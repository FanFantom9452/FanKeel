---
status: current
last_verified: 2026-10-16
---

# Opening a task prints its first stage's rules; the dirty tests stop timing out

`task.js stage` prints the new stage's rules since 0.111.3
(docs/03-decisions/2026-10-16-stage-prints-rules.md). `start` and `task`
(the rename) still print one `FIRST_STEP` sentence, so the first stage of a
task is the one stage that opens with no rules on screen until the next
prompt. Separately, `tests/dirty.test.js` fails under full-suite load because
`lib/dirty.js` gives git 2.5 seconds and answers `null` past that.

## 1. One opening block for start, task and stage

- `scripts/task.js` gains `openingLines(root, id, data, values)`, returning
  the controller block where `stage.agents` names `data.stage`, else
  `rulesLines(data, { values }, { root, sessionId: id })`; then build's hands
  lines, then land's todo lines; then a blank line and
  `進到這一站後在同一回合開工，不要先收回合。`.
- `cmdStage` replaces its own tail with `openingLines`; its output does not
  change.
- `cmdStart` and `cmdTask` print `openingLines` where they printed
  `controllerLines` or `FIRST_STEP`.
- `FIRST_STEP` is deleted. Its sentences are a second, drifted wording of the
  rules `rulesLines` already prints.

## 2. A git timeout tests can raise

- `dirtyPaths` reads its timeout from `FANKEEL_GIT_TIMEOUT` (milliseconds) at
  call time, 2500 when unset or not a positive number. The hook default does
  not move: the 2.5 s keeps UserPromptSubmit under its 5 s.
- `tests/dirty.test.js` and `tests/inject.test.js` (whose "a write no hook
  saw is seen on the next prompt" runs the same path through `inject.js`) set
  `process.env.FANKEEL_GIT_TIMEOUT = '30000'` at the top, which their child
  processes inherit, so a loaded machine slows the test instead of failing it. `tests/dirty-timeout.test.js` keeps the default and still
  proves the 2.5 s cut.

## 3. Records

- The decision record's last 放棄了什麼 bullet (start/task not done) is
  rewritten as done; `skills/fankeel/SKILL.md`'s sentence names `start` and
  `task` beside `stage`.

## What proves it done

| test | fails now | passes after |
|---|---|---|
| `start --route plan,build` output holds plan's first rule, plan's output shape, and ends with the same-turn line | prints `Now plan: …` only | — |
| `task "<new>"` on a started session prints the first stage's rules and the same-turn line | prints `FIRST_STEP` only | — |
| `dirtyPaths` with a git shim that sleeps 5 s and `FANKEEL_GIT_TIMEOUT=10000` returns the paths | returns `null` | — |
| full `npm test` in a clean worktree | 1–3 dirty tests fail | 0 fail |
