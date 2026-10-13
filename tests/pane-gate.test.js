'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const handoff = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-gate.ts')).href);
const entry = { started: '2026-10-10T20:33:51.000Z', stage: 'design', moves: [['survey', 1, 0], ['design', 2, 0]] };
const again = Object.assign({}, entry, { moves: [['design', 1, 0], ['build', 2, 0], ['design', 3, 0]] });
const one = { question: '接受這個方案，進入 plan 嗎？', header: 'design', options: [
    { label: '進入 plan (Recommended)', description: '核准這個方案' },
    { label: '留在 design', description: '沒有未定的事' },
    { label: '暫停', description: 'next 設為看過預覽' },
] };

test('taskDir is lib/handoff.js dirFor', async () => {
    const { taskDir } = await load();
    assert.equal(taskDir('F:/proj', entry), handoff.pendingPath('F:/proj', entry, 'design').replace(/\/[^/]+$/, ''));
    assert.equal(taskDir('F:\\proj\\', entry), taskDir('F:/proj', entry));
    assert.equal(taskDir('F:/proj', { started: 'nope' }), null);
    assert.equal(taskDir('', entry), null);
});

test('pendingName finds the file pendingPath names, on a first and a later lap', async () => {
    const { pendingName } = await load();
    for (const data of [entry, again]) {
        const pending = path.posix.basename(handoff.pendingPath('F:/proj', data, 'design'));
        assert.equal(pendingName(['context.md', 'survey.md', pending, 'build-pending.json'], 'design'), pending);
    }
    assert.equal(pendingName(['design-pending.json', 'design-2-pending.json'], 'design'), 'design-2-pending.json');
    assert.equal(pendingName(['designer-pending.json', 'design.md'], 'design'), null);
});

test('parsePending keeps what readPending keeps', async () => {
    const { parsePending } = await load();
    const now = 5000;
    const dir = tmp('pane-gate-');
    const cases = [
        JSON.stringify({ questions: [one], at: 1000, until: 9000 }),
        JSON.stringify({ questions: [one], at: 1000, until: 4000 }),
        JSON.stringify({ questions: [one], until: 9000 }),
        JSON.stringify({ questions: [one], at: 'soon', until: 9000 }),
        JSON.stringify({ questions: 'no', until: 9000 }),
        '{ not json',
    ];
    for (const body of cases) {
        const file = handoff.pendingPath(dir, entry, 'design');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
        const theirs = handoff.readPending(dir, entry, now);
        const ours = parsePending(body, now);
        assert.equal(ours === null, theirs === null, body);
        if (ours) {
            assert.deepEqual(ours.questions, theirs.questions);
            assert.equal(ours.at, theirs.at, body);
        }
    }
});
