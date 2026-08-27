'use strict';

// Two facts about this repository's own source that no behavioural test would
// catch, because neither one changes what anything does. Both were found by
// reading rather than by running, and both grow back without a word.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

const tracked = () =>
    execFileSync('git', ['ls-files', '*.js'], { cwd: ROOT, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);

// A raw NUL byte anywhere in a text file makes grep call the whole file binary
// and print "Binary file ... matches" instead of the line; ripgrep drops it from
// a directory search without saying anything at all. The file keeps working. It
// just stops being findable, which is why nobody noticed.
test('no source file holds a NUL byte', () => {
    const guilty = tracked().filter((rel) => fs.readFileSync(path.join(ROOT, rel)).includes(0));
    assert.deepEqual(guilty, [], 'grep and ripgrep read these as binary');
});

// An exported name nobody imports is not dead code — the function behind it is
// almost always still called inside its own file. It is a dead *name*, and what
// it costs is the interface: a module that exports thirty names of which twelve
// have no caller stops telling anyone which parts of it are load-bearing.
//
// A name reached only by a test counts as used. Exporting a private helper so a
// unit test can reach it is a deliberate choice and a common one; the thing this
// guards against is the name exported for nobody.
test('every exported name is used outside the file that exports it', () => {
    const files = tracked();
    const bodies = new Map(files.map((rel) => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')]));
    const orphans = [];

    for (const rel of files) {
        if (rel.startsWith('tests/')) continue;
        const block = bodies.get(rel).match(/module\.exports\s*=\s*\{([\s\S]*?)\n?\};?\s*$/);
        if (!block) continue;
        for (const raw of block[1].split(',')) {
            const name = raw.trim().split(':')[0].trim();
            if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
            const word = new RegExp('\\b' + name + '\\b');
            const used = files.some((other) => other !== rel && word.test(bodies.get(other)));
            if (!used) orphans.push(rel + ' — ' + name);
        }
    }

    assert.deepEqual(orphans, [], 'exported, and imported by nothing');
});
