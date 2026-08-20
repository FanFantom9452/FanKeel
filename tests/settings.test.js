'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const settings = require('../lib/settings.js');

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-settings-'));
const write = (d, text) => fs.writeFileSync(path.join(d, 'settings.json'), text);
const read = (d) => fs.readFileSync(path.join(d, 'settings.json'), 'utf8');
const json = (d) => JSON.parse(read(d));

test('a missing settings.json is created with only the one field', () => {
  const d = dir();
  const r = settings.setOutputStyle(d, 'fankeel-terse');
  assert.equal(r.ok, true);
  assert.deepEqual(json(d), { outputStyle: 'fankeel-terse' });
  assert.equal(r.backup, null, 'nothing existed to back up');
});

test('a config directory that does not exist yet is created', () => {
  // Found by running the script rather than by a test: every case here used
  // mkdtemp, so the directory always existed and a first run on a fresh machine
  // was the one path nothing covered.
  const d = path.join(dir(), 'never', 'made');
  const r = settings.setOutputStyle(d, 'fankeel-terse');
  assert.equal(r.ok, true, r.reason);
  assert.equal(json(d).outputStyle, 'fankeel-terse');
});

test('every other key survives', () => {
  const d = dir();
  write(d, JSON.stringify({
    permissions: { allow: ['Bash(git:*)'] },
    env: { FOO: 'bar' },
    extraKnownMarketplaces: { fankeel: { source: { source: 'github' } } },
  }, null, 2) + '\n');
  settings.setOutputStyle(d, 'fankeel-review');
  const after = json(d);
  assert.deepEqual(after.permissions, { allow: ['Bash(git:*)'] });
  assert.deepEqual(after.env, { FOO: 'bar' });
  assert.ok(after.extraKnownMarketplaces.fankeel);
  assert.equal(after.outputStyle, 'fankeel-review');
});

test('a byte order mark does not become a parse failure', () => {
  const d = dir();
  write(d, '\ufeff' + JSON.stringify({ env: { A: '1' } }) + '\n');
  const r = settings.setOutputStyle(d, 'fankeel-terse');
  assert.equal(r.ok, true);
  assert.equal(json(d).env.A, '1');
});

test('a file that does not parse is left exactly as it was', () => {
  const d = dir();
  const broken = '{ "env": { "A": "1" },, }\n';
  write(d, broken);
  const r = settings.setOutputStyle(d, 'fankeel-terse');
  assert.equal(r.ok, false);
  assert.equal(r.state, 'unparseable');
  assert.equal(read(d), broken, 'the broken file was overwritten');
});

test('a top level that is not an object is refused rather than replaced', () => {
  const d = dir();
  write(d, '[1, 2, 3]\n');
  assert.equal(settings.setOutputStyle(d, 'fankeel-terse').ok, false);
  assert.equal(read(d), '[1, 2, 3]\n');
});

test('the backup holds the original and is never overwritten by a later change', () => {
  const d = dir();
  const original = JSON.stringify({ env: { A: '1' } }, null, 2) + '\n';
  write(d, original);

  settings.setOutputStyle(d, 'fankeel-terse');
  const backup = path.join(d, 'settings.json' + settings.BACKUP_SUFFIX);
  assert.equal(fs.readFileSync(backup, 'utf8'), original);

  settings.setOutputStyle(d, 'fankeel-review');
  assert.equal(fs.readFileSync(backup, 'utf8'), original, 'the last good copy was replaced');
});

test('setting the style it already has writes nothing at all', () => {
  const d = dir();
  settings.setOutputStyle(d, 'fankeel-terse');
  const before = fs.statSync(path.join(d, 'settings.json')).mtimeMs;
  const r = settings.setOutputStyle(d, 'fankeel-terse');
  assert.equal(r.ok, true);
  assert.equal(r.changed, false);
  assert.equal(fs.statSync(path.join(d, 'settings.json')).mtimeMs, before);
});

test('clearing removes the key rather than writing a null', () => {
  const d = dir();
  settings.setOutputStyle(d, 'fankeel-terse');
  settings.setOutputStyle(d, null);
  assert.equal('outputStyle' in json(d), false);
  assert.equal(read(d).includes('null'), false);
});

test('the previous value is reported, so a caller can say what changed', () => {
  const d = dir();
  settings.setOutputStyle(d, 'fankeel-terse');
  const r = settings.setOutputStyle(d, 'fankeel-review');
  assert.equal(r.before, 'fankeel-terse');
  assert.equal(r.after, 'fankeel-review');
});

test('currentOutputStyle reads back what was written, and null when there is none', () => {
  const d = dir();
  assert.equal(settings.currentOutputStyle(d), null);
  settings.setOutputStyle(d, 'fankeel-pipeline');
  assert.equal(settings.currentOutputStyle(d), 'fankeel-pipeline');
});

test('no temporary file is left behind', () => {
  const d = dir();
  settings.setOutputStyle(d, 'fankeel-terse');
  const left = fs.readdirSync(d).filter((f) => f.includes('tmp'));
  assert.deepEqual(left, []);
});

test('the file is written the way Claude Code writes it', () => {
  const d = dir();
  settings.setOutputStyle(d, 'fankeel-terse');
  const text = read(d);
  assert.ok(text.endsWith('}\n'), 'no trailing newline');
  assert.match(text, /\n {2}"outputStyle"/, 'not two-space indented');
  assert.equal(text.charCodeAt(0), '{'.charCodeAt(0), 'a byte order mark was written');
});

test('claudeDir prefers CLAUDE_CONFIG_DIR and falls back to the home directory', () => {
  assert.equal(settings.claudeDir({ CLAUDE_CONFIG_DIR: 'X:/cfg', HOME: '/h' }), 'X:/cfg');
  assert.equal(settings.claudeDir({ HOME: '/h' }), path.join('/h', '.claude'));
  assert.equal(settings.claudeDir({}), null);
});
