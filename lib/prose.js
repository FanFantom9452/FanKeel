'use strict';

// The style a stage agent and a writer write in for a person: the rules
// injected into their briefs, chosen by the profile's `prose.style`. The two
// mechanical checks every style keeps — sentence width and bare codes — are
// lib/plain.js's and do not live here.
// docs/90-agent/plans/2026-10-05-prose-style-design.md.

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

module.exports = { STYLES, NAMES, SUGGESTED, MAX, length, customFile, styleFor, briefLines, costLines };
