'use strict';

// The CLI shell over lib/skills.js's classify(): scripts/docs-check.js's argv
// and exit-code shape, scanning skills/**/SKILL.md and lib/stages.js and
// checking that against scripts/. The exit code is `findings.some(f => f.fail)`
// — classify() already produced `empty-scan` for a scan naming nothing, and
// this must not judge that a second time (the Task 1 ruling).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { REQUIRED_CORE } = require('../lib/skills.js');
const { parseArgs, run } = require('../scripts/skills-check.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'skills-check.js');

// The script exits non-zero on a problem, so a failing run has to be caught to
// be read — the same shape tests/todo-check.test.js already uses. Named
// `runCli` rather than `run` so it does not shadow `run()` imported above,
// which is exercised directly further down.
function runCli(dir) {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: e.stdout, code: e.status };
  }
}

// A tree naming every required core script once, each through the
// `<plugin>/` prefix so nothing is also flagged bare-reference. REQUIRED_CORE
// is read off the live export rather than restated, so this fixture moves
// with it instead of rotting the day a thirteenth core script arrives.
// `map.js` alone carries a flag, `--print`, and its own scripts/map.js stub
// declares it in the literal-comparison shape acceptedFlags() reads.
function nameEveryCoreScript(dir) {
  const scriptsDir = path.join(dir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const lines = [];
  for (const name of REQUIRED_CORE) {
    if (name === 'map.js') {
      fs.writeFileSync(path.join(scriptsDir, name), "// '--print' writes to stdout instead of a file.\n");
      lines.push('Run `<plugin>/scripts/map.js --print` to see the map.');
    } else {
      fs.writeFileSync(path.join(scriptsDir, name), '');
      lines.push('Run `<plugin>/scripts/' + name + '`.');
    }
  }
  fs.mkdirSync(path.join(dir, 'skills', 'one'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'one', 'SKILL.md'), lines.join('\n') + '\n');
}

test('a tree naming every required core script, map.js with --print, exits 0', () => {
  const dir = tmp('fankeel-skillscli-');
  nameEveryCoreScript(dir);
  const { out, code } = runCli(dir);
  assert.equal(code, 0, out);
});

// The empty-scan case matters most because zero reads as clean — nothing
// mentions a script anywhere, not even a bare filename, so classify()'s own
// fail-closed finding is what stops this from passing silently.
test('a tree with no script reference anywhere is empty-scan and exits 1', () => {
  const dir = tmp('fankeel-skillscli-');
  fs.mkdirSync(path.join(dir, 'skills', 'one'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'one', 'SKILL.md'), 'Nothing here names a script.\n');
  const { out, code } = runCli(dir);
  assert.equal(code, 1);
  assert.match(out, /empty-scan/);
});

// The gate's own point: it has to pass against the tree it ships in, or it is
// a check nobody can trust anywhere else — the same bar docs-check.js's own
// comments hold themselves to.
test('this repository\'s own tree passes its own gate', () => {
  const { out, code } = runCli(ROOT);
  assert.equal(code, 0, out);
});

// `run()` and `parseArgs()` are called directly here rather than only through
// the spawned CLI above, because `scanned` is not observable from stdout at
// all — the CLI prints findings, never the counts it decided the exit code
// alongside.
test('run() and parseArgs() are usable directly, not only through the CLI', () => {
  const dir = tmp('fankeel-skillscli-');
  nameEveryCoreScript(dir);
  assert.equal(parseArgs(['--root', dir]).root, path.resolve(dir));
  const { findings, scanned } = run(parseArgs(['--root', dir]).root);
  assert.deepEqual(findings, []);
  assert.equal(scanned.scripts, REQUIRED_CORE.length);
});
