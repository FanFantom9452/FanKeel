'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const askhuman = require('../lib/askhuman.js');

const { parse, problem, questionsOf, answersOf, sectionOf, parseAnswered, pendingFor } = askhuman;

// A question is the lines `  - q:` opens and the option/reason lines close,
// so each near-miss below changes one line and nothing else.
function opt(label, o = {}) {
    const branch = 'branch' in o ? o.branch : (o.assumed ? null : '分支甲');
    const pro = 'pro' in o ? o.pro : '老客戶不壞';
    const con = 'con' in o ? o.con : '多一條維護線';
    const head = '    option: ' + label + (branch === null ? '' : ' → ' + branch) + (o.assumed ? ' (assumed)' : '');
    return [head, ...(pro === null ? [] : ['      pro: ' + pro]), ...(con === null ? [] : ['      con: ' + con])];
}

function question({ q = '要不要留舊路徑？', reason = '只有產品負責人知道', options } = {}) {
    return ['  - q: ' + q, ...options.flatMap((o) => o), ...(reason === null ? [] : ['    reason: ' + reason])];
}

const doc = (...questions) => ['judge text', '', '## Answer', '', 'pick: 拿掉', '', 'ask human:', ...questions.flat()].join('\n');

const Q1 = () => question({ options: [opt('留著'), opt('拿掉', { assumed: true })] });
const Q2 = () => question({ q: '色票用哪一組？', reason: '色彩偏好只有設計師知道', options: [opt('暖色', { branch: '走 warm' }), opt('冷色', { assumed: true })] });

function nearMiss(questions) {
    const p = parse(doc(...questions));
    return problem(p);
}

test('parse reads two questions with options, branches, assumed flags, pro/con and reason', () => {
    const p = parse(doc(Q1(), Q2()));
    assert.equal(p.present, true);
    assert.equal(p.none, false);
    assert.equal(p.questions.length, 2);
    assert.equal(p.questions[0].q, '要不要留舊路徑？');
    assert.equal(p.questions[0].reason, '只有產品負責人知道');
    assert.deepEqual(p.questions[0].options[0], { label: '留著', branch: '分支甲', assumed: false, pro: '老客戶不壞', con: '多一條維護線' });
    assert.deepEqual(p.questions[0].options[1], { label: '拿掉', branch: null, assumed: true, pro: '老客戶不壞', con: '多一條維護線' });
    assert.equal(p.questions[1].options[0].branch, '走 warm');
    assert.equal(p.questions[1].options[1].assumed, true);
    assert.equal(problem(p), null);
});

test('parse reads absent and nothing as no questions, and only the text after ## Answer', () => {
    assert.deepEqual(parse('pick: 拿掉\n\nno questions here'), { present: false, none: true, questions: [] });
    assert.deepEqual(parse('## Answer\n\npick: x\n\nask human: nothing\n'), { present: true, none: true, questions: [] });
    const before = 'ask human:\n  - q: 寫在答案之前\n\n## Answer\n\nask human: nothing\n';
    assert.deepEqual(parse(before), { present: true, none: true, questions: [] });
});

test('parse takes the first ask human: block and stops at the next column-0 line', () => {
    const text = doc(Q1()) + '\n\nnote after the block\n' + '\nask human:\n  - q: 第二個區塊\n';
    const p = parse(text);
    assert.equal(p.questions.length, 1);
    assert.equal(p.questions[0].q, '要不要留舊路徑？');
});

test('problem accepts the valid two-question block', () => {
    assert.equal(problem(parse(doc(Q1(), Q2()))), null);
});

test('problem rejects five questions, one over the cap', () => {
    const msg = nearMiss([Q1(), Q1(), Q1(), Q1(), Q1()]);
    assert.match(msg, /5 題/);
    assert.match(msg, /上限 4/);
});

test('problem rejects a question with one option', () => {
    assert.match(nearMiss([question({ options: [opt('拿掉', { assumed: true })] })]), /第1題.*選項 1 個/);
});

test('problem rejects a question with five options', () => {
    const five = ['A', 'B', 'C', 'D'].map((l) => opt(l));
    assert.match(nearMiss([question({ options: [...five, opt('E', { assumed: true })] })]), /第1題.*選項 5 個/);
});

test('problem rejects two assumed options', () => {
    const msg = nearMiss([question({ options: [opt('留著'), opt('拿掉', { assumed: true }), opt('砍掉', { assumed: true })] })]);
    assert.match(msg, /第1題.*\(assumed\) 選項 2 個/);
});

test('problem rejects a question with no assumed option', () => {
    assert.match(nearMiss([question({ options: [opt('留著'), opt('拿掉')] })]), /第1題.*\(assumed\) 選項 0 個/);
});

test('problem rejects an assumed option that carries an arrow', () => {
    assert.match(nearMiss([question({ options: [opt('留著'), opt('拿掉', { assumed: true, branch: '走 x' })] })]), /第1題.*拿掉.*不得帶 →/);
});

test('problem rejects a non-assumed option with no arrow', () => {
    assert.match(nearMiss([question({ options: [opt('留著', { branch: null }), opt('拿掉', { assumed: true })] })]), /第1題.*留著.*缺 →/);
});

test('problem rejects a non-assumed option with an empty branch', () => {
    assert.match(nearMiss([question({ options: [opt('留著', { branch: '' }), opt('拿掉', { assumed: true })] })]), /第1題.*留著.*缺 →/);
});

test('problem rejects a duplicated label within one question', () => {
    assert.match(nearMiss([question({ options: [opt('留著'), opt('留著', { assumed: true })] })]), /第1題.*留著.*重複/);
});

test('problem rejects an option line with no label', () => {
    assert.match(nearMiss([question({ options: [opt(''), opt('拿掉', { assumed: true })] })]), /第1題.*缺 label/);
});

test('problem rejects an option missing its con line', () => {
    assert.match(nearMiss([question({ options: [opt('留著', { con: null }), opt('拿掉', { assumed: true })] })]), /第1題.*留著.*缺 con:/);
});

test('problem rejects an option missing its pro line', () => {
    assert.match(nearMiss([question({ options: [opt('留著', { pro: null }), opt('拿掉', { assumed: true })] })]), /第1題.*留著.*缺 pro:/);
});

test('problem rejects a question with no q or no reason, and names the second question', () => {
    assert.match(nearMiss([Q1(), question({ q: '', options: [opt('留著'), opt('拿掉', { assumed: true })] })]), /第2題.*缺 q:/);
    assert.match(nearMiss([question({ reason: null, options: [opt('留著'), opt('拿掉', { assumed: true })] })]), /第1題.*缺 reason:/);
});

test('questionsOf shapes each question for AskUserQuestion with the header and the assumed description', () => {
    const qs = questionsOf(parse(doc(Q1(), Q2())));
    assert.deepEqual(qs[0], {
        header: '判官 1/2',
        question: '要不要留舊路徑？（無路徑可答：只有產品負責人知道）',
        options: [
            { label: '留著', description: '→ 分支甲' },
            { label: '拿掉', description: '判決假設這個 — 照 pick:' },
        ],
        multiSelect: false,
    });
    assert.equal(qs[1].header, '判官 2/2');
    assert.equal(qs[1].options[0].description, '→ 走 warm');
});

const ANSWER_KEY_1 = '要不要留舊路徑？（無路徑可答：只有產品負責人知道）';
const ANSWER_KEY_2 = '色票用哪一組？（無路徑可答：色彩偏好只有設計師知道）';

test('answersOf reports all assumed as 照 pick: with no off rows', () => {
    const r = answersOf(parse(doc(Q1(), Q2())), { [ANSWER_KEY_1]: '拿掉', [ANSWER_KEY_2]: '冷色' });
    assert.deepEqual(r.missing, []);
    assert.equal(r.decision, '照 pick:');
    assert.deepEqual(r.rows.map((x) => [x.q, x.assumed, x.answer, x.branch, x.off, x.outside]), [
        ['要不要留舊路徑？', '拿掉', '拿掉', null, false, false],
        ['色票用哪一組？', '冷色', '冷色', null, false, false],
    ]);
});

test('answersOf joins one off row into the decision line with its branch', () => {
    const r = answersOf(parse(doc(Q1(), Q2())), { [ANSWER_KEY_1]: '留著', [ANSWER_KEY_2]: '冷色' });
    assert.equal(r.rows[0].off, true);
    assert.equal(r.rows[0].outside, false);
    assert.equal(r.rows[0].branch, '分支甲');
    assert.equal(r.decision, '照 留著 → 分支甲');
});

test('answersOf joins two off rows with the full-width semicolon', () => {
    const r = answersOf(parse(doc(Q1(), Q2())), { [ANSWER_KEY_1]: '留著', [ANSWER_KEY_2]: '暖色' });
    assert.equal(r.decision, '照 留著 → 分支甲；照 暖色 → 走 warm');
});

test('answersOf marks an answer matching no option as outside and asks for a second ask with --record', () => {
    const r = answersOf(parse(doc(Q1(), Q2())), { [ANSWER_KEY_1]: '砍掉', [ANSWER_KEY_2]: '冷色' });
    assert.deepEqual([r.rows[0].off, r.rows[0].outside, r.rows[0].branch], [true, true, null]);
    assert.equal(r.decision, '分支外 — 第二次 /fankeel-ask 帶 --record <path>');
});

test('answersOf lists a question with no entry as missing and accepts the {answers} form', () => {
    const r = answersOf(parse(doc(Q1(), Q2())), { answers: { [ANSWER_KEY_1]: '拿掉' } });
    assert.deepEqual(r.missing, ['色票用哪一組？']);
    assert.equal(r.rows.length, 1);
    assert.equal(r.decision, '照 pick:');
});

test('sectionOf writes the exact section, one row per question and the decision under the table', () => {
    const rows = [
        { q: '要不要留舊路徑？', assumed: '拿掉', answer: '留著', branch: '分支甲', off: true, outside: false },
        { q: '色票 | 哪組？', assumed: '冷色', answer: '冷色', branch: null, off: false, outside: false },
    ];
    assert.equal(sectionOf(rows, '照 留著 → 分支甲', '2026-10-30T08:00:00.000Z'), [
        '## 人類的回答',
        '',
        'answered: 2026-10-30T08:00:00.000Z',
        '',
        '| 題目 | 判官假設 | 回答 | 分支 |',
        '|---|---|---|---|',
        '| 要不要留舊路徑？ | 拿掉 | 留著 | 分支甲 |',
        '| 色票 \\| 哪組？ | 冷色 | 冷色 | 照 pick: |',
        'decision: 照 留著 → 分支甲',
        '',
    ].join('\n'));
});

test('parseAnswered reads back what sectionOf wrote, including off and outside rows', () => {
    const iso = '2026-10-30T08:00:00.000Z';
    const r = answersOf(parse(doc(Q1(), Q2())), { [ANSWER_KEY_1]: '砍掉', [ANSWER_KEY_2]: '暖色' });
    const decision = r.decision;
    const text = doc(Q1(), Q2()) + '\n' + sectionOf(r.rows, decision, iso);
    assert.deepEqual(parseAnswered(text), {
        at: iso,
        rows: [
            { q: '要不要留舊路徑？', assumed: '拿掉', answer: '砍掉', branch: null, off: true },
            { q: '色票用哪一組？', assumed: '冷色', answer: '暖色', branch: '走 warm', off: true },
        ],
        decision,
    });
});

test('parseAnswered returns null when there is no 人類的回答 section', () => {
    assert.equal(parseAnswered(doc(Q1())), null);
});

// A judgement file as judge.js record writes its frontmatter, with the
// ask human: block under ## Answer. The test appends the section itself.
function judgement(root, name, { judged, session, human = 'yes' }) {
    const dir = path.join(root, 'docs', 'judgements');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    const text = [
        '---',
        'judged: ' + judged,
        'model: fable',
        'agent: fankeel-judge',
        'task: "pick a colour"',
        'session: ' + session,
        'stage: design',
        'human: ' + human,
        '---',
        '',
        '# 色票',
        '',
        '## Question',
        '',
        '色票用哪一組？',
        '',
        '## Answer',
        '',
        'pick: 冷色',
        'ask human:',
        '  - q: 色票用哪一組？',
        '    option: 暖色 → 走 warm',
        '      pro: 溫暖',
        '      con: 偏黃',
        '    option: 冷色 (assumed)',
        '      pro: 清爽',
        '      con: 偏冷',
        '    reason: 色彩偏好只有設計師知道',
        '',
    ].join('\n');
    fs.writeFileSync(file, text);
    return file;
}

test('pendingFor picks the newest unanswered human judgement of the session and goes null once answered', () => {
    const root = tmp('fankeel-askhuman-');
    const A = 'aaaaaaaa-1111-2222-3333-444444444444';
    const B = 'bbbbbbbb-1111-2222-3333-444444444444';
    const older = judgement(root, '2026-10-29-old.md', { judged: '2026-10-29T10:00:00.000Z', session: A });
    const newer = judgement(root, '2026-10-30-new.md', { judged: '2026-10-30T10:00:00.000Z', session: A });
    const other = judgement(root, '2026-10-30-other.md', { judged: '2026-10-30T11:00:00.000Z', session: B });
    judgement(root, '2026-10-30-no-human.md', { judged: '2026-10-30T12:00:00.000Z', session: A, human: 'no' });

    const first = pendingFor(root, A);
    assert.equal(first.file, newer);
    assert.deepEqual(first.questions, questionsOf(parse(fs.readFileSync(newer, 'utf8'))));
    assert.equal(first.questions.length, 1);

    fs.appendFileSync(newer, sectionOf(answersOf(parse(fs.readFileSync(newer, 'utf8')), { [ANSWER_KEY_2]: '冷色' }).rows, '照 pick:', '2026-10-30T09:00:00.000Z'));
    assert.equal(pendingFor(root, A).file, older);

    fs.appendFileSync(older, sectionOf(answersOf(parse(fs.readFileSync(older, 'utf8')), { [ANSWER_KEY_2]: '冷色' }).rows, '照 pick:', '2026-10-30T09:00:00.000Z'));
    assert.equal(pendingFor(root, A), null);

    assert.equal(pendingFor(root, B).file, other);
    assert.equal(pendingFor(root, 'cccccccc-1111-2222-3333-444444444444'), null);
});

test('pendingFor is null when no judgements directory exists', () => {
    assert.equal(pendingFor(tmp('fankeel-askhuman-empty-'), 'aaaaaaaa-1111-2222-3333-444444444444'), null);
});
