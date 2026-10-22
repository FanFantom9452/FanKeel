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

// Which names each file reaches in each file it loads, read once for the whole
// tree. The first version of this searched every file for the bare word, and that
// version could not fail: `main`, `parseArgs`, `report` and `human` are defined
// locally in most of these scripts, so every one of them matched itself somewhere
// else and read as used. Following the require edge is what makes it mean
// something. Nothing in this repository calls require() on anything but a string
// literal, checked, so resolving them statically covers all of it.
//
// The second version followed the edges again for every exporter, which kept the
// test at fifteen seconds and so out of the fast suite; the orphan it exists to
// catch then surfaced only at audit. Indexing every file once is the same answer.
//
// A test that loads a file into a vm sandbox — `vm.runInNewContext(
// fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js')))`
// — reaches its exports through whatever object it handed the sandbox, so every
// `.name` in that test counts as reaching that file. Looser than a require edge,
// and the only reading a static scan can give it.
function importIndex(files, body) {
    const index = new Map();
    const reach = (target, name) => {
        if (!index.has(target)) index.set(target, new Set());
        index.get(target).add(name);
    };

    for (const rel of files) {
        const src = body.get(rel);
        const self = path.resolve(ROOT, rel);
        const from = path.dirname(self);
        const resolve = (spec) => {
            try {
                const target = require.resolve(path.resolve(from, spec));
                return target === self ? null : target;
            } catch (e) {
                return null;
            }
        };

        const bound = /(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
        let m;
        while ((m = bound.exec(src))) {
            const target = resolve(m[2]);
            if (!target) continue;
            if (m[1].startsWith('{')) {
                // const { a, b: c } = require(...) — the exported name is the key
                for (const entry of m[1].slice(1, -1).split(',')) {
                    const key = entry.split(':')[0].trim();
                    if (key) reach(target, key);
                }
            } else {
                // const mod = require(...) — every mod.<name> that follows
                const reached = new RegExp('\\b' + m[1] + '\\.([A-Za-z_$][\\w$]*)', 'g');
                let d;
                while ((d = reached.exec(src))) reach(target, d[1]);
            }
        }

        const inline = /require\(\s*['"]([^'"]+)['"]\s*\)\.([A-Za-z_$][\w$]*)/g;
        while ((m = inline.exec(src))) {
            const target = resolve(m[1]);
            if (target) reach(target, m[2]);
        }

        if (/\bvm\.(?:runInNewContext|runInContext|runInThisContext|Script)\b/.test(src)) {
            const loaded = /readFileSync\(\s*path\.join\(\s*__dirname((?:\s*,\s*['"][^'"]+['"])+)\s*\)/g;
            while ((m = loaded.exec(src))) {
                const segments = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((s) => s[1]);
                const target = path.resolve(from, ...segments);
                if (target === self) continue;
                const member = /\.([A-Za-z_$][\w$]*)/g;
                let d;
                while ((d = member.exec(src))) reach(target, d[1]);
            }
        }
    }

    return index;
}

// The names in a `module.exports = {…}`, wherever in the file it sits. The first
// version anchored on the end of the file and read everything up to the last `}`
// in it, so it only worked while the export was the final statement. Followed by
// an `if (require.main === module) {…}` (lib/fanout.js, scripts/version.js) it
// swallowed that block into the last name and dropped it; inside a `typeof
// module` guard with 1,600 lines after it (assets/station/station.js) it matched
// nothing, and eight dead names went unchecked. Counting braces from the opening
// one ends the list at its own close, whatever follows. It takes every brace it
// meets at face value, so a `{` or `}` inside a string or comment in the list
// would end the scan early or late without a word; none does today.
function exportedNames(src) {
    const open = /module\.exports\s*=\s*\{/.exec(src);
    if (!open) return [];
    const start = open.index + open[0].length;
    let depth = 1;
    let end = -1;
    for (let i = start; i < src.length && end < 0; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) end = i;
    }
    return src.slice(start, end).split(',')
        .map((entry) => entry.trim().split(':')[0].trim())
        .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
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
    const index = importIndex(files, body);
    const orphans = [];

    for (const rel of files) {
        if (rel.startsWith('tests/')) continue;
        const names = exportedNames(body.get(rel));
        if (!names.length) continue;
        const used = index.get(path.resolve(ROOT, rel)) || new Set();
        for (const name of names) {
            if (!used.has(name)) orphans.push(rel + ' — ' + name);
        }
    }

    assert.deepEqual(orphans, [], 'exported, and imported by nothing');
});

// The vm reading, shown on its own: a name reached only through a sandbox's
// exports counts, a name the test never touches does not, and a vm-free file
// naming the same path reaches nothing.
test('a name reached only through a vm sandbox counts as imported', () => {
    const viaVm = "const vm = require('node:vm');\n"
        + "const box = { module: { exports: {} } };\n"
        + "vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'only-vm.js'), 'utf8'), box);\n"
        + 'box.module.exports.onlyVm();\n';
    const noVm = "const s = fs.readFileSync(path.join(__dirname, '..', 'lib', 'plain-read.js'), 'utf8');\ns.length;\n";
    const body = new Map([['tests/x.test.js', viaVm], ['tests/y.test.js', noVm]]);
    const index = importIndex([...body.keys()], body);
    const vmTarget = index.get(path.resolve(ROOT, 'lib', 'only-vm.js'));
    assert.ok(vmTarget && vmTarget.has('onlyVm'), 'the sandbox export reached');
    assert.ok(!vmTarget.has('neverCalled'));
    assert.equal(index.get(path.resolve(ROOT, 'lib', 'plain-read.js')), undefined, 'reading a file is not loading it');
});

// The control for the test above. Over the tree an empty answer and a right one
// read the same, because nothing exported for nobody is what a clean tree looks
// like — so the scan is shown finding names in three placements. At the tail the
// tail-anchored regex worked too, and that case checks the scan still agrees with
// it there; before a `require.main` block and inside a guard with code after it
// are the two it could not read.
test('an export list is found wherever in the file it sits', () => {
    const atTail = 'const x = 1;\nmodule.exports = { a, b: c };\n';
    const beforeMain = 'module.exports = { fanout };\n\nif (require.main === module) {\n    run();\n}\n';
    const inGuard = '(function () {\n    if (typeof module !== "undefined" && module.exports) {\n'
        + '        module.exports = {\n            tokens: tokens, mins: mins,\n            usd: usd,\n        };\n'
        + '    }\n    if (!doc) return;\n})();\n';

    assert.deepEqual(exportedNames(atTail), ['a', 'b']);
    assert.deepEqual(exportedNames(beforeMain), ['fanout']);
    assert.deepEqual(exportedNames(inGuard), ['tokens', 'mins', 'usd']);
    assert.deepEqual(exportedNames('module.exports = run;\n'), []);
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
// `src` is read by scripts/verify-map.js, which checks every glob against the
// tracked files, so a path there is watched.
const READ_KEYS = new Set(['status', 'last_verified', 'source_of_truth', 'link', 'src']);
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
            // Words also break at CJK punctuation and CJK text, so a path glued
            // to 「」：，。 or to a sentence is still a word of its own, and a
            // trailing `:line` or `:line-line` is dropped before the shape
            // check. A code span is removed whole first, so 留下：`a/b.js` 的
            // is skipped as the span it is and nothing next to it is misread.
            const value = kv[2].replace(/`[^`]*`/g, ' ');
            for (const word of value.split(/[\s,　-〿＀-￯一-鿿]+/)) {
                // A backticked value is a code span and a bracketed one is a
                // link, and `docs-check` scans both inside the frontmatter
                // block exactly as it does in the body. Stripping the backticks
                // and flagging what is underneath would report a path somebody
                // formatted correctly, which is the one finding that would get
                // this test deleted. Only the bare ones go unwatched.
                if (word.includes('`')) continue;
                const ref = word.replace(/^["']+|["'.]+$/g, '').replace(/:\d+(?:-\d+)?$/, '');
                if (!ref || !PATHISH.test(ref)) continue;
                if (resolveRef(ROOT, rel, ref) === null) continue;
                guilty.push(rel + ' — ' + kv[1] + ': ' + ref);
            }
        }
    }

    assert.deepEqual(guilty, [], 'a path here is read by nothing, so nothing catches it rotting');
});

// Three of ponytail's skills became fankeel's own on 2026-09-12 — the
// reviewer's `## Cuts`, audit's three lenses, design's ladder — and the
// module that read the install manifest to pick one sentence went with them.
// A name that grows back in a comment is the coupling returning as prose
// first. The length check is the control: an empty scan would pass too.
test('no shipped file names ponytail @slow', () => {
    const shipped = ['lib', 'scripts', 'hooks', 'agents', 'skills', 'assets', '.claude-plugin']
        .flatMap((dir) => tracked(dir));
    assert.ok(shipped.length > 50, 'git ls-files found ' + shipped.length + ' files to scan');
    const naming = shipped.filter((rel) => /ponytail/i.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    assert.deepEqual(naming, []);
});

// fankeel shipped three output styles until 2026-09-13. Every user saw them in
// the /config picker and none of them reached a subagent, so the voice moved to
// the injected rules and the fankeel-explain skill instead.
test('no output style ships', () => {
    const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(plugin.outputStyles, undefined, 'plugin.json still declares outputStyles');
    assert.equal(fs.existsSync(path.join(ROOT, 'output-styles')), false, 'output-styles/ is still on disk');
});
