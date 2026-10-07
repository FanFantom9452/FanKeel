---
label: spend
title: 使用前後兩段用量比對腳本
description: 讓另一位開發者先記錄裝 fankeel 前的用量，用一到兩週後再比；官方 /usage 只有 24h/7d 且不能匯出，要一支依日期範圍並排兩段的腳本
state: ready
link: lib/usage.js
---

來源：2026-10-07 TODO 全表盤點 session，使用者問能不能用官方 usage 指令，先記另一位開發者裝 fankeel 前的開發習慣，讓他用一到兩週後再抓數據比對。已知（官方文件，同日查）：/usage（/cost、/stats 同一個）的 Attribution 只有 24 小時或 7 天兩檔、只算本機、不能匯出；/insights 產 HTML 報告到 ~/.claude/usage-data/report.html，沒有 token 與花費；OpenTelemetry 可用 OTEL_RESOURCE_ATTRIBUTES 標 phase=before/after，但要自己架 collector；本機 transcript 預設只留 30 天（cleanupPeriodDays），/insights 報告也照這個清。repo 內：lib/usage.js 的 summarise() 只讀 transcript、依 requestId 去重、不需要 registry，裝 fankeel 前的資料也讀得到；scripts/sessions.js --since 只篩起點、只看一個專案、不去重；scripts/quota.js 需要 TokenBar 紀錄。要做的：一支腳本，給兩段日期範圍，對 ~/.claude/projects 算每段的 session 數、每個 session 的花費與 token、model 分佈、subagent 佔比，並排印出。給對方的事前步驟一起寫進說明：settings.json 設 cleanupPeriodDays 90、跑 /insights 並把報告另存、把 ~/.claude/projects 整包壓縮留作基準。完成條件：用本機兩段真實日期跑出對照表，數字與 summarise() 逐檔加總一致，有會轉紅的測試釘住日期篩選與去重。注意：兩段做的工作不同，比每個 session 或每個任務，不比總額；一兩週樣本小，結論只當參考。
