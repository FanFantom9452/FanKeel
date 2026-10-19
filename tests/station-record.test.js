'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../assets/station/station.js');
const { parseReport, derive } = require('../lib/gatereport.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const FIELDS = { ask: '留一份紀錄。', did: ['寫六欄紀錄', '監控站顯示它'], why: '原本沒有。', checked: '測試全過。', cost: '$1.00，5 分，0 個 agent。', left: '舊任務沒有。' };
const S = { id: 'a', state: 'down', record: { at: '2026-10-19T10:00:00.000Z', file: 'docs/90-agent/records/2026-10.md', anchor: 'r-x', fields: FIELDS } };
const dd = (html) => [...html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => m[1].replace(/<[^>]+>/g, '|'));

test('the detail and the page draw the same six fields in order, and the month file under them', () => {
    for (const html of [V.recordHtml(S), V.recordPageHtml(S)]) {
        const labels = [...html.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
        assert.deepEqual(labels, ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']);
        const v = dd(html);
        assert.equal(v[0], FIELDS.ask);
        assert.match(v[1], /寫六欄紀錄\|.*監控站顯示它/);
        assert.equal(v[4], FIELDS.cost);
        assert.match(html, /docs\/90-agent\/records\/2026-10\.md/);
    }
    assert.match(V.recordHtml(S), /data-block="record"/);
    assert.match(V.recordPageHtml(S), /data-block="record-page"/);
});

test('no record is one muted line, never an empty block', () => {
    assert.match(V.recordHtml({ id: 'a', state: 'down', record: null }), /^<p class="rec-none" data-block="record-none">這個任務沒有完成紀錄。<\/p>$/);
    assert.match(V.recordPageHtml({ id: 'a', state: 'live', record: null }), /^<p class="recp-none" data-block="record-page-none">完成紀錄在 land 時寫。<\/p>$/);
});

test('a landed row gets its 要求 as a second row; a row with none gets nothing', () => {
    assert.match(V.listAskRow(S, 'a'), /^<tr class="ask" data-block="list-ask" data-id="a" aria-selected="true"><td><\/td><td colspan="7">.*留一份紀錄。/);
    assert.equal(V.listAskRow({ id: 'b', record: null }, 'a'), '');
});

test('record text is escaped', () => {
    const bad = { id: 'a', record: { file: 'f', fields: Object.assign({}, FIELDS, { ask: '<script>x</script>' }) } };
    assert.doesNotMatch(V.recordHtml(bad) + V.recordPageHtml(bad) + V.listAskRow(bad, 'a'), /<script>/);
});

test('land\'s gate tab shows 要求, 為什麼這樣做 and 驗過・沒驗過 from a six-field report', () => {
    const text = ['4992cb98 docs: x', '要求: 留一份紀錄。', '做了什麼:', '  - 寫六欄紀錄', '為什麼這樣做: 原本沒有。',
        '驗過・沒驗過: 測試全過。', '花費: $1.00。', '還剩什麼: 舊任務沒有。', 'suite: ok'].join('\n');
    const html = V.gateTabHtml({ stage: 'land' }, { stage: 'land', path: 'x', text, gate: null, parts: derive('land', parseReport('land', text)) }, []);
    for (const s of ['留一份紀錄。', '原本沒有。', '測試全過。']) assert.ok(html.includes(s), s);
    assert.match(html, /<ul class="gv-ship"><li>寫六欄紀錄<\/li><\/ul>/);
    assert.match(html, /<ul class="gv-open"><li>舊任務沒有。<\/li><\/ul>/);
});

test('every rec-, recp- and ask- class drawn has a rule in station.css', () => {
    const html = V.recordHtml(S) + V.recordPageHtml(S) + V.listAskRow(S, 'a') + V.recordHtml({ record: null }) + V.recordPageHtml({ record: null });
    const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(rec|recp|ask)(-|$)/.test(c)));
    for (const c of used) assert.match(CSS, new RegExp('\\.' + c + '\\b'), c);
});

// ---- the call sites: each surface through its real caller --------------------------
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
function boot(hash, sessions) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; }, removeAttribute() {}, appendChild() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, STATION_DETAIL: {},
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\a', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions } };
    const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, fetch() { return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); }, module: { exports: {} } });
    vm.runInContext(SRC, ctx);
    return { els, x: ctx.module.exports };
}
const SES = Object.assign({ root: 'F:\\ws\\a', project: null, pkey: 'F:\\ws\\a', task: 'task a', stage: 'build', route: ['build'],
    started: new Date().toISOString(), updated: Date.now() - 60000, usd: 0, agentUsd: 0, estimated: [], unpriced: [], hasDetail: false,
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, days: [], spans: [] }, S);

test('drawList writes the 要求 row under the selected landed session and marks it has-ask', () => {
    const p = boot('#/list', [SES]);
    try { p.x.drawList(); } catch (e) { /* drawDetail, run last, may lack data; the list is written before it */ }
    const lb = p.els.lb.innerHTML;
    assert.match(lb, /<tr class="ask" data-block="list-ask" data-id="a"[^>]*>.*留一份紀錄。/);
    assert.match(lb, /<tr class="has-ask" data-id="a"/);
});

test('drawDetail writes the record block into the detail panel', () => {
    const p = boot('#/list', [SES]);
    try { p.x.drawList(); } catch (e) { /* the panel is written by drawDetail, after the list */ }
    assert.match(p.els.det.innerHTML, /data-block="record"[\s\S]*寫六欄紀錄/);
});

test('the session page draws the record page block', () => {
    const p = boot('#/session/a', [SES]);
    assert.match(p.x.sessionPage({ id: 'a' }), /data-block="record-page"[\s\S]*寫六欄紀錄/);
});
