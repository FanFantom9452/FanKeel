'use strict';
// lib/weekly-render.js: the weekly report's one self-contained page and the
// guard in front of it (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 頁面區塊 and 十個問題 #6, #10).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wr = require('../lib/weekly-render.js');
const wm = require('../lib/weekly-modules.js');

const ROOT = path.join(__dirname, '..');
const stationCss = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const reportCss = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.css'), 'utf8');

function data(previous) {
    const def = { title: 'demo 架構', frames: [{ id: 'f-src', label: 'src', nodes: [{ id: 'n-src-api', name: 'api', match: 'src/api/' }, { id: 'n-src-other', name: '其他', match: 'src/*' }] }] };
    const list = [{ h: 'a1', date: '2026-01-01', subj: 'feat(api): x', files: [{ p: 'src/api/a.js', a: 250, d: 10 }, { p: 'docs/x.md', a: 40, d: 0 }] }];
    const stats = wm.moduleStats(def, list, { attrs: [] });
    return {
        since: '2025-12-31', until: '2026-01-02', days: ['2025-12-31', '2026-01-01', '2026-01-02'], previous: previous || null,
        repos: [{ name: 'demo', path: '/x/demo', records: [], sessions: [], scopes: [], daily: { '2025-12-31': 0, '2026-01-01': 1, '2026-01-02': 0 }, commits: 1, modules: stats, board: wm.boardText(def, stats.mods) }],
    };
}

function events(extra) {
    return Object.assign({
        projects: { demo: '示範專案' },
        summary: [{ repo: 'demo', title: '查詢頁上線', text: '新增查詢頁，可以依日期查。' }],
        events: [
            { title: '查詢頁 <b>', repo: 'demo', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '程式提交 1/1', times: '1/1', modules: ['n-src-api'], count: 2 },
            { title: '匯出', repo: 'demo', status: 'ongoing', point: '', did: '開始做匯出。', why: '會議決定。', next: '完成匯出。', evidence: '程式提交 1/2', modules: [] },
        ],
        architecture: { demo: '改最多的是查詢介面。' },
        labels: { demo: { 'n-src-api': '查詢介面' } },
        carry: [{ repo: 'demo', said: '做查詢頁', verdict: 'done', now: '已完成。' }, { repo: 'demo', said: '做匯出', verdict: 'partial', now: '做了一半。' }],
        next: [{ repo: 'demo', text: '完成匯出。' }],
    }, extra);
}

const opts = { stationCss, reportCss, generated: '2026-01-02' };
const blocks = (html) => [...html.matchAll(/data-block="([a-z-]+)"/g)].map((m) => m[1]);

test('render writes every block in order, carry only when there is a previous report', async () => {
    const without = await wr.render(data(), events(), opts);
    assert.deepEqual(blocks(without), ['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'next', 'footer']);
    const withPrev = await wr.render(data({ since: '2025-12-24', until: '2025-12-30', next: [] }), events(), opts);
    assert.deepEqual(blocks(withPrev), ['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'carry', 'next', 'footer']);
    assert.ok(withPrev.includes('<span class="pill made">做到</span>') && withPrev.includes('<span class="pill part">部分</span>'));
    assert.match(withPrev, /<p class="carry-tally"><span><b>1<\/b>做到<\/span><span><b>1<\/b>部分<\/span><span><b>0<\/b>沒做<\/span><\/p>/);
});

test('the page is one file: no src= or href=, nothing left unfilled, the day count on the page', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i);
    assert.doesNotMatch(html, /\{\{/);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('<main class="page" data-block="page" style="--days: 3">'));
    assert.ok(html.includes('<title>工作週報 2025-12-31 至 2026-01-02</title>'));
});

test('the station keel tokens and the heat ramp are inlined, keel over base, dark and print too', async () => {
    const css = wr.tokens(stationCss);
    assert.match(css, /^:root\{color-scheme:light;[^}]*--ground:#f2f4f3/);
    assert.match(css, /^:root\{[^}]*--heat-4:#1c3a8c;--heat-4-line:#152c6b;--heat-4-ink:#fbfcfc/);
    assert.match(css, /@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{color-scheme:dark;[^}]*--heat-4:#cbd8fa/);
    assert.match(css, /:root\[data-theme="dark"\]\{color-scheme:dark;/);
    assert.match(css, /@media print\{/);
    const html = await wr.render(data(), events(), opts);
    assert.ok(html.includes(css));
    assert.ok(html.includes('.archmap .cr-shape[fill="#9db4ee"]{fill:var(--heat-2)'));
    assert.ok(html.includes('.hrow .cells { display: contents; }'), 'report.css is inlined');
});

test('cards, chips and the architecture use the model\'s labels, with the module\'s heat level', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.ok(html.includes('<li class="mod h4">查詢介面</li>'), 'api: all 260 code lines of the repo, a share of 1, is level 4');
    assert.ok(html.includes('<span><i class="h2"></i>5% 至 15%</span>') && html.includes('<span><i class="h4"></i>40% 以上</span>'), 'the legend reads shares');
    assert.ok(html.includes('查詢頁 &lt;b&gt;<small> ×2</small>'), 'titles are escaped, a merged record shows its count');
    assert.ok(html.includes('<span class="pill done">已完成</span>') && html.includes('<span class="pill ongoing">進行中</span>'));
    assert.ok(html.includes('<p class="why">改最多的是查詢介面。</p>'));
    assert.ok(html.includes('<b>1 / 2</b>'), 'one of two modules changed');
    assert.ok(/<svg[\s\S]*查詢介面[\s\S]*<\/svg>/.test(html), 'the board was relabelled before it was drawn');
    assert.ok(html.includes('<span class="mono">+250</span> <span class="mono">−10</span> 行'), 'architecture totals count code only');
});

test('a card resolves its modules by id only, because two frames can both have a 其他', async () => {
    const byId = await wr.render(data(), events({ events: [{ title: '雜項', repo: 'demo', status: 'done', point: '', did: '整理。', why: '順手。', next: '無。', evidence: '程式提交 1/1', modules: ['n-src-other'] }] }), opts);
    assert.ok(byId.includes('<li class="mod h0">其他</li>'));
    const byName = await wr.render(data(), events({ events: [{ title: '雜項', repo: 'demo', status: 'done', point: '', did: '整理。', why: '順手。', next: '無。', evidence: '程式提交 1/1', modules: ['其他', '查詢介面'] }] }), opts);
    assert.doesNotMatch(byName, /<div class="mods">/, 'a name or a label is not an id');
});

test('guard names each internal word, money, id and listed word, and where it sits', () => {
    const ev = events();
    ev.events[0].did = '開了一個 Session 來做';
    ev.events[1].why = '花了 $12';
    ev.summary[0].text = 'id 3f2a1b4c-1d2e-4f5a-8b9c-0123456789ab';
    ev.next[0].text = '交給 ACME 公司';
    ev.events[1].modules = ['n-scripts-station-js'];
    const hits = wr.guard(ev, ['acme']);
    assert.deepEqual(hits, [
        { where: 'summary[0].text', word: 'UUID' },
        { where: 'events[0].did', word: 'session' },
        { where: 'events[1].why', word: '$ 金額' },
        { where: 'next[0].text', word: 'acme' },
    ]);
    assert.deepEqual(wr.guard(events(), []), []);
    assert.deepEqual(wr.guard({ events: [{ did: 'gateway 和 stationary 不算' }] }, []), []);
    assert.deepEqual(wr.guard({ events: [{ did: 'mysession 和 xstation 不算' }] }, []), []);
    assert.deepEqual(wr.guard({ events: [{ did: 'Sessions 與 TODOs' }] }, []), [
        { where: 'events[0].did', word: 'session' },
        { where: 'events[0].did', word: 'TODO' },
    ]);
    assert.deepEqual(wr.BUILTIN_WORDS, ['session', 'gate', 'station', 'brain', 'TODO', 'subagent']);
});

test('archiveOf is the record the station lists: range, projects, counts, events, carry and next', () => {
    const got = wr.archiveOf(data(), events(), '2026-01-02');
    assert.deepEqual([got.since, got.until, got.generated], ['2025-12-31', '2026-01-02', '2026-01-02']);
    assert.deepEqual(got.projects, ['demo']);
    assert.deepEqual(got.counts, { done: 1, ongoing: 1 });
    assert.deepEqual(got.next, [{ repo: 'demo', text: '完成匯出。' }]);
    assert.equal(got.events.length, 2);
    assert.equal(got.carry.length, 2);
});

test('report.css is the mockup\'s, with a variable day count and no template markers', () => {
    assert.ok(reportCss.includes('repeat(var(--days), minmax(0, 1fr))'));
    assert.doesNotMatch(reportCss, /repeat\(11|\{\{/);
    assert.doesNotMatch(reportCss, /--heat-0:/, 'token values come from tokens(), not the stylesheet');
});

test('report.css lets the header project chips wrap on a narrow page', () => {
    const rule = /\.proj-chip\s*\{([^}]*)\}/.exec(reportCss)[1];
    assert.doesNotMatch(rule, /white-space:\s*nowrap/);
    assert.match(rule, /min-width:\s*0/);
    assert.match(reportCss, /\.page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('a header chip shows the name and the tagline, the long project line only as its tooltip', async () => {
    const html = await wr.render(data(), events({ projects: { demo: '一段很長很長的專案說明文字' }, taglines: { demo: '示範用' } }), opts);
    assert.ok(html.includes('<li class="proj-chip" title="一段很長很長的專案說明文字"><b>demo</b>示範用</li>'));
    assert.doesNotMatch(html, /<\/b>一段很長/);
});

test('a header chip without a tagline shows the name only, never the project line', async () => {
    const html = await wr.render(data(), events({ projects: { demo: '一段很長很長的專案說明文字' } }), opts);
    assert.ok(html.includes('<li class="proj-chip" title="一段很長很長的專案說明文字"><b>demo</b></li>'));
});

test('guard reaches every events.json key outside events: projects, taglines, summary, architecture, labels, carry, next', () => {
    const bad = { builtin: '開 Session', listed: '交給 ACME', uuid: '3f2a1b4c-1d2e-4f5a-8b9c-0123456789ab', money: '花了 $12' };
    const put = {
        projects: (t) => events({ projects: { demo: t } }),
        taglines: (t) => events({ taglines: { demo: t } }),
        summary: (t) => events({ summary: [{ repo: 'demo', title: 'x', text: t }] }),
        architecture: (t) => events({ architecture: { demo: t } }),
        labels: (t) => events({ labels: { demo: { 'n-src-api': t } } }),
        carry: (t) => events({ carry: [{ repo: 'demo', said: t, verdict: 'done', now: 'ok' }] }),
        next: (t) => events({ next: [{ repo: 'demo', text: t }] }),
    };
    const where = { projects: 'projects.demo', taglines: 'taglines.demo', summary: 'summary[0].text', architecture: 'architecture.demo', labels: 'labels.demo.n-src-api', carry: 'carry[0].said', next: 'next[0].text' };
    const word = { builtin: 'session', listed: 'acme', uuid: 'UUID', money: '$ 金額' };
    for (const key of Object.keys(put)) {
        for (const kind of Object.keys(bad)) {
            assert.deepEqual(wr.guard(put[key](bad[kind]), ['acme']), [{ where: where[key], word: word[kind] }], key + ' / ' + kind);
        }
    }
});

test('guardData reads the repo name, the frame and any module name the model gave no label for', () => {
    const d = data();
    d.repos[0].name = 'acme-demo';
    d.repos[0].modules.mods[0].name = 'Station 層';
    d.repos[0].modules.mods[1].frame = '花了 $12';
    assert.deepEqual(wr.guardData(d, events(), ['acme']), [
        { where: 'repos[0].name', word: 'acme' },
        { where: 'repos[0].modules.mods[0].name', word: 'station' },
        { where: 'repos[0].modules.mods[1].frame', word: '$ 金額' },
    ]);
    const ev = events({ labels: { 'acme-demo': { [d.repos[0].modules.mods[0].id]: '查詢介面' } } });
    assert.deepEqual(wr.guardData(d, ev, []).map((h) => h.where), ['repos[0].modules.mods[1].frame'], 'a labelled module name never shows, so it is not read');
    const empty = events({ labels: { 'acme-demo': { [d.repos[0].modules.mods[0].id]: '' } } });
    assert.ok(wr.guardData(d, empty, ['station']).some((h) => h.where === 'repos[0].modules.mods[0].name'), 'an empty label prints the module name, so it is still read');
    assert.deepEqual(wr.guardData(data(), events(), []), []);
});

test('the guard walks the taglines', () => {
    assert.deepEqual(wr.guard(events({ taglines: { demo: '工作 Session' } }), []), [{ where: 'taglines.demo', word: 'session' }]);
});
