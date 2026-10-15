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

test('a worktree claim is read relative to its worktree', () => {
    const dir = atBuild('build,verify', []);
    registry.update(dir, A, (d) => { d.worktree = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' }; });
    registry.addClaim(dir, A, '.fankeel/worktrees/aaaaaaaa/site/index.html');
    const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
    assert.equal(code, 1, out);
    assert.match(out, /site\/index\.html/);
});
