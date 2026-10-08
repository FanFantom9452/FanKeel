---
label: tests
title: guard 測試整套偶爾紅
description: 09-19 在 39efee9 整套紅過一次（1563/1564，已死的 pid 被當 live 而 deny），同樹重跑 1564/0、單跑 5/5 綠；疑 `deadPid()` 的 pid 在並行時被重用，未證實 — [tests/guard.test.js](tests/guard.test.js).
state: done
link: tests/guard.test.js
group: guard 測試再紅一次
timing: if: `a claim whose process is gone does not block` 在整套裡再紅一次
stamp: 2026-09-26
done:
  at: 2026-10-09
  sha: e332f851f0cd2f0ce257e602783dd51cb8443e55
  disposition: done
---

來源：根目錄 TODO.md 第 161 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：09-19 在 39efee9 整套紅過一次（1563/1564，已死的 pid 被當 live 而 deny），同樹重跑 1564/0、單跑 5/5 綠；疑 `deadPid()` 的 pid 在並行時被重用，未證實

完成條件：條目所述的事做完或確認不必做，並把結果寫回這個檔案再結案。

## 完成紀錄

deadPid() redraws any candidate pid that is still running (tests/guard.test.js:55), landed in a22d8f61 on 2026-09-28, with its own test at tests/guard.test.js:63; tests/guard.test.js runs 58 pass, 0 fail.

- commit e332f851f0cd2f0ce257e602783dd51cb8443e55
