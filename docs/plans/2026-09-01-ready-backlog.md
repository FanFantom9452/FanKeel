---
status: design-intent
last_verified: 2026-09-01
source_of_truth: docs/registry.md, docs/collisions.md, lib/dirty.js, scripts/map.js
---

# Ready Backlog Implementation Plan

**Goal:** close the three `TODO.md` `## Ready` entries that are documentation
defects, and leave the fourth — the `hooks/gate.js` probe — filed with the
precondition this survey established, because no session on this machine can run
it.

**Architecture:** four tasks, all prose edits to pages whose role is
`reference`. Three correct a page against code that already disagrees with it;
the fourth rewrites the index entries those three close. No source file changes,
so the whole plan is verified by `npm test`, `node scripts/docs-check.js`,
`node scripts/todo-check.js` and reading. Task 4 runs last because an index
entry removed while its work is undone is a lie in the one file `/fankeel` reads
aloud.

**Tech Stack:** Node's built-in test runner (`package.json` → `"test": "node
--test"`). No dependencies, and none may be added — `package.json` declares no
`dependencies` or `devDependencies` block at all.

**Spec:** no design stage on this route. The argument is `TODO.md` `## Ready`
plus the survey findings recorded in this session, each cited to `path:line`
below.

## Global Constraints

Generated 2026-09-01 from `.fankeel/map.md`, `package.json`, `.fankeel/docs.json`
and the suite. There is **no `CLAUDE.md` and no `AGENTS.md`** in this repository —
`scripts/map.js` reports "no directory tree found in CLAUDE.md, AGENTS.md,
README.md" — so conventions come from the code and the map, not from a
conventions file.

| Constraint | Value | Source |
|---|---|---|
| suite baseline | 980 pass, 0 fail, `npm test` exit 0 | measured 2026-09-01, unpiped |
| docs baseline | exit 0; 55 markdown files, tree `flat`, 21 archive / 1 decision / 12 plan / 21 reference | `node scripts/docs-check.js` |
| todo baseline | exit 0; 15 entries — 4 ready, 0 needs a decision, 11 waiting | `node scripts/todo-check.js` |
| `TODO.md` entry cap | 200 characters | `scripts/todo-check.js:42`, `MAX_ENTRY_CHARS` |
| `TODO.md` headings | only `## Ready`, `## Needs a decision`, `## Waiting`; a `## Waiting` entry needs an `MM-DD` stamp | `scripts/todo-check.js`, `SECTIONS` |
| `TODO.md` link target | must resolve, and must not be a `plan`, `decision`, `report` or `archive` document | `scripts/todo-check.js` |
| claim cap | `MAX_CLAIMS = 60` | `lib/registry.js:45` |
| skill version | `skills/fankeel/SKILL.md` frontmatter `version: 0.40.0` must equal `package.json` version | `tests/version.test.js` |
| doc roles | `docs` → `reference` (depth 1), `docs/decisions` → `decision`, `docs/plans` → `plan`, `skills` → `reference` | `.fankeel/docs.json` |
| prose width | wrap at 80 columns, matching the surrounding paragraphs. A recent commit exists solely to undo a 106-character line | `git log`, commit `960bdd9` |

**Line numbers in this repository's own `docs/plans/` are allowed to drift.**
`docs/plans/2026-09-01-six-decisions.md:342` cites `docs/registry.md:222-223` and
already points at the wrong text today. That page's role is `plan`, which records
a moment, and `scripts/docs-check.js` deliberately passes a citation that drifted
but still resolves. **Do not repair it, and do not constrain an edit to keep a
line count stable on its account.**

## File structure

| File | Responsibility |
|---|---|
| `docs/registry.md` | Modified by Tasks 1 and 3. The `reference` page for what is written to disk. Two separate paragraphs plus one table cell. |
| `skills/fankeel/SKILL.md` | Modified by Task 2. Prose only; the frontmatter `version` is not touched. |
| `docs/pipeline.md` | Modified by Task 2. One sentence, plus its wrap. |
| `docs/decisions/fankeel-shell.md` | Modified by Task 3. Role `decision` — see the note on that task. |
| `TODO.md` | Modified by Task 4. Three entries removed, one rewritten. |

No test file is created. These are prose corrections to pages no test asserts
the text of: `grep -rln` over `tests/` for the five page names returns files that
reference the *paths* structurally (`tests/version.test.js` builds a
`skills/<name>/SKILL.md` tree, `tests/todo-check.test.js` writes a fixture named
`docs/pipeline.md`), and none that assert a sentence being changed here.

---

## Task 1: `docs/registry.md` stops contradicting `docs/collisions.md`

`TODO.md` `## Ready`, entry 2. The page summarises claiming in two places and
the code backs `docs/collisions.md` at both.

**Files:**
- Modify: `docs/registry.md` — the `claims` summary paragraph and the
  `.gitignore` row of the writers table

**Interfaces:**
- Consumes: nothing.
- Produces: nothing any later task references by name. Task 4 removes the
  `TODO.md` entries this closes, and does so by their text, not by a symbol.

**Dispatch:** in-session — this session is instructed not to use the Agent tool,
so every task here is implemented in this context. Nothing goes out and there is
no spend to disclose.

### 1a — the sixty-path cap

Find, at `docs/registry.md:80-82`:

```
A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, oldest dropped, each recorded whole and
never truncated, because nothing here is a path a human retypes.
```

"oldest dropped" is `addClaim`'s behaviour and it is true of `addClaim`
(`lib/registry.js:551`, `data.claims = claims.slice(-MAX_CLAIMS)`). As the
summary of claiming it is wrong, because the other writer does the opposite:
`lib/dirty.js:173` is

```js
if (written.length > registry.MAX_CLAIMS) return { added: 0, declined: written.length };
```

— a git pass over sixty is refused **whole**, and `docs/collisions.md:120` says
so: "a pass holding more than sixty paths claims none of them."

Replace with:

```
A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, each recorded whole and never truncated,
because nothing here is a path a human retypes. The two writers reach that cap
from opposite directions. A path arriving on its own drops the oldest to make
room (`lib/registry.js:551`); a git pass holding more than sixty is refused
whole rather than trimmed (`lib/dirty.js:173`), because trimming it would evict
every claim an edit earned and put build output in its place.
[collisions.md](collisions.md) is the page for that.
```

### 1b — the per-path write cost

Find, at `docs/registry.md:359-361`:

```
Four of them are registered in hooks and three have ever run. `inject.js` writes
on every prompt — twice over, once for the claims git found and once for
`updated` — in every session on the machine. `resume.js` writes once per
```

"twice over" undercounts. `lib/dirty.js:177-181` loops the paths git found and
calls `registry.addClaim` once per path that is not already held; each
`addClaim` goes through `update`, which takes the lock and writes. So the claims
half is one write **per new path**, which is what `docs/collisions.md:46-50`
says: "the lock is paid for once per new path, not once per edit."

Replace the first three lines with:

```
Four of them are registered in hooks and three have ever run. `inject.js` writes
on every prompt — once for `updated`, and once more for every new path the git
pass claims, since `lib/dirty.js:180` calls `addClaim` per path and each one
takes the lock — in every session on the machine. That second number is usually
zero after a task's first prompt, because `covers` skips a path already held.
`resume.js` writes once per
```

Leave the rest of that paragraph (`answered question.` onward) untouched.

### 1c — who writes `.fankeel/.gitignore`

Find, at `docs/registry.md:32`:

```
| `.fankeel/.gitignore` | Yes | Created with the directory |
```

`TODO.md` `## Ready`, entry 4. Creation is not the only writer.
`lib/registry.js:199` writes one line, `sessions/`, and only when the file is
missing. `scripts/map.js:37` iterates `['sessions/', 'build/', IGNORE_LINE]` and
appends whatever is absent, on **every** `map.js` run. Verified by running
`node scripts/map.js` in this session: the file afterwards holds `sessions/`,
`map.md`, `build/` — which is what the tree diagram at `docs/registry.md:18`
already shows, so the diagram is right and only this cell is wrong.

Replace with:

```
| `.fankeel/.gitignore` | Yes | `lib/registry.js:199` creates it holding `sessions/` alone; `scripts/map.js:37` adds `build/` and `map.md`, on every map run rather than at creation |
```

The row is one line however long — the table's other rows already run past 80
columns, so the width constraint does not apply inside it.

### Test cycle

1. `node scripts/docs-check.js` — expect exit 0.
2. `npm test` — expect 980 pass, 0 fail.
3. Read `docs/registry.md:78-90` and `docs/registry.md:355-368` back against
   `docs/collisions.md:46-50` and `docs/collisions.md:118-121`. The claim to
   check is that no sentence on either page now says a thing the other denies.
4. Commit.

---

## Task 2: the `▌` form is the lead line, not the badge

`TODO.md` `## Ready`, entry 3. `docs/statusline.md` is precise about two
different files and two different renders; two other pages collapse them.

- badge — one word to `~/.claude/modes/<session_id>/fankeel`, rendered
  `[FANKEEL:DESIGN]` (`docs/statusline.md:19`)
- lead line — the whole line's worth to `<session_id>/fankeel.lead`, rendered
  `▌FANKEEL BUILD   ●●●○○  ⚿ on  ⚑2  …` (`docs/statusline.md:22-27`), and
  TokenBar promotes it by itself only **from v1.4.1**; before that `$leadPlugin`
  had to be set by hand (`docs/statusline.md:31-36`)

**Files:**
- Modify: `skills/fankeel/SKILL.md` — one sentence at `:398-399`
- Modify: `docs/pipeline.md` — one sentence at `:96-98`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** in-session — same reason as Task 1.

### 2a — `skills/fankeel/SKILL.md`

Find, at `:398-399`:

```
When they advance, run `task.js stage <name>`; the statusline badge reads it, so
`▌FANKEEL DESIGN` becoming `▌FANKEEL BUILD` is how they see the move.
```

Replace with:

```
When they advance, run `task.js stage <name>`; the statusline reads it, so
`[FANKEEL:DESIGN]` becoming `[FANKEEL:BUILD]` is how they see the move — and on
a TokenBar from v1.4.1, the `▌FANKEEL BUILD` lead line above it as well
([docs/statusline.md](../../docs/statusline.md)).
```

Do not touch the frontmatter. `version: 0.40.0` must keep matching
`package.json`, which `tests/version.test.js` asserts.

Note that the copy the `Skill` tool loads is the installed plugin cache at
`~/.claude/plugins/cache/fankeel/fankeel/0.40.0`, which lags this repository.
The edit lands here; it does not change what a running session reads.

### 2b — `docs/pipeline.md`

Find, at `:96-98`:

```
first stage on the route, `survey` unless `--route` said otherwise, and taking
stock is what `survey` is for, so it happens in the same turn — otherwise the badge reads `▌FANKEEL SURVEY` at the exact moment nothing
has been surveyed.
```

The middle line is 113 characters, which is the defect commit `960bdd9` exists
to prevent. Replace with:

```
first stage on the route, `survey` unless `--route` said otherwise, and taking
stock is what `survey` is for, so it happens in the same turn — otherwise the
badge reads `[FANKEEL:SURVEY]` at the exact moment nothing has been surveyed.
```

### Test cycle

1. `node scripts/docs-check.js` — expect exit 0, and the new relative link
   `../../docs/statusline.md` resolving from `skills/fankeel/`.
2. `npm test` — expect 980 pass, 0 fail. `tests/skills.test.js` reads
   `skills/fankeel/SKILL.md` for several shapes; this is the task that could
   break one.
3. `grep -rn '▌FANKEEL' docs/ skills/ README.md` — every remaining hit should be
   inside `docs/statusline.md`, where the lead line is the subject.
4. Commit.

---

## Task 3: two pages state a negative the registry disagrees with

**This task is not one of the four `TODO.md` entries.** It came out of the survey
while chasing entry 1, and it is separable — Tasks 1, 2 and 4 stand without it.

`docs/registry.md:30` and `docs/decisions/fankeel-shell.md:456` both say `gateAt`
and `waited` have *never* been written. A record on disk carries one:
`.fankeel/sessions/cb8cee7b-8ae0-41bd-9f8a-57317d1846dc.json` holds
`"waited": {"verify": 28660}`. Its provenance is settled and documented —
`docs/plans/2026-09-01-stage-timing-design.md:103` describes the probe as taken
"after draining a hand-run stamp", so the value is the residue of a hand-run
`gateOpen`/`gateClose` pair, not the hook firing.

So the *intent* of both sentences is correct: `hooks/gate.js` has still never
been observed to run. Only the absolute wording is false, and it is false against
a file a reader can open today.

`docs/decisions/fankeel-shell.md` has role `decision` — written once, not
maintained. The argument for editing it anyway is that the section is titled
"What is still a guess" and already keeps two superseded corrections on purpose:
"Both overstatements are kept here, because each looked like the correction of
the one before it." A third correction is the pattern that page established, not
a departure from it. **If that reading is rejected at the gate, drop 3b and keep
3a** — `docs/registry.md` is `reference` and must match reality either way.

**Files:**
- Modify: `docs/registry.md` — one table cell at `:30`
- Modify: `docs/decisions/fankeel-shell.md` — one sentence at `:455-456`

**Interfaces:**
- Consumes: Task 1 has already edited `docs/registry.md`. This task edits a
  different line of it and must run after Task 1, not beside it.
- Produces: nothing.

**Dispatch:** in-session — same reason as Task 1.

### 3a — `docs/registry.md:30`

Find, in that row, the trailing clause:

```
`gate.js` and `resume.js` for `gateAt` and `waited`, neither of which has ever been written
```

Replace with:

```
`gate.js` and `resume.js` for `gateAt` and `waited`, neither of which either hook has ever been seen to write
```

### 3b — `docs/decisions/fankeel-shell.md:454-457`

Find:

```
written to mark the moment a gate opened; `hooks/resume.js` is the other end and
works. The hook has never run: no record has carried a `gateAt` or a `waited`,
and two sessions since the file landed recorded neither, one of them four stages
deep with `clock` and `burn` written to the same entry by the sibling hooks.
```

Replace with:

```
written to mark the moment a gate opened; `hooks/resume.js` is the other end and
works. The hook has never run: no record has carried a `gateAt` or a `waited`
that a hook put there, and two sessions since the file landed recorded neither,
one of them four stages deep with `clock` and `burn` written to the same entry
by the sibling hooks. One record does carry a `waited` — session `cb8cee7b`'s
`{"verify":28660}` — and it is the hand-run stamp
[the stage-timing design](../plans/2026-09-01-stage-timing-design.md) drained
before its own probe, not a gate anything opened. Read without that clause the
sentence is false against a file in `.fankeel/sessions/` today, which is the
third time this paragraph has been written wider than it reaches.
```

### Test cycle

1. `node scripts/docs-check.js` — expect exit 0, including the new relative link
   `../plans/2026-09-01-stage-timing-design.md` from `docs/decisions/`.
2. `npm test` — expect 980 pass, 0 fail.
3. `grep -rn 'has ever been written\|never been written' docs/` — expect no hit
   that is still absolute about `gateAt` or `waited`.
4. Commit.

---

## Task 4: `TODO.md` closes three entries and sharpens the fourth

Runs last. Whoever finishes the work removes the entry in the same change, and
`TODO.md` is read aloud by `/fankeel` every time a session starts, so an entry
removed ahead of its work is the one lie that gets read most often.

**Files:**
- Modify: `TODO.md` — three `## Ready` entries deleted, one rewritten

**Interfaces:**
- Consumes: Tasks 1, 2 and 3 having landed. If Task 3 is dropped at the gate,
  4a still applies unchanged — Task 3 closes no `TODO.md` entry.
- Produces: nothing.

**Dispatch:** in-session — same reason as Task 1.

### 4a — delete the three closed entries

Delete these three bullets from `## Ready`, whole:

- the one beginning "`docs/registry.md` summarises claiming and contradicts" —
  closed by Task 1a and 1b
- the one beginning "`skills/fankeel/SKILL.md` shows a stage change as" —
  closed by Task 2
- the one beginning "`docs/registry.md` names only creation as writing" —
  closed by Task 1c

### 4b — rewrite the probe entry

The remaining entry stays under `## Ready`: it needs nothing but someone's hands,
and the bullet is its own specification. It gains the precondition this survey
established and loses nothing.

Find:

```
- Run the `AskUserQuestion` `PreToolUse` probe in a Claude Code started after the registration — [hooks/gate.js](hooks/gate.js). Ask one question, read `gateAt` while it is still open. 09-01.
```

Replace with:

```
- Run the `AskUserQuestion` `PreToolUse` probe in a Claude Code whose **process** started after the manifest — [hooks/gate.js](hooks/gate.js). Ask one question, read `gateAt` while it is open. 09-01.
```

That is 199 characters — measured, not estimated — against the 200-character cap
at `scripts/todo-check.js:42`. One character of headroom, so any further wording
change has to be re-counted rather than eyeballed.

The reason the word `process` is bolded: this session could not run the probe.
It runs under pid 400028, started 2026-08-31 23:55:39 local, where the manifest
at `~/.claude/plugins/cache/fankeel/fankeel/0.40.0/.claude-plugin/plugin.json`
was written 2026-09-01 02:03:37. A null reading here would prove nothing, and
`docs/decisions/fankeel-shell.md` records two earlier occasions when a real
measurement was made to carry a conclusion one step wider than it reached.

### Test cycle

1. `node scripts/todo-check.js` — expect exit 0 and `1 ready`.
2. `wc -m` on the rewritten bullet — expect at most 200.
3. `node scripts/docs-check.js` and `npm test` — expect exit 0 and 980 pass.
4. Commit.
