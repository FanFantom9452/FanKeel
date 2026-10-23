'use strict';
// station-51: the first-load skeleton takes the layout of the page the hash
// opens — list, detail or form — and the 儀表板 shape stays the default.
// The inline script in index.html sets #page's data-skel before it asks for
// station-data.js; station.css draws one variant per layout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
const INLINE = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

function boot(hash) {
    const calls = [];
    const page = { attrs: {}, setAttribute(k, v) { calls.push('skel'); this.attrs[k] = v; } };
    const document = { getElementById: (id) => (id === 'page' ? page : null), write: (s) => calls.push('write ' + s) };
    vm.runInNewContext(INLINE, { location: { hash, search: '' }, document, URLSearchParams });
    return { skel: page.attrs['data-skel'] || null, calls };
}

test('the hash picks the layout: list, detail, form, or none for the 儀表板', () => {
    assert.equal(boot('#/sessions').skel, 'list');
    assert.equal(boot('#/projects').skel, 'list');
    assert.equal(boot('#/docs').skel, 'list');
    assert.equal(boot('#/days').skel, 'list');
    assert.equal(boot('#/d/2026-10-24').skel, 'list');
    assert.equal(boot('#/list').skel, 'list');
    assert.equal(boot('#/cmp').skel, 'list');
    assert.equal(boot('#/s/x').skel, 'detail');
    assert.equal(boot('#/s/x/plan').skel, 'detail');
    assert.equal(boot('#/p/F%3A%5Cws').skel, 'detail');
    assert.equal(boot('#/settings').skel, 'form');
    assert.equal(boot('#/').skel, null);
    assert.equal(boot('').skel, null);
    assert.equal(boot('#/live').skel, null);
});

test('data-skel is set before station-data.js is asked for', () => {
    const { calls } = boot('#/sessions');
    assert.equal(calls[0], 'skel');
    assert.match(calls[1], /^write <script src="station\/station-data\.js/);
});

test('station.css draws one rule per layout beside the 儀表板 default', () => {
    for (const k of ['list', 'detail', 'form']) {
        assert.equal(css.split('#page:empty[data-skel=' + k + ']{').length - 1, 1, k);
    }
    assert.match(css, /\n#page:empty\{position:relative;/);
});
