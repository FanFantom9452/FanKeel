'use strict';
// The session card's AI 畫的圖 block (docs/99-archive/2026-10-20-chartroom-board-design.md §5;
// mockup .fankeel/build/2026-10-20-chartroom-board/mockup.html, data-block="boards"):
// one <img> thumbnail per board, opening the full SVG in a new tab; no board, no block.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const BOARDS = [{ name: 'levelmark', updated: 11 }, { name: 'levelmark-runtime', updated: 22 }];
const S = { id: 's1', started: '2026-09-11T10:00:00.000Z', boards: BOARDS };
const imgs = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);

// station.js booted on `hash`, served, with one session holding `boards`;
// returns the page's HTML. fetch never answers, so no poll lands mid-test.
function boot(hash, boards) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    els.page = el('div');
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, STATION_DETAIL: {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, clearInterval() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'down', route: ['survey', 'build'], stage: 'build', hasDetail: false,
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: '2026-09-11T10:00:00.000Z', days: [], boards }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return els.page.innerHTML;
}

test('boardsHtml draws one <img> per board, each opening its SVG in a new tab, and the build directory under them', () => {
    const html = V.boardsHtml(S, true);
    assert.match(html, /^<section class="panel boards" data-block="boards" aria-labelledby="boards-h">/);
    assert.deepEqual(imgs(html), ['station/board/s1/levelmark.svg?v=11', 'station/board/s1/levelmark-runtime.svg?v=22']);
    assert.equal((html.match(/<a class="bd" href="station\/board\/s1\/[^"]+" target="_blank" rel="noopener"/g) || []).length, 2);
    assert.match(html, /AI 畫的圖<small>2 張・點一下在新分頁開完整的圖<\/small>/);
    assert.match(html, /<span class="bd-nm"><b>levelmark<\/b>\.board<\/span>/);
    assert.match(html, /<p class="bd-src">檔案在 <span class="mono">\.fankeel\/build\/task-20260911T100000\/<\/span><\/p>/);
    assert.equal((html.match(/<svg/g) || []).length, 1, 'only the heading icon is inline SVG; the boards are <img>');
});

test('no board, no block; and a static copy, which has no route to draw one, draws none', () => {
    assert.equal(V.boardsHtml(Object.assign({}, S, { boards: [] }), true), '');
    assert.equal(V.boardsHtml({ id: 's1' }, true), '');
    assert.equal(V.boardsHtml(S, false), '');
});

test('a board name is escaped where it is drawn', () => {
    const html = V.boardsHtml({ id: 's1', started: S.started, boards: [{ name: 'x"><script>', updated: 1 }] }, true);
    assert.doesNotMatch(html, /<script>/);
});

test('the served session page shows one <img> per entry of boards[], after the record and before the tabs', () => {
    const html = boot('#/s/s1', BOARDS);
    const block = /<section class="panel boards" data-block="boards"[\s\S]*?<\/section>/.exec(html);
    assert.ok(block, 'the block is on the page');
    assert.equal(imgs(block[0]).length, BOARDS.length);
    assert.ok(html.indexOf('data-block="boards"') < html.indexOf('data-block="session-tabs"'));
    assert.doesNotMatch(boot('#/s/s1', []), /data-block="boards"/);
});

test('station.css carries the mockup\'s boards block', () => {
    for (const rule of ['.boards{', '.bd-grid{', '.bd{', '.bd-th img{', '.bd-ft{', '.bd-nm{', '.bd-go{', '.bd-src{']) {
        assert.ok(CSS.includes(rule), rule);
    }
});
