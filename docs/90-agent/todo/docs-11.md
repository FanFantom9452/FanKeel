---
label: docs
title: 補 layout 漏列並試畫框架圖
description: layout.md 補漏列的 board、chartroom、weekly 模組，並試畫完整框架圖與 gitdiagram 比較
state: done
link: docs/02-architecture/layout.md
stamp: 2026-10-27
done:
  at: 2026-10-27
  sha: 64a8a53c
  disposition: done
---

來源：2026-10-27 判官判決 docs/90-agent/judgements/2026-10-27-gitdiagram-vs-design.md（gitdiagram.com 對 fankeel 的 AI 架構圖漏了 skills/、agents/、scripts/、guard.js、stage-agent 迴圈，並把 Chartroom 畫成孤島）。兩件事：(1) docs/02-architecture/layout.md 補 lib/board.js、board-edit.js、board-look.js、lib/chartroom/（13 檔，只被 board.js / board-edit.js 以 dynamic import() 載入）、lib/weekly-*.js 與 scripts/weekly.js 的列，再跑 node scripts/map.js 重生 .fankeel/map.md；(2) 試畫一張完整 fankeel 框架圖（skills→brain→readers→handoff→gate、hooks、lib、scripts、station），依 2026-10-26 決定用 Mermaid，與 gitdiagram 那張比較差距，再決定是否收進文件。相關：docs-1「流程圖由腳本生成並防漂移」（blocked）。完成條件：layout.md 有上述各列且 map.js 重跑無漂移；框架圖草稿與比較結論寫下並由使用者決定去留。

## 完成紀錄

layout.md 補上板子、chartroom、週報幾列，加一張框架圖。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-27-e79bfd5e)

- commit 64a8a53c
