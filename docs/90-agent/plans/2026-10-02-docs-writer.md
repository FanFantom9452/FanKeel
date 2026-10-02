---
status: design-intent
---

# Dedicated agents per kind of write, and per-task effort — Implementation Plan

**Goal:** build, verify, audit and land send a dedicated plugin agent for each kind of write — `fankeel-writer`, `fankeel-implementer` (with `-high` and `-xhigh` effort variants), `fankeel-mutator`, `fankeel-mover` — instead of `general-purpose`, survey and design record what they read in `context.md`, and a plan's `**Dispatch:**` line can name an implementer's effort.
**Architecture:** four new agent files carry each role's rules in their body, which is the only text a dispatched agent always receives. Per-task effort, folded in by the user at the design gate: `lib/agentfile.js` gains `renderVariant`, `scripts/variants.js` writes `agents/fankeel-implementer-high.md` and `-xhigh.md` from the base file and they ship as plugin agents; `lib/plantasks.js` reads a third field `implementer, <model>, <effort>` and `lint` refuses an effort with no variant; the dispatcher sends `fankeel:fankeel-implementer-<effort>`. That replaces the design's sketch of `hooks/title.js` rewriting `subagent_type`: a main-session build dispatches with the brief's path, not the task text, so the hook would have no Dispatch line to read, and a variant generated mid-session was never measured to resolve (`docs/90-agent/todo/station-6.md` measured only files written before the session). `hooks/title.js` needs no change — it already titles `fankeel:<name>` from the plugin file (`lib/title.js:90`); Task 4 proves it for a variant. The briefs switch last (Task 8), and Task 9 relaunches so the new agents load.
**Tech Stack:** Node.js built-ins only, `node --test`; no dependencies (`package.json` has none).
**Spec:** [2026-10-02-docs-writer-design.md](2026-10-02-docs-writer-design.md)

## Global Constraints

- No dependencies may be added: `package.json` lists none; `npm test` is `node --test`.
- No `CLAUDE.md` at the repository root; conventions come from the code: `'use strict';` first line, 4-space indentation in `lib/`, `scripts/`, `tests/agents.test.js`, `tests/agentfile.test.js`, `tests/title.test.js`, `tests/init-docs.test.js`; 2-space in `tests/brief.test.js`, `tests/skills.test.js` and `tests/plantasks-*.test.js` (match the file you edit).
- `.gitattributes` is `* text=auto eol=lf`: write LF.
- `agents/` and `skills/` are filed as reference pages (`.fankeel/map.md`, filing): every agent file's frontmatter carries `status: current`, `last_verified: 2026-10-02` and a `source_of_truth:` naming files that exist.
- No shipped file under `lib`, `scripts`, `hooks`, `agents`, `skills`, `assets`, `.claude-plugin` may contain the word "ponytail" in any case (`tests/source.test.js:220`).
- Every agent names an `effort:` and none is `max` (`tests/agents.test.js:228-240`); `.claude-plugin/plugin.json`'s `agents` array equals `NAMES` in order (`tests/agents.test.js:61-66`) and `agents/` holds exactly those files.
- The stage rules in `lib/stages.js` `STAGES` are not edited: the whole injection is capped at 2400 (`tests/render.test.js`) and never raised. Only `STAGE_AGENTS` (`lib/stages.js:702-713`) changes.
- A brain brief stays under 10,000 characters (`tests/brief.test.js:536-538`).
- `lib/agentfile.js:50-64`, `:68-86`, `:75-79` and `:99-113` are cited by `docs/90-agent/reference/model-choice.md`: add code only after `refresh` (line 113), never above it.
- Test temp dirs come from `tests/tmp.js` (`const tmp = require('./tmp.js'); tmp(prefix)`).
- An implementer runs only its own test command, never the full suite; the parent runs `node --test` before committing. The implementer runs no `git` write command.

## Risks

- A plugin agent loads at startup, so the session running this build has none of the new agents; a brief naming them makes a dispatch fail — Task 8 — it is the last dispatched task, the only one that changes what a brief tells a brain to send; until then a brief still says `general-purpose`, and the brain's rule "where the brief and the skill disagree, the brief wins" covers the skill and agent-file edits of Tasks 5 and 6. Task 9 relaunches before build's gate.
- The build brain brief grows by about 150 characters — Task 8 — it runs `tests/brief.test.js`, whose line 536 asserts `< 10000`.
- A plugin agent sent with `isolation: "worktree"` was never measured — Task 8 — nothing in this repository can check it; the first build after the Task 9 relaunch is the probe, and verify records it.
- An implementer in a worktree cannot reach the task registry, which lives in the main tree only — Task 1 — the implementer's `context.js add` passes `--root <main tree>`, and Task 6 tells the brain to name it in the prompt.
- `context.md` holds 40 lines (`scripts/context.js:24`); more writers may crowd it — none of the tasks — verify measures it on the next survey.

## Task 1: fankeel-writer and fankeel-implementer agent files

**Files:**
- Modify: `agents/fankeel-writer.md` — new: the docs writer
- Modify: `agents/fankeel-implementer.md` — new: build's implementer
- Modify: `.claude-plugin/plugin.json` — `agents` gains both, after `./agents/fankeel-init-scout.md`
- Test: `tests/agents.test.js`
- Read: `scripts/ledger.js` — `FOOTER` at lines 136-148, the return contract the implementer names
- Read: `agents/fankeel-fixer.md` — the frontmatter and section shape to match

**Interfaces:**
- Consumes: none
- Produces: plugin agents `fankeel:fankeel-writer` (`tools: [Read, Grep, Glob, Edit, Write, Bash]`, sonnet, medium) and `fankeel:fankeel-implementer` (same tools, sonnet, medium); section headings `## Where you start`, `## Before you write`, `## Every section`, `## Refusals`, `## Return` (writer) and `## Where you start`, `## The ladder`, `## Comments`, `## Never cut`, `## Return` (implementer).

**Dispatch:** implementer, sonnet — the plan carries both files whole; transcription plus tests.

Steps:

1. Write the failing test. In `tests/agents.test.js`, change `NAMES` (line 10) to end `..., 'fankeel-slimmer', 'fankeel-init-scout', 'fankeel-writer', 'fankeel-implementer'];`, add `'fankeel-writer': ['Edit', 'Write'], 'fankeel-implementer': ['Edit', 'Write']` to `MAY_WRITE` (line 32), add `'fankeel-writer': 'medium', 'fankeel-implementer': 'medium'` to `EFFORT` (line 228), and append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer-design.md §4-§5: the writer writes
// for a person, the implementer writes short code; both say where they start
// and record what they read in context.md.
test('the writer and the implementer each say where they start, what they refuse, and how they return', () => {
    const writer = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-writer.md'), 'utf8');
    for (const h of ['## Where you start', '## Before you write', '## Every section', '## Refusals', '## Return']) {
        assert.ok(writer.includes('\n' + h + '\n'), 'writer lacks ' + h);
    }
    assert.match(writer, /docs\/01-guide\//);
    assert.match(writer, /context\.js add/);
    const impl = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-implementer.md'), 'utf8');
    for (const h of ['## Where you start', '## The ladder', '## Comments', '## Never cut', '## Return']) {
        assert.ok(impl.includes('\n' + h + '\n'), 'implementer lacks ' + h);
    }
    assert.match(impl, /grep every caller/);
    assert.match(impl, /context\.js add/);
    assert.match(impl, /--root <main tree>/);
});
```

2. Run it and watch it fail: `node --test tests/agents.test.js` — the new test throws `ENOENT` and the manifest test fails on the two missing names.

3. Write the writer. Create `agents/fankeel-writer.md`:

```md
---
name: fankeel-writer
description: Writes one human-facing docs page — a page under docs/01-guide/ or README.md — in full sentences, every section carrying what it does, why, and an example to copy, from facts it can point at by path:line. Refuses any other target, more than one page, or no page path. Cannot dispatch a subagent or call NotebookEdit.
tools: [Read, Grep, Glob, Edit, Write, Bash]
model: sonnet
effort: medium
status: current
last_verified: 2026-10-02
source_of_truth: lib/stages.js, scripts/context.js
---

You are a writer. The session that sent you names one page — a page under
`docs/01-guide/` or the repository's `README.md` — and you rewrite it for the
person who will read it, in full sentences, from facts you can point at.

## Where you start

- The task's `context.md`, whose path your brief names: facts already read in
  this task, each with its `path:line`. Your fact list starts from it.
- The page path your prompt names, and the files on that page's
  `source_of_truth:` line.
- Read a file yourself only for a fact neither of those holds.

A fact you read that a later agent will need again goes into `context.md`:
run `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`
before you return, with the session id your prompt names. A prompt that names
no session id: skip it, and never search for one.

## Before you write

Put three lines at the top of the page, and delete them before you hand it back:

1. Who reads this page.
2. What they can do once they have read it.
3. The facts it rests on, one per line, each with its `path:line`.

Nothing outside that fact list goes on the page.

## Every section

- Each section carries three things: what it does, why it is this way — the
  trade-off, or the incident it prevents — and one example the reader can
  copy. A section missing one gets it added, not cut.
- Length follows the stakes, in both directions: a setting that can lose work
  gets a paragraph, a cosmetic one gets a line.
- The deletion test, both ways: a passage whose removal costs the reader
  nothing they could do goes; a passage whose removal stops them doing one of
  the things in line 2 stays.
- Full sentences: the conclusion first, then why. Say what a term means the
  first time it appears. Keep the connectives; no shorthand only the writer
  knows.

## Voice and typography

- Before writing, read two or three other pages in the same directory and
  match their voice.
- Traditional Chinese typography: quotation marks 「」 and 『』, the dash ──,
  the ellipsis ……, full-width parentheses （） beside Chinese text. Paths and
  identifiers stay in code.
- A generated block — from `<!-- PROFILE_TABLE:START -->` to its `END` line,
  or any other START/END pair — is never edited.

## Tools

`Read`, `Grep`, `Glob`, `Edit`, `Write` and `Bash`. `Bash` is for
`context.js add` and nothing else: no tests, no `git` writes.

## Refusals

- A target that is not under `docs/01-guide/` and is not `README.md`.
- More than one page in one dispatch.
- No page path in the prompt.

Refuse before editing anything, and change no file.

## Return

`done: <path>` and one line per section you added to or cut, or the refusal
and its reason. Nothing else: every line you return stays in the parent's
context for the rest of the session.
```

4. Write the implementer. Create `agents/fankeel-implementer.md`:

```md
---
name: fankeel-implementer
description: Build's implementer — builds one plan task, test first, in the least code that does the job correctly, reusing what the repository already has and commenting only what the code cannot say. Returns the status, paths and test lines the brief footer asks for. Sent with the model the task's Dispatch line names. Cannot call NotebookEdit.
tools: [Read, Grep, Glob, Edit, Write, Bash]
model: sonnet
effort: medium
status: current
last_verified: 2026-10-02
source_of_truth: scripts/ledger.js, lib/stages.js
---

You are an implementer. You receive one task of a plan — the group's shared
prefix and your own task's text — and you build it, test first, in as little
code as does the job correctly.

## Where you start

- The prefix your prompt opens with: the task's `context.md`, the group's
  Files and Interfaces with their `path:line`, and the rules you cannot infer.
- Your own task's text, last in the prompt.
- A file the Files block does not name is returned as `blocked: <the file>`,
  never searched for.

A fact you read that a later agent will need again goes into `context.md`:
run `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id> --root <main tree>`
with the session id and main tree your prompt names — in a worktree, the main
tree is where the task's registry lives. A prompt that names neither: skip it,
and never search for them.

## Before you write

Read the task and the code it touches first, and trace the flow it runs
through end to end. The smallest change in the wrong place is a second bug,
not a small one.

## The ladder

Then stop at the first rung that holds:

1. It need not exist — the task does not ask for it.
2. It is already in this repository — a helper, type or pattern a few files
   over. Look before you write; re-implementing a neighbour is the most common
   waste.
3. The standard library does it.
4. The platform does it natively.
5. A dependency the project already has does it. Never add one.
6. Then the fewest lines that work.

No abstraction nobody asked for: no interface with one implementation, no
config for a value that never changes, no scaffolding for later.

## A bug fix

Fix the cause, not the symptom. Before editing a function, grep every caller
of it: one guard in the shared function is a smaller diff than one in every
caller, and patching only the path the task names leaves its siblings broken.

## Never cut

Of two equally short ways, take the one correct at the edges. Never simplified
away: validation at a trust boundary, error handling that prevents data loss,
a security measure, and anything the task asks for by name.

## Comments

Only where the code cannot say it: why it is this way, which incident or limit
it guards against. No comment restating what the code does. No comment or
docstring added to code you did not change.

## Return

The footer at the end of your prefix — `## Rules you cannot infer`, from
`scripts/ledger.js` — is the whole contract: a status line, the paths you
wrote, the `ℹ pass` and `ℹ fail` line, and one
`<test name> — red when: <the mutation>` line per new test. Never a diff,
never a summary of the code.
```

5. In `.claude-plugin/plugin.json`, change the `agents` array's last entry `"./agents/fankeel-init-scout.md"]` to `"./agents/fankeel-init-scout.md", "./agents/fankeel-writer.md", "./agents/fankeel-implementer.md"]`.

6. Run it and watch it pass: `node --test tests/agents.test.js tests/source.test.js` — `ℹ fail 0`. The parent commits.

## Task 2: fankeel-mutator and fankeel-mover agent files

**Files:**
- Modify: `agents/fankeel-mutator.md` — new: verify's mutation runner
- Modify: `agents/fankeel-mover.md` — new: audit's and land's mover
- Modify: `.claude-plugin/plugin.json` — `agents` gains both, after `./agents/fankeel-implementer.md`
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: Task 1's `NAMES` entries `fankeel-writer`, `fankeel-implementer` in `tests/agents.test.js`
- Produces: plugin agents `fankeel:fankeel-mutator` (`tools: [Read, Edit, Bash]`, sonnet, low) and `fankeel:fankeel-mover` (`tools: [Read, Bash]`, sonnet, low).

**Dispatch:** implementer, sonnet — the plan carries both files whole; transcription plus tests.

Steps:

1. Write the failing test. In `tests/agents.test.js`, append `'fankeel-mutator', 'fankeel-mover'` to the end of `NAMES`, add `'fankeel-mutator': ['Edit']` to `MAY_WRITE`, add `'fankeel-mutator': 'low', 'fankeel-mover': 'low'` to `EFFORT`, and append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer-design.md §6-§7.
test('the mutator applies one mutation and restores it, the mover moves without editing', () => {
    const mut = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mutator.md'), 'utf8');
    assert.equal(front(path.join(ROOT, 'agents', 'fankeel-mutator.md')).tools, '[Read, Edit, Bash]');
    assert.match(mut, /`node --test`/);
    assert.match(mut, /git diff --stat/);
    const mover = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mover.md'), 'utf8');
    assert.equal(front(path.join(ROOT, 'agents', 'fankeel-mover.md')).tools, '[Read, Bash]');
    assert.match(mover, /git mv/);
    for (const name of ['fankeel-mutator', 'fankeel-mover']) {
        assert.match(fs.readFileSync(path.join(ROOT, 'agents', name + '.md'), 'utf8'), /context\.js add/, name);
    }
});
```

2. Run it and watch it fail: `node --test tests/agents.test.js`.

3. Create `agents/fankeel-mutator.md`:

```md
---
name: fankeel-mutator
description: Verify's mutation runner — applies the one mutation it is given at a path:line, runs the one node --test command it is given, restores the file, and returns the pass and fail lines before and after with git diff --stat as proof of the restore. Refuses more than one mutation or a command that is not node --test. Cannot call Write, Grep, Glob or NotebookEdit.
tools: [Read, Edit, Bash]
model: sonnet
effort: low
status: current
last_verified: 2026-10-02
source_of_truth: lib/stages.js, lib/render.js
---

You are a mutator. Verify's stage agent cannot edit a file; you make the one
edit a mutation needs, run the test, and put the file back.

## Where you start

The one evidence row your prompt names: the `path:line` to change, what it
becomes, and the test command to run. Nothing else is yours to read.

A fact a later agent will need again — a test that stayed green under a
mutation it should catch — goes into `context.md`: run
`node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`
with the session id your prompt names, or skip it when it names none.

## Job

1. Run `git diff --stat -- <path>` and keep its output.
2. Run the test command once, unchanged, and keep its `ℹ pass` and `ℹ fail` lines.
3. Apply the mutation at the `path:line` with `Edit`.
4. Run the same command and keep both lines.
5. Restore the line exactly as it was with `Edit`, then run
   `git diff --stat -- <path>` again: it must print what step 1 printed.

## Refusals

- More than one mutation, or one spanning more than one place.
- A test command that does not start with `node --test`.
- Any edit to a file other than the one the mutation names.

Refuse before editing anything.

## Return

Four lines: `before: ℹ pass <n> ℹ fail <n>`, `mutated: ℹ pass <n> ℹ fail <n>`,
`restored: git diff --stat unchanged` (or what it printed instead), and the
`path:line` you changed. Or the refusal. Nothing else.
```

4. Create `agents/fankeel-mover.md`:

```md
---
name: fankeel-mover
description: Audit's and land's file mover — runs the git mv, merge or deletion of named files it is given, one action at a time, and returns each command with its result. Never changes a file's content. Cannot call Edit, Write or NotebookEdit.
tools: [Read, Bash]
model: sonnet
effort: low
status: current
last_verified: 2026-10-02
source_of_truth: lib/stages.js, lib/render.js
---

You are a mover. Audit's and land's stage agent cannot run a git write; you
run the ones it names and change no file's content.

## Where you start

The list of actions your prompt names: each one a path or paths and what to do
with them — `git mv <from> <to>`, a merge of a named branch, or deleting a
named file. You do not read the files' contents.

A fact a later agent will need — a move that changed a path other pages cite —
goes into `context.md`: run
`node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`
with the session id your prompt names, or skip it when it names none.

## Job

Run each action in the order given, one command each, and stop at the first
that fails.

## Refusals

- An action that edits a file's content: a `sed`, a redirect into a file, an
  editor.
- A path the prompt does not name.
- `git push`, `git reset --hard`, `git clean`, `git stash`,
  `git checkout -- <path>`: none of them is a move.

## Return

One line per action: the command, then `ok` or the first line of its error.
Nothing else.
```

5. In `.claude-plugin/plugin.json`, change `"./agents/fankeel-implementer.md"]` to `"./agents/fankeel-implementer.md", "./agents/fankeel-mutator.md", "./agents/fankeel-mover.md"]`.

6. Run it and watch it pass: `node --test tests/agents.test.js tests/source.test.js` — `ℹ fail 0`. The parent commits.

## Task 3: `renderVariant` and `scripts/variants.js`

**Files:**
- Modify: `lib/agentfile.js` — `VARIANT_EFFORTS`, `renderVariant`, appended after `refresh` (line 113), both exported
- Modify: `scripts/variants.js` — new: writes `agents/<base>-<effort>.md`
- Test: `tests/agentfile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `require('./agentfile.js').VARIANT_EFFORTS` → `['high', 'xhigh']`; `renderVariant(source: string, effort: string): string | null` — the source with `name: <n>` → `name: <n>-<effort>` and `effort:` set, body untouched; `null` for an effort not in `VARIANT_EFFORTS` or a source with no frontmatter. `require('../scripts/variants.js')` → `{ BASES: ['fankeel-implementer'], write(root: string): string[] }`, one `wrote agents/<base>-<effort>.md` line per file; CLI `node scripts/variants.js [--root <plugin root>]`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Steps:

1. Write the failing test. In `tests/agentfile.test.js`, append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer.md Task 3: a per-task effort is a
// shipped copy of the agent file under <name>-<effort>; the Agent tool cannot
// set effort, only an agent file's frontmatter can.
test('renderVariant renames the agent and sets its effort, body untouched; other efforts are refused', () => {
    const { renderVariant, VARIANT_EFFORTS } = require('../lib/agentfile.js');
    assert.deepEqual(VARIANT_EFFORTS, ['high', 'xhigh']);
    const source = '---\nname: fankeel-x\ndescription: d\nmodel: sonnet\neffort: medium\n---\nbody\n';
    assert.equal(renderVariant(source, 'high'), '---\nname: fankeel-x-high\ndescription: d\nmodel: sonnet\neffort: high\n---\nbody\n');
    assert.equal(renderVariant('---\nname: fankeel-x\n---\nb\n', 'xhigh'), '---\nname: fankeel-x-xhigh\neffort: xhigh\n---\nb\n');
    assert.equal(renderVariant(source, 'medium'), null);
    assert.equal(renderVariant(source, 'max'), null);
    assert.equal(renderVariant('no frontmatter\n', 'high'), null);
});

test('scripts/variants.js writes agents/<base>-<effort>.md for every base and effort under --root', () => {
    const d = tmp('fankeel-variants-');
    fs.mkdirSync(path.join(d, 'agents'));
    fs.writeFileSync(path.join(d, 'agents', 'fankeel-implementer.md'), '---\nname: fankeel-implementer\neffort: medium\n---\nb\n');
    const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'variants.js'), '--root', d], { encoding: 'utf8' });
    assert.equal(out, 'wrote agents/fankeel-implementer-high.md\nwrote agents/fankeel-implementer-xhigh.md\n');
    assert.equal(fs.readFileSync(path.join(d, 'agents', 'fankeel-implementer-xhigh.md'), 'utf8'), '---\nname: fankeel-implementer-xhigh\neffort: xhigh\n---\nb\n');
});
```

2. Run it and watch it fail: `node --test tests/agentfile.test.js`.

3. In `lib/agentfile.js`, after the closing brace of `refresh` and before `module.exports`, add:

```js
// A per-task effort variant: the plugin's agent file under `<name>-<effort>`,
// its `name:` and `effort:` lines changed. Shipped by scripts/variants.js, not
// generated at dispatch: a plugin agent loads at startup, and a file written
// mid-session was never measured to resolve (docs/90-agent/todo/station-6.md
// wrote every override before the session). `medium` is the base file itself.
const VARIANT_EFFORTS = ['high', 'xhigh'];

function renderVariant(source, effort) {
    const m = FRONT.exec(String(source || ''));
    if (!m || !VARIANT_EFFORTS.includes(effort)) return null;
    const head = m[1].split(/\r?\n/).map((l) => (/^name:/.test(l) ? l.trimEnd() + '-' + effort : l));
    const at = head.findIndex((l) => /^effort:/.test(l));
    if (at === -1) head.push('effort: ' + effort);
    else head[at] = 'effort: ' + effort;
    return '---\n' + head.join('\n') + '\n---\n' + source.slice(m[0].length);
}
```

and change the export line of `lib/agentfile.js` to:

```js
module.exports = { PLUGIN_ROOT, EFFORTS, VARIANT_EFFORTS, agentKey, agentNames, generatedVersion, syncAgent, syncLine, refresh, renderVariant };
```

4. Create `scripts/variants.js`:

```js
#!/usr/bin/env node
'use strict';

// Writes agents/<base>-<effort>.md from agents/<base>.md for every base in
// BASES and every effort in VARIANT_EFFORTS. Run it after editing a base file:
// tests/agents.test.js fails while a shipped variant differs from what this
// would write.
//
//   node scripts/variants.js [--root <plugin root>]

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { PLUGIN_ROOT, VARIANT_EFFORTS, renderVariant } = require('../lib/agentfile.js');

const BASES = ['fankeel-implementer'];

function write(root) {
    const out = [];
    for (const base of BASES) {
        const source = fs.readFileSync(path.join(root, 'agents', base + '.md'), 'utf8');
        for (const effort of VARIANT_EFFORTS) {
            const rel = 'agents/' + base + '-' + effort + '.md';
            fs.writeFileSync(path.join(root, rel), renderVariant(source, effort));
            out.push('wrote ' + rel);
        }
    }
    return out;
}

if (require.main === module) {
    const { values } = parseArgs({ options: { root: { type: 'string' } } });
    process.stdout.write(write(values.root || PLUGIN_ROOT).join('\n') + '\n');
}

module.exports = { BASES, write };
```

5. Run it and watch it pass: `node --test tests/agentfile.test.js` — `ℹ fail 0`. The parent commits.

## Task 4: ship the two implementer effort variants

**Files:**
- Modify: `agents/fankeel-implementer-high.md` — new, written by `node scripts/variants.js`
- Modify: `agents/fankeel-implementer-xhigh.md` — new, written by the same run
- Modify: `.claude-plugin/plugin.json` — `agents` gains both, after `./agents/fankeel-mover.md`
- Test: `tests/agents.test.js`
- Test: `tests/title.test.js`
- Read: `agents/fankeel-implementer.md` — the base file the variants copy
- Read: `scripts/variants.js` — the generator
- Read: `lib/agentfile.js` — `renderVariant`, `VARIANT_EFFORTS`

**Interfaces:**
- Consumes: `renderVariant(source, effort)` and `VARIANT_EFFORTS` from Task 3; `scripts/variants.js` from Task 3; `agents/fankeel-implementer.md` from Task 1
- Produces: plugin agents `fankeel:fankeel-implementer-high` and `fankeel:fankeel-implementer-xhigh`.

**Dispatch:** implementer, sonnet — a generator run plus two tests.

Steps:

1. Write the failing tests. In `tests/agents.test.js`, append `'fankeel-implementer-high', 'fankeel-implementer-xhigh'` to the end of `NAMES`, add `'fankeel-implementer-high': ['Edit', 'Write'], 'fankeel-implementer-xhigh': ['Edit', 'Write']` to `MAY_WRITE`, add `'fankeel-implementer-high': 'high', 'fankeel-implementer-xhigh': 'xhigh'` to `EFFORT`, and append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer.md Task 4: a variant is generated,
// never hand-edited. Edit agents/fankeel-implementer.md, then run
// `node scripts/variants.js`.
test('each implementer effort variant is the base file with name and effort changed', () => {
    const { VARIANT_EFFORTS, renderVariant } = require('../lib/agentfile.js');
    const base = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-implementer.md'), 'utf8');
    for (const effort of VARIANT_EFFORTS) {
        const rel = 'agents/fankeel-implementer-' + effort + '.md';
        assert.equal(fs.readFileSync(path.join(ROOT, rel), 'utf8'), renderVariant(base, effort), rel + ' differs: run node scripts/variants.js');
    }
});
```

In `tests/title.test.js`, append:

```js
// The shipped variant is a plugin agent like any other, so the title reads its
// effort off the file with no change to hooks/title.js.
test('a shipped effort variant titles with its own effort', () => {
    const w = world();
    const title = prefixFor({ toolInput: { subagent_type: 'fankeel:fankeel-implementer-xhigh', description: 'x' },
        pluginRoot: path.join(__dirname, '..'), projectDir: w.projectDir, configDir: w.configDir,
        transcriptPath: w.transcriptPath, env: {} });
    assert.equal(title, 'sonnet · xhigh');
});
```

2. Run them and watch them fail: `node --test tests/agents.test.js tests/title.test.js`.

3. Generate the files: `node scripts/variants.js` — it prints `wrote agents/fankeel-implementer-high.md` and `wrote agents/fankeel-implementer-xhigh.md`.

4. In `.claude-plugin/plugin.json`, change `"./agents/fankeel-mover.md"]` to `"./agents/fankeel-mover.md", "./agents/fankeel-implementer-high.md", "./agents/fankeel-implementer-xhigh.md"]`.

5. Run them and watch them pass: `node --test tests/agents.test.js tests/title.test.js` — `ℹ fail 0`. The parent commits.

## Task 5: the Dispatch line names an effort

**Files:**
- Modify: `lib/plantasks.js` — `task.effort` parsed off `implementer, <model>, <effort>`; `lint` names an effort with no variant
- Modify: `skills/fankeel-plan/SKILL.md:184-220` — the effort form of the Dispatch line
- Modify: `skills/fankeel-build/SKILL.md:205-225` — step 2 sends `fankeel:fankeel-implementer` or its variant
- Test: `tests/plantasks-effort.test.js`
- Test: `tests/skills.test.js`
- Read: `lib/agentfile.js` — `VARIANT_EFFORTS`

**Interfaces:**
- Consumes: `VARIANT_EFFORTS` from Task 3
- Produces: every task from `parseTasks`/`parsePlan` carries `effort: string` (`''` when the line names none); `lint` line `Task <n>: effort \`<e>\` has no fankeel-implementer variant — one of high, xhigh, or none for the agent file's own medium`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Steps:

1. Write the failing tests. Create `tests/plantasks-effort.test.js`:

```js
'use strict';

// docs/90-agent/plans/2026-10-02-docs-writer.md Task 5: `implementer, <model>,
// <effort>` names a shipped effort variant of fankeel-implementer.
const test = require('node:test');
const assert = require('node:assert/strict');

const plantasks = require('../lib/plantasks.js');
const { parseTasks } = plantasks;

const body = (dispatchLine) => [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  dispatchLine, '',
].join('\n');

test('parsePlan reads model and effort off an implementer, <model>, <effort> Dispatch line', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, sonnet, high — the lock protocol has to be reasoned about.'));
  assert.equal(t.model, 'sonnet');
  assert.equal(t.effort, 'high');
});

test('parsePlan leaves effort empty where the line names none, and the model as before', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, sonnet — transcription.'));
  assert.equal(t.model, 'sonnet');
  assert.equal(t.effort, '');
  assert.equal(parseTasks(body('**Dispatch:** in-session — the user said so.'))[0].effort, '');
});

test('lint names an effort with no shipped variant, and passes high and xhigh', () => {
  assert.deepEqual(plantasks.lint(body('**Dispatch:** implementer, sonnet, xhigh — a design judgement.'), '# A design\n'), []);
  const out = plantasks.lint(body('**Dispatch:** implementer, sonnet, max — why.'), '# A design\n');
  assert.ok(out.includes('Task 1: effort `max` has no fankeel-implementer variant — one of high, xhigh, or none for the agent file\'s own medium'), out.join('\n'));
});
```

In `tests/skills.test.js`, append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer.md Task 5.
test('build sends implementers as fankeel-implementer, the effort variant when the Dispatch line names one', () => {
  const build = read('fankeel-build');
  assert.match(build, /`subagent_type: fankeel:fankeel-implementer`/);
  assert.match(build, /`fankeel:fankeel-implementer-<effort>`/);
  assert.match(read('fankeel-plan'), /\*\*Dispatch:\*\* implementer, sonnet, high —/);
});
```

2. Run them and watch them fail: `node --test tests/plantasks-effort.test.js tests/skills.test.js`.

3. In `lib/plantasks.js`, below the other `require` lines at the top of the file, add `const { VARIANT_EFFORTS } = require('./agentfile.js');`. In the task object literal at line 78, add `effort: '',` after `model: '',`. Replace this block of `lib/plantasks.js`, at lines 114-118:

```js
                if (task.dispatch === 'implementer') {
                    const head = dash === -1 ? dl[1] : dl[1].slice(0, dash);
                    const comma = head.indexOf(',');
                    task.model = comma === -1 ? '' : head.slice(comma + 1).trim().toLowerCase();
                }
```

with this, in `lib/plantasks.js`:

```js
                // A third field is the effort, sent as the shipped variant
                // `fankeel:fankeel-implementer-<effort>` (lib/agentfile.js).
                if (task.dispatch === 'implementer') {
                    const head = dash === -1 ? dl[1] : dl[1].slice(0, dash);
                    const parts = head.split(',').map((s) => s.trim().toLowerCase());
                    task.model = parts[1] || '';
                    task.effort = parts[2] || '';
                }
```

In `lint` of `lib/plantasks.js`, before the loop that opens `if (t.dispatch !== 'implementer' || t.model !== 'haiku') continue;`, add:

```js
    for (const t of tasks) {
        if (t.dispatch !== 'implementer' || !t.effort || VARIANT_EFFORTS.includes(t.effort)) continue;
        out.push('Task ' + t.n + ': effort `' + t.effort + '` has no fankeel-implementer variant — one of ' + VARIANT_EFFORTS.join(', ') + ', or none for the agent file\'s own medium');
    }
```

4. In `skills/fankeel-plan/SKILL.md`, after the fence holding the `implementer, opus` example (`the lock protocol has to be reasoned about, not transcribed.`), insert this fence into `skills/fankeel-plan/SKILL.md`:

```markdown
**Dispatch:** implementer, sonnet, high — the retry protocol has to be reasoned about; sonnet at high effort is cheaper than opus for it.
```

and below it this paragraph:

A third field after the model raises the implementer's effort: `high` or
`xhigh` (`VARIANT_EFFORTS` in `lib/agentfile.js`), sent as
`fankeel:fankeel-implementer-<effort>` — a shipped copy of
`agents/fankeel-implementer.md` with its `name:` and `effort:` lines changed,
because the Agent tool cannot set effort
(`docs/90-agent/reference/model-choice.md:40`). Leave it off for the agent
file's own `medium`. It is above the floor like a stronger model, so it names
why on that line; `ledger.js lint` lists any other value by task number.

5. In `skills/fankeel-build/SKILL.md` step 2, replace these lines of `skills/fankeel-build/SKILL.md`:

```markdown
   here; `implementer, <model>` means dispatch one — **pass the model
   explicitly**, an omitted one inherits this session's, and say how many
```

with these, in `skills/fankeel-build/SKILL.md`:

```markdown
   here; `implementer, <model>` means dispatch one as
   `subagent_type: fankeel:fankeel-implementer` — or
   `fankeel:fankeel-implementer-<effort>` when the line carries a third field,
   `implementer, sonnet, high` — **pass the model
   explicitly**, an omitted one inherits this session's, and say how many
```

6. Run them and watch them pass: `node --test tests/plantasks-effort.test.js tests/plantasks-haiku.test.js tests/skills.test.js` — `ℹ fail 0`. The parent commits.

## Task 6: the brain records what it read and writes for a person

**Files:**
- Modify: `agents/fankeel-brain.md` — description, `## Tools` names the dedicated agents, new `## Context` and `## Reports are read by a person`
- Modify: `skills/fankeel-survey/SKILL.md` — step 6 records facts before the report
- Modify: `skills/fankeel-design/SKILL.md` — step 8 records facts; the ladder gains "already in this repository"
- Test: `tests/agents.test.js`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: the agent names from Tasks 1, 2 and 4 (`fankeel:fankeel-writer`, `fankeel:fankeel-implementer`, `fankeel:fankeel-implementer-<effort>`, `fankeel:fankeel-mutator`, `fankeel:fankeel-mover`)
- Produces: `agents/fankeel-brain.md` sections `## Context` and `## Reports are read by a person`, between `## Job` and `## Tools`.

**Dispatch:** implementer, sonnet — the plan carries every sentence; transcription plus tests.

Steps:

1. Write the failing tests. In `tests/agents.test.js`, append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer-design.md §2-§3 and §8.
test('the brain names the dedicated agents, records survey and design facts, and writes its reports for a person', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const tools = text.split('\n## Tools\n')[1].split('\n## Refusals\n')[0];
    for (const a of ['fankeel:fankeel-writer', 'fankeel:fankeel-mutator', 'fankeel:fankeel-mover', '`fankeel:fankeel-implementer`', 'fankeel:fankeel-implementer-<effort>']) {
        assert.ok(tools.includes(a), 'Tools lacks ' + a);
    }
    assert.doesNotMatch(tools, /\(`general-purpose`, on the model/);
    const ctx = text.split('\n## Context\n')[1];
    assert.ok(ctx, 'fankeel-brain.md has a ## Context section');
    const section = ctx.split('\n## ')[0];
    assert.match(section, /survey/);
    assert.match(section, /design/);
    assert.match(section, /context\.js add "<fact>" --at <path:line> --session <id>/);
    assert.match(text, /^## Reports are read by a person$/m);
});
```

In `tests/skills.test.js`, in the test `the design skill carries the ladder, first rung first`, change the rung list to `['It need not exist', 'It is already in this repository', 'The standard library already does it', 'The platform does it natively', 'A dependency does it', 'Then the fewest lines that work']`, and append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer-design.md §2.
test('survey and design record what they read in context.md before the report', () => {
  for (const name of ['fankeel-survey', 'fankeel-design']) {
    assert.match(read(name), /`node <plugin>\/scripts\/context\.js add "<fact>" --at <path:line> --session <id>`/, name);
  }
});
```

2. Run them and watch them fail: `node --test tests/agents.test.js tests/skills.test.js`.

3. In `agents/fankeel-brain.md`, in the `description:` line, replace `on a verify stage its verifier, fixer and an implementer for a mutation,` with `on a verify stage its verifier, fixer and mutator, on audit and land a mover,`. In `## Tools` of `agents/fankeel-brain.md`, replace

```markdown
`fankeel:fankeel-verifier` and an implementer
(`general-purpose`, on the model the task's Dispatch line names, or on
`dispatch.floor` where there is none): the raw
```

with this, in `agents/fankeel-brain.md`:

```markdown
`fankeel:fankeel-verifier`, `fankeel:fankeel-writer` for a page under
`docs/01-guide/` or `README.md`, `fankeel:fankeel-mutator` for a mutation,
`fankeel:fankeel-mover` for a move or a git write, and an implementer
(`fankeel:fankeel-implementer`, or `fankeel:fankeel-implementer-<effort>`
where the task's Dispatch line names an effort, on the model that line
names, or on `dispatch.floor` where there is none) — where your brief still
names the implementer `general-purpose`, the brief wins. Every writer,
implementer, mutator and mover prompt names `session <id>`, and a
worktree-isolated implementer's names the main tree as `root <path>`, so it
can record what it read with `context.js add`: the raw
```

Then insert, immediately above the `## Tools` heading of `agents/fankeel-brain.md`:

```markdown
## Context

On a survey or a design stage, before you write the handoff, record every
fact you read yourself that a later stage will need again — one line each,
with the place you read it:

`node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`

The brief names the session id. Readers already do this for what they read;
this is for what you opened yourself, so the stages after you start from
`context.md` rather than reading the same files again. A fact already there is
not added twice: `add` drops an exact duplicate.

## Reports are read by a person

Your report and every gate string are read by the user, not by an agent.
Write them in full sentences: the conclusion first, then why; say what a term
means the first time it appears; keep the connectives; no label only you
would know, such as a task or section number standing in for its content.
What you return to the controller stays a path, not prose.
```

4. In `skills/fankeel-survey/SKILL.md`, after the paragraph `Nothing declares a file list: the files this task touches are recorded as the edits land.` at the end of `### 6. Write it down`, add to `skills/fankeel-survey/SKILL.md`:

```markdown
Before the report, record what this stage read for the stages after it — one
line per fact a later stage will need again, with the place you read it:
`node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`.
`context.md` is what every later brief carries; a fact left out of it is read
again by design, by plan and by every implementer.
```

5. In `skills/fankeel-design/SKILL.md`, replace the ladder

```markdown
1. It need not exist — the ask does not require it.
2. The standard library already does it.
3. The platform does it natively.
4. A dependency does it — one the project already has before a new one.
5. Then the fewest lines that work.
```

with this, in `skills/fankeel-design/SKILL.md`:

```markdown
1. It need not exist — the ask does not require it.
2. It is already in this repository — a helper, type or pattern a few files over; reuse it before writing a new one.
3. The standard library already does it.
4. The platform does it natively.
5. A dependency does it — one the project already has before a new one.
6. Then the fewest lines that work.
```

Then, in `### 8. Self-review, then a person reads it`, immediately above `Then ask the user to read it, and wait.`, add to `skills/fankeel-design/SKILL.md`:

```markdown
Record what this stage read that plan and build will need again, one fact a
line: `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`.
```

6. Run them and watch them pass: `node --test tests/agents.test.js tests/skills.test.js tests/brief.test.js` — `ℹ fail 0`. The parent commits.

## Task 7: the reference pages name the new agents

**Files:**
- Modify: `docs/90-agent/reference/subagents.md` — sixteen agents, a paragraph on the four new roles and the variants
- Modify: `docs/90-agent/reference/model-choice.md` — per-task effort under `## Constraint on c`
- Modify: `docs/README.md` — index rows for the design and this plan
- Test: `tests/init-docs.test.js`

**Interfaces:**
- Consumes: the agent names from Tasks 1, 2 and 4; `renderVariant` and `scripts/variants.js` from Task 3
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries every sentence; transcription plus a test.

Steps:

1. Write the failing test. In `tests/init-docs.test.js`, in the test `subagents.md and collisions.md name fankeel-init-scout as read-only`, change `/## The ten agents this plugin defines/` to `/## The sixteen agents this plugin defines/`, and append:

```js
// docs/90-agent/plans/2026-10-02-docs-writer.md Task 7.
test('subagents.md names every agent the plugin ships', () => {
    const text = flat('subagents.md');
    const names = fs.readdirSync(path.join(__dirname, '..', 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
    assert.equal(names.length, 16);
    for (const n of names) assert.ok(text.includes('`' + n + '`'), n);
    assert.match(flat('model-choice.md'), /implementer, <model>, <effort>/);
});
```

2. Run it and watch it fail: `node --test tests/init-docs.test.js`.

3. In `docs/90-agent/reference/subagents.md`, five edits in place:
   - The heading `## The ten agents this plugin defines` becomes `## The sixteen agents this plugin defines`.
   - `Ten subagent types are not just described in prose` becomes `Sixteen subagent types are not just described in prose`.
   - The one-line list under it ends "fankeel-slimmer and fankeel-init-scout", each name in backticks. It becomes a list ending fankeel-slimmer, fankeel-init-scout, fankeel-writer, fankeel-implementer, fankeel-implementer-high, fankeel-implementer-xhigh, fankeel-mutator and fankeel-mover, each name in backticks as the rest of the list is, still one line.
   - The words "Nine of" closing one line and "the ten agents hold" opening the next become "Fifteen of" and "the sixteen agents hold", the rest of both lines unchanged.
   - `names all four writers as` becomes `names every writer as an`, and the next line's `exemptions, each` becomes `exemption, each`.

4. Into `docs/90-agent/reference/subagents.md`, immediately above the paragraph that opens with the reader's default model ("runs at model: sonnet by default"), insert:

```markdown
`fankeel-writer`, `fankeel-implementer`, `fankeel-mutator` and `fankeel-mover`
are a stage's hands, one per kind of write, and each replaces a
`general-purpose` implementer its stage used to send (`lib/stages.js`,
`STAGE_AGENTS`; [the design](../plans/2026-10-02-docs-writer-design.md)). The
writer rewrites one page under `docs/01-guide/` or `README.md` for a person.
The implementer builds one plan task at `effort: medium`;
`fankeel-implementer-high` and `fankeel-implementer-xhigh` are the same file
with `name:` and `effort:` changed — written by `node scripts/variants.js`,
held byte for byte to `renderVariant` by `tests/agents.test.js` — and are sent
when a task's `**Dispatch:**` line carries a third field
(`implementer, sonnet, high`), because the Agent tool cannot set effort. The
mutator applies one mutation, runs one `node --test` command and restores the
file, with `Read`, `Edit` and `Bash` only. The mover runs a `git mv`, a merge or
a deletion it is given, with `Read` and `Bash` and no `Edit` or `Write`. All
four record what they read with `context.js add` when the prompt names a
session id.
```

5. In `docs/90-agent/reference/model-choice.md`, after the paragraph of `## Constraint on c` that ends `only the bare name reaches it.`, add to `docs/90-agent/reference/model-choice.md`:

```markdown
A per-task raise is also a plan's own now: a `**Dispatch:**` line
`implementer, <model>, <effort>` sends `fankeel:fankeel-implementer-<effort>`,
a shipped copy of `agents/fankeel-implementer.md` with `name:` and `effort:`
changed (`renderVariant` in `lib/agentfile.js`, written by
`scripts/variants.js`), for `high` and `xhigh` only; `ledger.js lint` refuses
any other value. Shipped rather than generated at dispatch: a plugin agent
loads at startup, and a file written mid-session was never measured to
resolve. The override file above stays the per-role route.
```

6. In `docs/README.md`, after the row for the 10-01 patrol-four plan, add to `docs/README.md`:

```markdown
| 按角色拆專屬 agent（writer、implementer、mutator、mover），survey 與 design 把讀過的事實記進 `context.md` 的 design | [plans/2026-10-02-docs-writer-design.md](90-agent/plans/2026-10-02-docs-writer-design.md) — *design-intent, 繁體中文* |
| 那份設計的九個 task，含按任務的 effort（`implementer, <model>, <effort>`） | [plans/2026-10-02-docs-writer.md](90-agent/plans/2026-10-02-docs-writer.md) — *design-intent* |
```

7. Run it and watch it pass: `node --test tests/init-docs.test.js` and `node scripts/docs-check.js` — `ℹ fail 0`, and docs-check reports nothing under the three pages. The parent commits.

## Task 8: the stage briefs send the dedicated agents

**Files:**
- Modify: `lib/stages.js:700-713` — `STAGE_AGENTS` and its comment
- Modify: `lib/render.js:555-580` — the build, verify, audit and land lines name the agents
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: agent names from Tasks 1, 2 and 4; `agents/fankeel-brain.md` `## Tools` naming them (Task 6) — `tests/brief.test.js:540` holds the two together
- Produces: `agentsFor('build')` includes `'fankeel:fankeel-writer'` and an implementer entry naming fankeel:fankeel-implementer in backticks; `agentsFor('verify')` a mutator entry naming fankeel:fankeel-mutator; `agentsFor('audit')` includes `'fankeel:fankeel-writer'` and, with `agentsFor('land')`, a mover entry naming fankeel:fankeel-mover; none contains `general-purpose`.

**Dispatch:** implementer, sonnet — the plan carries every string; transcription plus tests.

Steps:

1. Write the failing test. In `tests/brief.test.js`, make these replacements, each whole line:

```js
  assert.match(build, /`fankeel:fankeel-reviewer`, `fankeel:fankeel-render-reviewer`, `fankeel:fankeel-fixer`, `fankeel:fankeel-writer` or an implementer/);
  assert.match(dispatchLine('verify'), /`fankeel:fankeel-render-reviewer`, `fankeel:fankeel-verifier`, `fankeel:fankeel-fixer` or a mutator \(`fankeel:fankeel-mutator`, on the `dispatch.floor` model/);
  assert.match(build, /You have no Edit\. A task whose Dispatch line says in-session goes to `fankeel:fankeel-implementer` on model `sonnet` like any other: send it the task's brief\./);
  assert.match(verify, /You cannot edit or restore a file\. To apply a mutation, run the test and restore the file, send `fankeel:fankeel-mutator` on model `sonnet`: it does all three, and you read what it returns/);
  assert.match(brief('verify', {}), /send `fankeel:fankeel-mutator` on model `sonnet`: it does all three/);
  assert.match(brief('verify', { 'dispatch.floor': 'opus' }), /send `fankeel:fankeel-mutator` on model `opus`: it does all three/);
  assert.match(brief('build', { 'dispatch.floor': 'opus' }), /in-session goes to `fankeel:fankeel-implementer` on model `opus` like any other/);
  assert.match(briefFor('audit'), /You cannot edit a page or run a git write\. Send one change at a time to `fankeel:fankeel-fixer` \(a page correction\) or `fankeel:fankeel-mover` on model `sonnet` \(a move, a merge, a cleanup\), and read what it returns before you send the next\./);
  assert.match(land, /You cannot edit a page or run a git write\. Send one change at a time to `fankeel:fankeel-mover` on model `opus` \(a move, a merge, a cleanup\)/);
  assert.match(build, /an implementer \(`fankeel:fankeel-implementer`, or `fankeel:fankeel-implementer-<effort>` where the task Dispatch line names an effort, on the model named there, with `isolation: "worktree"`\)/);
```

They replace, in order, the assertions now at lines 479, 481, 499, 506, 518, 519, 520, 692, 694 and 781. Then append to `tests/brief.test.js`:

```js
// docs/90-agent/plans/2026-10-02-docs-writer-design.md §8.
test('no stage agent is told to send general-purpose; each names its dedicated agent', () => {
  const { agentsFor } = require('../lib/stages.js');
  for (const stage of ['build', 'verify', 'audit', 'land']) {
    assert.ok(!agentsFor(stage).some((a) => a.includes('general-purpose')), stage);
  }
  assert.ok(agentsFor('build').some((a) => a.includes('`fankeel:fankeel-implementer`')));
  assert.ok(agentsFor('verify').some((a) => a.includes('`fankeel:fankeel-mutator`')));
  for (const stage of ['audit', 'land']) assert.ok(agentsFor(stage).some((a) => a.includes('`fankeel:fankeel-mover`')), stage);
  for (const stage of ['build', 'audit']) assert.ok(agentsFor(stage).includes('fankeel:fankeel-writer'), stage);
});
```

2. Run it and watch it fail: `node --test tests/brief.test.js`.

3. In `lib/stages.js`, replace the comment and `STAGE_AGENTS` (lines 702-713, from `// The agents a stage agent may dispatch.` to the closing `};`) with:

```js
// The agents a stage agent may dispatch. It has no Workflow tool, so a stage that
// fans out does it with the Agent tool, at most four in one response. Each kind
// of write has its own plugin agent (docs/90-agent/plans/2026-10-02-docs-writer-design.md):
// the implementer on the model the task's own Dispatch line names, its effort
// variant when that line names an effort, and the mutator and the mover on the
// profile's `dispatch.floor`, where no task names one.
const BRAIN_AGENTS = ['fankeel:fankeel-reader', 'fankeel:fankeel-reviewer'];
const STAGE_AGENTS = {
    build: BRAIN_AGENTS.concat(['fankeel:fankeel-render-reviewer', 'fankeel:fankeel-fixer', 'fankeel:fankeel-writer', 'an implementer (`fankeel:fankeel-implementer`, or `fankeel:fankeel-implementer-<effort>` where the task Dispatch line names an effort, on the model named there, with `isolation: "worktree"`)']),
    verify: BRAIN_AGENTS.concat(['fankeel:fankeel-render-reviewer', 'fankeel:fankeel-verifier', 'fankeel:fankeel-fixer', 'a mutator (`fankeel:fankeel-mutator`, on the `dispatch.floor` model, sent to apply a mutation, run the test and restore the file)']),
    audit: BRAIN_AGENTS.concat(['fankeel:fankeel-fixer', 'fankeel:fankeel-writer', 'a mover (`fankeel:fankeel-mover`, on the `dispatch.floor` model, sent to move a file or run a git write)']),
    land: BRAIN_AGENTS.concat(['a mover (`fankeel:fankeel-mover`, on the `dispatch.floor` model, sent to move a file, merge or clean up)']),
};
```

4. In `lib/render.js`, line 561 says `goes to an implementer on model`, line 570 `send an implementer on model`, and line 578 `+ fixer + 'an implementer on model`; each names the dedicated agent instead. The three lines of `lib/render.js` then read, in full:

```js
        lines.push('  - You have no Edit. A task whose Dispatch line says in-session goes to `fankeel:fankeel-implementer` on model `' + profile.values['dispatch.floor'] + '` like any other: send it the task\'s brief. One whose Dispatch line says user is not yours to send: `ledger.js ready` never lists it, the controller runs it with the user after your report, and your report names it on a line `hands: <n>, <n>`.');
    if (stage === 'verify') lines.push('  - You cannot edit or restore a file. To apply a mutation, run the test and restore the file, send `fankeel:fankeel-mutator` on model `' + profile.values['dispatch.floor'] + '`: it does all three, and you read what it returns.');
        lines.push('  - You cannot edit a page or run a git write. Send one change at a time to ' + fixer + '`fankeel:fankeel-mover` on model `' + profile.values['dispatch.floor'] + '` (a move, a merge, a cleanup), and read what it returns before you send the next.');
```

5. Run it and watch it pass: `node --test tests/brief.test.js tests/render.test.js tests/stages.test.js` — `ℹ fail 0`; the `brain brief is <n> chars` assertion at line 536 still holds. The parent commits.

## Task 9: relaunch, pilot the writer on profile.md, blind test

**Files:**
- Modify: `docs/01-guide/profile.md` — rewritten by `fankeel:fankeel-writer`: the prose outside the generated table gains why and an example
- Read: `agents/fankeel-writer.md` — what the writer is told

**Interfaces:**
- Consumes: `fankeel:fankeel-writer` (Task 1), loaded only after a relaunch
- Produces: `.fankeel/build/task-20261002T090238/blind-before.md` and `blind-after.md`, the three questions and each run's answers, for verify's evidence.

**Dispatch:** user — quit and relaunch Claude Code in this repository so the plugin's six new agents load (a plugin agent loads only at startup), and say when it is back; no subagent can restart its own host.

Steps, run with the user in the relaunched session:

1. Confirm the agents loaded: a dispatch of `fankeel:fankeel-writer` with the prompt `Return the word ready and nothing else.` returns `ready`.
2. Blind run before: dispatch one `fankeel:fankeel-reader` told to read only `docs/01-guide/profile.md` and no other file, and to answer: 「哪一層的值蓋過哪一層」「為什麼建議把 `stage.agents` 設成 `survey`」「替這個專案把 `language` 設成繁體中文要打哪條指令」. Write the questions and its answers to `.fankeel/build/task-20261002T090238/blind-before.md`.
3. Dispatch `fankeel:fankeel-writer` on `docs/01-guide/profile.md`, with `session 15377bbe-2490-4bc7-a303-dbbdb6c1c290` in the prompt.
4. Blind run after: the same reader prompt on the rewritten page; answers to `.fankeel/build/task-20261002T090238/blind-after.md`. The design's bar: before gets at least one wrong, after gets all three right.
5. Run `node scripts/docs-check.js`; the parent commits `docs/01-guide/profile.md`.

## Coverage

| promise | task |
|---|---|
| 不做按需 skill。subagent 不繼承 skill（`docs/03-decisions/2026-09-20-survey-brain.md:26`），SubagentStart 的 brief 也不帶 skill 全文（`lib/render.js:676-701`）；主 session 把事派出去以後，只在主 session 觸發的 skill 到不了做事的人。 | struck — a non-goal; no task adds a skill, and Tasks 1-2 put the rules in agent files instead |
| 每個角色的規則寫在它自己的 agent 檔本文：本文就是它的 system prompt，每次派都在。 | Task 1, Task 2 |
| 不用 agent 檔的 `skills:` 預載：repo 只有一句話說它可以（同上 :26），沒量過。 | struck — a non-goal; no agent file in Tasks 1-2 carries `skills:` |
| 現況：`scripts/context.js` 是 `context.md` 唯一的寫入者，一行一個事實加 `path:line` 與 sha，最多 40 行（`scripts/context.js:23`）；每個 subagent 的 brief 都附上它（`lib/render.js:637-642`），implementer 的 `ledger.js --prefix` 也以它開頭。只有 reader 被要求寫（`agents/fankeel-reader.md:69-73`）；自己讀檔的 survey 與 design brain 沒有，所以這個 task 的 `context.md` 不存在，design 重讀了 survey 已讀過的七個檔。 | Task 6 (the gap it describes is closed there) |
| survey 與 design 的 brain 交出 handoff 前，把自己讀過、後面幾站還會用到的事實逐條 `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`；寫進 `agents/fankeel-brain.md`，以及 `skills/fankeel-survey/SKILL.md`、`skills/fankeel-design/SKILL.md`（主 session 自己跑這兩站時用）。 | Task 6 |
| 每一棒拿到的東西，寫進各自的 agent 檔「你從哪裡接手」一節： | Task 1, Task 2 (`## Where you start`) |
| writer：brief 裡的 `context.md`、要改的頁面路徑、頁面 `source_of_truth`；事實清單從 `context.md` 起算，缺的才自己讀。 | Task 1 |
| implementer：`ledger.js --prefix`（`context.md`、該組的 Files 與 Interfaces，含 `path:line`）加自己的 task 全文；Files 沒列的檔回 `blocked:`，不自己找（`scripts/ledger.js:139-148`）。 | Task 1 |
| mutator：verify brain 給的一列 evidence——要改的 `path:line`、改成什麼、要跑的測試指令。 | Task 2 |
| mover：audit 或 land brain 給的路徑清單與要做的動作，不讀檔案內容。 | Task 2 |
| 每個專屬 agent 讀到、且後面還用得到的新事實，同樣用 `context.js add` 記下，再回傳。 | Task 1, Task 2; Task 6 has the brain name the session id in each prompt |
| 對人說的 agent——`fankeel-writer`（docs 頁）與 `fankeel-brain`（報告與 gate）——寫完整句子：先講結論，再講為什麼，詞第一次出現要說它是什麼，不省連接詞，不用只有寫的人懂的代號。`agents/fankeel-brain.md` 加一節「報告是給人讀的」。 | Task 1 (writer), Task 6 (`## Reports are read by a person`) |
| 回給 agent 的——reader、reviewer、verifier、implementer、mutator、mover、fixer——維持現有的精簡回傳格式，不改。 | Task 1, Task 2 (their `## Return` sections); no existing agent's return changes |
| 新檔 `agents/fankeel-writer.md`：`tools: [Read, Grep, Glob, Edit, Write, Bash]`（Bash 只為 `context.js add`），`model: sonnet`，`effort: medium`。 | Task 1 |
| 動筆前三行前置，交稿前刪掉：讀者是誰、讀完能做到什麼、事實清單——每條附 `path:line`；清單外的事不寫。 | Task 1 |
| 每一節三件套：它做什麼、為什麼這樣（取捨或它防止的事故）、一個能照抄的例子；缺的要補，不是刪。長度跟利害成比例，兩個方向都算（sepia `professional-pass.md` 第 18 行）。 | Task 1 |
| 雙向刪除測試：刪掉某段讀者不會少做到任何事就刪；刪掉後讀者做不到「讀完能做到什麼」裡的一件，就不能刪。 | Task 1 |
| 先讀同目錄兩到三頁當語氣基準；繁中排版四條：引號「」『』、破折號──、刪節號……、中文旁用全形括號；路徑與識別字用 code。生成區塊（例如 `<!-- PROFILE_TABLE:START -->` 到 `END`）不動。 | Task 1 |
| 拒絕：目標不在 `docs/01-guide/` 也不是 `README.md`、一次超過一頁、沒給頁面路徑；拒絕時不改任何檔。 | Task 1 |
| 新檔 `agents/fankeel-implementer.md`，取代 build 派的 `general-purpose`：`tools: [Read, Grep, Glob, Edit, Write, Bash]`，`model: sonnet`（Dispatch 行指名別的模型時照 Agent 的 `model` 參數），`effort: medium`。 | Task 1 (file), Task 8 (replaces `general-purpose`) |
| 本文收 ponytail 寫的當下的原理（來源 `~/.claude/plugins/marketplaces/ponytail/skills/ponytail/SKILL.md`；出貨檔不提這個名字，`tests/source.test.js:220`）：先讀懂任務與它碰到的流程再挑最小寫法（原 :44-48）；先找 repo 已有的 helper、型別、寫法（原 :37）；修 bug 先 grep 每個呼叫者、修在共用處（原 :50-54）；兩個一樣短的寫法挑邊界正確的，信任邊界檢查、防資料遺失、安全措施不省（原 :63、:90-92）；不加沒人要的抽象、設定、鷹架（原 :58-59）。 | Task 1 |
| 少註解：只在程式碼說不出的地方寫——為什麼這樣、防的是哪次事故或哪個限制；不寫重述程式在做什麼的註解，不替沒改的程式補註解或 docstring。 | Task 1 |
| 回傳格式沿用 `scripts/ledger.js:139-148` 的 `FOOTER`。 | Task 1 |
| 新檔 `agents/fankeel-mutator.md`，取代 verify 派的 `general-purpose`（`lib/stages.js:710`）：`tools: [Read, Edit, Bash]`，`model: sonnet`，`effort: low`。 | Task 2 (file), Task 8 (replaces `general-purpose`) |
| 只做三件事：照給的 `path:line` 套上 mutation、跑給的測試指令、把檔案還原；回傳 mutation 前後測試的 `ℹ pass`／`ℹ fail` 行，以及還原後 `git diff --stat` 為空的證明。 | Task 2 — the proof compares `git diff --stat` before and after rather than requiring empty, since a build worktree may already be dirty |
| 拒絕：給的 mutation 超過一處、測試指令不是 `node --test` 開頭；不改其他檔。 | Task 2 |
| 新檔 `agents/fankeel-mover.md`，取代 audit 與 land 派的 `general-purpose`（`lib/stages.js:711-712`）：`tools: [Read, Bash]`，沒有 Edit 與 Write，`model: sonnet`，`effort: low`。 | Task 2 (file), Task 8 (replaces `general-purpose`) |
| 只做給的動作：`git mv`、merge、刪掉指名的檔；不改任何檔案內容。回傳每個動作的指令與結果一行。 | Task 2 |
| `lib/stages.js:709-712` 的四個 implementer 字串改成 `fankeel:fankeel-implementer`、`fankeel:fankeel-mutator`、`fankeel:fankeel-mover`；writer 加進 build 與 audit 的名單；`agents/fankeel-brain.md:57` 起那段與 build skill 派 implementer 的句子同步。 | Task 8 (stages, render), Task 6 (brain Tools), Task 5 (build skill) |
| `.claude-plugin/plugin.json` 的 `agents` 加四個；`tests/agents.test.js` 的 `NAMES`（:10）、`MAY_WRITE`（:32）、effort 表（:228）各加四筆；`docs/90-agent/reference/subagents.md` 加四列、改掉「implementer 是 general-purpose」，數 agent 個數的字跟著改。 | Task 1, Task 2, Task 4 (manifest and test tables), Task 7 (subagents.md) |
| `skills/fankeel-design/SKILL.md:74-78` 的階梯在第 1、2 階之間加一階「這個 repo 已經有」。 | Task 6 |
| 不收：人設、強度模式與三個 hook、`ponytail:` 註解、gain、help——`docs/03-decisions/2026-09-24-optimise-own-first.md:33-38` 已判過。 | struck — a non-goal; nothing is built for it |
| writer 落地後改寫 `docs/01-guide/profile.md`，表格外的文字補上為什麼與例子。 | Task 9 |
| 盲測：派一個只拿到該頁、不准讀別的檔的 reader，答三題——「哪一層的值蓋過哪一層」「為什麼建議把 `stage.agents` 設成 `survey`」「替這個專案把 `language` 設成繁體中文要打哪條指令」。改寫前後各跑一次，改寫前至少錯一題、改寫後全對，問題與兩次回答記進 verify 的 evidence。 | Task 9 (runs and records), verify (the evidence row) |
| 現在失敗、之後通過：`tests/agents.test.js` 的 `NAMES` 加四個新名字；`tests/brief.test.js` 斷言 build、verify、audit、land 的可派名單不含 `general-purpose`，且各含對應的專屬 agent；`tests/agents.test.js` 斷言 `agents/fankeel-brain.md` 的 survey、design 段含 `context.js add`。 | Task 1, Task 2, Task 6, Task 8 |
| 全套 `node --test` 顯示 `ℹ fail 0`；`node scripts/docs-check.js` 不報新 agent。 | the parent's full suite after each group; Task 7 runs docs-check |
| 產出物那一列：第 9 節的盲測；另跑一次 survey，結束時 `context.md` 至少有一行來自 survey brain。 | Task 9 (blind test); struck from build — the survey rerun needs a new task, so verify runs it |
| 按任務的做法：每個 agent 預先生成幾個 effort 版本的覆寫檔，plan 的 Dispatch 行多寫一個 effort，`hooks/title.js` 照它改寫 `subagent_type`。動到 `lib/agentfile.js`、`lib/plantasks.js`、`hooks/title.js`，與本設計不共用檔案，另開一輪 design。 | Task 3, Task 4, Task 5 — folded in at the design gate; variants for `fankeel-implementer` only (the one agent a Dispatch line names), shipped rather than generated, and the dispatcher names the variant instead of `hooks/title.js` rewriting (see Architecture) |
