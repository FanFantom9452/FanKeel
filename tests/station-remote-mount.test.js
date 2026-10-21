'use strict';
// The 手機遠端 card mounted (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §3): #/settings draws it under the wizard when assets/station/remote-card.js
// is loaded, the shell loads that module before station.js, and a written
// station carries it. What the card draws is tests/station-remote-card.test.js's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const profile = require('../lib/profile.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const CARD = '<section class="dcard rm" id="rm-card" data-block="remote-on">card</section>';

// tests/station-pages.test.js's draw(), with the wizard's keys, a fetch that
// never answers (a served page asks the server for things this test does not
// serve), and window.FK_REMOTE when `remote` is given.
function draw(hash, opts) {
    const o = opts || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: o.serve ? 'http:' : 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: Boolean(o.serve), nonce: 'N0NCE',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: profile.WIZARD_KEYS, classes: {}, sessions: [] } };
    if (o.remote) win.FK_REMOTE = o.remote;
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return els.page.innerHTML;
}
// A stand-in for remote-card.js: records what it was told and draws CARD.
function stub() {
    const told = [];
    return { told, html: (serve) => { told.push(serve); return CARD; } };
}

test('#/settings draws the card after the wizard, told whether the page is served', () => {
    const off = stub();
    const page = draw('#/settings', { remote: off });
    assert.ok(page.includes('data-block="wizard"'));
    assert.ok(page.includes(CARD));
    assert.ok(page.indexOf('data-block="wizard"') < page.indexOf('id="rm-card"'), 'the card sits under the wizard');
    assert.equal(off.told[0], false);
    const on = stub();
    draw('#/settings', { remote: on, serve: true });
    assert.equal(on.told[0], true);
});

test('without remote-card.js the settings page is the wizard alone', () => {
    const page = draw('#/settings');
    assert.ok(page.includes('data-block="wizard"'));
    assert.ok(!page.includes('rm-card'));
});

test('no other page draws the card', () => {
    const s = stub();
    assert.ok(!draw('#/live', { remote: s }).includes('rm-card'));
    assert.deepEqual(s.told, []);
});

test('the shell loads remote-card.js after the spend modules and before station.js', () => {
    for (const html of [fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8'), station.render()]) {
        const order = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
        assert.equal(order.indexOf('remote-card.js'), order.indexOf('station.js') - 1, order.join(', '));
        assert.ok(order.indexOf('spend-panel.js') < order.indexOf('remote-card.js'), order.join(', '));
    }
});

test('a written station carries remote-card.js beside station.js', () => {
    assert.ok(station.EMITTED.includes('station/remote-card.js'));
    const cfg = tmp('fankeel-remote-mount-');
    station.write({ configDir: cfg });
    assert.equal(fs.readFileSync(path.join(cfg, 'fankeel', 'station', 'remote-card.js'), 'utf8'), fs.readFileSync(path.join(ASSETS, 'remote-card.js'), 'utf8'));
});
