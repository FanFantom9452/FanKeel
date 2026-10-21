---
label: todo
title: todo.js new 先查理由字數
description: todo.js new 只查標題寬度，理由不足要等 todo-check 才報 no reason
state: done
link: scripts/todo.js
done:
  at: 2026-10-21
  sha: 4a8c4829
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次 land 開 test-13 時，todo.js new 先因標題 44 欄被拒，改短後成功寫入，接著 todo-check 才報 no reason，只好再手動補一段「為什麼還開著」。同一條目被拒兩次、改了三次。

要做成：todo.js new 在寫檔前就跑 todo-check 用的理由字數判斷（reasonChars），不足時拒絕並說明差多少，和標題寬度的檢查一樣在寫入前擋下。

完成條件：測試證明理由不足的 body 被 new 拒絕且沒有寫出檔案，足夠的照常寫入；todo-check 不會再對剛 new 的條目報 no reason。

## 為什麼還開著

這次 land 只把限制寫進 land skill 的筆記表，程式還沒改；要確認 new 與 todo-check 共用同一個判斷，避免兩邊門檻分歧。
