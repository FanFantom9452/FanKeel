'use strict';
// lib/reviewcheck.js: the three mechanical checks build's reviewer template
// (skills/fankeel-build/SKILL.md, Part 2) asked a reviewer to do by hand until
// 2026-10-09, and that verify's eleven returns on 2026-10-01 found done wrong:
//   (a) every `closest('…')`, `matches('…')` and `addEventListener('…'` an
//       added non-test code line carries, with the non-comment test lines (read
//       at the sha) that hold the same string as a quoted literal — NONE where
//       none. An `addEventListener(EV` with a variable is a row too, valued by
//       the identifier, but it has no string to look for: it is listed as
//       `not a literal` and is not a finding;
//   (b) every `test('…'` an added test line carries, with the implementer's
//       `<name> — red when: <mutation>` line for it — `no red line` where
//       there is none, `no returned file` when no return was given at all;
//   (c) every `path:line` that a comment line of a changed test file, or the
//       returned file, cites in a code span, with the quote beside it, checked
//       against `git show <sha>:<path>` — `ok`, `off by N` when the quote sits
//       N lines away (within NEAR), `missing` when it is not, `past end` when
//       the line is beyond the file, `no such file` when the path is not there.
// The tables are evidence. Whether a cited test asserts the effect its row
// needs is still the reviewer's call; scripts/review-check.js prints these so
// the call is made over what is there rather than what was remembered.
const { execFileSync } = require('node:child_process');
const { PATHISH, quoteBeside } = require('./refs.js');

const SELECTOR = /\b(closest|matches)(?:\?\.)?\(\s*(['"`])((?:(?!\2).)+)\2/g;
const LISTENER = /\baddEventListener(?:\?\.)?\(\s*(?:(['"`])([\w:.-]+)\1|([A-Za-z_$][\w$.]*))/g;
// A name may hold the escaped quote of its own delimiter (`orient\'s todo`).
const TEST = /^\s*test\(\s*(['"`])((?:\\.|(?!\1)[^\\])+)\1/;
const TEST_OPEN = /^\s*test\(\s*$/;
const NAME_LINE = /^\s*(['"`])((?:\\.|(?!\1)[^\\])+)\1/;
const unescape = (name) => name.replace(/\\(['"`\\])/g, '$1');
// A bullet and backticks around the name are both how a return is written.
const RED = /^(?:[-*]\s+)?`?(.+?)`? — red when: (.+)$/;
// PATHISH is the path grammar; a citation in a comment is a code span of it.
const CITE = new RegExp('`' + PATHISH.source.replace(/^\^/, '').replace(/\$$/, '') + '`', 'g');
const NEAR = 20;

class GitError extends Error {}

// stderr is captured: a missing file is a row, not a `fatal:` on the terminal.
function git(root, args) {
    try {
        return execFileSync('git', args, { windowsHide: true, cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const err = new GitError('git ' + args.slice(0, 4).join(' ') + ' failed: ' + String(e.stderr || e.message).trim().split('\n')[0]);
        err.git = true;
        throw err;
    }
}
const isTest = (file) => /^tests\//.test(file) || /\.(test|spec)\.js$/.test(file);
const isComment = (text) => /^\s*(\/\/|\*|\/\*)/.test(text);
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every added line of a unified diff, with the file it lands in and its line
// number in that file. Context lines advance the count; removed lines do not.
// A `+++ ` line is a file header only before a file's first hunk; inside one it
// is an added line whose text begins `++`.
function addedLines(diff) {
    const out = [];
    let file = null;
    let line = 0;
    let inHunk = false;
    for (const raw of diff.split('\n')) {
        if (raw.startsWith('diff --git ')) { inHunk = false; continue; }
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (hunk) { line = Number(hunk[1]); inHunk = true; continue; }
        if (!inHunk) {
            if (raw.startsWith('+++ ')) {
                // git appends a tab to a header whose path holds a space
                const p = raw.slice(4).replace(/\t.*$/, '');
                file = p.replace(/^b\//, '');
            }
            continue;
        }
        if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; }
        else if (!raw.startsWith('-') && !raw.startsWith('\\')) line++;
    }
    return out;
}

// Every path in the tree at the sha: what (a) may read and what (c) may cite.
const treeFiles = (root, sha) => new Set(git(root, ['ls-tree', '-r', '--name-only', '-z', sha]).split('\0').filter(Boolean));

// The test files as they are at the sha, so (a) reads what (c) reads. One
// `git show` each, so selectorRows asks for it only when a row needs it.
function testLines(root, sha, names) {
    const out = [];
    for (const rel of [...names].filter(isTest)) {
        git(root, ['show', sha + ':' + rel]).split('\n').forEach((l, i) => out.push({ file: rel, line: i + 1, text: l }));
    }
    return out;
}

// `tests` is the test lines, or a function that returns them.
function selectorRows(added, tests) {
    const rows = [];
    const seen = new Set();
    let code = null;
    for (const a of added) {
        if (isTest(a.file) || isComment(a.text)) continue;
        const found = [];
        let m;
        SELECTOR.lastIndex = 0;
        while ((m = SELECTOR.exec(a.text)) !== null) found.push({ kind: m[1], value: m[3], literal: true });
        LISTENER.lastIndex = 0;
        while ((m = LISTENER.exec(a.text)) !== null) found.push({ kind: 'event', value: m[2] || m[3], literal: m[2] !== undefined });
        for (const f of found) {
            const key = a.file + ' ' + f.kind + ' ' + f.value;
            if (seen.has(key)) continue;
            seen.add(key);
            // A variable event has no string to look for: listed, not a finding.
            if (!f.literal) { rows.push({ file: a.file, line: a.line, kind: f.kind, value: f.value, literal: false, hits: [], finding: null }); continue; }
            if (code === null) code = (typeof tests === 'function' ? tests() : tests).filter((t) => !isComment(t.text));
            const literal = new RegExp('([\'"`])' + escape(f.value) + '\\1');
            const hits = code.filter((t) => literal.test(t.text)).map((t) => t.file + ':' + t.line);
            rows.push({ file: a.file, line: a.line, kind: f.kind, value: f.value, literal: true, hits, finding: hits.length ? null : 'NONE' });
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
    added.forEach((a, i) => {
        if (!isTest(a.file)) return;
        let name = unescape((TEST.exec(a.text) || [])[2] || '');
        const next = added[i + 1];
        if (!name && TEST_OPEN.test(a.text) && next && next.file === a.file && next.line === a.line + 1) name = unescape((NAME_LINE.exec(next.text) || [])[2] || '');
        if (!name) return;
        const line = red.get(name) || null;
        rows.push({ file: a.file, line: a.line, name, red: line, finding: returned == null ? 'no returned file' : line ? null : 'no red line' });
    });
    return rows;
}

// A file ending in a newline splits into a phantom empty last element. Whether
// the file exists is the tree's answer; a git failure past that is not "missing".
function showLines(root, sha, rel, names) {
    if (!names.has(rel)) return null;
    const lines = git(root, ['show', sha + ':' + rel]).split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

function citeRows(root, sha, added, returned, names) {
    const rows = [];
    const cache = new Map();
    const sources = added.filter((a) => isTest(a.file) && isComment(a.text)).map((a) => ({ file: a.file, line: a.line, text: a.text }));
    if (typeof returned === 'string') returned.split(/\r?\n/).forEach((text, i) => sources.push({ file: 'returned', line: i + 1, text }));
    for (const a of sources) {
        let m;
        CITE.lastIndex = 0;
        while ((m = CITE.exec(a.text)) !== null) {
            if (m[2] === undefined) continue;
            const rel = m[1];
            const line = Number(m[2]);
            const quote = quoteBeside(a.text, m.index + m[0].length);
            if (!cache.has(rel)) cache.set(rel, showLines(root, sha, rel, names));
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

// The diff format is pinned: a user's color.ui, diff.external, diff.renames,
// diff.dstPrefix and core.quotePath would otherwise change what addedLines
// reads, and a file named like the range would make git call it ambiguous (the
// trailing `--`). Only the `+++` header is read, so only --dst-prefix is pinned.
function tables(root, { sha, base, returned }) {
    const diff = git(root, ['-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff', '--no-renames', '--dst-prefix=b/', base + '..' + sha, '--']);
    const added = addedLines(diff);
    const names = treeFiles(root, sha);
    const t = { selectors: selectorRows(added, () => testLines(root, sha, names)), tests: testRows(added, returned), cites: citeRows(root, sha, added, returned, names) };
    t.findings = [].concat(t.selectors, t.tests, t.cites).filter((r) => r.finding).length;
    return t;
}

function render(t) {
    const out = [];
    const mark = (r) => (r.finding ? '  ← ' + r.finding : '');
    out.push('(a) selectors and events in changed listeners → test lines holding the string');
    if (!t.selectors.length) out.push('    none in this diff');
    for (const r of t.selectors) {
        const hits = !r.literal ? 'not a literal' : r.hits.length ? r.hits.slice(0, 8).join(', ') + (r.hits.length > 8 ? ' …+' + (r.hits.length - 8) : '') : 'NONE';
        out.push('    ' + r.file + ':' + r.line + '  ' + r.kind + ' ' + r.value + '  →  ' + hits);
    }
    out.push('(b) new tests → the red-when line returned for each');
    if (!t.tests.length) out.push('    none in this diff');
    for (const r of t.tests) out.push('    ' + r.file + ':' + r.line + '  ' + r.name + '  →  ' + (r.red || '—') + mark(r));
    out.push('(c) path:line cited by comments of changed test files and by the return, checked at the sha');
    if (!t.cites.length) out.push('    none in this diff');
    for (const r of t.cites) out.push('    ' + r.file + ':' + r.line + '  ' + r.cite + (r.quote ? '  `' + r.quote + '`' : '') + '  ' + (r.finding || 'ok'));
    out.push('findings: ' + t.findings);
    return out.join('\n');
}

module.exports = { addedLines, selectorRows, testRows, citeRows, tables, render, escape };
