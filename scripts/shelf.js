#!/usr/bin/env node
'use strict';
// node scripts/shelf.js run [--dry-run] [--days N] [--root <dir>]
// node scripts/shelf.js find <term>
// node scripts/shelf.js restore <id> [--root <dir>]
//
// Moves ended sessions older than --days (14) and their build directories to
// the config directory's shelf (lib/shelf.js). Nothing runs it automatically.
const path = require('node:path');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const shelf = require('../lib/shelf.js');

function fail(msg) {
    console.error(msg);
    return 2;
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { 'dry-run': { type: 'boolean' }, days: { type: 'string' }, root: { type: 'string' } } });
    } catch (err) {
        return fail(err.message);
    }
    const { values, positionals } = parsed;
    const root = values.root ? path.resolve(values.root) : registry.rootFor({});
    const [cmd, arg] = positionals;
    if (cmd === 'run') {
        // Number('') is 0, which would shelve every ended session; only digits pass.
        if (values.days !== undefined && !/^\d+$/.test(values.days)) return fail('shelf: --days takes a whole number of days.');
        const days = values.days === undefined ? undefined : Number(values.days);
        const dry = values['dry-run'] === true;
        const r = shelf.run(root, { days, dryRun: dry });
        console.log('shelf: ' + (dry ? 'would move ' : 'moved ') + r.sessions + ' session(s), ' + r.builds + ' build dir(s)' + (dry ? '' : ', ' + r.files + ' file(s)') + ' → ' + shelf.shelfDir(root));
        for (const k of r.kept) console.log('  kept, the copy did not match: ' + k);
        if (r.indexError) console.log('  index not written: ' + r.indexError);
        return r.kept.length ? 1 : 0;
    }
    if (cmd === 'find' && arg) {
        const rows = shelf.find(arg);
        for (const r of rows) console.log(r.id + '  ' + r.stage + '  ' + r.task + '  ' + r.file);
        if (!rows.length) console.log('shelf: nothing on the shelf matches ' + arg);
        return 0;
    }
    if (cmd === 'restore' && arg) {
        if (!shelf.restore(root, arg)) return fail('shelf: ' + arg + ' is not on the shelf for ' + root);
        console.log('shelf: restored ' + arg);
        return 0;
    }
    return fail('usage: shelf.js run [--dry-run] [--days N] | find <term> | restore <id>');
}

process.exitCode = main(process.argv.slice(2));
