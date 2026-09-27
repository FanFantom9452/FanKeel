---
status: current
last_verified: 2026-09-28
---

# guard seen / ab.sh 重跑 Implementation Plan

**Goal:** 鄰居 `seen` 裡的檔不再讓 guard 攔下編輯，並把 ab.sh 的 profile-pin 重跑跑完、寫成報告。
**Architecture:** `blockers()` 對鄰居只看 hook 記下的 `claims`；`seen` 留在 `effectiveClaims`／`sharedWith` 的警告路徑。ab.sh 原樣執行，報告從它的 evidence 算出。
**Tech Stack:** Node built-ins only, `node --test`; bash for `ab.sh`; `claude -p` for its arms.
**Spec:** [2026-09-28-guard-seen-ab-rerun-design.md](2026-09-28-guard-seen-ab-rerun-design.md)

## Global Constraints

- Node built-ins only: `package.json` has no `dependencies` or `devDependencies`; add none. Tests run with `node --test` (`npm test`).
- `'use strict';` at the top of every JS file; CommonJS; 4-space indentation in `lib/`, 2-space in `tests/` — match the surrounding file.
- `.gitattributes`: `* text=auto eol=lf` — write LF only.
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires from `scripts/` or `hooks/` (CONTRIBUTING.md:15).
- A new doc page gets its row in `docs/README.md` in the same change (CONTRIBUTING.md:20).
- Report pages are write-once snapshots: frontmatter `status: current`, `last_verified: <date>`, `source_of_truth: <evidence paths>`; every figure comes from a file under the evidence directory.
- Evidence directory `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/`: `ab.sh` and `pin.sh` are not edited — their md5s are recorded in `provenance.txt`.
- Implementers run only their own test file; the parent runs the full suite before committing.

## Coverage

| promise | task |
|---|---|
| `lib/guard.js` `blockers()`：判斷鄰居是否持有此檔時只看鄰居的 `claimsOf(data)`，不再用 `effectiveClaims(data, pool)` | Task 1 |
| `effectiveClaims` 與 `sharedWith` 不變：`seen` 照舊算進撞檔警告（`clash`）。 | Task 1 |
| `tests/guard-effective.test.js` 的 `a path git saw and no live session holds still counts` 改成 | Task 1 |
| `docs/90-agent/reference/collisions.md` weight 那一列補一句 | Task 1 |
| 照原 `CAP=62.50`（每 arm 上限）跑 | Task 2 |
| 新報告 `docs/90-agent/reports/2026-09-28-ab-profile-pin.md` | Task 3 |
| `TODO.md` 關掉 guard 那條 Ready 與 ab.sh 那條 Needs a decision | Task 1, Task 3 |
| seen 不攔 | Task 1 |
| 重跑 | Task 2, Task 3 |

## Task 1: guard stops blocking on a neighbour's `seen`

**Files:**
- Modify: `lib/guard.js` — `blockers()` checks a neighbour's `claimsOf(data)` instead of `effectiveClaims(data, pool)`
- Modify: `docs/90-agent/reference/collisions.md` — the `weight` row says `seen` warns and never blocks
- Modify: `TODO.md` — remove the `## Ready` bullet starting `〔guard〕鄰居 session 的 git pass`
- Read: `lib/registry.js` — `claimsOf` (already imported at `lib/guard.js:22`)
- Test: `tests/guard-effective.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `blockers(mine, others, rel, liveState)` keeps its signature

**Dispatch:** implementer, sonnet — a one-line change with its test and two doc lines.

- [ ] **Step 1: flip the test.** In `tests/guard-effective.test.js`, replace the test `a path git saw and no live session holds still counts` with:

```js
test('a path only git saw warns but never blocks', () => {
  const mine = { started: newer };
  const theirs = { sessionId: B, data: { seen: ['f.js'], started: older } };
  assert.deepEqual(guard.blockers(mine, [theirs], 'f.js', UNKNOWN), []);
  assert.deepEqual(guard.effectiveClaims(theirs.data, [{ data: mine }, theirs]), ['f.js']);
  assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]).clash, []);
});
```

  The last assertion holds because `mine` has nothing; the warning path is `effectiveClaims`, asserted on the line above.

- [ ] **Step 2: run it, watch it fail.** `node --test tests/guard-effective.test.js` — the `blockers` assertion fails with length 1.

- [ ] **Step 3: the fix.** In `lib/guard.js`, in `blockers()`, replace

```js
        if (!covers(effectiveClaims(data, pool), rel)) continue;
```

  with, in `lib/guard.js`,

```js
        // Only a hook-seen write blocks. A `seen` path is git's, and git names
        // no writer: a neighbour's pass picks up our own untracked file before
        // our next prompt records it, and on 2026-09-27 that denied our edit.
        // `seen` still counts toward the warning, through `effectiveClaims`.
        if (!covers(claimsOf(data), rel)) continue;
```

- [ ] **Step 4: run it, watch it pass.** `node --test tests/guard-effective.test.js`.

- [ ] **Step 5: docs.** In `docs/90-agent/reference/collisions.md`, at the end of the `| weight |` row, before its closing `|`, append: ` It never blocks: \`blockers\` in \`lib/guard.js\` reads a neighbour's \`claims\` only, so under \`ask\` or \`deny\` a \`seen\` path warns and the edit goes through.` Set that page's `last_verified` to `2026-09-28`. In `TODO.md`, delete the one `## Ready` bullet starting `〔guard〕`.

- [ ] **Step 6: commit** — `lib/guard.js`, `tests/guard-effective.test.js`, `docs/90-agent/reference/collisions.md`, `TODO.md`.

## Task 2: run ab.sh

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/provenance.txt` — written by the run
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/summary.json` — written by the run
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/opus-design.json` — and every other `<arm>-<stage>.json`/`.err`, `<arm>-diff.txt`, `<arm>.patch` the run writes beside it; Step 4 commits them all
- Read: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` — the script, not edited
- Read: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh` — called by the script

**Interfaces:**
- Consumes: none
- Produces: `<arm>-<stage>.json`, `<arm>-diff.txt`, `<arm>.patch`, `summary.json`, `provenance.txt` under the evidence directory

**Dispatch:** in-session — two Bash calls (a dry run, then the run in the background); a subagent adds a system prompt and nothing else.

- [ ] **Step 1: dry run.** `DRY=1 bash docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` from the repo root; read `provenance.txt` and check it lists 5 `claude` commands per arm and `CAP per arm: 62.50`.
- [ ] **Step 2: run.** `bash docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` with `run_in_background`; wait for its exit notification, never poll.
- [ ] **Step 3: check.** `tail -3` of `provenance.txt` ends in `done`; `ls` shows `opus-verify.json` and `sonnet-verify.json`; `git worktree list` shows no `wt-opus`/`wt-sonnet` left.
- [ ] **Step 4: commit** the evidence directory's new files.

## Task 3: the report

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-ab-profile-pin.md` — new page
- Modify: `docs/README.md` — one index row under the reports, beside the `2026-09-25-controller-multiplier.md` row
- Modify: `TODO.md` — remove the `## Needs a decision` bullet starting `〔stage-agents〕ab.sh`
- Read: `docs/90-agent/reports/2026-09-25-controller-multiplier.md` — the shape and the k definition to reuse
- Read: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/summary.json` — the figures
- Read: `lib/prices.js` — `costOf`, for any figure summary.json does not already carry

**Interfaces:**
- Consumes: Task 2's `summary.json` and `provenance.txt`
- Produces: none

**Dispatch:** implementer, sonnet — a report transcribed from one summary file, in the shape of an existing report.

- [ ] **Step 1:** Write the page in 繁體中文, frontmatter `status: current`, `last_verified: 2026-09-28`, `source_of_truth:` naming the evidence directory, `ab.sh`'s md5 from `provenance.txt` and the BASE sha. Sections: how it ran (what differs from 09-25: `pin.sh` commits `stage.agents`), per-stage k for each comparable stage, whether `stage.agents` stayed `false` through both arms (`<arm>-diff.txt`), and n=1 stated in the first paragraph.
- [ ] **Step 2:** Add the `docs/README.md` row; delete the `TODO.md` bullet.
- [ ] **Step 3:** `node scripts/docs-check.js` shows no finding on the new page.
- [ ] **Step 4: commit** the three files.
