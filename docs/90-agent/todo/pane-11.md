---
label: pane
title: Pane 的 route、tasks 可收合
description: route、tasks（可含 agents）的標題列改成 Button，按下收合或展開；Desktop 的按鈕放在 Svg 上方
state: ready
link: hooks/pane.ts
---

來源：2026-10-16 使用者在 todo-patrol-agent-tokens 的 build 站問：「右手邊 ROADMAP 可以做收闔功能嗎? 還有 TASKS 顯示也可以做收和嗎? ... 我希望他可以變成互動的方式」。

查到的：Pane 是 `hooks/pane.ts` 的 `ui.render` hook（`component: 'Pane'`）。終端全畫文字列；Desktop 由 `paneParts` 把 route、撞檔、tasks 換成 `Svg`。可點的只有 `Button`（`onPress`），頁尾的 station 就是一個（熱鍵 `s`）；`Svg` 本身不能點。

做法：route、tasks 的標題列畫成 `Button`，`onPress` 切 mod 記憶體裡的收合旗標並 `$.ui.invalidate('ui.render')`；收合時只留一列，例如「▸ tasks 3/5」。Desktop 的按鈕放在對應 Svg 上方。收合狀態只在記憶體，重開 session 回到展開；要記住得寫進 profile，另議。

使用者選了記成 TODO、另開任務，從 design 站畫 mockup 再做。完成條件：兩塊都能在 Desktop 與終端收合再展開，測試在 onPress 不再切旗標時轉紅，使用者在 Desktop 真機點過一次。

2026-10-17 Desktop 真機（0.111.14）：使用者按 route、tasks 的標題，兩塊都收成一列再展開回來，正常。
