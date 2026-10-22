'use strict';
// lib/mobile.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §4):
// the three lists /station/mobile.json carries, read from the rows gather()
// builds and cut to what the phone draws, and the /m shell, manifest and icon.
const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../lib/mobile.js');

const NOW = Date.parse('2026-10-21T03:02:00.000Z');
const H = 3600e3;
const Q = [{ question: '核准這份 design？', multiSelect: false, options: [{ label: '核准，進 plan (Recommended)' }, { label: '改 mockup' }] }];
const row = (o) => Object.assign({
    sessionId: 's', task: 't', project: '', stage: 'build', route: ['survey', 'build'], state: 'live', updated: NOW - 60e3,
    ended: null, cost: null, agentCost: null, stages: [], pending: null, gateAt: null,
    claims: ['lib/private.js'], notes: ['private'],
}, o);
const model = (sessions) => ({ registries: [{ root: '/ws/fankeel', profiles: {}, sessions }] });
const waiting = (at, until) => ({ questions: Q, at, until });

test('gates: every held gate still inside its wait, oldest first, waited from when the question went out', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'b', stage: 'survey', task: 'TODO 全表盤點', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'a', stage: 'design', pending: waiting(NOW - 240e3, NOW + 60e3), gateAt: NOW - 250e3 }),
        row({ sessionId: 'over', pending: waiting(NOW - 900e3, NOW - 1) }),
        row({ sessionId: 'plain' }),
    ]), NOW, 'ymlab-pc');
    assert.equal(m.host, 'ymlab-pc');
    assert.equal(m.at, NOW);
    assert.deepEqual(m.gates.map((g) => g.id), ['a', 'b']);
    assert.deepEqual(m.gates[0], { id: 'a', root: '/ws/fankeel', task: 't', project: 'fankeel', stage: 'design', route: ['survey', 'build'], questions: Q, since: NOW - 250e3, until: NOW + 60e3 });
    assert.equal(m.gates[1].since, NOW - 60e3, 'no gateAt: the hook\'s own at');
});

test('tasks: the running ones, newest first, each saying whether a gate waits', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'old', updated: NOW - 600e3, pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'new', updated: NOW - 5e3, project: 'sub' }),
        row({ sessionId: 'stale', state: 'stale' }),
        row({ sessionId: 'down', state: 'down' }),
    ]), NOW, 'ymlab-pc');
    assert.deepEqual(m.tasks.map((x) => [x.id, x.gate, x.project]), [['new', false, 'sub'], ['old', true, 'fankeel']]);
    assert.equal(m.tasks[0].updated, NOW - 5e3);
    assert.deepEqual(Object.keys(m.tasks[0]).sort(), ['attached', 'background', 'gate', 'id', 'last', 'project', 'root', 'route', 'stage', 'state', 'task', 'updated']);
});

test('a row takes its state from the look it is given, and phoneModel answers one session', () => {
    const MODEL = model([row()]);
    const snap = { attached: true, holding: false, waiting: { text: 'hi', at: 1 }, lastRole: 'assistant', last: { role: 'assistant', text: 'ok', at: 1 }, background: [{ id: 'b1' }], chat: [{ role: 'assistant', text: 'ok', at: 1 }] };
    const look = () => snap;
    const m = mobile.mobileModel(MODEL, NOW, 'my-pc', new Set(), look);
    assert.equal(m.tasks[0].state, 'background');
    assert.equal(m.tasks[0].attached, true);
    assert.deepEqual(m.tasks[0].last, snap.last);
    const p = mobile.phoneModel(MODEL, m.tasks[0].id, NOW, new Set(), look);
    assert.equal(p.state, 'background');
    assert.deepEqual(p.waiting, snap.waiting);
    assert.deepEqual(p.chat, snap.chat);
    assert.equal(p.gate, null);
    assert.equal(mobile.phoneModel(MODEL, 'ffffffff-0000-4000-8000-000000000000', NOW, new Set(), look), null);
    assert.equal(mobile.mobileModel(MODEL, NOW, 'my-pc', new Set()).tasks[0].state, 'idle', 'no look: no lines, idle');
});

test('done: stages finished and tasks ended in the last 48 hours, newest first, an end before its last stage, agents in the cost', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'e', state: 'down', stage: 'land', ended: { at: new Date(NOW - 0.5 * H).toISOString(), reason: 'exit' },
            cost: { usd: 70, priced: ['claude-opus'] }, agentCost: { usd: 9.71, priced: ['claude-sonnet'] },
            stages: [{ stage: 'plan', from: NOW - 52 * H, to: NOW - 49 * H, usd: 4 }, { stage: 'audit', from: NOW - 4 * H, to: NOW - 3 * H, usd: 11.09 }, { stage: 'land', from: NOW - 3 * H, to: NOW - 0.5 * H, usd: 2.58 }] }),
        row({ sessionId: 'l', state: 'live', stage: 'design', stages: [{ stage: 'survey', from: NOW - 2 * H, to: NOW - H, usd: 1.5 }, { stage: 'design', from: NOW - H, to: NOW - 1e3, usd: 0.4 }] }),
        row({ sessionId: 'u', state: 'down', stage: 'plan', ended: { at: new Date(NOW - 2 * H).toISOString() }, cost: { usd: 0, priced: [] },
            stages: [{ stage: 'plan', from: NOW - 3 * H, to: NOW - 2 * H, usd: null }] }),
        row({ sessionId: 'x', state: 'down', ended: { at: new Date(NOW - 72 * H).toISOString() }, stages: [{ stage: 'build', from: NOW - 73 * H, to: NOW - 72 * H, usd: 1 }] }),
    ]), NOW, 'ymlab-pc');
    assert.deepEqual(m.done.map((d) => [d.id, d.kind, d.stage]), [
        ['e', 'end', 'land'], ['e', 'stage', 'land'], ['l', 'stage', 'survey'], ['u', 'end', 'plan'], ['u', 'stage', 'plan'], ['e', 'stage', 'audit'],
    ], 'the running stage of a live task is not done; past 48 hours is gone');
    const end = m.done[0];
    assert.ok(Math.abs(end.usd - 79.71) < 1e-9, 'the parent and its agents: ' + end.usd);
    assert.equal(end.stages, 3);
    assert.equal(end.at, NOW - 0.5 * H);
    assert.equal(m.done[1].usd, 2.58);
    assert.equal(m.done[1].stages, undefined);
    assert.equal(m.done[3].usd, null, 'nothing priced is no cost, not $0');
    assert.equal(m.done[4].usd, null);
});

test('done keeps the newest forty', () => {
    const stages = Array.from({ length: 50 }, (_, i) => ({ stage: 's' + i, from: NOW - (i + 2) * 60e3, to: NOW - (i + 1) * 60e3, usd: 1 }));
    const m = mobile.mobileModel(model([row({ state: 'down', stages })]), NOW, 'h');
    assert.equal(m.done.length, 40);
    assert.equal(m.done[0].stage, 's0');
    assert.equal(m.done[39].stage, 's39');
});

test('a project station.hide takes off the phone too, and nothing private rides along', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'shown', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'hidden', project: 'secret', pending: waiting(NOW - 60e3, NOW + 30e3) }),
    ]), NOW, 'h', new Set(['/ws/fankeel/secret']));
    assert.deepEqual(m.gates.map((g) => g.id), ['shown']);
    assert.deepEqual(m.tasks.map((g) => g.id), ['shown']);
    const text = JSON.stringify(m);
    assert.ok(!text.includes('lib/private.js') && !text.includes('"private"'), 'claims and notes stay on this machine');
    assert.deepEqual(mobile.mobileModel({ registries: [] }, NOW, 'h'), { host: 'h', at: NOW, gates: [], tasks: [], done: [] });
    assert.deepEqual(mobile.mobileModel(null, NOW, null), { host: '', at: NOW, gates: [], tasks: [], done: [] });
});

test('the /m shell: the keel look, its manifest and icon, both stylesheets, the phone script', () => {
    const html = mobile.shell();
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
    assert.match(html, /<meta name="theme-color" content="#2d5bd8">/);
    assert.match(html, /<link rel="manifest" href="\/m\/manifest\.webmanifest">/);
    assert.match(html, /<link rel="icon" href="\/m\/icon\.svg" type="image\/svg\+xml">/);
    const a = html.indexOf('href="/station/station.css"');
    assert.ok(a > 0 && a < html.indexOf('href="/station/mobile.css"'), 'station.css first, mobile.css over it');
    assert.match(html, /<body class="m"><div class="scr" id="app" data-block="app"><\/div>/);
    assert.match(html, /<script src="\/station\/mobile\.js"><\/script>/);
});

test('the manifest installs /m standalone with its one svg icon', () => {
    assert.deepEqual(JSON.parse(mobile.manifest()), {
        name: 'fankeel 測站', short_name: 'fankeel', id: '/m', start_url: '/m', scope: '/', display: 'standalone',
        background_color: '#f2f4f3', theme_color: '#2d5bd8', icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    });
});

test('the icon is the keel glyph on keel blue', () => {
    const svg = mobile.icon();
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120">/);
    assert.match(svg, /<rect width="120" height="120" rx="26" fill="#2d5bd8"\/>/);
    assert.equal((svg.match(/<path d="M[^"]+Z" fill="#fbfcfc"\/>/g) || []).length, 7, 'six segments and the core');
});
