'use strict';
// Task 5 of docs/90-agent/plans/2026-10-29-mobile-sources.md: an unregistered session's read-only
// screen, a session on another computer linked and read through this station, and the 測站
// sheet with one row a computer — as .fankeel/build/2026-10-29-mobile-sources/mockup.html draws them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');
const { boot, settle } = require('./mobile-dom.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const APP = { mode: 'app', open: {} };
const M = {
    host: 'office', at: NOW, device: { name: 'iPhone', paired: NOW - 7 * 864e5 }, gates: [], stopped: [], done: [], others: [],
    tasks: [{ id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], gate: false, updated: NOW - 6e4, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine: 'lab' }],
    unregistered: [{ id: 'u2', cwd: 'D:\\lab\\x', entrypoint: 'cli', name: 'lab job', status: 'busy', bridge: false, started: NOW - 6e5, machine: 'lab' }],
    rc: { live: [], ended: [] },
    machines: [
        { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 4 },
        { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: Date.UTC(2026, 9, 24), refused: false, n: 3 },
        { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: Date.UTC(2026, 9, 28, 15, 14), paired: NOW - 864e5, refused: false, n: 2 },
        { name: 'ws1', url: 'https://ws1.t.ts.net/m', state: 'unpaired', me: false, seen: null, paired: null, refused: false, n: 0 },
    ],
};
const PU = (o) => Object.assign({ id: 'u2', machine: 'lab', name: 'lab job', task: '', cwd: 'D:\\lab\\x', entrypoint: 'cli', bridge: false, status: 'busy', state: 'running',
    chat: [{ role: 'desktop', text: 'fix the table', at: NOW - 6e4 }, { role: 'tool', id: 'a', tool: 'Read', label: 'a.md', at: NOW - 5e4 }, { role: 'tool-end', id: 'a', ok: true, at: NOW - 4e4 }, { role: 'assistant', text: 'Done.', at: NOW - 3e4 }],
    at: NOW, context: null, limits: null }, o);

test('the unregistered screen: its own head, two panes, the reason the others are gone, read only', () => {
    const h = P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, PU());
    assert.match(h, /data-block="session-head-unregistered"/);
    assert.match(h, /<span class="ent">CLI<\/span>/);
    assert.match(h, /<span class="mtag">[\s\S]*?lab<\/span>/);
    assert.match(h, /D:\\lab\\x/);
    assert.deepEqual(/<nav class="panes two"[\s\S]*?<\/nav>/.exec(h)[0].match(/href="#\/[^"]*"/g), ['href="#/u/lab/u2/talk"', 'href="#/u/lab/u2/events"']);
    assert.match(h, /data-block="session-chat-unregistered"[\s\S]*?這個 session 沒登記在 fankeel/);
    assert.match(h, /fix the table/);
    assert.match(h, /data-block="session-foot-unregistered"[\s\S]*?要回話得回到那台電腦/);
    assert.doesNotMatch(h, /claude\.ai\/code/, 'no RC, no app link');
    assert.doesNotMatch(h, /class="tabbar"|id="composer"|data-act="attach"/);
});

test('with Remote Control on, the foot sends the reply to the Claude app', () => {
    const h = P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, PU({ bridge: true }));
    assert.match(h, /<span class="rc"><i class="dot live"/);
    assert.match(h, /data-block="session-foot-unregistered"[\s\S]*?href="https:\/\/claude\.ai\/code" target="_blank" rel="noopener"/);
});

test('the events pane lists the steps; before its json arrives the list row stands in', () => {
    assert.match(P.screen(M, P.parseRoute('#/u/lab/u2/events'), NOW, APP, PU()), /data-block="m-pane-events"[\s\S]*?a\.md/);
    assert.match(P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, null), /data-block="session-head-unregistered"[\s\S]*?lab job/);
    assert.match(P.screen(M, P.parseRoute('#/u/lab/nope'), NOW, APP, null), /這個 session 不在了/);
});

test('a session on another computer keeps its computer in every pane link', () => {
    const p = { id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], state: 'running', attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW, holdUntil: null, context: null, limits: null, machine: 'lab' };
    const h = P.screen(M, P.parseRoute('#/m/lab/t2'), NOW, APP, p);
    assert.match(h, /href="#\/m\/lab\/t2\/timeline"/);
    assert.doesNotMatch(h, /href="#\/s\/t2\//);
});

test('the boot reads a session on another computer through this station, its own sessions directly', async () => {
    const b = boot('#/', { home: M, one: PU() });
    await settle();
    const urls = [];
    const real = b.win.fetch;
    b.win.fetch = (u, o) => { urls.push(u); return real(u, o); };
    b.goto('#/u/lab/u2');
    await settle();
    b.goto('#/u/office/u1');
    await settle();
    b.goto('#/m/lab/t2');
    await settle();
    assert.ok(urls.includes('/station/peer/lab/station/unreg.json?id=u2'), urls.join(' '));
    assert.ok(urls.includes('/station/unreg.json?id=u1'), urls.join(' '));
    assert.ok(urls.includes('/station/peer/lab/station/phone.json?id=t2'), urls.join(' '));
});
