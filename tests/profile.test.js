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

test('station.hide refuses an illegal value and accepts true', () => {
    const d = dir();
    const file = profile.projectFile(d);
    assert.equal(profile.write(file, 'station.hide', 'maybe').ok, false);
    assert.equal(profile.write(file, 'station.hide', 'true').ok, true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))['station.hide'], true);
});

// `stage.agents` used to be a plain boolean; it is an array of controlled
// stage names now, so its builtin off position is `[]` rather than `false`,
// and `true` still normalizes to `['survey']` — every doc and the A/B mean
// survey by `true`, so that backward-compatible reading has to survive.
test('stage.agents is [] unless a profile turns it on; true still means survey alone', () => {
    const projectRoot = tmp('fankeel-profile-agents-');
    const cfg = tmp('fankeel-profile-cfg-');
    assert.deepEqual(profile.read(projectRoot, cfg).values['stage.agents'], []);
    fs.mkdirSync(path.join(projectRoot, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
    assert.deepEqual(profile.read(projectRoot, cfg).values['stage.agents'], ['survey']);
});

// The row this task adds: `all`, and a comma list of stages normalized to
// `lib/stages.js`'s own order regardless of what order or how many repeats
// arrived, so two profiles naming the same set always compare equal.
test('stage.agents accepts a comma list of stages, normalized to canonical order and deduped', () => {
    const d = dir();
    const file = profile.projectFile(d);
    const out = profile.write(file, 'stage.agents', 'verify,survey,build,survey');
    assert.equal(out.ok, true);
    assert.deepEqual(out.value, ['survey', 'build', 'verify']);
    assert.deepEqual(profile.read(d, null).values['stage.agents'], ['survey', 'build', 'verify']);
});

test('stage.agents all is every canonical stage, reused from lib/stages.js rather than retyped', () => {
    const { FULL_ROUTE } = require('../lib/stages.js');
    const d = dir();
    const out = profile.write(profile.projectFile(d), 'stage.agents', 'all');
    assert.equal(out.ok, true);
    assert.deepEqual(out.value, FULL_ROUTE);
});

test('stage.agents rejects an unknown stage name in the same error shape as any other bad value', () => {
    const d = dir();
    // The exact shape every other bad value in this file returns —
    // `key + ' is one of: ' + values.join(', ')`, which the `guard` test a
    // few lines up pins with `/guard is one of/` — not a message naming the
    // bad token, which none of this file's other refusals do either.
    const EXPECTED = 'stage.agents is one of: false, true, all, or a comma-separated list of: survey, design, plan, build, verify, audit, land';
    const unknown = profile.write(profile.projectFile(d), 'stage.agents', 'survey,orbital');
    assert.equal(unknown.ok, false);
    assert.equal(unknown.reason, EXPECTED);

    // A comma list with nothing left after trimming empty pieces shares the
    // same refusal rather than a shape of its own.
    const empty = profile.write(profile.projectFile(d), 'stage.agents', ',,,');
    assert.equal(empty.ok, false);
    assert.equal(empty.reason, EXPECTED);
});

test('dispatch.floor and judge.model accept haiku as a cheap judge', () => {
    assert.equal(profile.write(profile.projectFile(dir()), 'dispatch.floor', 'haiku').ok, true);
    assert.equal(profile.write(profile.projectFile(dir()), 'judge.model', 'haiku').ok, true);
});

test('parseValue is exported, and false/true are the array stage.agents means them as', () => {
    assert.deepEqual(profile.parseValue('stage.agents', 'false').value, []);
    assert.deepEqual(profile.parseValue('stage.agents', 'true').value, ['survey']);
});

test('every key carries a one-line description', () => {
    for (const [key, spec] of Object.entries(profile.KEYS)) {
        assert.equal(typeof spec.desc, 'string', key);
        assert.ok(spec.desc.length > 0 && !spec.desc.includes('\n'), key + ' needs a one-line desc');
    }
});

test('a preset only sets keys that exist, to values the table accepts', () => {
    assert.deepEqual(Object.keys(profile.PRESETS), ['manual', 'balanced', 'lean']);
    for (const [id, preset] of Object.entries(profile.PRESETS)) {
        assert.ok(preset.label && preset.blurb, id + ' needs a label and a blurb');
        for (const [key, value] of Object.entries(preset.set)) {
            assert.ok(profile.KEYS[key], id + ' sets an unknown key: ' + key);
            if (value !== null) assert.ok(!profile.parseValue(key, value).error, id + ' sets ' + key + ' to a value the table refuses: ' + value);
        }
    }
});

test('unset removes one key from one file and leaves the rest', () => {
    const file = path.join(dir(), 'profile.json');
    profile.write(file, 'land.push', 'false');
    profile.write(file, 'guard', 'deny');
    assert.equal(profile.unset(file, 'land.push').ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guard: 'deny' });
    assert.equal(profile.unset(file, 'class.default').ok, true, 'a key that is not there is not an error');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guard: 'deny' });
});

test('unset never creates a file, refuses an unknown key, and names a file that does not parse', () => {
    const file = path.join(dir(), 'profile.json');
    assert.equal(profile.unset(file, 'land.push').ok, true);
    assert.equal(fs.existsSync(file), false);
    assert.equal(profile.unset(file, 'nope').ok, false);
    fs.writeFileSync(file, '{ not json');
    assert.equal(profile.unset(file, 'land.push').ok, false);
});

test('display is the one text a value prints as', () => {
    assert.equal(profile.display(undefined), '(ask)');
    assert.equal(profile.display([]), 'false');
    assert.equal(profile.display(['survey', 'build', 'verify']), 'survey,build,verify');
    assert.equal(profile.display(false), 'false');
    assert.equal(profile.display('merge'), 'merge');
});

test('showLines pads each column to its longest cell and ends every line with the description', () => {
    const lines = profile.showLines({ 'stage.agents': ['survey', 'build', 'verify'], guard: 'ask' }, { 'stage.agents': 'project', guard: 'builtin' });
    const keys = Object.keys(profile.KEYS);
    assert.equal(lines.length, keys.length);
    const agents = lines[keys.indexOf('stage.agents')];
    const wideKey = Math.max(...keys.map((k) => k.length));
    assert.ok(agents.startsWith('  ' + 'stage.agents'.padEnd(wideKey) + '  survey,build,verify  project  '), 'each column is as wide as its longest cell: ' + JSON.stringify(agents));
    assert.ok(agents.endsWith(profile.KEYS['stage.agents'].desc));
    const starts = new Set(lines.map((l, i) => l.length - profile.KEYS[keys[i]].desc.length));
    assert.equal(starts.size, 1, 'every description starts in the same column');
});

test('the three presets set exactly what the design says, and null is what clears', () => {
    assert.deepEqual(profile.PRESETS.manual.set, {
        'land.integration': null, 'land.push': null, 'land.archivePlan': null, 'class.default': null, guard: 'ask', 'stage.agents': 'false',
    });
    const habit = { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask' };
    assert.deepEqual(profile.PRESETS.balanced.set, Object.assign({}, habit, { 'stage.agents': 'survey' }));
    assert.deepEqual(profile.PRESETS.lean.set, Object.assign({}, habit, { 'stage.agents': 'survey,build,verify' }));
    assert.equal('class.default' in profile.PRESETS.balanced.set, false, 'balanced leaves class.default untouched');
});
