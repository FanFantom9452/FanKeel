---
status: decision
last_verified: 2026-10-27
---

# 週報 skill：選區間與 repo，收紀錄，畫成一頁給教授的 HTML（10-27）

一句話：`/fankeel-weekly` 從完成紀錄、session 紀錄與 git 收資料，經使用者確認事清單後畫成一頁自足的 HTML。週報歸檔在設定目錄、不進任何 repo，監控站的 `#/weekly` 頁列出歷次週報。

設計在 [99-archive/2026-10-27-weekly-skill-design.md](../99-archive/2026-10-27-weekly-skill-design.md)，計畫在 [99-archive/2026-10-27-weekly-skill.md](../99-archive/2026-10-27-weekly-skill.md)。判官的形狀分析在 [90-agent/judgements/2026-10-27-weekly-report-skill.md](../90-agent/judgements/2026-10-27-weekly-report-skill.md)。

## 決定

- 三步、兩個 gate：問區間與 repo；`weekly.js collect` 收資料；模型寫事清單，Gate 1 確認清單，`weekly.js render` 出頁，Gate 2 確認頁面。
- 一則完成紀錄是一張事卡，同標題多則合一張；只有 git 的 repo 依 commit scope 分群。
- 週報歸檔在 `<configDir>/fankeel/weekly/<迄日>.{json,html}`，不 commit：fankeel 是外掛的 repo，其他專案的工作內容不能進來。
- 監控站只管理不產生：`#/weekly` 列出歷次週報，站內開一份時注入「回列表、上一份、下一份」導覽列，寄出的單檔沒有它。
- 頁面用監控站的設計語言，CSS 內嵌、只畫 inline SVG；每個專案一張架構圖，這期改到的模組依改動量上色，事卡標出它動到的模組。
- 架構圖熱度與改動量 KPI 只算程式與測試，文件與資料另列。
- `render` 寫檔前守門：內建禁詞表加 `.fankeel/sensitive.txt`，命中就失敗並列出位置，不寫檔。
- `scripts/render.js` 多了 `--viewport` 與 `--theme`，能拍真正的 412px 版面與淺色主題；非 guest 角色要求這兩項時直接失敗。

## 為什麼

使用者每週五要向兩位教授報告這一兩週做了什麼。教授要的是理解，不是數字，所以頁面以事為單位、配上改到哪一塊的架構圖。commit scope 分群不穩，出頁前讓使用者看一次清單是唯一能改的地方。站沒有模型，所以週報由 skill 產生、站只負責列出與開啟。

## 放棄了什麼

- 給自己看的版本與花費：第一版只有教授版，花費整條路不讀。
- 英文 commit 原文：由模型轉述成繁中，不留原文。
- 非 guest 角色的 412 與淺色截圖：要先讓 `runAct` 接角色的登入 profile，這次改為明確失敗。
- 週報裡的專案標籤沿用 tagline 原文：這期範例的標籤偏長，但那是資料，程式照設計運作。
