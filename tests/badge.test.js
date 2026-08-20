'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { badgeWord, writeBadge, pruneBadges, MAX_WORD } = require('../lib/badge.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';

function tmpClaude() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-badge-'));
}

const flag = (dir, sid) => path.join(dir, 'modes', sid, 'fankeel');

function seedBadge(dir, sid, word, ageMs) {
  const d = path.join(dir, 'modes', sid);
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, 'fankeel');
  fs.writeFileSync(f, word + '\n');
  if (ageMs) {
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(f, t, t);
  }
  return f;
}

test('the badge word is the stage', () => {
  assert.equal(badgeWord('implement', false), 'implement');
});

test('a clash takes the slot from the stage', () => {
  assert.equal(badgeWord('implement', true), 'clash');
});

test('characters TokenBar would strip are removed here instead', () => {
  assert.equal(badgeWord('Design & Review', false), 'designreview');
  assert.equal(badgeWord('IMPLEMENT', false), 'implement');
  assert.equal(badgeWord('code-review', false), 'code-review');
});

test('the word is truncated to what TokenBar will read', () => {
  assert.equal(badgeWord('a'.repeat(40), false).length, MAX_WORD);
  assert.equal(MAX_WORD, 16);
});

test('a stage that survives nothing falls back to on', () => {
  assert.equal(badgeWord('', false), 'on');
  assert.equal(badgeWord(null, false), 'on');
  assert.equal(badgeWord('!!!', false), 'on');
  assert.equal(badgeWord(undefined, false), 'on');
});

test('writeBadge creates the directory tree and writes the word', () => {
  const dir = tmpClaude();
  assert.equal(writeBadge(dir, SID, 'implement'), true);
  assert.equal(fs.readFileSync(flag(dir, SID), 'utf8'), 'implement\n');
});

test('writeBadge overwrites rather than appending', () => {
  const dir = tmpClaude();
  writeBadge(dir, SID, 'design');
  writeBadge(dir, SID, 'clash');
  assert.equal(fs.readFileSync(flag(dir, SID), 'utf8'), 'clash\n');
});

test('writeBadge refuses a session id that would escape the modes directory', () => {
  const dir = tmpClaude();
  assert.equal(writeBadge(dir, '../../evil', 'implement'), false);
  assert.equal(fs.existsSync(path.join(dir, 'modes')), false);
});

test('pruneBadges removes a flag from a session long gone', () => {
  const dir = tmpClaude();
  seedBadge(dir, OTHER, 'implement', 40 * 24 * 3600e3);
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 1);
  assert.equal(fs.existsSync(path.join(dir, 'modes', OTHER)), false);
});

test('pruneBadges keeps a recent foreign flag', () => {
  const dir = tmpClaude();
  seedBadge(dir, OTHER, 'implement', 60e3);
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 0);
  assert.ok(fs.existsSync(flag(dir, OTHER)));
});

test('pruneBadges never touches this session, however old the flag looks', () => {
  const dir = tmpClaude();
  seedBadge(dir, SID, 'implement', 400 * 24 * 3600e3);
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 0);
  assert.ok(fs.existsSync(flag(dir, SID)));
});

test('pruneBadges leaves another plugin flag and its directory alone', () => {
  const dir = tmpClaude();
  seedBadge(dir, OTHER, 'implement', 40 * 24 * 3600e3);
  const caveman = path.join(dir, 'modes', OTHER, 'caveman');
  fs.writeFileSync(caveman, 'ultra\n');
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 1);
  assert.equal(fs.existsSync(flag(dir, OTHER)), false);
  assert.equal(fs.readFileSync(caveman, 'utf8'), 'ultra\n');
});

test('pruneBadges survives a missing modes directory', () => {
  assert.equal(pruneBadges(tmpClaude(), SID, 30 * 24 * 3600e3), 0);
});

test('pruneBadges ignores entries that are not session directories', () => {
  const dir = tmpClaude();
  fs.mkdirSync(path.join(dir, 'modes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'modes', 'stray.txt'), 'x');
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 0);
  assert.ok(fs.existsSync(path.join(dir, 'modes', 'stray.txt')));
});
