'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { callersOf, blastFor } = require('../lib/lenses.js');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'lenses.js');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function put(dir, rel, text) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
}

// lib/core.js is required by three files, lib/other.js by one, and a second
// core.js in sub/ by none; HEAD~1..HEAD changes lib/core.js, lib/other.js and
// sub/core.js.
function repo() {
    const dir = tmp('fankeel-blast-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    put(dir, 'lib/core.js', 'module.exports = 1;\n');
    put(dir, 'lib/other.js', 'module.exports = 1;\n');
    put(dir, 'sub/core.js', 'module.exports = 1;\n');
    put(dir, 'a.js', "const c = require('./lib/core.js');\n");
    put(dir, 'b.js', "const c = require('./lib/core');\n");
    put(dir, 'lib/c.js', "const c = require('./core');\nconst o = require('./other.js');\nconst p = require('node:path');\n");
    put(dir, 'esm.mjs', "import core from './lib/core.js';\n");
    put(dir, 'sub/uses.js', "const c = require('./core.js');\n");
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    put(dir, 'lib/core.js', 'module.exports = 2;\n');
    put(dir, 'lib/other.js', 'module.exports = 2;\n');
    put(dir, 'sub/core.js', 'module.exports = 2;\n');
    git(dir, 'commit', '-qam', 'change');
    return dir;
}

test('callersOf: resolves each specifier against its caller, so sub/core.js is not lib/core.js', () => {
    const dir = repo();
    assert.deepEqual(callersOf(dir, 'lib/core.js'), ['a.js', 'b.js', 'esm.mjs', 'lib/c.js']);
    assert.deepEqual(callersOf(dir, 'sub/core.js'), ['sub/uses.js']);
    assert.deepEqual(callersOf(dir, 'lib/other.js'), ['lib/c.js']);
});

test('blastFor: fires at the threshold and lists every caller; one under stays quiet', () => {
    const dir = repo();
    assert.deepEqual(blastFor(dir, ['lib/core.js', 'lib/other.js'], 4), [
        { file: 'lib/core.js', callers: ['a.js', 'b.js', 'esm.mjs', 'lib/c.js'] },
    ]);
    assert.deepEqual(blastFor(dir, ['lib/core.js'], 5), []);
    assert.deepEqual(blastFor(dir, ['lib/core.js'], 'off'), []);
});

test('scripts/lenses.js: a changed file with N callers prints ## Blast radius and the N callers @slow', () => {
    const dir = repo();
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', '4').ok, true);
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, [
        '## Blast radius',
        'lib/core.js — 4 callers',
        '  a.js',
        '  b.js',
        '  esm.mjs',
        '  lib/c.js',
        '',
    ].join('\n'));
});

test('scripts/lenses.js: under the threshold prints none, and verify.blast off never counts @slow', () => {
    const dir = repo();
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', '5').ok, true);
    let r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.stdout, 'none\n');
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', 'off').ok, true);
    r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.stdout, 'none\n');
});
