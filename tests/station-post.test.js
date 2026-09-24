'use strict';
// Every POST route serve() answers, and the refusals each one gives. Split out of station-cli.test.js on 2026-09-24.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;
// A pid no operating system hands out, the same constant `tests/carry.test.js`
// uses for one that is gone.
const GONE_PID = 2147483646;

function fixture() {
    const base = tmp('fankeel-station-cli-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    badge.writeLead(cfg, STALE, { word: 'design', root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    // Seeded so the CLI never sees "no roots.json at all" here: these three
    // tests exercise the ordinary write path, not the once-only auto-scan,
    // and an unseeded config dir would make every one of them spend the
    // auto-scan's own budget walking this machine's real drives.
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify({ [path.resolve(r1)]: at(now) }, null, 2) + '\n');
    return { base, cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});


const CS_LIVE = 'aaaaaaaa-9999-4999-8999-999999999991';
const CS_OLD_A = 'bbbbbbbb-9999-4999-8999-999999999992';
const CS_OLD_B = 'bbbbbbbb-9999-4999-8999-999999999993';
const CS_FRESH = 'cccccccc-9999-4999-8999-999999999994';

// Two stages old and one live, with an optional recently-touched fourth row —
// `clearEntry`'s age rule (`STALE_MS`, twelve hours) is independent of the
// station's own `stale` classification (not running), so a row can read
// `stale` on the page and still be too fresh for `/clear-stale` to touch
// without `force`. `withFresh` is what exercises that gap.
function clearStaleFixture(withFresh) {
    const base = tmp('fankeel-clear-stale-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, CS_LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - DAY), updated: at(now - DAY), configDir: cfg });
    registry.writeSession(r1, CS_OLD_A, { task: 'old-a', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 30 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, CS_OLD_B, { task: 'old-b', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 30 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    if (withFresh) {
        registry.writeSession(r1, CS_FRESH, { task: 'fresh', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
            started: at(now - 5 * 60e3), updated: at(now - 5 * 60e3), configDir: cfg });
    }
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: CS_LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1 };
}

test('POST /clear-stale clears every stale row in one registry', async () => {
    const f = clearStaleFixture(false);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce }));
        assert.equal(res.status, 303);
        // The count travels in the redirect rather than in a body this response
        // does not have: a bare `303 → /` said nothing about what it had done,
        // and the design asks the route to report how many it cleared.
        assert.equal(res.headers.location, '/?cleared=2');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false, 'the first stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false, 'the second stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_LIVE).active, true, 'the live row is untouched');
        // And the data the shell fetches next says so, which is the half a
        // redirect cannot do by itself.
        const after = await request(s.url + 'station/station-data.js?cleared=2', { method: 'GET' });
        assert.equal(after.status, 200);
        assert.match(after.text, /"cleared":2/);
        const plain = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.ok(!plain.text.includes('"cleared"'),
            'data loaded without the query says nothing about clearing');
        const junk = await request(s.url + 'station/station-data.js?cleared=lots', { method: 'GET' });
        assert.ok(!junk.text.includes('"cleared"'),
            'a non-numeric count is ignored rather than echoed into the data');
    } finally {
        s.close();
    }
});

test('POST /clear-stale refuses without the nonce', async () => {
    const f = clearStaleFixture(false);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce: 'wrong' }));
        assert.equal(res.status, 403);
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, true, 'nothing changed');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, true, 'nothing changed');
    } finally {
        s.close();
    }
});

test('POST /clear-stale reports the rows it refused', async () => {
    const f = clearStaleFixture(true);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce }));
        assert.equal(res.status, 409);
        assert.match(res.text, /cleared 2; refused 1/);
        assert.match(res.text, new RegExp(CS_FRESH + ': fresh'));
        assert.equal(registry.readSession(f.r1, CS_FRESH).active, true, 'the fresh row is refused, not force-cleared');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false, 'an old row is still cleared alongside a refusal');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false);
    } finally {
        s.close();
    }
});

test('POST /clear-stale clears a too-fresh row when force is sent', async () => {
    const f = clearStaleFixture(true);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce, force: '1' }));
        assert.equal(res.status, 303, 'force lets the whole batch clear rather than reporting a refusal');
        assert.equal(res.headers.location, '/?cleared=3', 'all three, the too-fresh one included');
        assert.equal(registry.readSession(f.r1, CS_FRESH).active, false, 'the too-fresh row is cleared when force is sent');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false);
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false);
    } finally {
        s.close();
    }
});

test('POST /profile writes a project key, refuses a bad nonce, a bad key, and an unknown project', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        assert.match(data.text, /"profiles":\{"machine":/);
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce: 'wrong' }))).status, 403);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'colour', value: 'blue', nonce }))).status, 400);
        assert.equal((await post(form({ scope: 'project', project: path.join(f.base, 'nowhere'), key: 'land.push', value: 'false', nonce }))).status, 404);
        const ok = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce }));
        assert.equal(ok.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.r1, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
        // Two pairs, the second invalid: validated before either is written, so
        // the first pair's value must not land even though it is well formed.
        // `value: 'true'` here (the file on disk already says `false`) is what
        // makes a landed first pair visible — reusing `false` would leave the
        // file looking untouched whether or not it actually was.
        const twoPairs = new URLSearchParams([['nonce', nonce], ['scope', 'project'], ['project', f.r1],
            ['key', 'land.push'], ['value', 'true'], ['key', 'colour'], ['value', 'blue']]);
        assert.equal((await post(twoPairs.toString())).status, 400);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.r1, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
        const machine = await post(form({ scope: 'machine', key: 'guard', value: 'deny', nonce }));
        assert.equal(machine.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.cfg, 'fankeel', 'profile.json'), 'utf8')), { guard: 'deny' });
        const after = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.match(after.text, /"land\.push":false/);
        assert.match(after.text, /"guard":"deny"/);
    } finally {
        s.close();
    }
});

test('POST /profile goes back to the hash it was sent from, and only to a hash', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        const back = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce, back: '#/settings' }));
        assert.equal(back.status, 303);
        assert.equal(back.headers.location, '/#/settings');
        const away = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'true', nonce, back: 'https://example.com/' }));
        assert.equal(away.status, 303);
        assert.equal(away.headers.location, '/', 'a back that is not a hash on this page is ignored');
        const none = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce }));
        assert.equal(none.headers.location, '/');
    } finally {
        s.close();
    }
});


// --- the seven refusals no test reached ---

// On 2026-09-14 the seven replies `scripts/station.js` had just moved onto
// `fail()` were renumbered 491-497 and every test stayed green. Each test
// below reaches one of them. `served()` binds a server for `f`, reads the
// per-run nonce the way the tests above do, and posts forms that carry it.
async function served(f) {
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    let nonce;
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
    } catch (e) {
        s.close();
        throw e;
    }
    const post = (route, fields) => request(s.url + route,
        { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
        new URLSearchParams({ nonce, ...fields }).toString());
    return { s, post, nonce };
}

test('GET /station/station.css answers 404 when the asset cannot be read', async (t) => {
    const f = fixture();
    const { s } = await served(f);
    try {
        // `scripts/station.js` reads the asset through the same cached
        // `node:fs` this file required, at request time, so failing that one
        // read stands in for an unreadable assets directory without touching
        // the real one.
        const realRead = fs.readFileSync;
        t.mock.method(fs, 'readFileSync', (p, ...rest) => {
            if (path.basename(String(p)) === 'station.css') throw new Error('EACCES: permission denied');
            return realRead(p, ...rest);
        });
        const res = await request(s.url + 'station/station.css', { method: 'GET' });
        assert.equal(res.status, 404);
        assert.match(res.headers['content-type'], /text\/plain/);
        assert.equal(res.text, 'no such asset\n');
    } finally {
        s.close();
    }
});

test('POST /clear answers 404 for a session not on the page', async () => {
    const f = fixture();
    const { s, post } = await served(f);
    try {
        const res = await post('clear', { root: f.r1, id: 'dddddddd-4444-4444-8444-444444444444' });
        assert.equal(res.status, 404);
        assert.equal(res.text, 'no such session on this page\n');
        assert.equal(registry.readSession(f.r1, STALE).active, true, 'nothing else was cleared');
    } finally {
        s.close();
    }
});

test('POST /clear answers 409 with the reason when clearEntry refuses a too-fresh row', async () => {
    const f = clearStaleFixture(true);
    const { s, post } = await served(f);
    try {
        // Not running, so the page reads it `stale` and the live-row check
        // passes; five minutes old, so `clearEntry`'s twelve-hour rule refuses.
        const res = await post('clear', { root: f.r1, id: CS_FRESH });
        assert.equal(res.status, 409);
        assert.match(res.text, /^not cleared: fresh\b/);
        assert.equal(registry.readSession(f.r1, CS_FRESH).active, true, 'the fresh row is refused, not cleared');
    } finally {
        s.close();
    }
});

test('POST /clear-stale answers 404 for a registry not on the page', async () => {
    const f = clearStaleFixture(false);
    const { s, post } = await served(f);
    try {
        const res = await post('clear-stale', { root: path.join(f.base, 'nowhere') });
        assert.equal(res.status, 404);
        assert.equal(res.text, 'no such registry on this page\n');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, true, 'nothing was cleared');
    } finally {
        s.close();
    }
});

test('POST /profile answers 400 for a scope that is neither project nor machine', async () => {
    const f = fixture();
    const { s, post } = await served(f);
    try {
        const res = await post('profile', { scope: 'workspace', key: 'land.push', value: 'false' });
        assert.equal(res.status, 400);
        assert.equal(res.text, 'scope is project or machine\n');
    } finally {
        s.close();
    }
});

test('POST /profile answers 400 when no key/value pair is sent', async () => {
    const f = fixture();
    const { s, post } = await served(f);
    try {
        const res = await post('profile', { scope: 'machine' });
        assert.equal(res.status, 400);
        assert.equal(res.text, 'key and value come in pairs\n');
    } finally {
        s.close();
    }
});

test('POST /profile answers 409 with the reason when the project profile does not parse', async () => {
    const f = fixture();
    const { s, post } = await served(f);
    try {
        const file = path.join(f.r1, '.fankeel', 'profile.json');
        fs.writeFileSync(file, 'not json');
        const res = await post('profile', { scope: 'project', project: f.r1, key: 'land.push', value: 'false' });
        assert.equal(res.status, 409);
        assert.match(res.text, /does not parse; fix it by hand first\n$/);
        assert.equal(fs.readFileSync(file, 'utf8'), 'not json', 'the unreadable file is left for a person');
    } finally {
        s.close();
    }
});

test('POST /profile takes a stage list and an empty value clears a key; the data carries the presets', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        assert.match(data.text, /"profilePresets":\{"manual":/);
        const file = path.join(f.r1, '.fankeel', 'profile.json');
        const post = (pairs) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            new URLSearchParams([['nonce', nonce], ['scope', 'project'], ['project', f.r1]].concat(pairs)).toString());
        // The page offers a project's own stage list back as the selected option,
        // so sending it back unchanged has to be accepted.
        assert.equal((await post([['key', 'stage.agents'], ['value', 'survey,build,verify']])).status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'stage.agents': ['survey', 'build', 'verify'] });
        // A preset is several pairs in one request; an empty value removes that key from this file.
        assert.equal((await post([['key', 'land.push'], ['value', 'false'], ['key', 'stage.agents'], ['value', '']])).status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'land.push': false });
        assert.equal((await post([['key', 'stage.agents'], ['value', 'survey,nope']])).status, 400);
    } finally {
        s.close();
    }
});

// A profile form posts pairs and a preset posts several in one request, so a
// test needs the same request to carry a key more than once; `served()` above
// takes an object and cannot.
async function servedPairs(f) {
    const { s, nonce } = await served(f);
    const post = (pairs, scope) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
        new URLSearchParams([['nonce', nonce], ['scope', scope || 'project'], ['project', f.r1]].concat(pairs)).toString());
    return { s, post };
}

test('POST /profile clears every enum key with an empty value, as the manual preset sends them', async () => {
    const f = fixture();
    const file = path.join(f.r1, '.fankeel', 'profile.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true, 'class.default': 'spike', guard: 'deny' }) + '\n');
    const { s, post } = await servedPairs(f);
    try {
        // `land.push` and its neighbours have no empty form of their own, so the
        // empty value has to be let through by the route rather than by parseValue.
        const res = await post([['key', 'land.integration'], ['value', ''], ['key', 'land.push'], ['value', ''],
            ['key', 'land.archivePlan'], ['value', ''], ['key', 'class.default'], ['value', ''],
            ['key', 'guard'], ['value', 'ask'], ['key', 'stage.agents'], ['value', 'false']]);
        assert.equal(res.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guard: 'ask', 'stage.agents': [] });
    } finally {
        s.close();
    }
});

test('POST /profile refuses an empty value for a key that does not exist, before any pair is written', async () => {
    const f = fixture();
    const file = path.join(f.r1, '.fankeel', 'profile.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'land.push': false }) + '\n');
    const before = fs.readFileSync(file, 'utf8');
    const { s, post } = await servedPairs(f);
    try {
        // The first pair is well formed and would change the file; the second is a
        // clear of a name that is no key, and nothing may have landed when it answers.
        assert.equal((await post([['key', 'land.push'], ['value', 'true'], ['key', 'colour'], ['value', '']])).status, 400);
        assert.equal(fs.readFileSync(file, 'utf8'), before);
    } finally {
        s.close();
    }
});

test('POST /profile with scope machine clears a key from the machine file and leaves the project file alone', async () => {
    const f = fixture();
    const project = path.join(f.r1, '.fankeel', 'profile.json');
    const machine = profile.machineFile(f.cfg);
    fs.mkdirSync(path.dirname(project), { recursive: true });
    fs.writeFileSync(project, JSON.stringify({ guard: 'deny', 'land.push': false }) + '\n');
    fs.writeFileSync(machine, JSON.stringify({ guard: 'deny', 'land.push': true }) + '\n');
    const before = fs.readFileSync(project, 'utf8');
    const { s, post } = await servedPairs(f);
    try {
        assert.equal((await post([['key', 'guard'], ['value', '']], 'machine')).status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(machine, 'utf8')), { 'land.push': true });
        assert.equal(fs.readFileSync(project, 'utf8'), before);
    } finally {
        s.close();
    }
});

test('POST /profile answers 400 for a name every object has, not only for one the table lacks', async () => {
    const f = fixture();
    const file = path.join(f.r1, '.fankeel', 'profile.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'land.push': false }) + '\n');
    const before = fs.readFileSync(file, 'utf8');
    const { s, post } = await servedPairs(f);
    try {
        // `KEYS.constructor` is a function, so a truthiness test lets an empty
        // value through and the route answers 303 having done nothing.
        for (const name of ['constructor', 'toString', '__proto__']) {
            assert.equal((await post([['key', name], ['value', '']])).status, 400, name);
        }
        assert.equal(fs.readFileSync(file, 'utf8'), before);
    } finally {
        s.close();
    }
});
