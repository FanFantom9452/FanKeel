# survey — 誰讀 registry 的 `started`，各自拿它做什麼

HEAD 357924cc2ecea2546785145df722e7b1d0af712a；`git status --porcelain` 只有 11 個未追蹤檔（10 份 docs/plans、1 份 session-31b5f48b-full.md），本站未動工作樹。
`fankeel` 自己的專案，依 skill 規定跑工作樹的 `scripts/`，不是 `<plugin>` 的。

## map 摘要（引用）

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  232 markdown files, 7 planned, not built, 110 retired, 11 undeclared

Read it before designing anything. It is regenerated, so it cannot be stale;
if it is wrong, the project's own documents are what is wrong.
```

## 掃描（引用）

`node scripts/survey.js started startedAt elapsed overdue`

```
fankeel survey — 566 files, matching: started, startedat, elapsed, overdue
source: git
skipped: 1 over the size cap, 166 with no pattern for their extension

declarations:
  lib/guard.js:84  const startedAt = (data) => {
  tests/inject.test.js:558  function stopStarted(cfg) {
  tests/task.test.js:70  const started = (dir, id, task, project) =>

documentation:
  docs/archive/2026-08-25-init-scan-residue.md:1280  # Zero is a legal step and means all hollow: a plugin that has started and not yet
  docs/archive/2026-09-05-anchor-remaining.md:252  ### 0. It already said it started
  docs/reports/evidence/2026-09-20-survey-brain-ab/handoff-942566e9/survey.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  skills/fankeel-survey/SKILL.md:42  ### 0. It already said it started

skipped, and openable by hand:
  .claude-plugin/marketplace.json
  ...（共 167 筆，其中 141 未列出）
```

掃描器只報宣告，`data.started` 這種欄位讀取一律不會出現，所以補了一次
`grep -rnE "\.started\b|\bstarted:|['\"]started['\"]" lib scripts hooks assets/station/station.js tests`：120 行、39 個檔（26 個是 tests）。

## 讀者

- lib/dirty.js:148 — `claimWrites` 拿 `started` 當 cutoff，只有 mtime 晚於它的 dirty 檔才算這個 task 的 claim；`Date.parse` 失敗就整個回 `{added:0, declined:0}`（94–100 行說明為何不用 `updated`：它每個 prompt 都改寫）
- lib/guard.js:85,96–100 — `startedAt()` / `claimedFirst()`：兩個 session 都握同一檔時比先後，先 claim 的贏；讀不到 `started` 的一方必輸，兩邊都讀不到也不看是誰在問
- lib/handoff.js:12–15 — `started` 去掉 `-` `:` 取前 15 字成 `.fankeel/build/task-<stamp>/`；不符 `^\d{8}T\d{6}$` 就回 null，等於這個 task 沒有 handoff 目錄
- lib/render.js:115–119、scripts/task.js:790、hooks/gate.js:47、hooks/resume.js:25 — 四個間接讀者，全部經 `handoffPath()`/`answerPath()`：stage agent 的 brief、`task.js next` 的 gate、gate hook 換問題、resume hook 寫回答
- lib/detail.js:652 — detail cache 的 `day` 是 `started` 前 10 字（UTC 日）
- lib/station.js:366 / 530 / 614 — 抄進 station model、`keptDays()` 舊 cache 的 fallback 日期、送進瀏覽器 payload
- assets/station/station.js:357,605,654,659,1242,1337,1402,1547 — 前端唯讀：30 天窗判定、花費散點的 x、時長 `updated - started`、`started` 排序欄、明細「開始」
- scripts/task.js:563 / 951 / 700–707 — 寫方：`start` 寫入、`adopt` 用 `source.started || stamp`（註解：re-stamp 會永久失去先後）、`task`（改名）刻意保留

同名但不是這個欄位：lib/render.js:272 與 lib/serve.js:131 是 station serve 的 `state === 'started'`；lib/live.js:109 讀 Claude Code 自己 session JSON 的 `startedAt`；docs/subagents.md:301 是 Workflow journal 的 `started` 事件。

文件與碼一致：docs/registry.md:101（mtime 晚於 `started`）、docs/station.md:131,570（entry 取 `started`、它自己一欄）都對得上，沒有牴觸。

planned, not built: docs/improvement-brief.md、docs/plans/2026-09-01-stage-timing-design.md、2026-09-01-stage-timing.md、2026-09-09-design-class-prompt.md、2026-09-19-stage-agents-design.md、2026-09-19-survey-brain-design.md、2026-09-19-survey-brain.md
not found: `elapsed`、`overdue` 兩個詞在 declarations 與 documentation 都零命中
unknown: none
skipped: 掃描器 1 檔超過大小上限、166 檔副檔名沒有宣告樣式（JSON/HTML/純文字/evidence 檔），另有 167 筆「可手開」清單只列 26 筆。沒有派 reader：答案在 `lib/`、`scripts/`、`hooks/`、`assets/station/`，已用一次 grep 全域覆蓋，上面每行都用 `sed -n` 開過
class: spike 形狀——只有一個答案要交，沒有東西要蓋
route: unchanged — 這筆記錄 start 時就說了 `survey,design`（`classForRoute` 對它回 null），ratchet 的地板是 start 說過的那個，往下改成 spike 的 `survey,build` 會拿掉控制端在等的 design

```json gate
{
  "questions": [
    {
      "question": "started 的讀者清單已列齊，接下來怎麼走？",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "接受，進 design",
          "description": "接受這份清單就是接受：直接讀 started 的是 lib/dirty.js:148（claim cutoff）、lib/guard.js:85(claimedFirst 先後判定)、lib/handoff.js:12（build/task-<stamp> 目錄鍵）、lib/detail.js:652（cache 的 day）、lib/station.js:366/530/614 與前端 assets/station/station.js 的排序與顯示；scripts/task.js:563/951 是寫方，adopt 沿用來源的 started。也接受 route 維持 start 時說的 survey,design，不降成 spike。（Recommended）"
        },
        {
          "label": "先談 handoff 鍵",
          "description": "把 lib/handoff.js:12 當成待決事項再進 design：handoff 目錄以 started 當鍵，adopt 會把來源的 started 一起帶走，於是被接手的 task 會回到舊目錄；而 started 不符 ^\\d{8}T\\d{6}$ 時 handoffPath 回 null，stage agent 的 brief 與 task.js next 會一起失效。要不要在 design 站先決定這個行為。"
        },
        {
          "label": "到此為止",
          "description": "只要這個答案，不進 design，也不改任何碼。此站的發現就是交付物，控制端收下路徑後結束這筆 task。"
        }
      ]
    }
  ],
  "next": "survey 完成：8 處直接讀者、4 處經 handoffPath 間接，route 維持 survey,design。"
}
```
