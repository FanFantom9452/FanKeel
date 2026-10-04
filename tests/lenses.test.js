'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { lensesFor, addedLines } = require('../lib/lenses.js');
const { parseArgs } = require('../scripts/lenses.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'lenses.js');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// Two commits; every test's range is HEAD~1..HEAD against them.
function repo(secondContent) {
    const dir = tmp('fankeel-lenses-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 1;\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.js'), secondContent);
    git(dir, 'commit', '-qam', 'change');
    return dir;
}

test('addedLines: only the lines a diff adds, never the +++ file header', () => {
    const diff = ['--- a/a.js', '+++ b/a.js', '-old', '+new', ' unchanged'].join('\n');
    assert.deepEqual(addedLines(diff), ['new']);
});

test('lensesFor: an added catch( line reads as silent-failure, never []', () => {
    const diff = [
        ' module.exports = 1;',
        '+try {',
        '+  risky();',
        '+} catch (e) {',
        '+  return null;',
        '+}',
    ].join('\n');
    const lenses = lensesFor(diff);
    assert.ok(lenses.length, 'an added catch( line came back []');
    assert.deepEqual(lenses, ['silent-failure']);
});

test('lensesFor: a diff that only adds a comment line reads as comment, never []', () => {
    const diff = [' module.exports = 1;', '+// exported for the CLI entry point'].join('\n');
    const lenses = lensesFor(diff);
    assert.ok(lenses.length, 'a comment-only diff came back []');
    assert.deepEqual(lenses, ['comment']);
});

test('lensesFor: both patterns fire both lenses; neither pattern is []', () => {
    const both = ['+// swallow it', '+try { risky(); } catch (e) { return undefined; }'].join('\n');
    assert.deepEqual(lensesFor(both), ['silent-failure', 'comment']);
    assert.deepEqual(lensesFor(['+const x = 1;', '+return x + 1;'].join('\n')), []);
});

test('parseArgs: <range> and --root, and a range git would read as an option is refused', () => {
    assert.deepEqual(parseArgs(['a..b']), { range: 'a..b', root: process.cwd() });
    assert.equal(parseArgs(['a..b', '--root', '/x']).root, '/x');
    assert.ok(parseArgs([]).error, 'no range');
    assert.ok(parseArgs(['--bogus']).error, 'a range starting with -');
    assert.ok(parseArgs(['a..b', '--root']).error, '--root with nothing after it');
});

test('scripts/lenses.js <range>: one lens per line from the real git diff', () => {
    const dir = repo('module.exports = 1;\n// a plain comment\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'comment\n');
});

test('scripts/lenses.js: no lens fires, prints none', () => {
    const dir = repo('module.exports = 2;\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'none\n');
});

test('scripts/lenses.js: no range is a usage error, exit 2, nothing run', () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: lenses\.js/);
});

test('a range after -- that starts with - is refused, not handed to git as an option', () => {
    assert.ok(parseArgs(['--', '--output=x']).error);
});
