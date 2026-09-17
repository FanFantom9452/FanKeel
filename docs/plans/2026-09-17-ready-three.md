---
status: design-intent
---

# TODO.md `## Ready` 三條 Implementation Plan

**Goal:** 清空 `TODO.md` 的 `## Ready`：`tests/memory-check.test.js` 改用 `tests/tmp.js` 並加守衛，另外兩條移回 `## Needs a decision`。

**Architecture:** 兩個 task，都改 `TODO.md`，所以前後排。Task 1 是程式加測試，順便刪掉它自己交付的那條；Task 2 只動 `TODO.md` 的另外兩條。兩個都在 session 內做。

**Tech Stack:** Node.js，`node --test`，零執行期相依。

**Spec:** [2026-09-17-ready-three-design.md](2026-09-17-ready-three-design.md)

## Global Constraints

從 `package.json`、`CONTRIBUTING.md`、`.fankeel/map.md`、`scripts/todo-check.js` 與測試套件取得，值照抄：

- 測試指令是 `npm test`，展開為 `node --test`（`package.json`）。`package.json` 沒有 `dependencies` 也沒有 `devDependencies`，**不得新增任何相依**。
- 本計畫不新增測試檔，也不新增 export。
- 測試要暫存目錄一律經由 `tests/tmp.js` 的 `tmp(prefix)`（`tests/tmp.js:27`，`function tmp(prefix) {`）。
- 文件歸檔照 `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/decisions` 是 decision、`docs/reports` 與 `docs/judgements` 是 report、`docs/archive` 是 archive、`skills` 與 `agents` 是 reference、`evals` 是 fixture。`docs/archive/`、`docs/decisions/`、`docs/reports/`、`docs/judgements/` **不得編輯內容**。
- 新增的頁要在同一個 change 補 `docs/README.md` 索引列。本計畫與它的 design 兩列在 plan 階段已經補上。
- `TODO.md` 每條上限 `MAX_ENTRY_CHARS = 200`（`scripts/todo-check.js:48`，`const MAX_ENTRY_CHARS = 200;`），以 `entry.text.replace(/\s+/g, ' ').trim().length` 計。只有三個標題：`const SECTIONS = ['Ready', 'Needs a decision', 'Waiting'];`（`scripts/todo-check.js:60`）。
- 基準是 `de63636`，porcelain 空，`npm test` 為 `ℹ pass 1475`、`ℹ fail 0`，存於 `.fankeel/build/2026-09-17-ready-three/baseline.txt`。收尾時是 1476。
- 暫存與證據放 `.fankeel/build/2026-09-17-ready-three/`（git-ignored），不放 scratchpad。證據檔開頭寫 HEAD 與 porcelain。
- `npm test` 的輸出先存檔，再用 `grep -E '^ℹ (tests|pass|fail)'` 讀；spec reporter 沒有 `ok`／`not ok` 行。exit code 從未經 pipe 的那次執行取。
- Commit 用 `git commit -o <paths>`，訊息 `fix:`／`docs:` 開頭、繁體中文，結尾加 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`。不 push。

## Task 1: memory-check 的暫存目錄交給 `tests/tmp.js`

**Files:**
- Modify: `tests/memory-check.test.js` — `tmpProject()`、`tmpConfig()` 改呼叫 `tmp(prefix)`，拿掉 `require('node:os')`
- Modify: `TODO.md` — 刪掉 `## Ready` 第 1 條
- Read: `tests/tmp.js` — `tmp(prefix)` 與它在 process exit 時的清理
- Test: `tests/tmp.test.js`

**Interfaces:**
- Consumes: `tmp(prefix: string) → string`，`tests/tmp.js` 的 `module.exports = tmp;`
- Produces: none

**Dispatch:** in-session — 兩個 helper 的內文加一支測試，派工的 system prompt 加 brief 比改動本身大。

1. 寫失敗的測試。在 `tests/tmp.test.js` 檔尾加入：

```js
test('no test file but tests/tmp.js takes a scratch directory with mkdtemp', () => {
  // memory-check.test.js was written after this helper existed, under a plan
  // whose constraints said to use it, and leaked 22 directories a run.
  const self = path.basename(__filename);
  const offenders = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'tmp.js' && f !== self)
    .filter((f) => fs.readFileSync(path.join(__dirname, f), 'utf8').includes('mkdtemp'));
  assert.deepEqual(offenders, []);
});
```

2. 跑它，看它失敗：

```
node --test tests/tmp.test.js > .fankeel/build/2026-09-17-ready-three/t1-red.out 2>&1; echo "exit=$?"
grep -E '^ℹ (pass|fail)|memory-check' .fankeel/build/2026-09-17-ready-three/t1-red.out
```

預期 `exit=1`、`ℹ fail 1`，訊息裡有 `'memory-check.test.js'`。

3. 最小實作。在 `tests/memory-check.test.js`，刪掉第 6 行 `const os = require('node:os');`，在 `const cp = require('node:child_process');` 之後加一行 `const tmp = require('./tmp.js');`，並把 `:14-19` 換成：

```js
function tmpProject() {
  return tmp('fankeel-memcheck-project-');
}
function tmpConfig() {
  return tmp('fankeel-memcheck-config-');
}
```

4. 跑兩支，看它們通過：

```
node --test tests/tmp.test.js tests/memory-check.test.js > .fankeel/build/2026-09-17-ready-three/t1-green.out 2>&1; echo "exit=$?"
grep -E '^ℹ (tests|pass|fail)' .fankeel/build/2026-09-17-ready-three/t1-green.out
```

預期 `exit=0`、`ℹ tests 19`、`ℹ fail 0`：`tmp.test.js` 原本 3 支加 1，`memory-check.test.js` 15 支。

5. 量目錄。與基準同一段計數，前後各印一次，單跑 `memory-check.test.js`：

```
B=.fankeel/build/2026-09-17-ready-three
CNT="const fs=require('fs'),os=require('os');const d=fs.readdirSync(os.tmpdir());const n=function(p){return d.filter(function(x){return x.startsWith(p)}).length};console.log('memcheck-project='+n('fankeel-memcheck-project-')+' memcheck-config='+n('fankeel-memcheck-config-')+' fankeel-*='+n('fankeel-'))"
{ echo "HEAD $(git rev-parse HEAD)"; git status --porcelain; node -e "$CNT"; node --test tests/memory-check.test.js > $B/t1-mc.out 2>&1; echo "exit=$?"; node -e "$CNT"; } > $B/t1-count.txt 2>&1; cat $B/t1-count.txt
```

預期前後兩行的三個數字完全相同。其中 4 個目錄是 `git init` 過的 repo，這一步也證明 `rmSync` 在 Windows 上刪得掉它們。

6. 刪掉 `TODO.md` `## Ready` 的第 1 條（以 `- 〔test〕` 開頭、含 `漏 22 個暫存目錄` 的那一行）與它下方的空行。

7. `node scripts/todo-check.js; echo "exit=$?"`，預期 `exit=0`，印 `38 entries — 2 ready, 25 needs a decision, 11 waiting`。

8. Commit：

```
git commit -o tests/tmp.test.js tests/memory-check.test.js TODO.md -m "fix: memory-check 的暫存目錄交給 tests/tmp.js，加守衛擋直接 mkdtemp" -m "<紅綠兩次的 ℹ 行與 t1-count.txt 的前後兩行>" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git show --stat HEAD
```

預期 `--stat` 恰好列出這三個檔。

## Task 2: 兩條移出 Ready

**Files:**
- Modify: `TODO.md` — `## Ready` 第 2 條併入 `## Needs a decision` 的 `section-loading.md:73` 那條，第 3 條改寫後移到 `## Needs a decision` 最後，init 選單那條 `25 條` 改 `26 條`
- Read: `docs/station.md` — `:627-630` 的原文，新條目引它
- Read: `scripts/todo-check.js` — `MAX_ENTRY_CHARS` 與長度算法

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — same reason as Task 1，而且新條目的措辭要照 survey 在這個 session 裡讀到的原文寫。

1. 先確認現況是紅的：

```
node scripts/todo-check.js | grep -F '0 ready, 26 needs a decision'; echo "grep exit=$?"
```

預期 `grep exit=1`：Task 1 之後是 `2 ready, 25 needs a decision`。

2. 在 `TODO.md` 刪掉 `## Ready` 剩下的兩條（`- 〔docs〕兩條引用指到不相干的內容` 與 `- 〔station〕session 詳情頁沒有 profile 卡` 開頭的兩行）與它們下方的空行。`## Ready` 標題保留，底下留一個空行。

3. 在 `TODO.md` 的 `## Needs a decision` 裡，含 `2026-09-10-section-loading.md:73` 的那一行整行換成：

```md
- 〔docs〕report 區三條引用指錯，但該區寫完不改：`section-loading.md:73` 引的測試比事故晚一週，`total-budget.md:34`、`process-state-review.md:123` 指到無關內容 — [docs/documents.md](docs/documents.md). 待決：改頁、加勘誤頁、還是放著。
```

4. 在 `TODO.md` 的 `## Needs a decision` 最後一條（`- 〔profile〕` 開頭）之後、`## Waiting` 之前，隔一個空行加入：

```md
- 〔station〕session 詳情頁沒有 profile 卡是刻意的：`docs/station.md:627-630` 記著原設計放在 detail pane、plan 的 Task 8 搬進 registry 卡 — [docs/station.md](docs/station.md). 待決：加回 session 頁，還是維持現狀並刪掉這條。
```

5. 在 `TODO.md` 的 `- 〔todo〕` 那條（含 `25 條但 init 選單`）把 `25` 改成 `26`。

6. 跑檢查，看它通過：

```
node scripts/todo-check.js > .fankeel/build/2026-09-17-ready-three/t2-todo.out 2>&1; echo "exit=$?"
head -n 1 .fankeel/build/2026-09-17-ready-three/t2-todo.out
node scripts/docs-check.js > .fankeel/build/2026-09-17-ready-three/t2-docs.out 2>&1; echo "exit=$?"
```

預期 todo-check `exit=0`，第一行 `fankeel todo-check: 37 entries — 0 ready, 26 needs a decision, 11 waiting.`，沒有 `too long`；docs-check `exit=0`。

7. 全套件，前後數目錄。`CNT` 與 Task 1 第 5 步同一段：

```
B=.fankeel/build/2026-09-17-ready-three
CNT="const fs=require('fs'),os=require('os');const d=fs.readdirSync(os.tmpdir());const n=function(p){return d.filter(function(x){return x.startsWith(p)}).length};console.log('memcheck-project='+n('fankeel-memcheck-project-')+' memcheck-config='+n('fankeel-memcheck-config-')+' fankeel-*='+n('fankeel-'))"
{ echo "HEAD $(git rev-parse HEAD)"; git status --porcelain; node -e "$CNT"; npm test > $B/t2-full.out 2>&1; echo "npm test exit=$?"; grep -E '^ℹ (tests|pass|fail)' $B/t2-full.out; node -e "$CNT"; } > $B/t2-full.txt 2>&1; cat $B/t2-full.txt
```

預期 `npm test exit=0`、`ℹ pass 1476`、`ℹ fail 0`，前後兩行計數完全相同。

8. Commit：

```
git commit -o TODO.md -m "docs: Ready 剩下兩條各帶一個待決，移回 Needs a decision" -m "<兩條各自的理由：c0eac43 與 docs/station.md:627-630>" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git show --stat HEAD
```

預期 `--stat` 只列 `TODO.md`。

## Coverage

| promise | task |
|---|---|
| `tests/memory-check.test.js` 的 `tmpProject()`（`:14`）與 `tmpConfig()`（`:17`）改呼叫 `tmp(prefix)`，prefix 不變。 | Task 1 |
| `tests/tmp.test.js` 加一支守衛：`tests/` 底下除了 `tmp.js` 與 `tmp.test.js` 本身，沒有任何 `.js` 檔含 `mkdtemp` 這個字。 | Task 1 |
| 守衛只認 `mkdtemp` 這個字。自己用 `os.tmpdir()` 拼路徑再 `mkdirSync` 的寫法抓不到 | Task 1 — 範圍的界線，測試只比對這個字 |
| 刪掉 `TODO.md` `## Ready` 的第 1 條。 | Task 1 |
| 第 2 條併進 `## Needs a decision` 既有的 `section-loading.md:73` 那條 | Task 2 |
| 第 3 條移到 `## Needs a decision` 最後，改寫成待決 | Task 2 |
| `## Needs a decision` 裡 init 選單那條的 `25 條` 改 `26 條`。 | Task 2 |
| `docs/station.md:618` 那句 `No session view carries a **profile** card` 不動 | Task 2 — 只讀 `docs/station.md`，不列 Modify |
| 守衛抓得到直接呼叫的 `mkdtemp` | Task 1 |
| memory-check 不再留下目錄 | Task 1 |
| 整個套件不再留下目錄 | Task 2 — 第 7 步 |
| Ready 清空、兩條進待決 | Task 2 |
| 沒弄壞既有的東西 | Task 2 — 第 7 步 |
