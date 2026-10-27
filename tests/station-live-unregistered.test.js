'use strict';
// station-57: the 進行中 page's unregistered sessions — newest first, labelled
// by name or the cwd's last folder, Desktop or CLI by how they started; the
// 未登記 card and the RC mark on rows with Remote Control attached (mockup-16,
// blocks live-unreg and live-rc).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

global.window = undefined;
const L = require('../assets/station/live-page.js');

const S = { sessions: [], unregistered: [
    { id: 'a', cwd: 'F:\\ymlab\\SBIR\\ProjectWorkspace', entrypoint: 'cli', name: '', status: 'idle', bridge: true, started: 1 },
    { id: 'b', cwd: 'F:\\ymlab\\fork\\Quick-IME', entrypoint: 'claude-desktop', name: 'Quick-IME tab', status: 'busy', bridge: false, started: 3 },
] };

test('unreg is newest first, with a label and how it started', () => {
    assert.deepEqual(L.unreg(S).map((u) => [u.id, u.label, u.via]), [['b', 'Quick-IME tab', 'Desktop'], ['a', 'ProjectWorkspace', 'CLI']]);
});

test('no unregistered field is an empty list', () => {
    assert.deepEqual(L.unreg({ sessions: [] }), []);
});

const NOW = 10 * 60000;
const reg = (id, bridge) => ({ id, pkey: 'p', task: 'T ' + id, route: ['survey', 'build'], stage: 'build', state: 'live', started: 1, updated: 2, bridge });
function draw(S2, lang) {
    const { win } = page(['tip.js', 'live-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    return win.FK_LIVE.page(S2, { names: {}, now: NOW });
}
const block = (html, name) => {
    const at = html.indexOf('data-block="' + name + '"');
    return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
};
const count = (s, re) => (s.match(re) || []).length;

test('the 未登記 card has one row per unregistered session, none a link', () => {
    const card = block(draw(S), 'live-unreg');
    assert.ok(card, 'live-unreg drawn');
    assert.equal(count(card, /class="hm-lv sxu"/g), L.unreg(S).length);
    assert.doesNotMatch(card, /<a /);
    assert.match(card, /F:\\ymlab\\fork\\Quick-IME/);
    assert.match(card, /lv-mk busy/);
    assert.match(card, /lv-mk idle/);
});

test('no unregistered session draws no 未登記 card', () => {
    assert.doesNotMatch(draw({ sessions: [reg('r1', true)] }), /data-block="live-unreg"/);
    assert.doesNotMatch(draw({ sessions: [], unregistered: [] }), /data-block="live-unreg"/);
});

test('the RC mark rides only rows whose session has Remote Control attached', () => {
    const html = draw({ sessions: [reg('r1', true), reg('r2', false)], unregistered: S.unregistered });
    const rowOf = (id) => { const at = html.indexOf('href="#/s/' + id + '"'); return html.slice(at, html.indexOf('</a>', at)); };
    assert.match(rowOf('r1'), /data-block="live-rc"/);
    assert.doesNotMatch(rowOf('r2'), /data-block="live-rc"/);
    assert.equal(count(block(html, 'live-unreg'), /data-block="live-rc"/g), 1);
    assert.equal(count(html, /data-block="live-rc"/g), 2);
});

test('in English the 未登記 card carries no CJK', () => {
    const card = block(draw(S, 'en'), 'live-unreg');
    assert.match(card, /Unregistered/);
    assert.doesNotMatch(card, /[\u3400-\u9fff]/);
});

// station-58 (3): a session named the same as its folder is named; only one with no name is dimmed.
test('unreg carries the name; a row dims only when the session has none', () => {
    const S2 = { sessions: [], unregistered: [
        { id: 'n', cwd: 'F:\\ymlab\\Quick-IME', entrypoint: 'cli', name: 'Quick-IME', status: 'idle', bridge: false, started: 2 },
        { id: 'u', cwd: 'F:\\ymlab\\Quick-IME', entrypoint: 'cli', name: '', status: 'idle', bridge: false, started: 1 },
    ] };
    assert.deepEqual(L.unreg(S2).map((u) => [u.id, u.name, u.label]), [['n', 'Quick-IME', 'Quick-IME'], ['u', '', 'Quick-IME']]);
    const rows = block(draw(S2), 'live-unreg').split('class="hm-lv sxu"').slice(1);
    assert.match(rows[0], /class="hm-lv-t">Quick-IME</);
    assert.match(rows[1], /class="hm-lv-t un">Quick-IME</);
});

// station-58 (2): an ended registry session with Remote Control still attached is on this card too,
// so the note no longer says every row never ran /fankeel; the title names both kinds.
test('the \u672a\u767b\u8a18 note says open and untracked, and its title names both kinds of row', () => {
    const card = block(draw(S), 'live-unreg');
    assert.doesNotMatch(card, /\u6c92\u8dd1\u904e \/fankeel \u7684 session</);
    assert.match(card, /<span class="sx-hnote" title="[^"]*\/fankeel[^"]*Remote Control[^"]*">\u9084\u958b\u8457\u3001fankeel \u6c92\u5728\u8ffd\u7684 session<\/span>/);
    const en = block(draw(S, 'en'), 'live-unreg');
    assert.match(en, /<span class="sx-hnote" title="[^"]*Remote Control[^"]*">Open, not tracked by fankeel<\/span>/);
});
