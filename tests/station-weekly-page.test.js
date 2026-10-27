'use strict';
// The 週報 page (assets/station/weekly-page.js; mockup
// .fankeel/build/2026-10-27-weekly-skill/station-weekly.html, blocks
// weekly-copy and weekly-list): a copy button for /fankeel-weekly and the
// archive read once a visit from GET station/weekly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const REPORTS = [
    { until: '2026-01-09', since: '2026-01-03', done: 5, ongoing: 2, projects: ['Trovara', 'fankeel'], html: true },
    { until: '2026-01-02', since: '2025-12-27', done: 4, ongoing: 0, projects: ['ils-bench'], html: true },
    { until: '2025-12-26', since: '2025-12-20', done: 1, ongoing: 1, projects: [], html: false },
];
const flush = () => new Promise((r) => setImmediate(r));

function mod(reports, lang) {
    const calls = [];
    const fetch = (url) => {
        calls.push(url);
        if (reports === null) return Promise.resolve({ ok: false, status: 500 });
        return Promise.resolve(url === 'station/weekly' ? { ok: true, json: () => Promise.resolve({ reports }) } : { ok: false, status: 404 });
    };
    const { win, doc } = page(['weekly-page.js'], {}, { fetch });
    if (lang) win.FK_I18N = { lang };
    const W = win.FK_WEEKLY;
    W.reset();
    let redraws = 0;
    const o = { names: {}, now: Date.now(), serve: true, redraw() { redraws++; } };
    return { W, win, doc, calls, draw: (extra) => W.page({}, Object.assign({}, o, extra)), redraws: () => redraws };
}

test('every Chinese string is keyed and has English', () => {
    const { W } = mod([]);
    assert.deepEqual(stringsLeft('weekly-page.js', W.EN), []);
});

test('unserved, the page draws both blocks, says the list needs serve, and asks nothing', () => {
    const { draw, calls } = mod([]);
    const html = draw({ serve: false });
    for (const b of ['weekly-page', 'weekly-copy', 'weekly-list']) assert.ok(html.includes('data-block="' + b + '"'), b);
    assert.ok(html.includes('<code id="wk-cmd">/fankeel-weekly</code>'));
    assert.ok(html.includes('這張表要 serve 才讀得到'));
    assert.deepEqual(calls, []);
});

test('served, one read a visit lists the reports that have a page, newest first, each opening its served copy', async () => {
    const { draw, calls, redraws } = mod(REPORTS);
    assert.ok(draw().includes('讀取週報歸檔'));
    draw();
    assert.deepEqual(calls, ['station/weekly']);
    await flush();
    assert.equal(redraws(), 1);
    const html = draw();
    const links = [...html.matchAll(/<a class="wk-rng" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ['station/weekly/2026-01-09.html', 'station/weekly/2026-01-02.html']);
    assert.ok(html.includes('<span>2026-01-03 至 01-09</span>'));
    assert.ok(html.includes('<span>2025-12-27 至 2026-01-02</span>'), 'a range across a year keeps both years');
    assert.ok(html.includes('<span class="wk-days">7 天</span>'));
    assert.equal((html.match(/class="wk-new"/g) || []).length, 1);
    assert.ok(html.includes('<td class="r z">0</td>'), 'a zero is drawn faint');
    assert.ok(html.includes('<span class="chip">Trovara</span><span class="chip">fankeel</span>'));
    assert.ok(html.includes('<span class="mono">2026-01-10</span>'), 'the next range starts the day after the latest end date');
});

test('with no report yet, the list says so and the range falls back to last Friday', async () => {
    const { draw } = mod([]);
    draw();
    await flush();
    const html = draw();
    assert.ok(html.includes('還沒有週報'));
    assert.ok(html.includes('預設區間是上週五到今天'));
    assert.doesNotMatch(html, /<table/);
});

test('a failed read says so instead of an empty list', async () => {
    const { draw } = mod(null);
    draw();
    await flush();
    assert.ok(draw().includes('讀不到週報歸檔：500'));
});

test('the copy button writes /fankeel-weekly to the clipboard and says so', async () => {
    const { W, win, draw } = mod([]);
    const wrote = [];
    win.navigator = { clipboard: { writeText: (t) => { wrote.push(t); return Promise.resolve(); } } };
    draw({ serve: false });
    W.onClick({ target: { closest: (sel) => (sel === '[data-wk-copy]' ? {} : null) } });
    await flush();
    assert.deepEqual(wrote, ['/fankeel-weekly']);
    assert.equal(W.state().said, '貼到 session 執行');
    assert.match(draw({ serve: false }), /<span>已複製<\/span>/);
});

test('loading the module adds no listener; the first draw adds exactly one click listener that reaches the copy', async () => {
    const vm = require('node:vm');
    const added = [];
    const doc = { addEventListener: (t, f) => added.push([t, f]), getElementById: () => null };
    const win = { FK_KIT: { esc: (s) => String(s) }, navigator: { clipboard: { writeText: (t) => { win.wrote = t; return Promise.resolve(); } } } };
    const box = vm.createContext({ window: win, document: doc, module: { exports: {} }, fetch() {} });
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'weekly-page.js'), 'utf8'), box);
    assert.equal(added.length, 0, 'load adds none');
    const W = box.module.exports;
    W.reset();
    W.page({}, { serve: false, redraw() {} });
    W.page({}, { serve: false, redraw() {} });
    assert.deepEqual(added.map((a) => a[0]), ['click']);
    added[0][1]({ target: { closest: () => null } });
    added[0][1]({});
    await flush();
    assert.equal(win.wrote, undefined, 'a click elsewhere copies nothing');
    added[0][1]({ target: { closest: (sel) => (sel === '[data-wk-copy]' ? {} : null) } });
    await flush();
    assert.equal(win.wrote, '/fankeel-weekly');
});

test('with no clipboard the copy selects the command and draws the 已選取 note', async () => {
    const { W, win, doc, draw } = mod([]);
    const ranges = [], log = [];
    const cmd = { id: 'wk-cmd' };
    doc.getElementById = (id) => (id === 'wk-cmd' ? cmd : null);
    doc.createRange = () => ({ selectNodeContents: (n) => ranges.push(n) });
    win.getSelection = () => ({ removeAllRanges: () => log.push('clear'), addRange: () => log.push('add') });
    win.navigator = {};
    draw({ serve: false });
    W.onClick({ target: { closest: (sel) => (sel === '[data-wk-copy]' ? {} : null) } });
    await flush();
    assert.deepEqual(ranges, [cmd]);
    assert.deepEqual(log, ['clear', 'add']);
    assert.equal(W.state().said, '已選取，按 Ctrl+C 複製');
    assert.equal(W.state().ok, false);
    assert.ok(draw({ serve: false }).includes('已選取，按 Ctrl+C 複製'));
});

test('in English the page reads in English', async () => {
    const { draw } = mod(REPORTS, 'en');
    draw();
    await flush();
    const html = draw();
    assert.ok(html.includes('Weekly reports'));
    assert.ok(html.includes('<span>2026-01-03 to 01-09</span>'));
    assert.ok(html.includes('7 days'));
});

test('every wk- class the page draws has a rule in weekly-page.css', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'weekly-page.js'), 'utf8');
    const css = fs.readFileSync(path.join(ASSETS, 'weekly-page.css'), 'utf8');
    const drawn = new Set([...src.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^wk(-|$)/.test(c)));
    assert.ok(drawn.size >= 10, [...drawn].join(' '));
    for (const c of drawn) assert.match(css, new RegExp('\\.' + c + '(?![\\w-])'), c);
});
