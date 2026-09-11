'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const {
  scan, report, main, projectSlug, memoryDir, parseArgs, indexEntries, citations, lastCommit,
} = require('../scripts/memory-check.js');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-memcheck-project-'));
}
function tmpConfig() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-memcheck-config-'));
}
function initGit(root) {
  cp.execFileSync('git', ['init', '-q'], { cwd: root });
  cp.execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  cp.execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
}
function commitAll(root, msg) {
  cp.execFileSync('git', ['add', '-A'], { cwd: root });
  cp.execFileSync('git', ['commit', '-q', '-m', msg], { cwd: root });
}
function seedNote(dir, name, body) {
  fs.writeFileSync(path.join(dir, name),
    '---\nname: ' + name.replace(/\.md$/, '') + '\ndescription: x\nmetadata:\n  type: reference\n---\n\n' + body + '\n');
}

test('projectSlug replaces :, \\ and / each with -', () => {
  assert.equal(projectSlug('F:\\ymlab\\fankeel'), 'F--ymlab-fankeel');
});

test('memoryDir composes configDir/projects/<slug>/memory', () => {
  const configDir = tmpConfig();
  const root = 'F:\\ymlab\\fankeel';
  assert.equal(memoryDir(configDir, root), path.join(configDir, 'projects', 'F--ymlab-fankeel', 'memory'));
});

test('scan() says there is nothing to check when the project has no memory yet', () => {
  const result = scan(tmpProject(), tmpConfig());
  assert.equal(result.present, false);
  assert.match(report(result), /nothing to check/);
});

test('scan() reports a memory entry citing a repo path that does not exist', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'module.exports = {};\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [A note](a-note.md) — a hook\n');
  seedNote(dir, 'a-note.md', 'See `lib/ghost.js` for the thing.');
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'dead' && f.what.includes('lib/ghost.js')));
});

test('scan() does not report a path whose first segment this project never tracks', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), '');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [B note](b-note.md) — a hook\n');
  seedNote(dir, 'b-note.md', 'See `SomeOtherProject/file.js`.');
  const result = scan(root, configDir);
  assert.equal(result.findings.filter((f) => f.tag === 'dead').length, 0);
});

test('scan() never reports a .fankeel/ citation, even when .fankeel is tracked', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), '{}');
  initGit(root);
  commitAll(root, 'seed');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [C note](c-note.md) — a hook\n');
  seedNote(dir, 'c-note.md', 'See `.fankeel/build/some-plan/scratch.md`.');
  const result = scan(root, configDir);
  assert.equal(result.findings.filter((f) => f.tag === 'dead').length, 0);
});

test('scan() reports a memory entry citing a line past the end of the file', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'line1\nline2\nline3\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [D note](d-note.md) — a hook\n');
  seedNote(dir, 'd-note.md', 'See `lib/real.js:99`.');
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'past-end' && f.what.includes('lib/real.js:99')));
});

test('scan() reports the index and the directory when they disagree, both directions', () => {
  const root = tmpProject();
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [E note](e-note.md) — a hook\n');
  // e-note.md is never written: the index links a file missing on disk.
  seedNote(dir, 'f-note.md', 'body with no citations');
  // f-note.md exists on disk but MEMORY.md never links it.
  const result = scan(root, configDir);
  assert.ok(result.findings.some((f) => f.tag === 'index' && f.what.includes('e-note.md')));
  assert.ok(result.findings.some((f) => f.tag === 'index' && f.what.includes('f-note.md')));
});

test('main() exits non-zero when findings exist, zero when the memory is clean', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'real.js'), 'ok\n');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [Z note](z-note.md) — a hook\n');
  seedNote(dir, 'z-note.md', 'All good, see `lib/real.js`.');
  const clean = main(['--root', root, '--config-dir', configDir]);
  assert.equal(clean.code, 0);

  seedNote(dir, 'z-note.md', 'See `lib/ghost.js`.');
  const dirty = main(['--root', root, '--config-dir', configDir]);
  assert.equal(dirty.code, 1);
});

test('parseArgs resolves --root and --config-dir to absolute paths and reads --quiet', () => {
  const root = tmpProject();
  const configDir = tmpConfig();
  const parsed = parseArgs(['--root', root, '--config-dir', configDir, '--quiet']);
  assert.equal(parsed.root, path.resolve(root));
  assert.equal(parsed.configDir, path.resolve(configDir));
  assert.equal(parsed.quiet, true);
});

test('indexEntries lists bare same-directory .md links and skips a nested or external one', () => {
  const text = [
    '- [A](a-note.md) — one',
    '- [External](https://example.com/x.md) — ignored',
    '- [Nested](sub/dir.md) — ignored, not bare',
    '- [B](b-note.md) — two',
  ].join('\n');
  assert.deepEqual(indexEntries(text), ['a-note.md', 'b-note.md']);
});

test('citations extracts a path or path:line for a tracked root, skipping an untracked root and .fankeel', () => {
  const roots = new Set(['lib']);
  const text = [
    'See `lib/real.js` and `lib/real.js:12` for detail.',
    'A directory mention `docs/` is not a citation.',
    'Outside this project: `SomeOtherProject/file.js`.',
    'Runtime state: `.fankeel/build/plan/scratch.md`.',
  ].join('\n');
  assert.deepEqual(citations(text, roots), [
    { ref: 'lib/real.js', wanted: null },
    { ref: 'lib/real.js', wanted: 12 },
  ]);
});

test('lastCommit reads the committer date of the last commit touching a path, and null otherwise', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  commitAll(root, 'add thing.js');
  const at = lastCommit(root, 'lib/thing.js');
  assert.equal(typeof at, 'number');
  assert.ok(Number.isFinite(at));
  assert.equal(lastCommit(root, 'lib/never-committed.js'), null);
});

test('scan() flags a memory entry whose modified predates the last commit to a path it cites', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  commitAll(root, 'add thing.js');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [G note](g-note.md) — a hook\n');
  fs.writeFileSync(path.join(dir, 'g-note.md'),
    '---\nname: g-note\ndescription: x\nmetadata:\n  type: reference\n  modified: 2020-01-01T00:00:00.000Z\n---\n\nSee `lib/thing.js`.\n');
  const result = scan(root, configDir);
  assert.ok(result.stale.some((s) => s.what.includes('lib/thing.js')));
  assert.equal(result.findings.length, 0, 'a stale citation is not a failing finding');
});

test('scan() does not flag a memory entry modified after the path it cites', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  commitAll(root, 'add thing.js');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [H note](h-note.md) — a hook\n');
  const future = new Date(Date.now() + 3600e3).toISOString();
  fs.writeFileSync(path.join(dir, 'h-note.md'),
    '---\nname: h-note\ndescription: x\nmetadata:\n  type: reference\n  modified: ' + future + '\n---\n\nSee `lib/thing.js`.\n');
  const result = scan(root, configDir);
  assert.equal(result.stale.length, 0);
});
