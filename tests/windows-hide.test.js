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
    const fn = '\\.(?:' + NAMES.join('|') + ')(?![\\w$])';
    const re = new RegExp('\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:(?:[\\w$]+\\.)?promisify\\(\\s*' + owner + fn + '\\s*\\)|' + owner + fn + '\\s*(?:[;\\n]|$))', 'g');
    return [...src.matchAll(re)].map((m) => m[1].replace(/\$/g, '\\$'));
}

// Every child-process call in a source string: direct, aliased, or a parenthesised callee like `(a || execFileSync)(`.
function callsIn(src) {
    const ns = ['cp', 'child_process'];
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*require\(\s*['"](?:node:)?child_process['"]\s*\)/g)) ns.push(m[1].replace(/\$/g, '\\$'));
    const names = NAMES.concat(aliases(src, ns), renames(src, ns));
    const list = names.join('|');
    const direct = new RegExp('(?<![\\w$.])(?:(?:' + ns.join('|') + ')\\.)?(?:' + list + ')\\(', 'g');
    const viaRequire = new RegExp('require\\(\\s*[\'"](?:node:)?child_process[\'"]\\s*\\)\\.(?:' + list + ')\\(', 'g');
    const viaBracket = new RegExp('(?<![\\w$.])(?:' + ns.join('|') + ')\\[\\s*[\'"](?:' + list + ')[\'"]\\s*\\]\\(', 'g');
    const starts = [];
    for (const re of [direct, viaRequire, viaBracket]) {
        for (const m of src.matchAll(re)) starts.push({ at: m.index, open: m.index + m[0].length - 1 });
    }
    // A parenthesised callee `( ... )(`: its balanced inner text names a scanned function that is not itself being called.
    for (let a = src.indexOf('('); a !== -1; a = src.indexOf('(', a + 1)) {
        let depth = 0, i = a, q = null;
        for (; i < src.length; i++) {
            const c = src[i];
            if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
            if (c === "'" || c === '"' || c === '`') q = c;
            else if (c === '(') depth++;
            else if (c === ')' && --depth === 0) break;
        }
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
        let depth = 0, i = s.open, q = null;
        for (; i < src.length; i++) {
            const c = src[i];
            if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
            if (c === "'" || c === '"' || c === '`') q = c;
            else if (c === '(') depth++;
            else if (c === ')' && --depth === 0) break;
        }
        found.push({ text: src.slice(s.at, i + 1), line: src.slice(0, s.at).split('\n').length, at: s.at, src });
    }
    return found;
}

const calls = (rel) => callsIn(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const allowed = (rel, text) => ALLOW.some((a) => a.file === rel && text.includes(a.match));

// A name that is a parameter of the function enclosing the call is that caller's own, so no declaration elsewhere applies.
function isParam(src, name, before) {
    let depth = 0;
    for (let i = before - 1; i >= 0; i--) {
        if (src[i] === '}') depth++;
        else if (src[i] === '{' && depth-- === 0) {
            const head = src.slice(Math.max(0, i - 300), i);
            const h = head.match(/\(([^()]*)\)\s*(?:=>\s*)?$/) || head.match(/([\w$]+)\s*=>\s*$/);
            if (h && !/\b(?:if|for|while|switch|catch)\s*\([^()]*\)\s*$/.test(head)) return (h[1].match(/[\w$]+/g) || []).includes(name);
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
});
