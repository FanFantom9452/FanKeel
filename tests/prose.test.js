'use strict';

// docs/99-archive/2026-10-05-prose-style-design.md: the style a stage
// agent and a writer write in, chosen by `prose.style`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const prose = require('../lib/prose.js');

function project(text) {
    const d = tmp('fankeel-prose-');
    if (text !== undefined) {
        fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
        fs.writeFileSync(path.join(d, '.fankeel', 'prose.md'), text);
    }
    return d;
}

test('no prose.style means writer', () => {
    const s = prose.styleFor({}, project());
    assert.equal(s.style, 'writer');
    assert.equal(s.text, prose.STYLES.writer);
    assert.equal(s.note, null);
    assert.equal(prose.styleFor(undefined, project()).style, 'writer');
});

test('a built-in name picks its own rules', () => {
    for (const name of ['writer', 'plain', 'sepia']) {
        const s = prose.styleFor({ 'prose.style': name }, project());
        assert.equal(s.style, name);
        assert.equal(s.text, prose.STYLES[name]);
    }
    assert.notEqual(prose.STYLES.sepia, prose.STYLES.writer);
});

test('custom reads .fankeel/prose.md whole', () => {
    const s = prose.styleFor({ 'prose.style': 'custom' }, project('Write like a field manual.\nNo jokes.\n'));
    assert.equal(s.style, 'custom');
    assert.equal(s.text, 'Write like a field manual.\nNo jokes.');
    assert.equal(s.note, null);
});

test('custom falls back to writer, with a note, when the file is missing, empty or over MAX', () => {
    const missing = prose.styleFor({ 'prose.style': 'custom' }, project());
    assert.equal(missing.style, 'writer');
    assert.equal(missing.text, prose.STYLES.writer);
    assert.match(missing.note, /\.fankeel\/prose\.md is missing or empty — using writer/);
    assert.equal(prose.styleFor({ 'prose.style': 'custom' }, project('  \n')).style, 'writer');
    const over = prose.styleFor({ 'prose.style': 'custom' }, project('字'.repeat(prose.MAX + 1)));
    assert.equal(over.style, 'writer');
    assert.match(over.note, new RegExp((prose.MAX + 1) + ' characters, over ' + prose.MAX + ' — using writer'));
    assert.equal(prose.styleFor({ 'prose.style': 'custom' }, project('字'.repeat(prose.MAX))).style, 'custom');
});

test('every built-in style fits under SUGGESTED, and SUGGESTED under MAX', () => {
    for (const name of Object.keys(prose.STYLES)) {
        assert.ok(prose.length(prose.STYLES[name]) <= prose.SUGGESTED, name + ' is ' + prose.length(prose.STYLES[name]));
    }
    assert.ok(prose.SUGGESTED < prose.MAX);
    assert.deepEqual(prose.NAMES, ['writer', 'plain', 'sepia', 'custom']);
});

test('briefLines names the style and carries its rules, indented', () => {
    const lines = prose.briefLines({ 'prose.style': 'sepia' }, project(), 'the page you write');
    assert.equal(lines[0], '  - Prose style `sepia` (profile `prose.style`), for the page you write:');
    assert.equal(lines[1], '      ' + prose.STYLES.sepia);
    const fallback = prose.briefLines({ 'prose.style': 'custom' }, project(), 'x');
    assert.match(fallback[fallback.length - 1], /^ {6}\(\.fankeel\/prose\.md is missing or empty — using writer\)$/);
});

test('costLines says the size against SUGGESTED and MAX, and warns only over SUGGESTED', () => {
    const est = (t) => Math.ceil(prose.length(t) / 4);
    const big = prose.costLines(project('x'.repeat(prose.SUGGESTED + 10)), 'custom', est);
    assert.match(big[0], new RegExp('^' + (prose.SUGGESTED + 10) + ' characters, ~\\d+ tok'));
    assert.match(big[0], new RegExp('suggested ' + prose.SUGGESTED + ', ceiling ' + prose.MAX + '$'));
    assert.match(big[1], /this is a warning, not a refusal/);
    assert.equal(prose.costLines(project(), 'sepia', est).length, 1);
    const missing = prose.costLines(project(), 'custom', est);
    assert.match(missing[0], /missing or empty — using writer/);
});
