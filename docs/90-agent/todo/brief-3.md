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
5. `session.append`：repo 裡沒有呼叫它的程式。先讀 `SessionAppendArgs` 的欄位名：它在 probe 的 mod 資料夾底下 `.claude-plugin/types/claude-code/index.d.ts`，這份型別檔是 mod 載入時由引擎產生的，不在 git 裡，所以要在步驟 1 的 session 開過、mod 載入後才有，再在 probe 加一段，於第二個子代理執行中帶它的 agentId 呼叫一次，記下回傳或 `{deny}`。
6. 三個都成立，就另開 design 決定 `hooks/brief.js` 哪一部分搬到 `agent.spawn`；任一不成立，就把結果寫進本條並關閉。
