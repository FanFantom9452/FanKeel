'use strict';
// The board's look (design §2): categories through `icon: "fk:<id>"`, the
// station's palette, a corner glyph, and a legend whose counts are the board's.
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBoard, checkBoard } = require('../lib/board.js');
const { CATEGORIES } = require('../lib/board-look.js');

const B = [
    '{"chartroom":1,"root":"v"}',
    '{"view":"v"}',
    '{"node":"a","in":"v","label":"A","icon":"fk:store"}',
    '{"node":"b","in":"v","label":"B","icon":"fk:store"}',
    '{"node":"c","in":"v","label":"C","icon":"fk:service"}',
    '{"node":"d","in":"v","label":"D","fill":"#000000","icon":"fk:service"}',
    '{"edge":"e","in":"v","from":"a","to":"c"}',
].join('\n') + '\n';

test('a category paints its tint and colour; a node\'s own fill wins', async () => {
    const svg = await renderBoard(B);
    const node = (id) => (new RegExp('<g data-id="' + id + '" data-type="node">(.*?)</g>', 's').exec(svg) || [])[1] || '';
    assert.match(node('a'), new RegExp('fill="' + CATEGORIES.store.tint + '"'));
    assert.match(node('a'), new RegExp('stroke="' + CATEGORIES.store.color + '"'));
    assert.match(node('d'), /fill="#000000"/);
});

test('each categorised node gets its glyph; the icon field reserves no room', async () => {
    const svg = await renderBoard(B);
    assert.equal((svg.match(/data-glyph-for="/g) || []).length, 4);
    assert.doesNotMatch(svg, /class="cr-icon"/);
});

test('the legend counts equal the board\'s nodes per category', async () => {
    const svg = await renderBoard(B);
    const legend = (/<g data-legend="">(.*?)<\/g>\n<\/svg>/s.exec(svg) || [])[1] || '';
    assert.match(legend, /data-cat="store"[^>]*>.*?<text[^>]*>2<\/text>/s);
    assert.match(legend, /data-cat="service"[^>]*>.*?<text[^>]*>2<\/text>/s);
    assert.doesNotMatch(legend, /data-cat="ui"/);
});

test('a board with no fk: category has no legend and no glyph', async () => {
    const svg = await renderBoard('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n');
    assert.doesNotMatch(svg, /data-legend/);
    assert.doesNotMatch(svg, /data-glyph-for/);
});

test('an fk: id the table does not have is an unknown-category warning', async () => {
    const r = await checkBoard('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","icon":"fk:robot"}\n');
    assert.equal(r.ok, true);
    assert.deepEqual(r.problems.map((p) => [p.code, p.id, p.level]), [['unknown-category', 'a', 'warn']]);
});
