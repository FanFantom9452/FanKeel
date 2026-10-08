'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bench = require('../lib/bench.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'bench.js');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, a + ' vs ' + b);

// A bench root holding one project, `p`, with the files given.
function project(files) {
    const root = tmp('fankeel-bench-proj-');
    for (const [rel, text] of Object.entries(files)) {
        const file = path.join(root, 'p', rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
    }
    return root;
}

test('cleanup passes retry options and swallows a failing rm with one warning', () => {
    const seen = [];
    const warns = [];
    assert.equal(bench.cleanup('D', (d, o) => seen.push([d, o]), (m) => warns.push(m)), null);
    assert.equal(seen[0][1].maxRetries > 0 && seen[0][1].retryDelay > 0, true);
    const left = bench.cleanup('D', () => { throw new Error('EPERM'); }, (m) => warns.push(m));
    assert.equal(left, 'D');
    assert.equal(warns.length, 1);
    assert.match(warns[0], /D.*EPERM/);
});

const selfOpts = () => tmp.selfOpts('unused');

test('arms alternate by round parity, and the seed is the round', () => {
    assert.deepEqual(bench.order(['base', 'sub'], 3).map((x) => x.round + x.arm + x.seed),
        ['1base1', '1sub1', '2sub2', '2base2', '3base3', '3sub3']);
});

test('--dry prints one line per run, each carrying its arm\'s assignment and the claude command', () => {
    const root = project({ 'bench.json': JSON.stringify({ title: 't', route: 'build,verify', seeded: true, arms: ['base', 'sub'] }), 'task.md': 'x\n' });
    const r = spawnSync(process.execPath, [SCRIPT, 'run', 'p', '--arms', 'base,sub', '--runs', '2', '--cap', '5', '--dry', '--projects', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^r1 p base seed=1 impl=sonnet route=build,verify cap=\$5 claude -p .*--permission-mode bypassPermissions .*profile: \(none\)$/);
    assert.match(lines[1], /^r1 p sub seed=1 .*agent\.fankeel-reader\.model=haiku agent\.fankeel-reader\.effort=high/);
    assert.match(lines[2], /^r2 p sub seed=2 /);
    assert.match(lines[3], /^r2 p base seed=2 /);
});

test('run refuses an arm its project does not list, before anything runs', () => {
    const root = project({ 'bench.json': JSON.stringify({ title: 't', route: null, seeded: false, arms: ['base', 'reviewer'] }), 'task.md': 'x\n' });
    const r = spawnSync(process.execPath, [SCRIPT, 'run', 'p', '--arms', 'base,impl', '--runs', '1', '--cap', '5', '--dry', '--projects', root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not impl/);
});

test('stagePrompts starts the task, then sends one prompt per stage, the task text with the first', () => {
    const p = bench.stagePrompts({ title: 'Fix it', route: 'build,verify' }, 'TASK BODY', 'U1', '/plug');
    assert.equal(p.length, 3);
    assert.match(p[0], /node \/plug\/scripts\/task\.js start --session U1 --task "Fix it" --route build,verify$/);
    assert.match(p[1], /^Do the build stage[\s\S]*task\.js stage verify --session U1, and stop\.\n\nThe task:\nTASK BODY$/);
    assert.match(p[2], /^Do the verify stage .* and stop\.$/);
});

test('selftest names a project with no controls/fail, passes one judged right both ways, and catches a check that passes everything', () => {
    const root = project({
        'setup.sh': 'echo start > state.txt\n',
        'check.sh': 'grep -q good "$1/state.txt"\n',
        'controls/pass/state.txt': 'good\n',
    });
    const p = path.join(root, 'p');
    assert.deepEqual(bench.selftest(p, selfOpts()), ['p: no controls/fail']);
    fs.mkdirSync(path.join(p, 'controls', 'fail'), { recursive: true });
    fs.writeFileSync(path.join(p, 'controls', 'fail', 'state.txt'), 'bad\n');
    assert.deepEqual(bench.selftest(p, selfOpts()), []);
    fs.writeFileSync(path.join(p, 'check.sh'), 'exit 0\n');
    const errors = bench.selftest(p, selfOpts());
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^p fail: check\.sh exited 0, wanted non-zero/);
});

test('aliasVerdict passes only when every claude-haiku id in modelUsage is Haiku 5.5', () => {
    assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-haiku-5-5': {} } }).ok, true);
    assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-haiku-5-5-20261001': {} } }).ok, true);
    const old = bench.aliasVerdict({ modelUsage: { 'claude-haiku-4-5-20251001': {} } });
    assert.equal(old.ok, false);
    assert.match(old.why, /claude-haiku-4-5-20251001/);
    assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-sonnet-5-5': {} } }).ok, false);
    assert.equal(bench.aliasVerdict(null).ok, false);
});

// One copied run: the controller's transcript and, per agent, its sidechain
// transcript and the meta.json that names its type.
function rawRun(root, tag, agents) {
    const session = '11111111-2222-3333-4444-555555555555';
    const dir = path.join(root, tag);
    const sub = path.join(dir, session, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const line = (o) => JSON.stringify(o) + '\n';
    fs.writeFileSync(path.join(dir, session + '.jsonl'), line({ type: 'assistant', requestId: 'm1',
        message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 1000, output_tokens: 100 } } }));
    agents.forEach(([type, model, cacheRead], i) => {
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.jsonl'), line({ type: 'assistant', isSidechain: true, requestId: 'r' + i,
            message: { model, usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: cacheRead } } }));
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.meta.json'), JSON.stringify({ agentType: type }));
    });
}

test('tally: a haiku role that ran on another model makes its run invalid, and the money adds up three ways', () => {
    const raw = tmp('fankeel-bench-raw-');
    rawRun(raw, 'r1-sub', [['fankeel:fankeel-verifier', 'claude-haiku-5-5', 120000], ['fankeel:fankeel-implementer', 'claude-sonnet-5-5', 0]]);
    rawRun(raw, 'r2-sub', [['fankeel:fankeel-verifier', 'claude-sonnet-5-5', 50]]);
    const t = bench.tally([
        { tag: 'r1-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
        { tag: 'r2-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
    ], raw);
    assert.equal(t.runs[0].valid, true);
    assert.equal(t.runs[0].over100k, 1);
    assert.equal(t.runs[1].valid, false);
    assert.match(t.runs[1].mismatched[0], /fankeel-verifier ran claude-sonnet-5-5/);
    // Recomputed by hand from the rates: the controller on Sonnet 5.5, the
    // verifier's 120,010-token prompt on Haiku 5.5's over-100K row.
    const controller = (1000 * 2 + 100 * 10) / 1e6;
    near(t.runs[0].usd, controller + (10 * 0.5 + 20 * 2.5 + 120000 * 0.05) / 1e6 + (10 * 2 + 20 * 10) / 1e6);
    near(t.runs[1].usd, controller + (10 * 2 + 20 * 10 + 50 * 0.2) / 1e6);
    const arm = t.arms.find((a) => a.arm === 'sub');
    near(arm.usd, t.runs[0].usd + t.runs[1].usd);
    assert.deepEqual([arm.runs, arm.valid, arm.passed], [2, 1, 1]);
    assert.deepEqual(bench.verdict(t.arms), {});
});

test('verdict picks the cheapest arm that passed n/n on valid runs', () => {
    assert.deepEqual(bench.verdict([
        { project: 'p', arm: 'base', runs: 3, valid: 3, passed: 3, usd: 2 },
        { project: 'p', arm: 'sub', runs: 3, valid: 3, passed: 3, usd: 1 },
        { project: 'p', arm: 'impl', runs: 3, valid: 3, passed: 2, usd: 0.5 },
    ]), { p: 'sub' });
});

test('tally records each role\'s first-request prompt size and its cache hit rate', () => {
    const raw = tmp('fankeel-bench-raw-');
    rawRun(raw, 'r1-sub', [['fankeel:fankeel-verifier', 'claude-haiku-5-5', 120000]]);
    const role = bench.tally([{ tag: 'r1-sub', project: 'p', arm: 'sub', pass: true, requires: [] }], raw).runs[0].roles['fankeel-verifier'];
    assert.deepEqual(role.prefix, [120010]);
    near(role.hitRate, 120000 / 120010);
});

test('tally: a required role that never ran, or an arm none of whose roles ran, makes the run invalid', () => {
    const raw = tmp('fankeel-bench-raw-');
    rawRun(raw, 'r1-base', [['fankeel:fankeel-verifier', 'claude-sonnet-5-5', 0]]);
    rawRun(raw, 'r1-sub', [['fankeel:fankeel-implementer', 'claude-sonnet-5-5', 0]]);
    const t = bench.tally([
        { tag: 'r1-base', project: 'p', arm: 'base', pass: true, requires: ['fankeel-reviewer'] },
        { tag: 'r1-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
    ], raw);
    assert.equal(t.runs[0].valid, false);
    assert.deepEqual(t.runs[0].unexercised, ['fankeel-reviewer']);
    assert.equal(t.runs[1].valid, false);
    assert.deepEqual(t.runs[1].unexercised, ['none of fankeel-reader, fankeel-mover, fankeel-mutator, fankeel-verifier']);
});

test('tally: a row already carrying an error, or with no transcript, is never valid', () => {
    const raw = tmp('fankeel-bench-raw-');
    rawRun(raw, 'r1-base', []);
    const t = bench.tally([
        { tag: 'r1-base', project: 'p', arm: 'base', pass: true, requires: [], error: 'capped' },
        { tag: 'r2-base', project: 'p', arm: 'base', pass: true, requires: [] },
    ], raw);
    assert.equal(t.runs[0].valid, false);
    assert.equal(t.runs[0].error, 'capped');
    assert.equal(t.runs[1].valid, false);
    assert.match(t.runs[1].error, /^no transcript in /);
    assert.equal(t.arms[0].valid, 0);
});

test('tally: a sub-arm agent whose meta.json is missing or unparseable makes the run invalid', () => {
    const raw = tmp('fankeel-bench-raw-');
    rawRun(raw, 'r1-sub', [['fankeel:fankeel-verifier', 'claude-haiku-5-5', 0]]);
    rawRun(raw, 'r2-sub', [['fankeel:fankeel-verifier', 'claude-haiku-5-5', 0], ['fankeel:fankeel-reader', 'claude-haiku-5-5', 0]]);
    const sub = path.join(raw, 'r2-sub', '11111111-2222-3333-4444-555555555555', 'subagents');
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), '{not json');
    fs.rmSync(path.join(sub, 'agent-a0.meta.json'));
    const t = bench.tally([
        { tag: 'r1-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
        { tag: 'r2-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
    ], raw);
    assert.equal(t.runs[0].valid, true);
    assert.equal(t.runs[1].valid, false);
    assert.equal(t.runs[1].mismatched.length, 2);
    assert.match(t.runs[1].mismatched[0], /role unreadable/);
});

test('callError reports a spawn error, a null status and a non-zero exit, and passes a clean exit', () => {
    assert.match(bench.callError({ error: new Error('ENOENT'), status: null }), /did not run: ENOENT/);
    assert.match(bench.callError({ status: null, stderr: '' }), /exited null/);
    assert.match(bench.callError({ status: 2, stderr: ' boom \n' }), /exited 2: boom$/);
    assert.equal(bench.callError({ status: 0, stderr: 'warn' }), null);
});

test('summaryMd renders the arm table, the run table with why-not-valid, and the verdict', () => {
    const arms = [{ project: 'p', arm: 'base', runs: 1, valid: 1, passed: 1, usd: 0.5 }, { project: 'q', arm: 'sub', runs: 1, valid: 0, passed: 0, usd: 1 }];
    const md = bench.summaryMd({ arms, runs: [
        { tag: 'r1-base', arm: 'base', valid: true, pass: true, usd: 0.5, over100k: 0, wakes: 0, wallS: 3 },
        { tag: 'r1-sub', arm: 'sub', valid: false, pass: false, usd: 1, error: 'capped' },
    ] });
    assert.match(md, /\| p \| base \| 1 \| 1 \| 1 \| 0\.5000 \|/);
    assert.match(md, /\| r1-base \| base \| true \| true \| 0\.5000 \| 0 \| 0 \| 3 \|  \|/);
    assert.match(md, /\| r1-sub \| sub \| false \| false \| 1\.0000 \| 0 \| 0 \| 0 \| capped \|/);
    assert.match(md, /- p: base\n- q: none\n$/);
});

test('selftest reports a setup.sh that fails, once per control', () => {
    const root = project({ 'setup.sh': 'echo nope >&2\nexit 3\n', 'check.sh': 'exit 0\n', 'controls/pass/x': '1', 'controls/fail/x': '2' });
    const errors = bench.selftest(path.join(root, 'p'), selfOpts());
    assert.equal(errors.length, 2);
    assert.match(errors[0], /^p pass: setup\.sh exited 3 — nope/);
});

test('stagePrompts with a single stage sends the task with it and names no next stage', () => {
    const p = bench.stagePrompts({ title: 'T', route: 'build' }, 'BODY', 'U1', '/plug');
    assert.equal(p.length, 2);
    assert.match(p[1], /^Do the build stage .* option one yourself and stop\.\n\nThe task:\nBODY$/);
    assert.doesNotMatch(p[1], /task\.js stage/);
});

const INPUT = 'Answer three questions.\n\n1. What is RETRY_LIMIT?\n';

// One copied role run: the relay's transcript, holding one Agent tool_use per
// prompt and the tool_result for each, then per agent its sidechain
// transcript and the meta.json naming its type.
function roleRaw(root, tag, { prompts, agents, result, notification }) {
    const session = '11111111-2222-3333-4444-555555555555';
    const dir = path.join(root, tag);
    const sub = path.join(dir, session, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const line = (o) => JSON.stringify(o) + '\n';
    let text = line({ type: 'assistant', requestId: 'm1', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 1000, output_tokens: 100 },
        content: prompts.map((p, i) => ({ type: 'tool_use', id: 'tu' + i, name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', model: 'sonnet', prompt: p } })) } });
    prompts.forEach((p, i) => {
        text += line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu' + i, content: [{ type: 'text', text: result }] }] } });
    });
    if (notification) {
        text += line({ type: 'user', origin: { kind: 'task-notification' },
            message: { content: '<task-notification><tool-use-id>tu0</tool-use-id>' + notification + '</task-notification>' } });
    }
    fs.writeFileSync(path.join(dir, session + '.jsonl'), text);
    agents.forEach(([type, model], i) => {
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.jsonl'), line({ type: 'assistant', isSidechain: true, requestId: 'r' + i,
            message: { model, usage: { input_tokens: 10, output_tokens: 20 } } }));
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.meta.json'), JSON.stringify({ agentType: type }));
    });
}

test('relayPrompt carries input.md word for word between its markers, and names the plugin agent and sonnet', () => {
    const p = bench.relayPrompt('fankeel-mutator', INPUT);
    assert.ok(p.includes('<<<BENCH INPUT\n' + INPUT.trim() + '\nBENCH INPUT>>>'), p);
    assert.match(p, /subagent_type "fankeel:fankeel-mutator", model "sonnet"/);
    assert.deepEqual(bench.claudeArgs('/plug', 'haiku').slice(-4), ['--model', 'haiku', '--output-format', 'json']);
    assert.deepEqual(bench.claudeArgs('/plug').slice(-4), ['--model', 'sonnet', '--output-format', 'json']);
});

test('roleFigures: one dispatch of input.md, on the arm\'s model, is valid; the role\'s money leaves the relay out', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'r1-haiku', { prompts: [INPUT.replace(/\n/g, '\r\n') + '\n'], agents: [['fankeel:fankeel-reader', 'claude-haiku-5-5']], result: '1. 7 — lib/a.js:3' });
    const f = bench.roleFigures(path.join(raw, 'r1-haiku'), 'fankeel-reader', 'haiku', INPUT);
    assert.deepEqual(f.why, []);
    assert.equal(f.valid, true);
    assert.equal(f.result, '1. 7 — lib/a.js:3');
    assert.deepEqual(f.models, ['claude-haiku-5-5']);
    // By hand from the rates: the role on Haiku 5.5, the relay on Haiku 5.5.
    near(f.roleUsd, (10 * 0.1 + 20 * 0.5) / 1e6);
    near(f.relayUsd, (1000 * 0.1 + 100 * 0.5) / 1e6);
});

test('roleFigures: no dispatch, two, a changed prompt, the role on the other arm\'s model, or another agent each make the run invalid', () => {
    const raw = tmp('fankeel-bench-role-');
    const reader = [['fankeel:fankeel-reader', 'claude-haiku-5-5']];
    roleRaw(raw, 'none', { prompts: [], agents: [], result: '' });
    roleRaw(raw, 'two', { prompts: [INPUT, INPUT], agents: reader, result: 'x' });
    roleRaw(raw, 'changed', { prompts: ['Answer three questions.'], agents: reader, result: 'x' });
    roleRaw(raw, 'sonnet', { prompts: [INPUT], agents: [['fankeel:fankeel-reader', 'claude-sonnet-5-5']], result: 'x' });
    roleRaw(raw, 'other', { prompts: [INPUT], agents: [['fankeel:fankeel-mover', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'empty', { prompts: [INPUT], agents: reader, result: '' });
    const fig = (tag) => bench.roleFigures(path.join(raw, tag), 'fankeel-reader', 'haiku', INPUT);
    assert.match(fig('none').why.join('; '), /dispatched 0 times/);
    assert.match(fig('two').why.join('; '), /dispatched 2 times/);
    assert.match(fig('changed').why.join('; '), /differs from input\.md/);
    assert.match(fig('sonnet').why.join('; '), /ran claude-sonnet-5-5, not the haiku arm/);
    assert.match(fig('other').why.join('; '), /is fankeel-mover, not fankeel-reader/);
    assert.match(fig('empty').why.join('; '), /returned no text/);
    for (const tag of ['none', 'two', 'changed', 'sonnet', 'other', 'empty']) assert.equal(fig(tag).valid, false, tag);
    assert.match(bench.roleFigures(path.join(raw, 'missing'), 'fankeel-reader', 'haiku', INPUT).why[0], /^no transcript in /);
});

test('roleFigures: a task-notification result keeps only the text inside <result>', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'bg', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'Async agent launched',
        notification: '<status>completed</status><result>1. A\n2. B</result><usage>x</usage>' });
    const f = bench.roleFigures(path.join(raw, 'bg'), 'fankeel-reader', 'haiku', INPUT);
    assert.equal(f.result, '1. A\n2. B');
});

test('roleFigures: a background dispatch\'s task-notification is the result, not the launch acknowledgement', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'bg', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'Async agent launched', notification: 'THE ANSWER' });
    const f = bench.roleFigures(path.join(raw, 'bg'), 'fankeel-reader', 'haiku', INPUT);
    assert.match(f.result, /THE ANSWER/);
    assert.doesNotMatch(f.result, /launched/);
    assert.equal(f.valid, true);
});

test('roleTally: each role × arm row sums its runs, equals the money recomputed from the raw transcripts, and drops the input text', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'r1-sonnet', { prompts: [INPUT], agents: [['fankeel:fankeel-reader', 'claude-sonnet-5-5']], result: 'x' });
    roleRaw(raw, 'r1-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'r2-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'r3-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    const base = { role: 'reader', agent: 'fankeel-reader', input: INPUT, claudeUsd: 0.01 };
    const t = bench.roleTally([
        { ...base, tag: 'r1-sonnet', arm: 'sonnet', pass: true },
        { ...base, tag: 'r1-haiku', arm: 'haiku', pass: true },
        { ...base, tag: 'r2-haiku', arm: 'haiku', pass: false },
        { ...base, tag: 'r3-haiku', arm: 'haiku', pass: true, error: 'capped' },
    ], raw);
    const haiku = t.arms.find((a) => a.arm === 'haiku');
    assert.deepEqual([haiku.runs, haiku.valid, haiku.passed], [3, 2, 1]);
    near(haiku.roleUsd, t.runs[1].roleUsd + t.runs[2].roleUsd + t.runs[3].roleUsd);
    near(haiku.roleUsd, 3 * (10 * 0.1 + 20 * 0.5) / 1e6);
    near(t.arms.find((a) => a.arm === 'sonnet').roleUsd, (10 * 2 + 20 * 10) / 1e6);
    assert.equal(t.runs[3].valid, false);
    assert.equal(t.runs[3].why[0], 'capped');
    assert.equal(t.runs[0].input, undefined);
    const md = bench.roleSummaryMd(t);
    assert.match(md, /\| reader \| haiku \| 3 \| 2 \| 1 \| 0\.0000 \| 0\.0000 \| /);
    assert.match(md, /\| r3-haiku \| haiku \| false \| true \| .* \| capped \|/);
    assert.match(md, /- reader: not haiku\n$/);
});

test('roleSummaryMd: the verdict is haiku only when every haiku run was valid and passed', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'r1-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'r2-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    const base = { role: 'reader', agent: 'fankeel-reader', input: INPUT, claudeUsd: 0.01, arm: 'haiku' };
    const md = (passes) => bench.roleSummaryMd(bench.roleTally(passes.map((pass, i) => ({ ...base, tag: 'r' + (i + 1) + '-haiku', pass })), raw));
    assert.match(md([true, false]), /- reader: not haiku\n$/);
    assert.match(md([true, true]), /- reader: haiku\n$/);
});

test('role --dry with a malformed role.json exits 1 and names the parse error', () => {
    const root = tmp('fankeel-bench-roles-');
    fs.mkdirSync(path.join(root, 'roles', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'roles', 'x', 'role.json'), '{ not json');
    fs.writeFileSync(path.join(root, 'roles', 'x', 'input.md'), 'Q\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'role', 'x', '--dry', '--projects', root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /bench\.js: .*JSON/);
});

test('selftest runs a control\'s control.sh in the laid-out project and removes it before check.sh', () => {
    const root = project({
        'setup.sh': 'echo start > state.txt\n',
        'check.sh': '[ ! -e "$1/control.sh" ] && grep -q good "$1/state.txt"\n',
        'controls/pass/control.sh': 'echo good > state.txt\n',
        'controls/fail/control.sh': 'echo bad > state.txt\n',
    });
    const p = path.join(root, 'p');
    assert.deepEqual(bench.selftest(p, selfOpts()), []);
    fs.writeFileSync(path.join(p, 'controls', 'pass', 'control.sh'), 'exit 4\n');
    assert.match(bench.selftest(p, selfOpts())[0], /^p pass: control\.sh exited 4/);
    assert.match(bench.layControl(p, 'pass', tmp('fankeel-bench-lay-'), process.env), /^control\.sh exited 4/);
});

const PASSING_CHECK = 'grep -q good "$1/state.txt" && echo pass && exit 0\necho "fail wrong: state is not good"\nexit 1\n';

// One item's files under items/<id>/: a setup that writes state.txt, the
// check given, and per control a state.txt laid over it.
const itemFiles = (id, check, controls) => ({
    ['items/' + id + '/input.md']: 'Q\n',
    ['items/' + id + '/setup.sh']: 'echo start > state.txt\n',
    ['items/' + id + '/check.sh']: check,
    ...Object.fromEntries(Object.entries(controls).map(([c, text]) => ['items/' + id + '/controls/' + c + '/state.txt', text])),
});

test('roleItems lists the directories under items/, sorted, each with its tier; a file there is no item', () => {
    const root = project({ 'items/trap-b/input.md': 'B\n', 'items/easy-a/input.md': 'A\n', 'items/odd/input.md': 'O\n', 'items/judge.sh': 'true\n' });
    assert.deepEqual(bench.roleItems(path.join(root, 'p')).map((i) => [i.id, i.tier, i.input]),
        [['easy-a', 'easy', 'A\n'], ['odd', null, 'O\n'], ['trap-b', 'trap', 'B\n']]);
    assert.deepEqual(bench.roleItems(path.join(root, 'none')), []);
    assert.deepEqual(bench.TIERS, ['easy', 'mid', 'trap']);
    assert.equal(bench.tierOf('mid-x'), 'mid');
});

test('checkClass reads the class off check.sh\'s last line; controlClass reads it off a control\'s name', () => {
    assert.equal(bench.checkClass('noise\npass\n'), null);
    assert.equal(bench.checkClass('fail fabricated: question 2: lib/a.js:4 does not hold the answer'), 'fabricated');
    assert.equal(bench.checkClass('fail bogus: x'), 'unclassified');
    assert.equal(bench.checkClass('the commit message differs'), 'unclassified');
    assert.equal(bench.checkClass(''), 'unclassified');
    assert.deepEqual(['fail-extra', 'fail-extra-2', 'fail', 'fail-bogus', 'pass'].map(bench.controlClass), ['extra', 'extra', null, null, null]);
    assert.deepEqual(bench.CLASSES, ['wrong', 'fabricated', 'unrestored', 'extra', 'format']);
});

test('selftestRole passes an item whose controls draw their own classes, and names every way an item falls short', () => {
    const good = project(itemFiles('easy-a', PASSING_CHECK, { pass: 'good\n', 'fail-wrong': 'bad\n' }));
    assert.deepEqual(bench.selftestRole(path.join(good, 'p'), selfOpts()), []);
    const bad = project({
        ...itemFiles('easy-a', PASSING_CHECK, { pass: 'good\n', 'fail-extra': 'bad\n' }),
        ...itemFiles('mid-b', PASSING_CHECK, { pass: 'good\n', fail: 'bad\n' }),
        ...itemFiles('trap-c', 'grep -q good "$1/state.txt" && exit 0\necho "fail wrong: no"\nexit 1\n', { pass: 'good\n', 'fail-wrong': 'bad\n' }),
        ...itemFiles('hard-d', PASSING_CHECK, { pass: 'good\n', 'fail-wrong': 'bad\n' }),
        'items/easy-e/input.md': 'Q\n',
    });
    assert.deepEqual(bench.selftestRole(path.join(bad, 'p'), selfOpts()).map((e) => e.replace(/ — .*$/, '')), [
        'p/easy-a fail-extra: check.sh\'s last line names wrong, wanted extra',
        'p/easy-e: no setup.sh', 'p/easy-e: no check.sh', 'p/easy-e: no controls',
        'p/hard-d: the name starts with none of easy-, mid-, trap-',
        'p/mid-b fail: a fail control is named fail-<class>, the class one of wrong, fabricated, unrestored, extra, format',
        'p/trap-c pass: check.sh\'s last line names unclassified, wanted pass',
    ]);
    assert.deepEqual(bench.selftestRole(path.join(project({}), 'p'), selfOpts()), ['p: no items under items/']);
});

test('selftestRole runs every seed it is given, and each control sees that seed', () => {
    const root = project({
        'items/easy-s/input.md': 'Q\n',
        'items/easy-s/setup.sh': 'echo "$BENCH_SEED" > seed.txt\n',
        'items/easy-s/check.sh': '[ "$(cat "$1/seed.txt")" = "$BENCH_SEED" ] && [ -f "$1/ok" ] && echo pass && exit 0\necho "fail wrong: no"\nexit 1\n',
        'items/easy-s/controls/pass/control.sh': '[ "$(cat seed.txt)" = "$BENCH_SEED" ] && touch ok\n',
        'items/easy-s/controls/fail-wrong/control.sh': 'true\n',
    });
    assert.deepEqual(bench.selftestRole(path.join(root, 'p'), { ...selfOpts(), seeds: [1, 2, 3] }), []);
    fs.writeFileSync(path.join(root, 'p', 'items', 'easy-s', 'controls', 'pass', 'control.sh'), '[ "$BENCH_SEED" = 1 ] && touch ok\n');
    assert.deepEqual(bench.selftestRole(path.join(root, 'p'), { ...selfOpts(), seeds: [1, 2] }).map((e) => e.replace(/:.*$/, '')), ['p/easy-s seed 2 pass']);
});

test('roleTally counts each role × arm × tier, and each valid failure under the class its check named', () => {
    const raw = tmp('fankeel-bench-role-');
    for (const tag of ['easy-a-r1-haiku', 'easy-a-r2-haiku', 'trap-b-r1-haiku', 'trap-b-r2-haiku']) {
        roleRaw(raw, tag, { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    }
    const base = { role: 'reader', agent: 'fankeel-reader', input: INPUT, claudeUsd: 0.01, arm: 'haiku' };
    const t = bench.roleTally([
        { ...base, tag: 'easy-a-r1-haiku', item: 'easy-a', pass: true, check: 'pass' },
        { ...base, tag: 'easy-a-r2-haiku', item: 'easy-a', pass: false, check: 'fail format: no answer line' },
        { ...base, tag: 'trap-b-r1-haiku', item: 'trap-b', pass: false, check: 'fail fabricated: question 1: x' },
        { ...base, tag: 'trap-b-r2-haiku', item: 'trap-b', pass: false, check: 'fail wrong: q', error: 'capped' },
    ], raw);
    assert.deepEqual(t.tiers.map((x) => [x.tier, x.runs, x.valid, x.passed, x.classes]), [
        ['easy', 2, 2, 1, { format: 1 }],
        ['trap', 2, 1, 0, { fabricated: 1 }],
    ]);
    assert.equal(t.runs[2].class, 'fabricated');
    const md = bench.roleSummaryMd(t);
    assert.match(md, /\| reader \| haiku \| trap \| 2 \| 1 \| 0 \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /\| trap-b-r1-haiku \| haiku \| true \| false \| fabricated \|/);
});

test('role --dry prints one line per run — each item × each round × each arm — naming the item, the relay on haiku and the haiku arm\'s profile key', () => {
    const root = tmp('fankeel-bench-roles-');
    for (const id of ['easy-a', 'trap-b']) {
        fs.mkdirSync(path.join(root, 'roles', 'x', 'items', id), { recursive: true });
        fs.writeFileSync(path.join(root, 'roles', 'x', 'items', id, 'input.md'), 'Q\n');
    }
    fs.writeFileSync(path.join(root, 'roles', 'x', 'role.json'), JSON.stringify({ agent: 'fankeel-reader' }));
    const role = (...extra) => spawnSync(process.execPath, [SCRIPT, 'role', 'x', '--dry', '--projects', root, ...extra], { encoding: 'utf8' });
    const r = role('--arms', 'sonnet,haiku', '--runs', '2', '--cap', '1', '--jobs', '2');
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 8);
    assert.match(lines[0], /^easy-a-r1-sonnet x easy-a sonnet seed=1 cap=\$1 claude -p .*--permission-mode bypassPermissions .*--model haiku .*profile: \(none\)$/);
    assert.match(lines[1], /^easy-a-r1-haiku .*profile: agent\.fankeel-reader\.model=haiku$/);
    assert.match(lines[2], /^easy-a-r2-haiku x easy-a haiku seed=2 /);
    assert.match(lines[4], /^trap-b-r1-sonnet /);
    const bad = role('--arms', 'sonnet,opus');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not opus/);
    assert.equal(role('--jobs', '0').status, 1);
});

test('pool keeps at most width jobs in flight and runs every one', async () => {
    let live = 0;
    let most = 0;
    const done = [];
    await bench.pool([1, 2, 3, 4, 5], 2, async (n) => {
        live += 1;
        most = Math.max(most, live);
        await new Promise((r) => setTimeout(r, 5));
        live -= 1;
        done.push(n);
    });
    assert.equal(most, 2);
    assert.deepEqual(done.sort(), [1, 2, 3, 4, 5]);
});

// The design's section 5: the haiku arm's override is written into its own
// run directory, never another run's and never the config directory.
test('two runs prepared side by side: only the haiku one holds an override, and nothing reaches the config dir', () => {
    const { prepareRun } = require('../scripts/bench.js');
    const { overrideFor } = require('../lib/title.js');
    const root = project({ 'items/easy-a/setup.sh': 'git init -q\nmkdir -p .fankeel/sessions\n' });
    const config = tmp('fankeel-bench-cfg-');
    const ctx = { agent: 'fankeel-reader', env: { CLAUDE_CONFIG_DIR: config }, mkdtemp: () => tmp('fankeel-bench-prep-') };
    const job = (arm) => ({ tag: 'easy-a-r1-' + arm, arm, model: arm, round: 1, seed: 1, itemDir: path.join(root, 'p', 'items', 'easy-a'),
        row: { role: 'p', item: 'easy-a', tier: 'easy', input: 'Q' } });
    const haiku = prepareRun(ctx, job('haiku'));
    const sonnet = prepareRun(ctx, job('sonnet'));
    assert.equal(haiku.row.error, null);
    assert.equal(sonnet.row.error, null);
    assert.match(fs.readFileSync(path.join(haiku.dir, '.claude', 'agents', 'fankeel-reader.md'), 'utf8'), /^model: haiku$/m);
    assert.equal(fs.existsSync(path.join(sonnet.dir, '.claude', 'agents')), false);
    assert.equal(fs.existsSync(path.join(config, 'agents')), false);
    assert.equal(overrideFor('fankeel:fankeel-reader', haiku.dir, config), 'fankeel-reader');
    assert.equal(overrideFor('fankeel:fankeel-reader', sonnet.dir, config), null);
});
