---
label: audit
title: docs-audit 不看 README
description: docs-audit 的漂移檢查不涵蓋 README.md，過時的 README 要靠使用者指出
state: done
link: scripts/docs-audit.js
done:
  at: 2026-10-21
  sha: 0ddba2c6
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次 init 的漂移檢查與 survey 都沒有找出 README 跟不上程式的地方：缺 pane-agents.ts、skills 列少了 audit 與 retro-all、找東西的表少三列。是使用者在 survey 中途說「README 也需要更新」才補上。

要做成：docs-audit --batches 把 README.md（以及 lib 底下的 README）納入批次，讓 reader 一併判斷是否仍描述程式。

完成條件：docs-audit 的批次輸出含 README.md，測試證明一份過時的 README 會被列出；onboard 的漂移步驟因此能看到它。

## 為什麼還開著

README 不在任何 docs.json bucket 裡，納入它要先決定歸屬與 last_verified 的規則，是一個小設計題，不適合在 land 順手改。
