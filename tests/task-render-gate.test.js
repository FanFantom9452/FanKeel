'use strict';

// docs/90-agent/plans/2026-10-15-render-gate-design.md §1: with no plan there
// is no ledger to refuse a page change, so `stage` leaving build does.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const CONF = JSON.stringify({
    pages: [{ name: 'home', url: 'site/index.html', src: ['site/**'] }],
    roles: [{ name: 'guest' }],
});

function run(dir, args) {
    const cfg = path.join(dir, 'cfg');
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
            { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

// A task at build on `route`, holding `claims`, in a project whose
// render.json gives `home` the files under `site/`.
function atBuild(route, claims) {
    const dir = tmp('fankeel-render-gate-');
    run(dir, ['start', '--session', A, '--task', 'a page task', '--route', route]);
    if (!route.startsWith('build')) run(dir, ['stage', 'build', '--session', A]);
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'render.json'), CONF);
    for (const c of claims) registry.addClaim(dir, A, c);
    return dir;
}

test('leaving build with no plan, a claimed page with no render verdict is refused, naming both ways through', () => {
    const dir = atBuild('build,verify', ['site/index.html', 'lib/x.js']);
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /home/);
    assert.match(out, /site\/index\.html/);
    assert.doesNotMatch(out, /lib\/x\.js/);
    assert.match(out, /--render <file>/);
    assert.match(out, /Ruling: render skipped — <why>/);
    assert.equal(registry.readSession(dir, A).stage, 'build');
});

test('--render passes only a file whose first non-blank line is disposition: ship', () => {
    const dir = atBuild('build,verify', ['site/index.html']);
    fs.writeFileSync(path.join(dir, 'fix.md'), 'disposition: fix\n- site/index.html:3 — overlap\n');
    fs.writeFileSync(path.join(dir, 'ship.md'), '\n\ndisposition: ship\n');
    assert.equal(run(dir, ['stage', 'verify', '--render', 'missing.md', '--session', A]).code, 1);
    const fixed = run(dir, ['stage', 'verify', '--render', 'fix.md', '--session', A]);
    assert.equal(fixed.code, 1);
    assert.match(fixed.out, /disposition: ship/);
    const shipped = run(dir, ['stage', 'verify', '--render', 'ship.md', '--session', A]);
    assert.equal(shipped.code, 0, shipped.out);
    assert.equal(registry.readSession(dir, A).stage, 'verify');
});

test('a note reading Ruling: render skipped — <why> lets it through; one with no why does not', () => {
    const dir = atBuild('build,verify', ['site/index.html']);
    run(dir, ['note', 'Ruling: render skipped —', '--session', A]);
    assert.equal(run(dir, ['stage', 'verify', '--session', A]).code, 1);
    run(dir, ['note', 'Ruling: render skipped — tuned live with the user', '--session', A]);
    assert.equal(run(dir, ['stage', 'verify', '--session', A]).code, 0);
});

test('a route with plan, a claim outside every src, and a project with no render.json are not checked', () => {
    assert.equal(run(atBuild('plan,build,verify', ['site/index.html']), ['stage', 'verify', '--session', A]).code, 0);
    assert.equal(run(atBuild('build,verify', ['lib/x.js']), ['stage', 'verify', '--session', A]).code, 0);
    const bare = atBuild('build,verify', ['site/index.html']);
    fs.unlinkSync(path.join(bare, '.fankeel', 'render.json'));
    assert.equal(run(bare, ['stage', 'verify', '--session', A]).code, 0);
});

test('a render.json that cannot be read or parsed refuses rather than skipping the check', () => {
    const broken = atBuild('build,verify', ['site/index.html']);
    fs.writeFileSync(path.join(broken, '.fankeel', 'render.json'), '{ not json');
    const parsed = run(broken, ['stage', 'verify', '--session', A]);
    assert.equal(parsed.code, 1, parsed.out);
    assert.match(parsed.out, /render\.json/);
    const unread = atBuild('build,verify', ['site/index.html']);
    fs.unlinkSync(path.join(unread, '.fankeel', 'render.json'));
    fs.mkdirSync(path.join(unread, '.fankeel', 'render.json'));
    const read = run(unread, ['stage', 'verify', '--session', A]);
    assert.equal(read.code, 1, read.out);
    assert.match(read.out, /render\.json/);
    assert.equal(registry.readSession(unread, A).stage, 'build');
});

test('a --render file is checked whenever it is given, on a task that touched no page too', () => {
    const dir = atBuild('build,verify', ['lib/x.js']);
    fs.writeFileSync(path.join(dir, 'fix.md'), 'disposition: fix\n');
    const { out, code } = run(dir, ['stage', 'verify', '--render', 'fix.md', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /first line is not `disposition: ship`/);
    assert.equal(registry.readSession(dir, A).stage, 'build');
});

test('src is matched against the claims inside the project only, relative to it', () => {
    const dir = tmp('fankeel-render-gate-');
    fs.mkdirSync(path.join(dir, 'app', '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app', '.fankeel', 'render.json'), JSON.stringify({
        pages: [{ name: 'home', url: 'site/index.html', src: ['**/*.html'] }],
        roles: [{ name: 'guest' }],
    }));
    run(dir, ['start', '--session', A, '--task', 'a page task', '--route', 'build,verify', '--project', 'app']);
    registry.addClaim(dir, A, 'other/index.html');
    assert.equal(run(dir, ['stage', 'verify', '--session', A]).code, 0, 'a claim outside the project');
    run(dir, ['stage', 'build', '--session', A]);
    registry.addClaim(dir, A, 'app/site/index.html');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /\(site\/index\.html\)/);
});

// The worktree is a checkout, and `.fankeel/` is version-controlled, so it
// carries its own render.json: the nearest one to the claim.
test('a worktree claim is read relative to its worktree', () => {
    const dir = atBuild('build,verify', []);
    fs.mkdirSync(path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa', '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa', '.fankeel', 'render.json'), CONF);
    registry.update(dir, A, (d) => { d.worktree = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' }; });
    registry.addClaim(dir, A, '.fankeel/worktrees/aaaaaaaa/site/index.html');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /site\/index\.html/);
});

// Fix round (verify): claims are capped and the oldest evicted, so a page the
// task changed is read from git as well — what it committed since it started
// and what it left uncommitted — whether or not a claim still names it.
function gitIn(dir, args, env) {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore', env: Object.assign({}, process.env, env || {}) });
}

function pageRepo() {
    const dir = tmp('fankeel-render-gate-');
    gitIn(dir, ['init', '-q']);
    gitIn(dir, ['config', 'user.email', 'test@example.invalid']);
    gitIn(dir, ['config', 'user.name', 'test']);
    gitIn(dir, ['config', 'commit.gpgsign', 'false']);
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'render.json'), CONF);
    fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
    return dir;
}

function commitFile(dir, rel, env) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), rel + '\n');
    gitIn(dir, ['add', '--', rel]);
    gitIn(dir, ['commit', '-qm', rel], env);
}

function startAt(dir) {
    run(dir, ['start', '--session', A, '--task', 'a page task', '--route', 'build,verify']);
    registry.addClaim(dir, A, 'lib/x.js');
}

test('a page committed since the task started, claimed or not, is refused', () => {
    const dir = pageRepo();
    commitFile(dir, 'base.txt');
    startAt(dir);
    commitFile(dir, 'site/index.html');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /site\/index\.html/);
});

test('a page left uncommitted and not claimed is refused', () => {
    const dir = pageRepo();
    commitFile(dir, 'base.txt');
    startAt(dir);
    fs.mkdirSync(path.join(dir, 'site'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'site', 'index.html'), 'new\n');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /site\/index\.html/);
});

test('a page committed before the task started and not touched since is not refused', () => {
    const dir = pageRepo();
    const past = new Date(Date.now() - 3600e3).toISOString();
    commitFile(dir, 'site/index.html', { GIT_COMMITTER_DATE: past, GIT_AUTHOR_DATE: past });
    gitIn(dir, ['add', '-A']);
    gitIn(dir, ['commit', '-qm', 'base'], { GIT_COMMITTER_DATE: past, GIT_AUTHOR_DATE: past });
    startAt(dir);
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 0, out);
});

// Review round: a worktree cut before render.json was written, or one the
// main checkout changed since, holds no copy; its files are read where they
// sit in the main tree, so the page is not waved through.
test('a worktree page with render.json only in the main tree is refused', () => {
    const dir = atBuild('build,verify', []);
    registry.update(dir, A, (d) => { d.worktree = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' }; });
    registry.addClaim(dir, A, '.fankeel/worktrees/aaaaaaaa/site/index.html');
    const own = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(own.code, 1, own.out);
    assert.match(own.out, /site\/index\.html/);
    const agent = atBuild('build,verify', ['.claude/worktrees/agent-1a2b3c/site/index.html']);
    const theirs = run(agent, ['stage', 'verify', '--session', A]);
    assert.equal(theirs.code, 1, theirs.out);
    assert.match(theirs.out, /site\/index\.html/);
});

// Review round: git's listing past execFileSync's default 1 MiB buffer was
// swallowed, and the check fell back to the claims alone.
test('a page among more than a megabyte of untracked paths is still refused', () => {
    const dir = pageRepo();
    commitFile(dir, 'base.txt');
    startAt(dir);
    const bulk = path.join(dir, 'bulk');
    fs.mkdirSync(bulk);
    const stem = 'x'.repeat(140);
    for (let i = 0; i < 8000; i++) fs.writeFileSync(path.join(bulk, stem + i), '');
    fs.mkdirSync(path.join(dir, 'site'));
    fs.writeFileSync(path.join(dir, 'site', 'index.html'), 'new\n');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /site\/index\.html/);
});

// Review round: a registry root holding several repositories, its
// render.json naming the repository's files by their path from the root.
test('a workspace root above the repository reads its render.json against the repository\'s changes', () => {
    const dir = tmp('fankeel-render-gate-');
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    gitIn(repo, ['init', '-q']);
    gitIn(repo, ['config', 'user.email', 'test@example.invalid']);
    gitIn(repo, ['config', 'user.name', 'test']);
    gitIn(repo, ['config', 'commit.gpgsign', 'false']);
    commitFile(repo, 'base.txt');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'render.json'), JSON.stringify({
        pages: [{ name: 'home', url: 'repo/site/x.html', src: ['repo/site/**'] }], roles: [{ name: 'guest' }],
    }));
    run(dir, ['start', '--session', A, '--task', 'a page task', '--route', 'build,verify', '--project', 'repo']);
    commitFile(repo, 'site/x.html');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /repo\/site\/x\.html/);
});
