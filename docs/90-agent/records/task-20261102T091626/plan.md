docs/90-agent/plans/2026-11-02-remove-tour-pipeline-overview.md — 12 tasks

1. station 頁拿掉導覽 — assets/station/station.js, lib/spend.js, 4 支測試
2. chart/nav/i18n 拿掉 tour — 3 檔, tests/removed-tour-code.test.js
3. station.css、dash.js、fmt.js — 同上測試
4. serve 不再提供 tour 檔 — scripts/station.js, scripts/render.js, 4 支測試
5. 刪 tour 影片、錄影器、測試 — assets/station/tour*, scripts/tour-record.js, tests/tour*
6. 補 TODO（tour 之後做回來）＋舊條目死連結 — docs/90-agent/todo/
7. gate 圖框依圖大小 — diagram.css, diagram.js, tests/station-diagram.test.js
8. pipeline.md 總覽圖＋hooks 時間軸 — pipeline.md, README.md（條件式）
9. 指南、layout、verify 清單 — 3 檔
10–11. reference/station.md 前後半 — 行號位移與 tour 段落
12. minor 升版 0.149.0 — scripts/version.js

constraints: 11 lines, from map.md
lint: clean
reviewer: 3 gaps, fixed（README 死引用、已完成 TODO 的 link、memo-static 第 4 行替換文字）

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : 移除 tour 並畫 7 階段 mermaid","options":[{"label":"Go to Build (Recommended)","description":"接受這 12 個 task，全部 implementer sonnet；Task 6、8、9、10、11 依賴 Task 5 刪檔，build 依序做不並行（已記 note）。"},{"label":"Stay in Plan","description":"沒有待決的問題；assets/station/icons/ 15 個只給 tour-ring.js 用的圖示，plan 留著沒刪，想一併刪再選這個。"},{"label":"暫停","description":"next 設為：plan 已寫好待批，12 tasks（plan.md）。"}],"multiSelect":false}],"next":"plan 已寫好待批，12 tasks（plan.md）"}
```
