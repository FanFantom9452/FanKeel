---
label: brain
title: 子 agent 未回不准交回
description: 加一個 SubagentStop 檢查：stage agent 自己派的 agent 還沒回來，就拒絕它交回
state: done
link: agents/fankeel-brain.md
done:
  at: 2026-10-20
  sha: cba4fc6f
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

## 現況

這次任務的 build 和 verify，stage agent 好幾次在自己派的 implementer、reviewer、對抗審查還沒回來時就交回。verify 的關卡送出時，對抗審查和畫面審查都還沒回來。agents/fankeel-brain.md 已經改成所有子 agent 都前景執行，也寫明 verify 要等兩個審查；但這些都只是文字。

## 要做

在 hooks/ 加一個檢查：stage agent 交回時，若它派出的 Agent 還有沒回來的，就拒絕交回，叫它等。另外讓 scripts/gate-check.js 拒收對抗審查一欄寫著未回的 verify 關卡。

## 完成紀錄

站 agent 交回前會等它派出去的 agent；對手 agent 沒回來，verify 關卡不開。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit cba4fc6f
- commit 2e04995e
- commit 12c040db
- commit 3cd41603
