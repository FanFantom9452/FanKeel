---
label: test
title: vm 對照測試的斷言恆真
description: source.test.js 的 vm 對照測試有一條斷言永遠不會紅
state: ready
link: tests/source.test.js
---

第二輪盤點 build 的審查指出 tests/source.test.js 第 163 行的 !vmTarget.has('neverCalled') 永遠不會紅，因為 fixture 裡沒有任何東西能把 neverCalled 放進集合；另外 vm 讀法把測試檔內任何 .name 都算作到達（約第 210 行），可能藏住名稱相同的孤兒匯出。要變成：fixture 多一個不在匯出清單的 box.module.exports.x，讓這條斷言真的能紅。怎樣算完成：刪掉 vm 分支或放寬比對時，對照測試會變紅，且整套快速測試仍綠。
