'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier', 'fankeel-fixer', 'fankeel-brain'];

// `fankeel-verifier` is the one named exception: it writes evidence rows to a
// file for the Workflow join, and `Write` is what that takes. It is not less
// constrained than the other three for holding it — `guard.js`'s PreToolUse
// hook matches `Edit|Write|NotebookEdit` (`.claude-plugin/plugin.json`), so
// `Write` is guarded; `Bash`, which all five of them hold, is matched by a
// second `guard.js` entry (matcher `Bash|PowerShell`) for three of them —
// not `fankeel-verifier` or `fankeel-brain`, per `lib/guard.js`'s
// `readOnlyAgentType` list.
// `fankeel-fixer` is the second named exception: it makes the small edit
// itself rather than returning it for the parent to apply, so it needs both
// `Edit` and `Write` — never `Bash`, so it never runs the test the edit would
// need.
// `fankeel-brain` is the third: it writes its handoff — the report and gate
// block a controller hands on by path (`lib/handoff.js`) — and, on a build
// stage, the commit file its controller commits from, so it takes `Write` and
// nothing that edits in place.
const MAY_WRITE = { 'fankeel-verifier': ['Write'], 'fankeel-fixer': ['Edit', 'Write'], 'fankeel-brain': ['Write'] };

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

// The five cut tags are defined here once. Build's Part 4 and audit's code
// half both point at this section rather than restating it, so a tag that
// went missing here would go missing from both.
test('the reviewer carries the cut tags build and audit ask for', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Cuts$/m);
    for (const tag of ['delete:', 'stdlib:', 'native:', 'yagni:', 'shrink:']) {
        assert.ok(text.includes('`' + tag + '`'), 'the reviewer does not define ' + tag);
    }
    assert.match(text, /net: -<N> lines possible\./);
    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
    assert.match(build, /Part 4 — cuts/);
});

// Each sentence is pinned to its own Part: one moved into another Part fails.
test('the reviewer template asks Part 2 for a control and Part 3 for the page made false', () => {
    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
    const part2 = build.split('Part 2 —')[1].split('Part 3 —')[0];
    const part3 = build.split('Part 3 —')[1].split('Part 4 —')[0];
    assert.match(part2, /has never failed/);
    assert.match(part2, /must reject/);
    assert.match(part3, /makes false/);
    assert.match(part3, /page:line/);
});

// A reader that sends one call per turn reads like a slow pipeline; what is
// slow is the turn count, not git.
test('the reader is told to send reads that do not depend on each other in one response', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const searching = text.split('\n## Searching\n')[1].split('\n## ')[0];
    assert.match(searching, /same response/);
});

test('the stage agent writes its handoff and dispatches readers, on opus', () => {
    const f = front(path.join(ROOT, 'agents', 'fankeel-brain.md'));
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Agent'), 'it dispatches its readers');
    assert.ok(tools.includes('Write'), 'it writes its handoff');
    assert.ok(!tools.includes('Edit'), 'it changes no source');
    assert.equal(f.model, 'opus');
    // At the session's `high` it thought 2.5–4× what the main session did over the same survey.
    assert.equal(f.effort, 'medium');
});

// Its brief says to read cited lines with `sed -n` in one Bash call; a Tools
// section keeping Bash to git and the plugin's scripts would forbid exactly that.
test('the stage agent may read with sed in Bash', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const tools = text.split('\n## Tools\n')[1].split('\n## ')[0];
    assert.match(tools, /`sed -n`/);
});
