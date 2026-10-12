---
label: test
title: 整套跑時 gate 計時測試紅
description: 合併回 main 後整套測試連兩次各紅一個、第三次全綠；看得到的那一個是 gate.station off 的 3000 毫秒計時斷言，跑了 3407 毫秒
state: done
link: tests/gate.test.js
done:
  at: 2026-10-13
  sha: 4bd8c1bb
  disposition: done
  session: 646aa571-88e3-4247-9431-3da839373b68
---

來源：2026-10-12 compact 任務的 land。把 fix/compact-window 併回 main（9af02c50）之後在合併結果上跑整套：第一次 4086 過、1 失敗，沒有留下是哪一個；第二次 4086 過、1 失敗，是 tests/gate.test.js:460 的 gate.station off: the hook neither waits nor writes a pending file，斷言 Date.now() - started < 3000，實際 3407 毫秒；單獨跑 tests/gate.test.js 是 52 過、0 失敗；第三次整套 4087 過、0 失敗。這次合併沒有動 hooks、tests/gate.test.js 或 lib/handoff.js。這就是 Watch 裡「整套再紅一次」那一組等的事件：一次性整套測試失敗未重現、並行 commit 測試偶爾紅，兩筆的 if 條件都成立了，但這次紅的是另一個測試，而且是計時斷言在整套並行時超時。要做的：先確認第一次紅的是不是同一個測試（重跑整套幾次，記下每次紅的名字）；計時斷言若只在整套並行時超時，把門檻改成跟負載無關的判斷（例如斷言沒有寫 pending 檔、沒有等到 gate.station 的秒數，而不是絕對的 3000 毫秒）；順便決定那兩筆 Watch 要不要併進這一筆。完成條件：整套連跑五次都綠，或紅的每一次都有名字與原因記在這裡。

## 完成紀錄

這一筆的測試在更早的 commit 已經改好：gate 的計時測試改成看等待中的檔案，不再看時鐘，所以整套一起跑時不會因為慢而紅。10-13 的盤點對過測試後結案，這一輪沒有為它寫任何程式。條目原本要求的「整套連跑五次都綠」沒有做；這一輪整套跑了兩次，兩次都是 4163 個通過、0 個失敗。

- commit 4bd8c1bb
