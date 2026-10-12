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
    assert.match(got.out, /usage: compact-window\.js show \| set <n> \| decline/);
  }
});
