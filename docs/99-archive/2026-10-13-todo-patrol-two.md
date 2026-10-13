---
status: current
---

# TODO 全表盤點（10-13 第二輪）：commit.js 提交搬過家的檔、逐塊調整托盤載入就展開 Implementation Plan

**Goal:** 做完 10-13 第二輪盤點放行的兩條（commit-4、tune-5），並把今天對得到證據的五條 Blocked 重新蓋章。
**Architecture:** Task 1 讓 `scripts/commit.js` 在 `git add` 之前先把「index 記著已刪除或已改名、工作目錄也沒有」的路徑從 add 的清單拿掉，
它們仍留在 `commit -o` 的清單裡，所以區塊同時列舊路徑與新路徑時提交出來是一筆改名；主流程與 `worktree` 區塊兩處都用同一個 helper。
Task 2 讓 `assets/tune/overlay.js` 載入完成時呼叫既有的 `toggleTray(true)`，托盤一開頁面就在。Task 3、Task 4 蓋章並補索引列。Task 5 是使用者真機開一次頁面。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.56.0.windows.2，fankeel 0.103.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261012T213553/survey.md)

## Global Constraints

由 `node scripts/map.js`（859 份 markdown、19 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。本計畫不動 `lib/`。
- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。行號是本計畫寫成時（commit cd8fe940）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- 寫成時的通過數：`tests/commit.test.js` 33、`tests/tune-overlay.test.js` 27，都是 0 fail。
- `scripts/commit.js` 的每個失敗都經過 `fail()` 回 `code: 1`，`git add` 失敗那一條已由 `tests/commit.test.js:113` 的測試釘住；本計畫不改 exit code。
- `assets/tune/overlay.js` 自己的元素 class 一律 `fk-live-` 開頭；它是直接塞進頁面的 script，不用 ES module 語法、用 `var`。
- 縮排四格（`scripts/commit.js`、`assets/tune/overlay.js`、兩個測試檔都是）。行尾 LF（`.gitattributes`）。檔案用 Edit／Write 改，不用 heredoc。
- 文件頁每行不超過 160 欄（`node scripts/docs-check.js`）；新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。
- TODO 條目在 `docs/90-agent/todo/`；改完跑 `node scripts/todo-check.js`，exit 0。`stamp` 是有人讀過 timing 並同意它仍成立的那一天。
- 實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 這台機器跑全套前要設 `FANKEEL_BROWSER` 為 chrome.exe 的完整路徑，否則 14 個 render 測試會在 Edge 上失敗。

## Risks

- `git mv` 之後又改了內容的檔，`git add` 會把新內容重新暫存，相似度掉到門檻下就不再是改名而是一刪一增 — Task 1 —
  測試在 `git mv` 前先把 `a.txt` 寫回 `a1\n`，斷言的是內容沒變的改名（`R100`）；內容改很多的搬家提交成一刪一增是 git 的行為，不是這裡要修的。
- 已暫存刪除的路徑若又在工作目錄被重建成新檔，使用者列它是要提交新內容 — Task 1 — 只有「在 `gone` 裡而且磁碟上沒有」才略過 add，磁碟上有就照舊 add。
- 托盤載入就展開後，`tests/tune-overlay.test.js` 有 13 個測試先呼叫 `t.openTray()`，會變成把托盤收起來 — Task 2 —
  第 1 步先把 `openTray` 改成只在收著時才點；另有兩個測試直接斷言初始是收著的，第 2、3 步改寫。
- 每次改寫完成頁面都會 `location.reload()`，托盤每次都重新展開，使用者收合過也一樣；沒有記住收合狀態 — Task 2 — 沒有做，plan 的 gate 說出這一題；
  Task 5 使用者若嫌擋畫面，另開條目。
- `skills/fankeel-design/SKILL.md:137` 寫標誌「opens a tray」，載入就展開後這句仍成立（標誌仍是開合的鈕），沒有改 — Task 2 — verify 的文件檢查再看一次。
- Task 5 用的 `.fankeel/build/2026-10-13-pane-colour/mockup.html` 在被 git 忽略的目錄裡，可能已被清掉，7819 也可能被佔 — Task 5 —
  session 起伺服器前先確認檔案在、port 沒被佔；不在就換任何一頁有 `data-block` 的 mockup。
- land 會照 registry 的 `todo` 欄印出七行 `todo.js done`，其中只有 commit-4 該關；tune-5 不在那一欄卻在 Task 5 通過後該關 — land —
  land 只執行 commit-4 那一行，Task 5 使用者說找得到入口才另外為 tune-5 跑一行；其餘六條真機條目不關。

## Task 1: 區塊列到已暫存刪除或改名的舊路徑時，commit.js 照樣提交

**Files:**
- Modify: `scripts/commit.js` — 新 helper `stagedGone`；主流程與 `landWorktree` 兩處的 `git add` 改成略過它點名、磁碟上又沒有的路徑；`module.exports` 加上它
- Test: `tests/commit.test.js`

**Interfaces:**
- Consumes: none
- Produces: `stagedGone(statusLines: string[]): Set<string>`，由 `scripts/commit.js` 匯出

**Dispatch:** implementer, sonnet

1. Write the failing tests。在 `tests/commit.test.js` 裡，緊接在
   `test('a staged rename is committed whole: the old path rides along with the new one', ...)` 那個測試結束的 `});` 之後加入：

```js
test('stagedGone names a rename\'s old side and a staged deletion, and nothing else', () => {
    assert.deepEqual([...commit.stagedGone(['R100\ta.txt\ta2.txt', 'D\tb.txt', 'M\tc.txt', 'A\td.txt', ''])], ['a.txt', 'b.txt']);
});

// commit-4: archive.js lists both sides of its `git mv`. The old side is in
// neither the working tree nor the index, so `git add` has nothing to match.
test('a block listing both sides of a staged rename commits one rename', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a1\n');
    execFileSync('git', ['mv', 'a.txt', 'a2.txt'], { cwd: dir });
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\na2.txt\n\nfeat: rename a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, before + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'show', '--name-status', '-M', '--format=', 'HEAD'), 'R100\ta.txt\ta2.txt');
    assert.equal(git(dir, 'status', '--porcelain'), 'M b.txt');
});

test('a block listing a path removed with git rm commits the deletion', () => {
    const dir = repo();
    execFileSync('git', ['rm', '-qf', 'b.txt'], { cwd: dir });
    const res = commit.main([requestFile('b.txt\n\nfeat: drop b\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'show', '--name-status', '--format=', 'HEAD'), 'D\tb.txt');
});

test('a worktree block listing both sides of a staged rename lands one rename', () => {
    const { dir, wt } = worktreeRepo();
    execFileSync('git', ['mv', 'b.txt', 'b2.txt'], { cwd: wt });
    const res = commit.main([requestFile('worktree ' + wt + '\nb.txt\nb2.txt\n\nfeat: rename b\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'show', '--name-status', '-M', '--format=', 'HEAD'), 'R100\tb.txt\tb2.txt');
    assert.equal(git(dir, 'status', '--porcelain'), '');
});
```

   `git()` 這個測試 helper 會 `.trim()` 輸出，所以 `status --porcelain` 的 ` M b.txt` 讀回來是 `M b.txt`。

2. 跑 `node --test tests/commit.test.js`，看它失敗：第一個是 `commit.stagedGone is not a function`，其餘三個的 `res.text` 是
   `commit.js: git add failed: fatal: pathspec ... did not match any files`。四個都紅才往下。

3. Write the helper。在 `scripts/commit.js` 裡，緊接在 `foldRenames` 函式結束的 `}` 之後加入：

```js
// `git diff --cached -M --name-status` lines again: the paths `git add`
// cannot be handed. A rename's old side and a staged deletion are in neither
// the working tree nor the index, so `add` matches nothing and fails the
// whole block; `commit -o` still takes them, and has to.
function stagedGone(statusLines) {
    const gone = new Set();
    for (const line of statusLines) {
        const m = /^(?:D|R\d*)\t([^\t]+)/.exec(line);
        if (m) gone.add(m[1]);
    }
    return gone;
}
```

4. Write the main-path change。在 `scripts/commit.js` 的 `main` 裡，把這兩行（寫成時是 277-278，下一行 `if (add.status !== 0) return fail(...)` 不動）：

```js
        const renamed = git(['diff', '--cached', '-M', '--name-status']);
        const add = git(['add', '--'].concat(paths));
```

   在 `scripts/commit.js` 改成：

```js
        const renamed = git(['diff', '--cached', '-M', '--name-status']);
        const staged = renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : [];
        const gone = stagedGone(staged);
        // A path recreated on disk after its deletion was staged is still added.
        const toAdd = paths.filter((p) => !gone.has(p) || fs.existsSync(path.resolve(topDir, p)));
        const add = toAdd.length ? git(['add', '--'].concat(toAdd)) : { status: 0 };
```

   並把 `scripts/commit.js` 其後的

```js
        const withOld = foldRenames(paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
```

   在 `scripts/commit.js` 改成：

```js
        const withOld = foldRenames(paths, staged);
```

5. Write the worktree change。在 `scripts/commit.js` 的 `landWorktree` 裡，把（寫成時是 137-138）：

```js
    const renamed = here(['diff', '--cached', '-M', '--name-status']);
    const add = here(['add', '--'].concat(block.paths));
```

   在 `scripts/commit.js` 改成：

```js
    const renamed = here(['diff', '--cached', '-M', '--name-status']);
    const staged = renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : [];
    const gone = stagedGone(staged);
    const toAdd = block.paths.filter((p) => !gone.has(p) || fs.existsSync(path.resolve(wt, p)));
    const add = toAdd.length ? here(['add', '--'].concat(toAdd)) : { status: 0 };
```

   並把 `scripts/commit.js` 同一個函式裡的

```js
    const withOld = foldRenames(block.paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
```

   在 `scripts/commit.js` 改成：

```js
    const withOld = foldRenames(block.paths, staged);
```

6. 在 `scripts/commit.js` 檔尾把 `module.exports` 那一行改成：

```js
module.exports = { main, foldRenames, formatMiss, stagedGone, stagedModes };
```

7. 跑 `node --test tests/commit.test.js`：37 pass、0 fail（33 加 4）。數字不合就以實跑的為準並在回報裡說。
8. 回報要提交的路徑 `scripts/commit.js`、`tests/commit.test.js`，訊息主旨
   `fix: commit.js commits a block that lists a renamed file's old path`，內文一行一檔說改了什麼。

## Task 2: 逐塊調整的托盤載入就展開

**Files:**
- Modify: `assets/tune/overlay.js` — 檔尾載入完成時呼叫 `toggleTray(true)`；檔頭註解改成托盤載入就展開
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/tune-overlay.test.js` 的 `loadOverlay` 裡，把：

```js
    t.openTray = () => { t.press(5, 5); t.release(); };
```

   在 `tests/tune-overlay.test.js` 改成（13 個測試先呼叫它，托盤已展開時不能把它點收）：

```js
    t.openTray = () => { if (t.tray.hidden) { t.press(5, 5); t.release(); } };
```

2. Write the failing test。在 `tests/tune-overlay.test.js` 裡，緊接在
   `test('a plain press and release of the logo toggles the tray and aria-expanded, once, and a keyboard click does too', ...)` 之前加入：

```js
// tune-5: a first-time reader never noticed the logo in the corner, so the
// tray is there when the page loads and the logo is what folds it.
test('a freshly loaded page shows the tray open, and the logo says it folds', () => {
    const t = loadOverlay();
    assert.equal(t.tray.hidden, false, 'the tray is folded behind the logo on load');
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    assert.ok(t.ast.classList.contains('fk-live-open'));
    assert.match(t.logo.getAttribute('aria-label'), /點一下收合$/);
});
```

3. `tests/tune-overlay.test.js` 裡有兩個測試斷言的是「初始收著」，改成「初始展開」。
   把 `a plain press and release of the logo toggles the tray ...` 那個測試的函式本體整個換成：

```js
    const t = loadOverlay();
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    t.press(5, 5);
    t.release();
    t.fire(t.logo, 'click', { detail: 1 });
    assert.equal(t.tray.hidden, true);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false');
    t.press(5, 5);
    t.release();
    t.fire(t.logo, 'click', { detail: 1 });
    assert.equal(t.tray.hidden, false);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    t.fire(t.logo, 'click', { detail: 0 });
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false');
    t.press(5, 5, 7);
    t.release(8);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false', 'another pointer\'s release must not toggle');
```

   再把 `tests/tune-overlay.test.js` 裡 `dragging the logo moves it, ... the click that ends a drag does not open the tray` 那個測試裡的這兩行：

```js
    assert.equal(t.tray.hidden, true, 'the click that ends a drag opened the tray');
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false');
```

   在 `tests/tune-overlay.test.js` 改成：

```js
    assert.equal(t.tray.hidden, false, 'the click that ends a drag folded the tray');
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
```

4. 跑 `node --test tests/tune-overlay.test.js`，看它失敗：新測試、以及第 3 步改寫的兩個，共三個紅，訊息是托盤 `hidden` 為 `true`。其餘照舊綠。

5. Write the implementation。在 `assets/tune/overlay.js` 檔尾，把：

```js
    load();
    settlePos();
    draw();
    refreshQueue();
```

   在 `assets/tune/overlay.js` 改成（`toggleTray` 自己會 `settlePos()` 與 `draw()`）：

```js
    load();
    // Open on load: a first-time reader has to see where to start.
    toggleTray(true);
    refreshQueue();
```

6. 在 `assets/tune/overlay.js` 檔頭的註解裡，把 `click it to open the tray of drafted` 那一句改成說托盤載入就展開、點標誌是收合與再展開，保持每行寬度與上下文一致：

```js
// (the spot is kept in localStorage); the tray of drafted changes is open
// when the page loads, and a click on the logo folds or reopens it.
```

   這兩行取代原本的 `// (the spot is kept in localStorage), click it to open the tray of drafted` 與下一行開頭的 `// changes.`，
   該行 `changes.` 之後的 `新增一則 starts picking: ...` 另起一行接下去，內容不變。

7. 跑 `node --test tests/tune-overlay.test.js`：28 pass、0 fail（27 加 1）。有別的測試因為托盤初始展開而紅，就在回報裡點名哪一個、斷言了什麼，不要改實作去遷就。
8. 回報要提交的路徑 `assets/tune/overlay.js`、`tests/tune-overlay.test.js`，訊息主旨 `feat: the tune tray is open when the page loads`。

## Task 3: 今天對得到證據的三條 Blocked 重新蓋章（effort-1、foreign-1、session-2）

**Files:**
- Modify: `docs/90-agent/todo/effort-1.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/90-agent/todo/foreign-1.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/90-agent/todo/session-2.md` — `stamp:` 改成 2026-10-13
- Read: `.fankeel/build/task-20261012T213553/survey.md` — 每條 timing 查了什麼（第 23-38 行）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一個 shell 呼叫做完整個 task，派出去比做還貴。

1. 這三條是盤點在這台機器上拿得到證據的：effort-1（`brief-3.md` 仍是 `state: ready`）、foreign-1（reports 下沒有 foreign-week 報告）、
   session-2（`git log scripts/drive.js` 只有 fake-spawn 的提交）。跑：

```sh
sed -i 's/^stamp: .*/stamp: 2026-10-13/' docs/90-agent/todo/effort-1.md docs/90-agent/todo/foreign-1.md docs/90-agent/todo/session-2.md
```

2. 跑 `grep -n '^stamp' docs/90-agent/todo/effort-1.md docs/90-agent/todo/foreign-1.md docs/90-agent/todo/session-2.md`（三行都是
   `stamp: 2026-10-13`）與 `node scripts/todo-check.js`（exit 0）。

## Task 4: 另外兩條 Blocked 重新蓋章（stage-agents-10、stage-agents-16），並為本計畫補索引列

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-10.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/90-agent/todo/stage-agents-16.md` — `stamp:` 改成 2026-10-13
- Modify: `docs/README.md` — 本計畫的索引列

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一個 shell 呼叫與一列索引做完整個 task，派出去比做還貴。

1. 這兩條也拿得到證據：stage-agents-10（reports 裡只有 10-10 巡檢提到 no verdict）、stage-agents-16（`git grep -w scriptPath` 在 lib、scripts、hooks
   無結果）。跑：

```sh
sed -i 's/^stamp: .*/stamp: 2026-10-13/' docs/90-agent/todo/stage-agents-10.md docs/90-agent/todo/stage-agents-16.md
```

2. 在 `docs/README.md` 裡 `TODO 全表盤點（10-13）的 plan` 那一列之前加一列，路徑是 `docs/90-agent/plans/2026-10-13-todo-patrol-two.md`，
   說明寫「TODO 全表盤點（10-13 第二輪）的 plan：commit.js 提交搬過家的檔、逐塊調整托盤載入就展開」，狀態照同表其他未落地的 plan 的寫法。
3. 跑 `node scripts/todo-check.js`（exit 0）與 `node scripts/docs-check.js`（不點名這三個檔）。

verify 推翻了 stage-agents-10 這一半：它等的是「no verdict 再發生一次」，那會出現在逐字稿而不是報告裡，
而且提到 no verdict 的報告有三份、不是第 1 步寫的一份。grep 報告撐不起新的章，所以它的 `stamp:` 退回 2026-10-12；stage-agents-16 與索引列不變。

## Task 5: 使用者不經說明開一次頁面，看找不找得到入口

沒有測試看得到真的瀏覽器。這個 task 是使用者的，沒有程式，也沒有任何派出去的 task 依賴它。

**Files:**
- Modify: `docs/90-agent/todo/tune-5.md` — 使用者看過之後，session 在內文末尾補一句看到了什麼與日期
- Read: `.fankeel/build/2026-10-13-pane-colour/mockup.html` — 開的頁面

**Interfaces:**
- Consumes: Task 2 落地後的浮層
- Produces: none

**Dispatch:** user — session 起伺服器並給網址，使用者開頁面、說一眼看不看得出從哪裡開始；沒有 subagent 能替人判斷顯不顯眼。

session 先做：確認 `.fankeel/build/2026-10-13-pane-colour/mockup.html` 還在、7819 沒被佔，然後在專案根目錄把下面這行放背景，把網址加上 `mockup.html` 給使用者：

```sh
node scripts/tune.js serve .fankeel/build/2026-10-13-pane-colour --port 7819
```

使用者做（開 `http://127.0.0.1:7819/mockup.html`）：

1. 頁面一開，右下角應該直接看到展開的托盤「修改項」，裡面有「新增一則」與「全部送出（0 則）」。
2. 點一下 fankeel 標誌，托盤收起；再點一下，回來。
3. 重新整理頁面，托盤仍是展開的。

使用者回一句：一開頁面看不看得出從哪裡開始、托盤有沒有擋到要看的東西，或「可以」。session 把那句話和日期寫進 `docs/90-agent/todo/tune-5.md` 內文末尾；
說「可以」才在 land 關 tune-5，擋畫面或仍找不到就另開條目，不在這個 task 裡修。

## Coverage

| promise | task |
|---|---|
| commit-4 — 開了 scripts/commit.js:277-284：`git add -- <paths>` 在區塊列了搬家前的舊路徑時整塊失敗；目前沒有測試 — do now | Task 1（主流程與 worktree 區塊；exit code 已是 1 且已有測試，不另補） |
| tune-5 — 開了 assets/tune/overlay.js:242-251，托盤 `hidden`，只剩右下角標誌 — needs the user（決定在 gate） | Task 2（使用者選了載入時預設展開）、Task 5（真機看一次） |
| brief-3、compact-4、pane-1、pane-2、pane-6、tune-4 — needs the user（真機） | struck — 使用者自己做，沒有任務；land 不關它們 |
| stage-agents-8 — 真正阻擋是 project≠cwd 的受控 build 從未跑過 — needs the user | struck — 要一次受控 build，這一輪沒有；條目不動 |
| effort-1、foreign-1、session-2 — waiting on；restamp | Task 3 |
| stage-agents-10、stage-agents-16 — waiting on；restamp | Task 4 蓋了 stage-agents-16；stage-agents-10 struck — verify 推翻，章退回 2026-10-12 |
| quota-1 — waiting on 7d 重置後的資料；restamp | struck — 上一輪盤點已蓋 2026-10-13，不必再蓋 |
| audit-1、docs-1、security-1 — waiting on；restamp | struck — 等的是 repo 外的事，盤點在這台機器上核對不了；stamp 是有人讀過並同意的那一天，不蓋新章，沒有一條到期 |
| build-1、model-4 — waiting on；restamp | struck — 要連網才查得到 knip 與 claude 的上游，reader 沒查；不蓋新章，沒有一條到期 |
| spend-2、stage-agents-5 — waiting on；restamp | struck — 今天沒有新證據，只有條目自己的敘述；不蓋新章，沒有一條到期 |
| Watch 全部 keep，沒有一筆滿 60 天 | struck — 沒有事件發生，不動 |
