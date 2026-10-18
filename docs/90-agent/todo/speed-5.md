---
label: speed
title: inflight 從 4 提到 8
description: 同一回應最多派 4 個 Agent，10 人組被切成三波；提高到 8 讓大組一次派完
state: ready
---

來源：2026-10-18 判官判決 docs/90-agent/judgements/2026-10-18-plan-parallelism.md 卡點 5 與改法 5。inflight=4 只在 2026-10-18-patrol-cuts-merges 兩個大組（10 人分 4/3/3 三波，每人 active 約 1 分）與 deny-posix-helpers（4+4）綁住，每場多 3–5 分；hooks/dispatch-gate.js:4-5 數的是同一回合的 Agent 呼叫數。10-16 報告 24 readers 167s→118s。要改成：lib/profile.js 的 dispatch.inflight builtin 預設 4 改 8，或在本專案 profile set dispatch.inflight 8 --project，並同步 skills/fankeel/SKILL.md 與 docs 裡寫著四個的地方。完成條件：預設或專案值為 8，dispatch-gate 測試覆蓋 8，文件不再寫 4。
