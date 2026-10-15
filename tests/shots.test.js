'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseTargets, cells, pagesTouched, loadTargets, renderFileRefusal, verdictRefusal } = require('../lib/shots.js');
const tmp = require('./tmp.js');

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

// The ledger and `task.js stage` read render.json and a --render file, and
// word the refusal, through these, so the two never drift apart again.
test('loadTargets: null with no file, a refusal for one it cannot read or parse, else the targets', () => {
    const dir = tmp('fankeel-shots-');
    assert.equal(loadTargets(path.join(dir, 'render.json')), null);
    assert.match(loadTargets(dir).refusal, /render\.json: could not read .* \(E[A-Z]+\)/);
    fs.writeFileSync(path.join(dir, 'bad.json'), '{');
    assert.match(loadTargets(path.join(dir, 'bad.json')).refusal, /render\.json: not JSON/);
    fs.writeFileSync(path.join(dir, 'ok.json'), SRC);
    assert.deepEqual(loadTargets(path.join(dir, 'ok.json')).targets.src.get('home'), ['site/**', 'assets/home.css']);
});

test('renderFileRefusal passes only a file whose first non-blank line is disposition: ship', () => {
    const dir = tmp('fankeel-shots-');
    fs.writeFileSync(path.join(dir, 'ship.md'), '\n  \ndisposition: ship\n');
    fs.writeFileSync(path.join(dir, 'fix.md'), 'disposition: fix\ndisposition: ship\n');
    assert.equal(renderFileRefusal(path.join(dir, 'ship.md')), null);
    assert.match(renderFileRefusal(path.join(dir, 'fix.md')), /fix\.md: its first line is not `disposition: ship`/);
    assert.match(renderFileRefusal(path.join(dir, 'gone.md')), /--render: no file at .*gone\.md/);
});

test('verdictRefusal names the pages and only the paths that reach them, with the caller\'s two ways through', () => {
    const t = parseTargets(SRC);
    assert.equal(verdictRefusal(t, ['lib/x.js'], 'PASS', 'SKIP'), null);
    const said = verdictRefusal(t, ['lib/x.js', 'site/index.html'], 'PASS', 'SKIP');
    assert.match(said, /home \(site\/index\.html\) and carries no render verdict/);
    assert.doesNotMatch(said, /lib\/x\.js|admin/);
    assert.match(said, /PASS/);
    assert.match(said, /SKIP/);
    assert.match(said, /Ruling: render skipped — <why>/);
});
