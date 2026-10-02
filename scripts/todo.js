#!/usr/bin/env node
'use strict';

// The one writer of TODO entry files, a thin wrapper over lib/todo.js.
//
//   node todo.js list    [--root <dir>]
//   node todo.js new     --label <w> --title <t> --description <d> --state <s> --body <text>
//                        [--link <path>] [--group <title> --timing <cond> --stamp YYYY-MM-DD] [--id <id>]
//   node todo.js done    <id> --sha <sha> [--session <id>] [--disposition done] [--at YYYY-MM-DD]
//   node todo.js migrate [--root <dir>]

const { parseArgs } = require('node:util');

const fs = require('node:fs');
const { checkFile } = require('./docs-check.js');
const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');

const USAGE = [
    'usage: todo.js list | new --label --title --description --state --body [--link --group --timing --stamp --id]',
    '       | done <id> --sha <sha> [--session <id>] [--disposition done] | migrate    [--root <dir>]',
].join('\n');

const FLAGS = ['root', 'label', 'title', 'description', 'state', 'body', 'link', 'group', 'timing', 'stamp', 'id',
    'sha', 'session', 'disposition', 'at'];

function main(argv, now) {
    const at = now === undefined ? Date.now() : now;
    const options = {};
    for (const f of FLAGS) options[f] = { type: 'string' };
    const { values, positionals } = parseArgs({ args: argv, strict: false, allowPositionals: true, options });
    const str = (k) => (typeof values[k] === 'string' ? values[k] : '');
    const root = resolveRoot(str('root') || undefined);
    const [cmd, arg] = positionals;
    try {
        if (cmd === 'list') {
            const loaded = todo.load(root, at);
            if (!loaded || loaded.mode !== 'folder') {
                return { text: 'fankeel todo: no todo folder under ' + root + ' — list reads entry files only', ok: false };
            }
            const open = loaded.all.filter((e) => e.state !== 'done');
            const lines = open.map((e) => e.state + ' ' + e.id + ' — ' + e.title);
            lines.push(open.length + ' open');
            return { text: lines.join('\n'), ok: true };
        }
        if (cmd === 'new') {
            const state = str('state') || 'decision';
            const body = str('body');
            if (!body.trim()) {
                return { text: 'fankeel todo: --body <text> is required — where it came from, what it should become,'
                    + ' and what counts as done', ok: false };
            }
            const n = todo.bodyChars(body);
            if (n < todo.MIN_BODY_CHARS) {
                return { text: 'fankeel todo: --body is ' + n + ' characters, at least ' + todo.MIN_BODY_CHARS
                    + ' — where it came from, what it should become, and what counts as done', ok: false };
            }
            const made = todo.add(root, {
                id: str('id'), label: str('label'), title: str('title'), description: str('description'), state,
                link: str('link'), group: str('group'), timing: str('timing'), body,
                stamp: str('stamp') || (state === 'blocked' || state === 'watch' ? todo.isoDay(at) : ''),
            });
            // docs-check-1: an open entry is checked as a reference page is the
            // moment it is filed — a path that is gone, a symbol nothing
            // declares, a cited line that no longer holds its quote — and
            // refused, with its file removed, rather than read later with
            // confidence. A file still to be written is named without backticks.
            const found = checkFile(root, made.file, 'todo');
            if (found.length) {
                fs.unlinkSync(made.path);
                return { text: ['fankeel todo: not filed — the entry names what the tree does not have:']
                    .concat(found.map((f) => '  ' + f.tag + ': ' + f.what)).join('\n'), ok: false };
            }
            return { text: 'fankeel todo: ' + made.file, ok: true };
        }
        if (cmd === 'done') {
            if (!arg) return { text: USAGE, ok: false };
            const shut = todo.close(root, arg, { sha: str('sha'), session: str('session'),
                disposition: str('disposition'), at: str('at') || todo.isoDay(at) });
            return { text: 'fankeel todo: closed ' + shut.file, ok: true };
        }
        if (cmd === 'migrate') {
            const r = todo.migrate(root, at);
            const lines = ['fankeel todo migrate: ' + r.open + ' open, ' + r.done + ' done, ' + r.left.length
                + ' not migrated, TODO.md removed' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];
            for (const l of r.left) lines.push('  TODO.md:' + l.line + '  ' + l.text);
            for (const w of r.warned) lines.push('  could not date ' + w.sha + ': ' + w.why + ' — used today');
            return { text: lines.join('\n'), ok: true };
        }
    } catch (e) {
        return { text: 'fankeel todo: ' + e.message, ok: false };
    }
    return { text: USAGE, ok: false };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { main };
