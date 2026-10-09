---
label: session
title: 逐站開 headless session
description: 極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位 — [scripts/station.js](scripts/station.js).
state: blocked
link: scripts/station.js
group: 交接後 context 仍過 400k
timing: after: 交接選項（簡報 §6.2）實施後 context 仍常過 400k
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 106 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條是 2026-09-26 從根目錄 TODO.md 第 106 行搬進來的備案，不是一個已經動工的缺口：交接選項（簡報 §6.2）已由 handoff-1 在 cb6e3d31 做完，但「做完之後 context 仍常過 400k」這個前提還沒有人量過，所以逐站開 headless session 的極端版沒有理由現在做，也沒有理由刪。連結的 scripts/station.js 目前只是網頁伺服器，唯一的 spawn 是開瀏覽器和拉起自己（第 206、825 行），沒有任何一處逐站開 `claude -p`，也沒有總輪數、花費、時間上限，更沒有讀回 `status` 欄位。

要做時的改法：在 scripts/station.js 旁加一支 driver，每站用 `claude -p` 從零開、狀態只讀寫 `.fankeel/build/<task>/`，三個上限（輪數、花費、逾時）寫成 flag，每站結束要讀到 `status` 欄位才算回報。

何時動手：用 `node scripts/ctx.js <session-id> --by-stage` 量交接後新開的主 session，若在 handoff-1 之後仍有 session 的某站 context 過 400k（`lib/context.js` 的線），這條才轉成要做，做完的標準是 tests/station.test.js 用假的 claude 驅動三個上限都能停下且該測試轉綠。量不到過線的 session 就帶著理由結案。
