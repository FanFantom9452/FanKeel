'use strict';
// lib/weekly-render.js: the 每天的工作量 switch, facets and the 一般／技術
// audience, each card's technical detail, the read-only questions and the
// filter script (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §1-§3;
// mockup .fankeel/build/2026-10-30-weekly-facets/mockup.html).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wr = require('../lib/weekly-render.js');
const wm = require('../lib/weekly-modules.js');

const ROOT = path.join(__dirname, '..');
const stationCss = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const reportCss = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.css'), 'utf8');
const reportJs = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.js'), 'utf8');

function data() {
    const def = { title: 'demo 架構', frames: [{ id: 'f-src', label: 'src', nodes: [{ id: 'n-src-api', name: 'api', match: 'src/api/' }, { id: 'n-src-other', name: '其他', match: 'src/*' }] }] };
    const list = [{ h: 'a1', date: '2026-01-01', subj: 'feat(api): x', files: [{ p: 'src/api/a.js', a: 250, d: 10 }] }];
    const stats = wm.moduleStats(def, list, { attrs: [] });
    return {
        since: '2025-12-31', until: '2026-01-02', days: ['2025-12-31', '2026-01-01', '2026-01-02'], previous: null,
        repos: [{ name: 'demo', path: '/x/demo', records: [], sessions: [], scopes: [], daily: { '2025-12-31': 0, '2026-01-01': 1, '2026-01-02': 0 }, commits: 1, modules: stats, board: wm.boardText(def, stats.mods) }],
    };
}

function events(extra) {
    return Object.assign({
        projects: { demo: '示範專案' },
        summary: [{ repo: 'demo', title: '查詢頁上線', text: '新增查詢頁。' }],
        events: [
            { title: '查詢頁', repo: 'demo', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '程式提交 1/1', times: '1/1', modules: ['n-src-api'], facets: ['使用者介面', '商業／產品'], tech: '查詢介面改成分頁讀取。' },
            { title: '匯出', repo: 'demo', status: 'ongoing', point: '', did: '開始做匯出。', why: '會議決定。', next: '完成匯出。', evidence: '程式提交 1/2', times: '1/2 至今', modules: [], facets: ['後端／資料'] },
            { title: '查詢說明', repo: 'demo', status: 'done', point: '', did: '寫說明。', why: '方便使用。', next: '無。', evidence: '程式提交 1/1', modules: [], facets: ['使用者介面'] },
        ],
        architecture: {}, labels: {}, carry: [], next: [{ repo: 'demo', text: '完成匯出。' }],
    }, extra);
}

const opts = { stationCss, reportCss, reportJs, generated: '2026-01-02' };
const cardsOf = (html) => [...html.matchAll(/<li class="panel event"[\s\S]*?\n<\/li>/g)].map((m) => m[0]);

test('DEFAULT_FACETS is the design\'s six, each with its readers', () => {
    assert.deepEqual(wr.DEFAULT_FACETS, [
        { name: '商業／產品', audience: 'general' }, { name: '文件／流程', audience: 'general' },
        { name: '使用者介面', audience: 'both' }, { name: '研究／實驗', audience: 'both' },
        { name: '後端／資料', audience: 'tech' }, { name: '維運／工具', audience: 'tech' },
    ]);
});

test('show.daily off or missing: no timeline, and no card prints its dates, the ongoing one included', async () => {
    for (const show of [undefined, { daily: false }, { daily: 'yes' }]) {
        const html = await wr.render(data(), events({ show }), opts);
        assert.doesNotMatch(html, /data-block="timeline"/, JSON.stringify(show));
        assert.doesNotMatch(html, /<span class="times">/, JSON.stringify(show));
        const ongoing = cardsOf(html).find((c) => c.includes('進行中'));
        assert.ok(ongoing, 'the ongoing card is drawn');
        assert.doesNotMatch(ongoing, /class="times"|至今/);
    }
    const on = await wr.render(data(), events({ show: { daily: true } }), opts);
    assert.match(on, /data-block="timeline"/);
    assert.ok(on.includes('<span class="times">1/2 至今</span>'));
});

test('a facet outside the vocabulary, or a card with none, is refused by render and named by shapeHits', async () => {
    const bad = events();
    bad.events[1].facets = ['營運'];
    delete bad.events[2].facets;
    assert.deepEqual(wr.shapeHits(bad, wr.DEFAULT_FACETS), [
        { where: 'events[1].facets[0]', word: '詞表外：營運' },
        { where: 'events[2].facets', word: '沒有面向' },
    ]);
    await assert.rejects(wr.render(data(), bad, opts), /events\[1\]\.facets\[0\]: 詞表外：營運/);
    const own = [{ name: '營運', audience: 'tech' }, { name: '使用者介面', audience: 'both' }];
    bad.events[0].facets = ['使用者介面'];
    bad.events[2].facets = ['使用者介面'];
    assert.deepEqual(wr.shapeHits(bad, own), []);
    const html = await wr.render(data(), bad, Object.assign({}, opts, { facets: own }));
    assert.match(html, /data-facet="f0" data-aud="tech" aria-pressed="false">營運<span class="n">1<\/span>/);
});

test('shapeHits holds tech to one to three sentences and question ids to unique short names', () => {
    const ev = events({ questions: [{ id: 'q1', repo: 'demo', text: 'a' }, { id: 'q1', repo: 'demo', text: 'b' }, { id: 'q 3', repo: 'demo', text: '' }] });
    ev.events[0].tech = '一。二。三。四。';
    assert.deepEqual(wr.shapeHits(ev, wr.DEFAULT_FACETS), [
        { where: 'events[0].tech', word: '一到三句' },
        { where: 'questions[1].id', word: '題號重複或不合格' },
        { where: 'questions[2].id', word: '題號重複或不合格' },
        { where: 'questions[2].text', word: '沒有題目' },
    ]);
});

test('the facet bar lists only this period\'s facets, general to tech, each chip counting the cards that carry it', async () => {
    const html = await wr.render(data(), events(), opts);
    const bar = /<div class="facet-bar"[\s\S]*?<\/div>/.exec(html)[0];
    const chips = [...bar.matchAll(/data-facet="(f\d+)" data-aud="(\w+)" aria-pressed="false">([^<]+)<span class="n">(\d+)<\/span>/g)];
    assert.deepEqual(chips.map((c) => [c[3], c[2]]), [['商業／產品', 'gen'], ['使用者介面', 'both'], ['後端／資料', 'tech']]);
    const cards = cardsOf(html).map((c) => /data-facets="([^"]*)"/.exec(c)[1].split(' '));
    assert.equal(cards.length, 3);
    for (const c of chips) assert.equal(Number(c[4]), cards.filter((f) => f.includes(c[1])).length, c[3]);
    assert.ok(bar.includes('data-facet="all" aria-pressed="true">全部<span class="n">3</span>'));
    assert.doesNotMatch(bar, /文件／流程|研究／實驗|維運／工具/, 'a facet with no card this period gets no chip');
});

test('a card lists its facets general first, and keeps tech, module chips and evidence in its technical detail', async () => {
    const html = await wr.render(data(), events(), opts);
    const [first, second] = cardsOf(html);
    assert.ok(first.includes('<ul class="facets" aria-label="面向"><li class="facet a-gen" title="一般讀者">商業／產品</li><li class="facet a-both" title="兩者讀者">使用者介面</li></ul>'));
    assert.ok(first.includes('data-facets="f0 f2"'));
    const detail = /<div class="tech-detail" data-block="tech-detail">[\s\S]*<\/div>\n<\/li>/.exec(first)[0];
    assert.ok(detail.includes('<p class="td-text"><span class="td-k">技術細節</span>查詢介面改成分頁讀取。</p>'));
    assert.ok(detail.includes('<div class="mods">'));
    assert.ok(detail.includes('<p class="evidence">依據：程式提交 1/1</p>'));
    assert.doesNotMatch(second, /td-text/, 'no tech, no paragraph');
});

test('the header carries the 一般／技術 switch, 一般 pressed', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.match(html, /<div class="aud" data-block="audience-toggle">[\s\S]*<button type="button" data-aud="gen" aria-pressed="true">一般<\/button><button type="button" data-aud="tech" aria-pressed="false">技術<\/button>/);
});

test('without the script the bar and the switch are hidden and every technical detail shows', () => {
    assert.match(reportCss, /\.facet-bar,\s*\.aud\s*\{\s*display:\s*none;\s*\}/);
    assert.match(reportCss, /\.js \.facet-bar\s*\{\s*display:\s*flex;\s*\}/);
    assert.match(reportCss, /\.js \.aud\s*\{\s*display:\s*grid;\s*\}/);
    assert.match(reportCss, /\.js \[data-aud="gen"\] \.tech-detail\s*\{\s*display:\s*none;\s*\}/);
    assert.doesNotMatch(reportCss, /^\.tech-detail\s*\{[^}]*display:\s*none/m);
    assert.doesNotMatch(reportCss, /mock-note|phone-cap|state-cap|phone-wrap|@container/, 'the mockup\'s notes and frames stay in the mockup');
});

test('the filter script is inlined once after main, parses, and uses only what the page draws', async () => {
    assert.doesNotThrow(() => new vm.Script(reportJs));
    const html = await wr.render(data(), events(), opts);
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.ok(html.indexOf('</main>') < html.indexOf('<script>'));
    assert.ok(html.includes(reportJs.trim()));
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i);
    for (const hook of ['facet-bar', 'fchip', 'data-facets', 'fb-status', 'event-grid', 'group-h', 'class="seg"']) {
        assert.ok(html.includes(hook), 'the page has no ' + hook);
    }
    for (const sel of ['.facet-bar', '.fchip', '.seg button', '.event-grid', 'data-facets', '.fb-status']) assert.ok(reportJs.includes(sel), sel);
    const bare = await wr.render(data(), events(), { stationCss, reportCss });
    assert.equal(bare.includes('<script>'), false, 'no reportJs, no script');
});

test('questions: none draws no block; each shows its saved reply or 尚未回覆, read-only, after next', async () => {
    assert.doesNotMatch(await wr.render(data(), events(), opts), /data-block="questions"/);
    const at = new Date(2026, 0, 2, 14, 5).toISOString();
    const qs = [{ id: 'q1', repo: 'demo', text: '帳號開好了嗎？' }, { id: 'q2', repo: 'demo', text: '可以先試跑嗎？', reply: '可以 <b>', repliedAt: at }];
    const html = await wr.render(data(), events({ questions: qs }), opts);
    const block = /<section class="qs" data-block="questions"[\s\S]*?\n<\/section>/.exec(html)[0];
    assert.ok(block.includes('<h2 id="h-questions">本週想請教的問題</h2>'));
    assert.ok(block.includes('<div class="q" role="listitem" data-q="q1">'));
    assert.ok(block.includes('<p class="ans none">尚未回覆</p>'));
    assert.ok(block.includes('<p class="ans">可以 &lt;b&gt;</p><p class="ans-meta">已存 <span class="mono">1/2 14:05</span></p>'));
    assert.doesNotMatch(block, /<textarea|<button|<form/);
    assert.ok(html.indexOf('data-block="next"') < html.indexOf('data-block="questions"'));
    assert.ok(html.indexOf('data-block="questions"') < html.indexOf('data-block="footer"'));
    assert.equal(wr.questionsSection(qs, 5), block, 'summary 1, architecture 2, events 3, next 4, questions 5');
});

test('the guard reads tech and the questions like every other field, and skips question ids', () => {
    const ev = events({ questions: [{ id: 'session-1', repo: 'demo', text: '開 Session 了嗎？' }] });
    ev.events[0].tech = '花了 $3 在 gate 上';
    assert.deepEqual(wr.guard(ev, []), [
        { where: 'events[0].tech', word: 'gate' },
        { where: 'events[0].tech', word: '$ 金額' },
        { where: 'questions[0].text', word: 'session' },
    ]);
});

test('archiveOf keeps show and the questions, so a reply has somewhere to go', () => {
    const got = wr.archiveOf(data(), events({ show: { daily: true }, questions: [{ id: 'q1', repo: 'demo', text: 'x' }] }), '2026-01-02');
    assert.deepEqual(got.show, { daily: true, cost: false });
    assert.deepEqual(got.questions, [{ id: 'q1', repo: 'demo', text: 'x' }]);
    assert.deepEqual(wr.archiveOf(data(), events(), '2026-01-02').show, { daily: false, cost: false });
});

test('shapeHits names a question that is not an object, at its place in the file', async () => {
    const ev = events({ questions: ['帳號開好了嗎？', { id: 'q1', repo: 'demo', text: 'a' }, null, ['x']] });
    assert.deepEqual(wr.shapeHits(ev, wr.DEFAULT_FACETS), [
        { where: 'questions[0]', word: '題目不是物件' },
        { where: 'questions[2]', word: '題目不是物件' },
        { where: 'questions[3]', word: '題目不是物件' },
    ]);
    await assert.rejects(wr.render(data(), ev, opts), /questions\[0\]: 題目不是物件/);
});

// No DOM in node --test: a stub document built from the rendered <main>, just
// enough of the DOM (the selectors report.js uses) to press its buttons.
function stubDocument(html) {
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>') + 7);
    const VOID = new Set(['meta', 'br', 'img', 'input', 'hr', 'link', 'col', 'wbr', 'area', 'source']);
    const all = (n) => [n, ...n.children.flatMap(all)];
    const one = (n, part) => {
        const tag = /^[a-z0-9]*/.exec(part)[0];
        if (tag && n.tagName !== tag) return false;
        for (const m of part.slice(tag.length).matchAll(/\.([\w-]+)|\[([\w-]+)\]|:not\(\[([\w-]+)\]\)/g)) {
            if (m[1] && !n.classList.contains(m[1])) return false;
            if (m[2] && !(m[2] in n.attrs)) return false;
            if (m[3] && m[3] in n.attrs) return false;
        }
        return true;
    };
    const matches = (n, sel) => {
        const parts = sel.trim().split(/\s+/);
        if (!one(n, parts.pop())) return false;
        for (let d = n.parent; parts.length && d; d = d.parent) if (one(d, parts[parts.length - 1])) parts.pop();
        return !parts.length;
    };
    const node = (tag, attrs, parent) => {
        const n = {
            tagName: tag, attrs, parent, children: [], text: '', listeners: [],
            getAttribute: (k) => (k in attrs ? attrs[k] : null),
            setAttribute: (k, v) => { attrs[k] = String(v); },
            get hidden() { return 'hidden' in attrs; },
            set hidden(v) { if (v) attrs.hidden = ''; else delete attrs.hidden; },
            get textContent() { return n.text + n.children.map((c) => c.textContent).join(''); },
            set textContent(v) { n.text = String(v); n.children = []; },
            classList: {
                add: (c) => { attrs.class = ((attrs.class || '') + ' ' + c).trim(); },
                contains: (c) => (attrs.class || '').split(/\s+/).includes(c),
            },
            get previousElementSibling() { return parent ? parent.children[parent.children.indexOf(n) - 1] || null : null; },
            querySelectorAll: (sel) => all(n).filter((d) => d !== n && matches(d, sel)),
            querySelector: (sel) => n.querySelectorAll(sel)[0] || null,
            closest: (sel) => { for (let d = n; d; d = d.parent) if (matches(d, sel)) return d; return null; },
            addEventListener: (type, fn) => { n.listeners.push({ type, fn }); },
        };
        return n;
    };
    const root = node('#root', {}, null);
    let cur = root;
    let at = 0;
    for (const m of main.matchAll(/<(\/?)([a-zA-Z0-9]+)((?:[^>"]|"[^"]*")*)>/g)) {
        cur.text += main.slice(at, m.index);
        at = m.index + m[0].length;
        const tag = m[2].toLowerCase();
        if (m[1]) {
            while (cur !== root && cur.tagName !== tag) cur = cur.parent;
            if (cur !== root) cur = cur.parent;
            continue;
        }
        const attrs = {};
        for (const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? '' : a[2];
        const child = node(tag, attrs, cur);
        cur.children.push(child);
        if (!VOID.has(tag) && !m[3].trim().endsWith('/')) cur = child;
    }
    return { documentElement: node('html', {}, null), querySelector: (sel) => root.querySelector(sel) };
}

test('report.js: pressing 技術 flips the switch, pressing a facet chip hides the cards without it', async () => {
    const document = stubDocument(await wr.render(data(), events(), opts));
    vm.runInNewContext(reportJs, { document });
    assert.ok(document.documentElement.classList.contains('js'));
    const page = document.querySelector('main.page');
    const click = (target) => page.listeners.filter((l) => l.type === 'click').forEach((l) => l.fn({ target }));
    const seg = page.querySelectorAll('.seg button');
    const pressed = () => seg.map((b) => b.getAttribute('data-aud') + ':' + b.getAttribute('aria-pressed'));
    assert.deepEqual(pressed(), ['gen:true', 'tech:false']);
    click(seg.find((b) => b.getAttribute('data-aud') === 'tech'));
    assert.deepEqual(pressed(), ['gen:false', 'tech:true']);
    assert.equal(page.getAttribute('data-aud'), 'tech');
    const cards = page.querySelectorAll('.event');
    const hidden = () => cards.map((c) => c.hidden);
    assert.deepEqual(hidden(), [false, false, false]);
    const chip = page.querySelectorAll('.fchip').find((c) => c.getAttribute('data-facet') === 'f4');
    click(chip.querySelector('.n'));
    assert.deepEqual(hidden(), [true, true, false], 'only the 後端／資料 card (進行中, drawn last) stays');
    assert.equal(chip.getAttribute('aria-pressed'), 'true');
});
