---
status: design-intent
last_verified: 2026-09-07
source_of_truth: TODO.md, tests/, scripts/docs-check.js, lib/station.js, scripts/ledger.js
---

# Clearing `TODO.md ## Ready`

Fourteen entries stood under `## Ready` on 2026-09-07. A survey read every one
against the line it cites. Two were already fixed and pinned by tests, one
turned out to be half a bug and half documented behaviour, one is blocked on a
setting only the user can make, and two were returned to the list as
measurements rather than changes. What is left is nine changes, and this is the
approach to them.

**The approach in one sentence:** stop the test suite leaking temporary
directories, then take the eight smaller entries in the order that leaves the
suite runnable throughout.

Entry 7 goes first for a reason that is not priority. Every other entry is
verified by running the suite, and a suite run measured on 2026-09-07 added 823
directories to a store that already holds 957,746. Fixing it first makes the
rest of the build cheaper; fixing it last means paying for it eight more times.

## 1. The tmp helper

- `tests/tmp.js` is new, and exports one function: it calls `fs.mkdtempSync`
  under `os.tmpdir()` with the prefix it is given, records the path, and returns
  it.
- A single `process.on('exit')` handler in that module removes every recorded
  path with `fs.rmSync(dir, { recursive: true, force: true })`, each in its own
  `try`/`catch` so one undeletable directory cannot strand the rest.
- `process.on('exit')` is the registration point rather than `test.after`,
  because `node --test` gives each test file its own process, so one handler per
  file covers every directory that file made. All 46 test files already import
  `node:test` as a default binding, so nothing about their imports changes.
- The 94 call sites across 33 test files each become one call to the helper.
  Most of them sit inside a per-file factory — `tmpClaude()` in
  `tests/badge.test.js:16`, `tree(files)` in `tests/docs-audit.test.js:29` — so
  the edit lands on far fewer than 94 lines.
- `tests/tmp.test.js` is new: it spawns a child process that takes a directory
  from the helper, writes a file into it and exits, then asserts the directory
  is gone. That test fails today because the module does not exist.

## 2. Clearing what is already there

- `scripts/tmp-clean.js` is new: it lists `os.tmpdir()`, removes every entry
  whose name begins with `fankeel-`, and prints how many it removed and how many
  it could not.
- It never removes an entry that does not carry that prefix, and it takes the
  prefix as a constant rather than an argument — a cleaner that can be pointed
  at an arbitrary name is a cleaner that can be pointed at the wrong one.
- `package.json` gains `"clean": "node scripts/tmp-clean.js"`.
- It is run once during build, against the 957,746 directories standing today.
  This is the one irreversible step in the plan, and the user asked for it
  explicitly at the design gate.
- The run is timed and the figure written into the build's report, because
  nobody has measured how long a deletion at this scale takes on this machine.

The alternative was a shell one-liner and no shipped script. It loses because
anyone who has ever run this suite has the same store, and because a script can
be tested where a one-liner in a commit message cannot.

## 3. `--root` resolves against the registry

- `scripts/docs-check.js:388` returns `values.root` as the raw string it was
  given. Run from inside the project it names, the documented command
  `--root Waypoint` resolves to a path that is not there, and the scanner
  reports "nothing readable".
- Both scanners resolve `--root` against the registry root — found the way the
  hooks find it — and fall back to the current directory when no registry is
  above them.
- `scripts/survey.js` takes the identical change, because the fankeel skill
  documents the same flag on both and a fix to one would make the pair disagree.
- A new test runs each scanner with `--root <project>` from inside that project
  and asserts the scan is not empty. Both fail today.

## 4. Unfiled markdown gets no role

- `scripts/docs-check.js:299` reads `const role = declared || 'reference'`,
  which grades every unbucketed markdown file as a reference page.
- `docs/documents.md:192-200`, a page the map lists as current, says the
  opposite: guessing `reference` "is not a safe default, it is the loudest one",
  and names a run where it produced twelve drift findings that were all plans
  doing their job. It permits reference-grading in exactly one case — a project
  with no tree at all.
- The code follows the page: `reference` is the fallback only when no tree was
  found; with a tree, an unbucketed file gets no role and is not graded.
- The second half of the TODO entry is closed rather than fixed. "Never listed
  as unfiled" is documented behaviour at `docs/documents.md:215` — the unfiled
  list is "only pages under the doc root. A README beside code is not misfiled."
- A new test declares a tree, puts an unbucketed markdown file outside the doc
  root, and asserts no finding is graded against it. It fails today.

## 5. The station cuts

- `lib/station.js:714-715` re-tallies the two counts `lib/station.js:634-635`
  already computed in `render()`. `render()` returns an HTML string, not the
  counts, so `write()` cannot read them off it: the loop is lifted into one
  `tally(model)` helper that both call. Written as "delete write's copy" first,
  and a reviewer ran it: 5 of 46 station tests failed on an undefined `counts`.
- `lib/station.js:102` returns a value from `rememberRoots` that its only caller
  — `lib/station.js:712` — discards as a bare statement. The return goes.
- `lib/registry.js:216,218` returns a boolean from `ensureIgnored` that both
  callers discard: `lib/station.js:704` and `scripts/map.js:31`. The return
  goes. `tests/registry.test.js:233,237` assert on it and are rewritten to
  assert on the file the function writes, which is what the callers care about.
- The TODO entry filed all three under `lib/station.js`. One of them is in
  `lib/registry.js`, and the entry is wrong about that.
- `tests/station.test.js` (46 tests) and `tests/station-cli.test.js` (15 tests)
  stay green with no change beyond the two registry assertions.

## 6. `adopt` pays `readAll` once

- `lib/registry.js:160` `readAll` reads and parses every session file under
  every discovered root on each `write()`, and `lib/station.js:688` `write()` is
  called on every `task.js` verb.
- `scripts/task.js:850` and `scripts/task.js:856` both reach `refreshStation` at
  `scripts/task.js:137` — once to hide the source session's badge and once to
  show this one's — so `adopt` pays the whole cost twice.
- `adopt` performs both badge changes and then refreshes once.
- A test asserts `refreshStation` is entered once per `adopt`. It fails today.

## 7. A ledger verb for the scan table

- `scripts/ledger.js` supports nine verbs: `init`, `complete`, `ruling`, `show`,
  `groups`, `ranges`, `lint`, `brief`, `fix`. None of them writes build step 3's
  scan table into `progress.md`, so two sessions on 2026-09-05 appended it by
  hand.
- `groups` already computes exactly that table and prints it. The new verb
  writes what `groups` prints into the ledger, so the table has one producer
  rather than two.
- `skills/fankeel-build/SKILL.md` step 3 names the new verb where it currently
  describes the table without saying how it is recorded.
- A test asserts the verb appends the table to `progress.md` and that a second
  run does not duplicate it. It fails today.

## 8. The grouping rule names fix rounds

- `skills/fankeel-build/SKILL.md:94-95` states the grouping rule as disjoint
  `**Files:**` and no task consuming another's output.
- A fix round writes its task's declared paths, so two fix rounds on one file
  collide exactly as two tasks would. The rule says nothing about them.
- `lib/plantasks.js` has no concept of a fix round at all — `grep fix` returns
  nothing in that file, and `groups()` and `conflict()` read only parsed plan
  tasks.
- The change is to the skill's prose, not to `plantasks.js`: the rule gains a
  sentence saying a fix round inherits its task's files for the purpose of the
  rule, so two rounds touching one file are sequenced rather than grouped.
- Nothing in the code changes, so nothing in the code can prove it. The
  criterion here is the audit stage reading the rule back and finding it covers
  the 2026-09-05 case.

## 9. The 08-30 plan is archived

- `docs-audit` names one document, not two:
  `docs/plans/2026-08-30-parallel-build-design.md`, 8 files, untouched 4 days.
  Its partner, `docs/plans/2026-08-30-parallel-build.md`, is not flagged.
- Only the flagged document moves to `docs/archive/`.
- `docs/README.md:40` is repointed at the new path. `docs/README.md:41` is left
  alone — the TODO entry claimed two rows needed repointing and both rows
  already resolve.
- `node scripts/docs-check.js` exits zero afterwards, which is what proves no
  link was left dangling.

## 10. The probe runs

- `.claude/agents/brief-probe.md` has never produced a reading. The attempt on
  2026-09-04 died on an agent registry that is only read at process start.
- This process loads it, so the fixture is dispatched once and its four lines
  are recorded in `docs/reports/2026-09-07-brief-probe.md`.
- A run with a non-zero tool count is void by the fixture's own terms and is
  reported as void rather than quietly rerun.
- `docs/README.md` gains the report's row.

## 11. What `TODO.md` says afterwards

- Entries 1 and 8 are removed: both were already fixed, and both are pinned —
  `tests/version.test.js:98-102` and `tests/render.test.js:270-284`.
- Entries 11 and 14 stay under `## Ready`, untouched. They are measurements
  rather than changes, and the user held them back at the design gate.
- Entry 13 stays. Its precondition is a `outputStyle` set in `/config`, which no
  settings file on this machine carries, and that is the user's to set.
- Every entry this plan closes is removed in the change that closes it, not in a
  sweep at the end.

## Success criteria

| | |
|---|---|
| entry 7 | `tests/tmp.test.js` fails today (no module) and passes after. **On the artefact:** the count of `fankeel-*` under `%TEMP%` is the same before and after a full `npm test`, where today it grows by thousands |
| entry 2 (clean) | `npm run clean` reports a removed count, and a second run reports zero |
| entry 5 | each scanner run with `--root <project>` from inside that project returns a non-empty scan; both fail today |
| entry 6 | an unbucketed markdown file outside the doc root, in a project with a tree, produces no graded finding; fails today |
| entries 9a-c | `tests/station.test.js` and `tests/station-cli.test.js` green before and after |
| entry 10 | `refreshStation` entered once per `adopt`; fails today |
| entry 4 | the new verb writes the table and is idempotent; fails today |
| entry 2 (rule) | audit reads the rule back against the 2026-09-05 collision |
| entry 3 | `docs-check` exits zero after the move |
| entry 12 | four lines recorded, or the run declared void |

## Against the map

`.fankeel/map.md` lists `docs/documents.md` as current, and section 4 above is a
contradiction between it and `scripts/docs-check.js:299`. This design resolves it
in the page's favour and says so rather than changing the code quietly.

`docs/station.md:72` describes `rememberRoots` as owning the root records; the
cut in section 5 removes only its unread return value, not that ownership, so
the page stays true.

`docs/registry.md:32` describes `ensureIgnored` by what it writes, not by what
it returns, so the cut in section 5 leaves it true as written.

No page the map lists as current describes `--root` as resolving against the
current directory; the fankeel skill documents it as overriding "where the
registry is", which is what section 3 makes true.

## Unverified

How long removing 957,746 directories takes on this machine. Nobody has done it,
the estimate could be minutes or hours, and section 2 times the real run rather
than predicting it.
