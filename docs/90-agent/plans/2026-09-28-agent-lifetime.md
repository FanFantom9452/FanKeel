---
status: design-intent
date: 2026-09-28
---

# Agent Lifetime Implementation Plan

**Goal:** shorten every subagent's life so its cost stops growing with requests × context.
**Architecture:** build runs one brain per disjoint `ledger.js groups` group, in parallel, each ending with its group; plan lint caps a task's read size; a subagent-only budget hook nudges at 150k and blocks at 250k; implementer prompts open with a byte-identical shared prefix that carries `context.md`'s content.
**Tech Stack:** Node.js built-ins only (CommonJS), `node --test`; Claude Code hook events PreToolUse, PostToolUse, SubagentStart.
**Spec:** [2026-09-28-agent-lifetime-design.md](2026-09-28-agent-lifetime-design.md)

## Global Constraints

- No dependencies: `package.json` has none; test runner is `node --test` (`"test": "node --test"`).
- `lib/*.js`: pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` (CONTRIBUTING.md:15).
- `scripts/*.js`: thin wrappers over `lib/`. A new flag on the station CLI needs a row on `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js` fails (CONTRIBUTING.md:16).
- `hooks/*.js`: every hook exits `0` on every path, including its own errors (CONTRIBUTING.md:17, README.md `## Development`). A new hook file is registered in `.claude-plugin/plugin.json`.
- Tests: every exported name needs an importer; a new file must be `git add`ed before `tests/source.test.js` sees it (CONTRIBUTING.md:19).
- Documentation filing (CONTRIBUTING.md:20): `docs/90-agent/reference` is reference, `docs/90-agent/reports` is report (write-once — correct with a dated block, never rewrite the body), `docs/03-decisions` is decision, `docs/90-agent/plans` is plan. A new or renamed page gets its `docs/README.md` row in the same change.
- Never hand-edit a file `station.js serve` writes (CONTRIBUTING.md:21).
- `TODO.md`: one bullet per deferred thing under `## Ready`, `## Needs a decision`, `## Blocked` or `## Watch` (CONTRIBUTING.md:22).
- Version numbers move only through `scripts/version.js` (CONTRIBUTING.md:24).
- Station strings live in `assets/station/i18n.js`, one entry per key per language.
- Every task in this plan obeys the cap it introduces: at most 3 `Modify:` files and at most 1500 lines of them read; a file over 1500 lines is named with a line range.
- Windows: write files with LF; `python` writes need `newline=''`.

## Task 1: subagent hook probe — nonces on SubagentStart/PostToolUse/PreToolUse

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js` — a one-shot hook script (new file) that emits a nonce on SubagentStart's `additionalContext`, on a subagent's Read `PostToolUse`, and denies a subagent's Glob on `PreToolUse` with a nonce in the reason; also a `summarise` mode that parses its own log
- Modify: `docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/run.sh` — a driver script (new file) that writes the probe's `settings.json`, runs `claude -p`, and prints the summary
- Modify: `docs/90-agent/reports/2026-09-28-subagent-hook-probe.md` — the report (new file), filled in from the real run
- Test: `tests/subagent-hook-probe.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — a probe and its report, not a library

**Dispatch:** implementer, sonnet — the whole task is transcribing a known probe shape (docs/90-agent/reports/2026-09-11-hook-payload-probe.md, docs/90-agent/reports/2026-09-04-subagent-brief-probe.md) onto three new hook events and running one `claude -p` turn; no judgement call in it.

This task answers the design's "尚未證實" section — the two facts §3 and §4 are built on and have never been observed:

1. Does a `PostToolUse` hook's `additionalContext` actually reach a **subagent's own** model, the way `hooks/resume.js` already proves it reaches the main session's?
2. Does `SubagentStart`'s injected text land before the subagent's own `prompt` in its context — which decides whether §4's shared prefix can share a cache with it — or is the order unknown?

**Later C tasks that depend on this probe's outcome:** Task 4 (`hooks/budget.js`) implements the `PostToolUse` SOFT nudge exactly as designed regardless of this probe's answer, but if this task's report finds `postToolUseEmitted: false` (the additionalContext never reached a subagent's own model in the observed run), 4 must still be built — leave its `PostToolUse` branch in place, commented as unverified rather than deleted, since a future host version may honour it — and `.claude-plugin/plugin.json`'s `PostToolUse` registration for `hooks/budget.js` should be left registered too (it exits 0 and writes nothing when `info.used < SOFT`, so a dead nudge costs nothing to leave running). The concrete fallback step, if that is what this probe finds: **do not remove the PreToolUse HARD deny** — a deny reason is not in question (`hooks/guard.js` already proves a deny reason reaches a subagent; this probe's PreToolUse nonce is a sanity re-check, not a new question) — so the mechanism still works with the nudge silently inert. No other C task reads this probe's SubagentStart-ordering answer to change its own code; it is filed for whoever writes the brain's dispatch-order behaviour (design §3's last bullet, §4's second bullet — outside this plan's Part C).

### Steps

1. Write the failing test.

   In `tests/subagent-hook-probe.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');

   const { parseLog } = require('../docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js');

   test('parseLog finds each nonce by its prefix, and the subagent-side transcript_path', () => {
       const lines = [
           JSON.stringify({ event: 'SubagentStart', tool: null, agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-SUBAGENTSTART-lifetime-2026-09-28' }),
           JSON.stringify({ event: 'PreToolUse', tool: 'Glob', agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-PRETOOLUSE-DENY-lifetime-2026-09-28' }),
           JSON.stringify({ event: 'PostToolUse', tool: 'Read', agent_id: 'a1', transcript_path: '/x/agent-a1.jsonl', emitted: 'PROBE-POSTTOOLUSE-lifetime-2026-09-28' }),
           JSON.stringify({ event: 'PostToolUse', tool: 'Bash', agent_id: null, transcript_path: '/x/main.jsonl', emitted: null }),
       ].join('\n');
       const r = parseLog(lines);
       assert.equal(r.subagentStartEmitted, true);
       assert.equal(r.postToolUseEmitted, true);
       assert.equal(r.preToolUseDenyEmitted, true);
       assert.deepEqual(r.subagentTranscriptPaths, ['/x/agent-a1.jsonl']);
   });

   test('parseLog reports false for a nonce that never fired, and no subagent transcript', () => {
       const lines = [JSON.stringify({ event: 'PostToolUse', tool: 'Bash', agent_id: null, transcript_path: '/x/main.jsonl', emitted: null })].join('\n');
       const r = parseLog(lines);
       assert.equal(r.subagentStartEmitted, false);
       assert.equal(r.postToolUseEmitted, false);
       assert.equal(r.preToolUseDenyEmitted, false);
       assert.deepEqual(r.subagentTranscriptPaths, []);
   });

   test('parseLog does not throw on a blank log', () => {
       const r = parseLog('');
       assert.deepEqual(r.rows, []);
   });
   ```

2. Run it and see it fail: `node --test tests/subagent-hook-probe.test.js` — `Cannot find module '../docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js'`.

3. Write the implementation.

   In `docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/hook.js`, write:

   ```javascript
   #!/usr/bin/env node
   'use strict';
   // One-shot: answers the two questions docs/90-agent/plans/2026-09-28-agent-lifetime-design.md's
   // "尚未證實" section names, copying the shape docs/90-agent/reports/2026-09-11-hook-payload-probe.md's
   // probe-hook.js used — one script, no matcher, appending one JSON line per event to
   // probe-log.jsonl beside it. Three behaviours that script did not have: a nonce in
   // SubagentStart's own additionalContext, a nonce in a PostToolUse additionalContext after a
   // subagent's Read, and a nonce in a PreToolUse deny reason for a subagent's Glob — each
   // prefixed so a search for `PROBE-` finds every one of them at once. The nonce is a fixed
   // literal rather than a random value, the same reason 2026-09-07's probe used a fixed NEEDLE
   // rather than one generated per run: what matters is that it could not already be in a
   // subagent's context by coincidence, not that it differs between runs.
   //
   // `node hook.js summarise` reads the log back and prints the table the report's findings
   // section quotes; every other invocation is Claude Code itself, feeding the payload on stdin.
   const fs = require('fs');
   const path = require('path');

   const LOG = path.join(__dirname, 'probe-log.jsonl');
   const NONCE = 'lifetime-2026-09-28';

   function parseLog(text) {
       const rows = String(text || '').split(/\r?\n/).filter(Boolean).map((l) => {
           try { return JSON.parse(l); } catch (e) { return null; }
       }).filter(Boolean);
       const emitted = rows.map((r) => r.emitted).filter(Boolean);
       const has = (p) => emitted.some((e) => String(e).startsWith(p));
       const subagentRows = rows.filter((r) => r.agent_id);
       const subagentTranscriptPaths = [...new Set(subagentRows.map((r) => r.transcript_path).filter(Boolean))];
       return {
           rows,
           subagentStartEmitted: has('PROBE-SUBAGENTSTART-'),
           postToolUseEmitted: has('PROBE-POSTTOOLUSE-'),
           preToolUseDenyEmitted: has('PROBE-PRETOOLUSE-DENY-'),
           subagentTranscriptPaths,
       };
   }

   function runHook() {
       let input = '';
       process.stdin.setEncoding('utf8');
       process.stdin.on('data', (c) => { input += c; });
       process.stdin.on('end', () => {
           let payload;
           try { payload = JSON.parse(input); } catch (e) { return; }
           const event = payload.hook_event_name;
           let out = null;
           if (event === 'SubagentStart') {
               out = { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: 'PROBE-SUBAGENTSTART-' + NONCE } };
           } else if (event === 'PostToolUse' && payload.agent_id && payload.tool_name === 'Read') {
               out = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'PROBE-POSTTOOLUSE-' + NONCE } };
           } else if (event === 'PreToolUse' && payload.agent_id && payload.tool_name === 'Glob') {
               out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'PROBE-PRETOOLUSE-DENY-' + NONCE } };
           }
           const record = {
               event, tool: payload.tool_name || null, agent_id: payload.agent_id || null,
               transcript_path: payload.transcript_path || null,
               emitted: out ? (out.hookSpecificOutput.additionalContext || out.hookSpecificOutput.permissionDecisionReason) : null,
           };
           fs.appendFileSync(LOG, JSON.stringify(record) + '\n');
           if (out) process.stdout.write(JSON.stringify(out));
       });
   }

   if (require.main === module) {
       if (process.argv[2] === 'summarise') {
           let text = '';
           try { text = fs.readFileSync(LOG, 'utf8'); } catch (e) { /* no log yet */ }
           process.stdout.write(JSON.stringify(parseLog(text), null, 2) + '\n');
       } else {
           runHook();
       }
   }

   module.exports = { parseLog };
   ```

4. Run it and see it pass: `node --test tests/subagent-hook-probe.test.js` — all three tests green.

5. Write the driver.

   In `docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/run.sh`, write:

   ```sh
   #!/usr/bin/env sh
   # Runs the nonce probe once and prints the summary. See ../../2026-09-28-subagent-hook-probe.md
   # for the question this answers, and docs/90-agent/reports/2026-09-11-hook-payload-probe.md for
   # the shape this copies.
   REPO="F:/ymlab/fankeel"
   OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe"
   cd "$REPO" || exit 1

   rm -f "$OUT/probe-log.jsonl"

   cat > "$OUT/settings.json" <<JSON
   {
     "hooks": {
       "SubagentStart": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ],
       "PostToolUse": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ],
       "PreToolUse": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ]
     }
   }
   JSON

   echo 'a target file for the probe subagent to Read' > "$OUT/target.txt"

   PROMPT='Dispatch exactly one subagent, model sonnet, with this task verbatim: "First attempt a Glob call for the pattern nonsense-probe-should-not-exist-*.txt and note whether it was denied and the exact reason if so. Then Read the file docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/target.txt. Report every string starting with PROBE- that you saw anywhere in your own context — system prompt, a deny reason, a tool result — one per line in the order you first saw it, and say whether a line naming SubagentStart was visible to you before this task text, or that you cannot tell." Relay its full final message verbatim, prefixed "SUBAGENT: ".'

   {
     echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
     echo "HEAD: $(git rev-parse HEAD)"
     echo "porcelain:"; git status --porcelain
     echo "claude: $(claude --version)"
   } > "$OUT/provenance.txt"

   claude -p "$PROMPT" \
     --output-format json \
     --model sonnet \
     --settings "$OUT/settings.json" \
     --setting-sources project \
     --permission-mode bypassPermissions \
     --disallowedTools "Edit Write NotebookEdit" \
     > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

   echo "claude exit $?" >> "$OUT/provenance.txt"
   node "$OUT/hook.js" summarise > "$OUT/summary.json"
   cat "$OUT/summary.json" >> "$OUT/provenance.txt"
   ```

   This step's fence is `sh`, exempt from the file-naming rule, but the file is committed at the path named above.

6. Run the probe for real: `sh docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/run.sh`. Read `claude-out.json`'s `result` field for the subagent's relayed answer, `summary.json` for what the hooks actually saw, and compare: every `PROBE-` string the model reports must also be a `true` in `summary.json`, or the model is claiming something no hook fired proves — the same discipline the two precedent reports use (a claim needs the observed control, not the model's say-so).

7. Write the report.

   In `docs/90-agent/reports/2026-09-28-subagent-hook-probe.md`, write:

   ```markdown
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

   `probe-log.jsonl` 全部 <N> 行，照原樣抄錄：

   ```text
   <paste probe-log.jsonl here>
   ```

   `summary.json`：

   ```json
   <paste summary.json here>
   ```

   subagent 的逐字回答（`claude-out.json` 的 `result` 欄位）：

   ```text
   <paste the relayed SUBAGENT: ... text here>
   ```

   ## 這一次定下來的

   | 欄位 | 結果 |
   |---|---|
   | PostToolUse 的 `additionalContext` 送不送進 subagent 自己的模型 | `summary.json` 的 `postToolUseEmitted` 是 <true/false>；模型的回答裡<有/沒有> `PROBE-POSTTOOLUSE-` 開頭的字串 |
   | SubagentStart 排在 prompt 前面 | 模型<說看到/說看不到/說不確定> SubagentStart 那行排在任務文字之前 |
   | PreToolUse 的拒絕理由送不送進 subagent | `summary.json` 的 `preToolUseDenyEmitted` 是 <true/false>；模型的回答裡<有/沒有> `PROBE-PRETOOLUSE-DENY-` 開頭的字串 |
   | subagent 自己的 `transcript_path` | `summary.json` 的 `subagentTranscriptPaths`：<paste the array> |

   ## 這一次沒有定下來的

   - 只跑了一次，三個欄位都沒有重跑驗證是否穩定。
   - SubagentStart 排序的答案是模型自己的陳述，不是 harness 排出的逐字紀錄；`docs/90-agent/reports/2026-09-04-subagent-brief-probe.md` 用同一個限制量過一次，這裡是第二個案例。

   ## 對 §3／§4 的影響

   - 若 `postToolUseEmitted` 是 `false`：`hooks/budget.js`（Task 4）的 PostToolUse 分支保留在程式碼裡，
     不刪除，但視為未經證實生效；HARD 的 PreToolUse 拒絕不受影響，機制仍然成立。
   - 若 `postToolUseEmitted` 是 `true`：§3 如原設計運作，兩個分支都算生效。

   ## 出處

   - 探測腳本：`docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/`（`hook.js`、`run.sh`，此提交一併保留）。
   - 對照：`docs/90-agent/reports/2026-09-11-hook-payload-probe.md`、`docs/90-agent/reports/2026-09-04-subagent-brief-probe.md`。
   ```

   Fill every `<...>` from the actual `probe-log.jsonl`, `summary.json` and `claude-out.json` this run produced — this is transcription of a real run's output, not a placeholder left for later.

8. Commit:

   ```
   git commit -m "evidence: subagent hook probe — PostToolUse additionalContext, SubagentStart order, transcript_path (design's 尚未證實)"
   ```

## Task 2: SOFT/HARD subagent context budget thresholds

**Files:**
- Modify: `lib/context.js` — export `SOFT` and `HARD`, the two thresholds `hooks/budget.js` (Task 4) reads
- Test: `tests/context-budget.test.js`

**Interfaces:**
- Consumes: none
- Produces: `SOFT` (`150000`), `HARD` (`250000`) — both exported from `lib/context.js`, beside `BUSY`

**Dispatch:** implementer, sonnet — two constants and an export line; the plan carries both.

The exact lines this task touches, `lib/context.js:38-41` today:

```
// Tokens in play above which a session is worth moving out of, before the first
// compaction rather than after it.
const BUSY = 400000;
```

and the export line, `lib/context.js:147`:

```
module.exports = { inspect, contextLine, tokens: k, TAIL, BUSY, readTail };
```

### Steps

1. Write the failing test.

   In `tests/context-budget.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { SOFT, HARD, BUSY } = require('../lib/context.js');

   test('SOFT and HARD are the two subagent budget thresholds design section 3 sets', () => {
       assert.equal(SOFT, 150000);
       assert.equal(HARD, 250000);
       assert.ok(SOFT < HARD, 'the nudge fires before the deny');
       assert.ok(HARD < BUSY, 'a subagent is refused well before a session is called busy');
   });
   ```

2. Run it and see it fail: `node --test tests/context-budget.test.js` — `SOFT` and `HARD` are `undefined`, `assert.equal(undefined, 150000)` fails.

3. Write the implementation.

   In `lib/context.js`, after the `BUSY` line, add:

   ```javascript
   // Where hooks/budget.js starts nudging a subagent to hand off, and where it
   // starts refusing everything but that handoff — on the subagent's own
   // transcript (`agent-<id>.jsonl`), never the main session's `BUSY` above.
   // Both are far under BUSY: session f44b1c61's worst subagent reached 544k
   // before it ever returned, and this design exists to end one long before that.
   const SOFT = 150000;
   const HARD = 250000;
   ```

   In `lib/context.js`, then change the export line to:

   ```javascript
   module.exports = { inspect, contextLine, tokens: k, TAIL, BUSY, SOFT, HARD, readTail };
   ```

4. Run it and see it pass: `node --test tests/context-budget.test.js` — green.

5. Commit:

   ```
   git commit -m "feat: SOFT/HARD subagent context budget thresholds in lib/context.js"
   ```

## Task 3: relayPath — one hand-off file per agent

**Files:**
- Modify: `lib/handoff.js` — add `relayPath(root, data, agentId)` beside `contextPath`
- Test: `tests/handoff-relay.test.js`

**Interfaces:**
- Consumes: none
- Produces: `relayPath(root, data, agentId)` — returns `<task dir>/relay-<agentId>.md`, or `null` with no agent id or no readable `started`

**Dispatch:** implementer, sonnet — one function, following `contextPath`'s own shape exactly.

The exact lines this task touches, `lib/handoff.js:70-76` today:

```
// The task's exchange of verified facts — `scripts/context.js` is its only
// writer. Beside the handoffs and not per stage: a fact read in build is as
// true in verify, until HEAD moves past the sha it was read at.
function contextPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/context.md' : null;
}
```

and the export line, `lib/handoff.js:415`:

```
module.exports = { handoffPath, commitPath, answerPath, contextPath, pendingPath, readPending, answersSince, handedOffSince, ledgerCommitPath, readGate, skipReason, gateMatches, writeAnswer, lapOf, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit };
```

### Steps

1. Write the failing test.

   In `tests/handoff-relay.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { relayPath } = require('../lib/handoff.js');

   const DATA = { started: '2026-09-19T09:30:12.345Z' };

   test('relayPath names one relay file per agent, under the task directory', () => {
       assert.equal(relayPath('/r', DATA, 'a1b2c3'), '/r/.fankeel/build/task-20260919T093012/relay-a1b2c3.md');
   });

   test('relayPath is null with no agent id, or no readable started', () => {
       assert.equal(relayPath('/r', DATA, ''), null);
       assert.equal(relayPath('/r', {}, 'a1b2c3'), null);
   });
   ```

2. Run it and see it fail: `node --test tests/handoff-relay.test.js` — `relayPath` is not a function.

3. Write the implementation.

   In `lib/handoff.js`, right after `contextPath`'s closing brace, add:

   ```javascript
   // Where hooks/budget.js tells a subagent nearing HARD to write its progress
   // before every further tool call is refused, and where the brain that
   // dispatched it looks for that file to hand the rest of the task to a fresh
   // agent (design §3). One file per agent, not per task: two subagents in the
   // same task hitting HARD at once must not overwrite each other's relay.
   function relayPath(root, data, agentId) {
       const dir = dirFor(root, data);
       const id = String(agentId || '').trim();
       return dir && id ? dir + '/relay-' + id + '.md' : null;
   }
   ```

   In `lib/handoff.js`, then change the export line to add `relayPath` after `contextPath`:

   ```javascript
   module.exports = { handoffPath, commitPath, answerPath, contextPath, relayPath, pendingPath, readPending, answersSince, handedOffSince, ledgerCommitPath, readGate, skipReason, gateMatches, writeAnswer, lapOf, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit };
   ```

4. Run it and see it pass: `node --test tests/handoff-relay.test.js` — green.

5. Commit:

   ```
   git commit -m "feat: relayPath in lib/handoff.js for a subagent's hand-off file"
   ```

## Task 4: hooks/budget.js — nudge a subagent at SOFT, refuse at HARD

**Files:**
- Modify: `hooks/budget.js` — new hook, PreToolUse and PostToolUse, subagent-only
- Modify: `.claude-plugin/plugin.json` — register it on both events, no matcher
- Read: `lib/context.js` — `SOFT`, `HARD`, `inspect()` (Task 2, unchanged here)
- Read: `lib/handoff.js` — `relayPath(root, data, agentId)` (Task 3, unchanged here)
- Read: `lib/guard.js` — `targetOf(payload)`, reused for the HARD write-exception
- Read: `hooks/resume.js` — the PostToolUse `additionalContext` output shape this hook copies
- Read: `hooks/guard.js` — the deny shape and `agent_id` test this hook copies
- Test: `tests/budget.test.js`

**Interfaces:**
- Consumes: `SOFT`, `HARD` (Task 2, `lib/context.js`); `relayPath(root, data, agentId)` (Task 3, `lib/handoff.js`)
- Produces: none

**Dispatch:** implementer, sonnet — the design names the exact shapes to reuse (`hooks/resume.js`'s PostToolUse output, `hooks/guard.js`'s deny shape and `agent_id` test), so this is transcription against those, not a new protocol.

`lib/guard.js:76-82` already exports the helper this task reuses for the HARD write-exception, rather than re-deriving a tool's target path:

```
function targetOf(payload) {
    const input = (payload && payload.tool_input) || {};
    for (const key of ['file_path', 'notebook_path']) {
        if (typeof input[key] === 'string' && input[key]) return input[key];
    }
    return null;
}
```

`hooks/resume.js`'s PostToolUse output shape, `hooks/resume.js:51-56`:

```
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: context,
        },
    }));
```

`hooks/guard.js`'s deny shape and `agent_id` test, `hooks/guard.js:60-73`:

```
        if (!payload.agent_id) return;
        if (!readOnlyAgentType(payload.agent_type)) return;
        const command = (payload.tool_input && payload.tool_input.command) || '';
        if (!writesFiles(command)) return;
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: this is a subagent call (agent_id is set) with the '
                    ...
            },
        }));
        return;
```

`.claude-plugin/plugin.json`'s current `PostToolUse` and `PreToolUse` blocks, in full, are what this task's second Modify line edits (quoted in step 3 below rather than here, since both are edited in one place).

### Steps

1. Write the failing test.

   In `tests/budget.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const tmp = require('./tmp.js');
   const { relayPath } = require('../lib/handoff.js');

   const ROOT = path.join(__dirname, '..');
   const HOOK = path.join(ROOT, 'hooks', 'budget.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
   const AGENT = 'agent0001';

   const ago = (ms) => new Date(Date.now() - ms).toISOString();

   function seed(root, sessionId, over) {
       const dir = path.join(root, '.fankeel', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       const data = Object.assign({ task: 'x', stage: 'build', active: true, started: ago(3600e3), updated: ago(60e3) }, over);
       fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
       return data;
   }

   function transcript(root, tokens) {
       const file = path.join(root, 'transcript.jsonl');
       fs.writeFileSync(file, JSON.stringify({ message: { usage: {
           input_tokens: tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
       } } }) + '\n');
       return file;
   }

   function run(payload) {
       return execFileSync(process.execPath, [HOOK], {
           input: JSON.stringify(payload),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
       });
   }

   test('no agent_id: nothing, regardless of context size', () => {
       const root = tmp('fankeel-budget-');
       seed(root, MINE);
       const t = transcript(root, 260000);
       const out = run({ session_id: MINE, cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Read', transcript_path: t });
       assert.equal(out, '');
   });

   test('160k on PostToolUse: nudged to write the relay and report it', () => {
       const root = tmp('fankeel-budget-');
       seed(root, MINE);
       const t = transcript(root, 160000);
       const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PostToolUse', tool_name: 'Read', transcript_path: t });
       const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
       assert.match(ctx, /150000/);
       assert.match(ctx, new RegExp('relay-' + AGENT + '\\.md'));
   });

   test('under SOFT on PostToolUse: nothing', () => {
       const root = tmp('fankeel-budget-');
       seed(root, MINE);
       const t = transcript(root, 50000);
       const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PostToolUse', tool_name: 'Read', transcript_path: t });
       assert.equal(out, '');
   });

   test('260k on PreToolUse: a Read is denied, the reason names the relay path', () => {
       const root = tmp('fankeel-budget-');
       seed(root, MINE);
       const t = transcript(root, 260000);
       const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
       const o = JSON.parse(out).hookSpecificOutput;
       assert.equal(o.permissionDecision, 'deny');
       assert.match(o.permissionDecisionReason, /250000/);
       assert.match(o.permissionDecisionReason, new RegExp('relay-' + AGENT + '\\.md'));
   });

   test('260k on PreToolUse: a Write under .fankeel/build/ is let through', () => {
       const root = tmp('fankeel-budget-');
       const data = seed(root, MINE);
       const t = transcript(root, 260000);
       const relay = relayPath(root, data, AGENT);
       const out = run({ session_id: MINE, cwd: root, agent_id: AGENT, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: relay }, transcript_path: t });
       assert.equal(out, '');
   });
   ```

2. Run it and see it fail: `node --test tests/budget.test.js` — `hooks/budget.js` does not exist, every `run()` call throws `ENOENT`.

3. Write the implementation.

   In `hooks/budget.js`, write:

   ```javascript
   #!/usr/bin/env node
   'use strict';

   // PreToolUse and PostToolUse, subagent-only. A subagent's context never
   // shrinks — every tool result it reads stays in its own transcript until it
   // ends — so the only way to keep one from running the way session f44b1c61's
   // i18n implementer did (409 requests, 36k to 544k tokens) is to end it before
   // it gets there. This hook is design §3's two thresholds: nudge it to hand
   // off at SOFT, refuse everything but that handoff at HARD.
   //
   // Same discipline as every hook here: exit 0 on every path, and cost nothing
   // for a call this plugin has no opinion about — which for this hook is
   // almost every one, since `agent_id` absent (the main session, or a session
   // started with `--agent`) returns before anything else runs.

   const registry = require('../lib/registry.js');
   const { inspect, SOFT, HARD } = require('../lib/context.js');
   const { relayPath } = require('../lib/handoff.js');
   const { targetOf } = require('../lib/guard.js');
   const { run, parse } = require('../lib/hook.js');

   // What HARD still allows: writing the relay file this hook is about to tell
   // the agent to write. Denying that too would leave it with no way to hand
   // off at all, which defeats the mechanism rather than enforcing it.
   const RELAY_TOOLS = new Set(['Write', 'Edit']);

   function main(raw) {
       const payload = parse(raw);
       if (!payload) return;
       if (!payload.agent_id) return;

       const root = registry.rootFor(payload);
       const mine = registry.readSession(root, payload.session_id);
       if (!mine || mine.active !== true) return;

       const info = inspect(payload.transcript_path);
       if (!info || !info.used) return;

       const relay = relayPath(root, mine, payload.agent_id)
           || '(no relay path — this session has no readable `started`)';

       if (payload.hook_event_name === 'PreToolUse') {
           if (info.used < HARD) return;
           if (RELAY_TOOLS.has(payload.tool_name)) {
               const target = String(targetOf(payload) || '').replace(/\\/g, '/');
               if (target.includes('.fankeel/build/')) return;
           }
           process.stdout.write(JSON.stringify({
               hookSpecificOutput: {
                   hookEventName: 'PreToolUse',
                   permissionDecision: 'deny',
                   permissionDecisionReason: 'fankeel: this subagent is at ' + info.used + ' tokens, over the '
                       + HARD + '-token budget hooks/budget.js enforces. Write your progress to ' + relay
                       + ' and return that path; every tool but a Write or Edit under .fankeel/build/ is '
                       + 'refused until this agent ends.',
               },
           }));
           return;
       }

       if (payload.hook_event_name === 'PostToolUse') {
           if (info.used < SOFT) return;
           process.stdout.write(JSON.stringify({
               hookSpecificOutput: {
                   hookEventName: 'PostToolUse',
                   additionalContext: 'fankeel: this subagent is at ' + info.used + ' tokens, over the ' + SOFT
                       + '-token soft budget. Finish this step, then write your progress to ' + relay
                       + ' and report that path so a fresh agent can continue from it.',
               },
           }));
       }
   }

   run(main);
   ```

4. Run it and see it pass — the first four tests, but not the last one yet (registering the hook does not matter to the test, which spawns `hooks/budget.js` directly): `node --test tests/budget.test.js` — green.

5. Register it. In `.claude-plugin/plugin.json`, in the `"PostToolUse"` array, after its existing two entries (the ones matching `AskUserQuestion` and `Edit|Write|NotebookEdit`), add a third with no `matcher`:

   ```json
       "PostToolUse": [
         { "matcher": "AskUserQuestion", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/resume.js\"", "timeout": 5, "statusMessage": "Restating the fankeel stage..." } ] },
         { "matcher": "Edit|Write|NotebookEdit", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/touch.js\"", "timeout": 5, "statusMessage": "Noting where the work went..." } ] },
         { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/budget.js\"", "timeout": 5, "statusMessage": "Checking a subagent's context budget..." } ] }
       ],
   ```

   And in `.claude-plugin/plugin.json`'s `"PreToolUse"` array, after its existing four entries, add a fifth with no `matcher`:

   ```json
       "PreToolUse": [
         { "matcher": "Edit|Write|NotebookEdit", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.js\"", "timeout": 5, "statusMessage": "Checking the fankeel scope guard..." } ] },
         { "matcher": "AskUserQuestion", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/gate.js\"", "timeout": 605, "statusMessage": "Noting when the gate opened, or waiting for the station's answer..." } ] },
         { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.js\"", "timeout": 5, "statusMessage": "Checking whether a read-only agent is about to write..." } ] },
         { "matcher": "Agent|Task", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.js\"", "timeout": 5, "statusMessage": "Checking whether this stage has a stage agent..." } ] },
         { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/budget.js\"", "timeout": 5, "statusMessage": "Checking a subagent's context budget..." } ] }
       ],
   ```

   (Both blocks are shown expanded to one line per entry for this diff; write them back in the file's own multi-line style, matching the indentation already there.)

6. Run the whole file's test again to confirm the last test (the `.fankeel/build/` write exception) still passes now that the hook is wired the same way `hooks/guard.js` already is: `node --test tests/budget.test.js` — green, five of five.

7. Commit:

   ```
   git commit -m "feat: hooks/budget.js — nudge a subagent at SOFT, refuse at HARD, registered on PreToolUse/PostToolUse"
   ```

## Task 5: ledger.js brief --group --prefix — a byte-identical implementer prefix

**Files:**
- Modify: `scripts/ledger.js` — add `prefix(root, planOpt, group)` and wire `brief --group <N> --prefix` to it
- Read: `lib/plantasks.js` — `parsePlan`, `groups` (unchanged)
- Test: `tests/ledger-brief-prefix.test.js`

**Interfaces:**
- Consumes: none
- Produces: `prefix(root, planOpt, group)` — a string: the active task's `context.md` (or a fallback line when none is active), then each of the group's tasks' `Files`/`Interfaces` text, then the fixed implementer `FOOTER`

**Dispatch:** implementer, sonnet — string assembly from parsers this file already calls; no new parsing rule.

Two facts this task depends on, checked before writing it: `lib/ledger.js:48-51`'s `ledgerPath` keys its directory by the **plan's basename** (`.fankeel/build/<plan-basename>/progress.md`), a different directory from `lib/handoff.js`'s `dirFor` (`.fankeel/build/task-<started>/`), so `--plan` alone cannot locate `context.md` — this task reaches it through `registry.readActive(root)` instead, the most recently updated active session under `root`. And `scripts/ledger.js`'s current `parseArgs`/`STRING_FLAGS`/`VERB_FLAGS` (`scripts/ledger.js:41,47,52-53`) have no entry for `group` or `prefix`, so both are added.

The exact lines this task touches. `scripts/ledger.js:25-32` (requires), today:

```
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs: parseArgv } = require('node:util');

const ledger = require('../lib/ledger.js');
const { splitAtVerb } = require('../lib/argv.js');
const plantasks = require('../lib/plantasks.js');
```

`scripts/ledger.js:41`:

```
const STRING_FLAGS = { root: 'root', plan: 'plan', range: 'range' };
```

`scripts/ledger.js:47,52-53`:

```
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ready', 'hands', 'scan', 'ranges', 'lint', 'brief', 'fix']);

const BASE_FLAGS = ['root', 'plan'];
const VERB_FLAGS = { init: BASE_FLAGS.concat(['range']), complete: BASE_FLAGS.concat(['range']), fix: BASE_FLAGS.concat(['range']) };
```

`scripts/ledger.js:62-81` (`parseArgs`), today:

```
function parseArgs(argv, verb) {
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };

    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    const opts = {};
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
    const allowed = VERB_FLAGS[verb] || BASE_FLAGS;
    const stray = Object.keys(values).filter((flag) => !allowed.includes(flag));
    if (stray.length) {
        fail(verb + ' takes ' + allowed.map((f) => '--' + f).join(', ') + '; refused: ' + stray.map((f) => '--' + f).join(', ') + '.');
    }
    return opts;
}
```

`scripts/ledger.js:574-619` (the `brief` verb) and `scripts/ledger.js:677` (`module.exports`) are also touched, in steps 3 and 5 below.

### Steps

1. Write the failing test.

   In `tests/ledger-brief-prefix.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

   const PLAN = [
       '# Sample Implementation Plan', '',
       '**Goal:** a fixture.', '**Architecture:** n/a.', '**Tech Stack:** n/a.', '**Spec:** design.md', '',
       '## Global Constraints', '', '- none', '',
       '## Task 1: first', '',
       '**Files:**', '- Modify: `lib/a.js` — adds a function', '- Test: `tests/a.test.js`', '',
       '**Interfaces:**', '- Consumes: none', '- Produces: `a()` — returns 1', '',
       '**Dispatch:** implementer, sonnet — mechanical.', '', '1. step', '',
   ].join('\n');

   function setup() {
       const root = tmp('fankeel-ledger-prefix-');
       const dir = path.join(root, 'docs', 'plans');
       fs.mkdirSync(dir, { recursive: true });
       const plan = path.join(dir, 'sample.md');
       fs.writeFileSync(plan, PLAN);
       return { root, plan };
   }

   function run(root, plan) {
       return execFileSync(process.execPath, [SCRIPT, '--root', root, '--plan', plan, 'brief', '--group', '1', '--prefix'], { encoding: 'utf8' });
   }

   test('brief --group --prefix carries the group\'s Files and Interfaces, and the fixed rules', () => {
       const { root, plan } = setup();
       const out = run(root, plan);
       assert.match(out, /Task 1: first/);
       assert.match(out, /lib\/a\.js/);
       assert.match(out, /Produces: `a\(\)` — returns 1/);
       assert.match(out, /Rules you cannot infer/);
   });

   test('brief --group --prefix is byte-identical across two runs', () => {
       const { root, plan } = setup();
       assert.equal(run(root, plan), run(root, plan));
   });

   test('brief --group --prefix says so when nothing is active, rather than guessing', () => {
       const { root, plan } = setup();
       assert.match(run(root, plan), /No active task/);
   });
   ```

2. Run it and see it fail: `node --test tests/ledger-brief-prefix.test.js` — `brief --group 1 --prefix` is refused as an unknown flag pair today (`--group` and `--prefix` are not in `STRING_FLAGS`/`VERB_FLAGS`, so `main` reaches the existing `brief` verb's `Number(text[0])` path and fails with `brief <task number>`).

3. Write the implementation.

   In `scripts/ledger.js`, change the requires block to:

   ```javascript
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const { parseArgs: parseArgv } = require('node:util');

   const ledger = require('../lib/ledger.js');
   const registry = require('../lib/registry.js');
   const { splitAtVerb } = require('../lib/argv.js');
   const plantasks = require('../lib/plantasks.js');
   const { contextPath } = require('../lib/handoff.js');
   ```

   In `scripts/ledger.js`, change `STRING_FLAGS` to:

   ```javascript
   const STRING_FLAGS = { root: 'root', plan: 'plan', range: 'range', group: 'group' };
   ```

   In `scripts/ledger.js`, change `VERB_FLAGS` to add a `brief` entry:

   ```javascript
   const BASE_FLAGS = ['root', 'plan'];
   const VERB_FLAGS = { init: BASE_FLAGS.concat(['range']), complete: BASE_FLAGS.concat(['range']), fix: BASE_FLAGS.concat(['range']), brief: BASE_FLAGS.concat(['group', 'prefix']) };
   ```

   In `scripts/ledger.js`, in `parseArgs`, add a boolean option and read it back:

   ```javascript
   function parseArgs(argv, verb) {
       const options = {};
       for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };
       options.prefix = { type: 'boolean' };

       const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
       const opts = {};
       for (const [flag, key] of Object.entries(STRING_FLAGS)) {
           if (values[flag] === undefined) continue;
           if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
           opts[key] = values[flag];
       }
       if (values.prefix !== undefined) opts.prefix = values.prefix === true;
       const allowed = VERB_FLAGS[verb] || BASE_FLAGS;
       const stray = Object.keys(values).filter((flag) => !allowed.includes(flag));
       if (stray.length) {
           fail(verb + ' takes ' + allowed.map((f) => '--' + f).join(', ') + '; refused: ' + stray.map((f) => '--' + f).join(', ') + '.');
       }
       return opts;
   }
   ```

   In `scripts/ledger.js`, right after `readOwnLedger` (before `function main(argv)`), add:

   ```javascript
   // The byte-identical prefix every implementer in one group opens with:
   // this task's own verified facts, the group's Files and Interfaces (so a
   // dispatched implementer learns its neighbours' names the way `brief <n>`
   // already gives one task's own Consumes its producer), and the fixed
   // footer every `brief <n>` already ends on. Only file content decides the
   // bytes — no timestamp, no session or agent id — so two implementers
   // dispatched a minute apart still share a prompt prefix a 5-minute cache
   // can serve from one read.
   function prefix(root, planOpt, group) {
       const { text } = readPlan(root, planOpt);
       const { tasks } = plantasks.parsePlan(text);
       const rows = plantasks.groups(tasks);
       const n = Number(group);
       if (!Number.isInteger(n) || n < 1 || n > rows.length) {
           fail('brief --prefix wants --group 1..' + rows.length + ' for this plan, got ' + group);
       }
       const nums = rows[n - 1];
       const groupTasks = tasks.filter((t) => nums.includes(t.n));

       const active = registry.readActive(root)
           .sort((a, b) => String(b.data.updated || '').localeCompare(String(a.data.updated || '')));
       const ctxFile = active.length ? contextPath(root, active[0].data) : null;
       let ctxText = 'No active task under ' + root + ' — nothing recorded yet.';
       if (ctxFile) {
           try {
               ctxText = fs.readFileSync(ctxFile, 'utf8').trim() || 'context: none yet — ' + ctxFile;
           } catch (e) {
               ctxText = 'context: none yet — ' + ctxFile;
           }
       }

       const sections = groupTasks.map((t) => [
           '### Task ' + t.n + ': ' + t.name,
           paragraph(t.body, 'Files'),
           paragraph(t.body, 'Interfaces'),
       ].filter(Boolean).join('\n\n'));

       return [
           '## Task context', '',
           ctxText, '',
           '## Group ' + n + ' — Files and Interfaces', '',
           sections.join('\n\n'), '',
           FOOTER, '',
       ].join('\n');
   }
   ```

   In `scripts/ledger.js`, in `main`, inside `if (verb === 'brief') {`, before the existing `const n = Number(text[0]);` line, add:

   ```javascript
       if (verb === 'brief') {
           if (opts.prefix) {
               if (opts.group === undefined) fail('brief --prefix wants --group <N>.');
               return prefix(root, opts.plan, opts.group);
           }
           const n = Number(text[0]);
   ```

   In `scripts/ledger.js`, change the final `module.exports` line to:

   ```javascript
   module.exports = { withScan, SCAN_HEADING, prefix };
   ```

4. Run it and see it pass: `node --test tests/ledger-brief-prefix.test.js` — green.

5. Commit:

   ```
   git commit -m "feat: ledger.js brief --group --prefix — a byte-identical implementer prefix carrying context.md"
   ```

## Task 6: renderBrief and renderBrainBrief inline context.md's content

**Files:**
- Modify: `lib/render.js` — `renderBrief` (its context line) and `renderBrainBrief` (a new block); a shared `contextText` helper
- Test: `tests/render-context-inline.test.js`

**Interfaces:**
- Consumes: none
- Produces: `renderBrief`/`renderBrainBrief` now inline `context.md`'s content in place of its path

**Dispatch:** implementer, sonnet — one helper function and two call sites; no new data source.

`renderBrainBrief` (`lib/render.js:490-550`) has **no** reference to `context.md` today — only `renderBrief` (`lib/render.js:609-610`) does. This task adds a block to both, not just edits the one line.

The exact lines this task replaces, `lib/render.js:609-610`, today:

```
    const ctxFile = contextPath(root, data);
    if (ctxFile) lines.push('  - context: ' + ctxFile + ' — facts already verified in this task; read it before re-reading code, add one with `node ' + PLUGIN_ROOT + '/scripts/context.js add`.');
```

And the line this task's new block goes after in `renderBrainBrief`, `lib/render.js:499`:

```
    lines.push('session: ' + mine.sessionId + ' — pass it to task.js as --session');
```

### Steps

1. Write the failing test.

   In `tests/render-context-inline.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const { contextPath } = require('../lib/handoff.js');
   const mkTmp = require('./tmp.js');

   const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
   const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
   const STARTED = '2026-09-19T09:30:12.345Z';

   function seed(root, over) {
       const dir = path.join(root, '.fankeel', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
           task: 'x', stage: 'build', active: true, started: STARTED, updated: new Date().toISOString(),
       }, over), null, 2) + '\n');
   }

   function seedProfile(root, values) {
       const dir = path.join(root, '.fankeel');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(values, null, 2) + '\n');
   }

   function writeContext(root, text) {
       const file = contextPath(root, { started: STARTED });
       fs.mkdirSync(path.dirname(file), { recursive: true });
       fs.writeFileSync(file, text);
       return file;
   }

   function run(root, payload) {
       return execFileSync(process.execPath, [HOOK], {
           input: JSON.stringify(payload),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
       });
   }

   const start = (root, over) => Object.assign({
       session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'agt_01', agent_type: 'general-purpose',
   }, over);

   const contextOf = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

   test('a plain subagent brief inlines context.md\'s content, not just its path', () => {
       const root = mkTmp('fankeel-render-ctx-');
       seed(root);
       writeContext(root, '- lib/x.js exports frob() — lib/x.js:12 @ abc1234\n');
       const text = contextOf(run(root, start(root)));
       assert.match(text, /exports frob\(\)/);
       assert.doesNotMatch(text, /context: .*facts already verified/);
   });

   test('a plain subagent brief says nothing about context when the file is empty', () => {
       const root = mkTmp('fankeel-render-ctx-');
       seed(root);
       const text = contextOf(run(root, start(root)));
       assert.doesNotMatch(text, /context, verified in this task/);
   });

   test('a fankeel-brain brief also inlines context.md\'s content', () => {
       const root = mkTmp('fankeel-render-ctx-');
       seedProfile(root, { 'stage.agents': ['build'] });
       seed(root);
       writeContext(root, '- lib/y.js exports zap() — lib/y.js:5 @ def5678\n');
       const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
       assert.match(text, /exports zap\(\)/);
   });
   ```

2. Run it and see it fail: `node --test tests/render-context-inline.test.js` — the first test fails (`text` still only carries the path, matching `/context: .*facts already verified/`, and no `frob()` string appears anywhere); the third fails (`renderBrainBrief` never mentions context at all).

3. Write the implementation.

   In `lib/render.js`, right before `function renderBrief({ mine, agentType, root, profile, transcriptPath }) {` (line 580), add:

   ```javascript
   // The file's own text, or null for one that does not exist or holds only
   // whitespace — "pays nothing when there is nothing," now applied to the
   // content a subagent reads instead of the path it used to have to Read
   // itself.
   function contextText(file) {
       if (!file) return null;
       let text;
       try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
       const trimmed = text.trim();
       return trimmed ? trimmed : null;
   }
   ```

   In `lib/render.js`'s `renderBrief`, replace:

   ```javascript
       const ctxFile = contextPath(root, data);
       if (ctxFile) lines.push('  - context: ' + ctxFile + ' — facts already verified in this task; read it before re-reading code, add one with `node ' + PLUGIN_ROOT + '/scripts/context.js add`.');
   ```

   with, still in `lib/render.js`:

   ```javascript
       const ctx = contextText(contextPath(root, data));
       if (ctx) {
           lines.push('  - context, verified in this task (add more with `node ' + PLUGIN_ROOT + '/scripts/context.js add`):');
           for (const l of ctx.split(/\r?\n/)) lines.push('      ' + l);
       }
   ```

   In `lib/render.js`'s `renderBrainBrief`, right after:

   ```javascript
       lines.push('session: ' + mine.sessionId + ' — pass it to task.js as --session');
   ```

   add, still in `lib/render.js`:

   ```javascript
       const brainCtx = contextText(contextPath(root, data));
       if (brainCtx) {
           lines.push('context, verified in this task (add more with `node ' + PLUGIN_ROOT + '/scripts/context.js add`):');
           for (const l of brainCtx.split(/\r?\n/)) lines.push('    ' + l);
       }
   ```

4. Run it and see it pass: `node --test tests/render-context-inline.test.js` — green.

5. Commit:

   ```
   git commit -m "feat: renderBrief/renderBrainBrief inline context.md's content instead of naming its path"
   ```

## Task 7: a reader's return contract, and a stage-exit warning on an empty context.md

**Files:**
- Modify: `agents/fankeel-reader.md` — one line in `## Return` sending a fact worth keeping to `scripts/context.js add`
- Modify: `scripts/task.js` — `cmdStage` warns, never blocks, leaving `survey` or `plan` with nothing recorded
- Test: `tests/context-facts-required.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one prose line and one conditional print statement; no new mechanism.

`skills/fankeel-plan/SKILL.md` never dispatches `fankeel-reader` at all (only `fankeel-reviewer`, `skills/fankeel-plan/SKILL.md:309`); only `skills/fankeel-survey/SKILL.md` does. So the reader-side half of this task goes in the one file every `fankeel-reader` dispatch shares, `agents/fankeel-reader.md`, not a stage-specific block — it already applies to survey today and picks up plan automatically if a later change ever has plan dispatch one too.

The exact lines this task touches. `agents/fankeel-reader.md:56-67` (the whole `## Return` section), today:

```
## Return

What the brief's contract asks for. Say plainly what you could not check: a gap
the parent cannot see becomes a confident wrong answer there.

Mark every line `EXTRACTED` or `INFERRED`: `EXTRACTED` is a fact read
straight off a file — a name, a path, a line a `grep` or a `Read` actually
showed; `INFERRED` is anything reasoned from those facts rather than read
outright. Write a relationship between two things as
`A --rel--> B at=file:line` — the relationship in the middle, lower-case,
and the file:line where it was read, so the parent can open it rather than
trust the reader's paraphrase of it.
```

`scripts/task.js:39` (an existing require this task extends):

```
const { handoffPath, readGate, lapsUsed } = require('../lib/handoff.js');
```

`scripts/task.js:786-791` (`cmdStage`, the block this task's new lines go beside), today:

```
    if (name === 'build' && from === 'verify' && registry.returnsTo(data, 'verify', 'build') > 1) {
        line += NL + 'second return to build from verify — name what verify caught that build\'s'
            + NL + 'review did not, and add that check to the review';
    }
    line += NL + effortHint(data.class || classForRoute(route), name);
```

### Steps

1. Write the failing test.

   In `tests/context-facts-required.test.js`, write:

   ```javascript
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const registry = require('../lib/registry.js');
   const { contextPath } = require('../lib/handoff.js');
   const tmp = require('./tmp.js');

   const ROOT = path.join(__dirname, '..');
   const SCRIPT = path.join(ROOT, 'scripts', 'task.js');
   const A = 'aaaaaaaa-1111-2222-3333-444444444444';

   test('the reader\'s return contract sends a fact worth keeping to context.js add', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
       const ret = text.split('\n## Return\n')[1];
       assert.ok(ret, 'no ## Return section');
       assert.match(ret, /scripts\/context\.js add/);
       assert.match(ret, /--session/);
   });

   function run(dir, args) {
       const cfg = path.join(dir, 'cfg');
       try {
           return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
               { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
       } catch (e) {
           return { out: String(e.stdout || ''), code: e.status };
       }
   }

   test('task.js stage warns leaving survey with no facts recorded, and does not block', () => {
       const dir = tmp('fankeel-task-ctx-');
       run(dir, ['start', '--session', A, '--task', 'a fixture task']);
       const { out, code } = run(dir, ['stage', 'design', '--session', A]);
       assert.equal(code, 0);
       assert.match(out, /context\.md has no facts/);
   });

   test('task.js stage says nothing about context once a fact is recorded', () => {
       const dir = tmp('fankeel-task-ctx-');
       run(dir, ['start', '--session', A, '--task', 'a fixture task']);
       const data = registry.readSession(dir, A);
       const file = contextPath(dir, data);
       fs.mkdirSync(path.dirname(file), { recursive: true });
       fs.writeFileSync(file, '- a fact — lib/x.js:1 @ abcdef1\n');
       const { out } = run(dir, ['stage', 'design', '--session', A]);
       assert.doesNotMatch(out, /context\.md has no facts/);
   });

   test('task.js stage says nothing leaving a stage section 5 does not name', () => {
       const dir = tmp('fankeel-task-ctx-');
       run(dir, ['start', '--session', A, '--task', 'a fixture task']);
       run(dir, ['stage', 'design', '--session', A]);
       const { out } = run(dir, ['stage', 'plan', '--session', A]);
       assert.doesNotMatch(out, /context\.md has no facts/);
   });
   ```

2. Run it and see it fail: `node --test tests/context-facts-required.test.js` — the first test fails (`agents/fankeel-reader.md`'s `## Return` has no `scripts/context.js add` text); the second and fourth fail (`cmdStage` never prints anything about `context.md`); the third passes already (there is nothing to say yet either way).

3. Write the implementation.

   In `agents/fankeel-reader.md`, at the end of the `## Return` section (after the `A --rel--> B at=file:line` paragraph), add:

   ```markdown
   A fact this task's later stages will need again — not just this answer —
   belongs in `context.md`, not only in your return: run
   `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`
   for it before you return. Your return is this reader's alone; `context.md`
   is what the next reader, and the next stage, reads instead of re-deriving it.
   ```

   In `scripts/task.js`, change the require line:

   ```javascript
   const { handoffPath, readGate, lapsUsed } = require('../lib/handoff.js');
   ```

   In `scripts/task.js`, change it to:

   ```javascript
   const { handoffPath, readGate, lapsUsed, contextPath } = require('../lib/handoff.js');
   ```

   In `scripts/task.js`'s `cmdStage`, right after:

   ```javascript
       if (name === 'build' && from === 'verify' && registry.returnsTo(data, 'verify', 'build') > 1) {
           line += NL + 'second return to build from verify — name what verify caught that build\'s'
               + NL + 'review did not, and add that check to the review';
       }
   ```

   add, in `scripts/task.js`:

   ```javascript
       // §5: leaving survey or plan with nothing recorded means the next stage
       // re-derives every fact this one already had open — warned, never
       // blocked, the same shape as the return-to-build line above.
       if (from === 'survey' || from === 'plan') {
           const ctxFile = contextPath(root, data);
           let text = '';
           if (ctxFile) {
               try { text = fs.readFileSync(ctxFile, 'utf8'); } catch (e) { /* none written yet */ }
           }
           if (!text.trim()) {
               line += NL + 'context.md has no facts recorded from ' + from + ' — a later stage would '
                   + 're-derive them. `node ' + PLUGIN_ROOT + '/scripts/context.js add` records one.';
           }
       }
   ```

4. Run it and see it pass: `node --test tests/context-facts-required.test.js` — green, four of four.

5. Commit:

   ```
   git commit -m "docs: a reader's return sends a fact to context.js add; task.js stage warns on empty context.md leaving survey/plan"
   ```

## Task 8: `readSize`, `READ_CAP`, `FILE_CAP`

**Files:**
- Modify: `lib/plantasks.js` — add a `readSize(root, task)` function and the `READ_CAP`/`FILE_CAP` constants; export all three.
- Read: `lib/requires.js` — the convention this reuses: a `Modify:`-declared file not yet on disk is tolerated, not an error (`lib/requires.js:52-60`).
- Test: `tests/plantasks-readsize.test.js` — the test file this task writes.

**Interfaces:**
- Consumes: nothing.
- Produces: `READ_CAP = 1500`, `FILE_CAP = 3`, `readSize(root, task)` — sums a task's `Modify:` entries to a line count: `path:a-b` counts only `b - a + 1`; a bare path counts the named file whole, read from `root`; a path naming nothing yet on disk, or given no `root` at all, counts zero.

**Dispatch:** implementer, sonnet — a new counting function with three edge cases (ranged, missing-file, root-less) worth getting right on the first pass rather than transcribed.

1. **Write the failing test.** In `tests/plantasks-readsize.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

test('READ_CAP and FILE_CAP are exported constants', () => {
  assert.equal(plantasks.READ_CAP, 1500);
  assert.equal(plantasks.FILE_CAP, 3);
});

test('readSize sums a ranged Modify: entry as b - a + 1, without touching disk', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js:10-20'] }), 11);
});

test('readSize reads an unranged Modify: entry\'s whole file from root', () => {
  const dir = tmp('fankeel-plantasks-readsize-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'one\ntwo\nthree\n');
  assert.equal(plantasks.readSize(dir, { modify: ['lib/a.js'] }), 3);
});

test('readSize counts a Modify: entry naming a file not yet on disk as zero', () => {
  const dir = tmp('fankeel-plantasks-readsize-');
  assert.equal(plantasks.readSize(dir, { modify: ['lib/new.js'] }), 0);
});

test('readSize is silent about an unranged entry with no root to read it against', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js'] }), 0);
});

test('readSize sums more than one Modify: entry', () => {
  assert.equal(plantasks.readSize(undefined, { modify: ['lib/a.js:1-10', 'lib/b.js:1-5'] }), 15);
});
```

2. **Run it and see it fail.** `node --test tests/plantasks-readsize.test.js` — every test throws, `plantasks.readSize` and `plantasks.READ_CAP`/`FILE_CAP` do not exist yet.

3. **Write the implementation.** In `lib/plantasks.js`, the requires at the top currently read:

```js
const { trackedFiles } = require('./tracked.js');
const { requireGraph } = require('./requires.js');
```

In `lib/plantasks.js`, replace with:

```js
const fs = require('node:fs');
const path = require('node:path');
const { trackedFiles } = require('./tracked.js');
const { requireGraph } = require('./requires.js');
```

In `lib/plantasks.js`, `requireConflicts` ends and the next comment begins with:

```js
        out.push({ a, b, group: groupOf.get(a) + 1, from: edge.from, to: edge.to, line: edge.line });
    }
    return out;
}

// Group size picks the dispatch surface. Three or more independent tasks are
```

In `lib/plantasks.js`, insert the new function and constants between the closing `}` of `requireConflicts` and that comment, so it reads:

```js
        out.push({ a, b, group: groupOf.get(a) + 1, from: edge.from, to: edge.to, line: edge.line });
    }
    return out;
}

// A task's `Modify:` entries, summed to how many pre-existing lines an
// implementer reads before touching them. `path:a-b` counts only its own
// span, `b - a + 1`; a bare path counts the file whole, read from `root`.
// Counting a whole file this way has to agree with what a person would call
// its line count — the number this plan's own test fixture quotes for
// `assets/station/station.js` is 5095, `wc -l`'s count, and a plain
// `text.split(/\r?\n/).length` disagrees with it by one on any file ending in
// a newline, which nearly every file here does. Stripping that one trailing
// newline before splitting is what keeps the two counts the same. A path
// naming nothing yet on disk — a task creating a file — counts zero, the
// same tolerance `lib/requires.js:52-60` already gives a `Modify:`-declared
// file that does not exist yet: there is no existing content for either
// module to fail to read. `root` may be omitted, the way every caller before
// this one called `lint`; an unranged entry then counts zero rather than
// throwing on a `path.join` with no root to join against.
const RANGE = /^(.*):(\d+)-(\d+)$/;

function readSize(root, task) {
    let total = 0;
    for (const raw of task.modify) {
        const ranged = RANGE.exec(raw);
        if (ranged) { total += Number(ranged[3]) - Number(ranged[2]) + 1; continue; }
        if (!root) continue;
        let text;
        try { text = fs.readFileSync(path.join(root, raw), 'utf8'); } catch (e) { continue; }
        total += text.replace(/\r?\n$/, '').split(/\r?\n/).length;
    }
    return total;
}

// The two numbers `lint()`'s size findings compare `readSize` against, and
// what `skills/fankeel-plan/SKILL.md`'s task template names them by rather
// than by the numbers themselves.
const READ_CAP = 1500;
const FILE_CAP = 3;

// Group size picks the dispatch surface. Three or more independent tasks are
```

In `lib/plantasks.js`, the final line currently reads:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, ready, proseConflicts, surfaces, missingInterfaces, fences, lint, filedPaths, requireConflicts };
```

In `lib/plantasks.js`, replace with:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, ready, proseConflicts, surfaces, missingInterfaces, fences, lint, filedPaths, requireConflicts, readSize, READ_CAP, FILE_CAP };
```

4. **Run it and see it pass.** `node --test tests/plantasks-readsize.test.js`.

5. **Commit.** `git commit -m "feat: readSize, READ_CAP, FILE_CAP — a task's Modify: files counted in lines"`

## Task 9: a ranged path is recognised as its bare file everywhere, not only in a fence

**Files:**
- Modify: `lib/plantasks.js` — `conflict()`, `requireConflicts()`, `fences()` and `lint()` all compare a `Modify:`/`Test:`/`Read:` entry against another as a raw string today; a `path:a-b` entry then never equals a bare mention of the same file. Add one `barePath()` helper and route all four through it.
- Test: `tests/plantasks-ranged-paths.test.js` — the test file this task writes.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing another task depends on by name — `conflict`, `groups`, `fences`, `lint` and `requireConflicts` keep their existing names and shapes; only which files they read as equal changes.

**Dispatch:** implementer, sonnet — one definition of "same file" has to land in four call sites at once; a partial fix is worse than the bug it targets.

1. **Write the failing test.** In `tests/plantasks-ranged-paths.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plantasks = require('../lib/plantasks.js');
const { parseTasks, conflict, groups } = plantasks;
const tmp = require('./tmp.js');

const task = (n, modify) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
].join('\n');

const readTask = (n, modify, body) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  ...(body || []), '',
].join('\n');

const design = (files) => [
  '# A design', '', '## File table', '', '| file | change | dispatch |', '|---|---|---|',
  ...(files || []).map((f) => '| `' + f + '` | something | implementer, sonnet |'),
  '',
].join('\n');

test('two tasks ranging the same file, even disjoint ranges, still conflict as one file', () => {
  const [a, b] = parseTasks(task(1, ['lib/big.js:1-100']) + task(2, ['lib/big.js:200-300']));
  assert.equal(conflict(a, b), 'files');
  assert.deepEqual(groups([a, b]), [[1], [2]]);
});

test('a ranged Modify: entry satisfies a design file table naming the bare path', () => {
  const plan = task(1, ['lib/big.js:1-100']);
  assert.deepEqual(plantasks.lint(plan, design(['lib/big.js'])), []);
});

test('a ranged Modify: entry is recognised as its bare file by lint\'s fence-ownership check, either way round', () => {
  const rangedFile = readTask(1, ['lib/big.js:1-100'], ['In `lib/big.js`, add:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(rangedFile, design([])), []);
  const rangedFence = readTask(1, ['lib/big.js'], ['In `lib/big.js:1-10`, add:', '', '```js', 'x', '```']);
  assert.deepEqual(plantasks.lint(rangedFence, design([])), []);
});

test('requireConflicts keys a ranged Modify: entry by its bare file', () => {
  const dir = tmp('fankeel-plantasks-ranged-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nconst b = require('./b.js');\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  const planText = task(1, ['lib/a.js:1-2']) + '\n' + task(2, ['lib/b.js']);
  const tasks = plantasks.parseTasks(planText);
  const found = plantasks.requireConflicts(tasks, dir);
  assert.deepEqual(found, [{ a: 1, b: 2, group: 1, from: 'lib/a.js', to: 'lib/b.js', line: 2 }]);
});
```

2. **Run it and see it fail.** `node --test tests/plantasks-ranged-paths.test.js` — the first test reports `conflict(a, b)` as `null` instead of `'files'` and `groups` as one group instead of two; the file-table and fence tests each report the false "not in its Files block" / "which no task modifies" finding; `requireConflicts` returns `[]` instead of the edge.

3. **Write the implementation.** In `lib/plantasks.js`, right after:

```js
const shares = (a, b) => a.some((x) => b.includes(x));
```

In `lib/plantasks.js`, insert:

```js
const shares = (a, b) => a.some((x) => b.includes(x));

// The file behind a `Files:` entry, a trailing `:12` or `:12-40` line pointer
// dropped — the same shape `fences()`, below, already strips from a fence's
// named tokens. Every place in this module that asks "is this the same
// file" reads through this first, so a ranged `Modify:` entry and a bare
// mention of the same file compare equal; only `readSize`, above, still
// wants the range itself.
const barePath = (p) => String(p || '').replace(/:\d+(-\d+)?$/, '');
```

In `lib/plantasks.js`, `conflict()` currently reads:

```js
    const own = (list) => (list || []).filter((p) => !skip.includes(p));
```

In `lib/plantasks.js`, replace with:

```js
    const own = (list) => (list || []).map(barePath).filter((p) => !skip.includes(p));
```

In `lib/plantasks.js`, still in `conflict()`:

```js
    const owned = (t) => [...t.modify, ...t.test];
    if (shares(a.read || [], owned(b)) || shares(b.read || [], owned(a))) return 'read';
```

In `lib/plantasks.js`, replace with:

```js
    const owned = (t) => [...t.modify, ...t.test].map(barePath);
    if (shares((a.read || []).map(barePath), owned(b)) || shares((b.read || []).map(barePath), owned(a))) return 'read';
```

In `lib/plantasks.js`, `requireConflicts()` currently reads:

```js
    const byFile = new Map();
    for (const t of tasks) for (const f of t.modify) byFile.set(f, t.n);
```

In `lib/plantasks.js`, replace with:

```js
    const byFile = new Map();
    for (const t of tasks) for (const f of t.modify) byFile.set(barePath(f), t.n);
```

In `lib/plantasks.js`, `fences()` currently reads:

```js
        const above = [];
        for (let j = i - 1; j >= 0 && above.length < 3; j--) if (lines[j].trim()) above.push(lines[j]);
        const named = above.flatMap((l) => ticked(l, true)).map((p) => p.replace(/:\d+(-\d+)?$/, ''));
```

In `lib/plantasks.js`, replace with:

```js
        const above = [];
        for (let j = i - 1; j >= 0 && above.length < 3; j--) if (lines[j].trim()) above.push(lines[j]);
        const named = above.flatMap((l) => ticked(l, true)).map(barePath);
```

In `lib/plantasks.js`, `lint()` currently reads:

```js
    const declared = new Set(tasks.flatMap((t) => [...t.modify, ...t.test]));
```

In `lib/plantasks.js`, replace with:

```js
    const declared = new Set(tasks.flatMap((t) => [...t.modify, ...t.test].map(barePath)));
```

In `lib/plantasks.js`, still in `lint()`:

```js
    for (const t of tasks) {
        const files = [...t.modify, ...t.test, ...t.read];
```

In `lib/plantasks.js`, replace with:

```js
    for (const t of tasks) {
        const files = [...t.modify, ...t.test, ...t.read].map(barePath);
```

4. **Run it and see it pass.** `node --test tests/plantasks-ranged-paths.test.js`.

5. **Commit.** `git commit -m "fix: a ranged Modify: entry reads as its bare file everywhere, not only in a fence"`

## Task 10: wire `READ_CAP`/`FILE_CAP` into `lint()`, and thread `--root` to it

**Files:**
- Modify: `lib/plantasks.js` — `lint()` gains an optional third `root` parameter and two new findings.
- Modify: `scripts/ledger.js` — the `lint` verb's call site passes its already-resolved `root` through.
- Test: `tests/plantasks-lint-cap.test.js` — the test file this task writes.

**Interfaces:**
- Consumes: `READ_CAP = 1500`, `FILE_CAP = 3`, `readSize(root, task)` (Task 8).
- Produces: `lint(planText, designText, root)` — same exported name, an optional third parameter; every existing 2-argument call is unchanged and skips the real-disk half of the new checks.

**Dispatch:** implementer, sonnet — a signature change and a CLI call site that must stay in sync; mechanical once the two files are read together.

1. **Write the failing test.** In `tests/plantasks-lint-cap.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ledger.js');

const task = (n, modify) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
].join('\n');

const design = () => '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n\n';

test('lint flags a task whose Modify: is the whole 5095-line station.js', () => {
  const plan = task(1, ['assets/station/station.js']);
  const out = plantasks.lint(plan, design(), ROOT);
  assert.ok(out.includes('Task 1: reads 5095 lines across its `Modify:` files, over READ_CAP (1500)'), out.join('\n'));
});

test('a ranged Modify: entry on the same file stays under the cap', () => {
  const plan = task(1, ['assets/station/station.js:1-100']);
  assert.deepEqual(plantasks.lint(plan, design(), ROOT), []);
});

test('lint flags more than FILE_CAP Modify: files', () => {
  const plan = task(1, ['lib/a.js', 'lib/b.js', 'lib/c.js', 'lib/d.js']);
  const out = plantasks.lint(plan, design(), ROOT);
  assert.ok(out.includes('Task 1: 4 `Modify:` files, over FILE_CAP (3)'), out.join('\n'));
});

test('lint(planText, designText) with no root still runs, silent on real-disk file size', () => {
  const plan = task(1, ['assets/station/station.js']);
  assert.deepEqual(plantasks.lint(plan, design()), []);
});

const run = (dir, plan, ...args) => {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
};

test('ledger.js lint threads --root through to readSize', () => {
  const dir = tmp('fankeel-ledger-lintcap-');
  fs.writeFileSync(path.join(dir, 'design.md'), '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n');
  fs.writeFileSync(path.join(dir, 'big.js'), 'x\n'.repeat(1600));
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '# A plan', '', '**Spec:** design.md', '', '## Global Constraints', '', '- none', '',
    '## Task 1: name', '', '**Files:**', '- Modify: `big.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  ].join('\n'));
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 1);
  assert.match(out, /Task 1: reads 1600 lines across its `Modify:` files, over READ_CAP \(1500\)/);
});
```

2. **Run it and see it fail.** `node --test tests/plantasks-lint-cap.test.js` — the first three assertions find no such finding, and the last spawns `ledger.js lint` and finds it clean instead of exit code 1.

3. **Write the implementation.** In `lib/plantasks.js`, `lint()` currently opens:

```js
function lint(planText, designText) {
```

In `lib/plantasks.js`, replace with:

```js
function lint(planText, designText, root) {
```

In `lib/plantasks.js`, `lint()`'s per-task loop currently ends:

```js
            for (const p of foreign) out.push('Task ' + t.n + ' line ' + f.line + ': `' + p + '` is named but not in its Files block');
        }
    }
    return out;
}
```

In `lib/plantasks.js`, replace with:

```js
            for (const p of foreign) out.push('Task ' + t.n + ' line ' + f.line + ': `' + p + '` is named but not in its Files block');
        }
    }
    for (const t of tasks) {
        if (t.modify.length > FILE_CAP) {
            out.push('Task ' + t.n + ': ' + t.modify.length + ' `Modify:` files, over FILE_CAP (' + FILE_CAP + ')');
        }
        const size = readSize(root, t);
        if (size > READ_CAP) {
            out.push('Task ' + t.n + ': reads ' + size + ' lines across its `Modify:` files, over READ_CAP (' + READ_CAP + ')');
        }
    }
    return out;
}
```

In `scripts/ledger.js`, the `lint` verb currently calls:

```js
        const lines = plantasks.lint(planText, designText);
```

In `scripts/ledger.js`, replace with:

```js
        const lines = plantasks.lint(planText, designText, root);
```

4. **Run it and see it pass.** `node --test tests/plantasks-lint-cap.test.js`.

5. **Commit.** `git commit -m "feat: lint enforces READ_CAP and FILE_CAP; ledger.js threads --root to it"`

## Task 11: haiku Dispatch tier — the two lint conditions

**Files:**
- Modify: `lib/plantasks.js` — `parsePlan()` gains a `task.model` field parsed off the `Dispatch:` line, a `writeSteps(task)` helper, and `lint()` gains the `implementer, haiku` checks.
- Test: `tests/plantasks-haiku.test.js` — the test file this task writes.

**Interfaces:**
- Consumes: `READ_CAP = 1500`, `readSize(root, task)` (Task 8); `fences(task)` (existing export); `lint(planText, designText, root)`'s two loops from Task 10, after which this task's own loop is appended.
- Produces: `task.model` — the Dispatch line's model tier ("haiku", "sonnet", "opus", or "" when the task is `in-session`/`user`/unset), parsed alongside the existing `task.dispatch`.

**Dispatch:** implementer, sonnet — this task invents the checkable definition of "every step carries a full fence"; needs judgement about what a haiku task's steps actually look like, not transcription.

1. **Write the failing test.** In `tests/plantasks-haiku.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const plantasks = require('../lib/plantasks.js');
const { parseTasks } = plantasks;

const body = (dispatchLine) => [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  dispatchLine, '',
].join('\n');

test('parsePlan reads the model off an implementer, <model> Dispatch line', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, haiku — mechanical rename.'));
  assert.equal(t.dispatch, 'implementer');
  assert.equal(t.model, 'haiku');
});

test('parsePlan leaves model empty for in-session, user, and an implementer with no comma', () => {
  assert.equal(parseTasks(body('**Dispatch:** in-session — the user said so.'))[0].model, '');
  assert.equal(parseTasks(body('**Dispatch:** user — run /doctor.'))[0].model, '');
  assert.equal(parseTasks(body('**Dispatch:** implementer — no model given.'))[0].model, '');
});

const design = () => '# A design\n';

const cleanHaiku = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '2. Run it and see it fail: `node --test tests/a.test.js`', '',
  '3. Write the implementation. In `lib/a.js`, add:', '', '```js', 'y', '```', '',
  '4. Run it and see it pass.', '',
  '5. Commit: `git commit -m "x"`', '',
].join('\n');

const missingFence = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '2. Run it and see it fail: `node --test tests/a.test.js`', '',
  '3. Write the implementation as described above.', '',
  '4. Run it and see it pass.', '',
  '5. Commit: `git commit -m "x"`', '',
].join('\n');

const overCap = [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js:1-800`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, haiku — mechanical rename.', '',
  '1. Write the failing test. In `lib/a.js`, add:', '', '```js', 'x', '```', '',
  '3. Write the implementation. In `lib/a.js`, add:', '', '```js', 'y', '```', '',
].join('\n');

test('lint passes an implementer, haiku task under half READ_CAP with a fence for each Write step', () => {
  assert.deepEqual(plantasks.lint(cleanHaiku, design()), []);
});

test('lint flags an implementer, haiku task missing a fence for one of its Write steps', () => {
  const out = plantasks.lint(missingFence, design());
  assert.ok(out.includes('Task 1: `implementer, haiku` has a numbered `Write` step with no fenced code to match it'), out.join('\n'));
});

test('lint flags an implementer, haiku task over half READ_CAP', () => {
  const out = plantasks.lint(overCap, design());
  assert.ok(out.includes('Task 1: `implementer, haiku` reads 800 lines, over READ_CAP / 2 (750)'), out.join('\n'));
});
```

2. **Run it and see it fail.** `node --test tests/plantasks-haiku.test.js` — `t.model` is `undefined`, and none of the three haiku findings appear.

3. **Write the implementation.** In `lib/plantasks.js`, `parsePlan()`'s task object currently opens:

```js
            task = { n: Number(t[1]), name: t[2].trim(), line: n, modify: [], test: [], read: [], consumes: [], produces: [], consumesText: [], producesText: [], interfaces: false, dispatch: null, dispatchNote: '', lines: [] };
```

In `lib/plantasks.js`, replace with:

```js
            task = { n: Number(t[1]), name: t[2].trim(), line: n, modify: [], test: [], read: [], consumes: [], produces: [], consumesText: [], producesText: [], interfaces: false, dispatch: null, dispatchNote: '', model: '', lines: [] };
```

In `lib/plantasks.js`, the Dispatch-line block currently reads:

```js
        const dl = DISPATCH.exec(line);
        if (dl) {
            if (task.dispatch === null) {
                const word = /^([a-z][a-z-]*)/i.exec(dl[1]);
                task.dispatch = word ? word[1].toLowerCase() : '';
                const dash = dl[1].indexOf('—');
                task.dispatchNote = dash === -1 ? '' : dl[1].slice(dash + 1).trim();
            }
            block = null;
            continue;
        }
```

In `lib/plantasks.js`, replace with:

```js
        const dl = DISPATCH.exec(line);
        if (dl) {
            if (task.dispatch === null) {
                const word = /^([a-z][a-z-]*)/i.exec(dl[1]);
                task.dispatch = word ? word[1].toLowerCase() : '';
                const dash = dl[1].indexOf('—');
                task.dispatchNote = dash === -1 ? '' : dl[1].slice(dash + 1).trim();
                // `implementer, <model> — <why>`: the model sits between the
                // first comma and the dash, the one piece of this line
                // neither `dispatch` nor `dispatchNote` carries.
                if (task.dispatch === 'implementer') {
                    const head = dash === -1 ? dl[1] : dl[1].slice(0, dash);
                    const comma = head.indexOf(',');
                    task.model = comma === -1 ? '' : head.slice(comma + 1).trim().toLowerCase();
                }
            }
            block = null;
            continue;
        }
```

In `lib/plantasks.js`, `fences()` ends and the next comment begins with:

```js
        out.push({ line: (task.line || 1) + i, info, named });
    }
    return out;
}

// Words only, lower-cased. Backticks, asterisks, dashes and every other mark
```

In `lib/plantasks.js`, insert `writeSteps()` between the closing `}` of `fences()` and that comment:

```js
        out.push({ line: (task.line || 1) + i, info, named });
    }
    return out;
}

// Numbered steps outside any fence whose text opens with `Write` — the two
// of a task's five steps the plan's own template hands an implementer code
// for rather than a command (`skills/fankeel-plan/SKILL.md:230,232`: "Write
// the failing test" / "Write the minimal implementation"). Counted rather
// than paired to a fence one-for-one: what a haiku task needs is "at least
// as many real code fences as steps that promised one", not which fence
// belongs to which step, and a fenced example quoting this same template
// must not count its own sample step twice — hence the same fence tracking
// `parsePlan` uses.
function writeSteps(task) {
    let n = 0;
    let fenceLen = 0;
    for (const raw of String(task.body || '').split(/\r?\n/)) {
        const line = raw.trim();
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) fenceLen = f[0].length;
            else if (f[0].length >= fenceLen) fenceLen = 0;
            continue;
        }
        if (fenceLen) continue;
        if (/^\d+\.\s*write\b/i.test(line)) n++;
    }
    return n;
}

// Words only, lower-cased. Backticks, asterisks, dashes and every other mark
```

In `lib/plantasks.js`, `lint()`'s FILE_CAP/READ_CAP loop from Task 10 currently ends:

```js
    for (const t of tasks) {
        if (t.modify.length > FILE_CAP) {
            out.push('Task ' + t.n + ': ' + t.modify.length + ' `Modify:` files, over FILE_CAP (' + FILE_CAP + ')');
        }
        const size = readSize(root, t);
        if (size > READ_CAP) {
            out.push('Task ' + t.n + ': reads ' + size + ' lines across its `Modify:` files, over READ_CAP (' + READ_CAP + ')');
        }
    }
    return out;
}
```

In `lib/plantasks.js`, replace with:

```js
    for (const t of tasks) {
        if (t.modify.length > FILE_CAP) {
            out.push('Task ' + t.n + ': ' + t.modify.length + ' `Modify:` files, over FILE_CAP (' + FILE_CAP + ')');
        }
        const size = readSize(root, t);
        if (size > READ_CAP) {
            out.push('Task ' + t.n + ': reads ' + size + ' lines across its `Modify:` files, over READ_CAP (' + READ_CAP + ')');
        }
    }
    for (const t of tasks) {
        if (t.dispatch !== 'implementer' || t.model !== 'haiku') continue;
        const size = readSize(root, t);
        if (size > READ_CAP / 2) {
            out.push('Task ' + t.n + ': `implementer, haiku` reads ' + size + ' lines, over READ_CAP / 2 (' + (READ_CAP / 2) + ')');
        }
        if (!writeSteps(t) || fences(t).length < writeSteps(t)) {
            out.push('Task ' + t.n + ': `implementer, haiku` has a numbered `Write` step with no fenced code to match it');
        }
    }
    return out;
}
```

4. **Run it and see it pass.** `node --test tests/plantasks-haiku.test.js`.

5. **Commit.** `git commit -m "feat: implementer, haiku passes lint only under half READ_CAP with a fence per Write step"`

## Task 12: `skills/fankeel-plan/SKILL.md` — ranges for big files, and the haiku form

**Files:**
- Modify: `skills/fankeel-plan/SKILL.md` — add the `path:a-b` range guidance beside the `Files:` block section, and the `implementer, haiku` Dispatch form beside the other four.
- Test: `tests/plan-skill-caps.test.js` — the test file this task writes.

**Interfaces:**
- Consumes: nothing a build dependency reads; the numbers and conditions this documents (`READ_CAP = 1500`, `FILE_CAP = 3`, Task 8; the two `implementer, haiku` conditions, Task 11) are already fixed code by the time this task runs.
- Produces: nothing.

**Dispatch:** implementer, sonnet — prose the lint check must match by name; a paraphrase breaks the pairing test below.

1. **Write the failing test.** In `tests/plan-skill-caps.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-plan', 'SKILL.md'), 'utf8');

test('the plan skill tells an author to range a file over READ_CAP rather than skip the cap', () => {
  assert.match(SKILL, /`path:a-b`/);
  assert.match(SKILL, /READ_CAP/);
  assert.match(SKILL, /FILE_CAP/);
  assert.match(SKILL, /has to be split/);
});

test('the plan skill names the implementer, haiku Dispatch form and its two conditions', () => {
  assert.match(SKILL, /\*\*Dispatch:\*\* implementer, haiku/);
  assert.match(SKILL, /READ_CAP \/ 2/);
  assert.match(SKILL, /begins `Write`/);
});
```

2. **Run it and see it fail.** `node --test tests/plan-skill-caps.test.js` — none of these phrases are in the file yet.

3. **Write the implementation.** In `skills/fankeel-plan/SKILL.md`, the `Read:` paragraph currently ends and the next section begins:

```markdown
`Modify:` or `Test:` **serialises the pair** — a file mid-edit is not a file to
read — and two tasks reading one file do not conflict. Only the first
backticked token on the line is the path, as for the other two kinds.

**And it decides how they go out.**
```

In `skills/fankeel-plan/SKILL.md`, insert a new paragraph between them:

```markdown
`Modify:` or `Test:` **serialises the pair** — a file mid-edit is not a file to
read — and two tasks reading one file do not conflict. Only the first
backticked token on the line is the path, as for the other two kinds.

A `Modify:` entry may end in a line range, `path:a-b` — a file over
`READ_CAP` lines (1500, `lib/plantasks.js`) must be written this way,
counting only that span rather than the file whole. A task that cannot name
a range narrow enough to fit under the cap has to be split rather than one
that gets to skip it. `ledger.js lint` counts the range, not the file, and
treats `path:a-b` as `path` everywhere a shared file is asked about — a
`conflict()` between two tasks, a design's file table, a fence naming its
file. More than three `Modify:` entries (`FILE_CAP`, 3) is the same finding
by a different measure.

**And it decides how they go out.**
```

In `skills/fankeel-plan/SKILL.md`, the `user` Dispatch example currently ends and the rules list begins:

````markdown
```markdown
**Dispatch:** user — run `/doctor` in this session and say when it is done; no
subagent can run a slash command.
```

Four rules about that line:
````

In `skills/fankeel-plan/SKILL.md`, insert a fifth form between them:

````markdown
```markdown
**Dispatch:** user — run `/doctor` in this session and say when it is done; no
subagent can run a slash command.
```

A fifth form goes below the floor rather than above it, so it carries no
`— why`:

```markdown
**Dispatch:** implementer, haiku — a mechanical rename.
```

`implementer, haiku` passes `ledger.js lint` only when both hold: its
`Modify:` files read at most `READ_CAP / 2` lines, and every numbered step
whose text begins `Write` sits above a real code fence, one for one. Either
miss and lint lists the task by number; a task that cannot clear both stays
on the floor.

Four rules about that line:
````

4. **Run it and see it pass.** `node --test tests/plan-skill-caps.test.js`.

5. **Commit.** `git commit -m "docs: plan skill — path:a-b for a file over READ_CAP, and the implementer, haiku form"`

## Task 13: registry marks carry a group, and a list once two run at once

**Files:**
- Modify: `lib/registry.js` — lines 779-903 only: `markInflight`/`clearInflight` become keyed by `agentId`, each mark carries `group`; add `inflights(data)`; export it.
- Test: `tests/registry.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none
- Produces: `markInflight(root, sessionId, stage, agentId, lap, group)` — returns the assigned group (a positive integer) or `null`; `clearInflight(root, sessionId, agentId)`; `inflights(data)` (array)

**Dispatch:** implementer, sonnet — a data-shape change with several call shapes to keep straight (bare object vs array, explicit vs auto group), no architectural risk.

1. Write the failing test. Append to `tests/registry.test.js`:
   ```js
   test('markInflight assigns the next free group per stage, stores one mark as a bare object and two as an array, and clearInflight removes one at a time', () => {
     const root = tmpRoot();
     seed(root, SID, { active: true, stage: 'build' });
     const g1 = registry.markInflight(root, SID, 'build', 'agent-1', 1);
     assert.equal(g1, 1);
     let data = registry.readSession(root, SID);
     assert.deepEqual(data.inflight, { stage: 'build', at: data.inflight.at, group: 1, agentId: 'agent-1', lap: 1 });
     assert.equal(Array.isArray(data.inflight), false, 'one mark stays a bare object');

     const g2 = registry.markInflight(root, SID, 'build', 'agent-2', 1);
     assert.equal(g2, 2, 'the next free group, not agent-1\'s');
     data = registry.readSession(root, SID);
     assert.equal(Array.isArray(data.inflight), true, 'a second concurrent mark promotes the field to a list');
     assert.equal(registry.inflights(data).length, 2);
     assert.deepEqual(registry.inflights(data).map((m) => m.agentId).sort(), ['agent-1', 'agent-2']);

     assert.equal(registry.clearInflight(root, SID, 'agent-1'), true);
     data = registry.readSession(root, SID);
     assert.equal(Array.isArray(data.inflight), false, 'one left collapses back to a bare object');
     assert.equal(data.inflight.agentId, 'agent-2');

     assert.equal(registry.clearInflight(root, SID, 'agent-2'), true);
     assert.equal(readEntryInflight(root, SID), undefined, 'the field is gone once none are left');
   });

   test('an explicit group is used as-is, and clearInflight with no agentId clears every mark (the shape every caller before this used)', () => {
     const root = tmpRoot();
     seed(root, SID, { active: true, stage: 'build' });
     assert.equal(registry.markInflight(root, SID, 'build', 'a', 1, 5), 5);
     assert.equal(registry.markInflight(root, SID, 'build', 'b', 1, 9), 9);
     assert.equal(registry.inflights(registry.readSession(root, SID)).length, 2);
     assert.equal(registry.clearInflight(root, SID), true);
     assert.equal(readEntryInflight(root, SID), undefined);
   });

   test('a group resets per lap: group 1 is free again once lap 1\'s only mark clears, even with a mark already running at lap 2', () => {
     const root = tmpRoot();
     seed(root, SID, { active: true, stage: 'build' });
     registry.markInflight(root, SID, 'build', 'a', 2);
     assert.equal(registry.markInflight(root, SID, 'build', 'b', 1), 1, 'lap 1 has no marks yet, regardless of lap 2');
   });

   test('inflights reads a legacy single-object mark the same as a fresh one, and an absent field as empty', () => {
     assert.deepEqual(registry.inflights({ inflight: { stage: 'survey', at: 1, agentId: 'x' } }), [{ stage: 'survey', at: 1, agentId: 'x' }]);
     assert.deepEqual(registry.inflights({}), []);
     assert.deepEqual(registry.inflights(null), []);
   });

   function readEntryInflight(root, sessionId) {
     return registry.readSession(root, sessionId).inflight;
   }
   ```
2. Run it and see it fail: `node --test tests/registry.test.js` — `TypeError` or assertion failures, since `markInflight` takes no `group` argument and always overwrites a single object.
3. Write the implementation. In `lib/registry.js`, replace lines 779-802 (the doc comment plus `markInflight`/`clearInflight`):
   ```js
   // A stage agent in flight: `{ stage, at, agentId?, lap?, group }`, written by
   // hooks/brief.js when a `fankeel-brain` starts and cleared by hooks/gate.js
   // once that stage's handoff carries a gate. `controlFor` in lib/stages.js
   // tells the controller to SendMessage the agent rather than dispatch another
   // on the same group.
   //
   // `data.inflight` holds one mark directly for the ordinary case — at most one
   // stage agent running at a time, the shape every reader and fixture written
   // before group-parallel build already expects — and only promotes to an
   // array of marks once a second concurrent one exists. `inflights(data)` is
   // the one place that reads both shapes as one.
   function inflights(data) {
       const raw = data && data.inflight;
       if (Array.isArray(raw)) return raw.filter((m) => m && typeof m === 'object');
       if (raw && typeof raw === 'object') return [raw];
       return [];
   }

   // `group` is explicit when the caller already knows it (a re-mark on
   // SendMessage, tests); left out, it is the lowest positive integer no other
   // mark for this same `stage` and `lap` is already using, decided inside the
   // lock so two brains started together never claim the same one. A second
   // call with the same `agentId` replaces that mark rather than adding
   // another, the way a SendMessage re-delivery has always re-set it. Returns
   // the assigned group, or null if the record could not be updated.
   function markInflight(projectRoot, sessionId, stage, agentId, lap, group) {
       let assigned = null;
       const ok = update(projectRoot, sessionId, (data) => {
           const stageName = String(stage || '');
           const lapNum = Number.isInteger(lap) && lap > 0 ? lap : null;
           const kept = inflights(data).filter((m) => m.agentId !== agentId);
           if (Number.isInteger(group) && group > 0) {
               assigned = group;
           } else {
               const used = new Set(kept
                   .filter((m) => m.stage === stageName && (m.lap || null) === lapNum)
                   .map((m) => m.group)
                   .filter((g) => Number.isInteger(g)));
               assigned = 1;
               while (used.has(assigned)) assigned++;
           }
           const mark = { stage: stageName, at: Date.now(), group: assigned };
           if (typeof agentId === 'string' && agentId) mark.agentId = agentId;
           // The lap the brief's handoff and commit paths were built with, so
           // scripts/await.js watches those files and not a lap recomputed later.
           if (lapNum) mark.lap = lapNum;
           const next = kept.concat([mark]);
           data.inflight = next.length === 1 ? next[0] : next;
           return true;
       });
       return ok ? assigned : null;
   }

   // Removes one mark by `agentId`, leaving any other one standing — a group
   // brain's own mark clearing does not clear its still-running siblings'. With
   // no `agentId` (the shape every caller before group-parallel build used),
   // every mark on the record clears, same as deleting the old single field.
   // Collapses back to a bare mark, not a one-element array, once only one is
   // left, so a reader written for the ordinary case keeps seeing it that way.
   function clearInflight(projectRoot, sessionId, agentId) {
       return update(projectRoot, sessionId, (data) => {
           if (!('inflight' in data)) return false;
           const before = inflights(data);
           const kept = agentId ? before.filter((m) => m.agentId !== agentId) : [];
           if (kept.length === before.length) return false;
           if (!kept.length) delete data.inflight;
           else data.inflight = kept.length === 1 ? kept[0] : kept;
           return true;
       });
   }
   ```
   Then in `lib/registry.js`, in the `module.exports` block, add `inflights` after `clearInflight,` (line 902).
4. Run it and see it pass: `node --test tests/registry.test.js`.
5. Commit: `git commit -m "feat(registry): inflight marks carry a group and list once two run at once" lib/registry.js tests/registry.test.js`

## Task 14: handoff and commit paths carry a group

**Files:**
- Modify: `lib/handoff.js` — lines 51-64 only: `fileFor`/`handoffPath`/`commitPath` gain a `group` parameter, appending `-g<N>`.
- Test: `tests/handoff.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none
- Produces: `handoffPath(root, data, stage, lap, group)`, `commitPath(root, data, stage, lap, group)`, `fileFor(root, data, stage, suffix, lap, group)`

**Dispatch:** implementer, sonnet — a small, mechanical addition to an existing pure function; no design judgment beyond following the existing lap-suffix pattern.

1. Write the failing test. Append to `tests/handoff.test.js`, near the existing `handoffPath` tests:
   ```js
   test('a group appends -g<N> before the extension, combined with a lap or alone, and is silent when left out', () => {
     assert.equal(handoffPath('/r', DATA, 'build', undefined, 2), '/r/.fankeel/build/task-20260919T093012/build-g2.md');
     assert.equal(commitPath('/r', DATA, 'build', undefined, 2), '/r/.fankeel/build/task-20260919T093012/build-g2-commit.md');
     assert.equal(handoffPath('/r', DATA, 'build', 2, 3), '/r/.fankeel/build/task-20260919T093012/build-2-g3.md');
     assert.equal(handoffPath('/r', DATA, 'build'), '/r/.fankeel/build/task-20260919T093012/build.md', 'no group: unchanged');
     assert.equal(handoffPath('/r', DATA, 'build', undefined, 0), '/r/.fankeel/build/task-20260919T093012/build.md', 'group 0 is not a group');
   });
   ```
2. Run it and see it fail: `node --test tests/handoff.test.js` — the first three assertions fail because `handoffPath`/`commitPath` do not accept a fifth argument.
3. Write the implementation. In `lib/handoff.js`, replace lines 51-64 (`fileFor` through `commitPath`):
   ```js
   // The first visit keeps the name a stage has always had; the n-th, n >= 2, is
   // `<stage>-<n>`, so a return to a stage is a file of its own and never the last lap's.
   // `lap`, when given, is used as it is rather than recomputed from `moves`: the
   // lap a stage agent was briefed with, read back off its in-flight mark, stays
   // the lap its files carry even after `moves` gains an entry. `group`, when a
   // positive integer, adds `-g<N>` after the lap suffix and before the
   // extension: a build running several brains at once names each one's file
   // for it (`build-g2.md`), and the closing brain's own report, with no
   // group, keeps the plain name every other stage already uses.
   function fileFor(root, data, stage, suffix, lap, group) {
       const dir = dirFor(root, data);
       if (!dir || !stage) return null;
       const n = Number.isInteger(lap) && lap > 0 ? lap : lapOf(data, stage);
       const g = Number.isInteger(group) && group > 0 ? '-g' + group : '';
       return dir + '/' + stage + (n > 1 ? '-' + n : '') + g + suffix;
   }

   function handoffPath(root, data, stage, lap, group) {
       return fileFor(root, data, stage, '.md', lap, group);
   }

   function commitPath(root, data, stage, lap, group) {
       return fileFor(root, data, stage, '-commit.md', lap, group);
   }
   ```
4. Run it and see it pass: `node --test tests/handoff.test.js`.
5. Commit: `git commit -m "feat(handoff): handoff and commit paths take an optional group suffix" lib/handoff.js tests/handoff.test.js`

## Task 15: a group brain's brief names its group and file, brief.js threads it through

**Files:**
- Modify: `hooks/brief.js` — lines 42-63 only: capture `markInflight`'s returned group, pass it into `renderBrief`.
- Modify: `lib/render.js` — lines 490-593 only: `renderBrainBrief` gains a `group` parameter and a build-specific bullet naming the group file; `renderBrief` passes `group` through.
- Read: `lib/registry.js` — lines 779-903: `markInflight`'s return shape (Task 13)
- Read: `lib/handoff.js` — lines 51-64: `handoffPath`'s group parameter (Task 14)
- Test: `tests/brief.test.js` — the test file this task writes

**Interfaces:**
- Consumes: `markInflight(root, sessionId, stage, agentId, lap, group)`, `handoffPath(root, data, stage, lap, group)`
- Produces: `renderBrief({ mine, agentType, root, profile, transcriptPath, group })`, `renderBrainBrief(mine, root, profile, transcriptPath, group)`

**Dispatch:** implementer, sonnet — wiring one new value through two small call sites and one conditional sentence; no new data shape.

1. Write the failing test. Append to `tests/brief.test.js`:
   ```js
   test('a build brain\'s brief names its group and the file a group writes instead of the gated one', () => {
     const root = tmp();
     seedProfile(root, { 'stage.agents': ['build'] });
     seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
     const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
     assert.match(text, /Your prompt names your case: task numbers for a group, or `build close`/);
     assert.match(text, /build-g1\.md instead of \S*build\.md/);
     assert.match(text, /the only gate this whole stage asks/);
     assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
   });

   test('two brains dispatched together for build get distinct groups, and both marks stay in flight until each reports', () => {
     const root = tmp();
     seedProfile(root, { 'stage.agents': ['build'] });
     seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
     const first = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
     const second = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a2' })));
     assert.match(first, /build-g1\.md/);
     assert.match(second, /build-g2\.md/);
     const mark = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
     assert.equal(Array.isArray(mark), true);
     assert.deepEqual(mark.map((m) => m.group).sort(), [1, 2]);
   });
   ```
2. Run it and see it fail: `node --test tests/brief.test.js` — the new text does not exist in the rendered brief yet, and `renderBrainBrief` ignores any group.
3. Write the implementation.
   In `hooks/brief.js`, replace lines 42-56 (the in-flight mark plus the `renderBrief` call two blocks below stays a separate edit):
   ```js
   // A stage agent starting is the in-flight mark the controller's block
   // reads (`controlFor` in lib/stages.js), so an interjection mid-stage is
   // told to SendMessage it rather than start a second one. The parent's
   // record, not an entry for the subagent: `agent_id` is a value here.
   // `lap` is the one `renderBrief` below builds the brief's paths with, and
   // `group` is the one it names in a build's brief: `markInflight` assigns
   // it, so this is the one place both the mark and the brief agree on it.
   let group = null;
   if (mine.stage && String(payload.agent_type || '').replace(/^fankeel:/, '') === 'fankeel-brain') {
       try {
           group = registry.markInflight(root, payload.session_id, mine.stage, payload.agent_id, lapOf(mine, mine.stage));
       } catch (e) { /* housekeeping */ }
   }
   ```
   Then, in `hooks/brief.js`, replace line 62 (the `renderBrief` call):
   ```js
   const text = renderBrief({ mine: { sessionId: payload.session_id, data: mine }, agentType: payload.agent_type, root, profile, transcriptPath: payload.transcript_path, group });
   ```
   In `lib/render.js`, replace line 490 (`renderBrainBrief`'s signature):
   ```js
   function renderBrainBrief(mine, root, profile, transcriptPath, group) {
   ```
   In `lib/render.js`, in `renderBrainBrief`, replace the `if (stage === 'build') {` block (lines 516-520):
   ```js
       if (stage === 'build') {
           const groupHandoff = handoffPath(root, data, stage, undefined, group);
           lines.push('  - Your prompt names your case: task numbers for a group, or `build close`. A group: do only those tasks, skip the `json gate` block above, write the report to ' + groupHandoff + ' instead of ' + handoff + ', and return that path — a fresh brain continues what is left. `build close`: run the full test suite first, then the report and gate above go to ' + handoff + ' as written — the only gate this whole stage asks.');
           const commit = commitPath(root, data, stage);
           lines.push('  - You cannot commit: `git commit` and `git add` are refused to you. Ask for a commit only when none of your implementers is still running, never per task: then write ' + commit + ' — one block per task that returned since the last commit, the paths it owns one per line, a blank line, then its commit message, and a line `---` between blocks — and return `commit ' + commit + '` and nothing else. The controller commits and messages you `<base>..<sha>` for a one-block file, or one `<paths>: <base>..<sha>` line per block: each is that task\'s pinned range for its reviewer, and where the skill says to commit, this is it. Its paths are relative to the repository root. The reply is those lines or one line `commit.js: <why>`; a failure stops at `commit.js: block <n>: <why>` after the lines that landed. If <why> is about your file or the paths you listed (no blank line, no message, a path git refused, nothing to commit, cannot read): fix it and ask again, but the same error twice means the stage is blocked. If it is anything else (no repository, a hook or git\'s own refusal, usage): the stage is blocked, so say so in the report. Return the report path when the whole stage is done or blocked.');
           lines.push('  - You have no Edit. A task whose Dispatch line says in-session goes to an implementer on model `' + profile.values['dispatch.floor'] + '` like any other: send it the task\'s brief. One whose Dispatch line says user is not yours to send: `ledger.js ready` never lists it, the controller runs it with the user after your report, and your report names it on a line `hands: <n>, <n>`.');
       }
   ```
   In `lib/render.js`, replace line 580 (`renderBrief`'s signature):
   ```js
   function renderBrief({ mine, agentType, root, profile, transcriptPath, group }) {
   ```
   In `lib/render.js`, replace line 591 (the `renderBrainBrief` call):
   ```js
           const brain = renderBrainBrief(mine, root, profile, transcriptPath, group);
   ```
4. Run it and see it pass: `node --test tests/brief.test.js`.
5. Commit: `git commit -m "feat(brief): a build brain's brief names its group and file" hooks/brief.js lib/render.js tests/brief.test.js`

## Task 16: gate.js reads one mark out of several, and clears the whole stage on a real gate

**Files:**
- Modify: `hooks/gate.js` — lines 130-230 only: a local `runningMark` helper narrows `mine.inflight` to the one matching mark before `skipReason`; the `clearInflight` call gets an explaining comment, no code change.
- Read: `lib/handoff.js` — lines 266-282: `skipReason`'s own `inflight` contract, unchanged
- Test: `tests/gate.test.js` — the test file this task writes

**Interfaces:**
- Consumes: `inflights` is not called directly (a local equivalent is written here so `hooks/` never reaches into `lib/registry.js`'s array-vs-object internals through a second path); the shape it reads is Task 13's.
- Produces: none

**Dispatch:** implementer, sonnet — one small local helper and a proving test; the risk is a silent regression (a message that stops firing), not a design choice.

1. Write the failing test. Append to `tests/gate.test.js`:
   ```js
   test('a brain dispatched for a stage stage.agents does not name: the gate hook still says so with several marks on the record', () => {
     const root = tmp('fankeel-gate-');
     const marks = [{ stage: 'design', at: 1758000000000, agentId: 'b1', group: 1 }, { stage: 'design', at: 1758000000000, agentId: 'b2', group: 2 }];
     seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: marks });
     fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
     const out = JSON.parse(run(GATE, root, { tool_input: askOf(QUESTIONS) }));
     assert.match(out.systemMessage, /dispatched for `design`, but stage\.agents \(survey,build,verify\) does not name `design`/);
   });

   test('stage.agents: a matching gate clears every mark on the record for this stage, not only one', () => {
     const root = tmp('fankeel-gate-');
     const marks = [{ stage: 'survey', at: 1758000000000, agentId: 'a3f9c2', group: 1 }, { stage: 'survey', at: 1758000000000, agentId: 'b7e1d4', group: 2 }];
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: marks });
     agentsOn(root);
     handoff(root, { questions: QUESTIONS, next: 'n' });
     run(GATE, root, { tool_input: askOf(QUESTIONS) });
     assert.equal(readEntry(root, MINE).inflight, undefined, 'both marks are gone once the one real gate for this stage is confirmed');
   });
   ```
2. Run it and see it fail: `node --test tests/gate.test.js` — the first new test fails because `skipReason` is handed the raw array as `inflight`, reads `mark.stage` off it as `undefined`, and produces no message.
3. Write the implementation. In `hooks/gate.js`, after the `agentsText` function (after line 59), add:
   ```js
   // The single mark `skipReason` reads: whatever `mine.inflight` holds — none,
   // one mark, or (a build's groups, docs/90-agent/plans/2026-09-28-agent-lifetime-design.md
   // §1) several — narrowed to the one matching `stage`, since that is the
   // only field `skipReason`'s message ever names. Every mark for one stage
   // carries the same `stage`, so which one is picked among several does not
   // change what it says. A local equivalent of `lib/registry.js`'s
   // `inflights`, not a call to it: this file reaches into `lib/handoff.js`
   // and `lib/stages.js` already, and the array-vs-bare-object shape is
   // `lib/registry.js`'s to read, not a second copy's.
   function runningMark(mine, stage) {
       const raw = mine && mine.inflight;
       const marks = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
       return marks.find((m) => m && m.stage === stage) || null;
   }
   ```
   Then, in `hooks/gate.js`, replace line 158:
   ```js
           if (!gate) skip = skipReason({ stage: mine.stage, controlled, agents, inflight: runningMark(mine, mine.stage), handoff: file });
   ```
   And, in `hooks/gate.js`, replace line 217:
   ```js
           skip = skipReason({ stage: mine.stage, controlled, matches: false, agents, inflight: runningMark(mine, mine.stage), handoff: file });
   ```
   And, in `hooks/gate.js`, replace lines 224-227 (the comment above `clearInflight`, no code change):
   ```js
       // The controller's own AskUserQuestion call already copies the file's gate
       // word for word, so there is nothing to substitute. The stage agent has
       // handed its gate back, so it is no longer in flight. There is no
       // SubagentStop hook in .claude-plugin/plugin.json; this is the one place
       // the mark is cleared. No `agentId`: every mark on this record clears,
       // not only the one that reported. Correct specifically because a real,
       // matched gate only ever comes from this stage's closing brain (design
       // §1, bullet 6) — by the time it is asked, every group this stage ran
       // has already returned, so nothing is left standing to spare.
       try {
           registry.clearInflight(root, payload.session_id);
       } catch (e) { /* housekeeping */ }
   ```
4. Run it and see it pass: `node --test tests/gate.test.js`.
5. Commit: `git commit -m "fix(gate): read one matching mark out of a list before skipReason" hooks/gate.js tests/gate.test.js`

## Task 17: await.js watches one brain at a time, chosen by --agent

**Files:**
- Modify: `scripts/await.js` — lines 19-129 only: `--agent <id>` flag; `waitFor`/`commitCandidates`/`lineFor` become group-aware.
- Read: `lib/registry.js` — lines 779-903: `inflights(data)` (Task 13)
- Test: `tests/await.test.js` — the test file this task writes

**Interfaces:**
- Consumes: `inflights(data)`, `handoffPath(root, data, stage, lap, group)`, `commitPath(root, data, stage, lap, group)`
- Produces: none (a CLI flag, not a programmatic interface)

**Dispatch:** implementer, sonnet — several existing tests must keep passing unmodified, which takes care reading the current fixtures rather than architectural risk.

1. Write the failing test. Append to `tests/await.test.js`:
   ```js
   // docs/90-agent/plans/2026-09-28-agent-lifetime-design.md §1: build alone can
   // run more than one brain at once, each with its own inflight mark and its
   // own `-g<N>` handoff; `--agent` says which this call watches.
   test('await.js watches one group-parallel brain at a time, chosen by --agent, and tags its line with its group', async () => {
     const marks = [{ stage: 'build', at: 1, agentId: 'a1', group: 1 }, { stage: 'build', at: 1, agentId: 'a2', group: 2 }];
     const f = fixture({ inflight: marks });
     const g2 = path.join(f.task, 'build-g2.md').split(path.sep).join('/');
     at(g2, Date.now());
     const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
     assert.equal(out.text, 'group 2, agent a2: handoff ' + g2 + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.');
   });

   test('await.js refuses to guess which brain to watch when more than one is running, and refuses an --agent naming none of them', async () => {
     const marks = [{ stage: 'build', at: 1, agentId: 'a1', group: 1 }, { stage: 'build', at: 1, agentId: 'a2', group: 2 }];
     const f = fixture({ inflight: marks });
     const none = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
     assert.equal(none.code, 1);
     assert.match(none.text, /^await\.js: 2 stage agents in flight for build: pass --agent <id>/);
     const bad = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'zz', '--timeout', '0.5'], f.env);
     assert.equal(bad.code, 1);
     assert.match(bad.text, /^await\.js: no in-flight mark for agent zz at stage build/);
   });
   ```
2. Run it and see it fail: `node --test tests/await.test.js` — `--agent` is not a recognised flag (`code: 2`, usage line), so both new tests fail.
3. Write the implementation. In `scripts/await.js`, replace line 28 (`USAGE`):
   ```js
   const USAGE = 'await.js: usage: await.js --session <id> [--root <dir>] [--since <file>] [--idle <seconds>] [--timeout <seconds>] [--agent <id>]';
   ```
   In `scripts/await.js`'s `parseArgs`, replace the `else if (key === '--idle' || key === '--timeout') {` branch's surrounding block (add a branch before it, lines 50-54 become):
   ```js
           if (key === '--session') opts.session = value;
           else if (key === '--root') opts.root = value;
           else if (key === '--since') opts.since = value;
           else if (key === '--agent') opts.agent = value;
           else if (key === '--idle' || key === '--timeout') {
               const n = Number(value);
               if (!(n > 0)) return null;
               opts[key.slice(2)] = n;
           } else return null;
   ```
   In `scripts/await.js`, replace `commitCandidates` (lines 65-73):
   ```js
   function commitCandidates(root, data, lap, group) {
       const candidates = [commitPath(root, data, data.stage, lap, group)];
       if (data.stage === 'build') {
           const plan = newestPlan(root, data.started);
           const ledger = ledgerCommitPath(root, plan, data.stage);
           if (ledger) candidates.push(ledger);
       }
       return candidates.filter(Boolean);
   }
   ```
   In `scripts/await.js`, replace `waitFor` (lines 77-101):
   ```js
   // What `awaitHandoff` is given, from the record. The agent counts as lost
   // only when its own transcript exists: an agent nobody can find is never
   // judged. `inflights(data)` may hold more than one mark once a build runs
   // several brains at once (docs/90-agent/plans/2026-09-28-agent-lifetime-design.md
   // §1); `--agent` says which one this call watches, and is required once
   // there is more than one candidate for `data.stage` — this call watches
   // one brain, not a race across several, so an omitted `--agent` with two
   // or more running is an error rather than a silent guess.
   function waitFor(opts, env) {
       const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
       const data = registry.readSession(root, opts.session);
       if (!data) return { error: 'no session ' + opts.session + ' under ' + root };
       const running = registry.inflights(data).filter((m) => m.stage === data.stage);
       if (opts.agent && !running.some((m) => m.agentId === opts.agent)) return { error: 'no in-flight mark for agent ' + opts.agent + ' at stage ' + data.stage };
       if (!opts.agent && running.length > 1) return { error: running.length + ' stage agents in flight for ' + data.stage + ': pass --agent <id>' };
       const mark = opts.agent ? running.find((m) => m.agentId === opts.agent) : (running[0] || null);
       const lap = mark && Number.isInteger(mark.lap) && mark.lap > 0 ? mark.lap : undefined;
       const group = mark && Number.isInteger(mark.group) ? mark.group : undefined;
       const handoff = handoffPath(root, data, data.stage, lap, group);
       if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
       let since = 0;
       try {
           since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
       } catch (e) { /* nothing answered yet: any report counts */ }
       const agentId = mark && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
       let activity = () => [];
       const dir = agentId ? sessionDirOf(transcriptOf(data.configDir || configDirOf(env), opts.session)) : null;
       if (dir) {
           const own = path.join(dir, 'subagents', 'agent-' + agentId + '.jsonl');
           activity = () => (fs.existsSync(own) ? agentFiles(dir) : []);
       }
       return { handoff, commit: commitCandidates(root, data, lap, group), since, agentId, group, activity, idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000 };
   }
   ```
   In `scripts/await.js`, replace `lineFor` (lines 107-112):
   ```js
   // The word first, so the controller's rule can name it; then what to do, so
   // the rule does not have to carry every case under the injection's cap.
   // `commitFile` is the candidate that actually matched — `o.commit` may be
   // several paths, and only one of them was written. `o.group` tags the line
   // with which brain it is about once a build runs more than one at a time;
   // a call with nothing to tag (every other stage, and build with just one
   // running) prints exactly the line it always did.
   function lineFor(state, o, commitFile) {
       const tag = Number.isInteger(o.group) ? 'group ' + o.group + ', agent ' + (o.agentId || '?') + ': ' : '';
       if (state === 'handoff') return tag + 'handoff ' + o.handoff + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.';
       if (state === 'commit') return tag + 'commit ' + commitFile + ' — run `node ' + COMMIT_SCRIPT + ' "' + commitFile + '"` and SendMessage the agent what it printed, exactly. After a `commit.js:` line, run await again with `--since "' + commitFile + '"` added.';
       if (state === 'lost') return tag + 'lost ' + o.agentId + ' — the stage agent stopped with neither file written: dispatch a fresh one with the same line.';
       return tag + 'timeout — nothing moved in ' + Math.round(o.timeoutMs / 60000) + ' minutes: run await again.';
   }
   ```
4. Run it and see it pass: `node --test tests/await.test.js`.
5. Commit: `git commit -m "feat(await): watch one group-parallel brain at a time with --agent" scripts/await.js tests/await.test.js`

## Task 18: the controller's block dispatches one brain per ready group

**Files:**
- Modify: `lib/stages.js` — lines 639-678 only: `inflightRule`/`controlRules`/`controlFor` read a list of marks, not one; a new `BUILD_GROUP_RULE` for build.
- Test: `tests/stages.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none (a local `marksOf` normaliser, not `lib/registry.js`'s `inflights` — `lib/stages.js` takes the bare field already, the way `render.js`'s `controlBlock` calls it, and reaches for no new cross-file dependency to read it)
- Produces: `controlFor(stage, values, subs, inflightRaw)` reading `inflightRaw` as none, one mark, or an array

**Dispatch:** implementer, sonnet — several existing tests pass a bare mark object as the fourth argument and must keep passing unmodified; the risk is the 2,400-character block cap, not the logic.

1. Write the failing test. Append to `tests/stages.test.js`:
   ```js
   test('build\'s controller block adds the group-parallel dispatch rule; no other controlled stage does', () => {
     const { controlFor } = require('../lib/stages.js');
     const values = { 'stage.agents': ['survey', 'build'] };
     const subs = { ledger: '<plugin>/scripts/ledger.js', await: '<plugin>/scripts/await.js', session: 'sid' };
     const build = controlFor('build', values, subs).rules;
     assert.ok(build.some((r) => r.includes('Build only: one Agent per ready `<plugin>/scripts/ledger.js groups` group')), build.join('\n'));
     assert.ok(build.some((r) => r.includes('prompt `build close`, runs the suite and writes the gate')));
     const survey = controlFor('survey', values, subs).rules;
     assert.equal(survey.some((r) => r.includes('Build only:')), false);
   });

   test('two marks for build each get their own SendMessage line, naming their group', () => {
     const { controlFor } = require('../lib/stages.js');
     const values = { 'stage.agents': ['build'] };
     const marks = [{ stage: 'build', at: 1, agentId: 'g1', group: 1 }, { stage: 'build', at: 1, agentId: 'g2', group: 2 }];
     const rules = controlFor('build', values, {}, marks).rules;
     const lines = rules.filter((r) => r.includes('already running'));
     assert.equal(lines.length, 2);
     assert.equal(lines[0], 'A build stage agent is already running for group 1 (`g1`): SendMessage it the user\'s new line and wait for it. Do not dispatch another for that group unless SendMessage says it is gone.');
     assert.match(lines[1], /for group 2 \(`g2`\)/);
   });
   ```
2. Run it and see it fail: `node --test tests/stages.test.js` — `Build only:` does not exist yet, and both marks collapse into whatever `controlFor` does with an array today (no per-mark line).
3. Write the implementation. In `lib/stages.js`, replace lines 639-661 (from the `inflightRule` doc comment through the end of `controlRules`):
   ```js
   // A stage agent already in flight (`inflight` on the record, written by
   // hooks/brief.js, cleared by hooks/gate.js). `data.inflight` holds one mark
   // directly, or — once a build's groups run more than one brain at a time —
   // an array; `marksOf` reads either shape the way `lib/registry.js`'s
   // `inflights` reads a whole record. The dispatch line stays below every one
   // of them: a mark left by an agent that died is only found out by SendMessage.
   const marksOf = (raw) => (Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []).filter((m) => m && typeof m === 'object');
   const inflightRule = (stage, mark) => 'A ' + stage + ' stage agent is already running'
       + (Number.isInteger(mark.group) ? ' for group ' + mark.group : '')
       + (typeof mark.agentId === 'string' && mark.agentId ? ' (`' + mark.agentId + '`)' : '')
       + ': SendMessage it the user\'s new line and wait for it. Do not dispatch another' + (Number.isInteger(mark.group) ? ' for that group' : '') + ' unless SendMessage says it is gone.';
   // Build alone runs more than one brain at once: one per group `ledger.js
   // groups` lists ready, dispatched together, prompt `build group <n>: tasks
   // <list>` in place of the bare `build` below. Once none is ready and every
   // task is complete, one more Agent, prompt `build close`, is the only one
   // that runs the full suite and writes the gate.
   const BUILD_GROUP_RULE = 'Build only: one Agent per ready `{{LEDGER}} groups` group untaken above, prompt `build group <n>: tasks <list>`; once none is ready, one more, prompt `build close`, runs the suite and writes the gate.';
   // A hand-back can be lost on the way — a SendMessage to a stopped agent showed
   // `queued` and vanished twice on 2026-09-23 — so after anything is sent, the
   // controller waits on the files instead: scripts/await.js, in the background.
   // What to do on each of its results rides the line it prints. The controlled
   // block sits within a few dozen characters of the 2400 cap (see render.test.js),
   // so trim here or in the gate/option-one rules before adding words anywhere else.
   const AWAIT_RULE = 'After the dispatch, each SendMessage, and a no-path finish notification, run `node {{AWAIT}} --session {{SESSION}}` with Bash `run_in_background`, end your turn; never poll. Its line says what next.';
   const controlRules = (stage, marks) => [
       'You are the controller for ' + stage + '. Do not do its work or restate what its agent wrote: dispatch, relay a path, ask.',
       ...marks.map((mark) => inflightRule(stage, mark)),
       'Dispatch one Agent: `subagent_type: fankeel:fankeel-brain`, prompt `' + stage + '`, plus one line only when the user has just given a new instruction for it; ' + (['design', 'plan'].includes(stage) ? '`model: opus`, replacing its file\'s pin; its brief carries the rules.' : 'no model. Its brief carries the rules.'),
       ...(stage === 'build' ? [BUILD_GROUP_RULE] : []),
       ...(['build', 'design', 'plan'].includes(stage) ? [COMMIT_RULE] : []),
       AWAIT_RULE,
       'When it returns a path, print it, then read {{HANDOFF}}\'s last `json gate` block and call AskUserQuestion with `questions` copied verbatim; `hooks/gate.js` validates the match. A return that is not a path or `commit <path>` is not its report: relay nothing and wait.',
       'Option one: strip `(Recommended)` for <word>; run `node {{TASK}} stage <word> --session {{SESSION}}`, or `node {{TASK}} down --session {{SESSION}}` for down/收工. Pause `node {{TASK}} next --from-gate --session {{SESSION}}`.',
       'Any other answer, typed too: SendMessage that agent exactly `The user\'s answer is in {{ANSWER}}.`, then ask again when it returns.',
   ];
   ```
   Then, in `lib/stages.js`, replace `controlFor` (lines 673-678):
   ```js
   function controlFor(stage, values, subs, inflightRaw) {
       const name = String(stage || '').trim().toLowerCase();
       if (!controlling(name, values)) return null;
       const running = marksOf(inflightRaw).filter((m) => m.stage === name);
       return { rules: substitute(substitute(controlRules(name, running), subs), subs, CONTROL_TOKENS), template: CONTROL_TEMPLATE };
   }
   ```
4. Run it and see it pass: `node --test tests/stages.test.js`. Also run `node --test tests/render.test.js` — the 2,400-character cap tests read the real block and must stay green; if `a record carrying an in-flight mark for its stage gets the SendMessage line` or the build-specific cap test fails on size, shorten `BUILD_GROUP_RULE`'s wording (never its `build group <n>` / `build close` phrasing — Task 19 quotes it verbatim).
5. Commit: `git commit -m "feat(stages): the controller dispatches one brain per ready build group" lib/stages.js tests/stages.test.js`

## Task 19: the brain's own instructions describe the group case

**Files:**
- Modify: `agents/fankeel-brain.md` — lines 68-73 (the `## Return` section names the group-vs-close branch), and the `## Tools` paragraph (near line 34) names the relay-dispatch and shared-prefix behaviour.
- Modify: `skills/fankeel-build/SKILL.md` — lines 43-45 only: the loop's own "asks once" sentence gets the same qualifier.
- Read: `lib/render.js` — lines 516-520: the exact wording Task 15 puts in the brief (`build close`, group file), quoted here rather than paraphrased
- Test: `tests/agents.test.js` — the test file this task writes
- Test: `tests/skills.test.js` — the test file this task writes

**Interfaces:**
- Consumes: `relayPath(root, data, agentId)` (Task 3), `prefix(root, planOpt, group)` (Task 5); the strings `build group <n>` and `build close` are fixed by this plan, not read from another task's code
- Produces: none

**Dispatch:** implementer, sonnet — prose edits to two already-tested files; the discipline is quoting exact current lines and adding without breaking existing section-scoped assertions.

1. Write the failing test. Append to `tests/agents.test.js`:
   ```js
   test('the stage agent\'s Return section says a group writes no gate, and only build close does', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
       const ret = text.split('\n## Return\n')[1];
       assert.match(ret, /a group rather than `build close`, the handoff path is that group's own — no/);
       assert.match(ret, /only `build close` runs the full suite, writes the gate/);
   });

   test('the brain\'s own Tools section describes dispatching a fresh implementer on a relay path, and the shared prefix at the head of every prompt', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
       const tools = text.split('\n## Tools\n')[1].split('\n## Refusals\n')[0];
       assert.match(tools, /relay-<agentId>\.md/);
       assert.match(tools, /relayPath\(root, data, agentId\)/);
       assert.match(tools, /brief --group <N> --prefix/);
       assert.match(tools, /in the same response/);
   });
   ```
   Append to `tests/skills.test.js`:
   ```js
   test('the build skill\'s own "asks once" sentence carries the group-parallel exception', () => {
       const text = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
       assert.match(text, /and then asks once\. A `fankeel-brain` dispatched for one group \(its prompt names task numbers, not `build close`\) returns with no gate once its own tasks are done; only `build close` is the one that asks\./);
   });
   ```
2. Run it and see it fail: `node --test tests/agents.test.js tests/skills.test.js` — none of the three sentences exists yet.
3. Write the implementation. In `agents/fankeel-brain.md`, replace the `## Return` section (lines 68-73):
   ```markdown
   ## Return

   The handoff path, and nothing else; on a build stage, when its brief says so,
   `commit <path>` for the tasks that returned since the last commit; on a design or plan stage, `commit <path>` for its file. On a build stage whose prompt
   names a group rather than `build close`, the handoff path is that group's
   own — no `json gate` block — and a fresh brain continues whatever the plan
   still lists; only `build close` runs the full suite, writes the gate, and
   is the one this whole stage's user question comes from. When you are sent
   a message that the user's answer is in a file, read it, rewrite the report
   and its gate, and return the path again.
   ```
   In `agents/fankeel-brain.md`, in the `## Tools` section, replace:
   ```markdown
   `fankeel:fankeel-render-reviewer`, `fankeel:fankeel-fixer`,
   `fankeel:fankeel-verifier` and an implementer
   (`general-purpose`, on the model the task's Dispatch line names, or on
   `dispatch.floor` where there is none): the raw
   reading happens in their contexts, and what reaches yours is what they return.
   ```
   In `agents/fankeel-brain.md`, replace it with:
   ```markdown
   `fankeel:fankeel-render-reviewer`, `fankeel:fankeel-fixer`,
   `fankeel:fankeel-verifier` and an implementer
   (`general-purpose`, on the model the task's Dispatch line names, or on
   `dispatch.floor` where there is none): the raw
   reading happens in their contexts, and what reaches yours is what they return.
   Every ready implementer in a group goes out in the same response, never one
   at a time: each one's prompt opens with `node <plugin>/scripts/ledger.js
   --plan <f> brief --group <N> --prefix`'s output, pasted verbatim, its own
   task's text last. When one instead returns a `relay-<agentId>.md` path
   (`relayPath(root, data, agentId)` in `lib/handoff.js` — it hit
   `hooks/budget.js`'s `HARD` limit before finishing), dispatch a fresh
   implementer whose prompt is that same shared prefix followed by only that
   relay file's path, not the task's own brief again.
   ```
   In `skills/fankeel-build/SKILL.md`, replace the sentence at lines 43-45 (`**This stage does not stop...`):
   ```markdown
   **This stage does not stop at a question until it is done.** Its gate is the end
   of the stage, not the end of a task: the loop runs everything the denominator
   lists open, and then asks once. A `fankeel-brain` dispatched for one group (its
   prompt names task numbers, not `build close`) returns with no gate once its own
   tasks are done; only `build close` is the one that asks.
   ```
4. Run it and see it pass: `node --test tests/agents.test.js tests/skills.test.js`.
5. Commit: `git commit -m "docs(brain): the brain's own instructions describe the group-vs-close case" agents/fankeel-brain.md skills/fankeel-build/SKILL.md tests/agents.test.js tests/skills.test.js`

## Task 20: `peak` on a subagent's dispatch row

`lib/usage.js`'s `dispatchesOf()` already puts `requests` on every agent row
(`own.usage.requests`, `lib/usage.js:565`) — the design's "由此得到 `requests`
和 `peak`" bullet is half done. Only `peak`, the largest single request's
context, is missing. It is computed the same way `lib/detail.js`'s
`extract()` already finds a session's own peak — `points`/`peak` at
`lib/detail.js:639-640`, a plain max over a series' `context` field — taken
here over one agent's own `series` (`own.series`, already built by
`summarise(file, { sidechain: true, series: true })` at `lib/usage.js:557`)
instead of the session's.

Nothing downstream needs touching: `lib/detail.js:622`'s
`const { file, models, series: agentCalls, ...rest } = r;` keeps every other
field of a row, `peak` included once it exists, and `lib/station.js:730`'s
`serializeDetail()` is `Object.assign({}, s.detail, {...})`, a full shallow
copy. Both are read-only verification in this task, not edits.

**Files:**
- Modify: `lib/usage.js` — add `peakOf(series)` beside `tokensOf` (:462) and a `peak` field on both places a row is built (:562-573, :600-606)
- Read: `lib/detail.js` — lines 601-626: `extract()`'s row projection; confirms `peak` needs no change here to reach `s.detail.rows`
- Read: `lib/station.js` — lines 720-733: `serializeDetail()`'s full spread; confirms `peak` needs no change here either
- Test: `tests/usage-peak.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none
- Produces: `peak` (a field on every row `dispatchesOf()` returns in `lib/usage.js`, and so on every row `s.detail.rows` and `serializeDetail()` carry)

**Dispatch:** implementer, sonnet — a small, fully-specified numeric field with the fixture and edit both given in full.

1. Write the failing test `tests/usage-peak.test.js`:

```javascript
'use strict';
// lib/usage.js dispatchesOf(): a row already carries `requests` (design §7's
// first bullet, half done); this adds `peak`, the largest single request's
// context — the same measure lib/detail.js's extract() already takes across
// a session's own requests (`points`/`peak`, lib/detail.js:639-640) — taken
// here across one agent's own series instead. The third test checks the
// field survives lib/station.js's serializeDetail(), a projection that can
// drop a field gather() has: test what serialize() outputs, not what the raw
// row carries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-28T09:00:' + String(s).padStart(2, '0') + '.000Z';
const agentLine = (rid, s, model, u) => line({
    type: 'assistant', isSidechain: true, requestId: rid, timestamp: T(s),
    message: { model, usage: u, content: [] },
});

function session() {
    const base = tmp('fankeel-usage-peak-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, line({ type: 'user', timestamp: T(0), message: { content: 'go' } }));
    const sub = path.join(dir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    // Two requests: the first carries the larger context (heavy cache read,
    // as a subagent's later turns do), the second is smaller. `peak` must be
    // the first (1100), not the sum (1105) and not the last (5).
    fs.writeFileSync(path.join(sub, 'agent-aaa1.jsonl'),
        agentLine('r1', 10, 'claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 })
        + agentLine('r2', 20, 'claude-sonnet-5', { input_tokens: 5, output_tokens: 5 }));
    return t;
}

test('dispatchesOf(): a row carries requests (already there) and peak, the largest single request\'s context, not a sum', () => {
    const out = usage.dispatchesOf(session());
    const row = out.rows.find((r) => r.id === 'aaa1');
    assert.equal(row.requests, 2);
    assert.equal(row.peak, 1100);
});

test('a workflow_agent left with no transcript file gets peak 0, not undefined', () => {
    const base = tmp('fankeel-usage-peak-orphan-');
    const t = path.join(base, 'sess.jsonl');
    const dir = path.join(base, 'sess');
    fs.writeFileSync(t, line({ type: 'user', timestamp: T(0), message: { content: 'go' } }));
    fs.mkdirSync(path.join(dir, 'subagents', 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'workflows', 'wf_1.json'), JSON.stringify({
        runId: 'wf_1', workflowName: 'flow', workflowProgress: [
            { type: 'workflow_agent', agentId: 'ddd4', label: 'read:x', phaseTitle: 'Read', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5' },
        ],
    }));
    const out = usage.dispatchesOf(t);
    const row = out.rows.find((r) => r.id === 'ddd4');
    assert.equal(row.peak, 0);
});

test("lib/station.js serializeDetail() passes a row's peak and requests through unchanged, since it is a full projection of s.detail and not a recomputation", () => {
    const fixture = { sessionId: 'sess-1', detail: { rows: [{ id: 'a1', requests: 4, peak: 160000 }] } };
    const script = station.serializeDetail(fixture);
    assert.match(script, /"requests":4/);
    assert.match(script, /"peak":160000/);
});
```

2. Run it and see it fail: `node --test tests/usage-peak.test.js` — the first
   two assertions throw `undefined !== 1100` / `undefined !== 0`, `row.peak`
   does not exist yet; the third already passes (a plain spread cannot lose a
   field it never had, so this only proves the harness works before the field
   exists — rerun after step 3 to see it prove the real thing).

3. In `lib/usage.js`, beside the existing line at :462

```javascript
const tokensOf = (split) => FIELDS.reduce((n, k) => n + split[k], 0);
```

   in `lib/usage.js`, add a peak helper right after it:

```javascript
const tokensOf = (split) => FIELDS.reduce((n, k) => n + split[k], 0);

// The largest context a single request in `series` carried — the same
// measure lib/detail.js's `extract()` takes across a session's own requests
// (`points`/`peak`, lib/detail.js:639-640), taken here across one agent's own
// `series` instead of the session's.
const peakOf = (series) => series.reduce((m, c) => (c.context > m ? c.context : m), 0);
```

   Then in `lib/usage.js`'s `dispatchesOf()`, the row built at :562-573 currently reads:

```javascript
        const row = {
            id, file, surface: inRun ? 'workflow' : 'agent', disp: null, turn: null,
            label: '', agentType: null, alias: null, phase: null, parent: null,
            requests: own ? own.usage.requests : 0, model: own ? own.model : null, models, split,
            tokens: tokensOf(split),
            durMs: span ? span.last - span.first : 0,
            // The agent's first and last request, and each request on its own
            // for the station's per-day rows; `durMs` above counts every line.
            from: times.length ? times.reduce((a, b) => Math.min(a, b)) : null,
            to: times.length ? times.reduce((a, b) => Math.max(a, b)) : null,
            series: own ? own.series : [],
        };
```

   in `lib/usage.js`, replace it with:

```javascript
        const row = {
            id, file, surface: inRun ? 'workflow' : 'agent', disp: null, turn: null,
            label: '', agentType: null, alias: null, phase: null, parent: null,
            requests: own ? own.usage.requests : 0, model: own ? own.model : null, models, split,
            tokens: tokensOf(split),
            // The station's per-agent view (design §7): the largest single
            // request's context this agent ever carried, not summed across
            // its requests the way `tokens` above is.
            peak: own ? peakOf(own.series) : 0,
            durMs: span ? span.last - span.first : 0,
            // The agent's first and last request, and each request on its own
            // for the station's per-day rows; `durMs` above counts every line.
            from: times.length ? times.reduce((a, b) => Math.min(a, b)) : null,
            to: times.length ? times.reduce((a, b) => Math.max(a, b)) : null,
            series: own ? own.series : [],
        };
```

   And in `lib/usage.js`, the placeholder row at :600-606 (an agent a run file names but whose transcript is gone) currently reads:

```javascript
            place({
                id, file: null, surface: 'workflow', disp: null, turn: null,
                label: String(p.label || ''), agentType: typeof p.agentType === 'string' ? p.agentType : null,
                alias: typeof p.model === 'string' ? p.model : null,
                phase: typeof p.phaseTitle === 'string' ? p.phaseTitle : null,
                requests: 0, model: null, models: {}, split: blank(), tokens: 0, durMs: 0, from: null, to: null, series: [], parent: null,
            }, dispatches.findIndex((d) => d.run === run));
```

   in `lib/usage.js`, replace it with:

```javascript
            place({
                id, file: null, surface: 'workflow', disp: null, turn: null,
                label: String(p.label || ''), agentType: typeof p.agentType === 'string' ? p.agentType : null,
                alias: typeof p.model === 'string' ? p.model : null,
                phase: typeof p.phaseTitle === 'string' ? p.phaseTitle : null,
                requests: 0, model: null, models: {}, split: blank(), tokens: 0, peak: 0, durMs: 0, from: null, to: null, series: [], parent: null,
            }, dispatches.findIndex((d) => d.run === run));
```

4. Run it and see it pass: `node --test tests/usage-peak.test.js`.
5. Commit:

```sh
git add lib/usage.js tests/usage-peak.test.js
git commit -m "fix: lib/usage.js dispatchesOf() rows carry peak, the largest single request's context"
```

## Task 21: station's dispatch table and chart get a peak and a requests column

`lib/usage.js` (Task 20) already puts `peak` and `requests` on every row;
`assets/station/station.js`'s dispatch table has to show them. `sums()`
(:3464-3473) and `numCells()` (:3474-3480) are the two helpers every caller —
the footer (:3744), each band header (:3704, :3716) and each single agent row
via `agentRow()` (:3560) — goes through, so widening the two helpers once
updates every one of them with no other edit. The bar chart's metric picker
(`dxChartHtml`, :3775-3821) needs its own small addition: `FMT`/`DXM` maps and
the `segHtml('dxm', ...)` option list.

**Files:**
- Modify: `assets/station/station.js` — lines 3464-3821 only (file is 5095 lines; never read it whole): widen `sums()`/`numCells()` with `peak`/`requests`, add two `<col>`/`<th>` to the dispatch table and the live-agents table, bump the `gap()` row's `colspan`, add the two metrics to the chart
- Modify: `assets/station/i18n.js` — English for the two new column/metric labels, near :715-719
- Modify: `docs/90-agent/reference/station.md` — document the two new columns, near :356-377
- Test: `tests/station-dispatch-peak.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none — the test builds its own fixture rows with `peak`/`requests` already on them, so this task does not need Task 20 to have landed first
- Produces: none

**Dispatch:** implementer, sonnet — a mechanical widening of two already-shared helpers plus a fixed-shape array literal, all given in full.

1. Write the failing test `tests/station-dispatch-peak.test.js`:

```javascript
'use strict';
// The dispatch table's two new columns (design §7's second bullet): a row's
// largest single request context ("context 峰值") and how many requests it
// made ("請求數"). The footer sums requests like every other numeric column;
// peak is not summed, sums() keeps the largest instead. `peak <= tokens` per
// row is a structural guarantee from how lib/usage.js builds `peak` and
// `tokens` (Task 20), not something this render layer re-derives.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const x = {
    dispatches: [
        { key: 't1', turn: 1, surface: 'agent', text: 'Review task 1', out: 1000, back: 61000, ret: 100, launch: 0, ids: ['a1'] },
        { key: 't2', turn: 2, surface: 'agent', text: 'Review task 2', out: 2000, back: 90000, ret: 100, launch: 0, ids: ['a2'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'Review task 1', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 100, k: 60, s: 60, split: { input: 0, output: 0 }, cost: { input: 0, output: 0 }, unpriced: [], peak: 160000, requests: 4 },
        { id: 'a2', disp: 1, surface: 'agent', label: 'Review task 2', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 50, k: 20, s: 30, split: { input: 0, output: 0 }, cost: { input: 0, output: 0 }, unpriced: [], peak: 90000, requests: 3 },
    ],
    runs: [],
    agentCents: 150,
    agentsTotal: { cents: 150 },
    unpriced: [],
    steps: {},
    events: [],
    dropped: 0,
};

test('the dispatch table shows a context-peak and a requests column, and the footer sums requests (not peak)', () => {
    const html = V.dispatchHtml(x);
    const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
    assert.match(head, /context 峰值/);
    assert.match(head, /請求數/);
    const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
    assert.match(foot, />7</, 'footer requests is 4 + 3');
    assert.match(html, /160k/, "row a1's own peak, unabbreviated tokens() would be 160,000");
    assert.match(html, /90k/, "row a2's own peak");
});

test('the chart metric picker offers peak and requests beside cost/tokens/time/chars', () => {
    const html = V.dispatchHtml(x, undefined, { metric: 'peak' });
    assert.match(html, /data-seg="peak"/);
    assert.match(html, /data-seg="requests"/);
});
```

2. Run it and see it fail: `node --test tests/station-dispatch-peak.test.js` —
   `context 峰值`/`請求數` are not in the header, the footer has no `7`, and
   `data-seg="peak"`/`data-seg="requests"` do not exist.

3. In `assets/station/station.js`, the two shared helpers at :3464-3480 currently read:

```javascript
    function sums(rows) {
        return rows.reduce(function (a, r) {
            a.c += r.c; a.k += r.k; a.s += r.s;
            a.ti += r.split ? r.split.input || 0 : 0;
            a.to += r.split ? r.split.output || 0 : 0;
            a.ci += r.cost ? r.cost.input || 0 : 0;
            a.co += r.cost ? r.cost.output || 0 : 0;
            return a;
        }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0 });
    }
    function numCells(t, unpriced, time) {
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="' + loc('det.priceListDoesNotKnow', '價目表不認得：{u}', { u: esc(unpriced) }) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>'
            + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + '</td>'
            + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + '</td>';
    }
```

   in `assets/station/station.js`, replace them with:

```javascript
    function sums(rows) {
        return rows.reduce(function (a, r) {
            a.c += r.c; a.k += r.k; a.s += r.s;
            a.ti += r.split ? r.split.input || 0 : 0;
            a.to += r.split ? r.split.output || 0 : 0;
            a.ci += r.cost ? r.cost.input || 0 : 0;
            a.co += r.cost ? r.cost.output || 0 : 0;
            a.requests += r.requests || 0;
            if ((r.peak || 0) > a.peak) a.peak = r.peak || 0;
            return a;
        }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0, requests: 0, peak: 0 });
    }
    function numCells(t, unpriced, time) {
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
            + (unpriced ? ' title="' + loc('det.priceListDoesNotKnow', '價目表不認得：{u}', { u: esc(unpriced) }) + '"' : '') + '>'
            + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>'
            + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + '</td>'
            + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + '</td>'
            + '<td class="r">' + tokens(t.peak || 0) + '</td><td class="r">' + comma(t.requests || 0) + '</td>';
    }
```

   In `assets/station/station.js`, `dispatchHtml()`'s `gap()` helper currently reads:

```javascript
            return '<tr class="gaprow"><td colspan="9">session ' + (end !== null ? loc('disp.endedAtB', '<b>{t}</b> 結束，', { t: clock(end) }) : '')
```

   in `assets/station/station.js`, replace `colspan="9"` with `colspan="11"` (two columns joined the row):

```javascript
            return '<tr class="gaprow"><td colspan="11">session ' + (end !== null ? loc('disp.endedAtB', '<b>{t}</b> 結束，', { t: clock(end) }) : '')
```

   In `assets/station/station.js`, the main table's colgroup/header/footer at :3739-3745 currently reads:

```javascript
        var rows = vw === 'chart' ? '' : '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
            + '<col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.dispatch', '派工') + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
            + '<th class="r rc" title="' + loc('disp.charsReturnedHint', '這次派工的結果進入主 context 的字元數') + '">' + loc('disp.charsReturned', '回傳字元') + '</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + loc('disp.nAgents2', '{n} 個 agent', { n: x.rows.length }) + '</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>';
```

   in `assets/station/station.js`, replace it with (two more `<col>`, two more `<th>`; the footer's `numCells(all, '')` call is unchanged and now emits the two extra `<td>` on its own):

```javascript
        var rows = vw === 'chart' ? '' : '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
            + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.dispatch', '派工') + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
            + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
            + '<th class="r rc" title="' + loc('disp.charsReturnedHint', '這次派工的結果進入主 context 的字元數') + '">' + loc('disp.charsReturned', '回傳字元') + '</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + loc('disp.nAgents2', '{n} 個 agent', { n: x.rows.length }) + '</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>';
```

   In `assets/station/station.js`, the live-agents table right after it currently reads:

```javascript
        if (vw === 'chart' && live.length) {
            rows = '<table class="x dx dxlive"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
                + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
                + '<col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.runningNow', '正在跑 {n}', { n: live.length }) + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
                + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
                + '<th class="r rc"></th></tr></thead><tbody>'
                + live.map(function (r) { return agentRow(r, 'ag', '', x, s, u); }).join('') + '</tbody></table>';
        }
```

   in `assets/station/station.js`, replace it with:

```javascript
        if (vw === 'chart' && live.length) {
            rows = '<table class="x dx dxlive"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
                + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
                + '<col style="width:54px"><col style="width:48px"><col style="width:58px"></colgroup><thead><tr><th>' + loc('disp.runningNow', '正在跑 {n}', { n: live.length }) + '</th><th class="r">' + loc('disp.timeSpent', '耗時') + '</th><th class="r">tokens</th>'
                + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
                + '<th class="r">' + loc('disp.contextPeak', 'context 峰值') + '</th><th class="r">' + loc('disp.requests', '請求數') + '</th>'
                + '<th class="r rc"></th></tr></thead><tbody>'
                + live.map(function (r) { return agentRow(r, 'ag', '', x, s, u); }).join('') + '</tbody></table>';
        }
```

   Further down in `assets/station/station.js`, `dxChartHtml()`'s metric map at :3776 currently reads:

```javascript
        var FMT = { c: cents, k: function (v) { return comma(v) + 'k'; }, s: dur, r: function (v) { return loc('disp.nChars2', '{v} 字', { v: comma(v) }); } };
```

   in `assets/station/station.js`, replace it with:

```javascript
        var FMT = { c: cents, k: function (v) { return comma(v) + 'k'; }, s: dur, r: function (v) { return loc('disp.nChars2', '{v} 字', { v: comma(v) }); },
            peak: tokens, requests: comma };
```

   And in `assets/station/station.js` at :3814-3816:

```javascript
        var DXM = { c: loc('disp.cost2', '花費'), k: 'token', s: loc('disp.timeSpent2', '耗時'), r: loc('disp.charsReturned2', '回傳字元') };
        return '<div class="dxc"><div class="dxch">'
            + segHtml('dxm', [['c', DXM.c], ['k', DXM.k], ['s', DXM.s], ['r', DXM.r]], m)
```

   in `assets/station/station.js`, replace it with:

```javascript
        var DXM = { c: loc('disp.cost2', '花費'), k: 'token', s: loc('disp.timeSpent2', '耗時'), r: loc('disp.charsReturned2', '回傳字元'),
            peak: loc('disp.contextPeak', 'context 峰值'), requests: loc('disp.requests', '請求數') };
        return '<div class="dxc"><div class="dxch">'
            + segHtml('dxm', [['c', DXM.c], ['k', DXM.k], ['s', DXM.s], ['r', DXM.r], ['peak', DXM.peak], ['requests', DXM.requests]], m)
```

4. In `assets/station/i18n.js`, lines 716-719 currently read:

```javascript
            'disp.timeSpent': 'Time spent',
            'disp.charsReturnedHint': "the character count of this dispatch's result reaching the main context",
            'disp.charsReturned': 'Chars returned',
            'disp.nAgents2': '{n} agents',
```

   in `assets/station/i18n.js`, insert the two new keys between `disp.charsReturned` and `disp.nAgents2`:

```javascript
            'disp.timeSpent': 'Time spent',
            'disp.charsReturnedHint': "the character count of this dispatch's result reaching the main context",
            'disp.charsReturned': 'Chars returned',
            'disp.contextPeak': 'Context peak',
            'disp.requests': 'Requests',
            'disp.nAgents2': '{n} agents',
```

5. In `docs/90-agent/reference/station.md`, the paragraph at :360-368 currently reads:

```markdown
**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
dispatch calls in one response) or `workflow` on it, and one row per agent: its
state, its wall-clock from its own transcript, its tokens, and its dollars
priced from its own per-kind counts — `workflow_agent.tokens` is one undivided
number and cannot be priced — with the price table's `verified` date beside
them and `unpriced` where the table does not know the model. Every workflow run
the session made is read, not only the newest. A workflow folds into one row
per phase until the phase is opened, each phase row carrying a dot per agent
in its state's colour and how many are in each state. The last column is the
```

   in `docs/90-agent/reference/station.md`, insert one sentence after "does not know the model.":

```markdown
**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
dispatch calls in one response) or `workflow` on it, and one row per agent: its
state, its wall-clock from its own transcript, its tokens, and its dollars
priced from its own per-kind counts — `workflow_agent.tokens` is one undivided
number and cannot be priced — with the price table's `verified` date beside
them and `unpriced` where the table does not know the model. Two more columns
follow the dollars: the largest context a single one of its requests carried,
and how many requests it made — every band and the footer sum the request
column the way they sum every other, while the peak column takes the largest
of the group rather than a sum. Every workflow run
the session made is read, not only the newest. A workflow folds into one row
per phase until the phase is opened, each phase row carrying a dot per agent
in its state's colour and how many are in each state. The last column is the
```

6. Run it and see it pass: `node --test tests/station-dispatch-peak.test.js`.
   Also run the pre-existing `node --test tests/station-dispatch-view.test.js`
   and `node --test tests/station-i18n.test.js` to confirm the two widened
   helpers and the new `loc()` calls did not redden either.
7. Commit:

```sh
git add assets/station/station.js assets/station/i18n.js docs/90-agent/reference/station.md tests/station-dispatch-peak.test.js
git commit -m "feat: station dispatch table and chart show each agent's context peak and request count"
```

## Task 22: fix `summarise.js`'s cumulative-cost double-count and re-run it

`--resume` reports `total_cost_usd` and `modelUsage` cumulative since the
session's own start, not per stage. `summarise.js:26-41`'s `arm()` sums
`total_cost_usd` and `modelUsage` `+=` across every stage file it finds,
which multiplies the same spend in — `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summary.json`'s
current `arms.opus.usd` (11.4686) already equals the sum of its five
per-stage cumulative readings, confirming this. The real total is whichever
stage comes last in the pipeline (`start, design, plan, build, verify`), read
once.

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js` — replace the summing `arm()` (lines 26-41) with one that reads only the last stage's file
- Modify: `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summary.json` — regenerated output, committed alongside the fix
- Test: `tests/summarise-cumulative.test.js` — the test file this task writes

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a bounded, fully-specified fix to one small script plus its own regeneration command.

1. Write the failing test `tests/summarise-cumulative.test.js`:

```javascript
'use strict';
// docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js:
// `--resume` gives `total_cost_usd` and `modelUsage` cumulative since the
// session's own start, so summing them across stage files double- (or
// n-tuple-) counts. The real total is whichever stage comes last, read once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence',
    '2026-09-25-controller-multiplier', 'summarise.js');

function write(dir, name, totalUsd, model, u) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ total_cost_usd: totalUsd, modelUsage: { [model]: u } }));
}

test("summarise.js's arm() reads only the last stage's cumulative total, not a sum across stages", () => {
    const dir = tmp('fankeel-summarise-');
    write(dir, 'opus-design.json', 1.00, 'claude-opus-5-5',
        { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 100, cacheCreationInputTokens: 20, costUSD: 1.00 });
    write(dir, 'opus-verify.json', 3.00, 'claude-opus-5-5',
        { inputTokens: 30, outputTokens: 15, cacheReadInputTokens: 300, cacheCreationInputTokens: 60, costUSD: 3.00 });
    write(dir, 'sonnet-design.json', 2.00, 'claude-sonnet-5',
        { inputTokens: 8, outputTokens: 4, cacheReadInputTokens: 80, cacheCreationInputTokens: 16, costUSD: 2.00 });
    write(dir, 'sonnet-verify.json', 5.00, 'claude-sonnet-5',
        { inputTokens: 24, outputTokens: 12, cacheReadInputTokens: 240, cacheCreationInputTokens: 48, costUSD: 5.00 });
    const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
    assert.equal(out.arms.opus.usd, 3.00, 'verify is the last stage; its own total is already cumulative, not design+verify summed to 4.00');
    assert.equal(out.arms.sonnet.usd, 5.00);
    assert.equal(out.arms.opus.models['claude-opus-5-5'].usd, 3.00);
    assert.equal(out.arms.opus.tokens, 30 + 15 + 300 + 60);
});
```

2. Run it and see it fail: `node --test tests/summarise-cumulative.test.js` —
   today's `arm()` sums both files' `total_cost_usd`, so `out.arms.opus.usd`
   is `4.00`, not `3.00`.
3. In `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`, lines 26-41 currently read:

```javascript
function arm(name) {
    const out = { usd: 0, tokens: 0, stages: {}, models: {} };
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(name + '-') && f.endsWith('.json')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        out.usd += j.total_cost_usd || 0;
        out.stages[f.slice(name.length + 1, -5)] = j.total_cost_usd || 0;
        for (const [id, u] of Object.entries(j.modelUsage || {})) {
            const m = out.models[id] || (out.models[id] = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            const t = mix(u);
            for (const k of Object.keys(t)) m[k] += t[k];
            m.usd += u.costUSD || 0;
            out.tokens += t.input + t.output + t.cacheRead + t.cacheWrite5m;
        }
    }
    return out;
}
```

   in `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`, replace it with:

```javascript
// `--resume` reports `total_cost_usd` and `modelUsage` cumulative since the
// session's own start, not per stage — so the run's real total is whichever
// stage file comes last in the pipeline, read once, never summed across files.
const ORDER = ['start', 'design', 'plan', 'build', 'verify'];
function arm(name) {
    const out = { usd: 0, tokens: 0, stages: {}, models: {} };
    let last = null;
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(name + '-') && f.endsWith('.json')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const stage = f.slice(name.length + 1, -5);
        out.stages[stage] = j.total_cost_usd || 0;
        if (!last || ORDER.indexOf(stage) > ORDER.indexOf(last.stage)) last = { stage, j };
    }
    if (last) {
        out.usd = last.j.total_cost_usd || 0;
        for (const [id, u] of Object.entries(last.j.modelUsage || {})) {
            const m = out.models[id] || (out.models[id] = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            const t = mix(u);
            for (const k of Object.keys(t)) m[k] += t[k];
            m.usd += u.costUSD || 0;
            out.tokens += t.input + t.output + t.cacheRead + t.cacheWrite5m;
        }
    }
    return out;
}
```

4. Run it and see it pass: `node --test tests/summarise-cumulative.test.js`.
   Then re-run the fixed script on the real evidence and save its output over
   the stale `summary.json`:

```sh
node docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js docs/90-agent/reports/evidence/2026-09-25-controller-multiplier > docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summary.json
```

   Confirm the corrected file: `grep -n "\"usd\"" docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summary.json`
   should now show the opus arm at `6.36...` and the sonnet arm at `8.95...`
   (matching `k = 1.71`), not the old `11.4686`/`18.62...`.
5. Commit:

```sh
git add docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summary.json tests/summarise-cumulative.test.js
git commit -m "fix: evidence summarise.js no longer sums --resume's cumulative total_cost_usd across stages"
```

## Task 23: dated correction blocks on the two A/B reports

Design §8's second bullet: "報告寫出去以後就不再改內文" — the report body
stays exactly as it was written; only a dated block at the top, before the
existing opening paragraph, states the real figures. No test file: the check
is a grep for the block's absence before this task and its presence after,
plus `scripts/docs-check.js`.

**Files:**
- Modify: `docs/90-agent/reports/2026-09-25-controller-multiplier.md` — add a dated correction block after the H1 (lines 7-9)
- Modify: `docs/90-agent/reports/2026-09-28-ab-profile-pin.md` — add a dated correction block after the H1 (lines 7-9)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two short, fully-quoted markdown insertions with no code involved.

1. No test file — the check is the grep below, run once before editing and
   once after, plus `docs-check.js` at the end. Before editing, confirm
   neither block exists yet:

```sh
grep -n "更正 2026-09-28" docs/90-agent/reports/2026-09-25-controller-multiplier.md docs/90-agent/reports/2026-09-28-ab-profile-pin.md
```

   (exits 1, no match — this is the "red" this task turns "green").

2. In `docs/90-agent/reports/2026-09-25-controller-multiplier.md`, lines 7-9 currently read:

```markdown
# Sonnet 主控倍數 k 的第一次實測 — 2026-09-25

**這一輪只量了一個很小的 task——TODO 的 todo-check 行號那條，1 個 task、約 3 個檔——sonnet arm 只跑了一次（n=1），opus arm 因為第一次起跑失敗又重跑了一次（n=2）。所以下面每一個 `k` 都只代表這一個 task，不是任何母體的平均。它填的是 [投影頁 §4](2026-09-21-long-task-projection.md) 留空的那一格：破平衡點 `k = 2.5052`。**
```

   in `docs/90-agent/reports/2026-09-25-controller-multiplier.md`, insert a correction block between the H1 and that paragraph:

```markdown
# Sonnet 主控倍數 k 的第一次實測 — 2026-09-25

> **更正 2026-09-28：** §2 表格的「全部」與「design+plan+build（含 start）」兩列，以及「逐站花費」那一行，都是把 `--resume` 回傳的累計 `total_cost_usd` 逐站相加算出來的；`--resume` 給的本來就是累計到那一站為止的總花費，相加等於重複計入更早的站。真正的總花費是 verify 站自己的累計值（因為 verify 是最後一站，其累計值就是全程總花費）：opus $6.36、sonnet $8.95，k = 1.71。修法見 `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`。

**這一輪只量了一個很小的 task——TODO 的 todo-check 行號那條，1 個 task、約 3 個檔——sonnet arm 只跑了一次（n=1），opus arm 因為第一次起跑失敗又重跑了一次（n=2）。所以下面每一個 `k` 都只代表這一個 task，不是任何母體的平均。它填的是 [投影頁 §4](2026-09-21-long-task-projection.md) 留空的那一格：破平衡點 `k = 2.5052`。**
```

3. In `docs/90-agent/reports/2026-09-28-ab-profile-pin.md`, lines 7-9 currently read:

```markdown
# `ab.sh` profile-pin 重跑 — 2026-09-28

**這是 [2026-09-25 報告](2026-09-25-controller-multiplier.md) 的重跑，同一個 task、同一個起點 sha、同一條路線，opus controller 對 sonnet controller 各跑一次（n=1 per arm，不是任何母體的平均），`--max-budget-usd` 每個 arm 各 62.50。跟 09-25 唯一不同的地方是 `pin.sh` 這次把 `stage.agents` 的 override **commit** 進 worktree，而不是只寫進工作目錄——09-25 §7 診斷出那次 override 是未 commit 的檔案改動，中途被一次 `git stash ... drop` 連帶清掉，verify 站因此被誤判成受控站。這次的重點是確認那個修法有沒有守住整趟跑。**
```

   in `docs/90-agent/reports/2026-09-28-ab-profile-pin.md`, insert a correction block between the H1 and that paragraph:

```markdown
# `ab.sh` profile-pin 重跑 — 2026-09-28

> **更正 2026-09-28：** §4 的「四站合計（不含 start）」與「全部含 start（即 `summary.json` 頂層 k）」兩格，是把各站累計的 `total_cost_usd` 逐站相加算出來的，重複計入了更早的站。真正的總花費是 verify 站自己的累計值：opus $6.19、sonnet $8.60，k = 1.64。修法見 `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`（同一支腳本，這次的證據也用它重算）。

**這是 [2026-09-25 報告](2026-09-25-controller-multiplier.md) 的重跑，同一個 task、同一個起點 sha、同一條路線，opus controller 對 sonnet controller 各跑一次（n=1 per arm，不是任何母體的平均），`--max-budget-usd` 每個 arm 各 62.50。跟 09-25 唯一不同的地方是 `pin.sh` 這次把 `stage.agents` 的 override **commit** 進 worktree，而不是只寫進工作目錄——09-25 §7 診斷出那次 override 是未 commit 的檔案改動，中途被一次 `git stash ... drop` 連帶清掉，verify 站因此被誤判成受控站。這次的重點是確認那個修法有沒有守住整趟跑。**
```

4. Confirm the "green" side of the grep, then run `docs-check.js`:

```sh
grep -n "更正 2026-09-28" docs/90-agent/reports/2026-09-25-controller-multiplier.md docs/90-agent/reports/2026-09-28-ab-profile-pin.md
node scripts/docs-check.js
```

5. Commit:

```sh
git add docs/90-agent/reports/2026-09-25-controller-multiplier.md docs/90-agent/reports/2026-09-28-ab-profile-pin.md
git commit -m "docs: dated correction blocks on the 09-25 and 09-28 controller-multiplier reports"
```

## Task 24: correction lines on the two decision records

**Files:**
- Modify: `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md` — add a correction line after the one-sentence summary (near line 8)
- Modify: `docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md` — add a correction line after the line naming the wrong totals (near line 21)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two short, fully-quoted markdown insertions.

1. No test file — the check is the grep below, before and after, plus
   `docs-check.js`. Before editing:

```sh
grep -n "更正 2026-09-28" docs/03-decisions/2026-09-25-todo-line-and-multiplier.md docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md
```

   (exits 1, no match.)

2. In `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md`, line 8 and the blank line after it currently read:

```markdown
一句話：`todo-check.js` 現在會檢查行號。`path:N`／`path:N-M` 形式的引用，行號超過檔尾就回報 `past end`；行數用 `docs-check.js` 匯出的 `lineCount` 算，不另寫一份。主控倍數 k 第一次實測結果：可比的三站 k 落在 2.29–2.74，破平衡點 2.5052 正好在這個範圍裡，一對數據定不了輸贏。

design 見 [../archive/2026-09-25-todo-line-and-multiplier-design.md](../99-archive/2026-09-25-todo-line-and-multiplier-design.md)，計畫見 [../archive/2026-09-25-todo-line-and-multiplier.md](../99-archive/2026-09-25-todo-line-and-multiplier.md)，量測結果見 [../reports/2026-09-25-controller-multiplier.md](../90-agent/reports/2026-09-25-controller-multiplier.md)。
```

   in `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md`, insert a correction line between them:

```markdown
一句話：`todo-check.js` 現在會檢查行號。`path:N`／`path:N-M` 形式的引用，行號超過檔尾就回報 `past end`；行數用 `docs-check.js` 匯出的 `lineCount` 算，不另寫一份。主控倍數 k 第一次實測結果：可比的三站 k 落在 2.29–2.74，破平衡點 2.5052 正好在這個範圍裡，一對數據定不了輸贏。

**更正 2026-09-28：** 上面「一對數據定不了輸贏」引用的量測報告本身有計算錯誤：`docs/90-agent/reports/2026-09-25-controller-multiplier.md` 的「全部」k=2.125 是把各站累計的 `total_cost_usd` 逐站相加算出來的；真正的總花費是 verify 站自己的累計值，opus $6.36、sonnet $8.95，k = 1.71，見該報告開頭的更正區塊。

design 見 [../archive/2026-09-25-todo-line-and-multiplier-design.md](../99-archive/2026-09-25-todo-line-and-multiplier-design.md)，計畫見 [../archive/2026-09-25-todo-line-and-multiplier.md](../99-archive/2026-09-25-todo-line-and-multiplier.md)，量測結果見 [../reports/2026-09-25-controller-multiplier.md](../90-agent/reports/2026-09-25-controller-multiplier.md)。
```

3. In `docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md`, line 21 and the heading after it currently read:

```markdown
- ab.sh：opus arm $11.69、sonnet arm $18.02。design、plan、build 三站的 `k` 分別是 2.49、2.38、2.52，都在 09-25 的 2.29–2.74 之內；verify 的 `k = 1.6937`，低於破平衡點 2.5052；全部合計 2.0230。每個 arm 只跑一次（n=1）。

## 在哪裡回頭
```

   in `docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md`, insert a correction line between them:

```markdown
- ab.sh：opus arm $11.69、sonnet arm $18.02。design、plan、build 三站的 `k` 分別是 2.49、2.38、2.52，都在 09-25 的 2.29–2.74 之內；verify 的 `k = 1.6937`，低於破平衡點 2.5052；全部合計 2.0230。每個 arm 只跑一次（n=1）。

**更正 2026-09-28：** 上一行的「opus arm $11.69、sonnet arm $18.02」與「全部合計 2.0230」都是把各站累計的 `total_cost_usd` 逐站相加算出來的計算錯誤；真正的總花費是 verify 站自己的累計值，opus $6.19、sonnet $8.60，k = 1.64，一樣低於破平衡點 2.5052，見 [報告](../90-agent/reports/2026-09-28-ab-profile-pin.md) 開頭的更正區塊。

## 在哪裡回頭
```

4. Confirm the "green" side, then run `docs-check.js`:

```sh
grep -n "更正 2026-09-28" docs/03-decisions/2026-09-25-todo-line-and-multiplier.md docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md
node scripts/docs-check.js
```

5. Commit:

```sh
git add docs/03-decisions/2026-09-25-todo-line-and-multiplier.md docs/03-decisions/2026-09-28-guard-seen-ab-rerun.md
git commit -m "docs: correction lines on the two 09-25/09-28 controller-multiplier decision records"
```

## Task 25: correct the k figures in `sources.md` and `docs/README.md`

Unlike the reports and decisions above, `docs/90-agent/reference/sources.md`
and `docs/README.md` are continuously-maintained reference pages — design
§8's third bullet says to change these two straight to the right numbers, not
add a dated block beside the wrong one. Every quoted before/after pair below
is plain text, not code, so it is fenced without a language tag.

**Files:**
- Modify: `docs/90-agent/reference/sources.md` — replace the two rows' wrong aggregate figures with the corrected totals (rows near lines 70-71)
- Modify: `docs/README.md` — same, in the three summary rows that cite them (near lines 152, 247, 253)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — four short, fully-quoted single-line substring replacements.

1. No test file — the check is the grep below, before and after, plus
   `docs-check.js`. Before editing, confirm the wrong figures are there:

```sh
grep -n "頂層 k）2.0230，\`kTokens\`" docs/90-agent/reference/sources.md
grep -n "2.0230，低於破平衡點" docs/README.md
```

   (both match.)

2. In `docs/90-agent/reference/sources.md` row 70 (`CONTROLLER-MULTIPLIER-260925`), the sentence:

```
所以「全部」那個 k=2.125 不是站得住的標題數字。
```

   becomes:

```
所以「全部」那個 k=2.125 不是站得住的標題數字，而且那一格本身也算錯：真正的總花費（verify 站自己的累計值）是 opus $6.36、sonnet $8.95，k = 1.71。
```

3. In the same file's row 71 (`AB-PROFILE-PIN-260928`), the substring:

```
四站合計（不含 start）2.0252、全部含 start（即 `summary.json` 頂層 k）2.0230，`kTokens` 2.3216；
```

   becomes:

```
四站合計（不含 start）2.0252、全部含 start（即 `summary.json` 頂層 k）本來誤算成 2.0230，修正後（不把各站累計值相加，只取 verify 站自己的累計值）是 opus $6.19、sonnet $8.60，k = 1.64；`kTokens` 2.3216；
```

4. In `docs/README.md` line 152, the row's tail:

```
verify 站因 harness 的 `git stash` 清掉 override 而不可比，修法另開 task
```

   becomes:

```
verify 站因 harness 的 `git stash` 清掉 override 而不可比，修法另開 task；真正的總花費（verify 站自己的累計值）是 opus $6.36、sonnet $8.95，k = 1.71
```

5. In `docs/README.md` line 247, the row's tail:

```
sonnet 的 verify 自己派了站 agent 沒跑完，不列入
```

   becomes:

```
sonnet 的 verify 自己派了站 agent 沒跑完；真正的總花費（verify 站自己的累計值）是 opus $6.36、sonnet $8.95，k = 1.71
```

6. In `docs/README.md` line 253, the row's tail:

```
但 verify 這次測到 `k=1.69`，把含 start 的總覽數字拉到 2.0230，低於破平衡點 2.5052
```

   becomes:

```
但 verify 這次測到 `k=1.69`；真正的總花費（verify 站自己的累計值）是 opus $6.19、sonnet $8.60，k = 1.64，一樣低於破平衡點 2.5052
```

7. Confirm the "green" side, then run `docs-check.js`:

```sh
grep -n "k = 1.71" docs/90-agent/reference/sources.md
grep -n "k = 1.64" docs/README.md
node scripts/docs-check.js
```

8. Commit:

```sh
git add docs/90-agent/reference/sources.md docs/README.md
git commit -m "docs: correct the cumulative-cost k figures in sources.md and docs/README.md"
```

## Task 26: close the two Blocked entries, add the Watch entry, describe the new shape in `subagents.md`

Last task of this part — the whole plan's shape is what it describes.
Consumes every other part's produced names, since it is the one place that
says the feature landed.

**Files:**
- Modify: `docs/90-agent/reference/subagents.md` — the "task's context.md" section's last paragraph, plus two short new paragraphs on group brains and the budget hook (near lines 673-683)
- Modify: `TODO.md` — remove the two Blocked entries this whole task closed, add one Watch entry (near lines 82-181)
- Read: `docs/90-agent/reports/2026-09-26-context-md.md` — cited by the paragraph of `subagents.md` being replaced; not itself touched
- Read: `.fankeel/build/2026-09-27-five-items/flake.txt` — cited by the untouched Watch entry quoted below for anchoring; not itself touched

**Interfaces:**
- Consumes: `SOFT`, `HARD`, `relayPath(root, data, agentId)`, `prefix(root, planOpt, group)`, `renderBrief`, `renderBrainBrief` (Part C); `markInflight(root, sessionId, stage, agentId, lap, group)`, `clearInflight(root, sessionId, agentId)`, `inflights(data)`, `handoffPath(root, data, stage, group)`, `commitPath(root, data, stage, group)` (Part A); `READ_CAP`, `FILE_CAP`, `readSize(root, task)` (Part B); `peak`, `requests` (this part, Task 20/21)
- Produces: none

**Dispatch:** implementer, sonnet — a doc rewrite and a TODO edit, both fully quoted, no code.

1. No test file — the checks are `node scripts/todo-check.js` and
   `node scripts/docs-check.js`, run after editing. Before editing, confirm
   the two entries are still there:

```sh
grep -n "brain 的 context 撐不住\|交接後 context 仍過 400k" TODO.md
```

   (both match.)

2. In `docs/90-agent/reference/subagents.md`, the section at :673-683 currently reads:

```markdown
### The task's context.md

`.fankeel/build/task-<started>/context.md` (`contextPath` in `lib/handoff.js`)
holds what a subagent verified, one fact a line: the fact, `path:line`, and the
short sha it was read at. `scripts/context.js add "<fact>" --at <path:line>
--session <id>` is the only writer — any subagent may call it — and keeps the
newest 40, dropping an exact duplicate and replacing a fact read again at a
new sha. `context.js show` marks a line whose sha is not HEAD `(舊)`. The
ordinary brief names the file's path and never its contents, where the
`reads:` block above is copied inline; whether that saves anything is
measured, not assumed — `docs/90-agent/reports/2026-09-26-context-md.md`.
```

   in `docs/90-agent/reference/subagents.md`, replace it with:

```markdown
### The task's context.md

`.fankeel/build/task-<started>/context.md` (`contextPath` in `lib/handoff.js`)
holds what a subagent verified, one fact a line: the fact, `path:line`, and the
short sha it was read at. `scripts/context.js add "<fact>" --at <path:line>
--session <id>` is the only writer — any subagent may call it — and keeps the
newest 40, dropping an exact duplicate and replacing a fact read again at a
new sha. `context.js show` marks a line whose sha is not HEAD `(舊)`. The
ordinary brief inlines the file's content — `renderBrief` and `renderBrainBrief`
in `lib/render.js` paste it in whole rather than naming its path — so a
subagent no longer has to `Read` the file itself before using what it holds.

Build now dispatches one `fankeel:fankeel-brain` per disjoint `ledger.js
groups` group, in parallel, each ending with its own group rather than one
brain working every task in turn; `markInflight`/`clearInflight` in
`lib/registry.js` key each entry by `agentId` so more than one can be in
flight under the same session at once, and the handoff and commit files each
group writes carry that group's number so two brains never write the same
one.

A subagent-only budget hook nudges an implementer at `SOFT` tokens of its own
context (read from its own transcript) to write a relay file under
`.fankeel/build/` and hand off, and refuses every tool but that write once it
reaches `HARD` — the brain that receives a relay path dispatches a fresh
agent with the shared prefix (`ledger.js brief --group <N> --prefix`) plus
that relay file, rather than letting one agent's own context run past either
line. A plan's task size is capped the same way, at read: `lint()` refuses a
task whose declared `Modify:` files add up past `READ_CAP` lines or that name
more than `FILE_CAP` of them.
```

3. In `TODO.md`, the Blocked section at lines 98-107 currently reads:

```markdown
### 交接後 context 仍過 400k
after: 交接選項（簡報 §6.2）實施後 context 仍常過 400k. 09-26.

- 〔session〕極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位 — [scripts/station.js](scripts/station.js).

### brain 的 context 撐不住
after: `scripts/ctx.js` 量到 build 或 verify 的站 agent 自己的 context 過 400k（`lib/context.js` 的線）. 09-26.

- 〔stage-agents〕站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了 — [lib/plantasks.js](lib/plantasks.js).

```

   Delete it entirely. The blank line before it, and the `### 受控
   build/verify 實跑` heading after it, are both untouched, so this leaves
   exactly one blank line between neighbours, matching the rest of the file.

   In `TODO.md`, the replacement is empty:

```markdown
```

4. At the end of `TODO.md`'s `## Watch` section, the last entry currently reads:

```markdown
### wizard-motion 再紅一次
if: `the chosen card animates, and under reduced motion nothing is running` 在整套裡再紅一次. 09-27.

- 〔tests〕09-27 四次整套紅兩次（2072/2073）、單跑 3/3 綠；之後整套 10 次全綠，沒抓到失敗訊息，紀錄在 `.fankeel/build/2026-09-27-five-items/flake.txt` — [tests/station-wizard-motion.test.js](tests/station-wizard-motion.test.js).
```

   in `TODO.md`, append one new entry after it:

```markdown
### wizard-motion 再紅一次
if: `the chosen card animates, and under reduced motion nothing is running` 在整套裡再紅一次. 09-27.

- 〔tests〕09-27 四次整套紅兩次（2072/2073）、單跑 3/3 綠；之後整套 10 次全綠，沒抓到失敗訊息，紀錄在 `.fankeel/build/2026-09-27-five-items/flake.txt` — [tests/station-wizard-motion.test.js](tests/station-wizard-motion.test.js).

### build 五個 task 以上
if: 下一次有 5 個以上 task 的 build 開跑. 09-28.

- 〔station〕看第 7 段加的 station 欄位：沒有任何 subagent 的 context 峰值超過 250k（基準 f44b1c61 的 544k）、最貴的單一 subagent 佔 subagent 總花費低於 15%（基準 31%） — [docs/90-agent/reference/station.md](docs/90-agent/reference/station.md).
```

5. Confirm the two Blocked entries are gone and the new Watch entry is there, then run both checkers:

```sh
grep -n "brain 的 context 撐不住\|交接後 context 仍過 400k" TODO.md
grep -n "build 五個 task 以上" TODO.md
node scripts/todo-check.js
node scripts/docs-check.js
```

   The first grep should now exit 1 (no match); the second should match.
6. Commit:

```sh
git add docs/90-agent/reference/subagents.md TODO.md
git commit -m "docs: close the context-budget Blocked entries; describe group brains, budget hook and read cap in subagents.md"
```

## Coverage

| promise | task |
|---|---|
| PostToolUse 的 `additionalContext` 能不能送進 subagent 自己的模型，目前沒有紀錄。 | Task 1 |
| SubagentStart 注入的 brief 和 Agent 的 `prompt` 誰在前面，目前也不知道。 | Task 1 |
| 新增 `hooks/budget.js`，登記在 `.claude-plugin/plugin.json` 的 PreToolUse 和 PostToolUse。payload 沒有 `agent_id` 就立刻返回，主 session 完全不受影響。 | Task 4 |
| 它讀取這個 subagent 自己的逐字紀錄，並用 `lib/context.js` 的 `inspect()` 只讀檔案最後 512KB。 | Task 4 |
| context 達到 `SOFT = 150000` 時，PostToolUse 每一次都注入：「做完這一步，把進度寫進 `.fankeel/build/<task>/relay-<agentId>.md`，然後回報那個路徑。」 | Task 4 |
| context 達到 `HARD = 250000` 時，PreToolUse 拒絕所有工具呼叫，只有寫入 `.fankeel/build/` 底下檔案的 Write 和 Edit 例外；拒絕理由寫明交接檔的路徑。 | Task 4 |
| brain 收到一個 relay 路徑，就派一個新的 agent，prompt 只寫共用前綴（第 4 段）加上那個 relay 檔。`SOFT` 和 `HARD` 由 `lib/context.js` 匯出，放在 `BUSY` 旁邊。 | `SOFT`/`HARD` export: Task 2; `relayPath`: Task 3 (consumed by Task 4); the brain's own dispatch-on-relay behaviour: Task 19. |
| `scripts/ledger.js brief` 新增 `--group <N> --prefix` 輸出，依序包含：`context.md` 的全文、這個 group 各 task 的 `Files`／`Consumes`／`Produces`，以及固定的 implementer 規則。輸出的字元只取決於檔案內容，不含時間或 agent id。 | Task 5 |
| brain 把這段輸出原封不動放在每一個 implementer prompt 的開頭，個別 task 的內容放在最後。同一個 group 裡可以同時開工的 implementer 在同一次回應裡一起派出，讓 5 分鐘的快取還沒過期時就能共用。 | Task 19 |
| `lib/render.js:600-602` 不再只列 `context.md` 的路徑，改成直接貼上內容，這樣 brain 和 reader 就不必自己 `Read` 這個檔。 | Task 6 |
| survey 和 plan 派出的 reader，brief 裡的回傳規定加一條：每查到一項以後還會用到的事實，就用 `scripts/context.js add` 寫一行。 | Task 7 |
| 離開 survey 和離開 plan 時，如果 `context.md` 裡一條事實都沒有，`task.js stage` 會印一行警告，不會擋下。 | Task 7 |
| `lib/plantasks.js` 的 `lint()` 新增讀取量檢查：把每個 task 的 `**Files:**` 裡 `Modify:` 檔案的行數加起來。寫成 `path:a-b` 的只算 b−a+1 行；`Create:` 不計入，因為新建檔沒有既有內容要讀。 | Task 8, Task 10 |
| 讀取量超過 `READ_CAP = 1500` 行，或 `Modify:` 超過 `FILE_CAP = 3` 個，就列為 lint finding；這條跟既有的三項檢查一樣會擋下 plan gate。兩個常數由 `lib/plantasks.js` 匯出。 | Task 8, Task 10 |
| `skills/fankeel-plan/SKILL.md` 的 task 範本說明大檔（例如 5095 行的 `assets/station/station.js`）必須寫出行號範圍；寫不出範圍，就代表 task 要拆開。 | Task 12 |
| plan 的 `**Dispatch:**` 行允許寫 `implementer, haiku`，但只限讀取量不超過 `READ_CAP / 2`，而且每一步都附有完整程式碼或逐字替換內容的 task；lint 會檢查這兩個條件，不符合就列為 finding。 | Task 11, Task 12 |
| `dispatch.floor` 本身不改。允許 haiku 的判斷在 `lib/profile.js` 和 `lib/stages.js` 的 floor 檢查處，只有 lint 通過的 task 才能用。brain、reviewer 和 verifier 的 agent 檔維持 sonnet。 | Task 11 — verified: neither file enforces a tier programmatically (both only interpolate `dispatch.floor`'s value into prompt text), so `lint()`'s two conditions are the only gate; no change needed there. |
| controller 從 `ledger.js groups` 取得目前可以開工的 group,互不共用檔案的 group 在同一次回應裡一起派出,每個 group 一個 `fankeel:fankeel-brain`,brief 寫明它負責的 task 編號 | 18 |
| 一個 brain 負責的 task 在 `progress.md` 裡都標成 `complete` 以後,這個 brain 就回報並結束。下一個 group 一律開新的 brain,從 ledger 接著做 | 15, 19 |
| 同一個 session 可以同時有好幾個 `inflight` 標記:`lib/registry.js:784-802` 的 `markInflight` 改成以 `agentId` 為鍵的清單,每筆帶 `group` 欄位;`clearInflight` 的作用範圍不變,`hooks/gate.js:227` 對它的呼叫仍是兩個參數,一次清掉整個 session 的所有標記 | 13, 16 |
| 交接檔和 commit 檔的名稱加上 group:`lib/handoff.js:51-64` 產生 `build-g<N>.md` 和對應的 commit 檔,兩個 brain 不會寫到同一個檔 | 14 |
| `scripts/await.js:85-100` 每有一個 brain 完成就回一行,並寫明是哪個 group、哪個 agent。controller 把每個 brain 的 commit 請求分開處理,用 SendMessage 回給那一個 brain | 17 |
| stage 的 gate 只問一次:所有 group 都完成以後,controller 再派一個收尾 brain（prompt 寫 `build close`）,由它跑完整測試,寫出 `build.md` 和 gate | 15, 18, 19 |
| `lib/stages.js:638-661` 的 controller 規則、`lib/render.js:490-565` 的 `renderBrainBrief`、`agents/fankeel-brain.md:70-89` 和 `skills/fankeel-build/SKILL.md` 改成以 group 為單位描述。不做 brain 底下再開 brain | 15, 18, 19 |
| `lib/station.js` 的 `gather()`（:352，:420-421）改為對每個 subagent 呼叫 `lib/usage.js:80` 的 `summarise(path, {series:true})`，由此得到 `requests` 和 `peak`… | Task 20 |
| `assets/station/station.js:3739-3745` 的派工表在 USD 後面加兩欄：「context 峰值」和「請求數」。表尾把請求數加總，圖的 `metric` 也多這兩個選項… | Task 21 |
| `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js:30-31` 把各站的 `+=` 改成只取最後一站的 `total_cost_usd`… | Task 22 |
| 報告寫出去以後就不再改內文，所以 `docs/90-agent/reports/2026-09-25-controller-multiplier.md` 和 `2026-09-28-ab-profile-pin.md` 只在開頭加一個有日期的「更正」區塊… | Task 23 |
| `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md:8` 和 `2026-09-28-guard-seen-ab-rerun.md:21` 各加一行更正… | Task 24 |
| （同一句的後半）`docs/90-agent/reference/sources.md:70-71` 和 `docs/README.md:152,247,253` 是會持續維護的文件，直接改成正確的數字 | Task 25 |
| `TODO.md` Blocked 底下的「brain 的 context 撐不住」和「交接後 context 仍過 400k」由這個 task 處理完，最後一個 task 把這兩條移除。另外在 Watch 新增一條… | Task 26 |
