'use strict';
// The focus page's payload (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// lib/station.js `focusOf` reads one session's entry, claimed plan, ledger and
// handoff — never a transcript — and holds its answer while those files keep
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
