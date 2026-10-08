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

pid 被重用的成因從頭到尾是假設（本條自己寫「未證實」），a22d8f61（2026-09-28）是針對它加固，不是證明它：`deadPid()`（tests/guard.test.js:55-61）現在對每個候選 pid 用 `process.kill(pid, 0)` 檢查，還在跑就重抽，連續 20 個都在跑才丟錯；tests/guard.test.js:63 的 `deadPid skips a candidate that is still running` 在舊版 helper 下是紅的（a22d8f61 的 commit message：舊版忽略參數、回傳自己剛 spawn 的 pid），所以這條測試分得出修好與沒修。本條 `timing:` 要的是整套裡再紅一次，但 2026-09-28 之後沒有引用過整套的跑法，結案憑的是重抽這條防線，不是整套綠；目前單檔 `node --test tests/guard.test.js` 為 58 pass、0 fail，只當現況，不當證據，因為 09-19 那次事故單檔本來就是綠的。

- commit e332f851f0cd2f0ce257e602783dd51cb8443e55
