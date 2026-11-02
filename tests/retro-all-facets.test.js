'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-retro-all', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');

test('the dispatch passes the source and the card to each retro', () => {
  assert.match(text, /`source local\|imported`/);
  assert.match(text, /`card <path>`/);
  assert.match(text, /`card none`/);
});

test('only an architecture finding is weighed by source; the others count from anywhere', () => {
  assert.match(text, /`架構理解疏漏`/);
  assert.match(text, /`unverified:`/);
  assert.match(text, /never counted toward "two or more bundles"/);
  assert.match(text, /`鬼打牆`/);
});

test('the export gate offers 附上專案地圖, off by default, as --project-card', () => {
  assert.match(text, /附上專案地圖/);
  assert.match(text, /`--project-card`/);
});

test('a conversation not under ~/.claude/projects is asked of the user as a ZIP', () => {
  assert.match(text, /~\/\.claude\/projects/);
  assert.match(text, /informal/);
  assert.match(text, /`conversation\.js --bundle/);
});
