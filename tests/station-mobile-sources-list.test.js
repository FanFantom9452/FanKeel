'use strict';
// Task 4 of docs/90-agent/plans/2026-10-29-mobile-sources.md: the /m lists with every computer —
// the unregistered group, the computer on each card, the filter chips, an offline computer, the
// RC tab — drawn as .fankeel/build/2026-10-29-mobile-sources/mockup.html draws them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const APP = { mode: 'app', open: {} };
const task = (id, machine, o) => Object.assign({ id, root: '/r', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: false, updated: NOW - 60e3, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine }, o);
const ur = (id, machine, o) => Object.assign({ id, cwd: 'F:\\w\\' + id, entrypoint: 'cli', name: 'job ' + id, status: 'idle', bridge: false, started: NOW - 600e3, machine }, o);
const M = {
    host: 'office', at: NOW, device: null, gates: [], stopped: [], done: [], others: [],
    tasks: [task('t1', 'office'), task('t2', 'lab'), task('t3', 'laptop', { was: true, seen: NOW - 3600e3 })],
    unregistered: [ur('u1', 'office', { bridge: true, status: 'busy', entrypoint: 'claude-desktop' }), ur('u2', 'lab'), ur('u3', 'laptop', { was: true, seen: NOW - 3600e3 })],
    rc: {
        live: [Object.assign(ur('u1', 'office', { bridge: true, status: 'busy' }), { kind: 'unreg' })],
        ended: [{ id: 'e1', kind: 'unreg', task: '', name: 'old', cwd: '/x', entrypoint: 'cli', at: NOW - 86400e3, machine: 'lab' }],
    },
    machines: [
        { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 2 },
        { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: NOW - 864e5, refused: false, n: 2 },
        { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: NOW - 3600e3, paired: NOW - 864e5, refused: false, n: 2 },
    ],
};
const home = (hash, m) => P.screen(m || M, P.parseRoute(hash), NOW, APP);
const cards = (h) => (h.match(/<div class="sc(?: [^"]*)?"/g) || []).length;
const blockOf = (h, name, end) => { const m = new RegExp('data-block="' + name + '"[\\s\\S]*?' + end).exec(h); return m ? m[0] : null; };

test('全部: this computer\'s and lab\'s rows, each card tagged with its computer, laptop\'s left out with a note', () => {
    const h = home('#/');
    assert.ok(blockOf(h, 'machine-filter', '</nav>'));
    assert.match(h, /data-block="list-merged"/);
    assert.match(h, /data-block="list-unregistered"/);
    assert.match(h, /在電腦上開著、但沒登記在 fankeel 的 Claude Code。點進去可以看對話。/);
    assert.match(h, /data-block="list-offline-note"[^>]*>[\s\S]*?laptop 離線，它的 session 沒列在這裡[\s\S]*?href="#\/\?m=laptop"/);
    assert.equal(cards(h), 4, 't1 t2 u1 u2');
    assert.match(h, /href="#\/m\/lab\/t2"/);
    assert.match(h, /href="#\/s\/t1"/);
    assert.match(h, /href="#\/u\/office\/u1"/);
    assert.match(h, /href="#\/u\/lab\/u2"/);
    assert.match(h, /<span class="mtag">[\s\S]*?lab<\/span>/);
    assert.doesNotMatch(h, /task t3|job u3/);
    assert.match(h, /<span class="ent">Desktop<\/span><span class="rc"><i class="dot live" aria-hidden="true"><\/i>RC/);
    assert.match(h, /3 台電腦<span class="hoff">1 離線<\/span>/);
});

test('成品檢查: the cards under each connected computer\'s chip add up to the cards under 全部', () => {
    const all = cards(home('#/'));
    const on = M.machines.filter((x) => x.state === 'on').map((x) => x.name);
    assert.equal(on.reduce((n, name) => n + cards(home('#/?m=' + name)), 0), all);
    const chips = blockOf(home('#/'), 'machine-filter', '</nav>').match(/<a href="#\/\?m=[a-z0-9-]+"/g) || [];
    assert.equal(chips.length, 3, 'one chip a computer, the off one included');
    assert.match(blockOf(home('#/'), 'machine-filter', '</nav>'), /<a href="#\/" aria-current="true"><span class="chip">全部<\/span><\/a>/);
});

test('a picked computer that is off: when it was last seen, then its rows as last seen, untagged', () => {
    const h = home('#/?m=laptop');
    assert.match(h, /data-block="machine-filter-picked"/);
    assert.match(h, /<a href="#\/\?m=laptop" aria-current="true" class="down"/);
    const off = blockOf(h, 'list-machine-offline', '$');
    assert.match(off, /laptop 連不上/);
    assert.match(off, /最後看到：跑中/);
    assert.match(off, /最後看到：閒置/);
    assert.match(off, /data-act="retry"/);
    assert.equal(cards(h), 2);
    assert.doesNotMatch(h, /class="mtag"/);
    assert.doesNotMatch(h, /data-block="list-offline-note"/);
});

test('the RC tab: 連著 and 已結束, each tagged, the footer naming its limit and linking claude.ai/code', () => {
    const h = home('#/rc');
    const rc = blockOf(h, 'account-rc', '<nav');
    assert.match(rc, /連著 <span>1<\/span>/);
    assert.match(rc, /已結束 <span>1<\/span>/);
    assert.match(rc, /含已結束的/);
    assert.match(rc, /只含有開 station 的電腦/);
    assert.match(rc, /href="https:\/\/claude\.ai\/code" target="_blank" rel="noopener"/);
    assert.match(rc, /href="#\/u\/lab\/e1"/);
    assert.match(h, /data-block="machine-filter-rc"/);
    assert.equal(cards(home('#/rc?m=office')), 1);
});

test('等你 and its tab count leave out an offline computer\'s last-seen gate', () => {
    const held = Object.assign({}, M, { tasks: M.tasks.concat([task('g1', 'office', { state: 'gate' }), task('g2', 'laptop', { state: 'gate', was: true, seen: NOW - 3600e3 })]),
        stopped: [task('g3', 'laptop', { state: 'gate', was: true, seen: NOW - 3600e3 })] });
    const ask = home('#/ask', held);
    assert.match(ask, /task g1/);
    assert.doesNotMatch(ask, /task g2|task g3/);
    assert.match(ask, /<b class="tab-n"[^>]*>1<\/b>/);
    assert.match(home('#/', held), /<b class="tab-n"[^>]*>1<\/b>/);
});

test('an offline computer\'s gate row shows no gate or approve control', () => {
    const held = Object.assign({}, M, { tasks: [task('g2', 'laptop', { state: 'gate', gate: true, was: true, seen: NOW - 3600e3 })], unregistered: [] });
    const h = home('#/?m=laptop', held);
    assert.match(h, /task g2/);
    assert.doesNotMatch(h, /data-act="(?:gate|approve|ok|answer)/);
    assert.doesNotMatch(h, /class="sc ask"/);
});

test('the tab bar has four tabs, RC 對話 third, current on its own route', () => {
    const tabs = (h) => blockOf(h, 'tabbar-rc', '</nav>');
    assert.deepEqual(tabs(home('#/')).match(/href="#\/[^"]*"/g), ['href="#/"', 'href="#/ask"', 'href="#/rc"', 'href="#/done"']);
    assert.match(tabs(home('#/rc')), /href="#\/rc" aria-current="page"/);
    assert.match(tabs(home('#/rc')), /RC 對話/);
});

test('one computer only: no chips, no tags, the host pill as before', () => {
    const one = Object.assign({}, M, { machines: [M.machines[0]], tasks: [M.tasks[0]], unregistered: [M.unregistered[0]], rc: { live: [], ended: [] } });
    const h = home('#/', one);
    assert.doesNotMatch(h, /data-block="machine-filter/);
    assert.doesNotMatch(h, /class="mtag"/);
    assert.match(h, /data-block="list-unregistered"/);
    assert.doesNotMatch(h, /台電腦/);
});

test('parseRoute: another computer\'s session is #/m/<computer>/<id>, #/s/ is as it was, #/u, #/rc and ?m=', () => {
    assert.deepEqual(P.parseRoute('#/m/lab/aaaaaaaa-2'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'talk', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/m/lab/aaaaaaaa-2/plan'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'plan', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/s/aaaaaaaa-2/events'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'events' });
    assert.equal(P.parseRoute('#/s/aaaaaaaa-2/nope').view, 'home', 'a bad pane is never read as a computer');
    assert.equal(P.parseRoute('#/s/lab/aaaaaaaa-2').view, 'home');
    assert.equal(P.parseRoute('#/m/lab/aaaaaaaa-2/nope').view, 'home');
    assert.deepEqual(P.parseRoute('#/u/lab/bbbb-1'), { view: 'unreg', id: 'bbbb-1', pair: null, pane: 'talk', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/u/lab/bbbb-1/events'), { view: 'unreg', id: 'bbbb-1', pair: null, pane: 'events', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/rc'), { view: 'rc', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/?m=lab'), { view: 'home', id: null, pair: null, pick: 'lab' });
    assert.deepEqual(P.parseRoute('#/rc?m=lab'), { view: 'rc', id: null, pair: null, pick: 'lab' });
    assert.deepEqual(P.parseRoute('#/s/a/b/c/d'), { view: 'home', id: null, pair: null });
});

test('English: every new string is drawn in English', () => {
    P.setLang('en');
    try {
        const h = home('#/');
        assert.match(h, /Not registered/);
        assert.match(h, /laptop is offline/);
        assert.match(home('#/rc'), /Only computers running a station/);
    } finally { P.setLang('zh'); }
});
