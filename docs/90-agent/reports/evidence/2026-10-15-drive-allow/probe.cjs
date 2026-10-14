'use strict';
// Which flag lets `claude -p --permission-mode acceptEdits` write under
// .fankeel/build/: one Write per arm, a file on disk or not. 2026-10-15, for
// docs/90-agent/todo/session-3.md.
// usage: node probe.cjs <repo root> <out dir>
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error('usage: node probe.cjs <repo root> <out dir>'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const RULE = 'Edit(.fankeel/build/**)';
const settings = path.join(out, 'allow.json');
fs.writeFileSync(settings, JSON.stringify({ permissions: { allow: [RULE] } }, null, 2) + '\n');
const abs = path.resolve(root);
const copy = path.join(os.tmpdir(), 'fankeel-probe-plugin');
fs.rmSync(copy, { recursive: true, force: true });
const wt = cp.spawnSync('git', ['-C', abs, 'worktree', 'add', '--detach', copy, 'HEAD'], { encoding: 'utf8' });
const ARMS = {
    control: [], settings: ['--settings', settings], allowedTools: ['--allowedTools', RULE],
    isolated: ['--setting-sources', 'user'], plugin: ['--plugin-dir', abs],
    isolatedAllowed: ['--setting-sources', 'user', '--allowedTools', RULE],
    pluginPlain: ['--plugin-dir', abs], pluginAllowed: ['--plugin-dir', abs, '--allowedTools', RULE],
    pluginElsewhere: ['--plugin-dir', copy],
};
// these arms write the handoff's own shape, as the refused 10-15 run did
const TASK_SHAPE = ['plugin', 'pluginAllowed', 'pluginElsewhere'];
for (const [arm, extra] of Object.entries(ARMS)) {
    if (arm === 'pluginElsewhere' && wt.status !== 0) { console.log(arm + '\tskipped'); continue; }
    const sub = TASK_SHAPE.includes(arm) ? 'task-20990101T000000' : 'probe-' + arm;
    const file = TASK_SHAPE.includes(arm) ? 'build.md' : 'x.md';
    const rel = '.fankeel/build/' + sub + '/' + file;
    const dir = path.join(root, '.fankeel', 'build', sub);
    fs.rmSync(dir, { recursive: true, force: true });
    const args = ['-p', '--model', 'haiku', '--permission-mode', 'acceptEdits', '--output-format', 'json'].concat(extra);
    const r = cp.spawnSync('claude', args, { cwd: root, input: 'Use the Write tool to create the file ' + rel + ' containing the single word ok. Do nothing else.',
        encoding: 'utf8', timeout: 180000, shell: process.platform === 'win32' });
    fs.writeFileSync(path.join(out, arm + '.json'), r.stdout || '');
    let denials = '?';
    try { denials = JSON.parse(r.stdout).permission_denials.length; } catch (e) { /* not json */ }
    console.log(arm + '\twritten ' + fs.existsSync(path.join(dir, file)) + '\tdenials ' + denials + '\texit ' + r.status);
    fs.rmSync(dir, { recursive: true, force: true });
}
if (wt.status === 0) cp.spawnSync('git', ['-C', abs, 'worktree', 'remove', '--force', copy]);
