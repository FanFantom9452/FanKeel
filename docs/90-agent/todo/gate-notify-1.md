---
label: gate-notify
title: gate-notify 測試偶發紅
description: gate-notify 測試單跑 40 次中紅過 1 次，同時有全套與其他測試在跑
state: watch
group: await 偶發紅
timing: if: gate-notify 測試在無其他負載下再紅
stamp: 2026-10-25
---

2026-10-25：verify 時全套快速測試中 gate-notify 的一個測試紅過一次（0 !== 1），單跑 5 個全綠。build 時連跑 40 次得 1 次紅，但同時有全套和其他測試在跑，所以可能只是負載下的時序。本次範圍沒有碰 hooks、notify 或該測試。再紅時先存下 suite.tap 的錯誤訊息並在無負載下壓測，完成的標準是找出原因並讓它穩定，或確認它只在高負載下發生並加上明確的等待訊號。

後續壓測：無負載連跑 60 次、6 路並行共 48 次都沒紅，原因仍不明；先前那一次紅發生在全套與其他測試同時跑的時候。
