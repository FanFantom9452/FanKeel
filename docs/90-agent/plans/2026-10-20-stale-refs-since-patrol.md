---
status: design-intent
---

# 舊引用、escape-scan --since 接時間、盤點不誤標已落地條目 Implementation Plan

**Goal:** docs-check 不再報三筆舊引用，escape-scan 的 `--since` 能切在一個時間點，盤點不再把內文已說落地的條目標成 `do now`。
**Architecture:** 三個互不相關的小修，各自一個任務、各自一組，沒有共用檔案。
**Tech Stack:** Node >=22.5（`package.json` 的 `engines`），`node:test`，不加依賴。
**Spec:** ../../../.fankeel/build/task-20261019T203217/design.md

## Global Constraints

- 不加依賴、`hooks/` 下不加新檔、不加新的產生檔名（`CONTRIBUTING.md:36`）。
- JS 縮排四格，`'use strict';` 開頭，照 `scripts/escape-scan.js` 現有寫法。
- 每個 SKILL.md 有自己的位元組上限（`tests/skill-size.test.js` 的 `CAPS`），長過上限要在同一個改動裡把上限調成新大小以上最小的 100 倍數。
- 提交：`type: what changed` 60 字以內，每個改動一行 `- <what changed> — <module>`。

## Risks

- `lib/stages.js` 行號在本計畫執行前又被別的 session 移動 — Task 1 — 先用 `node scripts/docs-check.js` 看它報的現行行號，以它為準。
- `skills/fankeel-survey/SKILL.md` 只剩 80 位元組空間 — Task 3 — 加句後跑 `tests/skill-size.test.js`，上限照算式調成 23700。

## Task 1: 三筆舊引用

**Files:**
- Modify: `agents/fankeel-brain.md` — 第 147 行的舉例路徑換成 repo 裡真的有的檔
- Modify: `docs/90-agent/reference/subagents.md` — 第 597 行 `lib/stages.js:717` 改 `:718`
- Modify: `docs/90-agent/todo/model-3.md` — 第 12 行 `lib/stages.js:702` 改 `:703`
- Read: `lib/stages.js` — 第 703 行帶 `model: opus`，第 718 行是 `const raw = values && values['stage.agents'];`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 三處逐字替換，計畫已寫出新字串。

1. Run `node scripts/docs-check.js`，看到 `3 references that no longer resolve`，三筆就是上面那三個檔。
2. In `agents/fankeel-brain.md`, line 147 holds the x.py example pair; replace that whole line with this one, in `agents/fankeel-brain.md`:

```md
  them, never to a directory above it: `tests/escape-scan.test.js`, not `<repo>/tests/escape-scan.test.js`.
```

3. In `docs/90-agent/reference/subagents.md`, line 597, replace `` `lib/stages.js:717` `` with `` `lib/stages.js:718` ``; the quoted `const raw = values && values['stage.agents'];` stays.
4. In `docs/90-agent/todo/model-3.md`, line 12, replace `` `lib/stages.js:702` `` with `` `lib/stages.js:703` ``.
5. Run `node scripts/docs-check.js` and `node scripts/todo-check.js`：前者不再有 `no longer resolve` 那段，後者乾淨。
6. Commit：`docs: three stale references point at the current lines`.

## Task 2: escape-scan 的 --since 接時間

**Files:**
- Modify: `scripts/escape-scan.js` — 第 11 行的用法註解、USAGE 與 `main()` 的 `--since` 檢查
- Test: `tests/escape-scan.test.js`

**Interfaces:**
- Consumes: none
- Produces: `main(['--since', '<YYYY-MM-DD | ISO time with Z or ±HH:MM>'])`，其他形式回 `{ code: 2 }`

**Dispatch:** implementer, sonnet — 一條 regex 與一個測試，程式碼在計畫裡。

1. In `tests/escape-scan.test.js`, after the `--since drops older lines` test, add:

```js
test('--since takes an ISO time with a zone and cuts inside one day; a time with no zone is refused', () => {
    const dir = config();
    const later = main(['--config-dir', dir, '--since', '2026-10-19T09:00Z']);
    assert.equal(later.code, 0);
    assert.match(later.text, /^ {2}AskUserQuestion\s+2\s+2\s+1\s+50\.00%$/m);
    assert.match(later.text, /, since 2026-10-19T09:00Z$/m);
    const after = main(['--config-dir', dir, '--since', '2026-10-19T19:00+08:00']);
    assert.match(after.text, /^ {2}AskUserQuestion\s+0\s+0\s+0\s+-$/m);
    const none = main(['--config-dir', dir, '--since', '2026-10-19T11:00Z']);
    assert.match(none.text, /^ {2}AskUserQuestion\s+0\s+0\s+0\s+-$/m);
    assert.equal(main(['--config-dir', dir, '--since', '2026-10-19T09:00']).code, 2);
    assert.equal(main(['--config-dir', dir, '--since', '2026-13-45T09:00Z']).code, 2);
});
```

   (`NEW` is `2026-10-19T10:00:00.000Z`: 09:00Z keeps it, 19:00+08:00 is 11:00Z and drops it.)
2. Run `node --test tests/escape-scan.test.js`，新測試失敗（`2026-10-19T09:00Z` 回 2）。
3. In `scripts/escape-scan.js`, replace the USAGE line with:

```js
const USAGE = 'escape-scan.js: usage: escape-scan.js [--config-dir <dir>] [--since <YYYY-MM-DD | YYYY-MM-DDTHH:MM[:SS]Z | ...±HH:MM>]';
```

3b. In `scripts/escape-scan.js`, line 11, replace the header comment's `[--since <YYYY-MM-DD>]` with `[--since <YYYY-MM-DD | ISO time with Z or ±HH:MM>]`.
4. In `scripts/escape-scan.js`, in `main()`, replace the `--since` check with:

```js
    const since = parsed.values.since;
    const shape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
    if (since !== undefined && !(shape.test(since) && Number.isFinite(Date.parse(since)))) return { text: USAGE + ': --since is a date, or a time with Z or an offset', code: 2 };
```

5. Run `node --test tests/escape-scan.test.js`，全過。
6. Commit：`feat: escape-scan --since takes a time with a zone`.

## Task 3: 盤點不把已落地的條目標成 do now

**Files:**
- Modify: `skills/fankeel-survey/SKILL.md` — `**Ready and Needs a decision.**` 段加一句
- Modify: `tests/skill-size.test.js` — `fankeel-survey` 上限 23500 改 23700
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一句規則、一個上限、一個斷言，全部寫在計畫裡。

1. In `tests/skills.test.js`, at the end of the file, add:

```js
// 2026-10-20: a patrol marked 工具參數中文寫成轉義 `do now` while its body
// said the work had landed and only the one-week re-measure was left.
test('the patrol reads an entry body that says it landed as waiting, not do now', () => {
  assert.match(read('fankeel-survey'), /its last dated record: one that says its work landed and only a later re-measure or event is left is `waiting on` that date or event/);
});
```

2. Run `node --test tests/skills.test.js`，新測試失敗。
3. In `skills/fankeel-survey/SKILL.md`, replace

```md
do-now ones as the next stage. Every Ready entry still true and buildable in this session is `do now`. The
```

with this, in `skills/fankeel-survey/SKILL.md`:

```md
do-now ones as the next stage. Every Ready entry still true and buildable in this session is `do now`. Read an entry's body to its last dated record: one that says its work landed and only a later re-measure or event is left is `waiting on` that date or event, and moves to Blocked under `on:` or `after:` — never `do now`. The
```

4. In `tests/skill-size.test.js`, in `CAPS`, replace `'fankeel-survey': 23500,` with `'fankeel-survey': 23700,`.
5. Run `node --test tests/skills.test.js tests/skill-size.test.js`，全過。
6. Commit：`fix: the patrol files a landed entry as waiting, not do now`.

## Coverage

| promise | task |
|---|---|
| `agents/fankeel-brain.md:147` 的舉例路徑 `tests/x.py` 改成 docs-check 不當成真路徑的寫法 | Task 1 |
| `docs/90-agent/reference/subagents.md:597` 的 `lib/stages.js:717` 改成目前那行 | Task 1 |
| `docs/90-agent/todo/model-3.md:12` 的 `lib/stages.js:702` 改成目前帶 `model: opus` 那行的行號 | Task 1 |
| `scripts/escape-scan.js` 的 `--since` 接受 `YYYY-MM-DD`，也接受帶 `Z` 或 `±HH:MM` 時差的 ISO 時間 | Task 2 |
| 沒帶時區的時間（例如 `2026-10-19T17:24`）與 Date.parse 解不出來的字串一樣被拒絕 | Task 2 |
| `tests/escape-scan.test.js` 加一個案例：同一天兩筆紀錄，以帶時間的 `--since` 切開 | Task 2 |
| `skills/fankeel-survey/SKILL.md` 的 `**Ready and Needs a decision.**` 段加一句：讀條目 body 到最後一段有日期的紀錄；body 自己說工作已落地、只剩日後重量或觀察的，處置是 `waiting on <日期或事件>` | Task 3 |
| 一個測試斷言這句規則在 SKILL.md 裡，現在會失敗；SKILL.md 的位元組上限測試仍要過。 | Task 3 |
| docs-check 不再報這三筆 | Task 1 |
| 帶時間的 --since 切得開同一天 | Task 2 |
| 盤點規則存在 | Task 3 |
