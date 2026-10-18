---
judged: 2026-10-18T14:40:40.369Z
model: fable
agent: fankeel-judge
task: ""
session: df8beb73-f585-4c40-b172-71b57f1ddd7b
stage: init
---

# Brief — are recent plans' build stages parallelised as far as they could be?

## Question

# Brief — are recent plans' build stages parallelised as far as they could be?

## The question

The user asks (verbatim, Traditional Chinese): 「請你深度分析 近期所有的任務 是不是每個 PLAN TASK 這些 都有最大化加速平行處理? 而不是每個都 PIPE 還是有些是受到 AGENT 數量限制 所以速度很慢?」

In English: across the recent tasks (roughly 2026-10-10 → 2026-10-18), did each plan's build actually run its tasks with maximum parallelism — or did tasks run as a serial pipe one after another, or get throttled by an agent-count cap (`dispatch.inflight`, 4 by default), making builds slow?

## Options to weigh

A. Parallelism is already near the maximum the plans allow; slowness comes from elsewhere (review per task, suite runs, commits serialised, verify).
B. Plans are grouped well, but execution serialises them — e.g. a group of 10 marked `agents` while the build runs under a stage agent (`stage.agents` names build, so no Workflow tool) and `dispatch.inflight` = 4 forces batches, or the controller waits for each implementer before the next.
C. Plans themselves serialise too much — `**Files:**` overlap or `Consumes:` chains put tasks into many small groups; or undeclared requires (see ledger diagnostics) push groups off `workflow`.
D. Some mix; name which dominates with numbers.

## Background

- `lib/plantasks.js` groups tasks by disjoint `**Files:**` and `Consumes:`; `surfaces()` gives `agent` / `agents` / `workflow`. Under a build stage agent it prints `agents` for 3+ because the brain has no Workflow tool. A group with a diagnostic never reaches `workflow`.
- `node scripts/ledger.js --plan <plan> groups` prints the grouping. Each `.fankeel/build/<plan-slug>/progress.md` is the ledger: its `## groups` block and the per-task `complete [a..b]` lines in the order they landed.
- Profile: `dispatch.inflight 4` (builtin), `stage.agents survey,build,verify`, `dispatch.floor sonnet`.
- `.fankeel/build/agents-<session>.json` holds per-agent start/`ended` epoch-ms stamps — the real overlap of implementers.
- Registry entries `.fankeel/sessions/*.json` carry `clock` (per-stage wall clock), `moves`, `waited`.
- Example already seen: `2026-10-18-patrol-cuts-merges` — 5 groups over 20 tasks, group 2 = 10 tasks `agents`, group 5 = 7 tasks `workflow`, plus 7 undeclared-require diagnostics in group 2.

## Paths to read

- `lib/plantasks.js`, `scripts/ledger.js`, `skills/fankeel-build/SKILL.md`, `agents/fankeel-brain.md`, `docs/90-agent/reference/subagents.md`
- Plans: `docs/99-archive/2026-10-1[0-8]-*.md` (non-`-design` ones) and any under `docs/90-agent/plans/`
- Ledgers: `.fankeel/build/2026-10-1*/progress.md` (about 40 dirs; sample at least 8 spread over the window, including the patrol ones and `2026-10-18-gate-tab`, `2026-10-18-plan-gate-page`)
- `.fankeel/build/agents-*.json` and `.fankeel/sessions/*.json` for timings (match by session/plan date)
- Search with `.fankeel/build/ask/*-answer.md` for earlier judgements on dispatch or workflow (`1-workflow-gaps`, `7-verifier-agent`)

## What counts as an answer

A verdict (A–D) backed by measurement: for the sampled builds, groups available vs implementers actually overlapping (from `agents-*.json` timestamps), how often a group of >4 was batched by `inflight`, how often a group was serialised by plan grouping or diagnostics, and where the build's wall-clock actually went. Then the concrete changes, ranked by time saved, each naming the file to change. Say plainly what could not be measured.

## Answer shape (Traditional Chinese, code names in code)

```
結論: <A|B|C|D> — <一句>
量測: <表格：plan | 任務數 | 組數 | 最大組 | 實際最大同時 implementer | build 牆鐘 | 主要卡點>
卡點排名:
  1. <原因> — <證據 path:line 或數字>
  ...
改法（依省下時間排序）:
  1. <改什麼> — <檔案> — <預估效果>
  ...
量不到的: <列出>
```

Keep it under 60 lines.

## Answer

結論: D — A 為主（約 1/3 牆鐘是 parent 單線迴圈、另 1/3 是 gate 等待與收尾 suite），C 在 render-gate 型計畫明顯（Read:／共用測試檔把 12 task 串成 9 組），B 幾乎沒發生：13 場有 build 時鐘的 session 全是 `stage.agents=["survey"]`，brain／無 Workflow 的機制一次也沒用上；`dispatch.inflight 4` 只在兩場綁住，代價 3–5 分鐘。
量測:
| plan | 任務數 | 組數 | 最大組 | 實際最大同時 implementer | build 牆鐘（gate 等） | 主要卡點 |
|---|---|---|---|---|---|---|
| 18-patrol-cuts-merges | 20 | 5 | 10（agents，7 條 require 診斷） | 4（=inflight） | 18m（1m） | 10 人組分 1,1,1,1／2,3,3,3／4,5 三波；每人 active ≈1m；parent 6m |
| 18-deny-posix-helpers | 11 | 4 | 4 | 4 | 69m（33m） | gate 等 48%；agent 總忙 23m；收尾 45→69m 無 agent |
| 15-render-gate | 12 | 9 | 3 | 2 | 123m（7m） | 9 組串鏈：`tests/agents.test.js` 綁 T5–T8、`Read: lib/shots.js`／`lib/ledger.js`；parent 52m |
| 18-gate-tab | 6 | 5 | 2 | 7（Workflow） | 102m（6m） | reviewer 28 : implementer 5，13 次 fix，9 次 suite（4 紅）；parent 36m |
| 18-plan-gate-page | 4 | 3 | 2 | 2 | 155m（98m） | gate 等 63%；8 次 fix；55→155m 無 agent |
| 10-workflow-gaps | 12 | 6 | 4 | 4 | 50m（4m） | parent 20m；收尾 28→50m 無 agent（suite+branch review） |
| 16-build-workflow-script | 6 | 4 | 2 | 6（Workflow） | 71m（2m） | parent 29m；implementer 總 active 僅 17m |
| 16-station-dashboard | 8 | 未 scan | — | 6 | 52m（8m） | 收尾 34→52m 無 agent |
| 14-pane-svg | 10 | 5 | 6（workflow） | 8（Workflow 一次跑滿） | 694m（69m） | 使用者離開 ≈583m；4 個單人組都卡 `hooks/pane-svg.ts` |
| 15-todo-patrol-four | 5 | 2 | 3（4 條診斷） | 5 | 102m（14m） | 23→73m 無 agent；implementer 總 active 9m |
卡點排名:
  1. parent 單線迴圈（commit→ledger→reviewer→confirm reviewer→fix→re-review，`skills/fankeel-build/SKILL.md:304-574`）— build−等−任一 agent 忙 = render-gate 52/123、build-workflow-script 29/71、workflow-gaps 20/50、gate-tab 36/102、cuts-merges 6/18；reviewer 活動分鐘 gate-tab 36 vs implementer 13
  2. gate 等待／使用者不在 — plan-gate-page 98/155、deny-posix 33/69、pane-svg 空白 583m、patrol-four 23→73m 無 agent（profile `gate.station: off`）
  3. 收尾串行：fast suite（246 次/54 task，相鄰間距下限 3.3–5m，gate-tab 一場 9 次 4 紅）→ docs-check → branch review → gate，`SKILL.md:596-599` 串著寫 — 尾段無 agent 18–29m（workflow-gaps、render-gate、deny-posix、station-dashboard）
  4. 計畫分組串鏈（C）— 14 份計畫 60 個組界：`files` 34、`read` 20、`interface` 6（`lib/plantasks.js:164-192`）；render-gate 12/9、init-quick-setup 3/3（`Read: lib/profile.js`）、pane-band 17/10（`hooks/pane-status.ts`）、todo-patrol-five 16/10（`hooks/pane-band.ts`）
  5. inflight=4（B）— 只在 cuts-merges 兩個大組與 deny-posix（4+4）綁住，每人 active ≈1m → 3–5m；`hooks/dispatch-gate.js:4-5` 數的是同一回合的 Agent 呼叫數，`ready` 逐個補位已繞過；7+9 條 require 診斷只把組從 `workflow` 降成 `agents`，in-session 下同回合 Agents 照樣並行，代價 ≈0
改法（依省下時間排序）:
  1. 實作→審查配對進同一 Workflow pipeline（`buildRun` 已在 `lib/plantasks.js:408`）並放寬門檻：`surfaces()` `lib/plantasks.js:391-393` 2 人組也給 `workflow`、`workflowScript` `:451` `< 3`→`< 2`、`scripts/ledger.js:210-217` `taskSurfaces` 診斷組不降級（診斷說的是分組正確性，pipeline 不改分組） — 省 parent 單線 13–52m/場，約 1/3 牆鐘
  2. 收尾並行：`skills/fankeel-build/SKILL.md:596-599` 讓 `suite.js --fast` 以 run_in_background 與 whole-branch reviewer、docs-check 同跑；`lib/suite.js` record 補 `ms` 欄才量得到 — 省 5–10m/場
  3. plan lint 報「鏈鎖檔」：`lint()` `lib/plantasks.js:603` 對被 ≥3 task 的 Modify/Test 共用的檔（`tests/agents.test.js`、`hooks/pane-status.ts`）與 `Read:` 到鄰居 Modify 的項目各報一行，要求 `path:a-b` 或拆測試檔 — render-gate 型 9 組可縮到 4–5 組，省 20–30m
  4. 開 `gate.station`／`gate.away`（`lib/profile.js`）— 等待是 2/13 場最大桶，但屬使用者側，列而不計
  5. `dispatch.inflight` 4→8（`lib/profile.js`；10-16 報告 24 readers 167s→118s） — 只在 ≥8 人組有感，省 ≈3–5m
量不到的: `agents-*.json` 只有 `ended` 無 start（`lib/agentends.js:3-8`），同時數改由 `~/.claude/projects/F--ymlab-fankeel/<session>/subagents/agent-*.jsonl` 時間戳以 3 分鐘空檔切段推得，resume 的 fix round 算分段；pane-band、pane-talk、todo-patrol-five、gate-drive 四場（`stage.agents` 未記的 session）在該專案夾無 transcript，未量；suite.json 無 duration，單次 3.3–5m 是相鄰紀錄間距的下限；parent-only 混著使用者不在 gate 之外的空白（patrol-four 50m、pane-svg 過夜）分不開；todo-patrol-drive／-two 的 5 人組找不到對應 session；Workflow 內 agent 無 meta.json，全算 implementer；`docs/90-agent/plans/` 現為空，計畫全從 `docs/99-archive/` 讀。
