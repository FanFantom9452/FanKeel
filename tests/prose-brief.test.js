'use strict';

// The chosen prose style reaches the stage agent's brief (every stage but
// build, whose brief is the closest to SubagentStart's 10,000-character cap;
// see tests/brief.test.js) and the writer's, and nobody else's.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');
const { renderBrief } = require('../lib/render.js');
const prose = require('../lib/prose.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

function seed(root, over) {
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
        task: 'rework the colour ramp',
        claims: ['statusline.ps1', 'statusline.sh'],
        stage: 'build',
        active: true,
        started: '2026-09-19T09:30:12.345Z',
        updated: new Date().toISOString(),
    }, over), null, 2) + '\n');
}

function seedProfile(root, values) {
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');
}

function brief(root, agentType) {
    const out = execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'agt_01', agent_type: agentType }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
}

const mine = (stage) => ({ sessionId: SESSION, data: { task: 't', stage, active: true, started: '2026-09-19T09:30:12.345Z', claims: [] } });
const prof = (values) => ({ values: Object.assign({ 'stage.agents': STAGES.slice(), 'dispatch.floor': 'sonnet' }, values), sources: {}, unreadable: [] });

test('a writer\'s brief carries writer\'s rules when prose.style is unset', () => {
    const root = mkTmp('fankeel-prose-brief-');
    const text = renderBrief({ mine: mine('build'), agentType: 'fankeel:fankeel-writer', root, profile: prof({}) });
    assert.ok(text.includes('  - Prose style `writer` (profile `prose.style`), for the page you write:'), text);
    assert.ok(text.includes(prose.STYLES.writer));
});

test('sepia replaces writer, in the stage agent\'s brief and the writer\'s', () => {
    const root = mkTmp('fankeel-prose-brief-');
    for (const type of ['fankeel:fankeel-writer', 'fankeel:fankeel-brain']) {
        const text = renderBrief({ mine: mine('plan'), agentType: type, root, profile: prof({ 'prose.style': 'sepia' }) });
        assert.ok(text.includes(prose.STYLES.sepia), type);
        assert.ok(!text.includes(prose.STYLES.writer), type);
    }
});

test('custom carries .fankeel/prose.md, and falls back to writer with a line when it is over MAX', () => {
    const root = mkTmp('fankeel-prose-brief-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), 'Write like a field manual.\n');
    const own = renderBrief({ mine: mine('design'), agentType: 'fankeel:fankeel-brain', root, profile: prof({ 'prose.style': 'custom' }) });
    assert.ok(own.includes('      Write like a field manual.'), own);
    fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), 'z'.repeat(prose.MAX + 1));
    const over = renderBrief({ mine: mine('design'), agentType: 'fankeel:fankeel-brain', root, profile: prof({ 'prose.style': 'custom' }) });
    assert.ok(over.includes(prose.STYLES.writer));
    assert.ok(over.includes('over ' + prose.MAX + ' — using writer'));
});

test('nobody else gets the style, and neither does the build stage agent', () => {
    const root = mkTmp('fankeel-prose-brief-');
    for (const type of ['fankeel:fankeel-reader', 'fankeel:fankeel-reviewer', 'fankeel:fankeel-implementer']) {
        assert.ok(!renderBrief({ mine: mine('plan'), agentType: type, root, profile: prof({}) }).includes('(profile `prose.style`)'), type);
    }
    assert.ok(!renderBrief({ mine: mine('build'), agentType: 'fankeel:fankeel-brain', root, profile: prof({}) }).includes('(profile `prose.style`)'));
});

test('the writer\'s SubagentStart brief carries the profile\'s style', () => {
    const root = mkTmp('fankeel-prose-hook-');
    seedProfile(root, { 'prose.style': 'sepia' });
    seed(root);
    assert.ok(brief(root, 'fankeel:fankeel-writer').includes(prose.STYLES.sepia));
});

test('a MAX-long custom style keeps every stage agent\'s brief under 10,000 characters', (t) => {
    for (const stage of STAGES) {
        const root = mkTmp('fankeel-prose-size-');
        seedProfile(root, { 'stage.agents': [stage], 'prose.style': 'custom' });
        fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), '字'.repeat(prose.MAX));
        seed(root, { stage });
        const text = brief(root, 'fankeel:fankeel-brain');
        t.diagnostic(stage + ' brain brief ' + text.length + ' chars');
        assert.ok(text.length < 10000, stage + ' brain brief is ' + text.length + ' chars');
    }
});
