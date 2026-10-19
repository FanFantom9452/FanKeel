---
label: spend
title: quota.js 真實資料成功路徑
description: tokenbar-usage.jsonl 只有 15 分鐘、視窗內最多動 1 點，quota.js 只走到拒絕路徑；成功路徑與還原僅由合成資料測試證明 — [scripts/quota.js](scripts/quota.js).
state: blocked
link: scripts/quota.js
group: quota.js 真實資料驗證
timing: upstream: TokenBar 累積出跨 10 點以上的真實 7 天視窗
stamp: 2026-10-19
---

來源：2026-10-05 build 退回，在真實 tokenbar-usage.jsonl 上實跑 quota.js --dry-run，exit 1：347 行中 81 行帶 seven_day_pct，涵蓋約 15 分鐘，各視窗內最多動 1 點。

要做成：等 TokenBar 累積出跨 10 點以上的真實視窗後，先 --dry-run 記下輸出，成功才真寫，真寫前備份機器設定檔 profile.json 並記下前後差異。

完成條件：quota.js 在真實資料上走過成功路徑一次，前後差異記進報告；或寫明為何仍跑不到。

## 為什麼還開著

程式面沒有缺口：`lib/quota.js` 的 `MIN_POINTS = 10` 就是要擋掉現在這種資料，所以 `scripts/quota.js` 在真實的 tokenbar-usage.jsonl 上拒絕是對的，不是 bug。05dd0250（2026-10-06）與 50753840、ac231715（2026-10-04）之後，成功路徑與成對寫入的還原仍只由合成資料測試證明，沒有一次真實資料的紀錄。要等 TokenBar 累積出某個 7 天視窗內動了 10 點以上；到時先跑 `node scripts/quota.js --dry-run`，exit 0 並印出 `quota.week` 才真寫，真寫前複製 profile.json 備份，並把前後差異寫進報告。這次 dry-run 的 exit code 從 1 變 0，就是可以收掉的訊號。
