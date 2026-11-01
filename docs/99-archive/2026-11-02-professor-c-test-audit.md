---
status: current
last_verified: 2026-11-02
---

# 教授 11-01 C 組：測試盤點 Implementation Plan

**Goal:** `node <plugin>/scripts/test-audit.js [--root <dir>]` lists test files whose local import resolves to nothing and test bodies that repeat another, deletes nothing, exits 0, and the audit skill's code half names it as an optional scanner.
**Architecture:** One self-contained read-only script in the shape of `scripts/css-dead.js`: it lists files with `git ls-files --cached --others --exclude-standard` (a walk skipping `node_modules` and dot-directories outside a repository), reads JS test files with a small string/comment/regex-aware scanner for relative `require`/`import` specifiers and `test(`/`it(` callbacks, reads Python test files line by line for imports and `def test_` bodies, and prints one line per finding plus a count line. `skills/fankeel-audit/SKILL.md` gets one line in its code-half paragraph, paid for by trimming two sentences so the page stays under its byte cap.
**Tech Stack:** Node `>=22.5`, CommonJS, `node --test`, no dependencies; `git` on PATH for the repository case.
**Spec:** 2026-11-01-professor-ci-tiers-design.md

Index row (2026-11-02-professor-index.md, group C): Modify `scripts/test-audit.js`, `tests/test-audit.test.js`, `skills/fankeel-audit/SKILL.md`; external interface `test-audit.js [--root <dir>]` printing `path:line — stale: <why>` or `path:line — duplicate of <path:line>`, ending `test-audit: <n> stale, <m> duplicate`, exit 0. No dependency on another group.

## Global Constraints

- Node `>=22.5` (`package.json` `engines.node`); `package.json` is `"private": true` with no `dependencies` key, and no dependency may be added (CONTRIBUTING.md, Issue first: "no new dependency"; `scripts/css-dead.js:22-24` restates it for scanners).
- `npm test` is `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`; `npm run test:fast` adds `--test-skip-pattern=@slow` (`package.json` `scripts`). One file runs as `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/<file>`.
- There is no `CLAUDE.md` in this repository (CONTRIBUTING.md:3-4); CONTRIBUTING.md holds the conventions: `scripts/*.js` are CLI entry points, `lib/*.js` never reaches into `scripts/`; tests are `tests/*.test.js` under `node --test`.
- A new file must be staged (`git add`) before `tests/source.test.js` can see it, and every name in a `module.exports = { … }` needs an importer (`tests/source.test.js:146` "every exported name is imported by something"; a name reached only by a test counts). `scripts/test-audit.js` exports `scan` alone, and `tests/test-audit.test.js` imports it.
- No tracked source file may hold a NUL byte (`tests/source.test.js:26`).
- Line endings are LF (`.gitattributes`: `* text=auto eol=lf`); indentation is 4 spaces in `scripts/` and in `tests/css-dead.test.js`, the scanner test this one is modelled on.
- CLI flags are parsed through `parseArgsOrExit(prog, argv, options)` from `lib/cli.js:11-19`: an unknown flag prints `<prog>: unknown argument <flag>` and exits 2. A skill line naming a script and a flag on the same line is checked against the script's parseArgs options table (`lib/skills.js:47` `OPTION`, `acceptedFlags`), and when one line names two scripts the flag is attributed to neither (`lib/skills.js:29`) — so the skill's `test-audit.js [--root <dir>]` sits on its own line and the script declares `{ root: { type: 'string' } }` in exactly that shape.
- A script a skill names is written `<plugin>/scripts/<name>.js`; a bare `scripts/<name>.js` in a skill is a `bare-reference` finding (`tests/skills.test.js:1013`).
- Scratch directories in tests come from `tests/tmp.js` (`tmp(prefix)`), never `fs.mkdtempSync` directly (`.fankeel/map.md`: "tmp.js is where every scratch directory comes from").
- `skills/fankeel-audit/SKILL.md` is 20770 bytes against a cap of 20800 (`tests/skill-size.test.js:19`, `'fankeel-audit': 20800`); raising the cap is "a decision, made by raising it here" (`tests/skill-size.test.js:10-11`) in a file no group of this split owns, so Task 2 stays under it: its edit, measured, leaves the file at 20795 bytes.
- Pinned text in `skills/fankeel-audit/SKILL.md` that Task 2 must keep: `/three \`fankeel-reviewer\`/` and `/## Cuts/` (`tests/skills.test.js:115-116`); the verification-map paragraph running from `**The verification map, reconciled.**` to a blank line then `Quote what came back.` and containing `live pass` (`tests/verify-map-wiring.test.js:31-38`); `` `node <plugin>/scripts/css-dead.js <dir>` `` (`tests/css-dead.test.js:59`); `(eight by default)` and `Eight in one response is the default` (`tests/inflight-text.test.js:30-33`); the page passes `docs-check` as reference (`tests/verify-map-wiring.test.js:41-45`).
- Plan sizes: `READ_CAP` 1500 lines across a task's `Modify:` files and `FILE_CAP` 3 `Modify:` entries (`lib/plantasks.js:387-388`).
- `dispatch.floor` is `sonnet` (builtin, `lib/profile.js:25`); this task's class is `architectural`, so `dispatchFor` raises the floor to `opus` at effort `high` (`lib/profile.js:368-372`).
- Filing (`.fankeel/map.md`): `docs/90-agent/plans` is `plan`; this plan becomes `status: current` when it lands. Version numbers move only through `scripts/version.js` (CONTRIBUTING.md); no task here touches one.

## Risks

- The scanner reads its own test file when run over this repository, and every fixture there is JS source — Task 1 — the scanner skips strings, template literals, comments and regex literals when it looks for calls and imports, and Task 1's third test proves a `require(` and a `test(` held in a string are not read; a sanity run over this tree at plan time printed `0 stale` and listed nothing in `tests/test-audit.test.js`.
- A regex literal holding an unbalanced paren (`/\(/`) would unbalance the argument scanner and swallow the following tests — Task 1 — `skip()` treats a `/` after an operator, bracket or nothing as a regex, and the third test puts `/\(/` before two duplicate tests that must still be found.
- An absolute Python import of a deleted local module reads as third-party (its first segment is on disk nowhere) and is not listed — Task 1 — accepted and written in the script's header comment; only a first segment found beside the file or at the root is judged.
- `git ls-files` run from a root that is a subdirectory of a repository lists paths relative to that root, and from a root outside any repository fails — Task 1 — the failure falls back to the walk; the fourth test checks the repository case with an ignored file.
- The audit skill is 30 bytes under its cap — Task 2 — its edit is measured at 20795 bytes and Task 2 runs `tests/skill-size.test.js` with its own test file.

## Task 1: `scripts/test-audit.js` lists stale and duplicate tests

**Files:**
- Modify: `scripts/test-audit.js` — new; `scan(root)` and the CLI
- Read: `lib/cli.js` — `parseArgsOrExit(prog, argv, options)`
- Read: `scripts/css-dead.js` — the scanner shape this copies (header comment, `main`, exit 2 on an unreadable root)
- Read: `tests/tmp.js` — `tmp(prefix)`
- Test: `tests/test-audit.test.js`

**Interfaces:**
- Consumes: `parseArgsOrExit(prog: string, argv: string[], options: object) -> { values, positionals }` (`lib/cli.js`); `tmp(prefix: string) -> string` (`tests/tmp.js`)
- Produces: `scan(root: string) -> { stale: Array<{ file: string, line: number, why: string }>, duplicate: Array<{ file: string, line: number, of: string }> }` — `file` relative to `root` with `/`, `why` is `<specifier> resolves to nothing`, `of` is the `path:line` of the first body in its group; the CLI `node scripts/test-audit.js [--root <dir>]` printing `path:line — stale: <why>` lines, then `path:line — duplicate of <path:line>` lines, then `test-audit: <n> stale, <m> duplicate`, exit 0 (2 for an unreadable root or unknown flag)

**Dispatch:** implementer, opus, high — the architectural floor, which `dispatchFor` raises to opus at high (see Global Constraints); the plan carries the code, and the scanner's string and regex skipping has to be read, not just transcribed.

1. Write the failing test. Create `tests/test-audit.test.js`:

In `tests/test-audit.test.js`, the whole file:
```js
'use strict';
// professor 11-01 design §4: scripts/test-audit.js lists test files whose local
// import resolves to nothing and test bodies that repeat another, and deletes
// nothing. Every fixture below is held in a string, which the scanner does not
// read as code, so running it over this repository does not list this file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { scan } = require('../scripts/test-audit.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'test-audit.js');

function project(prefix, files) {
    const dir = tmp(prefix);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    }
    return dir;
}

const JS = {
    'tests/helper.js': 'module.exports = (n) => n + 1;\n',
    'tests/stale.test.js': [
        "const test = require('node:test');",
        "const helper = require('./gone.js');",
        "test('uses a module that is gone', () => helper(1));",
        '',
    ].join('\n'),
    'tests/one.test.js': [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "const helper = require('./helper');",
        "test('adds one', () => {",
        '    assert.equal(helper(1), 2);',
        '});',
        "test('adds two', () => {",
        '    assert.equal(helper(2), 3);',
        '});',
        '',
    ].join('\n'),
    'tests/two.test.js': [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "const helper = require('./helper.js');",
        "test('adds one again', async () => {",
        '  assert.equal( helper(1),2 );',
        '});',
        '',
    ].join('\n'),
    'node_modules/pkg/x.test.js': "require('./nowhere.js');\n",
    '.cache/y.test.js': "require('./nowhere.js');\n",
};

test('the proof: a test importing a missing module and two tests with one body are both listed, and exit is 0', () => {
    const dir = project('fankeel-test-audit-proof-', JS);
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, [
        'tests/stale.test.js:2 — stale: ./gone.js resolves to nothing',
        'tests/two.test.js:4 — duplicate of tests/one.test.js:4',
        'test-audit: 1 stale, 1 duplicate',
        '',
    ].join('\n'));
    for (const rel of Object.keys(JS)) assert.ok(fs.existsSync(path.join(dir, rel)), rel + ' was deleted');
});

test('python: a relative import and a local package\'s missing module are stale, a standard one is not, and def bodies compare', () => {
    const dir = project('fankeel-test-audit-py-', {
        'pkg/__init__.py': '',
        'pkg/present.py': 'value = 1\n',
        'tests/test_calc.py': [
            'from .gone import thing',
            'import pkg.missing',
            'import os',
            'from pkg import present',
            '',
            'def test_one():',
            '    assert present.value == 1',
            '',
            'def test_two():',
            '    assert   present.value == 1',
            '',
            'def test_three(): assert present.value == 2',
            '',
        ].join('\n'),
    });
    assert.deepEqual(scan(dir), {
        stale: [
            { file: 'tests/test_calc.py', line: 1, why: '.gone resolves to nothing' },
            { file: 'tests/test_calc.py', line: 2, why: 'pkg.missing resolves to nothing' },
        ],
        duplicate: [{ file: 'tests/test_calc.py', line: 9, of: 'tests/test_calc.py:6' }],
    });
});

test('a call or an import inside a string, or a paren inside a regex, is not read as code', () => {
    const dir = project('fankeel-test-audit-strings-', {
        'tests/strings.test.js': [
            "const test = require('node:test');",
            "const src = \"require('./nowhere.js')\";",
            "test('a', () => src + \"test('x', () => { same(); })\");",
            "test('b', () => src.length + \"test('y', () => { same(); })\");",
            "test('c', () => assert.match('(', /\\(/));",
            "test('e', () => { twice(); });",
            "test('f', () => { twice(); });",
            '',
        ].join('\n'),
    });
    assert.deepEqual(scan(dir), {
        stale: [],
        duplicate: [{ file: 'tests/strings.test.js', line: 7, of: 'tests/strings.test.js:6' }],
    });
});

test('in a git repository the files come from git, so an ignored test is not read', () => {
    const dir = project('fankeel-test-audit-git-', {
        '.gitignore': 'ignored/\n',
        'ignored/x.test.js': "require('./nowhere.js');\n",
        'tests/a.test.js': "require('./gone.js');\n",
    });
    execFileSync('git', ['init', '-q', dir]);
    assert.deepEqual(scan(dir).stale, [{ file: 'tests/a.test.js', line: 1, why: './gone.js resolves to nothing' }]);
});

test('the CLI on a root that does not exist exits 2 with a stderr line, not a clean zero', () => {
    const dir = path.join(tmp('fankeel-test-audit-missing-'), 'no-such-dir');
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /test-audit: cannot read .*no-such-dir/);
    assert.equal(r.stdout, '');
});
```

2. Run it and watch it fail on `Cannot find module '../scripts/test-audit.js'`:

```
node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/test-audit.test.js
```

3. Write the implementation. Create `scripts/test-audit.js`:

In `scripts/test-audit.js`, the whole file:
```js
#!/usr/bin/env node
'use strict';
// Test files that look stale or duplicated (professor 11-01 design §4). Lists,
// never deletes.
//
//   node scripts/test-audit.js [--root <dir>]
//
// A test file is a JS `*.test.js` or `*.spec.<js|cjs|mjs|ts|cts|mts|jsx|tsx>`,
// or a Python `test_*.py` or `*_test.py`. The files come from `git ls-files
// --cached --others --exclude-standard` when the root is in a repository, and
// otherwise from a walk that skips `node_modules` and every directory whose
// name starts with a dot.
//
// Stale: a relative `require`/`import` (JS) that resolves to no file, or a
// Python import of a local module that is not on disk — every relative
// `from .x import`, and an absolute `import a.b` / `from a.b import` whose
// first segment is a module beside the file or at the root. An absolute import
// whose first segment is in neither place is a third-party or standard module,
// and is not judged: a deleted local module imported absolutely reads that way.
//
// Duplicate: test bodies — the callback of a JS `test(`/`it(` call, the body of
// a Python `def test_` — equal once all whitespace is removed. Strings,
// template literals, comments and regex literals are skipped when JS is read
// for calls and imports, so a fixture held in a string is not a test.
//
// Prints `path:line — stale: <why>` and `path:line — duplicate of <path:line>`,
// then `test-audit: <n> stale, <m> duplicate`. Exit 0; 2 for an unreadable
// root or an unknown flag.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgsOrExit } = require('../lib/cli.js');

const isFile = (p) => {
    try {
        return fs.statSync(p).isFile();
    } catch (e) {
        return false;
    }
};
const isDir = (p) => {
    try {
        return fs.statSync(p).isDirectory();
    } catch (e) {
        return false;
    }
};

function kindOf(rel) {
    const base = rel.split('/').pop();
    if (base.endsWith('.test.js') || /\.spec\.(?:[cm]?[jt]s|[jt]sx)$/.test(base)) return 'js';
    if (/^test_.*\.py$/.test(base) || /_test\.py$/.test(base)) return 'py';
    return null;
}

function walk(root, rel, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const e of entries) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) {
            if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(root, r, out);
        } else if (e.isFile()) {
            out.push(r);
        }
    }
    return out;
}

function listFiles(root) {
    const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) return walk(root, '', []);
    return r.stdout.split('\0').filter((rel) => rel && !rel.split('/').includes('node_modules') && isFile(path.join(root, rel)));
}

const lineAt = (src, at) => src.slice(0, at).split('\n').length;

// The index of the last character of the string, template literal, comment or
// regex literal that opens at `i`, or `i` itself when none does. A `/` opens a
// regex when the code before it ends in an operator, a bracket or nothing.
const REGEX_AFTER = '(,=:[!&|?{};+-*%<>~^';
function skip(src, i) {
    const c = src[i];
    if (c === '"' || c === '\'' || c === '`') {
        for (let j = i + 1; j < src.length; j++) {
            if (src[j] === '\\') j++;
            else if (src[j] === c) return j;
            else if (c !== '`' && src[j] === '\n') return j;
        }
        return src.length - 1;
    }
    if (c !== '/') return i;
    if (src[i + 1] === '/') {
        const nl = src.indexOf('\n', i);
        return nl < 0 ? src.length - 1 : nl;
    }
    if (src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        return end < 0 ? src.length - 1 : end + 1;
    }
    let k = i - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (k >= 0 && !REGEX_AFTER.includes(src[k])) return i;
    let cls = false;
    for (let j = i + 1; j < src.length && src[j] !== '\n'; j++) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) return j;
    }
    return i;
}

// Every position in `src` that is code and not the middle of a name.
function codeStarts(src) {
    const out = [];
    for (let i = 0; i < src.length; i++) {
        const j = skip(src, i);
        if (j !== i) {
            i = j;
            continue;
        }
        if (/[A-Za-z_$]/.test(src[i]) && !/[\w$.]/.test(src[i - 1] || '')) out.push(i);
    }
    return out;
}

// The top-level arguments of the call whose `(` is at `open`, as source text,
// or null when the file ends first.
function argsOf(src, open) {
    const args = [];
    let depth = 0;
    let start = open + 1;
    for (let i = open; i < src.length; i++) {
        const j = skip(src, i);
        if (j !== i) {
            i = j;
            continue;
        }
        const c = src[i];
        if (c === '(' || c === '{' || c === '[') depth++;
        else if (c === ')' || c === '}' || c === ']') {
            if (--depth === 0) {
                args.push(src.slice(start, i));
                return args;
            }
        } else if (c === ',' && depth === 1) {
            args.push(src.slice(start, i));
            start = i + 1;
        }
    }
    return null;
}

const JS_EXT = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.cts', '.mts', '.tsx', '.json', '.node'];
function jsResolves(abs) {
    if (isFile(abs)) return true;
    for (const ext of JS_EXT) if (isFile(abs + ext) || isFile(path.join(abs, 'index' + ext))) return true;
    if (isFile(path.join(abs, 'package.json'))) return true;
    const bare = abs.replace(/\.[cm]?jsx?$/, '');
    return bare !== abs && ['.ts', '.cts', '.mts', '.tsx'].some((ext) => isFile(bare + ext));
}

const IMPORT = /(?:require|import)\s*\(\s*(['"])([^'"\n]+)\1|(?:from|import)\s+(['"])([^'"\n]+)\3/y;
const CALL = /(?:test|it)(?:\.only|\.skip)?\s*\(/y;
const HEAD = /^(?:async)?(?:function\w*\([^)]*\)|\([^)]*\)=>|[\w$]+=>)\{/;

function readJs(root, rel, src, stale, bodies) {
    const dir = path.dirname(path.join(root, rel));
    for (const at of codeStarts(src)) {
        IMPORT.lastIndex = at;
        const m = IMPORT.exec(src);
        if (m) {
            const spec = m[2] || m[4];
            if ((spec.startsWith('./') || spec.startsWith('../')) && !jsResolves(path.resolve(dir, spec))) {
                stale.push({ file: rel, line: lineAt(src, at), why: spec + ' resolves to nothing' });
            }
            continue;
        }
        CALL.lastIndex = at;
        const c = CALL.exec(src);
        if (!c) continue;
        const args = argsOf(src, CALL.lastIndex - 1);
        if (!args || args.length < 2) continue;
        const flat = args[args.length - 1].replace(/\s+/g, '');
        const head = HEAD.exec(flat);
        const body = head ? flat.slice(head[0].length, -1) : flat.replace(/^(?:async)?(?:\([^)]*\)|[\w$]+)=>/, '');
        if (body) bodies.push({ key: 'js:' + body, file: rel, line: lineAt(src, at) });
    }
}

const pyModule = (base, dotted) => {
    const p = path.join(base, ...dotted.split('.'));
    return isFile(p + '.py') || isDir(p);
};

function readPy(root, rel, src, stale, bodies) {
    const dir = path.dirname(path.join(root, rel));
    const lines = src.split(/\r?\n/);
    const miss = (i, name) => stale.push({ file: rel, line: i + 1, why: name + ' resolves to nothing' });
    const absolute = (i, dotted) => {
        const base = [dir, root].find((b) => pyModule(b, dotted.split('.')[0]));
        if (base && !pyModule(base, dotted)) miss(i, dotted);
    };
    let inDoc = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const quotes = (line.match(/"""|'''/g) || []).length;
        if (inDoc || quotes) {
            if (quotes % 2) inDoc = !inDoc;
            continue;
        }
        let m = /^\s*from\s+(\.+)([\w.]*)\s+import\s+(.+)$/.exec(line);
        if (m) {
            let base = dir;
            for (let k = 1; k < m[1].length; k++) base = path.dirname(base);
            if (m[2]) {
                if (!pyModule(base, m[2])) miss(i, m[1] + m[2]);
            } else if (!isFile(path.join(base, '__init__.py'))) {
                for (const name of m[3].replace(/[()]/g, '').split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)) {
                    if (!pyModule(base, name)) miss(i, m[1] + name);
                }
            }
            continue;
        }
        m = /^\s*from\s+([\w.]+)\s+import\b/.exec(line);
        if (m) {
            absolute(i, m[1]);
            continue;
        }
        m = /^\s*import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*)\s*(?:#.*)?$/.exec(line);
        if (m) for (const part of m[1].split(',')) absolute(i, part.trim().split(/\s+/)[0]);
    }
    for (let i = 0; i < lines.length; i++) {
        const def = /^([ \t]*)(?:async[ \t]+)?def[ \t]+test_\w*[ \t]*\(/.exec(lines[i]);
        if (!def) continue;
        const indent = def[1].length;
        // The line and column of the `)` that closes the signature.
        let k = i;
        let col = def[0].length - 1;
        for (let depth = 0; k < lines.length; k++, col = 0) {
            for (; col < lines[k].length; col++) {
                if (lines[k][col] === '(') depth++;
                else if (lines[k][col] === ')' && --depth === 0) break;
            }
            if (col < lines[k].length) break;
        }
        const tail = (lines[k] || '').slice(col + 1).replace(/^\s*(?:->[^:]*)?:/, '').replace(/#.*$/, '');
        const body = [tail];
        for (let j = k + 1; j < lines.length; j++) {
            if (lines[j].trim() && lines[j].length - lines[j].trimStart().length <= indent) break;
            body.push(lines[j]);
        }
        const flat = body.join('').replace(/\s+/g, '');
        if (flat) bodies.push({ key: 'py:' + flat, file: rel, line: i + 1 });
    }
}

// { stale: [{ file, line, why }], duplicate: [{ file, line, of }] }, `file`
// relative to `root` with `/`, `of` the `path:line` of the first body in its
// group; both in file order.
function scan(root) {
    const stale = [];
    const bodies = [];
    for (const rel of listFiles(root).sort()) {
        const kind = kindOf(rel);
        if (!kind) continue;
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        (kind === 'js' ? readJs : readPy)(root, rel, src, stale, bodies);
    }
    const first = new Map();
    const duplicate = [];
    for (const b of bodies) {
        if (!first.has(b.key)) first.set(b.key, b.file + ':' + b.line);
        else duplicate.push({ file: b.file, line: b.line, of: first.get(b.key) });
    }
    return { stale, duplicate };
}

function main(argv) {
    const { values } = parseArgsOrExit('test-audit', argv, { root: { type: 'string' } });
    const root = path.resolve(values.root || '.');
    try {
        fs.readdirSync(root);
    } catch (e) {
        process.stderr.write('test-audit: cannot read ' + root + ' (' + e.code + ')\n');
        process.exitCode = 2;
        return;
    }
    const r = scan(root);
    const lines = r.stale.map((s) => s.file + ':' + s.line + ' — stale: ' + s.why)
        .concat(r.duplicate.map((d) => d.file + ':' + d.line + ' — duplicate of ' + d.of));
    lines.push('test-audit: ' + r.stale.length + ' stale, ' + r.duplicate.length + ' duplicate');
    process.stdout.write(lines.join('\n') + '\n');
    process.exitCode = 0;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { scan };
```

4. Run the step 2 command and watch all five tests pass. Then run it over this repository and check that it prints a count line, exits 0, and lists nothing in `tests/test-audit.test.js`:

```
node scripts/test-audit.js; echo "exit $?"
```

5. Stage both new files (`tests/source.test.js` reads `git ls-files`), then run `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/source.test.js` and watch it pass. Commit:

```
git add scripts/test-audit.js tests/test-audit.test.js
git commit -m "feat: test-audit.js lists stale and duplicate tests" -m "- scripts/test-audit.js: stale imports and duplicate bodies, JS and Python, list only" -m "- tests/test-audit.test.js: the design's proof fixture, Python, strings, git, CLI"
```

## Task 2: the audit skill's code half names `test-audit.js`

**Files:**
- Modify: `skills/fankeel-audit/SKILL.md` — one line after the `css-dead.js` sentence in the code-half paragraph; two sentences shortened to keep the page under its 20800-byte cap
- Read: `tests/skill-size.test.js` — the `'fankeel-audit': 20800` cap
- Read: `tests/verify-map-wiring.test.js` — the verification-map paragraph's pins
- Test: `tests/test-audit.test.js` — one test appended

**Interfaces:**
- Consumes: Task 1's CLI `node <plugin>/scripts/test-audit.js [--root <dir>]` (the flag name only; this task does not open the script)
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor, which `dispatchFor` raises to opus at high (see Global Constraints); the byte budget is tight enough that the replacements below must land exactly.

1. Write the failing test. Append to the end of `tests/test-audit.test.js`:

In `tests/test-audit.test.js`, at the end:
```js
// The audit skill's code half is where an optional scanner is named — css-dead.js
// is the precedent — on a line of its own, so `--root` is checked against this
// script's options rather than attributed to no script.
test('the audit skill names test-audit.js in its code half, on its own line', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-audit', 'SKILL.md'), 'utf8');
    const half = /The code half of the same fortnightly pass[\s\S]*?(?=\r?\n\r?\n\*\*Where the host opens it)/.exec(skill);
    assert.ok(half, 'the code-half paragraph is not where this test looks for it');
    assert.match(half[0], /\n`node <plugin>\/scripts\/test-audit\.js \[--root <dir>\]` lists stale and duplicate tests, deleting none\.$/);
});
```

2. Run it and watch it fail on the `assert.match`:

```
node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/test-audit.test.js
```

3. Make three exact replacements in `skills/fankeel-audit/SKILL.md`.

In `skills/fankeel-audit/SKILL.md`, the verification-map paragraph, replace these three lines:
```md
and the correction. The fix also rewrites `status` and `last_checked`. These
readers only read source and never drive the feature. The live pass, which
does drive it, is not part of this audit yet.
```

In `skills/fankeel-audit/SKILL.md`, with these two:
```md
and the correction. The fix also rewrites `status` and `last_checked`. The
live pass, which drives the feature, is not part of this audit yet.
```

In `skills/fankeel-audit/SKILL.md`, the `--record` paragraph, replace `days old. That line is the whole reminder: no cron, no routine.` with:
```md
days old. That line is the whole reminder.
```

In `skills/fankeel-audit/SKILL.md`, after the code-half line ending `` `node <plugin>/scripts/css-dead.js <dir>` lists unused CSS classes as `delete:` cuts. ``, add this line directly below it (no blank line between):
```md
`node <plugin>/scripts/test-audit.js [--root <dir>]` lists stale and duplicate tests, deleting none.
```

4. Run this task's test file with the pins it must keep, and watch all pass; check the size line says 20795 bytes or fewer:

```
node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/test-audit.test.js tests/skill-size.test.js tests/verify-map-wiring.test.js tests/css-dead.test.js tests/inflight-text.test.js tests/skills.test.js
node -e "console.log(require('fs').statSync('skills/fankeel-audit/SKILL.md').size)"
```

5. Commit:

```
git add skills/fankeel-audit/SKILL.md tests/test-audit.test.js
git commit -m "docs: the audit skill names test-audit.js in its code half" -m "- skills/fankeel-audit/SKILL.md: optional scanner line; two sentences shortened for the byte cap" -m "- tests/test-audit.test.js: the skill line is pinned"
```

## Coverage

| promise | task |
|---|---|
| 疑似失效：測試檔 `require`/`import`（JS）或 `from x import`（Python）指向不存在的本地模組。 | Task 1 |
| 疑似重複：去掉空白後內容完全相同的測試主體（JS `test(`/`it(`、Python `def test_`），列出每組路徑:行。 | Task 1 |
| 輸出 `path:line — reason`，結尾一行計數；exit 0。接到 audit 技能的程式碼半邊當一個可選掃描器。 | Task 1 (output, count, exit 0), Task 2 (audit code half) |
| `tests/test-audit.test.js`：fixture 裡一個 import 不存在模組的測試、兩個主體相同的測試 → 兩行都被列出。 | Task 1 |
