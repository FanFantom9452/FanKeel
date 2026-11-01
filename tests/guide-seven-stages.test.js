'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CLASSES } = require('../lib/stages.js');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'seven-stages.html');
const BANNED = ['F:/', 'F:\\', 'ymlab', 'Chartroom', 'chartroom', 'Latex', 'claude.ai/code', 'ddb6de22',
    'FanFantom', '.ts.net', 'd89cc304', '94f510ec', 'd5a8f499', '893f29f8', '943ee70d', '36f226c7', '40b61b39'];
const STAGES = ['init', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

test('the page has one section per stage, in route order', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    const found = [...text.matchAll(/data-stage="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(found)], STAGES);
    assert.match(text, /<html lang="zh-Hant">/);
});

test('the page loads nothing from outside itself', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    assert.doesNotMatch(text, /(src|href)\s*=\s*["']?(https?:)?\/\//i);
    assert.doesNotMatch(text, /url\(\s*["']?(https?:)?\/\//i);
    assert.doesNotMatch(text, /@import/);
});

test('the page carries no identifying string', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const w of BANNED) assert.ok(!text.includes(w), 'seven-stages.html contains ' + w);
});

const svgsWithStops = (text) => (text.match(/<svg\b(?:(?!<\/svg>)[\s\S])*<\/svg>/g) || [])
    .filter((s) => s.includes('class="stop"'));

test('each class line carries as many stops as that class has stages on its route', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    const svgs = svgsWithStops(text);
    assert.equal(svgs.length, 2, 'the desktop and the narrow diagram each draw the class lines');
    for (const svg of svgs) {
        const total = (svg.match(/<circle class="stop"/g) || []).length;
        let counted = 0;
        for (const name of Object.keys(CLASSES)) {
            const n = (svg.match(new RegExp('<circle class="stop" data-class="' + name + '"', 'g')) || []).length;
            assert.equal(n, CLASSES[name].route.length, name + ' line has ' + n + ' stops');
            counted += n;
        }
        assert.equal(counted, total, 'a stop is not marked with a class');
    }
});

test('there are eight step cards, each with a step naming a script or an agent in <code>', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    const cards = text.match(/<article class="stc" id="d-stage-[a-z]+"[\s\S]*?<\/article>/g) || [];
    assert.equal(cards.length, 8);
    assert.deepEqual(cards.map((c) => c.match(/id="d-stage-([a-z]+)"/)[1]), STAGES);
    for (const c of cards) {
        const named = c.match(/<li><b><code>[^<]*(?:\.js|\.ts|fankeel-[a-z-]+)[^<]*<\/code>/g) || [];
        assert.ok(named.length >= 1, c.slice(0, 60) + ' has no step naming a script or agent');
    }
});

test('the legend block and both BUILD lanes are on the page', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    assert.match(text, /data-block="stages-legend"/);
    for (const c of ['architectural', 'bounded', 'spike']) assert.match(text, new RegExp('<i class="sw ' + c + '">'));
    assert.match(text, /data-block="stages-build-inside"/);
    const lanes = (text.match(/<text class="lane"[^>]*>(?:Agent|Workflow)：/g) || []);
    assert.ok(lanes.filter((l) => l.includes('>Agent')).length >= 2, 'the Agent lane is missing from the wide or the narrow BUILD diagram');
    assert.ok(lanes.filter((l) => l.includes('>Workflow')).length >= 2, 'the Workflow lane is missing from the wide or the narrow BUILD diagram');
});

test('each of the eight stage nodes in the main diagram carries a step-count link that lands on its card', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    const main = text.match(/data-block="stages-main"[\s\S]*?<\/svg>/)[0];
    const links = [...main.matchAll(/<a href="#(d-stage-[a-z]+)"[^>]*>(?:(?!<\/a>)[\s\S])*?個步驟(?:(?!<\/a>)[\s\S])*?<\/a>/g)];
    assert.deepEqual(links.map((m) => m[1].replace('d-stage-', '')), STAGES);
    for (const m of links) assert.ok(text.includes('id="' + m[1] + '"'), m[1] + ' has no card');
});

test('every in-page link lands on an id, and the eight stage sections keep their anchors', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const m of text.matchAll(/href="#([^"]+)"/g)) {
        assert.ok(text.includes('id="' + m[1] + '"'), 'link to #' + m[1] + ' has no target');
    }
    for (const s of STAGES) assert.ok(text.includes('id="stage-' + s + '"'), '#stage-' + s + ' is gone');
});
