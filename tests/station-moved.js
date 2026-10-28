'use strict';
// tests/station-moved.js — a function moved out of station.js (station-52)
// is declared in its module, is no longer written out in station.js (only a
// one-line forward may remain), and its module is on the page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIR = path.join(__dirname, '..', 'assets', 'station');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

// Source with comments, strings, templates and regex literals blanked (same
// length), so identifiers and braces can be read off it.
function blank(src) {
    let out = '', i = 0, last = '';
    const fill = (a, b) => src.slice(a, b).replace(/[^\n]/g, ' ');
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        let j = -1;
        if (c === '/' && d === '/') { j = src.indexOf('\n', i); if (j < 0) j = src.length; }
        else if (c === '/' && d === '*') { j = src.indexOf('*/', i) + 2; }
        else if (c === '`') {
            // literal text is blanked, `${...}` bodies stay scannable
            let p = i + 1;
            out += ' ';
            while (src[p] !== '`') {
                if (src[p] === '\\') { out += '  '; p += 2; continue; }
                if (src[p] === '$' && src[p + 1] === '{') {
                    let q = p + 2, dep = 1;
                    while (dep) { if (src[q] === '{') dep++; else if (src[q] === '}') dep--; q++; }
                    out += '  ' + blank(src.slice(p + 2, q - 1)) + ' ';
                    p = q; continue;
                }
                out += src[p] === '\n' ? '\n' : ' '; p++;
            }
            out += ' '; last = 'x'; i = p + 1; continue;
        } else if (c === '\'' || c === '"') {
            j = i + 1;
            while (src[j] !== c) j += src[j] === '\\' ? 2 : 1;
            j++;
        } else if (c === '/' && (last === '' || /[(,=:\[!&|?{};+]/.test(last) || /(^|\W)return$/.test(out.trimEnd().slice(-7)))) {
            j = i + 1;
            let cls = false;
            while (cls || src[j] !== '/') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
            j++;
            while (/[a-z]/.test(src[j])) j++;
        }
        if (j < 0) { out += c; if (!/\s/.test(c)) last = c; i++; continue; }
        out += fill(i, j); last = 'x'; i = j;
    }
    return out;
}

// The K names the make({...}) call in station.js hands module `file`.
function kKeys(shell, file) {
    const at = shell.indexOf('\'' + file + '\').make({');
    assert.ok(at >= 0, 'station.js calls ' + file + ' make({...})');
    const from = at + file.length + 10;
    const end = shell.indexOf('}));', from);
    const body = blank(shell.slice(from, end));
    const keys = new Set();
    let depth = 0, buf = '';
    for (const ch of body + ',') {
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        if (ch === '}' || ch === ')' || ch === ']') depth--;
        if (ch === ',' && depth === 0) { const m = /^\s*(\w+)\s*:/.exec(buf); if (m) keys.add(m[1]); buf = ''; } else buf += ch;
    }
    return keys;
}

// Identifiers the make body reads that nothing in it declares (best effort).
function freeIdents(mod) {
    const code = blank(mod);
    const start = code.indexOf('function make(K)');
    let k = code.indexOf('{', start), depth = 0, end = k;
    for (; end < code.length; end++) {
        if (code[end] === '{') depth++;
        if (code[end] === '}' && --depth === 0) break;
    }
    const body = code.slice(k, end);
    const declared = new Set(['K', 'arguments', 'undefined']);
    let m;
    const decl = /\b(?:var|let|const)\s+/g;
    while ((m = decl.exec(body))) {
        let d = 0, part = '', p = decl.lastIndex;
        for (;; p++) {
            const ch = body[p];
            if ('{(['.includes(ch)) d++;
            if ('})]'.includes(ch)) { if (d === 0) break; d--; }
            if ((ch === ',' || ch === ';' || ch === undefined) && d === 0) {
                const id = /^\s*(\w+)/.exec(part); if (id) declared.add(id[1]);
                part = '';
                if (ch !== ',') break;
            } else part += ch;
            if (/\bof\b|\bin\b/.test(part) && d === 0 && /^\s*\w+\s+(of|in)\b/.test(part)) { declared.add(/^\s*(\w+)/.exec(part)[1]); break; }
        }
    }
    const fn = /\bfunction\s*(\w*)\s*\(([^)]*)\)/g;
    while ((m = fn.exec(body))) { if (m[1]) declared.add(m[1]); (m[2].match(/\w+/g) || []).forEach((x) => declared.add(x)); }
    for (const a of body.matchAll(/\bcatch\s*\((\w+)\)/g)) declared.add(a[1]);
    for (const a of body.matchAll(/\(([^()]*)\)\s*=>/g)) (a[1].match(/\w+/g) || []).forEach((x) => declared.add(x));
    for (const a of body.matchAll(/\b(\w+)\s*=>/g)) declared.add(a[1]);
    const free = new Set();
    for (const t of body.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const id = t[0], pre = body.slice(0, t.index).trimEnd(), post = body.slice(t.index + id.length);
        if (/^\d/.test(body[t.index - 1] || '')) continue;
        if (pre.endsWith('.') && !pre.endsWith('..')) continue;
        if (/[{,]$/.test(pre) && /^\s*:(?!:)/.test(post) ) continue;
        if (/^\s*:/.test(post) && /\bcase$|\bdefault$/.test(pre + id)) continue;
        if (declared.has(id) || (id in globalThis && id !== 'process' && id !== 'require') || ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'new', 'typeof', 'in', 'of', 'instanceof', 'case', 'default', 'switch', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'this', 'null', 'true', 'false', 'void', 'delete'].includes(id)) continue;
        free.add(id);
    }
    return free;
}

function moved(file, names) {
    const api = require(path.join(DIR, file));
    assert.equal(typeof api.make, 'function', file + ' exports make');
    const shell = read('station.js');
    const mod = read(file);
    const built = api.make(new Proxy({}, { get: () => function () {} }));
    for (const n of names) assert.equal(typeof built[n], 'function', file + ' make(K) returns ' + n);
    const keys = kKeys(shell, file);
    const code = blank(mod);
    assert.doesNotMatch(code, /\bK\s*\[/, file + ' reads K by computed key');
    assert.doesNotMatch(code, /=\s*K\s*[;,\n]|=\s*K\s*$/, file + ' aliases K');
    assert.doesNotMatch(code, /\}\s*=\s*K\b/, file + ' destructures K');
    for (const m of code.matchAll(/\bK\.(\w+)/g)) assert.ok(keys.has(m[1]), 'station.js make({...}) for ' + file + ' lacks K.' + m[1]);
    const free = [...freeIdents(mod)];
    assert.deepEqual(free, [], file + ' make body reads names nothing declares: ' + free.join(', '));
    const forwarder = (n) => new RegExp('function ' + n + '\\(\\) \\{ return \\w+\\(\\)\\.' + n + '\\.apply\\(null, arguments\\); \\}');
    const shellCode = blank(shell);
    for (const n of names) {
        const rest = shellCode.replace(forwarder(n), '');
        const used = new RegExp('(?<![.\\w$])' + n + '\\b').test(rest.replace(new RegExp('^.*\\bfunction ' + n + '\\(.*$', 'm'), ''));
        if (used) assert.match(shell, forwarder(n), 'station.js keeps a forwarder for ' + n);
    }
    assert.ok(read('index.html').includes('<script src="station/' + file + '"></script>'), file + ' is in index.html');
    for (const n of names) {
        assert.match(mod, new RegExp('function ' + n + '\\('), n + ' is declared in ' + file);
        const written = new RegExp('function ' + n + '\\([^)]*\\)\\s*\\{(?!\\s*return \\w+\\(\\)\\.' + n + '\\.apply\\(null, arguments\\); \\})');
        assert.doesNotMatch(shell, written, n + ' is still written out in station.js');
    }
}
module.exports = { moved };
