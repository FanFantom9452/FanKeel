'use strict';
// The promo film's look (docs/90-agent/plans/2026-10-01-todo-sweep.md Task 6):
// the only look, under :root[data-style=keel].
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'station.css'), 'utf8');

test('the masthead carries its data-block', () => {
    assert.ok(html.includes('<header class="mast" data-block="mast">'));
});

test('the shell opens in the keel look, and nothing in its head takes keel off', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    const head = html.slice(0, html.indexOf('<body>'));
    assert.doesNotMatch(head, /station\.style|removeAttribute\('data-style'\)/);
});

test('the masthead carries the film glyph and the appearance group, and no classic mark or switch', () => {
    assert.match(html, /<a class="brand" href="#\/" id="brand"[^>]*><svg class="glyph k-only mark b1" viewBox="0 0 120 120"/);
    assert.equal((html.match(/class="gseg done"/g) || []).length, 6);
    assert.doesNotMatch(html, /classic-mark|styletog|style-classic/);
    assert.match(html, /<div class="appear" id="appear" role="group" aria-label="外觀"><\/div>\n<\/header>/);
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
