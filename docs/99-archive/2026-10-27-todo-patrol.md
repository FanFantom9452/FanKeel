---
status: current
last_verified: 2026-10-27
source_of_truth: .fankeel/build/task-20261027T000808/survey.md
---

# TODO 全表盤點（2026-10-27）Implementation Plan

**Goal:** 把今天到期的三條量測與結案做完、兩條站台文件與樣式改完，並讓 fankeel 自己記下 5H／7D 額度讀數、可以畫成圖，不依賴 TokenBar。
**Architecture:** 量測沿用既有的 `scripts/sessions.js` 與 `lib/compare.js`，各加一個欄位；5H／7D 由 fankeel mod 的 pane tick 從 `$.session.usage().rateLimits` 取得，純函式在新檔 `hooks/pane-limits.ts`，寫入 `.fankeel/build/limits/<session>.jsonl`；新的 `scripts/limits.js` 把它讀回成表格或 SVG 圖。條目文字照 `scripts/todo.js` 的格式手改，結案留到 land 用 `todo.js done`。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴，CommonJS；`hooks/*.ts` 由 Claude Code mod 引擎載入，測試以 `import()` 直接載 `.ts`（見 `tests/pane-bar.test.js:7-8`）。
**Spec:** ../../../.fankeel/build/task-20261027T000808/survey.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:11-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交一組前跑 `suite.js --fast`。
- `.fankeel/map.md` — 計畫放 `docs/90-agent/plans/`；TODO 條目在 `docs/90-agent/todo/`（role `todo`），決策頁在 `docs/03-decisions/`，指南在 `docs/01-guide/`。
- `scripts/todo.js:6-10` — 子指令只有 `list | new | done | migrate`；重蓋日期沒有指令，手改條目 frontmatter 的 `stamp:` 行（第 9 行），時程在 `timing:` 行（第 8 行）。
- `lib/todo.js:80` — Blocked 的 `after:`／`upstream:` 在 `stamp` 滿 7 天（`REREAD_DAYS`）算到期；`on:` 到那天算到期。
- `hooks/pane-bar.ts:9` — `Limit = { kind: string; percentUsed: number; resetsAt?: string }`，`percentUsed` 是 0–100（`hooks/pane-bar.ts:165` 用 `gone * 100` 相減）。
- `hooks/pane.ts:67` 與 `:658` — `Logged` 的型別與初始值要一起加鍵，`logOnce` 只收 `keyof Logged`。
- `.fankeel/.gitignore` — `build/` 不進版控；限額記錄放 `.fankeel/build/limits/`，與 `hooks/mod.ts:45` 的 `build/spawn/` 同一層。
- 使用者這次 session 指示：5H／7D 記錄由 fankeel 自己支援，不依賴 TokenBar（`~/.claude/statusline.ps1` 與 `tokenbar-usage.jsonl` 都不碰）。

## Risks

- `$.fs.write` 不會自己建 `.fankeel/build/limits/` — Task 7 — 先看 `hooks/mod.ts:45` 寫 `build/spawn/` 前有沒有先建目錄；沒有就照抄同樣的做法。
- `tests/pane.test.js` 的假 `$` 沒有 `fs.write` 或 `clock.now` — Task 7 — `recordLimits` 整段包在 `try` 裡，先跑 `node --test tests/pane.test.js` 確認仍綠。
- 某個測試列舉 `scripts/` 或 `hooks/` 每個檔都要有文件或清單登記 — Task 7、Task 8 — 先 `grep -rln "readdirSync(.*scripts\|readdirSync(.*hooks" tests/`，有就照它的格式補登記。
- SBIR 舊 session 在 10-20 前開、沒重開 — Task 3 — `--since` 依檔案修改時間篩，舊 session 只要 10-20 後還有寫就會算進來；報告裡把峰值最高的檔名一起寫，讓人看得出是不是舊 session。
- 這一週的 transcript 被 `cleanupPeriodDays` 清掉 — Task 4 — 先 `ls ~/.claude/projects/*/ | head` 看 10-13 的檔還在不在；不在就把能比的範圍寫進條目。

## Task 1: 轉義條目寫回一週數字

**Files:**
- Modify: `docs/90-agent/todo/escape-1.md` — 檔尾加 10-27 的量測段落
- Modify: `docs/90-agent/todo/quota-2.md` — 新檔，由 `todo.js new --id quota-2` 寫出

**Interfaces:**
- Consumes: none
- Produces: none（結案在 land：`node scripts/todo.js done escape-1 --sha 64d9e5a6 --session <id>`）

**Dispatch:** implementer, sonnet — 文字都在 plan 裡，抄寫加檢查。

1. 跑 `node scripts/escape-scan.js --since 2026-10-19T17:24:00Z`，確認數字仍是 AskUserQuestion 2/1127、`__unparsedToolInput` 0、wrap_up 0/442；數字不同就用跑出來的數字寫下一步。

2. 在 `docs/90-agent/todo/escape-1.md` 檔尾（第 40 行那段之後）空一行加：

```md
2026-10-27 重量（以 2026-10-19T17:24Z、commit 64d9e5a6 落地時間切開，`node scripts/escape-scan.js --since 2026-10-19T17:24:00Z`）：AskUserQuestion 安靜錯字 2/1127（0.18%，修前 11/1161 即 0.95%）、`__unparsedToolInput` 0（修前 2）、wrap_up 0/442。兩項都比第 1 步少，完成條件成立，land 時結案。
```

3. 跑 `node scripts/todo-check.js`，輸出不能多出關於 `escape-1` 的新行。

4. 開一條 Ready 條目，讓額度差 4.7 倍與 quota.js 成功路徑兩條 Blocked 改讀 fankeel 自己的記錄：

```
node scripts/todo.js new --id quota-2 --label quota --title "quota.js 改讀 fankeel 的 limits 記錄" --description "quota.js 與 lib/quota.js 讀 TokenBar 的 tokenbar-usage.jsonl，改成讀 .fankeel/build/limits/*.jsonl，讓額度差 4.7 倍與 quota.js 成功路徑兩條 Blocked 不再等 TokenBar。" --state ready --link scripts/quota.js --body "來源：2026-10-27 TODO 全表盤點。使用者要求 5H／7D 記錄由 fankeel 自己支援、不依賴 TokenBar；這輪已讓 hooks/pane.ts 把 rateLimits 寫進 .fankeel/build/limits/<session>.jsonl，scripts/limits.js 能印表與畫圖。還沒做的是 lib/quota.js（:29 只收 seven_day_pct 為數字的行）改讀新格式的 seven 與 sevenResets 欄位，並把 quota-1、spend-2 的 timing 改成等新記錄累積。完成條件：quota.js 在 limits 記錄上跑出結果，兩條 Blocked 的 timing 不再提 TokenBar。"
```

5. 跑 `node scripts/todo-check.js`，新條目不能被列出任何問題。

## Task 2: 三條 Blocked 重蓋日期

**Files:**
- Modify: `docs/90-agent/todo/docs-1.md` — `stamp:` 改成今天
- Modify: `docs/90-agent/todo/foreign-1.md` — 同上
- Modify: `docs/90-agent/todo/model-4.md` — 同上

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 三行替換加檢查。

1. 跑 `node scripts/todo-check.js`，確認 `另一個專案先做流程圖`、`在別的專案跑一週`、`fast 可依 agent 設定` 三個時程列為 due。

2. `docs/90-agent/todo/docs-1.md`、`docs/90-agent/todo/foreign-1.md`、`docs/90-agent/todo/model-4.md` 三個檔的第 9 行都從 `stamp: 2026-10-19` 改成：

```md
stamp: 2026-10-27
```

（各一行；第 8 行 `timing:` 不動。survey 今天已逐條確認三個條件都還沒發生，model-4 的上游狀態沒有上網查，這點寫在 land 報告。）

3. 再跑 `node scripts/todo-check.js`，三個時程不再是 due。

## Task 3: SBIR 峰值量測

**Files:**
- Modify: `scripts/sessions.js` — `processFile` 多算 `maxStep`，輸出多 `maxPeak`、`maxStep`
- Modify: `docs/90-agent/todo/compact-7.md` — 寫回量測結果
- Test: `tests/sessions.test.js`

**Interfaces:**
- Consumes: none
- Produces: `processFile(file)` 回傳多一個 `maxStep: number`（相鄰兩次 assistant 請求 context 的最大增量）；`main()` 的 `out` 多 `maxPeak: number`、`maxStep: number`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 在 `tests/sessions.test.js` 檔尾加失敗的測試：

```js
test('maxPeak is the highest peak and maxStep the biggest rise between two requests', () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  writeTranscript(dir, 'a.jsonl', [
    { type: 'assistant', message: { usage: { input_tokens: 100 }, content: [] } },
    { type: 'assistant', message: { usage: { input_tokens: 400 }, content: [] } },
    { type: 'assistant', message: { usage: { input_tokens: 50 }, content: [] } },
  ]);
  writeTranscript(dir, 'b.jsonl', [{ type: 'assistant', message: { usage: { input_tokens: 900 }, content: [] } }]);
  const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'p'], { encoding: 'utf8' }));
  assert.equal(out.out.maxPeak, 900);
  assert.equal(out.out.maxStep, 300);
});
```

2. 跑 `node --test tests/sessions.test.js`，看新測試失敗。

3. 在 `scripts/sessions.js` 的 `let peakContext = 0;`（:89）下一行加：

```js
  // 一個回合：相鄰兩次主 session 請求之間 context 漲了多少，取最大。compact-7 用它判「compact.at 加一個回合」。
  let lastTotal = null;
  let maxStep = 0;
```

4. 在 `scripts/sessions.js` 的 `if (total > peakContext) peakContext = total;`（:110）下一行加：

```js
        if (lastTotal !== null && total - lastTotal > maxStep) maxStep = total - lastTotal;
        lastTotal = total;
```

5. 在 `scripts/sessions.js` 的 `return { size: stat.size, peakContext, ...`（:171）把 `peakContext,` 改成 `peakContext, maxStep,`，並在 `out` 的 `p90Peak:` 那行（:203）下一行加：

```js
    maxPeak: results.reduce((m, r) => Math.max(m, r.peakContext), 0),
    maxStep: results.reduce((m, r) => Math.max(m, r.maxStep), 0),
```

6. 跑 `node --test tests/sessions.test.js`，全綠。

7. 量 SBIR：

```
node scripts/sessions.js --project F--ymlab-SBIR-ProjectWorkspace --since 2026-10-20
```

8. 依結果在 `docs/90-agent/todo/compact-7.md` 檔尾空一行加一段，`<…>` 換成第 7 步的數字。`maxPeak <= 350000 + maxStep` 時寫：

```md
2026-10-27 重量（`node scripts/sessions.js --project F--ymlab-SBIR-ProjectWorkspace --since 2026-10-20`）：<totalSessions> 個 session，最高峰值 <maxPeak>、p90 <p90Peak>，最大單回合增量 <maxStep>；最高峰值沒超過 compact.at 350000 加一個回合，完成條件成立，land 時結案。
```

超過時，`docs/90-agent/todo/compact-7.md` 檔尾改寫成下面這段，並把第 8 行改成 `timing: on: 11-03`、第 9 行改成 `stamp: 2026-10-27`：

```md
2026-10-27 重量（`node scripts/sessions.js --project F--ymlab-SBIR-ProjectWorkspace --since 2026-10-20`）：<totalSessions> 個 session，最高峰值 <maxPeak>、p90 <p90Peak>，最大單回合增量 <maxStep>；最高峰值超過 compact.at 350000 加一個回合，未達完成條件。下次 11-03 重量，先查峰值最高的那個 session 是不是 10-20 前開、沒重開的。
```

## Task 4: 1h cache write 佔比量測

**Files:**
- Modify: `lib/compare.js` — `summary` 多算 `write1hShare`，`format` 多一列
- Modify: `docs/90-agent/todo/spend-6.md` — 寫回量測結果
- Test: `tests/usage-compare.test.js`

**Interfaces:**
- Consumes: none
- Produces: `summary(range, sessions)` 回傳多 `write1hShare: number`（0–1，1h cache write 美元除以該區間總美元）；`format` 多一列，標題 `1h cache write share of usd`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 在 `tests/usage-compare.test.js` 檔尾加失敗的測試：

```js
test('the 1h cache write share is its dollars over the range total', () => {
    const cfg = tmp('fankeel-compare-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    const W = { output_tokens: 1e6, cache_creation: { ephemeral_1h_input_tokens: 1e6 } }; // $10 + $4 on claude-sonnet-5
    fs.writeFileSync(path.join(dir, 'a1.jsonl'), assistant('r1', at(2026, 9, 2, 9), W));
    fs.writeFileSync(path.join(dir, 'b1.jsonl'), assistant('r2', at(2026, 9, 16, 9), { output_tokens: 1e6 }));
    const out = compare.format(compare.compare(cfg, compare.parseRange(A), compare.parseRange(B)));
    assert.match(out, /^1h cache write share of usd\s+29%\s+0%$/m);
});
```

2. 跑 `node --test tests/usage-compare.test.js`，看新測試失敗。

3. 在 `lib/compare.js` 的 `summary` 裡，`const models = {};` 那個迴圈之後、`return {` 之前加：

```js
    // 1h cache write 的美元，用 lib/prices.js 的費率；費率表沒有的 model 不算。spend-6 比的就是這個佔比。
    let write1h = 0;
    for (const s of inside) {
        for (const [id, m] of Object.entries(s.models)) {
            const r = prices.rateFor(id);
            if (r) write1h += m.cacheWrite1h * r.cacheWrite1h / 1e6;
        }
    }
```

並在 `lib/compare.js` 同一個 `return {` 的 `agentShare:` 那行下一行加：

```js
        write1hShare: usd ? write1h / usd : 0,
```

4. 在 `lib/compare.js` 的 `format` 裡，`['subagent share of usd', ...]` 那行下一行加：

```js
        ['1h cache write share of usd', pct(a.write1hShare), pct(b.write1hShare)],
```

5. 跑 `node --test tests/usage-compare.test.js`，全綠。

6. 量兩週：

```
node scripts/usage-compare.js --before 2026-10-13..2026-10-19 --after 2026-10-20..2026-10-26
```

7. 依結果在 `docs/90-agent/todo/spend-6.md` 檔尾空一行加一段，`<…>` 換成第 6 步的數字。after 欄比 before 欄低時寫：

```md
2026-10-27 重量（`node scripts/usage-compare.js --before 2026-10-13..2026-10-19 --after 2026-10-20..2026-10-26`）：1h cache write 佔總花費 <before>% → <after>%，總花費 $<before total> → $<after total>，subagent 佔比 <before agent>% → <after agent>%。方案是 10-20 落地的三項（agent 報告超過 3000 字退一次、跨 session 訊息超過 2000 字退回、「要離開」後在下一題停下壓縮），佔比下降，完成條件成立，land 時結案。
```

沒有下降時，`docs/90-agent/todo/spend-6.md` 檔尾改寫成下面這段，並把第 8 行改成 `timing: on: 11-03`、第 9 行改成 `stamp: 2026-10-27`：

```md
2026-10-27 重量（`node scripts/usage-compare.js --before 2026-10-13..2026-10-19 --after 2026-10-20..2026-10-26`）：1h cache write 佔總花費 <before>% → <after>%，總花費 $<before total> → $<after total>；佔比沒有下降，未達完成條件。下次 11-03 重量，先看主對話平均 context 有沒有變小。
```

## Task 5: 使用指南補板子編輯

**Files:**
- Modify: `docs/01-guide/station.md` — 第 38 行那段之後加一段講 gate 頁的板子編輯
- Modify: `docs/03-decisions/2026-10-20-task-boards-as-svg.md` — 第 17 行句尾加前向連結
- Read: `assets/station/board-edit.js` — 工具列與狀態列的中文字（:47-55、:58、:119、:255），不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 文字都在 plan 裡，抄寫加 docs-check。

1. 跑 `node scripts/docs-check.js`，記下現在的輸出。

2. 在 `docs/01-guide/station.md` 第 38 行那段之後（第 39 行空行之後、`## 從手機看` 之前）加一段，前後各留一個空行：

```md
停在 gate 時，關卡頁會把這個任務的第一塊板子畫在頁面裡，可以直接改。狀態列寫「session 停在 gate，可以編輯」；session 不在 gate 時是「唯讀：session 不在 gate」，只能看。工具列有選取、新增節點、新增連線、標記給 AI、刪除、復原：拖曳節點改位置，雙擊節點改名字，用「標記給 AI」在節點上留一句話請 AI 看。每一筆改動都列在板子下方，可以逐筆復原；一批改動整批套用或整批退回，會新增引用問題的那一批整批被拒。你在 Claude Desktop 回答這個 gate 時，改動和標記會一起附進答案。例子：雙擊 `parse` 節點、改成 `parse-csv`，下方會多一行「改名 parse：parse → parse-csv」，檢查列仍是「✓ 0 個問題」。
```

3. 在 `docs/03-decisions/2026-10-20-task-boards-as-svg.md` 第 17 行句尾（「不直接把 SVG 嵌進頁面。」之後）接上：

```md
gate 頁例外：停在 gate 的板子直接嵌進頁面讓人編輯，見 [2026-10-27 的決定](2026-10-27-gate-board-inline.md)。
```

4. 再跑 `node scripts/docs-check.js`，不能比第 1 步多出關於這兩個檔的行。

## Task 6: 拿掉 eyebrow 大寫字距與 .dead 邊條

**Files:**
- Modify: `assets/station/station.css:96-106` — `.dead`（:99-100）拿掉 `border-left`，`.eyebrow`（:106）拿掉大寫與字距
- Read: `tests/station-shell.test.js` — :163 的 class 清單仍列 `eyebrow`，不改
- Test: `tests/station-eyebrow.test.js`

**Interfaces:**
- Consumes: none
- Produces: none（`.eyebrow` 這個 class 保留，`tests/station-shell.test.js:163` 的清單不用動）

**Dispatch:** implementer, sonnet — 兩行 CSS 加一個測試檔。

1. 寫 `tests/station-eyebrow.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// station-59：.eyebrow 不再是大寫加字距的小標，.dead 不再有左側 3px 邊條。
const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('.eyebrow is not uppercase tracked text', () => {
    const rule = /(^|\n)\.eyebrow\{([^}]*)\}/.exec(css);
    assert.ok(rule, '.eyebrow rule missing');
    assert.doesNotMatch(rule[2], /text-transform:\s*uppercase|letter-spacing/);
});

test('.dead has no left accent bar', () => {
    const rule = /(^|\n)\.dead\{([^}]*)\}/.exec(css);
    assert.ok(rule, '.dead rule missing');
    assert.doesNotMatch(rule[2], /border-left/);
});
```

2. 跑 `node --test tests/station-eyebrow.test.js`，看兩個測試失敗。

3. 在 `assets/station/station.css` 第 100 行，把 `;border-left:3px solid var(--stale)}` 改成 `}`，整行變成：

```css
  padding:11px 32px;background:var(--stale-bg);color:var(--stale-ink)}
```

4. 在 `assets/station/station.css` 第 106 行，整行換成：

```css
.eyebrow{font-size:12px;color:var(--muted);font-weight:500}
```

5. 跑 `node --test tests/station-eyebrow.test.js tests/station-shell.test.js`，全綠。

## Task 7: fankeel 自己記下 5H／7D

**Files:**
- Modify: `hooks/pane.ts` — `look` 在 `contextOf` 之後呼叫 `recordLimits`；`Logged` 加 `limits` 鍵
- Modify: `hooks/pane-limits.ts` — 新檔：`limitRow`、`appendRow`、`LIMITS_MAX`
- Read: `hooks/compact.ts` — `isActive`（:26），不改
- Read: `hooks/pane-bar.ts` — `Limit` 型別（:9），不改
- Read: `hooks/mod.ts` — `$.fs.write` 寫 `build/spawn/` 的做法（:45），不改
- Test: `tests/pane-limits.test.js`

**Interfaces:**
- Consumes: none
- Produces: 每個 session 一個限額記錄檔（.fankeel/build/limits/ 底下，檔名是 session id 加 .jsonl），每行一個 `LimitRow` JSON：`{ at: string (ISO), task: string, stage: string, five: number|null, fiveResets: string|null, seven: number|null, sevenResets: string|null }`，`five`／`seven` 是 0–100；`limitRow(limits: Limit[], entry: { task?: unknown; stage?: unknown }, now: number, last: string): { row: LimitRow; key: string } | null`；`appendRow(text: string, row: object): string`；`LIMITS_MAX = 5000`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 寫 `tests/pane-limits.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-limits.ts')).href);
const NOW = Date.parse('2026-10-27T01:00:00.000Z');
const L = (five, seven) => [
    { kind: 'five_hour', percentUsed: five, resetsAt: '2026-10-27T05:00:00.000Z' },
    { kind: 'seven_day', percentUsed: seven, resetsAt: '2026-10-31T00:00:00.000Z' },
];
const E = { task: 'TODO 全表盤點', stage: 'build' };

test('a first reading is a row carrying both windows, the task and the stage', async () => {
    const { limitRow } = await load();
    const r = limitRow(L(12, 40), E, NOW, '');
    assert.deepEqual(r.row, { at: '2026-10-27T01:00:00.000Z', task: 'TODO 全表盤點', stage: 'build', five: 12, fiveResets: '2026-10-27T05:00:00.000Z', seven: 40, sevenResets: '2026-10-31T00:00:00.000Z' });
});

test('the same percentages and stage again are no row; a moved percentage or stage is', async () => {
    const { limitRow } = await load();
    const first = limitRow(L(12, 40), E, NOW, '');
    assert.equal(limitRow(L(12, 40), E, NOW + 60000, first.key), null);
    assert.ok(limitRow(L(13, 40), E, NOW + 60000, first.key));
    assert.ok(limitRow(L(12, 40), { task: E.task, stage: 'verify' }, NOW + 60000, first.key));
});

test('no five_hour and no seven_day reading is no row', async () => {
    const { limitRow } = await load();
    assert.equal(limitRow([], E, NOW, ''), null);
    assert.equal(limitRow([{ kind: 'seven_day_opus', percentUsed: 5 }], E, NOW, ''), null);
});

test('appendRow keeps the newest LIMITS_MAX rows', async () => {
    const { appendRow, LIMITS_MAX } = await load();
    let text = '';
    for (let i = 0; i < LIMITS_MAX + 3; i++) text = appendRow(text, { at: String(i) });
    const lines = text.trim().split('\n');
    assert.equal(lines.length, LIMITS_MAX);
    assert.equal(JSON.parse(lines[0]).at, '3');
});
```

2. 跑 `node --test tests/pane-limits.test.js`，看它因為找不到 `hooks/pane-limits.ts` 失敗。

3. 寫 `hooks/pane-limits.ts`：

```ts
import type { Limit } from './pane-bar.ts'

// The 5h and 7d readings over a task's life, so a chart can show how they moved:
// hooks/pane.ts appends one row to .fankeel/build/limits/<session>.jsonl each time
// either percentage or the stage changes, and scripts/limits.js reads it back.
// The source is the engine's own $.session.usage().rateLimits — nothing outside
// fankeel writes or is read here.
export const LIMITS_MAX = 5000

export type LimitRow = {
  at: string
  task: string
  stage: string
  five: number | null
  fiveResets: string | null
  seven: number | null
  sevenResets: string | null
}

function pick(limits: Limit[], kind: string): Limit | null {
  return limits.find((l) => !!l && l.kind === kind && typeof l.percentUsed === 'number' && Number.isFinite(l.percentUsed)) ?? null
}

// The row for this tick and its key, or null when neither window is reported or
// both percentages and the stage equal the ones in `last`, the key written before.
export function limitRow(limits: Limit[], entry: { task?: unknown; stage?: unknown }, now: number, last: string): { row: LimitRow; key: string } | null {
  const five = pick(limits, 'five_hour')
  const seven = pick(limits, 'seven_day')
  if (!five && !seven) return null
  const stage = String(entry.stage ?? '')
  const key = JSON.stringify([five ? five.percentUsed : null, seven ? seven.percentUsed : null, stage])
  if (key === last) return null
  return {
    key,
    row: {
      at: new Date(now).toISOString(),
      task: String(entry.task ?? ''),
      stage,
      five: five ? five.percentUsed : null,
      fiveResets: five?.resetsAt ?? null,
      seven: seven ? seven.percentUsed : null,
      sevenResets: seven?.resetsAt ?? null,
    },
  }
}

// `text` with `row` appended as one JSON line, the oldest dropped past LIMITS_MAX.
export function appendRow(text: string, row: object): string {
  const lines = text.split('\n').filter((l) => l.trim())
  lines.push(JSON.stringify(row))
  return lines.slice(-LIMITS_MAX).join('\n') + '\n'
}
```

4. 跑 `node --test tests/pane-limits.test.js`，全綠。

5. 在 `hooks/pane.ts` 頂端的 import 區，`import { say, langAt } from './pane-lang.ts'` 下一行加：

```ts
import { limitRow, appendRow } from './pane-limits.ts'
```

6. 在 `hooks/pane.ts` 第 67 行的 `type Logged` 裡，`lang: string` 之後加 `; limits: string`；第 658 行的初始值裡，`lang: ''` 之後加 `, limits: ''`。

7. 在 `hooks/pane.ts` 的 `contextOf`（:113）之前加：

```ts
// hooks/pane-limits.ts decides whether this tick is a new row; this writes it.
// Only while the session owns a task; a write that fails is said once and the tick goes on.
let lastLimits = ''
async function recordLimits($: EngineInterface, root: string, id: string, entry: Entry, limits: Limit[], logged: Logged): Promise<void> {
  if (!isActive(entry) || !limits.length) return
  try {
    const next = limitRow(limits, entry, await $.clock.now(), lastLimits)
    if (!next) return
    const file = `${root}/.fankeel/build/limits/${id}.jsonl`
    const text = (await $.fs.exists(file)) ? String(await $.fs.read(file)) : ''
    await $.fs.write(file, appendRow(text, next.row))
    lastLimits = next.key
  } catch (err) {
    logOnce($, logged, 'limits', `fankeel pane: limits row not written, ${String(err)}`)
  }
}
```

8. 在 `hooks/pane.ts` 的 `look` 裡，`const { context, limits } = await contextOf($, logged, found)`（:503）下一行加：

```ts
  await recordLimits($, found.root, id, entry, limits, logged)
```

9. 跑 `node --test tests/pane-limits.test.js tests/pane.test.js tests/mod-load.test.js`，全綠。

## Task 8: limits.js 讀回成表格與圖

**Files:**
- Modify: `scripts/limits.js` — 新檔：讀每個 session 的限額記錄檔，印表格或寫 SVG
- Modify: `docs/02-architecture/layout.md` — hooks 那一行登記 `hooks/pane-limits.ts`
- Modify: `docs/01-guide/profile.md` — band 那段補一句記錄與畫圖的方法
- Test: `tests/limits-script.test.js`

**Interfaces:**
- Consumes: Task 7 的 `LimitRow` 行格式（`at`、`task`、`stage`、`five`、`seven`）
- Produces: `node scripts/limits.js --session <id> [--root <dir>] [--task <name>] [--svg <file>]`；匯出 `readRows(file)`、`table(rows)`、`svg(rows)`、`main(argv): string`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 寫 `tests/limits-script.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const limits = require('../scripts/limits.js');
const tmp = require('./tmp.js');

function fixture(rows) {
    const root = tmp('fankeel-limits-');
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\nnot json\n');
    return root;
}
const R = (at, stage, five, seven, task) => ({ at, task: task || 'T', stage, five, seven });

test('the table lists every reading in order, an unparsable line skipped', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 10, 40), R('2026-10-27T02:00:00.000Z', 'build', 25.4, 41)]);
    const out = limits.main(['--session', 's1', '--root', root]).split('\n');
    assert.equal(out.length, 3);
    assert.match(out[1], /^2026-10-27T01:00:00\.000Z\s+survey\s+10%\s+40%$/);
    assert.match(out[2], /build\s+25%\s+41%$/);
});

test('--task keeps one task\'s readings; none is said, not an empty table', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 10, 40, 'A'), R('2026-10-27T02:00:00.000Z', 'build', 20, 41, 'B')]);
    assert.equal(limits.main(['--session', 's1', '--root', root, '--task', 'B']).split('\n').length, 2);
    assert.match(limits.main(['--session', 's1', '--root', root, '--task', 'C']), /^no readings in /);
});

test('--svg writes one polyline per window over a 0-100% axis', () => {
    const root = fixture([R('2026-10-27T01:00:00.000Z', 'survey', 0, 50), R('2026-10-27T03:00:00.000Z', 'build', 100, null)]);
    const file = path.join(root, 'chart.svg');
    assert.match(limits.main(['--session', 's1', '--root', root, '--svg', file]), /2 readings$/);
    const svg = fs.readFileSync(file, 'utf8');
    assert.equal((svg.match(/<polyline/g) || []).length, 2);
    assert.match(svg, /points="32\.0,208\.0 688\.0,32\.0"/);
});

test('no --session is a usage error', () => {
    assert.throws(() => limits.main([]), /usage: node scripts\/limits\.js/);
});
```

2. 跑 `node --test tests/limits-script.test.js`，看它因為找不到 `scripts/limits.js` 失敗。

3. 寫 `scripts/limits.js`：

```js
#!/usr/bin/env node
'use strict';
// The 5h and 7d readings hooks/pane.ts recorded for one session
// (.fankeel/build/limits/<session>.jsonl, rows from hooks/pane-limits.ts), as a
// table or an SVG chart — how the two windows moved while a task ran.
//
//   node scripts/limits.js --session <id> [--root <dir>] [--task <name>] [--svg <file>]
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const USAGE = 'usage: node scripts/limits.js --session <id> [--root <dir>] [--task <name>] [--svg <file>]';

function readRows(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
    }).filter((r) => r && typeof r.at === 'string');
}

const pct = (n) => (typeof n === 'number' ? n.toFixed(0) + '%' : '-');

function table(rows) {
    const out = ['at                        stage       5h    7d'];
    for (const r of rows) out.push(r.at.padEnd(26) + String(r.stage || '').padEnd(10) + pct(r.five).padStart(4) + '  ' + pct(r.seven).padStart(4));
    return out.join('\n');
}

// Two lines on one 0–100% axis over the rows' time span: 5h in orange, 7d in blue.
function svg(rows) {
    const W = 720, H = 240, P = 32;
    const ts = rows.map((r) => Date.parse(r.at));
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const x = (t) => P + (t1 > t0 ? (t - t0) / (t1 - t0) : 0) * (W - 2 * P);
    const y = (v) => H - P - (v / 100) * (H - 2 * P);
    const line = (key, color) => {
        const pts = rows.filter((r) => typeof r[key] === 'number').map((r) => x(Date.parse(r.at)).toFixed(1) + ',' + y(r[key]).toFixed(1));
        return pts.length ? `<polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.join(' ')}"/>` : '';
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
        + `<line x1="${P}" y1="${y(0)}" x2="${W - P}" y2="${y(0)}" stroke="#999"/>`
        + `<line x1="${P}" y1="${y(100)}" x2="${W - P}" y2="${y(100)}" stroke="#ddd"/>`
        + `<text x="2" y="${y(100) + 4}" font-size="11">100%</text><text x="2" y="${y(0) + 4}" font-size="11">0%</text>`
        + line('five', '#d9480f') + line('seven', '#1864ab')
        + `<text x="${P}" y="14" font-size="12" fill="#d9480f">5h</text><text x="${P + 30}" y="14" font-size="12" fill="#1864ab">7d</text>`
        + '</svg>\n';
}

function main(argv) {
    const { values } = parseArgs({ args: argv, options: { session: { type: 'string' }, root: { type: 'string' }, task: { type: 'string' }, svg: { type: 'string' } } });
    if (!values.session) throw new Error(USAGE);
    const file = path.join(values.root || process.cwd(), '.fankeel', 'build', 'limits', values.session + '.jsonl');
    let rows = readRows(file);
    if (values.task) rows = rows.filter((r) => r.task === values.task);
    if (!rows.length) return 'no readings in ' + file;
    if (values.svg) {
        fs.writeFileSync(values.svg, svg(rows));
        return values.svg + ' — ' + rows.length + ' readings';
    }
    return table(rows);
}

if (require.main === module) {
    try {
        process.stdout.write(main(process.argv.slice(2)) + '\n');
    } catch (err) {
        process.stderr.write(err.message + '\n');
        process.exit(1);
    }
}

module.exports = { readRows, table, svg, main };
```

4. 跑 `node --test tests/limits-script.test.js`，全綠。

5. 在 `docs/02-architecture/layout.md` 的 hooks 那一行，把 `pane-shell.ts (the Pane's background-shell list) and pane-lang.ts` 換成：

```md
pane-shell.ts (the Pane's background-shell list), pane-limits.ts (each change of the 5h or 7d percentage, or of the stage, appended as one row to .fankeel/build/limits/<session>.jsonl and read back by scripts/limits.js) and pane-lang.ts
```

6. 在 `docs/01-guide/profile.md` 把「兩行左邊的色條變紅。」換成：

```md
兩行左邊的色條變紅。2026-10-27 起，任務進行中 `5h` 或 `7d` 的百分比每變一次、或換了站，`hooks/pane.ts` 就在 `.fankeel/build/limits/<session id>.jsonl` 記一行；`node scripts/limits.js --session <id>` 印成表，加 `--svg <檔名>` 畫成兩條線的圖。讀數來自引擎，不需要 TokenBar。
```

7. 跑 `node scripts/docs-check.js`，不能多出關於這兩個檔的行。

## Task 9: 真瀏覽器截圖、互動與真機看

**Files:**
- Modify: `.fankeel/build/task-20261027T000808/levelmark.board` — 從 `tests/fixtures/levelmark.board` 複製，不進版控
- Modify: `docs/90-agent/todo/build-15.md` — 寫回截圖路徑與互動結果
- Modify: `docs/90-agent/todo/station-59.md` — 寫回真機看過的結果
- Read: `.fankeel/build/2026-10-27-board-upgrade/mockup.html` — 比對用，不改

**Interfaces:**
- Consumes: none（使用者任務，`ledger.js hands` 列出，在其他任務都提交後才做）
- Produces: none

**Dispatch:** user — 拖曳、雙擊改名、標記、復原要人手在真 gate 頁上做，真手機要使用者自己看；subagent 做不到。

1. 在 build 的 gate 前，把板子 fixture 放進這個任務的 build 目錄：

```
cp tests/fixtures/levelmark.board .fankeel/build/task-20261027T000808/levelmark.board
```

2. 這個 session 停在 build 的 gate 時，拍兩個寬度：

```
FANKEEL_BROWSER="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/render.js http://127.0.0.1:28888/f/77484d1a-1260-4edb-9870-6239d9de1cd2/gate --out .fankeel/build/task-20261027T000808/gate-412 --size 412,900
FANKEEL_BROWSER="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/render.js http://127.0.0.1:28888/f/77484d1a-1260-4edb-9870-6239d9de1cd2/gate --out .fankeel/build/task-20261027T000808/gate-1440 --size 1440,900
```

3. 使用者在同一頁上依序做：拖曳一個節點、雙擊一個節點改名、對一個節點「標記給 AI」、按「復原」一次；說出每一步看到的結果。拿兩張截圖對照 mockup 的工具列、圖例與改動清單。

4. 使用者用手機開 https://sh-pro6000.tail8f801f.ts.net/m 與桌面站台，確認 eyebrow 小標不再是大寫字距、過期提示列沒有左側邊條。

5. 把結果各寫一段到檔尾。`docs/90-agent/todo/build-15.md`：

```md
2026-10-27 真瀏覽器：gate 頁兩個寬度的截圖在這個任務 build 目錄的 gate-412 與 gate-1440 兩個子目錄（各一張 render.png）；拖曳、改名、標記、復原各走一遍，結果照使用者說的寫在這行之後。
```

`docs/90-agent/todo/station-59.md`：

```md
2026-10-27 使用者在真機與桌面看過：eyebrow 不再是大寫字距、過期提示列沒有左側邊條。
```

## Coverage

| promise | task |
|---|---|
| escape-1（寫回證據並結案） | Task 1 |
| compact-7（量一週峰值） | Task 3 |
| spend-6（量 1h write 佔比） | Task 4 |
| docs-10 使用指南補板子編輯 | Task 5 |
| build-15 gate 板子面板缺真截圖 | Task 9 |
| station-59 station 拿掉 eyebrow 邊條 | Task 6, Task 9 |
| waiting on 的重蓋日期 | Task 2 — 只有 stamp 滿 7 天的三條；其餘五條 stamp 未滿 7 天，不到期 |
| 5H／7D 變化記錄加圖表（使用者在 survey gate 加的，並指示不依賴 TokenBar） | Task 7, Task 8 |
| station-56 手機版 /m 走 design | struck — 使用者選下一輪另開任務 |
| tune-8 接 Desktop 選取元素 | struck — 使用者選另開 bounded 任務試做 |
| station-52 拆 station.js | struck — 使用者選排下一個任務 |
| entry-4、station-58 | struck — survey 判超出這輪名額，留下一輪 |
