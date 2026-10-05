---
label: inject
title: 站線 65 字元截斷沒有測試
description: hooks/inject.js 把 station 行切在 65 字元，render 測試餵的已是 65 長的字串，改成 6500 也不會有測試變紅
state: ready
link: hooks/inject.js
---

來源：2026-10-05 TODO 盤點 task 的 verify 對手審查。hooks/inject.js:159 的 .slice(0, 65) 沒有任何測試釘住，因為 render 測試餵進去的字串本來就只有 65 長，hook 自己的切割根本沒被跑到。要做：在 tests/inject.test.js 餵一個超長的 write 錯誤訊息，斷言輸出的 station 行被切在 65 字元。完成條件：新測試現況通過，把 65 改成 6500 的 mutation 會讓它變紅。
