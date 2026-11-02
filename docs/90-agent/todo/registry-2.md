---
label: registry
title: spend 與 render 補架子
description: lib/spend.js:120 帶 { shelf: true } 並拿掉 shelf-readers 的 todo；scripts/render.js:263 的 22.5 註解改 22.13 — 等「移除 station tour」釋出檔案
state: ready
link: lib/spend.js
---

2026-11-02 shelf 任務 land 時，這兩個檔案被「移除 station tour」的 session 佔著，guard 是 deny，所以沒改。釋出後要做兩件事：lib/spend.js:120 改成 registry.readAll(root, { shelf: true })，並拿掉 tests/shelf-readers.test.js 裡 spend 那條測試的 todo；scripts/render.js:263 的「22.5 floor」改成 22.13。
