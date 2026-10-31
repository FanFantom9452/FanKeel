'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\s+/g, ' ');

test('the gate table teaches the first-capital form, not capitals', () => {
    const skill = read('skills', 'fankeel', 'SKILL.md');
    assert.match(skill, /the move, `→` between the stages — `Plan→Build`; past 12 columns the destination alone, `→Design`/);
    assert.match(skill, /`Go to <Next>` — the next stage with only its first letter capital/);
    assert.match(skill, /`This -> Next \\\| project : task`/);
    assert.doesNotMatch(skill, /in capitals/);
});

test('the land skill and the brain agent name the new form', () => {
    const land = read('skills', 'fankeel-land', 'SKILL.md');
    assert.match(land, /Header `Land→收工`, question opens `Land -> 收工 \| <project> : <task>`/);
    assert.match(land, /2\. `Stay in Land`/);
    const brain = read('agents', 'fankeel-brain.md');
    assert.match(brain, /the first header the move, `<Stage>→<Next>`, or `→<Next>` past 12 columns/);
    assert.match(brain, /`Go to <Next>`/);
    assert.match(brain, /`Stay in <Stage>`/);
    assert.doesNotMatch(brain, /in capitals/);
});
