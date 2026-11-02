---
label: handoff
title: hand-off 記 HEAD 留或刪
description: hand-off 記下 HEAD、adopt 時列出之後變動的 claim 的 SPIKE 程式碼還標著 throwaway，要轉正（拿掉 SPIKE 註解）還是刪掉未定 — [lib/registry.js](lib/registry.js).
state: done
link: lib/registry.js
done:
  at: 2026-11-02
  sha: 7e97146b
  disposition: done
  session: 30421c7e-7fcf-4361-be33-90b25dd1ebbb
---

來源：task-20261101T152419（教授 11-01 功能）build 階段發現的殘留程式碼，屬於另一個任務，該任務沒有動它。現況：hand-off 時把 HEAD 記進 registry 的 handoffSha（lib/registry.js:821 的 SPIKE 註解寫入、:828 的 handoffShaOf 讀出），scripts/task.js:1191 在 hand-off 取 HEAD、:1538 在 adopt 時列出自 hand-off 以後變動過的 claim，tests/handoff-sha.test.js 覆蓋它。功能可用、測試是綠的，但四處都還標著「SPIKE (throwaway)」，讀者分不出它是正式功能還是試驗。station-6.md 的 Spike 是另一件事，不重複。要決定：一、轉正——拿掉 SPIKE 註解，把行為寫進 hand-off/adopt 的文件；二、刪掉——移除這四處與測試。完成條件：樹裡不再有 SPIKE (throwaway) 字樣，且留下的話文件與測試一致、刪掉的話 suite 仍綠。

## 完成紀錄

使用者選轉正：SPIKE 標記拿掉，registry.md 寫明 hand-off 記 HEAD、adopt 列出之後變動的 claim. 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-02-30421c7e)

- commit 7e97146b
