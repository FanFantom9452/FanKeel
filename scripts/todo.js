#!/usr/bin/env node
'use strict';

// The one writer of TODO entry files, a thin wrapper over lib/todo.js.
//
//   node todo.js index   [--root <dir>]
//   node todo.js new     --label <w> --title <t> --description <d> --state <s>
//                        [--link <path>] [--group <title> --timing <cond> --stamp YYYY-MM-DD] [--id <id>]
//   node todo.js done    <id> --sha <sha> [--session <id>] [--disposition done] [--at YYYY-MM-DD]
//   node todo.js migrate [--root <dir>]

const path = require('node:path');
const { parseArgs } = require('node:util');

const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');

const USAGE = [
    'usage: todo.js index | new --label --title --description --state [--link --group --timing --stamp --id]',
    '       | done <id> --sha <sha> [--session <id>] [--disposition done] | migrate    [--root <dir>]',
].join('\n');

const FLAGS = ['root', 'label', 'title', 'description', 'state', 'link', 'group', 'timing', 'stamp', 'id',
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
        if (cmd === 'index') {
            todo.writeIndex(root);
            return { text: 'fankeel todo: wrote ' + path.join(root, 'TODO.md'), ok: true };
        }
        if (cmd === 'new') {
            const state = str('state') || 'decision';
            const made = todo.add(root, {
                id: str('id'), label: str('label'), title: str('title'), description: str('description'), state,
                link: str('link'), group: str('group'), timing: str('timing'),
                stamp: str('stamp') || (state === 'blocked' || state === 'watch' ? todo.isoDay(at) : ''),
            });
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
                + ' not migrated' + (r.left.length ? ' — under no known heading; re-add each with todo.js new:' : '')];
            for (const l of r.left) lines.push('  TODO.md:' + l.line + '  ' + l.text);
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
