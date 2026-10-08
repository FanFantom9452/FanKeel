'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bench = require('../lib/bench.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const BENCH = path.join(ROOT, 'bench');
const projects = fs.existsSync(BENCH) ? fs.readdirSync(BENCH).filter((n) => fs.existsSync(path.join(BENCH, n, 'bench.json'))) : [];

test('every bench project names a title, arms the bench knows, and its three files', () => {
    assert.ok(projects.includes('fix-bug') && projects.includes('add-feature'), projects.join(','));
    for (const p of projects) {
        const conf = JSON.parse(fs.readFileSync(path.join(BENCH, p, 'bench.json'), 'utf8'));
        assert.equal(typeof conf.title, 'string', p);
        for (const a of conf.arms) assert.ok(bench.ARMS[a], p + ' names arm ' + a);
        for (const f of ['setup.sh', 'check.sh', 'task.md']) assert.ok(fs.existsSync(path.join(BENCH, p, f)), p + '/' + f);
    }
});

for (const p of projects) {
    test(p + ': check.sh passes every pass control and fails every fail control', () => {
        assert.deepEqual(bench.selftest(path.join(BENCH, p), { mkdtemp: () => tmp('fankeel-bench-self-'), plugin: bench.posix(ROOT) }), []);
    });
}

// selftest only sees the exit code; a control that fails for another clause's
// reason would leave its own clause unproven, so pin the message too.
function checkOf(project, control, checkEnv) {
    const dir = tmp('fankeel-bench-ctl-');
    const full = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: bench.posix(ROOT) };
    const s = spawnSync('bash', [bench.posix(path.join(BENCH, project, 'setup.sh'))], { cwd: dir, env: full, encoding: 'utf8' });
    assert.equal(s.status, 0, s.stderr);
    fs.cpSync(path.join(BENCH, project, 'controls', control), dir, { recursive: true });
    const r = spawnSync('bash', [bench.posix(path.join(BENCH, project, 'check.sh')), bench.posix(dir)], { env: { ...full, ...checkEnv }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout.trim() };
}

const WHY = [
    ['fix-bug', 'fail', 'spec/range.spec.js was changed'],
    ['fix-bug', 'fail-unfixed', 'node --test fails'],
    ['add-feature', 'fail', 'the hidden specs fail'],
    ['add-feature', 'fail-slug-spec', 'spec/slug.spec.js was changed'],
    ['add-feature', 'fail-no-truncate-spec', 'no spec/truncate.spec.js'],
    ['add-feature', 'fail-one-test', 'spec/truncate.spec.js holds fewer than two tests'],
];
for (const [p, c, msg] of WHY) {
    test(p + ' control ' + c + ' fails on its own clause: ' + msg, () => {
        assert.deepEqual(checkOf(p, c), { status: 1, out: msg });
    });
}

test('fix-bug: a gen-spec.sh failure is reported as its own, not as an edited spec', () => {
    const r = checkOf('fix-bug', 'pass', { BENCH_SEED: 'abc' });
    assert.deepEqual(r, { status: 1, out: 'gen-spec.sh failed for seed abc' });
});

// The repository's own `node --test` would run any of these, and a fixture
// spec that needs BENCH_PROJ would fail the suite.
test('no file under bench/ is one the repository\'s own node --test picks up', () => {
    const hits = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) {
                if (e.name === 'test') hits.push(f);
                walk(f);
            } else if (/^test\.[cm]?js$|[.\-_]test\.[cm]?js$|^test-.*\.[cm]?js$/.test(e.name)) {
                hits.push(f);
            }
        }
    };
    walk(BENCH);
    assert.deepEqual(hits, []);
});

test('fix-bug: seeds 1, 2 and 3 generate three different specs', () => {
    const out = [1, 2, 3].map((seed) => spawnSync('bash', [bench.posix(path.join(BENCH, 'fix-bug', 'gen-spec.sh')), String(seed)], { encoding: 'utf8' }).stdout);
    assert.equal(new Set(out).size, 3);
    assert.match(out[0], /sumRange\(2, 6\), 20\)/);
});

test('add-feature: the fixture plan names BENCH_IMPL on its Dispatch line and passes ledger.js lint', () => {
    const dir = tmp('fankeel-bench-lint-');
    const s = spawnSync('bash', [bench.posix(path.join(BENCH, 'add-feature', 'setup.sh'))], { cwd: dir, env: { ...process.env, BENCH_IMPL: 'haiku' }, encoding: 'utf8' });
    assert.equal(s.status, 0, s.stderr);
    const plan = 'docs/plans/2026-01-01-truncate.md';
    assert.match(fs.readFileSync(path.join(dir, plan), 'utf8'), /^\*\*Dispatch:\*\* implementer, haiku$/m);
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ledger.js'), '--plan', plan, 'lint'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
});
