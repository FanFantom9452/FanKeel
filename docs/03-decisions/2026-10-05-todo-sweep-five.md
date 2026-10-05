---
status: decision
last_verified: 2026-10-05
---

# TODO 全表盤點第五輪（10-05）：決策紀錄

一句話：十七個 task 做完；注入計時沒重現五秒逾時；「cleanup-1 剩下的可刪項」的第三、四項做完；死 build agent 的標記改成交接檔落地就清；write 的門檻定為 2800ms；中文受控規則由 `lib/plain.js` 擋在 gate 與 docs-check；todo 完成時寫白話紀錄；fast mode 的事實寫進 model-choice 並把條目移到 Blocked。

計畫見 [../99-archive/2026-10-05-todo-sweep-five.md](../99-archive/2026-10-05-todo-sweep-five.md)。

## 為什麼

- 注入計時：四個情境各跑五次，最慢的是 `/fankeel`（station 在跑），約 2.0 秒。
- 其中 `station.write` 中位數 1756ms，佔 94%。
- 五秒逾時沒重現，所以這次不改 `hooks/inject.js`。
- 報告留在 `docs/90-agent/reports/2026-10-05-inject-timing.md`。使用者在 build 關卡選了照建議收尾。
- 門檻：量到 write 為 1954 至 2664ms，使用者決定 2800ms。
- 這個數字只寫在 `docs/90-agent/reference/station.md` 的文字裡，沒有程式碼或測試固定它。
- 死 agent 標記：交接檔已到的 group，標記不再擋主控。
- close 標記不寫 group。決定寫進 `docs/90-agent/reference/subagents.md`。
- 受控規則：一句最多 160 欄，不用代號。`lib/plain.js` 負責檢查，gate 與 docs-check 都用它。
- `todoIds` 讀 TODO 失敗時回空陣列。這是 build 時裁定保留的取捨。
- 代價是 gate 此時抓不到裸 TODO 代號。
- `scripts/todo.js done` 可以寫 `## 完成紀錄`。station 的 TODO 面板對已完成條目只顯示它。
- fast mode 只支援 Opus，而且整個 session 一起開關，沒有子 agent 欄位。所以條目移到 Blocked 等上游。

## 沒做什麼

- 沒重跑 station 的 write 計時。
- 沒對測試做「回復修改後變紅」的證明，包括交接標記、完成紀錄、station 面板、plain 檢查。
- 注入只開 serve、SessionStart 提前起 server、冷啟動計時，都另記成 TODO。
- 「brain 該用 opus 還是 sonnet」的對照實驗與「拆掉 shots-v3 兩個 junction」不在本次範圍。
- 完整套件 3519 項、3518 通過、1 略過；略過的是哪一項沒有查。
- 另一次跑時 `tests/collisions-commit.test.js` 紅過一次，是兩個並行 commit 的斷言。重跑與單獨跑三次都綠，沒查出原因。
