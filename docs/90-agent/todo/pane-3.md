---
label: pane
title: Pane 配色與右欄資訊重新規劃
description: 使用者要重新規劃 Pane 每個區塊的配色與右欄放哪些資訊；先列出現在所有區塊與可上色的地方給他看，再決定
state: done
link: hooks/pane-status.ts
done:
  at: 2026-10-13
  sha: fab751d4
  disposition: done
  session: 238cf15f-c0d9-4e1f-8551-bf67b0c2bdff
---

來源：使用者 2026-10-12 在 compact 任務的 plan gate 提出，原話大意：右邊 Pane 的 route 那一行（survey > plan 這種）沒有套用顏色，能不能套；每個區塊套不同顏色的設計想重新規劃；到時候把 Pane 所有的選項重新列出來，讓他看配色怎麼設計比較好，還有右邊要放什麼資訊。現況：區塊與順序在 hooks/pane-status.ts 的 statusRows（task、neighbours、agent、context、plan、notes、foot），色調對照表在 hooks/pane.ts，輸入框上方兩行在 hooks/pane-band.ts。要做的：走一次 design 站，先產出一份清單（每個區塊現在畫什麼、用哪個色調、route 行每一站目前的樣式、引擎的 Pane 能用哪些色調），用 mockup 給使用者比較幾種配色，再由他決定每個區塊的顏色、route 行已完成／目前／未到三種站的顏色，以及右欄資訊的增減。完成條件：使用者核准一份配色與資訊清單的 design，並照它改完 hooks/pane-status.ts 與 hooks/pane.ts，測試通過，真機看過一次。

2026-10-12 真機（Claude Desktop，plugin 0.102.0，新開的 session，不必重開 app 就生效）：使用者看了 band 與 Pane 的截圖。band 第 1 列是徽章、圓點、本站與等你的分鐘，沒有任務標題；第 2 列是 ctx、5h、7d 三條長條，沒有超出右邊，長條與軌道相連。Pane 的任務標題完整，context、用量額度、這個 session 三塊照設計畫出，每塊有自己的色軌；7d 的 -39 與落後 39 點對得上。使用者決定：偏差為 0 時維持「落後平均進度 0 點」，notes 的圓點維持不上色。還沒看到的：gate 的倒數與按鈕、撞檔塊、tasks 塊、notes 塊、80 格以下的收窄。

## 完成紀錄

先把 Pane 現在的每一塊、各自的顏色與能上色的地方列給使用者看，再畫了一頁三種配色的比較頁。使用者決定了三件事：在任務標題下面新增一行寫出站名的 route，走完的站是綠色、目前這一站是粗體、還沒到的站是灰色；拿掉「這個 session」與「用量額度」兩塊；配色用安靜版，tasks、context、notes 的標題與色條共用同一個灰，顏色只留給 gate、撞檔與各種狀態記號。程式與測試照這個改完，整套測試通過，README 與 profile 說明頁裡描述 Pane 的句子也改成現況。決定與放棄的東西寫在 10-13 的 Pane 配色決定紀錄裡。原本的完成條件裡「真機看過一次」沒有做，使用者同意另外留成一筆 TODO「Pane 新配色真機沒看過」。拿掉用量額度之後，畫面上不再有地方顯示額度何時重置。

- commit fab751d4
- commit 9b3882a2
- commit 40abceff
