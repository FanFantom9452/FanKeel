---
label: gate
title: 未受控站的 gate 也檢查選項數
description: `hooks/gate.js` 的 `readGate` 只在受控站跑，六個未受控站的兩選項或沒 pause 的 gate 會直接送出
state: decision
link: hooks/gate.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 9 筆。現況：hooks/gate.js:206-214 的 readGate（至少三個選項、含 pause）只在 controlled 時執行，未受控的站只有 gateOpen 打時間戳。目前七站裡六站未受控，兩個選項或沒有 pause 的 gate 會直接送出，ALWAYS[0] 是唯一的防線。gate-4 記過 brain 三次送出兩選項，但它只管 handoff 的 gate，主 session 這一半沒人看。judge 提的修法：未受控而且 questions[0].header 等於 stage 名時檢查選項數至少三個，違反只發 systemMessage、不 deny。要先決定的事：judge 自己註明，如果 registry 的 gates 資料顯示主 session 從來沒有違反過，這筆可以降級，所以要不要做取決於那份資料。完成條件：查過 gates 資料並記下結果；有違反就照上面的修法做並補測試，沒有就把查到的數字寫進本條後關閉。
