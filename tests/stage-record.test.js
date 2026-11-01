'use strict';

// docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §7: at a stage
// change the stage just left files its report, masked, in the records bucket
// as <task>/<stage>.md and commits that file alone.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const registry = require('../lib/registry.js');
const { handoffPath } = require('../lib/handoff.js');
const { fileStageReport } = require('../scripts/record.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const TICKS = '`'.repeat(3);
const REPORT = '一句話：做法\n\nsecret-host-01 在這裡\n\n' + TICKS + 'json gate\n{"questions":[],"next":"n"}\n' + TICKS + '\n';

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function repo() {
    const dir = tmp('fankeel-stage-record-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 't@example.com');
    git(dir, 'config', 'user.name', 't');
    fs.writeFileSync(path.join(dir, 'README.md'), '# r\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
    return dir;
}

function task(dir, args) {
    const cfg = path.join(dir, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

function designReport(dir) {
    const file = handoffPath(dir, registry.readSession(dir, A), 'design');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, REPORT);
    return file;
}

test('stage <next> commits the report the stage left, masked, and only that file', () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'sensitive.txt'), 'secret-host-01\n');
    task(dir, ['start', '--session', A, '--task', 'x']);
    task(dir, ['stage', 'design', '--session', A]);
    const report = designReport(dir);
    fs.writeFileSync(path.join(dir, 'staged.txt'), 'someone else\'s\n');
    git(dir, 'add', 'staged.txt');
    const out = task(dir, ['stage', 'plan', '--session', A]);
    const rel = 'docs/90-agent/records/' + path.basename(path.dirname(report)) + '/design.md';
    assert.match(out, new RegExp('^record: ' + rel.replace(/[.]/g, '\\.') + ' committed$', 'm'));
    assert.deepEqual(git(dir, 'show', '--name-only', '--format=', 'HEAD').split('\n'), [rel]);
    assert.match(git(dir, 'log', '-1', '--format=%s'), /^docs: task-\d{8}T\d{6} design conclusion$/);
    const filed = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
    assert.doesNotMatch(filed, /secret-host-01/);
    assert.match(filed, /\[REDACTED:word\]/);
    assert.match(git(dir, 'diff', '--cached', '--name-only'), /^staged\.txt$/m, 'what was staged stays staged');
    assert.equal(registry.readSession(dir, A).stage, 'plan');
});

test('no git repository: the stage still changes and the line says it was not committed', () => {
    const dir = tmp('fankeel-stage-record-');
    task(dir, ['start', '--session', A, '--task', 'x']);
    task(dir, ['stage', 'design', '--session', A]);
    designReport(dir);
    const out = task(dir, ['stage', 'plan', '--session', A]);
    assert.match(out, /^record: docs\/90-agent\/records\/task-\d{8}T\d{6}\/design\.md written, not committed — /m);
    assert.equal(registry.readSession(dir, A).stage, 'plan');
});

test('a stage that left no report files nothing and says nothing', () => {
    const dir = repo();
    task(dir, ['start', '--session', A, '--task', 'x']);
    task(dir, ['stage', 'design', '--session', A]);
    const out = task(dir, ['stage', 'plan', '--session', A]);
    assert.doesNotMatch(out, /^record:/m);
    assert.equal(fs.existsSync(path.join(dir, 'docs', '90-agent', 'records')), false);
});

test('a sensitive list that cannot be read stops the copy, so nothing unmasked lands', () => {
    const dir = tmp('fankeel-stage-record-');
    fs.mkdirSync(path.join(dir, '.fankeel', 'sensitive.txt'), { recursive: true });
    const report = path.join(dir, 'design.md');
    fs.writeFileSync(report, REPORT);
    const line = fileStageReport({ projectRoot: dir, report, slug: 'task-20261102T000000', stage: 'design' });
    assert.match(line, /^record: not copied — \.fankeel\/sensitive\.txt could not be read/);
    assert.equal(fs.existsSync(path.join(dir, 'docs')), false);
});
