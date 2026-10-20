'use strict';
// lib/shells.js: a session's background shells, paired from its transcript and
// read from the tail of each `<id>.output` (design 2026-10-21-station-focus §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const shells = require('../lib/shells.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const T0 = Date.parse('2026-10-21T00:00:00.000Z');
const at = (m) => new Date(T0 + m * 60000).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const launch = (use, command, when) => line({ type: 'assistant', timestamp: when,
    message: { content: [{ type: 'tool_use', id: use, name: 'Bash', input: { command, run_in_background: true } }] } });
const started = (use, id, when) => line({ type: 'user', timestamp: when,
    message: { content: [{ type: 'tool_result', tool_use_id: use, content: 'Command running in background with ID: ' + id }] },
    toolUseResult: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } });
// A foreground call: never a shell row.
const plain = line({ type: 'assistant', timestamp: at(0), message: { content: [{ type: 'tool_use', id: 'u0', name: 'Bash', input: { command: 'ls' } }] } })
    + line({ type: 'user', timestamp: at(0), message: { content: [{ type: 'tool_result', tool_use_id: 'u0', content: 'a.js' }] }, toolUseResult: { stdout: 'a.js', stderr: '' } });

// [use, id, command, minute] per launch; outputs: id -> text, a missing id has no file.
function session(launches, outputs) {
    const base = tmp('fankeel-shells-');
    const proj = path.join(base, 'projects', 'F--ws');
    fs.mkdirSync(proj, { recursive: true });
    const transcript = path.join(proj, SID + '.jsonl');
    fs.writeFileSync(transcript, plain + launches.map(([use, id, cmd, m]) => launch(use, cmd, at(m)) + started(use, id, at(m))).join(''));
    const tasks = path.join(base, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    for (const [id, text] of Object.entries(outputs)) fs.writeFileSync(path.join(tasks, id + '.output'), text);
    // An agent's output in the same directory: no transcript pairs it, so it is never a row.
    fs.writeFileSync(path.join(tasks, 'a0000000000000001.output'), '');
    return { transcript, tasks };
}

test('parseTail reads the last exit line, past a trailing cwd note; no line is running, [killed] is ended with no code', () => {
    assert.deepEqual(shells.parseTail('ok\n[exited with code 0]\n'), { ended: true, code: 0 });
    assert.deepEqual(shells.parseTail('x\n[exited with code 2]\nShell cwd was reset to F:\\ws\n'), { ended: true, code: 2 });
    assert.deepEqual(shells.parseTail('echo [exited with code 9]\n[exited with code 1]\n'), { ended: true, code: 1 });
    assert.deepEqual(shells.parseTail('still going\n'), { ended: false, code: null });
    assert.deepEqual(shells.parseTail(''), { ended: false, code: null });
    assert.deepEqual(shells.parseTail('x\n[killed]\n'), { ended: true, code: null });
});

test('tasksDirOf is <tmp>/claude/<the transcript\'s project directory>/<session>/tasks', () => {
    const transcript = path.join('C:', 'cfg', 'projects', 'F--ws', SID + '.jsonl');
    assert.equal(shells.tasksDirOf(transcript, SID), path.join(os.tmpdir(), 'claude', 'F--ws', SID, 'tasks'));
});

test('shellsOf: running first, then the newest two ended; a vanished output is ended with no code; a foreground call is no row', () => {
    const s = session([
        ['u1', 'b1', 'sleep 60', 1],
        ['u2', 'b2', 'node scripts/suite.js', 2],
        ['u3', 'b3', 'npm test', 3],
        ['u4', 'b4', 'gone', 4],
    ], {
        b1: 'done\n[exited with code 0]\n',
        b2: 'running\n',
        // The marker sits behind 5000 bytes of output and before a cwd note: only the tail is read.
        b3: 'x'.repeat(5000) + '\n[exited with code 1]\nShell cwd was reset to F:\\ws\n',
    });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks), [
        { id: 'b2', command: 'node scripts/suite.js', state: 'running', code: null, startedAt: at(2) },
        { id: 'b4', command: 'gone', state: 'ended', code: null, startedAt: at(4) },
        { id: 'b3', command: 'npm test', state: 'ended', code: 1, startedAt: at(3) },
    ]);
});

test('the three-row cut: four running shells show the newest three, and no ended one', () => {
    const s = session([['u1', 'b1', 'one', 1], ['u2', 'b2', 'two', 2], ['u3', 'b3', 'three', 3], ['u4', 'b4', 'four', 4], ['u5', 'b5', 'done', 5]],
        { b1: '', b2: '', b3: '', b4: '', b5: '[exited with code 0]\n' });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b4', 'b3', 'b2']);
    const row = (id, state, m) => ({ id, command: id, state, code: state === 'ended' ? 0 : null, startedAt: at(m) });
    assert.deepEqual(shells.cutShells([row('e1', 'ended', 1), row('r1', 'running', 2), row('e2', 'ended', 3), row('e3', 'ended', 4)]).map((r) => r.id),
        ['r1', 'e3', 'e2']);
    assert.deepEqual(shells.cutShells([]), []);
    // No running shell to tell the two limits apart: ENDED_ROWS (2) caps the ended ones, not ROWS (3).
    const ended = session([['u1', 'b1', 'one', 1], ['u2', 'b2', 'two', 2], ['u3', 'b3', 'three', 3]],
        { b1: '[exited with code 0]\n', b2: '[exited with code 0]\n', b3: '[exited with code 0]\n' });
    assert.deepEqual(shells.shellsOf(ended.transcript, ended.tasks).map((r) => r.id), ['b3', 'b2']);
});

test('a transcript shorter than the read offset was rewritten and is read whole', () => {
    const s = session([['u1', 'b1', 'first', 1], ['u2', 'b2', 'second', 2]], { b1: '', b2: '', b9: '' });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b2', 'b1']);
    fs.writeFileSync(s.transcript, launch('u9', 'fresh', at(9)) + started('u9', 'b9', at(9)));
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b9']);
});

test('a transcript read once is read on from where it stopped, and a line still being written waits for its newline', () => {
    const s = session([['u1', 'b1', 'first', 1]], { b1: '', b2: '' });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b1']);
    const more = launch('u2', 'second', at(2)) + started('u2', 'b2', at(2));
    fs.appendFileSync(s.transcript, more.slice(0, -10));
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b1']);
    fs.appendFileSync(s.transcript, more.slice(-10));
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b2', 'b1']);
});

test('a shell whose output gains its exit line is read as ended on the next call', () => {
    const s = session([['u1', 'b1', 'sleep 5', 1]], { b1: 'working\n' });
    assert.equal(shells.shellsOf(s.transcript, s.tasks)[0].state, 'running');
    fs.appendFileSync(path.join(s.tasks, 'b1.output'), '[exited with code 3]\n');
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks)[0], { id: 'b1', command: 'sleep 5', state: 'ended', code: 3, startedAt: at(1) });
});

test('no transcript is no shells', () => {
    assert.deepEqual(shells.shellsOf(path.join(tmp('fankeel-shells-none-'), SID + '.jsonl'), tmp('fankeel-shells-none-')), []);
});
