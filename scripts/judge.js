#!/usr/bin/env node
'use strict';

// Files what a `fankeel-judge` subagent answered. The judge is read-only by
// construction, so the parent session is the one that writes — and what it
// writes is what it received, verbatim: the brief it sent and the answer that
// came back. A record is never overwritten; a second on the same slug gets -2.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const { posix } = require('../lib/tracked.js');
const page = require('../lib/judgepage.js');
const askhuman = require('../lib/askhuman.js');

const STATION_CSS = path.join(__dirname, '..', 'assets', 'station', 'station.css');

// A literal options table, the same shape `scripts/docs-check.js` already
// writes its own in. `lib/skills.js`'s `acceptedFlags()` reads this shape (and
// two others) straight off the source text, so a flag table built from a name
// array at runtime — the previous shape here — reads as no table at all, and
// every flag on a line naming this script then fails the unknown-flag gate.
const OPTIONS = {
    session: { type: 'string' },
    brief: { type: 'string' },
    answer: { type: 'string' },
    transcript: { type: 'string' },
    slug: { type: 'string' },
    model: { type: 'string' },
    root: { type: 'string' },
    project: { type: 'string' },
    record: { type: 'string' },
    answers: { type: 'string' },
};

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

function parse(argv) {
    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options: OPTIONS });
    for (const f of Object.keys(OPTIONS)) if (values[f] !== undefined && typeof values[f] !== 'string') fail('--' + f + ' needs a value.');
    return { verb: positionals[0], file: positionals[1], opts: values };
}

function readAnswer(spec) {
    if (spec === '-') return fs.readFileSync(0, 'utf8');
    return fs.readFileSync(spec, 'utf8');
}

// A judge hands back through a SubagentHandback call when it has one: the call's
// message is the judgement, and the text after it is only "handing back now".
// Without one, the answer is the last assistant text. Filed on 2026-10-19 as
// that one trailing line, because the skill said "the last assistant message".
function answerFromTranscript(file) {
    let handback = null;
    let text = '';
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        const content = entry && entry.type === 'assistant' && entry.message && entry.message.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
            if (c.type === 'tool_use' && c.name === 'SubagentHandback' && c.input && typeof c.input.message === 'string') handback = c.input.message;
        }
        const said = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        if (said.trim()) text = said;
    }
    return handback !== null ? handback : text;
}

function freePath(dir, base) {
    let file = path.join(dir, base + '.md');
    for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, base + '-' + n + '.md');
    return file;
}

function firstLine(text) {
    const line = text.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) || '';
    return line.length > 120 ? line.slice(0, 117) + '…' : line;
}

// The index is hand-maintained, so the row is appended under the heading
// Task 3 of the plan created. No heading means no index to keep, and the
// record is still written — the audit's "documents the index never learned
// about" is the safety net there.
function indexRow(indexFile, question, rel, judged, model) {
    if (!fs.existsSync(indexFile)) return false;
    const text = fs.readFileSync(indexFile, 'utf8');
    const at = text.indexOf('## Judgements');
    if (at < 0) return false;
    const tableEnd = (() => {
        const after = text.slice(at);
        const lines = after.split('\n');
        let i = 0;
        while (i < lines.length && !lines[i].startsWith('|')) i++;
        while (i < lines.length && lines[i].startsWith('|')) i++;
        return at + lines.slice(0, i).join('\n').length;
    })();
    const row = '\n| ' + question.replace(/\|/g, '\\|') + ' | [' + rel + '](' + rel + ') — *judged ' + judged.slice(0, 10) + ', ' + model + '* |';
    fs.writeFileSync(indexFile, text.slice(0, tableEnd) + row + text.slice(tableEnd));
    return true;
}

// judge-5: the page beside a record, `<record>.html`, in the station's look.
function writePage(file) {
    return page.pageOf(fs.readFileSync(file, 'utf8'), { stationCss: fs.readFileSync(STATION_CSS, 'utf8') }).then((html) => {
        const out = file.replace(/\.md$/, '') + '.html';
        fs.writeFileSync(out, html);
        return out;
    });
}

function record(opts) {
    if (!opts.session) fail('--session <id> is required: the record names the session that asked.');
    if (!opts.brief || !opts.slug || !opts.answer === !opts.transcript) fail('record needs --brief <path>, --slug <a-z0-9-> and one of --answer <path|-> or --transcript <agent-<id>.jsonl>.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.slug)) fail('--slug is lowercase ascii, digits and dashes.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    const brief = fs.readFileSync(opts.brief, 'utf8');
    const answer = opts.transcript ? answerFromTranscript(opts.transcript) : readAnswer(opts.answer);
    // Filed on 2026-09-11 with nothing under `## Answer`: the answer came from a
    // background agent's `tasks/<id>.output`, which is 0 bytes, and this exited 0.
    if (!answer.trim()) fail('The answer is empty, so there is nothing to record. A background judge\'s answer is the last assistant message in <session>/subagents/agent-<id>.jsonl; its tasks/<id>.output is 0 bytes.');
    // The judge's shape opens with `pick:` (agents/fankeel-judge.md); without it
    // what was piped is not the judgement, whatever else it says.
    if (!/^pick:/m.test(answer)) fail('The answer has no pick: line, so it is not what the judge answered. Pass --transcript <session>/subagents/agent-<id>.jsonl and record takes the SubagentHandback message, or the last assistant text where there is none.');
    const asks = askhuman.parse(answer);
    const askProblem = askhuman.problem(asks);
    if (askProblem) fail('The ask human: block is malformed, so nothing was filed. ' + askProblem);
    const human = asks.questions.length > 0;
    const judged = new Date().toISOString();
    const model = opts.model || 'fable';
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)judgements$/.test(b.path));
    const dir = path.join(projectRoot, ...(bucket ? bucket.path : 'docs/judgements').split('/'));
    fs.mkdirSync(dir, { recursive: true });
    const file = freePath(dir, judged.slice(0, 10) + '-' + opts.slug);
    const body = [
        '---',
        'judged: ' + judged,
        'model: ' + model,
        'agent: fankeel-judge',
        'task: ' + JSON.stringify(mine.task || ''),
        'session: ' + opts.session,
        'stage: ' + (mine.stage || ''),
        'human: ' + (human ? 'yes' : 'no'),
        '---',
        '',
        '# ' + firstLine(brief),
        '',
        '## Question',
        '',
        brief.trimEnd(),
        '',
        '## Answer',
        '',
        answer.trimEnd(),
        '',
    ].join('\n');
    fs.writeFileSync(file, body);
    const indexFile = path.join(projectRoot, 'docs', 'README.md');
    const rel = posix(path.relative(path.dirname(indexFile), file));
    const indexed = indexRow(indexFile, firstLine(brief), rel, judged, model);
    // judge-5: the judge's own plain words go back to the session, so the
    // user reads the pick and why without opening the file.
    const plain = page.plainOf(answer);
    const lines = [
        'fankeel — judgement filed: ' + file,
        indexed ? 'index row: ' + indexFile : 'no ## Judgements table in ' + indexFile + '; add the row by hand',
        plain ? 'plain:\n' + plain : 'plain: none — the answer has no ## 白話 section; the judgement is in the file',
    ];
    // A judgement that asks a person is read on the page, so it is always paged.
    if (human) lines.push('questions: ' + JSON.stringify(askhuman.questionsOf(asks)));
    if (!human && !page.wantsHtml(brief)) return lines.join('\n');
    return writePage(file).then((out) => lines.concat((human ? 'page: ' : 'html: ') + out).join('\n'));
}

// The answers the person gave AskUserQuestion, appended under `## 人類的回答`
// once. A record that is already answered is never answered again: a second
// question out of the same judgement is a second judgement (--record on a new one).
function answered(opts) {
    if (!opts.session) fail('--session <id> is required: the record names the session that asked.');
    if (!opts.record || !opts.answers) fail('answered needs --record <judgement.md> and --answers <path|->.');
    const file = path.resolve(opts.record);
    if (!fs.existsSync(file)) fail('answered: no record at ' + file);
    const text = fs.readFileSync(file, 'utf8');
    const asks = askhuman.parse(text);
    if (!asks.questions.length) fail('This record has no ask human: questions, so there is nothing to answer.');
    if (askhuman.parseAnswered(text)) fail('This record already has ## 人類的回答; it is answered once.');
    const fm = docs.frontmatter(text) || {};
    if (fm.session !== opts.session) fail('This record belongs to session ' + (fm.session || 'unknown') + ', not ' + opts.session + '.');
    let answers;
    try {
        answers = JSON.parse(readAnswer(opts.answers));
    } catch (e) {
        fail('--answers is not JSON: ' + e.message);
    }
    const { rows, decision, missing } = askhuman.answersOf(asks, answers);
    if (missing.length) fail('No answer for: ' + missing.map((q) => '「' + q + '」').join('；') + '. Nothing was filed.');
    const section = askhuman.sectionOf(rows, decision.replace('<path>', () => file), new Date().toISOString());
    fs.writeFileSync(file, text.trimEnd() + '\n\n' + section + '\n');
    const lines = ['decision: ' + decision];
    const sidecar = file.replace(/\.md$/, '') + '.html';
    if (!fs.existsSync(sidecar)) return lines.join('\n');
    return writePage(file).then((out) => lines.concat('page: ' + out).join('\n'));
}

function main(argv) {
    const { verb, file, opts } = parse(argv);
    if (verb === 'html') {
        if (!file || !fs.existsSync(file)) fail('judge.js html <judgement.md>: name a record that exists.');
        return writePage(path.resolve(file)).then((out) => 'fankeel — judgement page: ' + out);
    }
    if (verb === 'answered') return answered(opts);
    if (verb !== 'record') fail('judge.js record --session <id> --brief <path> (--answer <path|-> | --transcript <jsonl>) --slug <slug> [--model <m>] [--root <dir>] [--project <dir>]\njudge.js answered --session <id> --record <judgement.md> --answers <path|->\njudge.js html <judgement.md>');
    return record(opts);
}

if (require.main === module) Promise.resolve(main(process.argv.slice(2))).then((out) => process.stdout.write(out + '\n'));

module.exports = { firstLine, freePath, indexRow, answerFromTranscript };
