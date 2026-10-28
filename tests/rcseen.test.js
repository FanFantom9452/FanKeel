'use strict';
// lib/rcseen.js (Task 1 of docs/90-agent/plans/2026-10-29-mobile-sources.md): the RC sessions this
// machine saw in the last 48 hours, so the RC tab can list the ones that ended.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rcseen = require('../lib/rcseen.js');
const tmp = require('./tmp.js');

const T = Date.UTC(2026, 9, 29, 12, 0);
const a = { id: 'a', kind: 'unreg', name: 'A', cwd: '/a', entrypoint: 'cli', task: '' };
const b = { id: 'b', kind: 'reg', name: '', cwd: '/b', entrypoint: '', task: 'B' };

test('note: a live RC session is kept; once gone it is ended, newest first; past 48 h it drops', () => {
    const cfg = tmp('fankeel-rcseen-');
    assert.deepEqual(rcseen.note(cfg, [a, b], T), []);
    assert.deepEqual(rcseen.note(cfg, [b], T + 1000).map((x) => [x.id, x.last]), [['a', T]]);
    assert.equal(rcseen.find(cfg, 'a').name, 'A');
    assert.equal(rcseen.find(cfg, 'nope'), null);
    assert.deepEqual(rcseen.note(cfg, [], T + 49 * 3600e3), []);
    assert.equal(rcseen.find(cfg, 'a'), null);
});

test('note: writes only when a session is new or its last is a minute old', () => {
    const cfg = tmp('fankeel-rcseen-');
    const file = path.join(cfg, 'fankeel', 'rc-seen.json');
    rcseen.note(cfg, [a], T);
    const first = fs.readFileSync(file, 'utf8');
    rcseen.note(cfg, [a], T + 30e3);
    assert.equal(fs.readFileSync(file, 'utf8'), first);
    rcseen.note(cfg, [a], T + 61e3);
    assert.notEqual(fs.readFileSync(file, 'utf8'), first);
});

test('note: no more than 40 kept, the oldest dropped first', () => {
    const cfg = tmp('fankeel-rcseen-');
    for (let i = 0; i < 45; i++) rcseen.note(cfg, [Object.assign({}, a, { id: 'x' + i })], T + i * 1000);
    const kept = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'rc-seen.json'), 'utf8')).sessions;
    assert.equal(kept.length, 40);
    assert.equal(kept[0].id, 'x44');
    assert.equal(rcseen.find(cfg, 'x4'), null);
});
