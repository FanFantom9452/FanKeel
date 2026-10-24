---
label: flaky
title: phone-stop 負載下偶發失敗
description: phone-stop 的 detach 測試只等 300ms，整套負載下 holding.json 還沒寫好
state: watch
link: tests/phone-stop.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-25
---

來源：2026-10-25 發版 0.111.79 的完整測試，5408 項中唯一失敗：tests/phone-stop.test.js:84「a detach while holding releases the hook with nothing printed」，:92 斷言 holding.json 存在為 false。單獨重跑三次 8/8 全過。原因推測是 :91 固定等 300ms，整套負載下 hook 還沒寫出 holding.json。要做：改成輪詢等到檔案出現（有上限），不用固定 sleep。完成條件：整套連跑三次不再出現。
