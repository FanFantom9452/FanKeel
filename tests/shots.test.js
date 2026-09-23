'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseTargets, cells } = require('../lib/shots.js');

const CONF = JSON.stringify({
    pages: [{ name: 'home', url: 'home.html' }, { name: 'admin', url: 'http://127.0.0.1:9/admin' }],
    roles: [{ name: 'guest', pages: ['home'] }, { name: 'owner' }],
});

test('a role with no pages gets every page, in declaration order', () => {
    const got = cells(parseTargets(CONF), path.join('base'));
    assert.deepEqual(got.map((c) => c.role + '/' + c.page), ['guest/home', 'owner/home', 'owner/admin']);
});

test('a file url resolves against the directory render.json sits in; an http url is kept', () => {
    const got = cells(parseTargets(CONF), path.resolve('base'));
    assert.equal(got[0].url, path.resolve('base', 'home.html'));
    assert.equal(got[2].url, 'http://127.0.0.1:9/admin');
});

test('a role naming an undeclared page is refused, and the message names both', () => {
    const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html' }], roles: [{ name: 'admin', pages: ['settings'] }] });
    assert.throws(() => parseTargets(bad), /role "admin" names page "settings"/);
});

test('a name that is not a plain file name is refused', () => {
    const bad = JSON.stringify({ pages: [{ name: '../x', url: 'h.html' }], roles: [{ name: 'a' }] });
    assert.throws(() => parseTargets(bad), /pages\[0\] needs a `name`/);
});

test('`profiles` is not a role name: it is where the login profiles live', () => {
    const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html' }], roles: [{ name: 'profiles' }] });
    assert.throws(() => parseTargets(bad), /reserved/);
});

test('text that is not JSON says so', () => {
    assert.throws(() => parseTargets('{'), /render\.json: not JSON/);
});
