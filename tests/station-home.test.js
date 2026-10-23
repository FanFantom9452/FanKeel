'use strict';
// 現在 (`#/`) as four groups and nothing else (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3; mockup .fankeel/build/
// 2026-10-21-station-home/mockup.html blocks home, home-live, home-running,
// home-todo, home-spend).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const MIN = 60000;
const ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'land'];

function boot(o) {
    o = o || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', value: '', hidden: false, attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: o.hash || '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: o.projects || [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: o.sessions || [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, els };
}
const row = (id, over) => Object.assign({ id, pkey: 'F:\\ws\\alpha', root: 'F:\\ws\\alpha', project: null, task: 'task ' + id, state: 'live',
    route: ROUTE, stage: 'build', stages: [], updated: NOW - MIN, started: new Date(NOW - 52 * MIN).toISOString(), days: [], subagents: [] }, over);
const gated = (id, over) => row(id, Object.assign({ stage: 'design', gateAt: NOW - 6 * MIN,
    pending: { questions: [{ header: 'design done' }], at: NOW - 10 * MIN } }, over));
const blocks = (html) => [...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]);

test('home-live lists only live sessions, the one waiting on you first, each linking to /f/<id>/<stage> under serve', () => {
    const { V } = boot();
    const R = [row('a'), gated('b'), row('c', { state: 'down' }), row('d', { state: 'stale' })];
    const html = V.homeLive(R, NOW, true);
    const hrefs = [...html.matchAll(/<a class="hm-lv[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, ['/f/b/design', '/f/a/build']);
    assert.equal(hrefs.length, R.filter((s) => s.state === 'live').length);
    assert.match(html, /<b>進行中<\/b><span class="kn">2<\/span><span class="kn wait">1 等你回答<\/span>/);
    assert.match(html, /<a class="hm-lv wait" href="\/f\/b\/design" aria-label="[^"]+">/);
    assert.match(html, /<span class="waitchip"><svg[\s\S]*?<\/svg>等你回答 · design gate<\/span>/);
    assert.match(html, /<span class="hm-lv-r" title="在 gate 等了 6m">等 6m<\/span>/);
    assert.match(html, /<span class="hm-stw" style="--c:var\(--st-build\)">build<\/span>/);
    assert.match(html, /<span class="route"/, 'the stops are the route dots, as the mockup draws them');
});

test('home-live off serve links the session hash, and an empty one says so', () => {
    const { V } = boot();
    assert.match(V.homeLive([row('a')], NOW, false), /<a class="hm-lv" href="#\/s\/a">/);
    const none = V.homeLive([], NOW, true);
    assert.match(none, /<span class="kn">0<\/span><\/div>/);
    assert.match(none, /沒有進行中的 session/);
    assert.equal(V.focusHref('x y', 'plan', true), '/f/x%20y/plan');
    assert.equal(V.focusHref('x', '', false), '#/s/x');
});

test('home-running lists subagents and background shells, running before ended, with the exit code chip', () => {
    const { V } = boot();
    const s = row('a', {
        subagents: [{ id: 'g1', agentType: 'fankeel-reader', description: 'opus 5.5 · inherit: station 資料流', ranModel: 'claude-sonnet-5-5', startedAt: NOW - 6 * MIN }],
        shells: [
            { id: 'b2', command: 'npm run build', state: 'ended', code: 1, startedAt: new Date(NOW - 9 * MIN).toISOString() },
            { id: 'b1', command: 'node a.js > "x"', state: 'running', code: null, startedAt: new Date(NOW - 4 * MIN).toISOString() },
            { id: 'b3', command: 'git status', state: 'ended', code: 0, startedAt: new Date(NOW - 11 * MIN).toISOString() },
        ] });
    const html = V.homeRunning([s, row('z', { state: 'down', shells: [{ id: 'q', command: 'gone', state: 'running', code: null, startedAt: '' }] })], NOW, true);
    assert.match(html, /<section class="dcard" data-block="home-running" aria-label="正在跑">/);
    assert.match(html, /<b>正在跑<\/b><span class="kn">2<\/span>/, 'one subagent and one running shell');
    assert.match(html, /<b>子代理<\/b><span>1 個在跑<\/span>/);
    assert.match(html, /<span class="hm-rn-t">station 資料流<code>fankeel-reader<\/code><\/span>/);
    assert.match(html, /Sonnet 5\.5<\/span><span class="hm-rn-r">6m<\/span>/);
    assert.match(html, /<b>背景 shell<\/b><span>1 在跑 · 2 結束<\/span>/);
    assert.ok(html.indexOf('node a.js') < html.indexOf('npm run build'), 'running first');
    assert.match(html, /<a class="hm-rn" href="\/f\/a\/build" title="node a.js &gt; &quot;x&quot;">/);
    assert.match(html, /<span class="hm-rs bad"[^>]*>●<\/span><code class="hm-rn-cmd">npm run build<\/code>[\s\S]*?<span class="chip bad">exit 1<\/span>/);
    assert.match(html, /<span class="chip ok">exit 0<\/span>/);
    assert.doesNotMatch(html, />gone</, 'a session that is down has nothing running');
});

test('home-running with no shells on the row yet draws the shells group empty', () => {
    const { V } = boot();
    const html = V.homeRunning([row('a')], NOW, true);
    assert.match(html, /<b>背景 shell<\/b><span>0 在跑 · 0 結束<\/span><\/div><p class="dnone">沒有背景 shell<\/p>/);
    assert.match(html, /<p class="dnone">沒有子代理在跑<\/p>/);
});

// Each entry as lib/station.js `todoOf` hands it over: `due` and `dueAt` from
// lib/todo.js `dueOf` (design §6). `a-7` was stamped before today but is not
// due yet — the case the old `stamp <= today` rule listed.
const day = (m, d) => new Date(2026, m - 1, d).getTime();
const e = (id, title, state, stamp, dueAt) => ({ id, label: '', title, description: '', state, condition: state === 'blocked' ? 'waits on x' : '',
    stamp: stamp || '', due: dueAt != null && dueAt <= NOW, dueAt: dueAt == null ? null : dueAt });
const ALPHA = { pkey: 'F:\\ws\\alpha', mode: 'folder', folder: 'docs/todo', done: [], open: [e('a-1', 'A one', 'ready'), e('a-2', 'A two', 'ready'),
    e('a-3', 'A three', 'ready'), e('a-4', '**A** four', 'ready'), e('a-5', 'A due', 'blocked', '2026-10-05', day(10, 12)),
    e('a-6', 'A later', 'blocked', '2026-11-24', day(12, 1)), e('a-7', 'A stamped', 'blocked', '2026-10-15', day(10, 22))] };
const BETA = { pkey: 'F:\\ws\\beta', mode: 'folder', folder: 'docs/todo', done: [], open: [e('b-1', 'B one', 'ready'), e('b-2', 'B due', 'blocked', '2026-10-13', day(10, 20))] };

test('home-todo counts Ready across projects, most first, and lists only the Blocked entries lib/todo.js calls due', () => {
    const { V } = boot();
    const html = V.homeTodo([{ root: 'F:\\ws\\beta', todos: [BETA] }, { root: 'F:\\ws\\alpha', todos: [ALPHA] }]);
    assert.match(html, /<div class="hm-td-big"><b>5<\/b><span>筆 Ready，分在 2 個專案<\/span><\/div>/);
    assert.match(html, /<a href="#\/p\/F%3A%5Cws%5Calpha" data-tdlg="F:\\ws\\alpha" aria-haspopup="dialog">alpha <b>4<\/b><\/a><a href="#\/p\/F%3A%5Cws%5Cbeta"/);
    assert.match(html, /<b>Blocked 到期<\/b><span>重看日已到，2 筆<\/span>/);
    assert.ok(html.indexOf('A due') < html.indexOf('B due'), 'soonest due first');
    assert.doesNotMatch(html, /A later/);
    assert.doesNotMatch(html, /A stamped/, 'stamped before today is not due: due is seven days after the stamp');
    assert.match(html, /<a class="hm-tdb" href="#\/p\/F%3A%5Cws%5Calpha\/todo\/a-5"><span class="hm-tdb-t">A due<\/span><span class="hm-tdb-m">alpha · blocked · waits on x<\/span><span class="hm-tdb-d">到期 10-12<\/span><\/a>/);
    assert.match(V.homeTodo([]), /沒有 Ready 的條目/);
});

test('home-spend is one line: today, then the calendar week from Monday, the whole line a link to 花費', () => {
    const { V } = boot();
    const day = V.localDay(NOW);
    const R = [row('a', { days: [{ day, usd: 2 }, { day: '2026-10-19', usd: 3 }, { day: '2026-10-18', usd: 100 }] })];
    const html = V.homeSpend(R, NOW);
    assert.match(html, /^<a class="dcard spendline" data-block="home-spend" href="#\/days" aria-label="花費：今天 \$2\.00，本週 \$5\.00，前往花費">/);
    assert.match(html, /<span class="sl-k">今天<b>\$2\.00<\/b><\/span><span class="sl-k">本週<b>\$5\.00<\/b><\/span><span class="sl-go">花費 →<\/span><\/a>$/);
    assert.match(V.homeSpend([], NOW), /今天<b>\$0<\/b>/);
});
