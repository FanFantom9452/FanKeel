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

const selfOpts = () => ({ mkdtemp: () => tmp('fankeel-bench-self-'), plugin: 'unused' });

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
