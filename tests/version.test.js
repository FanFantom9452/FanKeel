'use strict';

// The release number lives in ten files and nothing used to set them together,
// so a release was ten edits and a miss left a skill announcing a version the
// plugin is not. `tests/contract.test.js` fails when they disagree; this is the
// half that makes them agree.
//
// Every test here works on a copy. A script whose job is to rewrite ten files in
// this repository must never be pointed at this repository by its own tests.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const version = require('../scripts/version.js');

const REAL = path.join(__dirname, '..');

// The shape rather than the contents: two manifests and one SKILL.md per skill,
// which is what the script goes looking for.
function tree(over) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-version-'));
  const at = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  const v = (rel) => (over && over[rel]) || '0.34.0';
  at('package.json', JSON.stringify({ name: 'fankeel', version: v('package.json') }, null, 2) + '\n');
  at('.claude-plugin/plugin.json', JSON.stringify({ version: v('.claude-plugin/plugin.json') }, null, 2) + '\n');
  for (const name of ['fankeel', 'fankeel-survey', 'fankeel-build']) {
    const rel = 'skills/' + name + '/SKILL.md';
    at(rel, '---\nname: ' + name + '\nversion: ' + v(rel) + '\n---\n\n# ' + name + '\n');
  }
  return root;
}

test('agreement is reported with the number and nothing else', () => {
  const r = version.main([], tree());
  assert.equal(r.code, 0);
  assert.match(r.text, /0\.34\.0, in all 5 places/);
});

// The failure names every file and its answer, because "they disagree" sends
// somebody to open ten files to find the one.
test('a disagreement names which file says what', () => {
  const root = tree({ 'package.json': '0.33.1', 'skills/fankeel-build/SKILL.md': '0.30.0' });
  const r = version.main([], root);
  assert.equal(r.code, 1);
  assert.match(r.text, /3 different answers/);
  assert.match(r.text, /0\.33\.1\s+package\.json/);
  assert.match(r.text, /0\.30\.0\s+skills\/fankeel-build\/SKILL\.md/);
});

test('setting it writes every file and says how many moved', () => {
  const root = tree({ 'package.json': '0.33.1' });
  const r = version.main(['0.35.0'], root);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /0\.35\.0, in all 5 places/);
  for (const row of version.readAll(root)) assert.equal(row.version, '0.35.0', row.file);
});

// The manifests are rewritten a line at a time rather than re-serialised, so a
// version bump does not reflow a file somebody hand-maintains.
test('a manifest keeps its own formatting through a bump', () => {
  const root = tree();
  const file = path.join(root, 'package.json');
  fs.writeFileSync(file, '{\n    "name": "fankeel",\n    "version": "0.34.0",\n    "private": true\n}\n');
  version.main(['0.36.0'], root);
  const after = fs.readFileSync(file, 'utf8');
  assert.equal(JSON.parse(after).version, '0.36.0');
  assert.match(after, /\n {4}"private": true\n/, 'the file was re-serialised');
});

test('anything that is not a release number is refused rather than written', () => {
  const root = tree();
  for (const bad of ['v1', '1.2', 'latest', '1.2.3.4']) {
    const r = version.main([bad], root);
    assert.equal(r.code, 1, bad);
    assert.match(r.text, /Not a release number/);
  }
  for (const row of version.readAll(root)) assert.equal(row.version, '0.34.0', row.file);
});

// A place the number should be and is not is the same defect as one that
// disagrees, so it is reported rather than skipped.
test('a file with no version line reads as none, not as absent', () => {
  const root = tree();
  fs.writeFileSync(path.join(root, 'skills', 'fankeel', 'SKILL.md'), '---\nname: fankeel\n---\n');
  const r = version.main([], root);
  assert.equal(r.code, 1);
  assert.match(r.text, /\(none\)\s+skills\/fankeel\/SKILL\.md/);
});

// The count this repository actually has, checked against the real tree so the
// script and `tests/contract.test.js` cannot disagree about what ten means.
test('the real repository has the eleven places the contract test counts', () => {
  const rows = version.readAll(REAL);
  assert.equal(rows.length, 11, rows.map((r) => r.file).join(', '));
  assert.equal(new Set(rows.map((r) => r.version)).size, 1);
});

// The other half of the same gap: the number was in ten places and what changed
// between two of them was in none. Derived from the log rather than kept by hand,
// because a hand-kept changelog is a second copy of the commits and the copy is
// the one that goes stale.
test('the changes since a release are the commits after it', () => {
  const found = { since: { sha: 'a'.repeat(40), subject: 'chore: 0.34.0 — a headline' },
    commits: [{ sha: 'b'.repeat(40), subject: 'fix: one thing' },
      { sha: 'c'.repeat(40), subject: 'docs: another' }] };
  const r = version.changeReport(found, '0.34.0');
  assert.equal(r.code, 0);
  assert.match(r.text, /2 commit\(s\) since chore: 0\.34\.0/);
  assert.match(r.text, /bbbbbbb {2}fix: one thing/);
});

test('a release with nothing after it says so rather than printing an empty list', () => {
  const r = version.changeReport({ since: { sha: 'a'.repeat(40), subject: 'chore: 0.34.0' }, commits: [] }, '0.34.0');
  assert.equal(r.code, 0);
  assert.match(r.text, /Nothing has landed since; 0\.34\.0 is what is out/);
});

// A repository that has never made one is not an error. Every commit in it is
// what the first release would contain.
test('no release commit yet means every commit is the first release', () => {
  const r = version.changeReport({ since: null, commits: [{ sha: 'a'.repeat(40), subject: 'feat: the beginning' }] }, '0.1.0');
  assert.equal(r.code, 0);
  assert.match(r.text, /no release commit found/);
});

test('a directory with no git history says so instead of guessing', () => {
  assert.equal(version.changes(tree()), null);
  assert.equal(version.main(['--changes'], tree()).code, 1);
});

// The manifests are listed and the skills are found, and the asymmetry is the
// point: a third manifest is a decision somebody makes, where a ninth skill is
// what adding a stage looks like and should be covered without editing this.
test('the skills are found by looking, the manifests by name', () => {
  assert.deepEqual(version.MANIFESTS, ['package.json', '.claude-plugin/plugin.json']);

  const root = tree();
  assert.deepEqual(version.skillFiles(root), [
    'skills/fankeel-build/SKILL.md',
    'skills/fankeel-survey/SKILL.md',
    'skills/fankeel/SKILL.md',
  ], 'sorted, so two runs over one tree read the same');

  fs.mkdirSync(path.join(root, 'skills', 'fankeel-ninth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'fankeel-ninth', 'SKILL.md'), '---\nversion: 0.34.0\n---\n');
  assert.equal(version.skillFiles(root).length, 4, 'a new skill is covered without this file changing');

  // A directory under skills/ that holds no SKILL.md is not a skill.
  fs.mkdirSync(path.join(root, 'skills', 'not-a-skill'), { recursive: true });
  assert.equal(version.skillFiles(root).length, 4);

  assert.deepEqual(version.skillFiles(path.join(root, 'nowhere')), []);
});

// Only a release commit starts a release. Other chore commits are ordinary work.
test('a chore that is not a release does not start one', () => {
  assert.equal(version.RELEASE.test('chore: 0.34.0 — the end of a task says what shipped'), true);
  assert.equal(version.RELEASE.test('chore: close the TODO entry this work finished'), false);
  assert.equal(version.RELEASE.test('chore: 0.34 — two numbers is not a release'), false);
});
