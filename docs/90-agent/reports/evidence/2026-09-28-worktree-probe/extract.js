#!/usr/bin/env node
'use strict';
// After run.sh: reads the outer agent's own transcript and says whether the
// result of its Agent call with isolation "worktree" — the text the model
// reads — names the worktree that call left behind.
// Usage: node extract.js <session id> <worktree-list.txt>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [sid, listFile] = process.argv.slice(2);
const config = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const projects = path.join(config, 'projects');

// One level of project directories, never a recursive walk.
const transcripts = [];
for (const slug of fs.readdirSync(projects)) {
    const sub = path.join(projects, slug, sid, 'subagents');
    let names = [];
    try { names = fs.readdirSync(sub); } catch (e) { continue; }
    for (const n of names) if (/^agent-.*\.jsonl$/.test(n)) transcripts.push(path.join(sub, n));
}

const textOf = (content) => (typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((c) => (c && c.type === 'text' ? c.text : '')).join('\n') : '');

const calls = [];
for (const file of transcripts) {
    const uses = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
        let row;
        try { row = JSON.parse(line); } catch (e) { continue; }
        const content = row.message && Array.isArray(row.message.content) ? row.message.content : [];
        for (const c of content) {
            if (c.type === 'tool_use' && (c.name === 'Agent' || c.name === 'Task')) uses.set(c.id, { file: path.basename(file), input: c.input });
            if (c.type === 'tool_result' && uses.has(c.tool_use_id)) {
                calls.push(Object.assign({}, uses.get(c.tool_use_id), {
                    resultText: textOf(c.content),
                    structured: row.toolUseResult === undefined ? null : row.toolUseResult,
                }));
            }
        }
    }
}

// `git worktree list --porcelain`: blank-line separated; the first is the main tree.
const worktrees = fs.readFileSync(listFile, 'utf8').split(/\r?\n\r?\n/).map((b) => {
    const wt = /^worktree (.+)$/m.exec(b);
    const br = /^branch refs\/heads\/(.+)$/m.exec(b);
    return wt ? { path: wt[1].trim(), branch: br ? br[1].trim() : null } : null;
}).filter(Boolean).slice(1);

// What the model reads is `resultText`; `structured` is recorded but does not decide.
const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();
const isolated = calls.filter((c) => c.input && c.input.isolation === 'worktree');
const seen = (pick) => isolated.some((c) => worktrees.some((w) => pick(w) && norm(c.resultText).includes(norm(pick(w)))));
const pathInResult = seen((w) => w.path);
const branchInResult = seen((w) => w.branch);
const readable = !isolated.length || !worktrees.length ? 'inconclusive' : (pathInResult ? 'yes' : 'no');
process.stdout.write(JSON.stringify({ sid, transcripts: transcripts.map((f) => path.basename(f)), calls, worktrees, pathInResult, branchInResult, readable }, null, 2) + '\n');
