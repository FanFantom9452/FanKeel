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
        assert.deepEqual(bench.selftest(path.join(BENCH, p), tmp.selfOpts(bench.posix(ROOT))), []);
    });
}

// selftest only sees the exit code; a control that fails for another clause's
// reason would leave its own clause unproven, so pin the message too.
function checkOf(project, control, checkEnv) {
    const dir = tmp('fankeel-bench-ctl-');
    const full = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: bench.posix(ROOT) };
    const s = spawnSync('bash', [bench.posix(path.join(BENCH, project, 'setup.sh'))], { cwd: dir, env: full, encoding: 'utf8' });
    assert.equal(s.status, 0, s.stderr);
    assert.equal(bench.layControl(path.join(BENCH, project), control, dir, full), null);
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

const ROLES = path.join(BENCH, 'roles');
const roles = fs.existsSync(ROLES) ? fs.readdirSync(ROLES).filter((n) => fs.existsSync(path.join(ROLES, n, 'role.json'))).sort() : [];

test('the four roles each name a plugin agent in role.json', () => {
    assert.deepEqual(roles, ['implementer', 'mover', 'mutator', 'reader']);
    for (const r of roles) {
        const conf = JSON.parse(fs.readFileSync(path.join(ROLES, r, 'role.json'), 'utf8'));
        assert.equal(conf.agent, 'fankeel-' + r);
        assert.ok(fs.existsSync(path.join(ROOT, 'agents', conf.agent + '.md')), r + ' names ' + conf.agent);
    }
});

// Every item of every role at seed 1: each control judged right, each fail
// control drawing the class its name promises. bench.js role runs the same
// check for every seed it is about to spend money on.
for (const r of roles) {
    for (const item of bench.roleItems(path.join(ROLES, r))) {
        test('roles/' + r + '/' + item.id + ': every control judged right, each fail control on its own class', () => {
            assert.deepEqual(bench.selftestRole(path.join(ROLES, r), { ...tmp.selfOpts(bench.posix(ROOT)), only: [item.id] }), []);
        });
    }
}

// A shared judge run once: its exit status and the last line it printed.
function judge(cmd, args, opts) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
    return { status: r.status, last: String(r.stdout || '').trim().split(/\r?\n/).pop() };
}

function repo(dir, tag) {
    const steps = [['init', '-q'], ['config', 'core.autocrlf', 'false'], ['config', 'user.name', 'b'], ['config', 'user.email', 'b@l'], ['add', '-A'], ['commit', '-q', '-m', 'start']];
    for (const a of tag ? [...steps, ['tag', 'bench-start']] : steps) spawnSync('git', a, { cwd: dir });
}

test('reader answers.sh: the exact answer at a line holding it passes, however the path is written; each miss names its class', () => {
    const proj = tmp('fankeel-judge-reader-');
    fs.mkdirSync(path.join(proj, 'lib'));
    fs.writeFileSync(path.join(proj, 'lib', 'a.js'), "'use strict';\n\nconst X = 8;\n");
    const run = (reply) => {
        fs.mkdirSync(path.join(proj, '.bench'), { recursive: true });
        fs.writeFileSync(path.join(proj, '.bench', 'result.txt'), reply);
        return judge('bash', [bench.posix(path.join(ROLES, 'reader', 'items', 'answers.sh')), bench.posix(proj)], { input: '1|8|X = 8\n2|none|\n' });
    };
    assert.deepEqual(run('1. 8 — lib/a.js:3\n2. none\n'), { status: 0, last: 'pass' });
    assert.equal(run('1. `8` — lib\\a.js:3\r\n2. none\r\n').last, 'pass');
    assert.equal(run('1. 8 — ' + bench.posix(proj) + '/lib/a.js:3\n2. none\n').last, 'pass');
    assert.equal(run('1. 9 — lib/a.js:3\n2. none\n').last, 'fail wrong: question 1: 9, not 8');
    assert.equal(run('1. 8 — lib/a.js:1\n2. none\n').last, 'fail fabricated: question 1: lib/a.js:1 does not hold the answer');
    assert.equal(run('1. 8 — lib/b.js:3\n2. none\n').last, 'fail fabricated: question 1: lib/b.js does not exist');
    assert.equal(run('1. 8\n2. none\n').last, 'fail format: question 1: no path:line');
    assert.equal(run('2. none\n').last, 'fail format: question 1: no answer line');
    assert.equal(run('1. 8 — lib/a.js:3\n2. none — lib/a.js:3\n').last, 'fail fabricated: question 2: lib/a.js:3 cited for something that does not exist');
    assert.equal(run('1. 8 — lib/a.js:3\n2. 8 — lib/a.js:3\n').last, 'fail wrong: question 2: the answer is none, not 8');
});

test('mutator judge.js: a restored file, a clean tree and both runs pass; each miss names its class', () => {
    const item = tmp('fankeel-judge-mut-item-');
    fs.mkdirSync(path.join(item, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(item, 'src', 'lib', 'x.js'), 'x\n');
    const proj = tmp('fankeel-judge-mut-');
    fs.mkdirSync(path.join(proj, 'lib'));
    fs.mkdirSync(path.join(proj, '.bench'));
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'x\n');
    fs.writeFileSync(path.join(proj, '.gitignore'), '.bench/\n');
    repo(proj, false);
    const run = (reply, want) => {
        fs.writeFileSync(path.join(proj, '.bench', 'result.txt'), reply);
        return judge(process.execPath, [path.join(ROLES, 'mutator', 'items', 'judge.js'), item, proj, 'lib/x.js', want]).last;
    };
    const ran = (after) => 'before: ℹ pass 3 ℹ fail 0\nmutated: ℹ pass 1 ℹ fail ' + after + '\nrestored: git diff --stat unchanged\n';
    assert.equal(run(ran(2), 'kill'), 'pass');
    assert.equal(run('before:\ntests 3\npass 3\nfail 0\nafter:\ntests 3\npass 3\nfail 0\n', 'survive'), 'pass');
    assert.equal(run(ran(0), 'kill'), 'fail wrong: the reply says the mutant survived, and the specs kill it');
    assert.equal(run(ran(1), 'survive'), 'fail wrong: the reply says the specs killed a mutant they cannot see');
    assert.equal(run('refused: line 4 does not hold n > hi\n', 'refuse'), 'pass');
    assert.equal(run(ran(2), 'refuse'), 'fail extra: the line does not hold the text, and the mutation was run anyway');
    assert.equal(run('after: fail 2\n', 'kill'), 'fail format: no fail count under before:');
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'y\n');
    assert.equal(run(ran(2), 'kill'), 'fail unrestored: lib/x.js was not restored');
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'x\n');
    assert.equal(run('before: ℹ pass 2 ℹ fail 0\nmutated: nothing ran\n', 'kill'), 'fail format: no fail count under after:');
    assert.equal(run('before: ℹ pass 2 ℹ fail 1\nmutated: ℹ pass 1 ℹ fail 2\n', 'kill'), 'fail wrong: the run before the mutation shows fail 1');
    fs.rmSync(path.join(proj, '.bench', 'result.txt'));
    assert.equal(judge(process.execPath, [path.join(ROLES, 'mutator', 'items', 'judge.js'), item, proj, 'lib/x.js', 'kill']).last, 'fail format: no .bench/result.txt');
    fs.writeFileSync(path.join(proj, 'lib', 'y.js'), 'y\n');
    assert.equal(run(ran(2), 'kill'), 'fail extra: the worktree is not clean — ?? lib/y.js');
});

test('mover judge.sh: each clause passes on the move asked for and names its class when it fails', () => {
    const proj = tmp('fankeel-judge-mover-');
    fs.mkdirSync(path.join(proj, 'docs', 'drafts'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'docs', 'drafts', 'n.md'), 'n\n');
    repo(proj, true);
    spawnSync('git', ['mv', 'docs/drafts/n.md', 'docs/n.md'], { cwd: proj });
    spawnSync('git', ['commit', '-q', '-m', 'docs: move n', '-m', 'Second paragraph.'], { cwd: proj });
    const scripts = tmp('fankeel-judge-mover-sh-');
    let n = 0;
    const clause = (body, dir = proj) => {
        const file = path.join(scripts, 'c' + (n++) + '.sh');
        fs.writeFileSync(file, 'proj="$1"\n. "$2"\n' + body + '\necho pass\n');
        return judge('bash', [bench.posix(file), bench.posix(dir), bench.posix(path.join(ROLES, 'mover', 'items', 'judge.sh'))]).last;
    };
    assert.equal(clause([
        'want_commits 1',
        'want_message "$(printf \'docs: move n\\n\\nSecond paragraph.\')"',
        'want_changes "$(printf \'D docs/drafts/n.md\\nA docs/n.md\')"',
        'want_same docs/n.md docs/drafts/n.md',
        'want_clean',
    ].join('\n')), 'pass');
    assert.equal(clause('want_commits 2'), 'fail wrong: 1 commit(s) on top of the start, not 2');
    assert.equal(clause('want_message "docs: move n"'), 'fail wrong: the commit message differs');
    assert.equal(clause('want_merge'), 'fail wrong: HEAD is not a merge commit');
    assert.equal(clause('want_changes "A docs/n.md"'), 'fail extra: the commits changed more than asked: A docs/n.md;D docs/drafts/n.md');
    assert.equal(clause('want_changes "$(printf \'A docs/m.md\\nD docs/drafts/n.md\')"'), 'fail wrong: the commits do not hold the change asked for: A docs/n.md;D docs/drafts/n.md');
    fs.writeFileSync(path.join(proj, 'x.txt'), 'x\n');
    assert.equal(clause('want_clean'), 'fail extra: the worktree is not clean');
    const merged = tmp('fankeel-judge-mover-merge-');
    fs.writeFileSync(path.join(merged, 'base.txt'), 'b\n');
    repo(merged, true);
    spawnSync('git', ['checkout', '-q', '-b', 'side'], { cwd: merged });
    fs.writeFileSync(path.join(merged, 'side.txt'), 's\n');
    spawnSync('git', ['add', '-A'], { cwd: merged });
    spawnSync('git', ['commit', '-q', '-m', 'side'], { cwd: merged });
    spawnSync('git', ['checkout', '-q', '-'], { cwd: merged });
    fs.writeFileSync(path.join(merged, 'main.txt'), 'm\n');
    spawnSync('git', ['add', '-A'], { cwd: merged });
    spawnSync('git', ['commit', '-q', '-m', 'main'], { cwd: merged });
    spawnSync('git', ['merge', '-q', '--no-ff', '-m', 'merge side', 'side'], { cwd: merged });
    assert.equal(clause('want_merge', merged), 'pass');
    assert.equal(clause('want_commits 2', merged), 'fail wrong: 3 commit(s) on top of the start, not 2');
    const drifted = tmp('fankeel-judge-mover-same-');
    fs.mkdirSync(path.join(drifted, 'docs', 'drafts'), { recursive: true });
    fs.writeFileSync(path.join(drifted, 'docs', 'drafts', 'n.md'), 'n\n');
    repo(drifted, true);
    spawnSync('git', ['mv', 'docs/drafts/n.md', 'docs/n.md'], { cwd: drifted });
    fs.writeFileSync(path.join(drifted, 'docs', 'n.md'), 'changed\n');
    spawnSync('git', ['add', '-A'], { cwd: drifted });
    spawnSync('git', ['commit', '-q', '-m', 'docs: move n'], { cwd: drifted });
    assert.equal(clause('want_same docs/n.md docs/drafts/n.md', drifted), 'fail extra: docs/n.md is not docs/drafts/n.md unchanged');
});

test('implementer judge.js: the code blocks byte for byte, nothing beside the Files block, the specs green', () => {
    const JUDGE = path.join(ROLES, 'implementer', 'items', 'judge.js');
    const item = tmp('fankeel-judge-impl-item-');
    const f = '```';
    fs.writeFileSync(path.join(item, 'input.md'), [
        '## Task 1: one', '', '**Files:**', '- Modify: `lib/one.js` — one()', '- Test: `spec/one.spec.js`', '',
        '1. Write the failing test in `spec/one.spec.js`:', '', '   ' + f + 'js', "   'use strict';",
        "   require('node:test')('one is 1', () => require('node:assert/strict').equal(require('../lib/one.js').one(), 1));", '   ' + f, '',
        '2. Write the implementation in `lib/one.js`:', '', '   ' + f + 'js', "   'use strict';", '   // \\d stays a backslash and a d', '   exports.one = () => 1;', '   ' + f, '',
    ].join('\n'));
    const proj = tmp('fankeel-judge-impl-');
    fs.writeFileSync(path.join(proj, 'README.md'), 'r\n');
    repo(proj, true);
    const node = (...args) => judge(process.execPath, [JUDGE, ...args]);
    const lib = path.join(proj, 'lib', 'one.js');
    node('write', item, proj);
    assert.equal(fs.readFileSync(lib, 'utf8'), "'use strict';\n// \\d stays a backslash and a d\nexports.one = () => 1;\n");
    assert.deepEqual(node(item, proj), { status: 0, last: 'pass' });
    fs.writeFileSync(lib, "'use strict';\r\n// \\d stays a backslash and a d\r\nexports.one = () => 1;\r\n");
    assert.equal(node(item, proj).last, 'fail wrong: lib/one.js differs from the plan — its line endings changed');
    node('write', item, proj);
    fs.writeFileSync(path.join(proj, 'README.md'), 'r2\n');
    assert.equal(node(item, proj).last, 'fail extra: changed outside the Files block: README.md');
    fs.writeFileSync(path.join(proj, 'README.md'), 'r\n');
    const want = tmp('fankeel-judge-impl-want-');
    fs.mkdirSync(path.join(want, 'lib'));
    fs.writeFileSync(path.join(want, 'lib', 'one.js'), 'other\n');
    assert.equal(node(item, proj, '--expect', want).last, 'fail wrong: lib/one.js differs from the plan — the first difference is at byte 0');
    const red = tmp('fankeel-judge-impl-red-');
    fs.writeFileSync(path.join(red, 'input.md'), fs.readFileSync(path.join(item, 'input.md'), 'utf8').replace('one(), 1))', 'one(), 2))'));
    const failing = tmp('fankeel-judge-impl-failing-');
    fs.writeFileSync(path.join(failing, 'README.md'), 'r\n');
    repo(failing, true);
    node('write', red, failing);
    assert.equal(node(red, failing).last, 'fail wrong: node --test spec/one.spec.js fails');
    const unwritten = tmp('fankeel-judge-impl-unwritten-');
    fs.writeFileSync(path.join(unwritten, 'README.md'), 'r\n');
    repo(unwritten, true);
    assert.equal(node(item, unwritten).last, 'fail wrong: lib/one.js was not written');
});
