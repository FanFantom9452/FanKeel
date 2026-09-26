#!/usr/bin/env node
'use strict';
// scripts/context.js: the task's exchange of verified facts,
// `.fankeel/build/task-<started>/context.md`, one per line:
//
//   - <fact> — <path:line> @ <short sha>
//
//   node scripts/context.js add "<fact>" --at <path:line> --session <id> [--root <dir>]
//   node scripts/context.js show --session <id> [--root <dir>]
//
// The only writer. Any subagent may call it; the brief names the file's path
// and never its contents. `add` stamps `git rev-parse --short HEAD`, drops an
// exact duplicate, replaces the same fact read again at a new sha, and keeps
// the newest CAP lines. `show` marks a line whose sha is not HEAD `(舊)`: it
// may still be true, and a reader re-checks it rather than trusting it.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const { projectRootsFor } = require('../lib/docs.js');
const { contextPath } = require('../lib/handoff.js');

const CAP = 40;
const LINE = /^- (.+) — (\S+) @ ([0-9a-f]{4,40})$/;
const AT = /^[^\s]+:\d+(?:-\d+)?$/;

const lineOf = (e) => '- ' + e.fact + ' — ' + e.at + ' @ ' + e.sha;

function readEntries(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    return text.split(/\r?\n/).map((l) => LINE.exec(l)).filter(Boolean).map((m) => ({ fact: m[1], at: m[2], sha: m[3] }));
}

function add(file, entry) {
    const fact = String((entry && entry.fact) || '').replace(/\s+/g, ' ').trim();
    const at = String((entry && entry.at) || '').trim();
    const sha = String((entry && entry.sha) || '').trim();
    if (!fact) return { ok: false, reason: 'a fact needs its text' };
    if (!AT.test(at)) return { ok: false, reason: '--at is <path:line>, got ' + (at || 'nothing') };
    if (!/^[0-9a-f]{4,40}$/.test(sha)) return { ok: false, reason: 'no sha to stamp: is this a git repository?' };
    const entries = readEntries(file);
    if (entries.some((e) => e.fact === fact && e.at === at && e.sha === sha)) return { ok: true, added: false, dropped: 0, count: entries.length };
    const next = entries.filter((e) => !(e.fact === fact && e.at === at)).concat([{ fact, at, sha }]);
    const dropped = Math.max(0, next.length - CAP);
    const kept = next.slice(dropped);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, kept.map(lineOf).join('\n') + '\n');
    return { ok: true, added: true, dropped, count: kept.length };
}

// A sha is HEAD when either short form is a prefix of the other: git widens a
// short sha as the repository grows, and the same commit reads 7 or 9 long.
function show(file, head) {
    const h = String(head || '');
    return readEntries(file).map((e) => lineOf(e) + (h && (e.sha.startsWith(h) || h.startsWith(e.sha)) ? '' : ' (舊)'));
}

function headOf(dir) {
    try {
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return '';
    }
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
            at: { type: 'string' }, session: { type: 'string' }, root: { type: 'string' },
        } });
    } catch (e) {
        return { text: 'context: ' + e.message, code: 2 };
    }
    const { values, positionals } = parsed;
    const usage = 'usage: context.js add "<fact>" --at <path:line> --session <id> | show --session <id>';
    if (!values.session) return { text: 'context: --session <id> is required. ' + usage, code: 2 };
    const root = registry.resolveRoot(values.root);
    const mine = registry.readSession(root, values.session);
    const file = mine ? contextPath(root, mine) : null;
    if (!file) return { text: 'context: no task with a readable start for session ' + values.session + ' under ' + root, code: 2 };
    const project = projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
    if (positionals[0] === 'add') {
        const r = add(file, { fact: positionals.slice(1).join(' '), at: values.at, sha: headOf(project) });
        if (!r.ok) return { text: 'context: ' + r.reason + '. ' + usage, code: 2 };
        return { text: 'context: ' + (r.added ? 'added' : 'already there') + ' (' + r.count + '/' + CAP + (r.dropped ? ', oldest dropped' : '') + ') ' + file, code: 0 };
    }
    if (positionals[0] === 'show') {
        const lines = show(file, headOf(project));
        return { text: lines.length ? lines.join('\n') : 'context: none yet — ' + file, code: 0 };
    }
    return { text: 'context: ' + usage, code: 2 };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}

module.exports = { add, show, readEntries, main, CAP };
