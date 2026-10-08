---
label: audit
title: Trovara 的 docs 搬到 preset
description: Trovara 的 docs 搬到 preset：在新機器的 Trovara 跑 `docs-move.js` 出搬移表、核可後 apply，再跑一次分批 `/fankeel-audit` — [scripts/docs-move.js](scripts/docs-move.js).
state: blocked
link: scripts/docs-move.js
group: fankeel 功能全部完成
timing: after: fankeel 其餘功能都落地、使用者換到新機器測試
stamp: 2026-10-07
---

來源：c8f9c55e（2026-09-26）「Ready 五條 lands」收尾審查，把 audit 條目縮到只剩 Trovara 這一個專案；31395ab8（2026-10-01）重讀過時機，仍等新機器。

要做成：在新機器的 Trovara 先跑 `docs-move.js plan` 出搬移表，使用者核可後 `apply`，把它的 docs 從舊 preset 搬進新 preset 的 bucket，再分批跑一次 `/fankeel-audit`。

完成條件：Trovara 的 `.fankeel/docs.json` 指向新 preset、docs-check 通過，分批 audit 沒有新的 dead reference。

## 為什麼還開著

腳本已經在：499df36f（2026-09-26）加了 `scripts/docs-move.js`，其後沒有人再改它，所以卡住的不是程式，而是 Trovara 所在的新機器還沒到手，這裡的 repo 碰不到 Trovara 的 docs。要動手時，先在 Trovara 根目錄跑 `node scripts/docs-move.js plan --to <preset> --out moves.tsv`，把搬移表給使用者看過再跑 `apply`；搬完以 `node scripts/docs-check.js` 為準，輸出沒有 dead reference，才算 `.fankeel/docs.json` 換好，最後再跑分批 `/fankeel-audit` 一次。換機器之前不要在這台機器上對 Trovara 預演，因為路徑與已追蹤檔案會不同。
