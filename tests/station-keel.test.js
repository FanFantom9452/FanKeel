'use strict';
// The promo film's look (docs/90-agent/plans/2026-10-01-todo-sweep.md Task 6):
// on by default under :root[data-style=keel], and the 2026-09 stylesheet one
// attribute away.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'station.css'), 'utf8');

test('the shell opens in the keel look and reads a classic choice before the body is drawn', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    const head = html.slice(0, html.indexOf('<body>'));
    assert.match(head, /localStorage\.getItem\('station\.style'\)==='classic'/);
    assert.match(head, /document\.documentElement\.removeAttribute\('data-style'\)/);
});

test('the masthead carries the film glyph, the classic mark, and the 經典樣式 switch', () => {
    assert.match(html, /<a class="brand" href="#\/" id="brand"[^>]*><svg class="glyph k-only mark b1" viewBox="0 0 120 120"/);
    assert.equal((html.match(/class="gseg done"/g) || []).length, 6);
    assert.match(html, /<svg class="classic-mark c-only" viewBox="0 0 20 20"/);
    assert.match(html, /<button type="button" class="styletog" id="styletog" data-block="style-classic" aria-pressed="false"/);
});

test('every keel rule is scoped, classic parts hide in keel and keel parts hide in classic', () => {
    assert.match(css, /^:root\[data-style=keel\]\{/m);
    assert.match(css, /^:root:not\(\[data-style=keel\]\) \.k-only\{display:none\}$/m);
    assert.match(css, /^:root\[data-style=keel\] \.c-only\{display:none\}$/m);
    assert.match(css, /\.td-mb\[aria-expanded="true"\] \.ico,\.dch-b\[data-dchmv="-1"\] \.ico\{transform:rotate\(180deg\)\}/);
    assert.doesNotMatch(css, /^\.mk\{/m, 'the mockup-only label rules stay out');
    const before = css.slice(0, css.indexOf('/* ==== keel:'));
    assert.ok(before.length > 1000, 'the keel block was not found');
    assert.doesNotMatch(before, /data-style/, 'the classic sheet above the keel block is untouched');
});
