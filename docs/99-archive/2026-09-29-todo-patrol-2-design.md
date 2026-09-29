---
status: current
last_verified: 2026-09-29
---

# TODO 全表盤點 — design (2026-09-29)

Approach: close the three test gaps, make a session visible from its `/fankeel` prompt by writing a task-less `init` entry, and fold the effort decision into the existing station override entry.

| file | change | dispatch |
|---|---|---|
| tests/plantasks-lint-cap.test.js | read `assets/station/station.js` line count from disk instead of the literal 5174 | implementer, sonnet |
| tests/title-hook.test.js | env-only `CLAUDE_CODE_SUBAGENT_MODEL` test and control probe | implementer, sonnet |
| lib/todo.js | red-able tests; `--migrate` stops swallowing errors | implementer, sonnet |
| hooks/inject.js | write the init entry on a `/fankeel` prompt | implementer, sonnet |
| scripts/task.js | `start` takes over an init entry | implementer, sonnet |
| lib/station.js | init row shows 初始化中 | implementer, sonnet |
| docs/90-agent/todo/ | close/rewrite five entries | in-session — `todo.js` commands |

## 1. The station cap test

- `tests/plantasks-lint-cap.test.js` reads the line count of `assets/station/station.js` from disk instead of the literal 5174 at lines 25 and 28.

## 2. The subagent-model env order

- A test sets only `CLAUDE_CODE_SUBAGENT_MODEL` and asserts it ranks below the agent file's `model:` and above the session's model (`lib/title.js:119`).
- An env-only control probe is run once and its result filed as a dated report under `docs/90-agent/reports/`.

## 3. The todo gaps

- A test that goes red when the `unreadable folder` branch of `scripts/todo-check.js` is deleted.
- A test that goes red when `LC_ALL=C` handling is removed.
- `trackedIn` gets a mutation run, recorded in the ledger.
- `--migrate`'s `completions()` and `commitDay` stop swallowing errors: a failure is reported, not dropped.

## 4. The init entry

- On a `/fankeel` prompt from a session with no entry, `hooks/inject.js` writes `{active: true, stage: 'init'}` with no `task`, through `lib/registry.js`.
- `task.js start` takes over this session's own init entry instead of refusing it as an already-active task (`scripts/task.js:536`, `:1124`).
- Every reader of `data.task` copes with its absence — render, station, carry, show, title/brief hooks.
- Another session's injected `also in progress:` and `task.js show` list an init entry.
- The station shows an init row as 初始化中.
- `docs/90-agent/reference/registry.md` and `collisions.md` say an init session is visible.

## 5. The TODO entries

- `advisor-1` is closed with `todo.js done`: `/fankeel-ask` is user-invoked by design and the brain must not call an advisor.
- `model-1` is folded into `station-3`: fixed effort is already pinned in all 8 agent files; the user override comes from profile-generated `.claude/agents/` files that survive plugin updates.
- `collisions-1` and `station-2` are closed by the init entry.

## What proves it done

| check | how |
|---|---|
| cap test | change station.js length by one line → old literal red, new test green |
| env order | swap env/agent-file order in lib/title.js → new test red |
| todo | delete the unreadable-folder branch → new test red |
| init entry | A has only run `/fankeel`; B's `task.js show` lists A as init — red today, green after |
| station artefact | rendered station page shows A's row as 初始化中 and its live-row count equals the registry's active entries |

against the map: lib/registry.js — no conflict.
mockup: not frontend work — existing stage cell carries the word.
out of scope: the two-registry split and the two narrow liveness cases (no repro).
