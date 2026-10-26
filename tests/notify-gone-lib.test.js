'use strict';
// notify-1: the ntfy sender is gone — its module, its detached child — and
// nothing under lib/, scripts/ or hooks/ still names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('lib/notify.js and scripts/notify.js are gone', () => {
    assert.equal(fs.existsSync(path.join(ROOT, 'lib', 'notify.js')), false);
    assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'notify.js')), false);
});

test('no file under lib/, scripts/ or hooks/ names lib/notify.js or ntfy', () => {
    const named = [];
    for (const dir of ['lib', 'scripts', 'hooks']) {
        for (const f of fs.readdirSync(path.join(ROOT, dir))) {
            if (!/\.(js|ts)$/.test(f)) continue;
            const text = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
            if (/lib\/notify\.js|\bntfy\b/i.test(text)) named.push(dir + '/' + f);
        }
    }
    assert.deepEqual(named, []);
});
