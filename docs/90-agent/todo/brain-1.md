---
label: brain
title: 子 agent 未回不准交回
description: 加一個 SubagentStop 檢查：stage agent 自己派的 agent 還沒回來，就拒絕它交回
state: ready
link: agents/fankeel-brain.md
---

## 現況

這次任務的 build 和 verify，stage agent 好幾次在自己派的 implementer、reviewer、對抗審查還沒回來時就交回。verify 的關卡送出時，對抗審查和畫面審查都還沒回來。agents/fankeel-brain.md 已經改成所有子 agent 都前景執行，也寫明 verify 要等兩個審查；但這些都只是文字。

## 要做

在 hooks/ 加一個檢查：stage agent 交回時，若它派出的 Agent 還有沒回來的，就拒絕交回，叫它等。另外讓 scripts/gate-check.js 拒收對抗審查一欄寫著未回的 verify 關卡。
