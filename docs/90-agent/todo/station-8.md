---
label: station
title: 最貴單一 subagent 換成上限
description: 取代 station-1 的 (b)：(1) 沒有任何單一 subagent 的 context 峰值超過 300k；(2) 最貴單一 subagent 的佔比低於 40%，只適用於 subagent ≥10 的 session（10-01 使用者把門檻從 15% 改成 40%）。在 8806240d 之後的 session 重新量測。
state: done
link: docs/90-agent/reference/station.md
done:
  at: 2026-10-01
  sha: 1664e87154317d02dde81979f2c2f3986f1a1664
  disposition: done
---

## 量測 2026-09-30

sessions 5; (1) peak over 300k: 2; (2) sessions with 10 or more agents: 5, of them share 15% or more: 3; unpriced models: none

(1) 沒過：2 個 session 的 subagent 峰值超過 300k（365198 與 325505）。(2) 沒過：5 個有 10 個以上 subagent 的 session 中，3 個最貴 agent 佔比在 15% 以上（28.9%、34.5%、34.0%）。詳見 [報告](../reports/2026-09-30-ready-eleven-measurements.md)。

## 量測 2026-10-01

範圍：commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f（2026-09-30 20:19:47 +0800，上一次量測）之後開始、transcript 找得到、至少一個 subagent 的 session；在 worktree 跑，HEAD 是派工 sha 3013140c81f68440ca1519883ccb980fa40c801a（主 checkout 的狀態讀不到）。

sessions 1; (1) peak over 300k: 0; (2) sessions with 10 or more agents: 0, of them share 15% or more: 0; unpriced models: none

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session bfad9d68-2efa-45d3-80e0-ca1e1896fd98 | 8 | 154184（ad820290615cbe7e3） | 71.8%（ad820290615cbe7e3） | $3.50 |

判定：不成立。這次只量到 session bfad9d68 進行到一半的 8 個 subagent；session 結束後重跑是 29 個 subagent、最貴佔比 38.3%，「10 個以上 subagent 的 session：1，其中佔比 15% 以上：1」，依 docs/90-agent/plans/2026-10-01-patrol-four.md 步驟 3 是 fail。單一 session 的中途快照不能關這條；等該 session 結束後再量一次。

## 量測 2026-10-01（40%）

範圍：commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f（2026-09-30 20:19:47 +0800）之後開始、已結束（`active` 不是 true）、transcript 找得到、至少一個 subagent 的 session；讀主 checkout 的 sessions 與 transcript，由從 commit 1664e87154317d02dde81979f2c2f3986f1a1664 開出的 worktree 跑（量的是 session 資料，不隨程式 commit 變；主 checkout 的 porcelain 數當時取不到）。跳過還在跑的：session e31b02e1-09c7-4f68-a7d4-d4688cc21a51。

sessions 1; (1) peak over 300k: 0; (2) sessions with 10 or more agents: 1, of them share 40% or more: 0; unpriced models: none

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session bfad9d68-2efa-45d3-80e0-ca1e1896fd98 | 41 | 154184（ad820290615cbe7e3） | 29.3%（ad820290615cbe7e3） | $8.58 |

判定：pass。
