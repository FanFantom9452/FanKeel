'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { formatProblem } = require('../lib/handoff.js');

const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const gate = (header, question, one, two) => ({
    questions: [{ header, question, multiSelect: false, options: [
        { label: one, description: 'd' }, { label: two, description: 'd' }, { label: '暫停', description: 'd' }] }],
    next: 'n',
});

test('a gate in the gate-19 format passes', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : TODO 盤點　照這份計畫做？', 'Go to BUILD (Recommended)', 'Stay in PLAN'), 'build', ROUTE), null);
    assert.equal(formatProblem(gate('VERIFY', 'VERIFY -> BUILD | fankeel : x　退回？', 'Back to BUILD', 'Stay in VERIFY'), 'land', ROUTE), null);
    assert.equal(formatProblem(gate('LAND', 'LAND -> 收工 | fankeel : x　收工？', 'Wrap up — 收工 (Recommended)', 'Stay in LAND'), null, ROUTE), null);
});

test('a header that is not the stage in capitals is refused', () => {
    const bad = formatProblem(gate('盤點', 'SURVEY -> PLAN | fankeel : x　？', 'Go to PLAN', 'Stay in SURVEY'), 'plan', ROUTE);
    assert.equal(bad.at, 'questions[0].header');
    assert.equal(formatProblem(gate('Plan', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].header');
});

test('a question that does not open with the move is refused', () => {
    assert.equal(formatProblem(gate('PLAN', '要進 build 嗎？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].question');
    assert.equal(formatProblem(gate('PLAN', 'SURVEY -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].question');
});

test('option one and option two carry their verbs', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'build (Recommended)', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('LAND', 'LAND -> 收工 | fankeel : x　？', 'Go to 收工', 'Stay in LAND'), null, ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', '再想想'), 'build', ROUTE).at, 'questions[0].options[1].label');
});

test('only the first question is held to it: a patrol side question keeps its own header', () => {
    const g = gate('SURVEY', 'SURVEY -> PLAN | fankeel : x　？', 'Go to PLAN', 'Stay in SURVEY');
    g.questions.push({ header: '拆殼範圍', question: '本輪要跑嗎？', multiSelect: false, options: [
        { label: '本輪不做', description: 'd' }, { label: '本輪跑', description: 'd' }] });
    assert.equal(formatProblem(g, 'plan', ROUTE), null);
});

// A gate the main session typed reaches formatProblem unchecked for shape
// (hooks/gate.js): a missing option is a refusal, never a throw the hook's
// catch would let out.
test('a gate with one option, or none, is refused at the option it lacks', () => {
    const one = gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN');
    one.questions[0].options.splice(1);
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[1].label');
    one.questions[0].options = [];
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[0].label');
    delete one.questions[0].options;
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[0].label');
});

test('option one goes to the next stage or back to an earlier one only', () => {
    const at = (h, one, next) => (formatProblem(gate(h, h + ' -> BUILD | fankeel : x　？', one, 'Stay in ' + h), next, ROUTE) || {}).at;
    assert.equal(at('PLAN', 'Go to LAND', 'build'), 'questions[0].options[0].label');
    assert.equal(at('PLAN', 'Back to LAND', 'build'), 'questions[0].options[0].label');
    assert.equal(at('PLAN', 'Back to PLAN', 'build'), 'questions[0].options[0].label');
    assert.equal(at('VERIFY', 'Back to BUILD', 'land'), undefined);
    assert.equal(at('VERIFY', 'Back to VERIFY', 'land'), 'questions[0].options[0].label');
});
