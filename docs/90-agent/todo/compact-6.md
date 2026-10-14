---
label: compact
title: 實測安裝版 mod 啟動就載入
description: 安裝版 fankeel 的 mod 目前要每個 session 在 /plugin 按 Enable 才載入；找有沒有設定能讓 Desktop 啟動時就載入
state: ready
link: hooks/compact.ts
---

來源：2026-10-13，SBIR 工作區的 Desktop session b6e7b45b 帶著 active 任務、經過 20 次 turn 結束，長到 530k 都沒有壓縮。fankeel 的壓縮 mod（hooks/compact.ts，由 hooks/mod.ts 載入）只在這個 session 於 /plugin 按過 Enable 之後才會跑，所以那個 session 沒人按，mod 就沒動。10-03 與 10-05 的探測用 --plugin-dir 載入 mod，設定檔只放 enabledPlugins，mod 在啟動時就載入了；但 repo 裡沒有任何一處記下為什麼安裝版不行，即使 settings.json 已有 fankeel@fankeel 為 true。要做的：在 Desktop 上找出有沒有哪個設定能讓安裝版的 module 在啟動時就載入，不必每個 session 按 Enable。這需要互動式的 Claude Desktop session，headless 看不到。完成條件：找到的設定已記在 fankeel-init，或確定沒有這種設定的證據已記在這筆待辦裡。

2026-10-14：試了兩條。一、Desktop 的外掛頁只有開關，沒有 Enable for this session，0.106.0 已裝但 mod 沒載入。二、settings.json 的 env 加 CLAUDE_CODE_PLUGIN_DIRS=F:/ymlab/fankeel，開新 session，band 和 Pane 都沒出現；已還原。
