---
label: pane
title: Pane 偵測網頁服務給開啟鈕
description: 背景 shell 輸出裡印出 http://127.0.0.1:port 且仍在跑時，Pane 頁尾 station 列上方多一列 [開] 按鈕，最多兩個
state: done
link: hooks/pane.ts
done:
  at: 2026-10-17
  sha: deffe630
  disposition: abandoned
  session: ae8f8efd-1af2-4e36-bbba-2b8908d4b992
---

來源：2026-10-16 使用者在「調整 station mockup」的 design 站問：「右邊 除了 派出的 AGENT 要不要順便顯示 所有 BACKGROUND TASK 然後如果是 網頁服務 可以自動顯示 BUTTON 打開嗎?」。判官（fable）的答案在 docs/90-agent/judgements/2026-10-16-pane-background-tasks.md，選 B 修改版：不列所有背景 task（引擎只在 turn 結束的 classic.Stop / classic.SubagentStop 給 background_tasks 快照，monitor 與 workflow 中途狀態無處可追），只做網頁服務按鈕。

做法：tool.call 包裝 Bash 取 backgroundTaskId，讀 %TEMP%/claude/<slug>/<session>/tasks/<id>.output，只認 http://(127.0.0.1|localhost|0.0.0.0|[::1]):port，輸出尾沒有 [exited with code / [killed] 才算在跑；openStation 泛化成 openUrl，白名單 ^http://(127.0.0.1|localhost):port/?$，不放 path 與 query（cmd /c start 會被 & | ^ 逃出）。放 foot 的 station 列上方，一列一個，最多兩列，終端熱鍵 o。新檔 hooks/pane-serve.ts 放純函式。

完成條件：先實測 hooks module 的 classic.Stop 是否真的帶 background_tasks（判官最大的不確定）；跑一個 dev server 時 Pane 出現該網址的按鈕，server 結束後按鈕消失；網址帶 & 或 path 時不畫按鈕；各有一個測試在規則被拿掉時轉紅；使用者在 Desktop 真機點過一次。

## 完成紀錄

不做了。使用者說 Desktop 內建的 preview 已經能偵測並打開本機網頁服務，測過沒問題，Pane 再做一顆一樣的按鈕是重複。fankeel 這邊沒有寫任何程式。

- commit deffe630
