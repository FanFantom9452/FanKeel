---
status: design-intent
---

# TODO 全表盤點（10-13）：面板門檻改讀 compact.at、Pane 四處重複、逐塊調整兩條、指南一句 Implementation Plan

**Goal:** 做完 10-13 盤點放行的五條（compact-5、pane-5、tune-3、tune-4、init-3），並把今天對得到證據的三條 Blocked 條目重新蓋章。
**Architecture:** Task 1 讓輸入框上方的 `ctx` 長條在門檻是無限大（`compact.at` 為 `off`）時只畫數字；Task 2 讓 `hooks/pane.ts` 改用 `hooks/compact.ts` 的 `threshold`，不再自己抄一份；Task 3 讓 `context:` 行在 profile 檔設了門檻時不再說沒有視窗，並改正 `registry.md` 那一句；Task 4 在指南補 init 第 7 步那一句與本計畫的索引列；Task 5 重新蓋章三條 Blocked。其後是 Pane 四處重複的任務與逐塊調整的任務，最後一個任務由使用者在真機上用一次。程式已修好的四條（context-1、pane-4、test-6、test-7）沒有任務：它們記在本 task 的 registry `todo` 欄，由 land 關。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies；`hooks/*.ts` 由 Node 24 去型別後直接 import），`node --test`，git 2.56.0.windows.2，fankeel 0.103.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261012T182908/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；855 份 markdown、19 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。
- 每個 hook 在每條路徑上都 exit `0`，包含自己的錯誤（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才會被 `tests/source.test.js` 看到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。行號是本計畫寫成時（commit 36a33b37）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- `hooks/compact.ts` 由引擎執行，不能 require `lib/`；`HARD` 在那裡再寫一次，由 `tests/compact.test.js` 釘住（`hooks/compact.ts:7-9`）。
- 注入區塊有長度上限（`tests/render.test.js`）；本計畫不在 `context:` 行加任何字，只拿掉一句。
- 縮排跟著檔案走：`hooks/*.ts` 與 `tests/context.test.js` 兩格；`lib/*.js`、`tests/pane*.test.js` 四格。
- 行尾 LF（`.gitattributes`）。檔案用 Edit／Write 改，不用 heredoc。
- 文件頁每行不超過 160 欄（`node scripts/docs-check.js`）；新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。
- TODO 條目在 `docs/90-agent/todo/`；改完跑 `node scripts/todo-check.js`，exit 0。`stamp` 是「有人讀過 timing 並同意它仍成立」的那一天（`docs/90-agent/reference/todo.md:35`）。
- 實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`，不寫裸的 hex。

## Risks

- `lib/` 看不到這個 session 有沒有在 `/plugin` 按過 Enable：profile 檔設了門檻、但 mod 沒載入時，Task 3 拿掉那一句之後就沒有東西提醒沒有視窗 — Task 3 — 只在門檻來自專案或機器的 profile 檔時拿掉（內建的 450000 不算，那不代表有人選了 mod）；這個取捨在 plan 的 gate 說出來。
- `threshold` 每 250 毫秒多一次 `env.get` 與一到兩次 profile 檔的 `exists`／`read` — Task 2 — 既有的 pane 測試沒有 profile 檔，`log.reads` 不變；實作者改完跑 `tests/pane.test.js` 全檔，數量與改前相同再加兩項。
- Task 1、Task 2 與 Pane 四處重複的任務都改 `hooks/pane-band.ts`、`hooks/pane.ts`、`hooks/pane-status.ts` — 後者 — `ledger.js ready` 依 Files 的交集排序；實作者照原文錨點找位置，前一個任務改過的行不照行號。
- land 會照 registry 的 `todo` 欄印出十三行 `todo.js done`，其中五條真機條目（brief-3、compact-4、pane-1、pane-2、pane-6）不該關，init-3 不在那一欄卻該關 — land — land 只執行 compact-5、pane-5、tune-3、context-1、pane-4、test-6、test-7 的那幾行，另外手動為 init-3 跑一行；tune-4 等使用者真機用過才關。
- Pane 任務裡寫的通過數是 Task 1、Task 2 落地之後的：`tests/pane.test.js` 62、`tests/pane-bar.test.js` 11、`tests/pane-band.test.js` 17、`tests/pane-status.test.js` 26、`tests/pane-gate.test.js` 12（commit 36a33b37 時是 60／11／16／26／12）— Task 6 到 Task 10 — 實作者動工前先跑自己的測試檔記下數量，與這裡不合就以實跑的為準並在回報說出來。
- 外框裡的 block 超過 20 個時，伺服器的 `strs()` 只留前 20 個，`done` 會把第 21 個以後的編輯當成越界退回；兩條條目與判官都沒提這個上限，本計畫沒有動它 — Task 11、Task 12 — plan 的 gate 說出這一題；Task 16 的步驟只點 `section.scheme`，不點包著 63 塊的 `<main>`。
- 條目寫「標紅」，浮層既有的錯誤色是琥珀 `#e0a526`，判官寫的是照缺備註那一則的做法 — Task 13 — 用 `fk-live-err` 與琥珀；標記加在畫好的列上，下一次 `draw()` 就沒了，測試只釘住失敗當下。
- Task 15 之後圈選中就能寫備註，而 Esc 仍會丟掉這次圈選連同備註；每點一次頁面清單重畫，備註的值留著、焦點不留 — Task 15 — 沒有改；Task 16 第 5 步若踩到，另開條目。
- Task 16 用的 `.fankeel/build/2026-10-13-pane-colour/mockup.html` 在被 git 忽略的目錄裡，可能已被清掉，7819 也可能被佔 — Task 16 — session 起伺服器前先確認檔案在、port 沒被佔；不在就換一頁同時有「不在 block 內的元素」與「包著 block 的外框」的 mockup。
- Task 14 沒有改 `agents/fankeel-mockup.md` 的 `last_verified` — Task 14 — 實作者改完多跑一次 `node scripts/docs-check.js`，它點名這一頁就把日期改成 2026-10-13。

## Task 1: 門檻是無限大時，ctx 只畫數字

**Files:**
- Modify: `hooks/pane-band.ts` — `secondAt` 裡畫 `ctx` 的那一段：`context.at` 不是有限數字時不畫長條與 `/門檻`
- Test: `tests/pane-band.test.js`

**Interfaces:**
- Consumes: none
- Produces: `bandRows` 接受 `context.at === Infinity`，第二行畫成 `▌ctx 212k`（Task 2 的 off 測試依賴這個畫法）

**Dispatch:** implementer, sonnet

1. 在 `tests/pane-band.test.js` 檔尾加入：

```js
// compact.at off is an infinite threshold (hooks/compact.ts threshold): the
// count is drawn alone, with no bar and nothing after the slash.
test('with no compact threshold the band draws the count alone', async () => {
    const m = await load();
    const open = { tokens: 212000, at: Infinity };
    const row = band(m, { context: open, limits: [] })[1];
    assert.equal(line(row), '▌ctx 212k');
    assert.deepEqual(row[2], { text: '212k', color: '#00ff00' });
    assert.equal(band(m, { context: open, limits: [five] }).map(line)[1], '▌ctx 212k  │  5h ██████▌░░░  66%');
});
```

2. 跑 `node --test tests/pane-band.test.js`：新測試紅，actual 是 `▌ctx ░░░░░░░░░░ 212k/Infinityk`；其餘照舊通過。

3. 在 `hooks/pane-band.ts` 的 `secondAt` 裡，把這一段：

```ts
    if (context) {
      const paint = ctxPaint(context.tokens, context.at)
      open('ctx ')
      draw(context.tokens, context.at, paint)
      row.push(inked(kilo(context.tokens), paint, 1), { text: `/${kilo(context.at)}`, color: WHERE })
      if (paint.mark) row.push(inked(paint.mark, paint, 1))
    }
```

   在 `hooks/pane-band.ts` 換成：

```ts
    if (context) {
      const paint = ctxPaint(context.tokens, context.at)
      open('ctx ')
      // compact.at off is an infinite threshold: the count alone, with nothing to measure it against.
      if (Number.isFinite(context.at)) {
        draw(context.tokens, context.at, paint)
        row.push(inked(kilo(context.tokens), paint, 1), { text: `/${kilo(context.at)}`, color: WHERE })
      } else {
        row.push(inked(kilo(context.tokens), paint))
      }
      if (paint.mark) row.push(inked(paint.mark, paint, 1))
    }
```

4. 跑 `node --test tests/pane-band.test.js`：全過，數量是改前加一。把兩次的 pass／fail 行原樣貼進回報。

## Task 2: 面板的門檻改用 hooks/compact.ts 的 threshold（compact-5 第 1、3 項）

**Files:**
- Modify: `hooks/compact.ts` — `threshold` 加上 `export`
- Modify: `hooks/pane.ts` — `contextOf` 改呼叫 `threshold`，import 與呼叫處跟著改
- Modify: `hooks/pane-status.ts` — `contextBlock` 上方註解補上 `compact.at`
- Read: `hooks/pane-band.ts` — Task 1 的 off 畫法
- Test: `tests/pane.test.js`

**Interfaces:**
- Consumes: Task 1 的 `bandRows`：`context.at === Infinity` 時第二行是 `▌ctx <count>`
- Produces: `export async function threshold($: EngineInterface, found: { entry: Entry; root: string } | null): Promise<number>`（`hooks/compact.ts`）——`FANKEEL_COMPACT_AT`、專案 profile、機器 profile、`HARD`，`off` 回 `Infinity`

**Dispatch:** implementer, sonnet

1. 在 `tests/pane.test.js` 裡，`test('with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block', ...)` 這個測試之前空一行，加入：

```js
const profileFile = (data) => ({ [ROOT + '/.fankeel/profile.json']: JSON.stringify(data) });

// compact-5: the same source as hooks/compact.ts threshold, so the band and the
// Pane move with the profile's compact.at.
test('the band and the context block are measured against the profile\'s compact.at', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), profileFile({ 'compact.at': '350000' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ████████▉░ 312k/350k ⚠');
    const pane = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.ok((await pane()).includes('context'), 'no context block at 312k of 350k');
    // Four fifths of 350k is 280k.
    log.tokens = 279999;
    await log.ticks[0].fn();
    assert.ok(!(await pane()).includes('context'), 'a context block under four fifths of 350k');
});

test('compact.at off draws the count with no threshold and never a context block', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), profileFile({ 'compact.at': 'off' })), tokens: 2000000 });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx 2000k');
    assert.ok(!texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('context'));
});
```

2. 跑 `node --test tests/pane.test.js`：兩個新測試紅（第一個的 actual 是 `▌ctx ██████▉░░░ 312k/450k`，第二個是 `▌ctx ██████████ 2000k/450k ⚠`）；其餘照舊通過。記下改前的 pass 數。

3. 在 `hooks/compact.ts`，把 `async function threshold($: EngineInterface, found: { entry: Entry; root: string } | null): Promise<number> {` 這一行的開頭改成 `export async function threshold(`，其餘不動：

```ts
export async function threshold($: EngineInterface, found: { entry: Entry; root: string } | null): Promise<number> {
```

4. 在 `hooks/pane.ts` 第 2 行，把 `import { parentOf, isActive, SESSION_ID, HARD } from './compact.ts'` 換成：

```ts
import { parentOf, isActive, SESSION_ID, threshold } from './compact.ts'
```

5. 在 `hooks/pane.ts`，把 `contextOf` 與它上方的註解（從 `// The tokens in play against the count hooks/compact.ts compacts at` 到函式結尾的 `}`）整段換成：

```ts
// The tokens in play against the count hooks/compact.ts compacts at — its own
// `threshold`, so FANKEEL_COMPACT_AT, the profile's compact.at and HARD are read
// in one place, and `off` is Infinity — and the rate limits the same call
// reports: `five_hour` and `seven_day` are the two drawn.
// No context while the engine has no count; neither when it cannot be asked.
async function contextOf($: EngineInterface, logged: Logged, found: { entry: Entry; root: string }): Promise<{ context: Context | null; limits: Limit[] }> {
  try {
    const usage = await $.session.usage()
    const limits = Array.isArray(usage.rateLimits) ? (usage.rateLimits as Limit[]) : []
    if (typeof usage.context.tokens !== 'number') return { context: null, limits }
    return { context: { tokens: usage.context.tokens, at: await threshold($, found) }, limits }
  } catch (err) {
    logOnce($, logged, 'context', `fankeel pane: no token count, ${String(err)}`)
    return { context: null, limits: [] }
  }
}
```

6. 在 `hooks/pane.ts`，把 `const { context, limits } = await contextOf($, logged)` 換成：

```ts
  const { context, limits } = await contextOf($, logged, found)
```

7. 在 `hooks/pane-status.ts`，把 `contextBlock` 上方註解的前兩行 `// Drawn only from KEEP percent of the threshold (hooks/compact.ts HARD or` 與 `// FANKEEL_COMPACT_AT), and then never given up: that a compact is close, or` 換成：

```ts
// Drawn only from eighty percent of the threshold (hooks/compact.ts threshold:
// FANKEEL_COMPACT_AT, the profile's compact.at, else HARD), and then never
// given up: that a compact is close, or
```

8. 跑 `node --test tests/pane.test.js tests/compact.test.js`：全過，`tests/pane.test.js` 的數量是改前加二，`tests/compact.test.js` 數量不變。

9. 對照：在 `hooks/pane.ts` 把 `at: await threshold($, found)` 暫時改成 `at: 450000`，跑 `node --test tests/pane.test.js`，兩個新測試都要紅。改回來，`git diff hooks/pane.ts` 只剩第 4 到 6 步的改動，再跑一次全過。兩次的 pass／fail 行原樣貼進回報。

## Task 3: profile 檔設了門檻時，context 行不再說沒有視窗（compact-5 第 2、4 項）

**Files:**
- Modify: `lib/context.js` — `contextLine` 多收第四個參數，是有限門檻時不加 `NO_WINDOW`
- Modify: `lib/render.js:95-405` — `render` 與 `renderResume` 把 profile 檔設的 `compact.at` 傳進去
- Modify: `docs/90-agent/reference/registry.md:1-492` — 「still compacts at 450k」那一句與 frontmatter 的 `last_verified`
- Read: `lib/profile.js` — `values` 與 `sources` 的形狀（第 331-333 行），`KEYS['compact.at']`（第 42 行）
- Test: `tests/context.test.js`

**Interfaces:**
- Consumes: none
- Produces: `contextLine(info, sessionId, env, compactAt)`（`lib/context.js`）——`compactAt` 是 `350000`、`450000` 或 `600000`（字串或數字）時不加 `NO_WINDOW`；`off`、`undefined` 與其他值照舊

**Dispatch:** implementer, sonnet

1. 在 `tests/context.test.js` 裡，`test('both blocks read the window from the hook\'s own environment', ...)` 這個測試結束的 `});` 之後空一行，加入：

```js
// compact-5: hooks/compact.ts compacts at the profile's compact.at, so a tier a
// profile file set is a window of its own. The built-in tier is nobody's choice.
test('a tier the profile set stands in for the window; off and no tier do not', () => {
  const info = { dropped: 0, used: ctx.BUSY };
  for (const at of ['350000', '450000', '600000', 350000]) {
    assert.doesNotMatch(ctx.contextLine(info, null, {}, at), /auto-compact window/, String(at));
  }
  for (const at of ['off', undefined, null, '123']) {
    assert.match(ctx.contextLine(info, null, {}, at), /No auto-compact window is set/, String(at));
  }
});

test('both blocks pass the tier a profile file set, never the built-in one', () => {
  const { render, renderResume } = require('../lib/render.js');
  const now = Date.now();
  const mine = { sessionId: 'a', data: { task: 'x', scope: ['a.js'], stage: 'build', active: true, updated: new Date(now).toISOString() } };
  const file = transcript([usage(ctx.BUSY)]);
  const profileOf = (source) => ({ values: { 'compact.at': '350000' }, sources: { 'compact.at': source } });
  const block = (source) => render({ mine, others: [], now, root: 'F:/x', launch: 'F:/x', transcript: file, profile: profileOf(source) });
  const resume = (source) => renderResume({ mine, transcript: file, profile: profileOf(source) }) || '';
  const saved = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  try {
    delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    for (const source of ['project', 'machine']) {
      assert.doesNotMatch(block(source), /auto-compact window/, source);
      assert.doesNotMatch(resume(source), /auto-compact window/, source);
    }
    assert.match(block('builtin'), /No auto-compact window is set/);
    assert.match(resume('builtin'), /No auto-compact window is set/);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    else process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = saved;
  }
});
```

2. 跑 `node --test tests/context.test.js`：兩個新測試紅（第一個在 `'350000'` 那一輪，第二個在 `project` 那一輪）；其餘照舊通過。

3. 在 `lib/context.js`，`const NO_WINDOW = ...` 那一行之後空一行，加入：

```js
// A tier of the profile's compact.at (lib/profile.js KEYS): hooks/compact.ts
// compacts there, so the session has a window whatever the variable says.
const tier = (at) => /^(350000|450000|600000)$/.test(String(at));
```

4. 在 `lib/context.js`，把 `function contextLine(info, sessionId, env) {` 換成 `function contextLine(info, sessionId, env, compactAt) {`，並把 `(env && !windowSet(env) ? NO_WINDOW : '')` 換成 `(env && !windowSet(env) && !tier(compactAt) ? NO_WINDOW : '')`。改完那兩行是：

```js
function contextLine(info, sessionId, env, compactAt) {
```

   與，同在 `lib/context.js`：

```js
        return 'context: ' + k(info.used) + ' in play, nothing dropped yet. ' + carry + (env && !windowSet(env) && !tier(compactAt) ? NO_WINDOW : '');
```

5. 在 `lib/render.js`，`function profileLine(profile) {` 之前空一行，加入：

```js
// The profile's compact.at where a file set it. The built-in tier is left out:
// it says nothing about whether anyone enabled the mod that compacts there.
function tierOf(profile) {
    if (!profile || !profile.values || !profile.sources) return undefined;
    return profile.sources['compact.at'] === 'builtin' ? undefined : profile.values['compact.at'];
}
```

6. 在 `lib/render.js`，`const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId, process.env);` 出現兩次（`render` 與 `renderResume` 各一），兩處都換成：

```js
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId, process.env, tierOf(profile));
```

7. 跑 `node --test tests/context.test.js tests/render.test.js tests/resume.test.js`：全過，`tests/context.test.js` 的數量是改前加二，另兩檔數量不變。

8. 在 `docs/90-agent/reference/registry.md`，把以 The fankeel module 開頭、以 it is enabled. 結尾、說 mod 仍在 450k 壓縮的那一句（跨三行）換成下面這段，前後的句子不動，並把 frontmatter 的 `last_verified` 改成 `2026-10-13`：

```md
The fankeel module
(`hooks/compact.ts`) compacts at the profile's `compact.at` at a turn end in a
session where it is enabled: 450k unless a profile says otherwise, never when
it is `off`. A tier a profile file set takes the sentence off the line; the
built-in one does not.
```

9. 跑 `node scripts/docs-check.js`，exit 0、沒有新的發現。把第 2、7 步的 pass／fail 行與這一步的最後一行原樣貼進回報。

## Task 4: 指南補上 init 第 7 步那一句，並為本計畫補索引列（init-3）

**Files:**
- Modify: `docs/01-guide/profile.md` — 講 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 的那一段多兩句
- Modify: `docs/README.md` — 本計畫的索引列
- Read: `scripts/compact-window.js` — `show` 子命令印什麼（第 7-13 行的註解）
- Read: `skills/fankeel-init/SKILL.md` — 第 7 步怎麼問（第 148-171 行）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 讀 `scripts/compact-window.js` 第 7-13 行與 `skills/fankeel-init/SKILL.md` 第 148-171 行，確認下面兩句說的與程式相符；不相符就停手回報，不要改寫事實。條目 init-3 寫的是舊做法（答是由 `compact-window.js set` 寫進 `settings.json`、答否由 `decline` 記住）；第 7 步後來改成問 `compact.at` 的檔位，不寫 `settings.json`，下面兩句照現在的 skill 寫。

2. 在 `docs/01-guide/profile.md`，找到以「再重開 Claude Code。」結尾的那一句（開頭是「不想每個 session 按 Enable 的話，可以改用 Claude Code 自己的自動壓縮」），在它之後、「2026-10-12 在 headless 用環境變數量過」之前插入：

```md
`/fankeel-init` 的第 7 步會先跑 `scripts/compact-window.js show`，看這台機器有沒有設這個變數，再問你 fankeel 自己的 mod 要在多少 token 壓縮。答案寫進機器層 profile 的 `compact.at`，不會改你的 `settings.json`；要用這個變數還是得自己設。
```

   這一頁一段是一行；插入的兩句接在同一行裡，前後各留原來的標點，不另起新行。

3. 在 `docs/README.md`，找到 10-05 盤點計畫（檔名含 todo-patrol-ready-three）的那一列，在它的下一行加入：

```md
| TODO 全表盤點（10-13）的 plan：面板門檻改讀 `compact.at`、Pane 四處重複、逐塊調整兩條、指南補 init 第 7 步 | [plans/2026-10-13-todo-patrol-five.md](90-agent/plans/2026-10-13-todo-patrol-five.md) — *design-intent, 繁體中文* |
```

4. 跑 `node scripts/docs-check.js`（exit 0、沒有新的發現；若它說某一句超過 160 欄，把那一句在句號處拆成兩句，不改事實）與 `node --test tests/profile-table.test.js`（全過）。兩個命令的最後一行原樣貼進回報。

## Task 5: 今天對得到證據的三條 Blocked 重新蓋章

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/90-agent/todo/quota-1.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/90-agent/todo/spend-2.md` — `stamp:` 改成 2026-10-13
- Read: `.fankeel/build/task-20261012T182908/survey.md` — 每條 timing 查了什麼（第 23-37 行）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一個 shell 呼叫做完整個 task，派出去比做還貴。

1. 這三條是盤點拿得到證據的：`npm view knip version` 仍是 6.41.0；`~/.claude/tokenbar-usage.jsonl` 只有 29 行、沒跨過 7d reset。跑：

```sh
sed -i 's/^stamp: .*/stamp: 2026-10-13/' docs/90-agent/todo/build-1.md docs/90-agent/todo/quota-1.md docs/90-agent/todo/spend-2.md
```

2. 跑 `grep -n '^stamp' docs/90-agent/todo/build-1.md docs/90-agent/todo/quota-1.md docs/90-agent/todo/spend-2.md`（三行都是 `stamp: 2026-10-13`）與 `node scripts/todo-check.js`（exit 0）。其餘 Blocked 條目的 stamp 留在 2026-10-12：盤點沒辦法在這台機器上核對它們的條件，而且沒有一條到期。

## Task 6: 刪掉沒有使用者的 HOLLOW 與 TITLE

**Files:**
- Modify: `hooks/pane-band.ts` — 刪 `export const HOLLOW` 與 `export const TITLE` 兩行
- Test: `tests/pane-band.test.js` — 把釘住它們的那條 `deepEqual` 的兩個成員與兩個值刪掉

**Interfaces:**
- Consumes: none
- Produces: none（`pane-band.ts` 不再匯出 `HOLLOW`、`TITLE`；`TODO`、`GUARD`、`FLAG`、`WHERE`、`CLASH`、`INK` 不動）

**Dispatch:** implementer, sonnet

1. 先確認沒有第二個使用者。跑：

```sh
git grep -nw "HOLLOW\|TITLE" -- hooks tests
```

   預期只有 `hooks/pane-band.ts` 兩行定義與 `tests/pane-band.test.js` 一行（`hooks/` 與 `tests/` 之外的 `TITLE-PROBE-260929` 是別的東西，不在這個範圍）。多出別的行就停下回報。

2. 在 `tests/pane-band.test.js` 的 `test('the colours are the ones the design lists', ...)` 裡，把這一整行：

```js
    assert.deepEqual([m.HOLLOW, m.TODO, m.GUARD, m.FLAG, m.TITLE, m.WHERE, m.CLASH, m.INK], ['#585858', '#767676', '#d7af5f', '#ff5f5f', '#bcbcbc', '#8a8a8a', '#ff0000', '#000000']);
```

   在 `tests/pane-band.test.js`，原地換成：

```js
    assert.deepEqual([m.TODO, m.GUARD, m.FLAG, m.WHERE, m.CLASH, m.INK], ['#767676', '#d7af5f', '#ff5f5f', '#8a8a8a', '#ff0000', '#000000']);
```

   這是刪一條只為釘住死匯出的斷言，沒有「先紅」可言：跑 `node --test tests/pane-band.test.js`，17 項全過（改前也是 17）。

3. 在 `hooks/pane-band.ts`，先把

```ts
export const HOLLOW = '#585858'
// The stations still ahead, and a task not begun.
```

   在 `hooks/pane-band.ts`，換成

```ts
// The stations still ahead, and a task not begun.
```

   在 `hooks/pane-band.ts`，再把

```ts
export const FLAG = '#ff5f5f'
export const TITLE = '#bcbcbc'
export const WHERE = '#8a8a8a'
```

   在 `hooks/pane-band.ts`，換成

```ts
export const FLAG = '#ff5f5f'
export const WHERE = '#8a8a8a'
```

4. 跑 `node --test tests/pane-band.test.js`，17 項全過；再跑 `git grep -nw "HOLLOW\|TITLE" -- hooks tests`，沒有任何輸出。這一項沒有 mutation：它刪的是沒有人用的名字，沒有「唯一的定義」可以改了讓測試變紅；上面那條 `git grep` 為空就是它的證明。不 commit。

## Task 7: 分鐘的格式化只剩 pane-bar.ts 的 minutes

**Files:**
- Modify: `hooks/pane-bar.ts` — 加 `export const minutes`
- Modify: `hooks/pane-band.ts` — 刪本地的 `minutes`，改從 `./pane-bar.ts` 匯入
- Modify: `hooks/pane-status.ts` — `mins` 改呼叫匯入的 `minutes`，缺值仍回 `?`
- Test: `tests/pane-bar.test.js` — 在既有的 `countdown` 測試裡加 `minutes` 的斷言
- Read: `tests/pane-band.test.js` — mutation 時要看它的 `本站` 斷言變紅，不改
- Read: `tests/pane-status.test.js` — mutation 時要看它的 `出去 N 分` 斷言變紅，不改

**Interfaces:**
- Consumes: none
- Produces: `export const minutes = (ms: number): number` in `hooks/pane-bar.ts` — 整分鐘數，向下取整，不小於 0（Task 8 之後的任務不依賴它）

**Dispatch:** implementer, sonnet

1. 在 `tests/pane-bar.test.js` 的 `test('countdown is hours and two-digit minutes, ...', ...)` 裡，把這一行

```js
    const { countdown } = await load();
```

   在 `tests/pane-bar.test.js`，換成

```js
    const { countdown, minutes } = await load();
    // The one place whole minutes are made: the band's stage minutes and the Pane's agent minutes are both this.
    assert.equal(minutes(0), 0);
    assert.equal(minutes(59999), 0);
    assert.equal(minutes(60000), 1);
    assert.equal(minutes(38 * 60000 + 5000), 38);
    assert.equal(minutes(-60000), 0, 'never under zero');
```

2. 跑 `node --test tests/pane-bar.test.js`，要紅：該測試以 `TypeError: minutes is not a function` 失敗，其餘 10 項過。

3. 在 `hooks/pane-bar.ts`，把

```ts
// ` 66%`: three cells of number, so a column of them lines up.
```

   在 `hooks/pane-bar.ts`，換成（前面多出來的是新的定義與一個空行）：

```ts
// Whole minutes in `ms`, never under zero: the band's stage minutes and the Pane's agent minutes are both this.
export const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60000))

// ` 66%`: three cells of number, so a column of them lines up.
```

4. 在 `hooks/pane-band.ts`，把第一個 import 行

```ts
import { str, list, width, bar, ctxPaint, fivePaint, weekPaint, deviation, limitOf, pct, kilo, signed, DIM } from './pane-bar.ts'
```

   在 `hooks/pane-band.ts`，換成

```ts
import { str, list, width, bar, ctxPaint, fivePaint, weekPaint, deviation, limitOf, pct, kilo, signed, minutes, DIM } from './pane-bar.ts'
```

   在 `hooks/pane-band.ts`，再把

```ts
const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60000))

function inked(
```

   在 `hooks/pane-band.ts`，換成

```ts
function inked(
```

5. 在 `hooks/pane-status.ts`，把

```ts
import { str, list, width, cut, WIDE, DIM } from './pane-bar.ts'
```

   在 `hooks/pane-status.ts`，換成

```ts
import { str, list, width, cut, WIDE, DIM, minutes } from './pane-bar.ts'
```

   在 `hooks/pane-status.ts`，再把

```ts
const mins = (ms: unknown): string => (typeof ms === 'number' && Number.isFinite(ms) ? String(Math.max(0, Math.floor(ms / 60000))) : '?')
```

   在 `hooks/pane-status.ts`，換成

```ts
const mins = (ms: unknown): string => (typeof ms === 'number' && Number.isFinite(ms) ? String(minutes(ms)) : '?')
```

6. 跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-status.test.js`，三個檔各自 11 / 17 / 26 項全過。再跑 `git grep -n "Math.floor(ms / 60000)" -- hooks`：只剩 `hooks/pane-bar.ts` 的兩處（`minutes` 與 `countdown` 內部的 `total`，後者是 `countdown` 自己的算式，不在這一項的範圍）。

7. mutation：在 `hooks/pane-bar.ts` 把 `minutes` 裡的 `Math.floor(ms / 60000)` 暫時改成 `Math.ceil(ms / 60000)`，跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-status.test.js`。要紅的：pane-bar 的 `countdown` 測試（`minutes(59999)` 得 1）、pane-band 的 `the stage minutes come from the last move...`（`本站` 38 變 39）與 `the first row is the rail...`、pane-status 的 `出去 19 分` 那條（`NOW - 20 * 60000 + 1000`，向上取整得 20）。band 與 Pane 兩邊都至少一個測試紅才算數；沒有就停下回報。改回 `Math.floor`，`git diff -- hooks/pane-bar.ts` 與步驟 3 之後的狀態一致（只剩 `minutes` 那一處新增），再跑一次三個檔，全過。把紅的與回復後的輸出原樣貼進回報。不 commit。

## Task 8: gate 剩餘秒數的算式只剩 pane-bar.ts 的 secondsLeft

**Files:**
- Modify: `hooks/pane-bar.ts` — 加 `export const secondsLeft`
- Modify: `hooks/pane-band.ts` — gate 的 `還 N 秒` 改呼叫 `secondsLeft`
- Modify: `hooks/pane-gate.ts` — `gateRows` 的 `after` 改呼叫 `secondsLeft`
- Test: `tests/pane-bar.test.js` — 在既有的 `countdown` 測試裡加 `secondsLeft` 的斷言
- Read: `tests/pane-band.test.js` — mutation 時要看它的 `還 46 秒` 斷言變紅，不改
- Read: `tests/pane-gate.test.js` — mutation 時要看它的 `還 46 秒` 斷言變紅，不改

**Interfaces:**
- Consumes: `minutes` 已在 `hooks/pane-bar.ts`、`hooks/pane-band.ts` 的 import 行（Task 7）
- Produces: `export const secondsLeft = (until: number, now: number): number` in `hooks/pane-bar.ts` — `until` 前還有幾秒，向上取整，不小於 0

**Dispatch:** implementer, sonnet

1. 在 `tests/pane-bar.test.js` 的 `countdown` 測試裡，把（Task 7 改過的）這一行

```js
    const { countdown, minutes } = await load();
```

   在 `tests/pane-bar.test.js`，換成

```js
    const { countdown, minutes, secondsLeft } = await load();
    // The one place a gate's seconds are made: the band's badge and the Pane's gate row are both this.
    assert.equal(secondsLeft(NOW + 45000, NOW), 45);
    assert.equal(secondsLeft(NOW + 45001, NOW), 46, 'a part second counts whole');
    assert.equal(secondsLeft(NOW, NOW), 0);
    assert.equal(secondsLeft(NOW - 1, NOW), 0, 'never under zero, and never -0');
    assert.equal(secondsLeft(NOW - 5000, NOW), 0);
```

2. 跑 `node --test tests/pane-bar.test.js`，要紅：`TypeError: secondsLeft is not a function`，其餘 10 項過。

3. 在 `hooks/pane-bar.ts`，把（Task 7 加的）

```ts
export const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60000))
```

   在 `hooks/pane-bar.ts`，換成

```ts
export const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60000))
// Whole seconds until `until`, a part second counted whole, never under zero: the band's badge and the Pane's gate row are both this.
export const secondsLeft = (until: number, now: number): number => Math.max(0, Math.ceil((until - now) / 1000))
```

4. 在 `hooks/pane-band.ts`，把 import 行

```ts
import { str, list, width, bar, ctxPaint, fivePaint, weekPaint, deviation, limitOf, pct, kilo, signed, minutes, DIM } from './pane-bar.ts'
```

   在 `hooks/pane-band.ts`，換成

```ts
import { str, list, width, bar, ctxPaint, fivePaint, weekPaint, deviation, limitOf, pct, kilo, signed, minutes, secondsLeft, DIM } from './pane-bar.ts'
```

   在 `hooks/pane-band.ts`，再把

```ts
        { text: `還 ${Math.max(0, Math.ceil((gateUntil - now) / 1000))} 秒`, color: GUARD, bold: true, gap: 2 },
```

   在 `hooks/pane-band.ts`，換成

```ts
        { text: `還 ${secondsLeft(gateUntil, now)} 秒`, color: GUARD, bold: true, gap: 2 },
```

5. 在 `hooks/pane-gate.ts`，把

```ts
import { cut } from './pane-status.ts'
```

   在 `hooks/pane-gate.ts`，換成

```ts
import { cut } from './pane-status.ts'
import { secondsLeft } from './pane-bar.ts'
```

   在 `hooks/pane-gate.ts`，再把

```ts
  const after = now === undefined ? '' : `還 ${Math.max(0, Math.ceil((pending.until - now) / 1000))} 秒`
```

   在 `hooks/pane-gate.ts`，換成

```ts
  const after = now === undefined ? '' : `還 ${secondsLeft(pending.until, now)} 秒`
```

6. 跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-gate.test.js`，11 / 17 / 12 項全過。再跑 `git grep -n "Math.ceil((" -- hooks`：只剩 `hooks/pane-bar.ts` 的 `secondsLeft` 一處。

7. mutation：在 `hooks/pane-bar.ts` 把 `secondsLeft` 裡的 `Math.ceil` 暫時改成 `Math.floor`，跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-gate.test.js`。要紅的：pane-bar 的 `countdown` 測試（`secondsLeft(NOW + 45001, NOW)` 得 45）、pane-band 的 `a waiting gate adds the badge...`（`secs(NOW + 45001)`）、pane-gate 的 `gateRows with a clock puts the seconds left...`（`badge(54999)`）。band 與 Pane（gate）兩邊都至少一個測試紅才算數。改回 `Math.ceil`，`git diff` 對照步驟 3 之後的狀態沒有多出一行，再跑一次三個檔，全過。把紅的與回復後的輸出原樣貼進回報。不 commit。

## Task 9: Pane 一次繪製只讀一次時鐘

**Files:**
- Modify: `hooks/pane.ts` — Pane 的 `ui.render` 裡兩處 `Date.now()` 併成一個 `now`
- Test: `tests/pane.test.js` — 在 `a short pane with a four-option gate...` 測試裡數 `Date.now` 被讀幾次

**Interfaces:**
- Consumes: `gateRows(pending, cols, width, now?)`（`hooks/pane-gate.ts`）與 `statusRows({ ..., now })`（`hooks/pane-status.ts`）已有的 `now` 參數
- Produces: none

**Dispatch:** implementer, sonnet

說明：band 的 `ui.render`（`AbovePrompt`）本來就只讀一次；band 與 Pane 是引擎的兩次獨立繪製，各自一次讀數是最小的做法，不跨繪製共用狀態。

1. 在 `tests/pane.test.js` 的 `test('a short pane with a four-option gate keeps the task, every description, every button and the foot', ...)` 裡，把這一行（全檔只出現一次）

```js
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
```

   在 `tests/pane.test.js`，換成

```js
    // One reading of the clock for the whole drawing: the gate's seconds and the status block's minutes are of the same moment.
    const real = Date.now;
    let reads = 0;
    Date.now = () => { reads += 1; return real(); };
    let tree;
    try {
        tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
    } finally {
        Date.now = real;
    }
    assert.equal(reads, 1, 'the Pane read the clock ' + reads + ' times in one drawing');
```

2. 跑 `node --test tests/pane.test.js`，要紅：該測試以 `the Pane read the clock 2 times in one drawing` 失敗，其餘 61 項過。若讀數不是 2（引擎或 fake 在繪製途中另外讀了時鐘），把實際數字回報，不要自己改斷言的 1。

3. 在 `hooks/pane.ts` 的 Pane `ui.render` 裡，把

```ts
    const gate = pending && pendingFile ? gateRows(pending, cols - 1, width, Date.now()) : []
```

   在 `hooks/pane.ts`，換成

```ts
    // One reading for the whole drawing, so the gate's seconds and the status block's minutes are of the same moment.
    const now = Date.now()
    const gate = pending && pendingFile ? gateRows(pending, cols - 1, width, now) : []
```

   在 `hooks/pane.ts`，再把

```ts
      now: Date.now(),
      probe: seen.probe,
```

   在 `hooks/pane.ts`，換成

```ts
      now,
      probe: seen.probe,
```

   band 那一處（`cols,` 之後的 `now: Date.now(),`）不動。

4. 跑 `node --test tests/pane.test.js`，62 項全過。

5. mutation：在 `hooks/pane.ts` 把剛才的 `now,`（`probe: seen.probe` 上一行）暫時改回 `now: Date.now(),`，跑 `node --test tests/pane.test.js`，上面那個測試要紅（`read the clock 2 times`）。改回 `now,`，`git diff -- hooks/pane.ts` 對照步驟 3 之後的狀態沒有差，再跑一次，62 項全過。這一項的「band 與 Pane 兩邊」由 Task 8 的 `secondsLeft` mutation 承擔（band 與 gate 兩邊的測試都紅），這裡只證明 Pane 的繪製只讀一次。不 commit。

## Task 10: 百分之八十那條線只剩 pane-bar.ts 的 nearCompact

**Files:**
- Modify: `hooks/pane-bar.ts` — 加 `NEAR` 與 `export const nearCompact`，`ctxPaint` 的 `mark` 改用它
- Modify: `hooks/pane-status.ts` — 刪 `KEEP` 與 `near`，`contextBlock` 改呼叫 `nearCompact`
- Test: `tests/pane-bar.test.js` — 在 `ctxPaint` 的測試裡加 `nearCompact` 的斷言，並綁住它與 `ctxPaint` 的 `mark`
- Test: `tests/pane-band.test.js` — 在第二列測試裡加「正好八十」的 `⚠` 斷言
- Read: `tests/pane-status.test.js` — mutation 時要看它的 `context` 區塊斷言變紅，不改

**Interfaces:**
- Consumes: `minutes` 已在 `hooks/pane-status.ts` 的 import 行（Task 7）
- Produces: `export const nearCompact = (tokens: number, at: number): boolean` in `hooks/pane-bar.ts` — 整數比較 `tokens * 100 >= 80 * at`；`at` 為 0 時回 `true`（Pane 原本的行為，`ctxPaint` 另外擋掉 `at <= 0`）

**Dispatch:** implementer, sonnet

1. 在 `tests/pane-bar.test.js` 的 `test('ctxPaint steps through TokenBar\'s ramp ...', ...)` 裡，把這一行

```js
    const { ctxPaint } = await load();
```

   在 `tests/pane-bar.test.js`，換成

```js
    const { ctxPaint, nearCompact } = await load();
    // The eighty percent line is one definition: the band's mark and the Pane's context block both ask it.
    assert.equal(nearCompact(80000, 100000), true);
    assert.equal(nearCompact(79999, 100000), false);
    assert.equal(nearCompact(360000, 450000), true);
    assert.equal(nearCompact(359999, 450000), false);
    assert.equal(nearCompact(463000, 450000), true);
    for (const [tokens, at] of [[79999, 100000], [80000, 100000], [359999, 450000], [360000, 450000], [463000, 450000]]) {
        assert.equal(ctxPaint(tokens, at).mark === '⚠', nearCompact(tokens, at), tokens + ' of ' + at);
    }
```

2. 在 `tests/pane-band.test.js` 的 `test('the second row is ctx, 5h and 7d as bars, parted by a bar of their own', ...)` 裡，把這一行

```js
    const { width } = await at('pane-bar.ts');
```

   在 `tests/pane-band.test.js`，換成

```js
    const { width } = await at('pane-bar.ts');
    // The mark is drawn from eighty percent of the threshold, to the token.
    const ctxRow = (tokens) => line(band(m, { context: { tokens, at: 450000 }, limits: [], cols: 120 })[1]);
    assert.ok(ctxRow(360000).endsWith(' 360k/450k ⚠'), ctxRow(360000));
    assert.ok(ctxRow(359999).endsWith(' 360k/450k'), ctxRow(359999));
```

3. 跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js`，要紅：pane-bar 的 `ctxPaint` 測試以 `TypeError: nearCompact is not a function` 失敗。pane-band 那一項在現況就過（它釘的是現在的行為，先過是對的）；其餘過。

4. 在 `hooks/pane-bar.ts`，把

```ts
export function ctxPaint(tokens: number, at: number): Paint {
  const percent = at > 0 ? (tokens * 100) / at : 0
  return { ...step(CTX, percent), mark: percent >= 80 ? '⚠' : '' }
}
```

   在 `hooks/pane-bar.ts`，換成

```ts
// The percent of the compact threshold from which a compact is near: the band marks its meter and the Pane draws its context block from here.
const NEAR = 80
// Integer comparison, so a threshold needs no rounding.
export const nearCompact = (tokens: number, at: number): boolean => tokens * 100 >= NEAR * at

export function ctxPaint(tokens: number, at: number): Paint {
  const percent = at > 0 ? (tokens * 100) / at : 0
  return { ...step(CTX, percent), mark: at > 0 && nearCompact(tokens, at) ? '⚠' : '' }
}
```

5. 在 `hooks/pane-status.ts`，把（Task 7 改過的）import 行

```ts
import { str, list, width, cut, WIDE, DIM, minutes } from './pane-bar.ts'
```

   在 `hooks/pane-status.ts`，換成

```ts
import { str, list, width, cut, WIDE, DIM, minutes, nearCompact } from './pane-bar.ts'
```

   在 `hooks/pane-status.ts`，再把這四行加後面的空行整段刪掉（`contextBlock` 上方、以 `// Drawn only from eighty percent` 開頭的註解是 Task 2 改過的樣子，不動）：

```ts
// The percent of the compact threshold the context block appears at.
const KEEP = 80
// Integer comparison, so a threshold needs no rounding.
const near = (context: Context): boolean => context.tokens * 100 >= KEEP * context.at

// Drawn only from eighty percent
```

   在 `hooks/pane-status.ts`，換成（只留下最後那半行註解的開頭，其餘照原文接著）：

```ts
// Drawn only from eighty percent
```

   在 `hooks/pane-status.ts`，最後把

```ts
  if (!near(context)) return []
```

   在 `hooks/pane-status.ts`，換成

```ts
  if (!nearCompact(context.tokens, context.at)) return []
```

6. 跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-status.test.js`，11 / 17 / 26 項全過。再跑 `git grep -nw "KEEP\|near" -- hooks`：沒有程式再用到 `KEEP` 或 `near`（Task 2 已把 `contextBlock` 上方的註解改成 `eighty percent`；註解裡的英文單字 near 不算）。再跑 `git grep -n ">= 80\|\* 100 >=" -- hooks`：只剩 `hooks/pane-bar.ts` 的 `nearCompact`（`FIVE`、`CTX` 表裡的 `[80, ...]` 是色階，不是這條線）。

7. mutation：在 `hooks/pane-bar.ts` 把 `const NEAR = 80` 暫時改成 `const NEAR = 81`，跑 `node --test tests/pane-bar.test.js tests/pane-band.test.js tests/pane-status.test.js`。要紅的：pane-bar 的 `ctxPaint` 測試（`mark: from >= 80` 在 80000/100000 得 `''`，且 `nearCompact(80000, 100000)`）、pane-band 的第二列測試（`ctxRow(360000)` 少了 `⚠`）、pane-status 的 context 測試（`at(80000, 100000)` 的 `length, 2` 變 0，`360000` 也不再畫）。band 與 Pane 兩邊都紅才算數。改回 `80`，`git diff` 對照步驟 4、5 之後的狀態沒有差，再跑一次三個檔，全過。把紅的與回復後的輸出原樣貼進回報。不 commit。

## Task 11: 圈選時把每個 pick 解析成 block，解析不到的不給點

**Files:**
- Modify: `assets/tune/overlay.js` — `itemsOf` 以解析後的聯集填 `block`／`blocks`；新增 `blocksOf`；`describe`、`show`、chip 標籤與 click 處理改用它；一條琥珀標籤的 CSS
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: none
- Produces: `blocksOf(node) → string[]`（overlay 內部函式，不 export）：元素自己或祖先帶 `data-block` 時回 `[那個名字]`；否則回它裡面所有 `[data-block]` 的名字，依文件順序、各一次；兩者皆無回 `[]`。
- Produces: `describe(node)` 回的 pick 形狀 `{ block: string, blocks: string[], selector: string, classes: string[], text: string }`，`block` 等於 `blocks[0]`，沒有時是 `''`。
- Produces: `itemsOf(drafts)` 回的每個 item（也就是 `POST /__live/request` 的 body `{ page: string, items: item[] }` 裡的一則）：`{ note: string, block: string, selector: string, classes: string[], text: string, blocks?: string[], selectors?: string[] }`。`block` 是該則所有 pick 解析出的 block 聯集的第一個（沒有時 `''`）；`blocks` 只在聯集多於一個時出現，是整個聯集；`selectors` 只在 pick 多於一個時出現。`selector`、`classes`、`text` 仍是第一個 pick 的。
- Produces: hover 標籤的三種文字：`<label> · data-block="<name>"`、`<label> · 外框·<N> 塊`、`<label> · 沒有 data-block，往外或往內一層`；第三種時 `.fk-live-box` 與 `.fk-live-tag` 都帶 class `fk-live-bad`。

**Dispatch:** implementer, sonnet

1. 在 `tests/tune-overlay.test.js` 的 `makeEl` 裡，讓測試用的假 DOM 認得 `[data-block]` 這個選擇器。把這兩行

```js
    const match = (sel) => {
        const m = /^(?:body > )?(\w+)?((?:\.[\w-]+)*)(?::nth-of-type\((\d+)\))?(?:\[data-block="(.*)"\])?$/.exec(sel);
```

   在 `tests/tune-overlay.test.js` 換成（中間多一行，其餘不動）：

```js
    const match = (sel) => {
        if (sel === '[data-block]') return (n) => n.hasAttribute('data-block');
        const m = /^(?:body > )?(\w+)?((?:\.[\w-]+)*)(?::nth-of-type\((\d+)\))?(?:\[data-block="(.*)"\])?$/.exec(sel);
```

2. 在 `tests/tune-overlay.test.js` 檔尾（最後一個測試 `Escape while picking drops the pick, removes a draft left with no element, and the page does not see the key` 的 `});` 之後）空一行，加入：

```js
// tune-3: a pick is resolved to blocks when it is made. An element inside a
// block stands for that block; a frame around blocks stands for every block
// inside it; an element with neither is outlined amber, told why, and not taken.
test('itemsOf sends every block a frame pick resolved to, the first one as block', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const frame = { block: 'card', blocks: ['card', 'foot'], selector: 'div:nth-of-type(1)', classes: ['term'], text: 't' };
    const inner = { block: 'hero', blocks: ['hero'], selector: 'section:nth-of-type(1)', classes: [], text: 'h' };
    assert.deepEqual(itemsOf([{ note: 'one', picks: [frame] }, { note: 'two', picks: [inner, frame] }, { note: 'three', picks: [inner] }]), [
        { note: 'one', block: 'card', blocks: ['card', 'foot'], selector: 'div:nth-of-type(1)', classes: ['term'], text: 't' },
        { note: 'two', block: 'hero', blocks: ['hero', 'card', 'foot'], selector: 'section:nth-of-type(1)', classes: [], text: 'h', selectors: ['section:nth-of-type(1)', 'div:nth-of-type(1)'] },
        { note: 'three', block: 'hero', selector: 'section:nth-of-type(1)', classes: [], text: 'h' },
    ]);
});

// A frame around card and foot, with a spacer row between them that carries no
// data-block, appended to the stub page; picking has begun.
function withFrame() {
    const t = loadOverlay();
    const frame = t.doc.createElement('div');
    frame.className = 'term';
    const gap = t.doc.createElement('div');
    gap.className = 'gap';
    t.doc.body.appendChild(frame);
    frame.appendChild(t.page.card);
    frame.appendChild(gap);
    frame.appendChild(t.page.foot);
    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    return { t, frame, gap };
}

test('while picking, a click on a frame takes every block inside it, and an element with no block is told why and not taken', async () => {
    const { t, frame, gap } = withFrame();
    const chips = () => t.doc.all('.fk-live-chip').map((c) => c.textContent);
    const tag = () => t.q('.fk-live-tag');
    const box = () => t.q('.fk-live-box');

    t.fire(gap, 'mousemove');
    assert.equal(tag().textContent, 'div.gap · 沒有 data-block，往外或往內一層');
    assert.ok(box().classList.contains('fk-live-bad'), 'the outline of an element with no block is not amber');
    assert.ok(tag().classList.contains('fk-live-bad'), 'the label of an element with no block is not amber');
    t.fire(gap, 'click');
    assert.deepEqual(chips(), [], 'an element with no data-block in or around it was taken');

    t.fire(frame, 'mousemove');
    assert.equal(tag().textContent, 'div.term · 外框·2 塊');
    assert.ok(!box().classList.contains('fk-live-bad'), 'a frame around blocks is outlined amber');
    t.fire(frame, 'click');
    assert.deepEqual(chips(), ['div.term · 外框·2 塊×']);

    t.fire(t.page.hero, 'mousemove');
    assert.equal(tag().querySelector('b').textContent, 'hero', 'the label of an element in a block does not name the block');
    assert.ok(!tag().classList.contains('fk-live-bad'));

    t.fire(t.q('.fk-live-fin'), 'click');
    const area = t.doc.all('textarea').pop();
    area.value = '整個外框換底色';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const item = JSON.parse(t.fetched.filter((f) => f.url === '/__live/request')[0].init.body).items[0];
    assert.equal(item.block, 'card');
    assert.deepEqual(item.blocks, ['card', 'foot']);
    assert.match(item.selector, /^div:nth-of-type\(\d+\)$/);
    assert.equal(item.selectors, undefined);
    await t.tick();
});
```

3. 跑 `node --test tests/tune-overlay.test.js`。要紅的是新加的兩項，原有 22 項仍過：`itemsOf sends every block…` 紅在 `deepEqual`（第一則的 actual 沒有 `blocks`）；`while picking, a click on a frame…` 紅在第一個斷言，actual 是 `'div.gap'`。紅在別處（例如 `match` 那一行沒改到而 `querySelectorAll` 回空）就停手回報。

4. 在 `assets/tune/overlay.js` 的純函式那一半，把整段

```js
    // The request's items: one per draft that has a note and an element, the
    // first element's fields on the item, and when it has more than one,
    // every element's block (once each) and every selector.
    function itemsOf(drafts) {
        return drafts.filter(function (d) { return String(d.note || '').trim() && d.picks.length; }).map(function (d) {
            var first = d.picks[0];
            var item = { note: String(d.note).trim(), block: first.block, selector: first.selector, classes: first.classes, text: first.text };
            if (d.picks.length > 1) {
                item.blocks = d.picks.map(function (p) { return p.block; }).filter(function (b, i, all) { return b && all.indexOf(b) === i; });
                item.selectors = d.picks.map(function (p) { return p.selector; });
            }
            return item;
        });
    }
```

   在 `assets/tune/overlay.js` 換成：

```js
    // The request's items: one per draft that has a note and an element, the
    // first element's selector, classes and text on the item, and every block
    // its picks resolved to, once each: the first as `block`, all of them as
    // `blocks` when there is more than one. A pick that is a frame carries
    // its own `blocks`; `selectors` lists every pick when there are several.
    function itemsOf(drafts) {
        return drafts.filter(function (d) { return String(d.note || '').trim() && d.picks.length; }).map(function (d) {
            var first = d.picks[0];
            var union = [];
            d.picks.forEach(function (p) {
                (p.blocks || [p.block]).forEach(function (b) { if (b && union.indexOf(b) < 0) union.push(b); });
            });
            var item = { note: String(d.note).trim(), block: union[0] || '', selector: first.selector, classes: first.classes, text: first.text };
            if (union.length > 1) item.blocks = union;
            if (d.picks.length > 1) item.selectors = d.picks.map(function (p) { return p.selector; });
            return item;
        });
    }
```

5. 在 `assets/tune/overlay.js` 的 CSS 陣列裡，把這一行

```js
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
```

   在 `assets/tune/overlay.js` 換成兩行：

```js
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-tag.fk-live-bad{background:#e0a526;color:#1d2026}',
```

6. 在 `assets/tune/overlay.js` 裡，`blockName` 之後、`find` 之前，把

```js
    function blockName(node) {
        var b = blockOf(node);
        return b ? b.getAttribute('data-block') : '';
    }
```

   在 `assets/tune/overlay.js` 換成（`blockName` 不動，後面多一個函式）：

```js
    function blockName(node) {
        var b = blockOf(node);
        return b ? b.getAttribute('data-block') : '';
    }
    // What a pick stands for: the block it sits in; for a frame around
    // blocks, every block inside it, once each; nothing when it has neither.
    function blocksOf(node) {
        var own = blockName(node);
        if (own) return [own];
        return [].slice.call(node.querySelectorAll('[data-block]'))
            .map(function (b) { return b.getAttribute('data-block'); })
            .filter(function (b, i, all) { return b && all.indexOf(b) === i; });
    }
```

7. 在 `assets/tune/overlay.js` 把整個 `show`

```js
    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var name = target.getAttribute('data-block');
        tag.innerHTML = esc(labelOf(target)) + (name !== null ? ' · data-block="<b>' + esc(name) + '</b>"' : '');
        above(tag, target);
    }
```

   在 `assets/tune/overlay.js` 換成：

```js
    // The outline says what a click here would take: the block's name, or 外框
    // and how many blocks it holds; amber, and why, when it would take nothing.
    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var names = blocksOf(target);
        box.classList.toggle('fk-live-bad', !names.length);
        tag.classList.toggle('fk-live-bad', !names.length);
        tag.innerHTML = esc(labelOf(target)) + ' · ' + (!names.length ? '沒有 data-block，往外或往內一層'
            : blockName(target) ? 'data-block="<b>' + esc(names[0]) + '</b>"' : '外框·' + names.length + ' 塊');
        above(tag, target);
    }
```

8. 在 `assets/tune/overlay.js` 把整個 `describe`

```js
    function describe(node) {
        return { block: blockName(node), selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
    }
```

   在 `assets/tune/overlay.js` 換成：

```js
    function describe(node) {
        var names = blocksOf(node);
        return { block: names[0] || '', blocks: names, selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
    }
```

9. 在 `assets/tune/overlay.js` 的 `row` 裡，把這兩行

```js
            var code = c.querySelector('code');
            code.textContent = code.title = labelOf(p);
```

   在 `assets/tune/overlay.js` 換成：

```js
            var code = c.querySelector('code');
            var names = blocksOf(p);
            code.textContent = code.title = labelOf(p) + (blockName(p) ? '' : names.length ? ' · 外框·' + names.length + ' 塊' : ' · 沒有 data-block');
```

10. 在 `assets/tune/overlay.js` 的 window `click` 監聽裡，把這四行

```js
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        draw();
```

   在 `assets/tune/overlay.js` 換成：

```js
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        // An element with no block in or around it is shown why, and not taken.
        if (!blocksOf(picked).length) { show(picked); return; }
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        draw();
```

   `pickable` 本身不改：沒名字的元素仍要能被 hover 框住（琥珀色），只是點了不加入。

11. 跑 `node --test tests/tune-overlay.test.js`，24 項全過。

12. 不 commit。回報路徑 `assets/tune/overlay.js`、`tests/tune-overlay.test.js`；訊息：

```text
fix: a tune pick is resolved to blocks when it is made
- assets/tune/overlay.js: blocksOf gives the block an element sits in, or every block inside a frame; a frame's chip and label read 外框·N 塊; an element with neither is outlined amber, told why, and not taken; itemsOf sends the union as block and blocks
- tests/tune-overlay.test.js: a frame pick sends every inner block, an element with no block is not taken; the stub document answers [data-block]
```

## Task 12: 伺服器逐則檢查，點名第幾則與哪個元素

**Files:**
- Modify: `scripts/tune.js` — `itemOf` 的 `block` 取 `block||blocks[0]`；靜態頁缺 block 的檢查由整批一句改成逐則點名
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: Task 11 的 item 形狀 `{ note, block, selector, classes, text, blocks?, selectors? }`，包在 `POST /__live/request` 的 `{ page, items }` 裡。這個 task 不依賴 Task 11 已落地：舊的 overlay 送的 item 也符合。
- Produces: 靜態頁（非 `--proxy`）上，某一則沒有 block 時回 `400`、`content-type: text/plain; charset=utf-8`，body 是一行 `item <n>: <element> 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層`。`<n>` 是該則在送來的 `items` 裡從 1 起算的位置；`<element>` 是 `selector` 最後一段去掉 `:nth-of-type(k)` 後接上每個 class（`div.term.band`、`footer.fine.print`、`main#app`）。請求不是 `items` 形式時沒有 `item <n>: ` 前綴。只點名第一個不合格的一則。
- Produces: 每一則的 `block` 是 `block || blocks[0] || ''`，`--proxy` 模式也一樣。

**Dispatch:** implementer, sonnet

1. 在 `tests/tune.test.js` 的測試 `items are refused when empty, over twenty, or missing a note or an element, and on a static page every item needs a block` 裡，把這一行

```js
    assert.match((await ask([one, { note: 'y', selector: 'main > footer' }])).text, /a static page takes a data-block element/);
```

   在 `tests/tune.test.js` 換成三行：

```js
    const loose = await ask([one, { note: 'y', selector: 'main > footer:nth-of-type(1)', classes: ['fine', 'print'] }]);
    assert.equal(loose.status, 400);
    assert.equal(loose.text, 'item 2: footer.fine.print 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層');
```

2. 在 `tests/tune.test.js` 同一個測試結束的 `});` 之後空一行，加入：

```js
// tune-3: an item whose first element sat in no block arrives with an empty
// `block` and the rest in `blocks`; the item is held to the first of those.
test('a static item with an empty block takes the first of its blocks', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    const made = await request(base + '__live/request', 'POST', { page: '/page.html', items: [{ note: 'z', block: '', blocks: ['now'], selector: 'main > footer' }] });
    assert.equal(made.status, 200, made.text);
    const job = JSON.parse(spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' }).stdout);
    assert.equal(job.block, 'now');
    assert.equal(job.items[0].block, 'now');
});
```

3. 跑 `node --test tests/tune.test.js`（約 12 秒）。要紅的是兩項，其餘 25 項仍過：`items are refused…` 紅在 `loose.text`，actual 是 `a static page takes a data-block element on an html file under the served directory`；新測試紅在 `made.status`，actual 是 `400`。

4. 在 `scripts/tune.js` 把整段

```js
                // One change: a note for one element, or for several — then
                // `blocks` and `selectors` name every one of them.
                const itemOf = (d) => {
                    const one = { note: str(d.note, 4000), block: str(d.block, 200), selector: str(d.selector, 500), classes: Array.isArray(d.classes) ? d.classes.filter((c) => typeof c === 'string').slice(0, 20) : [], text: str(d.text, 80) };
                    const blocks = strs(d.blocks, 200);
                    const selectors = strs(d.selectors, 500);
                    if (blocks.length > 1) one.blocks = blocks;
                    if (selectors.length > 1) one.selectors = selectors;
                    return one;
                };
```

   在 `scripts/tune.js` 換成：

```js
                // One change: a note for one element, or for several — then
                // `blocks` and `selectors` name every one of them. `block`
                // falls back to the first of `blocks`, for an item whose first
                // element sat in no block.
                const itemOf = (d) => {
                    const blocks = strs(d.blocks, 200);
                    const selectors = strs(d.selectors, 500);
                    const one = { note: str(d.note, 4000), block: str(d.block, 200) || blocks[0] || '', selector: str(d.selector, 500), classes: Array.isArray(d.classes) ? d.classes.filter((c) => typeof c === 'string').slice(0, 20) : [], text: str(d.text, 80) };
                    if (blocks.length > 1) one.blocks = blocks;
                    if (selectors.length > 1) one.selectors = selectors;
                    return one;
                };
```

5. 在 `scripts/tune.js` 把這三行

```js
                if (!upstream && (!file || !/\.html?$/i.test(file) || !fs.existsSync(file) || items.some((it) => !it.block))) {
                    return send(res, 400, TYPES['.txt'], 'a static page takes a data-block element on an html file under the served directory');
                }
```

   在 `scripts/tune.js` 換成（第一句的訊息一字不改，只拿掉 `items.some` 那個條件；缺 block 另外逐則說）：

```js
                if (!upstream && (!file || !/\.html?$/i.test(file) || !fs.existsSync(file))) {
                    return send(res, 400, TYPES['.txt'], 'a static page takes a data-block element on an html file under the served directory');
                }
                // A static page is edited by block name, so every item needs
                // one. The refusal names the item and the element it pointed
                // at — its tag off the selector's last step, and its classes —
                // and the overlay reads `item <n>: ` off the front to mark it.
                const loose = upstream ? -1 : items.findIndex((it) => !it.block);
                if (loose >= 0) {
                    const it = items[loose];
                    const name = it.selector.split(' > ').pop().replace(/:nth-of-type\(\d+\)$/, '') + it.classes.map((c) => '.' + c).join('');
                    return send(res, 400, TYPES['.txt'], (many ? 'item ' + (loose + 1) + ': ' : '') + name + ' 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層');
                }
```

   `it.selector` 在這裡一定有值：上一行的 `bad` 檢查已經拒絕了既沒有 block 也沒有 selector 的那一則。

6. 跑 `node --test tests/tune.test.js`，27 項全過。

7. 不 commit。回報路徑 `scripts/tune.js`、`tests/tune.test.js`；訊息：

```text
fix: a static tune request is refused item by item, naming the element
- scripts/tune.js: an item with no block is named by its number and its element, in Chinese with the next step, instead of one English line for the batch; block falls back to the first of blocks
- tests/tune.test.js: the refusal reads item 2 and footer.fine.print; an item with an empty block and one name in blocks is accepted
```

## Task 13: 送出被拒時，被點名的那一則標出來，訊息說第幾則

**Files:**
- Modify: `assets/tune/overlay.js` — `sendAll` 的失敗處理讀 `item <n>: ` 前綴，把那一則的列加上 `fk-live-err`，佇列列寫「第 n 則：…」；一條 CSS
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: Task 12 的拒絕形狀：`400`、`text/plain`，body `item <n>: <element> 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層`，`<n>` 從 1 起算。overlay 送出前已擋掉空備註、也不保留沒有元素的草稿，所以 `<n>` 就是托盤裡第 n 列。
- Produces: 失敗後 `sendErr` 是 `第 <n> 則：<前綴之後的原文>`，托盤第 n 個 `.fk-live-item` 帶 class `fk-live-err`；body 沒有 `item <n>: ` 前綴時 `sendErr` 是原文、沒有任何列被標記。草稿與備註都留著（原本就是）。

**Dispatch:** implementer, sonnet

「標紅」照判官說的「照缺備註那一則的做法」：用浮層既有的錯誤色 `#e0a526` 與既有的 class 名 `fk-live-err`，不另立一個紅色。

1. 在 `tests/tune-overlay.test.js` 的 `loadOverlay` 裡，讓假的 `fetch` 能回一次拒絕。把

```js
    const fetchStub = (url, init) => {
        fetched.push({ url, init });
        const body = url === '/__live/request' ? { id: 'r1' } : { pending: 0, editing: [] };
```

   在 `tests/tune-overlay.test.js` 換成（中間多一行）：

```js
    const fetchStub = (url, init) => {
        fetched.push({ url, init });
        if (url === '/__live/request' && shared && shared.refuse) return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve(shared.refuse) });
        const body = url === '/__live/request' ? { id: 'r1' } : { pending: 0, editing: [] };
```

2. 在 `tests/tune-overlay.test.js` 檔尾空一行，加入：

```js
// tune-3: a refusal that names an item keeps every draft, marks that item's
// row, and says which one on the queue line; one that names none marks none.
test('a refused send keeps the drafts, marks the item the server named, and says which one', async () => {
    const why = 'div.r 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層';
    const t = loadOverlay({ refuse: 'item 2: ' + why });
    t.openTray();
    t.draft(['hero'], 'first');
    t.draft(['card'], 'second');
    t.fire(t.q('.fk-live-all'), 'click');
    await t.tick();
    assert.equal(t.q('.fk-live-badge').textContent, '2', 'a refused send dropped the drafts');
    assert.deepEqual(t.doc.all('textarea').map((x) => x.value), ['first', 'second']);
    assert.equal(t.q('.fk-live-queue').querySelector('span').textContent, '第 2 則：' + why);
    assert.deepEqual(t.doc.all('.fk-live-item').map((li) => li.classList.contains('fk-live-err')), [false, true]);

    const plain = loadOverlay({ refuse: 'not JSON' });
    plain.openTray();
    plain.draft(['hero'], 'first');
    plain.fire(plain.q('.fk-live-all'), 'click');
    await plain.tick();
    assert.equal(plain.q('.fk-live-queue').querySelector('span').textContent, 'not JSON');
    assert.deepEqual(plain.doc.all('.fk-live-item').map((li) => li.classList.contains('fk-live-err')), [false]);
});
```

3. 跑 `node --test tests/tune-overlay.test.js`。新測試要紅在佇列列那個斷言，actual 以 `item 2: div.r` 開頭；前兩個斷言（草稿留著）在現況就過。其餘全過。

4. 在 `assets/tune/overlay.js` 的 CSS 陣列裡，把這一行

```js
        '.fk-live-item.fk-live-picking{background:rgba(34,184,207,.07)}',
```

   在 `assets/tune/overlay.js` 換成兩行：

```js
        '.fk-live-item.fk-live-picking{background:rgba(34,184,207,.07)}',
        '.fk-live-item.fk-live-err{box-shadow:inset 3px 0 0 #e0a526}',
```

5. 在 `assets/tune/overlay.js` 的 `sendAll` 裡，把失敗那一支

```js
            }, function (err) {
                // The drafts stay; the server's reason goes on the queue line.
                busy = false;
                sendErr = err && err.message ? err.message : String(err);
                draw();
            });
```

   在 `assets/tune/overlay.js` 換成：

```js
            }, function (err) {
                // The drafts stay; the server's reason goes on the queue line.
                // `item <n>: ` on its front names the draft at fault, whose
                // row is marked until the next draw — picking it again is one.
                busy = false;
                var why = err && err.message ? err.message : String(err);
                var named = /^item (\d+): ([\s\S]*)$/.exec(why);
                sendErr = named ? '第 ' + named[1] + ' 則：' + named[2] : why;
                draw();
                var li = named ? list.children[named[1] - 1] : null;
                if (li) li.classList.add('fk-live-err');
            });
```

6. 跑 `node --test tests/tune-overlay.test.js`，全過（照本計畫順序是 25 項）。

7. 不 commit。回報路徑 `assets/tune/overlay.js`、`tests/tune-overlay.test.js`；訊息：

```text
fix: a refused tune send marks the item the server named
- assets/tune/overlay.js: the failure reads item <n> off the server's reason, marks that row and says 第 n 則 on the queue line; the drafts stay as before
- tests/tune-overlay.test.js: a refusal naming item 2 marks the second row only; one naming none marks none; the stub fetch can refuse
```

## Task 14: mockup agent 把外框與空列也掛上 data-block

**Files:**
- Modify: `agents/fankeel-mockup.md` — 「Built from the project's own parts」多一條：外框與區塊之間的列各自帶 `data-block`，一頁一種粒度
- Test: `tests/tune-overlay.test.js`
- Read: `lib/tune.js` — `outside()` 把選到的 block 整段切掉再比，內層 block 隨外層一起切掉，所以巢狀的名字是允許的

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/tune-overlay.test.js` 裡，測試 `the design and build skills and the mockup agent describe the assistant and items, not Alt` 結束的 `});` 之後空一行，加入：

```js
// tune-3: a frame and a spacer row with no name of their own are what the
// overlay cannot send, so the mockup agent is told to name them.
test('the mockup agent names the frame and the spacer row as blocks of their own', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-mockup.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(text, /A frame that wraps several blocks, and a row that sits between two blocks, each carry a `data-block` of their own/);
    assert.match(text, /One granularity per page/);
});
```

2. 跑 `node --test tests/tune-overlay.test.js`，新測試紅在第一個 `assert.match`，其餘全過。

3. 在 `agents/fankeel-mockup.md` 的「Built from the project's own parts」一節，把最後一條

```md
- Every block the approach changes carries `data-block="<name>"`, spelled
  literally in the markup. The user, the tuning step and the render reviewer
  all point at a block by that name.
```

   在 `agents/fankeel-mockup.md` 換成（原條不動，後面多一條）：

```md
- Every block the approach changes carries `data-block="<name>"`, spelled
  literally in the markup. The user, the tuning step and the render reviewer
  all point at a block by that name.
- A frame that wraps several blocks, and a row that sits between two blocks,
  each carry a `data-block` of their own. The tuning overlay refuses a click
  on an element with no `data-block` in or around it, and `tune.js done`
  puts back an edit that lands in markup no block owns; a name on the frame
  and on the spacer row is what lets a note about "the whole pane" or "this
  gap" be sent and kept. A named block inside a named frame is fine. One
  granularity per page: where a block is a group of rows, every such group
  is one, and a single row is a block only where it stands alone.
```

   frontmatter 不改。

4. 跑 `node --test tests/tune-overlay.test.js`，全過（照本計畫順序是 26 項）。

5. 不 commit。回報路徑 `agents/fankeel-mockup.md`、`tests/tune-overlay.test.js`；訊息：

```text
docs: the mockup agent names frames and spacer rows as blocks
- agents/fankeel-mockup.md: a frame around several blocks and a row between two blocks each carry a data-block; one granularity per page
- tests/tune-overlay.test.js: the agent file says so
```

## Task 15: 圈選中的那一列就有備註欄，兩個按鈕搬進那一列

**Files:**
- Modify: `assets/tune/overlay.js` — `row` 在圈選中的那一列畫「往外一層」「完成這則」與備註欄；左上提示拿掉兩個按鈕與滾輪那句；對應的 CSS 與兩行監聽
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: Task 11 的 `show()`（這個 task 的測試用 hover 之後按「往外一層」，`show` 要能畫出外層元素）；`walk(out)` 與 `endPick(keep)`，兩者都是 `assets/tune/overlay.js` 既有的函式、不改。
- Produces: 圈選中的那一列（`.fk-live-item.fk-live-picking`）裡有一個 `div.fk-live-row.fk-live-acts`，內含 `button.fk-live-out`（往外一層）、`span.fk-live-aside`（或滾輪：上 往外，下 往內）、`button.fk-live-fin`（完成這則），其後是與其他列相同的 `label` 加 `textarea`。`.fk-live-hint` 只剩編號、提示句與「Esc 取消」，裡面沒有按鈕。class 名 `fk-live-out`、`fk-live-fin` 不變，既有測試照舊用 `t.q('.fk-live-fin')` 找得到。

**Dispatch:** implementer, sonnet

照判官的最小改法：只搬兩個按鈕與備註欄，左上的提示句留著。圈選只能從托盤裡開始（「新增一則」或列上的編號），收合托盤就結束圈選，所以圈選中托盤一定是開的，按鈕搬進去不會看不到。

1. 在 `tests/tune-overlay.test.js` 檔尾空一行，加入：

```js
// tune-4: the item being picked carries its note field and its two buttons, so
// what the user does next is in the row the pick belongs to.
test('the row being picked has its note field, and 往外一層 and 完成這則 sit in it', () => {
    const t = loadOverlay();
    const span = t.doc.createElement('span');
    t.page.card.appendChild(span);
    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    const row = () => t.q('.fk-live-item.fk-live-picking');
    assert.ok(row(), 'no row is marked as the one being picked');
    const area = row().querySelector('textarea');
    assert.ok(area, 'the row being picked has no note field');
    assert.ok(row().querySelector('.fk-live-out'), '往外一層 is not in the row being picked');
    assert.ok(row().querySelector('.fk-live-fin'), '完成這則 is not in the row being picked');
    assert.equal(t.q('.fk-live-hint').querySelector('button'), null, 'the hint still carries a button');

    area.value = '先寫備註';
    t.fire(area, 'input');
    t.fire(t.page.hero, 'click');
    assert.equal(row().querySelector('textarea').value, '先寫備註', 'a pick threw the note away');

    t.fire(span, 'mousemove');
    t.fire(row().querySelector('.fk-live-out'), 'click');
    t.fire(span, 'click');
    assert.deepEqual(t.doc.all('.fk-live-chip').map((c) => c.textContent), ['section.hero-c×', 'section.card-c×'], '往外一層 in the row did not walk out to the parent');

    t.fire(row().querySelector('.fk-live-fin'), 'click');
    assert.equal(row(), null, '完成這則 in the row did not end the pick');
    assert.equal(t.q('.fk-live-out'), null, 'a row that is not being picked carries 往外一層');
    assert.deepEqual(t.doc.all('textarea').map((x) => x.value), ['先寫備註']);
    assert.equal(t.q('.fk-live-badge').textContent, '1');
});
```

2. 同一個檔案裡有一個舊測試在圈選結束之後才去找「完成這則」；按鈕搬進圈選中的那一列之後，那時候它已經不在頁面上，`t.q('.fk-live-fin')` 會回 `null`。在 `tests/tune-overlay.test.js` 的測試 `while picking, the capture listeners swallow the page's pointer and click events, never the overlay's own, and never when not picking` 尾端，把

```js
    // The overlay's own elements are never swallowed.
    own.length = 0;
    for (const type of TYPES) {
        const ev = t.fire(t.logo, type, { button: type === 'auxclick' ? 1 : 0 });
        assert.equal(ev.defaultPrevented, false, type + ' on the logo was prevented');
    }
    assert.deepEqual(own, TYPES, 'the logo missed an event while picking');
    assert.equal(t.fire(t.q('.fk-live-fin'), 'click').defaultPrevented, false);
});
```

   在 `tests/tune-overlay.test.js` 換成（「完成這則」趁那一列還在時先點，再開一則讓 logo 那一段仍在圈選中）：

```js
    // The overlay's own elements are never swallowed. 完成這則 sits in the row
    // being picked, so it is clicked while that row is there, and a new item
    // keeps the assistant picking for the logo.
    assert.equal(t.fire(t.q('.fk-live-fin'), 'click').defaultPrevented, false);
    t.fire(t.q('.fk-live-add'), 'click');
    own.length = 0;
    for (const type of TYPES) {
        const ev = t.fire(t.logo, type, { button: type === 'auxclick' ? 1 : 0 });
        assert.equal(ev.defaultPrevented, false, type + ' on the logo was prevented');
    }
    assert.deepEqual(own, TYPES, 'the logo missed an event while picking');
});
```

   跑 `node --test tests/tune-overlay.test.js`：這個舊測試在還沒改 `assets/tune/overlay.js` 時就該過；紅的只有第 1 步的新測試，紅在 `the row being picked has no note field`，其餘全過。

3. 在 `assets/tune/overlay.js` 的 CSS 陣列裡改三處。第一處，把

```js
        '.fk-live-ast button,.fk-live-hint button{font:inherit;color:inherit;border-radius:0;cursor:pointer}',
        '.fk-live-ast :focus-visible,.fk-live-hint :focus-visible{outline:2px solid #22b8cf;outline-offset:2px}',
```

   在 `assets/tune/overlay.js` 換成（提示裡不再有按鈕，兩個選擇器各少一半）：

```js
        '.fk-live-ast button{font:inherit;color:inherit;border-radius:0;cursor:pointer}',
        '.fk-live-ast :focus-visible{outline:2px solid #22b8cf;outline-offset:2px}',
```

   第二處，在 `assets/tune/overlay.js` 把

```js
        '.fk-live-later{margin:0;color:#b8b8b0}',
```

   在 `assets/tune/overlay.js` 換成：

```js
        '.fk-live-acts{align-items:center;margin-bottom:6px}',
```

   第三處，在 `assets/tune/overlay.js` 把下面這一行整行刪掉（上下兩行不動）：

```js
        '.fk-live-hint .fk-live-go{margin-left:auto}',
```

4. 在 `assets/tune/overlay.js` 把建立提示的那一段

```js
    var hint = el('div', 'fk-live-hint',
        '<p><span class="fk-live-num fk-live-open"></span><span class="fk-live-say"></span></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-out">往外一層</button>'
        + '<span class="fk-live-aside">或滾輪：上 往外，下 往內</span>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-fin">完成這則</button>'
        + '<span class="fk-live-aside"><kbd>Esc</kbd> 取消</span></div>');
```

   在 `assets/tune/overlay.js` 換成：

```js
    var hint = el('div', 'fk-live-hint',
        '<p><span class="fk-live-num fk-live-open"></span><span class="fk-live-say"></span></p>'
        + '<div class="fk-live-row"><span class="fk-live-aside"><kbd>Esc</kbd> 取消</span></div>');
```

5. 在 `assets/tune/overlay.js` 的 `row` 裡，把

```js
        li.appendChild(head);
        if (i === picking) {
            var later = doc.createElement('p');
            later.className = 'fk-live-later';
            later.textContent = '圈選中。按「完成這則」後在這裡寫備註。';
            li.appendChild(later);
            return li;
        }
        var label = doc.createElement('label');
```

   在 `assets/tune/overlay.js` 換成（不再提早 `return`，圈選中的列往下照樣畫 `label` 與 `textarea`）：

```js
        li.appendChild(head);
        // The item being picked carries its own two buttons, above its note.
        if (i === picking) {
            var acts = doc.createElement('div');
            acts.className = 'fk-live-row fk-live-acts';
            acts.innerHTML = '<button type="button" class="fk-live-btn fk-live-out">往外一層</button>'
                + '<span class="fk-live-aside">或滾輪：上 往外，下 往內</span>'
                + '<button type="button" class="fk-live-btn fk-live-go fk-live-fin">完成這則</button>';
            acts.querySelector('.fk-live-out').addEventListener('click', function () { walk(true); });
            acts.querySelector('.fk-live-fin').addEventListener('click', function () { endPick(true); });
            li.appendChild(acts);
        }
        var label = doc.createElement('label');
```

6. 在 `assets/tune/overlay.js` 把下面兩行整行刪掉（按鈕已不在提示裡，留著會在載入時對 `null` 呼叫 `addEventListener` 而整支浮層掛掉）：

```js
    hint.querySelector('.fk-live-out').addEventListener('click', function () { walk(true); });
    hint.querySelector('.fk-live-fin').addEventListener('click', function () { endPick(true); });
```

7. 在 `tests/tune-overlay.test.js` 檔頭註解裡，「往外一層」現在有測試按它了。把

```js
// pointercancel, the fold, clear and out buttons, document mousemove beyond the
```

   在 `tests/tune-overlay.test.js` 換成：

```js
// pointercancel, the fold and clear buttons, document mousemove beyond the
```

8. 跑 `node --test tests/tune-overlay.test.js`，全過（照本計畫順序是 27 項）。特別看三個舊測試仍過：`the assistant carries the words the approved mockup shows, and the station glyph`（`往外一層`、`或滾輪：上 往外，下 往內`、`完成這則` 三個字串仍在原始碼裡）、`while picking, the capture listeners swallow…`、`Escape while picking drops the pick…`。

9. 不 commit。回報路徑 `assets/tune/overlay.js`、`tests/tune-overlay.test.js`；訊息：

```text
feat: the tune item being picked carries its note and its two buttons
- assets/tune/overlay.js: the picking row draws 往外一層, 完成這則 and the note field; the hint keeps its sentence and Esc and no button; the fk-live-later line is gone
- tests/tune-overlay.test.js: the picking row has a textarea and both buttons, a note typed mid-pick survives a pick, and the row's 往外一層 walks out
```

## Task 16: 使用者在真的頁面上完整用一次

沒有測試看得到真的瀏覽器：真的 hit-testing、版面、焦點與顏色都只有人看得到。這個 task 是使用者的，沒有程式，也沒有任何派出去的 task 依賴它。

**Files:**
- Modify: `docs/90-agent/todo/tune-4.md` — 使用者試過之後，session 在內文末尾補一句看到了什麼與日期
- Read: `.fankeel/build/2026-10-13-pane-colour/mockup.html` — 試用的頁面：`h1` 不在任何 `data-block` 內，`header.top` 與 `section.scheme` 是包著 block 的外框，方案裡的列在 block 內，三種情形都有

**Interfaces:**
- Consumes: Task 11、Task 12、Task 13、Task 15 落地後的浮層與伺服器
- Produces: none

**Dispatch:** user — session 先起伺服器並給網址，使用者照下面七步在瀏覽器裡用一次、說哪一步卡住或「順」；沒有 subagent 能替人判斷直不直覺，也不需要截圖。

session 先做（使用者開始之前）：`scripts/tune.js` 改過，舊的伺服器要重起才吃得到 Task 12。在專案根目錄跑下面這行，放背景，把印出的網址加上 `mockup.html` 給使用者：

```sh
node scripts/tune.js serve .fankeel/build/2026-10-13-pane-colour --port 7819
```

使用者做（開 `http://127.0.0.1:7819/mockup.html`）：

1. 點右下角的 fankeel 標誌，托盤展開；按「新增一則」。托盤裡第 1 則那一列應該同時有「往外一層」「完成這則」和備註欄；左上只剩一句提示和「Esc 取消」。
2. 滑鼠移到頁首的大標題「Pane 配色：三個方案」。框應該是琥珀色虛線，標籤寫「h1 · 沒有 data-block，往外或往內一層」。點它一下：不會加入，那一列沒有多出 chip。
3. 滑鼠不離開標題，按「往外一層」到框住整個頁首（`header.top`）。框變回青色，標籤寫「header.top · 外框·1 塊」。
4. 滑鼠移到任一個方案裡的一列。框是青色，標籤寫出它所在的 `data-block` 名字。點一下加入。
5. 不按「完成這則」，直接在那一列的備註欄寫一句；再點頁面上另一塊加入，確認剛寫的備註還在。然後按「完成這則」。
6. 再「新增一則」，把滑鼠移到某個方案上、按「往外一層」到標籤寫「section.scheme · 外框·N 塊」，點一下；chip 應寫「section.scheme · 外框·N 塊」。寫備註、按「完成這則」，再按「全部送出（2 則）」。佇列那一行應該變成等待改寫，沒有錯誤訊息。
7. 告訴 session 送出了。session 跑 `node scripts/tune.js wait --timeout 600`，印出的 JSON 裡第 2 則的 `blocks` 應是那個方案裡全部的名字；接著不改任何檔、直接跑 `node scripts/tune.js done <id>`（`<id>` 用 `wait` 印出的那個），頁面會重新載入、被點到的區塊閃一下綠色。

使用者回一句：哪一步和上面寫的不一樣、哪裡還是卡，或「順」。session 把那句話和日期寫進 `docs/90-agent/todo/tune-4.md` 內文末尾；有卡住的地方另開條目，不在這個 task 裡修。

## Coverage

| promise | task |
|---|---|
| compact-5 — hooks/pane.ts:96 仍只讀 FANKEEL_COMPACT_AT；registry.md:489 仍寫「still compacts at 450k」 — do now | Task 1（off 的畫法）、Task 2（pane.ts 與 pane-status.ts 的註解）、Task 3（lib/context.js 的 NO_WINDOW 與 registry.md） |
| pane-5 — hooks/pane-band.ts:35,40 的 HOLLOW、TITLE 仍匯出，只有 tests/pane-band.test.js:82 在用；pane-status.ts:95 的 mins 仍在 — do now | Task 6（HOLLOW、TITLE）、Task 7（分鐘）、Task 8（gate 秒數）、Task 9（一次繪製一個時鐘）、Task 10（八十那條線） |
| tune-3 — scripts/tune.js:170-171 仍整批回一行英文 400，備註送不出 — do now | Task 11（圈選時解析）、Task 12（伺服器逐則檢查）、Task 13（被點名的那一則標出來）、Task 14（mockup 的粒度） |
| tune-4 — 逐塊調整工具的三個卡點仍在 — do now | Task 11（hover 分能送與不能送）、Task 15（備註欄與兩個按鈕在同一列）、Task 12 與 Task 13（送出失敗點名）、Task 16（使用者真機用一次） |
| init-3 — docs/01-guide/profile.md 目前沒有 compact-window 那一句 — lifted，do now | Task 4（照現在的第 7 步寫：問的是 `compact.at`，不寫 `settings.json`；條目裡的 set／decline 已不是事實） |
| context-1 — lib/context.js:97-121 已改成只認各自的 row — do now（核對後結案，無需程式） | struck — 沒有任務；記在 registry 的 todo 欄，由 land 關 |
| pane-4 — hooks/pane.ts:197 已用 live.json 篩鄰居 — do now（結案） | struck — 沒有任務；由 land 關 |
| test-6 — tests/render.test.js:464-472 的 fixture 已改 — do now（結案） | struck — 沒有任務；由 land 關 |
| test-7 — tests/gate.test.js 已改成看 pending 檔而不看時鐘 — do now（結案；五次全套連跑未做） | struck — 沒有任務；由 land 關，五次連跑沒有做，land 的 gate 說出來 |
| build-1 — npm view knip version 為 6.41.0 — 條件未達，restamp | Task 5（連同 quota-1、spend-2，三條今天對得到證據） |
| 其餘 Blocked — 無法核對的只 restamp | struck — stamp 是有人讀過並同意的那一天；盤點核對不了的不蓋新章，它們停在 2026-10-12，沒有一條到期 |
| needs the user：brief-3、compact-4、pane-1、pane-2、pane-6（全是真機步驟） | struck — 使用者自己做，沒有任務；land 不關它們 |
| Watch 全部 keep | struck — 沒有事件發生，不動 |
