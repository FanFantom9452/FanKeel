---
label: station
title: 設定頁待調整
description: 設定頁兩份 mockup（快速設定、詳細設定）已核可，剩移植到真實 station
state: ready
link: .fankeel/build/2026-10-21-station-redesign/route-settings-v9.html
---

2026-10-23 狀態：mockup 已核可，剩移植到真實 station。核可兩份 mockup，都在 `.fankeel/build/2026-10-21-station-redesign/`（該目錄被 gitignore，不在 git 裡）：
- 快速設定 `route-settings-quick.html`：5 塊，每個問題都預選，並標來源「依你的紀錄」或「作者推薦」；有「全部套用推薦」；寫入畫面顯示舊→新；附連結到詳細設定。
- 詳細設定 `route-settings-v9.html`：10 章，一屏一題，prompt.* 標「進階・不建議」，含 agents 表。
- 設計筆記：同資料夾的 `settings-onboarding-design.md`（看決定那一節）。

移植尚未做完的部分：
- 目前只有 Q1/Q2 的推薦由程式算出（`task.js profile suggest`）。
- sessions 重疊、stage.agents、notify/remote、前端偵測、model.lang 的推論都還需要寫程式。
- 遠端存取要等 TODO「Tailscale 以外的遠端方案」。
- v9 的 agents 表在 390px 寬度下，select 文字會被截斷。

完成標準改為：線上的設定頁與上述兩份 mockup 一致。

以下為原始來源紀錄。

來源：2026-10-22 使用者在 patrol-two 的 Task 5 逐頁看 station 改版 mockup，route-focus-plan.html 與 route-spend.html 核可為定稿，其餘頁面他說「這些畫面都記錄到 READY 我之後要逐個調整」。設定頁屬於「station 改版剩下的頁」中尚未定稿的一頁。要變成什麼：使用者在設計階段一塊一塊調整這頁 mockup，定稿後再移植到 assets/station/ 的真實 station。完成標準：使用者宣告 route-settings.html 為定稿，且線上的設定頁與它一致。

2026-10-25 盤點核對：「移植尚未做完」那幾條已大多落地——`lib/settingsuggest.js`（19215e3e）推論 sessions 重疊（90 天內至少 5 個 session 才推）、`stage.agents`（profile 或至少 3 份任務快照）、`model.lang`（profile 或 `ui.lang`）、gate 等你時在哪（`notify.gate`、`gate.station`、`gate.away`）與前端偵測（`.fankeel/render.json` 或 html/css/vue/svelte/jsx/tsx 檔）；遠端方案 station-49 已結案，Q7 卡 4075bb78 改成 Tailscale 預設；v9 agents 表在 440px 以下改成一列一個 agent（`assets/station/settings-detail.css`）。

2026-10-25 使用者對照（1280 與 390）：不一樣的塊：設定頁上方的「專案」選單，原話：「上面專案那邊請你幫我改成顯示 GLOBAL 或是分 PROJECT 再下去選 PROJECT 然後 PROJECT 用 打字篩選 和我們搜尋功能一樣」。這是下一輪的範圍（使用者決定不併入這輪），下一輪先走 design 做 mockup 再改。
