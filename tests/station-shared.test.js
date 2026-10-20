'use strict';
// serve()'s shared model and its holds (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// an ended session's detail answers from the shared gather, a registry write
// inside the window drops it, and an ended row is read once across gathers.
// Each test runs from its fixture's own directory: serve() also lists the
// registry under process.cwd(), and a live neighbour there could move the stamp.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const detail = require('../lib/detail.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'abababab-1212-4121-8121-121212121212';
const OTHER = 'cdcdcdcd-3434-4343-8343-343434343434';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => new Date(Date.now() - 600000 + s * 1000).toISOString();

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

// One ended session with a transcript, so it has a detail.
function fixture() {
    const base = tmp('fankeel-shared-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'shared', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: T(0), updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' } });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 }, content: [{ type: 'text', text: 'ok' }] } }));
    return { base, cfg, ws };
}

// A served fixture, with gather() calls counted from the moment serve() has bound.
async function served(t, extra) {
    const f = fixture();
    const was = process.cwd();
    process.chdir(f.base);
    const real = station.gather;
    let calls = 0;
    t.mock.method(station, 'gather', function (o) { calls++; return real.call(this, o); });
    const s = await serve(Object.assign({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false }, extra));
    calls = 0;
    t.after(() => { s.close(); process.chdir(was); });
    return { f, s, calls: () => calls };
}

test('an ended session\'s detail answers from the shared model', async (t) => {
    const { s, calls } = await served(t);
    assert.equal((await get(s.url + 'station/station-data.js')).status, 200);
    const d = await get(s.url + 'station/detail/' + SID + '.js');
    assert.equal(d.status, 200);
    assert.match(d.text, /^window\.STATION_DETAIL = /);
    assert.equal(calls(), 1, 'the detail route gathered on its own');
});

test('a registry write inside the window drops the shared model', async (t) => {
    const { f, s, calls } = await served(t, { memoMs: 60e3 });
    await get(s.url + 'station/station-data.js');
    registry.writeSession(f.ws, OTHER, { task: 'written after', stage: 'survey', route: ['survey'], active: false, claims: [],
        started: T(0), updated: T(1), configDir: f.cfg });
    const after = await get(s.url + 'station/station-data.js');
    assert.match(after.text, /written after/);
    assert.equal(calls(), 2);
});

test('an ended row is read once across the server\'s gathers', async (t) => {
    const { s } = await served(t, { memoMs: 0 });
    const spy = t.mock.method(detail, 'tasksOf');
    await get(s.url + 'station/station-data.js');
    await get(s.url + 'station/station-data.js');
    assert.equal(spy.mock.calls.filter((c) => c.arguments[1] && c.arguments[1].task === 'shared').length, 1);
});

// A live session's transcript and agents move without the registry moving, so
// its detail is gathered for the request rather than read off the shared model.
test('a live session\'s detail shows its transcript growing inside the shared window', async (t) => {
    const { f, s } = await served(t, { memoMs: 60e3 });
    registry.writeSession(f.ws, SID, { task: 'shared', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: T(0), updated: T(9), configDir: f.cfg });
    const sub = path.join(f.cfg, 'projects', 'ws-slug', SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const agent = path.join(sub, 'agent-a1b2c3.jsonl');
    const said = (n, content) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + n, timestamp: T(n),
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, content } });
    fs.writeFileSync(agent, line({ type: 'user', isSidechain: true, timestamp: T(3), message: { content: 'look' } })
        + said(4, [{ type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'F:/ws/lib/a.js' } }]));
    const url = s.url + 'station/detail/' + SID + '.js';
    assert.match((await get(url)).text, /ws\/lib\/a\.js/);
    fs.appendFileSync(agent, line({ type: 'user', isSidechain: true, timestamp: T(5),
        message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'x' }] } })
        + said(6, [{ type: 'tool_use', id: 'u2', name: 'Grep', input: { pattern: 'keyOf' } }]));
    assert.match((await get(url)).text, /Grep keyOf/);
});

// stampOf is taken before the gather: an entry a neighbour writes while it
// runs must not be recorded as already seen.
test('a registry write during a gather is seen by the next request', async (t) => {
    const { f, s } = await served(t, { memoMs: 60e3 });
    const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    await get(s.url + 'station/station-data.js');
    const write = (id, task) => registry.writeSession(f.ws, id, { task, stage: 'survey', route: ['survey'], active: false, claims: [],
        started: T(0), updated: T(1), configDir: f.cfg });
    const real = station.gather;
    t.mock.method(station, 'gather', function (o) {
        const model = real.call(this, o);
        pause();
        write(OTHER, 'written mid gather');
        return model;
    }, { times: 1 });
    pause();
    write('efefefef-5656-4565-8565-565656565656', 'written before');
    assert.match((await get(s.url + 'station/station-data.js')).text, /written before/);
    assert.match((await get(s.url + 'station/station-data.js')).text, /written mid gather/);
});
