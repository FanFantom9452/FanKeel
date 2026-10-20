'use strict';
// The station glyph breathes only while the stage is worked on
// (docs/90-agent/plans/2026-10-15-route-dots-breathe.md Task 1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const ROUTE7 = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

function boot() {
    const kept = {};
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const root = el('html');
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\ws\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}
const row = (over) => Object.assign({ id: 'k1', pkey: 'F:\ws\alpha', task: 'keel one', state: 'live', updated: NOW - 1000, started: NOW - 120000,
    route: ROUTE7, stage: 'build', busy: true, gateAt: null }, over);

const recent = (V, r) => V.recentHtml([r], { names: {}, pkeys: [r.pkey] }, '');

test('a live row worked on carries the live class on its glyph', () => {
    assert.match(recent(boot(), row({ days: [] })), /<svg class="glyph k-only prog live"/);
});

test('a live row at a question, not busy, or not live draws a still glyph', () => {
    const V = boot();
    for (const over of [{ gateAt: NOW - 1000 }, { busy: false }, { state: 'down' }]) {
        assert.doesNotMatch(recent(V, row(Object.assign({ days: [] }, over))), /glyph k-only prog live"/, JSON.stringify(over));
    }
});

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
function busyOf(inflight, stage) {
    const base = tmp('fankeel-breathe-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, { task: 't', project: 'ws', stage: stage || 'build', route: ['survey', 'build', 'verify'],
        active: true, claims: [], started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(),
        configDir: cfg, inflight });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const m = station.gather({ configDir: cfg });
    const s = m.registries[0].sessions[0];
    const page = JSON.parse(station.serialize(m, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    return [s.busy, page.sessions[0].busy];
}

test('gather and serialize mark a session busy only for a fresh mark on its own stage', () => {
    const t = Date.now();
    assert.deepEqual(busyOf({ stage: 'build', at: t - 60000 }), [true, true]);
    assert.deepEqual(busyOf({ stage: 'build', at: t - 21 * 60000 }), [false, false]);
    assert.deepEqual(busyOf([{ stage: 'plan', at: t - 60000 }, { stage: 'build', at: t - 60000 }]), [true, true]);
    assert.deepEqual(busyOf({ stage: 'plan', at: t - 60000 }), [false, false]);
});

test('the css breathes the glyph only under .live, and reduced motion stills it', () => {
    const rule = (sel) => { const i = CSS.indexOf(sel + '{'); assert.ok(i >= 0, sel); return CSS.slice(i, CSS.indexOf('}', i)); };
    assert.doesNotMatch(rule('.glyph .gseg.now'), /animation/);
    assert.doesNotMatch(rule('.glyph .gedge.now'), /animation/);
    assert.match(rule('.glyph.live .gseg.now,.glyph.live .gedge.now'), /klive/);
    const block = CSS.match(/@media \(prefers-reduced-motion:reduce\)\{[^@]*?\.glyph \.gseg[^@]*?\}\s*\}/)[0];
    assert.match(block, /\.glyph\.live \.gseg\.now/);
    assert.match(block, /\.glyph\.live \.gedge\.now/);
});
