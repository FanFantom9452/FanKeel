---
label: test
title: registry 測試標題寫舊規則
description: 一個 markInflight 測試的標題說組號在標記清掉後會空出來，新規則不會；斷言仍成立，只有標題誤導
state: done
link: tests/registry.test.js
done:
  at: 2026-10-19
  sha: 54945165
  disposition: done
  session: 94618e2b-bdfb-4d9d-ab4d-a18b8697a719
---

來源：2026-10-19 TODO 全表盤點（第二輪）verify 的對手審查。tests/registry.test.js 約第 1129 行的標題是「a group resets per lap: group 1 is free again once lap 1's only mark clears」。markInflight 改用 groupSeq 之後，標記清掉並不會空出編號；這個測試能過，只是因為 lap 1 與 lap 2 是不同的 key。

完成的樣子：標題改成像「numbering is per stage and lap」這種說新規則的句子，斷言不動，該檔測試綠。

## 完成紀錄

registry 測試的標題改成現在的規則，不再描述舊的編號方式。

- commit 54945165
