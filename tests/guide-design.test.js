'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'design.md');
const BANNED = ['F:/', 'F:\\', 'ymlab', 'Chartroom', 'chartroom', 'Latex', 'claude.ai/code', 'ddb6de22',
    'FanFantom', '.ts.net', 'd89cc304', '94f510ec', 'd5a8f499', '893f29f8', '943ee70d', '36f226c7', '40b61b39'];
const STAGES = ['INIT', 'SURVEY', 'DESIGN', 'PLAN', 'BUILD', 'VERIFY', 'AUDIT', 'LAND'];

test('the design page has eight stage sections, each with a mermaid diagram', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    STAGES.forEach((s, i) => assert.match(text, new RegExp('^## ' + i + '\\. ' + s + ' ', 'm'), s));
    assert.ok((text.match(/^```mermaid$/gm) || []).length >= 8, 'fewer than eight mermaid blocks');
});

test('the design page carries no identifying string', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const w of BANNED) assert.ok(!text.includes(w), 'design.md contains ' + w);
});

test('the docs index lists the design page and the seven-stage page', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'docs', 'README.md'), 'utf8');
    assert.ok(index.includes('01-guide/design.md'));
    assert.ok(index.includes('01-guide/seven-stages.html'));
});
