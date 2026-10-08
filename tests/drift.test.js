'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const drift = require('../lib/drift.js');
const bench = require('../lib/bench.js');
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

const ROOT = path.join(__dirname, '..');
const DRIFT = path.join(ROOT, 'bench', 'drift');
const SCRIPT = path.join(ROOT, 'scripts', 'bench.js');
const cli = require('../scripts/bench.js');

test('bench/drift: check.sh passes its pass control and fails each fail control on its own class', () => {
    assert.deepEqual(bench.selftest(DRIFT, { ...tmp.selfOpts(bench.posix(ROOT)), classes: true }), []);
});

test('bench/drift/input.md lets the implementer change the eight modules and their specs, and says nothing of the constraints', () => {
    const md = fs.readFileSync(path.join(DRIFT, 'input.md'), 'utf8');
    const listed = [...md.matchAll(/^- (?:Modify|Test): `([^`]+)`/gm)].map((m) => m[1]).sort();
    assert.deepEqual(listed, MODULES.flatMap((m) => ['lib/' + m + '.js', 'spec/' + m + '.spec.js']).sort());
    assert.doesNotMatch(md, /lint|drift\(|vendor|繁體/);
});

test('reinject answers only a subagent, every fifth of its calls, with constraints.md, and logs each injection', () => {
    const reinject = require('../bench/drift/reinject.js');
    const dir = tmp('fankeel-drift-re-');
    const text = fs.readFileSync(path.join(DRIFT, 'constraints.md'), 'utf8').trim();
    assert.ok(text.length <= 600, text.length + ' characters');
    const call = (agent) => reinject.decide({ hook_event_name: 'PostToolUse', agent_id: agent }, dir, text);
    assert.equal(reinject.decide({ hook_event_name: 'PostToolUse' }, dir, text), null);
    const outs = Array.from({ length: 10 }, () => call('a1'));
    assert.deepEqual(outs.map((o, i) => (o ? i + 1 : 0)).filter(Boolean), [5, 10]);
    assert.equal(outs[4].hookSpecificOutput.additionalContext, text);
    assert.equal(call('b2'), null);
    const log = fs.readFileSync(path.join(dir, '.bench', 'reinject.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(log, [{ step: 5, chars: text.length }, { step: 10, chars: text.length }]);
    assert.equal(reinject.EVERY, 5);
});

test('reinject.js as a hook: silent on the relay, the fifth subagent call gets the constraints, bad input exits 0', () => {
    const dir = tmp('fankeel-drift-hook-');
    const hook = (payload) => spawnSync(process.execPath, [path.join(DRIFT, 'reinject.js')], { input: payload, encoding: 'utf8' });
    assert.equal(hook(JSON.stringify({ hook_event_name: 'PostToolUse', cwd: dir })).stdout, '');
    let last;
    for (let i = 0; i < 5; i++) last = hook(JSON.stringify({ hook_event_name: 'PostToolUse', agent_id: 'a1', cwd: dir }));
    assert.equal(last.status, 0);
    assert.equal(JSON.parse(last.stdout).hookSpecificOutput.additionalContext, fs.readFileSync(path.join(DRIFT, 'constraints.md'), 'utf8').trim());
    assert.equal(hook('{not json').status, 0);
});

const SESSION = '11111111-2222-3333-4444-555555555555';

// One copied drift run: the relay's transcript dispatching `prompt` once to
// the implementer, the implementer's own transcript from `steps`, and the
// reinjection log when one is given.
function driftRaw(root, tag, { prompt, model, steps, log }) {
    const dir = path.join(root, tag);
    const sub = path.join(dir, SESSION, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const line = (o) => JSON.stringify(o) + '\n';
    fs.writeFileSync(path.join(dir, SESSION + '.jsonl'),
        line({ type: 'assistant', requestId: 'm1', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 10 },
            content: [{ type: 'tool_use', id: 'tu0', name: 'Agent', input: { subagent_type: 'fankeel:fankeel-implementer', prompt } }] } })
        + line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu0', content: [{ type: 'text', text: 'DONE' }] }] } }));
    fs.copyFileSync(transcript(steps, {}, DONE, model), path.join(sub, 'agent-a1.jsonl'));
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-implementer' }));
    if (log) fs.writeFileSync(path.join(dir, 'reinject.log'), log.map((x) => JSON.stringify(x) + '\n').join(''));
}

// A batch directory holding one valid haiku drift run.
function driftBatch() {
    const batch = tmp('fankeel-drift-batch-');
    driftRaw(path.join(batch, 'raw'), 'drift-r1-haiku', { prompt: 'P\n', model: 'claude-haiku-5-5', steps: keepAll() });
    fs.writeFileSync(path.join(batch, 'runs.jsonl'), JSON.stringify({ kind: 'drift', tag: 'drift-r1-haiku', arm: 'haiku', model: 'haiku',
        reinject: false, input: 'P\n', pass: true, check: 'pass', claudeUsd: 0.1 }) + '\n');
    return batch;
}

test('driftTally: a valid run needs thirty calls, and an injection log only on a reinject arm; each arm sums its valid runs', () => {
    const raw = tmp('fankeel-drift-raw-');
    const prompt = 'CONSTRAINTS\n\nTASK\n';
    const late = keepAll();
    late[39] = ['Edit', { file_path: 'vendor/fmt/index.js' }];
    driftRaw(raw, 'drift-r1-haiku', { prompt, model: 'claude-haiku-5-5', steps: keepAll() });
    driftRaw(raw, 'drift-r1-haiku-reinject', { prompt, model: 'claude-haiku-5-5', steps: late, log: [{ step: 5, chars: 300 }, { step: 10, chars: 300 }] });
    driftRaw(raw, 'drift-r2-haiku', { prompt, model: 'claude-haiku-5-5', steps: keepAll().slice(0, 20) });
    driftRaw(raw, 'drift-r2-haiku-reinject', { prompt, model: 'claude-haiku-5-5', steps: keepAll() });
    driftRaw(raw, 'drift-r1-sonnet', { prompt, model: 'claude-sonnet-5-5', steps: keepAll(), log: [{ step: 5, chars: 300 }] });
    const row = (tag, arm, pass) => ({ kind: 'drift', tag, arm, model: drift.DRIFT_ARMS[arm].model, reinject: drift.DRIFT_ARMS[arm].reinject,
        input: prompt, pass, check: pass ? 'pass' : 'fail wrong: x', claudeUsd: 0.1 });
    const t = drift.driftTally([
        row('drift-r1-haiku', 'haiku', true),
        row('drift-r1-haiku-reinject', 'haiku-reinject', true),
        row('drift-r2-haiku', 'haiku', true),
        row('drift-r2-haiku-reinject', 'haiku-reinject', false),
        row('drift-r1-sonnet', 'sonnet', true),
    ], raw);
    const why = (tag) => t.runs.find((r) => r.tag === tag).why.join('; ');
    assert.equal(why('drift-r1-haiku'), '');
    assert.match(why('drift-r2-haiku'), /made 20 tool calls, under 30/);
    assert.match(why('drift-r2-haiku-reinject'), /no injection in its log/);
    assert.match(why('drift-r1-sonnet'), /injection log on an arm without reinjection/);
    const cell = (arm) => t.cells.find((c) => c.arm === arm);
    assert.deepEqual([cell('haiku').runs, cell('haiku').valid, cell('haiku').passed, cell('haiku').clean], [2, 1, 1, 1]);
    const re = cell('haiku-reinject');
    assert.deepEqual([re.valid, re.clean, re.medianFirst, re.injections, re.injectedChars], [1, 0, 40, 2, 600]);
    assert.equal(cell('sonnet').valid, 0);
    assert.match(drift.driftSummaryMd(t), /\| haiku-reinject \| 2 \| 1 \| 1 \| 0 \| 40 \| /);
});

test('drift --dry prints one line per run, the reinject arms with --settings and the haiku arms with the override', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'drift', '--runs', '1', '--dry'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^drift-r1-sonnet model=sonnet reinject=false .*profile: \(none\)$/);
    assert.match(lines[3], /^drift-r1-haiku-reinject model=haiku reinject=true .*--settings \.bench\/settings\.json profile: agent\.fankeel-implementer\.model=haiku$/);
    assert.equal(drift.reinjectSettings('/plug').hooks.PostToolUse[0].hooks[0].command, 'node "/plug/bench/drift/reinject.js"');
    assert.match(drift.driftPrompt(DRIFT), /^開始之前[\s\S]*\n\n## Task 1: format\(\) in place of oldFormat\(\)/);
});

test('tally on a drift batch writes the 2×2 summary', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'tally', driftBatch(), '--evidence', tmp('fankeel-drift-ev-')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^\| arm \| runs \| valid \| task passed \|/);
    assert.match(r.stdout, /\| haiku \| 1 \| 1 \| 1 \| 1 \| - \|/);
});

test('a reinject run gets a settings file whose PostToolUse hook names reinject.js by absolute path, and --settings to that file', () => {
    const dir = tmp('fankeel-drift-set-');
    const args = drift.reinjectArgs(ROOT, dir, true);
    const file = path.join(dir, '.bench', 'settings.json');
    assert.deepEqual(args, ['--settings', bench.posix(file)]);
    const hook = JSON.parse(fs.readFileSync(file, 'utf8')).hooks.PostToolUse[0].hooks[0].command;
    assert.equal(hook, 'node "' + bench.posix(path.join(ROOT, 'bench', 'drift', 'reinject.js')) + '"');
});

test('a plain run gets no settings file and no --settings argument', () => {
    const dir = tmp('fankeel-drift-plain-');
    assert.deepEqual(drift.reinjectArgs(ROOT, dir, false), []);
    assert.equal(fs.existsSync(path.join(dir, '.bench')), false);
});

test('keepReinjectLog copies a run\'s reinject.log into its raw directory, and does nothing when the run has none', () => {
    const run = tmp('fankeel-drift-log-run-');
    const raw = tmp('fankeel-drift-log-raw-');
    drift.keepReinjectLog(run, raw);
    assert.equal(fs.existsSync(path.join(raw, 'reinject.log')), false);
    fs.mkdirSync(path.join(run, '.bench'));
    fs.writeFileSync(path.join(run, '.bench', 'reinject.log'), '{"step":5,"chars":300}\n');
    drift.keepReinjectLog(run, raw);
    assert.equal(fs.readFileSync(path.join(raw, 'reinject.log'), 'utf8'), '{"step":5,"chars":300}\n');
});

test('runJob hands claude --settings, naming a file that points reinject.js in, for a reinject job and nothing for a plain one', async () => {
    const item = tmp('fankeel-drift-item-');
    fs.writeFileSync(path.join(item, 'setup.sh'), 'exit 0\n');
    const seen = [];
    const spawn = async (args) => {
        const i = args.indexOf('--settings');
        seen.push({ args, settings: i < 0 ? null : fs.readFileSync(args[i + 1], 'utf8') });
        return { status: 0, stdout: '', stderr: '' };
    };
    const job = (arm, reinject) => ({ tag: 't-' + arm, arm, model: 'sonnet', round: 1, seed: 1, itemDir: item, reinject,
        row: { kind: 'drift', reinject, input: 'P\n' } });
    const ctx = { agent: 'fankeel-implementer', cap: 1, keep: false, timeoutMs: 1000, spawn,
        batchDir: tmp('fankeel-drift-batch-'), mkdtemp: () => tmp('fankeel-drift-run-') };
    await cli.runJob(ctx, job('sonnet-reinject', true));
    await cli.runJob(ctx, job('sonnet', false));
    const hook = JSON.parse(seen[0].settings).hooks.PostToolUse[0].hooks[0].command;
    assert.equal(hook, 'node "' + bench.posix(path.join(ROOT, 'bench', 'drift', 'reinject.js')) + '"');
    assert.equal(seen[1].args.includes('--settings'), false);
});

test('verdicts apply the design\'s two rulings at their edges', () => {
    const cell = (arm, passed, clean, usdMean) => ({ arm, valid: 10, passed, clean, usdMean });
    const v = drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('haiku', 8, 7, 0.05), cell('sonnet-reinject', 9, 10, 0.59), cell('haiku-reinject', 8, 8, 0.05)]);
    assert.deepEqual([v.longTask.holds, v.worth.sonnet.holds, v.worth.haiku.holds], [true, true, false]);
    assert.equal(drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('haiku', 7, 8, 0.05)]).longTask.holds, false);
    assert.equal(drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('sonnet-reinject', 9, 10, 0.61)]).worth.sonnet.holds, false);
});

test('reportMd states both answers with the noise note beside each, and prints the bank table and the 2×2', () => {
    const c = (arm, clean, usdMean) => ({ arm, model: arm.replace('-reinject', ''), reinject: arm.endsWith('-reinject'), runs: 10, valid: 10, passed: 9, clean,
        medianFirst: 31, bySteps: [{ at: 1, kept: 9, applicable: 10 }], byContext: [{ at: 20000, kept: 1, applicable: 2 }],
        injections: 0, injectedChars: 0, usdMean, promptMean: 900000 });
    const roles = [{ tiers: [{ role: 'reader', arm: 'haiku', tier: 'trap', runs: 12, valid: 12, passed: 10, classes: { fabricated: 2 } }] }];
    const md = drift.reportMd({ date: '2026-10-10', roles, drift: { cells: [c('sonnet', 8, 0.5), c('haiku', 7, 0.05)] }, batches: ['.fankeel/build/bench/drift-x'] });
    assert.match(md, /^---\nstatus: current\nlast_verified: 2026-10-10\n/);
    assert.equal(md.split('每格十次時，差一次只是雜訊。').length - 1, 3);
    assert.match(md, /\| reader \| haiku \| trap \| 12 \| 12 \| 10 \| 0 \| 2 \| 0 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /\| sonnet \| 10 \| 10 \| 9 \| 8 \| 31 \| 1-10 90% \| 20K 50% \|/);
    assert.match(md, /`node scripts\/bench\.js tally \.fankeel\/build\/bench\/drift-x`/);
});

test('report re-tallies the batches it is given and writes the page to --out', () => {
    const out = path.join(tmp('fankeel-drift-out-'), 'r.md');
    const r = spawnSync(process.execPath, [SCRIPT, 'report', driftBatch(), '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(fs.readFileSync(out, 'utf8'), /\| haiku \| 1 \| 1 \| 1 \| 1 \| - \|/);
    assert.equal(spawnSync(process.execPath, [SCRIPT, 'report'], { encoding: 'utf8' }).status, 1);
});

module.exports = { MODULES, keepAll, transcript, driftBatch };
