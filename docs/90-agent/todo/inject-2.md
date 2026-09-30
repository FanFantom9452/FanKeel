---
label: inject
title: 提示 hook 在負載下超時
description: inject.js 閒置約 0.6s，但全套測試跑時（34 個 node）常超過 5s 被丟棄，該輪沒有 fankeel 區塊；先量負載下哪段最慢，再決定縮短工作或調高 timeout — [hooks/inject.js](hooks/inject.js).
state: done
link: hooks/inject.js
done:
  at: 2026-09-30
  sha: 4c5470489bd440b7eff963548ee2d9dd0ffd239f
  disposition: measured-no-change
---
