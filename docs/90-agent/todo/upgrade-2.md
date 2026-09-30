---
label: upgrade
title: readTodo 只吞 ENOENT
description: 09-30 verify 確認：scripts/upgrade.js:34-39 readTodo 對讀不了的 TODO.md 也回 null，把錯藏起來；應只在 ENOENT 回 null、其餘重拋，先寫會紅的測試
state: ready
link: scripts/upgrade.js
---
