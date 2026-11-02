---
label: await
title: 評估 Monitor 取代背景 Bash
description: CC 2.1.310 的 Monitor tool 可 until-loop 等條件，評估能否取代 await.js 的背景 Bash。
state: done
link: scripts/await.js
done:
  at: 2026-11-03
  sha: 3e30089c
  disposition: done
  session: f24ff948-4dec-44d0-b10a-03bc5e3e9f45
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.310 changelog :322 新增 Monitor tool；2.1.314 :95、:152 讓 matcher 為 Bash 的 hook 也收到 Monitor 的 shell 命令，只能 block 或 ask。影響 scripts/await.js 與 hooks/guard.js:47-219（matcher Bash|PowerShell，plugin.json:148-152）。要做成：評估 Monitor 取代背景 Bash 等 handoff 的可行性與喚醒行為，並確認 guard.js 在 tool_name 非 Bash 時的 verdict 合理。完成條件：留下取代或不取代的結論與理由，取代則改 await 並補測試。

## 完成紀錄

實測背景 Bash 結束會自己喚醒主對話，所以不換成 Monitor；guard 也會擋 Monitor 呼叫。 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-02-f24ff948)

- commit 4b1c6cfb
- commit 0cea8cb2
- commit 065d8c10
- commit 3e30089c
