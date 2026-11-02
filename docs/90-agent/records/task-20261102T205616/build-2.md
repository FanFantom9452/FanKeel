- lib/guard.js +7/-3 — `SHELL_WRAPPER`：`bash -c`、`powershell -Command`、`cmd /c` 等包裝下，`preanswerStop` 改讀原始指令，引號內的刪除會詢問
- hooks/guard.js +10/-7 — 預答 `ask` 移到 controlled-stage 寫入 deny 與 `emitCommit` 敏感資料掃描之後；`emitCommit` 回傳是否已輸出判定
- tests/guard-preanswer.test.js +34/-0 — 引號刪除、deny 勝過 ask、掃描判定勝過 ask（含 `&& git push`）

done: 2 of 2 缺口已修；ledger 無計畫，Task 3（A）依設計保持開啟，hands 已回答，不再詢問
docs-check: 未對本輪動手；剩餘 `moved`／`bare-code` 發現位於 todo 與 reference 頁，本範圍未碰（`a7abba57..466ef137` 只動三個檔）
suite: `--fast` 6232 pass、1 fail（`tests/board-page.test.js`，單獨重跑通過，屬不穩定測試）
未檢查：兩個實作者都沒有實際跑過變異（還原修正看測試是否轉紅），只靠讀碼推論；第二輪廣化的 regex 未再派 reviewer 審一次。

reads:
hooks/guard.js — 預答 ask 現在排在 deny 與掃描之後（約 :118-146）
lib/guard.js — `SHELL_WRAPPER` 與 `preanswerStop`（約 :404-415）
tests/guard-preanswer.test.js — 新增的三組測試

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點　兩條缺口已修並過 suite，進 verify 複驗？","options":[{"label":"Go to Verify (Recommended)","description":"本輪修正：引號包裹的刪除會詢問，deny 與敏感掃描優先於預答 ask；fast suite 通過（board-page 單獨重跑通過）。"},{"label":"Stay in Build","description":"想先要求補跑變異檢查，或讓 reviewer 再審第二輪廣化的 SHELL_WRAPPER，再進 verify。"},{"label":"暫停","description":"先停在這裡，不進下一站；修正已在 main 上，之後可從 verify 繼續。"}]}],"next":"verify 複驗 preanswer 兩條缺口，之後 land 並於 release 後切換 marketplace"}
```
