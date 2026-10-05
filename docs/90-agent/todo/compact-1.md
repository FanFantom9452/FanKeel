---
label: compact
title: 壓縮重試上限沒有測試
description: verify 的對手指出壓縮 mod 的重試迴圈改成無限次，它的單元測試也不會紅；要一個釘住最多三次的測試
state: ready
link: hooks/compact.ts
---

來源：2026-10-05 compact mod 那個 task 的 verify 階段，對手審查做了 mutation：把 hooks/compact.ts 第 71 行附近限制壓縮重試次數的條件拿掉，變成無限重試，tests/compact.test.js 九項仍全過，代表重試上限沒有被任何測試釘住。headless 下 compact 每次都被拒，所以重試路徑在實際環境是會走到的，沒有上限就可能每個 turn 都重打。要做的：在 tests/compact.test.js 加一個測試，讓 compact 一直 reject，斷言最多呼叫三次後停止並寫 log。完成條件：新測試在現況通過，把上限拿掉的 mutation 會讓它變紅。
