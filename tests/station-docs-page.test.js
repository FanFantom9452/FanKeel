'use strict';
// The 文件 page (assets/station/docs-page.js; station-38, mockup
// .fankeel/build/2026-10-21-station-redesign/route-docs.html): find box with
// a hits popover, the docs-health matrix (a row a project, a column a check,
// zero a tick), the picked cell's list, the reader dialog with the cited line
// marked, a project's map dialog, and its own English table.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const A = 'F:/w/alpha';
const B = 'F:/w/beta';
const HEALTH = { at: '2026-10-24T08:00:00.000Z', projects: [
    { pkey: B, name: 'beta', dir: B, files: 3, index: null, noTree: true, last: '2026-10-23T10:00:00.000Z',
        cells: { drift: null, landed: null, index: null, diagram: null, broken: null, unfiled: null } },
    { pkey: A, name: 'alpha', dir: A, files: 1200, index: 'docs/README.md', noTree: false, last: '2026-10-24T07:00:00.000Z', cells: {
        drift: { n: 2, items: [{ path: 'docs/ref/a.md', target: 'lib/a.js', gap: 9, docAge: 14, declared: true, sub: 'fix(a): move the cache' }] },
        landed: null,
        index: { n: 1, items: [{ path: 'docs/ref/b.md' }] },
        diagram: null,
        broken: { n: 1, items: [{ path: 'docs/ref/a.md:12', tag: 'gone', note: 'links to lib/old.js' }] },
        unfiled: { n: 4, items: [{ path: 'notes/x.md' }] } } },
] };
const SEARCH = { q: 'remote', n: 1, hits: [{ project: 'alpha', pkey: A, path: 'docs/guide/r.md', title: 'Remote', role: 'guide', count: 3,
    before: 'the ', hit: 'remote', after: ' card' }] };
const DOC = ['---', 'status: current', 'last_verified: 2026-10-01', '---', '# Alpha', '', '| k | v |', '|---|---|', '| a | `b` |', '',
    '- one', 'See [old](lib/old.js) here.', ''].join('\n');
const S = { projects: [{ root: 'F:/w', docs: [{ pkey: A, generatedAt: '2026-10-22T09:00:00.000Z', total: 10,
    buckets: [{ label: 'current', count: 6 }, { label: 'planned', count: 4 }], plannedNotBuilt: ['lib/new.js'],
    filing: { index: 'docs/README.md', rows: [{ bucket: 'docs/ref', role: 'reference' }] } }] }] };
const flush = () => new Promise((r) => setImmediate(r));

function mod(lang, failFresh) {
    const calls = [];
    const fetch = (url) => {
        calls.push(url);
        if (failFresh && url.includes('fresh=1')) return Promise.resolve({ ok: false, status: 500 });
        if (url.startsWith('station/docs-health')) return Promise.resolve({ ok: true, json: () => Promise.resolve(HEALTH) });
        if (url.startsWith('station/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve(SEARCH) });
        if (url.startsWith('station/doc?')) return Promise.resolve({ ok: true, text: () => Promise.resolve(DOC) });
        return Promise.resolve({ ok: false, status: 404 });
    };
    const { win, doc } = page(['docs-page.js'], {}, { fetch });
    if (lang) win.FK_I18N = { lang };
    const D = win.FK_DOCS;
    D.reset();
    let redraws = 0;
    const o = { names: {}, now: Date.now(), serve: true, pkeys: [A, B], redraw() { redraws++; } };
    return { D, doc, win, calls, o, draw: (extra) => D.page(S, Object.assign({}, o, extra)), redraws: () => redraws };
}
const hit = (attr, val) => ({ closest: (sel) => (sel === '[' + attr + ']' ? { getAttribute: () => val, disabled: false, closest: () => null } : null) });
const section = (html, block) => {
    const at = html.indexOf('data-block="' + block + '"');
    return html.slice(html.lastIndexOf('<section', at), html.indexOf('</section>', at));
};

test('every Chinese string is keyed and has English', () => {
    const { D } = mod();
    assert.deepEqual(stringsLeft('docs-page.js', D.EN), []);
});

test('unserved, the page says the table needs serve and asks nothing', () => {
    const { draw, calls } = mod();
    const html = draw({ serve: false });
    assert.ok(html.includes('data-block="docs-page"'));
    assert.ok(html.includes('<input id="dq" type="search"'));
    assert.ok(html.includes('這張表要 serve 才讀得到'));
    assert.deepEqual(calls, []);
});

test('served, it reads docs-health once and redraws when it answers', async () => {
    const { draw, calls, redraws } = mod();
    assert.ok(draw().includes('第一次要幾秒'));
    draw();
    assert.deepEqual(calls, ['station/docs-health']);
    await flush();
    assert.equal(redraws(), 1);
    draw();
    assert.deepEqual(calls, ['station/docs-health']);
});

test('the matrix: a row a project in session order, a tick for nothing, a dash for no tree, a number to click', async () => {
    const { draw } = mod();
    draw();
    await flush();
    const html = draw();
    const health = section(html, 'docs-health');
    assert.ok(health.indexOf('>alpha<') < health.indexOf('>beta<'));
    assert.ok(health.includes('<b>2</b> 個專案'));
    assert.ok(health.includes('<b>1,203</b> 份 markdown'));
    assert.ok(health.includes('<b>1</b> 個有缺陷'));
    assert.ok(health.includes('class="dh-n on" data-dk-cell="0 drift" aria-pressed="true"'));
    assert.ok(health.includes('class="dh-n ctx" data-dk-cell="0 unfiled"'));
    assert.ok(health.includes('<td class="dh-na">'));
    assert.ok(health.includes('<td class="dh-ok">'));
    assert.ok(health.includes('id="dh-tip-drift">頁面上次確認之後'));
    assert.ok(health.includes('data-dk-proj="1"'));
    assert.ok(health.includes('重新檢查'));
    assert.ok(!/<circle|<line|class="[^"]*graph/.test(health), 'no relation graph in docs-health (station-38)');
});

test('the side card lists the picked cell, and a click on another cell picks it', async () => {
    const m = mod();
    m.draw();
    await flush();
    let side = section(m.draw(), 'docs-findings');
    assert.ok(side.includes('alpha · 要重讀的頁'));
    assert.ok(side.includes('14 天前確認過；之後 <code>lib/a.js</code> 又改了'));
    assert.ok(side.includes('之後的提交：fix(a): move the cache'));
    assert.ok(side.includes('列出前 <b>1</b> 條，共 <b>2</b> 條'));
    assert.ok(side.includes('<code>node scripts/docs-audit.js --root F:/w/alpha</code>'));
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    assert.equal(m.redraws(), 2);
    side = section(m.draw(), 'docs-findings');
    assert.ok(side.includes('<span class="df-path">docs/ref/a.md<em>:12</em></span>'));
    assert.ok(side.includes('<span class="df-tag">指向的東西不在了</span>'));
    assert.ok(side.includes('連到 <code>lib/old.js</code>'));
    assert.ok(side.includes('共 <b>1</b> 條'));
});

test('the find box is the same HTML on every draw, so the redraw keeps its caret', async () => {
    const { draw } = mod();
    draw();
    await flush();
    assert.equal(section(draw(), 'docs-head'), section(draw(), 'docs-head'));
});

test('重新檢查 asks again with ?fresh=1 and says it is checking', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-run', '1') });
    assert.equal(m.calls[1], 'station/docs-health?fresh=1');
    assert.ok(m.draw().includes('檢查中…'));
    await flush();
    assert.ok(m.draw().includes('重新檢查'));
});

test('typing asks station/search and paints the hits into #dq-pop; a hit opens the reader', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onInput({ target: { id: 'dq', value: ' remote ' } });
    assert.equal(m.calls[1], 'station/search?q=remote');
    await flush();
    const pop = m.doc.getElementById('dq-pop');
    assert.equal(pop.hidden, false);
    assert.ok(pop.innerHTML.includes('<b>1</b> 頁含「remote」'));
    assert.ok(pop.innerHTML.includes('data-dk-hit="0"'));
    assert.ok(pop.innerHTML.includes('<mark>remote</mark>'));
    m.D.onClick({ target: hit('data-dk-hit', '0') });
    assert.equal(m.calls[2], 'station/doc?pkey=' + encodeURIComponent(A) + '&path=docs%2Fguide%2Fr.md');
    assert.ok(m.doc.getElementById('rd-why').innerHTML.includes('含「remote」3 處'));
    assert.equal(m.doc.getElementById('rd-pos').textContent, '1 / 1');
    await flush();
    assert.ok(m.doc.getElementById('rd-body').innerHTML.includes('<h2 data-l="5">Alpha</h2>'));
});

test('a row of the list opens the reader at its cited line', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    m.D.onClick({ target: hit('data-dk-item', '0') });
    assert.equal(m.calls[1], 'station/doc?pkey=' + encodeURIComponent(A) + '&path=docs%2Fref%2Fa.md');
    assert.equal(m.doc.getElementById('rd-path').textContent, 'docs/ref/a.md:12');
    await flush();
    const body = m.doc.getElementById('rd-body').innerHTML;
    assert.match(body, /<p data-l="12" class="[^"]*hl">See <span class="rd-a" title="lib\/old.js">old<\/span> here.<\/p>/);
    assert.ok(m.doc.getElementById('rd-meta').innerHTML.includes('<i>last_verified</i>2026-10-01'));
});

test('render: frontmatter, heading, table, list, code', () => {
    const { D } = mod();
    const r = D.render(DOC + '\n```\nx < y\n```\n', 0);
    assert.deepEqual({ ...r.meta }, { status: 'current', last_verified: '2026-10-01' });
    assert.ok(r.html.includes('class="rd-tw"><table><thead><tr><th>k</th><th>v</th></tr></thead><tbody><tr><td>a</td><td><code>b</code></td></tr></tbody></table>'));
    assert.ok(r.html.includes('<ul><li data-l="11">one</li></ul>'));
    assert.ok(r.html.includes('<pre data-l="14"><code>x &lt; y</code></pre>'));
    assert.ok(!r.html.includes(' hl'));
});

test('a project name opens its map: split, not built, filing; no map says how to write one', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-proj', '0') });
    const dlg = m.doc.getElementById('dlg-proj').innerHTML;
    assert.ok(dlg.includes('map 數到 10 份'));
    assert.ok(dlg.includes('class="split-bar"'));
    assert.ok(dlg.includes('<li title="lib/new.js">lib/new.js</li>'));
    assert.ok(dlg.includes('<td>docs/ref</td><td><span class="chip">reference</span></td>'));
    assert.ok(dlg.includes('index · docs/README.md'));
    m.D.onClick({ target: hit('data-dk-proj', '1') });
    assert.ok(m.doc.getElementById('dlg-proj').innerHTML.includes('node scripts/map.js'));
});

test('/ focuses the find box when nothing is typed into and no dialog is open', () => {
    const m = mod();
    m.draw({ serve: false });
    let focused = false;
    m.doc.getElementById('dq').focus = () => { focused = true; };
    m.D.onKey({ key: '/', target: { closest: () => null }, preventDefault() {} });
    assert.ok(focused);
});

test('English reads the English table', async () => {
    const m = mod('en');
    m.draw();
    await flush();
    const html = m.draw();
    assert.ok(html.includes('Pages to re-read'));
    assert.ok(html.includes('Check again'));
});

test('the stylesheet is the mockup\'s rules without style tags', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'docs-page.css'), 'utf8');
    for (const rule of ['.dk{', '.dq-pop{', '.dh-t{', '.dh-tip{', '.df-row{', '.rd-body .hl{', '.tdlg.pd{', '.pd-cols{']) assert.ok(css.includes(rule), rule);
    assert.ok(!/<\/?style/.test(css));
});

test('a failed re-check with the table already loaded still says so above the matrix', async () => {
    const m = mod(null, true);
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-run', '1') });
    await flush();
    const health = section(m.draw(), 'docs-health');
    assert.ok(health.includes('讀不到文件檢查：500'));
    assert.ok(health.includes('class="dh-t"'));
});

const withReader = async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    m.D.onClick({ target: hit('data-dk-item', '0') });
    return m;
};
const stepTarget = (val, disabled) => ({ closest: (sel) => (sel === '[data-dk-step]' ? { getAttribute: () => val, disabled, closest: () => null } : null) });

test('prev/next buttons step the reader by their sign and do nothing when disabled', async () => {
    const m = await withReader();
    m.D.state().list = m.D.state().list.concat(m.D.state().list, m.D.state().list);
    m.D.state().at = 1;
    m.D.onClick({ target: stepTarget('1', false) });
    assert.equal(m.D.state().at, 2);
    m.D.onClick({ target: stepTarget('-1', false) });
    m.D.onClick({ target: stepTarget('-1', false) });
    assert.equal(m.D.state().at, 0);
    m.D.onClick({ target: stepTarget('1', true) });
    assert.equal(m.D.state().at, 0);
});

test('the close button closes its dialog', async () => {
    const m = await withReader();
    let closed = false;
    const dlg = { close: () => { closed = true; } };
    m.D.onClick({ target: { closest: (sel) => (sel === '[data-dk-close]' ? { closest: () => dlg } : null) } });
    assert.ok(closed);
});

test('a click outside the find box hides the hits; inside it leaves them', async () => {
    const m = mod();
    m.draw();
    await flush();
    m.D.onInput({ target: { id: 'dq', value: 'remote' } });
    await flush();
    const pop = m.doc.getElementById('dq-pop');
    m.D.onClick({ target: { closest: (sel) => (sel === '.dq' ? {} : null) } });
    assert.equal(pop.hidden, false);
    m.D.onClick({ target: { closest: () => null } });
    assert.equal(pop.hidden, true);
});

test('/ is left to the field when typed in an input, textarea or select', () => {
    const m = mod();
    m.draw({ serve: false });
    let focused = false, prevented = false;
    m.doc.getElementById('dq').focus = () => { focused = true; };
    m.D.onKey({ key: '/', target: { closest: (sel) => (sel === 'input,textarea,select' ? {} : null) }, preventDefault() { prevented = true; } });
    assert.equal(focused, false);
    assert.equal(prevented, false);
});

test('focusing the find box again repaints the last hits', async () => {
    const m = mod();
    const on = {};
    m.doc.addEventListener = (t, f) => { on[t] = f; };
    m.draw();
    await flush();
    m.D.onInput({ target: { id: 'dq', value: 'remote' } });
    await flush();
    const pop = m.doc.getElementById('dq-pop');
    pop.hidden = true;
    on.focusin({ target: { id: 'dq' } });
    assert.equal(pop.hidden, false);
});

test('arrow keys walk the open reader; Escape hides the hits', async () => {
    const m = await withReader();
    const s = m.D.state();
    s.list = s.list.concat(s.list);
    s.at = 0;
    const rd = m.doc.getElementById('dlg-read');
    rd.open = true;
    let prevented = 0;
    const key = (k) => m.D.onKey({ key: k, target: null, preventDefault() { prevented++; } });
    key('ArrowRight');
    assert.equal(s.at, 1);
    key('ArrowRight');
    assert.equal(s.at, 1, 'past the end stays');
    key('ArrowLeft');
    assert.equal(s.at, 0);
    assert.equal(prevented, 2);
    rd.open = false;
    m.D.onInput({ target: { id: 'dq', value: 'remote' } });
    await flush();
    const pop = m.doc.getElementById('dq-pop');
    assert.equal(pop.hidden, false);
    key('Escape');
    assert.equal(pop.hidden, true);
});

test('render: a mermaid fence is a data-mermaid figure that keeps its source and the cited-line mark; another fence stays pre/code', () => {
    const { D } = mod();
    const md = '```mermaid\nflowchart TD\nA-->B\n```\n\n```js\nx < y\n```\n';
    const r = D.render(md, 0);
    assert.match(r.html, /<figure class="dg" data-mermaid data-l="1"/);
    assert.ok(r.html.includes('<pre class="dg-src"><code>flowchart TD\nA--&gt;B</code></pre>'));
    assert.ok(r.html.includes('<pre data-l="6"><code>x &lt; y</code></pre>'));
    assert.match(D.render(md, 3).html, /<figure class="dg hl" data-mermaid/);
});

test('the reader draws the diagrams of the document it just wrote, into the reader body', async () => {
    const m = mod();
    const drawn = [];
    m.win.FK_DIAGRAM = { draw: (b) => drawn.push(b), fence: () => '' };
    m.draw();
    await flush();
    m.D.onClick({ target: hit('data-dk-cell', '0 broken') });
    m.D.onClick({ target: hit('data-dk-item', '0') });
    await flush();
    assert.deepEqual(drawn, [m.doc.getElementById('rd-body')]);
});
