---
status: design-intent
last_verified: 2026-09-07
source_of_truth: lib/plantasks.js, scripts/ledger.js, lib/stages.js, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, skills/fankeel-verify/SKILL.md, skills/fankeel-design/SKILL.md
---

# Plan Quality and the Build Brief — Design

## The ask

Six mechanisms so that a plan reaches `build` without dropping the design's
promises, and a build implementer starts from a brief that names everything it
needs — plus a reviewer over the plan itself before its gate. Agreed in chat on
2026-09-07 after the station-reads-back session was read back: three verify
returns, ten fix rounds, and two `find /` stalls of 38 and 10 minutes, all
traced to the plan rather than to the implementers.

## What the survey found, and what it rules out

- `lib/plantasks.js:18` — `ENTRY` accepts `Modify`, `Test`, `Consumes` and
  `Produces` and nothing else; `parseTasks` keeps a task's name and those four
  lists, never its body. The plan header is not read at all
  (`lib/plantasks.js:13`: "This file reads a plan and nothing else").
- `scripts/ledger.js:40` — verbs `init`, `complete`, `ruling`, `show`,
  `groups`, `ranges`, each an `if (verb === ...)` block in `main` returning a
  string that `main` prints once.
- `tests/render.test.js:534` — every stage's injection stays under 2400
  characters at a 59-character plugin root. Measured on this checkout: plan
  2393, build 2386, verify 2394, design 2339. Every word added to an anchor
  displaces a word.
- `tests/skills.test.js:383` — a stage skill's `## Output` fence must equal
  `templateFor(stage)` in `lib/stages.js`; the two change together.
- `skills/fankeel-verify/SKILL.md:177` already sends anything half-built back
  to `build`. On 2026-09-06 five fix commits landed during `verify` with no
  reviewer, and the third return was made of their defects.
- `skills/fankeel-build/rationale.md:69` names a `task-brief` script and
  declines to write it, as out of that plan's scope.
- `TODO.md:63`, under `## Ready`: nothing checks that a design's file table
  reached the plan's tasks; three spec items were dropped on 09-06.

Rules out: a new hook (nothing here needs `PreToolUse`); any change to which
model a `**Dispatch:**` line names; a plan format other than markdown; a change
to `hooks/brief.js`, whose `SubagentStart` brief is a different thing from the
task brief below and stays as it is.

## 1. The Files block learns `Read:`

- A `- Read: \`path\` — why` entry lists a file the task depends on and does not
  change; `parseTasks` keeps it as `task.read`, taking only the first backticked
  token as `Modify` and `Test` do.
- A `Read:` of a file another task lists under `Modify:` or `Test:` serialises
  the pair: `conflict()` returns `'read'`, because a file mid-edit is not a file
  to read.
- Two tasks that both `Read:` one file do not conflict.
- `groups` names a `read` conflict the way it names a shared file, and `surfaces`
  is unchanged: a task's `Modify` list is still what decides `unsure`.

## 2. Every code fence names its file

- Inside a `## Task N` section, a fence whose info string is a language —
  anything other than none, `sh`, `bash`, `shell`, `console` or `text` — must
  have, within the three non-blank lines above it, a backticked path that
  appears in that task's Files block under `Modify`, `Test` or `Read`.
- A fence with no info string, or one of the five above, is a command or its
  output and is exempt.
- `lint` reports each fence that has no such line, and each path named on those
  lines that is not in the task's Files block.

## 3. Coverage is checked bullet by bullet

- The plan header's `**Spec:**` line names the design file, as a bare path or
  as a markdown link, resolved against the plan's own directory; `lint` reads it
  from there and refuses a plan whose header has no such line.
- A promise is every first-level bullet under a `## <digit>.` heading of the
  design, and every body row of its `## What proves it done` table.
- A promise's key is its first eight words, normalised: lower-cased, with
  backticks, asterisks and punctuation replaced by spaces and whitespace
  collapsed. The plan text is normalised the same way before the search.
- `lint` reports every promise whose key does not occur in the normalised plan
  text. A plan satisfies it by quoting each promise in a `## Coverage` table
  with columns `| promise | task |`; a struck promise is quoted there too, with
  `struck — <why>` in the task cell.
- Every backticked path in the design's `| file | change | dispatch |` table
  must appear in some task's `Modify` or `Test` list; `lint` reports the ones
  that do not.
- `lint` exits non-zero on any report and prints `lint: clean` otherwise.
- Replayed on `docs/plans/2026-09-06-station-reads-back.md` against its design,
  it names the x-axis bullet, the maximum-at-the-top bullet, the `data-state`
  bullet, the `/clear-stale` count row, and Task 7's `render()` fence among the
  fences with no file line. **It misses `waited`**, measured at the plan gate on
  2026-09-07: the design wrote that column in a paragraph, not a bullet, which
  is what the last bullet of section 7 is for.

## 4. A task goes out as a brief file

- `ledger.js --plan <f> brief <n>` writes
  `.fankeel/build/<plan>/task-<n>-brief.md` and prints its path.
- The brief holds, in order: the plan's `**Goal:**` and `**Spec:**` lines, the
  `## Global Constraints` block verbatim, the task's whole section from its
  heading to the next `## ` heading, and for every backticked identifier in its
  `Consumes:` entries the `Produces:` entry of the task that produces it.
- It ends with a fixed footer: the files this task may read are named above;
  never walk `/`, a home directory or a Temp directory; a file needed and not
  named is returned as `blocked: <the file>`; return status, paths and the test
  line, never a diff.
- The build dispatch carries three things, not four: one line on where the task
  fits, the brief path, and the report path. The reviewer gets the same brief
  path, the pinned range and the map path.
- `parseTasks` keeps each task's `body` — its section text — and the plan's
  `header` — everything before the first task heading — which `brief` reads.

## 5. The reviewer has a template, the implementer a contract

- The implementer returns a status line, the paths it wrote, the `ℹ pass` and
  `ℹ fail` line, and one line per new test in the form
  `<test name> — red when: <the mutation>`. A new test with no such line is a
  finding before the reviewer reads anything.
- A brief whose task text names a file its Files block does not list is returned
  as `blocked: <the file> is named but not declared` in the implementer's first
  turn, never built around.
- The reviewer's brief is one fixed template in the build skill: Part 1 Missing,
  Extra and Misunderstood against the task section and the `## Coverage` rows
  naming this task; Part 2 the mutation lines, re-running one of them; Part 3
  every changed line traces to the task. It returns `path:line — problem` lines
  or the word `clean`.
- The build anchor's entry line names the brief file and the reviewer template
  in place of `four-item brief`, within the cap.

## 6. A fix from verify is build's commit

- `verify` commits nothing: a defeated row is routed to `build` at the gate, as
  the verify skill already says, and its anchor now says a fix is build's commit
  with its own review range.
- In `build`, a fix is a row of the loop: BASE taken immediately before its
  commit, the parent commits it, one reviewer over `BASE..<sha>`, and
  `ledger.js --plan <f> --range A..B fix "<what>"` records it as a `Fix:` line.
- `ranges` lists `Fix:` lines beside task lines, so `verify` can see that every
  commit on the branch had a reviewer.

## 7. The plan gate has a reviewer

- Before the plan gate: `lint` clean, then one `sonnet` reviewer given the
  design path, the plan path and the lint output, returning only promises with
  no task and Files blocks that disagree with their task text, or `clean`.
- The plan's output shape gains two slots, `lint: <its line>` and
  `reviewer: clean | <n> gaps, fixed`, in `lib/stages.js` and the skill's
  Output fence alike.
- The design skill's success criterion gains one end-to-end row wherever the
  change produces an artefact — a rendered page, a written file, a printed
  report — checked against itself; and its sections whose bullets are promises
  are numbered, because that is what `lint` reads.

## File table

| file | change | dispatch |
|---|---|---|
| `lib/plantasks.js` | `Read:` in `ENTRY` and `task.read`; `'read'` conflict; `body` and `header` capture; `fences(task)`; `lint(planText, designText)` returning report lines | implementer, sonnet — the plan carries the code |
| `tests/plantasks.test.js` | the tests in the table below | same task |
| `scripts/ledger.js` | verbs `lint`, `brief`, `fix`; `ranges` lists `Fix:` lines; `--range` accepted by `fix` | implementer, sonnet — the plan carries the code |
| `tests/ledger.test.js` | the tests in the table below | same task |
| `lib/stages.js` | plan, build and verify anchor wording; plan template gains `lint:` and `reviewer:` | implementer, sonnet — exact sentences in the plan, iterated against `tests/render.test.js` |
| `skills/fankeel-plan/SKILL.md`, `skills/fankeel-plan/rationale.md` | `Read:`, the fence rule, `## Coverage`, `lint`, the plan reviewer, the Output fence | same task as `lib/stages.js` — the Output fence and the template are one test |
| `skills/fankeel-build/SKILL.md`, `skills/fankeel-build/rationale.md` | the brief file replaces the four things; the reviewer template; the return contract; `blocked:`; fix rows and the `fix` verb; the task-brief paragraph rewritten | implementer, sonnet — the plan carries the text |
| `skills/fankeel-verify/SKILL.md`, `skills/fankeel-design/SKILL.md` | a fix is build's commit and `ranges` shows it; the end-to-end criterion row and numbered sections | same task as the build skill |
| `docs/pipeline.md`, `docs/subagents.md`, `docs/README.md`, `TODO.md` | the sentences the above make false; the `## Ready` entry at `TODO.md:63` closed | in-session — describes the code as it finally landed |

## What proves it done

| test | fails now because |
|---|---|
| `tests/plantasks.test.js` — a `Read:` entry lands in `task.read`, and a Read of a file another task modifies serialises the pair as `read` | `ENTRY` has no `Read` |
| `tests/plantasks.test.js` — `lint` names a design bullet whose first eight words appear nowhere in the plan, a design file-table path in no task's Files, and a `js` fence with no file line above it | no `lint` exists |
| `tests/plantasks.test.js` — `parseTasks` keeps `header` and each task's `body` | neither is kept |
| `tests/ledger.test.js` — `brief 4` writes `task-4-brief.md` holding the constraints block, the task's section, the producer's `Produces:` entry for a consumed name, and the no-walk footer, and prints the path | no `brief` verb |
| `tests/ledger.test.js` — `lint` on a copy of the 2026-09-06 plan and design exits non-zero, names the x-axis bullet, `data-state` and the `/clear-stale` row, and pins that `waited` is missed | no `lint` verb |
| `tests/ledger.test.js` — `fix` with `--range` appends a `Fix:` line and `ranges` lists it | no `fix` verb |
| `tests/render.test.js` and `tests/skills.test.js` — every stage under 2400 and the plan Output fence equal to its template | green now; must stay green after both edits |
| end to end — `node scripts/ledger.js --plan docs/plans/2026-09-06-station-reads-back.md lint` on the committed plan names the five items in section 3 | the replay of the motivating case |

## Against the map

- `docs/pipeline.md:458-464` says "The brief a dispatch carries is four fixed
  things" and `docs/pipeline.md:435` draws the plan node without `Read:` or
  coverage; both become false and the docs task rewrites them.
- `docs/subagents.md` describes the `SubagentStart` brief; unchanged, and
  correctly so — the task brief is a file the dispatch names.
- The skills are reference pages and change in place.
- No page the map lists as `design-intent` describes any of this; the
  2026-09-06 station plan is `current`.

## Unverified

- Whether the three anchor rewordings fit under the cap without losing a rule:
  the room measured today is 7 characters on `plan`, 14 on `build` and 6 on
  `verify`, so each added clause displaces one, and which sentence gives way is
  decided in the plan and proven only by `tests/render.test.js` after the edit.
- Checked, not open: the eight-word key collides nowhere on the two designs in
  `docs/plans` — 18 and 29 bullets, all distinct — measured 2026-09-07.
