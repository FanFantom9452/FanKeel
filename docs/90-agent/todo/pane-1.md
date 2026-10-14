---
label: pane
title: 面板真機沒看完的四件事
description: 用下一個真的任務看：撞檔的 ⚑、gate 只在上方第一行顯示、終端、Pane 自己打開
state: ready
---

來源：2026-10-12 fankeel 面板 plan（docs/99-archive/2026-10-12-fankeel-pane-band.md）的 Task 6。使用者在 Claude Desktop 用一筆假的 entry 看過上方兩行與 Pane，說其餘的等開新任務時一起測。要看的四件事：一，兩個 session 碰過同一個檔時，兩邊第一行都有 ⚑ 與紅色色帶，Pane 的「其他 session」有一行共用；二，真的 gate 在等時，第一行多一個黃底的「gate 在等」與還剩幾秒的倒數，Pane 不為它畫任何東西，也不因它自動打開；答案要在終端或 station 頁給；三，終端上的兩行與側邊 Pane，hex 顏色看起來對不對；四，任務開始時 Pane 自己打開，關掉後同一個任務不再跳出來，任務結束時自己關。Claude Desktop 讀的是安裝快照，測之前要先 claude plugin update fankeel@fankeel。做完的標準：四件事各有一句看到了什麼，寫在這筆的完成紀錄裡（設計頁已封存在 docs/99-archive/2026-10-11-fankeel-pane-design.md）；看到不對的各開一筆。

2026-10-14：0.107.0 在 Desktop 畫出 Svg band 與 Pane（session 82155bbc，build 站）；band 第 2 列只有 ctx，沒有 5h／7d，推測 Desktop 沒給 mod 用量額度，未證實。
2026-10-14：終端 band 兩列與 Pane 文字版正常（VS Code 終端）；撞檔、gate 倒數環、淺色主題、Pane 自動開關仍沒看。
