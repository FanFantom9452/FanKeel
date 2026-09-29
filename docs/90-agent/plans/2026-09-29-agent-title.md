---
status: design-intent
last_verified: 2026-09-29
---

# Agent Title Prefix Implementation Plan

**Goal:** every Agent/Task dispatch's `description` carries a prefix `<alias>[ <version>] · <effort>` computed by a hook, never written by the model.
**Architecture:** `lib/title.js` computes the prefix from `tool_input.model`, the agent file's frontmatter, `CLAUDE_CODE_SUBAGENT_MODEL` and the main transcript, reading versions off real `message.model` ids in this project's subagent transcripts. `hooks/title.js`, a second PreToolUse on `Agent|Task`, returns `updatedInput` with the prefixed description. The rules stop telling the model to write a version, and the station's live subagent row shows each agent's real model and effort from its own transcript.
**Tech Stack:** Node ≥ 24 (`node:test`, `node:fs`), no dependencies (`package.json` `dependencies` is `{}`); Claude Code 2.1.284.
**Spec:** [2026-09-29-agent-title-design.md](2026-09-29-agent-title-design.md)

## Global Constraints

- CommonJS, `'use strict';` on line 1 or 2, four-space indent, `require('node:<mod>')` for built-ins — every file in `lib/` and `hooks/`.
- No new dependency: `package.json` has `"dependencies": {}` and `"test": "node --test"`.
- A hook exits 0 on every path and writes nothing for a call it has no opinion about (`hooks/budget.js:11-13`); stdin goes through `run()` / `parse()` from `lib/hook.js:24,41`.
- The injected block is capped at `BLOCK_CAP = 2400` characters (`lib/render.js:564`); a rule line may only get shorter.
- `READ_CAP` 1500 lines (`lib/plantasks.js`): `assets/station/station.js` (5170 lines) is modified by range only.
- `assets/station/station.js` runs in the browser and is `require`d by tests; it may not `require` anything from `lib/`. Its existing `modelKey()` / `modelLabel()` (`assets/station/station.js:235-243`) parse ids there.
- Frontmatter is read with `frontmatter()` from `lib/docs.js` (exported, used as `docs.frontmatter` in `lib/todo.js:306`); a file tail with `readTail(file, bytes)` from `lib/context.js:64`.
- Tests make temp dirs with `tests/tmp.js`'s `tmp(prefix)`; a test that spawns a hook passes `cwd: <fixture>` (it must not read this machine's registry).
- Commits: `feat:` / `fix:` / `docs:` subject, body ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `TODO.md` is generated: edit `docs/90-agent/todo/<id>.md`, then `node scripts/todo.js index`.
- Measured 2026-09-29 (`.fankeel/build/task-20260929T090942/probe/stream.jsonl`, `stream2.jsonl`): `updatedInput.description` with **no** `permissionDecision` is applied — `meta.json`, `task_started` and the tool result carry the rewrite; the model's own tool_use keeps its original. So the hook emits no `permissionDecision`.

## Risks

- A hook on disk is not live in a running process — Task 2's hook only runs in a session started after the plugin is reinstalled from the local directory — hits verify's live dispatch check — verify opens a new terminal and reinstalls first.
- Scanning every subagent transcript could pass the hook's 5 s timeout — Task 1 — `versionFor` sorts by mtime and reads at most `SCAN_CAP` (50) files' tails.
- `guard.js` and `title.js` both answer `Agent|Task` — Task 2 — guard only ever denies and title only rewrites; a deny still wins. Task 2's test checks title.js emits no `permissionDecision`.

## Task 1: lib/title.js — compute the prefix

**Files:**
- Modify: `lib/title.js` — new module
- Read: `lib/docs.js` — `frontmatter(text)`
- Read: `lib/context.js` — `readTail(file, bytes)`
- Test: `tests/title.test.js`

**Interfaces:**
- Consumes: none
- Produces: `parseModel(id) → { alias, version } | null`; `prefixFor({ toolInput, pluginRoot, projectDir, configDir, transcriptPath, env }) → string`; `retitle(description, prefix) → string`; `SCAN_CAP` (50)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/title.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { parseModel, prefixFor, retitle } = require('../lib/title.js');

const said = (model) => JSON.stringify({ type: 'assistant', message: { model, content: [{ type: 'text', text: 'x' }] } }) + '\n';

// <root>/plugin/agents, <root>/config/agents, <root>/projects/p/<sid>.jsonl and its subagents.
function world() {
    const root = tmp('title-');
    const plugin = path.join(root, 'plugin');
    fs.mkdirSync(path.join(plugin, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'agents', 'fankeel-reader.md'), '---\nname: fankeel-reader\nmodel: sonnet\neffort: medium\n---\nbody\n');
    const proj = path.join(root, 'projects', 'p');
    fs.mkdirSync(proj, { recursive: true });
    const transcriptPath = path.join(proj, 'main.jsonl');
    fs.writeFileSync(transcriptPath, said('claude-opus-5-5'));
    return { root, plugin, proj, transcriptPath, configDir: path.join(root, 'config'), projectDir: path.join(root, 'cwd') };
}
function subagent(w, sid, id, model, ageMs) {
    const sub = path.join(w.proj, sid, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const file = path.join(sub, 'agent-' + id + '.jsonl');
    fs.writeFileSync(file, said(model));
    const t = (Date.now() - ageMs) / 1000;
    fs.utimesSync(file, t, t);
}
const ask = (w, toolInput) => prefixFor({ toolInput, pluginRoot: w.plugin, projectDir: w.projectDir,
    configDir: w.configDir, transcriptPath: w.transcriptPath, env: {} });

test('parseModel reads family and version off any claude id, with no table', () => {
    assert.deepEqual(parseModel('claude-sonnet-5-5'), { alias: 'sonnet', version: '5.5' });
    assert.deepEqual(parseModel('claude-sonnet-5'), { alias: 'sonnet', version: '5' });
    assert.deepEqual(parseModel('claude-haiku-5-5'), { alias: 'haiku', version: '5.5' });
    assert.deepEqual(parseModel('claude-haiku-4-5-20251001'), { alias: 'haiku', version: '4.5' });
    assert.equal(parseModel('<synthetic>'), null);
});

test('an agent file and a transcript give alias, version and effort', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet 5.5 · medium');
});

test('with no subagent transcript the version is left out', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet · medium');
});

test('tool_input.model wins over the frontmatter', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5-5', 1000);
    subagent(w, 's1', 'a2', 'claude-haiku-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', model: 'haiku', description: 'x' }), 'haiku 5.5 · medium');
});

test('the newest transcript names the version, not the most frequent', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5', 60000);
    subagent(w, 's1', 'a2', 'claude-sonnet-5', 50000);
    subagent(w, 's2', 'a3', 'claude-sonnet-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet 5.5 · medium');
});

test('no model anywhere inherits the main transcript, effort inherit', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'general-purpose', description: 'x' }), 'opus 5.5 · inherit');
});

test('a user-level agent file is read when the project has none', () => {
    const w = world();
    fs.mkdirSync(path.join(w.configDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(w.configDir, 'agents', 'mine.md'), '---\nname: mine\nmodel: haiku\neffort: low\n---\n');
    assert.equal(ask(w, { subagent_type: 'mine', description: 'x' }), 'haiku · low');
});

test('retitle replaces a prefix the model wrote itself', () => {
    assert.equal(retitle('sonnet 5 · medium: survey stage agent', 'sonnet 5.5 · medium'), 'sonnet 5.5 · medium: survey stage agent');
    assert.equal(retitle('survey stage agent', 'sonnet · medium'), 'sonnet · medium: survey stage agent');
    assert.equal(retitle('inherit · inherit: x', 'opus 5.5 · inherit'), 'opus 5.5 · inherit: x');
});
```

2. Run `node --test tests/title.test.js` and watch it fail: `Cannot find module '../lib/title.js'`.
3. Write the implementation. In `lib/title.js`:

```js
'use strict';

// The prefix every Agent/Task description opens with — `<alias>[ <version>] ·
// <effort>` — computed here so the model never writes it. The version is read
// off a real `message.model` id, never a table: session 7a23b26a's titles said
// "sonnet 5" on 2026-09-29, the day the `sonnet` alias moved to
// claude-sonnet-5-5 (design docs/90-agent/plans/2026-09-29-agent-title-design.md).

const fs = require('node:fs');
const path = require('node:path');
const { frontmatter } = require('./docs.js');
const { readTail } = require('./context.js');

const MODEL_ID = /claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/;
const PREFIX = /^[a-z]+(?: \d+(?:\.\d+)?)? · [a-z]+: /;
const TAIL = 256 * 1024;
// At most this many subagent transcripts are opened, newest first: the hook
// runs under a 5 s timeout and one project holds thousands of them.
const SCAN_CAP = 50;

function parseModel(id) {
    const m = MODEL_ID.exec(String(id || ''));
    return m ? { alias: m[1], version: m[2] + (m[3] ? '.' + m[3] : '') } : null;
}

// The newest assistant `message.model` in a transcript's tail that parses, of
// family `alias` when one is given.
function lastModel(file, alias) {
    const text = readTail(file, TAIL);
    if (!text) return null;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        let e;
        try {
            e = JSON.parse(lines[i]);
        } catch (err) {
            continue;
        }
        const parsed = e && e.type === 'assistant' && e.message ? parseModel(e.message.model) : null;
        if (parsed && (!alias || parsed.alias === alias)) return parsed;
    }
    return null;
}

// Every `<session>/subagents/agent-*.jsonl` under the project's transcript
// directory, newest first.
function subagentFiles(projectsDir) {
    const out = [];
    let sessions;
    try {
        sessions = fs.readdirSync(projectsDir);
    } catch (e) {
        return out;
    }
    for (const s of sessions) {
        const sub = path.join(projectsDir, s, 'subagents');
        let names;
        try {
            names = fs.readdirSync(sub);
        } catch (e) {
            continue;
        }
        for (const n of names) {
            if (!/^agent-[0-9a-f]+\.jsonl$/.test(n)) continue;
            const file = path.join(sub, n);
            try {
                out.push({ file, at: fs.statSync(file).mtimeMs });
            } catch (e) { /* gone between the listing and the stat */ }
        }
    }
    return out.sort((a, b) => b.at - a.at).map((f) => f.file);
}

function versionFor(alias, transcriptPath) {
    if (typeof transcriptPath !== 'string' || !transcriptPath) return null;
    for (const file of subagentFiles(path.dirname(transcriptPath)).slice(0, SCAN_CAP)) {
        const hit = lastModel(file, alias);
        if (hit) return hit.version;
    }
    return null;
}

// `fankeel:<name>` is this plugin's own file; another plugin's is not ours to
// find; a bare name is the project's `.claude/agents/`, then the user's.
function agentFileOf(type, pluginRoot, projectDir, configDir) {
    const t = String(type || '');
    if (!t) return null;
    if (t.startsWith('fankeel:')) return path.join(pluginRoot, 'agents', t.slice('fankeel:'.length) + '.md');
    if (t.includes(':')) return null;
    for (const dir of [projectDir && path.join(projectDir, '.claude', 'agents'), configDir && path.join(configDir, 'agents')]) {
        if (!dir) continue;
        const file = path.join(dir, t + '.md');
        if (fs.existsSync(file)) return file;
    }
    return null;
}

function readAgent(file) {
    if (!file) return {};
    try {
        return frontmatter(fs.readFileSync(file, 'utf8')) || {};
    } catch (e) {
        return {};
    }
}

function prefixFor({ toolInput, pluginRoot, projectDir, configDir, transcriptPath, env }) {
    const input = toolInput || {};
    const fm = readAgent(agentFileOf(input.subagent_type, pluginRoot, projectDir, configDir));
    const effort = fm.effort || 'inherit';
    const named = [input.model, fm.model, env && env.CLAUDE_CODE_SUBAGENT_MODEL]
        .find((m) => typeof m === 'string' && m && m !== 'inherit');
    if (!named) {
        const main = typeof transcriptPath === 'string' ? lastModel(transcriptPath, null) : null;
        return (main ? main.alias + ' ' + main.version : 'inherit') + ' · ' + effort;
    }
    const full = parseModel(named);
    if (full) return full.alias + ' ' + full.version + ' · ' + effort;
    const version = versionFor(named, transcriptPath);
    return named + (version ? ' ' + version : '') + ' · ' + effort;
}

function retitle(description, prefix) {
    return prefix + ': ' + String(description || '').replace(PREFIX, '');
}

module.exports = { parseModel, prefixFor, retitle, SCAN_CAP };
```

4. Run `node --test tests/title.test.js` and watch all eight pass.
5. Mutations, one at a time, each reverted after: in `parseModel` drop `(m[3] ? '.' + m[3] : '')` → the first two prefix tests go red; in `subagentFiles` sort `a.at - b.at` → "the newest transcript" goes red; in `prefixFor` move `input.model` after `fm.model` → "tool_input.model wins" goes red; in `prefixFor` replace `(version ? ' ' + version : '')` with `' 5'` → "with no subagent transcript" goes red; in `MODEL_ID` replace `([a-z]+)` with `(fable|opus|sonnet)` → the `claude-haiku-5-5` assertion in "parseModel reads family and version" goes red; in `retitle` drop `.replace(PREFIX, '')` → "retitle replaces a prefix" goes red.
6. Commit `feat: lib/title.js — the dispatch title prefix from real model ids`.

## Task 2: hooks/title.js — the hook that writes the prefix

**Files:**
- Modify: `hooks/title.js` — new hook
- Modify: `.claude-plugin/plugin.json` — one more `PreToolUse` entry on `Agent|Task`
- Read: `lib/hook.js` — `run`, `parse`
- Read: `lib/title.js` — `prefixFor`, `retitle`
- Read: `agents/fankeel-reader.md` — the `effort:` the first test expects
- Read: `hooks/guard.js` — the other `Agent|Task` hook, unchanged
- Test: `tests/title-hook.test.js`

**Interfaces:**
- Consumes: `prefixFor({ toolInput, pluginRoot, projectDir, configDir, transcriptPath, env })`, `retitle(description, prefix)` from Task 1
- Produces: `hooks/title.js` exporting `main(raw)`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/title-hook.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'title.js');
function fire(payload, cwd) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
}
function fixture() {
    const dir = tmp('title-hook-');
    const transcript = path.join(dir, 'projects', 'p', 'main.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [] } }) + '\n');
    return { dir, transcript };
}

test('an Agent call gets its description prefixed through updatedInput, with no permission decision', () => {
    const f = fixture();
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'fankeel:fankeel-reader', description: 'sonnet 5 · medium: read the map', prompt: 'p' } }, f.dir);
    const h = out.hookSpecificOutput;
    assert.equal(h.hookEventName, 'PreToolUse');
    assert.equal(h.permissionDecision, undefined);
    assert.equal(h.updatedInput.prompt, 'p');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a general-purpose call inherits the main transcript model', () => {
    const f = fixture();
    const out = fire({ tool_name: 'Task', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'general-purpose', description: 'look', prompt: 'p' } }, f.dir);
    assert.equal(out.hookSpecificOutput.updatedInput.description, 'opus 5.5 · inherit: look');
});

test('any other tool, or bad input, writes nothing', () => {
    const f = fixture();
    assert.equal(fire({ tool_name: 'Bash', tool_input: { command: 'ls' } }, f.dir), null);
    const r = spawnSync(process.execPath, [HOOK], { input: 'not json', cwd: f.dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
});

test('the manifest runs hooks/title.js on Agent|Task', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
    const entries = manifest.hooks.PreToolUse.filter((e) => e.matcher === 'Agent|Task');
    assert.ok(entries.some((e) => e.hooks.some((h) => /hooks\/title\.js/.test(h.command))));
});
```

   The first test expects `sonnet · medium` because `agents/fankeel-reader.md` pins `model: sonnet` and `effort: medium`, and the fixture's project directory holds no subagent transcript, so no version.
2. Run `node --test tests/title-hook.test.js` and watch it fail: the hook file does not exist.
3. Write the implementation. In `hooks/title.js`:

```js
#!/usr/bin/env node
'use strict';

// PreToolUse on `Agent|Task`: opens the description with the model, its
// version and its effort, computed by lib/title.js. Measured 2026-09-29 on
// Claude Code 2.1.284: `updatedInput` with no `permissionDecision` is applied
// — the task list, the tool result and `agent-*.meta.json` carry the rewrite,
// the model's own tool_use keeps its original — so this never allows or
// denies; hooks/guard.js on the same matcher still can.

const os = require('node:os');
const path = require('node:path');
const { run, parse } = require('../lib/hook.js');
const { prefixFor, retitle } = require('../lib/title.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (payload.tool_name !== 'Agent' && payload.tool_name !== 'Task') return;
    const input = payload.tool_input;
    if (!input || typeof input.description !== 'string') return;
    const prefix = prefixFor({
        toolInput: input,
        pluginRoot: path.join(__dirname, '..'),
        projectDir: payload.cwd,
        configDir: process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
        transcriptPath: payload.transcript_path,
        env: process.env,
    });
    const description = retitle(input.description, prefix);
    if (description === input.description) return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, description } },
    }));
}

if (require.main === module) run(main);
module.exports = { main };
```

4. In `.claude-plugin/plugin.json`, in `hooks.PreToolUse`, directly after the existing `Agent|Task` entry that runs `hooks/guard.js`, add:

```json
{"matcher": "Agent|Task", "hooks": [{"type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/title.js\"", "timeout": 5, "statusMessage": "Writing the model, version and effort into the dispatch title..."}]}
```

5. Run `node --test tests/title-hook.test.js` and watch all four pass.
6. Mutation: add `permissionDecision: 'allow',` to the emitted object → the first test goes red. Revert.
7. Commit `feat: hooks/title.js — the hook writes the dispatch title prefix`.

## Task 3: the brief's rule — title only

**Files:**
- Modify: `lib/render.js:505-520` — the line at 516
- Modify: `agents/fankeel-brain.md` — the sentence at 36-40
- Test: `tests/title-rule.test.js`

**Interfaces:**
- Consumes: none — `lib/render.js` requires `lib/usage.js`, and Task 5 adds row fields there without changing any export
- Produces: none

**Dispatch:** implementer, sonnet — two text edits and a text test.

1. Write the failing test. In `tests/title-rule.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

for (const file of ['lib/render.js', 'agents/fankeel-brain.md']) {
    test(file + ' tells a dispatcher to write the title only; the hook adds the prefix', () => {
        const text = read(file);
        assert.doesNotMatch(text, /<alias> <version>/);
        assert.doesNotMatch(text, /environment block/);
        assert.match(text, /hooks\/title\.js/);
    });
}
```

2. Run `node --test tests/title-rule.test.js` and watch both fail.
3. In `lib/render.js`, replace the line at 516 (`lines.push('  - Open every dispatch\'s ...`) with:

```js
    lines.push('  - Write each dispatch\'s `description` as its title only: hooks/title.js adds the model, version and effort.');
```

4. In `agents/fankeel-brain.md`, replace the sentence beginning `Open every dispatch's own` through `for its own dispatches.` with:

```md
Write every dispatch's `description` as its title alone —
`hooks/title.js` opens it with the model, its version and its effort, read
off the agent file and real transcripts, the same for the plain session's
dispatches.
```

5. Run `node --test tests/title-rule.test.js` and watch both pass; then `node --test tests/render*.test.js tests/budget*.test.js` for the block cap.
6. Mutation: restore the old line 516 → the `lib/render.js` test goes red. Revert.
7. Commit `fix: the brief says title only — the hook writes the prefix`.

## Task 4: the skill and the reference say the same

**Files:**
- Modify: `skills/fankeel/SKILL.md:1060-1085` — the bullet at 1068-1081
- Modify: `docs/90-agent/reference/subagents.md:255-280` — the clause at 266-271
- Test: `tests/title-docs.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two prose edits and a text test.

1. Write the failing test. In `tests/title-docs.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

for (const file of ['skills/fankeel/SKILL.md', 'docs/90-agent/reference/subagents.md']) {
    test(file + ' says the hook writes the prefix, with no version to infer', () => {
        const text = read(file);
        assert.doesNotMatch(text, /sonnet 5 ·/);
        assert.doesNotMatch(text, /environment block/);
        assert.match(text, /hooks\/title\.js/);
    });
}
```

2. Run `node --test tests/title-docs.test.js` and watch both fail.
3. In `skills/fankeel/SKILL.md`, replace the bullet beginning `- **Open the \`description\` with the model` through `2026-09-24.` with:

```md
- **Write the `description` as the title alone** — `survey stage agent`,
  `write plan`. `hooks/title.js` opens it with `<alias> <version> · <effort>`
  before the dispatch runs: the model from the call's `model`, else the agent
  file's `model:`, else the session's; the version off the newest real
  `message.model` in this project's subagent transcripts, left out when there
  is none; the effort off the agent file's `effort:`, else `inherit`. The
  description is the title a background agent runs under, and the one place
  the user sees what is spending while it runs — so it is computed, never
  written: on 2026-09-29 three titles read `sonnet 5` for agents that ran
  claude-sonnet-5-5. A Workflow `agent()` call's `label` has no hook: open it
  with the alias and the effort, never a version.
```

4. In `docs/90-agent/reference/subagents.md`, replace the clause beginning `the **description must open with the model, its version` through `what is spending while it runs;` with:

```md
the **description is the title alone**, and `hooks/title.js` opens it with
the model, the version read off the newest real `message.model` in the
project's subagent transcripts and the effort off the agent file's `effort:`
or `inherit`, because it is the title a background agent runs under and the
one place the user sees what is spending while it runs — computed, since a
version the model inferred read `sonnet 5` for claude-sonnet-5-5 on
2026-09-29;
```

5. Run `node --test tests/title-docs.test.js` and watch both pass; run `node scripts/stage-registry.js` if `tests/` reports `skills/registry.json` stale, and `node scripts/docs-check.js`.
6. Mutation: put `sonnet 5 · medium` back into the SKILL.md bullet → its test goes red. Revert.
7. Commit `docs: the skill and subagents.md — the hook writes the title prefix`.

## Task 5: the station shows what each agent actually ran

**Files:**
- Modify: `lib/usage.js` — `runningAgents()` rows gain `ranModel` and `effort`
- Modify: `assets/station/station.js:1505-1535` — `liveSubsHtml()` chip
- Read: `lib/context.js` — `readTail`
- Test: `tests/station-subagents.test.js`
- Test: `tests/station-waiting.test.js`

**Interfaces:**
- Consumes: none
- Produces: each `runningAgents()` row carries `ranModel: string|null` (the last assistant `message.model`) and `effort: string|null` (that line's top-level `effort`)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/station-subagents.test.js`, change the `said` helper so its line carries `effort: 'medium'` at the top level beside `timestamp`, then add:

```js
test('a running agent row carries the model and effort its transcript last ran', () => {
    const dir = tmp('sa-ran-');
    seed(dir);
    const rows = usage.runningAgents(dir, Date.now());
    const reader = rows.find((r) => r.id === 'a0000000000000001');
    assert.equal(reader.ranModel, 'claude-sonnet-5');
    assert.equal(reader.effort, 'medium');
});

test('the row reads the last assistant line, not the first', () => {
    const dir = tmp('sa-ran2-');
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const later = line({ type: 'assistant', isSidechain: true, timestamp: at(), effort: 'high',
        message: { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'u2', name: 'Bash', input: { command: 'y' } }] } });
    agent(sub, 'a0000000000000009', { agentType: 'general-purpose', description: 'two turns' }, onTool + back + later);
    const row = usage.runningAgents(dir, Date.now()).find((r) => r.id === 'a0000000000000009');
    assert.equal(row.ranModel, 'claude-sonnet-5-5');
    assert.equal(row.effort, 'high');
});
```

   In `tests/station-waiting.test.js`, give `RUN.subagents[2]` (`a3`) `ranModel: 'claude-sonnet-5-5', effort: 'medium'` and change the last `assert.ok` of the first test to expect:

```js
    assert.ok(html.includes('<i class="sw" style="background:var(--m-sonnet)"></i>Sonnet 5.5 · medium</span>'
        + '<span class="sa-desc" title="sonnet 5 · inherit: station data-side facts">station data-side facts</span><span class="sa-for">3m</span>'), html);
```

2. Run `node --test tests/station-subagents.test.js tests/station-waiting.test.js` and watch the two new expectations fail.
3. In `lib/usage.js`, below `answered()`, add:

```js
// The last assistant line in the tail, for what the agent actually ran: its
// `message.model` and the top-level `effort` Claude Code stamps on each line.
function lastAssistant(file) {
    const text = readTail(file, AGENT_TAIL);
    if (!text) return null;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        let e;
        try {
            e = JSON.parse(lines[i]);
        } catch (err) {
            continue;
        }
        if (e && e.type === 'assistant' && e.message) return e;
    }
    return null;
}
```

   and in `lib/usage.js`, in `runningAgents()`, in the object pushed to `out`, after `model:`, add:

```js
            ranModel: (ran && typeof ran.message.model === 'string') ? ran.message.model : null,
            effort: (ran && typeof ran.effort === 'string') ? ran.effort : null,
```

   with `const ran = moved === null ? null : lastAssistant(file);` on the line before `out.push(`.
4. In `assets/station/station.js`, in `liveSubsHtml()`, replace the chip line `+ '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>' + fam + '</span>'` with:

```js
                    + '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>'
                    + (a.ranModel && modelKey(a.ranModel) !== 'other' ? esc(modelLabel(modelKey(a.ranModel))) : fam)
                    + (a.effort ? ' · ' + esc(a.effort) : '') + '</span>'
```

   and in `saFamily(a, s)` make the first check `family(a.ranModel)` when it is not `'other'`.
5. Run both test files and watch them pass; run `node --test tests/station*.test.js`.
6. Mutation: in `lastAssistant` iterate forward (`for (let i = 0; i < lines.length; i++)`) → "the row reads the last assistant line" goes red (it gets `claude-sonnet-5`). Revert.
7. Commit `feat: station — each live subagent shows the model and effort it ran`.

## Task 6: the probe report and the model-choice ruling

**Files:**
- Modify: `docs/90-agent/reports/2026-09-29-title-probe.md` — new report
- Modify: `docs/90-agent/reference/sources.md` — one row `TITLE-PROBE-260929`
- Modify: `docs/90-agent/reference/model-choice.md` — (c) settled
- Test: none — `node scripts/docs-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — prose from the measured facts below.

1. Write `docs/90-agent/reports/2026-09-29-title-probe.md` with the frontmatter keys `docs/90-agent/reports/2026-09-28-subagent-hook-probe.md` opens with (`status: current`, `last_verified: 2026-09-29`, `source_of_truth:` naming the two probe runs), and in its body: two headless `claude -p` runs on Claude Code 2.1.284 with a one-off PreToolUse(`Agent|Task`) hook returning `updatedInput.description = 'REWRITTEN ' + original`, the first with `permissionDecision: 'allow'`, the second with none. Both: the model's tool_use kept `orig-title`; `background_tasks_changed`, `task_started`, the tool result and `agent-*.meta.json` carried `REWRITTEN orig-title`. n=1 each. Not measured: what the interactive transcript row shows. Also: every subagent transcript line carries a top-level `"effort"`.
2. Add the `TITLE-PROBE-260929` row to `docs/90-agent/reference/sources.md` in the table's shape, citing `hooks/title.js` and `docs/90-agent/reference/subagents.md`.
3. In `docs/90-agent/reference/model-choice.md`, rewrite item **c** to: settled 09-29 — Claude Code's model-config documents medium as the default effort of Sonnet 5.5 and Opus 5.5, and the agent files keep the `effort:` they pin; raising one role's effort for a single task needs an override file outside the plugin cache, tracked in TODO `station-3`. Update the "Constraint on c" paragraph's last sentence to point there.
4. Run `node scripts/docs-check.js` — clean.
5. Commit `docs: the title probe report and model-choice (c) settled`.

## Task 7: TODO — (c) closed, the override its own entry

**Files:**
- Modify: `docs/90-agent/todo/model-1.md` — drop (c)
- Modify: `docs/90-agent/todo/station-3.md` — rewritten as the override entry
- Test: none — `node scripts/todo-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two frontmatter edits and a generator run.

1. In `docs/90-agent/todo/model-1.md`, set `title: 暫不用 haiku 後一件未決` and `description:` to `09-29 已決定暫不用 \`haiku\`，(c) 預設 effort 已定案（官方 medium），剩 (a) profile key 蓋掉 agent 釘的模型 — [model-choice.md](docs/90-agent/reference/model-choice.md).`
2. In `docs/90-agent/todo/station-3.md`, set `title: 單次任務臨時拉高 effort` and `description:` to `Agent 工具設不了 effort、改插件快取會被更新蓋掉：要從 profile 產生 \`.claude/agents/\` 覆寫檔，先實測同名檔能否蓋過 \`fankeel:\` 的 agent，guard／brief 要認得新名稱 — [model-choice.md](docs/90-agent/reference/model-choice.md).`; keep `state: ready`.
3. Run `node scripts/todo.js index`, then `node scripts/todo-check.js` — clean.
4. Commit `docs: TODO — (c) settled, the effort override its own entry`.

## Task 8: live dispatch — the title on screen against the transcript

**Files:**
- Modify: `docs/90-agent/reports/2026-09-29-title-probe.md` — a `## Live` section with the two rows
- Read: `hooks/title.js` — the hook that has to be live
- Test: none — the evidence is the report's table

**Interfaces:**
- Consumes: `hooks/title.js` from Task 2, installed
- Produces: none

**Dispatch:** user — a hook on disk runs only in a process started after the plugin is reinstalled from the local directory, and what the interactive row shows needs a person's screen; no subagent can open a terminal.

1. In a new terminal, reinstall fankeel from `F:/ymlab/fankeel` and start `claude`.
2. Ask it to dispatch one `fankeel:fankeel-reader` and one `general-purpose`, each with a description that is a title only.
3. The user reads, for each: the Agent row in the transcript view and the background task list. Screenshot both.
4. For each agent, from `~/.claude/projects/F--ymlab-fankeel/<session>/subagents/`: `meta.json`'s `description`, and the last assistant line's `message.model` and `effort`.
5. Append `## Live` to the report: one row per agent — shown on the row, shown in the task list, `meta.json` description, `message.model`, `effort` — and whether the prefix equals `parseModel(message.model)` plus the effort. Commit `docs: title probe — the live dispatch`.

## After build

Not tasks, and not skipped: verify runs `npm test` whole and `node scripts/docs-check.js` at the merged sha; land runs `node scripts/version.js 0.84.0` only once session 7a23b26a (promo30) is stood down — `node scripts/task.js show --all` says so.

## Coverage

| promise | task |
|---|---|
| 模型別名依序取：`tool_input.model`；`subagent_type` 對到的 agent 檔 frontmatter `model:` | Task 1 |
| 版本不猜：從 model id 用一條通用規則解析 `claude-<family>-<major>[-<minor>]` | Task 1 |
| effort 取 agent 檔的 `effort:`，沒有就寫 `inherit`。 | Task 1 |
| 前綴格式 `<alias>[ <version>] · <effort>`，接在標題前面，以 `: ` 分隔。 | Task 1 |
| 新的 PreToolUse hook，matcher `Agent|Task`，與 `hooks/guard.js` 並列。 | Task 2 |
| 用 `updatedInput` 把 description 換成「前綴: 標題」。description 開頭已經是前綴形狀的 | Task 2 |
| 內建 general-purpose/Explore/空 type 與找不到檔的裸名稱照常印 inherit 標題；只有非 fankeel: 的外掛 type、以及解析到但讀不了的 agent 檔不輸出（hook 不改 description）；hook 絕不擋派工。 | Task 2 |
| `lib/render.js:516` 改成更短的一句：description 只寫標題，模型、版本、effort 由 hook 補。 | Task 3 |
| 同步 `agents/fankeel-brain.md:37`、`skills/fankeel/SKILL.md:1069`、 | Task 3, Task 4 |
| Workflow `agent()` 的 `label` 沒有 hook 能補：規則改成只寫別名和 effort，不寫版本。 | Task 4 |
| `lib/usage.js` 的 subagent 列（今天取 meta 的 `model` 別名）加上該 agent transcript 最後一筆 | Task 5 |
| station 的 subagent 列，模型 chip 顯示 `sonnet 5.5`（用第 1 節同一個解析規則），旁邊加 effort； | Task 5 |
| `docs/90-agent/reference/model-choice.md` 的 (c) 記為定案：依官方文件，Sonnet 5.5 與 Opus 5.5 | Task 6 |
| TODO `model-1` 拿掉 (c)；`station-3` 改寫成新的一筆：臨時拉高 effort 要產生到 `.claude/agents/` | Task 7 |
