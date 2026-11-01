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

test('in a git repository the files come from git, so an ignored test is not read', () => {
    const dir = project('fankeel-test-audit-git-', {
        '.gitignore': 'ignored/\n',
        'ignored/x.test.js': "require('./nowhere.js');\n",
        'tests/a.test.js': "require('./gone.js');\n",
    });
    execFileSync('git', ['init', '-q', dir]);
    assert.deepEqual(scan(dir).stale, [{ file: 'tests/a.test.js', line: 1, why: './gone.js resolves to nothing' }]);
});

test('the CLI on a root that does not exist exits 2 with a stderr line, not a clean zero', () => {
    const dir = path.join(tmp('fankeel-test-audit-missing-'), 'no-such-dir');
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /test-audit: cannot read .*no-such-dir/);
    assert.equal(r.stdout, '');
});
