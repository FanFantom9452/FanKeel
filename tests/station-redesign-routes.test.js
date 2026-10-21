'use strict';
// The router (station redesign §1–§4): with the page modules loaded, each
// hash goes to its module, handed the station and { names, now, serve,
// redraw }; without them, and for the session tabs the redesign keeps (plan,
// events, gate), the old view draws. tests/station-remote-mount.test.js's
// draw(), with stand-in modules set on window before station.js runs, or the
// real ones run first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const SID = 'acacacac-1313-4131-8131-131313131313';
const ROW = { id: SID, pkey: 'F:\\ws', root: 'F:\\ws', project: 'ws', task: 'route test', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [],
    claims: [], notes: [], updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [], usd: 1, agentUsd: 0, hasDetail: false };

function draw(hash, opts) {
    const o = opts || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, scrollIntoView() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false, nonce: 'N0NCE',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [ROW] } };
    const box = vm.createContext({ window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    for (const f of o.files || []) {
        box.module = { exports: {} };
        vm.runInContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), box);
    }
    Object.assign(win, o.mods || {});
    box.module = { exports: {} };
    vm.runInContext(SRC, box);
    return els.page.innerHTML;
}
// A stand-in page module: keeps what it was handed and draws a marker.
function spy(name) {
    const told = [];
    return { told, page(...a) { told.push(a); return '<i id="mod-' + name + '"></i>'; } };
}
function common(o) {
    assert.equal(typeof o.names, 'object');
    assert.equal(typeof o.now, 'number');
    assert.equal(o.serve, false);
    assert.equal(typeof o.redraw, 'function');
}

test('#/ and #/live draw the 進行中 page', () => {
    for (const hash of ['#/', '#/live']) {
        const live = spy('live');
        assert.ok(draw(hash, { mods: { FK_LIVE: live } }).includes('<i id="mod-live"></i>'), hash);
        assert.equal(live.told[0][0].sessions[0].id, SID);
        common(live.told[0][1]);
    }
});

test('#/sessions draws the list, and #/cmp the list with its compare tray', () => {
    const a = spy('sessions');
    assert.ok(draw('#/sessions', { mods: { FK_SESSIONS: a } }).includes('<i id="mod-sessions"></i>'));
    assert.equal(a.told[0][1].tray, false);
    common(a.told[0][1]);
    const b = spy('sessions');
    assert.ok(draw('#/cmp', { mods: { FK_SESSIONS: b } }).includes('<i id="mod-sessions"></i>'));
    assert.equal(b.told[0][1].tray, true);
});

test('#/projects and its analysis angles draw the projects page, handed the hash', () => {
    for (const hash of ['#/projects', '#/projects/analysis/cost']) {
        const p = spy('projects');
        assert.ok(draw(hash, { mods: { FK_PROJECTS: p } }).includes('<i id="mod-projects"></i>'), hash);
        assert.equal(p.told[0][1].hash, hash);
        common(p.told[0][1]);
    }
});

test('#/p/<name> draws the project page, with its TODO panel when the hash asks for it', () => {
    const one = spy('project');
    assert.ok(draw('#/p/' + encodeURIComponent('F:\\ws'), { mods: { FK_PROJECT: one } }).includes('<i id="mod-project"></i>'));
    assert.equal(one.told[0][1], 'F:\\ws');
    assert.equal(one.told[0][2].todo, undefined);
    common(one.told[0][2]);
    const two = spy('project');
    draw('#/p/' + encodeURIComponent('F:\\ws') + '/todo', { mods: { FK_PROJECT: two } });
    assert.equal(two.told[0][2].todo, '');
});

test('#/s/<id> draws the session page for 經過, 派工 and 對話; the old 花費 tab is 經過', () => {
    for (const [hash, tab] of [['', 'timeline'], ['/cost', 'timeline'], ['/dispatch', 'dispatch'], ['/talk', 'talk']]) {
        const s = spy('session');
        assert.ok(draw('#/s/' + SID + hash, { mods: { FK_SESSION: s } }).includes('<i id="mod-session"></i>'), hash);
        const [row, x, o] = s.told[0];
        assert.equal(row.id, SID);
        assert.equal(x, null, 'no detail on this page');
        assert.equal(o.tab, tab, hash);
        common(o);
        if (tab === 'talk') assert.equal(o.talk.state, 'static', 'a file on disk cannot read the conversation');
    }
});

test('the plan, events and gate tabs, and a session not on the page, keep the old view', () => {
    for (const hash of ['#/s/' + SID + '/plan', '#/s/' + SID + '/events', '#/s/' + SID + '/gate']) {
        const s = spy('session');
        const html = draw(hash, { mods: { FK_SESSION: s } });
        assert.ok(html.includes('class="panel kshead"'), hash);
        assert.deepEqual(s.told, [], hash);
    }
    const s = spy('session');
    assert.ok(draw('#/s/ffffffff-0000', { mods: { FK_SESSION: s } }).includes('這頁上沒有 session'));
    assert.deepEqual(s.told, []);
});

test('without the modules every route draws the old view', () => {
    assert.ok(draw('#/live').includes('data-block="live-head"'));
    assert.ok(draw('#/s/' + SID).includes('class="panel kshead"'));
    assert.ok(!draw('#/sessions').includes('mod-'));
});

test('the real session page modules draw #/s/<id> and its 對話 tab', () => {
    const files = ['session-page.js', 'session-dispatch.js', 'session-talk.js'];
    const run = draw('#/s/' + SID, { files });
    assert.ok(run.includes('data-block="session-page"') && run.includes('data-block="session-run"'));
    assert.ok(!run.includes('class="panel kshead"'));
    assert.ok(draw('#/s/' + SID + '/talk', { files }).includes('要從 serve 開的頁面才讀得到對話'));
    assert.ok(draw('#/s/' + SID + '/dispatch', { files }).includes('data-block="session-tabs"'));
});
