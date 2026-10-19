'use strict';

// brain-1: on 2026-10-19 a verify gate went out with its adversary line
// reading that the adversary and the render review had not come back
// (.fankeel/build/task-20261019T115119/verify.md:25). gate-check.js, which the
// stage agent runs before it returns the path, now refuses that gate.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main } = require('../scripts/gate-check.js');
const tmp = require('./tmp.js');

const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const TICKS = '```';
const LABELS = ['land (Recommended)', '沒有未決事項', '暫停'];

function project(stage) {
    const root = tmp('fankeel-gate-review-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
        task: 't', claims: [], stage, active: true, route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(),
    }));
    return root;
}

function handoff(root, line) {
    const file = path.join(root, 'verify.md');
    const questions = [{ header: '下一站', question: '要進下一站嗎？', options: LABELS.map((label) => ({ label, description: 'd' })) }];
    fs.writeFileSync(file, '# verify\n\n- claim — held\n' + line + '\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'pause here' }) + '\n' + TICKS + '\n');
    return file;
}

const check = (root, file) => main(['--session', SESSION, '--root', root, file]);

test('a verify gate whose adversary line says it has not returned is refused', () => {
    const root = project('verify');
    for (const line of [
        '- adversary：已派 1 位（sonnet）與 1 位畫面審查（sonnet），寫報告時都未回傳，結果未知',
        '- adversary: 已派一個 fankeel-reviewer（sonnet），結果尚未回來，不能宣稱 nothing',
        '- adversary: pending',
        '- adversary: dispatched one reviewer, not yet returned',
    ]) {
        const out = check(root, handoff(root, line));
        assert.equal(out.code, 1, line);
        assert.match(out.text, /^gate-check\.js: the adversary line says it has not returned — /, line);
        assert.match(out.text, /`waiting`/, line);
    }
});

test('an adversary line with a result, even one quoting "pending", passes', () => {
    const root = project('verify');
    for (const line of [
        '- adversary: nothing — one reviewer re-ran the suite and the cited lines',
        '- adversary: scripts/upgrade.js:34-39 an unreadable TODO.md reads as "nothing pending" and exits 0 (CONFIRMED → build)',
        '- adversary: nothing defeated; it re-read the full Waiting section',
    ]) {
        assert.deepEqual(check(root, handoff(root, line)), { text: 'gate ok', code: 0 }, line);
    }
});

test('only a verify gate is held to it', () => {
    const root = project('plan');
    const file = handoff(root, '- adversary: 寫報告時未回傳');
    const questions = [{ header: '下一站', question: '要進下一站嗎？', options: ['build (Recommended)', '沒有未決事項', '暫停'].map((label) => ({ label, description: 'd' })) }];
    fs.writeFileSync(file, '# plan\n\n- adversary: 寫報告時未回傳\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'pause here' }) + '\n' + TICKS + '\n');
    assert.deepEqual(check(root, file), { text: 'gate ok', code: 0 });
});
