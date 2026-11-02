'use strict';
// AWAIT_RULE tells the controller to give the background await a description and no cd prefix,
// so the Pane and the station can name the shell (shell-label); the sentence rides after the
// phrase tests/stages.test.js:992 pins.
const test = require('node:test');
const assert = require('node:assert/strict');
const { controlFor } = require('../lib/stages.js');

test('every controlled stage tells the background await to carry a description and no cd', () => {
    const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    for (const stage of all) {
        const rules = controlFor(stage, { 'stage.agents': all }, { await: '<plugin>/scripts/await.js', session: 'sid' }).rules;
        const rule = rules.find((r) => r.startsWith('After the dispatch, each SendMessage'));
        assert.ok(rule, stage + ': no await rule');
        assert.ok(rule.includes('never poll. '), stage + ': ' + rule);
        assert.ok(rule.endsWith("`description` `await: " + stage + " stage agent`, no `cd`."), stage + ": " + rule);
    }
});
