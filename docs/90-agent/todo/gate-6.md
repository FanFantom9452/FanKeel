---
label: gate
title: gate 加報告面板
description: gate 仍用 AskUserQuestion 以便手機與遠端可見；終端與 Desktop 另加報告面板、重畫問題框
state: done
link: hooks/gate.js
done:
  at: 2026-10-05
  sha: b7d5157d
  disposition: done
  session: 0461c799-7295-4d36-91f0-66f97a2d97fa
---

來源：2026-10-05 TODO 全表盤點 session 的討論。結論方向：gate 保留 AskUserQuestion，因為手機和遠端控制只看得到它；mod 只在終端和 Desktop 加一個報告面板，把報告顯示出來，並重畫問題框。要先決定：面板放在哪個介面、怎麼偵測目前是終端還是手機、報告與問題框誰先出現、現有 mod 探測的結果能不能用。完成條件：決定寫下來；選做就有面板、偵測與測試，手機路徑維持原樣。

## 完成紀錄

這件事決定不做：gate 不另加終端或 Desktop 的報告面板，因為 gate.station 已能在監控站頁面顯示並回答 gate，也能交給終端或手機，面板會重複它。理由寫在決策頁 docs/03-decisions/2026-10-05-inject-gate-mod.md。

- commit c07554c8
- commit 50426a92
- commit 658f53d6
- commit 079f3b08
