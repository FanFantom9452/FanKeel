'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const PIN = path.join(ROOT, 'docs', 'reports', 'evidence', '2026-09-26-ab-profile-pin', 'pin.sh');
const TASK_JS = path.join(ROOT, 'scripts', 'task.js');
const slash = (p) => p.replace(/\\/g, '/');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// BASE holds stage.agents `survey`, a value the pin (`false`) is not, so a
// revert to BASE shows. The worktree is detached, as ab.sh's are.
function worktree() {
    const repo = tmp('fankeel-abpin-');
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'test@example.invalid');
    git(repo, 'config', 'user.name', 'test');
    git(repo, 'config', 'commit.gpgsign', 'false');
    fs.mkdirSync(path.join(repo, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey' }, null, 2) + '\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-qm', 'base');
    const wt = slash(path.join(tmp('fankeel-abpin-wt-'), 'wt'));
    git(repo, 'worktree', 'add', '-q', '--detach', wt, 'HEAD');
    return wt;
}

const env = () => Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-abpin-cfg-'), TASK_JS: slash(TASK_JS) });
const task = (wt, ...args) => execFileSync(process.execPath, [TASK_JS, ...args, '--root', wt], { encoding: 'utf8', env: env() });
const shown = (wt) => /^\s+stage\.agents\s+(\S+)/m.exec(task(wt, 'profile', 'show'))[1];
const pin = (wt, value) => execFileSync('bash', [slash(PIN), wt, value], { encoding: 'utf8', env: env() }).trim().split('\n').pop();

// What the sonnet arm's self-dispatched brain did on 09-25.
function stashAndDrop(wt) {
    git(wt, 'stash', 'push', '-u');
    if (git(wt, 'stash', 'list')) git(wt, 'stash', 'drop');
}

test('pin.sh commits stage.agents, so a stash push -u and drop leaves it pinned', () => {
    const wt = worktree();
    const sha = pin(wt, 'false');
    assert.equal(sha, git(wt, 'rev-parse', 'HEAD'), 'pin.sh prints the sha holding the pin');
    assert.equal(git(wt, 'status', '--porcelain', '--', '.fankeel/profile.json'), '', 'the pin is committed, not only written');
    stashAndDrop(wt);
    assert.equal(shown(wt), 'false');
});

test('control: the 09-25 sequence — profile set, no commit — is back at BASE after the same stash and drop', () => {
    const wt = worktree();
    task(wt, 'profile', 'set', 'stage.agents', 'false');
    assert.equal(shown(wt), 'false', 'the set itself took');
    stashAndDrop(wt);
    assert.equal(shown(wt), 'survey', 'the stash took the uncommitted pin back to BASE');
});

test('pin.sh twice with the same value exits 0 and makes no second commit', () => {
    const wt = worktree();
    const first = pin(wt, 'false');
    assert.equal(pin(wt, 'false'), first);
});
