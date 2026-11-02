'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const ignoreOf = (root) => fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8').split(/\r?\n/).filter(Boolean);

test('ensureLayout lists imports/ in .fankeel/.gitignore on a fresh project', () => {
  const root = tmp('fankeel-imp-ign-');
  registry.ensureLayout(root);
  const lines = ignoreOf(root);
  assert.ok(lines.includes('sessions/'), lines.join(','));
  assert.ok(lines.includes('imports/'), lines.join(','));
});

test('ensureLayout adds imports/ to an older .gitignore and keeps a line added by hand', () => {
  const root = tmp('fankeel-imp-ign-');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', '.gitignore'), 'sessions/\nmine/\n');
  registry.ensureLayout(root);
  const lines = ignoreOf(root);
  assert.ok(lines.includes('mine/') && lines.includes('imports/'), lines.join(','));
  assert.equal(lines.filter((l) => l === 'imports/').length, 1);
});
