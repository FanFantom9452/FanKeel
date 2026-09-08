---
status: design-intent
last_verified: 2026-09-08
source_of_truth: docs/plans/2026-09-08-behaviour-eval-design.md
---

# Behaviour Eval Implementation Plan

**Goal:** one eval case that asks whether a model in fankeel mode gives a typo
fix the two-stage route, runnable today with `claude -p` and unchanged when
`claude plugin eval` is enabled.

**Architecture:** `evals/route-typo/` holds the case in the official layout
(`case.yaml`, `prompt.md`, `graders/*.md`). `lib/eval.js` parses those files,
extracts tool calls and the last message out of a `--output-format stream-json`
transcript, and grades `tool_used` and `regex` graders as pure functions.
`scripts/eval.js` is the CLI around it: scaffold a temp repo, run `claude -p`
with only this plugin loaded, grade, print, exit.

**Tech Stack:** Node v24.9.0, `node --test`, no dependencies (`package.json`
declares none and may not gain any). Claude Code CLI 2.1.263: `claude -p`
reading the prompt from stdin, `--output-format stream-json --verbose`,
`--setting-sources project` (loads no user plugins), `--plugin-dir <repo>`
(loads the tree, not the installed cache), `--allowedTools`, `--max-turns`,
`--model`. Git Bash for `scaffold_script`.

**Spec:** [2026-09-08-behaviour-eval-design.md](2026-09-08-behaviour-eval-design.md)

## Global Constraints

- No dependencies: `package.json` has no `dependencies` and none may be added.
- Line endings LF: `.gitattributes` is `* text=auto eol=lf`. Write files with
  `\n`; never let a tool write CRLF.
- `tests/source.test.js:92` — every name in a `module.exports = { … }` block
  outside `tests/` must be imported by some tracked file. Export nothing a
  script or test does not import.
- `tests/source.test.js:135` — a frontmatter key other than `status`,
  `last_verified`, `source_of_truth` may not hold a bare word that resolves to
  a repository path. Grader keys hold regexes and tool names; `prompt.md`
  must not name `README.md` bare in a frontmatter key.
- `tests/source.test.js:26` — no NUL byte in any source file.
- Scratch directories in tests come from `tests/tmp.js` — `tmp(prefix)` returns
  a `mkdtempSync` path removed at process exit. Scripts must not require
  `tests/`; `scripts/eval.js` uses `fs.mkdtempSync` and `fs.rmSync` itself.
- Frontmatter: `lib/docs.js:316` `frontmatter(text)` returns `{ key: value }`
  with keys lowercased and surrounding quotes stripped, or `null`. It is not
  exported today; Task 1 exports it and imports it, which satisfies the
  orphan-export test.
- CLI argument parsing follows `scripts/docs-check.js`: `node:util`
  `parseArgs` with `strict: false, allowPositionals: true`; `main(argv)`
  returns an exit code and `if (require.main === module) process.exit(code)`.
- `.fankeel/docs.json` files every markdown directory; a markdown file in no
  bucket is reported by `docs-check`. `evals/` gets a bucket (Task 2).
- Measured 2026-09-08 (`.fankeel/build/eval-probe/probe2.jsonl`): under
  `claude -p … --plugin-dir F:/ymlab/fankeel`, `hooks/inject.js` fires on a
  `/fankeel …` prompt and the model can quote the injected `init rules:` block
  verbatim; the `UserPromptSubmit` hook does not appear as a `system` event
  in the stream, only `SessionStart` does. Do not grade on hook events.
- Measured 2026-09-08 (`probe.jsonl`): without `--setting-sources project`
  the user's other plugins load too, and haiku took `caveman:surgical-patch`
  instead of fankeel. Isolation is `--setting-sources project`, always.
- Stream shape (`probe.jsonl`): one JSON object per line; a tool call is
  `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{…}}]}}`;
  the end is `{"type":"result","subtype":"success","result":"<text>","num_turns":8}`.

## File structure

| file | responsibility |
|---|---|
| `evals/route-typo/case.yaml` | the scaffold: a one-file git repo with `teh` on README line 1 |
| `evals/route-typo/prompt.md` | run settings and the `/fankeel …` prompt |
| `evals/route-typo/graders/starts-with-short-route.md` | `tool_used`: a `task.js start` carrying `--route build,verify` |
| `evals/route-typo/graders/no-other-route.md` | `tool_used`, `max: 0`: no `task.js start` without it |
| `evals/route-typo/graders/says-it-out-loud.md` | `regex` on the last message: the route is said |
| `lib/eval.js` | `parseCase`, `toolCalls`, `lastMessage`, `grade`, `listValue` — pure |
| `scripts/eval.js` | CLI: temp dir, scaffold, `claude -p`, grade, print, `--json`, exit |
| `tests/eval.test.js` | fixtures for the pure functions, the real case dir, the CLI's two cheap paths |
| `.fankeel/docs.json` | one more bucket: `evals` as `reference` |
| `README.md`, `docs/README.md`, `TODO.md` | one section, one index row, one entry closed and one deferred |

## Ordering

Task 1 first: Tasks 2 and 3 consume its exports and all three write
`tests/eval.test.js`. Task 4 last.

## Task 1: the pure functions

**Files:**
- Modify: `lib/docs.js` — add `frontmatter` to `module.exports`
- Modify: `lib/eval.js` — new: `parseCase`, `listValue`, `toolCalls`, `lastMessage`, `grade`
- Read: `lib/docs.js` — `frontmatter(text)` at line 316, the reader to reuse
- Read: `tests/tmp.js` — `tmp(prefix)`, the scratch directory the tests use
- Test: `tests/eval.test.js`

**Interfaces:**
- Consumes: `frontmatter(text) → { [key: string]: string } | null` from `lib/docs.js`
- Produces:
  - `parseCase(dir: string) → { name, dir, prompt: { meta, body }, scaffold: string | null, graders: [{ name, meta, body }] }` — `meta` is the frontmatter object; `scaffold` is `context.scaffold_script` read out of `case.yaml` by the two-line YAML reader below, `null` when absent
  - `listValue(v: string | undefined) → string[]` — `"[Read, Edit]"` → `['Read','Edit']`; `""`/`undefined` → `[]`
  - `toolCalls(lines: string[]) → [{ name: string, input: object }]` — every `tool_use` block, in order
  - `lastMessage(lines: string[]) → string` — the `result` object's `result` when present, else the last assistant `text` block, else `''`
  - `grade(grader: { name, meta, body }, run: { calls, last }) → { name, type, pass: boolean | null, detail: string }`

- [ ] **Step 1: the failing tests**

In `tests/eval.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

// The shape `claude -p --output-format stream-json --verbose` printed on
// 2026-09-08 (.fankeel/build/eval-probe/probe.jsonl): one object per line.
const call = (name, input) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
const text = (t) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } });
const result = (t) => JSON.stringify({ type: 'result', subtype: 'success', result: t, num_turns: 3 });

const START_SHORT = call('Bash', { command: 'node scripts/task.js start --session abc --task "fix typo" --route "build,verify"' });
const START_CLASS = call('Bash', { command: 'node scripts/task.js start --session abc --task "fix typo" --class bounded' });

const grader = (name, meta, body) => ({ name, meta, body: body || '' });
const SHORT = grader('starts-with-short-route', { type: 'tool_used', tool: 'Bash', input_match: 'task\\.js start\\b[^\\n]*--route\\W{1,4}build,verify', min: '1' });
const NO_OTHER = grader('no-other-route', { type: 'tool_used', tool: 'Bash', input_match: 'task\\.js start\\b(?![^\\n]*--route\\W{1,4}build,verify)', max: '0' });
const SAYS = grader('says-it-out-loud', { type: 'regex', target: 'last_message', pattern: 'build[,\\s→]+verify', flags: 'i', match: 'contains' });

test('toolCalls keeps every tool_use in order and skips what is not one', () => {
    const calls = ev.toolCalls([text('hi'), START_SHORT, 'not json', call('Read', { file_path: 'README.md' }), result('done')]);
    assert.deepEqual(calls.map((c) => c.name), ['Bash', 'Read']);
    assert.equal(calls[0].input.command.includes('--route "build,verify"'), true);
});

test('lastMessage prefers the result object and falls back to the last text block', () => {
    assert.equal(ev.lastMessage([text('a'), text('b'), result('final')]), 'final');
    assert.equal(ev.lastMessage([text('a'), text('b')]), 'b');
    assert.equal(ev.lastMessage([]), '');
});

test('tool_used passes on a matching call and fails on a bounded class', () => {
    const ok = { calls: ev.toolCalls([START_SHORT]), last: '' };
    const bad = { calls: ev.toolCalls([START_CLASS]), last: '' };
    assert.equal(ev.grade(SHORT, ok).pass, true);
    assert.equal(ev.grade(SHORT, bad).pass, false);
    assert.equal(ev.grade(NO_OTHER, ok).pass, true);
    assert.equal(ev.grade(NO_OTHER, bad).pass, false);
});

test('tool_used counts against min and max', () => {
    const twice = { calls: ev.toolCalls([START_SHORT, START_SHORT]), last: '' };
    assert.equal(ev.grade({ ...SHORT, meta: { ...SHORT.meta, max: '1' } }, twice).pass, false);
    assert.equal(ev.grade({ ...SHORT, meta: { ...SHORT.meta, min: '2' } }, twice).pass, true);
    assert.match(ev.grade(SHORT, { calls: [], last: '' }).detail, /0 of min 1/);
});

test('tool_used matches the input as JSON, so a quoted flag still matches', () => {
    // JSON.stringify turns --route "build,verify" into --route \"build,verify\";
    // \W{1,4} in the pattern is what lets the backslash and the quote through.
    const json = JSON.stringify(ev.toolCalls([START_SHORT])[0].input);
    assert.equal(json.includes('\\"build,verify\\"'), true);
    assert.equal(ev.grade(SHORT, { calls: ev.toolCalls([START_SHORT]), last: '' }).pass, true);
});

test('regex on last_message flips with contains and not_contains', () => {
    const said = { calls: [], last: 'class: bounded — route build → verify' };
    const silent = { calls: [], last: 'Fixed the typo.' };
    assert.equal(ev.grade(SAYS, said).pass, true);
    assert.equal(ev.grade(SAYS, silent).pass, false);
    const not = { ...SAYS, meta: { ...SAYS.meta, match: 'not_contains' } };
    assert.equal(ev.grade(not, said).pass, false);
    assert.equal(ev.grade(not, silent).pass, true);
});

test('an llm grader is skipped, not failed', () => {
    const g = ev.grade(grader('judge', { type: 'llm', focus: 'last_message' }, 'PASS if …'), { calls: [], last: 'x' });
    assert.equal(g.pass, null);
    assert.match(g.detail, /skipped/);
});

test('an unknown grader type is a failure that says so', () => {
    const g = ev.grade(grader('odd', { type: 'file_exists', path: '*.md' }), { calls: [], last: '' });
    assert.equal(g.pass, false);
    assert.match(g.detail, /file_exists/);
});

test('listValue reads a bracketed list and an empty value', () => {
    assert.deepEqual(ev.listValue('[Read, Edit, Bash]'), ['Read', 'Edit', 'Bash']);
    assert.deepEqual(ev.listValue('Read'), ['Read']);
    assert.deepEqual(ev.listValue(''), []);
    assert.deepEqual(ev.listValue(undefined), []);
});

test('parseCase reads a case directory written the official way', () => {
    const dir = tmp('fankeel-eval-');
    fs.mkdirSync(path.join(dir, 'graders'));
    fs.writeFileSync(path.join(dir, 'case.yaml'), 'schema_version: "1.1"\nname: sample\ncontext:\n  scaffold_script: "printf x > a.txt"\n');
    fs.writeFileSync(path.join(dir, 'prompt.md'), '---\nname: sample\nmax_turns: 4\nallowed_tools: [Read, Bash]\n---\n/fankeel do the thing\n');
    fs.writeFileSync(path.join(dir, 'graders', 'g.md'), '---\ntype: regex\ntarget: last_message\npattern: thing\n---\n');
    const c = ev.parseCase(dir);
    assert.equal(c.name, 'sample');
    assert.equal(c.prompt.body.trim(), '/fankeel do the thing');
    assert.equal(c.prompt.meta.max_turns, '4');
    assert.deepEqual(ev.listValue(c.prompt.meta.allowed_tools), ['Read', 'Bash']);
    assert.equal(c.scaffold, 'printf x > a.txt');
    assert.deepEqual(c.graders.map((g) => [g.name, g.meta.type]), [['g', 'regex']]);
});

test('parseCase without case.yaml has no scaffold, and without prompt.md throws', () => {
    const dir = tmp('fankeel-eval-');
    fs.mkdirSync(path.join(dir, 'graders'));
    fs.writeFileSync(path.join(dir, 'prompt.md'), '---\nname: bare\n---\nhello\n');
    assert.equal(ev.parseCase(dir).scaffold, null);
    const empty = tmp('fankeel-eval-');
    assert.throws(() => ev.parseCase(empty), /prompt\.md/);
});
```

- [ ] **Step 2: run it and watch it fail**

```
node --test tests/eval.test.js
```

Expected: every test fails with `Cannot find module '../lib/eval.js'`.

- [ ] **Step 3: export the reader**

In `lib/docs.js`, in the `module.exports = {` block at line 391, add
`frontmatter,` after `detect,`.

- [ ] **Step 4: the module**

In `lib/eval.js`:

```js
'use strict';
// One eval case, read and graded, with nothing that spends money in it.
//
// `evals/<case>/` is the layout `claude plugin eval` reads — case.yaml,
// prompt.md, graders/*.md — and this reads the same files so a case written
// for that runner needs no second copy to be run by scripts/eval.js. What it
// grades is a `--output-format stream-json` transcript: every tool call with
// its input, and the last message. `tool_used` and `regex` are enough for the
// one case that exists; `llm` needs a judge and is reported as skipped.

const fs = require('node:fs');
const path = require('node:path');
const { frontmatter } = require('./docs.js');

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?(?:\n|$)/;

// `[Read, Edit]`, `Read`, `` → an array. Enough YAML for a flow list.
function listValue(v) {
    const s = String(v == null ? '' : v).trim().replace(/^\[|\]$/g, '');
    return s.split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

// case.yaml holds one nested key worth reading: context.scaffold_script. A
// real YAML parser is a dependency, and the plugin has none.
function scaffoldOf(text) {
    const m = /^\s*scaffold_script\s*:\s*(.+)$/m.exec(String(text || ''));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
}

function readDoc(file) {
    const text = fs.readFileSync(file, 'utf8');
    return { meta: frontmatter(text) || {}, body: text.replace(FRONTMATTER, '') };
}

function parseCase(dir) {
    const promptFile = path.join(dir, 'prompt.md');
    if (!fs.existsSync(promptFile)) throw new Error('no prompt.md in ' + dir);
    const prompt = readDoc(promptFile);
    const yaml = path.join(dir, 'case.yaml');
    const scaffold = fs.existsSync(yaml) ? scaffoldOf(fs.readFileSync(yaml, 'utf8')) : null;
    const gdir = path.join(dir, 'graders');
    const graders = (fs.existsSync(gdir) ? fs.readdirSync(gdir) : [])
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => ({ name: f.replace(/\.md$/, ''), ...readDoc(path.join(gdir, f)) }));
    const name = prompt.meta.name || path.basename(dir);
    return { name, dir, prompt, scaffold, graders };
}

function parseLines(lines) {
    const out = [];
    for (const line of lines) {
        try { out.push(JSON.parse(line)); } catch (e) { /* a non-JSON line is noise, not a message */ }
    }
    return out;
}

function blocksOf(msg) {
    const c = msg && msg.message && msg.message.content;
    return Array.isArray(c) ? c : [];
}

function toolCalls(lines) {
    const calls = [];
    for (const msg of parseLines(lines)) {
        if (msg.type !== 'assistant') continue;
        for (const b of blocksOf(msg)) {
            if (b.type === 'tool_use') calls.push({ name: String(b.name || ''), input: b.input == null ? {} : b.input });
        }
    }
    return calls;
}

function lastMessage(lines) {
    const msgs = parseLines(lines);
    const res = msgs.find((m) => m.type === 'result');
    if (res && typeof res.result === 'string') return res.result;
    let last = '';
    for (const msg of msgs) {
        if (msg.type !== 'assistant') continue;
        for (const b of blocksOf(msg)) if (b.type === 'text' && typeof b.text === 'string') last = b.text;
    }
    return last;
}

function toolUsed(g, run) {
    const tool = String(g.meta.tool || '');
    const re = g.meta.input_match ? new RegExp(g.meta.input_match) : null;
    const hits = run.calls.filter((c) => c.name === tool && (!re || re.test(JSON.stringify(c.input)))).length;
    const min = g.meta.min == null ? 1 : Number(g.meta.min);
    const max = g.meta.max == null ? Infinity : Number(g.meta.max);
    const pass = hits >= min && hits <= max;
    const bound = hits < min ? hits + ' of min ' + min : hits > max ? hits + ' over max ' + max : hits + ' call' + (hits === 1 ? '' : 's');
    return { pass, detail: tool + (re ? ' matching ' + g.meta.input_match : '') + ': ' + bound };
}

function regex(g, run) {
    const target = g.meta.target || 'last_message';
    if (target !== 'last_message') return { pass: false, detail: 'regex target ' + target + ' is not supported here; only last_message' };
    const re = new RegExp(String(g.meta.pattern || ''), String(g.meta.flags || ''));
    const found = re.test(run.last);
    const want = (g.meta.match || 'contains') === 'not_contains' ? !found : found;
    return { pass: want, detail: (found ? 'found' : 'did not find') + ' /' + g.meta.pattern + '/ in the last message' };
}

function grade(g, run) {
    const type = String(g.meta.type || '');
    let r;
    if (type === 'tool_used') r = toolUsed(g, run);
    else if (type === 'regex') r = regex(g, run);
    else if (type === 'llm') r = { pass: null, detail: 'skipped: an llm grader needs claude plugin eval' };
    else r = { pass: false, detail: 'grader type ' + type + ' is not supported here' };
    return { name: g.name, type, pass: r.pass, detail: r.detail };
}

module.exports = { parseCase, listValue, toolCalls, lastMessage, grade };
```

- [ ] **Step 5: run it and watch it pass**

```
node --test tests/eval.test.js
```

Expected: `ℹ pass 11`, `ℹ fail 0`.

- [ ] **Step 6: commit**

```
git add lib/eval.js lib/docs.js tests/eval.test.js
git commit -m "feat: lib/eval.js grades a stream-json transcript" -m "- parseCase, toolCalls, lastMessage, grade — lib/eval.js" -m "- frontmatter exported — lib/docs.js"
```

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

## Task 2: the case

**Files:**
- Modify: `evals/route-typo/case.yaml` — new
- Modify: `evals/route-typo/prompt.md` — new
- Modify: `evals/route-typo/graders/starts-with-short-route.md` — new
- Modify: `evals/route-typo/graders/no-other-route.md` — new
- Modify: `evals/route-typo/graders/says-it-out-loud.md` — new
- Modify: `.fankeel/docs.json` — one bucket added
- Modify: `docs/README.md` — one row in `## Roles` naming the `evals` bucket (tests/docs.test.js:460 requires it)
- Read: `lib/eval.js` — `parseCase`, `listValue`
- Test: `tests/eval.test.js`

**Interfaces:**
- Consumes: `parseCase(dir)`, `listValue(v)` from `lib/eval.js` (Task 1)
- Produces: the case directory (the five files above) that Task 3's CLI runs and Task 4's README names

- [ ] **Step 1: the failing test**

Append to `tests/eval.test.js`:

```js
test('the shipped case reads back the way the design promised', () => {
    const c = ev.parseCase(path.join(__dirname, '..', 'evals', 'route-typo'));
    assert.equal(c.name, 'route-typo');
    assert.match(c.prompt.body.trim(), /^\/fankeel /);
    const tools = ev.listValue(c.prompt.meta.allowed_tools);
    assert.equal(tools.includes('AskUserQuestion'), false, 'headless has nobody to answer it');
    assert.equal(tools.includes('Bash'), true, 'task.js start runs through Bash');
    assert.match(c.scaffold, /teh/i);
    assert.deepEqual(c.graders.map((g) => [g.name, g.meta.type]), [
        ['no-other-route', 'tool_used'],
        ['says-it-out-loud', 'regex'],
        ['starts-with-short-route', 'tool_used'],
    ]);
    for (const g of c.graders) assert.doesNotThrow(() => new RegExp(g.meta.input_match || g.meta.pattern), g.name + ' regex compiles');
});
```

- [ ] **Step 2: run it and watch it fail**

```
node --test tests/eval.test.js
```

Expected: the new test fails with `no prompt.md in …evals/route-typo`.

- [ ] **Step 3: the files**

In `evals/route-typo/case.yaml`:

```yaml
schema_version: "1.1"
name: route-typo
context:
  scaffold_script: "printf 'Teh keel of a project.\\n' > README.md && git init -q && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm init"
```

In `evals/route-typo/prompt.md`:

```md
---
name: route-typo
description: A typo fix asked for through /fankeel takes the two-stage route, not seven
tags: [route, init]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Bash, Glob, Grep, Skill]
---
/fankeel 修 README.md 第一行的 typo：teh → the
```

In `evals/route-typo/graders/starts-with-short-route.md`:

```md
---
type: tool_used
tool: Bash
input_match: task\.js start\b[^\n]*--route\W{1,4}build,verify
min: 1
---
The fankeel skill says a typo fix is `build,verify`. The input is matched as
JSON, so `\W{1,4}` lets a space, a quote and its escaping backslash through.
```

In `evals/route-typo/graders/no-other-route.md`:

```md
---
type: tool_used
tool: Bash
input_match: task\.js start\b(?![^\n]*--route\W{1,4}build,verify)
min: 0
max: 0
---
A start with any other route or class — including one corrected afterwards —
is the seven-stage default this case exists to catch.
```

In `evals/route-typo/graders/says-it-out-loud.md`:

```md
---
type: regex
target: last_message
pattern: build[,\s→]+verify
flags: i
match: contains
---
The survey skill says the class is said out loud so it can be overridden.
```

In `.fankeel/docs.json`, after the `output-styles` bucket, add:

```json
    {
      "path": "evals",
      "role": "reference"
    },
```

- [ ] **Step 4: run it and watch it pass**

```
node --test tests/eval.test.js && node scripts/docs-check.js | grep -c "evals/" ; npm test 2>&1 | grep -E '^ℹ (pass|fail)'
```

Expected: the eval test passes; `docs-check` reports no line for `evals/`
(the bucket files them); the suite is green.

- [ ] **Step 5: commit**

```
git add evals .fankeel/docs.json tests/eval.test.js
git commit -m "feat: evals/route-typo — a typo fix takes build,verify" -m "- case.yaml, prompt.md, three graders — evals/route-typo" -m "- evals bucket — .fankeel/docs.json"
```

**Dispatch:** implementer, sonnet — the plan carries every file; transcription plus one test.

## Task 3: the runner

**Files:**
- Modify: `scripts/eval.js` — new
- Read: `lib/eval.js` — the five functions Task 1 exports
- Read: `scripts/docs-check.js` — `parseArgs` and the `main`/`require.main` shape to copy
- Read: `tests/tmp.js` — `tmp(prefix)`, the scratch directory the tests use
- Test: `tests/eval.test.js`

**Interfaces:**
- Consumes: `parseCase`, `listValue`, `toolCalls`, `lastMessage`, `grade` from `lib/eval.js`
- Produces: `main(argv) → number`, `parseArgs(argv) → { dir, model, runs, pluginDir, json, keepTemp, help }`, `usage() → string`, `runOnce(c, opts) → { graders, toolCalls, lastMessage, exit, error }`, `render(c, runs) → string`, `verdict(runs) → 0 | 1` — all six exported, and all six imported by the test by destructuring

- [ ] **Step 1: the failing tests**

Append to `tests/eval.test.js`:

```js
const { execFileSync, spawnSync } = require('node:child_process');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'eval.js');
// Destructured on purpose: tests/source.test.js credits an export as imported
// only when it sees `mod.name` or a destructuring require, and runOnce is the
// one name nothing here can call without spending money.
const { usage, parseArgs, runOnce, render, verdict, main } = require('../scripts/eval.js');

test('eval.js --help prints usage and exits 0', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
    assert.match(out, /eval\.js <case dir>/);
    assert.match(out, /--setting-sources project/);
    assert.match(usage(), /case dir/);
    assert.equal(main(['--help']), 0);
    assert.equal(typeof runOnce, 'function');
});

test('eval.js with no case dir, or a dir with no prompt.md, exits 1 and says why', () => {
    const none = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(none.status, 1);
    assert.match(none.stdout + none.stderr, /case dir/);
    const empty = spawnSync(process.execPath, [SCRIPT, tmp('fankeel-eval-')], { encoding: 'utf8' });
    assert.equal(empty.status, 1);
    assert.match(empty.stdout + empty.stderr, /prompt\.md/);
});

test('parseArgs defaults: plugin dir is the repository, one run, no json', () => {
    const a = parseArgs(['evals/route-typo']);
    assert.equal(a.dir, 'evals/route-typo');
    assert.equal(path.resolve(a.pluginDir), path.resolve(__dirname, '..'));
    assert.equal(a.runs, null);
    assert.equal(a.json, null);
    assert.equal(parseArgs(['x', '--runs', '2', '--model', 'haiku', '--json', 'o.json']).runs, 2);
});

test('render prints one line per grader per run and a score, and fails on any fail', () => {
    const c = { name: 'route-typo' };
    const runs = [{ graders: [
        { name: 'a', type: 'tool_used', pass: true, detail: 'Bash: 1 call' },
        { name: 'b', type: 'regex', pass: false, detail: 'did not find' },
        { name: 'c', type: 'llm', pass: null, detail: 'skipped: x' },
    ], toolCalls: 4, lastMessage: 'done', exit: 0, error: null }];
    const text = render(c, runs);
    assert.match(text, /route-typo run 1 a pass — Bash: 1 call/);
    assert.match(text, /route-typo run 1 b fail — did not find/);
    assert.match(text, /route-typo run 1 c skipped — skipped: x/);
    assert.match(text, /score 1\/2/);
    assert.equal(verdict(runs), 1);
    assert.equal(verdict([{ ...runs[0], graders: runs[0].graders.filter((g) => g.pass !== false) }]), 0);
    assert.equal(verdict([{ ...runs[0], graders: [], error: 'claude exited 1' }]), 1);
});
```

- [ ] **Step 2: run it and watch it fail**

```
node --test tests/eval.test.js
```

Expected: the four new tests fail — `Cannot find module '../scripts/eval.js'`.

- [ ] **Step 3: the script**

In `scripts/eval.js`:

```js
#!/usr/bin/env node
'use strict';
// Run one eval case with `claude -p`, today, on this tree.
//
//   node scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>] [--json <path>] [--keep-temp]
//
// `claude plugin eval` is the runner these case files are written for, and it
// is early access — on a machine where it answers "currently in early access"
// this is the runner that answers instead. Same files, fewer graders: it grades
// tool_used and regex, and reports an llm grader as skipped.
//
// Each run is one `claude -p` in a fresh temp directory with the case's
// scaffold_script applied, and with only this plugin loaded:
// --setting-sources project keeps the user's own plugins out (measured
// 2026-09-08: without it haiku took another plugin's skill), --plugin-dir
// loads the tree rather than the installed cache. The prompt goes in on stdin,
// which is what keeps a prompt with quotes and CJK out of a Windows shell line.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs: parseArgv } = require('node:util');
const ev = require('../lib/eval.js');

const ROOT = path.join(__dirname, '..');

function usage() {
    return [
        'usage: node scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>] [--json <path>] [--keep-temp]',
        '',
        '  runs claude -p once per run in a scaffolded temp directory, with only',
        '  --plugin-dir loaded (--setting-sources project), and grades the',
        '  stream-json transcript against <case dir>/graders/*.md.',
        '  --model defaults to sonnet; --runs to the case\'s `runs`, else 1;',
        '  --plugin-dir to this repository. Any failed grader exits 1.',
    ].join('\n');
}

function parseArgs(argv) {
    const { values, positionals } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: {
            model: { type: 'string' },
            runs: { type: 'string' },
            'plugin-dir': { type: 'string' },
            json: { type: 'string' },
            'keep-temp': { type: 'boolean' },
            help: { type: 'boolean' },
        },
    });
    return {
        dir: positionals[0] || null,
        model: typeof values.model === 'string' ? values.model : 'sonnet',
        runs: typeof values.runs === 'string' ? Number(values.runs) : null,
        pluginDir: typeof values['plugin-dir'] === 'string' ? values['plugin-dir'] : ROOT,
        json: typeof values.json === 'string' ? values.json : null,
        keepTemp: Boolean(values['keep-temp']),
        help: Boolean(values.help),
    };
}

function scaffold(dir, script) {
    if (!script) return null;
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8' });
    return r.status === 0 ? null : 'scaffold_script exited ' + r.status + ': ' + (r.stderr || '').trim();
}

function runOnce(c, opts) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-eval-'));
    const meta = c.prompt.meta;
    const out = { graders: [], toolCalls: 0, lastMessage: '', exit: null, error: null, dir };
    try {
        out.error = scaffold(dir, c.scaffold);
        if (out.error) return out;
        const args = ['-p', '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project',
            '--plugin-dir', opts.pluginDir, '--max-turns', String(meta.max_turns || 10), '--model', opts.model];
        const tools = ev.listValue(meta.allowed_tools);
        if (tools.length) args.push('--allowedTools', tools.join(','));
        const r = spawnSync('claude', args, {
            cwd: dir,
            input: c.prompt.body.trim(),
            encoding: 'utf8',
            timeout: Number(meta.timeout_seconds || 300) * 1000,
            maxBuffer: 64 * 1024 * 1024,
            shell: process.platform === 'win32',
        });
        out.exit = r.status;
        if (r.error) out.error = r.error.code === 'ETIMEDOUT' ? 'timed out after ' + (meta.timeout_seconds || 300) + 's' : String(r.error.message);
        else if (r.status !== 0) out.error = 'claude exited ' + r.status + ': ' + (r.stderr || '').trim().slice(0, 300);
        const lines = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
        out.raw = lines;
        const run = { calls: ev.toolCalls(lines), last: ev.lastMessage(lines) };
        out.toolCalls = run.calls.length;
        out.lastMessage = run.last;
        out.graders = c.graders.map((g) => ev.grade(g, run));
        return out;
    } finally {
        if (!opts.keepTemp) fs.rmSync(dir, { recursive: true, force: true });
    }
}

function render(c, runs) {
    const lines = [];
    let passed = 0;
    let graded = 0;
    runs.forEach((r, i) => {
        if (r.error) lines.push(c.name + ' run ' + (i + 1) + ' error — ' + r.error);
        for (const g of r.graders) {
            const word = g.pass === null ? 'skipped' : g.pass ? 'pass' : 'fail';
            lines.push(c.name + ' run ' + (i + 1) + ' ' + g.name + ' ' + word + ' — ' + g.detail);
            if (g.pass !== null) graded += 1;
            if (g.pass === true) passed += 1;
        }
    });
    lines.push('score ' + passed + '/' + graded);
    return lines.join('\n');
}

function verdict(runs) {
    for (const r of runs) {
        if (r.error) return 1;
        if (r.graders.some((g) => g.pass === false)) return 1;
    }
    return 0;
}

function main(argv) {
    const a = parseArgs(argv);
    if (a.help) { console.log(usage()); return 0; }
    if (!a.dir) { console.error('eval.js: a case dir is required\n' + usage()); return 1; }
    let c;
    try { c = ev.parseCase(path.resolve(a.dir)); } catch (e) { console.error('eval.js: ' + e.message); return 1; }
    const n = a.runs || Number(c.prompt.meta.runs || 1);
    const runs = [];
    for (let i = 0; i < n; i += 1) runs.push(runOnce(c, a));
    console.log(render(c, runs));
    if (a.json) {
        const doc = { case: c.name, model: a.model, pluginDir: a.pluginDir, runs: runs.map((r) => ({ graders: r.graders, toolCalls: r.toolCalls, lastMessage: r.lastMessage, exit: r.exit, error: r.error, raw: r.raw || [] })) };
        fs.writeFileSync(a.json, JSON.stringify(doc, null, 2) + '\n');
    }
    return verdict(runs);
}

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}

module.exports = { usage, parseArgs, runOnce, render, verdict, main };
```

- [ ] **Step 4: run it and watch it pass**

```
node --test tests/eval.test.js && npm test 2>&1 | grep -E '^ℹ (pass|fail)'
```

Expected: `ℹ fail 0`. `tests/source.test.js` is what checks that `runOnce`
and the rest are imported by something — the test file imports the module,
so the export block is covered.

Do not run `node scripts/eval.js evals/route-typo` in this task: that spends a
sonnet session and is `verify`'s one measured run.

- [ ] **Step 5: commit**

```
git add scripts/eval.js tests/eval.test.js
git commit -m "feat: scripts/eval.js runs a case with claude -p" -m "- runOnce, render, verdict, main — scripts/eval.js" -m "- --help, no case dir, parseArgs defaults, render — tests/eval.test.js"
```

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

## Task 4: the documents

**Files:**
- Modify: `README.md` — a subsection under `## Development`
- Modify: `docs/README.md` — one index row
- Modify: `TODO.md` — close the eval entry; add the CI entry under `## Waiting`
- Read: `scripts/todo-check.js` — the cap and the `lifts when:` rule it enforces
- Test: none — `node scripts/todo-check.js` and `node scripts/docs-check.js` are the checks

**Interfaces:**
- Consumes: the case name `evals/route-typo` and the CLI `scripts/eval.js` from Tasks 2 and 3
- Produces: none

- [ ] **Step 1: README**

In `README.md`, at the end of `## Development`, add:

```md
### Behaviour evals

`evals/<case>/` holds cases in the layout `claude plugin eval` reads. That
command is early access — run it in an empty directory: "currently in early
access" means not enabled here, "No eval cases found" means it is. Either way
the same case runs today on this tree:

    node scripts/eval.js evals/route-typo --model sonnet

One `claude -p` per run, in a scaffolded temp repository with only this plugin
loaded (`--setting-sources project --plugin-dir .`), graded against
`graders/*.md`; `tool_used` and `regex` are graded, `llm` is reported as
skipped. Any failed grader exits 1. With early access:

    claude plugin eval . --json results.json --threshold 0.7 --model claude-sonnet-5 --no-publish
```

- [ ] **Step 2: the index**

In `docs/README.md`, in the `| I want to know | Page |` table, add a row:

```md
| How to run the behaviour eval, and what to do when `claude plugin eval` says early access | [../README.md](../README.md) — *Behaviour evals* |
```

- [ ] **Step 3: the backlog**

In `TODO.md`, remove the `## Needs a decision` bullet beginning `- 行為 eval：`
and add under its `## Waiting` heading:

```md
- eval 進 CI：`.github/workflows` 一條，push main 且限 skills/、evals/、manifest；本機 `claude plugin eval` 回 early access，一條永遠紅的 workflow 是噪音 — [README.md](README.md). lifts when: 本機 `claude plugin eval` 不再回 early access. 09-08.
```

- [ ] **Step 4: the checks**

```
node scripts/todo-check.js && node scripts/docs-check.js; npm test 2>&1 | grep -E '^ℹ (pass|fail)'
```

Expected: `todo-check` exit 0 with one fewer `needs a decision` and one more
`waiting`; `docs-check` shows no new line naming README.md, docs/README.md or
evals/; the suite is green.

- [ ] **Step 5: commit**

```
git add README.md docs/README.md TODO.md
git commit -m "docs: how to run the behaviour eval" -m "- Behaviour evals subsection — README.md" -m "- index row — docs/README.md" -m "- eval entry closed, CI entry under Waiting — TODO.md"
```

**Dispatch:** in-session — three files, one paragraph each, and the TODO.md wording is a judgement about what the entry is still short of.

## Coverage

| promise | task |
|---|---|
| `case.yaml`：`schema_version: "1.1"`、`name: route-typo`、`context.scaffold_script` 建一個一檔的 git repo | Task 2 |
| `prompt.md` frontmatter：`name`、`tags: [route, init]`、`runs: 1`、`max_turns: 12`、`timeout_seconds: 300`、`allowed_tools` … 沒有 AskUserQuestion | Task 2 |
| `prompt.md` body：`/fankeel 修 README.md 第一行的 typo：teh → the` | Task 2 |
| `graders/starts-with-short-route.md`：`type: tool_used`、`tool: Bash`、`input_match` … `min: 1` | Task 2 |
| `graders/no-other-route.md`：`type: tool_used` … `max: 0` | Task 2 |
| `graders/says-it-out-loud.md`：`type: regex`、`target: last_message`、`pattern: build[,\s→]+verify` | Task 2 |
| `lib/eval.js` 是純函式，照 `lib/docs.js` / `scripts/docs-check.js` 的分法：`parseCase`、`toolCalls`、`lastMessage`、`grade` | Task 1 |
| `scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>] [--json <path>]`：每個 run 建 temp dir、跑 scaffold_script、以 `claude -p` … 跑 | Task 3 |
| 輸出一行一個 grader：`<case> run <i> <grader> pass\|fail\|skipped — <detail>`，最後一行 `score <passed>/<graded>`；任何 `fail` 就 exit 1 | Task 3 |
| temp dir 用 `tests/tmp.js` 的 helper | struck — `scripts/` must not require `tests/`; `runOnce` uses `mkdtempSync` and `rmSync`, and `--keep-temp` keeps the directory for reading |
| `parseCase` 對 `evals/route-typo/` 真檔：三個 grader 的 type 與鍵讀得出來 | Task 2 |
| `grade` 對 fixture transcript（手寫的 stream-json 幾行）：紅綠各一 | Task 1 |
| `scripts/eval.js --help` 印用法 exit 0；沒有 case dir 時 exit 1 並說原因 | Task 3 |
| `README.md ## Development` 加一小節：兩種跑法各一行命令，early access 的自檢法 | Task 4 |
| `docs/README.md` 索引加一列指到那一節。 | Task 4 |
| `docs/improvement-brief.md:306` 那格「行為層：無」不改正文 | struck — no task edits it; the audit stage decides on an annotation |
| `TODO.md`：關掉 Needs a decision 的 eval 條目；`## Waiting` 加 CI workflow 一條 | Task 4 |
| `npm test` 綠，含 `tests/eval.test.js` 的紅綠對 | Task 1 |
| `node scripts/eval.js evals/route-typo --model claude-sonnet-5` 在 verify 跑一次 … 存到 `docs/reports/evidence/2026-09-08-route-typo/` | verify stage — no build task; Task 3 says so |
