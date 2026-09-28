'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { contextPath } = require('../lib/handoff.js');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-09-19T09:30:12.345Z';

function seed(root, over) {
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
        task: 'x', stage: 'build', active: true, started: STARTED, updated: new Date().toISOString(),
    }, over), null, 2) + '\n');
}

function seedProfile(root, values) {
    const dir = path.join(root, '.fankeel');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(values, null, 2) + '\n');
}

function writeContext(root, text) {
    const file = contextPath(root, { started: STARTED });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
}

function run(root, payload) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
    });
}

const start = (root, over) => Object.assign({
    session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'agt_01', agent_type: 'general-purpose',
}, over);

const contextOf = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

test('a plain subagent brief inlines context.md\'s content, not just its path', () => {
    const root = mkTmp('fankeel-render-ctx-');
    seed(root);
    writeContext(root, '- lib/x.js exports frob() — lib/x.js:12 @ abc1234\n');
    const text = contextOf(run(root, start(root)));
    assert.match(text, /exports frob\(\)/);
    assert.doesNotMatch(text, /context: .*facts already verified/);
});

test('a plain subagent brief says nothing about context when the file is empty', () => {
    const root = mkTmp('fankeel-render-ctx-');
    seed(root);
    const text = contextOf(run(root, start(root)));
    assert.doesNotMatch(text, /context, verified in this task/);
});

test('a fankeel-brain brief also inlines context.md\'s content', () => {
    const root = mkTmp('fankeel-render-ctx-');
    seedProfile(root, { 'stage.agents': ['build'] });
    seed(root);
    writeContext(root, '- lib/y.js exports zap() — lib/y.js:5 @ def5678\n');
    const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
    assert.match(text, /exports zap\(\)/);
});
