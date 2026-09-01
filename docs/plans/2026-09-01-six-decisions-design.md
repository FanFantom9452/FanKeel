---
status: design-intent
source_of_truth: TODO.md
---

# Six deferred decisions, settled

`TODO.md` carried five entries under `## Needs a decision` and two under
`## Ready`. A sixth decision was found during this task's own survey and joined
the scope at the survey gate. This page records what was decided and why, so the
questions stop being re-opened.

Nothing here is a new subsystem. The class is `architectural` because `CLASSES`
in `lib/stages.js` is the route table the whole pipeline reads, and it was one of
the six under consideration.

## The six

### 1 · `LINE_MAX` becomes 120

`scripts/task.js:317`. The bound is on the rendered line, and the fixed columns
ahead of the task measure 34 characters, so `room` at `task.js:348` is
`100 - 2 - 34 - 2 = 62`. The median task on this registry is 68 characters, and
32 of 56 rows exceed the bound — **more than half the listing is losing its tail
today**.

At 120 `room` becomes 82 and the median survives. The 80-column argument in the
comment above the constant does not survive contact with the number: a 100
character line already wraps at 80, so nothing is given up by widening it.

Not chosen: removing the cap. `task` text has no length bound at write time —
`lib/registry.js` trims `note` and `next` only — so one long task line would
break the column alignment of a fifty-row listing.

### 2 · `audit` joins neither `spike` nor `bounded`

`lib/stages.js:407`. `docs-check.js` runs at **`verify`**
(`skills/fankeel-verify/SKILL.md:67`), which is already on `bounded`'s route, so
a scoped change is checked mechanically without the `audit` stage. What `audit`
adds over that is `docs-audit.js`, the fortnightly sweep — running it on every
scoped change is the wrong cadence for it.

`spike` is defined as a route whose output is an answer and whose build is
labelled throwaway. Auditing documents against throwaway code answers nothing.

`/fankeel-audit` runs the whole pass without a task, which is what makes this
cheap to decide: nothing is lost, because the sweep was never gated on a route.

### 3 · `fork` joins `carry.js`'s matcher, reusing the guard already there

`.claude-plugin/plugin.json` registers `carry.js` on `SessionStart` with
`"matcher": "clear"`. `fork` is one of the five sources `hooks/carry.js:18` names
and is matched nowhere.

The reason it was excluded is recorded at
`docs/archive/2026-08-28-task-end-design.md:233`: *fork is unmeasured, and its
predecessor may still be live where a cleared one is certainly dead. The same
handling would tell someone to take a task off a running session.*

**That reason is already handled by code that was there when it was written.**
All three cases are covered:

| case | what stops the wrong offer |
|---|---|
| `fork` keeps the session id | `carry.js:59` — `entry.sessionId === sessionId` is skipped |
| `fork` changes it, predecessor live | `carry.js:60` — `live.isLive` skips it, and `lib/live.js:138` turns *unknown* into live, which is the safe direction |
| `fork` changes it, predecessor dead | the offer is correct, and is the whole point |

So the matcher becomes `clear|fork` and no new guard is written. A second
liveness check would be a second thing to keep in step with the first.

### 4 · `survey.js` gains one pattern, for `UPPER_SNAKE` consts only

`scripts/survey.js:49`. The fourth JS pattern requires the right-hand side to be
`(`, `function`, or an arrow — it matches **function-valued consts only**. A
module-level data constant is invisible to the scanner even in a language it
fully supports.

This is not the `## Waiting` entry about languages `survey.js` does not know. It
is a declaration kind missing from a language it does know, and it produced a
wrong answer during this task's own survey: `survey.js LINE_MAX CLASSES` reported
zero declarations while both constants existed. In a tool where "nothing matched"
is documented as a finding, that is worse than an incomplete answer.

The pattern added is `^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=` — it
catches `CLASSES`, `LINE_MAX`, `MAX_ENTRY_CHARS`, `FULL_ROUTE`, `JS_PATTERNS`,
and skips the ordinary lowercase local. It narrows by naming case and not by
scope — nothing line-based can see scope, so a `const LOCAL_MAX = 5` inside a
function is reported too, which is accepted: a name shouted in capitals is one a
reader came looking for.

Not chosen: matching every `const`, which would turn each local variable into a
declaration and bury real hits under a capped report.

Known limit, accepted: a module-level data constant in camelCase stays invisible.

### 5 · `readSession` stays silent

`lib/registry.js:140`. A wrong session id resolves to a path that does not exist,
which is byte-for-byte what a session not using the plugin looks like. There is
no signal to tell the two apart, so any output would fire for every non-fankeel
session as well — and every hook here is built on the opposite contract: exit 0
on every path, cost nothing for a session not in the mode.

Every hook takes its id from `payload.session_id` and never from typed input
(`brief.js:33`, `carry.js:47`, `gate.js:27`, `guard.js:24`, `inject.js:52`,
`resume.js:28`, `touch.js:28`), so a "wrong id" would mean Claude Code passed a
wrong one, not that anybody mistyped.

The visibility this entry was worried about is already provided where a person
can act on it: `readAll` returns the unreadable count beside the entries, for the
caller that is a person asking rather than a hook firing, and `task.js` refuses
an id no running session claims.

### 6 · `docs-check.js` keeps its mechanical-only rule

`scripts/docs-check.js:8-18` states the boundary in its own header, and the
proposed check cannot be decided mechanically: a `path:line` that still resolves
but points at the wrong line requires knowing what it was meant to point at, and
nothing records that. The tool already reports `past-end` for a citation beyond
the end of a file, which is the part that *is* mechanical.

Five drifting citations in one build stay unreported, and that is `audit`'s work
— read by a person, which is what that stage is for.

## What was found, not decided

`PreToolUse` does not fire for `AskUserQuestion`. `TODO.md` carried this as a
`## Ready` probe; the probe ran during this task and returned a negative.

| evidence | |
|---|---|
| registration | present in the copy that runs — the cache `plugin.json` is byte-identical to the repo's, mtime `2026-09-01 02:03:37 +0800` |
| control session `9c173d5f` | ran 11:03–11:44 local, nine hours later, route `design,build,verify,land` to completion. `clock` and `burn` written by the sibling hooks; no `gateAt`, no `waited` |
| this session | three gates with `active: true`; no `gateAt`, no `waited` |
| the one `waited` on record (`cb8cee7b`) | that session's task *was* building this feature, and its window straddles the commit that installed the hook — not evidence the hook fires |

`PostToolUse` on the same matcher fires on every answer.

**What happens to `hooks/gate.js` is not decided here.** It is dead code if the
event never arrives, but removing it, keeping it against a future Claude Code
release, or replacing the pair with a `resume.js`-only measurement are three
different answers and none of them was in the six.

## The file table

| file | change |
|---|---|
| `scripts/task.js` | `LINE_MAX` 100 → 120; the comment above it loses the 80-column claim |
| `lib/stages.js` | unchanged — `CLASSES` keeps its three routes |
| `.claude-plugin/plugin.json` | `SessionStart` matcher `"clear"` → `"clear\|fork"` |
| `hooks/carry.js` | the header comment at `:18` stops saying `clear` alone |
| `scripts/survey.js` | one pattern added to `JS_PATTERNS` |
| `tests/dirty.test.js` | a test writing to a gitignored path, asserting `dirtyPaths` misses it |
| `tests/survey.test.js` | a test that a data `const` is found and a local is not |
| `docs/decisions/` | two pages: the hook silence, and the mechanical-only boundary |
| `docs/registry.md` | `:222` says `carry.js` runs on `matcher: "clear"` |
| `TODO.md` | eight entries removed — two `## Ready`, six `## Needs a decision` |

## Proves it done

- `npm test` green, from 975 to 978 — two new tests, and whatever the pattern
  change costs.
- `tests/dirty.test.js`: the new test **fails before** the gap is documented and
  passes after, or — if the decision is to leave `dirtyPaths` as it is — asserts
  the miss, which fails today only if someone later makes it not miss.
- `node scripts/survey.js LINE_MAX CLASSES` reports two declarations where it
  reports zero today. This is the one that fails now and passes after.
- `node scripts/todo-check.js` exits 0 with 12 entries: 11 under `## Waiting` and
  one new decision, the fate of `hooks/gate.js`.
- `node scripts/docs-check.js` exits 0 — the two new decision pages resolve.

## Against the map

`.fankeel/map.md` lists 53 documents, **0 planned-but-not-built**, 21 retired.
The pages this touches:

- `docs/registry.md` — current, and `:222` states the `clear` matcher. It becomes
  false and is on the table.
- `docs/pipeline.md:284` — the class table. **Unchanged**, because decision 2 is
  to leave `CLASSES` alone. This is the page that would have cost the most.
- `skills/fankeel/SKILL.md:250` and `skills/fankeel-survey/SKILL.md:203` — the
  same table, same reason, unchanged.

No conflict found with a page marked current.

## Unverified

Whether `fork` changes the session id. The design does not depend on the answer —
the table in decision 3 covers both branches — but it means the new matcher ships
without anyone having watched a `fork` reach `carry.js`.
