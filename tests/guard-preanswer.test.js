'use strict';

// docs/03-decisions/2026-11-03-preanswered-gate.md: while this task's gates
// are pre-answered, push, deletion, land's merge and launching a program
// stop at a permission prompt. Without a pre-answer nothing changes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { preanswerStop } = require('../lib/guard.js');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const PRE = { preanswer: { answers: { verify: 'Land' }, stops: ['push', 'delete', 'merge', 'launch'], at: 1 } };

function seed(over) {
    const root = tmp('fankeel-guard-preanswer-');
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
        task: 't', stage: 'build', active: true, started: '2026-09-19T09:30:12.345Z',
        updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
    }, over)) + '\n');
    return root;
}

function shell(root, command) {
    const out = execFileSync(process.execPath, [GUARD], {
        input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    }).trim();
    return out ? JSON.parse(out) : {};
}

test('with a pre-answer, git push asks', () => {
    const out = shell(seed(PRE), 'git push origin main').hookSpecificOutput;
    assert.equal(out.permissionDecision, 'ask');
    assert.match(out.permissionDecisionReason, /pre-answered/);
    assert.match(out.permissionDecisionReason, /push/);
});

test('without a pre-answer, git push is left to the user\'s own rules', () => {
    assert.equal(shell(seed({}), 'git push origin main').hookSpecificOutput, undefined);
});

test('each of the four kinds is caught, and ordinary work is not', () => {
    const kind = (command) => {
        const why = preanswerStop(PRE, command);
        return why ? /`(\w+)`/.exec(why)[1] : null;
    };
    assert.equal(kind('git push origin main'), 'push');
    assert.equal(kind('git branch -D fk/abc12345'), 'delete');
    assert.equal(kind('git reset --hard HEAD~1'), 'delete');
    assert.equal(kind('rm docs/old.md'), 'delete');
    assert.equal(kind('Remove-Item lib/x.js'), 'delete');
    assert.equal(kind('node scripts/land.js merge --session x'), 'merge');
    assert.equal(kind('git merge fk/abc12345'), 'merge');
    assert.equal(kind('powershell -Command "New-Object -ComObject Word.Application"'), 'launch');
    assert.equal(kind('Start-Process notepad'), 'launch');
    assert.equal(kind('cmd /c start report.html'), 'launch');
    assert.equal(kind('bash -c "rm -rf x"'), 'delete');
    assert.equal(kind('powershell -Command "Remove-Item -Recurse x"'), 'delete');
    assert.equal(kind('cmd /c "del f"'), 'delete');
    assert.equal(kind('bash -c "echo hi"'), null);
    assert.equal(kind('npm test'), null);
    assert.equal(kind('node --test tests/guard-preanswer.test.js'), null);
    assert.equal(kind('git commit -m "rm the old flag"'), null);
    assert.equal(kind('git status'), null);
});

test('no pre-answer, or an empty command, says nothing', () => {
    assert.equal(preanswerStop({}, 'git push'), null);
    assert.equal(preanswerStop(PRE, ''), null);
});

test('at a controlled stage a shell write is denied, not asked, even when it is also a delete', () => {
    const root = seed(PRE);
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
    const out = shell(root, 'rm docs/x.md').hookSpecificOutput;
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /controlled stage/);
});

test('a sensitive-scan verdict on a commit beats the pre-answer ask, chained with git push too', () => {
    const root = seed(PRE);
    const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
    git('init', '-q');
    fs.writeFileSync(path.join(root, '.fankeel', '.gitignore'), 'sessions/\nsensitive.txt\nprofile.json\n');
    fs.writeFileSync(path.join(root, '.fankeel', 'sensitive.txt'), 'ACME\n');
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'sensitive.mode': 'block' }));
    fs.writeFileSync(path.join(root, 'plan.md'), 'ship it to acme\n');
    git('add', 'plan.md');
    const out = shell(root, 'git commit -m plan && git push origin main').hookSpecificOutput;
    assert.equal(out.permissionDecision, 'deny');
    assert.doesNotMatch(out.permissionDecisionReason, /pre-answered/);
    assert.match(out.permissionDecisionReason, /plan\.md:1/);
    assert.equal(shell(root, 'git push origin main').hookSpecificOutput.permissionDecision, 'ask');
});
