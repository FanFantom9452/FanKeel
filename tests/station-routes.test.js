'use strict';
// The overview's stage ledger is grouped by route, and a session that stepped
// back is counted in its group but kept out of its averages.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASSES } = require('../lib/stages.js');

const classes = Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [name, c.route]));
global.window = { STATION: { serve: false, classes } };
const V = require('../assets/station/station.js');

const stage = (name, ms, usd) => ({ stage: name, from: 0, to: ms, burn: 1000, usd, waited: 0 });
const bounded = { route: classes.bounded, backtracks: 0, stages: [stage('survey', 60000, 0.5), stage('build', 120000, 2)] };
const clean = { route: classes.architectural, backtracks: 0, stages: [stage('survey', 100000, 1), stage('build', 300000, 3)] };
const back = { route: classes.architectural, backtracks: 2, stages: [stage('survey', 900000, 9), stage('build', 900000, 9)] };
const hand = { route: ['survey', 'build', 'land'], backtracks: 0, stages: [stage('survey', 1000, 0.1)] };

test('routeGroups: one group per route, a class route under its name, averages only from sessions that did not step back', () => {
    const groups = V.routeGroups([bounded, clean, back, hand], classes);
    const arch = groups.find((g) => g.name === 'architectural');
    assert.deepEqual([arch.n, arch.clean, arch.backN, arch.backtracks], [2, 1, 1, 2]);
    assert.deepEqual(arch.stages.survey, { n: 1, ms: 100000, wait: 0, burn: 1000, usd: 1 }, 'the backtracking session is not in the average');
    assert.deepEqual(arch.back, { ms: 1800000, wait: 0, burn: 2000, usd: 18 });
    assert.equal(groups.find((g) => g.name === 'bounded').stages.survey.usd, 0.5, 'no average crosses two groups');
    assert.ok(groups.some((g) => g.name === 'survey → build → land'), 'a hand-written route is named by its stages');
});

test('routeLedger prints each group\'s sessions and backtracks, and the 有倒退 row apart from the stage rows', () => {
    const html = V.routeLedger([bounded, clean, back]);
    assert.match(html, /<b>architectural<\/b><span class="mute">2 個 session · 有倒退 1 個、倒退 2 次/);
    assert.match(html, /<b>bounded<\/b><span class="mute">1 個 session · 有倒退 0 個、倒退 0 次/);
    const arch = html.slice(html.indexOf('<b>architectural'), html.indexOf('<b>bounded'));
    assert.match(arch, />survey<\/span>[\s\S]*?\$1\.00/, 'survey averages the clean session alone');
    assert.match(arch, /有倒退<\/span>[\s\S]*?\$18\.00/, 'the backtracking session\'s whole cost is its own row');
    assert.equal((html.match(/有倒退<\/span>/g) || []).length, 1, 'only the group with one has the row');
});
