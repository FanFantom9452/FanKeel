'use strict';
// The 測站 sheet lists the other stations on the tailnet (m-machines): one plain https link each.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 28, 6, 0);
const R = P.parseRoute('#/');
const sheet = (others) => P.screen({ host: 'office-pc', at: NOW, device: null, gates: [], tasks: [], done: [], others }, R, NOW, { mode: 'app', open: {}, sheet: true });
const block = (h) => /data-block="m-machines"[\s\S]*?<\/section>/.exec(h)[0];
const links = (h) => block(h).match(/<a [^>]*href="[^"]*"/g) || [];

test('m-machines: two others give exactly two https /m links; none gives the empty line and no link', () => {
    const two = block(sheet([{ name: 'lab-desktop', url: 'https://lab-desktop.t.ts.net/m' }, { name: 'home-pc', url: 'https://home-pc.t.ts.net/m' }]));
    assert.equal(links(two).length, 2);
    assert.match(two, /href="https:\/\/lab-desktop\.t\.ts\.net\/m"/);
    assert.match(two, /href="https:\/\/home-pc\.t\.ts\.net\/m"/);
    assert.match(two, /其他電腦/);
    for (const o of [[], undefined]) {
        const none = block(sheet(o));
        assert.equal(links(none).length, 0);
        assert.match(none, /class="mm-empty"/);
        assert.match(none, /tailnet 上沒有找到其他開了遠端的電腦/);
    }
});

test('m-machines: only an https url becomes a link, and names and urls are escaped', () => {
    const h = block(sheet([{ name: 'a', url: 'javascript:alert(1)' }, { name: 'b', url: 'http://b.ts.net/m' }, { name: '<i>c</i>', url: 'https://c.ts.net/m?"x' }]));
    assert.equal(links(h).length, 1);
    assert.doesNotMatch(h, /javascript:|http:\/\/|<i>/);
    assert.match(h, /&lt;i&gt;c&lt;\/i&gt;/);
});
