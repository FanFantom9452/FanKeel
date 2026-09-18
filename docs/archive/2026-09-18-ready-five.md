---
status: current
---

# TODO.md `## Ready` 五條 Implementation Plan

**Goal:** 清空 `TODO.md` 的 `## Ready`：detail 快取進版、`wakes` 上 session 頁、memory-check 摘要數條目、reader 並行一段、`sources.md` 補列，各自刪掉自己那一條。

**Architecture:** 五個 task 都改 `TODO.md`，所以排成一條線依序做。Task 1 和 Task 2 另外共用 `lib/detail.js` 和 `tests/detail-cache.test.js`，而 Task 1 的 VERSION 3 同時涵蓋 Task 2 新加的欄位。五個都在 session 內做。

**Tech Stack:** Node.js，`node --test`，零執行期相依；`assets/station/station.js` 是瀏覽器端 ES5（`var`、`function`）。

**Spec:** [2026-09-18-ready-five-design.md](2026-09-18-ready-five-design.md)

## Global Constraints

從 `package.json`、`CONTRIBUTING.md`、`.fankeel/map.md` 與測試套件取得，值照抄：

- 測試指令是 `npm test`，展開為 `node --test`（`package.json`）。`package.json` 沒有 `dependencies` 也沒有 `devDependencies`，**不得新增任何相依**。
- 本計畫新增一個測試檔 `tests/sources-doc.test.js`，不新增 export。新檔要先 `git add` 才能跑 `npm test`：`tests/source.test.js` 讀的是 `git ls-files`（`CONTRIBUTING.md`：`a new file has to be staged (git add) before tests/source.test.js can see it`）。
- 測試需要暫存目錄時，一律用 `tests/tmp.js` 的 `tmp(prefix)`，不直接呼叫 `mkdtemp`（`tests/tmp.test.js` 的守衛會擋）。
- `lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md`：`Nothing in lib/ reaches into scripts/ or hooks/`）。
- `assets/station/station.js` 照檔內寫法：`var`、`function (…) {}`，不用箭頭函式、`const`、`let`。
- 文件歸檔照 `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/decisions` 是 decision、`docs/reports` 與 `docs/judgements` 是 report、`docs/archive` 是 archive、`skills` 與 `agents` 是 reference。`docs/archive/`、`docs/decisions/`、`docs/reports/`、`docs/judgements/` **不得編輯內容**。
- 新增的頁要在同一個 change 補 `docs/README.md` 的索引列。本計畫與 design 的兩列已在 plan 階段補好。
- VERSION 只進一次：Task 1 把 `lib/detail.js` 的 `VERSION` 改成 `3`，Task 2 加 `wakes` 時不再改。兩個 task 一起發版，所以快取裡不會有「VERSION 3 卻沒有 `wakes`」的情形。
- 基準是 `68f62d2`，porcelain 空，`npm test` 為 `ℹ tests 1512`、`ℹ pass 1512`、`ℹ fail 0`，存在 `.fankeel/build/2026-09-18-ready-five/baseline.txt`。收尾時應為 1517（五支新測試）。
- 暫存與證據放 `.fankeel/build/2026-09-18-ready-five/`（git-ignored），不放 scratchpad。證據檔開頭寫 HEAD 和 porcelain。
- `npm test` 的輸出先存檔，再用 `grep -E '^ℹ (tests|pass|fail)'` 讀；spec reporter 沒有 `ok`／`not ok` 行。exit code 取自沒有經過 pipe 的那次執行。
- 每個 task 只跑自己列出的測試檔；整套 `npm test` 在 Task 5 commit 之後跑一次，紅了就在 build 內修掉。
- Commit 用 `git commit -o <paths>`（新檔先 `git add`），訊息以 `fix:`／`docs:` 開頭、繁體中文，每一段各用一個 `-m`，最後一段是 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` 和 `Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL` 兩行。在分支 `ready-five` 上，不 push。

## Task 1: detail 快取 `VERSION` 進 3

**Files:**
- Modify: `lib/detail.js` — `:523` 的 `const VERSION = 2;` 改成 `3`
- Modify: `TODO.md` — 刪掉 `## Ready` 的〔station〕`swapped` 那條
- Test: `tests/detail-cache.test.js`

**Interfaces:**
- Consumes: `detail.detailOf(configDir, sessionId, data, opts) → { detail, fresh } | null`、`detail.keyOf(file) → string`、檔內的 `setup()` 與 `oldCache(f, fields) → { old, file }`
- Produces: 快取與 detail 上的 `v: 3`（`VERSION` 沒有 export）

**Dispatch:** in-session — 改一個常數和三行測試；派工的 brief 加上回報，比改動本身還長。

1. 寫失敗的測試。在 `tests/detail-cache.test.js` 把 `:82-83` 兩行改成：

```js
    assert.deepEqual([got.fresh, got.detail.v, Array.isArray(got.detail.days)], [true, 3, true]);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 3, 'the cache is rewritten at the new version');
```

   接著在 `tests/detail-cache.test.js` 檔尾（`:94` 的 `});` 之後）加上：

```js

test('a VERSION 2 cache, written before gate questions carried their labels, is read again even when its key still matches', () => {
    const f = setup();
    oldCache(f, { v: 2, key: detail.keyOf(f.t), at: Date.parse(T(30)) });
    const got = detail.detailOf(f.cfg, SID, f.data);
    assert.deepEqual([got.fresh, got.detail.v], [true, 3]);
});
```

2. 跑測試，確認它失敗：

```
node --test tests/detail-cache.test.js
```

   預期 `ℹ fail 2`：新測試得到 `[false, 2]`，因為 VERSION 還是 2，key 相同就原樣回傳；`:82` 那行得到 `2`。兩者都只是因為 `VERSION` 還沒改。

3. 在 `lib/detail.js` 把 `:523` 改成：

```js
const VERSION = 3;
```

4. 跑測試，確認通過：

```
node --test tests/detail-cache.test.js tests/station-detail.test.js tests/detail.test.js
```

   預期 `ℹ fail 0`。

5. 在 `TODO.md` 刪掉開頭是 ``- 〔station〕`swapped` 只數到 2610 筆 gate question 裡的 89 筆`` 的那一條，連同它後面的空行。

6. Commit：

```
git commit -o lib/detail.js tests/detail-cache.test.js TODO.md -m "fix: detail 快取 VERSION 進 3，v2 快取沒有 gate labels" -m "8be3981 在 lib/replay.js 加了 labels，卻沒有動 lib/detail.js 的 VERSION，v2 快取於是被原樣回傳，swapped 只算得到之後重讀過的 session。新測試對一份 key 仍然相符的 v2 快取，要求重讀。" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL"
```

## Task 2: `wakes` 從 detail 帶到 session 頁標頭

**Files:**
- Modify: `lib/detail.js` — `extract()` 回傳的物件在 `requests` 後面加 `wakes`
- Modify: `assets/station/station.js` — `sessionHeadHtml` 在「派工」後面加「叫醒」一格
- Modify: `TODO.md` — 刪掉〔station〕`usage.wakes` 那條
- Read: `lib/usage.js` — `summarise()` 回傳的 `usage.wakes`（`:139-141`），以及 `notificationOf()`（`:344`）認得的通知格式
- Test: `tests/detail-cache.test.js`
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: `usage.summarise(transcript, { series: true }).usage.wakes: number`；Task 1 的 `VERSION = 3`
- Produces: `detail.wakes: number`（`extract()` 回傳的欄位；舊快取沒有這個欄位）；`sessionHeadHtml(s, x)` 輸出的 `叫醒` 一格

**Dispatch:** in-session — 一個欄位加一格顯示，兩支測試；這段 plan 已經把程式碼寫全了，派出去等於照抄再多一次往返。

1. 寫失敗的測試。在 `tests/detail-cache.test.js` 檔尾（Task 1 加的那支測試之後）加上：

```js

test('wakes counts the task notifications that reached the main transcript', () => {
    const f = setup();
    assert.equal(detail.detailOf(f.cfg, SID, f.data).detail.wakes, 0);
    fs.appendFileSync(f.t, line({ type: 'user', timestamp: T(4),
        message: { content: '<task-notification><tool-use-id>b9</tool-use-id><status>completed</status></task-notification>' } }));
    assert.equal(detail.detailOf(f.cfg, SID, f.data).detail.wakes, 1, 'the grown transcript is read again');
});
```

   在 `tests/station-view.test.js` 的 `DETAIL_X`（`:578`），把 `:579` 行首的 `requests: 3, peak: 90000,` 改成：

```js
    requests: 3, wakes: 4, peak: 90000, peakN: 3, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], tasks: [],
```

   接著在 `tests/station-view.test.js` 的 `'the session header reads dollars from days and time from the timeline; the four tabs link by hash'` 裡，`assert.match(head, /2 次 gate/);` 下面加兩行：

```js
    assert.match(head, /叫醒<\/div><div class="v">4<span class="u">次<\/span>/);
    assert.match(V.sessionHeadHtml(HOME[0], Object.assign({}, DETAIL_X, { wakes: undefined })), /叫醒<\/div><div class="v">—</, 'a cache from before wakes shows a dash, not a zero');
```

2. 跑測試，確認它失敗：

```
node --test tests/detail-cache.test.js tests/station-view.test.js
```

   預期兩支失敗：detail-cache 的 `wakes` 測試拿到 `undefined`；station-view 的標頭測試找不到 `叫醒`。

3. 在 `lib/detail.js` 的 `extract()`，`:632` 的 `requests: seen ? seen.usage.requests : 0,` 下面加一行：

```js
        wakes: seen ? seen.usage.wakes : 0,
```

   在 `assets/station/station.js` 的 `sessionHeadHtml`，`var waited = …;` 那一行下面加：

```js
        var wakes = x && typeof x.wakes === 'number' ? x.wakes : null;
```

   再於 `assets/station/station.js` 同一個函式裡，`+ roHtml('派工', …)` 那一行下面加：

```js
            + roHtml('叫醒', wakes === null ? '—' : wakes + '<span class="u">次</span>', wakes === null ? '' : '派工回報叫醒主 session')
```

4. 跑測試，確認通過：

```
node --test tests/detail-cache.test.js tests/station-view.test.js tests/station-detail.test.js
```

   預期 `ℹ fail 0`。

5. 在 `TODO.md` 刪掉開頭是 ``- 〔station〕`usage.wakes` 有算沒顯示`` 的那一條，連同它後面的空行。

6. Commit：

```
git commit -o lib/detail.js assets/station/station.js tests/detail-cache.test.js tests/station-view.test.js TODO.md -m "fix: session 頁標頭加「叫醒」一格，detail 帶出 wakes" -m "lib/usage.js 早就算出 wakes，lib/detail.js 沒帶出去，頁面也沒讀。舊快取沒有這個欄位時顯示 —，不顯示 0。VERSION 3 在前一個 commit 已經進了，涵蓋這個欄位。" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL"
```

## Task 3: memory-check 的 stale 摘要行數條目，不數引用

**Files:**
- Modify: `scripts/memory-check.js` — `scan()` 的 stale 項目帶上 `name`；`report()` 的摘要行數不重複的 `name`
- Modify: `TODO.md` — 刪掉〔scripts〕memory-check 那條
- Read: `lib/report.js` — `section(title, rows, max)`（`:51`）：沒有列時回傳空陣列，否則輸出 `''`、原樣不縮排的 `title`，再每列加兩格縮排
- Test: `tests/memory-check.test.js`

**Interfaces:**
- Consumes: `scan(root, configDir) → { dir, present, findings, stale, indexed, onDisk }`、`report(result) → string`、檔內的 `tmpProject()`、`tmpConfig()`、`initGit(root)`、`commitAll(root, msg)`、`memoryDir(configDir, root)`
- Produces: stale 項目的形狀變成 `{ tag: 'stale', name: string, what: string }`

**Dispatch:** in-session — 一個欄位加一行計數，外加一支測試；這段 plan 已經把程式碼寫全了。

1. 寫失敗的測試。在 `tests/memory-check.test.js` 檔尾加上：

```js

test('report() counts stale entries, not the citations they carry', () => {
  const root = tmpProject();
  initGit(root);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'v1\n');
  fs.writeFileSync(path.join(root, 'lib', 'other.js'), 'v1\n');
  commitAll(root, 'add two files');
  const configDir = tmpConfig();
  const dir = memoryDir(configDir, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- [K note](k-note.md) — a hook\n');
  fs.writeFileSync(path.join(dir, 'k-note.md'),
    '---\nname: k-note\ndescription: x\nmetadata:\n  type: reference\n  modified: 2020-01-01T00:00:00.000Z\n---\n\nSee `lib/thing.js` and `lib/other.js`.\n');
  const result = scan(root, configDir);
  assert.equal(result.stale.length, 2);
  assert.match(report(result), /^1 entry cites a file changed since it was written, 2 citations:$/m);
});
```

2. 跑測試，確認它失敗：

```
node --test tests/memory-check.test.js
```

   預期 `ℹ fail 1`：摘要行印的是 `2 entries cite a file changed since they were written:`。

3. 在 `scripts/memory-check.js` 的 `scan()`，把 `stale.push(…)` 那一行改成：

```js
                stale.push({ tag: 'stale', name, what: name + ' cites ' + ref + ', changed since this entry was last touched' });
```

   在 `scripts/memory-check.js` 的 `report()`，把現在的 `lines.push(...section(result.stale.length + (result.stale.length === 1` 那一段（到 `result.stale.map((f) => f.what), MAX_FINDINGS));` 為止）換成：

```js
    const staleEntries = new Set(result.stale.map((f) => f.name)).size;
    const staleTitle = staleEntries + (staleEntries === 1
        ? ' entry cites a file changed since it was written'
        : ' entries cite a file changed since they were written');
    lines.push(...section(staleTitle
        + (result.stale.length === staleEntries ? ':' : ', ' + result.stale.length + ' citations:'),
        result.stale.map((f) => f.what), MAX_FINDINGS));
```

4. 跑測試，確認通過：

```
node --test tests/memory-check.test.js
```

   預期 `ℹ fail 0`。接著對本 repo 真正的 memory 跑一次，存下摘要行：

```
node scripts/memory-check.js > .fankeel/build/2026-09-18-ready-five/memory-check.txt; echo "exit $?"
```

   摘要行的條目數要等於不重複條目數：`grep -E '^  [^ ]+\.md cites' .fankeel/build/2026-09-18-ready-five/memory-check.txt | awk '{print $1}' | sort -u | wc -l`。

5. 在 `TODO.md` 刪掉開頭是 ``- 〔scripts〕`scripts/memory-check.js` 把 stale 的引用數當條目數印`` 的那一條，連同它後面的空行。

6. Commit：

```
git commit -o scripts/memory-check.js tests/memory-check.test.js TODO.md -m "fix: memory-check 的 stale 摘要行數條目，不數引用" -m "每個引用推一筆 stale，摘要行卻直接用 .length，49 個引用分散在 27 條裡，印出來是 49 entries。現在數不重複的條目，數字不同時在後面補上引用數；下方的清單仍是一個引用一行。" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL"
```

## Task 4: reader 把互不相依的呼叫放進同一個回應

**Files:**
- Modify: `agents/fankeel-reader.md` — `## Searching` 末尾加一段
- Modify: `TODO.md` — 刪掉〔agents〕`fankeel-reader.md` 那條
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: 檔內的 `ROOT`（repo 根目錄）
- Produces: none

**Dispatch:** in-session — 一段四行的文字加一支測試。

1. 寫失敗的測試。在 `tests/agents.test.js` 檔尾加上：

```js

// A reader that sends one call per turn reads like a slow pipeline; what is
// slow is the turn count, not git.
test('the reader is told to send reads that do not depend on each other in one response', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const searching = text.split('\n## Searching\n')[1].split('\n## ')[0];
    assert.match(searching, /same response/);
});
```

2. 跑測試，確認它失敗：

```
node --test tests/agents.test.js
```

   預期 `ℹ fail 1`：`## Searching` 裡沒有 `same response`。

3. 在 `agents/fankeel-reader.md` 的 `## Searching`，`:41` 的 `own.` 後面、`## Refusals` 前面的空行之前，加上：

```md

Reads that do not depend on one another go out in the same response: several
`Read`, `Grep` and `Bash` calls in one turn run together, and one call per
turn is what makes a reader look like a pipeline when nothing it read was
slow. Only a call that needs the previous one's answer waits for it.
```

4. 跑測試，確認通過：

```
node --test tests/agents.test.js
```

   預期 `ℹ fail 0`。

5. 在 `TODO.md` 刪掉開頭是 ``- 〔agents〕`fankeel-reader.md` 沒叫它把互不相依的 Read/Grep 放在同一個回應`` 的那一條，連同它後面的空行。

6. Commit：

```
git commit -o agents/fankeel-reader.md tests/agents.test.js TODO.md -m "fix: fankeel-reader 的 Searching 加一段，互不相依的呼叫放同一個回應" -m "reader 看起來像一條 pipeline，是因為模型一回合只發一個工具呼叫，不是 git 讀得慢。" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL"
```

## Task 5: `docs/sources.md` 補 `WAITING-PROBES-260915`，加一報告一列的守衛

**Files:**
- Modify: `docs/sources.md` — `:15-19` 改寫、`:39` 標題、`:60` 後面補一列
- Modify: `TODO.md` — 刪掉〔docs〕`docs/sources.md` 那條
- Read: `docs/reports/2026-09-15-waiting-probes.md` — 新列七格的來源：`:3` 日期、`:4-8` 出處、`:13` 量什麼、`:15`、`:34`、`:50`、`:70`、`:88`、`:120-122` 範圍
- Test: `tests/sources-doc.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 新列七格和那句改寫都已經照報告逐字寫在下面；剩下的是一個新測試檔和一次 `git add`。

1. 寫失敗的測試。新增 `tests/sources-doc.test.js`，內容：

```js
'use strict';
// docs/sources.md is the evidence ledger: one row per dated report at the top
// level of docs/reports/. A row is added by hand, and twice a report sat there
// without one until somebody counted — docs/archive/2026-09-09-gate-and-controls-design.md
// §4, and 2026-09-15-waiting-probes.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('every top-level report has exactly one row in docs/sources.md, and every row links a report that is there', () => {
    const reports = fs.readdirSync(path.join(ROOT, 'docs', 'reports')).filter((f) => f.endsWith('.md')).sort();
    const text = fs.readFileSync(path.join(ROOT, 'docs', 'sources.md'), 'utf8');
    const linked = [...text.matchAll(/^\|[^\n]*?\]\(reports\/([^)/]+\.md)\)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(linked, reports);
});
```

   然後 `git add tests/sources-doc.test.js`。

2. 跑測試，確認它失敗：

```
node --test tests/sources-doc.test.js
```

   預期 `ℹ fail 1`，diff 只少一個 `2026-09-15-waiting-probes.md`。如果還出現其他差異，代表 regex 沒有正確讀出今天那 20 列，先修 regex 再往下做。

3. 在 `docs/sources.md` 把 `:15-19` 的五行：

```md
`docs/reports/`. Twenty-one sit there and twenty have a row —
`2026-09-15-waiting-probes.md` has none yet: the heading counts rows across
both tables and not files, and today the two numbers do not agree.
When they stop agreeing it is the heading that has to move, because a row can
only be added by hand and a report cannot.
```

   在 `docs/sources.md` 換成：

```md
`docs/reports/`. Twenty-one sit there and twenty-one have a row; the heading
counts rows across both tables, not files. A row is still added by hand, and
`tests/sources-doc.test.js` fails while a report there has none — the heading
is the one number left to keep in step by hand.
```

   在 `docs/sources.md` 把 `:39` 的 `## The twenty reports` 改成 `## The twenty-one reports`。

   在 `docs/sources.md` 的 `INTENT-SIGNAL-260912` 那一列（`:60`）後面、`SEVENTEEN-ITEMS-260918` 那一列前面，插入這一列：

```md
| `WAITING-PROBES-260915` | Whether the five `## Waiting` entries of 2026-09-15 could lift — each `lifts when:` named a run fankeel had to do itself, not an event in the world — by doing each run: three scripted probes and two eval re-runs | [reports/2026-09-15-waiting-probes.md](reports/2026-09-15-waiting-probes.md) | 2026-09-15 | measured — three scripted probes with a control arm each, and two evals re-run five times on one commit; `provenance.txt` pins the HEAD sha and `claude --version` | Each of the five is a small run on one commit, not a series. Two of the three control arms caught a wrong conclusion before it was written: the dispatch probe's first round ran under `bypassPermissions`, where `--allowedTools` is a no-op, and the link probe's first grader matched the injected `SKILL.md` body rather than the model's answer. The `auto` half of the `permissions.deny` probe tested the `--permission-mode auto` flag, not the `defaultMode: "auto"` settings key the page asked about. The link probe covers an invoked skill, whose body arrives injected; a reader handed the `SKILL.md` path and left to open it was not run. `route-typo`'s five greens say it did not flip on that commit, that model, that day — the flips it was filed for were measured on two different commits. | `docs/README.md`, `docs/collisions.md`, `docs/decisions/2026-09-05-skill-split-design.md`, `docs/decisions/2026-09-10-todo-ten.md`, `docs/decisions/2026-09-11-todo-eight.md`, `docs/decisions/fankeel-shell.md` |
```

4. 跑測試，確認通過：

```
node --test tests/sources-doc.test.js tests/source.test.js
```

   預期 `ℹ fail 0`。另外跑 `node scripts/docs-check.js`，預期 exit 0。

5. 在 `TODO.md` 刪掉開頭是 ``- 〔docs〕`docs/sources.md` 沒有 `2026-09-15-waiting-probes.md` 的列`` 的那一條，連同它後面的空行。這時 `## Ready` 底下已經沒有條目。跑 `node scripts/todo-check.js`，預期 exit 0，並印出 `0 ready`。

6. Commit：

```
git commit -o docs/sources.md tests/sources-doc.test.js TODO.md -m "docs: sources.md 補上 WAITING-PROBES-260915，加一份報告一列的守衛" -m "頂層報告有 21 份，表格只有 20 列。新列七格都取自報告本身；:15 那句原本在解釋兩個數字為什麼不一致，補完後改寫。tests/sources-doc.test.js 在任何一份頂層報告沒有對應列時轉紅，同一種漏列之前已經出現過兩次。" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wgzkxj56YbN433pTaocdgL"
```

7. 跑整套測試，存下輸出：

```
npm test > .fankeel/build/2026-09-18-ready-five/final-npm.txt 2>&1; echo "exit $?"
grep -E '^ℹ (tests|pass|fail)' .fankeel/build/2026-09-18-ready-five/final-npm.txt
```

   預期 exit 0，`ℹ pass 1517`、`ℹ fail 0`。

## Coverage

| promise | task |
|---|---|
| `lib/detail.js:523` 的 `const VERSION = 2;` 改成 `3`。`8be3981` 在 `lib/replay.js` 加了 `labels` | Task 1 |
| `tests/detail-cache.test.js:82-83` 寫死的兩個 `2` 改成 `3`，另外加一支測試：key 對得上的 v2 快取也要重讀。 | Task 1 |
| 刪掉 `TODO.md` `## Ready` 的〔station〕`swapped` 那條。 | Task 1 |
| `lib/detail.js:632` 的 `requests` 旁邊加 `wakes: seen ? seen.usage.wakes : 0,`。第 1 節的 VERSION 3 也涵蓋這個新欄位 | Task 2 |
| `assets/station/station.js` 的 `sessionHeadHtml` 在「派工」後面加一格「叫醒」。舊快取沒有 `wakes`，那一格顯示 `—`，不顯示 `0`。 | Task 2 |
| 刪掉 `TODO.md` 的〔station〕`usage.wakes` 那條。 | Task 2 |
| `scripts/memory-check.js` 的每個 stale 項目加上 `name`，摘要行改數不重複的 `name`。條目數和引用數不同時，冒號前面補 `, N citations`。 | Task 3 |
| 下方逐條列出的內容不變，仍是一個引用一行。 | Task 3 |
| 刪掉 `TODO.md` 的〔scripts〕memory-check 那條。 | Task 3 |
| `agents/fankeel-reader.md` 的 `## Searching` 加一段：互不相依的 `Read`、`Grep`、`Bash` 放在同一個回應裡一起發，只有用得到上一個結果的呼叫才需要等。 | Task 4 |
| 刪掉 `TODO.md` 的〔agents〕`fankeel-reader.md` 那條。 | Task 4 |
| 在 `INTENT-SIGNAL-260912` 和 `SEVENTEEN-ITEMS-260918` 之間補一列，七格都從 `docs/reports/2026-09-15-waiting-probes.md` 取材。 | Task 5 |
| `:39` 的標題改成 `## The twenty-one reports`。`:15-19` 那句「twenty have a row」連同後面解釋兩個數字為何對不上的部分一起改寫 | Task 5 |
| 新增 `tests/sources-doc.test.js`：`docs/reports/` 頂層的每份報告，都要對應到表格 Link 欄裡恰好一列。這支測試不在條目寫的改法裡。加它是因為同一種漏列 09-09 和 09-15 各出現過一次 | Task 5 |
| 刪掉 `TODO.md` 的〔docs〕`docs/sources.md` 那條。 | Task 5 |
| v2 快取會重讀 | Task 1 |
| `wakes` 帶出並顯示 | Task 2 |
| stale 摘要行數條目 | Task 3 |
| reader 的新段落在 `## Searching` 裡 | Task 4 |
| sources.md 一份報告一列 | Task 5 |
| Ready 清空 | Task 5 |
| 沒有弄壞既有的東西 | Task 5 |
