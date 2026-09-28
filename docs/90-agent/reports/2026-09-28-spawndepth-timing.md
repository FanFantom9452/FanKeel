---
status: current
last_verified: 2026-09-28
source_of_truth: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/` 下的 `hook-log.jsonl`、`summary.json`、`provenance.txt`、`claude-out.json`；`record.js` 與 `run.sh` 的 md5 記在 `provenance.txt`。本頁每一個數字都從那些檔來；重測在 docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/
---

## 問題

`hooks/brief.js` 的 `nestedBrain()` 上面那段註解說：

> Anything that keeps that file from answering — no transcript path, no file yet, bad JSON, no field — reads as depth 1: a missed nested mark only costs a spurious `group` (today's behaviour), a missed real mark breaks the controller, so unknown must not skip the mark.

也就是說，`agent-<id>.meta.json` 在 `SubagentStart` 觸發當下如果還沒寫好、或還沒帶 `spawnDepth`，`nestedBrain()` 會退回「非巢狀」（`false`），呼叫端因此把它當成 depth 1。這頁量的就是：那個檔案在 hook 觸發當下，到底有沒有帶著 `spawnDepth` 存在。

## 怎麼量

跑的是 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh`＋`record.js`，用真的 headless `claude -p` 跑一個外層 agent（`nester`）再巢狀派一個內層 agent（`leaf`），在 `SubagentStart` 觸發的當下（`atHook`）與事後（`existsAfter`）各讀一次 `agent-<id>.meta.json`，記下當時的 `spawnDepth`（`depthAtHook`／`depthAfter`）與 `parentAgentId`（`parentAfter`）。跑出的 `provenance.txt` 記的 sha 是 `55a06982bcb57a6d00fd598ad3b4a1ac5dff173a`；本頁寫成當下 repo 的 HEAD 是 `78ab1d158b2c05f11e4f92602a048b552ca90a8f`，兩者不同是因為跑量之後又落了幾個 commit，本頁引的是 `provenance.txt` 記錄當時的那個 sha。`provenance.txt` 也記了 `record.js` 的 md5 `36624c097c3173549676376649f5dbfc`、`run.sh` 的 md5 `c60fbe70ceb2907cb489f261381b5ce4`，以及 `claude exit 0`。

兩個 agent：外層 `nester`（`agent_id` = `a994590b20dcad134`）沒有 parent；內層 `leaf`（`agent_id` = `a6f74f5f8185413fb`）的 parent 是 `nester`。

## 結果

| agent_type | atHook | depthAtHook | existsAfter | depthAfter | mtimeMinusHookMs |
| --- | --- | --- | --- | --- | --- |
| nester | false | null | true | 1 | 87 |
| leaf | false | null | true | 2 | 36 |

## 結論

兩列的 `atHook` 都是 `false`、`depthAtHook` 都是 `null`：`SubagentStart` 觸發的當下，`agent-<id>.meta.json` 兩個 agent 都還沒有可讀的 `spawnDepth`。兩列的 `existsAfter` 都是 `true` 且 `depthAfter` 有值（`nester` 為 1、`leaf` 為 2），`leaf` 的 `parentAfter` 是 `nester` 的 `agent_id`：檔案是事後才補齊、且巢狀關係最終是對的。`mtimeMinusHookMs` 兩列都是正值（87、36），也就是檔案的 mtime 落在 hook 記錄時間之後，佐證 hook 觸發時檔案確實還沒寫好。三項合起來：兩個 agent 一致落在「檔案在 hook 時序上還沒能答」這一支，也就是 `nestedBrain()` 那段註解說的 fallback 分支——沒有出現「兩者都在 hook 時就帶著 `spawnDepth`」的情形，也沒有兩列不一致的 mixed 結果。

## 重測：hook 內等待（2026-09-28）

`docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/` 的 `record.js` 在 hook 裡每 20 ms 重讀一次 `agent-<id>.meta.json`，最多等 500 ms，其餘與上面那次相同。`provenance.txt` 記的 HEAD `106883355dd5fb6eacdd885ff87fb7a67aa7c918`，`record.js` md5 `d4173de7fdf6bcad71cbd36a6d15b901`，`run.sh` md5 `f83565ab17177ce0f355e946f2a13261`，`claude exit 0`。

| agent_type | firstSeenMs | depthAtFirstSeen | polls | waitedMs | mtimeMinusReturnMs |
| --- | --- | --- | --- | --- | --- |
| nester | null | null | 18 | 520 | 29 |
| leaf | null | null | 18 | 524 | 90 |

兩列的 `firstSeenMs`、`depthAtFirstSeen` 都是 `null`：等滿 500 ms、輪詢 18 次，`agent-<id>.meta.json` 仍沒有一次帶著可讀的 `spawnDepth`。`mtimeMinusReturnMs` 兩列都是正值（29、90），即檔案的 mtime 落在 hook 返回之後，佐證 Claude Code 是等 hook 返回才寫這個檔案，等多久都等不到。`hooks/brief.js` 不改。只跑了一次。
