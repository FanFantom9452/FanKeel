---
status: decision
last_verified: 2026-10-21
---

# 根目錄 README 改成給使用者的 quick start，細節連到 docs（10-21）

一句話：README 只留安裝、第一次 `/fankeel`、七站與 gate、badge 與監控站、常用指令和一張文件導覽表，開頭有五行英文摘要、其餘是繁中；目錄樹和開發者材料搬進 docs，再補三張給人讀的頁面。

計畫在 [99-archive/2026-10-21-readme-quickstart.md](../99-archive/2026-10-21-readme-quickstart.md)。

## 決定

- README 雙語：頂部英文摘要，其餘繁中；指令與程式名稱維持原文，總長不超過 120 行，不連 `docs/90-agent/`。
- 「What lives where」目錄樹搬到 `docs/02-architecture/layout.md`；`.fankeel/docs.json` 加 `layout`，讓 map 從新位置讀樹。
- 開發者段落併進 `docs/01-guide/development.md`，README 只留連結。
- 新增三張指南頁：`what-runs.md`（每個 hook 與 agent 何時跑、做什麼）、`scanners.md`（五支掃描器）、`troubleshooting.md`（常見狀況）。
- audit 逐段對照 01-guide 八頁與 `pipeline.md`，修正 16 處；03-decisions 只替被整份推翻的兩份補 `superseded_by`，內文不動。

## 為什麼

使用者說最外層 README 是給人看的 quick start，詳細設計應該連到 docs 對應頁。舊 README 混著目錄樹、開發流程和已經過時的說法，第一次來的人找不到從哪裡開始。map 原本從 README 讀目錄樹，所以搬樹時要讓 `docs.json` 指到新頁，map 才不會壞。

## 放棄了什麼

- 全英文或全繁中的 README：使用者選雙語。
- 改寫 03-decisions 的內文：決策紀錄寫一次不維護，只加指向。部分被推翻的 14 份只在 audit 列出，沒有標註。
- Workflow 腳本門檻從 3 改成 2 卻沒有決策紀錄：這次不改頁面，開了 TODO「Workflow 門檻改 2 未記決策」讓人決定。
