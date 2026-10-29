---
label: station
title: 設定頁 390 寬溢出
description: 設定頁內容在 390 寬 viewport 比畫面寬，尚未查是哪個區塊
state: done
link: assets/station/settings-page.css
done:
  at: 2026-10-30
  sha: 05cf97eb
  disposition: done
  session: 4c96ec5b-9532-460f-aeb4-eb8523845042
---

來源：2026-10-29 TODO 盤點時，使用者在真手機重驗「未登記卡片與設定頁待真機驗」第 5 項，同時發現設定頁內容在 390 寬的 viewport 下比畫面寬，會出現橫向捲動；當時只記在那條的進度裡，沒有查是哪個區塊，也沒有開條目。要做成：找出撐寬的區塊（可能是全域｜個別切換列、global-foot、專案選擇器或某個長字串），用 CSS 讓它在窄螢幕換行或縮小。完成標準：390 與 412 寬時頁面 scrollWidth 等於畫面寬、沒有子元素超出，附截圖或一條會擋回歸的測試。

## 完成紀錄

設定頁的全域｜個別切換列改成兩欄 minmax(0,1fr)、min-width:0，窄螢幕會縮，有一條測試擋回歸；還沒在真手機重量。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-29-4c96ec5b)

- commit 05cf97eb
