---
label: audit
title: Trovara 的 docs 搬到 preset
description: Trovara 的 docs 搬到 preset：在新機器的 Trovara 跑 `docs-move.js` 出搬移表、核可後 apply，再跑一次分批 `/fankeel-audit` — [scripts/docs-move.js](scripts/docs-move.js).
state: blocked
link: scripts/docs-move.js
group: fankeel 功能全部完成
timing: after: fankeel 其餘功能都落地、使用者換到新機器測試
stamp: 2026-10-01
---

來源：c8f9c55e（2026-09-26）「Ready 五條 lands」收尾審查，把 audit 條目縮到只剩 Trovara 這一個專案；31395ab8（2026-10-01）重讀過時機，仍等新機器。

要做成：在新機器的 Trovara 先跑 `docs-move.js plan` 出搬移表，使用者核可後 `apply`，把它的 docs 從舊 preset 搬進新 preset 的 bucket，再分批跑一次 `/fankeel-audit`。

完成條件：Trovara 的 `.fankeel/docs.json` 指向新 preset、docs-check 通過，分批 audit 沒有新的 dead reference。
