#!/usr/bin/env node
'use strict';

// gate-5: the check hooks/gate.js runs when the controller asks a stage
// agent's gate, run by the stage agent itself before it returns the path. On
// 2026-10-02/03 three gates — two with two options, one whose option one named
// no stage — were refused only at the controller's AskUserQuestion, each
// costing a SendMessage round. The stage, route and floor are the session's,
// read off its record the way hooks/gate-write.js reads them.
//
//   node gate-check.js --session <id> [--root <dir>] <handoff file>

const { parseArgs } = require('node:util');
const registry =require('../lib/registry.js');
const { nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { readGate } = require('../lib/handoff.js');

const USAGE = 'gate-check.js: usage: gate-check.js --session <id> [--root <dir>] <handoff file>';

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: { session: { type: 'string' }, root: { type: 'string' } }, allowPositionals: true });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const { session, root } = parsed.values;
    const files = parsed.positionals;
    if (!session || files.length !== 1) return { text: USAGE, code: 2 };
    const at = root ? registry.resolveRoot(root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(at, session);
    if (!mine || !mine.stage) return { text: 'gate-check.js: no session ' + session + ' with a stage under ' + at, code: 1 };
    const gate = readGate(files[0], nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor });
    if (!gate) return { text: 'gate-check.js: no readable `json gate` block in ' + files[0], code: 1 };
    if (gate.invalid) return { text: 'gate-check.js: invalid at ' + gate.invalid + ': ' + gate.detail, code: 1 };
    return { text: 'gate ok', code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
