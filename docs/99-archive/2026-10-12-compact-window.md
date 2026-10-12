---
status: current
---

# 自動壓縮改靠主機的壓縮視窗（10-12）Implementation Plan

**Goal:** 主 session 過 400k 而主機沒有設壓縮視窗時，`context:` 行說出來並指到那個一次性的設定；指南寫明怎麼設。
**Architecture:** 壓縮本身交給 Claude Code 主機：設了 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 之後它在 turn 進行中自己壓（量測在 `docs/90-agent/reports/2026-10-12-compact-window-probe.md`）。fankeel 這一側只做一件事：command hook 的行程繼承主機的環境變數，`lib/context.js` 的 `contextLine` 看得到有沒有設，沒設而且 context 已到 `BUSY` 就多一句。mod（`hooks/compact.ts`）不動。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組，`package.json` 沒有 dependencies），`node --test`；fankeel 0.101.0，工作樹 commit f741b6c7；Claude Code 2.1.296。
**Spec:** [2026-10-12-compact-window-design.md](2026-10-12-compact-window-design.md)

## Global Constraints

由 `node scripts/map.js`（827 markdown files，17 planned, not built，254 retired，12 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。環境變數用參數傳進 `contextLine`，只有 `lib/render.js` 的兩個呼叫處讀 `process.env`。
- `lib/context.js` 的 `inspect` 與 `contextLine` 不丟例外、讀不到就什麼都不說（`lib/context.js:107-109`）。
- 測試：`npm test` 是 `node --test`。每個 export 都要有 importer（`tests/source.test.js`），所以這次不新增 export。實作者只跑自己 task 列出的測試指令，不跑全套；全套由 build 收尾時跑。
- 不加 dependency（`CONTRIBUTING.md` 的 Maintenance 條）。
- `BUSY` 是 400000、`SOFT` 300000、`HARD` 450000（`lib/context.js:40-49`）。這次不改任何一個，也不動 `hooks/compact.ts`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）：一個 task 最多三個 `Modify:`，超過 1500 行的總量要寫行範圍。
- 縮排與分號照各檔原樣：`lib/*.js` 四格、有分號；`tests/context.test.js` 兩格、有分號。行尾 LF。用 Edit／Write 改檔，不用 heredoc。
- reference 頁重讀過且為真，`last_verified` 才改成當天；頁上引用的 `path:line` 會被 `scripts/docs-check.js` 逐行檢查。
- TODO 條目在 `docs/90-agent/todo/`，由 `scripts/todo.js new` 寫，正文至少 200 字，標題最多 28 欄（中日韓字元算兩欄）；沒有 `TODO.md`。
- 這個任務掛著三筆 Ready 條目（子代理 brief 改走 spawn、面板真機沒看完的四件事、Pane 顯示遠端控制狀態），三筆都要使用者在真機做，這次不做也不關；land 印出的 `todo.js done` 不要對它們跑。
- plan 站已經寫好、要跟著第一個 commit 一起進去的檔：這份計畫與它的 design、`docs/90-agent/reports/2026-10-12-compact-window-probe.md`、`docs/90-agent/judgements/2026-10-12-compact-before-build.md`、`docs/90-agent/todo/pane-3.md`、`docs/90-agent/todo/pane-4.md` 與 `docs/README.md` 的索引列。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。訊息第一行照 `git log` 的樣子：`fix: ` 或 `audit: ` 開頭的一句英文。

## Risks

- command hook 的行程看不看得到寫在 `~/.claude/settings.json` 的 `env` 裡的變數，只在 headless 用 shell 環境變數量過；Desktop 上看不到的話，設了視窗的 session 也會多那一句（誤報，不會漏報）——Task 1——接受；真機看一次開成 TODO（Task 2）。
- `tests/context.test.js` 既有的 `render`／`renderResume` 測試在跑測試的機器上讀得到真的 `process.env`；它們只在 context 低於 `BUSY` 或用 `doesNotMatch(/context:/)` 斷言，新的一句只在 `BUSY` 以上出現——Task 1——第 5 步連同 `tests/render.test.js`、`tests/render-context-inline.test.js` 一起跑。
- `tests/resume.test.js:107` 斷言 `nothing dropped yet\. This stage's gate gets a fourth option`，`tests/render.test.js:492` 斷言整個注入區塊小於 3000 字（最重的 fixture 現在 2901）；新的一句插在中間或加在已壓縮過的 session 上，兩條都會紅——Task 1——那一句放在整行最後，而且只在還沒壓縮過時加；第 5 步把這兩個檔一起跑。
- 新測試會改 `process.env`；Node 的 test runner 每個檔一個行程，同檔的測試依序跑——Task 1——測試用 `try`／`finally` 還原。
- 450000 的觸發點是從 100000 與 200000 兩個點外推的——Task 2——指南寫「約在視窗減 3 萬處」，並連到報告。

## Coverage

| promise | task |
|---|---|
| 指南寫明一次性的設定：在 `~/.claude/settings.json` 的 `env` 加 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`，建議值 `450000`；設了之後主機在 context 到視窗減約 3 萬時自己壓，turn 進行中也壓，不需要 mod、Enable 或使用者動作。 | Task 2 |
| 指南同一段改掉「你在全域關掉的自動壓縮，對沒有 fankeel task 的 session 維持關閉」那一句：這個設定對每個 session 都生效，不只 fankeel 的。 | Task 2 |
| context 到 `BUSY`（400k）以上、還沒有壓縮過，而 hook 的環境裡沒有正數的 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`：`context:` 行最後多一句，說這個 session 在模型自己的上限之前不會被壓縮，請 Claude 轉告使用者設那個變數或手動 `/compact`。已經壓縮過的 session 不加，那一行已經夠長（`tests/render.test.js` 的 3000 字上限）。 | Task 1 |
| 有設的時候，或 400k 以下：這一行跟現在一樣，一個字不多。 | Task 1 |
| `hooks/compact.ts` 不動：它的門檻是 450k，主機設 450000 時會先在 420k 上下壓到，mod 變成保險。 | struck — 沒有要做的事；Global Constraints 寫了不動它 |
| 不做依任務大小的判斷、不做進 build 前的壓縮、不做心跳檔：主機只在真的到線時才壓，task 少的任務永遠碰不到。 | struck — 沒有要做的事；design 第 3 節是紀錄 |
| Claude Desktop 真機上設定吃不吃得到，這次只有 headless 的量測；開一筆 TODO。 | Task 2 |
| 過 400k、還沒壓縮過而沒有設視窗時，context 行說出來 | Task 1 |
| 有設視窗時、400k 以下、或已經壓縮過，context 行不變 | Task 1 |
| 兩個注入區塊都帶那一句 | Task 1 |

上面最後三列是 design 的 `What proves it done` 表的 claim 欄。

## File structure

| file | responsibility |
|---|---|
| `lib/context.js` | 讀 transcript，決定 `context:` 行的字，含「沒有壓縮視窗」那一句 |
| `lib/render.js` | 把 hook 行程的環境交給 `contextLine`；不含判斷 |

## Task 1: context 行說出沒有壓縮視窗

**Files:**
- Modify: `lib/context.js` — `windowSet`、`NO_WINDOW`，`contextLine` 多一個參數
- Modify: `lib/render.js` — 兩處 `contextLine` 呼叫（`render` 的第 279 行與 `renderResume` 的第 402 行）
- Modify: `docs/90-agent/reference/registry.md:440-480` — `# When compaction has already cost something` 那一節
- Test: `tests/context.test.js`

**Interfaces:**
- Consumes: none
- Produces: `contextLine(info, sessionId, env)`，第三個參數是一個像 `process.env` 的物件，省略時行為跟現在完全一樣。

**Dispatch:** implementer, sonnet — the plan carries the code.

1. Write the failing tests. In `tests/context.test.js`, add these two tests at the end of the file:

```js
// The host compacts on its own once a window is set; without one, a session on
// a 1M window is not compacted until it is nearly full, and nothing said so.
test('a busy session with no auto-compact window is told nothing will compact it', () => {
  const info = { dropped: 0, used: ctx.BUSY };
  assert.doesNotMatch(ctx.contextLine(info), /auto-compact window/);
  assert.match(ctx.contextLine(info, null, {}),
    /nothing dropped yet\. This stage's gate gets a fourth option.*Adopt\. No auto-compact window is set.*CLAUDE_CODE_AUTO_COMPACT_WINDOW.*\/compact\.$/);
  assert.match(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '0' }), /No auto-compact window is set/);
  assert.match(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: 'off' }), /No auto-compact window is set/);
  assert.doesNotMatch(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '450000' }), /auto-compact window/);
  // a session that has compacted before keeps the line it had, busy or not
  assert.doesNotMatch(ctx.contextLine({ dropped: 500000, used: ctx.BUSY }, 'abc', {}), /auto-compact window/);
  assert.doesNotMatch(ctx.contextLine({ dropped: 500000, used: 1000 }, 'abc', {}), /auto-compact window/);
  assert.equal(ctx.contextLine({ dropped: 0, used: ctx.BUSY - 1 }, null, {}), null);
});

test('both blocks read the window from the hook\'s own environment', () => {
  const { render, renderResume } = require('../lib/render.js');
  const now = Date.now();
  const mine = { sessionId: 'a', data: { task: 'x', scope: ['a.js'], stage: 'build', active: true, updated: new Date(now).toISOString() } };
  const file = transcript([usage(ctx.BUSY)]);
  const block = () => render({ mine, others: [], now, root: 'F:/x', launch: 'F:/x', transcript: file });
  const resume = () => renderResume({ mine, transcript: file }) || '';
  const saved = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  try {
    delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    assert.match(block(), /No auto-compact window is set/);
    assert.match(resume(), /No auto-compact window is set/);
    process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '450000';
    assert.match(block(), /context: 40\dk in play/);
    assert.doesNotMatch(block(), /auto-compact window/);
    assert.doesNotMatch(resume(), /auto-compact window/);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    else process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = saved;
  }
});
```

2. Run the file and watch the two new tests fail:

```sh
node --test tests/context.test.js 2>&1 | grep -E "^(not ok|# (pass|fail))"
```

3. Write the implementation. In `lib/context.js`, directly above the line `const k = (n) =>`, add:

```js
// The host compacts on its own, mid-turn and in every client, once a window is
// set: measured 2026-10-12 at the window less some 30k
// (docs/90-agent/reports/2026-10-12-compact-window-probe.md). Without one it
// waits for the model's own limit, and on a 1M window that is where a session
// sat at 629k through sixteen turn ends with nothing compacting it. A hook
// process inherits the host's environment, so it can see which case this is.
const WINDOW = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function windowSet(env) {
    const n = Number(env && env[WINDOW]);
    return Number.isFinite(n) && n > 0;
}

// Last on the line and only before the first compaction: tests/resume.test.js
// reads the line's head, and tests/render.test.js caps the whole block.
const NO_WINDOW = ' No auto-compact window is set, so nothing compacts this session before the model\'s own limit: tell the user to set '
    + WINDOW + ' (450000) under env in ~/.claude/settings.json, or to /compact.';
```

   Then, still in `lib/context.js`, the head of `contextLine` becomes `function contextLine(info, sessionId, env) {`; and the first `return`, the one inside `if (!info.dropped)`, becomes `return 'context: ' + k(info.used) + ' in play, nothing dropped yet. ' + carry + (env && !windowSet(env) ? NO_WINDOW : '');` — that branch is only reached when the session is busy. The last `return` and the exports line do not change.

4. Write the implementation: the callers. In `lib/render.js`, in both `render` (line 279) and `renderResume` (line 402), the call becomes:

```js
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId, process.env);
```

5. Run and watch them pass, with the files that share these functions:

```sh
node --test tests/context.test.js tests/context-budget.test.js tests/render.test.js tests/render-context-inline.test.js tests/resume.test.js 2>&1 | grep -E "^(not ok|# (pass|fail))"
```

6. The reference page. In `docs/90-agent/reference/registry.md`, in the section `# When compaction has already cost something`, directly after the paragraph that ends ``and the same hand-off advice, with no `--session` id.``, add:

```md
At `BUSY` and above the line also says when nothing is going to compact the
session. Claude Code compacts on its own, mid-turn, once
`CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set — measured 2026-10-12 at the window
less some 30k ([the probe](../reports/2026-10-12-compact-window-probe.md)) —
and without it waits for the model's own limit. A hook process inherits the
host's environment, so `contextLine` in `lib/context.js` takes it as its third
argument, and with no positive number there, in a session that has not
compacted yet, it ends the line with `No auto-compact window is set` and where
to set one. With a window set, below `BUSY`, or once something has been
dropped, the line is as it was. The fankeel module (`hooks/compact.ts`) still compacts at 450k at a turn
end in a session where it is enabled; with a 450000 window the host gets there
first.
```

   Leave `last_verified` as it is unless you re-read the whole page.

7. Check the page, then commit `lib/context.js`, `lib/render.js`, `tests/context.test.js` and `docs/90-agent/reference/registry.md`, together with the plan-stage files Global Constraints lists:

```sh
node scripts/docs-check.js --role reference 2>&1 | tail -5
```

```text
fix: the context line says when no auto-compact window is set

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: 指南寫明怎麼設，與一筆真機 TODO

**Files:**
- Modify: `docs/01-guide/profile.md` — 第 60 行講 mod 與自動壓縮的那一段
- Modify: `docs/90-agent/todo/compact-4.md` — 新條目，由 `scripts/todo.js new --id compact-4` 寫出
- Read: `docs/90-agent/reports/2026-10-12-compact-window-probe.md` — 指南的數字要跟它一致

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two sentences in a guide page and one TODO entry; the plan carries the words.

1. The entry. Run `node scripts/todo.js list | grep compact` first and confirm no open entry already covers it. Then:

```sh
node scripts/todo.js new --id compact-4 --label compact --state ready --link lib/context.js --title "Desktop 真機看壓縮視窗" --description "CLAUDE_CODE_AUTO_COMPACT_WINDOW 只在 headless 量過；在 Claude Desktop 把它寫進 settings 的 env，看主機會不會自己壓、context 行那一句會不會消失" --body "來源：2026-10-12 的任務（docs/99-archive/2026-10-12-compact-window.md）。SBIR 工作區的 Desktop session 9916350f 從 450k 長到 629k，16 次 turn 結束都沒壓縮。量測（docs/90-agent/reports/2026-10-12-compact-window-probe.md）是 headless、haiku、用 shell 的環境變數：視窗 100000 時在 71k 到 75k 壓，200000 時在 165k 到 170k 壓，都在 turn 進行中。沒量的有三件。第一，變數寫在 ~/.claude/settings.json 的 env 時，Claude Desktop 啟動的 session 吃不吃得到，主機會不會在 420k 上下自己壓（transcript 出現 trigger 為 auto 的 compact_boundary）。第二，command hook 的行程看不看得到那個變數：有設而且過 400k 時，注入塊的 context 行不該有 No auto-compact window is set 那一句。第三，1M 視窗的模型在 450000 的實際觸發點。要做的：使用者在 settings 加上那個 env、重開 Desktop，開一個 fankeel 任務跑到過 400k，記下壓縮發生在多少、context 行有沒有那一句。完成條件：三件都看過並記在這裡；主機沒有壓，或那一句誤報，就改回 ready 並寫下差在哪。"
```

   If `todo.js` refuses, do not write the file by hand: report the refusal line.

2. The guide. In `docs/01-guide/profile.md`, in the paragraph on line 60, replace the sentence `你在全域關掉的自動壓縮，對沒有 fankeel task 的 session 維持關閉。` with:

```md
不想每個 session 按 Enable 的話，改用 Claude Code 自己的自動壓縮：在 `~/.claude/settings.json` 的 `env` 加上 `"CLAUDE_CODE_AUTO_COMPACT_WINDOW": "450000"`，重開 Claude Code。設了之後主機在 context 到大約視窗減 3 萬的地方自己壓，turn 進行中也壓，不用 mod、不用你打任何字；這個設定對每個 session 都生效，不只有 fankeel task 的。2026-10-12 在 headless 量過 100000 與 200000 兩個視窗（[量測](../90-agent/reports/2026-10-12-compact-window-probe.md)），450000 與 Claude Desktop 還沒在真機看過。沒有設而 context 到 400k 以上時，`context:` 行會多一句，請 Claude 轉告你去設或自己打 `/compact`。
```

3. Check that the sentence and the entry are there, then the two checks. The grep prints 1, and the list shows the new title:

```sh
grep -c "CLAUDE_CODE_AUTO_COMPACT_WINDOW" docs/01-guide/profile.md
node scripts/todo.js list | grep "Desktop 真機看壓縮視窗"
node scripts/todo-check.js 2>&1 | tail -3
node scripts/docs-check.js --role reference 2>&1 | tail -5
```

4. Commit `docs/01-guide/profile.md` and `docs/90-agent/todo/compact-4.md`:

```text
audit: the guide says how to set the auto-compact window, and Desktop waits as an entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
