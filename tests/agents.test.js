'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier', 'fankeel-fixer'];

// `fankeel-verifier` is the one named exception: it writes evidence rows to a
// file for the Workflow join, and `Write` is what that takes. It is not less
// constrained than the other three for holding it — `guard.js`'s PreToolUse
// hook matches `Edit|Write|NotebookEdit` (`.claude-plugin/plugin.json`), so
// `Write` is guarded; `Bash`, which all four agents hold, is matched by a
// second `guard.js` entry (matcher `Bash|PowerShell`) for three of them —
// not `fankeel-verifier`, per `lib/guard.js`'s `readOnlyAgentType` list.
// `fankeel-fixer` is the second named exception: it makes the small edit
// itself rather than returning it for the parent to apply, so it needs both
// `Edit` and `Write` — never `Bash`, so it never runs the test the edit would
// need.
const MAY_WRITE = { 'fankeel-verifier': ['Write'], 'fankeel-fixer': ['Edit', 'Write'] };

function front(file) {
    const m = FRONT.exec(fs.readFileSync(file, 'utf8'));
    assert.ok(m, file + ' has frontmatter');
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([\w-]+):\s*(.*)$/.exec(line);
        if (kv) out[kv[1]] = kv[2];
    }
    return out;
}

test('every agent parses, names itself after its file, and cannot edit', () => {
    for (const name of NAMES) {
        const f = front(path.join(ROOT, 'agents', name + '.md'));
        assert.equal(f.name, name);
        assert.match(f.tools, /^\[.+\]$/, name + ' tools is a list');
        const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
        assert.ok(tools.length > 0, name + ' tools is not empty — an empty list refuses to launch');
        const allowed = MAY_WRITE[name] || [];
        for (const banned of ['Edit', 'Write', 'NotebookEdit']) {
            if (allowed.includes(banned)) continue;
            assert.ok(!tools.includes(banned), name + ' lists ' + banned);
        }
        assert.ok(f.model, name + ' pins a model');
    }
});

test('the manifest ships them all, and no others', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.deepEqual(manifest.agents, NAMES.map((n) => './agents/' + n + '.md'));
    for (const rel of manifest.agents) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    assert.deepEqual(fs.readdirSync(path.join(ROOT, 'agents')).sort(), NAMES.map((n) => n + '.md').sort());
});
