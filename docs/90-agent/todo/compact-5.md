---
label: compact
title: 面板提醒改讀 compact.at
description: `hooks/pane.ts`、`lib/context.js` 與 `hooks/pane-status.ts` 仍只認 FANKEEL_COMPACT_AT 或 450000，沒有讀 profile 的 compact.at
state: blocked
link: hooks/pane.ts
group: pane-band 任務收尾
timing: after: Pane 配色任務收尾，放開 `hooks/pane.ts`、`hooks/pane-status.ts` 與 `lib/context.js`
stamp: 2026-10-13
---

來源：2026-10-12 session 80db54ce 做「init 問壓縮門檻四檔」時新增 profile 鍵 compact.at，hooks/compact.ts 已改讀它（commit 77078caa、69b304a8）。第 1 輪審查確認有三處沒跟上，三個檔當時都被 Pane 配色任務佔著、guard 是 deny，使用者裁定只放行文件頁，程式留到該任務收尾。

該變成什麼：
1. hooks/pane.ts 的 contextOf（第 96 行附近）自己抄了一份門檻讀法，只讀 FANKEEL_COMPACT_AT 否則 HARD。改成和 hooks/compact.ts 的 threshold 同一個來源（環境變數、專案 profile、機器 profile、HARD；off 視為不壓縮），最好直接匯入而不是再抄一份。
2. lib/context.js 的 NO_WINDOW（第 154 行附近）在沒設 CLAUDE_CODE_AUTO_COMPACT_WINDOW 時說「沒有自動壓縮視窗」。compact.at 是 350000、450000 或 600000 而且 mod 有載入時，這句不成立；off 時仍成立。
3. hooks/pane-status.ts 第 275 行附近的註解寫門檻是 HARD 或 FANKEEL_COMPACT_AT，補上 compact.at。

4. docs/90-agent/reference/registry.md 第 489 行附近寫 mod「still compacts at 450k」，改成 profile 的 compact.at（預設 450k，off 不壓縮）。這一頁當時同樣被 Pane 配色任務佔著，是 verify 的 adversary 找到的。

做完的樣子：compact.at 設 350000 時，輸入框上方的 ctx 長條與面板的 context 區塊以 350000 為門檻，各有一個測試在讀法被拿掉時變紅；compact.at 為 off 時面板不再顯示「快要自動 compact 了」；context: 行在 compact.at 有數字時不再說沒有視窗。
