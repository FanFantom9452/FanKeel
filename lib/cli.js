'use strict';

// The `node:util` parser every script here uses, with the one refusal they
// share. `strict: true` is what refuses an unrecognised flag; the shapes it
// throws for — an unknown option, or a declared flag given no value — become
// `<prog>: unknown argument <flag>` and exit 2, the message and code
// `scripts/station.js` has always used, so nothing piping stderr sees a change.

const { parseArgs } = require('node:util');

function parseArgsOrExit(prog, argv, options) {
    try {
        return parseArgs({ args: argv, options, allowPositionals: true, strict: true });
    } catch (e) {
        const bad = /'(--?[a-zA-Z0-9-]+)/.exec(e.message);
        process.stderr.write(prog + ': unknown argument ' + (bad ? bad[1] : String(e.message)) + '\n');
        process.exit(2);
    }
}

module.exports = { parseArgsOrExit };
