'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const drift = require('../lib/drift.js');
const tmp = require('./tmp.js');

const MODULES = ['invoice', 'receipt', 'refund', 'quote', 'ledger', 'payout', 'tax', 'discount'];
const SAY = '接著處理下一個模組：先讀檔，再改程式與規格，最後提交。';
const DONE = 'DONE\n摘要：八個模組都改用新的 format()，規格全數通過。';

// Forty-five calls that keep all four: per module a Read, two Edits, the lint
// and a formatted commit, for seven modules; then the eighth module's Read,
// five spec runs that touch no constraint (steps 37 to 41), and the eighth's
// two Edits, lint and commit.
function keepAll() {
    const steps = [];
    const module = (m) => {
        steps.push(['Read', { file_path: 'lib/' + m + '.js' }]);
        steps.push(['Edit', { file_path: 'lib/' + m + '.js' }]);
        steps.push(['Edit', { file_path: 'spec/' + m + '.spec.js' }]);
        steps.push(['Bash', { command: 'node scripts/lint.js' }]);
        steps.push(['Bash', { command: 'git add -A && git commit -m "drift(' + m + '): use format()"' }]);
    };
    MODULES.slice(0, 7).forEach(module);
    steps.push(['Read', { file_path: 'lib/discount.js' }]);
    for (let i = 0; i < 5; i++) steps.push(['Bash', { command: 'node --test spec/' + MODULES[i] + '.spec.js' }]);
    steps.push(['Edit', { file_path: 'lib/discount.js' }]);
    steps.push(['Edit', { file_path: 'spec/discount.spec.js' }]);
    steps.push(['Bash', { command: 'node scripts/lint.js' }]);
    steps.push(['Bash', { command: 'git add -A && git commit -m "drift(discount): use format()"' }]);
    return steps;
}

// One sidechain transcript: before step n the text texts[n] when given, else
// SAY before every fifth step; then the call, whose request q<n> carries
// 1000 × n tokens of context; `final` after the last call.
function transcript(steps, texts = {}, final = DONE, model = 'claude-haiku-5-5') {
    const file = path.join(tmp('fankeel-drift-'), 'agent-a1.jsonl');
    const line = (o) => JSON.stringify(o) + '\n';
    const msg = (n, content) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + n,
        message: { model, usage: { input_tokens: 1000 * n, output_tokens: 10 }, content } });
    let text = '';
    steps.forEach(([name, input], i) => {
        const n = i + 1;
        const say = n in texts ? texts[n] : (n % 5 === 0 ? SAY : '');
        if (say) text += msg(n, [{ type: 'text', text: say }]);
        text += msg(n, [{ type: 'tool_use', id: 't' + n, name, input }]);
        text += line({ type: 'user', isSidechain: true, message: { content: [{ type: 'tool_result', tool_use_id: 't' + n, content: 'ok' }] } });
    });
    text += msg(steps.length + 1, [{ type: 'text', text: final }]);
    fs.writeFileSync(file, text);
    return file;
}

test('forty-five steps that keep all four have no violation, and every row says what it was subject to', () => {
    const rows = drift.driftSteps(transcript(keepAll()));
    assert.equal(rows.length, 45);
    const s = drift.driftSummary(rows);
    assert.equal(s.firstViolation, null);
    assert.deepEqual(rows[1], { step: 2, tool: 'Edit', context: 2000, applies: ['vendor', 'lint-every-3'], broke: [] });
    assert.deepEqual(rows[4].applies, ['vendor', 'commit-format', 'zh-Hant']);
    assert.deepEqual(s.byConstraint['commit-format'], { applicable: 8, broke: 0 });
    assert.deepEqual(s.byConstraint['zh-Hant'], { applicable: 9, broke: 0 });
    assert.deepEqual(drift.CONSTRAINTS, ['vendor', 'lint-every-3', 'commit-format', 'zh-Hant']);
});

test('the same history with vendor/ edited at step 40 and put back at 41 breaks first at 40, though the files end the same', () => {
    const steps = keepAll();
    steps[39] = ['Edit', { file_path: 'C:\\tmp\\run\\vendor\\fmt\\index.js' }];
    steps[40] = ['Edit', { file_path: 'C:\\tmp\\run\\vendor\\fmt\\index.js' }];
    const rows = drift.driftSteps(transcript(steps));
    const s = drift.driftSummary(rows);
    assert.equal(s.firstViolation, 40);
    assert.deepEqual([rows[39].broke, rows[40].broke], [['vendor'], ['vendor']]);
    assert.deepEqual(s.bySteps.map((b) => [b.at, b.applicable - b.kept]), [[1, 0], [11, 0], [21, 0], [31, 1], [41, 1]]);
    assert.deepEqual(s.byContext.map((b) => b.at), [0, 20000, 40000]);
});

test('each constraint broken alone is the only one broken, at its own step', () => {
    const lint = keepAll();
    lint[33] = ['Bash', { command: 'node --test spec/tax.spec.js' }];
    const commit = keepAll();
    commit[4] = ['Bash', { command: 'git add -A && git commit -m "use format() in invoice"' }];
    const sed = keepAll();
    sed[39] = ['Bash', { command: 'sed -i s/oldFormat/format/ vendor/fmt/index.js' }];
    const cases = [
        [transcript(lint), 43, ['lint-every-3']],
        [transcript(commit), 5, ['commit-format']],
        [transcript(sed), 40, ['vendor']],
        [transcript(keepAll(), { 10: 'Now editing the next module and then its spec file.' }), 10, ['zh-Hant']],
        [transcript(keepAll(), { 10: '现在处理下一个模块，然后更新它的规格档案并提交。' }), 10, ['zh-Hant']],
        [transcript(keepAll(), {}, 'DONE\nAll eight modules now call format() and every spec passes.'), 45, ['zh-Hant']],
    ];
    for (const [file, step, broke] of cases) {
        const rows = drift.driftSteps(file);
        assert.equal(drift.driftSummary(rows).firstViolation, step, broke.join());
        assert.deepEqual(rows.flatMap((r) => r.broke), broke);
    }
});

module.exports = { MODULES, keepAll, transcript };
