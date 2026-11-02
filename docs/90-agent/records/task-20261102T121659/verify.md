```
$ node scripts/suite.js --session f24ff948-4dec-44d0-b10a-03bc5e3e9f45 --fast
suite: 6190 pass, 0 fail @ f2b64db0

$ node scripts/docs-check.js
6 references that no longer resolve   (修正前後都是 6，皆非本次造成)
```

結論：這次 build 的內容都成立，fast suite 全綠，只有一句文件（subagents.md 的 Monitor 段落）因 Task 19 而變成假的，已在這裡修掉。

- 已知項 AWAIT_RULE 範例寫死 `survey` — held。`lib/stages.js:702` 改為 `STAGE` 佔位，`lib/stages.js:738` 代換成各 stage 名，由 771024e1 修；`tests/await-rule-description.test.js` 對七個 stage 逐一驗證結尾字串，代換錯就會失敗。
- dispatch-gate 計畫外修正（d8e5ad4f、6fb6f598）— held。`tests/dispatch-gate.test.js` 涵蓋第二次計數、同一呼叫去重、新使用者訊息重設、marker 目錄不可寫、依 agent_id 分檔、無 session_id。`os.tmpdir()/fankeel-dispatch-gate/` 的 marker 檔不會刪，已被接受為低優先。
- skill-size 失敗 — held。`skills/fankeel-init/SKILL.md` 由 15184 降到 13925 bytes（上限 14000），在 771024e1 收尾時處理，共用的 one-path 條目保持原文。
- Pane 與 station 的 shell 列 — held。`lib/shells.js:57` 與 `hooks/pane-shell.ts:64` 都是先取 Bash description、沒有才取去掉開頭 `cd … &&` 的 command；`hooks/pane.ts:721` 把 description 傳進去；shells.test.js、pane-shell.test.js、guard-monitor.test.js 共 24 項通過。
- guard 對 Monitor 的處理 — 未實測。只有手造 payload 的測試，`plugin.json:148` matcher 仍是 `Bash|PowerShell`，文件已標明未觀察。
- 20 項計畫任務與 ledger — build 報告為 20 of 20，我沒有逐一重跑每個 verifier，只對照 build 報告與上述測試。

docs: `docs/90-agent/reference/subagents.md:680-684` 原本說 Monitor 與背景 Bash 結束「都沒觀察到」，但 065d8c10 已在同檔 656 行記錄背景 Bash 結束會喚醒 controller，所以那句是假的。
fixed here: subagents.md:682-684 改為「背景 Bash 結束已觀察到會喚醒 controller，Monitor 事件則未觀察到」，由 fankeel-fixer（sonnet）修改；我重讀確認文字，docs-check 仍是 6 個舊的（README tour-record.js、plan rationale 兩個已刪計畫、improvement-brief 的 registry.js:453、judge-6 與 notify-2 的裸 commit 碼），無新增。commit 檔：verify-commit.md。
docs-check 另有 24 條「carries no quote」提示，是舊有的非失敗項。
adversary: nothing（一個 reviewer，sonnet，讀證據；未重跑測試也未開 transcript，安全面向無發現）。它指出的缺口：我已查 `hooks/pane.ts:721` 確實傳遞 description。

reads:
.fankeel/build/task-20261102T121659/verify.md — 本報告
docs/90-agent/reference/subagents.md — 676-690 行的修正
lib/stages.js — 702、738 行 await 規則

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : TODO 全表盤點 + shell 標示看得出在跑什麼","options":[{"label":"Go to Land (Recommended)","description":"fast suite 6190 pass / 0 fail，已知六項都查過，subagents.md 一句假話已修，docs-check 剩 6 個舊問題，adversary 無異議。"},{"label":"Back to Build","description":"若想先實測 Monitor 路由、放寬 plugin.json 的 matcher 再回 build；目前只在文件標為未實測。"},{"label":"暫停","description":"先停在 verify，之後再繼續。"}]}],"next":"verify 完成，進 land（先提交 verify-commit.md）"}
```
