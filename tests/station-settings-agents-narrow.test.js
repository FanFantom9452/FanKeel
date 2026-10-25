'use strict';
// station-39: the approved v9 agents table cut its select text at 390px —
// three columns side by side leave each select about 110px. Below 440px each
// agent is a row of its own: the name across, its model and effort selects
// under it, half the width each. The head row goes; each select keeps its
// aria-label (settings-detail.js agentsHtml).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-detail.css'), 'utf8');
const OPEN = '@media (max-width:440px){\ntable.v9-at thead{display:none}';

function narrow() {
    const at = CSS.indexOf(OPEN);
    assert.ok(at >= 0, 'no narrow block for the agents table');
    let depth = 0;
    for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
        if (CSS[i] === '{') depth += 1;
        else if (CSS[i] === '}' && --depth === 0) return { at, body: CSS.slice(at, i + 1) };
    }
    throw new Error('the narrow block never closes');
}

test('below 440px each agent is its own row, its two selects side by side', () => {
    const { body } = narrow();
    assert.match(body, /table\.v9-at tr\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);column-gap:8px;padding:6px 0;border-top:1px solid var\(--rule\)\}/);
    assert.match(body, /table\.v9-at tbody th\{grid-column:1\/-1;width:auto;padding:0 0 4px;border-top:0\}/);
    assert.match(body, /table\.v9-at td\{padding:0;border-top:0\}/);
    assert.match(body, /table\.v9-at select\{height:40px\}/);
});

test('the narrow block comes after the table rules it overrides', () => {
    assert.ok(narrow().at > CSS.indexOf('table.v9-at select{width:100%}'));
});
