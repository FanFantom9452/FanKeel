---
label: pane
title: Desktop 看路線圓點呼吸
description: 發 0.111.0 後在真正的 Claude Desktop 上看 band 與 Pane 的路線圓點有沒有擴散的圈、重畫會不會跳 — [hooks/pane-svg.ts](hooks/pane-svg.ts).
state: ready
link: hooks/pane-svg.ts
---

來源：2026-10-15 路線圓點呼吸任務的 Task 4。band 與 Pane 的路線圓點在 stage agent 執行中或一個回合進行中，會多畫一個 SMIL 擴散圈，並以 isInteractive 繪製；這只在瀏覽器 render 過，沒有在真正的 Desktop 上看過。Desktop 用的是安裝的副本（當時 0.108.1），要等發版、跑 claude plugin update fankeel@fankeel、開新 session 才會載入。

要做成：開一個會派 stage agent 的任務，看三件事：band 和 Pane 目前那一站的圓點有沒有擴散的圈；Pane 每分鐘更新時圈會不會跳回起點；tasks 格子原本的外框脈動有沒有在動。

完成條件：三件事的結果寫進這個條目。完全不會動的話，在 docs/90-agent/reference/statusline.md 第 27 行旁補一句 Pane 也不能動畫，並把 hooks/pane-svg.ts 的圈與 isInteractive 拿掉。

2026-10-16 盤點：`~/.claude/plugins/cache/fankeel/fankeel/` 已有 0.111.0、0.111.1、0.111.2，installed_plugins.json 記 0.111.2（10-15 更新），after 條件已滿足，改標 ready。注意：band 與 Pane 要 mod 載入才會畫。mod 預設就開，不用按 Enable；0.111.0 到 0.111.3 沒畫是 validate 錯誤讓整個 module 被拒，0.111.4 修掉（見「確認 0.111.4 mod 載入」），所以用 0.111.4 以上的新 session 看。
