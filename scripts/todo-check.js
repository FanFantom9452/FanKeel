#!/usr/bin/env node
'use strict';

// Whether TODO.md is still an index.
//
// R5 asks for one convention and a way to tell when it has been broken, because
// an index pointing at things that no longer exist is worse than no index — it
// is read with confidence and it is wrong. The convention:
//
//   An entry is one bullet. It is short enough to scan, any detail behind it
//   lives in a file in this repository that the entry links to, and it sits
//   under the heading that says what it is still waiting for.
//
// Three things follow, and all three are checkable, which is the point. A link
// that no longer resolves is a dead entry: usually the plan it pointed at was
// rewritten into a decision record and deleted at `land`, and closing the entry
// was forgotten. An entry over the length cap is not an index entry at all; the
// detail got written here instead of where it belongs. An entry under no known
// heading is one nobody said the state of, and `init` then has to guess which
// entries can become a task today.
//
// Nothing else is judged. Whether the work is still worth doing is not a thing a
// script can know.

const fs = require('node:fs');
const path = require('node:path');

// Long enough for a sentence and a link, short enough that a paragraph does not
// fit. Detail that will not compress to this belongs in the file being pointed
// at, which is the whole rule.
const MAX_ENTRY_CHARS = 200;

// The three buckets, in the order a reader wants them: what can be started now,
// what needs a person before anyone can start, what nobody can move yet. The
// heading carries the classification, so it costs one line of structure per group
// rather than a field on every bullet — and `entries()` was already recording it
// while nothing read it back.
//
// By decision state and not by topic, on purpose. Topic groups read well and
// answer the wrong question: what `init` needs to know is which entries can
// become a task today, and two bullets about one file are as often one that is
// ready and one that is still an argument.
const SECTIONS = ['Ready', 'Needs a decision', 'Waiting'];

const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
// A scheme, or a bare in-page anchor. Neither is a file in this repository, so
// neither is something this can check.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

// Top-level bullets only. An indented bullet is a continuation of the entry
// above it and is measured as part of it, not as an entry of its own.
function entries(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    let current = null;
    const close = () => {
        if (current) out.push(current);
        current = null;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line)) {
            close();
            section = line.replace(/^#+\s*/, '').trim();
            continue;
        }
        if (/^[-*]\s+\S/.test(line)) {
            close();
            current = { line: i + 1, section, text: line.replace(/^[-*]\s+/, '') };
            continue;
        }
        if (current && /^\s+\S/.test(line)) {
            current.text += ' ' + line.trim();
            continue;
        }
        if (!line.trim()) continue;
        close();
    }
    close();
    return out;
}

function linksIn(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const target = m[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
        if (!target || EXTERNAL.test(target)) continue;
        out.push(target.split('#')[0]);
    }
    return out;
}

function check(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { file, missing: true, problems: [] };
    }
    const base = path.dirname(file);
    const problems = [];
    const found = entries(text);
    for (const entry of found) {
        if (!SECTIONS.includes(entry.section)) {
            problems.push({
                line: entry.line,
                kind: 'unclassified',
                detail: (entry.section ? 'under "' + entry.section + '"' : 'under no heading')
                    + '. Every entry sits under one of ' + SECTIONS.map((s) => '## ' + s).join(' · ')
                    + ', which is what says whether it can be started today.',
            });
        }
        const len = entry.text.replace(/\s+/g, ' ').trim().length;
        if (len > MAX_ENTRY_CHARS) {
            problems.push({
                line: entry.line,
                kind: 'too long',
                detail: len + ' characters, cap is ' + MAX_ENTRY_CHARS + '. Move the detail into the file this points at.',
            });
        }
        for (const target of linksIn(entry.text)) {
            if (fs.existsSync(path.resolve(base, target))) continue;
            problems.push({
                line: entry.line,
                kind: 'dead link',
                detail: target + ' does not exist. Either the entry is finished and should be removed, or the detail moved.',
            });
        }
    }
    const counts = {};
    for (const name of SECTIONS) counts[name] = found.filter((e) => e.section === name).length;
    return { file, missing: false, count: found.length, counts, problems };
}

function report(result) {
    if (result.missing) {
        return 'fankeel todo-check: no ' + result.file + '. Nothing to check.';
    }
    // The split is the reason to run this on a clean file: a backlog of thirty is
    // unreadable as one list, and "18 ready" is the number that decides whether
    // there is a task to start this morning.
    const split = SECTIONS.map((s) => (result.counts[s] || 0) + ' ' + s.toLowerCase()).join(', ');
    if (!result.problems.length) {
        return 'fankeel todo-check: ' + result.count + ' entries — ' + split
            + '. All links resolve, none over the cap.';
    }
    const lines = ['fankeel todo-check: ' + result.problems.length + ' problem'
        + (result.problems.length === 1 ? '' : 's') + ' in ' + result.file, ''];
    for (const p of result.problems) {
        lines.push('  ' + result.file + ':' + p.line + '  ' + p.kind + ' — ' + p.detail);
    }
    return lines.join('\n');
}

// `--root <dir>` the way every other script here takes it. Before this, the
// first argument not beginning with `--` was taken as the file — so `--root .`
// handed `.` to `check`, reading a directory threw EISDIR, `check` reported it
// missing, and missing is success. The form a person reaches for, and the form a
// gate gets written with, passed while examining nothing.
function main(argv) {
    let root = '';
    const loose = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--root') {
            root = argv[++i] || '';
            continue;
        }
        if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
            continue;
        }
        if (arg.startsWith('--')) continue;
        loose.push(arg);
    }
    // A positional argument is still a path to a file. A flag's value is not one.
    const at = loose[0] || path.join(root || process.cwd(), 'TODO.md');
    const result = check(path.resolve(at));
    return { text: report(result), ok: result.missing || !result.problems.length };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { MAX_ENTRY_CHARS, SECTIONS, linksIn, check, main };
