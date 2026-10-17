---
label: brief
title: spawn 紀錄先後：巢狀實測
description: 真巢狀 brain 判成巢狀，紀錄在讀取前已在；要不要在 hook 內加探針量讀取時刻
state: decision
---

10-17 接 brief-7（spawn 紀錄的先後）的真巢狀實測。session 03250267 的 survey brain a91e2c48 再派一個 fankeel-brain a8f78b33。內層 spawn 紀錄 parentAgentId 為 a91e2c48，at 15:19:37.326Z（mtime 37.3267）。內層 transcript 的 SubagentStart hook_success 時間 37.427Z、durationMs 112，推得 hook 約 37.315 起跑。內層 agent-<id>.meta.json（spawnDepth 2）mtime 37.446，在 hook 結束後才寫，退回 meta 的路線答不出巢狀。registry inflight 只有外層的 mark，沒有內層，所以 markInflight 沒跑，代表 nestedBrain 回 true，只可能是讀到了紀錄：確證紀錄在 nestedBrain 讀之前已存在。但紀錄比 hook 起跑還晚約 11ms，能贏是因為 node 開機加 require 約 27-30ms（本機實測），算競速，不是保證。殘留的不確定：markInflight 寫入失敗會被吞掉，也會長得一樣，機率低。要量 hook 真正讀的時刻，得在已安裝快取的 hooks/brief.js 加探針；這次被 auto mode 判為 Self-Modification 擋下，沒有做。要決定：接受這個確證就關掉；要直接量，請使用者自己放行，或在 checkout 加探針，用 --plugin-dir 起新 session 再跑一次。完成條件：選一條，照實記下。
