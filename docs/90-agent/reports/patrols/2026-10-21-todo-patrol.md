---
status: decision
last_verified: 2026-10-21
---

# TODO 全表盤點（10-21）：四條結案，README 與指南對回程式

一句話：31 條全部查過，四條可直接做的做完結案，knip 重跑仍認不得，使用者指出 README 與文件跟不上程式，survey 找到的過時處也一起改掉。

任務紀錄在 [2026-10 月紀錄](../../records/2026-10.md#r-2026-10-20-b7a7d8d4)。計畫封存在 `docs/99-archive/2026-10-21-todo-patrol.md`。

## 做了什麼

- 「舊 await 通知別叫醒主對話」結案：handoff 已經問過、之後沒再改時，舊的 await 只回一行 stale（6df93ffe）。
- 「紅燈時 suite.js 留下完整 TAP」結案：紅燈在 suite.json 旁寫 suite.tap 並印出路徑，綠燈移除（f08ec15f）。
- 「agent 分支與 worktree 殘留」結案：`residue.js --sweep` 與 `land.js clean` 清掉內容已在 main、沒有未提交檔、兩小時沒動的 agent worktree 與分支，其餘留下並說原因（310df451、7a4f3cb9）。
- land 站提交規則那條結案：使用者選「只改 mover 與 brain」，mover 拒絕 git commit，brain 不再把 git write 派給 mover（93c2e6dc）。
- knip 用 6.42.1 重跑，`clearBadge` 仍找不到 import，條目重蓋 10-21（54bcec8b）。
- README 補上漏掉的 skill、hook 與三項功能；開發指南、profile、監控站指南的數字改成現況；pipeline、concepts、getting-started 與文件索引重讀後重蓋日期。
- init 一起做：`lib/chartroom/README.md` 歸檔、三個殘留 worktree 確認已在 main 後刪除。

## 沒做什麼

- verify 找到三個缺口沒修，記成新條目「patrol 留下的三個測試缺口」：await 的 stale 呼叫點與 TAP 後綴沒有端到端測試，sweep 的「兩小時沒動」只看根目錄 mtime。
- fast suite 第一次跑時 `tests/await.test.js:561` 的 gate page 測試紅過一次，重跑都綠，根因沒查。
- land 站提交規則沒動 `lib/stages.js`，這是使用者的選擇。
- 其餘 Blocked 與 Watch 條目等的條件都還沒發生，照舊。
