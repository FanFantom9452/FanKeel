fankeel map — 1408 markdown files, 5 planned, not built, 419 retired, 108 undeclared

fankeel survey — 3683 files, matching: tour（skipped: 1 over the size cap, 1808 with no pattern；excluded: 419 archive、89 decision、264 report 等）

任務一：移除 station tour。
- assets/station/tour*.js、tour.css、tour.html（10 檔）：整組可刪。
- scripts/tour-record.js、tests/tour*.test.js、tests/tour-ctx.js、tests/station-docs-tour.test.js：可刪。
- assets/station/station.js:246,301,384,943,1805,1814、chart.js:470-481、nav.js:45、i18n.js:63,180、station.css:1283：要改，拿掉 `tour` 頁與導覽入口。dash.js、fmt.js 也有 tour 字樣，要確認是否只是註解。
- scripts/station.js:75-79：STATIC 正規式裡的 `tour(?:-…)` 要拿掉；scripts/render.js:138 只是註解範例。
- tests/station-view.test.js、station-module-lists.test.js、station-mod-chart.test.js、station-quota-chart.test.js、station-todo-panel.test.js、station-memo-static.test.js、station-dead-wizard.test.js、render-cli.test.js 提到 tour，需逐一改。
- docs/01-guide/station.md、90-agent/reference/station.md、02-architecture/layout.md、docs/README.md、skills/fankeel-ask 與 fankeel-land 的 SKILL.md、skills/fankeel-design/catalog/exclude.json 要改。
- 該留的歷史紀錄：docs/03-decisions/2026-09-29-promo30.md、99-archive、judgements、reports/patrols。todo/tour-1.md 已是 state: done，保留。
- 只有 `.claude/worktrees/*` 是並行 worktree 的副本，不動。
- 「之後再弄」目前沒有 TODO 條目，建議新增一筆，記錄導覽要怎麼做回來。

任務二：7 階段流程圖。
- docs/02-architecture/pipeline.md:417 起已有 8 張分階段 mermaid（survey 到 land），但沒有一張從頭到尾的總覽。
- 建議在 pipeline.md 的「Stages, and the route through them」（約第 286 行）後新增一張總覽。每站標示呼叫的 scripts 與一行用途，hooks 另畫成側欄。
- 素材：lib/stages.js 的 rules、各 skills/fankeel-*/SKILL.md、hooks/*.js。survey 的腳本：orient、map、survey、task route、context。hooks.json 這次沒能解析出內容，設計階段要直接讀它。
- 還沒逐站讀 design 到 land 的 SKILL，這部分留給 design 派 reader。

planned, not built: 5 頁（本次未逐一列出）
not found: 無（tour 有大量命中）
unknown: 使用者選了留在 survey，已把「promo30 測試與 tour-record 是否一併刪」定為建議全刪（它們只服務 tour）；總覽圖要放 pipeline.md 還是另開頁；hooks.json 的事件對應。
skipped: 1808 個無宣告模式的檔案（多為 md／json／html），tour 相關者已用檔名與 grep 補查；.claude/worktrees 副本不算本專案。
class: bounded — 刪除與改引用都在既有流程內，圖是文件。
route: unchanged

```json gate
{"questions":[{"header":"→Design","question":"Survey -> Design | fankeel : 移除 station tour 並畫 7 階段 mermaid","options":[{"label":"Go to Design (Recommended)","description":"tour 全部移除，含 tour-record.js 與 promo30 v1 到 v5 的測試（它們只服務 tour，留著只會失效）；決定紀錄 2026-09-29-promo30.md 與封存頁保留；新增一筆 TODO 記著要做回來；總覽圖加在 pipeline.md。"},{"label":"Stay in Survey","description":"改成只刪頁面與入口，保留 tour-record.js 與 promo30 測試以便日後重錄；需再確認它們是否仍能單獨執行。"},{"label":"暫停","description":"先停在這裡，之後再繼續。"}],"multiSelect":false}],"next":"design：依「全刪、留決定紀錄、補 TODO」定刪除清單與總覽圖位置"}
```

reads:
docs/02-architecture/pipeline.md — 已有的分階段 mermaid，總覽圖要接在這裡。
lib/stages.js — 各站 rules 與呼叫的腳本。
hooks/hooks.json — hook 事件對應。
assets/station/station.js — tour 頁與導覽入口的引用點。
scripts/station.js — STATIC 正規式裡的 tour。

