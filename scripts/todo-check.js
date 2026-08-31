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
// Four things follow, and all four are checkable, which is the point. A link
// that no longer resolves is a dead entry: usually the plan it pointed at was
// rewritten into a decision record and deleted at `land`, and closing the entry
// was forgotten. A link that resolves to a document whose role records a moment
// rather than the present is the same failure one step earlier — the file is
// still there and has already stopped answering. An entry over the length cap
// is not an index entry at all; the detail got written here instead of where it
// belongs.
// An entry under no known heading is one nobody said the state of, and `init`
// then has to guess which entries can become a task today.
//
// Nothing else is judged. Whether the work is still worth doing is not a thing a
// script can know, and neither is whether a page that is maintained happens to
// discuss this entry.

const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');

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

// The roles `docs.json` declares for documents that record a moment rather than
// the present: a decision record says why something was decided then, a plan
// says what was about to be done, a report is a dated snapshot, and an archive
// is retired. All four are correct documents doing their job. All four are the
// wrong home for the detail behind an open entry, because none of them is
// written to answer a question that is still open — which leaves `reference`,
// and code, which is in no bucket at all.
//
// Not "nobody maintains them", which is the reading this said first and which
// this repository's own tree falsifies: `docs/decisions/fankeel-shell.md`
// carries `status: current` and a `last_verified` date, and is still reported
// here. That is the check working. A decision record kept scrupulously current
// is a scrupulously current account of a decision, and an entry whose detail
// lives in one is pointing at history, however fresh the history is.
//
// This is the check, and it is deliberately not the one that was asked for.
// Three entries drifted on 2026-08-31 and two of them cited `## What is still a
// guess` in a decision record — the heading was still there, so verifying that a
// cited section exists would have caught neither. What had changed was the
// section's subject, narrowed to `survey` while the entries went on pointing at
// it, and no script can read a section and rule on its subject. The role can:
// it is the standing declaration that the page is an account of a decision and
// not a place an open question is tracked.
const STALE_ROLES = ['decision', 'plan', 'report', 'archive'];

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
    // No `docs.json` is not a failure. `read` hands back a null tree, `roleOf`
    // answers null for everything under it, and the role check reports nothing —
    // this degrades to the three checks it had before rather than refusing to
    // run in a repository that never declared a tree.
    const { tree } = docs.read(base);
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
            const full = path.resolve(base, target);
            if (!fs.existsSync(full)) {
                problems.push({
                    line: entry.line,
                    kind: 'dead link',
                    detail: target + ' does not exist. Either the entry is finished and should be removed, or the detail moved.',
                });
                continue;
            }
            const role = docs.roleOf(tree, path.relative(base, full));
            if (STALE_ROLES.includes(role)) {
                problems.push({
                    line: entry.line,
                    kind: 'stale citation',
                    detail: target + ' is filed as ' + role + ', a role that records a moment rather than the present. Point at the code this is about, or at a reference page.',
                });
            }
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
            + '. All links resolve, no stale citations, none over the cap.';
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
