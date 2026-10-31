'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
    assert.doesNotMatch(text, /(src|href)="https?:/);
    assert.doesNotMatch(text, /@import/);
});

test('the page carries no identifying string', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const w of BANNED) assert.ok(!text.includes(w), 'seven-stages.html contains ' + w);
});
