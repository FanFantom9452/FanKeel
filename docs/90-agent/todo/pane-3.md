---
label: pane
title: Pane 配色與右欄資訊重新規劃
description: 使用者要重新規劃 Pane 每個區塊的配色與右欄放哪些資訊；先列出現在所有區塊與可上色的地方給他看，再決定
state: decision
link: hooks/pane-status.ts
---

來源：使用者 2026-10-12 在 compact 任務的 plan gate 提出，原話大意：右邊 Pane 的 route 那一行（survey > plan 這種）沒有套用顏色，能不能套；每個區塊套不同顏色的設計想重新規劃；到時候把 Pane 所有的選項重新列出來，讓他看配色怎麼設計比較好，還有右邊要放什麼資訊。現況：區塊與順序在 hooks/pane-status.ts 的 statusRows（task、neighbours、agent、context、plan、notes、foot），色調對照表在 hooks/pane.ts，輸入框上方兩行在 hooks/pane-band.ts。要做的：走一次 design 站，先產出一份清單（每個區塊現在畫什麼、用哪個色調、route 行每一站目前的樣式、引擎的 Pane 能用哪些色調），用 mockup 給使用者比較幾種配色，再由他決定每個區塊的顏色、route 行已完成／目前／未到三種站的顏色，以及右欄資訊的增減。完成條件：使用者核准一份配色與資訊清單的 design，並照它改完 hooks/pane-status.ts 與 hooks/pane.ts，測試通過，真機看過一次。
