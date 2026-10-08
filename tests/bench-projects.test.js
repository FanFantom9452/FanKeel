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
