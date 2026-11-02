'use strict';
// professor 11-01 design §4: scripts/test-audit.js lists test files whose local
// import resolves to nothing and test bodies that repeat another, and deletes
// nothing. Every fixture below is held in a string, which the scanner does not
// read as code, so running it over this repository does not list this file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { scan } = require('../scripts/test-audit.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'test-audit.js');

function project(prefix, files) {
    const dir = tmp(prefix);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    }
    return dir;
}

const JS = {
    'tests/helper.js': 'module.exports = (n) => n + 1;\n',
    'tests/stale.test.js': [
        "const test = require('node:test');",
        "const helper = require('./gone.js');",
        "test('uses a module that is gone', () => helper(1));",
        '',
    ].join('\n'),
    'tests/one.test.js': [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "const helper = require('./helper');",
        "test('adds one', () => {",
        '    assert.equal(helper(1), 2);',
        '});',
        "test('adds two', () => {",
        '    assert.equal(helper(2), 3);',
        '});',
        '',
    ].join('\n'),
    'tests/two.test.js': [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "const helper = require('./helper.js');",
        "test('adds one again', async () => {",
        '  assert.equal( helper(1),2 );',
        '});',
        '',
    ].join('\n'),
    'node_modules/pkg/x.test.js': "require('./nowhere.js');\n",
    '.cache/y.test.js': "require('./nowhere.js');\n",
};

test('the proof: a test importing a missing module and two tests with one body are both listed, and exit is 0', () => {
    const dir = project('fankeel-test-audit-proof-', JS);
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, [
        'tests/stale.test.js:2 — stale: ./gone.js resolves to nothing',
        'tests/two.test.js:4 — duplicate of tests/one.test.js:4',
        'test-audit: 1 stale, 1 duplicate',
        '',
    ].join('\n'));
    for (const rel of Object.keys(JS)) assert.ok(fs.existsSync(path.join(dir, rel)), rel + ' was deleted');
});

test('python: a relative import and a local package\'s missing module are stale, a standard one is not, and def bodies compare', () => {
    const dir = project('fankeel-test-audit-py-', {
        'pkg/__init__.py': '',
        'pkg/present.py': 'value = 1\n',
        'tests/test_calc.py': [
            'from .gone import thing',
            'import pkg.missing',
            'import os',
            'from pkg import present',
            '',
            'def test_one():',
            '    assert present.value == 1',
            '',
            'def test_two():',
            '    assert   present.value == 1',
            '',
            'def test_three(): assert present.value == 2',
            '',
        ].join('\n'),
    });
    assert.deepEqual(scan(dir), {
        stale: [
            { file: 'tests/test_calc.py', line: 1, why: '.gone resolves to nothing' },
            { file: 'tests/test_calc.py', line: 2, why: 'pkg.missing resolves to nothing' },
        ],
        duplicate: [{ file: 'tests/test_calc.py', line: 9, of: 'tests/test_calc.py:6' }],
    });
});

test('a call or an import inside a string, or a paren inside a regex, is not read as code', () => {
    const dir = project('fankeel-test-audit-strings-', {
        'tests/strings.test.js': [
            "const test = require('node:test');",
            "const src = \"require('./nowhere.js')\";",
            "test('a', () => src + \"test('x', () => { same(); })\");",
            "test('b', () => src.length + \"test('y', () => { same(); })\");",
            "test('c', () => assert.match('(', /\\(/));",
            "test('e', () => { twice(); });",
            "test('f', () => { twice(); });",
            '',
        ].join('\n'),
    });
    assert.deepEqual(scan(dir), {
        stale: [],
        duplicate: [{ file: 'tests/strings.test.js', line: 7, of: 'tests/strings.test.js:6' }],
    });
});

test('whitespace inside a string literal tells two bodies apart, indentation does not', () => {
    const dir = project('fankeel-test-audit-literal-', {
        'tests/lit.test.js': [
            "const test = require('node:test');",
            "test('two spaces', () => { same('  '); });",
            "test('empty', () => { same(''); });",
            "test('tpl a', () => { same(`a b`); });",
            "test('tpl b', () => { same(`ab`); });",
            "test('indented', () => {",
            '        same(1);',
            '});',
            "test('flat', () => { same(1); });",
            '',
        ].join('\n'),
        'tests/test_lit.py': [
            'def test_a():',
            "    assert f(' ') == 1",
            '',
            'def test_b():',
            "    assert f('') == 1",
            '',
            'def test_c():',
            '    assert   g() == 1',
            '',
            'def test_d():',
            '    assert g() == 1',
            '',
        ].join('\n'),
    });
    assert.deepEqual(scan(dir).duplicate, [
        { file: 'tests/lit.test.js', line: 9, of: 'tests/lit.test.js:6' },
        { file: 'tests/test_lit.py', line: 10, of: 'tests/test_lit.py:7' },
    ]);
});

test('in a git repository the files come from git, so an ignored test is not read', () => {
    const dir = project('fankeel-test-audit-git-', {
        '.gitignore': 'ignored/\n',
        'ignored/x.test.js': "require('./nowhere.js');\n",
        'tests/a.test.js': "require('./gone.js');\n",
    });
    execFileSync('git', ['init', '-q', dir]);
    assert.deepEqual(scan(dir).stale, [{ file: 'tests/a.test.js', line: 1, why: './gone.js resolves to nothing' }]);
});

test('bench/ holds deliberate control copies, so it is skipped with git and without', () => {
    const files = {
        'bench/a/pass/x.test.js': "require('./gone.js');\n",
        'tests/a.test.js': "require('./gone.js');\n",
    };
    const plain = project('fankeel-test-audit-bench-', files);
    assert.deepEqual(scan(plain).stale.map((s) => s.file), ['tests/a.test.js']);
    const repo = project('fankeel-test-audit-bench-git-', files);
    execFileSync('git', ['init', '-q', repo]);
    assert.deepEqual(scan(repo).stale.map((s) => s.file), ['tests/a.test.js']);
});

test('the CLI on a root that does not exist exits 2 with a stderr line, not a clean zero', () => {
    const dir = path.join(tmp('fankeel-test-audit-missing-'), 'no-such-dir');
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /test-audit: cannot read .*no-such-dir/);
    assert.equal(r.stdout, '');
});

// The audit skill's code half is where an optional scanner is named — css-dead.js
// is the precedent — on a line of its own, so `--root` is checked against this
// script's options rather than attributed to no script.
test('the audit skill names test-audit.js in its code half, on its own line', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-audit', 'SKILL.md'), 'utf8');
    const half = /The code half of the same fortnightly pass[\s\S]*?(?=\r?\n\r?\n\*\*Where the host opens it)/.exec(skill);
    assert.ok(half, 'the code-half paragraph is not where this test looks for it');
    assert.match(half[0], /\n`node <plugin>\/scripts\/test-audit\.js \[--root <dir>\]` lists stale and duplicate tests, deleting none\.$/);
});
