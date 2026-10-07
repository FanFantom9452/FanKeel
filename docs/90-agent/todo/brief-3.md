---
label: brief
title: 子代理 brief 改走 spawn
description: 依 2026-10-07 mod 重開決策的第三項：以 agent.spawn 改寫 prompt 取代 `hooks/brief.js` 的一部分；第一步是互動式 n>1 探測，不是搬遷
state: ready
link: hooks/brief.js
---

來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第三項。已知：headless n=1 下 agent.spawn 改寫的 prompt 成為子代理 transcript 第 1 行（docs/90-agent/reports/2026-10-03-mod-probe-3.md:14）；session.append 帶 agentId 可把一列 user 文字加進執行中的子代理，這個 repo 沒測過。第一步：在互動式 session 按 Enable 後派至少三個子代理，看每一個的 transcript 第 1 行是否為改寫後的 prompt，並試一次 session.append 對執行中的子代理。完成條件：探測成立就另開 design 決定 hooks/brief.js 哪一部分搬到 agent.spawn；不成立就把結果寫進本條並關閉。共通規則：mod 沒載入時 hooks/brief.js 照舊運作。
