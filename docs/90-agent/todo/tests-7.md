---
label: tests
title: 拿掉四處重複的測試斷言
description: 判官點名 stages.test.js 三處、docs.test.js 一處重複的斷言，拿掉或併進已經涵蓋的那條
state: ready
link: tests/stages.test.js
---

## 現況

2026-10-19 判官盤點整個 suite（312 個測試檔），結論是沒有哪個檔可以整個刪，只有四處斷言重複，記在 docs/90-agent/judgements/2026-10-19-obsolete-tests.md 候選清單的第 1 到 4 項。行號是 7d7a16e7 時的位置，動手前用內容重新找。

## 要做

- tests/stages.test.js 第 1228 行附近：clear 那句已在 427 行附近釘過，拿掉這一行斷言，測試本身留著。
- tests/stages.test.js 第 303 行附近：Option one is the approval 已在 246 行附近釘過，併進 242 行附近那條。
- tests/stages.test.js 第 233 行附近：decision record 那句已由 1187 行附近較長的 regex 涵蓋，拿掉 233 那行。
- tests/docs.test.js 第 682 行附近：寫死的 17、13、4 併進 662 行附近的完整清單比對；696 行附近的中文數字改從 actual.length 推出。

約 50 條只檢查文字的測試要留著，audit 靠它們判斷規則措辭有沒有被依賴。

## 完成條件

node --test tests/stages.test.js tests/docs.test.js 全過，四處重複都不在了，完整 suite 綠燈。
