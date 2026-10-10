---
label: design
title: design 的檔案表一律寫成檔
description: `DESIGN_TO_BUILD` 只在 build 受控時注入，bounded 任務的 build 分母只在對話裡，壓縮後就沒了
state: ready
link: lib/stages.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 7 筆，judge 排在第二優先。現況：lib/stages.js:593-594 的 DESIGN_TO_BUILD 只在 build 受控而 design 不受控時注入，目前 profile 只控 survey。bounded 是最常用的 class，它沒有 plan 檔，build 的分母是 design 的 file table，只存在對話裡；skills/fankeel-build/SKILL.md:186-188 說 next 那 120 字就是它的 ledger；hooks/compact.ts:30-41 的壓縮指令只保 plan file path，而 bounded 沒有這個路徑。所以長對話壓縮之後 done: n of m 沒有 m。compact-1、compact-2、design-2 都不涵蓋。要變成：拿掉 controlling(build, v) 這個條件，design 接 build 的路線一律把檔案表寫到 .fankeel/build/task-<started>/design.md；instructionsFor 多一行保住該路徑。完成條件：build 不受控的 bounded 任務在 design 結束後磁碟上有 design.md，壓縮指令含它的路徑，兩者都有測試。
