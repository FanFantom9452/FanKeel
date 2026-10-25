'use strict';
// Every non-interactive child process must carry windowsHide, or Windows flashes a cmd window.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CALL = /(?<![\w$.])(?:cp\.|child_process\.)?(spawnSync|execFileSync|execFile|spawn|execSync)\(/g;

// {file, match (substring of the call text), why}
const ALLOW = [
    { file: 'scripts/render.js', match: "'--user-data-dir='", why: 'interactive login: the browser window must show' },
    { file: 'scripts/render.js', match: "'which'", why: 'non-Windows `which` lookup; Windows takes the other branch' },
    { file: 'scripts/station.js', match: 'spawn(cmd, args,', why: 'browser opener: the browser window must show' },
];

function files() {
    const out = [];
    for (const d of ['lib', 'scripts']) {
        for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.js')) out.push(d + '/' + f);
    }
    return out;
}

function calls(rel) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const found = [];
    let m;
    CALL.lastIndex = 0;
    while ((m = CALL.exec(src))) {
        const lineStart = src.lastIndexOf('\n', m.index) + 1;
        const prefix = src.slice(lineStart, m.index);
        if (/^\s*(\/\/|\*)/.test(prefix) || /function\s+$/.test(prefix)) continue;
        let depth = 0, i = m.index + m[0].length - 1, q = null;
        for (; i < src.length; i++) {
            const c = src[i];
            if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
            if (c === "'" || c === '"' || c === '`') q = c;
            else if (c === '(') depth++;
            else if (c === ')' && --depth === 0) break;
        }
        found.push({ text: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length, src });
    }
    return found;
}

const allowed = (rel, text) => ALLOW.some((a) => a.file === rel && text.includes(a.match));

// The text of `const|let|var <name> = { ... }`, or '' when the file declares none.
function declaration(src, name) {
    const m = new RegExp('\\b(?:const|let|var)\\s+' + name + '\\s*=\\s*\\{').exec(src);
    if (!m) return '';
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
    }
    return '';
}

// Options held in a variable carry windowsHide only if the call text or that variable's declaration says so.
function hidden(c) {
    if (/windowsHide/.test(c.text)) return true;
    const names = [...c.text.matchAll(/\.\.\.(\w+)|,\s*(\w+)\s*\)$/g)].map((m) => m[1] || m[2]);
    return names.some((n) => /windowsHide/.test(declaration(c.src, n)));
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
