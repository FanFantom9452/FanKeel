'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-retro.md'), 'utf8').replace(/\s+/g, ' ');

test('the retro names the six facets and tags each evidence line with one', () => {
  for (const f of ['架構理解疏漏', '鬼打牆', '可平行未平行', '關卡或驗證被跳過', '工具故障', '其他流程']) {
    assert.ok(text.includes('`' + f + '`'), f);
  }
  assert.match(text, /`evidence: turn <n> — "<at most fifteen words, quoted from that turn>" · facet: <facet>`/);
});

test('an architecture finding stands only for a local source or a card, else it is an unverified: line', () => {
  assert.match(text, /`source local\|imported`/);
  assert.match(text, /`card <path>\|none`/);
  assert.match(text, /`unverified: <finding> — turn <n> — facet: 架構理解疏漏`/);
  assert.match(text, /A `架構理解疏漏` candidate stands when the source is `local`/);
  assert.match(text, /The other five facets need only the conversation and stand from any source/);
});

test('a conversation that is not on this machine comes back as needs: zip', () => {
  assert.match(text, /`needs: zip — no transcript for <id>`/);
  assert.match(text, /asks the user for a ZIP/);
});
