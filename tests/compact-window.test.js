'use strict';

// docs/90-agent/plans/2026-10-12-init-compact-window-design.md §1 and §2.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'compact-window.js');
const WINDOW = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function run(cfg, args, extra) {
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
  delete env[WINDOW];
  Object.assign(env, extra);
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env }).trim(), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || '').trim(), code: e.status };
  }
}

const settings = (cfg) => path.join(cfg, 'settings.json');

test('show prints unset on a machine with nothing set', () => {
  assert.deepEqual(run(tmp('fankeel-cw-'), ['show']), { out: 'unset', code: 0 });
});

test('show prints set <n> from the environment and from settings.json', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['show'], { [WINDOW]: '450000' }).out, 'set 450000');
  fs.writeFileSync(settings(cfg), JSON.stringify({ env: { [WINDOW]: '200000' } }));
  assert.equal(run(cfg, ['show']).out, 'set 200000');
  fs.writeFileSync(settings(cfg), JSON.stringify({ env: { [WINDOW]: '0' } }));
  assert.equal(run(cfg, ['show']).out, 'unset');
});

test('decline is remembered, and a later set wins over it', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['decline']).code, 0);
  assert.ok(fs.existsSync(path.join(cfg, 'fankeel', 'compact-window.declined')));
  assert.equal(run(cfg, ['show']).out, 'declined');
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  assert.equal(run(cfg, ['show']).out, 'set 450000');
});

test('set keeps every other key, and show reads back the number it wrote', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), JSON.stringify({ model: 'opus', env: { FOO: '1' } }));
  const got = run(cfg, ['set', '450000']);
  assert.equal(got.code, 0);
  assert.ok(got.out.includes(settings(cfg)), got.out);
  const written = JSON.parse(fs.readFileSync(settings(cfg), 'utf8'));
  assert.deepEqual(written, { model: 'opus', env: { FOO: '1', [WINDOW]: '450000' } });
  assert.equal(run(cfg, ['show']).out, 'set ' + written.env[WINDOW]);
});

test('set creates settings.json where there was none', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['set', '300000']).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(settings(cfg), 'utf8')), { env: { [WINDOW]: '300000' } });
});

test('set leaves a backup holding the bytes that were there', () => {
  const cfg = tmp('fankeel-cw-');
  const original = '{\n\t"model":\t"opus"\n}';
  fs.writeFileSync(settings(cfg), original);
  const got = run(cfg, ['set', '450000']);
  assert.equal(got.code, 0);
  const bak = settings(cfg) + '.fankeel-bak';
  assert.equal(fs.readFileSync(bak, 'utf8'), original);
  assert.ok(got.out.includes(bak), got.out);
  assert.ok(got.out.endsWith('Restart Claude Code for it to take effect.'), got.out);
  assert.deepEqual(fs.readdirSync(cfg).filter((f) => f.endsWith('.fankeel-tmp')), []);
  const bare = tmp('fankeel-cw-');
  assert.equal(run(bare, ['set', '450000']).code, 0);
  assert.ok(!fs.existsSync(settings(bare) + '.fankeel-bak'));
});

test('set refuses a settings.json that links to nothing', (t) => {
  const cfg = tmp('fankeel-cw-');
  const gone = path.join(cfg, 'gone.json');
  try { fs.symlinkSync(gone, settings(cfg)); } catch (e) { t.skip('no symlink privilege'); return; }
  const got = run(cfg, ['set', '450000']);
  assert.equal(got.code, 1);
  assert.ok(got.out.includes(settings(cfg)), got.out);
  assert.ok(!fs.existsSync(gone));
});

test('set writes through a live link and leaves it a link', (t) => {
  const cfg = tmp('fankeel-cw-');
  const real = path.join(cfg, 'real.json');
  fs.writeFileSync(real, JSON.stringify({ model: 'opus' }));
  try { fs.symlinkSync(real, settings(cfg)); } catch (e) { t.skip('no symlink privilege'); return; }
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  assert.ok(fs.lstatSync(settings(cfg)).isSymbolicLink());
  assert.deepEqual(JSON.parse(fs.readFileSync(real, 'utf8')), { model: 'opus', env: { [WINDOW]: '450000' } });
});

test('set keeps the mode settings.json had', (t) => {
  if (process.platform === 'win32') { t.skip('no POSIX modes'); return; }
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), '{}');
  fs.chmodSync(settings(cfg), 0o600);
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  assert.equal(fs.statSync(settings(cfg)).mode & 0o777, 0o600);
});

test('a link left at the backup or temp path is replaced, not written through', (t) => {
  const cfg = tmp('fankeel-cw-');
  const original = '{"model":"opus"}';
  fs.writeFileSync(settings(cfg), original);
  const victims = ['victim-bak.txt', 'victim-tmp.txt'].map((f) => path.join(cfg, f));
  for (const v of victims) fs.writeFileSync(v, 'victim');
  try {
    fs.symlinkSync(victims[0], settings(cfg) + '.fankeel-bak');
    fs.symlinkSync(victims[1], settings(cfg) + '.fankeel-tmp');
  } catch (e) { t.skip('no symlink privilege'); return; }
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  for (const v of victims) assert.equal(fs.readFileSync(v, 'utf8'), 'victim');
  const bak = settings(cfg) + '.fankeel-bak';
  assert.ok(!fs.lstatSync(bak).isSymbolicLink());
  assert.equal(fs.readFileSync(bak, 'utf8'), original);
  assert.ok(!fs.existsSync(settings(cfg) + '.fankeel-tmp'));
  assert.deepEqual(JSON.parse(fs.readFileSync(settings(cfg), 'utf8')), { model: 'opus', env: { [WINDOW]: '450000' } });
});

test('a settings.json that opens with a byte-order mark still parses', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), String.fromCharCode(0xFEFF) + JSON.stringify({ model: 'opus' }));
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(settings(cfg), 'utf8')), { model: 'opus', env: { [WINDOW]: '450000' } });
});

test('set refuses a bad number, a file that does not parse and an env that is no object, and writes nothing', () => {
  const cfg = tmp('fankeel-cw-');
  for (const bad of ['abc', '0', '-5', '4.5', '']) {
    assert.equal(run(cfg, ['set', bad]).code, 1, JSON.stringify(bad));
    assert.ok(!fs.existsSync(settings(cfg)), JSON.stringify(bad));
  }
  for (const body of ['{ not json', '[]', '{"env":"x"}']) {
    fs.writeFileSync(settings(cfg), body);
    const got = run(cfg, ['set', '450000']);
    assert.equal(got.code, 1, body);
    assert.ok(got.out.includes(settings(cfg)), got.out);
    assert.equal(fs.readFileSync(settings(cfg), 'utf8'), body);
  }
});

test('anything else is a usage line and exit 2', () => {
  const cfg = tmp('fankeel-cw-');
  for (const args of [[], ['get'], ['set'], ['show', 'x']]) {
    const got = run(cfg, args);
    assert.equal(got.code, 2, args.join(' '));
    assert.match(got.out, /usage: compact-window\.js show \| set <n> \| sync <at> \| decline/);
  }
});

test('sync writes on a machine with nothing set, then says same and touches no byte', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), JSON.stringify({ model: 'opus' }));
  const first = run(cfg, ['sync', '450000']);
  assert.equal(first.code, 0);
  assert.ok(first.out.startsWith('changed unset → 450000'), first.out);
  assert.ok(first.out.includes(settings(cfg)), first.out);
  assert.ok(first.out.includes(settings(cfg) + '.fankeel-bak'), first.out);
  const bak = settings(cfg) + '.fankeel-bak';
  const before = [fs.readFileSync(settings(cfg)), fs.readFileSync(bak)];
  fs.writeFileSync(bak, 'marker');
  before[1] = fs.readFileSync(bak);
  const again = run(cfg, ['sync', '450000']);
  assert.deepEqual(again, { out: 'same 450000', code: 0 });
  assert.deepEqual(fs.readFileSync(settings(cfg)), before[0]);
  assert.deepEqual(fs.readFileSync(bak), before[1]);
});

test('sync reports the old value when it changes one, and ignores process.env', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), JSON.stringify({ env: { [WINDOW]: '350000' } }));
  const got = run(cfg, ['sync', '600000'], { [WINDOW]: '600000' });
  assert.ok(got.out.startsWith('changed 350000 → 600000'), got.out);
  assert.equal(JSON.parse(fs.readFileSync(settings(cfg), 'utf8')).env[WINDOW], '600000');
});

test('sync off and a decline marker leave the window alone', () => {
  const cfg = tmp('fankeel-cw-');
  assert.deepEqual(run(cfg, ['sync', 'off']), { out: 'off: window left as it is', code: 0 });
  assert.ok(!fs.existsSync(settings(cfg)));
  run(cfg, ['decline']);
  assert.deepEqual(run(cfg, ['sync', '450000']), { out: 'declined: window left as it is', code: 0 });
  assert.ok(!fs.existsSync(settings(cfg)));
});

test('sync refuses a number outside the three windows with usage and exit 2', () => {
  const cfg = tmp('fankeel-cw-');
  for (const bad of ['200000', 'abc', '']) {
    const got = run(cfg, ['sync', bad]);
    assert.equal(got.code, 2, bad);
    assert.match(got.out, /usage: compact-window\.js show \| set <n> \| sync <at> \| decline/);
  }
  assert.ok(!fs.existsSync(settings(cfg)));
});

test('sync exits 1 with the reason when settings.json does not parse, and leaves it', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), '{ not json');
  const got = run(cfg, ['sync', '450000']);
  assert.equal(got.code, 1);
  assert.ok(got.out.includes(settings(cfg)), got.out);
  assert.equal(fs.readFileSync(settings(cfg), 'utf8'), '{ not json');
});

test('the exported sync returns the state object', () => {
  const cfg = tmp('fankeel-cw-');
  const { sync } = require('../scripts/compact-window.js');
  const a = sync(cfg, '450000');
  assert.deepEqual([a.state, a.from, a.to, a.file], ['changed', 'unset', '450000', settings(cfg)]);
  assert.equal(sync(cfg, '450000').state, 'same');
  assert.equal(sync(cfg, 'off').state, 'off');
  fs.writeFileSync(settings(cfg), '[]');
  const f = sync(cfg, '350000');
  assert.equal(f.state, 'failed');
  assert.ok(f.reason.includes(settings(cfg)));
});

test('sync exits 1 with the reason when the write throws, and leaves settings.json', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), '{}');
  const block = settings(cfg) + '.fankeel-tmp';
  fs.mkdirSync(path.join(block, 'in'), { recursive: true });
  const got = run(cfg, ['sync', '450000']);
  assert.equal(got.code, 1);
  assert.match(got.out, /^compact-window\.js: \S/);
  assert.equal(fs.readFileSync(settings(cfg), 'utf8'), '{}');
  const { sync } = require('../scripts/compact-window.js');
  const f = sync(cfg, '450000');
  assert.deepEqual([f.state, f.from, f.to], ['failed', 'unset', '450000']);
  assert.ok(f.reason.length > 0);
});
