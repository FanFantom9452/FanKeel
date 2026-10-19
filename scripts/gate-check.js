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

const fs = require('node:fs');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const { nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { readGate, patrolEntries } = require('../lib/handoff.js');

const USAGE = 'gate-check.js: usage: gate-check.js --session <id> [--root <dir>] <handoff file>';

// brain-1: on 2026-10-19 a verify gate went out with its adversary line saying
// the adversary had not come back yet. The line is the verify template's
// `- adversary: ...` (lib/stages.js), colon half- or full-width. Over the 160
// verify handoffs under .fankeel/build/ that carry one, these words hit the
// two genuinely unreturned ones and nothing else; a bare `pending` or `waiting`
// counts only as the whole answer, since a result can quote "nothing pending".
const ADVERSARY = /^\s*[-*]?\s*adversary\s*[:：]\s*(.+)$/im;
const UNRETURNED = /未回|尚未回|還沒回|沒有回來|結果未知|not (?:yet )?returned|has not returned|still running|^\s*(?:pending|waiting)\b/i;

function unreturned(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    const m = ADVERSARY.exec(text);
    return m && UNRETURNED.test(m[1]) ? m[1].trim() : null;
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: { session: { type: 'string' }, root: { type: 'string' } }, allowPositionals: true });
    } catch (e) {
        return { text: USAGE + ': ' + e.message, code: 2 };
    }
    const { session, root } = parsed.values;
    const files = parsed.positionals;
    if (!session || files.length !== 1) return { text: USAGE, code: 2 };
    const at = root ? registry.resolveRoot(root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(at, session);
    if (!mine || !mine.stage) return { text: 'gate-check.js: no session ' + session + ' with a stage under ' + at, code: 1 };
    const todo = require('../lib/plain.js').todoIds(at);
    const gate = readGate(files[0], nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor, ids: todo.ids, patrol: patrolEntries(at, mine) });
    const warn = todo.warning ? '\nwarning: ' + todo.warning : '';
    if (!gate) return { text: 'gate-check.js: no readable `json gate` block in ' + files[0] + warn, code: 1 };
    if (gate.invalid) return { text: 'gate-check.js: invalid at ' + gate.invalid + ': ' + gate.detail + warn, code: 1 };
    const pending = mine.stage === 'verify' ? unreturned(files[0]) : null;
    if (pending) {
        return { text: 'gate-check.js: the adversary line says it has not returned — "' + pending.slice(0, 120)
            + '". End your turn with `waiting` until it does, put what it defeated on that line, then run this again.' + warn, code: 1 };
    }
    return { text: 'gate ok' + warn, code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
