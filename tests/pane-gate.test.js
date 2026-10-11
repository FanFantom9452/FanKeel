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
    const rows = gateRows({ questions: [one], until: 1, at: null }, 44, width);
    const buttons = rows.filter((r) => r.press !== undefined);
    assert.deepEqual(buttons.map((r) => r.hotkey), ['1', '2', '3', 't']);
    assert.deepEqual(buttons.slice(0, 3).map((r) => r.press), one.options.map((o) => o.label));
    assert.equal(buttons[3].press, '');
    assert.ok(buttons.every((r) => !r.bold));
    assert.deepEqual(rows[0], { block: 'gate', text: 'gate · design', bold: true, badge: true });
    assert.deepEqual(rows[1], { block: 'gate', text: one.question, bold: true });
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
});

test('gateRows for a gate that is not simple offers only the terminal', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one, one], until: 1, at: null }, 44, width);
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
    assert.ok(rows.some((r) => r.dim && r.text.includes('2 題')));
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
        assert.deepEqual(gateRows(pending, 44, width).filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
    }
});

test('gateRows keeps the question and every description whole, wrapped under its button, however many rows that takes', async () => {
    const { gateRows } = await load();
    const options = ['a', 'b', 'c', 'd'].map((label) => ({ label: '選項 ' + label, description: ('關於 ' + label + ' 的說明，寫得比一列長；').repeat(6) + label + ' 結束' }));
    const four = Object.assign({}, one, { question: '這一題的題目也比一列長，'.repeat(4) + '要選哪一個？', options });
    const rows = gateRows({ questions: [four], until: 1, at: null }, 44, width);
    const squash = (s) => s.replace(/\s+/g, '');
    assert.ok(rows.length > 18, 'the fixture would fit an 18-row pane: ' + rows.length);
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
    assert.equal(squash(rows.filter((r) => r.bold && !r.badge).map((r) => r.text).join('')), squash(four.question));
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['1', '2', '3', '4', 't']);
    options.forEach((o, i) => {
        const under = [];
        for (let k = rows.findIndex((r) => r.hotkey === String(i + 1)) + 1; rows[k].press === undefined; k++) under.push(rows[k]);
        assert.ok(under.length > 1, 'the description of ' + o.label + ' took one row');
        assert.ok(under.every((r) => r.dim && r.text.startsWith('   ')));
        assert.equal(squash(under.map((r) => r.text).join('')), squash(o.description));
    });
    assert.ok(rows[rows.length - 1].dim && rows[rows.length - 1].text.includes('ctrl+x'));
});

test('an option with no description draws only its button', async () => {
    const { gateRows } = await load();
    const bare = Object.assign({}, one, { options: [{ label: 'Yes' }, { label: 'No', description: '' }] });
    const rows = gateRows({ questions: [bare], until: 1, at: null }, 44, width);
    assert.deepEqual(rows.map((r) => r.hotkey || (r.badge ? 'badge' : r.bold ? 'question' : 'hint')), ['badge', 'question', '1', '2', 't', 'hint']);
});
