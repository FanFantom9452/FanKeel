---
label: notify
title: 手機 gate 通知標題放題目
description: gate 通知的標題只寫 stage，題目藏在內文，收合時看不到
state: done
done:
  at: 2026-10-30
  sha: 1503dcaf
  disposition: done
---

現況：lib/notify.js 的 gateEvent 把標題寫成「<stage> gate 在等你」，第一題的 question 截到 80 字放在內文。手機收合通知時只看得到標題和內文開頭，使用者 2026-10-30 問「手機這邊收到的通知只有 Verify 而不是 AskUserQuestion Title 嗎？」。

要做：標題改成第一題的 question（例如「Verify -> Land | fankeel : TODO 全表盤點」），內文放任務名稱；沒有 question 時退回現在的寫法。lib/notify.js 屬於另一個 session 還沒提交的 notify 功能，等它落地後再改，並更新 tests/notify.test.js 的期待值。

## 完成紀錄

它要改的 lib/notify.js 已在 a233443d 刪掉，題目不存在了；使用者選擇結案，另開 watch「通知做回來，不走第三方」。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-30-546aef3d)

- commit 1503dcaf
