'use strict';
// The focus shell loads the board pane, and the 5 s repaint leaves a board
// being edited alone (design §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const station = require('../lib/station.js');
const F = require('../assets/station/focus-page.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'focus-page.js'), 'utf8');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';

// focus-page.js in a window whose FK_BOARD.load fails the way a 404 or an
// offline station does: it records the error and asks for a repaint at once.
function gatePage() {
    const loads = [];
    const win = {
        FK_KIT: { esc: String, fillVars: (s) => s, gateTabHtml: () => '', shellsHtml: () => '', planNewest: () => null, keelProgress: () => '', stageNow: () => '' },
        FK_GATE: { frame: () => '<div></div>' },
        FK_BOARD: { load(s, nonce, repaint) { loads.push({ id: s.id, nonce }); if (loads.length < 5) repaint(); } },
    };
    vm.runInNewContext(SRC, { window: win, document: null });
    const draw = (s) => win.FK_FOCUS.page({ nonce: 'N', sessions: [s] }, {}, { id: SID, tab: 'gate' });
    return { win, loads, draw };
}

// A registry holding one session at a gate, its build directory made, as
// tests/station-focus.test.js builds one; no `boards` written by hand.
function gateFixture() {
    const root = tmp('fankeel-focus-board-');
    registry.ensureLayout(root);
    const data = { active: true, task: 'board fixture', stage: 'plan', route: ['survey', 'plan', 'build'],
        started: '2026-10-21T10:00:00.000Z', gateAt: 1, configDir: path.join(root, 'no-config') };
    registry.writeSession(root, SID, data);
    const dir = handoff.dirFor(root, data);
    fs.mkdirSync(dir, { recursive: true });
    return { root, dir };
}
const S = { id: SID, stage: 'plan', gateAt: 1, boards: [{ name: 'arch' }] };

test('the gate shell links board-edit.css and loads board-edit.js before gate-frame.js', () => {
    const html = station.focusShell(SID, 'gate');
    assert.match(html, /<link rel="stylesheet" href="\/station\/board-edit\.css">/);
    assert.ok(html.indexOf('/station/board-edit.js') > 0 && html.indexOf('/station/board-edit.js') < html.indexOf('/station/gate-frame.js'));
});

test('no repaint while the focus is inside the board pane', () => {
    const active = { tagName: 'BUTTON', closest: (sel) => (sel === '.bd' ? {} : null) };
    assert.equal(F.repaint('a', 'b', active), false);
});

test('a redraw the board asks for goes through with focus on its toolbar or editor, not over a field outside it', () => {
    const tool = { tagName: 'BUTTON', closest: (sel) => (sel === '.bd' ? {} : null) };
    const editor = { tagName: 'INPUT', closest: (sel) => (sel === '.bd' ? {} : null) };
    const answer = { tagName: 'TEXTAREA', closest: () => null };
    assert.equal(F.repaint('a', 'a', tool, true), true);
    assert.equal(F.repaint('a', 'b', editor, true), true);
    assert.equal(F.repaint('a', 'b', answer, true), false);
});

test('a board read that fails does not fetch again on the repaint it asks for', () => {
    const p = gatePage();
    p.win.FK_FOCUS_REDRAW = () => p.draw(S);
    p.draw(S);
    p.draw(S);
    assert.deepEqual(p.loads, [{ id: SID, nonce: 'N' }]);
});

test('the board is read again when the session reaches a new gate', () => {
    const p = gatePage();
    p.draw(S);
    p.draw(Object.assign({}, S, { gateAt: 2 }));
    assert.equal(p.loads.length, 2);
});

test('the plan tab never reads the board', () => {
    const p = gatePage();
    p.win.FK_FOCUS.page({ nonce: 'N', sessions: [S] }, {}, { id: SID, tab: 'plan' });
    assert.equal(p.loads.length, 0);
});

test('a *.board in the build directory reaches the real gate page and loads its pane', () => {
    const f = gateFixture();
    fs.writeFileSync(path.join(f.dir, 'arch.board'), '');
    const focus = station.focusOf(f.root, SID, {});
    assert.equal(focus.row.boards[0].name, 'arch');
    const box = { window: {} };
    vm.runInNewContext(station.serializeFocus(f.root, focus, { serve: true, nonce: 'N' }), box);
    const p = gatePage();
    p.win.FK_FOCUS.page(box.window.STATION, box.window.STATION_DETAIL, { id: SID, tab: 'gate' });
    assert.deepEqual(p.loads, [{ id: SID, nonce: 'N' }]);
});

test('a board added after the first read is seen on the next, with the same memo', () => {
    const f = gateFixture();
    const memo = new Map();
    assert.deepEqual(station.focusOf(f.root, SID, { memo }).row.boards, []);
    fs.writeFileSync(path.join(f.dir, 'arch.board'), '');
    assert.equal(station.focusOf(f.root, SID, { memo }).row.boards[0].name, 'arch');
});
