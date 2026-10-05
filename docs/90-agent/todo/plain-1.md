---
label: plain
title: gate 漏抓代號要出聲
description: 讀 TODO 失敗時 plain.js 吞掉例外、回傳空陣列，gate 因此不擋裸代號；write 門檻 2800 毫秒也沒有測試固定
state: ready
link: lib/plain.js
---

來源：2026-10-05 TODO 全表盤點 verify 的低嚴重度備註。一，plain.js 的 todoIds 在讀 TODO 失敗時吞掉例外並回空陣列，gate 此時抓不到裸代號，使用者看不到原因；build 時裁定先保留。二，station 的 write 門檻 2800 毫秒只寫在 station 頁的文字裡，沒有程式碼或測試固定它。三，這次新增的幾個測試只證明現在通過，沒有證明舊程式會讓它變紅：交接標記、完成紀錄、station 面板、plain 檢查。要做：讓失敗浮出一個警告；補一個測試固定門檻；對上述測試做回復修改後變紅的證明。完成條件：三項各有測試，全套綠。
