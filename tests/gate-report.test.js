'use strict';

// docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: a stage the
// session runs itself writes its report where a stage agent's goes, before
// its gate, so the station's gate page has something to draw.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { gateReportRule } = require('../lib/stages.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const TASK = path.join(ROOT, 'scripts', 'task.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const TICKS = '`'.repeat(3);

const GATE_Q = [{ question: 'Design -> Plan | fankeel : t　照這個做法？', header: 'Design→Plan', multiSelect: false, options: [
    { label: 'Go to Plan (Recommended)', description: 'a' }, { label: 'Stay in Design', description: 'b' }, { label: '暫停', description: 'c' }] }];

function seed(agents) {
    const root = tmp('fankeel-gate-report-');
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify({
        task: 't', stage: 'design', active: true, started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
    }) + '\n');
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': agents }));
    return root;
}

const report = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'design.md');

function ask(root, questions) {
    const out = execFileSync(process.execPath, [GATE], {
        input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion', tool_input: { questions } }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    }).trim();
    return out ? JSON.parse(out) : {};
}

test('an in-session gate with no report at the handoff path is denied, naming the path', () => {
    const out = ask(seed('survey'), GATE_Q);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /design\.md does not exist/);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /Write this stage's report there, ending in a `json gate` block/);
});

test('a report with no json gate block is denied too: the gate page would still be blank', () => {
    const root = seed('survey');
    fs.mkdirSync(path.dirname(report(root)), { recursive: true });
    fs.writeFileSync(report(root), '# design\n\nthe approach\n');
    const out = ask(root, GATE_Q);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /holds no `json gate` block/);
});

test('a report ending in its json gate block lets the gate out', () => {
    const root = seed('survey');
    fs.mkdirSync(path.dirname(report(root)), { recursive: true });
    fs.writeFileSync(report(root), '# design\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions: GATE_Q, next: 'n' }) + '\n' + TICKS + '\n');
    assert.equal(ask(root, GATE_Q).hookSpecificOutput, undefined);
});

test('a question mid-stage owes no report', () => {
    const mid = JSON.parse(JSON.stringify(GATE_Q));
    mid[0].options[0].label = '用 Map';
    assert.equal(ask(seed('survey'), mid).hookSpecificOutput, undefined);
});

test('a controlled stage with no report is denied too, and told to wait for its stage agent', () => {
    const out = ask(seed('survey,design'), GATE_Q);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /design\.md does not exist\. Wait for the stage agent to return that path/);
});

test('gateReportRule names the path for an in-session stage and nothing for a controlled one', () => {
    const rule = gateReportRule('design', { 'stage.agents': ['survey'] }, '.fankeel/build/task-x/design.md');
    assert.match(rule, /^Before the gate, Write this stage's report to `\.fankeel\/build\/task-x\/design\.md`, ending in a `json gate` block/);
    assert.equal(gateReportRule('design', { 'stage.agents': ['survey', 'design'] }, '.fankeel/build/task-x/design.md'), null);
    assert.equal(gateReportRule('design', { 'stage.agents': [] }, null), null);
});

function task(dir, args) {
    const cfg = path.join(dir, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('task.js stage prints the report rule on entering an in-session stage, and not a controlled one', () => {
    const dir = tmp('fankeel-gate-report-');
    task(dir, ['start', '--session', MINE, '--task', 'x']);
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build' }));
    assert.match(task(dir, ['stage', 'design', '--session', MINE]), /^gate report: Before the gate, Write this stage's report to `\.fankeel\/build\/task-\d{8}T\d{6}\/design\.md`/m);
    assert.doesNotMatch(task(dir, ['stage', 'build', '--session', MINE]), /^gate report:/m);
});
