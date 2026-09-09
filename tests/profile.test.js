'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const dir = () => tmp('fankeel-profile-');

test('project beats machine beats builtin, per key', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'land.push': false }));
    fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'land.push': true, 'land.integration': 'merge', guard: 'deny' }));
    const { values, sources, unreadable } = profile.read(d, cfg);
    assert.equal(values['land.push'], false);
    assert.equal(sources['land.push'], 'project');
    assert.equal(values['land.integration'], 'merge');
    assert.equal(sources['land.integration'], 'machine');
    assert.equal(values.guard, 'deny');
    assert.equal(values['judge.model'], 'fable');
    assert.equal(sources['judge.model'], 'builtin');
    assert.equal(values['land.archivePlan'], undefined);
    assert.deepEqual(unreadable, []);
});

test('no files at all is the builtins, and a file that does not parse is named', () => {
    const d = dir();
    const none = profile.read(d, path.join(d, 'cfg'));
    assert.equal(none.values.guard, 'ask');
    assert.equal(none.values['land.integration'], undefined);
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), '{ not json');
    const bad = profile.read(d, null);
    assert.deepEqual(bad.unreadable, [profile.projectFile(d)]);
    assert.equal(bad.values.guard, 'ask');
});

test('write refuses an unknown key and an unknown value, and merges into the file', () => {
    const d = dir();
    const file = profile.projectFile(d);
    assert.equal(profile.write(file, 'colour', 'blue').ok, false);
    assert.match(profile.write(file, 'guard', 'maybe').reason, /guard is one of/);
    assert.equal(profile.write(file, 'land.push', 'false').ok, true);
    assert.equal(profile.write(file, 'guard', 'deny').ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'land.push': false, guard: 'deny' });
});

test('suggest reads three local merges and no remote as merge, no push, and writes nothing', () => {
    const d = dir();
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    for (let i = 0; i < 3; i++) {
        g('checkout', '-q', '-b', 'f' + i);
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'work ' + i);
        g('checkout', '-q', 'main');
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-ff', '-m', 'merge: f' + i, 'f' + i);
    }
    const out = profile.suggest(d);
    assert.equal(out.values['land.integration'], 'merge');
    assert.equal(out.values['land.push'], false);
    assert.match(out.evidence[0], /3 local, 0 pull request/);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('the two injected strings', () => {
    assert.match(profile.landClause({}), /no land answer/);
    assert.equal(profile.landClause({ 'land.integration': 'merge', 'land.push': false }),
        'the profile says merge, no push — do that, say so in one line, and do not open the menu');
    const s = profile.summary({ 'land.integration': 'merge', 'land.push': false, guard: 'ask', 'judge.model': 'opus' },
        { 'land.integration': 'project', 'land.push': 'project', guard: 'builtin', 'judge.model': 'machine' });
    assert.equal(s, 'land merge, no push · judge.model opus (machine)');
    assert.equal(profile.summary({ guard: 'ask' }, { guard: 'builtin' }), '');
});
