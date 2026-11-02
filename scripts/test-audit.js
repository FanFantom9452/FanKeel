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
// A top-level bench/ is skipped either way: it is fixture, duplicated on purpose.
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

// bench/ is fixture (docs/README.md files it so): its control and treatment
// copies are identical on purpose, tests/bench.test.js compares the two sides,
// so reading them reported ten duplicates nobody should delete (TODO test-18).
const SKIP_TOP = new Set(['bench']);

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
            if (e.name !== 'node_modules' && !e.name.startsWith('.') && !(rel === '' && SKIP_TOP.has(e.name))) walk(root, r, out);
        } else if (e.isFile()) {
            out.push(r);
        }
    }
    return out;
}

function listFiles(root) {
    const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) return walk(root, '', []);
    return r.stdout.split('\0').filter((rel) => rel && !rel.split('/').includes('node_modules') && !SKIP_TOP.has(rel.split('/')[0]) && isFile(path.join(root, rel)));
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

// `text` with its whitespace removed except inside a string, template or regex
// literal, where `'  '` and `''` are different tests. `js` false reads quotes
// only, for Python, where `/` and `//` are division.
function squash(text, js) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const j = js || c === '"' || c === '\'' ? skip(text, i) : i;
        if (j !== i) {
            const span = text.slice(i, j + 1);
            out += c === '/' && (text[i + 1] === '/' || text[i + 1] === '*') ? span.replace(/\s+/g, '') : span;
            i = j;
        } else if (!/\s/.test(c)) {
            out += c;
        }
    }
    return out;
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
        const flat = squash(args[args.length - 1], true);
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
        const flat = squash(body.join('\n'), false);
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
