'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { formatProblem, stageWord } = require('../lib/handoff.js');

const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const gate = (header, question, one, two) => ({
    questions: [{ header, question, multiSelect: false, options: [
        { label: one, description: 'd' }, { label: two, description: 'd' }, { label: '暫停', description: 'd' }] }],
    next: 'n',
});

test('a gate in the gate-19 format passes', () => {
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : TODO 盤點　照這份計畫做？', 'Go to Build (Recommended)', 'Stay in Plan'), 'build', ROUTE), null);
    assert.equal(formatProblem(gate('Verify', 'Verify -> Build | fankeel : x　退回？', 'Back to Build', 'Stay in Verify'), 'land', ROUTE), null);
    assert.equal(formatProblem(gate('Land', 'Land -> 收工 | fankeel : x　收工？', 'Wrap up — 收工 (Recommended)', 'Stay in Land'), null, ROUTE), null);
});

test('a header that is not the stage with a capital first letter is refused', () => {
    const bad = formatProblem(gate('盤點', 'Survey -> Plan | fankeel : x　？', 'Go to Plan', 'Stay in Survey'), 'plan', ROUTE);
    assert.equal(bad.at, 'questions[0].header');
    assert.equal(formatProblem(gate('plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].header');
});

test('the old all-capitals form is refused at every field, so there is one format', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].header');
    assert.equal(formatProblem(gate('Plan', 'PLAN -> BUILD | fankeel : x　？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].question');
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to BUILD', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].options[1].label');
});

test('a question that does not open with the move is refused', () => {
    assert.equal(formatProblem(gate('Plan', '要進 build 嗎？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].question');
    assert.equal(formatProblem(gate('Plan', 'Survey -> Build | fankeel : x　？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].question');
});

test('option one and option two carry their verbs', () => {
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'build (Recommended)', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('Land', 'Land -> 收工 | fankeel : x　？', 'Go to 收工', 'Stay in Land'), null, ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', '再想想'), 'build', ROUTE).at, 'questions[0].options[1].label');
});

test('only the first question is held to it: a patrol side question keeps its own header', () => {
    const g = gate('Survey', 'Survey -> Plan | fankeel : x　？', 'Go to Plan', 'Stay in Survey');
    g.questions.push({ header: '拆殼範圍', question: '本輪要跑嗎？', multiSelect: false, options: [
        { label: '本輪不做', description: 'd' }, { label: '本輪跑', description: 'd' }] });
    assert.equal(formatProblem(g, 'plan', ROUTE), null);
});

// A gate the main session typed reaches formatProblem unchecked for shape
// (hooks/gate.js): a missing option is a refusal, never a throw the hook's
// catch would let out.
test('a gate with one option, or none, is refused at the option it lacks', () => {
    const one = gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', 'Stay in Plan');
    one.questions[0].options.splice(1);
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[1].label');
    one.questions[0].options = [];
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[0].label');
    delete one.questions[0].options;
    assert.equal(formatProblem(one, 'build', ROUTE).at, 'questions[0].options[0].label');
});

test('option one goes to the next stage or back to an earlier one only', () => {
    const at = (h, one, next) => (formatProblem(gate(h, h + ' -> Build | fankeel : x　？', one, 'Stay in ' + h), next, ROUTE) || {}).at;
    assert.equal(at('Plan', 'Go to Land', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Plan', 'Back to Land', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Plan', 'Back to Plan', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Verify', 'Back to Build', 'land'), undefined);
    assert.equal(at('Verify', 'Back to Verify', 'land'), 'questions[0].options[0].label');
});

test('stageWord keeps the first letter capital and the rest lower', () => {
    assert.equal(stageWord('survey'), 'Survey');
    assert.equal(stageWord('SURVEY'), 'Survey');
    assert.equal(stageWord('init'), 'Init');
    assert.equal(stageWord(''), '');
    assert.equal(stageWord(null), '');
});
