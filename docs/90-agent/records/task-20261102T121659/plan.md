docs/90-agent/plans/2026-11-02-todo-patrol.md — 20 tasks

1. 兩條 TODO 依 survey gate 的答案改狀態
2. title.js 認 CLAUDE_CODE_SUBAGENT_EFFORT
3. ask skill 註明判官已 xhigh
4. spend 與 render 補架子
5. 文件寫明 Desktop 閒置壓縮與 compact.at 的分工 (compact-8)
6. init 提示 /auto-mode-setup，並在壓縮視窗那題寫明閒置壓縮 (init-4, compact-8)
7. TODO 條目對齊 — init-4 改為等重驗、spend-6 指向分工
8. Pane 的 `shellLabel`
9. Pane 記下 description 並用 `shellLabel` 畫列
10. station 的 shell 列同一套標示
11. AWAIT_RULE 要 await 的背景 Bash 帶 description、不加 cd
12. profile 加 `verify.blast` 門檻鍵
13. lenses 算 fan-in，超過門檻列呼叫者
14. verify 的 SKILL 點名 blast-radius，bytes 上限跟著動
15. 逾時轉背景的 shell 結果不算 lost（await-17）
16. guard.js 把 Monitor 當 shell 呼叫（await-18）
17. 文件——Desktop 背景語意、lost 判斷、Monitor 結論（docs-15、await-17、await-18）
18. dispatch gate 的 ask 經 mod tool.check 交給人（decider person）
19. 親手觀察背景 Bash 的喚醒與逾時轉背景的結果文字（await-17）
20. 實機確認 auto mode 下 dispatch gate 由人回答、沒人時拒絕

constraints: 12 lines, from CONTRIBUTING.md, tests and plan-B's measured budgets
lint: fankeel ledger — lint: clean
reviewer: 3 gaps, fixed — Task 19 的 todo.js new 改成交給 land；Task 20 的 gate-21 改手加一行；「先問完、剩下自己跑」的「開新條目」struck（條目本身就是重議條目）
groups: 5 groups over 20 tasks; Task 19、20 是 user，最後和你一起做
open: Task 11 的規則句可能超過 survey／build 的 byte 預算，超過就停下回報，不自行調 budget

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : TODO 全表盤點 + shell 標示看得出在跑什麼","options":[{"label":"Go to Build (Recommended)","description":"核准 2026-11-02-todo-patrol.md 的 20 個任務，18 個 sonnet implementer 分 5 組跑。最後兩項（背景 Bash 喚醒、auto mode 的 dispatch gate）和你親手觀察。等待規則那一句若超過 byte 預算就停下回報。"},{"label":"Stay in Plan","description":"沒有未決的計畫問題；只在你想刪減任務（例如這輪先不做 dispatch gate 或 blast-radius）時留下。"},{"label":"暫停","description":"計畫已寫好未 commit，next 設為「從 Plan gate 繼續：核准 2026-11-02-todo-patrol.md 後進 build」。"}],"multiSelect":false}],"next":"從 Plan gate 繼續：核准 2026-11-02-todo-patrol.md 後進 build"}
```
