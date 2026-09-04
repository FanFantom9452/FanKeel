'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { badgeWord, writeBadge, readBadge, pruneBadges, MAX_WORD } = require('../lib/badge.js');
const badge = require('../lib/badge.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';

function tmpClaude() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-badge-'));
}

const flag = (dir, sid) => path.join(dir, 'modes', sid, 'fankeel');
const lead = (dir, sid) => flag(dir, sid) + '.lead';

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

function seedLead(dir, sid, body, ageMs) {
  const f = lead(dir, sid);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
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

// The badge is the word; the lead is the rail TokenBar actually draws. Every
// other caller takes them down together — `hooks/inject.js:115` and
// `scripts/task.js:96` both call `clearBadge` and `clearLead` in the same
// breath. Pruning removed only the badge, so a session thirty days gone kept a
// live rail for ever, and the directory it sat in never emptied.
test('pruneBadges takes the lead down with the badge', () => {
  const dir = tmpClaude();
  seedBadge(dir, OTHER, 'implement', 40 * 24 * 3600e3);
  seedLead(dir, OTHER, 'word=implement\ntask=something long gone\n', 40 * 24 * 3600e3);
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 1);
  assert.equal(fs.existsSync(lead(dir, OTHER)), false, 'the lead outlived the badge');
  assert.equal(fs.existsSync(path.join(dir, 'modes', OTHER)), false, 'nothing was left, so the directory should have gone');
});

test('pruneBadges keeps a recent flag and its lead', () => {
  const dir = tmpClaude();
  seedBadge(dir, OTHER, 'implement', 60e3);
  seedLead(dir, OTHER, 'word=implement\n', 60e3);
  assert.equal(pruneBadges(dir, SID, 30 * 24 * 3600e3), 0);
  assert.ok(fs.existsSync(lead(dir, OTHER)));
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

test('readBadge returns the word on disk, and null for everything else', () => {
  const dir = tmpClaude();
  assert.equal(readBadge(dir, SID), null, 'no file yet');
  writeBadge(dir, SID, 'init');
  assert.equal(readBadge(dir, SID), 'init');
  writeBadge(dir, SID, 'survey');
  assert.equal(readBadge(dir, SID), 'survey');
  assert.equal(readBadge(dir, 'not-a-session-id'), null, 'a rejected id is not a read');
});

// LEAD_KEYS is exported because it is the contract `writeLead` writes to —
// only these keys, in this order, and `root` is the newest of them. A reader
// outside this file (the station, eventually) needs the same list rather than
// a second copy of it, so the order lives here once.
test('LEAD_KEYS is the order writeLead writes fields in, with root last', () => {
  assert.deepEqual(badge.LEAD_KEYS, ['word', 'step', 'steps', 'title', 'where', 'guard', 'others', 'root']);
});

test('readLeads lists every lead under modes/ with its fields, root included', () => {
    const dir = tmpClaude();
    const other = 'abcdef01-2345-6789-abcd-ef0123456789';
    assert.equal(badge.writeLead(dir, SID, { word: 'build', step: 3, steps: 5, title: 't', root: 'F:\\ws' }), true);
    assert.equal(badge.writeLead(dir, other, { word: 'init', step: 0, root: '/home/u/ws' }), true);
    fs.mkdirSync(path.join(dir, 'modes', 'not-a-session-id'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'modes', 'not-a-session-id', 'fankeel.lead'), 'word=build\n');
    const leads = badge.readLeads(dir).sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    assert.deepEqual(leads.map((l) => l.sessionId), [other, SID].sort());
    const mine = leads.find((l) => l.sessionId === SID);
    assert.deepEqual(mine.fields, { word: 'build', step: '3', steps: '5', title: 't', root: 'F:\\ws' });
    assert.equal(leads.find((l) => l.sessionId === other).fields.root, '/home/u/ws');
});

test('readLeads returns [] where modes/ is absent, and skips a lead with no word', () => {
    const dir = tmpClaude();
    assert.deepEqual(badge.readLeads(dir), []);
    fs.mkdirSync(path.join(dir, 'modes', SID), { recursive: true });
    fs.writeFileSync(path.join(dir, 'modes', SID, 'fankeel.lead'), 'root=F:\\ws\n');
    assert.deepEqual(badge.readLeads(dir), []);
});
