---
status: current
last_verified: 2026-09-30
---

# Patrol upgrade: the todo-4 and test-2 leftovers, `version.js --since`, and `fankeel-upgrade`

What the 2026-09-30 patrol (`TODO 全表盤點`) decided to build now: two small fixes the patrol found,
a release cut a caller can name, and a script and skill that bring a project up to what the
installed fankeel expects. It describes the work to be done, not the code as it is.

## 1. titledIds fallback (TODO todo-4)

- `titledIds` in `scripts/task.js:319` calls `todoFiles.load` (`lib/todo.js:535`) unguarded; when the todo folder cannot be read it must fall back to printing bare ids instead of throwing, for both callers (`describe()` near `scripts/task.js:338` and `todoLines()` near `:780`).

## 2. Moved citations (todo-4)

- `node scripts/docs-check.js` reports 6 moved `path:line` references: `docs/02-architecture/pipeline.md:249` and `:253`, `docs/90-agent/reference/subagents.md:786` and `:789`, `skills/fankeel-survey/SKILL.md:290` and `:297`. Each is fixed to the line docs-check says now holds the quoted text, and docs-check reports none of the six afterwards.

## 3. Build-section patrol assertion (TODO test-2)

- `tests/skills.test.js` (about 1312-1340): the survey and fankeel sections assert `doesNotMatch(/survey,build,land/)`; the build section (`buildSection`) has none. Add it, and prove it red-green: put `survey,build,land` into the patrol section of `skills/fankeel-build/SKILL.md`, see the test fail, revert, see it pass, with the commands and output recorded in the task's steps.
- The station project page's `todo-done` block has never been rendered and looked at. A `user`-dispatch task, last in the plan: the user opens the station page and confirms the block renders.

## 4. version.js --since

- `node scripts/version.js --changes --since <x.y.z>` lists the commits after the release commit whose subject matches `chore: <x.y.z>`, where the current cut (`scripts/version.js:100-134`) is the newest `/^chore: \d+\.\d+\.\d+\b/`. An unknown version exits 1 with a message; without `--since` the behaviour is unchanged; no git keeps the existing exit 1.

## 5. scripts/upgrade.js

- It detects by the project's current shape, never by a recorded version. Step (a): `TODO.md` still has a `## Waiting` section, so check reports it and `--apply` runs `todo-check --migrate` (`scripts/todo-check.js:551-684`, writes, idempotent).
- Step (b): a `todo`-role bucket exists in `.fankeel/docs.json`, its folder has no `.md` and `TODO.md` has entries, so it prints `node <plugin>/scripts/todo.js migrate --root <dir>` for a person, because that command throws on a second run (`lib/todo.js:612`). Step (c), docs-move: only a printed hint to `docs-move.js plan --to <preset>` when `docs.json` names no shape, never run. The `scope` to `claims` rename needs nothing (`lib/registry.js:709-717` reads the old field lazily), and the output says so instead of listing a step.
- Exit: check mode exits 1 when any step is pending and 0 when none is; `--root <dir>` is taken like the other scripts.
- `--apply` writes `<report bucket>/YYYY-MM-DD-fankeel-upgrade.md` (the report-role bucket `lib/docs.js` resolves) with frontmatter `fankeel: <plugin package.json version>` and a body listing what ran and what still needs a person.
- Before listing changes it finds the newest such report's `fankeel:` and runs `version.js --changes --since <that>`; with no report it runs plain `--changes`; when version.js exits 1 (no `.git` in an installed copy) it prints `changes unavailable: <reason>` and continues.

## 6. fankeel-upgrade skill

- `skills/fankeel-upgrade/SKILL.md` with `disable-model-invocation: true` (like `skills/fankeel-station/SKILL.md:4`) and `version:` equal to `package.json`'s: run `upgrade.js` check, show the changes, ask per pending step before `--apply`. It needs no `rationale.md` (the split is only `fankeel-build`, `fankeel-plan`, `fankeel-audit`, `tests/skills.test.js:251`) and does not touch `REQUIRED_CORE` (`tests/skills.test.js:1107`); the tests that do count skills (`tests/inventory.test.js`, `tests/contract.test.js:262`, `tests/version.test.js`) move from eleven skills and thirteen version places to twelve and fourteen.

## What proves it done

| test | passes when |
|---|---|
| `start --todo` and `stage land` print bare ids when the todo folder holds an unreadable entry file | `tests/task-todo.test.js`; red today with `EISDIR`, green with the guard |
| `node scripts/docs-check.js` lists none of the six moved references | exit 0 for those six, run after every other task |
| `tests/skills.test.js` fails when the build patrol section holds `survey,build,land` | red with the mutation, green after the revert, both outputs in the task steps |
| the station project page renders the `todo-done` block | the user says so after opening the page |
| `version.js --changes --since` lists the commits after that release, and exits 1 for an unknown one | `tests/version.test.js` |
| `upgrade.js` exits 1 with a `## Waiting` section, runs the migration on `--apply`, and exits 0 on an already upgraded project | `tests/upgrade.test.js`, with the already-upgraded project as the control |
| `--apply` writes the report with `fankeel:` and the next run reads it back | `tests/upgrade.test.js` |
| the twelfth skill keeps the skill, contract, inventory and version tests green | `npm test` |
