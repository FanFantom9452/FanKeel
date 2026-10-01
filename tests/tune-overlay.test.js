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

test('a click reaches the page: the click and wheel handlers return first unless the assistant is picking, and Alt is gone', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /addEventListener\('click', function \(ev\) \{\s*if \(picking < 0\) return;/);
    assert.match(text, /addEventListener\('wheel', function \(ev\) \{\s*if \(picking < 0/);
    assert.ok(!text.includes('altKey'), 'an Alt handler is still there');
    assert.ok(!text.includes('fk-live-toggle') && !text.includes('fk-live-off'), 'the live toggle is still there');
});

test('the assistant carries the words the approved mockup shows, the station glyph, and remembers where it was dragged', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['修改項', '新增一則', '收合', '刪除這則', '塊共用一段備註，要怎麼改？', '圈選第 ', '往外一層', '或滾輪：上 往外，下 往內', '完成這則', '全部送出（', '清空', '則待送', '按住拖曳']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
    assert.match(text, /localStorage\.setItem\(POS/);
    assert.match(text, /sessionStorage\.setItem\(SAVE/);
    assert.match(text, /setPointerCapture/);
    assert.ok(text.includes('M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z'), 'the logo is not the station glyph');
    assert.ok(!/class="g(seg|edge|core)"/.test(text), 'a glyph class without the fk-live- prefix picks up the page\'s own .gseg rules');
});

test('the request is one POST of every item, each element described by block, selector, classes and text', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /var payload = \{ page: location\.pathname, items: itemsOf\(/);
    const desc = /function describe\(node\) \{[\s\S]*?\n    \}/.exec(text);
    assert.ok(desc, 'no describe()');
    for (const k of ['block:', 'selector:', 'classes:', 'text:']) assert.ok(desc[0].includes(k), 'describe() has no ' + k);
    assert.match(desc[0], /\.slice\(0, 80\)/);
});

test('itemsOf keeps drafts with a note and an element, the first element on the item, every block once', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const p = (block, selector) => ({ block, selector, classes: ['c'], text: 't' });
    const got = itemsOf([
        { note: ' one ', picks: [p('hero', 'section:nth-of-type(1)')] },
        { note: 'two', picks: [p('card', 'article#a'), p('card', 'article#b'), p('foot', 'footer')] },
        { note: '   ', picks: [p('x', 'div')] },
        { note: 'no element', picks: [] },
    ]);
    assert.deepEqual(got, [
        { note: 'one', block: 'hero', selector: 'section:nth-of-type(1)', classes: ['c'], text: 't' },
        { note: 'two', block: 'card', selector: 'article#a', classes: ['c'], text: 't', blocks: ['card', 'foot'], selectors: ['article#a', 'article#b', 'footer'] },
    ]);
});

test('clampTo keeps the logo inside the viewport', () => {
    const { clampTo } = require('../assets/tune/overlay.js');
    assert.deepEqual(clampTo(-20, 900, 48, 48, 1280, 800), { x: 0, y: 752 });
    assert.deepEqual(clampTo(600, 300, 48, 48, 1280, 800), { x: 600, y: 300 });
});
