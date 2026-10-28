'use strict';
// Whole-branch review of docs/90-agent/plans/2026-10-29-mobile-sources-design.md: a session on
// another computer has no /f/<id> page on this station, and its hold is not this phone's.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const APP = { mode: 'app', open: {} };
const row = (id, machine) => ({ id, root: '/r', task: 'job ' + id, project: 'lab', kind: 'stage', stage: 'build', at: NOW - 6e4, usd: 1, machine });
const M = (o) => Object.assign({ host: 'office', at: NOW, device: { name: 'iPhone', paired: NOW - 864e5 }, gates: [], stopped: [], tasks: [], done: [], others: [], machines: [] }, o);
const links = (h) => (h.match(/<a [^>]*href="\/f\/[^"]*"/g) || []).map((x) => /href="([^"]*)"/.exec(x)[1]);

test('完成: a row from another computer is drawn without a link, this computer\'s keeps its /f link', () => {
    const h = P.screen(M({ done: [row('a1', 'office'), row('b2', 'lab')] }), P.parseRoute('#/done'), NOW, APP);
    assert.deepEqual(links(h), ['/f/a1/build']);
    assert.match(h, /<div class="row"[^>]*>[\s\S]*?job b2/);
});

test('the panes of a session on another computer carry no desktop-page link; this computer\'s do', () => {
    const p = (machine) => ({ id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], state: 'running', attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW, holdUntil: null, context: null, limits: null, machine });
    const m = M({ done: [row('t2', 'lab')] });
    for (const pane of ['timeline', 'plan', 'dispatch']) {
        assert.deepEqual(links(P.screen(m, P.parseRoute('#/m/lab/t2/' + pane), NOW, APP, p('lab'))), [], pane);
        assert.equal(links(P.screen(m, P.parseRoute('#/s/t2/' + pane), NOW, APP, p('office'))).length, 1, pane);
    }
});

test('the 測站 sheet shows only this computer\'s hold as the one this phone holds', () => {
    const task = (id, machine) => ({ id, root: '/r', task: 'job ' + id, project: 'lab', stage: 'build', route: ['build'], gate: false, updated: NOW, state: 'running', attached: true, background: [], last: null, holdUntil: NOW + 6e4, machine });
    const sheet = (tasks) => P.screen(M({ tasks }), P.parseRoute('#/'), NOW, { mode: 'app', open: { 'rs:held': true }, sheet: true });
    assert.doesNotMatch(sheet([task('b2', 'lab')]), /data-key="rs:held"|data-act="detach"/);
    assert.match(sheet([task('b2', 'lab'), task('a1', 'office')]), /data-act="detach" data-id="a1"/);
    assert.match(sheet([task('a1', undefined)]), /data-act="detach" data-id="a1"/);
});
