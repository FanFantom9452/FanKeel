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
const { parseReport, derive } = require('../lib/gatereport.js');
const { readGate } = require('../lib/handoff.js');

const ROOT = path.join(__dirname, '..');
const SURVEY = path.join(ROOT, 'docs', '90-agent', 'reports', 'evidence', '2026-10-18-gate-tab', 'survey.md');
const TEXT = fs.readFileSync(SURVEY, 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.js'), 'utf8');

const report = (stage, text, extra) => ({ stage, path: '.fankeel/build/task-20261018T093023/' + stage + '.md', text, gate: null,
    parts: Object.assign(derive(stage, parseReport(stage, text)), extra || {}) });
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
const STAGES = [{ stage: 'survey', from: 0, to: 2 * 60000 }, { stage: 'build', from: 2 * 60000, to: 59 * 60000 }, { stage: 'land', from: 59 * 60000, to: 66 * 60000 }];
const drawn = () => [
    V.gateTabHtml({ stage: 'survey', gateAt: 1 }, SURVEY_G, []),
    V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []),
    V.gateTabHtml({ stage: 'build' }, report('build', BUILD), PLAN),
    V.gateTabHtml({ stage: 'land', stages: STAGES }, report('land', LAND, { run: { pass: 3, fail: 1, ok: false, fast: false, command: 'x' } }), []),
];

test('the survey banner counts as many findings as it draws rows, and as the report has bullets', () => {
    const html = V.gateTabHtml({ stage: 'survey', gateAt: 1 }, SURVEY_G, []);
    const count = Number(/<b>(\d+)<\/b>處發現/.exec(html)[1]);
    const rows = /<ul class="gv-rows" data-block="gate-findings">([\s\S]*?)<\/ul>/.exec(html)[1].match(/<li>/g).length;
    const bullets = TEXT.match(/^- \S+:\d+ — /gm).length;
    assert.deepEqual([count, rows], [bullets, bullets]);
    assert.match(html, /^<div class="pv-banner" data-block="gate-banner">/);
    assert.match(html, />survey<\/span> gate：三件事盤點完了，要怎麼往下走？<\/h2>/);
    assert.match(html, /<li>class <code class="gv-sum">architectural<\/code><\/li>/);
    assert.match(html, /回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。/);
    assert.match(html, /<details class="gv-more" data-gv="rest"><summary>報告其餘<small>\d+ 行<\/small><\/summary><pre class="gv-rest">[\s\S]*## 盤點（patrol）/);
});

test('away from that stage\'s gate the report keeps a quiet head and no banner', () => {
    const html = V.gateTabHtml({ stage: 'design' }, SURVEY_G, []);
    assert.match(html, /^<div class="pv-hd" data-block="gate-head"><div class="srcline pv-src"/);
    assert.doesNotMatch(html, /gate-banner/);
    assert.match(html, /<div class="gv-body" data-block="gate-survey">/);
});

test('design draws the approach, the file table, the mockup link and its check lines, unverified marked', () => {
    const html = V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []);
    assert.match(html, /<li><b>2<\/b>個檔<\/li><li><b>1<\/b>條證明做完<\/li><li><b>1<\/b>件沒驗<\/li><li>附 mockup<\/li>/);
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
        const html = V.gateTabHtml({ stage: 'survey', gateAt: 1 }, Object.assign(report('survey', '- a.js:1 — x'), { gate }), []);
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

test('a report at the session\'s own stage draws the banner only while the session waits at that gate', () => {
    // A group brain's build-g<N>.md lands mid-build, long before build's gate.
    const g = report('build', BUILD);
    const busy = V.gateTabHtml({ stage: 'build' }, g, PLAN);
    assert.match(busy, /^<div class="pv-hd" data-block="gate-head">/);
    assert.doesNotMatch(busy, /gate-banner/);
    assert.doesNotMatch(V.tabsHtml({ id: 'x', stage: 'build' }, 'gate', { rows: [], events: [], tasks: [], gate: g }, null), /pv-tabgate/);
    for (const s of [{ stage: 'build', gateAt: 1 }, { stage: 'build', pending: { questions: [{ question: 'q' }] } }]) {
        assert.match(V.gateTabHtml(s, g, PLAN), /^<div class="pv-banner" data-block="gate-banner">/);
        assert.match(V.tabsHtml(Object.assign({ id: 'x' }, s), 'gate', { rows: [], events: [], tasks: [], gate: g }, null), /pv-tabgate/);
    }
});

test('the survey lead is its head and numbered points, and the banner counts what is unverified and what was not opened', () => {
    const html = V.gateTabHtml({ stage: 'survey', gateAt: 1 }, SURVEY_G, []);
    const lead = /<div class="gv-lead">([\s\S]*?)<\/div>/.exec(html)[1];
    assert.match(lead, /^<b>結論先說：三件事都有可動手的內容。<\/b><ol>/);
    assert.equal((lead.match(/<li>/g) || []).length, 3);
    assert.match(html, /<li><b>5<\/b>處發現<\/li><li><b>3<\/b>件沒驗<\/li><li><b>1528<\/b>個檔沒打開<\/li>/);
    assert.match(V.gateTabHtml({ stage: 'survey' }, report('survey', 'Just one thing.\n- a.js:1 — x'), []), /<p class="gv-lead">Just one thing\.<\/p>/);
});

test('survey draws unknown and skipped as lists when they hold more than one item', () => {
    const html = V.gateTabHtml({ stage: 'survey' }, SURVEY_G, []);
    assert.match(html, /<dt>unknown<\/dt><dd><ul><li>pane 在 AskUserQuestion 前或後出現<\/li><li>800px pane 是否要橫捲（gate-10 自己列為沒驗）<\/li><li>/);
    assert.match(html, /<dt>skipped<\/dt><dd><ul><li>1528 個檔案/);
    assert.match(V.gateTabHtml({ stage: 'survey' }, report('survey', '- a.js:1 — x\nunknown: one thing'), []), /<dt>unknown<\/dt><dd>one thing<\/dd>/);
});

test('survey folds the TODO patrol under its count and each disposition\'s, with the group lines inside', () => {
    const html = V.gateTabHtml({ stage: 'survey' }, SURVEY_G, []);
    assert.match(html, /<details class="gv-more" data-gv="patrol" data-block="gate-patrol"><summary>TODO 盤點 23 條<small>do now 1 · waiting on 8 · keep 14<\/small><\/summary>/);
    assert.match(html, /<div><dt>waiting on<\/dt><dd>audit-1、build-1、docs-1、foreign-1、model-4、quota-1、security-1、spend-2<\/dd><\/div>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'survey' }, report('survey', '- a.js:1 — x'), []), /gate-patrol/);
});

test('design counts its checks and what is unverified, swatches each dispatch\'s model, and shows the mockup\'s screenshot', () => {
    const two = DESIGN.replace('counts the findings', 'counts the findings; tests/station-gate-tab.test.js draws them').replace('unverified: the pane order', 'unverified: the pane order; the 800px scroll');
    const shot = Object.assign({}, MOCKUP, { shot: { path: '.fankeel/build/2026-10-18-gate-tab/shot-1600/render.png', href: 'file:///F:/r/.fankeel/build/2026-10-18-gate-tab/shot-1600/render.png' } });
    const html = V.gateTabHtml({ id: 'abc-1', stage: 'design' }, report('design', two, { mockup: shot }), []);
    assert.match(html, /<li><b>2<\/b>個檔<\/li><li><b>2<\/b>條證明做完<\/li><li><b>2<\/b>件沒驗<\/li><li>附 mockup<\/li>/);
    assert.equal(html.match(/<td class="pv-disp"><span class="pv-m"><i class="sw" style="background:var\(--m-opus\)"><\/i>opus<\/span><\/td>/g).length, 2);
    assert.match(html, /<dt>證明做完<\/dt><dd><ul><li>tests\/gatereport\.test\.js counts the findings<\/li><li>tests\/station-gate-tab\.test\.js draws them<\/li><\/ul><\/dd>/);
    assert.match(html, /<figure class="gv-shot"><a href="file:\/\/\/F:\/r\/[^"]*mockup\.html" target="_blank" rel="noopener"><img src="file:\/\/\/F:\/r\/[^"]*shot-1600\/render\.png" alt="mockup 的截圖" loading="lazy"><\/a>/);
    global.window.STATION.serve = true;
    try {
        assert.match(V.gateTabHtml({ id: 'abc-1', stage: 'design' }, report('design', two, { mockup: shot }), []), /<img src="station\/shot\/abc-1\.png"/);
    } finally {
        global.window.STATION.serve = false;
    }
    assert.doesNotMatch(V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: Object.assign({}, MOCKUP, { shot: null }) }), []), /<img /);
    assert.match(V.gateTabHtml({ stage: 'design' }, report('design', DESIGN.replace('implementer, opus |', 'in-session, the tab |'), { mockup: MOCKUP }), []), /<td class="pv-disp">in-session, the tab<\/td>/);
});

test('design draws a dispatch cell\'s effort after the model\'s swatch, and none when the cell names none', () => {
    const html = V.gateTabHtml({ stage: 'design' }, report('design', DESIGN.replace('implementer, opus |', 'implementer, opus, high |'), { mockup: MOCKUP }), []);
    assert.match(html, /<td class="pv-disp"><span class="pv-m"><i class="sw" style="background:var\(--m-opus\)"><\/i>opus<\/span> · high<\/td>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []), / · high|opus<\/span> ·/);
});

test('build counts its fix rounds and rulings, each task\'s own rounds, and each kind\'s lines', () => {
    const plan = [{ plan: 'docs/90-agent/plans/p.md', fixes: 3, rulings: 5, tasks: [Object.assign({}, PLAN[0].tasks[0], { fixes: 2 }), Object.assign({}, PLAN[0].tasks[1], { fixes: 0 })] }];
    const html = V.gateTabHtml({ stage: 'build' }, report('build', BUILD, { rounds: 2 }), plan);
    assert.match(html, /<li><b>3<\/b>輪修正<\/li><li><b>2<\/b>輪驗證往返<\/li><li><b>5<\/b>條裁定<\/li>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'build' }, report('build', BUILD, { rounds: 0 }), plan), /輪驗證往返/);
    assert.equal((html.match(/<span>修 2 輪<\/span>/g) || []).length, 1);
    assert.doesNotMatch(html, /修 0 輪/);
    assert.match(html, /<p class="gv-fg"><b>程式<\/b><span>2 個 · <span class="gv-add">\+305<\/span> <span class="gv-del">−27<\/span><\/span><\/p>/);
    assert.match(html, /<p class="gv-fg"><b>測試<\/b><span>1 個 · <span class="gv-add">\+0<\/span> <span class="gv-del">−0<\/span><\/span><\/p>/);
    assert.match(html, /<p class="gv-fg"><b>文件<\/b><span>1 個 · <span class="gv-add">\+48<\/span> <span class="gv-del">−31<\/span><\/span><\/p>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'build' }, report('build', BUILD), PLAN), /輪修正|條裁定/);
});

test('land counts the main session\'s time, draws the suite record\'s pass and fail, and the time by stage as a bar and legend', () => {
    const run = { pass: 1520, fail: 0, ok: true, fast: false, command: 'node --test tests/' };
    const html = V.gateTabHtml({ stage: 'land', stages: STAGES }, report('land', LAND, { run }), []);
    assert.match(html, /<li><b>1h6m<\/b>主 session<\/li>/);
    assert.match(html, /<span class="gv-suite">[\s\S]*?1520 通過 · 0 失敗<\/span><code class="gv-cmd">suite\.js: 1520 pass, 0 fail<\/code>/);
    const bar = /<div class="gv-bar" role="img" aria-label="([^"]*)">([\s\S]*?)<\/div>/.exec(html);
    assert.equal(bar[1], '主 session 各站時間：survey 2m, build 57m, land 7m');
    assert.equal((bar[2].match(/<i style="--c:var\(--st-/g) || []).length, 3);
    assert.match(html, /<ul class="gv-legend" aria-hidden="true"><li><i style="--c:var\(--st-survey\)"><\/i>survey <b>2m<\/b><\/li>/);
    const red = V.gateTabHtml({ stage: 'land', stages: STAGES }, report('land', LAND, { run: Object.assign({}, run, { ok: false, fail: 2 }) }), []);
    assert.match(red, /<span class="gv-suite gv-red">1520 通過 · 2 失敗<\/span>/);
    const bare = V.gateTabHtml({ stage: 'land' }, report('land', LAND, { run: null }), []);
    assert.doesNotMatch(bare, /主 session<\/li>|gv-suite|gv-bar/);
});

test('a mockup whose screenshot directory cannot be read says so, with the path escaped', () => {
    const html = V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: Object.assign({}, MOCKUP, { shotUnreadable: 'F:/r/<x>' }) }), []);
    assert.match(html, /<p class="gv-red">讀不到截圖目錄 <code>F:\/r\/&lt;x&gt;<\/code>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'design' }, report('design', DESIGN, { mockup: MOCKUP }), []), /讀不到截圖目錄/);
});

test('a land gate whose suite.json cannot be read says so, with the path escaped', () => {
    const html = V.gateTabHtml({ stage: 'land' }, report('land', LAND, { runUnreadable: 'F:/r/<s>.json' }), []);
    assert.match(html, /<p class="gv-red">讀不到 <code>F:\/r\/&lt;s&gt;\.json<\/code>/);
    assert.doesNotMatch(V.gateTabHtml({ stage: 'land' }, report('land', LAND, {}), []), /讀不到/);
});
