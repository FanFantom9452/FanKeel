---
status: design-intent
---

# spawnDepth 讀法與 implementer worktree Implementation Plan

**Goal:** 量清楚 `nestedBrain()` 能不能在 hook 內等到 meta 檔再決定要不要改讀法；並讓 build 的 implementer 各在自己的 worktree 裡改，由 `scripts/commit.js` 把每個 worktree 的提交 cherry-pick 回主 repo。
**Architecture:** 兩組彼此獨立的 task。第一組（Task 3–4）先用一次 headless 重量決定 `hooks/brief.js` 改或不改。第二組先做 design「還沒驗的」那一次探測（Task 1–2），再做兩個不依賴探測結果的程式改動（Task 5 `commit.js` 的 `worktree` block、Task 6 `ready` 的 `{ worktree: true }`），最後才依探測結果改寫 brain 的規則與文件（Task 7–8）。
**Tech Stack:** Node（無第三方依賴，`package.json` 只有 `node --test`）、git 2.44.0.windows.1（本機）、Claude Code headless `claude -p`、Git Bash `sh`。
**Spec:** [2026-09-28-spawndepth-worktree-design.md](2026-09-28-spawndepth-worktree-design.md)

## Global Constraints

來源：`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`，這份就是慣例頁）、`.fankeel/map.md`、`package.json`、測試。

- `package.json`：`"test": "node --test"`，沒有 `dependencies`；不得新增依賴。版本 `0.80.0`，版本號只能用 `scripts/version.js` 動，不手改（`CONTRIBUTING.md` Version numbers 列）。
- `CONTRIBUTING.md`：`lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`。`scripts/*.js` 是 `lib/` 上的薄殼。`hooks/*.js` 每一條路徑都 exit 0。
- `CONTRIBUTING.md` Documentation 列：新頁面在同一個改動裡加 `docs/README.md` 的索引列。`tests/sources-doc.test.js:13`：`docs/90-agent/reports/` 下每一份頂層報告在 `docs/90-agent/reference/sources.md` 恰好一列；`:61`：每一頁引用某報告的 docs 頁都要列在那一列的 Cited by。
- `CONTRIBUTING.md` Tests 列：新檔要先 `git add`，`tests/source.test.js` 才看得到。
- 縮排照檔案自己的：`lib/`、`scripts/`、`hooks/`、`tests/commit.test.js` 四格；`tests/brief.test.js`、`tests/plantasks.test.js`、`tests/ledger.test.js` 兩格。
- `lib/plantasks.js:337-338`：`READ_CAP` 1500、`FILE_CAP` 3，本計畫每個 task 的 `Modify:` 都在這兩條之下（超過的用 `path:a-b` 範圍）。
- `tests/brief.test.js:450`：build brain 的 brief `< 10000` 字（本 checkout 量到 7527）。
- `tests/render.test.js:528`：每個 stage 的主 session 注入 `< 2400` 字，`build` 的 `rules`（`lib/stages.js:302-310`）不動。
- `tests/stages.test.js:675` 逐字斷言 build 規則 `Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, commit shape.`——不動。
- `tests/brief.test.js:413,416,654` 逐字斷言 `lib/render.js:521` 那一行 commit 規則——不改那一行，另外加一行。`tests/brief.test.js:395` 斷言 build 的派遣清單以 `` `fankeel:fankeel-fixer` or an implementer `` 收尾。
- `tests/brief.test.js:658-660` 斷言 `agents/fankeel-brain.md` 的 Job 段有 `on build each time none of the implementers you sent is\s+still running, one block per task that returned since the last one, never per\s+task` 和字面 `` `ledger.js ready` ``；`tests/brief.test.js:437-442` 與 `tests/agents.test.js:139-175,346-360` 斷言 Tools／Refusals／Return 的字句——那些句子原樣保留。
- `.claude-plugin/plugin.json:77`：`SubagentStart` hook 的 `timeout` 是 5 秒。
- `hooks/gate.js:100-125`：hook 裡同步等待的既有寫法是 `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)`，因為 `run(main)` 不 await。
- 證據目錄（`docs/90-agent/reports/evidence/`，filing 是 fixture）裡的 `provenance.txt` 要寫 HEAD、`git status --porcelain`、`claude --version`、腳本 md5；`summary.json` 只由腳本寫，不手改。
- 報告頁用繁體中文；`skills/`、`agents/`、`docs/90-agent/reference/` 頁與程式註解維持英文。
- 提交：`type(scope): subject`，受控 build 由 brain 寫 commit file、controller 跑 `scripts/commit.js`；implementer 不提交。只在本機提交，不 push。

## Task 1: worktree 探測——brain 讀不讀得到 Agent 回傳的 worktree 路徑

design「還沒驗的」：Agent 工具在 brain 這一層（depth 1 的 subagent）帶 `isolation: "worktree"` 時，回傳給模型的那段文字裡有沒有 worktree 路徑和分支。探測在一個暫存 git repo 裡跑，不在 fankeel 裡開 worktree。

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/run.sh` — 新檔：一次 headless run，寫出 `agents.json`、`provenance.txt`、`claude-out.json`、`claude-err.txt`、`worktree-list.txt`、`summary.json`
- Modify: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/extract.js` — 新檔：讀 outer agent 的 transcript，判定 `readable`
- Modify: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/summary.json` — 由 `run.sh` 寫，不手改
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh` — 照它的 `--agents`／`--setting-sources project`／provenance 形狀

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/summary.json` — `{ sid, transcripts, calls: [{ file, input, resultText, structured }], worktrees: [{ path, branch }], pathInResult, branchInResult, readable }`，`readable` 是 `"yes"`、`"no"` 或 `"inconclusive"`

**Dispatch:** implementer, sonnet — 兩支腳本都寫在這裡；跑的是一次 haiku headless session。

- [ ] **Step 1: 寫 run.sh。** 建立 `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/run.sh`：

```sh
#!/usr/bin/env sh
# Does a subagent that calls Agent with isolation "worktree" get the worktree's
# path and branch back in the text it reads? See ../../2026-09-28-worktree-probe.md.
# Runs in a throwaway repository so no worktree is opened inside fankeel.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-worktree-probe"
SID="5e1f0c2a-9d3b-4c6e-8a71-2b4f6d8e0a13"
PROBE="$(mktemp -d)"

cd "$PROBE" || exit 1
git init -q
git config user.email probe@example.invalid
git config user.name probe
echo probe > README.md
git add README.md
git commit -qm base

cat > "$OUT/agents.json" <<'JSON'
{
  "outer": {
    "description": "Dispatches one inner agent in a worktree and relays the tool result verbatim.",
    "prompt": "Use the Agent tool exactly once: subagent_type \"inner\", isolation \"worktree\", prompt \"go\". Then reply with the full text of that tool result, verbatim, and nothing else.",
    "tools": ["Agent"],
    "model": "haiku"
  },
  "inner": {
    "description": "Writes one file in its working directory and replies done.",
    "prompt": "Run exactly this one Bash command and nothing else: echo probe > probe.txt. Then reply with the single word done.",
    "tools": ["Bash"],
    "model": "haiku"
  }
}
JSON

PROMPT='Use the Agent tool exactly once, subagent_type "outer", prompt "go". Then reply with exactly what it returned.'

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git -C "$REPO" rev-parse HEAD)"
  echo "porcelain:"; git -C "$REPO" status --porcelain
  echo "claude: $(claude --version)"
  echo "run.sh md5: $(md5sum "$OUT/run.sh" | cut -d' ' -f1)"
  echo "extract.js md5: $(md5sum "$OUT/extract.js" | cut -d' ' -f1)"
  echo "session: $SID"
  echo "probe repo: $PROBE"
} > "$OUT/provenance.txt"

claude -p "$PROMPT" \
  --session-id "$SID" \
  --output-format json \
  --model haiku \
  --agents "$OUT/agents.json" \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit" \
  < /dev/null > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

echo "claude exit $?" >> "$OUT/provenance.txt"
git -C "$PROBE" worktree list --porcelain > "$OUT/worktree-list.txt"
node "$OUT/extract.js" "$SID" "$OUT/worktree-list.txt" > "$OUT/summary.json"
cat "$OUT/summary.json" >> "$OUT/provenance.txt"
cd "$REPO" && rm -rf "$PROBE"
```

- [ ] **Step 2: 寫 extract.js。** 建立 `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/extract.js`：

```js
#!/usr/bin/env node
'use strict';
// After run.sh: reads the outer agent's own transcript and says whether the
// result of its Agent call with isolation "worktree" — the text the model
// reads — names the worktree that call left behind.
// Usage: node extract.js <session id> <worktree-list.txt>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [sid, listFile] = process.argv.slice(2);
const config = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const projects = path.join(config, 'projects');

// One level of project directories, never a recursive walk.
const transcripts = [];
for (const slug of fs.readdirSync(projects)) {
    const sub = path.join(projects, slug, sid, 'subagents');
    let names = [];
    try { names = fs.readdirSync(sub); } catch (e) { continue; }
    for (const n of names) if (/^agent-.*\.jsonl$/.test(n)) transcripts.push(path.join(sub, n));
}

const textOf = (content) => (typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((c) => (c && c.type === 'text' ? c.text : '')).join('\n') : '');

const calls = [];
for (const file of transcripts) {
    const uses = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
        let row;
        try { row = JSON.parse(line); } catch (e) { continue; }
        const content = row.message && Array.isArray(row.message.content) ? row.message.content : [];
        for (const c of content) {
            if (c.type === 'tool_use' && (c.name === 'Agent' || c.name === 'Task')) uses.set(c.id, { file: path.basename(file), input: c.input });
            if (c.type === 'tool_result' && uses.has(c.tool_use_id)) {
                calls.push(Object.assign({}, uses.get(c.tool_use_id), {
                    resultText: textOf(c.content),
                    structured: row.toolUseResult === undefined ? null : row.toolUseResult,
                }));
            }
        }
    }
}

// `git worktree list --porcelain`: blank-line separated; the first is the main tree.
const worktrees = fs.readFileSync(listFile, 'utf8').split(/\r?\n\r?\n/).map((b) => {
    const wt = /^worktree (.+)$/m.exec(b);
    const br = /^branch refs\/heads\/(.+)$/m.exec(b);
    return wt ? { path: wt[1].trim(), branch: br ? br[1].trim() : null } : null;
}).filter(Boolean).slice(1);

// What the model reads is `resultText`; `structured` is recorded but does not decide.
const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();
const isolated = calls.filter((c) => c.input && c.input.isolation === 'worktree');
const seen = (pick) => isolated.some((c) => worktrees.some((w) => pick(w) && norm(c.resultText).includes(norm(pick(w)))));
const pathInResult = seen((w) => w.path);
const branchInResult = seen((w) => w.branch);
const readable = !isolated.length || !worktrees.length ? 'inconclusive' : (pathInResult ? 'yes' : 'no');
process.stdout.write(JSON.stringify({ sid, transcripts: transcripts.map((f) => path.basename(f)), calls, worktrees, pathInResult, branchInResult, readable }, null, 2) + '\n');
```

- [ ] **Step 3: 跑。** `sh docs/90-agent/reports/evidence/2026-09-28-worktree-probe/run.sh`。`summary.json` 的 `calls` 至少一筆 `input.isolation` 是 `"worktree"`。`readable` 是 `"inconclusive"` 時：`worktrees` 空，表示 inner 沒改到東西、worktree 被自動清掉——把 inner 的指令改成 `echo probe > probe.txt && git add probe.txt && git commit -qm probe` 再跑；`calls` 空，表示 outer 沒派——讀 `claude-err.txt`、`claude-out.json` 修 `run.sh`。最多跑三次，每次改了什麼、為什麼，寫在回報裡。`summary.json`、`worktree-list.txt` 不手改。
- [ ] **Step 4: 回報** `readable`、`pathInResult`、`branchInResult`、`worktrees[0].path`（worktree 開在哪個目錄底下）與 `provenance.txt` 的 HEAD。
- [ ] **Step 5: Commit** — 路徑：這個目錄下 `run.sh`、`extract.js`、`agents.json`、`provenance.txt`、`claude-out.json`、`claude-err.txt`、`worktree-list.txt`、`summary.json`；訊息 `docs(evidence): worktree isolation probe for a brain-level Agent call`。

## Task 2: worktree 探測報告

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-worktree-probe.md` — 新報告頁
- Modify: `docs/README.md` — 報告索引加一列，放在 `2026-09-28-spawndepth-timing.md` 那列之後
- Modify: `docs/90-agent/reference/sources.md` — 加 `WORKTREE-PROBE-260928` 一列，放在 `SPAWNDEPTH-TIMING-260928` 之後
- Read: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/summary.json` — 本頁每個數字的來源
- Read: `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` — 同日報告的格式

**Interfaces:**
- Consumes: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/summary.json`
- Produces: `docs/90-agent/reports/2026-09-28-worktree-probe.md` — 結論節裡恰好一行 `readable: yes` 或 `readable: no`，Task 7、8 照它分支

**Dispatch:** implementer, sonnet — 頁面的每一節和兩個索引列都寫在這裡，數字從 `summary.json` 抄。

- [ ] **Step 1: 寫報告頁。** 建立 `docs/90-agent/reports/2026-09-28-worktree-probe.md`，照下面的骨架，角括號裡的值從 `summary.json` 與 `provenance.txt` 逐字抄：

```md
---
status: current
last_verified: 2026-09-28
source_of_truth: `docs/90-agent/reports/evidence/2026-09-28-worktree-probe/` 下的 `summary.json`、`provenance.txt`、`worktree-list.txt`、`claude-out.json`；`run.sh` 與 `extract.js` 的 md5 記在 `provenance.txt`
---

## 問題

`docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md` 的「還沒驗的」：Agent 工具在 brain 這一層（depth 1 的 subagent）帶 `isolation: "worktree"` 時，回傳給模型的文字裡有沒有 worktree 的路徑和分支。

## 怎麼量

一次 headless `claude -p`（session `<sid>`），在暫存 git repo 裡派 `outer`，`outer` 再帶 `isolation: "worktree"` 派 `inner`，`inner` 在自己的工作目錄寫一個檔。跑完用 `git worktree list --porcelain` 讀出留下的 worktree，再由 `extract.js` 比對 `outer` transcript 裡那次 Agent 呼叫的 `tool_result` 文字。HEAD `<provenance 的 HEAD>`，`run.sh` md5 `<…>`，`extract.js` md5 `<…>`，`claude <版本>`，`claude exit <n>`。

## 結果

| 欄位 | 值 |
| --- | --- |
| isolation 呼叫數 | <calls 裡 input.isolation 為 worktree 的筆數> |
| 留下的 worktree | `<worktrees[0].path>`（分支 `<worktrees[0].branch>`） |
| pathInResult | <true/false> |
| branchInResult | <true/false> |

回傳文字（`resultText`，逐字）：

<resultText 原文，放在縮排四格的區塊裡>

## 結論

readable: <yes 或 no>

<一段：yes 時說 brain 可以直接把回傳的路徑寫進 commit file 的 `worktree <path>`；no 時說 design 的退路（`task.js` 的 `openWorktree`）要一個 brain 能跑的開 worktree 指令，design 沒定，Task 7、8 停下回 design。另寫 worktree 開在哪個目錄底下；在 repo 根目錄之內時，touch 記下的 claims 會是 worktree 底下的路徑，`lib/guard.js` 的 `relPath` 不會把它對回主樹。只跑了一次。>
```

- [ ] **Step 2: 加索引列。** 在 `docs/README.md` 的 `[reports/2026-09-28-spawndepth-timing.md]` 那列之後加一列，形狀照上一列：第一格一句話說量到什麼（含 `readable` 的值），第二格 `[reports/2026-09-28-worktree-probe.md](90-agent/reports/2026-09-28-worktree-probe.md) — *a dated snapshot, 繁體中文*`。
- [ ] **Step 3: 加 sources 列。** 在 `docs/90-agent/reference/sources.md` 的 `SPAWNDEPTH-TIMING-260928` 列之後加 `WORKTREE-PROBE-260928` 一列，七欄照鄰列：問題、`[reports/2026-09-28-worktree-probe.md](../reports/2026-09-28-worktree-probe.md)`、`2026-09-28`、`measured, n=1 run — …`、headline（`readable` 與兩個布林值）、Cited by `` `docs/README.md` ``。
- [ ] **Step 4: 跑** `node --test tests/sources-doc.test.js` 與 `node scripts/docs-check.js`，兩個都要綠。
- [ ] **Step 5: Commit** — 路徑三個 Modify 檔；訊息 `docs(reports): worktree isolation probe`。

## Task 3: spawnDepth 重量——hook 內輪詢

design 要「把 `record.js` 改成 hook 內每 20 ms 重讀一次」。這裡照做，但放在新的兄弟目錄 `2026-09-28-spawndepth-poll/`：直接改原目錄會蓋掉 `hook-log.jsonl`、`summary.json`、`provenance.txt`，現有報告引用的 md5 就對不上了。

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/record.js` — 新檔：輪詢版 hook 與 `after` 一趟
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/run.sh` — 新檔：與原 `run.sh` 相同，只有 `OUT` 與說明不同
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/summary.json` — 由 `run.sh` 寫，不手改
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/record.js` — 原版，`statOf`／`metaFileOf` 照抄
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh` — 原版

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/summary.json` — 陣列，每列 `{ agent_id, agent_type, firstSeenMs, depthAtFirstSeen, polls, waitedMs, existsAfter, depthAfter, parentAfter, mtimeMinusHookMs, mtimeMinusReturnMs }`

**Dispatch:** implementer, sonnet — 腳本寫在這裡；跑的是一次 haiku headless session。

- [ ] **Step 1: 寫 record.js。** 建立 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/record.js`：

```js
#!/usr/bin/env node
'use strict';
// SubagentStart probe, second run: the hook itself waits for
// subagents/agent-<id>.meta.json, re-reading every STEP_MS for at most WAIT_MS,
// so the question is whether Claude Code writes the file while a hook is still
// running. `node record.js after` re-reads every file once the run is over.
const fs = require('node:fs');
const path = require('node:path');
const { sessionDirOf } = require('../../../../../lib/usage.js');

const LOG = path.join(__dirname, 'hook-log.jsonl');
const STEP_MS = 20;
const WAIT_MS = 500;

function metaFileOf(payload) {
    const dir = sessionDirOf(payload.transcript_path);
    return dir ? path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.meta.json') : null;
}

function statOf(file) {
    try {
        const s = fs.statSync(file);
        let body = null;
        try { body = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { body = 'unparsed'; }
        return { exists: true, mtimeMs: s.mtimeMs, body };
    } catch (e) {
        return { exists: false };
    }
}

if (process.argv[2] === 'after') {
    const rows = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const out = rows.map((r) => {
        const now = r.metaFile ? statOf(r.metaFile) : { exists: false };
        const body = now.exists && now.body && typeof now.body === 'object' ? now.body : null;
        return {
            agent_id: r.agent_id,
            agent_type: r.agent_type,
            firstSeenMs: r.firstSeenMs,
            depthAtFirstSeen: r.depthAtFirstSeen,
            polls: r.polls,
            waitedMs: r.returnedAt - r.hookAt,
            existsAfter: now.exists,
            depthAfter: body ? body.spawnDepth : null,
            parentAfter: body ? body.parentAgentId || null : null,
            mtimeMinusHookMs: now.exists ? Math.round(now.mtimeMs - r.hookAt) : null,
            mtimeMinusReturnMs: now.exists ? Math.round(now.mtimeMs - r.returnedAt) : null,
        };
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
    let raw = '';
    process.stdin.on('data', (c) => { raw += c; });
    process.stdin.on('end', () => {
        const hookAt = Date.now();
        let payload = {};
        try { payload = JSON.parse(raw); } catch (e) { payload = {}; }
        const metaFile = metaFileOf(payload);
        const nap = new Int32Array(new SharedArrayBuffer(4));
        let firstSeenMs = null;
        let depthAtFirstSeen = null;
        let polls = 0;
        for (;;) {
            polls += 1;
            const s = metaFile ? statOf(metaFile) : { exists: false };
            if (s.exists && s.body && typeof s.body === 'object' && typeof s.body.spawnDepth === 'number') {
                firstSeenMs = Date.now() - hookAt;
                depthAtFirstSeen = s.body.spawnDepth;
                break;
            }
            if (Date.now() - hookAt >= WAIT_MS) break;
            Atomics.wait(nap, 0, 0, STEP_MS);
        }
        const returnedAt = Date.now();
        fs.appendFileSync(LOG, JSON.stringify({ hookAt, returnedAt, agent_id: payload.agent_id, agent_type: payload.agent_type, transcript_path: payload.transcript_path, metaFile, firstSeenMs, depthAtFirstSeen, polls }) + '\n');
    });
}
```

- [ ] **Step 2: 寫 run.sh。** 把 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh` 整份複製成 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/run.sh`，只改兩處：第二行註解改成 `# Runs the spawnDepth probe again with a hook that waits (20 ms steps, 500 ms max). See ../../2026-09-28-spawndepth-timing.md.`；`OUT=` 那行改成 `OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll"`。其餘（`--agents`、`--settings`、`timeout: 5`、provenance 的 md5 行）一字不改。
- [ ] **Step 3: 跑。** `sh docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/run.sh`。`hook-log.jsonl` 要有兩列：`nester` 與 `leaf`。只有一列時讀 `claude-err.txt` 修 `run.sh` 再跑；最多三次，改了什麼寫在回報裡。
- [ ] **Step 4: 回報** 兩列的 `firstSeenMs`、`depthAtFirstSeen`、`waitedMs`、`mtimeMinusReturnMs`，以及依下面規則判出的分支：`leaf` 列 `depthAtFirstSeen` 為 `2` → **改**；否則（`firstSeenMs` 為 `null`，`waitedMs` ≥ 500）→ **不改**。
- [ ] **Step 5: Commit** — 路徑：這個目錄下 `record.js`、`run.sh`、`settings.json`、`agents.json`、`provenance.txt`、`hook-log.jsonl`、`claude-out.json`、`claude-err.txt`、`summary.json`；訊息 `docs(evidence): spawnDepth probe with a hook that waits`。

## Task 4: nestedBrain 依量測結果改或不改

**Files:**
- Modify: `hooks/brief.js` — 改：`nestedBrain()` 輪詢；不改：只補註解
- Modify: `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` — 新一節，附新跑的 sha 與 md5
- Modify: `TODO.md` — 刪 `## Needs a decision` 裡 `〔stage-agents〕SubagentStart 觸發時` 開頭那一條
- Test: `tests/brief.test.js`
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/summary.json` — 決定分支
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/provenance.txt` — sha 與 md5
- Read: `hooks/gate.js` — `Atomics.wait` 的既有寫法（:100-125）
- Read: `lib/usage.js` — `sessionDirOf`（:162）

**Interfaces:**
- Consumes: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/summary.json`
- Produces: none — `nestedBrain` 不匯出，行為只從 hook 觀察。

**Dispatch:** implementer, sonnet — 兩支都寫在這裡，由量測結果選一支。

先打開 `summary.json`，照 Task 3 Step 4 的規則選分支，只做那一支。

### 分支「改」（`leaf` 的 `depthAtFirstSeen` 是 2）

- [ ] **Step 1: 寫失敗的測試。** 在 `tests/brief.test.js` 第 12 行，把 `const { execFileSync } = require('node:child_process');` 改成 `const { execFileSync, spawn } = require('node:child_process');`，下一行加 `const { once } = require('node:events');`。再在 `tests/brief.test.js` 的 `a nested brain (spawnDepth 2) does not mark inflight` 測試之後加：

```js
// docs/90-agent/reports/2026-09-28-spawndepth-timing.md: the meta file lands
// 36–87 ms after SubagentStart fires, and — measured again with a hook that
// waits — while the hook is still running. A read that waits (20 ms steps,
// 500 ms at most) still tells a nested brain apart.
test('a nested brain whose meta file lands 60 ms after the hook starts still does not mark inflight', async () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  const meta = path.join(sub, 'agent-a9.meta.json');
  const body = JSON.stringify({ agentType: 'fankeel:fankeel-brain', parentAgentId: 'a1', spawnDepth: 2 });
  const late = spawn(process.execPath, ['-e', 'setTimeout(() => require("node:fs").writeFileSync(process.argv[1], process.argv[2]), 60)', meta, body], { stdio: 'ignore' });
  const exited = once(late, 'exit');
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a9', transcript_path: path.join(root, 'sess.jsonl') }));
  await exited;
  assert.ok(fs.existsSync(meta), 'the late writer ran');
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight, undefined, 'a nested brain must not add an inflight mark');
});

// The wait ends: a brain whose meta file never appears is read as depth 1
// after at most 500 ms, and marks inflight as it always did.
test('a brain whose meta file never appears still marks inflight, within the wait', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  fs.mkdirSync(path.join(root, 'sess', 'subagents'), { recursive: true });
  const t0 = Date.now();
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a7', transcript_path: path.join(root, 'sess.jsonl') }));
  const took = Date.now() - t0;
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight.agentId, 'a7');
  assert.ok(took >= 500 && took < 3000, 'the hook took ' + took + ' ms');
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/brief.test.js`。第一個新測試要紅（今天的 `nestedBrain()` 讀一次就回 `false`，所以會寫 inflight）；第二個要紅在 `took >= 500`。第一個如果今天就綠——代表 hook 自己啟動比子程序寫檔還慢，這個測試量不到東西——把 `60` 改成 `250`（仍在 500 之內），再跑一次確認紅，並在回報裡寫一行 `Ruling: late writer 250 ms, 60 ms was green on unchanged code`。
- [ ] **Step 3: 寫實作。** 在 `hooks/brief.js`，把 `function nestedBrain(payload) {` 到它的結尾 `}`（:42-55）整段換成：

```js
// How long nestedBrain waits for the meta file, and how often it looks. The
// file lands 36–87 ms after SubagentStart fires, while this hook is still
// running (docs/90-agent/reports/2026-09-28-spawndepth-timing.md). Only a
// fankeel-brain start reaches here, so no other agent's brief waits.
const META_WAIT_MS = 500;
const META_STEP_MS = 20;

function readMeta(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

function nestedBrain(payload) {
    const dir = sessionDirOf(payload.transcript_path);
    if (!dir) return false;
    const metaFile = path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.meta.json');
    const since = Date.now();
    const nap = new Int32Array(new SharedArrayBuffer(4));
    for (;;) {
        const meta = readMeta(metaFile);
        if (meta && typeof meta.spawnDepth === 'number') return meta.spawnDepth >= 2;
        if (meta && typeof meta.parentAgentId === 'string' && meta.parentAgentId) return true;
        if (Date.now() - since >= META_WAIT_MS) return false;
        Atomics.wait(nap, 0, 0, META_STEP_MS);
    }
}
```

同一檔 :38-41 註解裡的 `no file yet` 改成 `no file within META_WAIT_MS`。
- [ ] **Step 4: 跑，看它通過。** `node --test tests/brief.test.js`，全部綠。

### 分支「不改」（等滿 500 ms 仍沒有帶 `spawnDepth` 的檔）

- [ ] **Step 1: 寫一個釘住量測事實的測試。** design 驗收第一條只在「改」這支成立；這支沒有行為改動，所以寫的是描述性測試：meta 檔在 hook 執行當下不存在時，`nestedBrain()` 照舊回 `false`，brain 照舊寫 inflight。在 `tests/brief.test.js` 的 `a nested brain (spawnDepth 2) does not mark inflight` 測試之後加：

```js
// docs/90-agent/reports/2026-09-28-spawndepth-timing.md, measured twice: the
// meta file is not there while SubagentStart runs, even to a hook that waits
// 500 ms. So a brain with a transcript path but no meta file yet is read as
// depth 1 and marks inflight — the fallback nestedBrain()'s comment names.
test('a brain whose meta file is not there when the hook runs is read as depth 1 and marks inflight', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  fs.mkdirSync(path.join(root, 'sess', 'subagents'), { recursive: true });
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a7', transcript_path: path.join(root, 'sess.jsonl') }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight.agentId, 'a7');
});
```

  這個測試今天就綠，它記錄的是行為不變；它的反向對照是「改」那支的第一個測試。
- [ ] **Step 2: 補註解。** 在 `hooks/brief.js` :41 那行 `// missed real mark breaks the controller, so unknown must not skip the mark.` 之後加一行：

```js
// Measured: the file is not there while this hook runs, even waiting 500 ms — docs/90-agent/reports/2026-09-28-spawndepth-timing.md.
```

- [ ] **Step 3: 跑** `node --test tests/brief.test.js`，全部綠。

### 兩支都做

- [ ] **Step 5: 報告新一節。** 在 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 檔尾加下面這節，值從 `summary.json` 與 `provenance.txt` 抄；frontmatter 的 `source_of_truth` 句末加 `；重測在 docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/`：

```md

## 重測：hook 內等待（2026-09-28）

`docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll/` 的 `record.js` 在 hook 裡每 20 ms 重讀一次 `agent-<id>.meta.json`，最多等 500 ms，其餘與上面那次相同。`provenance.txt` 記的 HEAD `<sha>`，`record.js` md5 `<md5>`，`run.sh` md5 `<md5>`，`claude exit <n>`。

| agent_type | firstSeenMs | depthAtFirstSeen | polls | waitedMs | mtimeMinusReturnMs |
| --- | --- | --- | --- | --- | --- |
| nester | <值> | <值> | <值> | <值> | <值> |
| leaf | <值> | <值> | <值> | <值> | <值> |

<一段結論：改——檔案在 hook 等待期間出現，`leaf` 讀到 2，`nestedBrain()` 改成同樣的讀法；不改——等滿 500 ms 仍沒有檔案、`mtimeMinusReturnMs` 為正，Claude Code 等 hook 返回才寫，`hooks/brief.js` 不改。只跑了一次。>
```

- [ ] **Step 6: 刪 TODO。** 在 `TODO.md` 的 `## Needs a decision` 下，刪掉以 `- 〔stage-agents〕SubagentStart 觸發時 ` 開頭的那一整行。跑 `node scripts/todo-check.js`，要乾淨。
- [ ] **Step 7: Commit** — 路徑 `hooks/brief.js`、`docs/90-agent/reports/2026-09-28-spawndepth-timing.md`、`TODO.md`、`tests/brief.test.js`；訊息：改 → `fix(brief): wait up to 500 ms for a nested brain's meta file`；不改 → `docs(brief): record that the meta file lands after SubagentStart returns`。

## Task 5: commit.js 認得 `worktree` block

不論 Task 2 的結論是什麼都要做：`commit.js` 只拿到一個路徑，不管 worktree 是誰開的。

**Files:**
- Modify: `scripts/commit.js` — `parseBlock` 認 `worktree <path>` 第一行；新函式 `landWorktree`；主迴圈分支
- Test: `tests/commit.test.js`
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: commit file 一個 block 的第一行 `worktree <path>`；回覆行 `conflict <paths>`（多 block 時 `<paths>: conflict <paths>`，結束碼 1）；成功但 worktree 沒移掉時，範圍行之後一行 `kept <path> — <why>`；`landWorktree(top, block, run, oneLine)` 回傳 `{}`、`{ kept }`、`{ conflict: string[] }` 或 `{ error }`

**Dispatch:** implementer, sonnet — 程式與測試都寫在這裡；git 行為由真的暫存 repo 驗。

- [ ] **Step 1: 寫失敗的測試。** 在 `tests/commit.test.js` 檔尾加：

```js
// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: a block
// whose first line is `worktree <path>` was built in a worktree of this
// repository. A clean repository whose a.txt has ten lines, b.txt one, and a
// worktree of it on branch `wt1` outside it, the way Agent isolation leaves one.
const TEN = Array.from({ length: 10 }, (_, i) => 'line ' + (i + 1)).join('\n') + '\n';
function worktreeRepo() {
    const dir = tmp('fankeel-commit-wt-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), TEN);
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    const wt = path.join(tmp('fankeel-commit-wtdir-'), 'wt');
    git(dir, 'worktree', 'add', '-q', '-b', 'wt1', wt);
    return { dir, wt };
}
const setLine = (file, n, text) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[n - 1] = text;
    fs.writeFileSync(file, lines.join('\n'));
};

test('a worktree block commits there, cherry-picks onto HEAD, and removes the worktree and its branch', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 1, 'main 1');
    git(dir, 'commit', '-qam', 'main edits line 1');
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    const res = commit.main([requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    const [after, before] = git(dir, 'log', '--format=%H', '-n', '2').split('\n');
    assert.equal(res.text, before + '..' + after);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: line 9');
    const a = fs.readFileSync(path.join(dir, 'a.txt'), 'utf8').split('\n');
    assert.deepEqual([a[0], a[8]], ['main 1', 'worktree 9']);
    assert.equal(fs.existsSync(wt), false, 'the worktree is removed');
    assert.equal(git(dir, 'branch', '--list', 'wt1'), '', 'its branch is deleted');
    assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('a worktree block that conflicts is aborted: HEAD, the tree and the worktree stay as they were', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 5, 'main 5');
    git(dir, 'commit', '-qam', 'main edits line 5');
    setLine(path.join(wt, 'a.txt'), 5, 'worktree 5');
    const before = git(dir, 'rev-parse', 'HEAD');
    const file = requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 5\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'conflict a.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(git(dir, 'status', '--porcelain'), '');
    assert.equal(fs.existsSync(path.join(dir, '.git', 'CHERRY_PICK_HEAD')), false);
    assert.equal(fs.existsSync(wt), true, 'the worktree is kept');
    assert.equal(fs.existsSync(file), true, 'the commit file is kept');
});

test('a conflict in a later block keeps the blocks that landed and names its own paths', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 5, 'main 5');
    git(dir, 'commit', '-qam', 'main edits line 5');
    setLine(path.join(wt, 'a.txt'), 5, 'worktree 5');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('b.txt\n\nfeat: change b\n---\nworktree ' + wt + '\na.txt\n\nfeat: line 5\n')], dir);
    assert.equal(res.code, 1);
    assert.deepEqual(res.text.split('\n'), ['b.txt: ' + base + '..' + git(dir, 'rev-parse', 'HEAD'), 'a.txt: conflict a.txt']);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
});

test('a worktree line naming something that is not a worktree of this repository commits nothing', () => {
    const { dir } = worktreeRepo();
    const other = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    for (const where of [tmp('fankeel-commit-none-'), other, dir]) {
        const res = commit.main([requestFile('worktree ' + where + '\na.txt\n\nfeat: x\n')], dir);
        assert.equal(res.code, 1, where);
        assert.equal(res.text, 'commit.js: not a worktree of this repository: ' + where);
    }
    assert.equal(commit.main([requestFile('worktree ' + dir + '\n\nfeat: x\n')], dir).text, 'commit.js: no paths after the worktree line');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/commit.test.js`。四個新測試都紅：今天 `worktree <path>` 被當成一個路徑交給 `git add`，回 `commit.js: git add failed: …`。
- [ ] **Step 3: 寫實作。** 在 `scripts/commit.js`：

  (a) 在 `const fs = require('node:fs');` 之後加 `const path = require('node:path');`。

  (b) 在 `scripts/commit.js` 把 `parseBlock` 整個換成：

```js
function parseBlock(text) {
    const at = text.search(/\r?\n[ \t]*\r?\n/);
    if (at < 0) return { error: 'no blank line between the paths and the message' };
    let paths = text.slice(0, at).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const message = text.slice(at).trim();
    if (!message) return { error: 'no message' };
    // A first line `worktree <path>`: the implementer built in a worktree of
    // this repository, and that is where these paths are committed.
    const head = /^worktree\s+(\S.*)$/.exec(paths[0] || '');
    if (!head) return { paths, message };
    paths = paths.slice(1);
    if (!paths.length) return { error: 'no paths after the worktree line' };
    return { paths, message, worktree: head[1].trim() };
}
```

  (c) 在 `scripts/commit.js` 的 `foldRenames` 之後、`function main` 之前加：

```js
// The directory every worktree of one repository shares, or null.
function commonDir(run, dir) {
    const r = run(dir, ['rev-parse', '--git-common-dir']);
    if (r.status !== 0) return null;
    try {
        return fs.realpathSync.native(path.resolve(dir, r.stdout.trim()));
    } catch (e) {
        return null;
    }
}

// A `worktree <path>` block: commit its paths in that worktree with `commit -o`,
// then cherry-pick the commit onto this repository's HEAD. A conflict is
// aborted, so HEAD and the working tree are as they were, and the worktree is
// kept for the task's re-dispatch. On success the worktree and its branch go;
// a worktree git will not remove (files outside the block) is kept and said.
function landWorktree(top, block, run, oneLine) {
    const wt = path.resolve(top, block.worktree);
    let real = null;
    try { real = fs.realpathSync.native(wt); } catch (e) { /* not there */ }
    const mine = commonDir(run, top);
    if (!real || real === fs.realpathSync.native(top) || !mine || commonDir(run, wt) !== mine) {
        return { error: 'not a worktree of this repository: ' + block.worktree };
    }
    const here = (args, input) => run(wt, args, input);
    const branch = here(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const renamed = here(['diff', '--cached', '-M', '--name-status']);
    const add = here(['add', '--'].concat(block.paths));
    if (add.status !== 0) return { error: 'git add failed: ' + oneLine(add.stderr) };
    if (here(['diff', '--cached', '--quiet', '--'].concat(block.paths)).status === 0) return { error: 'nothing to commit in ' + block.paths.join(', ') };
    const withOld = foldRenames(block.paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
    const made = here(['commit', '-o', '-F', '-', '--'].concat(withOld), block.message + '\n');
    if (made.status !== 0) return { error: 'git commit failed: ' + oneLine(made.stderr || made.stdout) };
    const sha = here(['rev-parse', 'HEAD']).stdout.trim();
    const pick = run(top, ['cherry-pick', sha]);
    if (pick.status !== 0) {
        const unmerged = run(top, ['diff', '--name-only', '--diff-filter=U']);
        const clashed = unmerged.status === 0 ? unmerged.stdout.split(/\r?\n/).filter(Boolean) : [];
        run(top, ['cherry-pick', '--abort']);
        if (clashed.length) return { conflict: clashed };
        return { error: 'git cherry-pick failed: ' + oneLine(pick.stderr || pick.stdout) };
    }
    const removed = run(top, ['worktree', 'remove', wt]);
    if (removed.status !== 0) return { kept: block.worktree + ' — ' + oneLine(removed.stderr) };
    if (branch.status === 0 && branch.stdout.trim()) run(top, ['branch', '-D', branch.stdout.trim()]);
    return {};
}
```

  (d) 在 `scripts/commit.js` 的 `main` 迴圈裡，`const base = git(['rev-parse', 'HEAD']).stdout.trim();` 那行之後插入：

```js
        if (parsed.blocks[i].worktree) {
            const label = many ? paths.join(', ') + ': ' : '';
            const r = landWorktree(top.stdout.trim(), parsed.blocks[i], run, oneLine);
            if (r.error) return fail(r.error);
            if (r.conflict) return { text: out.concat(label + 'conflict ' + r.conflict.join(' ')).join('\n'), code: 1 };
            out.push(label + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
            if (r.kept) out.push('kept ' + r.kept);
            continue;
        }
```

  (e) 在 `scripts/commit.js` 檔頭註解 `// Once every block has committed, the file is renamed to <name>.done.md.` 之後加一行註解：`// A block whose first line is \`worktree <path>\` is committed in that worktree and cherry-picked here; a conflict prints \`conflict <paths>\` and exits 1.`；`module.exports` 改成 `{ main, foldRenames }` 不變（`landWorktree` 不匯出：`CONTRIBUTING.md` 要每個匯出名都有 importer）。
- [ ] **Step 4: 跑，看它通過。** `node --test tests/commit.test.js`，新舊測試全綠——沒有 `worktree` 行的舊測試不動就綠，就是「行為和今天一模一樣」那條。
- [ ] **Step 5: Commit** — 路徑 `scripts/commit.js`、`tests/commit.test.js`；訊息 `feat(commit): land a worktree block by cherry-pick, abort on conflict`。

## Task 6: `ready()` 的 `{ worktree: true }`

**Files:**
- Modify: `lib/plantasks.js` — `ready(input, done, opts)`
- Modify: `scripts/ledger.js` — `ready` 動詞收 `--worktree`
- Test: `tests/plantasks.test.js`
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `ready(input, done, opts)` — `opts.worktree === true` 時兩個 task 只共用 `Modify:`／`Test:` 檔不再擋；`read`、`interface`、`undeclared` 照擋。`ledger.js --plan <f> ready --worktree` 印同樣格式的編號。`conflict`、`groups` 不變。

**Dispatch:** implementer, sonnet — 程式與測試都寫在這裡。

- [ ] **Step 1: 寫失敗的測試。** 在 `tests/plantasks.test.js` 的 `ready fails closed on a task with no Files block` 測試之後加：

```js
// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: each
// implementer builds in its own worktree, so a shared Modify/Test file no
// longer holds a task back; a Read of a neighbour's file and an interface
// edge still do — even when the pair also shares a file.
test('ready with { worktree: true } drops only the files predicate', () => {
  const shared = task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/a.js'], ['tests/a.test.js'], [], []);
  assert.deepEqual(plantasks.ready(shared, []), [1]);
  assert.deepEqual(plantasks.ready(shared, [], { worktree: true }), [1, 2]);
  const edge = task(1, ['lib/a.js'], [], [], ['makeA']) + task(2, ['lib/a.js'], [], ['makeA'], []);
  assert.deepEqual(plantasks.ready(edge, [], { worktree: true }), [1]);
  const reads = task(1, ['lib/a.js'], [], [], []) + readTask(2, ['lib/b.js'], ['lib/a.js']);
  assert.deepEqual(plantasks.ready(reads, [], { worktree: true }), [1]);
  const [a] = parseTasks(task(1, ['lib/a.js'], [], [], []));
  const bare = { n: 2, name: 'x', modify: [], test: [], read: [], consumes: [], produces: [] };
  assert.deepEqual(plantasks.ready([a, bare], [], { worktree: true }), [1]);
  const [x, y] = parseTasks(shared);
  assert.equal(conflict(x, y), 'files');
  assert.deepEqual(groups(shared), [[1], [2]]);
});
```

  再在 `tests/ledger.test.js` 的 `ready with no ledger yet says so, the way show does` 測試之後加：

```js
test('ready --worktree sends two tasks that share a Modify file together; ready alone does not', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/a.js`', '',
  ].join('\n'));
  const cli = (...args) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' });
  cli('init');
  assert.equal(cli('ready'), '1\n');
  assert.equal(cli('ready', '--worktree'), '1\n2\n');
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/plantasks.test.js tests/ledger.test.js`。plantasks 的新測試紅在 `[1, 2]`（今天第三個參數被忽略，回 `[1]`）；ledger 的新測試紅在 `ready --worktree`（今天 `ready takes --root, --plan; refused: --worktree.`）。
- [ ] **Step 3: 寫實作。** 在 `lib/plantasks.js` 把 `ready` 整個換成：

```js
// `opts.worktree`: every implementer builds in a worktree of its own, so two
// tasks sharing a `Modify:` or `Test:` file no longer overwrite each other and
// only the files predicate is dropped. Done by exempting both tasks' own files
// rather than by ignoring a `'files'` answer: `conflict()` returns at the
// first predicate that fires, so a pair sharing a file *and* an interface
// edge would otherwise read as free. `groups()` and every report keep the
// predicate as it was.
function ready(input, done, opts) {
    const tasks = typeof input === 'string' ? parseTasks(input) : input;
    const complete = new Set((done || []).map(Number));
    const worktree = Boolean(opts && opts.worktree);
    const exempt = (e, t) => (worktree ? INDEX_FILES.concat(e.modify, e.test, t.modify, t.test).map(barePath) : INDEX_FILES);
    return tasks
        .filter((t, i) => !complete.has(t.n)
            && tasks.slice(0, i).every((e) => complete.has(e.n) || !conflict(e, t, exempt(e, t))))
        .map((t) => t.n);
}
```

  在 `scripts/ledger.js`：`VERB_FLAGS` 那行加 `ready: BASE_FLAGS.concat(['worktree'])`；`parseArgs` 裡 `options.prefix = { type: 'boolean' };` 之後加 `options.worktree = { type: 'boolean' };`，`if (values.prefix !== undefined) opts.prefix = values.prefix === true;` 之後加 `if (values.worktree !== undefined) opts.worktree = values.worktree === true;`；`ready` 動詞裡 `plantasks.ready(tasks, ledger.completed(contents))` 改成 `plantasks.ready(tasks, ledger.completed(contents), { worktree: opts.worktree === true })`，並在那段註解末加一句 `` `--worktree`: the build brain's form, where a shared file does not hold a task back. ``
- [ ] **Step 4: 跑，看它通過。** `node --test tests/plantasks.test.js tests/ledger.test.js`，全綠。
- [ ] **Step 5: Commit** — 路徑 `lib/plantasks.js`、`scripts/ledger.js`、`tests/plantasks.test.js`、`tests/ledger.test.js`；訊息 `feat(plantasks): ready --worktree drops only the shared-file predicate`。

## Task 7: brain 的規則——worktree 派遣、commit file、衝突重派

design 說改「`lib/stages.js` 的 build 規則」。實際上 brain 的 commit 流程寫在 `lib/render.js` 的 `renderBrief`（:517-523），`lib/stages.js` 的 build `rules`（:302-310）是主 session 的注入，受 `tests/render.test.js:528` 的 2400 上限管，而且 brain 不是從那裡讀提交流程。所以改兩處：`lib/stages.js` 的 `STAGE_AGENTS.build`（:707-708，只進 brain 的 brief）加上 isolation，`lib/render.js` 的 build 分支加一行。

**Files:**
- Modify: `lib/render.js:515-525` — build 分支、`:521` 那行之後加一行
- Modify: `lib/stages.js:705-712` — `STAGE_AGENTS.build` 的 implementer 字串
- Modify: `agents/fankeel-brain.md` — Job 段加一句、Refusals 加一條
- Test: `tests/brief.test.js`
- Read: `docs/90-agent/reports/2026-09-28-worktree-probe.md` — `readable:` 那一行決定做哪一支
- Read: `scripts/commit.js` — `worktree <path>`、`conflict <paths>`、`kept <path> — <why>` 的確切字樣
- Read: `lib/plantasks.js` — `ready(input, done, opts)`
- Read: `lib/guard.js` — `lib/render.js` require 它；本 task 不用 Task 9 改的任何東西，列在這裡只為讓兩者不同時跑

**Interfaces:**
- Consumes: `docs/90-agent/reports/2026-09-28-worktree-probe.md`、`worktree <path>`、`conflict <paths>`、`kept <path> — <why>`、`ledger.js --plan <f> ready --worktree`
- Produces: none — 規則文字，沒有程式介面。

**Dispatch:** implementer, sonnet — 每一段新字句都寫在這裡。

- [ ] **Step 0: 選分支。** 打開 `docs/90-agent/reports/2026-09-28-worktree-probe.md` 的結論節。`readable: no`：不改任何檔，回報 `blocked: Agent 的回傳讀不到 worktree 路徑；design 的退路要一個 brain 能跑的開 worktree 指令，design 沒定，回 design`，停。`readable: yes`：往下做。
- [ ] **Step 1: 寫失敗的測試。** 在 `tests/brief.test.js` 的 `a build brain asks for a commit only when none of its implementers is running, never per task` 測試之後加：

```js
// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: a build
// brain sends every implementer into its own worktree, names that worktree at
// the head of the task's block, and re-dispatches a conflict once on its own.
test('a build brain sends implementers into worktrees, names the worktree in the commit file, and re-dispatches a conflict once', () => {
  const build = briefFor('build');
  assert.match(build, /Send every implementer with `isolation: "worktree"`/);
  assert.match(build, /the first line of its task's block is `worktree <path>`/);
  assert.match(build, /`conflict <paths>`[^\n]*dispatch it once more, fresh, on the new HEAD, without asking\. The same task conflicting a second time: stop the build/);
  assert.match(build, /`ledger\.js --plan <f> ready --worktree`/);
  assert.match(build, /`kept <path> — <why>`/);
  assert.match(build, /an implementer \(`general-purpose`, on the model named in the task Dispatch line, with `isolation: "worktree"`\)/);
  assert.doesNotMatch(briefFor('verify'), /isolation: "worktree"/);
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  assert.match(file, /`ledger\.js --plan <f> ready --worktree`/);
  assert.match(file, /`isolation: "worktree"`/);
  assert.match(file, /Do not run `git worktree`/);
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/brief.test.js`，新測試紅在第一個 `assert.match`。
- [ ] **Step 3: 寫實作。**

  (a) 在 `lib/stages.js` 的 `STAGE_AGENTS` 裡，`build:` 那行的 `'an implementer (`general-purpose`, on the model named in the task Dispatch line)'` 改成 `'an implementer (`general-purpose`, on the model named in the task Dispatch line, with `isolation: "worktree"`)'`。`verify`、`audit`、`land` 不動。

  (b) 在 `lib/render.js` 的 `if (stage === 'build') {` 分支裡，`const commit = commitPath(root, data, stage);` 之後那個 `lines.push('  - You cannot commit: …')` 不動，在它之後、`lines.push('  - You have no Edit. …')` 之前加：

```js
        lines.push('  - Send every implementer with `isolation: "worktree"`, and ask `ledger.js --plan <f> ready --worktree` what goes out: there two tasks sharing a file may run at once. In the commit file, the first line of its task\'s block is `worktree <path>`, the worktree path its Agent result names, above the paths. A reply line `conflict <paths>` (or `<paths>: conflict <paths>`) means that task did not land and nothing of it is in HEAD: dispatch it once more, fresh, on the new HEAD, without asking. The same task conflicting a second time: stop the build and name those paths in your report, for the controller to ask. A line `kept <path> — <why>` after a range: the task landed but its worktree stayed; name it in your report.');
```

  (c) 在 `agents/fankeel-brain.md` 的 `## Job`，把 `send what it newly lists in that same response. A task whose Dispatch line` 改成：

```md
send what it newly lists in that same response — run it as
`ledger.js --plan <f> ready --worktree`, and send every implementer with
`isolation: "worktree"`: its task's block in the commit file opens with
`worktree <path>`, the path its Agent result names. A reply `conflict <paths>`
for a task: send it once more, fresh, without asking; the same task conflicting
twice stops the build, with the paths in your handoff. A task whose Dispatch line
```

  (d) 在 `agents/fankeel-brain.md` 的 `## Refusals`，`- Do not run \`scripts/commit.js\`: the controller does, on your \`commit <path>\`.` 那條之後加：

```md
- Do not run `git worktree` or open a worktree yourself: the Agent tool's
  `isolation: "worktree"` opens it, and `scripts/commit.js` removes it.
```

- [ ] **Step 4: 跑，看它通過。** `node --test tests/brief.test.js tests/agents.test.js tests/stages.test.js tests/render.test.js`，全綠（`tests/render.test.js:528` 的 2400 上限不受影響，因為動的只有 brain 的 brief；`tests/brief.test.js:450` 的 10000 上限要仍在之下）。
- [ ] **Step 5: Commit** — 路徑 `lib/render.js`、`lib/stages.js`、`agents/fankeel-brain.md`、`tests/brief.test.js`；訊息 `feat(build): brain sends implementers into worktrees and re-dispatches a conflict once`。

## Task 8: build skill 與 subagents.md 改寫成 worktree 流程

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — task loop 第 2 步 `ledger.js ready` 那段之後加一段
- Modify: `docs/90-agent/reference/subagents.md:530-835` — `a commit` 表列（:536）、:666 的括號、`Where it commits` 條（:829-831）
- Modify: `TODO.md` — 刪 `## Needs a decision` 裡 `〔build〕ready-queue 的 worktree 那一半` 開頭那一條
- Read: `docs/90-agent/reports/2026-09-28-worktree-probe.md` — `readable:` 那一行決定做哪一支
- Read: `scripts/commit.js` — 輸出字樣
- Read: `lib/plantasks.js` — `ready` 的選項

**Interfaces:**
- Consumes: `docs/90-agent/reports/2026-09-28-worktree-probe.md`、`worktree <path>`、`conflict <paths>`、`kept <path> — <why>`、`ledger.js --plan <f> ready --worktree`
- Produces: none — 文件。

**Dispatch:** implementer, sonnet — 每一段新字句都寫在這裡。

- [ ] **Step 0: 選分支。** 打開 `docs/90-agent/reports/2026-09-28-worktree-probe.md` 的結論節。`readable: no`：不改任何檔，回報 `blocked: 回 design（同 Task 7 Step 0）`，停。`readable: yes`：往下做。
- [ ] **Step 1: 沒有新測試。** 這個 task 只改文件；守住它的是既有的 skills 測試（task loop 段的字句）與 docs-check，Step 5 跑。
- [ ] **Step 2: build skill。** 在 `skills/fankeel-build/SKILL.md`，`never listed — the hands paragraph above step 1 has it.` 這行之後空一行，加：

```md
   **A stage agent's implementers each build in a worktree.** A
   `fankeel-brain` asks `ledger.js --plan <f> ready --worktree` instead: there
   two tasks sharing a `Modify:` or `Test:` file go out together, and a
   `Read:` of a neighbour's file or a `Consumes`/`Produces` edge still holds
   one back. It sends every implementer with `isolation: "worktree"`, and each
   task's block in its commit file opens with `worktree <path>`, the path that
   implementer's Agent result names. `scripts/commit.js` commits the block in
   that worktree and cherry-picks it onto HEAD. A reply `conflict <paths>`
   means that task is not in HEAD: send it once more, fresh, on the new HEAD,
   without asking; the same task conflicting a second time stops the build,
   and the handoff names the paths for the controller to ask about.
```

- [ ] **Step 3: subagents.md 三處。** 在 `docs/90-agent/reference/subagents.md`：

  (a) :536 `a commit` 那列第三格的句尾 `so a \`-commit.md\` on disk is always a commit still to make` 之後、`|` 之前加：`; a block whose first line is \`worktree <path>\` is committed in that worktree and cherry-picked onto the controller's HEAD, and the worktree and its branch removed — a conflict is aborted and comes back as \`conflict <paths>\`, exit 1, the worktree kept`。

  (b) :666-667 的 `(a\nworktree the implementers build in is not handled)` 改成 `(each implementer builds in its own \`isolation: "worktree"\` worktree, and the block naming it is cherry-picked in — see **Where it commits** below)`。

  (c) 把 `docs/90-agent/reference/subagents.md` :829-831 的 `Where it commits` 整條換成：

```md
- **Where it commits.** `scripts/commit.js` commits in the repository at the
  controller's working directory, and does not consult the task's `project`. A
  build brain sends every implementer with `isolation: "worktree"` and puts
  `worktree <path>` — the path the Agent result names — first in that task's
  block; `commit.js` commits the listed paths there with `commit -o`,
  cherry-picks the commit onto HEAD, prints `<base>..<sha>`, and removes the
  worktree and its branch, or prints `kept <path> — <why>` when git will not.
  A cherry-pick conflict is aborted — HEAD and the working tree unchanged,
  earlier blocks kept, the worktree kept — and printed as `conflict <paths>`
  with exit 1; the brain re-dispatches that task once on the new HEAD without
  asking, and a second conflict stops the build with the paths in its handoff.
  `ledger.js --plan <f> ready --worktree` is what lets two tasks sharing a
  `Modify:` or `Test:` file go out together; `groups` still counts them.
```

  `docs/03-decisions/2026-09-21-controlled-stations.md:38` 的「worktree 不處理」不改：decision 頁不維護（design「對照地圖」第一條）。
- [ ] **Step 4: 刪 TODO。** 在 `TODO.md` 的 `## Needs a decision` 下，刪掉以 `- 〔build〕ready-queue 的 worktree 那一半` 開頭的那一整行。
- [ ] **Step 5: 跑。** `node --test tests/skills.test.js tests/sources-doc.test.js`、`node scripts/docs-check.js`、`node scripts/todo-check.js`，全綠。
- [ ] **Step 6: Commit** — 路徑三個 Modify 檔；訊息 `docs(build): implementers in worktrees, commit.js cherry-picks, conflict re-dispatch`。

## Task 9: worktree 裡的編輯以主樹的邏輯路徑記進 claims

排在探測之後：根目錄內那一段要去掉的前綴，取自探測報告記下的 worktree 位置。`readable` 是 `yes` 還是 `no` 都要做，因為任何連結的 worktree（在根目錄外）今天都不會留下 claim。

**Files:**
- Modify: `lib/guard.js` — `WORKTREE_SEGMENT` 多認 Agent isolation 的目錄；新函式 `logicalFile(root, file)`；`decide()` 改用它
- Modify: `hooks/touch.js` — :36 改用 `logicalFile`
- Test: `tests/worktree-paths.test.js`
- Read: `docs/90-agent/reports/2026-09-28-worktree-probe.md` — 「留下的 worktree」那一列：worktree 開在哪個目錄底下
- Read: `lib/dirty.js` — `lib/` 裡跑 git 的既有寫法（`execFileSync`，stderr 丟掉）

**Interfaces:**
- Consumes: `docs/90-agent/reports/2026-09-28-worktree-probe.md`
- Produces: `logicalFile(root, file)` — 回傳 `string | null`：`file` 在主樹、在 `.fankeel/worktrees/<hex8>/`、在根目錄內的 Agent worktree、或在根目錄外但屬於根目錄內某 repo 的連結 worktree 時，都回同一個主樹相對路徑；其餘回 `null`。`hooks/touch.js` 與 `decide()` 都用它。

**Dispatch:** implementer, sonnet — 程式與測試都寫在這裡；worktree 位置由探測報告給一個字串。

- [ ] **Step 0: 讀位置。** 打開 `docs/90-agent/reports/2026-09-28-worktree-probe.md` 的「留下的 worktree」。在 repo 根目錄之內時，記下根目錄到 worktree 那一層的前綴（預期是 .claude/worktrees/<name>）；不是 .claude/worktrees 時，下面 Step 1、Step 3 裡的這個目錄名全換成報告裡那個，並在回報裡寫一行 Ruling: Agent worktrees live under <那個目錄>。在根目錄之外時，Step 3 的正規式照寫不動，實際生效的是 mainTreeRel 那條路。
- [ ] **Step 1: 寫失敗的測試。** 在 `tests/worktree-paths.test.js` 檔尾加：

```js
// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: an
// implementer sent with Agent `isolation: "worktree"` edits in a worktree the
// session record knows nothing of. Its edit has to claim the path a main-tree
// edit would, or a neighbour's claim on the same file is never seen.
test('an Agent-isolation worktree inside the root is read by its logical path', () => {
  assert.equal(guard.logicalPath('.claude/worktrees/agent-a1b2c3/lib/x.js'), 'lib/x.js');
  assert.equal(guard.logicalPath('Waypoint/.claude/worktrees/agent-a1b2c3/lib/x.js'), 'Waypoint/lib/x.js');
  const older = new Date(Date.now() - 7200e3).toISOString();
  const mine = { active: true, guard: 'ask', started: new Date().toISOString() };
  const theirs = { sessionId: B, data: { active: true, claims: ['lib/x.js'], started: older } };
  const verdict = guard.decide({ mine, sessionId: A, others: [theirs], root: '/r',
    file: '/r/.claude/worktrees/agent-a1b2c3/lib/x.js', liveState: { known: false, ids: new Set() } });
  assert.equal(verdict && verdict.decision, 'ask');
});

test('a linked worktree outside the root is claimed, and judged, by its main-tree path', () => {
  const root = tmp('fankeel-wt-outside-');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(root, 'lib'));
  fs.writeFileSync(path.join(root, 'lib', 'x.js'), 'one\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'base']);
  const wt = path.join(tmp('fankeel-wt-away-'), 'wt');
  git(root, ['worktree', 'add', '-q', '-b', 'agent-x', wt]);
  const file = path.join(wt, 'lib', 'x.js');
  seed(root, {});
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: A, cwd: wt, tool_name: 'Edit', tool_input: { file_path: file } }),
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }), encoding: 'utf8',
  });
  assert.deepEqual(registry.claimsOf(registry.readSession(root, A)), ['lib/x.js']);
  assert.equal(guard.logicalFile(root, file), 'lib/x.js');
  assert.equal(guard.logicalFile(root, path.join(tmp('fankeel-wt-none-'), 'y.js')), null);
  const older = new Date(Date.now() - 7200e3).toISOString();
  const mine = { active: true, guard: 'ask', started: new Date().toISOString() };
  const theirs = { sessionId: B, data: { active: true, claims: ['lib/x.js'], started: older } };
  const verdict = guard.decide({ mine, sessionId: A, others: [theirs], root, file, liveState: { known: false, ids: new Set() } });
  assert.equal(verdict && verdict.decision, 'ask');
});
```

- [ ] **Step 2: 跑，看它失敗。** `node --test tests/worktree-paths.test.js`。第一個新測試紅在 `logicalPath` 回原字串；第二個紅在 claims 是 `[]`（今天 `relPath` 對根目錄外回 `null`，`touch.js` 不記）。
- [ ] **Step 3: 寫實作。** 在 `lib/guard.js`：

  (a) `const path = require('node:path');` 之前加 `const { execFileSync } = require('node:child_process');` 與 `const fs = require('node:fs');`。

  (b) 把 `lib/guard.js` 的 `WORKTREE_SEGMENT` 與 `logicalPath` 整段（:241-248）換成：

```js
// The path a file has in the project, whichever checkout it was edited in:
// `.fankeel/worktrees/<id8>/lib/x.js` is `lib/x.js`, and so is
// `.claude/worktrees/<name>/lib/x.js`, the worktree an Agent call with
// `isolation: "worktree"` opens (docs/90-agent/reports/2026-09-28-worktree-probe.md).
// Two sessions in two checkouts name one file the same way. A project prefix
// in front stays.
const WORKTREE_SEGMENT = /(^|\/)(?:\.fankeel\/worktrees\/[0-9a-fA-F]{8}|\.claude\/worktrees\/[^/]+)\//;
function logicalPath(rel) {
    if (typeof rel !== 'string' || !rel) return rel;
    return rel.replace(WORKTREE_SEGMENT, '$1');
}

function gitAt(dir, args) {
    try {
        return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return null;
    }
}

const realOf = (p) => {
    try { return fs.realpathSync.native(p); } catch (e) { return null; }
};

// A file outside `root` that sits in a linked worktree of a repository inside
// it: the same file's path in that repository's main tree, relative to `root`,
// or null. Git is asked only here, and only for a path `relPath` already
// refused, so an edit inside the root never spawns it.
function mainTreeRel(root, file) {
    let dir = path.dirname(path.resolve(file));
    while (!fs.existsSync(dir)) {
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
    const top = gitAt(dir, ['rev-parse', '--show-toplevel']);
    const common = gitAt(dir, ['rev-parse', '--git-common-dir']);
    if (!top || !common) return null;
    const commonAbs = path.resolve(dir, common);
    if (path.basename(commonAbs) !== '.git') return null;
    const mainTop = path.dirname(commonAbs);
    const topReal = realOf(top);
    const mainReal = realOf(mainTop);
    if (!topReal || !mainReal || topReal === mainReal) return null;
    const inner = path.relative(topReal, realOf(path.dirname(path.resolve(file))) || path.dirname(path.resolve(file)));
    return relPath(realOf(root) || root, path.join(mainReal, inner, path.basename(file)));
}

// The one path an edit is claimed and judged by. `hooks/touch.js` and
// `decide()` both read it, so a claim and a verdict never disagree on a name.
function logicalFile(root, file) {
    const rel = relPath(root, file);
    if (rel) return logicalPath(rel);
    return logicalPath(mainTreeRel(root, file));
}
```

  (c) 在 `lib/guard.js` 的 `decide()` 裡，`const rel = logicalPath(relPath(root, file));` 改成 `const rel = logicalFile(root, file);`。`logicalFile` 定義在 `decide` 之後沒關係：函式宣告會提升。

  (d) 在 `lib/guard.js` 的 `module.exports` 最後加 `logicalFile`。

  在 `hooks/touch.js`：:20 的 import 改成 `const { covers, targetOf, logicalFile } = require('../lib/guard.js');`；:36 改成 `const rel = logicalFile(root, file);`；:34-35 的註解改成 `// Outside the registry root is not this registry's business unless it is a\n    // linked worktree of a repository inside it: logicalFile reads that back.`。
- [ ] **Step 4: 跑，看它通過。** `node --test tests/worktree-paths.test.js tests/touch.test.js tests/guard.test.js tests/guard-effective.test.js`，全綠。`tests/touch.test.js` 的 `a file outside the registry root is not this registry's business` 仍要綠：`os.tmpdir()` 底下的檔不在任何 git repo 裡，`mainTreeRel` 回 `null`。
- [ ] **Step 5: Commit** — 路徑 `lib/guard.js`、`hooks/touch.js`、`tests/worktree-paths.test.js`；訊息 `fix(guard): claim an Agent-isolation worktree edit by its main-tree path`。

## Coverage

| promise | task |
|---|---|
| 先量，後改：把 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/record.js` 改成 hook 內每 20 ms 重讀一次，最多等 500 ms，再跑一次 headless nester＋leaf。量的是：hook 還沒返回的時候，檔案會不會出現。 | Task 3（放在兄弟目錄 `2026-09-28-spawndepth-poll/`，理由見 Task 3 開頭） |
| 如果檔案在 hook 等待期間出現，而且 `leaf` 讀到 `spawnDepth` 2：`nestedBrain()` 就改成同樣的讀法，每 20 ms 用 `Atomics.wait` 重讀一次，最多 500 ms，逾時照舊回 `false`。只有 `fankeel-brain` 啟動時才會等，其他 agent 的 brief 路徑不變。 | Task 4 分支「改」 |
| 如果 Claude Code 要等 hook 返回才寫檔，也就是等滿 500 ms 仍然沒有檔案：`hooks/brief.js` 不改，量測結果寫進同一份報告，TODO 條目刪掉，`nestedBrain()` 上方的註解補一句「hook 當下讀不到，已量過」。 | Task 4 分支「不改」 |
| 兩種結果都寫進 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 的新一節，附新跑的 sha 和 md5。 | Task 4 Step 5 |
| build 的 brain 派 implementer 時一律帶 `isolation: "worktree"`（Agent 工具內建），不自己開 worktree。 | Task 1–2（探測）、Task 7、Task 8 |
| implementer 照舊不提交。brain 的 commit file 在一個 block 的第一行多寫 `worktree <path>`，`<path>` 用 Agent 回傳的 worktree 路徑。 | Task 5（解析）、Task 7（brain 規則） |
| `scripts/commit.js` 遇到有 `worktree` 行的 block：先在那個 worktree 裡對列出的路徑做 `add`＋`commit -o`，再回到主 repo 做 `git cherry-pick <sha>`。成功就印 `<base>..<sha>`，接著 `git worktree remove`，並刪掉那條分支。 | Task 5 |
| cherry-pick 有衝突時，`commit.js` 會先 `git cherry-pick --abort`，主 repo 的 HEAD 和工作區都不動，這個 block 印 `conflict <那些路徑>`，以非零碼結束，已經落地的 block 保留。worktree 也留著。brain 看到 `conflict`，就把那個 task 放回 ready 佇列，在新的 HEAD 上自動重派一次，不問人（使用者 09-28 在 design gate 選的）。同一個 task 第二次還衝突，brain 就停下 build，在 handoff 裡寫出衝突的路徑，交給 controller 問使用者。 | Task 5（commit.js 一側）、Task 7、Task 8（brain 一側） |
| 沒有 `worktree` 行的 block，行為和今天一模一樣。 | Task 5 Step 4（既有測試不改而全綠） |
| `plantasks.ready()` 多一個 `{ worktree: true }` 選項：只有兩個 task 共用 `Modify`/`Test` 檔時，不再擋住它們；`read` 和 `interface` 兩條照擋。build 的 brain 呼叫時帶這個選項，`groups()` 和其他報告不變。 | Task 6（選項與 `--worktree`）、Task 7（brain 帶它） |
| `agents/fankeel-brain.md`、`lib/stages.js` 的 build 規則、`skills/fankeel-build/SKILL.md`、`docs/90-agent/reference/subagents.md` 的「在哪提交」一節都改寫成這個流程。`TODO.md` 那一條由交付的 task 刪掉。 | Task 7（`agents/fankeel-brain.md`、`lib/stages.js` 的 `STAGE_AGENTS`、`lib/render.js`）、Task 8（skill、`subagents.md`、`TODO.md`） |
| `nestedBrain()`：另開一個子程序，60 ms 後才寫出 meta 檔（`spawnDepth: 2`），函式要回 `true`。今天的程式碼會回 `false`。這條只在第 1 節走「改」那一支時才成立。 | Task 4 分支「改」Step 1–4 |
| `commit.js`：暫存 repo 加一個 worktree，改一個主 repo 也改過、但改在不同 hunk 的檔。block 帶 `worktree` 時，主 repo 多一個 commit，worktree 被移除。改成同一行時，印出 `conflict`，結束碼非零，`git status` 乾淨，也沒有 `CHERRY_PICK_HEAD`。今天兩種情況都會因為不認得 `worktree` 行，在 `git add` 失敗。 | Task 5 Step 1–4 |
| `ready(tasks, [], { worktree: true })`：兩個共用 `Modify` 的 task 同時 ready；一個 `Consumes` 另一個 `Produces` 的組合仍然只有前面那個 ready。 | Task 6 Step 1–4 |
| 產物：`commit.js` 印出的每一段 `<base>..<sha>`，都要等於主 repo `git log --format=%H -n 2` 讀到的前後兩個 sha。 | Task 5（第一個新測試） |
| implementer 在 worktree 裡的編輯要以主樹的邏輯路徑記進 claims，guard 才看得到鄰居撞檔。今天 `lib/guard.js` 的 `logicalPath()`（:244-248）只去掉 `.fankeel/worktrees/<hex8>/`，`hooks/touch.js:36` 把 Agent isolation 開的 worktree 裡的編輯記成原始路徑 | Task 9 |
| Agent 工具在 brain 這一層帶 `isolation: "worktree"` 時，回傳內容裡到底有沒有 worktree 的路徑和分支，而且 brain 讀得到。 | Task 1、Task 2；讀不到時 Task 7、8 停下回 design |
