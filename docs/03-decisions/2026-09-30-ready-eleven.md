---
status: decision
last_verified: 2026-09-30
---

# TODO 全表盤點（09-30）：決策紀錄

一句話：Ready 十一條處理完九條。五條修了程式或測試，三條量測後不用改，一條實跑確認。另外兩條留在 Ready：await-1 只過一半，station-8 量測沒過。data-1 從 Needs a decision 轉進 Ready，只加了一個保留欄位。

計畫見 [../99-archive/2026-09-30-ready-eleven.md](../99-archive/2026-09-30-ready-eleven.md)，design 見 [../99-archive/2026-09-30-ready-eleven-design.md](../99-archive/2026-09-30-ready-eleven-design.md)，量測見 [../90-agent/reports/2026-09-30-ready-eleven-measurements.md](../90-agent/reports/2026-09-30-ready-eleven-measurements.md)。

## 為什麼

使用者選了全表盤點，要求「全部都做，主要是 INIT 還有 UPGRADE 都要」。upgrade-2 完整修掉。Ready 裡沒有一條碰到 init，所以 init 沒有動，只有 data-1 的保留欄位寫在 init 會寫的 `data` bucket 上。

## 定了什麼

- upgrade-2：`scripts/upgrade.js` 的 `readTodo` 只在 `ENOENT` 時回 `null`，其他錯誤照原樣拋出（87fa41af）。
- tests-3：`tests/contract.test.js` 的註解不再寫死版本出現在幾個地方（41417f3a）。
- await-4：`lib/handoff.js` 加 `pendingTool`。transcript 尾端還有沒拿到 `tool_result` 的 `tool_use` 時，閒置要到 `busyMs`（11 分鐘）才算 `lost`；讀不到 transcript 時當作還在等（ff028dda、a53fdab9）。
- collisions-2：用測試釘住三件事：`index.lock` 被佔住時，`commit.js` 以 1 結束並印出原因；兩個 `commit.js` 同時跑不會安靜失敗；兩個 worktree 改同一行，第二次 merge 會停在衝突。`collisions.md` 也寫明 fankeel 在這條路上沒有自己的程式（a8a944f5、7cbec770）。
- commit-2：使用者 09-30 選「profile 設定」。新增 profile 鍵 `commit.format`（一行正規式），`commit.js` 在 stage 任何 block 之前檢查每則訊息的第一行，有一則不符就整個檔都不提交。沒設這個鍵時行為照舊（4450c74b、5d7890d7）。
- data-1：使用者 09-30 說要一個「未來功能欄位」，現在不寫處理機制。`data` bucket 保留一個鍵 `access`，`normalise()` 讀到它會丟掉，有測試釘住（17fdeafd）。位置、負責人、保留期限那一半留在 Ready。
- test-3、tests-1：在乾淨 worktree 各跑三次全套，都沒重現，以 `measured-no-change` 關閉。
- inject-2：全套負載下（約 22 個 node process）量了 20 次，最大值沒超過 5 秒，manifest 維持 5 秒，並加測試釘住這個值（4c547048）。條目原本描述的是 34 個 process 的負載，這次沒有重現到那個程度，所以這個結論只在量到的負載以內成立。
- skills-1：使用者在新 session 實跑，三項都成立（5014df7f）。模型拿到的 skill 清單裡沒有 `fankeel:fankeel-station`；不加斜線請它開監控站時，它不呼叫這個 skill；打 `/fankeel:fankeel-station` 仍可執行。

## 沒做的

- await-1：實跑的 `build close` brain 交回時，await 印的是 `build.md`，這一項成立。但 session 的 `inflight` 標記沒有 `kind: 'close'`，而是 `group: 6`，第 5 組的標記在它結束後也沒被清掉。條目留在 Ready。
- station-8：兩個 session 的單一 subagent context 峰值超過 300k；10 個以上 subagent 的五個 session 裡，有三個最貴 agent 的佔比達 15% 以上。本 session 最貴的是 opus 寫的 plan（34.5%）。條目留在 Ready。
- skills-1 的副作用：模型沒有呼叫 `fankeel-station`，但改走 `fankeel:fankeel` 並自己執行 `station.js serve`，結果監控站照樣開起來。`disable-model-invocation` 擋住的只是那一個 skill，擋不住同一件事被做出來。
- 站 agent 寫的 gate 起初都是英文，要使用者要求後才改成繁體中文。站 agent 的 brief 沒有帶到使用者的語言。
- 本輪沒有 verify 補跑 mutation：reviewer 的唯讀限制擋住了寫暫存檔。
