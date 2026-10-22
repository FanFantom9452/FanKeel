---
status: current
---

# A main-thread Stop hook for a turn that ends with nothing to wake it

The judgement [2026-10-22-stage-agent-pause](../judgements/2026-10-22-stage-agent-pause.md)
found the top cause of plan- and build-stage "pauses": the controller answers an
asynchronous event with a status line and `end_turn` while the stage is open and
nothing in the background will notify the session. `lib/stages.js:685` schedules a
wake-up for three cases only, and `.claude-plugin/plugin.json` registers no
main-thread `Stop` hook to catch the rest.

## 1. The check

- `lib/stop.js` exports `refusal(data, transcriptPath)`: the reason to refuse a stop, or null.
- It returns null when the session has no active task, no stage, or an `awayAt` mark (hooks/gate.js held a question for an away user and that turn is meant to end).
- It returns null when the session transcript shows background work still pending: a `Bash` or `PowerShell` call with `run_in_background: true`, or an `Agent` call whose result says `Async agent launched`, with no later `<task-notification>` naming its `<tool-use-id>`; or a `SendMessage` with no notification after it.
- Otherwise it returns a reason naming the stage and the three ways on: dispatch, `await.js` in the background, or the gate — and saying to end the turn again when answering or waiting on the user.

## 2. The hook

- `hooks/stop.js` reads the Stop payload, skips `stop_hook_active: true`, and prints `{"decision":"block","reason":...}` when `refusal` returns one; it exits 0 on every path and prints nothing for a session with no active task.
- `.claude-plugin/plugin.json` registers it under `Stop`.
- `docs/02-architecture/layout.md` rows it under `hooks/`, and `lib/stop.js` under `lib/`.
- The hook count in `docs/01-guide/development.md` and `tests/hook.test.js` goes from fourteen to fifteen.

## What proves it done

| check | test |
|---|---|
| a turn that ends on text with an active build task and nothing pending is refused | `tests/stop-hook.test.js` |
| a pending background `await.js` lets the stop through | `tests/stop.test.js` |
| `stop_hook_active` lets the stop through | `tests/stop-hook.test.js` |

## Files

| file | change | dispatch |
|---|---|---|
| `lib/stop.js` | new: `refusal`, `pendingWork`, `entries` | implementer, sonnet |
| `tests/stop.test.js` | new: unit tests over synthetic transcripts | implementer, sonnet |
| `hooks/stop.js` | new: the Stop hook | implementer, sonnet |
| `.claude-plugin/plugin.json` | register `Stop` | implementer, sonnet |
| `tests/stop-hook.test.js` | new: the hook end to end | implementer, sonnet |
| `docs/02-architecture/layout.md` | a `stop.js` row under `hooks/` and one under `lib/` | implementer, sonnet |
| `docs/01-guide/development.md`, `tests/hook.test.js`, `tests/contract.test.js` | the hook count, fourteen → fifteen (`tests/contract.test.js:300-340` recounts it) | implementer, sonnet |
