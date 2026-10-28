'use strict';

// The style a stage agent and a writer write in for a person: the rules
// injected into their briefs, chosen by the profile's `prose.style`. The two
// mechanical checks every style keeps — sentence width and bare codes — are
// lib/plain.js's and do not live here.
// docs/99-archive/2026-10-05-prose-style-design.md.

const fs = require('node:fs');
const path = require('node:path');

// `writer` is agents/fankeel-writer.md's own `## Every section`; `plain` is
// docs/90-agent/reference/plain-language.md's five rules; `sepia` is
// rewritten from sepia's references/professional-pass.md checks 6-9 and
// style-pass.md §5, never read from sepia at run time, since not every
// machine has sepia installed.
const STYLES = {
    writer: 'Conclusion first, then why. Every section says what it does, why it is this way, and gives one example the reader can copy. Length follows the stakes: a setting that can lose work gets a paragraph, a cosmetic one a line. Say what a term means the first time it appears, and keep the connectives. Use a list or a table only for things that really enumerate; everything else is paragraphs.',
    plain: 'One sentence says one thing: two things are two sentences. The result first, then the reason. Name who did what: a person, an agent or a program is the subject. No code stands where a name should be. Short sentences, active voice, one fixed word for one thing, after ASD-STE100 controlled English. Number the steps of a procedure.',
    sepia: 'Vary sentence length: break up a run of sentences of similar length, but do not shorten them all, since a paragraph of only short sentences reads as machine-made too. Use a list or a table only for items that really enumerate; a first, second, third paragraph becomes a real list or an argued paragraph. Take a stance where a judgement is needed. End when the content ends, with no closing restatement. Adapted from sepia.',
};
const NAMES = ['writer', 'plain', 'sepia', 'custom'];

// SUGGESTED is the longest built-in rounded up (sepia, 422); a custom text
// over it is warned about when set, never refused. Over MAX the brief falls
// back to writer: the design and plan brain briefs keep about 3,500
// characters of room under SubagentStart's 10,000 (tests/brief.test.js).
const SUGGESTED = 450;
const MAX = 1200;
const CUSTOM_FILE = ['.fankeel', 'prose.md'];

function length(text) {
    return [...String(text)].length;
}

function customFile(projectRoot) {
    return path.join(projectRoot, ...CUSTOM_FILE);
}

// trim() also drops a leading byte-order mark.
function styleFor(values, projectRoot) {
    const want = values && typeof values['prose.style'] === 'string' ? values['prose.style'] : 'writer';
    if (want !== 'custom') {
        const name = Object.prototype.hasOwnProperty.call(STYLES, want) ? want : 'writer';
        return { style: name, text: STYLES[name], note: null };
    }
    let text = '';
    try { text = fs.readFileSync(customFile(projectRoot), 'utf8').trim(); } catch (e) { /* missing reads as empty */ }
    if (!text) return { style: 'writer', text: STYLES.writer, note: '.fankeel/prose.md is missing or empty — using writer' };
    if (length(text) > MAX) return { style: 'writer', text: STYLES.writer, note: '.fankeel/prose.md is ' + length(text) + ' characters, over ' + MAX + ' — using writer' };
    return { style: 'custom', text, note: null };
}

// The brief's lines: one naming the style, then the rules a line each,
// indented under it, then the fallback's reason when there is one.
function briefLines(values, projectRoot, audience) {
    const s = styleFor(values, projectRoot);
    const lines = ['  - Prose style `' + s.style + '` (profile `prose.style`), for ' + audience + ':'];
    for (const l of s.text.split(/\r?\n/)) if (l.trim()) lines.push('      ' + l.trim());
    if (s.note) lines.push('      (' + s.note + ')');
    return lines;
}

// What `task.js profile set prose.style` prints under its head line, the
// fallback's note first. `estimate` is scripts/input-check.js's
// estimateTokens, passed in because lib/ does not reach into scripts/.
function costLines(projectRoot, style, estimate) {
    const s = styleFor({ 'prose.style': style }, projectRoot);
    const n = length(s.text);
    const lines = [];
    if (s.note) lines.push(s.note);
    lines.push(n + ' characters, ~' + estimate(s.text) + ' tok in every stage agent\'s brief but build\'s, and every writer\'s; suggested ' + SUGGESTED + ', ceiling ' + MAX);
    if (s.style === 'custom' && n > SUGGESTED) lines.push('over the suggested ' + SUGGESTED + ' — set anyway; this is a warning, not a refusal');
    return lines;
}

// The rules the station's custom editor offers, one click appending `text`.
// The first four and the last two come from the built-in styles; `alone` and
// `whole` are the two that carried over from subtitle line-breaking
// (docs/90-agent/judgements/2026-10-28-writer-segmentation-rules.md).
const RULES = [
    { id: 'conclusion', zh: '先講結論', en: 'Conclusion first', text: 'Conclusion first, then why.' },
    { id: 'example', zh: '每節附例子', en: 'An example per section', text: 'Every section says what it does, why it is this way, and gives one example the reader can copy.' },
    { id: 'one', zh: '一句一件事', en: 'One thing a sentence', text: 'One sentence says one thing: two things are two sentences.' },
    { id: 'who', zh: '寫誰做了什麼', en: 'Name who did what', text: 'Name who did what: a person, an agent or a program is the subject.' },
    { id: 'alone', zh: '每句單獨看也懂', en: 'Each sentence stands alone', text: 'Each sentence stands alone: a reader who sees only that sentence still understands it. End it on the point, never on a dangling connective (because, so, but, if — 因為、所以、但是、如果).' },
    { id: 'whole', zh: '不拆名稱與數字單位', en: 'Keep names and units whole', text: 'Never split a name, a number and its unit, or a fixed phrase across a line or a table cell.' },
    { id: 'vary', zh: '長短句交錯', en: 'Vary sentence length', text: 'Vary sentence length: break up a run of sentences of similar length, but do not shorten them all.' },
    { id: 'stance', zh: '該下判斷就下', en: 'Take a stance', text: 'Take a stance where a judgement is needed. End when the content ends, with no closing restatement.' },
];

function readCustom(projectRoot) {
    try { return fs.readFileSync(customFile(projectRoot), 'utf8').replace(/^﻿/, ''); } catch (e) { return ''; }
}

// Over MAX is refused rather than written: styleFor would fall back to
// writer, and the page would show a style that is not in force.
function writeCustom(projectRoot, text) {
    const body = String(text || '').replace(/\r\n/g, '\n').trim();
    const n = length(body);
    if (n > MAX) return { ok: false, reason: n + ' characters, over ' + MAX };
    fs.mkdirSync(path.dirname(customFile(projectRoot)), { recursive: true });
    fs.writeFileSync(customFile(projectRoot), body ? body + '\n' : '');
    return { ok: true, length: n };
}

module.exports = { STYLES, NAMES, SUGGESTED, MAX, RULES, length, styleFor, briefLines, costLines, readCustom, writeCustom };
