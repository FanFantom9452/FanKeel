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

動手時在這個 repo 跑 `node scripts/docs-move.js plan --to <preset> --out moves.tsv --root <Trovara 的路徑>`，核可後 `apply` 同一個 `--root`；搬完 `node scripts/docs-check.js --root <Trovara 的路徑>` 沒有 dead reference，才算 `.fankeel/docs.json` 換好。卡住的不是程式也不是權限：499df36f（2026-09-26）加了 `scripts/docs-move.js` 後沒人改它；等的是使用者的決定，記在 docs/03-decisions/2026-09-27-todo-clear.md:8，Trovara 的搬移照他的話延後，等他在另一台電腦測。
