---
label: pane
title: Pane TODO 只留計數與跳轉鈕
description: Pane 右欄 TODO 展開條目時列數不夠被 DROP 先丟掉；改成只顯示各狀態數量，按鈕直接跳 station 對應清單，不再在 Pane 內展開
state: done
link: hooks/pane-status.ts
done:
  at: 2026-10-22
  sha: c246a8dc
  disposition: done
  session: 3751ce2a-68f2-422f-909a-001b11efff75
---

來源：2026-10-21 使用者回報，Pane 右邊的 TODO 區塊常因列數不夠顯示不出來。現在 [todoBlock](hooks/pane-status.ts) 是標題列 + 兩列四顆狀態鈕（Ready / Needs a decision / Blocked / Watch），按下後在 Pane 內再展開最多 TODO_ROWS（6）條標題與「還有 N 條」；而 statusRows 的 DROP 順序裡 todo 排第一個被丟，room 一緊就整塊只剩標題甚至看不到。

要做成：TODO 區塊只畫各狀態的數量（例如 Ready 3 · 決策 2 · Blocked 1 · Watch 4），每個數量本身就是按鈕，按下直接開 station 該專案的 TODO 面板並定位到那個狀態，不再有 todoState 展開、todoOpen 狀態與 TODO_ROWS 條目列。station 目前的 hash 只有 #/p/<key>/todo 與 #/p/<key>/todo/<id>（assets/station/station.js:260），要嘛加一個狀態的 hash（如 todo/state:ready）並捲到該 heading，要嘛先跳到 todo 面板頂端。拿掉不用的 todoState press、todoOpen 欄位與 hooks/pane.ts 裡對應的狀態。

完成條件：TODO 區塊固定不超過兩列（標題 + 計數列，窄欄可折成兩列計數），點任一計數會開 station 到該狀態的清單；Pane 內不再列出任何 TODO 標題；hooks 的 pane 測試改寫涵蓋新列數與每顆按鈕的 to hash。

## 完成紀錄

Pane 的 TODO 區只留各狀態計數鈕，按下跳到監控站對應群組。 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-3751ce2a)

- commit c246a8dc
- commit e9807fa1
