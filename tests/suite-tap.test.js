'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const suite = require('../lib/suite.js');
const tmp = require('./tmp.js');

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };

function repo(body) {
    const dir = tmp('fankeel-suite-tap-');
    const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git(['init', '-q']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 'T']);
    fs.writeFileSync(path.join(dir, 'a.test.js'), body);
    git(['add', '-A']);
    git(['commit', '-qm', 'first']);
    return dir;
}

test('a red run writes suite.tap with the not ok block; a green run removes it @slow', () => {
    const dir = repo("require('node:test')('a', () => { throw new Error('boom 42'); });\n");
    const file = suite.record(dir, DATA, suite.runSuite(dir, 'node --test'));
    const tap = suite.tapPath(file);
    assert.match(fs.readFileSync(tap, 'utf8'), /not ok \d+ - a[\s\S]*boom 42/);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).stdout, undefined, 'the TAP stays out of suite.json');
    fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => {});\n");
    suite.record(dir, DATA, suite.runSuite(dir, 'node --test'));
    assert.equal(fs.existsSync(tap), false);
});
