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
const width = (s) => [...s].length;
const cut = (s, cols) => ([...s].length <= cols ? s : [...s].slice(0, cols - 1).join('') + '…');

test('taskDir is lib/handoff.js dirFor', async () => {
    const { taskDir } = await load();
    assert.equal(taskDir('F:/proj', entry), handoff.pendingPath('F:/proj', entry, 'design').replace(/\/[^/]+$/, ''));
    assert.equal(taskDir('F:\\proj\\', entry), taskDir('F:/proj', entry));
    assert.equal(taskDir('F:/proj', { started: 'nope' }), null);
    assert.equal(taskDir('', entry), null);
});

test('pendingName finds the file pendingPath names, on a first and a later lap', async () => {
    const { pendingName, answerName } = await load();
    for (const data of [entry, again]) {
        const pending = path.posix.basename(handoff.pendingPath('F:/proj', data, 'design'));
        const answer = path.posix.basename(handoff.answerPath('F:/proj', data, 'design'));
        assert.equal(pendingName(['context.md', 'survey.md', pending, 'build-pending.json'], 'design'), pending);
        assert.equal(answerName(pending), answer);
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

test('a single single-select question is simple; anything else is not', async () => {
    const { simple } = await load();
    assert.equal(simple({ questions: [one], until: 1 }), true);
    assert.equal(simple({ questions: [one, one], until: 1 }), false);
    assert.equal(simple({ questions: [Object.assign({}, one, { multiSelect: true })], until: 1 }), false);
});

test('gateRows: one plain button a option with hotkeys from 1, then the terminal button', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one], until: 1, at: null }, 44, 99, cut);
    const buttons = rows.filter((r) => r.press !== undefined);
    assert.deepEqual(buttons.map((r) => r.hotkey), ['1', '2', '3', 't']);
    assert.deepEqual(buttons.slice(0, 3).map((r) => r.press), one.options.map((o) => o.label));
    assert.equal(buttons[3].press, '');
    assert.ok(buttons.every((r) => !r.bold));
    assert.ok(rows.some((r) => r.text.includes(one.question)));
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
});

test('gateRows for a gate that is not simple offers only the terminal', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one, one], until: 1, at: null }, 44, 99, cut);
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
});

test('answerText is read back by answersSince, and refuses a label nobody asked', async () => {
    const { answerText } = await load();
    const pending = { questions: [one], until: 1 };
    const dir = tmp('pane-gate-');
    const file = path.join(dir, 'design-answer.md');
    fs.writeFileSync(file, answerText(pending, '留在 design'));
    assert.deepEqual(handoff.answersSince(file, 0), { [one.question]: '留在 design' });
    assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify({ answers: { [one.question]: '留在 design' } }, null, 2) + '\n');
    assert.equal(answerText(pending, '沒有這個選項'), null);
    assert.equal(answerText({ questions: [one, one], until: 1 }, '留在 design'), null);
});

test('HANDOFF is what handedOffSince reads', async () => {
    const { HANDOFF } = await load();
    const dir = tmp('pane-gate-');
    const file = path.join(dir, 'design-answer.md');
    fs.writeFileSync(file, HANDOFF);
    assert.equal(handoff.handedOffSince(file, 0), true);
});

test('a question with no options, or more than four, is not simple and offers only the terminal', async () => {
    const { simple, gateRows } = await load();
    const five = Object.assign({}, one, { options: ['a', 'b', 'c', 'd', 'e'].map((label) => ({ label })) });
    const none = Object.assign({}, one, { options: [] });
    for (const q of [five, none]) {
        const pending = { questions: [q], until: 1 };
        assert.equal(simple(pending), false);
        assert.deepEqual(gateRows(pending, 44, 99, cut).filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
    }
});

test('gateRows stays inside its room by dropping descriptions, then the hint, never a button', async () => {
    const { gateRows } = await load();
    const four = Object.assign({}, one, { options: ['a', 'b', 'c', 'd'].map((label) => ({ label, description: 'about ' + label })) });
    const pending = { questions: [four], until: 1, at: null };
    for (const [room, rows] of [[12, 12], [8, 8], [7, 7]]) {
        const got = gateRows(pending, 44, room, cut);
        assert.equal(got.length, rows, 'room ' + room);
        assert.deepEqual(got.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['1', '2', '3', '4', 't']);
        assert.ok(got[0].bold && got[1].text === four.question);
    }
    assert.ok(gateRows(pending, 44, 8, cut).some((r) => r.text.includes('ctrl+x')));
    assert.ok(!gateRows(pending, 44, 7, cut).some((r) => r.text.includes('ctrl+x')));
    assert.ok(!gateRows(pending, 44, 8, cut).some((r) => r.text.includes('about')));
});
