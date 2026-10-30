---
label: docs
title: 花費頁改版的說明頁
description: station.md、兩份 guide 與 profile 說明仍寫舊的花費頁，被另一個 session 的檔案宣告擋住
state: done
done:
  at: 2026-10-31
  sha: b0dcbce2
  disposition: done
  session: 33a02218-c768-43da-94ce-118cd5834b8d
---

來源：spend-quota build（花費頁改成總覽、7d 額度、5h 額度、明細四個分頁，不接 (x%)，kpiHtml 不再有花費讀數與校準日，heroEyebrow 已刪，花費自己印「凍結於 {t}」，index.html 多載 quota-share.js）。這些頁被 weekly gate 任務（7ca66bf2）的檔案宣告擋住，build 沒有強制解除，所以還是舊的：docs/90-agent/reference/station.md:190、212、620、1137、1147、1453 與其餘 moved 引文，docs/01-guide/station.md:29、96，docs/01-guide/profile.md:44、97、103，以及 lib/profile.js:33（改完要跑 node scripts/profile-table.js 重生成表）。完成的標準：node scripts/docs-check.js 不再列出 station.md 的 moved，這幾句與頁面一致。要寫的字句在 .fankeel/build/task-20261030T071915/build.md。

## 完成紀錄

spend-quota 說明頁已寫完（station.md、兩份 guide、profile），docs-check 無 station.md moved

- commit a1761a3f
- commit b0dcbce2
