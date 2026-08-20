'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const style = require('../scripts/style.js');
const { STYLES, NAMES, byName, byAny } = require('../lib/styles.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'style.js');
const STYLE_DIR = path.join(__dirname, '..', 'output-styles');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-style-'));

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
    task: 'finish the styles',
    scope: ['lib/**'],
    stage: 'build',
    active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over), null, 2) + '\n');
}

const entry = (root) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));

function run(args) {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: e.stdout, code: e.status };
  }
}

const readSettings = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));

// ---- the data ------------------------------------------------------------

test('every style has a file on disk, and every file has a style', () => {
  const files = fs.readdirSync(STYLE_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  const declared = STYLES.map((s) => s.file);
  assert.deepEqual(declared.slice().sort(), files.slice().sort(),
    'lib/styles.js and output-styles/ disagree about which styles exist');
});

test('the digest is short enough to ride on every prompt', () => {
  for (const s of STYLES) {
    assert.ok(s.digest.length <= 4, s.name + ' has ' + s.digest.length + ' digest lines');
    const chars = s.digest.join(' ').length;
    assert.ok(chars < 600, s.name + ' digest is ' + chars + ' chars');
  }
});

test('every digest keeps the rule whose absence fails silently', () => {
  // A digest written in English otherwise reads as an instruction to answer in
  // English, and a bilingual user's replies quietly switch language.
  for (const s of STYLES) {
    assert.ok(s.digest.some((d) => /language the user writes in/.test(d)), s.name);
  }
});

test('names are looked up by the short form and by the file name', () => {
  assert.equal(byName('terse').file, 'fankeel-terse');
  assert.equal(byName('  TERSE ').file, 'fankeel-terse');
  assert.equal(byName('fankeel-terse'), null, 'byName takes the short form only');
  assert.equal(byAny('fankeel-terse').name, 'terse');
  assert.equal(byAny('terse').name, 'terse');
  assert.equal(byAny('Concise'), null);
  assert.equal(byName(undefined), null);
});

// ---- the script ----------------------------------------------------------

test('with no arguments it reports what is set and lists the choices', () => {
  const dir = tmp();
  const { out, code } = run(['--claude-dir', dir]);
  assert.equal(code, 0);
  assert.match(out, /output style: none set/);
  for (const n of NAMES) assert.match(out, new RegExp('\\b' + n + '\\b'));
});

test('a name it does not have is refused, with the choices', () => {
  const dir = tmp();
  const { out, code } = run(['--claude-dir', dir, 'shouty']);
  assert.equal(code, 1);
  assert.match(out, /no style called "shouty"/);
  assert.match(out, /terse/);
  assert.equal(fs.existsSync(path.join(dir, 'settings.json')), false, 'it wrote a file anyway');
});

test('setting one writes the style’s real name into settings.json', () => {
  const dir = tmp();
  const { out, code } = run(['--claude-dir', dir, 'terse']);
  assert.equal(code, 0);
  assert.equal(readSettings(dir).outputStyle, 'fankeel-terse');
  assert.match(out, /output style set to terse/);
});

test('setting the same one twice says so instead of claiming a change', () => {
  const dir = tmp();
  run(['--claude-dir', dir, 'review']);
  const { out } = run(['--claude-dir', dir, 'review']);
  assert.match(out, /already review/);
});

test('off clears it', () => {
  const dir = tmp();
  run(['--claude-dir', dir, 'pipeline']);
  const { out, code } = run(['--claude-dir', dir, 'off']);
  assert.equal(code, 0);
  assert.equal('outputStyle' in readSettings(dir), false);
  assert.match(out, /cleared/);
});

test('the status line names the style when one of ours is set', () => {
  const dir = tmp();
  run(['--claude-dir', dir, 'review']);
  assert.match(run(['--claude-dir', dir]).out, /output style: review \(fankeel-review\)/);
});

test('a style that is not ours is reported as such rather than ignored', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ outputStyle: 'Concise' }, null, 2) + '\n');
  assert.match(run(['--claude-dir', dir]).out, /Concise — not one of fankeel’s/);
});

test('a settings file that does not parse stops it, and says nothing was written', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), '{ oops\n');
  const { out, code } = run(['--claude-dir', dir, 'terse']);
  assert.equal(code, 1);
  assert.match(out, /Nothing was written/);
  assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), '{ oops\n');
});

// ---- the bridge ----------------------------------------------------------

test('with a live task it writes the digest onto that session’s entry', () => {
  const dir = tmp();
  const root = tmp();
  seed(root);
  const { out } = run(['--claude-dir', dir, 'terse', '--session', SESSION, '--root', root]);
  assert.equal(entry(root).style, 'terse');
  assert.match(out, /voice starts now/);
});

test('clearing removes the digest from the entry too', () => {
  const dir = tmp();
  const root = tmp();
  seed(root, { style: 'terse' });
  run(['--claude-dir', dir, 'off', '--session', SESSION, '--root', root]);
  assert.equal('style' in entry(root), false);
});

test('with no task it says the style waits for the next session', () => {
  const dir = tmp();
  const root = tmp();
  const { out } = run(['--claude-dir', dir, 'terse', '--session', SESSION, '--root', root]);
  assert.match(out, /takes effect from your next Claude Code session/);
});

test('the bridge only exists while a settings reload is known not to be live', () => {
  // If this ever flips to true the digest is dead weight: the full style is
  // already in force. The constant is the single place that records the
  // observed answer, so the test names it rather than the behaviour.
  assert.equal(typeof style.SETTINGS_RELOAD_IS_LIVE, 'boolean');
});

test('an unknown style name is never stored on the entry', () => {
  const root = tmp();
  seed(root);
  const registry = require('../lib/registry.js');
  assert.equal(registry.setStyle(root, SESSION, 'shouty'), false);
  assert.equal('style' in entry(root), false);
});

test('flags take their values with them rather than being read as a style name', () => {
  const a = style.parseArgs(['--claude-dir', 'X:/cfg', '--root', 'Y:/p', '--session', SESSION, 'terse']);
  assert.equal(a.dir, 'X:/cfg');
  assert.equal(a.root, 'Y:/p');
  assert.equal(a.sessionId, SESSION);
  assert.equal(a.want, 'terse');
});
