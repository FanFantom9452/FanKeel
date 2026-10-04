---
label: spend
title: quota.js 真實資料成功路徑
description: tokenbar-usage.jsonl 只有 15 分鐘、視窗內最多動 1 點，quota.js 只走到拒絕路徑；成功路徑與還原僅由合成資料測試證明 — [scripts/quota.js](scripts/quota.js).
state: blocked
link: scripts/quota.js
group: quota.js 真實資料驗證
timing: upstream: TokenBar 累積出跨 10 點以上的真實 7 天視窗
stamp: 2026-10-05
---

來源：2026-10-05 build 退回，在真實 tokenbar-usage.jsonl 上實跑 quota.js --dry-run，exit 1：347 行中 81 行帶 seven_day_pct，涵蓋約 15 分鐘，各視窗內最多動 1 點。

要做成：等 TokenBar 累積出跨 10 點以上的真實視窗後，先 --dry-run 記下輸出，成功才真寫，真寫前備份機器設定檔 profile.json 並記下前後差異。

完成條件：quota.js 在真實資料上走過成功路徑一次，前後差異記進報告；或寫明為何仍跑不到。
