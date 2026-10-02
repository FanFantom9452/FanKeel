---
label: build
title: build 組別編號錯位
description: 第 2 組的報告和 commit 檔被寫成 build-g1，注入區塊也把第 4、7 組標成 group 3
state: ready
---

來源：2026-10-02 session 15377bbe 的「設計寫文件的 agent」task，build 與 plan 階段實際遇到。 現象：派 build group 2 時，stage agent 寫出的檔名是 build-g1-commit.md 和 build-g1.md；派 group 4、group 6 後，UserPromptSubmit 注入的「A build stage agent is already running for group 3」也標錯組號，之後幾次又自行恢復正確。內容都是對的組，只影響顯示與檔名，但檔名重複會讓 await 的 --since 與 .done 標記混淆。要做的：查 inflight.group 從哪裡寫入（hooks/brief.js 或 lib/handoff.js 的 lapOf/group 推算），找出少算一號的原因。完成條件：連續派 8 組，每組的檔名與注入的組號都等於 ledger.js groups 的編號；有測試。
