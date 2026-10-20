'use strict';
// lib/board.js: a task's .board files, listed and drawn to SVG by the
// Chartroom render code vendored in lib/chartroom/
// (docs/99-archive/2026-10-20-chartroom-board-design.md §1-§2).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const board = require('../lib/board.js');
const tmp = require('./tmp.js');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'levelmark.board'), 'utf8');
const recs = (text) => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
const count = (svg, type) => (svg.match(new RegExp('data-type="' + type + '"', 'g')) || []).length;
const line = (o) => JSON.stringify(o) + '\n';

test('renderBoard draws one group per node record and one per edge record of the root view', async () => {
    const all = recs(FIXTURE);
    const root = all[0].root;
    const nodes = all.filter((r) => r.node && r.in === root).length;
    const edges = all.filter((r) => r.edge && r.in === root).length;
    assert.deepEqual([nodes, edges], [7, 4], 'the fixture is levelmark.board as copied');
    const svg = await board.renderBoard(FIXTURE);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.equal(count(svg, 'node') + count(svg, 'frame'), nodes);
    assert.equal(count(svg, 'edge'), edges);
});

test('a board with no coordinates lays out with no two node boxes overlapping', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const text = line({ chartroom: 1, title: 't', root: 'v' }) + line({ view: 'v', title: 'v' })
        + ids.map((id) => line({ node: id, in: 'v', label: id + '\n第二行' })).join('')
        + [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'e']].map(([from, to], i) => line({ edge: 'e' + i, in: 'v', from, to })).join('');
    const svg = await board.renderBoard(text);
    const boxes = [...svg.matchAll(/data-type="node"><rect [^>]*?\bx="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
        .map((m) => m.slice(1).map(Number));
    assert.equal(boxes.length, ids.length);
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const [ax, ay, aw, ah] = boxes[i];
            const [bx, by, bw, bh] = boxes[j];
            assert.ok(!(ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah), ids[i] + ' overlaps ' + ids[j]);
        }
    }
});

test('malformed text rejects with ParseError', async () => {
    await assert.rejects(board.renderBoard('not json\n'), { name: 'ParseError' });
});

test('listBoards lists *.board directly in the directory, by name, and [] where there is none', () => {
    const dir = tmp('fankeel-board-');
    for (const f of ['b.board', 'a.board', 'bad name.board']) fs.writeFileSync(path.join(dir, f), FIXTURE);
    fs.writeFileSync(path.join(dir, 'notes.md'), 'x');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.board'), FIXTURE);
    const got = board.listBoards(dir);
    assert.deepEqual(got.map((b) => b.name), ['a', 'b']);
    assert.ok(got.every((b) => Number.isInteger(b.updated) && b.updated > 0));
    assert.deepEqual(board.listBoards(path.join(dir, 'missing')), []);
    assert.deepEqual(board.listBoards(null), []);
});

test('boardFile resolves a name inside the directory, and null for anything else', () => {
    const dir = tmp('fankeel-board-');
    fs.writeFileSync(path.join(dir, 'a.board'), FIXTURE);
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.board'), FIXTURE);
    assert.equal(board.boardFile(dir, 'a'), path.join(path.resolve(dir), 'a.board'));
    for (const bad of ['../a', 'sub/c', 'sub\\c', 'missing', '', 'a b', '..', '%2e%2e']) {
        assert.equal(board.boardFile(dir, bad), null, JSON.stringify(bad));
    }
    assert.equal(board.boardFile(null, 'a'), null);
});
