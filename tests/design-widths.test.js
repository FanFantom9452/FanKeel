'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

// design-4: not every project has a phone screen; the design stage draws one
// only where .fankeel/render.json declares a phone width.
test('the design skill decides the width per project from render.json', () => {
    const design = flat('skills/fankeel-design/SKILL.md');
    assert.match(design, /\*\*Widths follow the project\.\*\*/);
    assert.match(design, /\.fankeel\/render\.json/);
    assert.match(design, /mobileDeclared/);
    assert.match(design, /480/);
    assert.match(design, /desktop width alone/);
    assert.match(design, /writes the answer into the prompt/);
    assert.doesNotMatch(design, /方向/);
    assert.doesNotMatch(design, /逐塊/);
});

test('the mockup agent draws one width unless the prompt names a phone', () => {
    const agent = flat('agents/fankeel-mockup.md');
    assert.match(agent, /^---.*## Widths /);
    assert.match(agent, /one frame at the desktop width/);
    assert.match(agent, /`ui` and `ix`/);
    assert.match(agent, /narrow fallbacks and touch targets are CSS only/);
    assert.ok(agent.indexOf('## Widths') < agent.indexOf('## Check it served'), 'Widths comes before Check it served');
});
