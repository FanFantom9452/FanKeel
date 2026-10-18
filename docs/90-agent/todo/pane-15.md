---
label: pane
title: pane 區塊改版與收合
description: pane 的 tasks 區塊改成 agents 式列表，agents 可收合，TODO 分四個按鈕
state: done
done:
  at: 2026-10-19
  sha: 0b9cbc1f
  disposition: done
  session: 1452cf01-6856-4dc9-a1d7-2ba349b40338
---

來源：2026-10-18 使用者看 pane 截圖時提出，覺得 tasks 區塊（只有編號綠色方塊，如「tasks 2 of 2」1 2）沒什麼用。目標：tasks 區塊改成像 agents 那樣一列一個任務：名稱、狀態、派給的 agent/模型、時間、token，且可收合；agents 區塊也可收合（Fold 型別加 agents）；TODO 區塊分成 Ready / Needs a decision / Blocked / Watch 四個按鈕，各帶數量，點開列出該類條目。涉及檔案：hooks/pane-status.ts（taskBlock、tasksBlock、todoBlock、agentsBlock，Fold 型別在第 22 行）、hooks/pane.ts（TODO_ORDER、folded 狀態）、hooks/pane-svg.ts（tasksSvg）。完成標準：三個區塊在 pane 上可見、tasks 每列有任務名與狀態、agents 與 tasks 都能收合且狀態保留、TODO 四鍵各顯示數量並能展開；有對應測試。

## 完成紀錄

Pane 的代理區塊可以收合，每個任務列會寫出交給了誰；TODO 改成四個狀態按鈕並附數量，窄的 Pane 也排得下。

- commit 028c50d9
- commit de221f1f
- commit 7dbe0a95
- commit 649ca5a0
- commit 912f71f4
- commit 0b9cbc1f
