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

test('a leading UTF-8 BOM does not make the file unreadable', () => {
    const d = dir();
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), '﻿' + JSON.stringify({ guard: 'deny' }));
    const { values, unreadable } = profile.read(d, null);
    assert.equal(values.guard, 'deny');
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
        'profile: land merge, no push — do that, say so, skip the menu');
    const s = profile.summary({ 'land.integration': 'merge', 'land.push': false, guard: 'ask', 'judge.model': 'opus' },
        { 'land.integration': 'project', 'land.push': 'project', guard: 'builtin', 'judge.model': 'machine' });
    assert.equal(s, 'land merge, no push · judge.model opus (machine)');
    assert.equal(profile.summary({ guard: 'ask' }, { guard: 'builtin' }), '');
});

test('judge.enabled is gone; judge.model stays', () => {
    const { values } = profile.read(dir(), null);
    assert.equal(values['judge.enabled'], undefined);
    assert.equal(values['judge.model'], 'fable');
});

test('design.mockup is both the switch and the model', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    // The builtin is the off position, and it survives read() as a boolean.
    const off = profile.read(d, cfg);
    assert.equal(off.values['design.mockup'], false);
    assert.equal(off.sources['design.mockup'], 'builtin');
    // A model name is the on position, and it is the value the rule names.
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'design.mockup': 'opus' }));
    const on = profile.read(d, cfg);
    assert.equal(on.values['design.mockup'], 'opus');
    assert.equal(on.sources['design.mockup'], 'project');
    // Anything outside the four is refused, not silently taken.
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'design.mockup': 'off' }));
    assert.equal(profile.read(d, cfg).values['design.mockup'], false);
});

test('summary names design.mockup once somebody sets it', () => {
    const values = { 'design.mockup': 'opus' };
    const sources = { 'design.mockup': 'project' };
    assert.match(profile.summary(values, sources), /design\.mockup opus/);
    assert.equal(profile.summary({ 'design.mockup': false }, { 'design.mockup': 'builtin' }), '');
});

test('class.default is a class name, and stays out of summary', () => {
    const d = dir();
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'class.default': 'bounded' }));
    const { values, sources } = profile.read(d, null);
    assert.equal(values['class.default'], 'bounded');
    assert.equal(sources['class.default'], 'project');
    assert.equal(profile.write(profile.projectFile(d), 'class.default', 'orbital').ok, false);
    assert.equal(profile.summary(values, sources).includes('class.default'), false);
});

test('suggest also counts this registry\'s own land records for the same project', () => {
    const d = dir();
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    const sessions = path.join(d, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    const write = (id, integration) => fs.writeFileSync(path.join(sessions, id + '.json'), JSON.stringify({
        task: 't', active: false, started: new Date().toISOString(), updated: new Date().toISOString(),
        land: { integration, at: new Date().toISOString() },
    }));
    write('11111111-0000-4000-8000-000000000001', 'pr');
    write('11111111-0000-4000-8000-000000000002', 'pr');
    write('11111111-0000-4000-8000-000000000003', 'pr');
    const out = profile.suggest(d, d);
    assert.equal(out.values['land.integration'], 'pr');
    assert.ok(out.evidence.some((e) => e.startsWith('land records:') && /3 pr/.test(e)));
});

test('suggest with no second argument behaves exactly as before', () => {
    const d = dir();
    const out = profile.suggest(d);
    assert.equal(out.evidence[0], 'not a git repository, or git is not on PATH');
});
