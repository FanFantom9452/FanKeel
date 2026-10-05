---
status: current
---

# TODO 全表盤點（10-05 第二輪）：站線 65 字元截斷與 stationLine 分支補測試 Implementation Plan

**Goal:** 做完這次盤點放行的兩條：inject-6（`hooks/inject.js` 把頁面寫入錯誤切在 65 字元，卻沒有測試釘住）與 render-1（`lib/render.js` 的 `stationLine` 各分支只有 regex 斷言，沒有證據它們被改壞時會紅）。
**Architecture:** Task 1 在 `tests/inject.test.js` 讓 `station.write` 丟出一則必定超過 65 字元的錯誤，斷言 station 行括號裡剛好 65 字元，用「65 改成 6500」的變異證明它會紅，並在 `docs/README.md` 補本計畫的索引列。Task 2 在 `tests/render.test.js` 補一個現有斷言漏掉的情形（`starting` 或 `failed` 的 station 即使帶著 url，也不算「仍在顯示」），再對 `stationLine` 的五處逐一做變異，每一處都要讓測試變紅。兩個 task 的檔案互不相交，可以同時派出。inject-6 與 render-1 由 land 關，本計畫不關。
**Tech Stack:** Node（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 0.99.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261005T154131/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；587 份 markdown、14 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。
- 每個 hook 在每條路徑上都 exit `0`，包含自己的錯誤（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。行號是本計畫寫成時（commit f3c23bac）的行號；實作者照每一步引的原文找位置，不照行號。
- init 區塊在參考長度的 plugin 根目錄下要小於 1400 字元（`tests/render.test.js` 的 `sizeAtReference(...) < 1400`），注入上限 2400 不動；65 這個數字就是讓錯誤行留在這個上限內的長度。
- 縮排跟著檔案走：`lib/render.js`、`hooks/inject.js` 四格；`tests/inject.test.js`、`tests/render.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc 或 sed（heredoc 吃反斜線，sed 沒對上時不報錯）。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 變異（mutation，把程式暫時改壞看測試會不會紅）一次只改一處，跑完立刻改回，改回後 `git diff <該檔>` 必須為空，才做下一個。

## Risks

- 讓 `station.write` 丟錯的方式若在 `gather` 就先丟出一則短於 65 字元的錯誤，新測試在現況就會紅，紅的原因卻不是截斷 — Task 1 — 實作者先跑新測試，必須在現況通過；不通過就把失敗訊息原樣回報並停手，不改測試去遷就。
- 把 `.slice(0, 65)` 改成 6500 時，若錯誤訊息本來就不到 65 字元，新測試不會紅，等於沒釘住 — Task 1 — 測試把設定目錄取名為 80 個 `c`，mkdir 的錯誤訊息含完整路徑，必定超過 65；變異那一步要看到紅才算完成。
- `stationLine` 的錯誤分支裡「只有 `running` 與 `started` 才帶 url」這個條件，現有測試只餵 `url: null` 的 `starting`，把條件換成 `true` 也不會紅 — Task 2 — 新測試補上帶 url 的 `starting` 與 `failed`，變異那一步要看到新測試紅。
- land 要關 inject-6 與 render-1，但本 task 的 registry 不一定記著這兩個 TODO id — land — land 照本計畫的 Goal 行關這兩條，其餘條目（compact-2、station-13 與 Blocked、Watch 各條）不關。

## Task 1: 站線的寫入錯誤切在 65 字元，補一個會紅的測試（inject-6）

**Files:**
- Modify: `hooks/inject.js` — `writePage` 上方註解補一句 65 字元的理由
- Modify: `docs/README.md` — 在 10-05 ready-three 計畫那列之後補本計畫一列
- Test: `tests/inject.test.js`

**Interfaces:**
- Consumes: `renderInit({ sessionId, station, serve, input })` in `lib/render.js`, which formats `{ error }` as the station line; Task 2 changes only a comment there, not this signature or its output
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/inject.test.js` 檔尾，`test('a /fankeel prompt whose page write fails says so on the station line', ...)` 結束的 `});` 之後空一行，加入：

```js
// inject-6: the hook cuts a page write error to 65 characters, which is what
// keeps the station line inside the init block's cap. A config directory named
// with 80 characters puts that name in the mkdir error, so the message is
// longer than 65 whatever the temp directory is.
test('a page write error longer than 65 characters is cut to 65 on the station line', () => {
  const dir = tmp('fankeel-hook-');
  const cfg = path.join(tmp('fankeel-cfg-'), 'c'.repeat(80));
  fs.mkdirSync(cfg);
  fs.writeFileSync(path.join(cfg, 'fankeel'), 'not a directory');
  const text = context(run({ session_id: MINE, cwd: dir, prompt: '/fankeel' }, cfg));
  const line = text.match(/^station: the page was not written \((.*)\)\.$/m);
  assert.ok(line, 'no unwritten-page station line in: ' + text);
  assert.equal(line[1].length, 65, 'the error shown was: ' + line[1]);
});
```

2. 跑 `node --test tests/inject.test.js`，全部通過（新測試在現況就該過）。若新測試紅了，把失敗訊息原樣貼進回報並停手。

3. 對照：在 `hooks/inject.js` 把

```text
                return { error: String((e && e.message) || e).split('\n')[0].slice(0, 65) };
```

   暫時改成同一行但 `.slice(0, 6500)`，再跑 `node --test tests/inject.test.js`，新測試要紅（失敗訊息是長度不等於 65，實際值大於 65），其他測試照舊通過。改回 `.slice(0, 65)`，`git diff hooks/inject.js` 為空，再跑一次，全部通過。三次的輸出結尾（pass／fail 計數與失敗的那一項）原樣貼進回報。

4. 在 `hooks/inject.js` 把整行

```text
        // line, with its error, rather than dropping the line (inject-5).
```

   在 `hooks/inject.js` 換成這兩行：

```js
        // line, with its error, rather than dropping the line (inject-5), and the
        // error is cut to 65 characters so the line stays under the init cap (inject-6).
```

5. 在 `docs/README.md` 裡，連到 10-05 ready-three 計畫（壓縮重試、write 失敗的 station 行那份）的那一列之後加一列：

```md
| TODO 全表盤點（10-05 第二輪）的 plan：站線的寫入錯誤切在 65 字元補測試、`stationLine` 各分支逐一變異並補帶 url 的 `starting` 斷言 | [plans/2026-10-05-station-line-tests.md](90-agent/plans/2026-10-05-station-line-tests.md) — *design-intent, 繁體中文* |
```

6. 跑 `node --test tests/inject.test.js` 與 `node scripts/docs-check.js`，兩者都 exit 0。

7. 不 commit。回報三個路徑：`tests/inject.test.js`、`hooks/inject.js`、`docs/README.md`；訊息：

```text
test: pin the 65-character cut on the station line's write error

inject-6: hooks/inject.js cut the error to 65 characters with no test
holding it. The new test feeds an error longer than 65 and fails when
the cut is raised to 6500.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: `stationLine` 每個分支都做一次變異，補上帶 url 的 `starting` 斷言（render-1）

**Files:**
- Modify: `lib/render.js` — `stationLine` 上方註解補一句哪些狀態算「仍在顯示」
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `stationLine` 與 `renderInit` 的輸出不變，只改註解

**Dispatch:** implementer, sonnet

1. 在 `tests/render.test.js` 裡，`test('the station line names a page that was not written, and the url still serving', ...)` 結束的 `});` 之後空一行，加入：

```js
// render-1: only a station that is running or was started this prompt shows
// the last page; one still starting, or one that failed, is not named even
// when a url came back with it.
test('the station line names no url for a station starting or failed, url or not', () => {
  const failed = { error: "EEXIST: file already exists, mkdir 'C:/Users/you/.claude/fankeel'" };
  for (const serve of [{ state: 'starting', url: 'http://127.0.0.1:7817/' }, { state: 'failed', url: 'http://127.0.0.1:7817/' }]) {
    assert.match(renderInit({ sessionId: MINE, station: failed, serve }),
      /^station: the page was not written \(EEXIST: file already exists, mkdir 'C:\/Users\/you\/\.claude\/fankeel'\)\.$/m,
      'a ' + serve.state + ' station was named as still showing the last page');
  }
});
```

2. 跑 `node --test tests/render.test.js`，全部通過（新測試在現況就該過）。

3. 對 `lib/render.js` 的 `stationLine` 逐一做下面五個變異。每一個：改一處，跑 `node --test tests/render.test.js`，記下紅的測試名稱，改回，`git diff lib/render.js` 為空，才做下一個。每一個都必須有至少一項測試紅。

   | 變異 | 原文 | 改成 | 預期紅的測試 |
   |---|---|---|---|
   | error 分支消失 | `if (typeof station.error === 'string') {` | `if (false) {` | the station line names a page that was not written, and the url still serving |
   | 錯誤時誰算仍在顯示 | `(s.state === 'running' \|\| s.state === 'started') ? s.url : null` | `true ? s.url : null` | the station line names no url for a station starting or failed, url or not |
   | running 分支消失 | 以 `if (typeof s.url === 'string' && s.state === 'running')` 開頭的整行 | 刪掉該行 | the station line names the served url, a station still starting, or the file |
   | started 分支消失 | 以 `if (typeof s.url === 'string' && s.state === 'started')` 開頭的整行 | 刪掉該行 | the station line names the served url, a station still starting, or the file |
   | starting 分支消失 | 以 `if (s.state === 'starting')` 開頭的整行 | 刪掉該行 | the station line names the served url, a station still starting, or the file |

   若有一個變異沒有任何測試紅，不要自己發明斷言：把該變異、跑出的 pass／fail 計數原樣回報並停手。

4. 在 `lib/render.js` 把整行

```text
// url, which still shows the last page it had.
```

   在 `lib/render.js` 換成這三行：

```js
// url, which still shows the last page it had. Only `running` and `started`
// count as serving there: a station still starting has shown no page yet, and
// `tests/render.test.js` fails when either of the other states is named (render-1).
```

5. 跑 `node --test tests/render.test.js`，全部通過。

6. 不 commit。回報兩個路徑：`tests/render.test.js`、`lib/render.js`，附上第 3 步五個變異各自的紅測試名稱與 pass／fail 計數；訊息：

```text
test: mutate every stationLine branch, pin the url to running and started

render-1: stationLine's branches had regex assertions but no evidence
they fail when broken. Five mutations each turn a test red; the one that
survived, a starting or failed station with a url, now has its own test.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Coverage

| promise | task |
|---|---|
| inject-6（站線 65 字元截斷）— hooks/inject.js:159 的 `.slice(0, 65)` 仍在，tests/inject.test.js 沒有任何一處釘它 — do now | Task 1 |
| render-1（stationLine 新分支沒變異）— lib/render.js:314-324 四個分支都在，tests/render.test.js:572、675 只有 regex 斷言 — do now | Task 2 |
| compact-2（互動式下 compact）— 開了 hooks/compact.ts 與 tests/compact.test.js，都在 | struck — 要在互動式 TUI 實跑，只有使用者能做，survey 已列為 needs the user |
| station-13（拆 shots-v3 兩個 junction）— `.fankeel/build/task-20261003T114747/shots-v3/cfg/projects` 仍存在且有內容 | struck — 要使用者用 cmd `rmdir`，survey 已列為 needs the user |
