---
label: station
title: plan 展開改成渲染 markdown
description: gate 焦點頁每列「展開本項 plan 文字」把 plan 的 markdown 原文放進 pre，標題、清單、程式碼區塊都沒渲染，讀起來吃力 — [assets/station/focus-page.js](assets/station/focus-page.js).
state: done
link: assets/station/focus-page.js
done:
  at: 2026-10-27
  sha: e50741fa
  disposition: done
---

來源：2026-10-27 任務「週報 skill design」land 時使用者提出：gate 頁 plan 每列展開後是 markdown 原文，難讀，要整理成好讀的渲染再給人看。現況：assets/station/focus-page.js 的 fpBody 把 t.body 經 esc 後放進 <pre class="tb-pre">，沒有任何 markdown 處理；assets/station 目前沒有共用的 markdown 渲染函式，lib/ 裡的 markdown 處理都在伺服器端（conversation、docsearch、map）。要做成：展開區塊顯示渲染後的內容 — 標題、清單、粗體、行內程式碼、程式碼區塊與表格，步驟的核取方塊照原樣呈現；仍以 esc 防注入，不引外部依賴；排版跟站上其他內文一致，窄螢幕不橫向溢出。完成條件：焦點頁展開一列看到渲染後的 plan 文字，有測試證明標題、清單、程式碼區塊與表格被渲染、HTML 被跳脫，並在真的瀏覽器拍過寬螢幕與 412px。

## 完成紀錄

focus 頁計畫摺疊區渲染 markdown；沒有截圖證據。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-27-e79bfd5e)

- commit 1e2d4bd7
- commit e50741fa
