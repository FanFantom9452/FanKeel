'use strict';

// Three facts about this repository's own source that no behavioural test would
// catch, because none of them changes what anything does. All three were found
// by reading rather than by running, and all three grow back without a word.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { PATHISH, resolveRef } = require('../scripts/docs-check.js');

const ROOT = path.join(__dirname, '..');

const tracked = (glob = '*.js') =>
    execFileSync('git', ['ls-files', glob], { cwd: ROOT, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);

// A raw NUL byte anywhere in a text file makes grep call the whole file binary
// and print "Binary file ... matches" instead of the line; ripgrep drops it from
// a directory search without saying anything at all. The file keeps working. It
// just stops being findable, which is why nobody noticed.
test('no source file holds a NUL byte', () => {
    const guilty = tracked().filter((rel) => fs.readFileSync(path.join(ROOT, rel)).includes(0));
    assert.deepEqual(guilty, [], 'grep and ripgrep read these as binary');
});

// Which names another file actually imports from `exporter`. The first version of
// this searched every file for the bare word, and that version could not fail:
// `main`, `parseArgs`, `report` and `human` are defined locally in most of these
// scripts, so every one of them matched itself somewhere else and read as used.
// It found the eleven unusual names and was blind to the twenty-two ordinary
// ones — the exact opposite of a test worth having.
//
// Following the require edge is what makes it mean something. Nothing in this
// repository calls require() on anything but a string literal, checked, so
// resolving them statically covers all of it.
function imported(exporter, files, body) {
    const target = path.resolve(ROOT, exporter);
    const names = new Set();

    for (const rel of files) {
        if (rel === exporter) continue;
        const src = body.get(rel);
        const from = path.dirname(path.resolve(ROOT, rel));
        const resolves = (spec) => {
            try {
                return require.resolve(path.resolve(from, spec)) === target;
            } catch (e) {
                return false;
            }
        };

        const bound = /(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
        let m;
        while ((m = bound.exec(src))) {
            if (!resolves(m[2])) continue;
            if (m[1].startsWith('{')) {
                // const { a, b: c } = require(...) — the exported name is the key
                for (const entry of m[1].slice(1, -1).split(',')) {
                    const key = entry.split(':')[0].trim();
                    if (key) names.add(key);
                }
            } else {
                // const mod = require(...) — every mod.<name> that follows
                const reached = new RegExp('\\b' + m[1] + '\\.([A-Za-z_$][\\w$]*)', 'g');
                let d;
                while ((d = reached.exec(src))) names.add(d[1]);
            }
        }

        const inline = /require\(\s*['"]([^'"]+)['"]\s*\)\.([A-Za-z_$][\w$]*)/g;
        while ((m = inline.exec(src))) {
            if (resolves(m[1])) names.add(m[2]);
        }
    }

    return names;
}

// An exported name nobody imports is not dead code — the function behind it is
// almost always still called inside its own file. It is a dead *name*, and what
// it costs is the interface: a module that exports thirty names of which twelve
// have no importer has stopped telling anyone which parts of it are load-bearing.
//
// A name reached only by a test counts as used. Exporting a private helper so a
// unit test can reach it is a deliberate choice and a common one; what this
// guards against is the name exported for nobody at all.
test('every exported name is imported by something', () => {
    const files = tracked();
    const body = new Map(files.map((rel) => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')]));
    const orphans = [];

    for (const rel of files) {
        if (rel.startsWith('tests/')) continue;
        const block = body.get(rel).match(/module\.exports\s*=\s*\{([\s\S]*?)\n?\};?\s*$/);
        if (!block) continue;
        const used = imported(rel, files, body);
        for (const entry of block[1].split(',')) {
            const name = entry.trim().split(':')[0].trim();
            if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
            if (!used.has(name)) orphans.push(rel + ' — ' + name);
        }
    }

    assert.deepEqual(orphans, [], 'exported, and imported by nothing');
});

// `contractOf` in `lib/docs.js` reads three frontmatter keys and no others, and
// `docs-check` does not parse frontmatter at all — it scans the file for
// markdown links and code spans, that block included, and a bare path is
// neither. So a bare path written into a fourth key has no reader and no
// checker, and can rot for as long as it takes somebody to follow it by hand.
// A link or a backticked path written into a key is checked like any other,
// which is why the filter below is shape and not location: it is the bare ones
// that go unwatched.
//
// One did. `amends:` on a plan went on naming `docs/plans/` after its target had
// moved to `docs/archive/`, and the move was silent in both directions — the
// checker that would have caught the same path in the body could not see it, and
// nothing else was looking. What makes it worth a test rather than a fix is that
// the key cost nothing to invent and would cost nothing to invent again.
//
// A key holding prose is not the failure and is not flagged: `name`,
// `description` and `version` all carry text nobody could follow, and this
// repository is deliberately tolerant about frontmatter vocabulary. What is
// caught is the narrower shape — something that looks followable, resolves
// today, and is checked by nothing.
const READ_KEYS = new Set(['status', 'last_verified', 'source_of_truth']);
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?(?:\n|$)/;

test('no frontmatter key nothing reads carries a repository path', () => {
    const guilty = [];

    for (const rel of tracked('*.md')) {
        const block = FRONTMATTER.exec(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
        if (!block) continue;

        for (const line of block[1].split(/\r?\n/)) {
            const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
            if (!kv || READ_KEYS.has(kv[1].toLowerCase())) continue;

            // A value is a list of words, and any one of them can be the path —
            // the key that rotted wrote a sentence after its own.
            for (const word of kv[2].split(/[\s,]+/)) {
                // A backticked value is a code span and a bracketed one is a
                // link, and `docs-check` scans both inside the frontmatter
                // block exactly as it does in the body. Stripping the backticks
                // and flagging what is underneath would report a path somebody
                // formatted correctly, which is the one finding that would get
                // this test deleted. Only the bare ones go unwatched.
                if (word.includes('`')) continue;
                const ref = word.replace(/^["']+|["'.]+$/g, '');
                if (!ref || !PATHISH.test(ref)) continue;
                if (resolveRef(ROOT, rel, ref) === null) continue;
                guilty.push(rel + ' — ' + kv[1] + ': ' + ref);
            }
        }
    }

    assert.deepEqual(guilty, [], 'a path here is read by nothing, so nothing catches it rotting');
});
