'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';

test('gather and serialize both carry seen onto the page session', () => {
    const base = tmp('fankeel-station-seen-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const at = new Date().toISOString();
    registry.writeSession(r1, LIVE, { task: 'seen one', stage: 'build', route: ['survey', 'build'],
        active: true, claims: ['a.js'], seen: ['b.js'], started: at, updated: at, configDir: cfg });
    const m = station.gather({ configDir: cfg, roots: [r1] });
    const row = m.registries[0].sessions.find((s) => s.sessionId === LIVE);
    assert.deepEqual(row.seen, ['b.js']);
    const data = JSON.parse(station.serialize(m, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    const page = data.sessions.find((s) => s.id === LIVE);
    assert.deepEqual(page.seen, ['b.js']);
});

test('seenHtml marks the list weak, escapes it, and draws nothing for none', () => {
    assert.equal(V.seenHtml([]), '');
    assert.equal(V.seenHtml(undefined), '');
    const html = V.seenHtml(['lib/<x>.js']);
    assert.match(html, /seen（弱：git 看到，沒有經過 hook）/);
    assert.match(html, /lib\/&lt;x&gt;\.js/);
});
