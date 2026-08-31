---
status: design-intent
last_verified: 2026-08-31
source_of_truth: TODO.md, lib/plantasks.js, lib/guard.js
---

# TODO Waiting backlog Implementation Plan

**Goal:** close the three `## Waiting` entries that no longer wait on anything external, and file the two entries this survey produced.

**Architecture:** no behaviour changes. Two of the three entries are answered by reasoning already half-written in the code; the work is finishing that reasoning where it lives and removing the entry in the same change, which is this repository's own way of closing one. The third is a merge of two bullets asking one question. Nothing new is built and no test is added: the behaviour both entries ask about is already pinned by tests that exist.

**Tech Stack:** Node's built-in test runner only (`node --test`). No dependencies, and none may be added — `package.json` is `"private": true` with no `dependencies` key at all.

**Spec:** no spec file. Class is `bounded`; the design was agreed in chat and is summarised in the task list below.

## Global Constraints

Taken from `node scripts/map.js`, `package.json`, `TODO.md` and the test suite, not from memory.

- There is **no `CLAUDE.md` and no `AGENTS.md`** in this repository. Conventions come from the surrounding code, which is the only source.
- `package.json` declares exactly one script: `"test": "node --test"`. That is the whole suite command.
- `.fankeel/map.md` filing: `docs/plans` is role `plan`, `docs/decisions` is `decision`, `docs/archive` is `archive`, and `docs`, `skills` and `output-styles` are `reference`. The index is `docs/README.md`.
- The map reports **0 pages marked `planned, not built`**. Nothing here may be written as though a design-intent page described the code.
- `scripts/todo-check.js:31` — `MAX_ENTRY_CHARS = 200`. Every TODO entry written here is measured against that, whitespace collapsed.
- `scripts/todo-check.js:43` — `SECTIONS = ['Ready', 'Needs a decision', 'Waiting']`, matched as exact strings. No fourth heading, no renaming.
- `scripts/todo-check.js:128` — every non-external, non-anchor markdown link in an entry must resolve from the repository root. A new entry either links to a file that exists or carries no link.
- `TODO.md` convention, from its own prose: the heading answers **what the entry is still short of**, not what it is about; whoever finishes the work removes the entry **in the same change**; the bullet is short and the detail lives in the file it links to.
- Commit subjects in this repository are lowercase `type: ` followed by a statement of what was wrong or what now holds — see `git log --oneline`. Not imperative, no scope parentheses.
- Comments in `lib/` carry the reasoning and, where a direction was chosen, the date it was chosen on. They are long deliberately; a one-line comment restating the code is not the house style.

## File structure

| file | responsibility here |
|---|---|
| `lib/plantasks.js` | the `conflict()` comment gains the half that explains the asymmetry it already relies on |
| `tests/plantasks.test.js` | one comment above the test that already pins the fail-open, naming what it pins |
| `lib/guard.js` | the `blockers()` comment gains its conclusion and the date it was taken |
| `TODO.md` | three entries out, two bullets merged into one, two new entries in |

No file is created. No file is deleted.

## Task 1: why `conflict()` fails open on interfaces

**Files:**
- Modify: `lib/plantasks.js` — the comment inside `conflict()`
- Modify: `tests/plantasks.test.js` — one comment above an existing test
- Modify: `TODO.md` — remove the `conflict()` entry from `## Waiting`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing.

**Dispatch:** in-session — the reasoning is the deliverable, and it was worked out in this session's design stage rather than written here for someone else to transcribe.

### Steps

1. In `lib/plantasks.js`, `conflict()` currently reads:

```js
function conflict(a, b) {
    // Fail closed. A task that declared no files has no ownership to compare,
    // and reading "nothing declared" as "nothing shared" is how the one task
    // nobody checked runs beside the task it overwrites.
    if (!a.modify.length || !b.modify.length) return 'undeclared';
    const files = [
        [a.modify, b.modify], [a.modify, b.test],
        [a.test, b.modify], [a.test, b.test],
    ];
    if (files.some(([x, y]) => shares(x, y))) return 'files';
    if (shares(a.consumes, b.produces) || shares(b.consumes, a.produces)) return 'interface';
    return null;
}
```

Insert this comment immediately above the `if (shares(a.consumes, ...))` line:

```js
    // And fail open here, which is not the block above being inconsistent. An
    // empty `Files:` is a malformed task — every task modifies something — so
    // nothing declared there is a declaration nobody wrote. An empty
    // `Interfaces:` is a real answer, and the two the fixture in
    // tests/plantasks.test.js writes are the two a plan actually contains:
    // `Consumes: nothing from an earlier task.` is what the first task of every
    // plan says, and `Produces: nothing.` is what the last one says. Failing
    // closed here would refuse to parallelise Task 1 with anything, in every
    // plan there will ever be, which is the whole feature.
```

2. Run `node --test tests/plantasks.test.js` and watch it pass. Nothing executable changed, so a failure here means the edit landed inside a string or broke the file.

3. In `tests/plantasks.test.js`, the test whose line begins `test('disjoint files and no edge may run at once'` already builds both tasks with empty consumes and empty produces, so it is the pin on the paragraph above. Put this comment immediately above that `test(` line:

```js
// Both tasks here declare empty interfaces, which is what makes this the pin on
// `conflict()` failing open on them. Make interfaces fail closed the way files
// do and this is the test that goes red.
```

4. Run `node --test tests/plantasks.test.js` again and watch it pass.

5. In `TODO.md`, delete this entire line from `## Waiting`:

```
- Whether `conflict()` fail closed on `Files:` but fail open on `Interfaces:` lets a dependent pair run at once — [lib/plantasks.js](lib/plantasks.js). The plan skill mandates the block. 08-31.
```

6. Run `node scripts/todo-check.js`. It must report one fewer waiting entry and no problems.

7. Commit. Subject: `docs: the asymmetry conflict() relies on had never been written down`

## Task 2: the conclusion the `deny` liveness comment stops short of

**Files:**
- Modify: `lib/guard.js` — the comment above `blockers()`
- Modify: `TODO.md` — remove the `deny` liveness entry from `## Waiting`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing.

**Dispatch:** in-session — same reason as Task 1, and it edits `TODO.md`, which Task 1 also edits, so it could not run beside it in any case.

### Steps

1. In `lib/guard.js`, the comment above `blockers()` currently ends:

```js
// costs a prompt that names its holder and passes on one keypress. `deny` is
// where it would cost something real, and `deny` is the one nobody gets by
// default.
```

Append these lines to that comment, directly after the `// default.` line:

```js
//
// Left that way on 2026-08-31, after asking whether `deny` should flip it. It
// should not. `deny` is opt-in, and `reasonFor` ends every refusal it produces
// with the `guard off` command, so a lockout from a registry this cannot read
// describes itself and is one command from over. Flipping it would turn the one
// mode somebody chose because a missed collision is unacceptable into the one
// mode that misses every collision the moment a directory stops being readable.
// The current direction is pinned by the test named `when liveness cannot be
// measured, every active claim blocks` in tests/guard.test.js.
```

2. Run `node --test tests/guard.test.js` and watch it pass.

3. In `TODO.md`, delete this entire line from `## Waiting`:

```
- Whether `deny` needs the liveness fallback flipped — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "Then it stopped being opt-in". Unmeasurable liveness blocks. 08-30.
```

4. Run `node scripts/todo-check.js`. One fewer waiting entry, no problems.

5. Commit. Subject: `docs: the deny liveness question was answered where it was asked`

## Task 3: two bullets that were one question, and two entries this survey produced

**Files:**
- Modify: `TODO.md` — merge two `## Waiting` bullets, add one `## Ready` entry and one `## Needs a decision` entry

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing.

**Dispatch:** in-session — three line edits in one file, and the file is the one both earlier tasks also touch.

### Steps

1. In `TODO.md`, these two `## Waiting` bullets ask one question and are blocked on the same trigger:

```
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
```

Replace both with this one:

```
- A per-`agent_type` subagent brief, and whether it carries more than the map — [docs/subagents.md](docs/subagents.md). The `SubagentStart` matcher allows it; real use says which types earn one. 08-31.
```

2. Under `## Ready`, add:

```
- `survey.js --tree` prints nothing unless `--root` is passed too — [scripts/survey.js](scripts/survey.js), line 410 gates the tree on `opts.root`. Silent, so it reads as an empty tree. 08-31.
```

3. Under `## Needs a decision`, add:

```
- How to look at `.fankeel/sessions/` without a session open — a generated HTML page, a `task.js` verb, or neither. `/fankeel` already lists and `clear` already deletes; the view from outside is what is missing. 08-31.
```

4. Run `node scripts/todo-check.js`. It must report `1 ready, 1 needs a decision, 12 waiting`, all links resolving, none over the cap.

5. Run `npm test` and watch the suite stay green.

6. Commit. Subject: `docs: one question was filed twice, and two the survey found were filed nowhere`

## Not in this plan, and why

`Whether an output style reaches subagents at all` stays in `## Waiting`, unchanged.

The survey reclassified it as something one dispatch would settle. That was wrong in this session: `~/.claude/settings.json` carries no `outputStyle` key and neither does any project settings file, so no style is active and there is nothing for a dispatched subagent to detect. A style is chosen in `/config` by the user and is not this plan's to set. The entry is correctly filed until somebody runs the check with one of the three active.
