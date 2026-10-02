'use strict';

// gate-5: on 2026-10-02/03 three gates — two with two options, one whose option
// one named no stage — were refused only when the controller asked them, each
// costing a SendMessage round to the brain that wrote it. The brain now runs
// the same check itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main } = require('../scripts/gate-check.js');
const tmp = require('./tmp.js');

const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const TICKS = '```';

function project(stage, extra) {
    const root = tmp('fankeel-gate-check-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
        task: 't', claims: [], stage, active: true, route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(), ...extra,
    }));
    return root;
}

function handoff(root, labels) {
    const file = path.join(root, 'report.md');
    const questions = [{ header: '下一站', question: '要進下一站嗎？', options: labels.map((label) => ({ label, description: 'd' })) }];
    fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'pause here' }) + '\n' + TICKS + '\n');
    return file;
}

test('a sound gate prints gate ok and exits 0', () => {
    const root = project('plan');
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '沒有未決事項', '暫停'])]);
    assert.deepEqual(out, { text: 'gate ok', code: 0 });
});

test('two options: refused with gateProblem\'s own reason', () => {
    const root = project('plan');
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '暫停'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /invalid at questions\[0\]\.options: the first question has 2 options, 3 at least/);
});

test('option one naming no stage at the route\'s end: refused, naming what it may say', () => {
    const root = project('land');
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['結束任務', '沒有', '暫停'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /questions\[0\]\.options\[0\]\.label: option one "結束任務" names none of: down, 收工/);
});

test('no gate block, or no such session: exit 1; no file named: usage, exit 2', () => {
    const root = project('plan');
    const bare = path.join(root, 'bare.md');
    fs.writeFileSync(bare, '# report\n');
    assert.equal(main(['--session', SESSION, '--root', root, bare]).code, 1);
    assert.equal(main(['--session', 'bbbbbbbb-0000-4000-8000-000000000002', '--root', root, bare]).code, 1);
    assert.equal(main(['--session', SESSION]).code, 2);
});

test('three options with no pause label: refused', () => {
    const root = project('plan');
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '沒有未決事項', '改天再說'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /invalid at questions: no option says pause/);
});

test('a session with a floor refuses an option naming a lighter class', () => {
    const root = project('plan', { floor: 'architectural' });
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '改走 bounded 路線', '暫停'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /names bounded, below this task's floor architectural/);
});

test('a session record with no stage: exit 1', () => {
    const root = project(undefined);
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '沒有未決事項', '暫停'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /no session .* with a stage/);
});
