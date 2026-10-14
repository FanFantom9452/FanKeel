'use strict';
// Times hooks/guard.js on PreToolUse Bash payloads, a fresh node per run, the
// way ../2026-10-05-inject-timing/probe.cjs times inject.js. 2026-10-15, for
// docs/90-agent/todo/hooks-1.md. The command is never run; guard.js only
// reads it.
// usage: node guard-probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [plugin, tree, out, session, runsArg] = process.argv.slice(2);
if (!plugin || !tree || !out || !session) {
    console.error('usage: node guard-probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]');
    process.exit(2);
}
const runs = Number(runsArg) || 5;
fs.mkdirSync(out, { recursive: true });
const CASES = {
    read: 'git status --short',
    write: 'echo probe > .fankeel/build/guard-probe.txt',
    commit: 'git commit --dry-run -m probe',
};
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
for (const [name, command] of Object.entries(CASES)) {
    const xs = [];
    for (let i = 0; i < runs; i++) {
        const payload = JSON.stringify({ session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: tree });
        const t0 = process.hrtime.bigint();
        const r = cp.spawnSync(process.execPath, [path.join(plugin, 'hooks', 'guard.js')], { input: payload, cwd: tree, encoding: 'utf8', timeout: 20000 });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        xs.push(ms);
        rows.push([name, i + 1, ms.toFixed(1), r.status, (r.stdout || '').length].join('\t'));
    }
    console.log(name + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
fs.writeFileSync(path.join(out, 'wall.tsv'), 'case\trun\tms\texit\tstdout\n' + rows.join('\n') + '\n');
