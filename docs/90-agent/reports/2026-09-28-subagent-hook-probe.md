---
status: current
last_verified: 2026-09-28
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 hooks/budget.js 為準
---

# subagent 收不收得到 PostToolUse 的 additionalContext，SubagentStart 排在 prompt 前面嗎 — 2026-09-28 的量測

`docs/90-agent/plans/2026-09-28-agent-lifetime-design.md`「尚未證實」段的兩個問題：`hooks/budget.js`
的 SOFT 提醒要靠 PostToolUse 的 `additionalContext` 送進 subagent 自己的模型，而 `scripts/ledger.js
brief --group --prefix` 的共用前綴要靠 SubagentStart 排在 `prompt` 前面才能真正共用快取。這一頁是那次
量測，跑一次就不再更新。

## 方法

一支一次性 hook（`docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js`，不進
`.claude-plugin/plugin.json`，只透過 `--settings` 掛載）在 SubagentStart 的 `additionalContext`、
一次 Read 之後的 PostToolUse `additionalContext`、一次 Glob 的 PreToolUse 拒絕理由裡各放一個字面
nonce `PROBE-SUBAGENTSTART-lifetime-2026-09-28` / `PROBE-POSTTOOLUSE-lifetime-2026-09-28` /
`PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28`。一次 headless `claude -p` turn 派一個 subagent 做這兩
件事並逐字回報看到的 nonce 與順序；同一支 hook 也把每次觸發的 `agent_id`／`transcript_path` 寫進
`probe-log.jsonl`，`node hook.js summarise` 讀回它。

`probe-log.jsonl` 全部 6 行，照原樣抄錄：

```text
{"event":"PreToolUse","tool":"Agent","agent_id":null,"transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":null}
{"event":"SubagentStart","tool":null,"agent_id":"ae849dc3877fe9057","transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":"PROBE-SUBAGENTSTART-lifetime-2026-09-28"}
{"event":"PreToolUse","tool":"Glob","agent_id":"ae849dc3877fe9057","transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":"PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28"}
{"event":"PreToolUse","tool":"Read","agent_id":"ae849dc3877fe9057","transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":null}
{"event":"PostToolUse","tool":"Read","agent_id":"ae849dc3877fe9057","transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":"PROBE-POSTTOOLUSE-lifetime-2026-09-28"}
{"event":"PostToolUse","tool":"Agent","agent_id":null,"transcript_path":"C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl","emitted":null}
```

`summary.json`：

```json
{
  "rows": [
    {
      "event": "PreToolUse",
      "tool": "Agent",
      "agent_id": null,
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": null
    },
    {
      "event": "SubagentStart",
      "tool": null,
      "agent_id": "ae849dc3877fe9057",
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": "PROBE-SUBAGENTSTART-lifetime-2026-09-28"
    },
    {
      "event": "PreToolUse",
      "tool": "Glob",
      "agent_id": "ae849dc3877fe9057",
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": "PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28"
    },
    {
      "event": "PreToolUse",
      "tool": "Read",
      "agent_id": "ae849dc3877fe9057",
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": null
    },
    {
      "event": "PostToolUse",
      "tool": "Read",
      "agent_id": "ae849dc3877fe9057",
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": "PROBE-POSTTOOLUSE-lifetime-2026-09-28"
    },
    {
      "event": "PostToolUse",
      "tool": "Agent",
      "agent_id": null,
      "transcript_path": "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl",
      "emitted": null
    }
  ],
  "subagentStartEmitted": true,
  "postToolUseEmitted": true,
  "preToolUseDenyEmitted": true,
  "subagentTranscriptPaths": [
    "C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl"
  ]
}
```

subagent 的逐字回答（`claude-out.json` 的 `result` 欄位）：

```text
SUBAGENT: The Glob call was denied. The exact error was `PreToolUse:Glob hook error: PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28`. It came from a PreToolUse hook, not from a permissions rule.

The Read of `target.txt` succeeded. Its only content is line 1, "a target file for the probe subagent to Read", and it contains no PROBE- string.

Every string starting with PROBE- that I saw, in the order I first saw it:
1. `PROBE-SUBAGENTSTART-lifetime-2026-09-28`, in a system-reminder headed "SubagentStart hook additional context".
2. `PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28`, in the Glob deny reason.
3. `PROBE-POSTTOOLUSE-lifetime-2026-09-28`, in a system-reminder headed "PostToolUse:Read hook additional context", which followed the Read result.

That SubagentStart reminder arrived after the task text, so no line naming SubagentStart was visible to me before it. The system prompt and the earlier context blocks (memory index, git status) contained no PROBE- string and no SubagentStart mention.
```

## 這一次定下來的

| 欄位 | 結果 |
|---|---|
| PostToolUse 的 `additionalContext` 送不送進 subagent 自己的模型 | `summary.json` 的 `postToolUseEmitted` 是 `true`；模型的回答裡有 `PROBE-POSTTOOLUSE-` 開頭的字串 |
| SubagentStart 排在 prompt 前面 | 模型說看不到——牠明確說 SubagentStart 那則 system-reminder 排在任務文字**之後**才出現 |
| PreToolUse 的拒絕理由送不送進 subagent | `summary.json` 的 `preToolUseDenyEmitted` 是 `true`；模型的回答裡有 `PROBE-PRETOOLUSE-DENY-` 開頭的字串 |
| subagent 自己的 `transcript_path` | `summary.json` 的 `subagentTranscriptPaths`：`["C:\\Users\\Owner\\.claude\\projects\\F--ymlab-fankeel\\923ffd4b-455e-45bb-bb59-2339acca1a10.jsonl"]` |

## 這一次沒有定下來的

- 只跑了一次，三個欄位都沒有重跑驗證是否穩定。
- SubagentStart 排序的答案是模型自己的陳述，不是 harness 排出的逐字紀錄；`docs/90-agent/reports/2026-09-04-subagent-brief-probe.md` 用同一個限制量過一次，這裡是第二個案例。
- 這次觀察到的 `transcript_path` 與主 session 的 transcript 路徑相同（都是 `923ffd4b-...jsonl`），與 Task 1 的測試假設（subagent 有獨立的 `agent-<id>.jsonl`）不同；`hook.js` 記下的是 payload 本身回報的路徑，這一點留給讀這頁的人核對，不在這個探測的範圍內重新驗證。

## 對 §3／§4 的影響

- `postToolUseEmitted` 是 `true`，且模型的回答裡確實出現對應的 `PROBE-POSTTOOLUSE-` 字串：§3 如原設計運作，`hooks/budget.js` 的 PostToolUse 分支生效，不必留成「未經證實」。
- SubagentStart 排在 prompt **之後**，不是之前：§4「共用前綴要靠 SubagentStart 排在 prompt 前面才能真正共用快取」的前提不成立——SubagentStart 注入的內容排在 subagent 自己的任務文字後面，不能靠它把共用前綴放到快取最前段。這個答案留給「brain 的 dispatch-order 行為」那個負責頁面（design §3 最後一點、§4 第二點，這個 plan 的 Part C 之外）處理，本頁不修改任何程式碼。
- HARD 的 PreToolUse 拒絕（`preToolUseDenyEmitted: true`）與 `hooks/guard.js` 先前的結論一致，維持原設計。

## 出處

- 探測腳本：`docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/`（`hook.js`、`run.sh`，此提交一併保留）。
- 對照：`docs/90-agent/reports/2026-09-11-hook-payload-probe.md`、`docs/90-agent/reports/2026-09-04-subagent-brief-probe.md`。
