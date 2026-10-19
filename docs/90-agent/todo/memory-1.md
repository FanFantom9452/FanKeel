---
label: memory
title: 記憶規則與 pstack 並比
description: 把 TencentDB-Agent-Memory 判決建議借的四條記憶規則，和 pstack 判決的建議放在一起比較，再決定要做哪些
state: done
link: agents/fankeel-slimmer.md
done:
  at: 2026-10-19
  sha: e4a999d0
  disposition: done
  session: 94618e2b-bdfb-4d9d-ab4d-a18b8697a719
---

來源：2026-10-19 判官分析 TencentDB-Agent-Memory（2026-10-18 歸檔的 tencentdb-agent-memory 判決）。判決選 2（只借規則，不部署代理）：一、MEMORY.md 條目數有上限，滿了先 merge；二、寫入前做 store／update／merge／skip 決策，並列出不收錄的四類；三、slimmer 單次移除不超過記憶檔的 1/3；四、input-check 報條目數、memory-check 加跨檔近重複偵測。落點：agents/fankeel-slimmer.md、skills/fankeel-land/SKILL.md、scripts/memory-check.js、scripts/input-check.js。使用者要求先不做，等之後和 pstack 判決（同日歸檔的 cursor-plugins-pstack 判決）一起比較。

要變成：一份把兩份判決的建議逐條並排的比較，標出重疊、衝突與優先順序，再挑出要實作的項目。

完成的樣子：比較結果列出每條建議的取捨，選中的項目各自成為 TODO 或一個任務的計畫。

## 完成紀錄

比較了記憶規則和 pstack 的做法，挑中的四項都做了：記憶條目有上限、寫入前先決定新增更新合併或略過、檢查會列出相近的記憶檔、也會檢查記憶之間的連結。

- commit a165faf2
- commit 8c08b2e0
- commit e4a999d0
