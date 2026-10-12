---
label: pane
title: Pane 模組裡的四處重複
description: pane-band 與 pane-status、pane-gate、pane-bar 之間有四處同一件事寫了兩份，目前結果一致，改一邊另一邊不會跟
state: ready
link: hooks/pane-band.ts
---

來源：2026-10-12 分支 pane-band 的 build 收尾時，整支分支的審查（範圍 825cb0e2..f3b84ac8）列出的重複。五個模組由不同 agent 照同一份計畫寫成，逐任務審查看不到模組之間的接縫。其中色軌顏色與 claimsOf 已在 commit 60af1234 收成一份，下面四項是計畫原碼、當時裁決不在 build 裡動的。

一、hooks/pane-band.ts 匯出的 HOLLOW 與 TITLE 沒有任何程式在用，只有 tests/pane-band.test.js 釘住它們的值；HOLLOW 的值與 DIM 相同。二、分鐘的格式化寫了兩份：pane-band.ts 的 minutes 與 pane-status.ts 的 mins，差別只在 mins 對缺值多回一個問號。三、gate 剩餘秒數的算式在 pane-band.ts 與 pane-gate.ts 各寫一次，hooks/pane.ts 一次繪製還讀了兩次 Date.now()，band 與 Pane 的倒數沒有共用同一個時間讀數。四、百分之八十那條線在 pane-bar.ts 用浮點寫，在 pane-status.ts 用整數寫，兩者之間沒有任何東西綁住。

應該變成：每一樣只有一個定義，放在 hooks/pane-bar.ts（兩個繪製共用的那個模組），另一邊改成匯入；沒有使用者的匯出連同只為了釘住它的斷言一起刪掉。

完成的條件：四項各只剩一個定義；五個 Pane 測試檔在改前改後通過的數量相同，沒有任何期望值被改；對每一項各跑一個 mutation（改那唯一的定義），band 與 Pane 兩邊的測試都要變紅。
