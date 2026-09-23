'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { memoryDir } = require('../scripts/memory-check.js');
const {
  scan, report, main, parseArgs, sources, projectsUnder, estimateTokens, duplicates, deadLinks, bigSections,
} = require('../scripts/input-check.js');

function fixture() {
  const configDir = tmp('fankeel-input-config-');
  const root = tmp('fankeel-input-root-');
  fs.writeFileSync(path.join(configDir, 'CLAUDE.md'), '# Global\n\nAlways answer in English.\n');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Project\n\nUse four spaces.\n');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'CLAUDE.md'), '# Sub\n\nA second project.\n');
  const mem = memoryDir(configDir, root);
  fs.mkdirSync(mem, { recursive: true });
  fs.writeFileSync(path.join(mem, 'alpha-rule.md'), 'x\n');
  fs.writeFileSync(path.join(mem, 'MEMORY.md'), [
    '- [Alpha rule for tests](alpha-rule.md) — the first',
    '- [Alpha rule for tests](alpha-rule.md) — said again',
    '- [Gone entry](gone-entry.md) — its file was deleted',
    '',
  ].join('\n'));
  return { configDir, root, mem };
}

test('the fixture: all three kinds of source, with bytes, and both defects named', () => {
  const { configDir, root, mem } = fixture();
  const result = scan(root, configDir);
  const files = result.sources.map((s) => s.file);
  assert.ok(files.includes(path.resolve(configDir, 'CLAUDE.md')), 'no global CLAUDE.md');
  assert.ok(files.includes(path.resolve(root, 'CLAUDE.md')), 'no project CLAUDE.md');
  assert.ok(files.includes(path.resolve(root, 'sub', 'CLAUDE.md')), 'no child project CLAUDE.md');
  assert.ok(files.includes(path.resolve(mem, 'MEMORY.md')), 'no MEMORY.md');
  const memory = result.sources.find((s) => s.kind === 'memory');
  assert.equal(memory.bytes, fs.statSync(path.join(mem, 'MEMORY.md')).size);
  assert.ok(memory.findings.some((f) => f.tag === 'dup' && /line 2 repeats line 1/.test(f.what)), JSON.stringify(memory.findings));
  assert.ok(memory.findings.some((f) => f.tag === 'dead' && /gone-entry\.md/.test(f.what)), JSON.stringify(memory.findings));
  const text = report(result);
  assert.match(text, /global/);
  assert.match(text, /memory/);
  assert.match(text, /dup: line 2 repeats line 1/);
  assert.match(text, /dead: links gone-entry\.md/);
});

test('largest first, and nothing is written', () => {
  const { configDir, root, mem } = fixture();
  const before = fs.readFileSync(path.join(mem, 'MEMORY.md'), 'utf8');
  const bytes = scan(root, configDir).sources.map((s) => s.bytes);
  assert.deepEqual(bytes, [...bytes].sort((a, b) => b - a));
  assert.equal(fs.readFileSync(path.join(mem, 'MEMORY.md'), 'utf8'), before);
  assert.equal(main(['--root', root, '--config-dir', configDir]).code, 0);
});

test('estimateTokens counts a CJK character as one token and four others as one', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('中文'), 2);
  assert.equal(estimateTokens('中文abcde'), 4);
});

test('duplicates keys a bullet by its link title, or its text', () => {
  assert.deepEqual(duplicates('- one thing here\n- other thing\n').length, 0);
  assert.equal(duplicates('- Same Title, here!\n- same title here\n')[0].tag, 'dup');
});

test('deadLinks resolves against the file own directory and skips urls', () => {
  const dir = tmp('fankeel-input-links-');
  fs.writeFileSync(path.join(dir, 'there.md'), '');
  const file = path.join(dir, 'CLAUDE.md');
  const found = deadLinks(file, '[a](there.md) [b](missing.md) [c](https://example.com/x.md)');
  assert.deepEqual(found.map((f) => f.what), ['links missing.md, which is not there']);
});

test('bigSections names a heading whose section passes the line', () => {
  const text = '# small\nx\n## big\n' + 'y'.repeat(50) + '\n';
  assert.deepEqual(bigSections(text, 40).map((f) => f.tag), ['big']);
  assert.match(bigSections(text, 40)[0].what, /section "big"/);
  assert.deepEqual(bigSections(text, 4000), []);
});

test('projectsUnder is the root and each directory under it, dot-directories and node_modules left out', () => {
  const root = tmp('fankeel-input-projects-');
  for (const d of ['a', '.git', 'node_modules']) fs.mkdirSync(path.join(root, d));
  assert.deepEqual(projectsUnder(root), [root, path.join(root, 'a')]);
});

test('sources lists each file once, and parseArgs reads the flags', () => {
  const { configDir, root } = fixture();
  const files = sources(root, configDir).map((s) => s.file);
  assert.equal(new Set(files).size, files.length);
  const a = parseArgs(['--root', root, '--config-dir', configDir, '--section-bytes', '100']);
  assert.equal(a.configDir, path.resolve(configDir));
  assert.equal(a.sectionBytes, 100);
});
