---
label: test
title: patrol 留下的三個測試缺口
description: patrol verify 找到三個沒有測試或判斷偏弱的地方 — [scripts/residue.js](scripts/residue.js).
state: done
link: scripts/residue.js
done:
  at: 2026-10-21
  sha: 1699fa45
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點的 verify，對抗檢查者沒有推翻任何一列，但指出三個缺口（見 .fankeel/build 下該任務的 verify.md）。

要做成：一、scripts/await.js 在 main() 裡回 stale 的呼叫點要有端到端測試，刪掉那行測試要會紅；二、scripts/suite.js 結果行的「— TAP: <路徑>」後綴要有測試；三、scripts/residue.js 的 sweepable 目前只看 worktree 根目錄的 mtime 判斷「兩小時沒動」，巢狀檔案修改不會更新它，改成看 worktree 內檔案的最新 mtime（或 HEAD 與 index 的時間），並補「land clean 失敗就略過 sweep」的測試。

完成條件：三項各有一個會在拿掉實作時變紅的測試，sweep 對一個兩小時內有巢狀檔案修改的乾淨 agent worktree 會保留並說明原因。

## 為什麼還開著

這三點是 2026-10-21 盤點的 verify 由對抗檢查者提出，使用者選擇先 land、把缺口記成條目，所以沒有回 build 補。前兩項是「刪掉實作測試仍會過」：await.js 回 stale 的那一行與 suite.js 的 TAP 後綴都只有讀程式與一次人工紅燈當證據。第三項是 sweep 的保守性：一個乾淨、分支已是 HEAD 祖先、根目錄兩小時沒變的 agent worktree，即使 agent 還在巢狀目錄裡改檔，也可能被 land clean 移走；不會丟工作，但 agent 會失去它的工作目錄。做完的樣子見上面的完成條件。
