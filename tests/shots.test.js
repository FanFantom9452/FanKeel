'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseTargets, cells, pagesTouched } = require('../lib/shots.js');

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

// docs/90-agent/plans/2026-10-15-render-gate-design.md §1: a page names the
// files that draw it, so a change to one of them can be told apart.
const SRC = JSON.stringify({
    pages: [{ name: 'home', url: 'site/index.html', src: ['site/**', 'assets/home.css'] }, { name: 'admin', url: 'http://127.0.0.1:9/admin' }],
    roles: [{ name: 'guest' }],
});

test('a page\'s `src` globs are kept by page name; a page with none has no entry, and cells are unchanged', () => {
    const t = parseTargets(SRC);
    assert.deepEqual(t.src.get('home'), ['site/**', 'assets/home.css']);
    assert.equal(t.src.has('admin'), false);
    assert.deepEqual(cells(t, path.join('base')).map((c) => c.page), ['home', 'admin']);
});

test('a `src` that is not an array of non-empty strings is refused, naming the page', () => {
    for (const src of ['site/**', [''], [3], {}]) {
        const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html', src }], roles: [{ name: 'a' }] });
        assert.throws(() => parseTargets(bad), /pages\[0\] \("home"\) has a `src` that is not an array of non-empty strings/, JSON.stringify(src));
    }
});

test('pagesTouched names the pages whose src matches a path, either separator, and none for a path outside every src', () => {
    const t = parseTargets(SRC);
    assert.deepEqual(pagesTouched(t, ['site/index.html']), ['home']);
    assert.deepEqual(pagesTouched(t, ['lib/x.js', 'assets\\home.css']), ['home']);
    assert.deepEqual(pagesTouched(t, ['lib/x.js', 'assets/other.css', 'README.md']), []);
    assert.deepEqual(pagesTouched(t, []), []);
    assert.deepEqual(pagesTouched(parseTargets(CONF), ['home.html']), []);
});
