---
status: design-intent
---

# TODO 全表盤點（10-05）：壓縮重試上限、write 失敗的 station 行、兩處 timeout 與行號小錯 Implementation Plan

**Goal:** 做完 10-05 盤點放行的三條（compact-1、inject-5、docs-2），並照使用者的裁定把 model-3 從 Ready 改放 Watch。
**Architecture:** Task 1 給 `hooks/compact.ts` 的重試迴圈補一個會紅的測試；Task 2 讓 `/fankeel` 的頁面寫入失敗時，`station:` 行說出失敗與原因，而不是整行消失（判斷在 `lib/render.js` 的 `stationLine`，`hooks/inject.js` 只把錯誤帶過去），並在 `docs/90-agent/reference/station.md` 的表格補一列；Task 3 改正 `station.md` 那句「五秒給每個 hook」；Task 4 改正冷啟動報告第 15 行的行號引用；Task 5 把 model-3 改成 watch，並在 `docs/README.md` 補本計畫的索引列。Task 2 與 Task 3 都改 `station.md`，所以依序做；其餘互不相交。compact-1、inject-5、docs-2 記在本 task 的 registry `todo` 欄，由 land 關，本計畫不關。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies；`hooks/compact.ts` 由 Node 24 去型別後直接 import），`node --test`，git 2.44.0.windows.1，fankeel 0.99.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261005T143639/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；584 份 markdown、13 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。
- 每個 hook 在每條路徑上都 exit `0`，包含自己的錯誤（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。`Modify:` 的行號是本計畫寫成時（commit bcfbc3a3 之後）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- init 區塊在參考長度的 plugin 根目錄下要小於 1400 字元（`tests/render.test.js` 的 `sizeAtReference(out) < 1400`），注入上限 2400 不動。
- 縮排跟著檔案走：`lib/render.js`、`hooks/inject.js`、`tests/compact.test.js` 四格；`hooks/compact.ts`、`tests/inject.test.js`、`tests/render.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md:22`）；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目受 `node scripts/docs-check.js` 的 gone、symbol、quote 檢查：新寫的內文不寫 `path:line`，不把不存在的名字放進反引號。`watch` 條目要有 `group`（最多 28 欄）、`timing: if: <事件>` 與 `stamp`（`docs/90-agent/reference/todo.md:33-35`）。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。`docs/90-agent/reports` 是 report 角色（`.fankeel/docs.json:16-17`）：寫完就不改，docs-check 也不檢查它的引用。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- land 會照 registry 的 `todo` 欄印出六行 `todo.js done`，其中 compact-2、model-3、station-13 不該關（compact-2 與 station-13 由使用者自己做，model-3 改放 Watch）— land — land 只執行 compact-1、inject-5、docs-2 三行；若 Task 4 被拿掉，docs-2 照樣在 Task 3 落地後關，`--disposition done` 之外在 gate 說明報告那句沒改。
- 冷啟動報告是 report 角色，寫完不改；使用者 10-05 在 inject-plain-brain 計畫裡定過「報告與決策頁裡的舊行號是當時的紀錄，不改」— Task 4 — 這一條是 survey 選項一帶進來的，plan gate 另給一個不改報告的選項；實作者只改那一個引用，不動任何數字或結論。
- 把迴圈上限拿掉時，一直 reject 的假 compact 會讓測試無限跑下去，掛住不等於紅 — Task 1 — 假 compact 在第 11 次呼叫起改為成功，上限拿掉時測到 11 次而紅，不會掛住。
- 在 `<configDir>/fankeel` 放一個檔案讓 `station.write` 丟錯，hook 裡別處若也讀那個路徑而沒接住錯誤，整個區塊就會消失，測試紅的原因就不對 — Task 2 — 實作者先在改程式前跑新測試，確認紅的原因是「區塊在、只是沒有 `station:` 行」（失敗訊息裡的 actual 含 `fankeel: this session is`）；不是就停手回報。
- `docs/90-agent/reference/station.md` 在表格加一列會讓其後的行號下移一行；`docs/03-decisions/2026-09-18-todo-six.md:77` 引 `station.md:287`，那是決策頁、本來就已不準 — Task 2 — 改完跑 `node scripts/docs-check.js`，exit 0 才算完成；docs-check 若點名別頁的 `station.md` 行號，實作者停手回報，那一頁不在本 task 的 Files 裡。

## Task 1: 壓縮重試最多三次，補一個會紅的測試（compact-1）

**Files:**
- Modify: `hooks/compact.ts:68-69` — `compactWithRetry` 上方註解原地補一句由哪個測試釘住
- Test: `tests/compact.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/compact.test.js` 裡，`test('a rejected compaction is retried', ...)` 這個測試結束的 `});` 之後空一行，加入：

```js
// compact-1: the retry loop stops after three tries. A compaction that keeps
// rejecting until its eleventh call shows a lifted cap as eleven calls rather
// than as a hang.
test('a compaction rejected every time is tried three times, each one logged', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    const logs = [];
    let slept = 0;
    $.ui.log = (text) => { logs.push(text); };
    $.clock.sleep = async () => { slept++; };
    $.session.compact = async (input) => {
        calls.push(input);
        if (calls.length <= 10) throw new Error('a turn is running');
        return {};
    };
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 3);
    assert.equal(slept, 3);
    assert.deepEqual(logs.filter((l) => / rejected: /.test(l)).map((l) => l.match(/attempt (\d+)/)[1]), ['1', '2', '3']);
});
```

2. 跑 `node --test tests/compact.test.js`，十項全過（新測試在現況就該過）。

3. 對照：在 `hooks/compact.ts` 把 `for (let attempt = 1; attempt <= 3; attempt++) {` 暫時改成 `for (let attempt = 1; attempt <= 30; attempt++) {`，再跑 `node --test tests/compact.test.js`，新測試要紅、失敗訊息是 `11 !== 3`（其他九項仍過）。改回 `attempt <= 3`，`git diff hooks/compact.ts` 為空，再跑一次，十項全過。兩次的輸出原樣貼進回報。

4. 在 `hooks/compact.ts` 把整行

```text
// still count as running until this hook returns. Three tries, a second apart.
```

   原地換成（一行換一行）：

```text
// still count as running until this hook returns. Three tries, a second apart; tests/compact.test.js pins the three.
```

5. 跑 `node --test tests/compact.test.js`，十項全過。

6. 不 commit。回報兩個路徑：`hooks/compact.ts`、`tests/compact.test.js`；訊息：

```text
test: pin the compact retry loop at three tries

- a compaction that rejects until its eleventh call is tried three times, slept between, each try logged — tests/compact.test.js
- lifting the cap to 30 turns the test red as 11 calls, not a hang — checked and restored
- the comment above compactWithRetry names the test that pins it — hooks/compact.ts
```

## Task 2: 頁面寫入失敗時，station 行說出來（inject-5）

**Files:**
- Modify: `hooks/inject.js:148-161` — `writePage` 失敗時回 `{ error }` 而不是 `null`；上方註解原地改一句
- Modify: `lib/render.js:307-336` — `stationLine` 認得 `{ error }`；`renderInit` 收它
- Modify: `docs/90-agent/reference/station.md:44-53` — 表格補一列，「four ways」改「five ways」
- Test: `tests/inject.test.js`
- Test: `tests/render.test.js`
- Read: `lib/station.js` — `write()` 用 `fs.mkdirSync(path.dirname(stationPath(configDir)), { recursive: true })` 開 `<configDir>/fankeel`，那裡是檔案時丟錯
- Read: `tests/reference-size.js` — `REFERENCE_ROOT`、`sizeAtReference`

**Interfaces:**
- Consumes: none
- Produces: `renderInit({ sessionId, station, serve, input })` 的 `station` 多一種形狀 `{ error: string }`；`stationLine` 對它回 `station: the page was not written (<error>).`，或在 `serve` 是 `running`／`started` 且有 `url` 時回 `station: the page was not written (<error>); <url> still shows the last one written.`

**Dispatch:** implementer, sonnet

1. 在 `tests/inject.test.js` 檔尾（最後一個測試 `FANKEEL_SERVE=off leaves the file on the station line and asks nothing` 的 `});` 之後）空一行，加入：

```js
// inject-5: a page write that throws used to drop the station line, so the
// block said nothing while a station could still open the browser. A file
// where the station's directory belongs makes `station.write` throw.
test('a /fankeel prompt whose page write fails says so on the station line', () => {
  const dir = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  fs.writeFileSync(path.join(cfg, 'fankeel'), 'not a directory');
  const text = context(run({ session_id: MINE, cwd: dir, prompt: '/fankeel' }, cfg));
  assert.match(text, new RegExp(MINE), 'the block itself still goes out');
  assert.match(text, /^station: the page was not written \(.+\)\.$/m);
});
```

2. 在 `tests/render.test.js` 裡，`test('the station line names the served url, a station still starting, or the file', ...)` 結束的 `});` 之後空一行，加入：

```js
// inject-5: a page that was not written is named on the line, with its error,
// and with the url when a station is serving the last page it had.
test('the station line names a page that was not written, and the url still serving', (t) => {
  const failed = { error: "EEXIST: file already exists, mkdir 'C:/Users/you/.claude/fankeel'" };
  assert.match(renderInit({ sessionId: MINE, station: failed }),
    /^station: the page was not written \(EEXIST: file already exists, mkdir 'C:\/Users\/you\/\.claude\/fankeel'\)\.$/m);
  for (const state of ['running', 'started']) {
    assert.match(renderInit({ sessionId: MINE, station: failed, serve: { state, url: 'http://127.0.0.1:7817/' } }),
      /^station: the page was not written \(.+\); http:\/\/127\.0\.0\.1:7817\/ still shows the last one written\.$/m);
  }
  assert.match(renderInit({ sessionId: MINE, station: failed, serve: { state: 'starting', url: null } }),
    /^station: the page was not written \(.+\)\.$/m);
  const longest = renderInit({ sessionId: MINE, station: { error: 'x'.repeat(120) }, serve: { state: 'running', url: 'http://127.0.0.1:7817/' } });
  const size = sizeAtReference(longest);
  t.diagnostic('init+unwritten'.padEnd(15) + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
  assert.ok(size < 1400, 'init block with an unwritten-page line is ' + size + ' chars');
});
```

3. 跑 `node --test tests/inject.test.js tests/render.test.js`，兩個新測試都要紅。inject 那個必須紅在第二個斷言（`station:` 那行），不是第一個（區塊本身）；紅在第一個就停手回報，不往下做。

4. 在 `lib/render.js` 把 `stationLine` 上方註解的最後兩行

```text
// file until then; anything else — `FANKEEL_SERVE=off`, or a start that threw —
// is the file and the command that serves it.
```

   換成：

```text
// file until then; anything else — `FANKEEL_SERVE=off`, or a start that threw —
// is the file and the command that serves it. A page the hook could not write
// (`{ error }`) says so instead of the counts, and names a serving station's
// url, which still shows the last page it had.
```

5. 在 `lib/render.js` 把整個 `stationLine` 函式換成：

```js
function stationLine(station, serve) {
    const s = serve && typeof serve === 'object' ? serve : {};
    if (typeof station.error === 'string') {
        const shown = typeof s.url === 'string' && (s.state === 'running' || s.state === 'started') ? s.url : null;
        return 'station: the page was not written (' + station.error + ')' + (shown ? '; ' + shown + ' still shows the last one written.' : '.');
    }
    const head = 'station: ' + station.stale + ' stale, ' + station.live + ' live — ';
    if (typeof s.url === 'string' && s.state === 'running') return head + s.url + ' (serve was running).';
    if (typeof s.url === 'string' && s.state === 'started') return head + s.url + ' (serve started, browser opened).';
    if (s.state === 'starting') return head + 'serve is starting; until then ' + station.file + '.';
    return head + station.file + '. Edit the profile with station.js serve --open.';
}
```

6. 在 `lib/render.js` 的 `renderInit` 裡，把

```text
    if (station && typeof station.file === 'string') lines.push(stationLine(station, serve));
```

   在 `lib/render.js` 換成：

```js
    if (station && (typeof station.file === 'string' || typeof station.error === 'string')) lines.push(stationLine(station, serve));
```

7. 在 `hooks/inject.js` 的 `writePage` 裡，把 `catch (e) {` 下面那行 `return null;`（只換這一行，第 159 行；第 155 行的 `return null;` 不動）原地換成：

```js
            return { error: String((e && e.message) || e).split('\n')[0].slice(0, 120) };
```

   再把它上方註解的最後一句整行

```text
// hook's five seconds (inject-3). A failure here costs one line of the
// block rather than the block.
```

   原地換成（兩行換兩行，`hooks/inject.js` 總行數不變）：

```text
// hook's five seconds (inject-3). A failure here is named on the station
// line, with its error, rather than dropping the line (inject-5).
```

   `finish(page, page ? boundSince(serveLib, dir, serve) : null)` 不改：失敗時 `page` 是 `{ error }`，照樣帶出 serve 的 url。

8. 在 `docs/90-agent/reference/station.md` 把 `back a page a newer checkout no longer matches. The line ends one of four` 這行的 `four` 改成 `five`（只改這個字）；在表格最後一列（`` | `<file>. Edit the profile with station.js serve --open.` | ``開頭那列）之後、表格下的空行之前，加一列：

```md
| `(<error>).` or `(<error>); <url> still shows the last one written.` | the page write threw — a full disk, or a file sitting where `<configDir>/fankeel` belongs. The line then opens `station: the page was not written` instead of the counts, carries the error's first line (at most 120 characters), and names the url only when a station was running or started |
```

9. 跑 `node --test tests/inject.test.js tests/render.test.js`，全過；`node scripts/docs-check.js`，exit 0；docs-check 若點名別頁的 `station.md` 行號，不改那一頁，停手回報它點名的行，由 build agent 決定。

10. 不 commit。回報五個路徑：`hooks/inject.js`、`lib/render.js`、`docs/90-agent/reference/station.md`、`tests/inject.test.js`、`tests/render.test.js`；訊息：

```text
fix: name a page the /fankeel hook could not write on the station line

- writePage returns { error } instead of null, so the failure reaches the block — hooks/inject.js
- stationLine says the page was not written, with the error, and the serving url when there is one — lib/render.js
- a fifth row in the table of how the line ends — docs/90-agent/reference/station.md
- a file where the station's directory belongs makes the hook say so; every form stays under the init cap — tests/inject.test.js, tests/render.test.js
```

## Task 3: station.md 那句「五秒給每個 hook」改正（docs-2 的第一處）

**Files:**
- Modify: `docs/90-agent/reference/station.md:54-57` — 一句原地改寫，兩行換兩行
- Read: `.claude-plugin/plugin.json` — 第 31 行是 inject hook 的 `"timeout": 5`，第 112 行是 `gate.js` 的 `"timeout": 605`

**Interfaces:**
- Consumes: Task 2 改過的 `docs/90-agent/reference/station.md`（同一檔，依序做）
- Produces: none

**Dispatch:** implementer, sonnet

1. 先確認引用的兩行：`sed -n '30,31p;111,112p' .claude-plugin/plugin.json`，第 31 行是 `"timeout": 5,`、上一行是 `hooks/inject.js` 的 command；第 112 行是 `"timeout": 605,`、上一行是 `hooks/gate.js`。不是就停手回報。

2. 在 `docs/90-agent/reference/station.md` 把這兩行

```text
short of the five `.claude-plugin/plugin.json` gives every hook but
`SessionEnd`'s. That is a budget, not a bound: after the change writes measured
```

   原地換成（兩行換兩行）：

```text
short of the five `.claude-plugin/plugin.json:31` gives this hook (`gate.js`
has 605). That is a budget, not a bound: after the change writes measured
```

3. 跑 `node scripts/docs-check.js`，exit 0；`node --test tests/station-doc.test.js`，全過。

4. 不 commit。回報一個路徑：`docs/90-agent/reference/station.md`；訊息：

```text
docs: the five-second timeout is the inject hook's, not every hook's

- gate.js has 605 seconds; the sentence now cites the inject hook's own line — docs/90-agent/reference/station.md
```

## Task 4: 冷啟動報告第 15 行的行號引用（docs-2 的第二處）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-05-inject-cold-start.md:15` — 一個引用補上第二個行號
- Read: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/summary.txt` — 第 46 行 `max 4101.0`、第 89 行 `max 4107.3`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 先確認：`sed -n '46p;89p' docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/summary.txt`，第 46 行含 `call lib/station.js write` 與 `max 4101.0`，第 89 行含 `call lib/station.js write` 與 `max 4107.3`。不是就停手回報。

2. 在 `docs/90-agent/reports/2026-10-05-inject-cold-start.md` 把

```text
（`after/summary.txt:46`）
```

   換成：

```text
（`after/summary.txt:46` 與 `:89`）
```

   這一頁別的字一個都不改：它是 report 角色，只改這個引用，數字與結論照舊。

3. 跑 `node scripts/docs-check.js`，exit 0。

4. 不 commit。回報一個路徑：`docs/90-agent/reports/2026-10-05-inject-cold-start.md`；訊息：

```text
docs: cite where the 4107ms write max actually sits

- 4101ms is the cold arm's line 46 and 4107ms the warm arm's line 89; the citation named only the first — docs/90-agent/reports/2026-10-05-inject-cold-start.md
```

## Task 5: model-3 改放 Watch，並為本計畫補索引列

**Files:**
- Modify: `docs/90-agent/todo/model-3.md` — `state` 改 `watch`，補 `group`、`timing`、`stamp` 與使用者的裁定
- Modify: `docs/README.md` — 在 10-03 盤點計畫那列之後補本計畫一列

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `docs/90-agent/todo/model-3.md` 的 frontmatter 裡，把整行 `state: ready` 換成 `state: watch`，並在 `link: lib/stages.js` 那行之後加三行：

```md
group: brain 換模型的訊號
timing: if: 一次受控 task 的 brain 來回次數或 reviewer 抓到的缺陷明顯偏高
stamp: 2026-10-05
```

2. 在 `docs/90-agent/todo/model-3.md` 內文最後一段之後空一行加入：

```md
2026-10-05 使用者裁定（TODO 全表盤點的 survey）：同題對照要花兩份 brain 的錢，現在沒有急迫性，改放 Watch。事件發生時，照上面的做法量，再決定 brain 維持 sonnet、改 opus 或按 stage 分。
```

3. 在 `docs/README.md` 裡，連到 10-03 todo-patrol-three 計畫的那一列之後加一列：

```md
| TODO 全表盤點（10-05）的 plan：壓縮重試最多三次的測試、`/fankeel` 頁面寫不出來時 station 行說出來、兩處 timeout 與行號小錯、brain 選模型改放 Watch | [plans/2026-10-05-todo-patrol-ready-three.md](90-agent/plans/2026-10-05-todo-patrol-ready-three.md) — *design-intent, 繁體中文* |
```

4. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0；`node scripts/todo.js list` 裡 model-3 列在 Watch 下、不在 Ready。

5. 不 commit。回報兩個路徑：`docs/90-agent/todo/model-3.md`、`docs/README.md`；訊息：

```text
docs: move the brain-model comparison to watch, index the 10-05 patrol plan

- the user's ruling: a same-task opus/sonnet comparison waits for a run whose round trips or defects run high — docs/90-agent/todo/model-3.md
- index row for the plan — docs/README.md
```

## Coverage

| promise | task |
|---|---|
| compact-1 壓縮重試上限沒有測試 — 開了 hooks/compact.ts:70-72，迴圈寫死 `attempt <= 3` | Task 1 |
| docs-2 兩處 timeout 與行號小錯 — 開了 docs/90-agent/reference/station.md:54-57 | Task 3（station.md）、Task 4（報告第 15 行） |
| inject-5 write 失敗仍起 station — 開了 hooks/inject.js:154-161，`writePage` 失敗只回 `null` | Task 2 |
| model-3 brain 該用 opus 還是 sonnet — 使用者選改放 Watch | Task 5 |
| compact-2 互動式下 compact 能不能用 | struck — 使用者選自己在互動式 TUI 跑一次，沒有 task |
| station-13 拆掉 shots-v3 兩個 junction | struck — 使用者選自己在 cmd 用不加 /s 的 rmdir，沒有 task |
