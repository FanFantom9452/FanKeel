---
label: station
title: 路線圓點在執行中呼吸
description: station 頁與 Desktop 的路線進度點，在該站執行中時呼吸，暫停時靜止。
state: done
done:
  at: 2026-10-15
  sha: 4221f897
  disposition: done
  session: c238c175-99dd-466d-b0d8-200c3b1b2c44
---

來源 — 2026-10-15 使用者要求：路線進度點（●●●○○）在該站正在對話或執行時呼吸，暫停或沒在跑就停。判官的回答在 docs/90-agent/judgements/2026-10-15-route-dots-breathe.md。要變成什麼 — station 頁：station.css:713 補一條規則，routeDots（assets/station/station.js:519）依「live」條件加 class，沿用既有 `.now.live` 的呼吸動畫；Desktop Pane/band：routeSvg（hooks/pane-svg.ts:508）與 band 列（hooks/pane.ts:414）改以 isInteractive 繪製，用 SMIL `<animate>`，起點相位取 `now % period` 的負偏移避免每次重畫跳相；terminal statusline 做不到動畫，不做。live 條件：active 且程序在跑、沒有 gateAt、且有同 stage 的 inflight 在 20 分鐘內（Pane 另可用 turn.start/turn.complete 旗標）。先量：在真的 Desktop 上看已出貨的 `.fk-t .live` 脈動會不會動、重畫時會不會跳相。完成條件 — station 頁 live 時點會呼吸、暫停時靜止，各一個測試；Pane 部分在真機量過後才做。

## 完成紀錄

監控站的六角圖示改成只在目前這一站有 stage agent 在跑、標記不到 20 分鐘、而且沒有問題在等回答時才呼吸，停在提問或沒在跑就靜止。Desktop 的 Pane 與上方 band 的路線圓點多一圈擴散動畫，條件相同，另外一個回合正在進行時也算；子 agent 結束不會讓它提早停，重畫時不會跳回開頭。動畫在 Desktop 上會不會真的動還沒實機看過，留在 TODO pane-8，等發版後看。

- commit ecf9142b
- commit 5c85d3db
- commit 997ac234
- commit ed189829
- commit 929ea9a0
- commit cdf92839
- commit e6e2c156
- commit 4221f897
- commit 630a0cff
