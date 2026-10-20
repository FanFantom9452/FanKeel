'use strict';
// The focus page's payload (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// lib/station.js `focusOf` reads one session's entry, claimed plan, ledger and
// handoff — a transcript only for an active session's shells — and holds its answer while those files keep
// their mtimes. `focusShell` is the page that loads it instead of station-data.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const plantasks = require('../lib/plantasks.js');
const handoff = require('../lib/handoff.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'ffffffff-6666-4666-8666-666666666666';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const TASKS = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length;

// A registry holding one session that claims a copy of a real plan; its
// configDir names a directory with no transcripts in it.
function fixture(extra) {
    const root = tmp('fankeel-focus-');
    registry.ensureLayout(root);
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    const data = Object.assign({ active: true, task: 'focus fixture', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: path.join(root, 'no-config') }, extra);
    registry.writeSession(root, SID, data);
    return { root, data };
}

test('focusOf reads the plan and the gate report with no transcript anywhere', () => {
    const f = fixture({ stage: 'survey' });
    const dir = handoff.dirFor(f.root, f.data);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'survey.md'), 'what is already here\n');
    const got = station.focusOf(f.root, SID, {});
    assert.equal(got.row.sessionId, SID);
    assert.equal(got.row.task, 'focus fixture');
    assert.equal(got.row.detail, null, 'no transcript detail was read');
    assert.equal(got.detail.tasks.length, 1);
    assert.equal(got.detail.tasks[0].tasks.length, TASKS);
    assert.equal(got.detail.gate.stage, 'survey');
    assert.match(got.detail.gate.path, /survey\.md$/);
});

test('focusOf answers null for an id with no entry, and for one that is not an id', () => {
    const f = fixture();
    assert.equal(station.focusOf(f.root, 'aaaaaaaa-1111-4111-8111-111111111111', {}), null);
    assert.equal(station.focusOf(f.root, '../x', {}), null);
});

test('an unchanged session answers from memory; a touched plan or entry is read again', () => {
    const f = fixture();
    const memo = new Map();
    const first = station.focusOf(f.root, SID, { memo });
    assert.equal(station.focusOf(f.root, SID, { memo }), first);
    const later = new Date(Date.now() + 60e3);
    fs.utimesSync(path.join(f.root, 'docs', 'plans', 'x.md'), later, later);
    const second = station.focusOf(f.root, SID, { memo });
    assert.notEqual(second, first);
    assert.equal(station.focusOf(f.root, SID, { memo }), second);
    registry.writeSession(f.root, SID, Object.assign({}, f.data, { task: 'renamed' }));
    const later2 = new Date(Date.now() + 120e3);
    fs.utimesSync(registry.sessionPath(f.root, SID), later2, later2);
    assert.equal(station.focusOf(f.root, SID, { memo }).row.task, 'renamed');
});

test('serializeFocus is one session row and its detail, in the globals the page reads', () => {
    const f = fixture();
    const js = station.serializeFocus(f.root, station.focusOf(f.root, SID, {}), { serve: true, nonce: 'n1', configDir: 'C:\\cfg' });
    const box = { window: {} };
    vm.runInNewContext(js, box);
    assert.equal(box.window.STATION.serve, true);
    assert.equal(box.window.STATION.sessions.length, 1);
    assert.equal(box.window.STATION.sessions[0].id, SID);
    assert.equal(box.window.STATION.sessions[0].stage, 'plan');
    assert.equal(box.window.STATION_DETAIL[SID].tasks[0].tasks.length, TASKS);
});

test('focusShell loads the focus script and never station-data.js; any other tab or id is null', () => {
    const html = station.focusShell(SID, 'plan');
    assert.ok(html.includes('<script src="/station/focus/' + SID + '.js"></script>'));
    assert.ok(html.includes('window.STATION_FOCUS = {"id":"' + SID + '","tab":"plan"};'));
    assert.ok(html.includes('<div id="focus"></div>'));
    for (const asset of ['/station/station.css', '/station/i18n.js', '/station/station.js']) assert.ok(html.includes(asset), asset);
    assert.ok(html.indexOf('/station/focus/') < html.indexOf('/station/station.js'), 'the data loads before the page script');
    assert.doesNotMatch(html, /station-data\.js/);
    assert.deepEqual(station.FOCUS_TABS, ['plan', 'gate']);
    assert.equal(station.focusShell(SID, 'dispatch'), null);
    assert.equal(station.focusShell('</script>', 'plan'), null);
});

// tests/station-shells.test.js machine(): a config dir holding this session's
// transcript with one background shell, and its output file under a temp dir
// that withTemp makes os.tmpdir() for the call.
function shellFixture(active) {
    const f = fixture({ active });
    const cfg = path.join(f.root, 'cfg');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(proj, { recursive: true });
    registry.writeSession(f.root, SID, Object.assign({}, f.data, { configDir: cfg }));
    const line = (o) => JSON.stringify(o) + '\n';
    const when = new Date(Date.now() - 60000).toISOString();
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), line({ type: 'assistant', timestamp: when,
        message: { content: [{ type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'sleep 60', run_in_background: true } }] } })
        + line({ type: 'user', timestamp: when, message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'running in background' }] },
            toolUseResult: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } }));
    const temp = path.join(f.root, 'temp');
    const tasks = path.join(temp, 'claude', 'ws-slug', SID, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    fs.writeFileSync(path.join(tasks, 'b1.output'), 'running\n');
    return { root: f.root, temp, tasks, when };
}

// os.tmpdir() reads these at call time: TEMP and TMP on Windows, TMPDIR elsewhere.
function withTemp(dir, fn) {
    const keep = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
    Object.assign(process.env, { TEMP: dir, TMP: dir, TMPDIR: dir });
    try {
        return fn();
    } finally {
        for (const [k, v] of Object.entries(keep)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

test('focusOf gives an inactive session no shells, even with shells in its transcript', () => {
    const s = shellFixture(false);
    const got = withTemp(s.temp, () => station.focusOf(s.root, SID, {}));
    assert.deepEqual(got.detail.shells, []);
});

test('an active session\'s shells reach detail.shells and STATION_DETAIL[id].shells', () => {
    const s = shellFixture(true);
    const got = withTemp(s.temp, () => station.focusOf(s.root, SID, {}));
    const want = [{ id: 'b1', command: 'sleep 60', state: 'running', code: null, startedAt: s.when }];
    assert.deepEqual(got.detail.shells, want);
    const box = { window: {} };
    vm.runInNewContext(station.serializeFocus(s.root, got, {}), box);
    // Through JSON: the vm context's arrays are not this realm's, which deepEqual tells apart.
    assert.deepEqual(JSON.parse(JSON.stringify(box.window.STATION_DETAIL[SID].shells)), want);
});

test('a memo hit reads the shells again: a shell that ended since is shown ended', () => {
    const s = shellFixture(true);
    const memo = new Map();
    const first = withTemp(s.temp, () => station.focusOf(s.root, SID, { memo }));
    assert.equal(first.detail.shells[0].state, 'running');
    fs.writeFileSync(path.join(s.tasks, 'b1.output'), 'done\n[exited with code 0]\n');
    const second = withTemp(s.temp, () => station.focusOf(s.root, SID, { memo }));
    assert.equal(second.detail.shells[0].state, 'ended');
    assert.equal(second.detail.shells[0].code, 0);
    assert.equal(second.detail.tasks, first.detail.tasks, 'answered from the memo, not read again');
});
