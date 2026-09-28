---
status: current
last_verified: 2026-09-28
---

# 三件收尾 Implementation Plan

**Goal:** 釘住 `addNote` 的 trim-order、把 `relPath` 唯一真正的重複換掉並刪掉錯的 14 檔註解、實測 `SubagentStart` 與 `agent-<id>.meta.json` 寫入的先後。
**Architecture:** 四個 task，前三個互不重疊。Task 1 只加測試；Task 2 改 `scripts/tune.js` 一行、刪 `lib/guard.js` 一段註解；Task 3 照 `2026-09-28-subagent-hook-probe` 的 evidence 形狀跑一次 headless `claude -p`；Task 4 讀它的 `summary.json` 寫報告。
**Tech Stack:** Node built-ins only, `node --test`; sh for the probe; `claude -p` (haiku) for its one run.
**Spec:** [2026-09-28-three-leftovers-design.md](2026-09-28-three-leftovers-design.md)

## Global Constraints

- Node built-ins only: `package.json` has no `dependencies` or `devDependencies`; add none. Tests run with `node --test` (`npm test`).
- `'use strict';` at the top of every JS file; CommonJS; 4-space indentation in `lib/` and `scripts/`, 2-space in `tests/` — match the surrounding file.
- `.gitattributes`: `* text=auto eol=lf` — write LF only.
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires from `scripts/` or `hooks/` (CONTRIBUTING.md:15). `scripts/` may require `lib/`.
- A new doc page gets its row in `docs/README.md` in the same change (CONTRIBUTING.md:20).
- Report pages are write-once snapshots: frontmatter `status: current`, `last_verified: <date>`, `source_of_truth: <evidence paths>`; every figure comes from a file under the evidence directory.
- A `TODO.md` entry is removed by the task that delivers it, in the same change.
- Implementers run only their own test file; the parent runs the full suite before committing.

## Coverage

| promise | task |
|---|---|
| `tests/registry.test.js` 加一則：`addNote(root, SID, 'x ')` 之後 `addNote(root, SID, 'x')` 回 `false` | Task 1 |
| `TODO.md` 刪掉 `## Ready` 裡以 `〔tests〕` 開頭、講 `appendUnique` 的那條。 | Task 1 |
| 審查結論：ac58fc9b 加在 `relPath` 上面的那段註解說「14 個檔手寫 `path.join(...).replace(/\\/g, '/')`，換成 `relPath` 不保行為」，框架錯了。那 14 個檔裡的 `replace(/\\/g, '/')` 幾乎都在正規化已經是相對的字串，或組出絕對路徑，跟 `relPath` 算的不是同一件事；真正在算「相對專案根」的只有 `scripts/tune.js` 的 `/__live/request` 那行 `path.relative(root, file).replace(/\\/g, '/')`。 | Task 2 |
| `scripts/tune.js` 那行改呼叫 `lib/guard.js` 的 `relPath(root, file)`。 | Task 2 |
| `lib/guard.js` 刪掉那段 14 檔的註解，`relPath` 的註解留原本前三行。 | Task 2 |
| `TODO.md` 刪掉 `## Ready` 裡以 `〔trim〕` 開頭的那條。 | Task 2 |
| 用 headless `claude -p` 掛一個只記錄的 `SubagentStart` hook，派一個會再派子 agent 的 agent（深度 2），記下 hook 觸發當下 `agent-<id>.meta.json` 在不在、內容、以及之後多久出現。 | Task 3 |
| 腳本、hook、原始輸出與 `provenance.txt` 放 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/`。 | Task 3 |
| 報告 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md`，登入 `docs/README.md`。 | Task 4 |
| `TODO.md` 的 Watch「spawnDepth 讀檔時序未證實」：檔案在 hook 觸發時已存在且帶 `spawnDepth` → 整個 timing 刪掉；不在 → 那條移到 `## Needs a decision`，連到報告。 | Task 4 |
| trim-order | Task 1 |
| relPath | Task 2 |
| 時序 | Task 3, Task 4 |
| 全套 | all — the parent runs `npm test` before each commit |

## Task 1: pin addNote's trim-before-dedupe order

**Files:**
- Modify: `TODO.md` — remove the `## Ready` bullet starting `〔tests〕`appendUnique``
- Read: `lib/registry.js` — `addNote` trims, then calls `appendUnique`; nothing there changes
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one test and one TODO line, both spelled out here.

- [ ] **Step 1: write the test.** In `tests/registry.test.js`, directly after the test whose name starts `a note that repeats` (the one calling `addNote(root, SID, 'same lesson')` ten times) — or, if that name differs, after the last `addNote` test in the `task memory` section — add:

```js
test('a note is trimmed before it is compared, so a padded repeat is dropped', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  assert.equal(registry.addNote(root, SID, 'x '), true);
  assert.equal(registry.addNote(root, SID, 'x'), true); // update() reports an already-held value as success, as addClaim does
  assert.deepEqual(registry.notesOf(registry.readSession(root, SID)), ['x']);
});
```

- [ ] **Step 2: run it.** `node --test tests/registry.test.js` — it passes on today's code; that is expected, the test pins behaviour that already holds.

- [ ] **Step 3: show it can fail.** In `lib/registry.js`'s `addNote`, temporarily pass the raw `note` to `appendUnique` in place of `text` (the `appendUnique(projectRoot, sessionId, 'notes', text,` call). Run `node --test tests/registry.test.js`: the new test must fail. Revert the edit with `git checkout -- lib/registry.js` and run it again: green. Put both outputs' pass/fail lines in the return.

- [ ] **Step 4: close the TODO entry.** In `TODO.md`, delete the whole `## Ready` bullet that starts `- 〔tests〕`appendUnique` 的去重在 trim 之後比對` and the blank line after it.

- [ ] **Step 5: commit request.** Do not commit; return the changed paths.

## Task 2: relPath — swap the one real duplicate, drop the wrong comment

**Files:**
- Modify: `scripts/tune.js` — the `/__live/request` handler's `page:` uses `relPath(root, file)`
- Modify: `lib/guard.js` — delete the five-line paragraph above `relPath` that lists 14 files
- Modify: `TODO.md` — remove the `## Ready` bullet starting `〔trim〕`
- Read: `lib/guard.js` — `relPath(root, file)` returns a forward-slash repo-relative path, or null outside root
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: `relPath(root, file)` from `lib/guard.js` (exported at its `module.exports` line)
- Produces: none

**Dispatch:** implementer, sonnet — two small edits spelled out here, and one assertion to add.

- [ ] **Step 1: pin the stored page.** In `tests/tune.test.js`, find the test that POSTs `{ page: '/page.html', block: 'now', note: '改成 3 / 5' }` and reads back `made` (the first such POST in the file). After it reads the request back from the queue, it must assert the stored `page` is `'page.html'`. If that test already reads the queued entry, add to it, in `tests/tune.test.js`:

```js
  assert.equal(queued.page, 'page.html');
```

  where `queued` is whatever name that test gives the entry it read back; if it reads none, read the queue file the same way the nearest test that inspects a queued entry does, and assert on it. Run `node --test tests/tune.test.js`: green before the change.

- [ ] **Step 2: swap the call.** In `scripts/tune.js`, below the `readBody` require line, add:

```js
const { relPath } = require('../lib/guard.js');
```

  and in `scripts/tune.js`, in the `append({ id, status: 'queued', page: ...` line, replace

```js
page: upstream ? page : path.relative(root, file).replace(/\\/g, '/'),
```

  with, in `scripts/tune.js`,

```js
page: upstream ? page : relPath(root, file),
```

  `file` comes from `resolveInside(root, page)` two dozen lines above and the handler has already returned 400 when it is falsy, so `relPath` cannot see a path outside root here.

- [ ] **Step 3: delete the comment.** In `lib/guard.js`, remove these lines above `function relPath` (and the `//` blank line that precedes them), keeping the three-line comment above them:

```text
// Still duplicated by hand as `path.join(...).replace(/\\/g, '/')` in 14 files:
// lib/docs.js, lib/handoff.js, lib/map.js, lib/overlap.js, lib/render.js,
// scripts/archive.js, scripts/await.js, scripts/docs-check.js,
// scripts/input-check.js, scripts/orient.js, scripts/survey.js, scripts/task.js,
// scripts/tune.js, hooks/budget.js. Swapping each to call this instead isn't
// behaviour-preserving, since relPath returns null outside the project root
// where those call sites don't — see TODO.md's 〔trim〕 entry.
```

  The reason, for the commit message: those `replace(/\\/g, '/')` calls normalise strings that are already relative, or build absolute paths; only `scripts/tune.js` computed a root-relative path, and Step 2 swapped it.

- [ ] **Step 4: close the TODO entry.** In `TODO.md`, delete the whole `## Ready` bullet that starts `- 〔trim〕約 14 個檔各自` and the blank line after it.

- [ ] **Step 5: run.** `node --test tests/tune.test.js tests/guard.test.js` green; `grep -n "Still duplicated by hand" lib/guard.js` prints nothing.

- [ ] **Step 6: commit request.** Do not commit; return the changed paths.

## Task 3: measure SubagentStart against the meta file

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/record.js` — new: the SubagentStart hook and its `after` pass
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh` — new: one headless run; it writes `settings.json`, `agents.json`, `provenance.txt`, `hook-log.jsonl`, `claude-out.json`, `claude-err.txt`, `summary.json` beside itself
- Modify: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/summary.json` — written by `run.sh`, never by hand
- Read: `docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/run.sh` — the probe shape this copies
- Read: `lib/usage.js` — `sessionDirOf(transcriptPath)`, which `hooks/brief.js`'s `nestedBrain` uses to find `subagents/agent-<id>.meta.json`
- Read: `hooks/brief.js` — `nestedBrain(payload)`, the code whose assumption is being measured

**Interfaces:**
- Consumes: `sessionDirOf` from `lib/usage.js`
- Produces: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/summary.json` — an array of `{ agent_id, agent_type, atHook, depthAtHook, existsAfter, depthAfter, parentAfter, mtimeMinusHookMs }`

**Dispatch:** implementer, sonnet — the scripts are written out here; the run is one haiku session.

- [ ] **Step 1: write the hook.** Create `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/record.js`:

```js
#!/usr/bin/env node
'use strict';
// SubagentStart probe for hooks/brief.js's nestedBrain(): at the moment the hook
// fires, is subagents/agent-<id>.meta.json already on disk, and what does it say?
// `node record.js after` re-reads every recorded meta file once the run is over
// and prints, per agent, whether it exists now and its mtime against the hook's.
const fs = require('node:fs');
const path = require('node:path');
const { sessionDirOf } = require('../../../../../lib/usage.js');

const LOG = path.join(__dirname, 'hook-log.jsonl');

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
        return {
            agent_id: r.agent_id,
            agent_type: r.agent_type,
            atHook: r.atHook.exists,
            depthAtHook: r.atHook.exists && r.atHook.body && typeof r.atHook.body === 'object' ? r.atHook.body.spawnDepth : null,
            existsAfter: now.exists,
            depthAfter: now.exists && now.body && typeof now.body === 'object' ? now.body.spawnDepth : null,
            parentAfter: now.exists && now.body && typeof now.body === 'object' ? now.body.parentAgentId || null : null,
            mtimeMinusHookMs: now.exists ? Math.round(now.mtimeMs - r.hookAt) : null,
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
        const atHook = metaFile ? statOf(metaFile) : { exists: false };
        fs.appendFileSync(LOG, JSON.stringify({ hookAt, agent_id: payload.agent_id, agent_type: payload.agent_type, transcript_path: payload.transcript_path, metaFile, atHook }) + '\n');
    });
}
```

- [ ] **Step 2: write the run script.** Create `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh`:

```sh
#!/usr/bin/env sh
# Runs the spawnDepth timing probe once. See ../../2026-09-28-spawndepth-timing.md.
# Copies the shape of ../2026-09-28-subagent-hook-probe/run.sh; adds --agents so a
# subagent can dispatch one of its own (depth 2), which is the case nestedBrain() reads.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing"
cd "$REPO" || exit 1

rm -f "$OUT/hook-log.jsonl"

cat > "$OUT/settings.json" <<JSON
{
  "hooks": {
    "SubagentStart": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/record.js\"", "timeout": 5 } ] } ]
  }
}
JSON

cat > "$OUT/agents.json" <<'JSON'
{
  "nester": {
    "description": "Dispatches exactly one leaf agent and relays its answer.",
    "prompt": "Use the Agent tool exactly once, subagent_type \"leaf\", prompt \"reply with the single word leaf\". Then reply with exactly what it returned.",
    "tools": ["Agent"],
    "model": "haiku"
  },
  "leaf": {
    "description": "Replies with one word.",
    "prompt": "Reply with the single word leaf. Use no tools.",
    "tools": ["Read"],
    "model": "haiku"
  }
}
JSON

PROMPT='Use the Agent tool exactly once, subagent_type "nester", prompt "go". Then reply with exactly what it returned.'

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "record.js md5: $(md5sum "$OUT/record.js" | cut -d' ' -f1)"
  echo "run.sh md5: $(md5sum "$OUT/run.sh" | cut -d' ' -f1)"
} > "$OUT/provenance.txt"

claude -p "$PROMPT" \
  --output-format json \
  --model haiku \
  --settings "$OUT/settings.json" \
  --agents "$OUT/agents.json" \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit Bash" \
  < /dev/null > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

echo "claude exit $?" >> "$OUT/provenance.txt"
node "$OUT/record.js" after > "$OUT/summary.json"
cat "$OUT/summary.json" >> "$OUT/provenance.txt"
```

- [ ] **Step 3: run it.** `sh docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/run.sh`. It must leave `hook-log.jsonl` with two rows — one `agent_type` `nester`, one `leaf`. If it has one row, the nester could not dispatch: read `claude-err.txt` and `claude-out.json`, fix the cause in `run.sh` (for example `--agents` taking inline JSON rather than a path — `claude --help` says `<json-or-file>`), and run again; say in the return what was changed and why. Never edit `hook-log.jsonl` or `summary.json` by hand. Do not run it more than three times.

- [ ] **Step 4: commit request.** Do not commit; return the changed paths, `summary.json`'s rows verbatim, and how many runs it took.

## Task 4: the timing report, its index row, and the Watch entry

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` — new report page
- Modify: `docs/README.md` — one row for the new report, beside the `2026-09-28-subagent-hook-probe.md` row
- Modify: `TODO.md` — the `## Watch` timing `spawnDepth 讀檔時序未證實`, per Step 3
- Read: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/summary.json` — Task 3's result; every figure on the page comes from it or its siblings
- Read: `hooks/brief.js` — the `nestedBrain` comment the page quotes

**Interfaces:**
- Consumes: `summary.json` from Task 3 — `{ agent_type, atHook, depthAtHook, existsAfter, depthAfter, mtimeMinusHookMs }` per row
- Produces: none

**Dispatch:** implementer, sonnet — the page's sections and its two possible TODO outcomes are spelled out here.

- [ ] **Step 1: write the report.** Create `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` in 繁體中文, frontmatter:

```md
---
status: current
last_verified: 2026-09-28
source_of_truth: `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/` 下的 `hook-log.jsonl`、`summary.json`、`provenance.txt`、`claude-out.json`；`record.js` 與 `run.sh` 的 md5 記在 `provenance.txt`。本頁每一個數字都從那些檔來
---
```

  Then four sections: `## 問題` (quote `hooks/brief.js`'s `nestedBrain` comment's claim that an absent file reads as depth 1); `## 怎麼量` (the run, its sha from `provenance.txt`, the two agents); `## 結果` — a table with one row per `summary.json` entry: `agent_type`, `atHook`, `depthAtHook`, `existsAfter`, `depthAfter`, `mtimeMinusHookMs`, copied from `summary.json`; `## 結論` — one of: the meta file was on disk with `spawnDepth` at hook time for both agents (the fix works); it was not (the fix falls back to marking inflight, as the comment says); or mixed, stating which. Each sentence in `## 結論` names the `summary.json` field it rests on.

- [ ] **Step 2: index it.** In `docs/README.md`, below the `subagent-hook-probe` report row, add one row of the same two-column shape: first cell a one-sentence finding in 繁體中文, second cell `[reports/2026-09-28-spawndepth-timing.md](90-agent/reports/2026-09-28-spawndepth-timing.md) — *a dated snapshot, 繁體中文*`.

- [ ] **Step 3: move the Watch entry.** In `TODO.md` under `## Watch`: if `summary.json` shows `atHook: true` with a numeric `depthAtHook` on both rows, delete the `### spawnDepth 讀檔時序未證實` heading, its `if:` line, its bullet and the blank line after it. Otherwise delete the same lines and add under `## Needs a decision` this one bullet (`todo-check` refuses a link to a report, so the link is to the code and the report is named in backticks):

```md
- 〔stage-agents〕SubagentStart 觸發時 `agent-<id>.meta.json` 還不在或不帶 `spawnDepth`，`nestedBrain()` 退回原本行為；要不要改讀法，實測見 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md` — [hooks/brief.js](hooks/brief.js).
```

  (that fence's file is `TODO.md`).

- [ ] **Step 4: check.** `node scripts/todo-check.js` exits 0; `node scripts/docs-check.js --role report` names nothing on the new page.

- [ ] **Step 5: commit request.** Do not commit; return the changed paths and which of the two Step 3 outcomes applied.
