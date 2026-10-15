---
label: compact
title: 確認 0.111.4 mod 載入
description: mod 預設就開，之前沒載入是 validate 錯誤（turn.complete 註冊兩次）；確認 0.111.4 在 Desktop 新 session 出現 band、Pane 與 /fankeel-panel
state: ready
link: hooks/compact.ts
---

來源：2026-10-13，SBIR 工作區的 Desktop session b6e7b45b 帶著 active 任務、經過 20 次 turn 結束，長到 530k 都沒有壓縮。fankeel 的壓縮 mod（hooks/compact.ts，由 hooks/mod.ts 載入）只在這個 session 於 /plugin 按過 Enable 之後才會跑，所以那個 session 沒人按，mod 就沒動。10-03 與 10-05 的探測用 --plugin-dir 載入 mod，設定檔只放 enabledPlugins，mod 在啟動時就載入了；但 repo 裡沒有任何一處記下為什麼安裝版不行，即使 settings.json 已有 fankeel@fankeel 為 true。要做的：在 Desktop 上找出有沒有哪個設定能讓安裝版的 module 在啟動時就載入，不必每個 session 按 Enable。這需要互動式的 Claude Desktop session，headless 看不到。完成條件：找到的設定已記在 fankeel-init，或確定沒有這種設定的證據已記在這筆待辦裡。

2026-10-14：試了兩條。一、Desktop 的外掛頁只有開關，沒有 Enable for this session，0.106.0 已裝但 mod 沒載入。二、settings.json 的 env 加 CLAUDE_CODE_PLUGIN_DIRS=F:/ymlab/fankeel，開新 session，band 和 Pane 都沒出現；已還原。

2026-10-16：上面「要按 Enable 才載入」的前提是錯的。官方文件（code.claude.com/docs/en/plugins/mods/overview.md）寫 Mods are on by default，Desktop 從 2.1.286 支援；Desktop 內建 2.1.295 已啟用 fankeel、資料夾已信任，沒有 disableAllHooks，仍沒載入。真正的原因是 `claude plugin validate` 失敗：`on("turn.complete") is registered twice without a matcher`（ed189829 在 `hooks/pane.ts` 加了第二支，隨 0.111.0 發出），引擎因此拒絕整個 hooks module，band、Pane、`/fankeel-panel` 與自動壓縮全部沒作用。0.111.4 修掉，合成 `hooks/compact.ts` 的一支，旗標放在 `hooks/turn.ts`；`tests/plugin-validate.test.js` 守住。要做的只剩：在 Desktop 開新 session，確認 band、Pane 出現、`/fankeel-panel` 存在，之後這筆可以結案。
