'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mobileDeclared } = require('../lib/shots.js');

const conf = (pages) => JSON.stringify({ pages, roles: [{ name: 'guest' }] });
const page = (name, extra) => Object.assign({ name, url: 'http://127.0.0.1:9/' + name }, extra);

// design-4: the design stage draws a phone mockup only where the project
// declared a phone width in .fankeel/render.json.
test('a page whose viewport is 480 wide or less declares a phone', () => {
    assert.equal(mobileDeclared(conf([page('home'), page('home-412', { viewport: '412,900' })])), true);
    assert.equal(mobileDeclared(conf([page('edge', { viewport: '480,900' })])), true);
});

test('no viewport, or only wider ones, declares none', () => {
    assert.equal(mobileDeclared(conf([page('home')])), false);
    assert.equal(mobileDeclared(conf([page('narrow-desktop', { viewport: '481,900' }), page('wide', { viewport: '1600,1000' })])), false);
    assert.equal(mobileDeclared(conf([page('themed', { theme: 'light' })])), false);
});

test('a missing, empty or broken render.json declares none and does not throw', () => {
    for (const bad of [undefined, '', 'not json', '{}', conf([page('x', { viewport: 'wide' })])]) {
        assert.equal(mobileDeclared(bad), false, String(bad));
    }
});
