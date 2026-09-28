'use strict';
// assets/tune/overlay.js runs in a browser that this suite does not have, so
// what is checked here is what can be checked without one: it parses, it
// talks to the endpoints scripts/tune.js serves, and scripts/tune.js serves
// it. What it looks like is the render reviewer's question, at verify.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'assets', 'tune', 'overlay.js');

test('the overlay parses as a script', () => {
    assert.doesNotThrow(() => new Function(fs.readFileSync(SRC, 'utf8')));
});

test('the overlay speaks every endpoint tune.js serves it for', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['/__live/request', '/__live/events', '/__live/queue', '/__live/diff/', 'data-block', 'Escape']) {
        assert.ok(text.includes(s), 'overlay.js never mentions ' + s);
    }
});

test('the five states carry the words the approved mockup shows', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['這塊要怎麼改？', '已送出，等待改寫…', '已改寫 · 只動了 ', '退回：改到區塊外（', '原檔未變', '看差異', '佇列 ']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
});

const { selectorOf, labelOf, pathOf } = require('../assets/tune/overlay.js');

// A few element-shaped objects: enough of the DOM for the pure half.
function node(tag, attrs, kids) {
    const n = Object.assign({ nodeType: 1, tagName: tag.toUpperCase(), id: '', className: '', children: [], parentNode: null }, attrs);
    n.classList = String(n.className).split(/\s+/).filter(Boolean);
    for (const k of kids || []) { k.parentNode = n; n.children.push(k); }
    return n;
}

test('a plain click reaches the page: the click handler returns before anything else unless Alt is held', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /addEventListener\('click', function \(ev\) \{\s*if \(!ev\.altKey\) return;/);
    assert.match(text, /addEventListener\('wheel', function \(ev\) \{\s*if \(!ev\.altKey/);
    assert.ok(!text.includes('fk-live-toggle') && !text.includes('fk-live-off'), 'the live toggle is still there');
});

test('the request carries selector, classes, text and the nearest block', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    const call = /var payload = \{[\s\S]*?\};/.exec(text);
    assert.ok(call, 'no request is sent');
    for (const k of ['page:', 'note:', 'block:', 'selector:', 'classes:', 'text:']) assert.ok(call[0].includes(k), 'the request has no ' + k);
    assert.match(text, /\.slice\(0, 80\)/);
});

test('a block tune is editing carries a quiet pulse and its round, and none under reduced motion', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /\.fk-live-edp\{[^}]*animation:fk-live-edp /);
    assert.match(text, /@media \(prefers-reduced-motion:reduce\)\{[^']*\.fk-live-edp\{animation:none/);
    assert.ok(text.includes('編輯中 第 '), 'the ring does not say which round');
    assert.match(text, /q\.editing/);
    assert.match(text, /setInterval\(refreshQueue, 2000\)/);
});

test('selectorOf, labelOf and pathOf describe any element, stopping at an id or the body', () => {
    const b2 = node('b', { className: 'rs big' });
    const b1 = node('b');
    const div = node('div', { className: 'card' }, [b1, node('i'), b2]);
    const main = node('main', { id: 'app' }, [node('div'), div]);
    const body = node('body', {}, [main]);
    assert.equal(selectorOf(b2, body), 'main#app > div:nth-of-type(2) > b:nth-of-type(2)');
    assert.equal(labelOf(b2), 'b.rs.big');
    assert.equal(labelOf(main), 'main#app');
    assert.deepEqual(pathOf(b2, body).map(labelOf), ['b.rs.big', 'div.card', 'main#app']);
});

test('toggleIn adds an element once and a second toggle removes it', () => {
    const { toggleIn } = require('../assets/tune/overlay.js');
    const a = {}, b = {};
    assert.deepEqual(toggleIn([], a), [a]);
    assert.deepEqual(toggleIn([a], b), [a, b]);
    assert.deepEqual(toggleIn([a, b], a), [b]);
});
