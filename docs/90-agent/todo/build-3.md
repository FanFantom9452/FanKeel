---
label: build
title: build close 先跑 docs-check
description: build close 只跑 npm test，沒跑 docs-check；10-02 改版刪了 TODO.md，死連結與 35 行位移都是 verify 才抓到，退回 build 兩次 — [fankeel-build](skills/fankeel-build/SKILL.md).
state: ready
link: skills/fankeel-build/SKILL.md
---

來源：2026-10-02 TODO folder-only 改版。build close 跑完整套測試（3396 全過）就寫關卡，沒跑 scripts/docs-check.js；結果 verify 第一輪抓到 pipeline.md 8 處舊 TODO.md 規則、station.md 35 行 moved 行號，第二輪又抓到 development.md:76 連到已刪的 TODO.md 與 plan 頁 past-end 引用，前後退回 build 兩次。task.js 在第二次退回時印出「name what verify caught that build's review did not, and add that check to the review」，這就是那個檢查。

要做成：skills/fankeel-build/SKILL.md 的 build close 步驟（與 lib/stages.js 對應的 build 規則）在跑完 npm test 之後加跑 node scripts/docs-check.js，把 gone、moved、past-end 這幾類 finding 當成 build 自己要修的項目，不留給 verify；只有 decision、archive 這類 write-once 頁的歷史連結可以列為 ruling 留下。

完成條件：build close 的輸出形狀含一行 docs-check 結果；tests/skills.test.js（或 stages.test.js）有一條斷言 build close 規則提到 docs-check，拿掉該句即紅。
