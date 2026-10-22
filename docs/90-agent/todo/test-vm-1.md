---
label: test
title: vm 對照測試的斷言恆真
description: source.test.js 的 vm 對照測試有一條斷言永遠不會紅
state: done
link: tests/source.test.js
done:
  at: 2026-10-23
  sha: 23d4576f
  disposition: done
  session: 6bedeb94-1482-4af2-8d8f-049b6d29c923
---

第二輪盤點 build 的審查指出 tests/source.test.js 第 163 行的 !vmTarget.has('neverCalled') 永遠不會紅，因為 fixture 裡沒有任何東西能把 neverCalled 放進集合；另外 vm 讀法把測試檔內任何 .name 都算作到達（約第 210 行），可能藏住名稱相同的孤兒匯出。要變成：fixture 多一個不在匯出清單的 box.module.exports.x，讓這條斷言真的能紅。怎樣算完成：刪掉 vm 分支或放寬比對時，對照測試會變紅，且整套快速測試仍綠。

## 完成紀錄

對照只算沙箱匯出的名字，斷言會失敗了. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-6bedeb94)

- commit 23d4576f
