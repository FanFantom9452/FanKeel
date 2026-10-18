'use strict';
// The gate tab's panels (docs/90-agent/plans/2026-10-18-gate-tab-design.md §4):
// `gateTabHtml` draws a stage's parsed report under the plan tab's banner.
// The survey case is this task's own survey report, parsed as the station
// parses it, so the count in the banner is checked against the rows drawn.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');
const { parseReport } = require('../lib/gatereport.js');
const { readGate } = require('../lib/handoff.js');

const ROOT = path.join(__dirname, '..');
const SURVEY = path.join(ROOT, 'docs', '90-agent', 'reports', 'evidence', '2026-10-18-gate-tab', 'survey.md');
const TEXT = fs.readFileSync(SURVEY, 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.js'), 'utf8');

const report = (stage, text, extra) => ({ stage, path: '.fankeel/build/task-20261018T093023/' + stage + '.md', text, gate: null,
    parts: Object.assign(parseReport(stage, text), extra || {}) });
const SURVEY_G = Object.assign(report('survey', TEXT), { gate: readGate(SURVEY) });
const DESIGN = [
    'Add a gate tab that reads the newest handoff.',
    '',
    '| file | change | dispatch |',
    '|---|---|---|',
    '| `lib/gatereport.js` | new: reads the report | implementer, opus |',
    '| assets/station/station.js | the tab | implementer, opus |',
    '',
    'proves it done: tests/gatereport.test.js counts the findings',
    'against the map: no conflict',
    'unverified: the pane order',
    'spec: `.fankeel/build/2026-10-18-gate-tab/mockup.html`',
].join('\n');
const MOCKUP = { path: '.fankeel/build/2026-10-18-gate-tab/mockup.html', href: 'file:///F:/r/.fankeel/build/2026-10-18-gate-tab/mockup.html' };
const BUILD = [
    '- assets/station/station.js +217/-15 — the gate tab',
    '- tests/station-gate-tab.test.js (new) — its panels',
    '- docs/90-agent/reference/station.md +48/-31 — the paragraph',
    '- lib/gatereport.js +88/-12 — the reader',
    '',
    'done: 2 of 3 — ledger',
    'docs-check: clean',
].join('\n');
const LAND = [
    '1d7cf209 chore: 0.111.26 - plan gate page lands',
    'shipped:',
    '  - the plan tab draws the plan before its gate',
    '  - hovering a card lights what it waits for',
    'suite: suite.js: 1520 pass, 0 fail',
    'cost: $35.88',
    'open: the pane order is unverified',
    '白話: 以前看不到要核准的步驟；現在問題跳出前，監控站先開一頁列出來。',
].join('\n');
const PLAN = [{ plan: 'docs/90-agent/plans/p.md', tasks: [{ n: 1, title: 'the `reader`', status: 'complete', range: 'a23fcfd..9cfaaea' },
    { n: 2, title: 'the tab', status: 'no ledger line', range: null }] }];
const drawn = () => [
    V.gateTabHtml({ stage: 'survey' }, SURVEY_G, []),
    V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []),
    V.gateTabHtml({ stage: 'build' }, report('build', BUILD), PLAN),
    V.gateTabHtml({ stage: 'land' }, report('land', LAND), []),
];

test('the survey banner counts as many findings as it draws rows, and as the report has bullets', () => {
    const html = V.gateTabHtml({ stage: 'survey' }, SURVEY_G, []);
    const count = Number(/<b>(\d+)<\/b>處發現/.exec(html)[1]);
    const rows = /<ul class="gv-rows" data-block="gate-findings">([\s\S]*?)<\/ul>/.exec(html)[1].match(/<li>/g).length;
    const bullets = TEXT.match(/^- \S+:\d+ — /gm).length;
    assert.deepEqual([count, rows], [bullets, bullets]);
    assert.match(html, /^<div class="pv-banner" data-block="gate-banner">/);
    assert.match(html, />survey<\/span> gate：三件事盤點完了，要怎麼往下走？<\/h2>/);
    assert.match(html, /<li>class <code class="gv-sum">architectural<\/code><\/li>/);
    assert.match(html, /回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。/);
    assert.match(html, /<details class="gv-more"><summary>報告其餘<small>\d+ 行<\/small><\/summary><pre class="gv-rest">[\s\S]*## 盤點（patrol）/);
});

test('away from that stage\'s gate the report keeps a quiet head and no banner', () => {
    const html = V.gateTabHtml({ stage: 'design' }, SURVEY_G, []);
    assert.match(html, /^<div class="pv-hd" data-block="gate-head"><div class="srcline pv-src"/);
    assert.doesNotMatch(html, /gate-banner/);
    assert.match(html, /<div class="gv-body" data-block="gate-survey">/);
});

test('design draws the approach, the file table, the mockup link and its check lines, unverified marked', () => {
    const html = V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []);
    assert.match(html, /<li><b>2<\/b>個檔<\/li><li>附 mockup<\/li>/);
    assert.match(html, /<p class="gv-approach">Add a gate tab/);
    assert.equal(html.match(/<tr><td><code class="gv-path">/g).length, 2);
    assert.match(html, /<figure class="gv-shot">.*<a href="file:\/\/\/F:\/r\/\.fankeel\/build\/2026-10-18-gate-tab\/mockup\.html"[^>]*>\.fankeel\/build\/2026-10-18-gate-tab\/mockup\.html<\/a>/);
    assert.match(html, /<dl class="gv-kv gv-checks">.*<div class="warn"><dt>沒驗<\/dt><dd>the pane order<\/dd><\/div>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: null }), []), /gv-shot|附 mockup/);
});

test('build sums its files\' lines in the banner, draws the plan\'s tasks as cards and the files by kind', () => {
    const html = V.gateTabHtml({ stage: 'build' }, report('build', BUILD), PLAN);
    assert.match(html, /<li><b>2<\/b>\/ 3 task 完成<\/li><li><b>4<\/b>個檔 <span class="gv-sum"><span class="gv-add">\+353<\/span> <span class="gv-del">−58<\/span><\/span><\/li>/);
    assert.equal(html.match(/<article class="pv-card gv-mini"/g).length, 2);
    assert.equal(html.match(/<span class="gv-ok">/g).length, 1);
    assert.match(html, /<code>a23fcfd\.\.9cfaaea<\/code>/);
    assert.match(html, /還沒有 ledger 行/);
    assert.match(html, /<b>程式<\/b>.*<b>測試<\/b>.*<b>文件<\/b>/);
    assert.match(html, /tests\/station-gate-tab\.test\.js<\/code><span class="gv-d">新檔<\/span>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'build' }, report('build', BUILD), []), /gv-mini/, 'no plan, no task cards');
});

test('land puts 白話 first, then the commit, what shipped and what is still open', () => {
    const html = V.gateTabHtml({ stage: 'land' }, report('land', LAND), []);
    assert.match(html, /<li><b>2<\/b>件做得到了<\/li>/);
    const plain = html.indexOf('class="gv-plain"');
    assert.ok(plain >= 0 && plain < html.indexOf('class="gv-commit"'), 'plain words before the commit');
    assert.equal(/<ul class="gv-ship">([\s\S]*?)<\/ul>/.exec(html)[1].match(/<li>/g).length, 2);
    assert.match(html, /<ul class="gv-open"><li>the pane order is unverified<\/li><\/ul>/);
});

test('no report yet and a report that will not open each say so', () => {
    const none = '<p class="pv-empty">這個 session 還沒寫出 design 的 handoff。stage 走到 gate 時，這裡列出它的報告。</p>';
    assert.equal(V.gateTabHtml({ stage: 'design' }, null, []), none);
    assert.equal(V.gateTabHtml({ stage: 'build' }, { error: 'none', stage: 'design', path: 'x' }, []), none);
    assert.equal(V.gateTabHtml({ stage: 'survey' }, { error: 'unreadable', stage: 'survey', path: '.fankeel/build/t/survey.md' }, []),
        '<p class="pv-empty err">讀不到 <code>.fankeel/build/t/survey.md</code>：檔案在，但打不開。</p>');
});

test('report text is escaped', () => {
    const html = V.gateTabHtml({ stage: 'survey' }, report('survey', '- a.js:1 — <script>alert(1)</script>\nodd <img src=x>\n'), []);
    assert.doesNotMatch(html, /<script>|<img/);
    assert.match(html, /&lt;script&gt;/);
});

test('every gv- class drawn has a rule in station.css', () => {
    const used = new Set();
    for (const html of drawn()) {
        for (const m of html.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (/^gv-/.test(c)) used.add(c);
    }
    const missing = [...used].filter((c) => !new RegExp('\\.' + c + '(?![\\w-])').test(CSS));
    assert.deepEqual(missing, []);
    assert.ok(used.size > 20, 'the panels were drawn: ' + [...used].join(' '));
});

test('below 1000px the body drops its minimum width and the side bar and search fold away', () => {
    const blocks = [...CSS.matchAll(/@media \(max-width:999px\)\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
    for (const rule of ['body{min-width:0}', '.shell>aside{display:none}', '.mast .search{display:none}']) assert.ok(blocks.includes(rule), rule);
});

test('the gate tab adds no listener', () => {
    const from = SRC.indexOf('// ---- 關卡: the gate tab');
    const to = SRC.indexOf('function gateTab(s, x)');
    assert.ok(from > 0 && to > from, 'the block is where it was put');
    assert.doesNotMatch(SRC.slice(from, to), /addEventListener/);
});

test('report lines no rule recognised are escaped in the rest', () => {
    const g = report('build', '- a.js +1/-0 — x\n<img src=x>\n');
    assert.deepEqual(g.parts.rest, ['<img src=x>'], 'the line lands in rest');
    const rest = /<pre class="gv-rest">([\s\S]*?)<\/pre>/.exec(V.gateTabHtml({ stage: 'build' }, g, []))[1];
    assert.equal(rest, '&lt;img src=x&gt;');
});

test('at the gate with no gate question to read, the banner says so instead of a bare colon', () => {
    for (const gate of [null, { questions: [] }]) {
        const html = V.gateTabHtml({ stage: 'survey' }, Object.assign(report('survey', '- a.js:1 — x'), { gate }), []);
        const h2 = /<h2>([\s\S]*?)<\/h2>/.exec(html)[1];
        assert.doesNotMatch(h2, /[：:]$/);
        assert.match(h2, /survey<\/span> gate：報告裡沒有讀得出的 gate 問題$/);
    }
});

test('a stage with no gate page says so rather than that its handoff is missing', () => {
    const html = V.gateTabHtml({ stage: 'verify' }, null, []);
    assert.equal(html, '<p class="pv-empty">verify 沒有關卡頁：這頁只列 survey、design、build、land 的 gate 報告；plan 的 gate 在「計畫」tab。</p>');
    assert.doesNotMatch(html, /還沒寫出/);
});
