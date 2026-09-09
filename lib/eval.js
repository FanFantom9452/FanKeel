'use strict';
// One eval case, read and graded, with nothing that spends money in it.
//
// `evals/<case>/` is the layout `claude plugin eval` reads — case.yaml,
// prompt.md, graders/*.md — and this reads the same files so a case written
// for that runner needs no second copy to be run by scripts/eval.js. What it
// grades is a `--output-format stream-json` transcript: every tool call with
// its input, and the last message. `tool_used` and `regex` are enough for the
// one case that exists; `llm` needs a judge and is reported as skipped.

const fs = require('node:fs');
const path = require('node:path');
const { frontmatter } = require('./docs.js');

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?(?:\n|$)/;

// `[Read, Edit]`, `Read`, `` → an array. Enough YAML for a flow list.
function listValue(v) {
    const s = String(v == null ? '' : v).trim().replace(/^\[|\]$/g, '');
    return s.split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

// case.yaml holds one nested key worth reading: context.scaffold_script. A
// real YAML parser is a dependency, and the plugin has none.
function scaffoldOf(text) {
    const m = /^\s*scaffold_script\s*:\s*(.+)$/m.exec(String(text || ''));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
}

function readDoc(file) {
    const text = fs.readFileSync(file, 'utf8');
    return { meta: frontmatter(text) || {}, body: text.replace(FRONTMATTER, '') };
}

function parseCase(dir) {
    const promptFile = path.join(dir, 'prompt.md');
    if (!fs.existsSync(promptFile)) throw new Error('no prompt.md in ' + dir);
    const prompt = readDoc(promptFile);
    const yaml = path.join(dir, 'case.yaml');
    const scaffold = fs.existsSync(yaml) ? scaffoldOf(fs.readFileSync(yaml, 'utf8')) : null;
    const gdir = path.join(dir, 'graders');
    const graders = (fs.existsSync(gdir) ? fs.readdirSync(gdir) : [])
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => ({ name: f.replace(/\.md$/, ''), ...readDoc(path.join(gdir, f)) }));
    const name = prompt.meta.name || path.basename(dir);
    return { name, dir, prompt, scaffold, graders };
}

function parseLines(lines) {
    const out = [];
    for (const line of lines) {
        try { out.push(JSON.parse(line)); } catch (e) { /* a non-JSON line is noise, not a message */ }
    }
    return out;
}

function blocksOf(msg) {
    const c = msg && msg.message && msg.message.content;
    return Array.isArray(c) ? c : [];
}

function toolCalls(lines) {
    const calls = [];
    for (const msg of parseLines(lines)) {
        if (msg.type !== 'assistant') continue;
        for (const b of blocksOf(msg)) {
            if (b.type === 'tool_use') calls.push({ name: String(b.name || ''), input: b.input == null ? {} : b.input });
        }
    }
    return calls;
}

function lastMessage(lines) {
    const msgs = parseLines(lines);
    const res = msgs.find((m) => m.type === 'result');
    if (res && typeof res.result === 'string') return res.result;
    let last = '';
    for (const msg of msgs) {
        if (msg.type !== 'assistant') continue;
        for (const b of blocksOf(msg)) if (b.type === 'text' && typeof b.text === 'string') last = b.text;
    }
    return last;
}

// The same `type: 'result'` message lastMessage() reads carries the run's
// cost and token usage — contamination control 5 (docs/improvement-brief.md
// §5.3): reporting cost is what a runner with no budget check leaves out. A
// crash mid-run, or a transcript with no result line, has nothing to report.
function costOf(lines) {
    const res = parseLines(lines).find((m) => m.type === 'result');
    if (!res || typeof res.total_cost_usd !== 'number') return null;
    return { costUsd: res.total_cost_usd, usage: res.usage == null ? null : res.usage };
}

function toolUsed(g, run) {
    const tool = String(g.meta.tool || '');
    const re = g.meta.input_match ? new RegExp(g.meta.input_match) : null;
    const hits = run.calls.filter((c) => c.name === tool && (!re || re.test(JSON.stringify(c.input)))).length;
    const min = g.meta.min != null ? Number(g.meta.min) : (g.meta.max != null ? 0 : 1);
    const max = g.meta.max == null ? Infinity : Number(g.meta.max);
    const pass = hits >= min && hits <= max;
    const bound = hits < min ? hits + ' of min ' + min : hits > max ? hits + ' over max ' + max : hits + ' call' + (hits === 1 ? '' : 's');
    return { pass, detail: tool + (re ? ' matching ' + g.meta.input_match : '') + ': ' + bound };
}

// Every assistant text block, in order, one string. `target: trace` reads
// this: what the model said anywhere in the run, where `last_message` is only
// its final turn — and a route said out loud at the start is not in the final
// turn, which is what the first measured run showed.
function assistantText(lines) {
    const out = [];
    for (const msg of parseLines(lines)) {
        if (msg.type !== 'assistant') continue;
        for (const b of blocksOf(msg)) if (b.type === 'text' && typeof b.text === 'string') out.push(b.text);
    }
    return out.join('\n');
}

function regex(g, run) {
    const target = g.meta.target || 'last_message';
    let haystack;
    if (target === 'last_message') haystack = run.last;
    else if (target === 'trace') haystack = run.texts == null ? '' : run.texts;
    else return { pass: false, detail: 'regex target ' + target + ' is not supported here; only last_message and trace' };
    const re = new RegExp(String(g.meta.pattern || ''), String(g.meta.flags || ''));
    const found = re.test(haystack);
    const want = (g.meta.match || 'contains') === 'not_contains' ? !found : found;
    const where = target === 'trace' ? 'the trace' : 'the last message';
    return { pass: want, detail: (found ? 'found' : 'did not find') + ' /' + g.meta.pattern + '/ in ' + where };
}

function grade(g, run) {
    const type = String(g.meta.type || '');
    let r;
    if (type === 'tool_used') r = toolUsed(g, run);
    else if (type === 'regex') r = regex(g, run);
    else if (type === 'llm') r = { pass: null, detail: 'skipped: an llm grader needs claude plugin eval' };
    else r = { pass: false, detail: 'grader type ' + type + ' is not supported here' };
    return { name: g.name, type, pass: r.pass, detail: r.detail };
}

module.exports = { parseCase, listValue, toolCalls, lastMessage, costOf, assistantText, grade };
