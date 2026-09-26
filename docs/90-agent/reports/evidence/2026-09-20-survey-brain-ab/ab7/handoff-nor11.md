# survey — 誰讀 registry 的 `started`，各自拿它做什麼

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  235 markdown files, 7 planned, not built, 110 retired, 14 undeclared

Read it before designing anything. It is regenerated, so it cannot be stale;
if it is wrong, the project's own documents are what is wrong.
```

```
fankeel survey — 631 files, matching: started
source: git
skipped: 1 over the size cap, 223 with no pattern for their extension

declarations:
  lib/guard.js:84  const startedAt = (data) => {
  tests/inject.test.js:558  function stopStarted(cfg) {
  tests/task.test.js:70  const started = (dir, id, task, project) =>

documentation:
  docs/archive/2026-08-25-init-scan-residue.md:1280  # Zero is a legal step and means all hollow: a plugin that has started and not yet
  docs/archive/2026-09-05-anchor-remaining.md:252  ### 0. It already said it started
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor5.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor6.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab5/handoff-nor7.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  docs/reports/evidence/2026-09-20-survey-brain-ab/handoff-942566e9/survey.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  skills/fankeel-survey/SKILL.md:42  ### 0. It already said it started

skipped, and openable by hand:
  .claude-plugin/marketplace.json
  .claude-plugin/plugin.json
  .fankeel/.gitignore
  .fankeel/docs.json
  .fankeel/profile.json
  .gitattributes
  .gitignore
  .ignore
  assets/station/index.html
  docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab-provenance.txt
  ... and 198 more, not listed
```

宣告式掃描只抓到 `startedAt` 這個函式名，所以我改用 `grep -rn '\.started\b|started:'` 逐處開檔核對。

寫入兩處：

- scripts/task.js:563 — `started: stamp`，`start` 建檔時的 ISO 時刻
- scripts/task.js:951 — `started: source.started || stamp`，`adopt` 沿用來源的，註解說重新蓋章會永久失去先後答案

直接讀它的五個模組：

- lib/guard.js:85,96-98 — `claimedFirst` 的搶檔先後；不可解析的一方判輸，兩邊同樣規則
- lib/dirty.js:148 — `claimWrites` 的 mtime 界線；註解說用它而非 `updated`，因為 `updated` 每個 prompt 都重寫
- lib/handoff.js:12-15 — 砍成 `\d{8}T\d{6}` 當交接目錄名 `.fankeel/build/task-<stamp>`
- lib/station.js:366,530-532,614 — 原樣進 model、`keptDays` 取 UTC 日、再原樣進 JSON
- lib/detail.js:652 — `d.started.slice(0,10)` 當 `day`

瀏覽器端 assets/station/station.js 八處都是 `Date.parse(s.started)`：排序鍵 1337、視窗過濾 1242,357、圖表 605,654、列表 1255,1316,1402、詳情 1547。

同名但無關：lib/live.js:109 與 lib/station.js:327 的 `startedAt` 是 Claude Code 行程起始（數字），lib/serve.js 與 scripts/station.js 的 `started` 是 station 紀錄自己的。

planned, not built: docs/improvement-brief.md、docs/plans/2026-09-01-stage-timing{,-design}.md、docs/plans/2026-09-09-design-class-prompt.md、docs/plans/2026-09-19-stage-agents-design.md、docs/plans/2026-09-19-survey-brain{,-design}.md
not found: 無；`started` 有命中
unknown: 沒有任何一頁寫明 `started` 的格式契約；我沒讀 docs/registry.md 求證，這是猜測而非查核
skipped: 1 檔超過大小上限、223 檔副檔名無宣告樣式（JSON 設定與 evidence 的 .txt/.json/.patch）。這些是資料與設定，不是讀者；`assets/station/station.js` 雖被歸在無樣式，我已直接 grep 過。tests/ 我刻意未算成讀者。
class: spike — 產出是一份答案，沒有要改任何檔
route: unchanged（紀錄上是 `survey,design`，有人說過，棘輪不准降）

```json gate
{
  "questions": [
    {
      "question": "survey 的讀者清單完成了。要收下、升路線把它寫成文件，還是再查一輪？",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "收下這份清單 (Recommended)",
          "description": "接受這份答案為結論：寫入只有 scripts/task.js 兩處（start 蓋章、adopt 沿用來源的），直接讀者五個模組——guard 判搶檔先後、dirty 當 mtime 界線、handoff 砍成交接目錄名、station 與 detail 做顯示與分日，瀏覽器端 assets/station/station.js 八處全是 Date.parse 拿來排序與過濾。同時接受 class 是 spike、路線維持紀錄上的 survey,design 不動。這一站結束後不再往下做。"
        },
        {
          "label": "升路線，補一頁格式契約",
          "description": "唯一還開著的決定：我找不到任何一頁寫明 started 是 ISO 8601，lib/handoff.js:14 卻用正則 \\d{8}T\\d{6} 硬吃它的前十五碼，格式一變交接目錄就會靜靜地算不出來。要的話跑 node scripts/task.js route \"survey,design,build,verify,land\" --session 6444bc74-e25b-4c23-9297-d679daf59d8b，由 build 那站把欄位與讀者清單補進 docs/registry.md。棘輪只准往上，選了不能再降回兩站。"
        },
        {
          "label": "再查一輪，兩個具名目標",
          "description": "一、我沒開 docs/registry.md 求證欄位表裡有沒有 started 這一列，上面 unknown 那行是推斷不是查核，這是本次報告最弱的一句。二、docs/plans/2026-09-01-stage-timing-design.md 這組 design-intent 頁要在 started 旁邊加每站時間戳，我只從 map 看到它存在，沒讀它會不會改動 started 本身的語意。兩個都查，報告改寫後重回這個關卡。"
        },
        {
          "label": "問法不對，我重跑",
          "description": "如果你要的其實不是「誰讀它」而是「改掉它會壞哪裡」，或者你想把 tests/ 底下的測試也算成讀者（我刻意排除了）、想連 docs/archive/ 的 110 頁一起看，說一句就好。我會用新的鏡頭重跑這一站，這份報告是被改寫而不是疊加。"
        }
      ]
    }
  ],
  "next": "survey 完成：started 寫入 2 處、直接讀者 5 個模組、瀏覽器 8 處，class spike，路線不動。"
}
```
