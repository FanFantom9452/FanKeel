---
label: 測試
title: suite 偶發 409 測試紅
description: 整套 suite 跑時 `tests/station-chartroom.test.js` 的「兩個同名 root 回 409」測試出現一次 fetch failed，單獨跑 5 次都過，原因不明。
state: done
done:
  at: 2026-10-27
  sha: d33bc9f4
  disposition: done
  session: add1373d-aba2-45e0-8598-d8ece9d778bc
---

2026-10-25 build 時 suite 在 6e96890a 出現一次，TAP（.fankeel/build/task-20261025T120059/suite.tap 第 18692 行）只有 fetch failed，沒有更深的 cause。單獨跑一次、四份同時跑一輪都全過，所以不是測試本身壞掉，推測是整套並行時的連線競爭，但沒有證據。下次再失敗時，保留完整錯誤與當時的並行負載再查；若查出原因並修好、連跑整套 suite 三次都不再出現，就算完成。

2026-10-26 追查：讀碼的假設是 undici keep-alive socket 碰上同埠重開的新 server；tests/station-chartroom.test.js 已改成每個請求 connection: close，失敗時印完整 cause 鏈、埠號、該埠在本檔是否已被前一份用過（同埠重發才標）與耗時。undici 收 connection: close。負載下（每輪八份同時跑）第二輪的一份重現了：cause 是 `bad port`，`port: 0` 讓作業系統給了 4045，而 fetch 在連線前就拒絕 WHATWG 的 bad ports（4045、5060、6000、6665-6669、10080 等），所以真因是埠號，不是 keep-alive；後來 `start` 遇到被拒的埠就關掉重要一個。修後四輪共 32 份全綠；拿掉 connection: close 再跑八份也全綠，所以那條 keep-alive 假設沒有證據。連跑整套三次的收尾是 land 的事。

## 完成紀錄

原因是隨機埠偶爾拿到瀏覽器擋的 4045，現在會換埠重試，失敗時訊息帶原因與埠號. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-26-add1373d)

- commit d33bc9f4
- commit 286c7899
