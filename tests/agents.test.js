'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer'];

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
        for (const banned of ['Edit', 'Write', 'NotebookEdit']) assert.ok(!tools.includes(banned), name + ' lists ' + banned);
        assert.ok(f.model, name + ' pins a model');
    }
});

test('the manifest ships them all, and no others', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.deepEqual(manifest.agents, NAMES.map((n) => './agents/' + n + '.md'));
    for (const rel of manifest.agents) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    assert.deepEqual(fs.readdirSync(path.join(ROOT, 'agents')).sort(), NAMES.map((n) => n + '.md').sort());
});
