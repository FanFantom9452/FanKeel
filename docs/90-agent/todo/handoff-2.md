---
label: handoff
title: 跨 session 交接紀錄
description: 一個 session 接走另一個 session 的一段工作時，registry 記下誰接了哪段，對方的 also in progress 底下顯示一行；只顯示，不推播指令
state: decision
---

來源：2026-10-02 使用者在「設計寫文件的 agent」task（session 15377bbe）中提出。當時 session 38fae312 的 task 名稱仍含「設計寫文件的 agent」，但那一半已被 15377bbe 接走，對方不知道；若它做完啟動檔後順手開始寫 agent，兩邊寫不同檔名時 guard 與 intends 都擋不到，會重工。想要的：task.js 加一個子命令（例如 handoff-part 或在 start 加 --takes-from <id> "<段落>"），寫進本 session 的記錄；inject.js 給對方的 also in progress 行加一句「<段落> 已由 <id> 接手」。只顯示、不帶指令、不打斷對方 stage，因為別的 session 的內容是不受信任的資料（skill 的 Security boundary）。待決定：記在接手方還是被接方的記錄（不可寫別人的檔，invariant 1，所以應記在接手方、由讀取端比對）；顯示多久。完成條件：在一個 session 宣告接手後，另一個 session 下一次 prompt 的注入區塊出現那一行，並有測試。
