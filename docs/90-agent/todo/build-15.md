---
label: build
title: gate 板子面板缺真截圖
description: 面板只過單元測試，render reviewer 沒有可拍的 gate 頁
state: ready
---

build 的 render reviewer 回 disposition: recapture：.fankeel/render.json 的頁面都不是 gate 頁，面板只在停在 gate、build 目錄有 .board 的 session focus 頁出現，沒有現成的頁面可拍。要補：起一個停在 gate 的 session（目錄放 tests/fixtures/levelmark.board），在 412 與桌面寬度拍面板、工具列、圖例、改動清單，對照 .fankeel/build/2026-10-27-board-upgrade/mockup.html；一併手動試拖動框內節點、雙擊改名、標記、撤回。完成標準：兩個寬度的截圖對得上 mockup，互動各走一遍沒錯。

2026-10-27 真瀏覽器：`scripts/render.js` 拍了 412 與 1440 兩個寬度（這個任務 build 目錄的 gate-412、gate-1440 各一張 render.png，不進版控）。無頭截圖裡板子面板有工具列與「✓ 0 個問題」，但圖是空的（render 在 SVG 載入前就拍了），412 寬時頁面比視窗寬，右上「對話」、工具列與狀態列被裁掉，「選取」字色幾乎看不見。使用者在真瀏覽器、session 停在 gate 時操作：狀態變「可以編輯」，拖曳寫進 .board（gate 答案附上 6 筆移動 api／collab），改名、標記、復原使用者回報正常。使用者另外指出操作不流暢、工具列用文字而非 icon，要往 chartroom 的互動看齊，另開條目。完成條件「兩個寬度的截圖對得上 mockup」未成立：截圖時機與 412 溢出待修，這條不結案。
