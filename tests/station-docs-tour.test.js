'use strict';
// 文件's full-text box and the 導覽 page (design §5; mockup blocks docs-search
// and tour-nav). Both need a server: the written page says so instead.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const HIT = { project: 'fankeel', pkey: 'F:/ymlab/fankeel', path: 'docs/90-agent/reference/registry.md',
    title: 'The registry, and what it remembers', role: 'reference', before: '… `', hit: 'inflight', after: '` — `{ stage, at }` <b> …' };

test('#/tour is a page, and 導覽 is the last entry of the left bar', () => {
    assert.deepEqual(V.parseHash('#/tour'), { view: 'tour' });
    const nav = V.navHtml('tour', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {});
    assert.ok(nav.includes('<li class="navcat" data-block="tour-nav"><a href="#/tour" aria-current="page" title="fankeel 怎麼跑一個任務，一段動畫看完">'
        + '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/></svg><span>導覽</span></a></li>'), nav);
    assert.ok(nav.indexOf('href="#/settings"') < nav.indexOf('href="#/tour"'));
    assert.doesNotMatch(V.navHtml('docs', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {}), /href="#\/tour" aria-current/);
});

test('the tour page frames tour.html when served, and says to open serve when not', () => {
    assert.match(V.tourPage(true), /^<div class="tour" data-block="tour"><iframe class="tour-frame" src="station\/tour\.html" title="fankeel 導覽"><\/iframe><\/div>$/);
    const file = V.tourPage(false);
    assert.doesNotMatch(file, /<iframe/);
    assert.match(file, /data-block="tour"/);
    assert.match(file, /\/fankeel-station/);
});

test('the written page shows the search block as a note, with no box to type into', () => {
    const html = V.docsSearchHtml({ q: '', res: null }, false);
    assert.match(html, /^<div class="dsx" data-block="docs-search">/);
    assert.doesNotMatch(html, /<input/);
    assert.match(html, /\/fankeel-station/);
});

test('served, the box keeps its query and draws each hit as a ruled row with the match marked and escaped', () => {
    const html = V.docsSearchHtml({ q: 'inflight', res: { q: 'inflight', n: 1, hits: [HIT] } }, true);
    assert.ok(html.includes('<label class="dsx-l" for="dq">全文搜尋</label><div class="dsx-box"><input id="dq" type="search" value="inflight"'
        + ' placeholder="輸入字詞，搜全部專案的文件內文" autocomplete="off"><span class="dsx-n mono" id="dsxN">1 頁</span></div>'), html);
    assert.ok(html.includes('<p class="dsx-scope">搜 reference、guide、decision 三種頁面的內文；archive、plan、report 不搜。</p>'), html);
    assert.ok(html.includes('<div id="dsxOut"><ol class="dsx-list"><li><a class="dsx-row" href="#/docs" title="F:/ymlab/fankeel/docs/90-agent/reference/registry.md">'
        + '<span class="dsx-t">The registry, and what it remembers</span><span class="chip">reference</span>'
        + '<p class="dsx-snip">… `<mark>inflight</mark>` — `{ stage, at }` &lt;b&gt; …</p>'
        + '<span class="dsx-path mono">fankeel · docs/90-agent/reference/registry.md</span></a></li></ol></div>'), html);
});

test('no hit names the query and the scope; more hits than shown says how many there were', () => {
    const none = V.docsSearchHtml({ q: 'tokenbar 動畫', res: { q: 'tokenbar 動畫', n: 0, hits: [] } }, true);
    assert.match(none, /<span class="dsx-n mono" id="dsxN">0 頁<\/span>/);
    assert.match(none, /<p class="dsx-none">沒有頁面的內文含「tokenbar 動畫」。<span>換個較短的詞再試；archive、plan、report 頁不在搜尋範圍內/);
    const more = V.docsSearchHtml({ q: 'inflight', res: { q: 'inflight', n: 25, hits: [HIT] } }, true);
    assert.match(more, /列出前 1 頁，共 25 頁/);
    assert.match(V.docsSearchHtml({ q: '', res: null }, true), /<span class="dsx-n mono" id="dsxN"><\/span><\/div>[\s\S]*<div id="dsxOut"><\/div><\/div>$/);
});
