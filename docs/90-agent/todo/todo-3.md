---
label: todo
title: 完成清單顯示在哪
description: TODO.md 只列未完成，完成的條目看起來像被刪了（09-30 教授會議）；要顯示在 TODO.md 的 ## Done、station 一欄，還是 init 開場列最近幾條 — [lib/todo.js](lib/todo.js).
state: done
link: lib/todo.js
done:
  at: 2026-09-30
  sha: e3a425ff
  disposition: done
  session: 0fc4b8f3-9116-4bd6-9de2-f2435ae4a100
---

完成的條目沒有刪：檔案留在 docs/90-agent/todo/，`state: done`，帶 `done.at`、`done.sha`、`done.disposition`（09-30 有 31 個）。`lib/todo.js` 已把它們依日期由新到舊排成 `done` 清單；station 頁有沒有畫出來還沒查。實驗室同學用的安裝版可能比 repo 舊。
