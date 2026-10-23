---
label: station
title: 下一步框的決定 gate 攔不到
description: 桌面 app 的下一步框（mcp__ccd_turn__wrap_up 的 ask/actions）問了使用者決定，station gate 沒看到，側欄也沒顯示 session 在等人
state: done
done:
  at: 2026-10-24
  sha: 49420823
  disposition: done
  session: 53b0565d-b2ca-45b3-ad53-dda251c5e46b
---

2026-10-22 逐塊核准 mockup 時觀察到：session 問「docs-findings 這塊要怎麼處理？」，走的是 Claude 桌面 app 的下一步框（mcp__ccd_turn__wrap_up 帶 ask/actions），不是 AskUserQuestion。

station 的 gate hook 只比對 AskUserQuestion（.claude-plugin/plugin.json:39 與 :137），所以 station 完全沒看到這個問題；而且 wrap_up 沒帶 blocked: true，這一輪已結束，桌面側欄也沒把這個 session 顯示成在等使用者。

想要的結果：fankeel 階段中任何要等使用者決定的問題（逐塊核准、選項）都走 AskUserQuestion；wrap_up 的框只用來收尾回顧。可選做法：在注入的規則或 skill 寫明這條；或加一個 PreToolUse hook 比對 mcp__ccd_turn__wrap_up，在有進行中任務時拒絕帶 ask 的呼叫；並補一個測試。

## 完成紀錄

任務進行中，帶 ask 或 actions 的下一步框會被 hooks/wrap-up.js 擋下，決定改走 AskUserQuestion. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-23-53b0565d)

- commit 49420823
- commit d1764cc9
- commit e35596ed
- commit 9ba01ca5
