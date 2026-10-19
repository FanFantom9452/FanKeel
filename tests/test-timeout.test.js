'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

test('both suite scripts bound a single test and exit when the tests are done', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).scripts;
    for (const name of ['test', 'test:fast']) {
        const m = /--test-timeout=(\d+)/.exec(scripts[name]);
        assert.ok(m, name + ' has no --test-timeout');
        assert.ok(Number(m[1]) >= 60000 && Number(m[1]) <= 600000, name + ' timeout ' + m[1]);
        assert.match(scripts[name], /--test-force-exit/, name);
    }
});

test('an async test that never ends goes red within the timeout and the run exits', () => {
    const dir = tmp('fankeel-test-timeout-');
    const file = path.join(dir, 'hangs.test.js');
    fs.writeFileSync(file, "const test = require('node:test');\n"
        + "test('hangs', () => new Promise(() => { setInterval(() => {}, 1000); }));\n");
    // a child run inside a test inherits NODE_TEST_CONTEXT and then skips its files
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const started = Date.now();
    const r = spawnSync(process.execPath, ['--test', '--test-timeout=500', '--test-force-exit', file], { encoding: 'utf8', timeout: 60000, env });
    assert.equal(r.error, undefined, 'the run itself hung');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /timed out|cancelled/i);
    assert.ok(Date.now() - started < 30000);
});
