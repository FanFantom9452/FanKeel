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
