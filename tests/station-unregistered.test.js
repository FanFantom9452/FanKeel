'use strict';
// station-57 (docs/90-agent/judgements/2026-10-26-station-desktop-rc-sessions.md):
// a running session no registry lists — a Desktop tab, a terminal that never
// ran /fankeel — reaches the page as an unregistered row, a registered row
// says whether Remote Control is attached, and station.hide still holds for a
// session inside a hidden project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const REG = '11111111-0000-4000-8000-00000000000a';
const UNREG = '22222222-0000-4000-8000-00000000000b';
const S = (model) => JSON.parse(station.serialize(model, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));

function machine() {
    const base = tmp('fankeel-station-unreg-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const root = path.join(base, 'ws');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    registry.writeSession(root, REG, { task: 't', stage: 'build', route: ['build'], active: true, started: now, updated: now });
    const elsewhere = path.join(base, 'Quick-IME');
    fs.mkdirSync(elsewhere);
    // Two liveness files under one running pid's name each: the test process
    // is the only pid sure to be alive, so each file names it.
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: UNREG, cwd: elsewhere, startedAt: Date.now(), entrypoint: 'claude-desktop', name: 'Quick-IME', status: 'idle', bridgeSessionId: 'session_01x',
    }));
    fs.writeFileSync(path.join(cfg, 'sessions', 'reg.json'), JSON.stringify({ pid: process.pid, sessionId: REG, cwd: root, startedAt: Date.now(), bridgeSessionId: 'session_01y' }));
    return { cfg, root, elsewhere };
}

test('gather lists the running session no registry knows, and only that one', () => {
    const m = machine();
    const model = station.gather({ configDir: m.cfg, roots: [m.root], details: false });
    assert.deepEqual(model.unregistered.map((u) => u.sessionId), [UNREG]);
    const u = model.unregistered[0];
    assert.equal(u.cwd, m.elsewhere);
    assert.equal(u.entrypoint, 'claude-desktop');
    assert.equal(u.bridge, true);
});

test('serialize carries it, and a registered row says Remote Control is attached', () => {
    const m = machine();
    const data = S(station.gather({ configDir: m.cfg, roots: [m.root], details: false }));
    assert.deepEqual(data.unregistered.map((u) => [u.id, u.name, u.entrypoint, u.bridge]), [[UNREG, 'Quick-IME', 'claude-desktop', true]]);
    assert.equal(data.sessions.find((s) => s.id === REG).bridge, true);
});

test('an unregistered session inside a hidden project stays off the page; one outside every profile shows', () => {
    const root = path.join('C:', 'fake', 'root1');
    const model = {
        generatedAt: new Date(0).toISOString(), configDir: '', pricesVerified: 'n/a', scanStats: null,
        machineProfile: { values: {}, sources: {}, unreadable: [] },
        registries: [{ root, gone: false, unreadable: 0, build: [], mapAt: null, sessions: [],
            profiles: { [path.join(root, 'hidden-project')]: { values: { 'station.hide': true }, sources: {}, unreadable: [] } } }],
        unregistered: [
            { sessionId: 'in-hidden', cwd: path.join(root, 'hidden-project', 'sub'), entrypoint: 'cli', name: '', status: 'busy', bridge: false, startedAt: 1 },
            { sessionId: 'elsewhere', cwd: path.join('C:', 'other'), entrypoint: 'cli', name: '', status: 'idle', bridge: false, startedAt: 2 },
        ],
    };
    assert.deepEqual(S(model).unregistered.map((u) => u.id), ['elsewhere']);
});
