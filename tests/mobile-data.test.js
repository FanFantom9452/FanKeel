'use strict';
// /station/mobile.json and phone.json for the 2026-10-27 /m redesign: the TokenBar's context and
// limits, when a held turn gives up (phone.hold), this phone as the station knows it, and the dark theme-color.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = require('../lib/mobile.js');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const NOW = Date.parse('2026-10-27T14:00:00.000Z');
const SID = 'bbbbbbbb-1111-4111-8111-00000000000a';
const row = (o) => Object.assign({ sessionId: 's', task: 't', project: '', stage: 'build', route: ['build'], state: 'live', updated: NOW - 60e3, ended: null, cost: null, agentCost: null, stages: [], pending: null, gateAt: null }, o);
const model = (sessions) => ({ registries: [{ root: '/ws/fankeel', profiles: {}, sessions }] });

test('limitsOf: the newest row by its time, resets in epoch ms; bad lines and empty rows skipped', () => {
    const text = [
        '{"at":"2026-10-27T13:00:00.000Z","task":"t","stage":"plan","five":2,"fiveResets":"2026-10-27T18:00:00.000Z","seven":45,"sevenResets":"2026-10-30T03:00:00.000Z"}',
        'not json',
        '{"at":"2026-10-27T13:30:00.000Z","task":"t","stage":"plan","five":4,"fiveResets":"2026-10-27T18:00:00.000Z","seven":46,"sevenResets":"2026-10-30T03:00:00.000Z"}',
        '{"at":"2026-10-27T13:10:00.000Z","task":"t","stage":"plan","five":3,"fiveResets":null,"seven":null,"sevenResets":null}',
        '{"at":"2026-10-27T13:40:00.000Z","task":"t","stage":"plan","five":null,"fiveResets":null,"seven":null,"sevenResets":null}',
    ].join('\n');
    assert.deepEqual(mobile.limitsOf(text), { at: Date.parse('2026-10-27T13:30:00.000Z'), five: 4, fiveResets: Date.parse('2026-10-27T18:00:00.000Z'), seven: 46, sevenResets: Date.parse('2026-10-30T03:00:00.000Z') });
    assert.equal(mobile.limitsOf(''), null);
    assert.equal(mobile.limitsOf(null), null);
});

test('contextOf: the transcript\'s tokens against compact.at; off or unknown is no line; no count is null', () => {
    assert.deepEqual(mobile.contextOf({ used: 380000, dropped: 0 }, '350000'), { tokens: 380000, at: 350000, window: null });
    assert.deepEqual(mobile.contextOf({ used: 380000, dropped: 0 }, 600000), { tokens: 380000, at: 600000, window: null });
    assert.deepEqual(mobile.contextOf({ used: 1000, dropped: 0 }, 'off'), { tokens: 1000, at: null, window: null });
    assert.equal(mobile.contextOf({ used: 0, dropped: 5 }, '350000'), null);
    assert.equal(mobile.contextOf(null, '350000'), null);
});

test('mobileModel: this phone as deviceFor names it, null from this machine; every row says when its hold gives up', () => {
    const look = () => ({ attached: true, holding: true, holdUntil: NOW + 1690e3, waiting: null, lastRole: 'assistant', last: null, background: [], chat: [] });
    const m = mobile.mobileModel(model([row()]), NOW, 'h', new Set(), look, { id: 'x', name: 'iPhone', paired: NOW - 5 * 864e5, seen: NOW });
    assert.deepEqual(m.device, { name: 'iPhone', paired: NOW - 5 * 864e5 });
    assert.equal(m.tasks[0].holdUntil, NOW + 1690e3);
    assert.equal(mobile.mobileModel(model([row()]), NOW, 'h', new Set(), look).device, null);
    assert.equal(mobile.mobileModel(model([row()]), NOW, 'h', new Set()).tasks[0].holdUntil, null, 'no look: no hold');
});

test('phoneModel carries holdUntil, and context and limits as null until the server fills them', () => {
    const look = () => ({ attached: true, holding: true, holdUntil: NOW + 60e3, waiting: null, lastRole: 'assistant', last: null, background: [], chat: [] });
    const p = mobile.phoneModel(model([row()]), 's', NOW, new Set(), look);
    assert.equal(p.holdUntil, NOW + 60e3);
    assert.equal(p.context, null);
    assert.equal(p.limits, null);
});

test('snapshot: holdUntil is holding.json\'s until while it is ahead, null after', () => {
    const root = tmp('fankeel-phone-hold-');
    fs.mkdirSync(phone.dirOf(root, SID), { recursive: true });
    fs.writeFileSync(path.join(phone.dirOf(root, SID), 'holding.json'), JSON.stringify({ since: 1000, until: 5000 }));
    assert.equal(phone.snapshot(root, SID, 3000, 0).holdUntil, 5000);
    assert.equal(phone.snapshot(root, SID, 6000, 0).holdUntil, null);
    assert.equal(phone.snapshot(tmp('fankeel-phone-hold-'), SID, 3000, 0).holdUntil, null);
});

test('the shell\'s status bar is the page ground in each theme; the manifest takes the dark ground', () => {
    const html = mobile.shell();
    assert.ok(html.includes('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#10151d">'));
    assert.ok(html.includes('<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f2f4f3">'));
    assert.ok(!html.includes('#2d5bd8"'), 'the brand blue is the icon only');
    assert.equal(JSON.parse(mobile.manifest()).theme_color, '#10151d');
});
