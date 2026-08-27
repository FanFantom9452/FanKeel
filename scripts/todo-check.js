#!/usr/bin/env node
'use strict';

// Whether TODO.md is still an index.
//
// R5 asks for one convention and a way to tell when it has been broken, because
// an index pointing at things that no longer exist is worse than no index — it
// is read with confidence and it is wrong. The convention:
//
//   An entry is one bullet. It is short enough to scan, and any detail behind it
//   lives in a file in this repository that the entry links to.
//
// Two things follow, and both are checkable, which is the point. A link that no
// longer resolves is a dead entry: usually the plan it pointed at was rewritten
// into a decision record and deleted at `land`, and closing the entry was
// forgotten. An entry over the length cap is not an index entry at all; the
// detail got written here instead of where it belongs.
//
// Nothing else is judged. Whether the work is still worth doing is not a thing a
// script can know.

const fs = require('node:fs');
const path = require('node:path');

// Long enough for a sentence and a link, short enough that a paragraph does not
// fit. Detail that will not compress to this belongs in the file being pointed
// at, which is the whole rule.
const MAX_ENTRY_CHARS = 200;

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
    return { file, missing: false, count: found.length, problems };
}

function report(result) {
    if (result.missing) {
        return 'fankeel todo-check: no ' + result.file + '. Nothing to check.';
    }
    if (!result.problems.length) {
        return 'fankeel todo-check: ' + result.count + ' entries, all links resolve, none over the cap.';
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

module.exports = { MAX_ENTRY_CHARS, linksIn, check, main };
