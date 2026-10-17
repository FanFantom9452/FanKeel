---
label: brief
title: 子代理 brief 改走 spawn
description: 依 2026-10-07 mod 重開決策的第三項：以 agent.spawn 改寫 prompt 取代 `hooks/brief.js` 的一部分；第一步是互動式 n>1 探測，不是搬遷
state: ready
link: hooks/brief.js
---

來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第三項。已知：headless n=1 下 agent.spawn 改寫的 prompt 成為子代理 transcript 第 1 行（docs/90-agent/reports/2026-10-03-mod-probe-3.md:14）；session.append 帶 agentId 可把一列 user 文字加進執行中的子代理，這個 repo 沒測過。第一步：在互動式 session 按 Enable 後派至少三個子代理，看每一個的 transcript 第 1 行是否為改寫後的 prompt，並試一次 session.append 對執行中的子代理。完成條件：探測成立就另開 design 決定 hooks/brief.js 哪一部分搬到 agent.spawn；不成立就把結果寫進本條並關閉。共通規則：mod 沒載入時 hooks/brief.js 照舊運作。

## 探測步驟（2026-10-16 盤點寫成）

前提：mod 要在互動式 session 載入。mod 預設就開，Desktop 也會載入；10-14 以為 Desktop 要按 Enable，其實是 0.111.0 到 0.111.3 的 validate 錯誤讓整個 module 被拒，0.111.4 已修（compact-6 的 10-16 紀錄）。

1. 重用 `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts`：把 `:7` 的 LOG 改到一個新的 `.fankeel/build/<日期>-spawn-probe/records`。這支 probe 只在 dispatch 的 description 含 `mod-probe b` 時改寫 prompt（`:116`），改寫方式是在 prompt 尾端加 `MOD-PROBE-SPAWN-<nonce>`。
2. 終端執行 `claude --plugin-dir docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod --debug-file <log>`，在 session 裡 `/plugin` → Enable for this session。debug log 要有 `hooks module … loaded`；沒有就是 rollout 旗標 `tengu_plugin_hooks_modules` 關著，停在這步並記下。
3. 派三個 description 含 `mod-probe b` 的子代理，prompt 各不相同。
4. 每一個：看 `<session 目錄>/subagents/agent-<agentId>.jsonl` 第 1 行是否以 `MOD-PROBE-SPAWN-<nonce>` 結尾。互動式 session 的 jsonl 可能不落地（mod-probe-3 只見 `.meta.json`），不在就改看 records 裡的 `agent.spawn` 紀錄，並記下「transcript 未落地」。
5. `session.append`：欄位名照 `index.d.ts:10541` 的 `SessionAppendArgs`，是 `message` 與 `agentId`。probe 已對第二個 `mod-probe b` 子代理呼叫一次（見〈探測準備〉），剩下的是讀結果：`session.append.call` 紀錄，記下它的回傳或 `{deny}`。
6. 三個都成立，就另開 design 決定 `hooks/brief.js` 哪一部分搬到 `agent.spawn`；任一不成立，就把結果寫進本條並關閉。

## 探測準備（2026-10-17）

步驟 1 與步驟 5 已備好，檔案在 `.fankeel/build/2026-10-17-spawn-probe/`（不進 git）。`mod/hooks/probe.ts` 的 LOG 指向同一目錄的 `records`，nonce 改存在 `probe.nonce4`。第二個 description 含 `mod-probe b` 的子代理跑到第一步時，probe 對它呼叫一次 `session.append`，結果記成 `session.append.call`。欄位照 `.claude-plugin/types/claude-code/index.d.ts:10541` 的 `SessionAppendArgs`：`message` 與 `agentId`；這份型別檔在這個 checkout 已經有，不必先載入 mod。`node .fankeel/build/2026-10-17-spawn-probe/check.mjs` 在假引擎上驗過這三件事。步驟 2 起要使用者在互動式 session 跑：`claude --plugin-dir .fankeel/build/2026-10-17-spawn-probe/mod --debug-file <log>`。

## 探測結果（2026-10-17，互動式）

- module 載入：VS Code 終端的 Claude Code 2.1.302，`claude --plugin-dir` 帶 mod 啟動，debug log 有 `hooks module fankeel-mod-probe@inline loaded`，事件含 `agent.spawn` 與 `session.append`；不必另外按 Enable。mod 目錄要有 `.claude-plugin/plugin.json`，10-17 備料時漏了，從 mod-probe-3 複製一份後才載入。
- 三個子代理的第 1 行：同一個回應派出的三個 haiku 子代理（session 2cc94879-0b29-448c-9449-0fa2828ba921），transcript 都落地，第 1 行都以 `MOD-PROBE-SPAWN-` 加 nonce 結尾，prompt 各多 53 字元。fankeel 的 title hook 先把 description 前面加上模型與 effort，probe 用子字串比對，照樣認得。
- session.append：對第二個子代理呼叫一次，回傳 uuid、沒有 deny；那一列以 isMeta 的 user 列寫進它的 transcript，它的下一則 assistant 回應就接在這一列後面。
- 結論：成立。brief.js 哪一部分搬到 agent.spawn，另開 brief-6 決定；本條關閉。
