'use strict';
// Every non-interactive child process must carry windowsHide, or Windows flashes a cmd window.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const NAMES = ['spawnSync', 'execFileSync', 'execFile', 'spawn', 'execSync', 'exec'];

// {file, match (substring of the call text), why}
const ALLOW = [
    { file: 'scripts/render.js', match: "'--user-data-dir='", why: 'interactive login: the browser window must show' },
    { file: 'scripts/bench.js', match: '(ctx.spawn || spawnClaudeAsync)', why: 'test seam; spawnClaudeAsync is the real spawn and is scanned itself' },
    { file: 'scripts/render.js', match: "'which'", why: 'non-Windows `which` lookup; Windows takes the other branch' },
];

function files() {
    const out = [];
    for (const d of ['lib', 'scripts']) {
        for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.js')) out.push(d + '/' + f);
    }
    return out;
}

const CP_REQUIRE = "require\\(\\s*['\"](?:node:)?child_process['\"]\\s*\\)";
const ownerOf = (ns) => '(?:' + CP_REQUIRE + '|(?:' + ns.join('|') + ')(?![\\w$]))';

// Names a file binds to child_process functions: `const { spawn: spawnChild } = require('node:child_process')` or `= cp`.
function aliases(src, ns) {
    const out = [];
    for (const m of src.matchAll(new RegExp('\\{([^}]*)\\}\\s*=\\s*' + ownerOf(ns), 'g'))) {
        for (const part of m[1].split(',')) {
            const [orig, alias] = part.split(':').map((x) => x.trim());
            if (alias && NAMES.includes(orig)) out.push(alias.replace(/\$/g, '\\$'));
        }
    }
    return out;
}

// Local names bound to one child_process function: `const run = promisify(cp.execFile)` or `const sp = cp.spawn`.
function renames(src, ns) {
    const owner = ownerOf(ns);
    const fn = '\\??\\.(?:' + NAMES.join('|') + ')(?![\\w$])';
    const re = new RegExp('\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:(?:[\\w$]+\\.)?promisify\\(\\s*' + owner + fn + '\\s*\\)|' + owner + fn + '\\s*(?:[;,\\n]|$))', 'g');
    return [...src.matchAll(re)].map((m) => m[1].replace(/\$/g, '\\$'));
}

// The index of the `)` closing the `(` at `open`. What sits inside a string, a comment or a
// regular-expression literal is not code: an apostrophe in `// don't` or the `(` in `/\(/`
// must not move the depth, or the call's text runs on into the next call.
function closeOf(src, open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"' || c === '`') { i = endOfQuote(src, i); continue; }
        if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n === -1 ? src.length : n; continue; }
        if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); i = n === -1 ? src.length : n + 1; continue; }
        if (c === '/' && regexCanStart(src, i)) { i = endOfRegex(src, i); continue; }
        if (c === '(') depth++;
        else if (c === ')' && --depth === 0) return i;
    }
    return src.length - 1;
}

function endOfQuote(src, i) {
    for (let j = i + 1; j < src.length; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === src[i]) return j;
    }
    return src.length - 1;
}

// A `/` opens a regular expression where an operand is expected: after a punctuator, or after
// a keyword such as `return`. After a name, a number or `)` it is division.
function regexCanStart(src, i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j])) return true;
    return /\b(?:return|typeof|case|do|else|in|of|void|yield|await)$/.test(src.slice(Math.max(0, j - 6), j + 1));
}

// The index of the `/` closing the literal opened at `i`, or `i` itself when the line ends first
// (then it was division after all, and the scan goes on from there).
function endOfRegex(src, i) {
    let cls = false;
    for (let j = i + 1; j < src.length; j++) {
        const c = src[j];
        if (c === '\\') { j++; continue; }
        if (c === '\n') return i;
        if (cls) { if (c === ']') cls = false; continue; }
        if (c === '[') cls = true;
        else if (c === '/') return j;
    }
    return i;
}

// Every child-process call in a source string: direct, `?.`, `.call(`/`.apply(`, aliased, or a parenthesised callee like `(a || execFileSync)(`.
function callsIn(src) {
    const ns = ['cp', 'child_process'];
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*require\(\s*['"](?:node:)?child_process['"]\s*\)/g)) ns.push(m[1].replace(/\$/g, '\\$'));
    const names = NAMES.concat(aliases(src, ns), renames(src, ns));
    const list = names.join('|');
    const tail = '(?:\\.(?:call|apply))?\\(';
    const direct = new RegExp('(?<![\\w$.])(?:(?:' + ns.join('|') + ')\\??\\.)?(?:' + list + ')' + tail, 'g');
    const viaRequire = new RegExp('require\\(\\s*[\'"](?:node:)?child_process[\'"]\\s*\\)\\??\\.(?:' + list + ')' + tail, 'g');
    const viaBracket = new RegExp('(?<![\\w$.])(?:' + ns.join('|') + ')(?:\\?\\.)?\\[\\s*[\'"](?:' + list + ')[\'"]\\s*\\]' + tail, 'g');
    const starts = [];
    for (const re of [direct, viaRequire, viaBracket]) {
        for (const m of src.matchAll(re)) starts.push({ at: m.index, open: m.index + m[0].length - 1 });
    }
    // A parenthesised callee `( ... )(`: its balanced inner text names a scanned function that is not itself being called.
    for (let a = src.indexOf('('); a !== -1; a = src.indexOf('(', a + 1)) {
        const i = closeOf(src, a);
        if (src[i + 1] !== '(') continue;
        const inner = src.slice(a + 1, i);
        const isCall = [...inner.matchAll(/[\w$.]+/g)].some((t) => names.includes(t[0].split('.').pop()) && !/^\s*\(/.test(inner.slice(t.index + t[0].length)));
        if (isCall) starts.push({ at: a, open: i + 1 });
    }
    const found = [];
    for (const s of starts.sort((a, b) => a.at - b.at)) {
        const lineStart = src.lastIndexOf('\n', s.at) + 1;
        const prefix = src.slice(lineStart, s.at);
        if (/^\s*(\/\/|\*)/.test(prefix) || /function\s+$/.test(prefix)) continue;
        const i = closeOf(src, s.open);
        found.push({ text: src.slice(s.at, i + 1), line: src.slice(0, s.at).split('\n').length, at: s.at, src });
    }
    return found;
}

const calls = (rel) => callsIn(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const allowed = (rel, text) => ALLOW.some((a) => a.file === rel && text.includes(a.match));

// The names a parameter list declares: each comma-separated piece at depth 0, up to its own `=`,
// so `opts = defaults()` declares `opts` and not `defaults`.
function paramNames(list) {
    const out = [];
    let depth = 0, piece = '';
    const flush = () => { out.push(...(piece.split('=')[0].match(/[\w$]+/g) || [])); piece = ''; };
    for (const c of list) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        if (c === ',' && depth === 0) { flush(); continue; }
        piece += c;
    }
    flush();
    return out;
}

// The parameter list ending at `end` (whitespace skipped): a balanced `( ... )` that is not the
// head of an `if`/`for`/`while`/`switch`/`catch`/`with`, or — where `bare` says an arrow follows — one bare name.
function listBefore(src, end, bare) {
    let j = end;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (src[j] === ')') {
        for (let k = j, depth = 0; k >= 0; k--) {
            if (src[k] === ')') depth++;
            else if (src[k] === '(' && --depth === 0) {
                return /\b(?:if|for|while|switch|catch|with)\s*$/.test(src.slice(Math.max(0, k - 12), k)) ? null : src.slice(k + 1, j);
            }
        }
        return null;
    }
    const m = bare ? /[\w$]+$/.exec(src.slice(Math.max(0, j - 60), j + 1)) : null;
    return m ? m[0] : null;
}

// The `=` of the `=>` of an arrow whose expression body holds index `before`: walking back,
// nothing at the call's own depth closes a statement (`;`) or opens a block (`{`) first. -1 when none.
function arrowBefore(src, before) {
    for (let i = before - 1, depth = 0; i > 0; i--) {
        const c = src[i];
        if (c === ')' || c === ']' || c === '}') depth++;
        else if (c === '(' || c === '[') { if (depth > 0) depth--; }
        else if (c === '{') { if (depth === 0) return -1; depth--; }
        else if (c === ';' && depth === 0) return -1;
        else if (c === '>' && src[i - 1] === '=' && depth === 0) return i - 1;
    }
    return -1;
}

// A name that is a parameter of the function enclosing the call is that caller's own, so no declaration elsewhere applies.
// An expression-bodied arrow has no `{` to find, so it is asked first; a block's head is read balanced, so a default
// holding parentheses stays inside the list.
function isParam(src, name, before) {
    const arrow = arrowBefore(src, before);
    if (arrow !== -1) {
        const list = listBefore(src, arrow - 1, true);
        if (list !== null && paramNames(list).includes(name)) return true;
    }
    let depth = 0;
    for (let i = before - 1; i >= 0; i--) {
        if (src[i] === '}') depth++;
        else if (src[i] === '{' && depth-- === 0) {
            let j = i - 1;
            while (j >= 0 && /\s/.test(src[j])) j--;
            const arrowHead = src[j] === '>' && src[j - 1] === '=';
            const list = listBefore(src, arrowHead ? j - 2 : j, arrowHead);
            if (list !== null) return paramNames(list).includes(name);
            depth = 0;
        }
    }
    return false;
}

// The text of `const|let|var <name> = { ... }` that applies to a call at index `before`, or '' when none does.
// Rule: the last matching declaration that starts before the call, so a same-named binding in an earlier
// or later function is not mistaken for the one the call uses.
function declaration(src, name, before) {
    if (isParam(src, name, before)) return '';
    let m = null;
    for (const x of src.matchAll(new RegExp('\\b(?:const|let|var)\\s+' + name + '\\s*=\\s*\\{', 'g'))) if (x.index < before) m = x;
    if (!m) return '';
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
    }
    return '';
}

const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
// Only the option written as a real property, outside comments, counts.
const sayshidden = (t) => /windowsHide\s*:\s*true\b/.test(noComments(t));

// Options held in a variable carry windowsHide only if the call text or that variable's declaration says so.
function hidden(c) {
    if (sayshidden(c.text)) return true;
    const names = [...noComments(c.text).matchAll(/\.\.\.(\w+)|,\s*(\w+)\s*\)$/g)].map((m) => m[1] || m[2]);
    return names.some((n) => sayshidden(declaration(c.src, n, c.at)));
}

test('every child-process call in lib/ and scripts/ carries windowsHide or is allowlisted', () => {
    const bad = [];
    for (const rel of files()) {
        for (const c of calls(rel)) {
            if (hidden(c) || allowed(rel, c.text)) continue;
            bad.push(rel + ':' + c.line);
        }
    }
    assert.deepStrictEqual(bad, []);
});

test('allowlist entries still match a real call', () => {
    for (const a of ALLOW) {
        assert.ok(calls(a.file).some((c) => c.text.includes(a.match)), 'stale allowlist entry: ' + a.file + ' ' + a.match);
        assert.ok(a.why);
    }
});

test('the scanner finds a call in each shape it could miss, and reads windowsHide on it', () => {
    const shapes = {
        parenthesised: (o) => 'const t = (deps.execFile || execFileSync)(process.execPath, [], { ' + o + 'encoding: 1 });',
        member: (o) => 'const t = (x.spawn)("a", [], { ' + o + 'stdio: 1 });',
        exec: (o) => 'cp.exec("a", { ' + o + 'cwd: 1 });',
        bareExec: (o) => 'exec("a", { ' + o + 'cwd: 1 });',
        namespace: (o) => "const childProcess = require('node:child_process');\nchildProcess.spawn('a', [], { " + o + 'stdio: 1 });',
        inlineRequire: (o) => "require('node:child_process').spawn('a', [], { " + o + 'stdio: 1 });',
        bracket: (o) => "const cp = require('child_process');\ncp['spawn']('a', [], { " + o + 'stdio: 1 });',
        nestedParen: (o) => 'const t = (deps.x || wrap(execFileSync))(process.execPath, [], { ' + o + 'encoding: 1 });',
        nestedCall: (o) => 'const t = (pick(a, b) || spawn)("a", [], { ' + o + 'stdio: 1 });',
        promisifyRename: (o) => "const cp = require('node:child_process');\nconst run = promisify(cp.execFile);\nrun('git', [], { " + o + 'cwd: 1 });',
        plainRename: (o) => "const cp = require('node:child_process');\nconst sp = cp.spawn;\nsp('a', [], { " + o + 'stdio: 1 });',
        namespaceDestructure: (o) => "const cp = require('node:child_process');\nconst { execFile: ef } = cp;\nef('a', [], { " + o + 'cwd: 1 });',
        inlinePromisify: (o) => "const run = util.promisify(require('node:child_process').execFile);\nrun('git', [], { " + o + 'cwd: 1 });',
        call: (o) => "const cp = require('node:child_process');\ncp.spawn.call(null, 'a', [], { " + o + 'stdio: 1 });',
        apply: (o) => "const cp = require('node:child_process');\ncp.spawn.apply(cp, ['a', [], { " + o + 'stdio: 1 }]);',
        optional: (o) => "const cp = require('node:child_process');\ncp?.spawn('a', [], { " + o + 'stdio: 1 });',
        commaRename: (o) => "const cp = require('node:child_process');\nconst sp = cp.spawn, n = 1;\nsp('a', [], { " + o + 'stdio: 1 });',
        alias: (o) => "const { spawn: spawnChild } = require('node:child_process');\nspawnChild('a', [], { " + o + 'stdio: 1 });',
    };
    for (const [name, make] of Object.entries(shapes)) {
        const bare = callsIn(make(''));
        assert.strictEqual(bare.length, 1, name + ': found once');
        assert.ok(!hidden(bare[0]), name + ': unhidden');
        const shown = callsIn(make('windowsHide: true, '));
        assert.strictEqual(shown.length, 1, name + ': found once with the option');
        assert.ok(hidden(shown[0]), name + ': hidden');
    }
});

test('a rename of a non-child_process function is not flagged', () => {
    assert.deepStrictEqual(callsIn("const run = promisify(somethingElse.execFile);\nrun('git', [], {});"), []);
    assert.deepStrictEqual(callsIn("const sp = other.spawn;\nsp('a');"), []);
});

test('the scanner ignores regex.exec and other objects exec', () => {
    assert.deepStrictEqual(callsIn('const m = re.exec(s); const n = /a/.exec(s); this.exec(1);'), []);
    assert.deepStrictEqual(callsIn('const f = foo(bar)(1); const g = (pick(a, b) || other)(2); (() => { x(1); })();'), []);
});

test('the scanner refuses near-misses: windowsHide false, a comment, a same-named declaration elsewhere, a parameter', () => {
    const refused = {
        falseValue: "spawn('a', [], { windowsHide: false });",
        lineComment: "spawn('a', [], {\n // windowsHide\n stdio: 1 });",
        blockComment: "spawn('a', [], { /* windowsHide: true */ stdio: 1 });",
        falseInDecl: "const opts = { windowsHide: false };\nspawn('a', [], opts);",
        commentInDecl: "const opts = { // windowsHide: true\n cwd: 1 };\nspawn('a', [], opts);",
        earlierFunction: "function a() { const opts = { windowsHide: true }; }\nfunction b() {\n const opts = { cwd: 1 };\n spawn('a', [], opts);\n}",
        laterDeclaration: "function b() { spawn('a', [], opts); }\nfunction a() { const opts = { windowsHide: true }; }",
        parameter: "function a() { const opts = { windowsHide: true }; }\nfunction b(opts) {\n spawn('a', [], opts);\n}",
        paramInBlock: "function a() { const opts = { windowsHide: true }; }\nfunction b(opts) {\n if (x) {\n spawn('a', [], opts);\n }\n}",
        arrowParameter: "const a = () => { const opts = { windowsHide: true }; };\nconst b = (opts) => {\n spawn('a', [], opts);\n};",
        defaultParen: "function a() { const opts = { windowsHide: true }; }\nfunction b(opts = defaults()) {\n spawn('a', [], opts);\n}",
        exprArrow: "const opts = { windowsHide: true };\nconst b = opts => spawn('a', [], opts);",
        exprArrowParen: "const opts = { windowsHide: true };\nconst b = (x, opts) => spawn('a', [], opts);",
        spreadInComment: "const opts = { windowsHide: true };\nspawn('a', [], { /* ...opts */ stdio: 1 });",
    };
    for (const [name, src] of Object.entries(refused)) {
        const c = callsIn(src);
        assert.strictEqual(c.length, 1, name + ': found once');
        assert.ok(!hidden(c[0]), name + ': must be unhidden');
    }
    const ok = callsIn("function a() { const opts = { cwd: 1 }; }\nfunction b() {\n const opts = { windowsHide: true };\n spawn('a', [], opts);\n}");
    assert.strictEqual(ok.length, 1);
    assert.ok(hidden(ok[0]), 'the right declaration carries it');
    const inBlock = callsIn("function b() {\n const opts = { windowsHide: true };\n if (opts) {\n spawn('a', [], opts);\n }\n}");
    assert.ok(hidden(inBlock[0]), 'a local declaration is not shadowed by an if condition');
    const own = callsIn("function b(opts) {\n spawn('a', [], { windowsHide: true, ...opts });\n}");
    assert.ok(hidden(own[0]), 'a parameter does not hide the call text saying windowsHide: true');
    const notShadowed = callsIn("const opts = { windowsHide: true };\nconst b = (x) => spawn('a', [], opts);");
    assert.ok(hidden(notShadowed[0]), 'an arrow whose parameters do not name opts leaves the declaration in force');
});

test('a quote in a comment or a paren in a regular expression does not carry a call into the next one', () => {
    for (const src of [
        "spawn('a', [], { // don't\n stdio: 1 });\nspawn('b', [], { windowsHide: true });",
        "spawn('a', [], { re: /\\(/, stdio: 1 });\nspawn('b', [], { windowsHide: true });",
    ]) {
        const c = callsIn(src);
        assert.strictEqual(c.length, 2, src);
        assert.ok(!hidden(c[0]), 'the first call is unhidden: ' + c[0].text);
        assert.ok(hidden(c[1]), 'the second call is hidden');
    }
});
