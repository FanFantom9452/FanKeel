'use strict';
// lib/reviewcheck.js: the three mechanical checks build's reviewer template
// (skills/fankeel-build/SKILL.md, Part 2) asked a reviewer to do by hand until
// 2026-10-09, and that verify's eleven returns on 2026-10-01 found done wrong:
//   (a) every `closest('…')`, `matches('…')` and `addEventListener('…'` an
//       added non-test line carries, with the test lines holding the same
//       string (an event name counted only when quoted) — NONE where none;
//   (b) every `test('…'` an added test line carries, with the implementer's
//       `<name> — red when: <mutation>` line for it — `no red line` where
//       there is none, `no returned file` when no return was given at all;
//   (c) every `path:line` an added test line cites in a code span, with the
//       quote beside it, checked against `git show <sha>:<path>` — `ok`,
//       `off by N` when the quote sits N lines away (within NEAR), `missing`
//       when it is not, `past end` when the line is beyond the file.
// The tables are evidence. Whether a cited test asserts the effect its row
// needs is still the reviewer's call; scripts/review-check.js prints these so
// the call is made over what is there rather than what was remembered.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { quoteBeside } = require('./refs.js');

const SELECTOR = /\b(closest|matches)\(\s*(['"`])((?:(?!\2).)+)\2/g;
const LISTENER = /\baddEventListener\(\s*(['"`])([A-Za-z]+)\1/g;
const TEST = /^\s*test\(\s*(['"`])((?:(?!\1).)+)\1/;
const RED = /^(.+?) — red when: (.+)$/;
const CITE = /`((?:\.\/)?[\w.-]+\/[\w./-]+):(\d+)(?:[-–]\d+)?`/g;
const NEAR = 20;

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const isTest = (file) => /^tests\//.test(file) || /\.(test|spec)\.js$/.test(file);
const flat = (s) => s.replace(/\s+/g, ' ').trim();

// Every added line of a unified diff, with the file it lands in and its line
// number in that file. Context lines advance the count; removed lines do not.
function addedLines(diff) {
    const out = [];
    let file = null;
    let line = 0;
    for (const raw of diff.split('\n')) {
        if (raw.startsWith('+++ ')) { file = raw.slice(4).replace(/^b\//, '').trim(); continue; }
        if (raw.startsWith('--- ')) continue;
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (hunk) { line = Number(hunk[1]); continue; }
        if (file === null || file === '/dev/null') continue;
        if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; }
        else if (!raw.startsWith('-') && !raw.startsWith('\\')) line++;
    }
    return out;
}

// Every line of every tracked test file, for the substring search (a) does.
function testLines(root) {
    const out = [];
    let files;
    try { files = git(root, ['ls-files']).split(/\r?\n/).filter(isTest); } catch (e) { return out; }
    for (const rel of files) {
        let text;
        try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
        text.split('\n').forEach((l, i) => out.push({ file: rel, line: i + 1, text: l }));
    }
    return out;
}

function selectorRows(added, tests) {
    const rows = [];
    const seen = new Set();
    for (const a of added) {
        if (isTest(a.file)) continue;
        const found = [];
        let m;
        SELECTOR.lastIndex = 0;
        while ((m = SELECTOR.exec(a.text)) !== null) found.push({ kind: m[1], value: m[3] });
        LISTENER.lastIndex = 0;
        while ((m = LISTENER.exec(a.text)) !== null) found.push({ kind: 'event', value: m[2] });
        for (const f of found) {
            const key = a.file + ' ' + f.kind + ' ' + f.value;
            if (seen.has(key)) continue;
            seen.add(key);
            const quoted = f.kind === 'event' ? new RegExp('[\'"`]' + f.value + '[\'"`]') : null;
            const hits = tests.filter((t) => (quoted ? quoted.test(t.text) : t.text.includes(f.value))).map((t) => t.file + ':' + t.line);
            rows.push({ file: a.file, line: a.line, kind: f.kind, value: f.value, hits, finding: hits.length ? null : 'NONE' });
        }
    }
    return rows;
}

function testRows(added, returned) {
    const red = new Map();
    if (typeof returned === 'string') {
        for (const l of returned.split(/\r?\n/)) {
            const m = RED.exec(l.trim());
            if (m) red.set(m[1].trim(), m[2].trim());
        }
    }
    const rows = [];
    for (const a of added) {
        if (!isTest(a.file)) continue;
        const m = TEST.exec(a.text);
        if (!m) continue;
        const line = red.get(m[2]) || null;
        rows.push({ file: a.file, line: a.line, name: m[2], red: line, finding: returned == null ? 'no returned file' : line ? null : 'no red line' });
    }
    return rows;
}

function showLines(root, sha, rel) {
    try { return git(root, ['show', sha + ':' + rel]).split('\n'); } catch (e) { return null; }
}

function citeRows(root, sha, added) {
    const rows = [];
    const cache = new Map();
    for (const a of added) {
        if (!isTest(a.file)) continue;
        let m;
        CITE.lastIndex = 0;
        while ((m = CITE.exec(a.text)) !== null) {
            const rel = m[1].replace(/^\.\//, '');
            const line = Number(m[2]);
            const quote = quoteBeside(a.text, m.index + m[0].length);
            if (!cache.has(rel)) cache.set(rel, showLines(root, sha, rel));
            const lines = cache.get(rel);
            let finding = null;
            if (lines === null) finding = 'no such file at ' + sha.slice(0, 8);
            else if (line < 1 || line > lines.length) finding = 'past end (' + lines.length + ' lines)';
            else if (quote) {
                const needle = flat(quote);
                let at = flat(lines[line - 1]).includes(needle) ? line : 0;
                if (!at) {
                    const i = lines.findIndex((l, j) => Math.abs(j + 1 - line) <= NEAR && flat(l).includes(needle));
                    at = i === -1 ? 0 : i + 1;
                }
                if (at === 0) finding = 'missing';
                else if (at !== line) finding = 'off by ' + (at - line);
            }
            rows.push({ file: a.file, line: a.line, cite: rel + ':' + line, quote, finding });
        }
    }
    return rows;
}

function tables(root, { sha, base, returned }) {
    const added = addedLines(git(root, ['diff', base + '..' + sha]));
    return { selectors: selectorRows(added, testLines(root)), tests: testRows(added, returned), cites: citeRows(root, sha, added) };
}

function render(t) {
    const out = [];
    const mark = (r) => (r.finding ? '  ← ' + r.finding : '');
    out.push('(a) selectors and events in changed listeners → test lines holding the string');
    if (!t.selectors.length) out.push('    none in this diff');
    for (const r of t.selectors) {
        const hits = r.hits.length ? r.hits.slice(0, 8).join(', ') + (r.hits.length > 8 ? ' …+' + (r.hits.length - 8) : '') : 'NONE';
        out.push('    ' + r.file + ':' + r.line + '  ' + r.kind + ' ' + r.value + '  →  ' + hits);
    }
    out.push('(b) new tests → the red-when line returned for each');
    if (!t.tests.length) out.push('    none in this diff');
    for (const r of t.tests) out.push('    ' + r.file + ':' + r.line + '  ' + r.name + '  →  ' + (r.red || '—') + mark(r));
    out.push('(c) path:line cited by changed test files, checked at the sha');
    if (!t.cites.length) out.push('    none in this diff');
    for (const r of t.cites) out.push('    ' + r.file + ':' + r.line + '  ' + r.cite + (r.quote ? '  `' + r.quote + '`' : '') + '  ' + (r.finding || 'ok'));
    const findings = [].concat(t.selectors, t.tests, t.cites).filter((r) => r.finding).length;
    out.push('findings: ' + findings);
    return out.join('\n');
}

module.exports = { addedLines, selectorRows, testRows, citeRows, tables, render };
