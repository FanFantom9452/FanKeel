---
status: current
---

# Station 三層 Implementation Plan

**Goal:** station 的總覽換成三層——30 天直方圖首頁、專案頁、session 時間線——每一層的時間、token 與錢都從 detail 快取裡按日切好的 `days` 與 `spans` 加總。
**Architecture:** 資料半部（Task 1–4）在 `lib/` 裡把每筆 request 依日期、stage、model、主 session 或 agent 切好，存進 detail 快取，再由 `serialize()` 帶進 `station-data.js`。頁面半部（Task 5–8）依已核准的 mockup 重做 shell 與樣式，並在 `assets/station/station.js` 裡加上 hash 路由與三層頁面。兩半只透過 design 約定的欄位相接，彼此不共用檔案；Task 9 最後把文件與 `TODO.md` 改成新的樣子。
**Tech Stack:** Node 24（2026-09-14 `node -v` 為 v24.9.0），沒有 dependencies；`node --test` 與 spec reporter；瀏覽器端是 ES5 的 `assets/station/station.js` 與手寫 inline SVG。
**Spec:** 2026-09-14-station-three-levels-design.md

## Global Constraints

- 測試指令就是 `node --test`（`package.json` 的 `scripts.test`）。`package.json` 沒有 `dependencies`，也不新增。沒有 `CLAUDE.md`；慣例在 `CONTRIBUTING.md`。
- spec reporter 印的是 `✔`/`✖` 與 `ℹ pass N`/`ℹ fail N`；用 `grep -E '^(ℹ (pass|fail)|✖)'` 過濾，永遠不要 grep `ok`。
- `lib/` 是純函式，不 require `scripts/` 或 `hooks/`，只有反方向 — `CONTRIBUTING.md:15`。
- 每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js` 才看得到 — `CONTRIBUTING.md:19`。
- `lib/station.js` 的 `EMITTED` 不新增名字：頁面仍是 `index.html` 加上 `station/` 底下的 `station.css`、`station.js`、`station-data.js` 與 `detail/<id>.js` — `tests/station.test.js:532`、`CONTRIBUTING.md:21`。
- `scripts/station.js` 不加新 flag；加了就要在 `docs/station.md` 有一列，否則 `tests/station-doc.test.js` 紅 — `CONTRIBUTING.md:16`。
- `assets/station/station.js` 是 ES5：2026-09-14 計數 218 個 `var`、0 個 `const`/`let`、0 個 `=>`，整檔包在 `(function (w, doc) {` 裡；可測的純函式放在 `module.exports` guard 上方並從那裡 export，guard 下方碰 DOM、不進 `node --test` — `assets/station/station.js:6-9`、`assets/station/station.js:158`。新程式照這個寫法。
- 縮排四個空格，檔頭 `'use strict';` — `assets/station/station.js:1`、`assets/station/station.js:12`、`tests/station-view.test.js:27`。
- 頁面不載入任何外部資源，沒有外部 script、字型或圖片 — `docs/decisions/2026-09-04-session-station-design.md:120`；shell 不含絕對路徑 — `tests/station-shell.test.js:44`。
- shell 保留六個 id：`side`、`q`、`gen`、`nreg`、`cfg`、`page` — `tests/station-shell.test.js:51`；`render()` 的輸出與 `assets/station/index.html` 逐位元組相同 — `tests/station.test.js:514`；同一個 model 寫第二次只動 `station-data.js` 的 mtime — `tests/station.test.js:543`。
- hook 觸發的 `write()` 讀 transcript 有時間上限 `DETAIL_BUDGET_MS = 1500` — `lib/station.js:480`。新欄位在 `extract()` 同一次讀取裡算出，不另外讀檔。
- 做完的人在同一個變更裡刪掉 `TODO.md` 的條目 — `TODO.md:4-5`；之後 `node scripts/todo-check.js` exit 0。
- `docs/station.md` 是 reference 頁（`.fankeel/map.md` filing：`docs — reference`）。`docs/archive/`、`docs/decisions/`、`docs/reports/`、`docs/judgements/` 與這份以外的 plan 都不改。
- 視覺依據是 `.fankeel/build/2026-09-14-station-three-levels/mockup.html`（不 commit）。mockup 與 design 衝突時以 design 為準：時間 × 依 model 這個組合停用。
- implementer 只跑自己任務寫的測試檔，做到 commit 之前為止；commit 與排在它後面的 mutation 步驟由 parent 執行。mutation 一定在該任務 commit 之後：`git checkout -- <file>` 還原到剛 commit 的版本，commit 之前還原會連實作一起洗掉。
- 基線在 `a50c000`，逐檔 `node --test tests/<file> 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`：`tests/usage-series.test.js` `ℹ pass 4`、`tests/dispatches.test.js` `ℹ pass 7`、`tests/detail.test.js` `ℹ pass 8`、`tests/detail-cache.test.js` `ℹ pass 3`、`tests/station-detail.test.js` `ℹ pass 3`，五檔都 `ℹ fail 0`。
- 步驟裡的行號都是 `a50c000` 的行號。同一檔的多處修改由下往上做，前一處才不會移動後一處的行號；前一個任務已經動過的檔，用步驟裡的 `grep -n` 找位置。
- 測試裡要斷言日期的時間用本地時間組（`new Date(2026, 8, d, h, m, 0).toISOString()`），日期在任何時區都相同；只斷言 stage 或毫秒的時間沿用各檔既有的 `T(s)`。
- `vm.runInNewContext` 產出的物件屬於另一個 realm，strict 的 `assert.deepEqual` 連原型一起比；跨 realm 比較先過 `JSON.parse(JSON.stringify(...))`。
- Task 2 export `dayOf`，Task 2 的測試以 `detail.dayOf` 讀它，所以 Task 2 單獨 commit 時 `tests/source.test.js` 也找得到 importer；Task 4 起 `lib/station.js` 是正式的 importer — `CONTRIBUTING.md:19`。
- Task 1–4 的程式碼與測試，起草時已在 `a50c000` 的 `git archive` 副本上照本文套用：那五個測試檔全綠，`tests/usage.test.js`、`tests/station.test.js`、`tests/detail-tasks.test.js`、`tests/replay.test.js`、`tests/station-view.test.js`、`tests/station-dispatch-view.test.js`、`tests/station-panel.test.js`、`tests/station-cli.test.js` 也 `ℹ fail 0`，每個 mutation 紅的是步驟點名的測試。副本不是 git 樹，沒有跑整套與 `tests/source.test.js`。
- parent 在每組 commit 前跑全套 `node --test 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，看到 `ℹ fail 0`，因為共用的工作樹會把跨檔的紅藏到那時才現。
- mutation 保持程式可跑：改一個數字或一個參數，不刪整行。用 `git checkout -- <file>` 還原，`git diff --quiet -- <file> && echo restored` 證明已還原。
- parent 在 implementer 還在跑時用 `git commit -o <paths>`，免得鄰居暫存的變更被一起帶進去。subject 是 `type: what changed`、60 字元內；每則訊息結尾是 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy`。
- 用 Edit 與 Write 工具改檔：heredoc 會吃掉反斜線，這台機器上的 Python 寫檔會把整個檔案變成 CRLF。

## File structure

| file | responsibility | task |
|---|---|---|
| `lib/usage.js` | 主 session 與 agent 檔每筆 request 的時間、model、五種 token | 1 |
| `lib/detail.js` | `days`、`spans`、`waits`、`points` 的 `model`、dispatch 列的 `from`/`to`/`cost`；`VERSION` 2 與舊快取保留 | 2, 3 |
| `lib/station.js` | `serialize()` 帶 `days`、`spans`、`pkey` | 4 |
| `assets/station/index.html`、`assets/station/station.css` | 依 mockup 的 shell 與三層全部樣式 | 5 |
| `assets/station/station.js` | hash 路由、首頁、專案頁、session 四分頁 | 6, 7, 8 |
| `tests/detail.test.js`、`tests/detail-cache.test.js`、`tests/station-view.test.js`、`tests/station-shell.test.js` | 各任務自己的測試 | 2, 3, 5, 6 |
| `docs/station.md`、`TODO.md` | 三層的描述、serve 那句、刪掉總覽改版條目 | 9 |

<!-- 草稿：docs/plans/2026-09-14-station-three-levels.md 的 Tasks 1–4。標頭、Global Constraints 與 Coverage 由 parent 合併。 -->

## Task 1: 主 session 與 agent 檔的每筆 request 帶時間與五種 token

**Files:**
- Modify: `lib/usage.js` — `addUsage` 之後加 `tokensFrom()`；`summarise()` 的 series 列帶 `tokens`；`dispatchesOf()` 的每列帶 `from`、`to`、`series`
- Test: `tests/usage-series.test.js` — 一個測試，接在第一個測試（:23-39）之後
- Test: `tests/dispatches.test.js` — 一個測試，接在 :101-115 的測試之後
- Read: `tests/tmp.js` — `tmp(prefix)`，兩個測試檔都已 require

**Interfaces:**
- Consumes: none
- Produces: `summarise(transcriptPath, { series: true })` 的每一列多 `series[].tokens`，形狀 `{ input, output, cacheRead, cacheWrite5m, cacheWrite1h }`，`id`、`at`、`model`、`context`、`output` 不變
- Produces: `dispatchesOf(transcriptPath)` 的每一列多 `rows[].from`、`rows[].to`（該 agent 檔第一筆與最後一筆 request 的 epoch ms，沒有則 `null`）與 `rows[].series`（該 agent 檔 `summarise(file, { sidechain: true, series: true })` 的 series，零列為 `[]`）

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼與預期輸出；五處小改與兩個測試的抄寫，只跑兩個測試檔。

1. 基線：

   ```
   node --test tests/usage-series.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
   node --test tests/dispatches.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
   ```

   前者 `ℹ pass 4`，後者 `ℹ pass 7`，兩者 `ℹ fail 0`。

2. 失敗的測試，一。在 `tests/usage-series.test.js` 第 39 行——`series is one row per request in first-seen order; context is input, cache read and both cache writes` 收尾的 `});`——之後插入一個空行與：

   ```js
   test('each series row carries its five token counts, read the way the model map is', () => {
       const file = transcript([
           said('req_a', 1, { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100,
               cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 30 } }),
           said('req_b', 2, { input_tokens: 1, output_tokens: 7, cache_read_input_tokens: 200, cache_creation_input_tokens: 40 }),
       ]);
       const seen = usage.summarise(file, { series: true });
       assert.deepEqual(seen.series.map((r) => [r.id, r.at, r.model, r.tokens]), [
           ['req_a', Date.parse(T(1)), 'claude-opus-5', { input: 10, output: 5, cacheRead: 100, cacheWrite5m: 20, cacheWrite1h: 30 }],
           ['req_b', Date.parse(T(2)), 'claude-opus-5', { input: 1, output: 7, cacheRead: 200, cacheWrite5m: 40, cacheWrite1h: 0 }],
       ]);
       const summed = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
       for (const r of seen.series) for (const k of Object.keys(summed)) summed[k] += r.tokens[k];
       assert.deepEqual(summed, seen.usage.models['claude-opus-5'], 'the rows add up to the model map');
   });
   ```

3. 失敗的測試，二。在 `tests/dispatches.test.js` 第 115 行——`one row per agent file and a zero row for a run agent with no transcript, each on its dispatch` 收尾的 `});`——之後插入一個空行與：

   ```js
   test('an agent row carries the time of its first and last request and each request on its own; a zero row carries none', () => {
       const out = usage.dispatchesOf(session());
       const by = Object.fromEntries(out.rows.map((r) => [r.id, r]));
       assert.deepEqual([by.aaa1.from, by.aaa1.to], [Date.parse(T(10)), Date.parse(T(40))]);
       assert.deepEqual(by.aaa1.series.map((c) => [c.at, c.model, c.tokens]), [
           [Date.parse(T(10)), 'claude-sonnet-5', { input: 100, output: 10, cacheRead: 1000, cacheWrite5m: 0, cacheWrite1h: 0 }],
           [Date.parse(T(40)), 'claude-sonnet-5', { input: 5, output: 5, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }],
       ]);
       assert.deepEqual([by.ddd4.from, by.ddd4.to, by.ddd4.series.length], [Date.parse(T(8)), Date.parse(T(8)), 1]);
       assert.deepEqual([by.eee5.from, by.eee5.to, by.eee5.series], [null, null, []]);
   });
   ```

4. 紅。跑步驟 1 的兩行。`tests/usage-series.test.js`：`ℹ pass 4`、`ℹ fail 1`，`✖ each series row carries its five token counts, read the way the model map is`，actual 每列第四格是 `undefined`。`tests/dispatches.test.js`：`ℹ pass 7`、`ℹ fail 1`，`✖ an agent row carries the time of its first and last request and each request on its own; a zero row carries none`，`actual: [ undefined, undefined ]`。
5. 實作，一（由下往上的第一處）。在 `lib/usage.js` 第 509 行，`dispatchesOf()` 為沒有 transcript 的 run agent 補的零列，把 `requests: 0, model: null, models: {}, split: blank(), tokens: 0, durMs: 0,` 那一行換成：

   ```js
                   requests: 0, model: null, models: {}, split: blank(), tokens: 0, durMs: 0, from: null, to: null, series: [],
   ```

6. 實作，二。在 `lib/usage.js` 第 477 行 `durMs: span ? span.last - span.first : 0,` 之後、第 478 行 `};` 之前插入：

   ```js
               // The agent's first and last request, and each request on its own
               // for the station's per-day rows; `durMs` above counts every line.
               from: times.length ? times.reduce((a, b) => Math.min(a, b)) : null,
               to: times.length ? times.reduce((a, b) => Math.max(a, b)) : null,
               series: own ? own.series : [],
   ```

7. 實作，三。在 `lib/usage.js` 把第 468-471 行（`const own = summarise(file, { sidechain: true });` 到 `const span = spanOf(file);`）換成：

   ```js
           const own = summarise(file, { sidechain: true, series: true });
           const models = own ? own.usage.models : {};
           const split = splitOf(models);
           const span = spanOf(file);
           const times = (own ? own.series : []).map((c) => c.at).filter(Number.isFinite);
   ```

8. 實作，四。在 `lib/usage.js` 把第 129 行 `out.series.push({ id, at: r.at, model: r.model, context: contextOf(r.usage), output: num(r.usage.output_tokens) });` 換成：

   ```js
               out.series.push({ id, at: r.at, model: r.model, context: contextOf(r.usage), output: num(r.usage.output_tokens), tokens: tokensFrom(r.usage) });
   ```

9. 實作，五。在 `lib/usage.js` 第 36 行——`addUsage` 收尾的 `}`——之後插入一個空行與：

   ```js
   // One request's five token counts, read by `addUsage` itself, so a sum of
   // these and the model map `addUsage` builds cannot read an undivided cache
   // write two ways.
   function tokensFrom(usage) {
       const one = {};
       addUsage(one, 'request', usage);
       return one.request;
   }
   ```

   `tokensFrom` 不 export：只有 `summarise()` 用它。

10. 綠。跑步驟 1 的兩行：`ℹ pass 5`、`ℹ fail 0` 與 `ℹ pass 8`、`ℹ fail 0`。
11. Commit：

    ```
    git commit -o -m "feat: each request carries its time and five token kinds" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy" -- lib/usage.js tests/usage-series.test.js tests/dispatches.test.js
    git show --stat HEAD
    ```

    `git show --stat HEAD` 列出的恰好是這三個檔。

## Task 2: extract() 產出 days、spans、waits

**Files:**
- Modify: `lib/detail.js` — `contextPoints()` 的點帶 `model`；`// ---- the cache` 之前加一節 `// ---- by day`（`dayOf`、`stageWhen`、`perDay`、`costSplit`、`rowCost`、`daysOf`、`waitsOf`、`spansOf`，`spansOf` 把 stage 段與等待裁到第一筆與最後一筆 request 之間）；`extract()` 產出 `days`、`spans`、`waits`，派工列帶 `cost`；`module.exports` 加 `dayOf`
- Test: `tests/detail.test.js` — require 區塊、:79-82 的 `contextPoints` 測試、檔尾一組 fixture 與四個測試
- Read: `lib/usage.js` — Task 1 的 `series[].tokens`、`rows[].from`、`rows[].to`、`rows[].series`
- Read: `lib/prices.js` — `rateFor(modelId)`（:23）；`costOf(models)`（:33-46）的算法，`costSplit` 逐種照它算
- Read: `lib/replay.js` — gate 的 `askedAt` 與 `t`（:80-81、:109-114）與 `MAX_EVENTS`（:13）；`waitsOf` 讀同一對 tool_use 與 tool_result，但不受列數上限影響
- Read: `tests/tmp.js` — `tmp(prefix)`

**Interfaces:**
- Consumes: `series[].tokens`, `rows[].from`, `rows[].to`, `rows[].series`, `stageSequence(commands, data)`, `rateFor(modelId)`
- Produces: `detailOf(configDir, sessionId, data, opts)` 回傳的 detail（也就是 `extract()` 的回傳與寫進 `station/detail/<id>.js` 的物件）多出 `days`、`spans`、`waits`
- Produces: `days` 每列 `{ day, stage, model, who, tokens, cost, usd }`，依 `day` 排序、同日依 `who`（`main`、`agent`、`workflow`）排序；沒有定價的 model `cost` 與 `usd` 為 `null`；非 `null` 的 `usd` 加總等於 detail 的 `usd`，差距在 1e-9 內
- Produces: `spans` 每列 `{ day, stage, who, ms }`，依 `day` 排序，由 `spansOf(seq, waits, firstAt, lastAt, agents)` 算出：`main` 與 `wait` 只算主 session 第一筆（`firstAt`）到最後一筆（`lastAt`）request 之間，`agent` 與 `workflow` 是 agent 檔自己的第一到最後一筆；`waits` 每列 `{ askedAt, answeredAt, stage }`
- Produces: `dayOf(t)`，export：epoch ms 在本機時區的 `'YYYY-MM-DD'`
- Produces: `points[].model`、`rows[].from`、`rows[].to`、`rows[].cost`（五種 token 各自的 USD，或 `null`）；`rows[].series` 不進 detail

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼與預期輸出；一節新函式、五處接線、五個測試，外加兩個 commit 後的 mutation。

1. 基線：

   ```
   node --test tests/detail.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
   ```

   `ℹ pass 8`、`ℹ fail 0`。

2. 失敗的測試，一（由下往上的第一處）。在 `tests/detail.test.js` 檔尾——`risesOf ranks the rises and names each cause` 收尾的 `});`，第 103 行——之後加一個空行與：

   ```js
   // ---- by day ----------------------------------------------------------------

   const SID = '11111111-2222-4333-8444-555555555555';
   const line = (o) => JSON.stringify(o) + '\n';
   // A local wall-clock time, so the day a request falls on is the same in
   // whatever time zone the suite runs.
   const L = (day, h, m) => new Date(2026, 8, day, h, m, 0).toISOString();
   const req = (rid, at, model, u, content, extra) => line(Object.assign({ type: 'assistant', requestId: rid, timestamp: at,
       message: { model, usage: u, content: content || [] } }, extra || {}));

   // A session where `detailOf` looks for one, under <cfg>/projects/<slug>/, with
   // its agents' files in the directory beside it named for the session.
   function onDisk(main, agents) {
       const cfg = tmp('fankeel-detail-days-');
       const dir = path.join(cfg, 'projects', 'F--some-project');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, SID + '.jsonl'), main.join(''));
       for (const [rel, lines] of Object.entries(agents || {})) {
           const p = path.join(dir, SID, rel);
           fs.mkdirSync(path.dirname(p), { recursive: true });
           fs.writeFileSync(p, lines.join(''));
       }
       return cfg;
   }

   test('a session across midnight is spent on both days, main and agent apart, and its days add up to its usd', () => {
       const opus = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000,
           cache_creation: { ephemeral_5m_input_tokens: 300, ephemeral_1h_input_tokens: 400 } };
       const sonnet = { input_tokens: 500, output_tokens: 50, cache_creation_input_tokens: 80 };
       const side = { isSidechain: true };
       const cfg = onDisk([
           req('m1', L(11, 23, 50), 'claude-opus-5', opus),
           req('m2', L(12, 0, 10), 'claude-opus-5', opus),
       ], {
           'subagents/agent-aaaa.jsonl': [
               req('a1', L(11, 23, 55), 'claude-sonnet-5', sonnet, [], side),
               req('a2', L(12, 0, 5), 'claude-sonnet-5', sonnet, [], side),
               req('a3', L(12, 0, 7), 'claude-mystery-1', sonnet, [], side),
           ],
       });
       const d = detail.detailOf(cfg, SID, { route: ['build'], stage: 'build', moves: [['build', Date.parse(L(11, 23, 40))]] }).detail;
       assert.deepEqual(d.days.map((r) => [r.day, r.stage, r.model, r.who]), [
           ['2026-09-11', 'build', 'claude-opus-5', 'main'],
           ['2026-09-11', 'build', 'claude-sonnet-5', 'agent'],
           ['2026-09-12', 'build', 'claude-opus-5', 'main'],
           ['2026-09-12', 'build', 'claude-sonnet-5', 'agent'],
           ['2026-09-12', 'build', 'claude-mystery-1', 'agent'],
       ]);
       const near = (a, b) => Math.abs(a - b) < 1e-12;
       assert.deepEqual(d.days[0].tokens, { input: 1000, output: 100, cacheRead: 2000, cacheWrite5m: 300, cacheWrite1h: 400 });
       const c = d.days[0].cost;
       assert.ok(near(c.input, 0.005) && near(c.output, 0.0025) && near(c.cacheRead, 0.001)
           && near(c.cacheWrite5m, 0.001875) && near(c.cacheWrite1h, 0.004) && near(d.days[0].usd, 0.014375), JSON.stringify(d.days[0]));
       assert.deepEqual(d.days[1].tokens, { input: 500, output: 50, cacheRead: 0, cacheWrite5m: 80, cacheWrite1h: 0 });
       assert.deepEqual([d.days[4].cost, d.days[4].usd], [null, null], 'a model with no rate is not priced at zero');
       const sum = d.days.reduce((n, r) => n + (r.usd === null ? 0 : r.usd), 0);
       assert.ok(d.usd > 0 && Math.abs(sum - d.usd) < 1e-9, sum + ' vs ' + d.usd);
       assert.deepEqual(d.spans.map((s) => [s.day, s.stage, s.who, s.ms]), [
           ['2026-09-11', 'build', 'main', 10 * 60e3],
           ['2026-09-11', 'build', 'agent', 5 * 60e3],
           ['2026-09-12', 'build', 'main', 10 * 60e3],
           ['2026-09-12', 'build', 'agent', 7 * 60e3],
       ]);
       const row = d.rows.find((r) => r.id === 'aaaa');
       assert.deepEqual([row.from, row.to, row.series], [Date.parse(L(11, 23, 55)), Date.parse(L(12, 0, 7)), undefined]);
       assert.ok(near(row.cost.input, 0.002) && near(row.cost.output, 0.001) && near(row.cost.cacheWrite5m, 0.0004), JSON.stringify(row.cost));
       assert.deepEqual(d.points.map((p) => p.model), ['claude-opus-5', 'claude-opus-5']);
   });

   test('a request belongs to the last stage step not later than it, with no clock, from two stage commands; before the first, null', () => {
       const u = (n) => ({ input_tokens: n });
       const cfg = onDisk([
           req('r1', T(1), 'claude-sonnet-5', u(1)),
           req('r2', T(2), 'claude-sonnet-5', u(10), [use('b1', 'Bash', { command: 'node scripts/task.js stage design' })]),
           line(result(3, 'b1', 'fankeel — survey to design')),
           req('r3', T(4), 'claude-sonnet-5', u(100)),
           req('r4', T(5), 'claude-sonnet-5', u(1000), [use('b2', 'Bash', { command: 'node scripts/task.js stage build' })]),
           line(result(6, 'b2', 'fankeel — design to build')),
           req('r5', T(7), 'claude-sonnet-5', u(10000)),
       ]);
       const d = detail.detailOf(cfg, SID, { route: ['survey', 'design', 'build'], stage: 'build' }).detail;
       assert.deepEqual(d.seq.map((s) => [s.stage, s.source]), [['design', 'cmd'], ['build', 'cmd']], 'no clock, no moves: the commands are the sequence');
       assert.deepEqual(d.days.map((r) => [r.stage, r.tokens.input]), [[null, 1], ['design', 110], ['build', 11000]]);
   });

   test('each gate is one wait from question to answer, and main time is the stage steps less the waits', () => {
       const gate = (id) => use(id, 'AskUserQuestion', { questions: [{ question: 'go on?', options: [{ label: 'yes' }] }] });
       const u = { input_tokens: 1 };
       const cfg = onDisk([
           req('r1', T(1), 'claude-sonnet-5', u, [use('b1', 'Bash', { command: 'node scripts/task.js start --task x' })]),
           line(result(2, 'b1', 'fankeel — started, at survey')),
           req('r2', T(3), 'claude-sonnet-5', u, [gate('g1')]),
           line(result(13, 'g1', 'yes')),
           req('r3', T(14), 'claude-sonnet-5', u, [use('b2', 'Bash', { command: 'node scripts/task.js stage design' })]),
           line(result(15, 'b2', 'fankeel — survey to design')),
           req('r4', T(16), 'claude-sonnet-5', u, [gate('g2')]),
           line(result(46, 'g2', 'yes')),
           req('r5', T(50), 'claude-sonnet-5', u),
       ]);
       const d = detail.detailOf(cfg, SID, { route: ['survey', 'design'], stage: 'design' }).detail;
       assert.deepEqual(d.waits, [
           { askedAt: Date.parse(T(3)), answeredAt: Date.parse(T(13)), stage: 'survey' },
           { askedAt: Date.parse(T(16)), answeredAt: Date.parse(T(46)), stage: 'design' },
       ]);
       assert.deepEqual(d.waits.map((w) => w.answeredAt - w.askedAt), [10000, 30000]);
       assert.deepEqual(d.waits.map((w) => [w.askedAt, w.answeredAt]),
           d.events.filter((e) => e.kind === 'gate').map((e) => [e.askedAt, e.t]), 'the same gates the replay shows');
       assert.deepEqual(d.spans.map((s) => [s.stage, s.who, s.ms]),
           [['survey', 'main', 3000], ['design', 'main', 6000], ['survey', 'wait', 10000], ['design', 'wait', 30000]]);
   });

   test('a stage step long before the first request adds no days: steps are clipped to the first and last request', () => {
       const u = { input_tokens: 1 };
       const cfg = onDisk([
           req('r1', L(11, 12, 0), 'claude-sonnet-5', u),
           req('r2', L(11, 12, 30), 'claude-sonnet-5', u),
       ]);
       // Three days before the first request, not at the epoch: with the clip
       // removed this test still fails in four rows rather than twenty thousand.
       const moves = [['survey', Date.parse(L(8, 12, 0))], ['build', Date.parse(L(11, 12, 10))]];
       const d = detail.detailOf(cfg, SID, { route: ['survey', 'build'], stage: 'build', moves }).detail;
       assert.equal(detail.dayOf(Date.parse(L(11, 12, 0))), '2026-09-11');
       assert.deepEqual(d.spans.map((s) => [s.day, s.stage, s.who, s.ms]),
           [['2026-09-11', 'survey', 'main', 10 * 60e3], ['2026-09-11', 'build', 'main', 20 * 60e3]]);
   });
   ```

   四個測試：跨午夜那個是「跨午夜分日」，時間是本地的 23:50 到隔天 00:10，`build` 那一步在 23:40，比第一筆 request 早 10 分鐘，所以 09-11 的 `main` 是 10 分鐘；第二個是「stage 歸屬」，data 沒有 `clock` 也沒有 `moves`，`seq` 只從兩次 `task.js stage` 來；第三個是「等待空窗」，兩次 gate；第四個是裁切：`survey` 那一步在第一筆 request 前三天，`spans` 仍只有 09-11 一天、`survey` 只算 12:00 到 12:10。Task 4 那個測試檔的 `fixture()`（:32）把 `moves` 放在 epoch 起 1 到 4 毫秒，原樣不動，是同一個裁切的第二道防線：沒有裁切時，那個檔的每次 `write` 會把 1970 年到 2026 年切成約兩萬列。

3. 失敗的測試，二。在 `tests/detail.test.js` 把第 79-82 行的 `contextPoints counts a request with no time instead of placing it` 整個測試換成：

   ```js
   test('contextPoints counts a request with no time instead of placing it, and each point keeps its model', () => {
       assert.deepEqual(detail.contextPoints([{ at: 10, context: 5, model: 'm1' }, { at: NaN, context: 6, model: 'm1' }, { at: 30, context: 7, model: 'm2' }]),
           { points: [{ n: 1, t: 10, y: 5, model: 'm1' }, { n: 3, t: 30, y: 7, model: 'm2' }], noTime: 1 });
   });
   ```

4. 失敗的測試，三。在 `tests/detail.test.js` 把第 6-8 行（`const assert = ...`、`const detail = ...`、`const usage = ...`）換成：

   ```js
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const detail = require('../lib/detail.js');
   const usage = require('../lib/usage.js');
   const tmp = require('./tmp.js');
   ```

5. 紅。跑步驟 1 的指令：`ℹ pass 7`、`ℹ fail 5`，`✖` 恰好是這五個：`contextPoints counts a request with no time instead of placing it, and each point keeps its model`（`Expected values to be strictly deep-equal`）、`a session across midnight is spent on both days, main and agent apart, and its days add up to its usd`（`TypeError: Cannot read properties of undefined (reading 'map')`）、`a request belongs to the last stage step not later than it, with no clock, from two stage commands; before the first, null`（同一個 `TypeError`）、`each gate is one wait from question to answer, and main time is the stage steps less the waits`（`actual: undefined`）、`a stage step long before the first request adds no days: steps are clipped to the first and last request`（`TypeError: detail.dayOf is not a function`）。
6. 實作，一（由下往上的第一處）。先在 `lib/detail.js` 第 534 行，把 `module.exports` 裡的 `contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf,` 那一行換成：

   ```js
       contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf, dayOf,
   ```

   再在 `lib/detail.js` 第 481 行 `ownUsd, agentUsd, usd: ownUsd + agentUsd, unpriced: [...unpriced],` 之後插入：

   ```js
           days: daysOf(calls, seq), spans, waits,
   ```

7. 實作，二。在 `lib/detail.js` 第 472 行 `const ownUsd = ownCost.priced.length ? ownCost.usd : 0;` 之後插入：

   ```js
       const waits = waitsOf(entries, seq);
       const times = series.map((c) => c.at).filter(Number.isFinite);
       const firstAt = times.length ? times.reduce((a, b) => Math.min(a, b)) : null;
       const lastAt = times.length ? times.reduce((a, b) => Math.max(a, b)) : null;
       const spans = spansOf(seq, waits, firstAt, lastAt, rows.filter((r) => Number.isFinite(r.from)).map((r) => ({
           from: r.from, to: r.to, who: r.surface === 'workflow' ? 'workflow' : 'agent', stage: stageWhen(seq, r.from),
       })));
   ```

8. 實作，三。在 `lib/detail.js` 的 `extract()` 裡，把第 448-456 行（`const steps = {};` 到 `found.rows.map` 收尾的 `});`）換成：

   ```js
       const steps = {};
       const unpriced = new Set();
       // Every request of the session and of its agents, one by one, for `days`.
       const calls = series.map((c) => ({ at: c.at, model: c.model, tokens: c.tokens, who: 'main' }));
       const rows = found.rows.map((r) => {
           const cost = prices.costOf(r.models);
           for (const id of cost.unpriced) unpriced.add(id);
           if (r.file) steps[r.id] = replay.stepsOf(r.file);
           const { file, models, series: agentCalls, ...rest } = r;
           const who = r.surface === 'workflow' ? 'workflow' : 'agent';
           for (const c of agentCalls) calls.push({ at: c.at, model: c.model, tokens: c.tokens, who });
           return Object.assign(rest, { usd: cost.priced.length ? cost.usd : 0, unpriced: cost.unpriced, cost: rowCost(models) });
       });
   ```

9. 實作，四。在 `lib/detail.js` 第 380 行 `// ---- the cache ---...` 之前插入下面這一節，後面留一個空行：

   ```js
   // ---- by day ----------------------------------------------------------------

   // The five token kinds, in the order `prices.perMillion` lists them.
   const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];

   // The calendar day an epoch-ms time falls on, in the time zone of the machine
   // running this: the page's bars are that machine's days.
   function dayOf(t) {
       const d = new Date(t);
       return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
   }

   // The stage a moment belongs to: the last step of `seq` not later than it, and
   // null before the first. Every step is looked at: a sequence whose commands do
   // not open with `start` has the entry's first stage put in front, and a hook
   // may have stamped that one later than the command after it.
   function stageWhen(seq, t) {
       let stage = null;
       for (const s of seq || []) if (s.at <= t) stage = s.stage;
       return stage;
   }

   // [from, to) cut at local midnights, as day to milliseconds; nothing for an
   // empty interval or one with an unknown end.
   function perDay(from, to) {
       const out = new Map();
       if (!Number.isFinite(from) || !Number.isFinite(to)) return out;
       for (let t = from; t < to;) {
           const d = new Date(t);
           const next = Math.min(to, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
           out.set(dayOf(t), (out.get(dayOf(t)) || 0) + next - t);
           t = next;
       }
       return out;
   }

   // USD per token kind for one model's tokens, at the rates `prices.costOf`
   // uses; null for a model the table has no rate for, so an unpriced row reads
   // as unpriced rather than as free.
   function costSplit(model, tokens) {
       const r = prices.rateFor(model);
       if (!r) return null;
       const out = {};
       for (const k of KINDS) out[k] = tokens[k] * r[k] / 1e6;
       return out;
   }

   // A dispatch row's cost per token kind, its priced models summed; null when
   // none of them is priced.
   function rowCost(models) {
       let out = null;
       for (const [id, m] of Object.entries(models || {})) {
           const c = costSplit(id, m);
           if (!c) continue;
           if (!out) out = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
           for (const k of KINDS) out[k] += c[k];
       }
       return out;
   }

   // One row per (day, stage, model, who), summed from single requests, so a
   // session that runs past midnight is spent on both days. `calls` is every
   // request of the session and of its agents as `{ at, model, tokens, who }`. A
   // request with no time has no day; its row says `day: null` rather than leave
   // the rows short of the session's `usd`.
   function daysOf(calls, seq) {
       const rows = new Map();
       for (const c of calls) {
           const day = Number.isFinite(c.at) ? dayOf(c.at) : null;
           const stage = stageWhen(seq, c.at);
           const key = JSON.stringify([day, stage, c.model, c.who]);
           if (!rows.has(key)) {
               rows.set(key, { day, stage, model: c.model, who: c.who, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
           }
           const row = rows.get(key);
           for (const k of KINDS) row.tokens[k] += c.tokens[k];
       }
       const order = { main: 0, agent: 1, workflow: 2 };
       return [...rows.values()]
           .map((row) => {
               const cost = costSplit(row.model, row.tokens);
               return Object.assign(row, { cost, usd: cost ? KINDS.reduce((n, k) => n + cost[k], 0) : null });
           })
           .sort((a, b) => String(a.day).localeCompare(String(b.day)) || order[a.who] - order[b.who]);
   }

   // Every gate the session put to the person, an AskUserQuestion and the tool
   // result that answered it, read off the entries themselves: the replay keeps
   // at most `MAX_EVENTS` rows, and a wait it dropped would drop out of the time.
   function waitsOf(entries, seq) {
       const asked = new Map();
       const out = [];
       for (const e of entries || []) {
           if (!e || e.isSidechain === true || !e.message || !Array.isArray(e.message.content)) continue;
           const at = Date.parse(e.timestamp);
           for (const b of e.message.content) {
               if (!b) continue;
               if (e.type === 'assistant' && b.type === 'tool_use' && b.name === 'AskUserQuestion') asked.set(b.id, at);
               if (e.type !== 'user' || b.type !== 'tool_result' || !asked.has(b.tool_use_id)) continue;
               const askedAt = asked.get(b.tool_use_id);
               asked.delete(b.tool_use_id);
               if (Number.isFinite(askedAt) && Number.isFinite(at)) out.push({ askedAt, answeredAt: at, stage: stageWhen(seq, askedAt) });
           }
       }
       return out;
   }

   // Where the session's time went, as `{ day, stage, who, ms }`. `main` is each
   // step of `seq` to the next, the last one to the last request, less the waits
   // inside it; `wait` is each wait; `agent` and `workflow` run from an agent
   // file's first request to its last, at the stage it began in. Steps and waits
   // are clipped to the session's first and last request, `firstAt` and `lastAt`:
   // a step stamped long before anything ran, down to a few milliseconds past the
   // epoch, would otherwise be cut into one row per day all the way back to it.
   // Every interval is cut at local midnights.
   function spansOf(seq, waits, firstAt, lastAt, agents) {
       const rows = new Map();
       const add = (day, stage, who, ms) => {
           const key = JSON.stringify([day, stage, who]);
           if (!rows.has(key)) rows.set(key, { day, stage, who, ms: 0 });
           rows.get(key).ms += ms;
       };
       if (Number.isFinite(firstAt) && Number.isFinite(lastAt)) {
           (seq || []).forEach((s, i) => {
               const end = i + 1 < seq.length ? seq[i + 1].at : lastAt;
               const from = Math.max(s.at, firstAt);
               const to = Math.min(end, lastAt);
               const main = perDay(from, to);
               for (const w of waits) {
                   for (const [day, ms] of perDay(Math.max(w.askedAt, from), Math.min(w.answeredAt, to))) main.set(day, main.get(day) - ms);
               }
               for (const [day, ms] of main) if (ms > 0) add(day, s.stage, 'main', ms);
           });
           for (const w of waits) {
               for (const [day, ms] of perDay(Math.max(w.askedAt, firstAt), Math.min(w.answeredAt, lastAt))) add(day, w.stage, 'wait', ms);
           }
       }
       for (const a of agents) for (const [day, ms] of perDay(a.from, a.to)) add(day, a.stage, a.who, ms);
       return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day));
   }
   ```

   這八個函式只 export `dayOf`（步驟 6）：Task 4 的 `serialize()` 用它，其餘七個只有 `extract()` 呼叫，測試經 `detailOf()` 讀它們的結果。

10. 實作，五。在 `lib/detail.js` 把第 218 行 `if (Number.isFinite(r.at)) points.push({ n: i + 1, t: r.at, y: r.context });` 換成：

    ```js
            if (Number.isFinite(r.at)) points.push({ n: i + 1, t: r.at, y: r.context, model: r.model });
    ```

11. 綠。跑步驟 1 的指令：`ℹ pass 12`、`ℹ fail 0`。裁切那個測試的 `✔` 行不到 100 ms。
12. Commit：

    ```
    git commit -o -m "feat: extract() spends each request on its day and stage" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy" -- lib/detail.js tests/detail.test.js
    git show --stat HEAD
    ```

    `git show --stat HEAD` 列出的恰好是這兩個檔。

13. 紅，mutation 一：歸屬永遠取第一步。在 `lib/detail.js` 的 `stageWhen()` 裡，用 Edit 把 `if (s.at <= t) stage = s.stage;` 改成 `if (s.at <= t) stage = seq[0].stage;`；`git diff --stat -- lib/detail.js` 顯示 `1 insertion(+), 1 deletion(-)`。
14. 跑步驟 1 的指令：`ℹ pass 10`、`ℹ fail 2`，`✖` 恰好是 `a request belongs to the last stage step not later than it, with no clock, from two stage commands; before the first, null` 與 `each gate is one wait from question to answer, and main time is the stage steps less the waits`（第二次等待的 stage 讀成 `survey`）。跨午夜與裁切兩個測試的 `spans` 用步驟自己的 stage，保持綠。回報這兩行 `✖`。
15. 還原：`git checkout -- lib/detail.js`，然後 `git diff --quiet -- lib/detail.js && echo restored` 印出 `restored`；再跑步驟 1 的指令，`ℹ pass 12`、`ℹ fail 0`。
16. 紅，mutation 二：拿掉起點的裁切。在 `lib/detail.js` 的 `spansOf()` 裡，用 Edit 把 `const from = Math.max(s.at, firstAt);` 改成 `const from = s.at;`。跑步驟 1 的指令：`ℹ pass 10`、`ℹ fail 2`，`✖` 恰好是 `a stage step long before the first request adds no days: steps are clipped to the first and last request`（多出 09-08 到 09-10 的列）與 `a session across midnight is spent on both days, main and agent apart, and its days add up to its usd`（09-11 的 `main` 從 23:40 算起，變成 20 分鐘）。裁切測試的 `survey` 只早三天，紅的輸出只多三列，跑得完。回報這兩行 `✖`。
17. 還原同步驟 15，再跑步驟 1 的指令：`ℹ pass 12`、`ℹ fail 0`。

## Task 3: 快取 VERSION 2，transcript 不在時保留舊快取

**Files:**
- Modify: `lib/detail.js` — `VERSION` 改成 2；`detailOf()` 對版本不符的快取：transcript 在就重讀，不在就照舊回傳，`opts.reuse` 也回傳它
- Test: `tests/detail-cache.test.js` — 檔尾一個 helper 與兩個測試
- Read: `tests/tmp.js` — `tmp(prefix)`，`setup()` 已用它

**Interfaces:**
- Consumes: `days`
- Produces: `VERSION` 為 2
- Produces: `detailOf(configDir, sessionId, data, opts)` 回傳 `{ detail, fresh }`：`v` 不是 2 的快取，transcript 在就重讀（`fresh: true`，快取改寫成 `v: 2`，連 ended 之後寫的快取也不走捷徑）；transcript 不在，或 `opts.reuse`，回傳 `{ detail: <舊快取原樣>, fresh: false }`

**Dispatch:** implementer, sonnet — 計畫帶著程式碼與預期輸出；一個常數、兩處接線、兩個測試，外加兩個 commit 後的 mutation。

1. 基線：

   ```
   node --test tests/detail-cache.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
   ```

   `ℹ pass 3`、`ℹ fail 0`。

2. 失敗的測試。在 `tests/detail-cache.test.js` 檔尾——`an ended session cached after it ended is not stat-ed again; reuse returns the cache without reading` 收尾的 `});`，第 64 行——之後加一個空行與：

   ```js
   // Claude Code deletes a transcript after about thirty days, and a VERSION bump
   // used to drop every cache on the spot: a session older than its transcript
   // then left the page altogether.
   function oldCache(f, fields) {
       const old = Object.assign({ v: 1, sessionId: SID, day: '2026-08-15', model: 'claude-sonnet-5', usd: 1.25, rows: [], backtracks: 0, peak: 0 }, fields);
       const file = detail.cachePath(f.cfg, SID);
       fs.mkdirSync(path.dirname(file), { recursive: true });
       fs.writeFileSync(file, JSON.stringify(old));
       return { old, file };
   }

   test('a cache from an older VERSION is read again while the transcript is there, even for a session that ended before it was written', () => {
       const f = setup();
       const { file } = oldCache(f, { key: detail.keyOf(f.t), at: Date.parse(T(30)) });
       const ended = Object.assign({}, f.data, { ended: { at: T(20), reason: 'exit' } });
       const got = detail.detailOf(f.cfg, SID, ended);
       assert.deepEqual([got.fresh, got.detail.v, Array.isArray(got.detail.days)], [true, 2, true]);
       assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 2, 'the cache is rewritten at the new version');
   });

   test('a cache from an older VERSION is kept as it stands once the transcript is gone, and a spent budget returns it too', () => {
       const f = setup();
       const { old, file } = oldCache(f, { key: 'gone', at: 0 });
       fs.rmSync(f.t);
       assert.equal(detail.transcriptOf(f.cfg, SID), null);
       assert.deepEqual(detail.detailOf(f.cfg, SID, f.data), { detail: old, fresh: false });
       assert.deepEqual(detail.detailOf(f.cfg, SID, f.data, { reuse: true }), { detail: old, fresh: false });
       assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), old, 'nothing rewrote it');
   });
   ```

3. 紅。跑步驟 1 的指令：`ℹ pass 4`、`ℹ fail 1`，`✖ a cache from an older VERSION is read again while the transcript is there, even for a session that ended before it was written`，`actual: [ false, 1, false ]`、`expected: [ true, 2, true ]`。保留那個測試現在就綠：今天 `VERSION` 是 1，v1 快取就是現行快取，`lib/detail.js` 在 transcript 不在時本來就回傳它；它的紅在步驟 7 與 9 的 mutation。
4. 找位置，行號已被 Task 2 移動：

   ```
   grep -n -e 'const VERSION = 1;' -e 'old.v !== VERSION' -e 'if (o.reuse) return old' -e 'if (!transcript) return old' lib/detail.js
   ```

   印出四行，由上而下是 `const VERSION = 1;`、`if (!old || old.v !== VERSION) old = null;`、`if (o.reuse) return old ? { detail: old, fresh: false } : null;`、`if (!transcript) return old ? { detail: old, fresh: false } : null;`。

5. 實作，由下往上。先在 `lib/detail.js` 把 `if (!transcript) return old ? { detail: old, fresh: false } : null;` 那一行換成：

   ```js
       if (!transcript) return kept ? { detail: kept, fresh: false } : null;
   ```

   再在 `lib/detail.js` 把 `if (!old || old.v !== VERSION) old = null;` 與下一行 `if (o.reuse) return old ? { detail: old, fresh: false } : null;` 兩行換成：

   ```js
       // A cache from another VERSION lacks what this one adds, so it is not
       // current. It is not thrown away either: once Claude Code has deleted the
       // transcript, it is all that is left of the session.
       const stale = old && typeof old === 'object' && old.v !== VERSION ? old : null;
       if (!old || old.v !== VERSION) old = null;
       const kept = old || stale;
       if (o.reuse) return kept ? { detail: kept, fresh: false } : null;
   ```

   最後在 `lib/detail.js` 把 `const VERSION = 1;` 換成 `const VERSION = 2;`。ended 的捷徑（`if (old && Number.isFinite(endedAt) && old.at >= endedAt)`）不動：它讀 `old`，舊版快取在那裡已是 `null`，所以會重讀。

6. 綠。跑步驟 1 的指令：`ℹ pass 5`、`ℹ fail 0`。然後 commit：

   ```
   git commit -o -m "feat: detail cache v2 keeps an old one past its transcript" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy" -- lib/detail.js tests/detail-cache.test.js
   git show --stat HEAD
   ```

   `git show --stat HEAD` 列出的恰好是這兩個檔。

7. 紅，mutation 一：拿掉保留那一行。在 `lib/detail.js` 用 Edit 把 `if (!transcript) return kept ? { detail: kept, fresh: false } : null;` 改回 `if (!transcript) return old ? { detail: old, fresh: false } : null;`（`a50c000` 的原文）。跑步驟 1 的指令：`ℹ pass 4`、`ℹ fail 1`，`✖` 恰好是 `a cache from an older VERSION is kept as it stands once the transcript is gone, and a spent budget returns it too`，敗在第一個 `detailOf` 的 `deepEqual`（actual `null`）。回報 `✖` 行。
8. 還原：`git checkout -- lib/detail.js`，`git diff --quiet -- lib/detail.js && echo restored` 印出 `restored`。
9. 紅，mutation 二：reuse 不回傳舊快取。在 `lib/detail.js` 用 Edit 把 `if (o.reuse) return kept ? { detail: kept, fresh: false } : null;` 改成 `if (o.reuse) return old ? { detail: old, fresh: false } : null;`。跑步驟 1 的指令：同一個測試 `✖`，這次敗在 `{ reuse: true }` 那一行（actual `null`）；`ℹ pass 4`、`ℹ fail 1`。回報 `✖` 行。
10. 還原同步驟 8，再跑步驟 1 的指令：`ℹ pass 5`、`ℹ fail 0`。

## Task 4: serialize() 帶 days、spans、pkey

**Files:**
- Modify: `lib/station.js` — `serialize()` 之前加 `keptDays(s)`；`serialize()` 每個 session 多 `days`、`spans`、`pkey`，接在 :428 之後
- Test: `tests/station-detail.test.js` — require 區塊多一行、檔尾一個測試
- Read: `lib/detail.js` — `dayOf(t)`（Task 2 export）；`cachePath(configDir, sessionId)`，測試用它放 v1 快取；Task 3 的保留讓那個 session 仍有 detail
- Read: `lib/registry.js` — `projectOf(data)`（:652），`gather()` 的 `project` 從這裡來；`writeSession(root, id, data)`
- Read: `tests/tmp.js` — `fixture()` 已用它

**Interfaces:**
- Consumes: `days`, `spans`, `dayOf(t)`, `detailOf(configDir, sessionId, data, opts)`, `projectOf(data)`
- Produces: `station-data.js` 的 `sessions[].days`：detail 的 `days`；detail 沒有 `days`（保留下來的 v1 快取）時是 `keptDays(s)` 的一列 `{ day: dayOf(Date.parse(started)), stage: null, model: detail.model, who: 'main', tokens: null, cost: null, usd: detail.usd }`，`started` 是 `gather()` 已放在 session 上的 `started`，無法解析時 `day` 為 `null`；沒有 detail 時 `null`
- Produces: `sessions[].spans`：detail 的 `spans`，否則 `null`
- Produces: `sessions[].pkey`（`pkey`）：session 沒有 `project` 時是它的 registry `root`，否則 `root + '/' + project`

**Dispatch:** implementer, sonnet — 計畫帶著程式碼與預期輸出；`serialize()` 裡三個欄位與一個小函式、一個讀產出檔的測試，外加兩個 commit 後的 mutation。

1. 基線：

   ```
   node --test tests/station-detail.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
   ```

   `ℹ pass 3`、`ℹ fail 0`。

2. 失敗的測試，一（由下往上的第一處）。在 `tests/station-detail.test.js` 檔尾——`serve answers a session's detail script, and 404 for a session with none` 收尾的 `});`，第 98 行——之後加一個空行與：

   ```js
   // The overview and the project page add up `days` from station-data.js alone.
   // A session whose transcript is gone keeps an older cache with no `days`, and
   // its usd is spent whole on the local day it started.
   const KEPT = 'aaaaaaaa-6666-4666-8666-666666666666';
   const OTHER = 'bbbbbbbb-7777-4777-8777-777777777777';
   // What `run()` builds belongs to another realm, and a strict deepEqual compares
   // prototypes too; through JSON both sides are plain.
   const plain = (v) => JSON.parse(JSON.stringify(v));

   test('station-data.js carries each session days and spans, a kept cache usd on its own day, and a key per project', () => {
       const f = fixture();
       const common = { stage: 'build', route: ['survey', 'build'], active: false, claims: [],
           started: T(0), updated: T(9), configDir: f.cfg, ended: { at: T(9), reason: 'exit' } };
       // Local noon, so `started` falls on 2026-08-15 in every time zone; the
       // cache's own `day` is a day off, so the row shows which of the two it read.
       const noon = new Date(2026, 7, 15, 12, 0, 0).toISOString();
       registry.writeSession(f.r1, KEPT, Object.assign({}, common, { task: 'transcript gone', project: 'app-a', started: noon }));
       registry.writeSession(f.r1, OTHER, Object.assign({}, common, { task: 'another project', project: 'app-b' }));
       const old = { v: 1, sessionId: KEPT, day: '2026-08-14', model: 'claude-sonnet-5', usd: 1.25, rows: [], backtracks: 0, peak: 0, key: 'gone', at: 0 };
       const cache = detail.cachePath(f.cfg, KEPT);
       fs.mkdirSync(path.dirname(cache), { recursive: true });
       fs.writeFileSync(cache, JSON.stringify(old));
       station.write({ configDir: f.cfg });
       const into = path.join(f.cfg, 'fankeel', 'station');
       const by = Object.fromEntries(run(fs.readFileSync(path.join(into, 'station-data.js'), 'utf8')).STATION.sessions.map((s) => [s.id, s]));
       const d = run(fs.readFileSync(path.join(into, 'detail', SID + '.js'), 'utf8')).STATION_DETAIL[SID];
       assert.ok(d.days.length > 0, 'the session with a transcript has days of its own');
       assert.deepEqual(plain([by[SID].days, by[SID].spans]), plain([d.days, d.spans]));
       assert.deepEqual(plain([by[KEPT].days, by[KEPT].spans]),
           [[{ day: '2026-08-15', stage: null, model: 'claude-sonnet-5', who: 'main', tokens: null, cost: null, usd: 1.25 }], null]);
       assert.deepEqual([by[BARE].days, by[BARE].spans], [null, null]);
       const root = path.resolve(f.r1);
       assert.deepEqual([by[SID].pkey, by[KEPT].pkey, by[OTHER].pkey], [root, root + '/app-a', root + '/app-b']);
   });
   ```

   `SID` 有 transcript、沒有 `project`；`KEPT` 在 `app-a`，transcript 不在、只有 v1 快取，`started` 是本地 2026-08-15 中午，快取自己的 `day` 寫成 2026-08-14；`OTHER` 在 `app-b`；`BARE` 什麼都沒有。同一個 registry 兩個 `project` 分成兩個 key，這是「專案 key」那一列。`fixture()` 的 `moves`（:32，epoch 起 1 到 4 毫秒）原樣不動：Task 2 的裁切讓 `SID` 的 `spans` 只剩幾列。

3. 失敗的測試，二。在 `tests/station-detail.test.js` 把第 12-13 行（`const registry = ...`、`const station = ...`）換成：

   ```js
   const registry = require('../lib/registry.js');
   const detail = require('../lib/detail.js');
   const station = require('../lib/station.js');
   ```

4. 紅。跑步驟 1 的指令：`ℹ pass 3`、`ℹ fail 1`，`✖ station-data.js carries each session days and spans, a kept cache usd on its own day, and a key per project`，敗在 `plain([by[SID].days, by[SID].spans])` 那一行，actual `[ null, null ]`。
5. 實作，由下往上。先在 `lib/station.js` 第 428 行 `hasDetail: Boolean(s.detail), peak: s.detail ? s.detail.peak : null,` 之後插入：

   ```js
               // What the overview and the project page add up, so neither loads a
               // detail file.
               days: !s.detail ? null : Array.isArray(s.detail.days) ? s.detail.days : keptDays(s),
               spans: s.detail && Array.isArray(s.detail.spans) ? s.detail.spans : null,
               // A project is a registry root and the session's `project` under it.
               pkey: s.project ? s.root + '/' + s.project : s.root,
   ```

   再在 `lib/station.js` 第 383 行——`serialize()` 上方註解的第一行 `// The one generated file. ...`——之前插入下面這段，後面留一個空行。`lib/station.js` 第 25 行已經 require 了 detail 模組，名字就叫 `detail`：

   ```js
   // A session's spend when its detail has no `days`, a cache kept from before
   // they existed: spent whole, at no stage, on the local day the session started.
   // The cache's own `day` is `started` cut to ten characters, a UTC date, and
   // `days` counts local ones.
   function keptDays(s) {
       const started = Date.parse(s.started);
       return [{
           day: Number.isFinite(started) ? detail.dayOf(started) : null,
           stage: null, model: s.detail.model, who: 'main', tokens: null, cost: null, usd: s.detail.usd,
       }];
   }
   ```

6. 綠。跑步驟 1 的指令：`ℹ pass 4`、`ℹ fail 0`。然後 commit：

   ```
   git commit -o -m "feat: station-data.js carries days, spans and a project key" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy" -- lib/station.js tests/station-detail.test.js
   git show --stat HEAD
   ```

   `git show --stat HEAD` 列出的恰好是這兩個檔。

7. 紅，mutation 一：key 不看 `project`。在 `lib/station.js` 用 Edit 把 `pkey: s.project ? s.root + '/' + s.project : s.root,` 改成 `pkey: s.root,`。跑步驟 1 的指令：`ℹ pass 3`、`ℹ fail 1`，`✖` 是同一個測試，敗在最後一個 `deepEqual`（`app-a` 與 `app-b` 都讀成 root）。回報 `✖` 行。
8. 還原：`git checkout -- lib/station.js`，`git diff --quiet -- lib/station.js && echo restored` 印出 `restored`。
9. 紅，mutation 二：舊快取那一列讀快取自己的 `day`。在 `lib/station.js` 的 `keptDays()` 裡，用 Edit 把 `day: Number.isFinite(started) ? detail.dayOf(started) : null,` 改成 `day: s.detail.day,`。跑步驟 1 的指令：`ℹ pass 3`、`ℹ fail 1`，`✖` 是同一個測試，敗在 `plain([by[KEPT].days, by[KEPT].spans])` 那一行（`2026-08-14` 對 `2026-08-15`）。回報 `✖` 行。
10. 還原同步驟 8，再跑步驟 1 的指令：`ℹ pass 4`、`ℹ fail 0`。

## Task 5: 依 mockup 重做 shell 與樣式

**Files:**
- Modify: `assets/station/index.html` — 側欄與 topbar 換成 mockup 的 masthead；六個掛載 id 留著
- Modify: `assets/station/station.css` — 整份重寫：mockup 的 token 與元件、清單頁與細節面板沿用的舊規則
- Modify: `tests/station-shell.test.js` — 四個新測試，接在檔尾
- Test: `tests/station-shell.test.js`
- Read: `.fankeel/build/2026-09-14-station-three-levels/mockup.html` — `<style>` 在 :8-239，masthead 在 :243-250
- Read: `tests/station.test.js` — :514 shell 逐位元組相同、:594-615 讀第一個 inline `<script>`
- Read: `docs/decisions/2026-09-04-session-station-design.md` — :120 不載入外部資源

**Interfaces:**
- Consumes: none
- Produces: shell 的掛載點 `#side`（`nav.crumbs`）、`#q`、`#page`（`main.page`）、`#gen`、`#nreg`、`#cfg`（在 `footer.foot`）；CSS token `--st-<stage>`、`--st-none`、`--m-fable|opus|sonnet|haiku|other`、`--s-main|agent|workflow`、`--t-in|out|cr|cw`、`--p-0`…`--p-5`、`--hatch`、`--hatch-bg`；Tasks 6–8 使用的 class：`panel eyebrow h2 readouts ro l v u d hatchsw controls ctlgrp seg legend sw ln chart hit tick gridl base tbl-wrap t link task sub child chip pchip bar-in route todo big grid2 hero hero-top hero-title projrow head nm pth day day-head day-nav btn day-body split split-h split-bar split-leg s-title s-meta tabs on lane-legend lane-l lane-s tl wf-toggle note sumline mixbar mini-mix ev filters foot page fixed`，以及清單頁、細節面板、比較頁沿用的舊 class（`card cbody phead ctl listwrap listcard det sec tally cx seq x dx rp rpf td cmpcard figs rgh pill dot delta mini empty cleared profile pf search mute`）

**Dispatch:** implementer, sonnet — 搬 mockup 的 CSS 與照表改名，計畫給了行號、改名表與新增的每一條規則。

1. Baseline：`node --test tests/station-shell.test.js tests/station.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，記下 pass 數 N，`ℹ fail 0`。
2. 在 `tests/station-shell.test.js` 檔尾加上：

   ```js
   // The 2026-09-14 redesign: the mockup's masthead replaces the side bar, and the
   // six ids above stay as the view script's mount points. The class list is the
   // one Tasks 6-8 render; a class with no rule is a component the port dropped.
   test('the shell is the mockup\'s masthead: a home link, the crumbs on #side, the page main', () => {
       const html = shell();
       assert.match(html, /<header class="mast">/);
       assert.match(html, /<a class="brand" href="#\/"/);
       assert.match(html, /<nav class="crumbs" id="side"/);
       assert.match(html, /<main class="page" id="page"><\/main>/);
       assert.match(html, /<a class="btn" href="#\/list">/);
       assert.match(html, /<footer class="foot">/);
   });

   test('the page loads nothing from outside', () => {
       // docs/decisions/2026-09-04-session-station-design.md:120
       const css = fs.readFileSync(CSS, 'utf8');
       assert.doesNotMatch(shell(), /(?:src|href)="(?:https?:)?\/\//);
       assert.doesNotMatch(css, /@import|url\(/);
   });

   test('every palette token the three levels colour by is defined in both themes', () => {
       const css = fs.readFileSync(CSS, 'utf8');
       const at = css.indexOf('@media(prefers-color-scheme:dark)');
       const light = css.slice(0, at);
       const dark = css.slice(at, css.indexOf('}}', at));
       const names = ['--panel', '--inset', '--ink', '--ink2', '--muted', '--faint', '--rule', '--rule2', '--grid',
           '--hatch', '--hatch-bg', '--good', '--bad',
           '--st-survey', '--st-design', '--st-plan', '--st-build', '--st-verify', '--st-audit', '--st-land', '--st-none',
           '--m-fable', '--m-opus', '--m-sonnet', '--m-haiku', '--m-other', '--s-main', '--s-agent', '--s-workflow',
           '--t-in', '--t-out', '--t-cr', '--t-cw', '--ctx', '--ctx-wash',
           '--p-0', '--p-1', '--p-2', '--p-3', '--p-4', '--p-5'];
       for (const n of names) {
           assert.ok(light.includes(n + ':'), 'light theme lacks ' + n);
           assert.ok(dark.includes(n + ':'), 'dark theme lacks ' + n);
       }
   });

   test('every class the three levels render has a rule', () => {
       const css = fs.readFileSync(CSS, 'utf8');
       const classes = ['mast', 'crumbs', 'search', 'foot', 'page', 'fixed', 'panel', 'eyebrow', 'h2', 'readouts', 'ro',
           'hatchsw', 'controls', 'ctlgrp', 'seg', 'legend', 'sw', 'chart', 'hit', 'tbl-wrap', 't', 'link', 'chip',
           'pchip', 'bar-in', 'route', 'grid2', 'hero-top', 'projrow', 'pth', 'day', 'day-head', 'day-nav', 'btn',
           'day-body', 'split', 'split-h', 'split-bar', 'split-leg', 's-title', 's-meta', 'tabs',
           'lane-legend', 'tl', 'note', 'sumline', 'mixbar', 'mini-mix', 'ev', 'filters',
           'card', 'phead', 'ctl', 'listwrap', 'det', 'sec', 'tally', 'seq', 'rp', 'cmpcard', 'pill', 'delta', 'mute'];
       for (const c of classes) {
           assert.match(css, new RegExp('\\.' + c + '[\\s{,:.>\\[)]'), 'no rule for .' + c);
       }
       // `^` because the kept `.seq .ar.bk{` is not the mockup's bare `.bk{`.
       assert.doesNotMatch(css, /^\.bk\{|\.bk-h|\.demo|\.tip\{|\.xh-read|\.strip24|\.teamcard|\.scrollmain/m,
           'a renamed or dropped rule is still there');
   });
   ```

3. Red：跑 step 1 的指令。三個新測試 `✖`（`<header class="mast">`、`--st-none`、`.mast` 沒有規則）；`the page loads nothing from outside` 現在就綠，它守的是改寫之後不退步。其餘照舊 pass。回報 `✖` 行。
4. 改寫 `assets/station/index.html` 為下面全文。第 `<script>(function(){…` 那一行從現在的 :30 逐字搬過來，一個字元都不改——`tests/station.test.js:594` 切的就是它：

   ```html
   <!doctype html>
   <html lang="zh-Hant"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <title>fankeel 測站</title>
   <link rel="stylesheet" href="station/station.css">
   </head><body>
   <header class="mast">
     <a class="brand" href="#/" aria-label="fankeel 測站 首頁"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 18 17H2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="12" r="1.9" fill="currentColor"/></svg><b>fankeel</b><span>測站</span></a>
     <nav class="crumbs" id="side" aria-label="位置"></nav>
     <label class="search"><input id="q" placeholder="搜尋任務、session、碰過的檔案…" aria-label="搜尋"><span class="k">/</span></label>
     <a class="btn" href="#/list">清單</a>
     <a class="btn" href="#/cmp">比較</a>
   </header>
   <main class="page" id="page"></main>
   <footer class="foot"><span id="gen"></span> · <span id="nreg"></span> · config dir <span class="mono" id="cfg">&mdash;</span></footer>
   <script>(function(){var v=new URLSearchParams(location.search).get('cleared');var q=v!==null&&/^\d+$/.test(v)?'?cleared='+v:'';document.write('<script src="station/station-data.js'+q+'"><\/script>')})()</script>
   <script src="station/station.js"></script>
   </body></html>
   ```

5. 改寫 `assets/station/station.css`。先寫檔頭與兩組 token——這一段整段照抄。暗色那組必須是 `@media(prefers-color-scheme:dark){:root{` 這個不帶空白的寫法，`tests/station-shell.test.js:61` 比對的是它；`--p-0`…`--p-2` 是 mockup 的 `--p-fankeel`、`--p-Trovara`、`--p-TokenBar`，專案是資料決定的，所以改成序號；舊變數名改成指向新 token，清單頁、細節面板與 view script 裡 inline style 的 `var(--line)`、`var(--dn)` 之類照樣解析：

   ```css
   /* The station page, after the 2026-09-14 mockup: warm grey ground, flat panels,
      ink as the accent, colour kept for what a chart separates. Loaded as a sibling
      of index.html, copied verbatim from assets/station/ — so nothing in here may
      reference the plugin directory, and nothing is fetched from anywhere. */
   :root{
     color-scheme:light;
     --ground:#e3e7e1; --panel:#f5f6f2; --inset:#eaede7; --raise:#ffffff;
     --ink:#161c1a; --ink2:#4a5451; --muted:#66706d; --faint:#8d9793;
     --rule:#d6dbd5; --rule2:#c3cac3; --grid:#e2e6e0; --wash:rgba(22,28,26,.045); --weekend:rgba(22,28,26,.028);
     --hatch:rgba(22,28,26,.42); --hatch-bg:rgba(22,28,26,.06);
     --good:#1f7a3a; --bad:#a93a20;
     --st-survey:#3578b8; --st-design:#cc9225; --st-plan:#af4a88; --st-build:#58994a;
     --st-verify:#6959ae; --st-audit:#c04d42; --st-land:#14938d; --st-none:#8d9793;
     --m-fable:#1e2925; --m-opus:#46534e; --m-sonnet:#73817c; --m-haiku:#9daca6; --m-other:#c3cac3;
     --p-0:#015f98; --p-1:#cd5d8e; --p-2:#c0a320; --p-3:#6959ae; --p-4:#14938d; --p-5:#8d9793;
     --s-main:#4a5954; --s-agent:#dc932e; --s-workflow:#bc4c31;
     --t-in:#246099; --t-cw:#5e8dbe; --t-cr:#9bbbdd; --t-out:#cf6139;
     --ctx:#161c1a; --ctx-wash:rgba(22,28,26,.07);
     --f-ui:"Bahnschrift","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC","DIN Alternate",system-ui,sans-serif;
     --f-mono:"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",ui-monospace,monospace;
     --r:10px; --r-md:8px; --r-sm:6px; --r-pill:999px;
     --card:var(--panel); --fg:var(--ink); --fg-2:var(--ink2); --mute:var(--muted);
     --line:var(--rule); --line-2:var(--rule2); --soft:var(--inset);
     --ind:var(--ink); --ind-2:var(--ink2); --ind-soft:var(--inset);
     --teal:var(--st-land); --blue:var(--st-survey);
     --up:var(--good); --up-bg:rgba(31,122,58,.12); --dn:var(--bad); --dn-bg:rgba(169,58,32,.12);
     --up-ink:var(--good); --dn-ink:var(--bad);
     --live:#1f7a3a; --live-bg:rgba(31,122,58,.12); --stale:#b7791f; --stale-bg:rgba(183,121,31,.14);
     --stale-ink:#8a5a12; --down:#66706d; --down-bg:var(--inset);
     --teal-soft:rgba(20,147,141,.12); --teal-ink:#0f6f6a;
     --mono:var(--f-mono); --sans:var(--f-ui); --sh:none;
   }
   @media(prefers-color-scheme:dark){:root{
     color-scheme:dark;
     --ground:#0e1311; --panel:#161c1a; --inset:#1e2522; --raise:#222a27;
     --ink:#e8ece6; --ink2:#a9b3ae; --muted:#8a9590; --faint:#65706b;
     --rule:#29312e; --rule2:#36403c; --grid:#232b28; --wash:rgba(232,236,230,.05); --weekend:rgba(232,236,230,.028);
     --hatch:rgba(232,236,230,.40); --hatch-bg:rgba(232,236,230,.05);
     --good:#5cc27a; --bad:#ef8a6a;
     --st-survey:#488acb; --st-design:#bf860c; --st-plan:#c35c9b; --st-build:#5e9f50;
     --st-verify:#8071c8; --st-audit:#d15d51; --st-land:#209993; --st-none:#65706b;
     --m-fable:#c5d3cd; --m-opus:#9aa8a2; --m-sonnet:#727f7a; --m-haiku:#4d5a55; --m-other:#36403c;
     --p-0:#4a8fd6; --p-1:#d76797; --p-2:#ae931d; --p-3:#8071c8; --p-4:#209993; --p-5:#65706b;
     --s-main:#93a39d; --s-agent:#bf8b1f; --s-workflow:#c9553c;
     --t-in:#8bbcef; --t-cw:#5b90c7; --t-cr:#32669a; --t-out:#dd6d45;
     --ctx:#e8ece6; --ctx-wash:rgba(232,236,230,.08);
     --up-bg:rgba(92,194,122,.14); --dn-bg:rgba(239,138,106,.14);
     --live:#5cc27a; --live-bg:rgba(92,194,122,.14); --stale:#e0a53a; --stale-bg:rgba(224,165,58,.16);
     --stale-ink:#e0a53a; --down:#8a9590;
     --teal-soft:rgba(32,153,147,.16); --teal-ink:#5fd0c9;
   }}
   ```

6. 接著把 `.fankeel/build/2026-09-14-station-three-levels/mockup.html` 的 :43-239（`*{box-sizing:border-box}` 到最後一個 `@media (max-width:1100px){…}` 的收尾 `}`）搬進 `assets/station/station.css`，逐字，只做下面這些改動：
   - 刪掉 `.demo`、`.demo-in`、`.demo-in>span`、`.demo a`、`.demo a:hover`、`.demo a.on`（:64-69），`@media (max-width:1100px)` 裡的選擇器 `.mast,.demo,.page` 改成 `.mast,.page,.foot`。示範導覽是 mockup 自己的，頁面沒有。
   - 刪掉 `.tip` 到 `.tip .tf`（:115-121）、`.xh-read`、`.xh-read.on`（:194-195），以及 `@media (prefers-reduced-motion: reduce){.fade{animation:none}.tip{transition:none}}` 裡的 `.tip{transition:none}`。頁面的懸停說明用 SVG `<title>`，沒有浮動提示框。
   - `.ctl{display:flex;align-items:center;gap:8px}` 與 `.ctl>label{…}`（:96-97）改名 `.ctlgrp`、`.ctlgrp>label`：清單頁與比較頁的按鈕還叫 `.ctl`。
   - `.bk`、`.bk-h`、`.bk-bar`、`.bk-bar i`、`.bk-bar i:first-child`、`.bk-bar i:last-child`、`.bk-leg`、`.bk-leg span`、`.bk-leg b`、`.bk-leg em`（:171-179）改名 `.split`、`.split-h`、`.split-bar`…`.split-leg em`：舊的 `.seq .s.bk` 會吃到全域的 `.bk{margin-bottom:18px}`。
   - 刪掉 `.strip24`、`.strip24 i`、`.strip24 u`（:180-182）：`spans` 每列只有某日的毫秒數，沒有時刻，畫不出 00–24 的時段條；某日花費的 session 表改印 active 與等待的時數。
   - `.note{color:var(--muted);font-size:12px;margin-top:10px}` 留著，後面的舊規則把細節面板那個改成 `.det .note`。
   - `@media (prefers-color-scheme: dark)` 不在這一段裡（它在 :26-42，第 5 步已寫），不要再搬一次。
7. 接著在 `assets/station/station.css` 的 mockup 那段之後加上這幾條 mockup 沒有、而頁面要的規則：

   ```css
   /* Not in the mockup: the search box, the footer, the list page's fixed height,
      the histogram's hit columns, a disabled segment, and the project path line. */
   .mast .search{flex:0 1 320px;display:flex;align-items:center;gap:8px;background:var(--inset);
     border-radius:8px;padding:5px 10px}
   .mast .search input{border:0;background:transparent;outline:0;font:inherit;color:var(--ink);width:100%}
   .mast .search .k{font:11px var(--f-mono);color:var(--muted);border:1px solid var(--rule2);border-radius:5px;padding:0 6px}
   .mast .btn{white-space:nowrap}
   .foot{max-width:1440px;margin:0 auto;padding:0 32px 28px;color:var(--muted);font-size:12px}
   .page.fixed{height:calc(100vh - 52px);overflow:hidden;display:flex;flex-direction:column;padding-bottom:22px}
   .page.fixed .listwrap{flex:1;min-height:0;height:auto}
   .chart .hit{fill:transparent;cursor:pointer}
   .chart .hit:hover{fill:var(--wash)}
   .seg button:disabled{opacity:.45;cursor:not-allowed}
   .projrow .pth{display:block}
   .tl .wf-toggle{fill:transparent}
   .tl .wf-toggle:hover{fill:var(--wash)}
   .mute{color:var(--muted)}
   ```

8. 最後把現在 `assets/station/station.css` 裡清單頁、細節面板、比較頁仍在用的規則搬到檔尾，逐字，只做列出的改動（行號是改寫前、commit a50c000 的檔）：
   - :92-105 `.phead` 到 `.cbody`，照搬。
   - :119-123 `.delta` 三條，照搬。
   - :145-151 `.dot`、`.pill` 各條，與 :155-159 `.pulse` 到 reduced-motion，照搬；:152-154 的舊 `.chip` 不搬（用 mockup 的）。
   - :161-171：`table`、`th`、`th:first-child`、`th:last-child`、`td`、`tbody tr:last-child td` 六個選擇器前面各加 `table:not(.t)`（`table` 本身寫成 `table:not(.t)`，其餘寫成 `table:not(.t) th` 這樣），不讓舊表格的大寫表頭漏進 mockup 的 `.t`；`.r`、`.ell`、`.mini`、`.mini span` 照搬。:172-173 `.seeall` 不搬。
   - :175-202 照搬，只把 `.note{…}` 改成 `.det .note{…;color:var(--ink)}`（在原宣告最後加 `color:var(--ink)`），蓋掉 mockup `.note` 的淡色。
   - :204-386 照搬。
   - 不搬的：:4-29 舊 token（第 5 步取代）、:31-40、:42-89（`.app`、`.side`、`.brand`、`.grp`、`.nav`、`.ic`、`.teamcard`、`.main`、`.tbar`、`.search`、`.who`）、:90-91 `.scrollmain`、:107-118 `.kpis`/`.kpi`、:125-143（`.grid2`、`.grid3`、`.headline`、`svg.chart`、`.legend`、`.gstats`）——這些標記在 Task 6 之後都不存在。
9. Green：跑 step 1 的指令，`ℹ pass N+4`、`ℹ fail 0`。`node --test tests/station-shell.test.js` 的 CRLF 測試也在裡面；檔案用 Write/Edit 寫，不用 Python。
10. 不 commit。回報 step 3 的 `✖` 行與 step 9 的計數。parent 跑全套，commit `assets/station/index.html assets/station/station.css tests/station-shell.test.js`，訊息 `feat: station shell and stylesheet follow the mockup`。

## Task 6: hash 路由與首頁

**Files:**
- Modify: `assets/station/station.js` — 純函式區加上路由、按日彙總與首頁的 HTML builder；DOM 區拿掉 `overview()`、`kpis()`、`flow()`、`weekBars()`、`gauge()`、`navGroup()`、舊 `drawSide()`，換成 `homePage()`、hash 路由的 `draw()`、麵包屑的 `drawSide()`；清單頁的 facet 從側欄搬到清單頁頭
- Modify: `tests/station-view.test.js` — 首頁的 fixture 與十個測試，接在檔尾
- Modify: `.fankeel/build/2026-09-14-station-three-levels/smoke-page.js` — 新檔，gitignored，不 commit：拿假 `document` 把 DOM 區每個 hash 跑一次
- Test: `tests/station-view.test.js`
- Read: `assets/station/station.css` — Task 5 的 class 與 token（`--m-*`、`--st-*`、`--s-*`、`--p-0`…`--p-5`）
- Read: `.fankeel/build/2026-09-14-station-three-levels/mockup.html` — `viewHome` :720-763、`drawHist` :765-815、`dayPanel` :817-856、`projectsList` :858-870、`drawSpark` :871-876、`sessionsTable` :877-885，標記的來源
- Read: `tests/station-compare.test.js`、`tests/station-routes.test.js`、`tests/station-panel.test.js`、`tests/station-dispatch-view.test.js`、`tests/station-todo.test.js` — 引用 `assets/station/station.js` 的其他測試，不能變紅

**Interfaces:**
- Consumes: Task 5 的 class 與 token；`window.STATION.sessions[]` 每列的 `days`（`[{ day, stage, model, who, tokens, cost, usd }]` 或 `null`）、`spans`（`[{ day, stage, who, ms }]` 或 `null`）、`pkey`；檔內既有的 `labels(roots)`、`delta(cur, prev, unit)`、`match(s, f)`、`statePill(s)`、`usd(n)`、`tokens(n)`、`hours(ms)`、`ago(ms)`、`esc(s)`、`profileCard(title, scope, projectPath, prof)`
- Produces（`module.exports` 新增、`tests/station-view.test.js` 引用）：
  - `localDay(ms)` → `'YYYY-MM-DD'`，本地日期
  - `lastDays(nowMs, n)` → `string[]`，n 個本地日，今天在最後
  - `parseHash(hash)` → `{ view: 'home', day: string|null }` | `{ view: 'project', pkey }` | `{ view: 'session', id, tab }`（`tab` ∈ `TABS`，不認得的是 `'timeline'`）| `{ view: 'list' }` | `{ view: 'cmp' }`
  - `family(model)` → `'fable'|'opus'|'sonnet'|'haiku'|'other'`
  - `sessionTotals(s)` → `{ usd, tokens, active, main, wait, models: { <family>: usd } }`，全從 `s.days`、`s.spans`
  - `windowTotals(sessions, days)` → `{ usd, tokens, active, main, wait }`，只算 `days` 裡的日子
  - `dayBars(sessions, metric, dim, days)`，`metric` ∈ `'usd'|'tokens'|'time'`、`dim` ∈ `'model'|'project'|'stage'|'who'` → `{ days: [{ day, total, parts: { <key>: n } }], keys: string[], max, disabled: string|null }`；`time` 配 `model` 回 `{ days: [], keys: [], max: 0, disabled: <原因> }`
  - `dayPanel(sessions, day)` → `{ day, usd, tokens, active, wait, by: { project, model, stage, who }, sessions: [{ id, task, pkey, usd, tokens, active, wait }] }`，`sessions` 依 `usd` 由大到小、只列當天有花費或 token 的
  - `projectRows(sessions, days)` → `[{ pkey, root, project, usd, n, last, daily: number[] }]`，依 `usd` 由大到小
  - `kpiHtml(cur, prev)`、`histSvg(bars, o)`、`dayPanelHtml(p, o)`、`projectsHtml(rows, o)`、`recentHtml(list, o)` → HTML 字串；`o = { metric, dim, sel, today, days, names, pkeys }`
- Produces（純函式區、不 export，Tasks 7–8 直接呼叫）：`TABS`、`MODEL_KEYS`、`TOKEN_KEYS`、`DIM_LABEL`、`pad2(n)`、`projectHash(pkey)`、`sessionHash(id, tab)`、`tokenSum(t)`、`dimKey(dim, s, r)`、`orderKeys(dim, seen)`、`colorOf(dim, key, pkeys)`、`keyLabel(dim, key, names)`、`projectNames(sessions)` → `{ <pkey>: name }`、`niceTop(v)`、`metricText(metric, v)`、`spark(values, colour)`、`routeDots(s)`、`segHtml(key, opts, current, off)`、`crumbHtml(parts)`、`legendHtml(bars, o)`
- Produces（DOM 區）：`route`（目前的 `parseHash()` 結果）、`view`（`{ metric, dim }`，Tasks 7–8 加自己的鍵）、`VIEWS`（`{ <view>: function (route) → html }`）、`CRUMBS`（`{ <view>: function (route) → [[label, href|null]] }`）、`DAYS`、`PREV`、`TODAY`、`NAMES`、`PKEYS`、`homeRows()`、`draw()`；點擊代理認 `[data-href]`、`[data-seg] button`、`[data-facet] button`

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼與測試；抄寫、兩個一行的 mutation、一支煙霧腳本。

1. Baseline：`node --test tests/station-view.test.js tests/station-compare.test.js tests/station-routes.test.js tests/station-panel.test.js tests/station-dispatch-view.test.js tests/station-todo.test.js tests/source.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，記下 pass 數 N，`ℹ fail 0`。
2. 在 `tests/station-view.test.js` 檔尾加上：

   ```js
   // --- the three levels: home -------------------------------------------------
   // Sessions in the shape `serialize()` gives them from 2026-09-14 on: `days` rows
   // per local day x stage x model x who, `spans` rows of milliseconds, and `pkey`.
   // Every dollar amount is a binary fraction, so sums compare exactly. The
   // registry's `usd` and `agentUsd` are 99 on purpose: a figure that reached the
   // page from them would be off by a visible amount.
   const count = (s, re) => (s.match(re) || []).length;
   const tok5 = (n) => ({ input: n, output: n / 10, cacheRead: n * 4, cacheWrite5m: n / 2, cacheWrite1h: n / 4 });
   const usd5 = (u) => ({ input: u / 4, output: u / 2, cacheRead: u / 8, cacheWrite5m: u / 16, cacheWrite1h: u / 16 });
   const dayRow = (day, stage, model, who, usd, n) => ({ day, stage, model, who, tokens: tok5(n), cost: usd5(usd), usd });
   const local = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
   const NOW = new Date(2026, 8, 14, 21, 40).getTime();
   const HOME = [
       { id: 'aaaa1111-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'crosses midnight',
         state: 'down', stage: 'verify', route: ['survey', 'build', 'verify'], started: local(9, 13, 23),
         updated: NOW - 3600000, usd: 99, agentUsd: 99, hasDetail: true,
         days: [dayRow('2026-09-13', 'build', 'claude-opus-5', 'main', 1.25, 1000),
             dayRow('2026-09-13', 'build', 'claude-sonnet-5', 'agent', 0.5, 2000),
             dayRow('2026-09-14', 'verify', 'claude-opus-5', 'main', 2, 3000)],
         spans: [{ day: '2026-09-13', stage: 'build', who: 'main', ms: 3600000 },
             { day: '2026-09-13', stage: 'build', who: 'wait', ms: 1200000 },
             { day: '2026-09-13', stage: 'build', who: 'agent', ms: 600000 },
             { day: '2026-09-14', stage: 'verify', who: 'main', ms: 1800000 }] },
       { id: 'bbbb2222-0000', root: 'F:\\ws\\alpha', project: 'Beta', pkey: 'F:\\ws\\alpha/Beta', task: 'a plan day',
         state: 'live', stage: 'plan', route: ['survey', 'design', 'plan'], started: local(9, 14, 9),
         updated: NOW - 60000, usd: 99, agentUsd: 99, hasDetail: true,
         days: [dayRow('2026-09-14', null, 'claude-haiku-4-5-20251001', 'workflow', 0.75, 500),
             dayRow('2026-09-14', 'plan', 'claude-fable-5-1', 'main', 4, 800)],
         spans: [{ day: '2026-09-14', stage: null, who: 'workflow', ms: 300000 },
             { day: '2026-09-14', stage: 'plan', who: 'main', ms: 2400000 },
             { day: '2026-09-14', stage: 'plan', who: 'wait', ms: 600000 }] },
       { id: 'cccc3333-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'no transcript here',
         state: 'down', stage: 'build', route: ['survey', 'build'], started: local(8, 20, 10),
         updated: NOW - 20 * 864e5, usd: 99, agentUsd: 99, hasDetail: false, days: null, spans: null },
       { id: 'dddd4444-0000', root: 'F:\\ws\\gamma', project: null, pkey: 'F:\\ws\\gamma', task: 'last month',
         state: 'down', stage: 'land', route: ['survey', 'land'], started: local(8, 1, 10),
         updated: NOW - 44 * 864e5, usd: 99, agentUsd: 99, hasDetail: false,
         days: [dayRow('2026-08-01', 'land', 'claude-sonnet-5', 'main', 8, 4000)],
         spans: [{ day: '2026-08-01', stage: 'land', who: 'main', ms: 7200000 },
             { day: '2026-08-01', stage: 'land', who: 'wait', ms: 7200000 }] },
   ];
   // Guarded, so that before `lastDays` exists its own tests fail rather than the
   // whole file throwing at load and taking the older tests down with it.
   const DAYS = typeof V.lastDays === 'function' ? V.lastDays(NOW, 30) : [];
   const PREV = typeof V.lastDays === 'function' ? V.lastDays(NOW - 30 * 864e5, 30) : [];
   const O = { metric: 'usd', dim: 'model', sel: '2026-09-13', today: '2026-09-14', days: DAYS,
       names: { 'F:\\ws\\alpha': 'alpha', 'F:\\ws\\alpha/Beta': 'alpha / Beta', 'F:\\ws\\gamma': 'gamma' },
       pkeys: ['F:\\ws\\alpha/Beta', 'F:\\ws\\alpha', 'F:\\ws\\gamma'] };
   // A session whose transcript is gone but whose v1 cache was kept: Task 4 gives
   // it one `days` row carrying its whole `usd`, with no tokens and no per-kind cost.
   const KEPT = { id: 'eeee5555-0000', root: 'F:\\ws\\gamma', project: null, pkey: 'F:\\ws\\gamma', task: 'kept cache',
       state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 10), updated: NOW - 4 * 864e5,
       usd: 99, agentUsd: 99, hasDetail: false, spans: null,
       days: [{ day: '2026-09-10', stage: null, model: 'claude-opus-5', who: 'main', tokens: null, cost: null, usd: 2.5 }] };

   test('lastDays counts local calendar days back from now, today last, across a month', () => {
       assert.equal(DAYS.length, 30);
       assert.deepEqual([DAYS[0], DAYS[28], DAYS[29]], ['2026-08-16', '2026-09-13', '2026-09-14']);
       assert.deepEqual(V.lastDays(new Date(2026, 8, 1, 0, 30).getTime(), 2), ['2026-08-31', '2026-09-01']);
       assert.equal(V.localDay(new Date(2026, 8, 13, 23, 59).getTime()), '2026-09-13');
   });

   test('parseHash reads every route the three levels use and falls back to home', () => {
       const key = 'F:\\ws\\alpha/Beta';
       assert.deepEqual(V.parseHash(''), { view: 'home', day: null });
       assert.deepEqual(V.parseHash('#/'), { view: 'home', day: null });
       assert.deepEqual(V.parseHash('#/d/2026-09-13'), { view: 'home', day: '2026-09-13' });
       assert.deepEqual(V.parseHash('#/d/yesterday'), { view: 'home', day: null });
       assert.deepEqual(V.parseHash('#/p/' + encodeURIComponent(key)), { view: 'project', pkey: key });
       assert.deepEqual(V.parseHash('#/s/aaaa1111-0000'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
       assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/cost'), { view: 'session', id: 'aaaa1111-0000', tab: 'cost' });
       assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/nope'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
       assert.deepEqual(V.parseHash('#/list'), { view: 'list' });
       assert.deepEqual(V.parseHash('#/cmp'), { view: 'cmp' });
       assert.deepEqual(V.parseHash('#/p/%E0%A4%A'), { view: 'home', day: null }, 'a key that does not decode is no route');
   });

   test('family names the model line and calls anything else other', () => {
       assert.deepEqual(['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'gpt-x', null].map(V.family),
           ['fable', 'opus', 'sonnet', 'haiku', 'other', 'other']);
   });

   test('dayBars stacks each day from days and spans, not from the registry, and time has no model split', () => {
       const usd = V.dayBars(HOME, 'usd', 'model', DAYS);
       assert.deepEqual([usd.days[29].day, usd.days[29].total, usd.days[29].parts], ['2026-09-14', 6.75, { opus: 2, haiku: 0.75, fable: 4 }]);
       assert.deepEqual([usd.days[28].total, usd.days[28].parts], [1.75, { opus: 1.25, sonnet: 0.5 }]);
       assert.deepEqual(usd.keys, ['fable', 'opus', 'sonnet', 'haiku'], 'model keys in price order');
       assert.equal(usd.max, 6.75);
       assert.equal(usd.days.reduce((n, b) => n + b.total, 0), 8.5, '08-01 is outside the window');
       assert.deepEqual(V.dayBars(HOME, 'time', 'who', DAYS).days[28].parts, { main: 3600000, agent: 600000 }, 'waiting is not time');
       const byStage = V.dayBars(HOME, 'usd', 'stage', DAYS);
       assert.deepEqual(byStage.days[29].parts, { verify: 2, none: 0.75, plan: 4 });
       assert.deepEqual(byStage.keys, ['plan', 'build', 'verify', 'none']);
       const off = V.dayBars(HOME, 'time', 'model', DAYS);
       assert.deepEqual([off.days.length, off.keys.length, off.max], [0, 0, 0]);
       assert.match(off.disabled, /model/);
       for (const b of V.dayBars(HOME, 'tokens', 'project', DAYS).days) {
           assert.equal(b.total, Object.values(b.parts).reduce((n, v) => n + v, 0), b.day + ': a bar is its segments');
       }
   });

   test('dayPanel splits one day four ways and lists the sessions that spent on it', () => {
       const p = V.dayPanel(HOME, '2026-09-14');
       assert.deepEqual([p.usd, p.active, p.wait], [6.75, 1800000 + 300000 + 2400000, 600000]);
       assert.deepEqual(p.by.who, { main: 6, workflow: 0.75 });
       assert.deepEqual(p.by.stage, { verify: 2, none: 0.75, plan: 4 });
       assert.deepEqual(p.by.project, { 'F:\\ws\\alpha': 2, 'F:\\ws\\alpha/Beta': 4.75 });
       assert.deepEqual(p.sessions.map((s) => [s.id, s.usd]), [['bbbb2222-0000', 4.75], ['aaaa1111-0000', 2]]);
   });

   test('頁面對帳：a day\'s bar total equals its day panel total equals that day\'s days[].usd across sessions', () => {
       for (const dim of ['model', 'project', 'stage', 'who']) {
           const bars = V.dayBars(HOME, 'usd', dim, DAYS);
           DAYS.forEach((day, i) => {
               let rows = 0;
               for (const s of HOME) for (const r of s.days || []) if (r.day === day) rows += r.usd;
               assert.equal(bars.days[i].total, rows, dim + ' ' + day + ': the bar');
               assert.equal(V.dayPanel(HOME, day).usd, rows, day + ': the day panel');
           });
       }
   });

   test('windowTotals and the four readouts: thirty days against the thirty before, waiting over main plus wait', () => {
       const cur = V.windowTotals(HOME, DAYS);
       const prev = V.windowTotals(HOME, PREV);
       assert.deepEqual(cur, { usd: 8.5, tokens: 42705, active: 8700000, main: 7800000, wait: 1800000 });
       assert.deepEqual(prev, { usd: 8, tokens: 23400, active: 7200000, main: 7200000, wait: 7200000 });
       const html = V.kpiHtml(cur, prev);
       assert.match(html, /\$8\.50/);
       assert.doesNotMatch(html, /\$99|\$198/);
       assert.match(html, /18\.8<span class="u">%<\/span>/);
       assert.match(html, /-31\.3 pt/);
       const none = V.kpiHtml(cur, V.windowTotals(HOME, V.lastDays(NOW - 60 * 864e5, 30)));
       assert.equal(count(none, /前期無資料/g), 4);
   });

   test('sessionTotals and projectRows sum days and spans per session and per project key', () => {
       assert.deepEqual(V.sessionTotals(HOME[0]), { usd: 3.75, tokens: 35100, active: 6000000, main: 5400000, wait: 1200000,
           models: { opus: 3.25, sonnet: 0.5 } });
       assert.deepEqual(V.sessionTotals(HOME[2]), { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, models: {} });
       const rows = V.projectRows(HOME, DAYS);
       assert.deepEqual(rows.map((r) => [r.pkey, r.usd, r.n]),
           [['F:\\ws\\alpha/Beta', 4.75, 1], ['F:\\ws\\alpha', 3.75, 2], ['F:\\ws\\gamma', 0, 0]]);
       assert.equal(rows[1].daily[28], 1.75);
       assert.equal(rows[1].last, NOW - 3600000);
   });

   test('the home builders print dollars from days and link every row to its level', () => {
       const svg = V.histSvg(V.dayBars(HOME, 'usd', 'model', DAYS), O);
       assert.equal(count(svg, /<rect class="hit"/g), 30);
       assert.match(svg, /<rect class="hit" data-href="#\/"[^>]*><title>2026-09-13 /, 'the open day closes');
       assert.match(svg, /<rect class="hit" data-href="#\/d\/2026-09-14"/);
       assert.match(V.histSvg(V.dayBars(HOME, 'time', 'model', DAYS), O), /^<p class="note">時間沒有 model 可分/);
       const panel = V.dayPanelHtml(V.dayPanel(HOME, '2026-09-14'), O);
       assert.match(panel, /當日花費<\/div><div class="v">\$6\.75/);
       assert.match(panel, /href="#\/d\/2026-09-13"/);
       assert.doesNotMatch(panel, /#\/d\/2026-09-15/, 'no day after today');
       assert.match(panel, /data-href="#\/s\/bbbb2222-0000"/);
       assert.match(V.projectsHtml(V.projectRows(HOME, DAYS), O), /href="#\/p\/F%3A%5Cws%5Calpha%2FBeta"/);
       const recent = V.recentHtml(HOME.slice(0, 2), O);
       assert.match(recent, /data-href="#\/s\/aaaa1111-0000"[\s\S]*?\$3\.75/);
       assert.doesNotMatch(recent, /\$99|\$198/);
   });

   test('a kept v1 cache\'s single row counts its dollars and zero tokens, and breaks no home view', () => {
       const i = DAYS.indexOf('2026-09-10');
       assert.deepEqual(V.dayBars([KEPT], 'usd', 'stage', DAYS).days[i].parts, { none: 2.5 });
       const tok = V.dayBars([KEPT], 'tokens', 'model', DAYS);
       assert.deepEqual([tok.days[i].total, tok.keys, tok.max], [0, [], 0]);
       assert.deepEqual(V.dayBars([KEPT], 'time', 'who', DAYS).days[i].parts, {});
       assert.equal(V.dayPanel([KEPT], '2026-09-10').usd, 2.5);
       assert.deepEqual(V.sessionTotals(KEPT), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0, models: { opus: 2.5 } });
       assert.deepEqual(V.windowTotals([KEPT], DAYS), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0 });
       assert.match(V.recentHtml([KEPT], O), /\$2\.50<\/td><td class="r muted">0<\/td>/);
       assert.equal(count(V.histSvg(V.dayBars([KEPT], 'tokens', 'model', DAYS), O), /<rect class="hit"/g), 30);
   });
   ```

3. Red：跑 step 1 的指令。新的十個測試 `✖`（`V.lastDays is not a function` 之類），其餘照舊。回報 `✖` 行。
4. 在 `assets/station/station.js`，`match()` 收尾的 `}`（:156）之後、`if (typeof module !== 'undefined' && module.exports) {` 之前，插入共用的常數與小工具：

   ```js
       // ---- the three levels: shared -----------------------------------------
       // 2026-09-14. Every figure on the home, project and session pages is summed
       // from a session's `days` (dollars, tokens) and `spans` (milliseconds), split
       // by the local day each request happened on — never from the registry's
       // `usd`, which SessionEnd writes once and which is filed under the start day.
       var TABS = ['timeline', 'cost', 'dispatch', 'events'];
       var MODEL_KEYS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];
       var TOKEN_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
       var WHO_LABEL = { main: '主 session', agent: '背景 agent', workflow: 'workflow' };
       var DIM_LABEL = { model: '依 model', project: '依專案', stage: '依 stage', who: '主 session 對 agent' };
       var METRIC_LABEL = { usd: '花費', tokens: 'token', time: '時間' };
       function pad2(n) { return (n < 10 ? '0' : '') + n; }
       function localDay(ms) {
           var d = new Date(ms);
           return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
       }
       // Calendar arithmetic rather than 864e5 steps, so a daylight-saving day
       // neither repeats nor drops a date.
       function lastDays(nowMs, n) {
           var d = new Date(nowMs), out = [];
           for (var i = n - 1; i >= 0; i--) {
               out.push(localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i, 12).getTime()));
           }
           return out;
       }
       // `#/`, `#/d/<day>`, `#/p/<encodeURIComponent(pkey)>`, `#/s/<id>[/<tab>]`, and
       // `#/list` and `#/cmp` for the two pages that stayed. A hash is what a page
       // opened from file:// can go back through.
       function parseHash(hash) {
           var p = String(hash || '').replace(/^#\/?/, '').split('/');
           var dec = function (v) { try { return decodeURIComponent(v); } catch (e) { return null; } };
           if (p[0] === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) return { view: 'home', day: p[1] };
           var key = p[0] === 'p' && p[1] ? dec(p.slice(1).join('/')) : null;
           if (key !== null) return { view: 'project', pkey: key };
           var id = p[0] === 's' && p[1] ? dec(p[1]) : null;
           if (id !== null) return { view: 'session', id: id, tab: TABS.indexOf(p[2]) >= 0 ? p[2] : 'timeline' };
           if (p[0] === 'list' || p[0] === 'cmp') return { view: p[0] };
           return { view: 'home', day: null };
       }
       function projectHash(pkey) { return '#/p/' + encodeURIComponent(pkey); }
       function sessionHash(id, tab) { return '#/s/' + encodeURIComponent(id) + (tab && tab !== 'timeline' ? '/' + tab : ''); }
       function family(model) {
           var m = /claude-(fable|opus|sonnet|haiku)/.exec(String(model || ''));
           return m ? m[1] : 'other';
       }
       function tokenSum(t) {
           return t ? TOKEN_KEYS.reduce(function (n, k) { return n + (t[k] || 0); }, 0) : 0;
       }
       function dimKey(dim, s, r) {
           if (dim === 'model') return family(r.model);
           if (dim === 'project') return s.pkey;
           if (dim === 'stage') return r.stage || 'none';
           return r.who;
       }
       // Models bottom-up by price, stages in route order, projects by size.
       function orderKeys(dim, seen) {
           var fixed = dim === 'model' ? MODEL_KEYS : dim === 'stage' ? ROUTE.concat(['none'])
               : dim === 'who' ? ['main', 'agent', 'workflow'] : null;
           var keys = Object.keys(seen).filter(function (k) { return seen[k]; });
           if (!fixed) return keys.sort(function (a, b) { return seen[b] - seen[a] || (a < b ? -1 : 1); });
           return fixed.filter(function (k) { return seen[k]; })
               .concat(keys.filter(function (k) { return fixed.indexOf(k) < 0; }).sort());
       }
       // A project's colour is its place in `pkeys`, the 30-day order, so it is
       // the same on every chart; the sixth project on shares `--p-5`.
       function colorOf(dim, key, pkeys) {
           if (dim === 'model') return 'var(--m-' + key + ')';
           if (dim === 'stage') return ROUTE.indexOf(key) >= 0 ? 'var(--st-' + key + ')' : 'var(--st-none)';
           if (dim === 'who') return 'var(--s-' + key + ')';
           var i = (pkeys || []).indexOf(key);
           return 'var(--p-' + (i < 0 ? 5 : Math.min(i, 5)) + ')';
       }
       function keyLabel(dim, key, names) {
           if (dim === 'who') return WHO_LABEL[key] || key;
           if (dim === 'stage') return key === 'none' ? '第一步之前' : key;
           if (dim === 'project') return (names && names[key]) || key;
           return key;
       }
       function projectNames(sessions) {
           var lab = labels(sessions.map(function (s) { return s.root; }));
           var out = {};
           sessions.forEach(function (s) { out[s.pkey] = (lab[s.root] || s.root) + (s.project ? ' / ' + s.project : ''); });
           return out;
       }
       function niceTop(v) {
           if (!(v > 0)) return 1;
           var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
           return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
       }
       function metricText(metric, v) {
           return metric === 'usd' ? (v ? usd(v) : '$0') : metric === 'tokens' ? tokens(v) : hours(v);
       }
   ```

5. 在 `assets/station/station.js`，step 4 那段之後緊接著插入彙總函式：

   ```js
       function sessionTotals(s) {
           var t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, models: {} };
           (s.days || []).forEach(function (r) {
               var m = family(r.model);
               t.usd += r.usd || 0;
               t.tokens += tokenSum(r.tokens);
               t.models[m] = (t.models[m] || 0) + (r.usd || 0);
           });
           (s.spans || []).forEach(function (r) {
               if (r.who === 'wait') { t.wait += r.ms; return; }
               t.active += r.ms;
               if (r.who === 'main') t.main += r.ms;
           });
           return t;
       }
       // Time is main + agent + workflow, counted each on its own while they
       // overlap: it measures work, not the wall clock. Waiting is apart.
       function windowTotals(sessions, days) {
           var inside = {}, t = { usd: 0, tokens: 0, active: 0, main: 0, wait: 0 };
           days.forEach(function (d) { inside[d] = true; });
           sessions.forEach(function (s) {
               (s.days || []).forEach(function (r) {
                   if (!inside[r.day]) return;
                   t.usd += r.usd || 0;
                   t.tokens += tokenSum(r.tokens);
               });
               (s.spans || []).forEach(function (r) {
                   if (!inside[r.day]) return;
                   if (r.who === 'wait') { t.wait += r.ms; return; }
                   t.active += r.ms;
                   if (r.who === 'main') t.main += r.ms;
               });
           });
           return t;
       }
       // One bar per day; a bar's total is added in the same pass as its parts,
       // so it is their sum and nothing else.
       function dayBars(sessions, metric, dim, days) {
           if (metric === 'time' && dim === 'model') {
               return { days: [], keys: [], max: 0, disabled: '時間沒有 model 可分：spans 只記 stage 與誰在跑，不記 model' };
           }
           var at = {}, seen = {};
           days.forEach(function (d) { at[d] = { day: d, total: 0, parts: {} }; });
           var add = function (d, key, v) {
               if (!at[d] || !v) return;
               at[d].parts[key] = (at[d].parts[key] || 0) + v;
               at[d].total += v;
               seen[key] = (seen[key] || 0) + v;
           };
           sessions.forEach(function (s) {
               if (metric === 'time') {
                   (s.spans || []).forEach(function (r) { if (r.who !== 'wait') add(r.day, dimKey(dim, s, r), r.ms); });
                   return;
               }
               (s.days || []).forEach(function (r) {
                   add(r.day, dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens));
               });
           });
           var list = days.map(function (d) { return at[d]; });
           return {
               days: list, keys: orderKeys(dim, seen), disabled: null,
               max: Math.max.apply(null, list.map(function (b) { return b.total; }).concat([0])),
           };
       }
       function dayPanel(sessions, day) {
           var out = { day: day, usd: 0, tokens: 0, active: 0, wait: 0, by: { project: {}, model: {}, stage: {}, who: {} }, sessions: [] };
           sessions.forEach(function (s) {
               var mine = { id: s.id, task: s.task, pkey: s.pkey, usd: 0, tokens: 0, active: 0, wait: 0 };
               (s.days || []).forEach(function (r) {
                   if (r.day !== day) return;
                   var u = r.usd || 0;
                   mine.usd += u;
                   mine.tokens += tokenSum(r.tokens);
                   ['project', 'model', 'stage', 'who'].forEach(function (dim) {
                       var k = dimKey(dim, s, r);
                       out.by[dim][k] = (out.by[dim][k] || 0) + u;
                   });
               });
               (s.spans || []).forEach(function (r) {
                   if (r.day !== day) return;
                   if (r.who === 'wait') mine.wait += r.ms; else mine.active += r.ms;
               });
               out.usd += mine.usd;
               out.tokens += mine.tokens;
               out.active += mine.active;
               out.wait += mine.wait;
               if (mine.usd || mine.tokens) out.sessions.push(mine);
           });
           out.sessions.sort(function (a, b) { return b.usd - a.usd; });
           return out;
       }
       // A session counts toward a project's `n` when it spent inside the window
       // or started inside it; one with no transcript has only its start.
       function projectRows(sessions, days) {
           var inside = {}, by = {}, list = [];
           days.forEach(function (d, i) { inside[d] = i + 1; });
           sessions.forEach(function (s) {
               var r = by[s.pkey];
               if (!r) {
                   r = by[s.pkey] = { pkey: s.pkey, root: s.root, project: s.project || null, usd: 0, n: 0, last: 0,
                       daily: days.map(function () { return 0; }) };
                   list.push(r);
               }
               var touched = false;
               (s.days || []).forEach(function (x) {
                   if (!inside[x.day]) return;
                   r.usd += x.usd || 0;
                   r.daily[inside[x.day] - 1] += x.usd || 0;
                   touched = true;
               });
               if (touched || inside[localDay(Date.parse(s.started))]) r.n++;
               r.last = Math.max(r.last, s.updated || 0);
           });
           return list.sort(function (a, b) { return b.usd - a.usd || b.last - a.last; });
       }
   ```

6. 在 `assets/station/station.js`，step 5 那段之後插入首頁的 HTML builder。標記照 mockup 的 `viewHome`、`drawHist`、`dayPanel`、`projectsList`、`drawSpark`、`sessionsTable`；不同處：懸停說明是 SVG `<title>`，某日 session 表沒有 00–24 時段條（`spans` 沒有時刻），route 點只畫這個 session 的 route、走過的上色：

   ```js
       function kpiHtml(cur, prev) {
           var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
           var ro = function (label, v, d) {
               return '<div class="ro"><div class="l">' + label + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
           };
           return '<div class="readouts">'
               + ro('30 天花費', usd(cur.usd), delta(cur.usd, prev.usd))
               + ro('token', tokens(cur.tokens), delta(cur.tokens, prev.tokens))
               + ro('active 時間', hours(cur.active), delta(cur.active, prev.active))
               + ro('<i class="hatchsw"></i>等待佔比', Math.round(share(cur) * 1000) / 10 + '<span class="u">%</span>',
                   (prev.main + prev.wait ? delta(share(cur), share(prev), 'pt') : '<span class="delta flat">前期無資料</span>')
                   + ' · ' + hours(cur.wait) + ' 等')
               + '</div>';
       }
       function spark(values, colour) {
           var W = 120, H = 30, mx = Math.max.apply(null, values.concat([0])) || 1, n = Math.max(values.length - 1, 1);
           return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="'
               + values.map(function (v, i) {
                   return (i / n * (W - 4) + 2).toFixed(1) + ',' + (H - 3 - v / mx * (H - 7)).toFixed(1);
               }).join(' ') + '" style="fill:none;stroke:' + colour + ';stroke-width:1.5;stroke-linejoin:round"/></svg>';
       }
       function routeDots(s) {
           var route = s.route || [], at = route.indexOf(s.stage);
           return '<span class="route" aria-label="route ' + esc(route.join(' → ')) + '">' + route.map(function (k, i) {
               return '<i title="' + esc(k) + '"' + (i <= at ? ' style="background:var(--st-' + esc(k) + ')"' : ' class="todo"') + '></i>';
           }).join('') + '</span>';
       }
       // `off` maps an option to the reason it cannot be chosen right now.
       function segHtml(key, opts, current, off) {
           return '<div class="seg" role="group" data-seg="' + key + '">' + opts.map(function (o) {
               var why = off && off[o[0]];
               return '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (current === o[0]) + '"'
                   + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + esc(o[1]) + '</button>';
           }).join('') + '</div>';
       }
       function crumbHtml(parts) {
           return parts.map(function (p, i) {
               return i === parts.length - 1 ? '<span class="cur">' + esc(p[0]) + '</span>'
                   : '<a href="' + esc(p[1]) + '">' + esc(p[0]) + '</a>';
           }).join('<i>/</i>');
       }
       function histSvg(bars, o) {
           if (bars.disabled) return '<p class="note">' + esc(bars.disabled) + '</p>';
           var W = 1200, H = 318, L = 52, R = 4, T = 26, AX = 48, plotH = H - T - AX, base = T + plotH;
           var n = bars.days.length || 1, slot = (W - L - R) / n, bw = Math.min(24, slot * 0.6);
           var top = niceTop(bars.max), y = function (v) { return v / top * plotH; };
           var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 ' + n + ' 天每日'
               + METRIC_LABEL[o.metric] + '，' + DIM_LABEL[o.dim] + '">';
           [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
               var yy = (base - f * plotH).toFixed(1);
               out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>'
                   + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">'
                   + metricText(o.metric, top * f) + '</text>';
           });
           bars.days.forEach(function (b, i) {
               var cx = (L + i * slot + slot / 2).toFixed(1), x0 = (L + i * slot + slot / 2 - bw / 2).toFixed(1);
               var c = 0, open = b.day === o.sel, mark = open || b.day === o.today;
               out += '<g class="bar"' + (o.sel && !open ? ' style="opacity:.36"' : '') + '>';
               bars.keys.forEach(function (k) {
                   if (!b.parts[k]) return;
                   var h = y(b.parts[k]);
                   out += '<rect x="' + x0 + '" y="' + (base - c - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="'
                       + Math.max(h - 1, 0.5).toFixed(1) + '" style="fill:' + colorOf(o.dim, k, o.pkeys) + '"/>';
                   c += h;
               });
               out += '</g>'
                   + (b.total ? '<text class="tick" x="' + cx + '" y="' + (base - c - 7).toFixed(1) + '" text-anchor="middle">'
                       + metricText(o.metric, b.total) + '</text>' : '')
                   + '<text class="tick" x="' + cx + '" y="' + (base + 17) + '" text-anchor="middle"'
                   + (mark ? ' style="fill:var(--ink);font-weight:600"' : '') + '>' + Number(b.day.slice(8)) + '</text>'
                   + (b.day === o.today || b.day.slice(8) === '01' || i === 0
                       ? '<text x="' + cx + '" y="' + (base + 33) + '" text-anchor="middle">'
                       + (b.day === o.today ? '今天' : Number(b.day.slice(5, 7)) + '月') + '</text>' : '')
                   + '<rect class="hit" data-href="' + (open ? '#/' : '#/d/' + b.day) + '" x="' + (L + i * slot).toFixed(1)
                   + '" y="' + (T - 10) + '" width="' + slot.toFixed(1) + '" height="' + (plotH + AX) + '"><title>'
                   + esc(b.day + ' 合計 ' + metricText(o.metric, b.total) + bars.keys.filter(function (k) { return b.parts[k]; })
                       .map(function (k) { return '\n' + keyLabel(o.dim, k, o.names) + ' ' + metricText(o.metric, b.parts[k]); }).join(''))
                   + '</title></rect>';
           });
           return out + '</svg>';
       }
       function legendHtml(bars, o) {
           if (bars.disabled) return '';
           var own = o.dim !== 'project' ? bars.keys : bars.keys.filter(function (k) {
               var i = o.pkeys.indexOf(k);
               return i >= 0 && i < 5;
           });
           return '<span class="muted">由下而上</span>' + own.map(function (k) {
               return '<span><i class="sw" style="background:' + colorOf(o.dim, k, o.pkeys) + '"></i>' + esc(keyLabel(o.dim, k, o.names)) + '</span>';
           }).join('') + (own.length < bars.keys.length
               ? '<span><i class="sw" style="background:var(--p-5)"></i>其他 ' + (bars.keys.length - own.length) + ' 個</span>' : '');
       }
       function dayPanelHtml(p, o) {
           var i = o.days.indexOf(p.day);
           var split = function (dim) {
               var by = p.by[dim], keys = orderKeys(dim, by);
               return '<div class="split"><div class="split-h"><span>' + DIM_LABEL[dim] + '</span><span class="num">' + usd(p.usd) + '</span></div>'
                   + '<div class="split-bar">' + keys.map(function (k) {
                       return '<i title="' + esc(keyLabel(dim, k, o.names) + ' ' + usd(by[k])) + '" style="flex:' + by[k] + ' 1 0;background:'
                           + colorOf(dim, k, o.pkeys) + '"></i>';
                   }).join('') + '</div><div class="split-leg">' + keys.map(function (k) {
                       return '<span><i class="sw" style="background:' + colorOf(dim, k, o.pkeys) + '"></i>' + esc(keyLabel(dim, k, o.names))
                           + ' <b>' + usd(by[k]) + '</b><em>' + Math.round(by[k] / (p.usd || 1) * 100) + '%</em></span>';
                   }).join('') + '</div></div>';
           };
           var ro = function (l, v) { return '<div class="ro sm"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; };
           return '<section class="panel day" id="daypanel" aria-label="某日花費"><div class="day-head">'
               + '<div><div class="eyebrow">某日花費</div><h2>' + esc(p.day) + (p.day === o.today ? ' <small class="muted">今天</small>' : '') + '</h2></div>'
               + '<div class="readouts">' + ro('當日花費', usd(p.usd)) + ro('token', tokens(p.tokens)) + ro('active', hours(p.active))
               + ro('<i class="hatchsw"></i>等待', hours(p.wait)) + '</div>'
               + '<div class="day-nav">' + (i > 0 ? '<a class="btn" href="#/d/' + o.days[i - 1] + '">‹ 前一天</a>' : '')
               + (i >= 0 && i < o.days.length - 1 ? '<a class="btn" href="#/d/' + o.days[i + 1] + '">後一天 ›</a>' : '')
               + '<a class="btn" href="#/" aria-label="收起某日花費">收起 ✕</a></div></div>'
               + '<div class="day-body"><div>' + ['project', 'model', 'stage', 'who'].map(split).join('') + '</div>'
               + '<div><div class="h2">當日 sessions <small>' + p.sessions.length + ' 個 · 只計這一天內發生的花費</small></div>'
               + '<div class="tbl-wrap"><table class="t"><thead><tr><th>任務</th><th class="r">active</th><th class="r">等待</th>'
               + '<th class="r">當日花費</th><th class="r">佔當日</th></tr></thead><tbody>'
               + p.sessions.map(function (s) {
                   return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                       + esc(s.task || '（未命名）') + '</a><div class="muted"><i class="sw" style="background:' + colorOf('project', s.pkey, o.pkeys)
                       + '"></i> ' + esc(o.names[s.pkey] || s.pkey) + '</div></td>'
                       + '<td class="r">' + hours(s.active) + '</td><td class="r muted">' + hours(s.wait) + '</td>'
                       + '<td class="r">' + usd(s.usd) + '</td><td class="r muted">' + Math.round(s.usd / (p.usd || 1) * 100) + '%</td></tr>';
               }).join('') + '</tbody><tfoot><tr><td>合計</td><td class="r">' + hours(p.active) + '</td><td class="r">' + hours(p.wait)
               + '</td><td class="r">' + usd(p.usd) + '</td><td class="r">100%</td></tr></tfoot></table></div></div></div></section>';
       }
       function projectsHtml(rows, o) {
           return '<div class="h2">專案 <small>近 30 天</small></div>'
               + '<div class="projrow head"><span>專案</span><span>每日花費</span><span class="r">花費</span><span class="r">session</span>'
               + '<span class="r">最後活動</span></div>'
               + (rows.length ? rows.map(function (r) {
                   var c = colorOf('project', r.pkey, o.pkeys);
                   return '<a class="projrow" href="' + projectHash(r.pkey) + '"><span style="min-width:0"><span class="nm"><i class="sw" style="background:'
                       + c + '"></i>' + esc(o.names[r.pkey] || r.pkey) + '</span><span class="pth mono">' + esc(r.pkey) + '</span></span>'
                       + '<span>' + spark(r.daily, c) + '</span><span class="r">' + usd(r.usd) + '</span><span class="r">' + r.n + '</span>'
                       + '<span class="r muted">' + ago(r.last) + '</span></a>';
               }).join('') : '<p class="note">這台機器上沒有 session</p>');
       }
       function recentHtml(list, o) {
           return '<div class="h2">最近 sessions <small>依最後動作，最新在上</small><span class="spacer"></span>'
               + '<a class="btn" href="#/list">看全部 →</a></div>'
               + '<div class="tbl-wrap"><table class="t"><thead><tr><th>任務</th><th>專案</th><th>stage</th><th class="r">花費</th>'
               + '<th class="r">token</th><th>狀態</th></tr></thead><tbody>'
               + list.map(function (s) {
                   var t = sessionTotals(s);
                   return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '">'
                       + esc(s.task || '（未命名）') + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                       + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                       + '<td>' + routeDots(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                       + '<td>' + statePill(s) + '</td></tr>';
               }).join('') + '</tbody></table></div>';
       }
   ```

7. 在 `assets/station/station.js` 的 `module.exports = {` 裡，`routeGroups: routeGroups, routeLedger: routeLedger,` 那一行之後加上這三行：

   ```js
               localDay: localDay, lastDays: lastDays, parseHash: parseHash, family: family, sessionTotals: sessionTotals,
               windowTotals: windowTotals, dayBars: dayBars, dayPanel: dayPanel, projectRows: projectRows, kpiHtml: kpiHtml,
               histSvg: histSvg, dayPanelHtml: dayPanelHtml, projectsHtml: projectsHtml, recentHtml: recentHtml,
   ```

8. Green：跑 step 1 的指令，`ℹ pass N+10`、`ℹ fail 0`。有一個不過就停下，回報測試名與 assertion 訊息；不要改測試的期望值去配合輸出。
9. Red，mutation 一（按開始日歸檔，就是舊 `flow()` 的錯）。在 `assets/station/station.js` 的 `dayBars` 裡，用 Edit 把 `add(r.day, dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens));` 改成 `add(localDay(Date.parse(s.started)), dimKey(dim, s, r), metric === 'usd' ? r.usd || 0 : tokenSum(r.tokens));`。只跑 `node --test tests/station-view.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`：`✖` 裡有 `頁面對帳：a day's bar total equals its day panel total equals that day's days[].usd across sessions` 與 `dayBars stacks each day…`。回報 `✖` 行。再用 Edit 改回原字串，`grep -c "add(r.day, dimKey(dim, s, r), metric === 'usd'" assets/station/station.js` 印 `1`。檔案裡有還沒 commit 的實作，不要用 `git checkout` 還原。
10. Red，mutation 二（某日花費漏掉一列）。在 `dayPanel` 裡，用 Edit 把 `(s.days || []).forEach(function (r) {` 改成 `(s.days || []).slice(1).forEach(function (r) {`——只改 `dayPanel` 裡那一處，它的下兩行是 `if (r.day !== day) return;` 與 `var u = r.usd || 0;`；Edit 的 old_string 連這兩行一起帶，才不會改到別的函式。跑同一個指令：`✖` 裡有 `頁面對帳：…` 與 `dayPanel splits one day four ways…`。回報 `✖` 行。用 Edit 改回，`grep -c "slice(1).forEach" assets/station/station.js` 印 `0`。再跑一次：`ℹ fail 0`。
11. DOM 區的狀態。在 `assets/station/station.js`：刪掉 :18 `var PAL = …` 與 :19 `var WD = …`（只有 `flow()`、`weekBars()` 用）；把 :175 `var page = 'overview', sel = null, sortKey = 'updated', sortDir = -1;` 換成下面前三行；在 :185 `S.sessions.forEach(function (s) { s.label = LAB[s.root]; });` 之後插入後四行；刪掉 :186-188 的 `var sum = …` 與 :192-197 的 `var windowed = …`（只有 `kpis()`、`overview()` 用），`var rows = …` 留著：

   ```js
       var route = parseHash(w.location && w.location.hash), sel = null, sortKey = 'updated', sortDir = -1;
       // The home page's two segmented controls; Tasks 7 and 8 add their own keys.
       var view = { metric: 'usd', dim: 'model' };
       var DAYS = lastDays(NOW, 30), PREV = lastDays(NOW - 30 * 864e5, 30), TODAY = DAYS[DAYS.length - 1];
       var NAMES = projectNames(S.sessions);
       var PKEYS = projectRows(S.sessions, DAYS).map(function (r) { return r.pkey; });
       var VIEWS = {}, CRUMBS = {};
   ```

12. 首頁。在 `assets/station/station.js` 刪掉 `navGroup()` 與舊 `drawSide()`（:199-246）、`kpis()`（:247-277）、`flow()` 連同它上面的註解（:279-366）、`weekBars()`（:367-396）、`gauge()`（:398-429）、`overview()`（:575-637）。`routeName`、`routeGroups`、`routeLedger`、`taskCell`、`stageCell`、`goneNote`、`registryNote` 留著——`routeLedger` 與 `registryNote` 在 Task 7 搬上專案頁之前暫時沒有呼叫者。在原來 `overview()` 的位置插入：

   ```js
       // The home page answers the search box and nothing else: the list page's
       // facets narrow the list page, and a facet left set there that quietly
       // shrank these totals would read as a quieter month.
       function homeRows() {
           return S.sessions.filter(function (s) { return match(s, { q: f.q, state: '', project: '', stage: '' }); });
       }
       function homePage(r) {
           var R = homeRows();
           var sel = r.day && DAYS.indexOf(r.day) >= 0 ? r.day : null;
           var o = { metric: view.metric, dim: view.dim, sel: sel, today: TODAY, days: DAYS, names: NAMES, pkeys: PKEYS };
           var bars = dayBars(R, view.metric, view.dim, DAYS);
           var recent = R.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 12);
           return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
               + '<section class="panel hero"><div class="hero-top"><div class="hero-title"><div class="eyebrow">近 30 天</div>'
               + '<h1><b>' + DAYS[0].slice(5) + '</b> — <b>' + TODAY.slice(5) + '</b></h1></div>'
               + kpiHtml(windowTotals(R, DAYS), windowTotals(R, PREV)) + '</div>'
               + '<div class="controls"><div class="ctlgrp"><label>長條高度</label>'
               + segHtml('metric', [['tokens', 'token'], ['usd', '花費'], ['time', '時間']], view.metric) + '</div>'
               + '<div class="ctlgrp"><label>分段</label>'
               + segHtml('dim', [['model', '依 model'], ['project', '依專案'], ['stage', '依 stage'], ['who', '主 session 對 agent']],
                   view.dim, view.metric === 'time' ? { model: '時間沒有 model 可分' } : null) + '</div>'
               + '<div class="legend">' + legendHtml(bars, o) + '</div></div>'
               + '<div class="chart">' + histSvg(bars, o) + '</div></section>'
               + (sel ? dayPanelHtml(dayPanel(R, sel), o) : '')
               + '<div class="grid2"><section class="panel">' + projectsHtml(projectRows(R, DAYS), o) + '</section>'
               + '<section class="panel">' + recentHtml(recent, o) + '</section></div>'
               + profileCard('machine profile', 'machine', null, S.profiles && S.profiles.machine);
       }
   ```

13. 清單頁與比較頁。在 `assets/station/station.js`，把 `listPage()`（:648-669）整個換成下面的 `facetsHtml()` 與 `listPage()`；`.listwrap` 不再帶 inline 高度，`.page.fixed` 的 flex 版面（Task 5）接手：

   ```js
       // The side bar's three facets, moved onto the page they narrow.
       function facetsHtml() {
           var n = { live: 0, stale: 0, down: 0 }, byStage = {};
           S.sessions.forEach(function (s) { n[s.state]++; byStage[s.stage] = (byStage[s.stage] || 0) + 1; });
           var seg = function (key, items) {
               return '<div class="seg" role="group" data-facet="' + key + '">' + items.map(function (it) {
                   return '<button type="button" data-v="' + esc(it[0]) + '" aria-pressed="' + (f[key] === it[0]) + '"'
                       + (it[2] ? ' title="' + esc(it[2]) + '"' : '') + '>' + esc(it[1]) + '</button>';
               }).join('') + '</div>';
           };
           return '<div class="controls">'
               + '<div class="ctlgrp"><label>狀態</label>' + seg('state', [['', '全部 ' + S.sessions.length], ['live', 'live ' + n.live],
                   ['stale', 'stale ' + n.stale], ['down', 'down ' + n.down]]) + '</div>'
               + '<div class="ctlgrp"><label>Registry</label>' + seg('project', [['', '全部']].concat(S.projects.map(function (p) {
                   return [p.root, LAB[p.root] + (p.gone ? ' — gone' : ''), p.root];
               }))) + '</div>'
               + '<div class="ctlgrp"><label>停在哪一階段</label>' + seg('stage', [['', '全部']].concat(ROUTE.filter(function (k) {
                   return byStage[k];
               }).map(function (k) { return [k, k + ' ' + byStage[k]]; }))) + '</div></div>';
       }
       function listPage() {
           // A gone registry has no rows to lay out, so the note replaces the table
           // rather than sitting above it and pushing the list off the bottom.
           var head = '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span><span class="spacer"></span>';
           var gone = goneNote();
           if (gone) return head + '<a class="ctl" href="#/">▦ 首頁</a></div>' + facetsHtml() + gone;
           return head + '<a class="ctl" href="#/cmp">⇅ 比較勾選的 <b id="ncmp">' + picked.length + '</b> 個</a>'
               + '<a class="ctl" href="#/">▦ 首頁</a></div>' + facetsHtml()
               + '<div class="listwrap">'
               + '<div class="card listcard"><div class="scroll"><table>'
               + '<colgroup><col style="width:34px"><col><col style="width:130px"><col style="width:80px">'
               + '<col style="width:78px"><col style="width:86px"><col style="width:86px">'
               + '<col style="width:92px"></colgroup>'
               + '<thead id="lh"></thead><tbody id="lb"></tbody></table></div></div>'
               + '<div class="card det" id="det"></div></div>';
       }
   ```

   在 `cmpPage()` 裡：`'<span class="ctl" data-page="list">☰ 回清單</span></div>'` 換成 `'<a class="ctl" href="#/list">☰ 回清單</a></div>'`；`在清單上勾兩個有細節的 session，` 換成 `在專案頁或清單上勾兩個有細節的 session，`。在 `needDetail()` 裡，`if (page === 'cmp') draw();` 換成 `if (route.view === 'cmp') draw();`。
14. 路由與點擊。在 `assets/station/station.js`，把 `draw()`（:1346-1353）整個換成：

   ```js
       function drawSide() {
           var tail = CRUMBS[route.view] ? CRUMBS[route.view](route)
               : route.view === 'list' ? [['清單', null]] : route.view === 'cmp' ? [['比較', null]]
                   : route.day ? [[route.day, null]] : [];
           doc.getElementById('side').innerHTML = crumbHtml([['首頁', '#/']].concat(tail));
       }
       VIEWS.home = homePage;
       VIEWS.list = listPage;
       VIEWS.cmp = cmpPage;
       function draw() {
           route = parseHash(w.location.hash);
           var p = doc.getElementById('page');
           p.className = 'page' + (route.view === 'list' ? ' fixed' : '');
           p.innerHTML = (VIEWS[route.view] || homePage)(route);
           if (route.view === 'list') drawList();
           drawSide();
           doc.getElementById('gen').textContent = genText();
       }
       // Back, forward and every link on the page arrive here; opening a day keeps
       // the chart in view instead of jumping to the top.
       w.addEventListener('hashchange', function () {
           sel = null;
           draw();
           var dp = route.view === 'home' && route.day ? doc.getElementById('daypanel') : null;
           if (dp) dp.scrollIntoView({ block: 'nearest' }); else w.scrollTo(0, 0);
       });
   ```

   `assets/station/station.js` 的點擊代理裡，把

   ```js
           var pg = e.target.closest('[data-page]');
           if (pg) { page = pg.getAttribute('data-page'); sel = null; draw(); return; }
           var a = e.target.closest('a[data-k]');
           if (a) { f[a.getAttribute('data-k')] = a.getAttribute('data-v'); draw(); return; }
   ```

   換成（`assets/station/station.js`）：

   ```js
           var sg = e.target.closest('[data-seg] button');
           if (sg) { view[sg.parentNode.getAttribute('data-seg')] = sg.getAttribute('data-v'); draw(); return; }
           var fc = e.target.closest('[data-facet] button');
           if (fc) { f[fc.parentNode.getAttribute('data-facet')] = fc.getAttribute('data-v'); draw(); return; }
           var go = e.target.closest('[data-href]');
           if (go && !e.target.closest('a,button,input')) { w.location.hash = go.getAttribute('data-href'); return; }
   ```

   並把 `if (tr && page === 'list') {` 換成 `if (tr && route.view === 'list') {`。
15. 煙霧腳本。沒有 DOM 的單元測試走不到 DOM 區，一個打錯的函式名要到瀏覽器才會炸。寫 `.fankeel/build/2026-09-14-station-three-levels/smoke-page.js`（gitignored，不 commit），Tasks 7、8 會再跑它：

   ```js
   'use strict';
   // Runs assets/station/station.js's DOM half once per hash given on the command
   // line, against a stub document. It proves every name the page calls exists and
   // every view returns markup — what no unit test reaches. Not committed.
   const fs = require('node:fs');
   const path = require('node:path');
   const vm = require('node:vm');
   const ROOT = path.resolve(__dirname, '..', '..', '..');
   const src = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.js'), 'utf8');
   const at = (d, h) => new Date(2026, 8, d, h).getTime();
   const row = (d, stage, model, who, usd) => ({ day: '2026-09-' + d, stage, model, who, usd,
       tokens: { input: 1000, output: 100, cacheRead: 4000, cacheWrite5m: 500, cacheWrite1h: 0 },
       cost: { input: usd / 4, output: usd / 2, cacheRead: usd / 8, cacheWrite5m: usd / 8, cacheWrite1h: 0 } });
   const t0 = at(13, 23);
   const session = { id: 'aaaa1111-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'smoke',
       state: 'down', unknown: false, stage: 'verify', route: ['survey', 'build', 'verify'], step: 3, steps: 3,
       started: new Date(t0).toISOString(), updated: at(14, 2), ended: null, model: 'claude-opus-5', burn: 1, clock: 1,
       waited: 0, usd: 1, agentUsd: 0, unpriced: [], agents: 1, requests: 2, stages: [], claims: [], notes: [], next: '',
       guard: null, backtracks: 0, hasDetail: true, peak: 2000,
       days: [row(13, 'build', 'claude-opus-5', 'main', 1.25), row(14, 'verify', 'claude-sonnet-5', 'agent', 0.5)],
       spans: [{ day: '2026-09-13', stage: 'build', who: 'main', ms: 3600000 }, { day: '2026-09-14', stage: 'verify', who: 'wait', ms: 60000 }] };
   const detail = { requests: 2, peak: 2000, peakN: 2, noTime: 0, backtracks: 0, seqSource: 'task.js', marks: [], rises: [], backs: [], tasks: [],
       points: [{ n: 1, t: t0 + 60000, y: 1000, model: 'claude-opus-5' }, { n: 2, t: t0 + 7200000, y: 2000, model: 'claude-opus-5' }],
       seq: [{ stage: 'build', at: t0, source: 'cmd' }, { stage: 'verify', at: t0 + 3600000, source: 'cmd' }],
       waits: [{ askedAt: t0 + 600000, answeredAt: t0 + 900000, stage: 'build' }],
       dispatches: [{ key: 'd0', turn: 1, surface: 'agent', text: 'read', out: t0 + 1000000, back: t0 + 2000000, ret: 900, launch: 0, ids: ['a1'] }],
       rows: [{ id: 'a1', disp: 0, surface: 'agent', label: 'read', agentType: 'reader', model: 'claude-sonnet-5', phase: null,
           c: 50, k: 12, s: 1000, unpriced: [], from: t0 + 1000000, to: t0 + 2000000,
           cost: { input: 0.1, output: 0.3, cacheRead: 0.05, cacheWrite5m: 0.05, cacheWrite1h: 0 } }],
       runs: [], agentCents: 50, agentsTotal: { cents: 50 }, unpriced: [], steps: {}, dropped: 0,
       events: [{ t: t0 + 900000, kind: 'gate', askedAt: t0 + 600000, qs: [{ q: 'ok?', a: 'yes', own: false }] }],
       days: session.days, spans: session.spans };
   const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
   for (const hash of process.argv.slice(2)) {
       const els = {};
       const document = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el,
           head: { appendChild() {} }, querySelectorAll: () => [] };
       const window = { location: { hash }, addEventListener() {}, scrollTo() {},
           STATION: { generatedAt: new Date(at(14, 21)).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
               projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null }],
               profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
               sessions: [session] },
           STATION_DETAIL: { 'aaaa1111-0000': detail } };
       vm.runInNewContext(src, { window, document, URLSearchParams, fetch() {} });
       if (!els.page.innerHTML) throw new Error(hash + ': the page is empty');
       console.log(hash + '\t' + els.page.innerHTML.length + ' chars\t' + els.side.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
   }
   console.log('smoke done');
   ```

16. 跑：

   ```
   node --check assets/station/station.js && MSYS_NO_PATHCONV=1 node .fankeel/build/2026-09-14-station-three-levels/smoke-page.js '#/' '#/d/2026-09-14' '#/list' '#/cmp' '#/p/F%3A%5Cws%5Calpha' '#/s/aaaa1111-0000'
   ```

   六行各印字元數與麵包屑，最後一行 `smoke done`；少了 `smoke done` 就是某個 hash 丟了錯，回報錯誤訊息。`#/p/…` 與 `#/s/…` 在 Task 7、8 之前落回首頁，麵包屑只有 `首頁`。
17. 殘留檢查：`! grep -nE "function (flow|weekBars|gauge|kpis|overview|navGroup)\b|data-page=|page === |var (PAL|WD|sum|windowed) =" assets/station/station.js && echo gone` 印 `gone`。再跑 step 1 的指令：`ℹ pass N+10`、`ℹ fail 0`。
18. 不 commit。回報 steps 3、9、10 的 `✖` 行、step 16 的輸出與 step 17 的計數。parent 跑全套，commit `assets/station/station.js tests/station-view.test.js`，訊息 `feat: station home is a 30-day histogram on hash routes`。

## Task 7: 專案頁

**Files:**
- Modify: `assets/station/station.js` — 專案頁的純函式、`projectPage()`、`goneNote(root)` 與 `registryNote(root)` 改收參數、勾選比較時重畫專案頁
- Modify: `tests/station-view.test.js` — 三個測試，接在 Task 6 的測試之後
- Test: `tests/station-view.test.js`
- Read: `assets/station/station.css` — Task 5 的 class
- Read: `.fankeel/build/2026-09-14-station-three-levels/mockup.html` — `viewProject` :895-936、`drawProject` :938-992、`sessionsTable` :877-885、`miniMix` :640-644，標記的來源
- Read: `.fankeel/build/2026-09-14-station-three-levels/smoke-page.js` — Task 6 寫的煙霧腳本，這裡只跑
- Read: `tests/station-routes.test.js` — `routeLedger` 的兩個測試，搬上專案頁後照樣綠

**Interfaces:**
- Consumes（Task 6）：`sessionTotals(s)`、`windowTotals(sessions, days)`、`projectRows(sessions, days)`、`colorOf(dim, key, pkeys)`、`routeDots(s)`、`segHtml(key, opts, current, off)`、`sessionHash(id, tab)`、`niceTop(v)`、`metricText(metric, v)`、`MODEL_KEYS`、`METRIC_LABEL`、`VIEWS`、`CRUMBS`、`view`、`route`、`draw()`、`homeRows()`、`DAYS`、`TODAY`、`NAMES`、`PKEYS`，與測試檔裡的 `HOME`、`DAYS`、`count`；檔內既有的 `routeLedger(R)`、`goneNote()`、`registryNote()`、`picked`、`stamp(ms)`、`mins(ms)`、`usd(n)`、`tokens(n)`、`hours(ms)`、`esc(s)`
- Produces（`module.exports` 新增）：
  - `dayStart(day)` → 那個本地日 00:00 的 epoch ms
  - `projectHead(sessions, pkey, days)` → `{ pkey, usd, tokens, active, n }`
  - `sessionPoints(sessions, metric, t0, t1)`，`metric` ∈ `'usd'|'tokens'` → `[{ id, task, t, v }]`，`t` 是 `started` 的 epoch ms、落在 `[t0, t1)`，依 `t` 排序；`v` 是 `sessionTotals(s)` 的 `usd` 或 `tokens`
  - `projectChart(series, o)`，`series = [{ pkey, name, colour, points }]`、`o = { metric, t0, t1, days, today }` → SVG 字串，共用一條 y 軸
  - `projectSessionsHtml(list, picked)` → 表格 HTML
- Produces（不 export）：`miniMix(models)`；DOM 區 `projectPage(r)`、`VIEWS.project`、`CRUMBS.project`、`view.pMetric`、`view.compare`；`goneNote(root)`、`registryNote(root)` 改收 registry 根

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼與測試；抄寫加上一次煙霧腳本。

1. Baseline：`node --test tests/station-view.test.js tests/station-routes.test.js tests/station-compare.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，記下 pass 數 N，`ℹ fail 0`。
2. 在 `tests/station-view.test.js` 檔尾（Task 6 的測試之後，用它的 `HOME`、`DAYS`、`count`）加上：

   ```js
   // --- the three levels: project -----------------------------------------------
   test('projectHead and sessionPoints take one project key\'s figures from days, one point per session start', () => {
       assert.deepEqual(V.projectHead(HOME, 'F:\\ws\\alpha', DAYS),
           { pkey: 'F:\\ws\\alpha', usd: 3.75, tokens: 35100, active: 6000000, n: 2 });
       assert.equal(V.dayStart('2026-09-14'), new Date(2026, 8, 14).getTime());
       const t0 = V.dayStart(DAYS[0]), t1 = V.dayStart(DAYS[29]) + 864e5;
       const alpha = HOME.filter((s) => s.root === 'F:\\ws\\alpha');
       assert.deepEqual(V.sessionPoints(alpha, 'usd', t0, t1).map((p) => [p.id, p.v]),
           [['cccc3333-0000', 0], ['aaaa1111-0000', 3.75], ['bbbb2222-0000', 4.75]]);
       assert.deepEqual(V.sessionPoints(HOME, 'tokens', t0, t1).map((p) => p.v), [0, 35100, 7605], 'last month\'s session is off the axis');
   });

   test('projectChart draws a line per project on one y axis, and every point links to its session', () => {
       const t0 = V.dayStart(DAYS[0]), t1 = V.dayStart(DAYS[29]) + 864e5;
       const of = (k) => V.sessionPoints(HOME.filter((s) => s.pkey === k), 'tokens', t0, t1);
       const beta = { pkey: 'F:\\ws\\alpha/Beta', name: 'alpha / Beta', colour: 'var(--p-0)', points: of('F:\\ws\\alpha/Beta') };
       const alpha = { pkey: 'F:\\ws\\alpha', name: 'alpha', colour: 'var(--p-1)', points: of('F:\\ws\\alpha') };
       const o = { metric: 'tokens', t0, t1, days: DAYS, today: DAYS[29] };
       const svg = V.projectChart([beta, alpha], o);
       assert.equal(count(svg, /<polyline /g), 2);
       assert.equal(count(svg, /<circle class="hit" data-href="#\/s\//g), 3);
       assert.match(svg, /data-href="#\/s\/bbbb2222-0000"/);
       assert.match(svg, />50k<\/text>/, 'alpha\'s 35k sets the shared axis');
       assert.doesNotMatch(V.projectChart([beta], o), />50k<\/text>/, 'alone, Beta\'s 8k does not reach it');
   });

   test('the project sessions table ticks for 比較, and prints dollars and a model mix from days', () => {
       const html = V.projectSessionsHtml(HOME.slice(0, 3), ['aaaa1111-0000']);
       assert.match(html, /data-cmp="aaaa1111-0000" aria-label="選來比較" checked>/);
       assert.match(html, /data-cmp="cccc3333-0000" aria-label="選來比較" disabled/);
       assert.match(html, /data-href="#\/s\/aaaa1111-0000"[\s\S]*?\$3\.75[\s\S]*?<span class="mini-mix" title="opus \$3\.25、sonnet \$0\.50">/);
       assert.doesNotMatch(html, /\$99/);
   });
   ```

3. Red：跑 step 1 的指令，三個新測試 `✖`（`V.projectHead is not a function`）。回報 `✖` 行。
4. 在 `assets/station/station.js`，Task 6 的 `recentHtml()` 之後插入：

   ```js
       // ---- the project page -------------------------------------------------
       function dayStart(day) {
           return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))).getTime();
       }
       function projectHead(sessions, pkey, days) {
           var mine = sessions.filter(function (s) { return s.pkey === pkey; });
           var t = windowTotals(mine, days), row = projectRows(mine, days)[0];
           return { pkey: pkey, usd: t.usd, tokens: t.tokens, active: t.active, n: row ? row.n : 0 };
       }
       // A session's whole spend, at the moment it started.
       function sessionPoints(sessions, metric, t0, t1) {
           return sessions.map(function (s) {
               var t = sessionTotals(s);
               return { id: s.id, task: s.task, t: Date.parse(s.started), v: metric === 'usd' ? t.usd : t.tokens };
           }).filter(function (p) { return p.t >= t0 && p.t < t1; }).sort(function (a, b) { return a.t - b.t; });
       }
       // The 對照專案 line is a second series on the same axes, not a second chart.
       function projectChart(series, o) {
           var W = 1200, H = 340, L = 60, R = 24, T = 16, AX = 40, plotH = H - T - AX, base = T + plotH;
           var X = function (t) { return (L + (t - o.t0) / ((o.t1 - o.t0) || 1) * (W - L - R)).toFixed(1); };
           var all = [0];
           series.forEach(function (s) { s.points.forEach(function (p) { all.push(p.v); }); });
           var top = niceTop(Math.max.apply(null, all));
           var Y = function (v) { return (base - v / top * plotH).toFixed(1); };
           var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="每個 session 的' + METRIC_LABEL[o.metric] + '，依開始時間">';
           [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
               out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(top * f) + '" y2="' + Y(top * f) + '"/>'
                   + '<text class="tick" x="' + (L - 10) + '" y="' + (Number(Y(top * f)) + 4) + '" text-anchor="end">' + metricText(o.metric, top * f) + '</text>';
           });
           o.days.forEach(function (d, i) {
               var x = X(dayStart(d) + 432e5);
               if (i % 2 === 0 || d === o.today) out += '<text class="tick" x="' + x + '" y="' + (base + 17) + '" text-anchor="middle">' + Number(d.slice(8)) + '</text>';
               if (d === o.today || d.slice(8) === '01' || i === 0) {
                   out += '<text x="' + x + '" y="' + (base + 33) + '" text-anchor="middle">' + (d === o.today ? '今天' : Number(d.slice(5, 7)) + '月') + '</text>';
               }
           });
           series.forEach(function (s) {
               if (!s.points.length) return;
               out += '<polyline points="' + s.points.map(function (p) { return X(p.t) + ',' + Y(p.v); }).join(' ')
                   + '" style="fill:none;stroke:' + s.colour + ';stroke-width:2;stroke-linejoin:round"/>';
               s.points.forEach(function (p) {
                   out += '<circle class="hit" data-href="' + sessionHash(p.id) + '" cx="' + X(p.t) + '" cy="' + Y(p.v) + '" r="5" style="fill:'
                       + s.colour + ';stroke:var(--panel);stroke-width:2"><title>' + esc(s.name + ' · ' + (p.task || p.id) + ' · ' + stamp(p.t)
                       + ' · ' + metricText(o.metric, p.v)) + '</title></circle>';
               });
           });
           return out + '</svg>';
       }
       function miniMix(models) {
           var keys = MODEL_KEYS.filter(function (k) { return models[k] > 0; });
           var tot = keys.reduce(function (n, k) { return n + models[k]; }, 0);
           if (!tot) return '<span class="muted">—</span>';
           return '<span class="mini-mix" title="' + keys.map(function (k) { return k + ' ' + usd(models[k]); }).join('、') + '">'
               + keys.map(function (k) {
                   return '<i style="width:' + (models[k] / tot * 100).toFixed(2) + '%;background:var(--m-' + k + ')"></i>';
               }).join('') + '</span>';
       }
       function projectSessionsHtml(list, picked) {
           if (!list.length) return '<p class="note">這個專案近 30 天沒有 session</p>';
           return '<div class="tbl-wrap"><table class="t"><thead><tr><th aria-label="選來比較"></th><th>任務</th><th>開始</th>'
               + '<th class="r">時長</th><th>stage 進度</th><th class="r">花費</th><th class="r">token</th><th>model 組成</th></tr></thead><tbody>'
               + list.map(function (s) {
                   var t = sessionTotals(s), started = Date.parse(s.started);
                   return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td><input type="checkbox" data-cmp="' + esc(s.id)
                       + '" aria-label="選來比較"' + (picked.indexOf(s.id) >= 0 ? ' checked' : '')
                       + (s.hasDetail ? '' : ' disabled title="沒有 transcript，沒有細節可比"') + '></td>'
                       + '<td class="task"><a href="' + sessionHash(s.id) + '">' + esc(s.task || '（未命名）') + '</a></td>'
                       + '<td class="muted">' + stamp(started) + '</td><td class="r">' + mins((s.updated || started) - started) + '</td>'
                       + '<td>' + routeDots(s) + ' <span class="muted">' + esc(s.stage || '—') + '</span></td>'
                       + '<td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td><td>' + miniMix(t.models) + '</td></tr>';
               }).join('') + '</tbody></table></div>';
       }
   ```

   並在 `assets/station/station.js` 的 `module.exports = {` 裡、Task 6 加的那三行之後加上這兩行：

   ```js
               dayStart: dayStart, projectHead: projectHead, sessionPoints: sessionPoints, projectChart: projectChart,
               projectSessionsHtml: projectSessionsHtml,
   ```

5. Green：跑 step 1 的指令，`ℹ pass N+3`、`ℹ fail 0`。
6. registry 的卡片改看專案的根。在 `assets/station/station.js`：`goneNote()` 的前三行換成下面前三行、`registryNote()` 的前三行換成後三行；`listPage()` 裡的 `var gone = goneNote();` 換成 `var gone = goneNote(f.project);`：

   ```js
       function goneNote(root) {
           if (!root) return '';
           var hit = S.projects.filter(function (p) { return p.root === root; });
       function registryNote(root) {
           if (!root) return '';
           var hit = S.projects.filter(function (p) { return p.root === root; });
   ```

7. 專案頁。在 `assets/station/station.js`，Task 6 的 `homePage()` 之後插入：

   ```js
       view.pMetric = 'usd';
       view.compare = '';
       // A session counts on this page when it started inside the thirty days or
       // spent inside them.
       function inWindow(s) {
           return Date.parse(s.started) >= dayStart(DAYS[0]) || (s.days || []).some(function (x) { return DAYS.indexOf(x.day) >= 0; });
       }
       function projectPage(r) {
           var all = S.sessions.filter(function (s) { return s.pkey === r.pkey; });
           if (!all.length) return '<section class="panel"><p class="note">這頁上沒有專案 ' + esc(r.pkey) + '</p></section>';
           var R = homeRows(), mine = R.filter(function (s) { return s.pkey === r.pkey; });
           var head = projectHead(R, r.pkey, DAYS), t0 = dayStart(DAYS[0]), t1 = dayStart(TODAY) + 864e5;
           if (view.compare === r.pkey) view.compare = '';
           var series = [r.pkey].concat(view.compare ? [view.compare] : []).map(function (k) {
               return { pkey: k, name: NAMES[k] || k, colour: colorOf('project', k, PKEYS),
                   points: sessionPoints(R.filter(function (s) { return s.pkey === k; }), view.pMetric, t0, t1) };
           });
           var others = PKEYS.filter(function (k) { return k !== r.pkey; });
           var list = mine.filter(inWindow).sort(function (a, b) { return Date.parse(b.started) - Date.parse(a.started); });
           var ro = function (l, v) { return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; };
           return '<section class="panel"><div class="hero-top"><div><div class="eyebrow">專案</div>'
               + '<h1 class="s-title"><i class="sw" style="background:' + colorOf('project', r.pkey, PKEYS) + '"></i> '
               + esc(NAMES[r.pkey] || r.pkey) + '</h1><div class="mono muted">' + esc(r.pkey) + '</div></div>'
               + '<div class="readouts">' + ro('近 30 天花費', usd(head.usd)) + ro('token', tokens(head.tokens))
               + ro('active 時間', hours(head.active)) + ro('session', head.n) + '</div></div>'
               + '<div class="controls"><div class="ctlgrp"><label>縱軸</label>'
               + segHtml('pMetric', [['tokens', 'token'], ['usd', '花費']], view.pMetric) + '</div>'
               + (others.length ? '<div class="ctlgrp"><label>對照專案</label>' + segHtml('compare', [['', '無']].concat(others.map(function (k) {
                   return [k, NAMES[k] || k];
               })), view.compare) + '</div>' : '')
               + '<div class="legend">' + series.map(function (s) {
                   return '<span><i class="sw ln" style="background:' + s.colour + '"></i>' + esc(s.name) + ' <span class="muted">'
                       + s.points.length + ' 個</span></span>';
               }).join('') + '</div></div>'
               + '<div class="chart">' + projectChart(series, { metric: view.pMetric, t0: t0, t1: t1, days: DAYS, today: TODAY }) + '</div>'
               + '<div class="note">每個點是一個 session，放在它開始的時刻；線依時間先後連接，點一下開啟那個 session。</div></section>'
               + registryNote(all[0].root)
               + '<section class="panel"><div class="h2">Sessions <small>近 30 天 ' + list.length + ' 個，最新在上；勾兩列進比較</small>'
               + '<span class="spacer"></span><a class="ctl" href="#/cmp">⇅ 比較勾選的 <b>' + picked.length + '</b> 個</a></div>'
               + projectSessionsHtml(list, picked) + '</section>'
               + '<section class="panel"><div class="h2">各 route 的階段 <small>只算這個專案</small></div>' + routeLedger(mine) + '</section>';
       }
       VIEWS.project = projectPage;
       CRUMBS.project = function (r) { return [[NAMES[r.pkey] || r.pkey, null]]; };
   ```

8. 勾選比較。在 `assets/station/station.js` 的點擊代理裡，`input[data-cmp]` 那段的 `if (picked.length > 2) picked.shift();` 之後插入一行：

   ```js
               if (route.view === 'project') { draw(); return; }
   ```

9. 煙霧：

   ```
   node --check assets/station/station.js && MSYS_NO_PATHCONV=1 node .fankeel/build/2026-09-14-station-three-levels/smoke-page.js '#/' '#/list' '#/p/F%3A%5Cws%5Calpha' '#/p/nowhere'
   ```

   `#/p/F%3A%5Cws%5Calpha` 那行的麵包屑是 `首頁 / alpha`；`#/p/nowhere` 那行印得出字元數（「這頁上沒有專案」）且麵包屑是 `首頁 / nowhere`；最後一行 `smoke done`。
10. 殘留檢查：`! grep -n "f\.project) return ''" assets/station/station.js && echo gone` 印 `gone`（兩張卡片不再讀 facet）。跑 step 1 的指令：`ℹ pass N+3`、`ℹ fail 0`。
11. 不 commit。回報 step 3 的 `✖` 行、step 9 的輸出與 step 10 的計數。parent 跑全套，commit `assets/station/station.js tests/station-view.test.js`，訊息 `feat: station project page — sessions over 30 days, compare line`。

## Task 8: session 頁四分頁

**Files:**
- Modify: `assets/station/station.js` — 時間線、花費表、session 標頭與分頁的純函式；`dispatchHtml()` 每列多 input 與 output 的 token（`split`）與 USD（`cost`）；`replayHtml()` 的 gate 列多等待時長；`sessionPage()`；細節檔載入後重畫 session 頁；事件篩選不再限定 `#det`；workflow 列收合
- Modify: `tests/station-view.test.js` — session 的 fixture 與七個測試，接在 Task 7 的測試之後
- Test: `tests/station-view.test.js`
- Read: `assets/station/station.css` — Task 5 的 class（`tabs`、`lane-legend`、`tl`、`wf-toggle`、`sumline`、`sub`、`child`）
- Read: `.fankeel/build/2026-09-14-station-three-levels/mockup.html` — `viewSession` :1023-1052、`timelineHtml` :1055-1064、`drawTimeline` :1066-1179、`tabCost` :1206-1237，標記的來源
- Read: `.fankeel/build/2026-09-14-station-three-levels/smoke-page.js` — Task 6 寫的煙霧腳本，這裡只跑
- Read: `tests/station-dispatch-view.test.js` — `dispatchHtml`、`replayHtml` 的既有測試，改完照樣綠
- Read: `lib/replay.js` — :114 gate 事件帶 `askedAt` 與回答時刻 `t`
- Read: `lib/usage.js` — :470 `dispatchesOf()` 給每個派工列建 `split`（五鍵 token）
- Read: `lib/detail.js` — :454 `const { file, models, ...rest } = r`，`split` 留在列上

**Interfaces:**
- Consumes（Task 6）：`TABS`、`MODEL_KEYS`、`pad2(n)`、`family(model)`、`sessionTotals(s)`、`sessionHash(id, tab)`、`projectHash(pkey)`、`colorOf(dim, key, pkeys)`、`routeDots(s)`、`niceTop(v)`、`VIEWS`、`CRUMBS`、`view`、`route`、`draw()`、`NAMES`，與測試檔裡的 `HOME`、`KEPT`、`count`；`window.STATION_DETAIL[id]` 的 `seq`、`points[]`（`t`、`y`、`model`）、`waits`（`[{ askedAt, answeredAt, stage }]`）、`dispatches[]`（`surface`、`text`、`out`、`back`、`ret`）、`rows[]`（`disp`、`label`、`model`、`k`、`c`、`from`、`to`、`cost` 五鍵 USD 或 `null`、`split` 五鍵 token——`dispatchesOf()` 在 `lib/usage.js:470` 建、`lib/detail.js:454` 的 `...rest` 留下）、`events[]`、`runs`、`requests`、`peak`、`tasks`；檔內既有的 `ctxSection(s, x)`、`tasksHtml(list)`、`dispatchHtml(x)`、`replayHtml(x)`、`sums(rows)`、`numCells(t, unpriced)`、`agentRow(r, cls, attr)`、`needDetail(s)`、`detailNote(s)`、`DETAIL`、`statePill(s)`、`dur(sec)`、`comma(n)`、`cents(c)`、`mins(ms)`、`stamp(ms)`、`usd(n)`、`tokens(n)`、`hours(ms)`、`esc(s)`
- Produces（`module.exports` 新增）：
  - `timelineModel(x)` → `{ t0, t1, points, segs: [{ stage, from, to }], waits: [{ stage, from, to, ms }], ticks: [{ t, family }], rets: [{ t, chars }], bars: [{ kind: 'agent'|'wf'|'kid', key, label, model, from, to, tokens, cents, ret, n? }] }`；`t0` 是 `seq` 第一步、`t1` 是最後一筆 request
  - `timelineSvg(m, closed)`，`closed = { 'wf-<i>': true }` → SVG 字串
  - `costModel(days)` → `{ stages: [{ stage, sub: cell, models: [{ model, cell }] }], main: cell, agent: cell, total: cell }`，`cell = { tokens: { input, output, cacheRead, cacheWrite }, cost: { 同四鍵 }, usd }`，`cacheWrite` 是 5m 加 1h
  - `costHtml(m)`、`sessionHeadHtml(s, x)`、`tabsHtml(s, tab, x)` → HTML 字串
- Produces（不 export）：`clock(ms)` → 本地 `HH:MM`；DOM 區 `sessionPage(r)`、`VIEWS.session`、`CRUMBS.session`、`view.closed`

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼與測試；抄寫、一個一行的 mutation、一次煙霧腳本。

1. Baseline：`node --test tests/station-view.test.js tests/station-dispatch-view.test.js tests/station-panel.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，記下 pass 數 N，`ℹ fail 0`。
2. 在 `tests/station-view.test.js` 檔尾（Task 7 的測試之後，用 Task 6 的 `HOME`、`count`）加上：

   ```js
   // --- the three levels: session -----------------------------------------------
   // A detail in the shape `serializeDetail()` writes from 2026-09-14 on: `points`
   // carry their model, `waits` their two moments, dispatch rows `from`, `to` and
   // a five-key `cost` (one of them null, as an unpriced row arrives), and the
   // five-key token `split` every row already carries (lib/usage.js:470).
   const T0 = new Date(2026, 8, 13, 22, 0).getTime();
   const DETAIL_X = {
       requests: 3, peak: 90000, peakN: 3, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], tasks: [],
       points: [{ n: 1, t: T0 + 60000, y: 20000, model: 'claude-opus-5' }, { n: 2, t: T0 + 3000000, y: 60000, model: 'claude-sonnet-5' },
           { n: 3, t: T0 + 7200000, y: 90000, model: 'claude-opus-5' }],
       seq: [{ stage: 'build', at: T0, source: 'cmd' }, { stage: 'verify', at: T0 + 5400000, source: 'cmd' }],
       waits: [{ askedAt: T0 + 600000, answeredAt: T0 + 1500000, stage: 'build' },
           { askedAt: T0 + 6000000, answeredAt: T0 + 6120000, stage: 'verify' }],
       dispatches: [
           { key: 'd0', turn: 2, surface: 'agent', text: 'read the map', out: T0 + 1800000, back: T0 + 2400000, ret: 6400, launch: 0, ids: ['a1'] },
           { key: 'd1', turn: 4, surface: 'workflow', text: 'build', out: T0 + 2500000, back: T0 + 4800000, ret: 9200, launch: 800, run: 'wf_1', ids: ['w1', 'w2'] },
       ],
       rows: [
           { id: 'a1', disp: 0, surface: 'agent', label: 'read:map', agentType: 'reader', model: 'claude-sonnet-5', phase: null,
             c: 19, k: 218, s: 600, unpriced: [], from: T0 + 1800000, to: T0 + 2400000,
             split: { input: 1500, output: 12000, cacheRead: 200000, cacheWrite5m: 4500, cacheWrite1h: 0 },
             cost: { input: 0.04, output: 0.1, cacheRead: 0.03, cacheWrite5m: 0.02, cacheWrite1h: 0 } },
           { id: 'w1', disp: 1, surface: 'workflow', label: 'impl:a', agentType: 'implementer', model: 'claude-sonnet-5', phase: 'Build',
             c: 164, k: 2820, s: 2000, unpriced: [], from: T0 + 2600000, to: T0 + 4600000,
             split: { input: 3000, output: 45000, cacheRead: 2700000, cacheWrite5m: 72000, cacheWrite1h: 0 },
             cost: { input: 0.5, output: 0.75, cacheRead: 0.25, cacheWrite5m: 0.14, cacheWrite1h: 0 } },
           { id: 'w2', disp: 1, surface: 'workflow', label: 'impl:b', agentType: 'implementer', model: 'claude-sonnet-5', phase: 'Build',
             c: 61, k: 889, s: 1200, unpriced: [], from: T0 + 3000000, to: T0 + 4200000, cost: null,
             split: { input: 800, output: 9000, cacheRead: 850000, cacheWrite5m: 29200, cacheWrite1h: 0 } },
       ],
       runs: [{ run: 'wf_1', name: 'build', agents: 2 }], agentCents: 244, agentsTotal: { cents: 244 }, unpriced: [], steps: {}, dropped: 0,
       events: [{ t: T0 + 1500000, kind: 'gate', askedAt: T0 + 600000, qs: [{ q: 'go?', a: 'yes', own: false }] }],
   };

   test('timelineModel: stages as wide as the time they took, each wait, a tick per request, a bar per agent and workflow', () => {
       const m = V.timelineModel(DETAIL_X);
       assert.deepEqual([m.t0, m.t1], [T0, T0 + 7200000], 'from the first step to the last request');
       assert.deepEqual(m.segs.map((g) => [g.stage, g.to - g.from]), [['build', 5400000], ['verify', 1800000]]);
       assert.deepEqual(m.waits.map((w) => [w.stage, w.ms]), [['build', 900000], ['verify', 120000]]);
       assert.deepEqual(m.ticks.map((q) => q.family), ['opus', 'sonnet', 'opus']);
       assert.deepEqual(m.bars.map((b) => [b.kind, b.label, b.from - T0, b.to - T0]), [['agent', 'read:map', 1800000, 2400000],
           ['wf', 'build', 2500000, 4800000], ['kid', 'impl:a', 2600000, 4600000], ['kid', 'impl:b', 3000000, 4200000]]);
       assert.deepEqual([m.bars[1].tokens, m.bars[1].cents, m.bars[1].n], [3709000, 225, 2], 'a workflow is the sum of its agents');
       assert.deepEqual(m.rets.map((q) => [q.t - T0, q.chars]), [[2400000, 6400], [4800000, 9200]]);
   });

   test('timelineSvg hatches each wait with its length, colours a tick per request, and folds a workflow shut', () => {
       const m = V.timelineModel(DETAIL_X);
       const svg = V.timelineSvg(m, {});
       assert.equal(count(svg, /<rect class="wait"/g), 2);
       assert.match(svg, />等 15m<\/text>/);
       assert.match(svg, />等 2m<\/text>/);
       assert.equal(count(svg, /<rect class="seg" /g), 2);
       assert.equal(count(svg, /<rect class="rq" /g), 3);
       assert.match(svg, /<rect class="rq" [^>]*style="fill:var\(--m-sonnet\)"/);
       assert.match(svg, />\+6\.4k 字元<\/text>/);
       assert.match(svg, /data-wf="wf-1"/);
       assert.match(svg, />impl:b</);
       assert.doesNotMatch(V.timelineSvg(m, { 'wf-1': true }), />impl:b</, 'a closed workflow hides its agents');
   });

   test('costModel lays a session\'s days out stage by model, subtotals main and agent, and totals', () => {
       const m = V.costModel(HOME[0].days);
       assert.deepEqual(m.stages.map((g) => [g.stage, g.sub.usd, g.models.map((x) => x.model)]),
           [['build', 1.75, ['claude-opus-5', 'claude-sonnet-5']], ['verify', 2, ['claude-opus-5']]]);
       assert.deepEqual([m.main.usd, m.agent.usd, m.total.usd], [3.25, 0.5, 3.75]);
       assert.deepEqual(m.total.tokens, { input: 6000, output: 600, cacheRead: 24000, cacheWrite: 4500 });
       assert.deepEqual([m.stages[0].sub.cost.output, m.stages[0].sub.cost.cacheWrite], [0.875, 0.21875]);
       assert.deepEqual(V.costModel(null).total.usd, 0);
   });

   test('頁面對帳：the session cost tab\'s total equals the sum of that session\'s days[].usd', () => {
       for (const s of HOME.filter((x) => x.days)) {
           const rows = s.days.reduce((n, r) => n + r.usd, 0);
           const m = V.costModel(s.days);
           assert.equal(m.total.usd, rows, s.id + ': the model');
           assert.equal(m.main.usd + m.agent.usd, rows, s.id + ': its two subtotals');
           const foot = V.costHtml(m).split('<tfoot>')[1];
           const shown = V.usd(rows).replace(/[$.]/g, '\\$&');
           assert.match(foot, new RegExp('<td>合計</td>[\\s\\S]*?<td class="r total">' + shown + '</td>'), s.id + ': the page');
       }
   });

   test('the dispatch tab adds input and output tokens and USD per row, and the events tab says how long each gate waited', () => {
       const html = V.dispatchHtml(DETAIL_X);
       assert.match(html, /<th class="r">input<\/th><th class="r">input USD<\/th><th class="r">output<\/th><th class="r">output USD<\/th>/);
       assert.match(html, /read:map[\s\S]*?<td class="r">2k<\/td><td class="r">\$0\.04<\/td><td class="r">12k<\/td><td class="r">\$0\.10<\/td>/,
           'tokens from split, dollars from cost');
       const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
       assert.match(foot, /<td class="r">5k<\/td><td class="r">\$0\.54<\/td><td class="r">66k<\/td><td class="r">\$0\.85<\/td>/,
           'the footer sums the rows; a null cost adds no dollars but its tokens still count');
       assert.match(V.replayHtml(DETAIL_X), /<span class="tg gate">gate<\/span>等了 15m00s/);
   });

   test('the session header reads dollars from days and time from the timeline; the four tabs link by hash', () => {
       const head = V.sessionHeadHtml(HOME[0], DETAIL_X);
       assert.match(head, /花費<\/div><div class="v">\$3\.75/);
       assert.match(head, /歷時<\/div><div class="v">2h</);
       assert.match(head, /2 次 gate/);
       assert.doesNotMatch(head, /\$99|\$198/);
       const tabs = V.tabsHtml(HOME[0], 'cost', DETAIL_X);
       assert.deepEqual([...tabs.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
           ['#/s/aaaa1111-0000', '#/s/aaaa1111-0000/cost', '#/s/aaaa1111-0000/dispatch', '#/s/aaaa1111-0000/events']);
       assert.match(tabs, /<a href="#\/s\/aaaa1111-0000\/cost" class="on" aria-current="page">花費</);
   });

   test('a kept v1 cache\'s single row: the cost tab counts its dollars, zero tokens and no per-kind dollars', () => {
       const m = V.costModel(KEPT.days);
       assert.deepEqual([m.total.usd, m.main.usd, m.agent.usd], [2.5, 2.5, 0]);
       assert.deepEqual(m.total.tokens, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
       assert.deepEqual(m.total.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
       assert.deepEqual(m.stages.map((g) => [g.stage, g.sub.usd]), [['none', 2.5]]);
       const html = V.costHtml(m);
       assert.match(html.split('<tfoot>')[1], /<td>合計<\/td>[\s\S]*?<td class="r total">\$2\.50<\/td>/);
       assert.doesNotMatch(html, /NaN|undefined/);
       assert.match(V.sessionHeadHtml(KEPT, null), /花費<\/div><div class="v">\$2\.50/);
   });
   ```

3. Red：跑 step 1 的指令。七個新測試 `✖`；`station-dispatch-view.test.js` 照舊綠。回報 `✖` 行。
4. 在 `assets/station/station.js`，Task 7 的 `projectSessionsHtml()` 之後插入時間線：

   ```js
       // ---- the session page -------------------------------------------------
       function clock(ms) { var d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
       // One real time axis, from the first stage step to the last request: a
       // stage is as wide as it lasted, a wait is the gap between a gate's question
       // and its answer, an agent runs from launch to return.
       function timelineModel(x) {
           var pts = (x.points || []).filter(function (p) { return isFinite(p.t); });
           var seq = x.seq || [], rows = x.rows || [], bars = [];
           var t0 = seq.length ? seq[0].at : pts.length ? pts[0].t : NaN;
           var t1 = pts.length ? pts[pts.length - 1].t : t0;
           var agent = function (r, kind, key, ret) {
               return { kind: kind, key: key, label: r.label || r.id, model: r.model, from: r.from, to: r.to,
                   tokens: (r.k || 0) * 1000, cents: r.c || 0, ret: ret };
           };
           (x.dispatches || []).forEach(function (d, i) {
               var kids = rows.filter(function (r) { return r.disp === i; });
               if (d.surface !== 'workflow') {
                   kids.forEach(function (r) { bars.push(agent(r, 'agent', r.id, d.ret)); });
                   return;
               }
               bars.push({ kind: 'wf', key: 'wf-' + i, label: d.text, model: null, from: d.out, to: d.back, ret: d.ret, n: kids.length,
                   tokens: kids.reduce(function (n, r) { return n + (r.k || 0); }, 0) * 1000,
                   cents: kids.reduce(function (n, r) { return n + (r.c || 0); }, 0) });
               kids.forEach(function (r) { bars.push(agent(r, 'kid', 'wf-' + i, null)); });
           });
           rows.filter(function (r) { return r.disp === null; }).forEach(function (r) { bars.push(agent(r, 'agent', r.id, null)); });
           return {
               t0: t0, t1: t1, points: pts, bars: bars,
               segs: seq.map(function (m, i) { return { stage: m.stage, from: m.at, to: i + 1 < seq.length ? seq[i + 1].at : t1 }; })
                   .filter(function (g) { return g.to > g.from; }),
               waits: (x.waits || []).map(function (w) {
                   return { stage: w.stage, from: w.askedAt, to: w.answeredAt, ms: w.answeredAt - w.askedAt };
               }),
               ticks: pts.map(function (p) { return { t: p.t, family: family(p.model) }; }),
               rets: (x.dispatches || []).filter(function (d) { return isFinite(d.back) && d.ret !== null && d.ret !== undefined; })
                   .map(function (d) { return { t: d.back, chars: d.ret }; }),
           };
       }
       function timelineSvg(m, closed) {
           if (!(m.t1 > m.t0)) return '<p class="note">這個 session 沒有帶時間的 request，畫不出時間線</p>';
           var shown = m.bars.filter(function (b) { return b.kind !== 'kid' || !closed[b.key]; });
           var W = 1200, G = 160, R = 18, RH = 26, ctx0 = 34, ctxH = 150, ctxB = ctx0 + ctxH;
           var st0 = ctxB + 22, stH = 34, wl = st0 + stH + 15, rq0 = wl + 16, rqH = 20, d0 = rq0 + rqH + 22;
           var H = d0 + Math.max(1, shown.length) * RH + 34, bottom = H - 26;
           var X = function (t) { return G + (Math.min(Math.max(t, m.t0), m.t1) - m.t0) / (m.t1 - m.t0) * (W - G - R); };
           var ctop = niceTop(Math.max.apply(null, m.points.map(function (p) { return p.y; }).concat([1])));
           var Yc = function (v) { return ctxB - v / ctop * ctxH; };
           var yAt = function (t) { var y = 0; m.points.forEach(function (p) { if (p.t <= t) y = p.y; }); return y; };
           var f1 = function (n) { return n.toFixed(1); };
           var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="session 時間線"><defs>'
               + '<pattern id="hw" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">'
               + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><rect width="1.4" height="5" style="fill:var(--hatch)"/></pattern></defs>'
               + '<text x="' + G + '" y="16" style="fill:var(--ink);font-weight:600">' + clock(m.t0) + '</text>'
               + '<text x="' + (W - R) + '" y="16" text-anchor="end" style="fill:var(--ink);font-weight:600">' + clock(m.t1) + '</text>'
               + '<text class="tick" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">共 ' + mins(m.t1 - m.t0) + '</text>';
           m.waits.forEach(function (w) {
               out += '<rect class="wait" x="' + f1(X(w.from)) + '" y="' + (ctx0 - 6) + '" width="' + f1(Math.max(X(w.to) - X(w.from), 1))
                   + '" height="' + (bottom - ctx0 + 6) + '" style="fill:url(#hw);opacity:.38"/>';
           });
           out += '<text class="lane-l" x="0" y="' + (ctx0 + 10) + '">主 session context</text>'
               + '<text class="lane-s" x="0" y="' + (ctx0 + 26) + '">token；◆ 是 agent 回傳</text>';
           [0, 0.5, 1].forEach(function (f) {
               out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + G + '" x2="' + (W - R) + '" y1="' + f1(Yc(ctop * f)) + '" y2="' + f1(Yc(ctop * f)) + '"/>'
                   + '<text class="tick" x="' + (G - 8) + '" y="' + f1(Yc(ctop * f) + 4) + '" text-anchor="end">' + tokens(ctop * f) + '</text>';
           });
           if (m.points.length) {
               out += '<path d="' + m.points.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p.t)) + ',' + f1(Yc(p.y)); }).join('')
                   + '" style="fill:none;stroke:var(--ctx);stroke-width:2;stroke-linejoin:round"/>';
           }
           m.rets.forEach(function (q) {
               var x = X(q.t), y = Yc(yAt(q.t));
               out += '<path d="M' + f1(x) + ' ' + f1(y - 6) + ' ' + f1(x + 6) + ' ' + f1(y) + ' ' + f1(x) + ' ' + f1(y + 6) + ' ' + f1(x - 6) + ' ' + f1(y)
                   + 'Z" style="fill:var(--ink);stroke:var(--panel);stroke-width:2"/><text x="' + f1(x - 9) + '" y="' + f1(y - 9)
                   + '" text-anchor="end" style="font-size:10.5px;fill:var(--ink2)">+' + (q.chars >= 1000 ? (q.chars / 1000).toFixed(1) + 'k' : q.chars)
                   + ' 字元</text>';
           });
           out += '<text class="lane-l" x="0" y="' + (st0 + 15) + '">stage</text><text class="lane-s" x="0" y="' + (st0 + 30) + '">寬度 = 實際經過時間</text>';
           m.segs.forEach(function (g) {
               var x0 = X(g.from) + 1, w = Math.max(X(g.to) - x0 - 1, 0.5), text = g.stage + ' ' + mins(g.to - g.from);
               out += '<rect class="seg" x="' + f1(x0) + '" y="' + st0 + '" width="' + f1(w) + '" height="' + stH + '" rx="3" style="fill:'
                   + colorOf('stage', g.stage) + '"><title>' + esc(text) + '</title></rect>'
                   + (w > text.length * 7 + 14 ? '<text x="' + f1(x0 + 7) + '" y="' + (st0 + 21)
                       + '" style="fill:#fff;font-size:12px;font-weight:600;pointer-events:none">' + esc(text) + '</text>' : '');
           });
           m.waits.forEach(function (w) {
               var x0 = X(w.from), wd = Math.max(X(w.to) - x0, 1);
               out += '<rect class="waitst" x="' + f1(x0) + '" y="' + st0 + '" width="' + f1(wd) + '" height="' + stH + '" style="fill:url(#hw)"/>'
                   + '<text x="' + f1(x0 + wd / 2) + '" y="' + wl + '" text-anchor="middle" style="font-size:11px;fill:var(--ink);font-weight:500">等 '
                   + mins(w.ms) + '</text>';
           });
           out += '<text class="lane-l" x="0" y="' + (rq0 + 11) + '">主 session 請求</text><text class="lane-s" x="0" y="' + (rq0 + 25) + '">'
               + m.ticks.length + ' 次，顏色 = model</text>';
           m.ticks.forEach(function (q) {
               out += '<rect class="rq" x="' + f1(X(q.t) - 0.75) + '" y="' + rq0 + '" width="1.5" height="' + rqH + '" style="fill:var(--m-' + q.family + ')"/>';
           });
           out += '<line class="base" x1="0" x2="' + (W - R) + '" y1="' + (d0 - 10) + '" y2="' + (d0 - 10) + '"/>';
           if (!shown.length) out += '<text class="lane-s" x="' + G + '" y="' + (d0 + 16) + '">這個 session 沒有派出 agent 或 workflow</text>';
           shown.forEach(function (b, i) {
               var y = d0 + i * RH, ok = isFinite(b.from) && isFinite(b.to);
               var x0 = ok ? X(b.from) : G, x1 = ok ? Math.max(X(b.to), x0 + 2) : G + 2;
               var name = (b.kind === 'wf' ? (closed[b.key] ? '▸ ' : '▾ ') : '') + b.label;
               out += '<text class="mono" x="' + (b.kind === 'kid' ? 14 : 0) + '" y="' + (y + 17) + '" style="font-size:11.5px;fill:var(--'
                   + (b.kind === 'kid' ? 'ink2' : 'ink') + ')' + (b.kind === 'wf' ? ';font-weight:600' : '') + '">'
                   + esc(name.length > 21 ? name.slice(0, 20) + '…' : name) + '</text>'
                   + (b.kind === 'wf'
                       ? '<rect x="' + f1(x0) + '" y="' + (y + 4) + '" width="' + f1(x1 - x0) + '" height="18" rx="3" style="fill:var(--s-workflow);opacity:.2"/>'
                       : '<rect x="' + f1(x0) + '" y="' + (y + 7) + '" width="' + f1(x1 - x0) + '" height="12" rx="3" style="fill:var(--s-'
                       + (b.kind === 'kid' ? 'workflow' : 'agent') + ')"/>')
                   + '<text x="' + f1(x1 + 8) + '" y="' + (y + 17) + '" style="font-size:11.5px;fill:var(--ink2)">'
                   + esc((b.kind === 'wf' ? 'workflow · ' + b.n + ' 個 agent · ' : String(b.model || '—').replace(/^claude-/, '') + ' · ')
                       + tokens(b.tokens) + ' tok · ' + cents(b.cents)
                       + (b.ret !== null && b.ret !== undefined ? ' · 回傳 ' + comma(b.ret) + ' 字元' : ''))
                   + '</text><line class="gridl" x1="0" x2="' + (W - R) + '" y1="' + (y + RH) + '" y2="' + (y + RH) + '"/>'
                   + (b.kind === 'wf' ? '<rect class="wf-toggle" data-wf="' + esc(b.key) + '" x="0" y="' + y + '" width="' + (W - R)
                       + '" height="' + RH + '"><title>點一下收合或展開</title></rect>' : '');
           });
           return out + '</svg>';
       }
   ```

5. 在 `assets/station/station.js`，step 4 那段之後插入花費表、標頭與分頁：

   ```js
       // Stage by model, each of the four token kinds with its own dollars, from
       // the session's `days` — the same rows the home page's bars add up.
       function costModel(days) {
           var cell = function () {
               return { tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, usd: 0 };
           };
           var add = function (a, r) {
               var t = r.tokens || {}, c = r.cost || {};
               ['input', 'output', 'cacheRead'].forEach(function (k) { a.tokens[k] += t[k] || 0; a.cost[k] += c[k] || 0; });
               a.tokens.cacheWrite += (t.cacheWrite5m || 0) + (t.cacheWrite1h || 0);
               a.cost.cacheWrite += (c.cacheWrite5m || 0) + (c.cacheWrite1h || 0);
               a.usd += r.usd || 0;
           };
           var by = {}, order = [], out = { stages: [], main: cell(), agent: cell(), total: cell() };
           (days || []).forEach(function (r) {
               var sk = r.stage || 'none', mk = r.model || '—';
               if (!by[sk]) { by[sk] = { sub: cell(), models: {} }; order.push(sk); }
               if (!by[sk].models[mk]) by[sk].models[mk] = cell();
               add(by[sk].sub, r);
               add(by[sk].models[mk], r);
               add(r.who === 'main' ? out.main : out.agent, r);
               add(out.total, r);
           });
           var rank = function (k) { var i = ROUTE.indexOf(k); return i < 0 ? ROUTE.length : i; };
           out.stages = order.sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) {
               return { stage: k, sub: by[k].sub, models: Object.keys(by[k].models).sort().map(function (mk) {
                   return { model: mk, cell: by[k].models[mk] };
               }) };
           });
           return out;
       }
       function costHtml(m) {
           var KINDS = [['input', 'input', '--t-in'], ['output', 'output', '--t-out'], ['cacheRead', 'cache read', '--t-cr'],
               ['cacheWrite', 'cache write', '--t-cw']];
           var cells = function (a, cls) {
               return KINDS.map(function (k) {
                   return '<td class="r muted">' + tokens(a.tokens[k[0]]) + '</td><td class="r">' + usd(a.cost[k[0]]) + '</td>';
               }).join('') + '<td class="r' + (cls ? ' ' + cls : '') + '">' + usd(a.usd) + '</td>';
           };
           var share = function (v) { return m.total.usd ? Math.round(v / m.total.usd * 1000) / 10 + '%' : '—'; };
           var allTok = KINDS.reduce(function (n, k) { return n + m.total.tokens[k[0]]; }, 0);
           return '<div class="sumline"><div>合計花費<b>' + usd(m.total.usd) + '</b></div><div>主 session<b>' + usd(m.main.usd) + '</b></div>'
               + '<div>派工（agent + workflow）<b>' + usd(m.agent.usd) + '</b></div><div>output 佔花費<b>' + share(m.total.cost.output) + '</b></div>'
               + '<div>cache read 佔 token<b>' + (allTok ? Math.round(m.total.tokens.cacheRead / allTok * 1000) / 10 + '%' : '—') + '</b></div></div>'
               + '<div class="h2">stage × model <small>token 與各自的 USD；stage 列是小計</small></div>'
               + '<div class="tbl-wrap"><table class="t"><thead><tr><th rowspan="2">stage</th><th rowspan="2">model · 佔 session</th>'
               + KINDS.map(function (k) { return '<th colspan="2"><i class="sw" style="background:var(' + k[2] + ')"></i> ' + k[1] + '</th>'; }).join('')
               + '<th rowspan="2" class="r">USD</th></tr><tr>'
               + KINDS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('') + '</tr></thead><tbody>'
               + m.stages.map(function (g) {
                   return '<tr class="sub"><td><span class="pchip"><i class="sw" style="background:' + colorOf('stage', g.stage) + '"></i>'
                       + esc(g.stage === 'none' ? '第一步之前' : g.stage) + '</span></td><td class="muted">' + share(g.sub.usd) + '</td>'
                       + cells(g.sub, '') + '</tr>' + g.models.map(function (x) {
                           return '<tr class="child"><td></td><td><span class="pchip"><i class="sw" style="background:var(--m-' + family(x.model)
                               + ')"></i>' + esc(String(x.model).replace(/^claude-/, '')) + '</span></td>' + cells(x.cell, '') + '</tr>';
                       }).join('');
               }).join('') + '</tbody><tfoot>'
               + '<tr><td>主 session</td><td></td>' + cells(m.main, 'total') + '</tr>'
               + '<tr><td>agent</td><td></td>' + cells(m.agent, 'total') + '</tr>'
               + '<tr><td>合計</td><td></td>' + cells(m.total, 'total') + '</tr></tfoot></table></div>';
       }
       function sessionHeadHtml(s, x) {
           var t = sessionTotals(s), m = x ? timelineModel(x) : null, agentUsd = costModel(s.days).agent.usd;
           var waited = m ? m.waits.reduce(function (n, w) { return n + w.ms; }, 0) : t.wait;
           var ro = function (l, v, d) {
               return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
           };
           return '<div class="readouts">'
               + ro('歷時', m && m.t1 > m.t0 ? mins(m.t1 - m.t0) : '—', 'active ' + hours(t.active))
               + ro('<i class="hatchsw"></i>等你回答', mins(waited), m ? m.waits.length + ' 次 gate' : '讀取細節…')
               + ro('花費', usd(t.usd), t.usd ? '派工佔 ' + Math.round(agentUsd / t.usd * 100) + '%' : '沒有按日的花費')
               + ro('token', tokens(t.tokens), x ? x.requests + ' 次主 session 請求' : '')
               + ro('派工', x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? x.runs.length + ' 個 workflow' : '')
               + ro('context 峰值', x ? tokens(x.peak) : '—', '')
               + '</div>';
       }
       function tabsHtml(s, tab, x) {
           var label = { timeline: '時間線', cost: '花費', dispatch: '派工', events: '事件' };
           var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null };
           return '<nav class="tabs" aria-label="session 檢視">' + TABS.map(function (k) {
               return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                   + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '') + '</a>';
           }).join('') + '</nav>';
       }
   ```

   並在 `assets/station/station.js` 的 `module.exports = {` 裡、Task 7 加的那兩行之後加上這兩行：

   ```js
               timelineModel: timelineModel, timelineSvg: timelineSvg, costModel: costModel, costHtml: costHtml,
               sessionHeadHtml: sessionHeadHtml, tabsHtml: tabsHtml,
   ```

6. 派工與事件分頁。在 `assets/station/station.js`：
   - `sums(rows)` 的函式本體換成下面第一段；`numCells()` 最後一行 `+ (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>';` 換成第二段；`agentRow()` 裡的 `numCells(r, (r.unpriced || []).join(', '))` 換成 `numCells(sums([r]), (r.unpriced || []).join(', '))`，單列也走 `sums`，才讀得到 `cost`。
   - `dispatchHtml()` 的表頭：`'<col style="width:58px"></colgroup>` 換成 `'<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px"><col style="width:58px"></colgroup>`；`<th class="r">USD</th><th class="r rc"` 換成 `<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th><th class="r rc"`。token 讀每列本來就有的 `split`（`lib/usage.js:470` 建，`lib/detail.js:454` 的 `...rest` 留下），美元讀 `cost`。
   - `replayHtml()` 的 gate 分支：`body = e.qs.map(function (q) {` 換成第三段那一行（gate 事件的 `askedAt` 是提問時刻、`t` 是回答時刻，`lib/replay.js:114`）。

   ```js
           return rows.reduce(function (a, r) {
               a.c += r.c; a.k += r.k; a.s += r.s;
               a.ti += r.split ? r.split.input || 0 : 0;
               a.to += r.split ? r.split.output || 0 : 0;
               a.ci += r.cost ? r.cost.input || 0 : 0;
               a.co += r.cost ? r.cost.output || 0 : 0;
               return a;
           }, { c: 0, k: 0, s: 0, ti: 0, to: 0, ci: 0, co: 0 });
               + (unpriced && !t.c ? 'unpriced' : cents(t.c)) + '</td>'
               + '<td class="r">' + tokens(t.ti || 0) + '</td><td class="r">$' + (t.ci || 0).toFixed(2) + '</td>'
               + '<td class="r">' + tokens(t.to || 0) + '</td><td class="r">$' + (t.co || 0).toFixed(2) + '</td>';
                   body = (isFinite(e.askedAt) ? '等了 ' + dur(Math.round((e.t - e.askedAt) / 1000)) : '') + e.qs.map(function (q) {
   ```

7. Green：跑 step 1 的指令，`ℹ pass N+7`、`ℹ fail 0`；`tests/station-dispatch-view.test.js` 的四個測試仍綠（它的 fixture 沒有 `split`、`cost` 與 `askedAt`，新欄位印 `0` 與 `$0.00`、gate 列不加字）。不過就停下回報，不改期望值。
8. Red，mutation（花費分頁漏掉一列）。在 `assets/station/station.js` 的 `costModel` 裡，用 Edit 把 `(days || []).forEach(function (r) {` 改成 `(days || []).slice(1).forEach(function (r) {`（old_string 帶上下一行 `var sk = r.stage || 'none', mk = r.model || '—';`，只改這一處）。只跑 `node --test tests/station-view.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`：`✖` 裡有 `頁面對帳：the session cost tab's total equals the sum of that session's days[].usd` 與 `costModel lays a session's days out…`。回報 `✖` 行。用 Edit 改回，`grep -c "slice(1).forEach" assets/station/station.js` 印 `0`，再跑一次 `ℹ fail 0`。檔案裡有未 commit 的實作，不用 `git checkout`。
   第二個 mutation（output 欄讀成 input 的 token）：在 `sums()` 裡，用 Edit 把 `a.to += r.split ? r.split.output || 0 : 0;` 改成 `a.to += r.split ? r.split.input || 0 : 0;`。跑同一個指令：`✖` 裡有 `the dispatch tab adds input and output tokens and USD per row, and the events tab says how long each gate waited`。回報 `✖` 行。用 Edit 改回，`grep -c "a.to += r.split ? r.split.output" assets/station/station.js` 印 `1`，再跑一次 `ℹ fail 0`。
9. session 頁。在 `assets/station/station.js`，Task 7 的 `CRUMBS.project = …` 之後插入：

   ```js
       view.closed = {};
       function sessionPage(r) {
           var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
           if (!s) return '<section class="panel"><p class="note">這頁上沒有 session ' + esc(r.id) + '</p></section>';
           needDetail(s);
           var x = DETAIL[s.id] || null;
           // The cost tab reads `days` off the data file, so it answers before the
           // detail script has loaded; the other three need the detail.
           var body = r.tab === 'cost' ? costHtml(costModel(s.days))
               : !x ? detailNote(s)
                   : r.tab === 'dispatch' ? '<div class="det">' + dispatchHtml(x) + '</div>'
                       : r.tab === 'events' ? '<div class="det">' + replayHtml(x) + '</div>'
                           : '<div class="lane-legend"><span><i class="hatchsw"></i>等你回答（gate）</span>'
                           + '<span><i class="sw ln" style="background:var(--ctx)"></i>主 session context</span>'
                           + MODEL_KEYS.map(function (k) {
                               return '<span><i class="sw" style="background:var(--m-' + k + ')"></i>' + k + '</span>';
                           }).join('')
                           + '<span><i class="sw" style="background:var(--s-agent)"></i>背景 agent</span>'
                           + '<span><i class="sw" style="background:var(--s-workflow)"></i>workflow</span></div>'
                           + '<div class="chart tl">' + timelineSvg(timelineModel(x), view.closed) + '</div>'
                           + '<div class="note">橫軸是真實時間：stage 的寬度等於實際經過的時間；點 workflow 那列收合或展開。</div>'
                           + '<div class="det">' + ctxSection(s, x) + tasksHtml(x.tasks) + '</div>';
           return '<section class="panel"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
               + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
               + '<h1 class="s-title">' + esc(s.task || '（未命名）') + '</h1>'
               + '<div class="s-meta">' + routeDots(s) + '<span class="mono">' + esc((s.route || []).join(' → ')) + '</span>' + statePill(s)
               + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>主 session <span class="mono">'
                   + esc(s.model) + '</span></span>' : '') + '</div>'
               + sessionHeadHtml(s, x) + '</section>'
               + tabsHtml(s, r.tab, x) + '<section class="panel">' + body + '</section>';
       }
       VIEWS.session = sessionPage;
       CRUMBS.session = function (r) {
           var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
           return s ? [[NAMES[s.pkey] || s.pkey, projectHash(s.pkey)], [s.task || String(s.id).slice(0, 8), null]] : [[r.id, null]];
       };
   ```

   同一個檔裡還有三處：
   - `needDetail()` 裡 `if (route.view === 'cmp') draw();` 換成 `if (route.view === 'cmp' || (route.view === 'session' && route.id === s.id)) draw();`。
   - 點擊代理的事件篩選，`'#det .rp > li[data-kind="'` 換成 `'.rp > li[data-kind="'`：事件分頁不在 `#det` 裡，同一時間畫面上只有一份 replay。
   - 點擊代理裡，Task 6 加的 `var go = e.target.closest('[data-href]');` 之前插入下面兩行（`assets/station/station.js`）：

   ```js
           var wfRow = e.target.closest('[data-wf]');
           if (wfRow) { view.closed[wfRow.getAttribute('data-wf')] = !view.closed[wfRow.getAttribute('data-wf')]; draw(); return; }
   ```

10. 煙霧：

   ```
   node --check assets/station/station.js && MSYS_NO_PATHCONV=1 node .fankeel/build/2026-09-14-station-three-levels/smoke-page.js '#/' '#/list' '#/p/F%3A%5Cws%5Calpha' '#/s/aaaa1111-0000' '#/s/aaaa1111-0000/cost' '#/s/aaaa1111-0000/dispatch' '#/s/aaaa1111-0000/events' '#/s/missing'
   ```

   四個 `#/s/aaaa1111-0000…` 那幾行的麵包屑是 `首頁 / alpha / smoke`，`#/s/missing` 那行是 `首頁 / missing`，最後一行 `smoke done`。
11. 跑 step 1 的指令加上其餘引用 station.js 的測試：`node --test tests/station-view.test.js tests/station-dispatch-view.test.js tests/station-panel.test.js tests/station-compare.test.js tests/station-routes.test.js tests/station-todo.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`，`ℹ fail 0`。
12. 不 commit。回報 steps 3、8 的 `✖` 行、step 10 的輸出與 step 11 的計數。parent 跑全套，commit `assets/station/station.js tests/station-view.test.js`，訊息 `feat: station session page — timeline, cost, dispatch, events`。

## Task 9: 文件寫成三層，刪掉 TODO 條目

**Files:**
- Modify: `docs/station.md` — `### One session, opened` 之前加 `### The session page` 一節；`### The stage strip` 裡總覽那句；`Opening a row` 那句；`### Filtering, and the two views` 之前加一段；`station-data.js` 那句；`**總覽**` 那句；`serve` 那句
- Modify: `docs/improvement-brief.md` — 第 1044 行的 (c) 列
- Modify: `TODO.md` — 第 72 行〔station〕總覽改版那條
- Read: `assets/station/station.js` — Task 6–8 留下的分頁名與路由；`drawDetail()` 的側邊面板沒被 Task 8 改動，它的 stage strip 與 claims 照舊
- Read: `lib/detail.js` — Task 2–3 留下的 `days`、`spans`、`seq`
- Read: `scripts/station.js` — 第 13 行 `--idle` 的預設

**Interfaces:**
- Consumes: `days`、`spans`、`waits`、`seq`（Task 2）、`pkey`（Task 4），路由 `#/`、`#/d/<day>`、`#/p/<pkey>`（Task 6、7）、`#/s/<id>/<tab>`（Task 8）
- Produces: none

**Dispatch:** implementer, sonnet — 替換文字全在計畫裡，工作是轉錄、跑兩個檢查、照 docs-check 印出的行號改引用。

1. 基線：

   ```
   node scripts/docs-check.js
   node scripts/todo-check.js
   ```

   Task 1–8 改過程式，`docs-check` 可能已經報出行號移動的引用；記下它印的每一條，第 10 步處理。

2. 清單頁的側邊面板（`drawDetail()`）與它的 stage strip 都還在，`### The stage strip` 與 `### One session, opened` 兩節只改變成錯的句子。在 `docs/station.md`，把（原文跨行，照原樣找）：

   ```
   a stage's own cost surfaces only in the aggregate
   per-route stage ledger on **總覽**, not per row.
   ```

   換成：

   ```
   a stage's own cost surfaces in the per-route stage
   ledger on each project page, and per stage and model on the session page's
   花費 tab — not on this table's rows.
   ```

3. 在 `docs/station.md`，把 `Opening a row fills the panel with` 換成 `Opening a row in 清單 fills the side panel with`。

4. 在 `docs/station.md` 的 `### One session, opened` 那行之前，加入這一節與一個空行：

   In `docs/station.md`, before `### One session, opened`:

   ```md
   ### The session page

   A session also opens on a page of its own, `#/s/<id>`, in four tabs — 時間線,
   花費, 派工 and 事件 — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
   `cost`, `dispatch` or `events`. 時間線 is the default, with the context chart,
   任務 and the list of the largest rises under it; 派工 gives every row its input
   and output tokens, read from `split`, and its dollars, read from `cost`; 事件 is
   the replay, each gate's row carrying how long it waited. The side panel in the
   next section is the other way in, from 清單, and keeps its claims.

   時間線 draws the session against real elapsed time: one axis from the first
   step of `seq` to the last request, so a ten-minute session and a ten-hour one
   no longer fill the same width. The stage lane gives each step a segment as wide
   as the time it ran, and every gate in `waits` is a hatched gap across all the
   lanes, labelled with how long the question waited for its answer. Each agent
   and workflow is a bar from its first request to its last — `from` and `to` on
   its dispatch row — carrying its model, tokens and dollars, and a workflow opens
   into its agents. A lane of ticks marks every main-session request in its
   model's colour, and the context line above shares the axis, marked where an
   agent's return entered the main context.

   花費 is where a stage's dollars live: a stage × model table summed from the
   session's `days`, with input, output, cache-read and cache-write tokens and
   dollars in their own columns and a subtotal each for the main session and its
   agents. Its total is the sum of `days[].usd` — the figure the home and project
   pages sum too — and a live session has one, because `days` comes from the
   transcript read in `extract()` rather than from `spend`, which `hooks/leave.js`
   still writes only at session end. A model the price table does not know gives
   its rows `cost: null` and `usd: null`: no figure, rather than a zero.
   ```

5. 在 `docs/station.md` 的 `### Filtering, and the two views` 那行之前，加一個空行與這段：

   In `docs/station.md`, before `### Filtering, and the two views`:

   ```md
   `days` and `spans` are a second derivation, and they do not replace `spend`.
   `extract()` computes them in the same transcript read that fills the detail
   panel, so a live session has them. A request's stage there is the last step of
   `seq` at or before its timestamp — `task.js stage` commands first, `moves` or
   `clock` only when the transcript holds none — and a request older than the
   first step has stage `null` rather than falling into a first window that
   starts at `-Infinity`. Each row is one local calendar day, one stage, one model
   and one of `main`, `agent` or `workflow`, so a session that crosses midnight is
   spent on both days, and the rows' dollars sum to the detail's `usd`. `spans`
   holds the time the same way — `main`, `wait`, `agent` and `workflow` — every
   interval kept between the session's first and last request.
   ```

6. 在 `docs/station.md`，把這三行（原文跨行，照原樣找）：

   ```
   `station-data.js` carries only whether there is one,
   the session's peak context and its count of backward steps, so the file every
   prompt rewrites stays small.
   ```

   換成：

   ```
   `station-data.js` carries whether there is one,
   the session's peak context, its count of backward steps, and its `days`,
   `spans` and `pkey` — what the home and project pages sum, so neither page
   loads a detail file.
   ```

7. 在 `docs/station.md`，把：

   ```
   **總覽** carries four cards with a seven-day-against-previous-seven delta, the
   stacked context flow by registry, a weekday bar, the waiting gauge and the
   per-route stage ledger.
   ```

   換成（後面的 `A delta whose previous window holds nothing prints` 接在同一行不動）：

   ```
   **首頁**, `#/`, is a 30-day histogram — one bar per local day, today at the
   right — whose height switches between tokens, dollars and time and whose
   segments switch between model, project, stage and main session against
   agent; time has no model, so that pairing is disabled and says why. Four
   cards above it compare the last 30 days with the 30 before them, and clicking
   a bar opens that day, `#/d/<day>`, with its breakdown and the sessions that
   spent on it. A project, `#/p/<pkey>` with the key URI-encoded, plots its
   sessions as points over the same 30 days, can lay a second project's line on
   the same axes, lists its sessions, and carries the per-route stage ledger.
   ```

8. 在 `docs/station.md`，把 `` `serve` runs a loopback server only while clearing; it renders afresh on `` 換成：

   ```
   `serve` runs a loopback server that stays up until it is stopped —
   `--idle <minutes>` brings back an idle exit — and renders afresh on
   ```

   依據是 `scripts/station.js:13-14`：`--idle` defaults to never exiting。

9. 在 `docs/improvement-brief.md` 第 1044 行，把：

   ```
   | (c) 每個 stage 花多少錢 | 刻意拿掉：`docs/station.md:129`（`a stage's own cost surfaces only in the aggregate`）說它只出現在總覽的總帳 |
   ```

   換成（拿掉 `:129` 與引號，因為第 2 步改了那句，留著會讓 `docs-check` 報引用失效）：

   ```
   | (c) 每個 stage 花多少錢 | 刻意拿掉：`docs/station.md` 當時說 a stage's own cost surfaces only in the aggregate，只出現在總覽的總帳（2026-09-14 已關閉：session 頁的花費分頁從 `days` 列出 stage × model 的金額；現況見 `docs/station.md`「The session page」） |
   ```

   再在 `TODO.md` 刪掉這一行，連同它下方多出來的空行，讓標題之間只剩一個空行：

   ```
   - 〔station〕總覽改版：兩個專案並排、單一專案、某一天的花費、趨勢折線。另起一次設計，附自己的 mockup — [docs/station.md](docs/station.md).
   ```

10. 跑檢查，直到都通過：

    ```
    node scripts/docs-check.js
    node scripts/todo-check.js
    node --test tests/station-doc.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'
    ```

    `docs-check` 報的每一條行號移動，打開被引用的檔案，找到引號裡的原文，把行號改成它現在所在的行；報「symbol nothing declares」的，確認該名字已被 Task 1–8 改名或刪除，改成現在的名字。前兩個 exit 0，`tests/station-doc.test.js` 顯示 `ℹ fail 0`。

11. commit（parent 執行）：

    ```
    git commit -o -m "docs: the station described as three levels" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_013Pe2ZNnW33fux6rnGgHAcy" -- docs/station.md docs/improvement-brief.md TODO.md
    ```

## Coverage

| promise | task |
|---|---|
| `extract()` 多出 `days`：每列是一組 `day`、`stage`、`model`、`who`，`who` 是 `main`、`agent` 或 `workflow`，帶五種 token（`input`、`output`、`cacheRead`、`cacheWrite5m`、`cacheWrite1h`）與這五種各自的 USD。 | Task 2 |
| 每一筆 request 依自己的 `timestamp` 歸到產頁那台機器的本地日期；跨午夜的 session 分到兩天。 | Task 1, Task 2 |
| 一筆 request 的 `stage` 是 `seq` 裡時間不晚於它的最後一步（`stageSequence()`，`lib/detail.js:157`）；`seq` 先取 transcript 裡的 `task.js stage` 指令，沒有才用 `moves` 或 `clock`，所以沒有 `clock` 的 session 也分得出 stage。早於第一步的 request 記為 `null`。 | Task 2 |
| 一個 session 所有 `days` 列的 USD 加總，等於同一次 `extract()` 算出的 `usd`（`lib/detail.js:481`）。 | Task 2 |
| `extract()` 多出 `spans`：每列是 `day`、`stage`、`who` 與毫秒數，`who` 是 `main`、`wait`、`agent` 或 `workflow`；`main` 是 `seq` 相鄰兩步之間的時間減掉等待後按日切，最後一步算到最後一筆 request；`wait` 是 `waits` 按日切；`agent` 與 `workflow` 是 launch 到 return 按日切。 | Task 1, Task 2 |
| `extract()` 多出 `waits`：每一次 gate 的提問時間、回答時間與當時的 stage，不受 `events` 列數上限影響。 | Task 2 |
| `VERSION` 升到 2。版本不符的快取，transcript 還在就重讀；transcript 已不在就照舊回傳，頁面把沒有 `days` 的舊快取整筆 `usd` 算在它的 `day`、stage 為 `null`。 | Task 3, Task 4 |
| `serialize()` 把每個 session 的 `days`、`spans` 帶進 `station-data.js`，首頁與專案頁不載入 detail 檔。 | Task 4 |
| 專案的 key 是 registry 根加上 session 的 `project`；沒有 `project` 的 session 歸在它的 registry 根。 | Task 4 |
| 三層的花費一律從 `days` 加總，不用 SessionEnd 寫進 registry 的 `usage`，所以進行中的 session 也算得到。 | Task 4, Task 6, Task 7, Task 8 |
| 最近 30 個本地日各一根長條，今天在最右，只讀 `days` 與 `spans`。 | Task 6 |
| 高度可切換 token、花費、時間；分段可切換依 model、依專案、依 stage、主 session 對 agent。時間沒有 model 可分，時間配依 model 這一組停用並寫出原因。 | Task 6 |
| 時間是 `spans` 裡 `main`、`agent`、`workflow` 的毫秒和：agent 與主 session 同時在跑時各算各的，量的是工作量而不是牆鐘；`wait` 不算進時間，等待佔比是 `wait` 除以 `main` 加 `wait`。 | Task 6 |
| 每根長條的總數等於它各分段的和。 | Task 6 |
| KPI 四格：30 天花費、token、active 時間、等待佔比，各自對前 30 天的差；前期沒資料時沿用 `delta()` 的「前期無資料」。 | Task 6 |
| 點一根長條打開某日花費：當天總數、依專案、model、stage、主 session 對 agent 的拆分，以及當天有花費的 session 與各自當天花了多少；總數與那根長條相同。 | Task 6 |
| 專案清單列出每個專案的 30 天花費、session 數、最後活動，點進專案頁；近期 sessions 表留在首頁，點進 session 頁。 | Task 6 |
| 直方圖取代 `flow()` 與 `weekBars()`；`gauge()` 併入等待佔比那格；`routeLedger()` 移到專案頁。 | Task 6, Task 7 |
| 標頭是名稱、路徑、30 天花費、token、active 時間。 | Task 7 |
| 主圖的 x 是 30 天的時間，每個 session 在它的開始時間一個點，y 可切換 token 或花費，依時間連線，點進 session 頁。 | Task 7 |
| 「對照專案」選另一個專案，在同一組軸上多畫一條線、共用 y 軸；TODO 的「兩個專案並排」就是這個。 | Task 7 |
| sessions 表列出 task、開始、時長、stage 進度、花費、token、model 組成；勾兩列進現有的 `cmpPage()`。 | Task 7 |
| 頁尾是只算這個專案的 `routeLedger()`。 | Task 7 |
| 四個分頁：時間線（預設）、花費、派工、事件；現有的 context 圖、tasks 與上升清單收在時間線分頁下方。 | Task 8 |
| 時間線是真的時間軸，從 `seq` 的第一步開始到最後一筆 request；stage 段的寬度等於實際經過的時間，`waits` 的每一次等待畫成斜線空窗並標出時長。 | Task 8 |
| 每個 agent 與 workflow 各一條 bar，從 launch 到 return，標出做了什麼、model、token、花費；workflow 可展開成它的 agents。 | Task 8 |
| 主 session 的每筆 request 在時間軸上一個刻度，依 model 上色；context 折線疊在同一條軸上，agent 回傳進主 context 的位置標出字元數。 | Task 8 |
| 花費分頁是 stage × model 的表，`input`、`output`、`cacheRead`、`cacheWrite` 各自的 token 與 USD，主 session 與 agent 各一個小計；總數等於這個 session 所有 `days` 列的 USD 和。 | Task 8 |
| 派工分頁在現有 `dispatchHtml()` 的每列多出 input 與 output 的 token 與 USD。 | Task 8 |
| 事件分頁是現有的 `replayHtml()`，gate 那列多出等待時長。 | Task 8 |
| `assets/station/index.html` 與 `station.css` 依核准的 mockup 重做；`side`、`q`、`gen`、`nreg`、`cfg`、`page` 六個 id 留作掛載點（`tests/station-shell.test.js:51`）。 | Task 5 |
| 三層用 `location.hash` 路由：`#/`、`#/p/<key>`、`#/s/<id>`、`#/d/<day>`；從 `file://` 開也能上一頁。 | Task 6 |
| 頁面照舊不載入任何外部資源（`docs/decisions/2026-09-04-session-station-design.md:120`）。 | Task 5 |
| `docs/station.md` 描述總覽的那段改寫成三層，serve「只在清除時」那句改成與 `scripts/station.js:13` 一致。 | Task 9 |
| `TODO.md` 的〔station〕總覽改版那條刪掉。 | Task 9 |
| 跨午夜分日 — fixture：一個 session 跨午夜，主 session 加一個 agent、兩個 model；`days` 分到兩天，USD 加總等於 `usd`。現在沒有 `days`，紅 | Task 2 |
| stage 歸屬 — fixture 沒有 `clock`、transcript 有兩次 `task.js stage`；兩段的 request 各歸各的 stage，第一步之前的記 `null`；把歸屬改成永遠取第一步，紅 | Task 2 |
| 等待空窗 — fixture 兩次 gate；`waits` 兩列，長度等於回答減提問 | Task 2 |
| 舊快取不丟 — v1 快取、transcript 刪掉，`detailOf` 仍回傳它；拿掉保留那一行，紅 | Task 3 |
| 專案 key — 同一 registry 兩個 `project` 的 session 分成兩個專案 | Task 4 |
| 頁面對帳 — 從產出的 `station-data.js` 與頁面的純函式：某天長條總數 = 某日花費總數 = 當天各 session 花費和；session 花費分頁總數 = 該 session `days` 的 USD 和 | Task 6, Task 8 |
| 全套 — `node --test` 顯示 `ℹ fail 0` | every task; Task 9 runs it last |
| 文件 — `node scripts/docs-check.js` 與 `node scripts/todo-check.js` exit 0 | Task 9 |
