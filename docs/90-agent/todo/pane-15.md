---
label: pane
title: pane 區塊改版與收合
description: pane 的 tasks 區塊改成 agents 式列表，agents 可收合，TODO 分四個按鈕
state: ready
---

來源：2026-10-18 使用者看 pane 截圖時提出，覺得 tasks 區塊（只有編號綠色方塊，如「tasks 2 of 2」1 2）沒什麼用。目標：tasks 區塊改成像 agents 那樣一列一個任務：名稱、狀態、派給的 agent/模型、時間、token，且可收合；agents 區塊也可收合（Fold 型別加 agents）；TODO 區塊分成 Ready / Needs a decision / Blocked / Watch 四個按鈕，各帶數量，點開列出該類條目。涉及檔案：hooks/pane-status.ts（taskBlock、tasksBlock、todoBlock、agentsBlock，Fold 型別在第 22 行）、hooks/pane.ts（TODO_ORDER、folded 狀態）、hooks/pane-svg.ts（tasksSvg）。完成標準：三個區塊在 pane 上可見、tasks 每列有任務名與狀態、agents 與 tasks 都能收合且狀態保留、TODO 四鍵各顯示數量並能展開；有對應測試。
