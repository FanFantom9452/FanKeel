---
label: 測試
title: suite 偶發 409 測試紅
description: 整套 suite 跑時 tests/station-chartroom.test.js 的「兩個同名 root 回 409」測試出現一次 fetch failed，單獨跑 5 次都過，原因不明。
state: decision
---

2026-10-25 build 時 suite 在 6e96890a 出現一次，TAP（.fankeel/build/task-20261025T120059/suite.tap 第 18692 行）只有 fetch failed，沒有更深的 cause。單獨跑一次、四份同時跑一輪都全過，所以不是測試本身壞掉，推測是整套並行時的連線競爭，但沒有證據。下次再失敗時，保留完整錯誤與當時的並行負載再查；若查出原因並修好、連跑整套 suite 三次都不再出現，就算完成。
