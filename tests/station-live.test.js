'use strict';
// The served page keeps itself current (docs/plans/2026-09-19-station-live-design.md
// §2): the list every three seconds, the detail of the session on screen while
// that session is live, and when it last re-read. The file `/fankeel` writes
// does none of it. The pure half is called directly; the re-read loop is run
// on the page script itself, booted in a context whose timers are captured by
// period and whose <head> answers each script it is handed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

const T0 = new Date(2026, 8, 19, 9, 12, 0).getTime();
const ROW = {
    id: 'aaaa1111-0000', root: 'F:\\ws', pkey: 'F:\\ws', task: 'station live', state: 'live', stage: 'build',
    route: ['survey', 'design', 'build', 'verify'], step: 3, steps: 4, running: 2,
    stages: [{ stage: 'survey', from: T0, to: T0 + 300000 }, { stage: 'design', from: T0 + 300000, to: T0 + 2400000 },
        { stage: 'build', from: T0 + 2400000, to: T0 + 3000000 }],
    days: [], spans: [],
};
const O = { names: {}, pkeys: [] };

test('a live row rings the stage it is in, names it with its number, and says how many agents are running', () => {
    const html = V.recentHtml([ROW], O);
    assert.match(html, /<i title="build（現在）" class="now" style="--c:var\(--st-build\);background:var\(--c\)"><\/i>/);
    assert.match(html, /<span class="stname">build<span class="of">3\/4<\/span><\/span>/);
    assert.match(html, /<span class="runn" title="此刻有 2 個 agent 是 running"><i class="dot live"><\/i>running 2<\/span>/);
    assert.match(V.recentHtml([Object.assign({}, ROW, { running: 0 })], O), /<span class="runn zero"[^>]*>running 0<\/span>/);
    const stale = V.recentHtml([Object.assign({}, ROW, { state: 'stale', running: null })], O);
    assert.doesNotMatch(stale, /class="now"|runn/, 'a row that is not live rings nothing and counts nothing');
    assert.match(stale, /<span class="stname">build/, 'and still names its stage');
});

test('the rail times each stage behind the current one, and counts the current one up from when it was entered while live', () => {
    const now = T0 + 3600000;
    const live = V.railHtml(ROW, true, now);
    assert.equal((live.match(/<li /g) || []).length, 4);
    assert.match(live, /<li class="done"[^>]*><span class="pt"><\/span><span class="nm">survey<\/span><span class="tm">5m<\/span><\/li>/);
    assert.match(live, /<li class="now live"[^>]*aria-current="step"[^>]*>[\s\S]*?<span class="tkr" data-b="-/);
    assert.match(live, /<span class="since">09:52 進站<\/span>/);
    assert.match(live, /<li class="todo"[^>]*><span class="pt"><\/span><span class="nm">verify<\/span><\/li>/);
    const stopped = V.railHtml(ROW, false, now);
    assert.doesNotMatch(stopped, /class="tkr"/, 'a session that is not live does not tick');
    assert.match(stopped, /<li class="now"[\s\S]*?<span class="tm">10m<\/span><span class="since">09:52 進站，停在這站<\/span>/);
});

test('the live tag says how long ago the page re-read, and the moment it stopped once the session is not live', () => {
    const at = new Date(2026, 8, 19, 11, 2, 40).getTime();
    assert.match(V.liveTag(true, at, at + 2000),
        /^<span class="livetag" title="最後一次更新 11:02:40；[^"]*"><b>即時<\/b>・<span data-ago>2 秒前更新<\/span><\/span>$/);
    assert.match(V.liveTag(true, at, at), /剛更新/);
    assert.equal(V.liveTag(false, at, at + 9000), '<span class="livetag off" title="session 結束後不再重拉"><b>已停止更新</b>・最後一次 11:02:40</span>');
    assert.equal(V.tk(-100, 1, false, 160), '1m00s');
    assert.equal(V.tk(-100, 1, true, 160), '<span class="tkr" data-b="-100" data-m="1">1m00s</span>');
});

const settle = () => new Promise((r) => { setImmediate(r); });
const station = (state, task, serve) => ({
    generatedAt: new Date(2026, 8, 19, 11, 0).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: serve !== false,
    projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null }],
    profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
    sessions: [Object.assign({}, ROW, { state, task, hasDetail: true })],
});

// The page as the browser runs it. `answer(src, win)` plays the server for
// each script the page appends; `loaded` is every src it asked for.
function boot(hash, first, answer, protocol) {
    const els = {};
    let html = '';
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const loaded = [];
    const timers = {};
    const win = { location: { hash, protocol: protocol || 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn, ms) => { timers[ms] = fn; return 1; }, STATION: first };
    const doc = {
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: { appendChild(s) { loaded.push(s.src); s.parentNode = { removeChild() {} }; answer(s.src, win); setImmediate(() => s.onload()); } },
    };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    return { html: () => html, loaded, timers, gen: () => els.gen.textContent };
}

test('served, the page re-reads the list and the live session on screen every three seconds, and stops re-reading one that ended', async () => {
    let next = station('live', 'second');
    const p = boot('#/s/aaaa1111-0000/cost', station('live', 'first'), (src, win) => {
        if (src.indexOf('station/station-data.js') === 0) win.STATION = next;
    });
    await settle(); await settle();
    assert.deepEqual(Object.keys(p.timers).map(Number).sort((a, b) => a - b), [1000, 3000, 5000]);
    assert.match(p.html(), /<h1 class="s-title">first<\/h1>/);
    const at = p.loaded.length;
    p.timers[3000](); await settle(); await settle(); await settle();
    assert.deepEqual(p.loaded.slice(at).map((s) => s.split('?')[0]), ['station/station-data.js', 'station/detail/aaaa1111-0000.js']);
    assert.ok(p.loaded.slice(at).every((s) => /\?t=\d+$/.test(s)), 'each re-read asks past the browser cache');
    assert.match(p.html(), /<h1 class="s-title">second<\/h1>/, 'the page was drawn again from what it re-read');
    assert.match(p.html(), /<span class="livetag"/);
    assert.match(p.gen(), /每 3 秒重讀一次，最後一次 \d\d:\d\d:\d\d/);
    next = station('stale', 'third');
    const again = p.loaded.length;
    p.timers[3000](); await settle(); await settle(); await settle();
    assert.deepEqual(p.loaded.slice(again).map((s) => s.split('?')[0]), ['station/station-data.js'],
        'a session no longer live has its detail re-read no more');
    assert.match(p.html(), /<span class="livetag off"/);
});

test('the file /fankeel writes re-reads nothing: no timer under file:, and only the health poll for data no server wrote', () => {
    assert.deepEqual(Object.keys(boot('#/', station('live', 'x', false), () => {}, 'file:').timers), []);
    assert.deepEqual(Object.keys(boot('#/', station('live', 'x', false), () => {}, 'http:').timers).map(Number), [5000]);
});
