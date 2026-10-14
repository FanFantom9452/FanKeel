---
status: current
last_verified: 2026-10-15
source_of_truth: scripts/drive.js, lib/handoff.js, lib/render.js
---

# Driving a task one headless session per stage

`scripts/drive.js` runs a fankeel task one stage at a time, each stage in a fresh `claude -p`, so no session carries the context of the stages before it. It is the answer to a session whose context still passed 400k after a hand-off: session 8846548c, which adopted a hand-off on 2026-10-08, reached 405k in build, 417k in verify and 425k in audit.

```
node scripts/drive.js --session <id> [--root <dir>] [--max-rounds 12] [--max-usd 20] [--timeout 3600] [--gate-wait 86400]
```

`--session` names an active registry entry; the driver starts at its current stage and owns no entry of its own, the way a subagent owns none.

## One stage

1. The prompt is the brief a `fankeel-brain` stage agent gets from `renderBrief`, with `stage.agents` forced to this stage, plus one line asking for `status`.
2. `claude -p --plugin-dir <plugin> --permission-mode acceptEdits --output-format json --max-budget-usd <left>` runs it. The permission mode was the user's choice on 2026-10-10: edits go through and everything else follows the project's allow rules. A stage whose tool was refused can report `blocked`; if the refused write is the handoff file itself, no handoff appears and the driver stops on `status` — and that is what `acceptEdits` does: on 2026-10-15 the first real run (session 8a06683b, one build round, $0.47) had both its Write and its Edit of `.fankeel/build/task-<started>/build.md` refused as "a sensitive file", reported `blocked` in its last message, and the driver stopped on `status` with no handoff on disk. Until the mode or an allow rule lets a headless stage write under `.fankeel/build/`, no stage driven here can hand off.
3. The stage writes its handoff with a `json gate` block whose top level carries `"status"`: `done`, `partial` or `blocked`.
4. The driver writes `<stage>-pending.json` the way `hooks/gate.js` does, so the station shows the question, and waits for `<stage>-answer.md`, which the station's `/answer` writes.
5. The first question's answer decides: its own option one runs `task.js stage <next>` (or `task.js down` at the route's end), a pause runs `task.js next`, and anything else runs the same stage again with the answer file's path in the prompt.

## Where it stops

One JSON line, `{"stopped": <reason>, "rounds": n, "usd": x, "stage": s}`, exit 0 for `down` and `pause` and 1 for the rest.

| reason | when |
|---|---|
| `rounds` | `--max-rounds` calls made; a stage run again counts again |
| `usd` | under $0.50 left of `--max-usd`, summed from each call's `total_cost_usd` |
| `timeout` | `--timeout` seconds of wall-clock, not counting time spent waiting at a gate |
| `status` | no handoff written, a gate that does not read, or no `status` in it; the line names the handoff |
| `gate` | `--gate-wait` seconds with no answer |
| `pause`, `down` | the answer said so |
| `error` | no active entry for `--session`, no brief for its stage, `claude` could not be started (any spawn error but a timeout), a round whose output carried no `total_cost_usd`, or anything thrown inside the loop — a profile that does not read, `task.js` refusing a move; the line's `detail` carries the message |
