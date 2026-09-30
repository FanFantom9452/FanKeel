---
label: init
title: 首次使用的 init skill
description: 首次接上 fankeel 的引導：專屬唯讀 agent 排查現況，再一次一題帶過 docs.json、TODO、開發習慣（profile）、CLAUDE.md、memory、map；每步看現況判斷已完成，共用 upgrade.js 偵測。architectural，走七站
state: ready
link: scripts/upgrade.js
---

## 2026-09-30 討論定案

- 觸發：由 hook 腳本偵測，不交給模型判斷。下列五條沒全過，`/fankeel` 的 `INIT` 就注入「先執行 fankeel-init」；全過之後不再叫。init 不加 `disable-model-invocation`，因為使用者叫起的 skill 不能轉給只能手動叫的 skill。
- 完成條件，全部由腳本檢查：`docs.json` 存在且沒有 `unfiled`；已有文件經 `docs-move.js` 搬好（先出搬移表，核可後才搬）；`docs-check.js` 通過；目錄樹每一列都寫了用途（`map.js` 的計數）；`docs-audit.js` 列出的 drift 已交使用者決定。
- 跳過：記在 profile（`init.skip`），之後不再自動叫；但第一次選跳過時再出一道 gate 確認，並強烈建議先做完初始化。
- 步驟順序：scout → docs.json → TODO → 目錄樹（取代「map」，map 本身由 `map.js` 產生）→ CLAUDE.md → memory（只跑 `memory-check.js`，不預先寫條目）→ profile。
- survey 第 2 步保留，和 init 共用 `write(root, PRESETS[...])`。和 upgrade 共用偵測函式，但步驟清單各自獨立。
- 定期清理不併進 init，由 `/fankeel-audit` 負責。
- 觸發檢查分兩層（修正上面「五條沒全過就觸發」）：`/fankeel` 的 hook 只跑便宜的檢查，都是讀檔就知道的：`docs.json` 存不存在、有沒有 `unfiled`、目錄樹填了沒、`init.skip`。便宜的檢查沒過，就自動叫 init。init 一旦執行（自動或使用者手動叫），就跑完整的五條，當作結束時的關卡。
- drift 的頁面要三選一才算處理完：更新內容、確認仍正確（改 `last_verified`），或移進 archive。只列出來不算。
- scout 回傳兩段：狀態表（每步 `done/partial/missing` 加一行證據，照抄腳本輸出）；草稿（目錄樹每一列的用途、未歸類文件建議放的 bucket、看起來過時的頁面），讓使用者核可就好，不必從頭寫。
- 分批沿用 `docs-audit.js --batches`（一個 bucket 一批，一批最多 40 頁），每批一個 reader，一次最多 4 個。順序：歸類（`docs-move.js` 一張表）→ 死引用（`docs-check`，交給 fixer）→ drift（分批讀）。
