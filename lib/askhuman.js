'use strict';

// The `ask human:` block a judgement carries (agents/fankeel-judge.md): what
// the controller asks the person through AskUserQuestion, the answers it files
// back under `## 人類的回答`, and the judgement still waiting on a person.
const fs = require('node:fs');
const path = require('node:path');
const docs = require('./docs.js');

const ANSWER = /^## Answer[ \t]*$/m;
const SECTION = /^## 人類的回答[ \t]*$/m;
const HEAD = /^([ \t]*)ask human:(.*)$/m;
const KEY = /^(?:-\s*)?(q|reason|option|pro|con):(.*)$/;
const ASSUMED = /\s*\(assumed\)\s*$/;
const ARROW = '→';
const PICK = '照 pick:';
const OUTSIDE = '分支外';
const OUTSIDE_DECISION = '分支外 — 第二次 /fankeel-ask 帶 --record <path>';
const MAX_QUESTIONS = 4;

// The block runs from the head line to the first non-blank line at the head's
// indent or less. Only the part after `## Answer` counts when that heading exists.
function blockOf(text) {
    const src = String(text || '').replace(/\r\n/g, '\n');
    const from = ANSWER.exec(src);
    const body = from ? src.slice(from.index + from[0].length) : src;
    const head = HEAD.exec(body);
    if (!head) return null;
    const indent = head[1].length;
    const lines = [];
    for (const line of body.slice(head.index + head[0].length).split('\n')) {
        if (line.trim() !== '' && line.length - line.trimStart().length <= indent) break;
        lines.push(line);
    }
    return { lines };
}

function optionOf(value) {
    const assumed = ASSUMED.test(value);
    const body = value.replace(ASSUMED, '');
    const at = body.indexOf(ARROW);
    return {
        label: (at < 0 ? body : body.slice(0, at)).trim(),
        branch: at < 0 ? null : body.slice(at + 1).trim(),
        assumed,
        pro: null,
        con: null,
    };
}

function parse(text) {
    const block = blockOf(text);
    if (!block) return { present: false, none: true, questions: [] };
    const questions = [];
    let question = null;
    let option = null;
    for (const raw of block.lines) {
        const m = KEY.exec(raw.trim());
        if (!m) continue;
        const value = m[2].trim();
        if (m[1] === 'q') {
            question = { q: value, reason: null, options: [] };
            questions.push(question);
            option = null;
            continue;
        }
        if (!question) {
            question = { q: '', reason: null, options: [] };
            questions.push(question);
        }
        if (m[1] === 'option') {
            option = optionOf(value);
            question.options.push(option);
        } else if (m[1] === 'reason') {
            question.reason = value;
        } else if (option) {
            option[m[1]] = value;
        }
    }
    return { present: true, none: questions.length === 0, questions };
}

function questionProblem(q) {
    if (!q.q) return '缺 q:';
    if (!q.reason) return '缺 reason:';
    const n = q.options.length;
    if (n < 2 || n > 4) return '選項 ' + n + ' 個，需 2–4 個';
    const assumed = q.options.filter((o) => o.assumed).length;
    if (assumed !== 1) return '(assumed) 選項 ' + assumed + ' 個，需恰好 1 個';
    const labels = new Set();
    for (const o of q.options) {
        const name = '選項「' + o.label + '」';
        if (!o.label) return 'option: 缺 label';
        if (labels.has(o.label)) return name + '重複';
        labels.add(o.label);
        if (o.assumed && o.branch !== null) return '(assumed) ' + name + '不得帶 →';
        if (!o.assumed && !o.branch) return name + '缺 → <分支>';
        if (!o.pro) return name + '缺 pro:';
        if (!o.con) return name + '缺 con:';
    }
    return null;
}

function problem(p) {
    if (!p || !p.present || p.none) return null;
    if (p.questions.length > MAX_QUESTIONS) return 'ask human: ' + p.questions.length + ' 題，上限 ' + MAX_QUESTIONS + ' 題';
    for (let i = 0; i < p.questions.length; i++) {
        const bad = questionProblem(p.questions[i]);
        if (bad) return '第' + (i + 1) + '題：' + bad;
    }
    return null;
}

function questionsOf(p) {
    const n = p.questions.length;
    return p.questions.map((q, i) => ({
        header: '判官 ' + (i + 1) + '/' + n,
        question: q.q + '（無路徑可答：' + q.reason + '）',
        options: q.options.map((o) => ({ label: o.label, description: o.assumed ? '判決假設這個 — 照 pick:' : '→ ' + o.branch })),
        multiSelect: false,
    }));
}

function decisionOf(rows) {
    if (rows.some((r) => r.outside)) return OUTSIDE_DECISION;
    const off = rows.filter((r) => r.off);
    if (!off.length) return PICK;
    return off.map((r) => '照 ' + r.answer + ' → ' + r.branch).join('；');
}

// `answers` is AskUserQuestion's map keyed by the question text questionsOf
// produced, or an object holding that map under `answers`.
function answersOf(p, answers) {
    const map = answers && answers.answers && typeof answers.answers === 'object' ? answers.answers : answers || {};
    const asked = questionsOf(p);
    const rows = [];
    const missing = [];
    p.questions.forEach((q, i) => {
        const answer = map[asked[i].question];
        if (answer === undefined || answer === null || answer === '') {
            missing.push(q.q);
            return;
        }
        const assumed = q.options.find((o) => o.assumed);
        const picked = q.options.find((o) => o.label === answer);
        rows.push({
            q: q.q,
            assumed: assumed.label,
            answer,
            branch: picked && !picked.assumed ? picked.branch : null,
            off: answer !== assumed.label,
            outside: !picked,
        });
    });
    return { rows, decision: decisionOf(rows), missing };
}

const cell = (s) => String(s).replace(/\|/g, '\\|');
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

function sectionOf(rows, decision, iso) {
    const lines = ['## 人類的回答', '', 'answered: ' + iso, '', '| 題目 | 判官假設 | 回答 | 分支 |', '|---|---|---|---|'];
    for (const r of rows) {
        const branch = r.outside ? OUTSIDE : r.branch || PICK;
        lines.push('| ' + [r.q, r.assumed, r.answer, branch].map(cell).join(' | ') + ' |');
    }
    lines.push('decision: ' + decision);
    return lines.join('\n') + '\n';
}

function parseAnswered(text) {
    const src = String(text || '').replace(/\r\n/g, '\n');
    const m = SECTION.exec(src);
    if (!m) return null;
    const rest = src.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    const section = next ? rest.slice(0, next.index) : rest;
    const lines = section.split('\n');
    const sep = lines.findIndex((l) => /^\|[\s:|-]+\|\s*$/.test(l));
    const rows = [];
    for (const line of sep < 0 ? [] : lines.slice(sep + 1)) {
        if (!/^\s*\|/.test(line)) break;
        const [q, assumed, answer, branch] = cells(line);
        rows.push({ q, assumed, answer, branch: branch === PICK || branch === OUTSIDE ? null : branch, off: branch !== PICK });
    }
    const at = /^answered: (.*)$/m.exec(section);
    const decision = /^decision: (.*)$/m.exec(section);
    return { at: at ? at[1].trim() : null, rows, decision: decision ? decision[1].trim() : null };
}

// The newest judgement of this session still waiting on a person: `human: yes`
// in its frontmatter and no `## 人類的回答` section yet.
function pendingFor(projectRoot, session) {
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)judgements$/.test(b.path));
    const dir = path.join(projectRoot, ...(bucket ? bucket.path : 'docs/judgements').split('/'));
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
    }
    let best = null;
    for (const name of names) {
        if (!name.endsWith('.md')) continue;
        const file = path.join(dir, name);
        const text = fs.readFileSync(file, 'utf8');
        const fm = docs.frontmatter(text) || {};
        if (fm.session !== session || fm.human !== 'yes' || SECTION.test(text)) continue;
        const judged = Date.parse(fm.judged) || 0;
        if (!best || judged > best.judged) best = { file, judged, text };
    }
    return best && { file: best.file, questions: questionsOf(parse(best.text)) };
}

module.exports = { parse, problem, questionsOf, answersOf, sectionOf, parseAnswered, pendingFor };
