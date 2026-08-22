'use strict';

// The map is the one artefact that travels from survey to land, so what matters
// is that it says what it does not know rather than producing an empty section
// that reads as "there is nothing here".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const map = require('../lib/map.js');

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-map-'));
const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('firstTable takes the first table of three rows or more', () => {
  const lines = [
    '# Title',
    '',
    'Some prose.',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    'after',
  ];
  assert.deepEqual(map.firstTable(lines, 18, 160), ['| a | b |', '|---|---|', '| 1 | 2 |']);
});

test('firstTable refuses a two-row table, which is a formatting accident', () => {
  assert.deepEqual(map.firstTable(['| a |', '|---|'], 18, 160), []);
});

test('the signpost is the first of CLAUDE.md, AGENTS.md, README.md that exists', () => {
  const dir = root();
  write(dir, 'README.md', '| x | y |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'README.md');
  write(dir, 'CLAUDE.md', '| a | b |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'CLAUDE.md');
});

test('a project with no signpost says so rather than returning nothing', () => {
  const dir = root();
  write(dir, 'lib/thing.js', 'x');
  const text = map.buildMap(dir);
  assert.match(text, /no CLAUDE\.md, AGENTS\.md or README\.md/);
});

test('pages are grouped by what they declare about themselves', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/now.md', '---\nstatus: current\n---\n# Now\n');
  write(dir, 'docs/later.md', '---\nstatus: design-intent\n---\n# Later\n');
  write(dir, 'docs/gone.md', '---\nstatus: archived\n---\n# Gone\n');
  write(dir, 'docs/bare.md', '# Bare\n');
  const by = map.pagesByStatus(dir);
  assert.deepEqual(by.intent, ['docs/later.md']);
  assert.deepEqual(by.retired, ['docs/gone.md']);
  assert.deepEqual(by.undeclared, ['docs/bare.md']);
  assert.ok(by.current.includes('docs/now.md'));
});

test('the map names what was planned but not built, because nothing else does', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/roadmap.md', '---\nstatus: design-intent\n---\n# Roadmap\n');
  const text = map.buildMap(dir);
  assert.match(text, /planned, not built/);
  assert.match(text, /docs\/roadmap\.md/);
});

test('the map declares itself generated so the sweep skips it', () => {
  const text = map.buildMap(root());
  assert.match(text, /^---\r?\nstatus: generated\r?\n/);
  assert.match(text, /source_of_truth: generated-by scripts\/map\.js/);
});
