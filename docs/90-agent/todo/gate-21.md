---
label: gate
title: dispatch gate 走 decider
description: CC 2.1.304 的 mod tool.check 支援 decider person，可避免 auto mode 分類器代答 dispatch gate 的 ask。
state: ready
link: docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.304 changelog :530、:531：mod tool.check 新增 decider: "person"（只有人能批，沒人就拒）與 e.isReadOnly。hooks/dispatch-gate.js:143 現在回 'ask'，auto mode 下可能被分類器代答。影響 hooks/dispatch-gate.js、hooks/wrap-up.js:12、hooks/mod.ts。要做成：dispatch gate 改走 mod tool.check 並用 decider person 強制人答。完成條件：auto mode 下 dispatch gate 一定由人回答，測試涵蓋沒人在時拒絕。
