'use strict';
// hooks/pane-shell.ts: the Pane's background shells, pure (design 2026-10-21-station-focus §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-shell.ts')).href);
const NOW = Date.parse('2026-10-21T00:00:00.000Z');
const MIN = 60000;
const sh = (id, at, end = null, code = null) => ({ id, command: 'cmd ' + id, at, end, code });

test('parseTail reads the last exit line, past a trailing cwd note; none is running, [killed] is ended with no code', async () => {
    const m = await load();
    assert.equal(m.TAIL, 256);
    assert.deepEqual(m.parseTail('ok\n[exited with code 0]\n'), { ended: true, code: 0 });
    assert.deepEqual(m.parseTail('x\n[exited with code 2]\nShell cwd was reset to F:\\ws\n'), { ended: true, code: 2 });
    assert.deepEqual(m.parseTail('echo [exited with code 9]\n[exited with code 1]\n'), { ended: true, code: 1 });
    assert.deepEqual(m.parseTail('still going\n'), { ended: false, code: null });
    assert.deepEqual(m.parseTail('x\n[killed]\n'), { ended: true, code: null });
});

test('settle: an exit line ends the shell now with its code; no line leaves it running; an ended shell stays as it was', async () => {
    const m = await load();
    const s = sh('b1', NOW - MIN);
    assert.deepEqual(m.settle(s, 'out\n[exited with code 3]\n', NOW), { ...s, end: NOW, code: 3 });
    assert.equal(m.settle(s, 'out\n', NOW), s);
    const done = sh('b2', NOW - 5 * MIN, NOW - MIN, 0);
    assert.equal(m.settle(done, null, NOW), done);
});

test('settle: a vanished output file is ended with no code once the grace is past, and not before', async () => {
    const m = await load();
    assert.equal(m.GRACE_MS, 5000);
    const young = sh('b1', NOW - 1000);
    assert.equal(m.settle(young, null, NOW), young);
    const old = sh('b2', NOW - 6000);
    assert.deepEqual(m.settle(old, null, NOW), { ...old, end: NOW, code: null });
});

test('cutShells: running first, newest first, then at most the two newest ended, three rows at most', async () => {
    const m = await load();
    const list = [sh('r1', NOW - 4 * MIN), sh('e1', NOW - 30 * MIN, NOW - 18 * MIN, 0), sh('r2', NOW - MIN), sh('e2', NOW - 20 * MIN, NOW - 11 * MIN, 1)];
    assert.deepEqual(m.cutShells(list, NOW).map((s) => s.id), ['r2', 'r1', 'e2']);
    const ended = [sh('e1', NOW - 9 * MIN, NOW - 8 * MIN, 0), sh('e2', NOW - 7 * MIN, NOW - 6 * MIN, 0), sh('e3', NOW - 5 * MIN, NOW - 4 * MIN, 0)];
    assert.deepEqual(m.cutShells(ended, NOW).map((s) => s.id), ['e3', 'e2']);
    const four = [1, 2, 3, 4].map((i) => sh('r' + i, NOW - i * MIN));
    assert.deepEqual(m.cutShells(four, NOW).map((s) => s.id), ['r1', 'r2', 'r3']);
    assert.deepEqual(m.cutShells([], NOW), []);
});

test('cutShells keeps an ended shell for KEEP_MS after it ended, and no longer', async () => {
    const m = await load();
    assert.equal(m.KEEP_MS, 3600000);
    const list = [sh('fresh', NOW - 70 * MIN, NOW - 59 * MIN, 0), sh('stale', NOW - 90 * MIN, NOW - 61 * MIN, 0)];
    assert.deepEqual(m.cutShells(list, NOW).map((s) => s.id), ['fresh']);
});

test('remember replaces a shell by id, puts it last, and keeps the newest twenty', async () => {
    const m = await load();
    const list = Array.from({ length: 20 }, (_, i) => sh('b' + i, NOW - i));
    const got = m.remember(list, sh('b0', NOW));
    assert.equal(got.length, 20);
    assert.deepEqual(got[19], sh('b0', NOW));
    assert.equal(got.filter((s) => s.id === 'b0').length, 1);
    const more = m.remember(list, sh('new', NOW));
    assert.equal(more.length, 20);
    assert.equal(more[0].id, 'b1');
});

test('commandLine is the first line, with runs of space as one', async () => {
    const m = await load();
    assert.equal(m.commandLine('node  scripts/suite.js\t--fast\nsecond line'), 'node scripts/suite.js --fast');
    assert.equal(m.commandLine('  cd F:/ws &&  npm test  '), 'cd F:/ws && npm test');
});
