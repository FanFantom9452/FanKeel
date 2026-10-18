---
label: memory
title: 記憶規則與 pstack 並比
description: 把 TencentDB-Agent-Memory 判決建議借的四條記憶規則，和 pstack 判決的建議放在一起比較，再決定要做哪些
state: ready
link: docs/90-agent/judgements/2026-10-18-tencentdb-agent-memory.md
---

來源：2026-10-19 判官分析 TencentDB-Agent-Memory（docs/90-agent/judgements/2026-10-18-tencentdb-agent-memory.md）。判決選 2（只借規則，不部署代理）：一、MEMORY.md 條目數有上限，滿了先 merge；二、寫入前做 store／update／merge／skip 決策，並列出不收錄的四類；三、slimmer 單次移除不超過記憶檔的 1/3；四、input-check 報條目數、memory-check 加跨檔近重複偵測。落點：agents/fankeel-slimmer.md、skills/fankeel-land/SKILL.md、scripts/memory-check.js、scripts/input-check.js。使用者要求先不做，等之後和 pstack 判決（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md）一起比較。

要變成：一份把兩份判決的建議逐條並排的比較，標出重疊、衝突與優先順序，再挑出要實作的項目。

完成的樣子：比較結果列出每條建議的取捨，選中的項目各自成為 TODO 或一個任務的計畫。
