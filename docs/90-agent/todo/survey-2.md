---
label: survey
title: graphify 接為查詢工具
description: graphify 可接為查詢工具；獨立實測未穩定省錢，接之前先解決它的 PreToolUse hook 擋 Read 與 guard 衝突、Windows 上 hook 靜默失效（其 issue #140） — [scripts/survey.js](scripts/survey.js).
state: watch
link: scripts/survey.js
group: 程式碼大到要查結構
timing: if: 某個專案的程式碼大到 grep 加 read 找不到跨檔關係
stamp: 2026-09-29
---
