'use strict';
// station-39: the 快速設定 page's preselected answers. Each question carries
// `rec` when this project's git log, registry or profile says something and
// `author` when nothing does; these pin both sides of every inference the
// TODO entry named (sessions overlap, stage.agents, notify, front end, model.lang).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { suggestFor } = require('../lib/settingsuggest.js');
const tmp = require('./tmp.js');

const NOW = Date.now();
const HOUR = 3600e3;
const id = (i) => 'cccccccc-0000-4000-8000-00000000000' + i;
const at = (ms) => new Date(ms).toISOString();

function place() {
    const base = tmp('fankeel-suggest-');
    const dir = path.join(base, 'proj');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(cfg, { recursive: true });
    return { dir, cfg };
}
const flat = (recs) => Object.fromEntries(Object.entries(recs).map(([k, r]) => [k, r.o + '/' + r.src]));

test('with no record every question carries the author default', () => {
    const { dir, cfg } = place();
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, false);
    assert.equal(out.commitFormat, null);
    assert.deepEqual(flat(out.recs), {
        main: 'merge/author', push: 'false/author', sessions: 'some/author', inflight: '8/author', ctx: 'rw/author',
        lang: 'en/author', gates: 'survey/author', floor: 'sonnet/author', screen: 'false/author', where: 'term/author',
    });
});

test('five sessions open at once read as many, five in a row as one', () => {
    const { dir, cfg } = place();
    for (let i = 0; i < 5; i++) {
        registry.writeSession(dir, id(i), { task: 't' + i, stage: 'build', active: false, claims: [],
            started: at(NOW - 10 * HOUR + i * 60e3), updated: at(NOW - 8 * HOUR) });
    }
    const many = suggestFor(dir, dir, cfg, NOW).recs.sessions;
    assert.deepEqual({ o: many.o, src: many.src, peak: many.v.peak, n: many.v.n }, { o: 'many', src: 'rec', peak: 5, n: 5 });

    const other = place();
    for (let i = 0; i < 5; i++) {
        registry.writeSession(other.dir, id(i), { task: 't' + i, stage: 'build', active: false, claims: [],
            started: at(NOW - (20 - 2 * i) * HOUR), updated: at(NOW - (19 - 2 * i) * HOUR) });
    }
    const one = suggestFor(other.dir, other.dir, other.cfg, NOW).recs.sessions;
    assert.deepEqual({ o: one.o, src: one.src, peak: one.v.peak }, { o: 'one', src: 'rec', peak: 1 });
});

test('a front end, the project profile and the machine file move their answers to the record', () => {
    const { dir, cfg } = place();
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>x</p>\n');
    const pf = profile.projectFile(dir);
    for (const [k, v] of [['dispatch.floor', 'haiku'], ['model.lang', '繁體中文'], ['stage.agents', 'all'], ['design.mockup', 'auto'], ['dispatch.inflight', '6']]) {
        assert.ok(profile.write(pf, k, v).ok, k);
    }
    assert.ok(profile.write(profile.machineFile(cfg), 'notify.gate', 'true').ok);
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, true);
    const got = flat(out.recs);
    for (const [k, want] of Object.entries({ floor: 'haiku/rec', lang: 'zh/rec', ctx: 'all/rec', screen: 'auto/rec', inflight: '6/rec', where: 'away/rec' })) {
        assert.equal(got[k], want, k);
    }
});

test('dispatch.inflight is recommended as itself: 17 stays 17, unlimited stays unlimited', () => {
    for (const v of ['17', 'unlimited']) {
        const { dir, cfg } = place();
        assert.ok(profile.write(profile.projectFile(dir), 'dispatch.inflight', v).ok, v);
        const r = suggestFor(dir, dir, cfg, NOW).recs.inflight;
        assert.deepEqual({ o: r.o, src: r.src, now: r.v.now }, { o: v, src: 'rec', now: Number.isNaN(Number(v)) ? v : Number(v) }, v);
    }
});

test('a front end with no mockup setting preselects 有，每次先問我 from the author', () => {
    const { dir, cfg } = place();
    fs.writeFileSync(path.join(dir, 'app.css'), 'p{}\n');
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.front, true);
    assert.equal(flat(out.recs).screen, 'opus/author');
});

test('the commit format offered adds merge to the types the log used; no remote means no push', () => {
    const { dir, cfg } = place();
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q');
    for (const s of ['feat(a): one', 'fix(b): two', 'feat(c): three', 'docs: four', 'fix: five']) {
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', s);
    }
    const out = suggestFor(dir, dir, cfg, NOW);
    assert.equal(out.commitFormat, '^(docs|feat|fix|merge)(\\([^)]+\\))?: ');
    assert.equal(flat(out.recs).push, 'false/rec');
    assert.equal(out.recs.push.v.unpushed, 5);
});
