# survey — 誰讀 registry 的 `started`，各自拿它做什麼

HEAD 357924cc2ecea2546785145df722e7b1d0af712a；`git status --porcelain` 只有 11 個未追蹤檔（10 個 docs/plans、1 個 session-31b5f48b-full.md），本站未動工作樹。

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  232 markdown files, 7 planned, not built, 110 retired, 11 undeclared

Read it before designing anything. It is regenerated, so it cannot be stale;
if it is wrong, the project's own documents are what is wrong.
```

```
fankeel survey — 566 files, matching: started, startedat, start_time
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
```

宣告掃描抓不到欄位讀取（`started` 是 property access，不是 declaration），所以另以
`grep -rn "\.started\b|\['started'\]|\"started\"|started:"` 掃過 lib、hooks、scripts、
assets、tests 的全部 `.js`，下列是全集。

**寫入者（非讀者）**

- scripts/task.js:563 — `start` 寫 `started: stamp`，唯一的產生點。
- scripts/task.js:951 — `adopt` 用 `source.started || stamp`，保留來源的值。
- scripts/task.js:705 — 註解：`task`（改名）保留 `started`，因為它是碰撞 tie-break。

**讀者，各自的用途**

- lib/dirty.js:148 — `claimWrites` 以 `Date.parse(data.started)` 當 cutoff，只認 mtime 晚於它的 dirty 路徑；不可解析就回 `{added:0, declined:0}`。選它而非 `updated`，因為 `updated` 每個 prompt 都會被改寫（dirty.js:98 的註解）。
- lib/guard.js:85 — `startedAt(data)` 解析它；`claimedFirst`（:96–99）比兩造的 `started`，早的贏，沒有可讀值的一方輸，兩邊同樣規則。
- lib/handoff.js:12 — `dirFor` 去掉 `-` `:` 取前 15 字成 `.fankeel/build/task-<stamp>`；不合 `^\d{8}T\d{6}$` 回 null，整個 handoff 機制就停用。
- lib/station.js:366 — 掃描時原樣放進 session row（非字串則 null）。
- lib/station.js:530 — `keptDays`：舊 cache 沒有 `days` 時，用 `Date.parse(s.started)` 的當地日當唯一支出日。
- lib/station.js:614 — 放進送給瀏覽器的 view JSON。
- lib/detail.js:652 — detail cache 的 `day` 是 `d.started.slice(0, 10)`，一個 UTC 日期字串（station.js:527 註解說它與 `days` 的當地日不同）。
- assets/station/station.js:357 — 專案列的 session 計數：這 30 天有花費，或 `started` 落在窗內，才 `r.n++`。
- assets/station/station.js:605 — session 散點圖的 x 軸。
- assets/station/station.js:654、:659 — 表格「開始」欄，時長算 `(updated || started) - started`。
- assets/station/station.js:1242 — 30 天窗的納入判準（起始在窗內，或有窗內的 `days`）。
- assets/station/station.js:1255 — 依 `started` 倒序排。
- assets/station/station.js:1337 — 排序鍵 `started`（:1330 註解：它有自己的欄位，因為排序鍵不能沒有表頭）。
- assets/station/station.js:1402、:1547 — 日期欄與明細頁的「開始」顯示。

**沒有讀它的（點名，免得被當漏網）**

- lib/registry.js — 0 個 `started`。不像 `updatedAt`/`projectOf`/`claimsOf`，這個欄位沒有 accessor，五個讀者各自 inline `Date.parse`。
- hooks/ 八個檔一個都不讀（`started` 全是散文動詞）；lib/badge.js、scripts/orient.js、scripts/residue.js、scripts/sessions.js、scripts/ledger.js 同樣不讀。

**同名但不是它的**

- scripts/station.js:314/419/588 與 lib/serve.js:6 的 `started`：station server record 的欄位。
- lib/live.js:109 的 `startedAt`：Claude Code session 檔的欄位，數字毫秒。
- lib/stage-registry.js:38、tests/task.test.js:70：fixture。

**文件對不對得上**

- docs/collisions.md:69、:119 與 docs/registry.md:101 講的 dirty cutoff，和 lib/dirty.js:148 一致。
- docs/station.md:131、:570 講站台欄位與排序，和 assets/station/station.js:1333 一致。
- skills/fankeel/SKILL.md:170、:209 的 record 範例與「改名保留 `started`」，和 scripts/task.js:705 一致。
- 缺口：docs/registry.md:31 那張「誰寫哪個欄位」的表列了 `version`、`guard`、`updated`、`clock`、`burn`、`claims`、`gateAt`、`waited`、`ended` 等，**沒有點名 `started` 的寫者**（`task.js start` 與 `adopt`）；registry.md 也沒有逐欄 schema 列。handoff 目錄鍵這個用途只寫在 lib/handoff.js:4–6 引用的 docs/plans/2026-09-19-survey-brain-design.md，而那頁在 map 的 `planned, not built` 裡。

planned, not built: docs/improvement-brief.md、docs/plans/2026-09-01-stage-timing-design.md、docs/plans/2026-09-01-stage-timing.md、docs/plans/2026-09-09-design-class-prompt.md、docs/plans/2026-09-19-stage-agents-design.md、docs/plans/2026-09-19-survey-brain-design.md、docs/plans/2026-09-19-survey-brain.md

not found: `start_time`（零命中）；`startedAt` 有命中，但全部不是 registry 欄位（lib/live.js:109、lib/guard.js:84 的區域函式名）。

unknown: 兩件。(1) lib/handoff.js 已經上線，它引為出處的 2026-09-19-survey-brain-design.md 仍掛 `status: design-intent`，是該頁待更新還是我誤判，需要確認。(2) docs/registry.md 要不要補 `started` 的寫者與用途，不在本站的 survey-only 範圍內。

skipped: 掃描器跳過 1 個超過大小上限的檔（session-31b5f48b-full.md，850,408 bytes，未追蹤的 transcript 存檔，不是程式碼），以及 166 個副檔名沒有宣告樣式的檔（json、txt、css、html、patch、yaml、jsonl）。後者我沒有整批打開：改以字串 grep 直接掃 assets/station/index.html、.claude-plugin/、evals/、.fankeel/docs.json、.fankeel/profile.json，`started` 零命中（exit 1）。`.fankeel/sessions/*.json` 與 `.fankeel/station/detail/*.js` 是這個欄位的資料與產生的 cache，不是讀者。未讀 docs/archive 的 110 頁（map 標為 retired, do not follow）與 docs/reports/evidence 下的 A/B 產物；同一問題的舊 handoff（docs/reports/evidence/2026-09-20-survey-brain-ab/handoff-942566e9/survey.md）我刻意沒讀，以免抄它的答案。

class: spike — 本站的產出就是答案，沒有要改任何檔。但記錄上的 route 是 `survey,design`（`classForRoute` 對它回 null，所以 entry 沒有 `class` 欄），是有人說出口的路線，棘輪不准往下改成 spike 的 `survey,build`。

route: unchanged（`survey,design`，未跑 `task.js route`）

```json gate
{
  "questions": [
    {
      "question": "survey 讀完了：`started` 有 14 個讀點、3 個寫點、registry.js 沒有 accessor。接下來?",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "收下這份清單",
          "description": "(Recommended) 接受這份盤點就是答案：14 個讀點（lib/dirty.js:148 當 dirty cutoff、lib/guard.js:85 當碰撞 tie-break、lib/handoff.js:12 當 handoff 目錄鍵、lib/station.js 三處與 lib/detail.js:652 當日期、assets/station/station.js 七處當站台的排序與顯示）、3 個寫點（scripts/task.js:563 start、:951 adopt、:705 改名保留），lib/registry.js 完全沒有這個欄位的 accessor。也接受分級 spike、route 維持 `survey,design` 不動。任務到此結束，不進 design，不改任何檔。"
        },
        {
          "label": "補 registry.md",
          "description": "把發現的文件缺口補起來再結束：docs/registry.md:31 的「誰寫哪個欄位」表沒有點名 `started` 的寫者，整頁也沒有逐欄 schema。這會讓任務從 survey-only 變成要改一個檔，走到 design 站。"
        },
        {
          "label": "查 design-intent",
          "description": "先確認那個不確定處再結束：lib/handoff.js 第 4 到 6 行引 docs/plans/2026-09-19-survey-brain-design.md 當出處，程式碼已經在跑，那頁卻仍被 map 列為 planned, not built。要我去讀那頁的 frontmatter 與內文，判斷是該頁該改 status，還是我讀錯了。"
        },
        {
          "label": "再掃一輪",
          "description": "我用的是 `grep` 掃 lib、hooks、scripts、assets、tests 的 .js，對 json、html、yaml 等 166 個無宣告樣式的檔只做字串比對，也沒讀 docs/archive 的 110 頁。要我把這些沒覆蓋到的地方再走一遍，確認沒有第 15 個讀點。"
        }
      ]
    }
  ],
  "next": "survey 完成：14 個讀點、3 個寫點已列齊，等你決定收下清單或要我再做一件事"
}
```
