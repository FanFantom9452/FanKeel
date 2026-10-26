---
label: build
title: gate 板子面板缺真截圖
description: 面板只過單元測試，render reviewer 沒有可拍的 gate 頁
state: ready
---

build 的 render reviewer 回 disposition: recapture：.fankeel/render.json 的頁面都不是 gate 頁，面板只在停在 gate、build 目錄有 .board 的 session focus 頁出現，沒有現成的頁面可拍。要補：起一個停在 gate 的 session（目錄放 tests/fixtures/levelmark.board），在 412 與桌面寬度拍面板、工具列、圖例、改動清單，對照 .fankeel/build/2026-10-27-board-upgrade/mockup.html；一併手動試拖動框內節點、雙擊改名、標記、撤回。完成標準：兩個寬度的截圖對得上 mockup，互動各走一遍沒錯。
