---
label: pane
title: monitor 與 workflow 清單
description: Pane 列 monitor／workflow 要等引擎給每 tick 可問的背景清單 API
state: watch
link: hooks/pane.ts
group: 引擎開背景清單 API
timing: if: $.tasks.list() 出現，或 background_tasks 進 ui.render 或 $.session
stamp: 2026-10-21
---

來源：2026-10-21 /fankeel-ask 判官對「Pane 能不能像官方一樣列 background task」的答覆，見 [判決](../judgements/2026-10-20-pane-bg-list.md)。

monitor 在磁碟上沒有任何檔，workflow 的 wf_*.json 沒有狀態欄，兩者唯一來源是 turn 末 classic.Stop 的 background_tasks 快照，列出來會半舊半新；而且 hooks module 的 classic.Stop 是否真的帶這個欄位從 10-16 起就沒實測過。

要做成：引擎給出每 tick 可問的背景清單後，把 monitor 與 workflow 併進 Pane 的背景 shell 區，同一套在跑／結束顯示。

完成條件：Pane 在 monitor 或 workflow 跑時列出它並隨狀態更新，測試涵蓋新 API 的資料形狀。

## 為什麼還開著

引擎目前沒有開放這份清單，硬做只能顯示每輪結束時的舊資料，等 API 出現再做。
