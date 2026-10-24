'use strict';
// The 導覽 page and its entry in the left bar (design §5; mockup block
// tour-nav). The tour needs a server: the written page says so instead.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

test('#/tour is a page, and 導覽 is the last entry of the left bar', () => {
    assert.deepEqual(V.parseHash('#/tour'), { view: 'tour' });
    const nav = V.navHtml('tour', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {});
    assert.ok(nav.includes('<li class="navcat" data-block="tour-nav"><a href="#/tour" aria-current="page" title="fankeel 怎麼跑一個任務，一段動畫看完">'
        + '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/></svg><span>導覽</span></a></li>'), nav);
    assert.ok(nav.indexOf('href="#/settings"') < nav.indexOf('href="#/tour"'));
    assert.doesNotMatch(V.navHtml('docs', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {}), /href="#\/tour" aria-current/);
});

test('the tour page frames tour.html when served, and says to open serve when not', () => {
    assert.match(V.tourPage(true), /^<div class="tour" data-block="tour"><iframe class="tour-frame" src="station\/tour\.html" title="fankeel 導覽"><\/iframe><\/div>$/);
    const file = V.tourPage(false);
    assert.doesNotMatch(file, /<iframe/);
    assert.match(file, /data-block="tour"/);
    assert.match(file, /\/fankeel-station/);
});
