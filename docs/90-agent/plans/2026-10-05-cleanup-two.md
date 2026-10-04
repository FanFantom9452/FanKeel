---
status: design-intent
---

# cleanup-2 的前兩項：fetchHealth 改用 fetch、profile.js 改用 blame.js 的 git Implementation Plan

**Goal:** 做完 TODO 條目 cleanup-2 的第一項與第二項：`lib/serve.js` 的 `fetchHealth` 改用全域 `fetch` 加 `AbortSignal.timeout`（先證明它不會拖住短命的 hook 行程），`lib/profile.js` 自己的 `git` 輔助函式刪掉、改用 `lib/blame.js` 匯出的 `git`；兩項都在條目裡劃掉，第三、四項留著。
**Architecture:** 兩個 task 的程式檔互不相交，但都改 `docs/90-agent/todo/cleanup-2.md`，所以 `ledger.js ready` 會先送 Task 1、再送 Task 2。Task 1 只換 `fetchHealth`；`scripts/security-local.js` 的 `post` 不改，理由寫進條目（見 Risks）。Task 2 把 `lib/profile.js` 第 10 行的 require 原地換掉、刪掉 335-342 行，再把 `docs/01-guide/profile.md` 引用 342 行之後的三個行號各減 8。不重蓋章、不動 model-3 與 stage-agents-14（使用者在 survey 關卡的裁定）。
**Tech Stack:** Node v24.9.0（undici 7.16.0；CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies，也沒有 `engines`），`node --test`，git 2.44.0.windows.1，fankeel 0.96.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261004T164626/survey.md)

## Global Constraints

由 `node scripts/map.js`（551 份 markdown、11 份 planned 未建、214 份 retired）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json`、`.gitattributes` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`lib/profile.js` require `./blame.js` 是 lib 對 lib，允許。
- Hooks 每條路徑都 exit 0（`CONTRIBUTING.md:17`）；`hooks/inject.js:170` 經 `ensureServe` 呼叫 `fetchHealth`，所以 `fetchHealth` 不可留下讓 hook 行程結束不了的東西。
- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。實作者只跑自己 task 寫明的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`lib/serve.js` 202 行、`lib/profile.js` 544 行，都在上限內。行號是本計畫寫成時（commit 5f342fbd）的行號；實作者照每一步引的原文（錨點）找位置。
- 縮排：`lib/`、`tests/serve.test.js`、`tests/profile.test.js` 都是四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc（heredoc 吃反斜線）。
- 文件裡帶引文的 `path:line` 要在那一行找得到引文：改完跑 `node scripts/docs-check.js`，照它印的 `— it is at :N` 改，它點名本 task Files 以外的檔就停下來回報。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目內文至少 200 字、`description` 連同 label 與 link 至多 200 字；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目不寫 `path:line`。本計畫不關 cleanup-2（第三、四項還在），也不改任何條目的章。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`。

## Risks

- 全域 `fetch` 的 keep-alive 可能讓閒置 socket 留著 ref，拖住呼叫 `fetchHealth` 的 hook 行程 — Task 1 — 先寫一個開子行程探測、量它多久自己結束的測試，並用一個故意留住 socket 的對照證明這個測試抓得到；換成 `fetch` 後這個測試紅了，就把 `lib/serve.js` 還原，條目改記測得的毫秒數，不做這一項。
- `scripts/security-local.js` 的 `post` 若也改 `fetch`，undici 的 `headersTimeout` 預設 300 秒（undici Client 文件的預設值，我沒有在本 repo 內量過），ollama 以 `stream: false` 生成超過五分鐘就會被切斷；現在的 `http.request` 沒有這個上限 — Task 1 — `post` 不改，原因寫進條目；這個取捨放在 plan 關卡讓使用者推翻。
- `lib/profile.js` 刪掉 8 行，會位移 `docs/01-guide/profile.md:58` 引用的 `lib/profile.js:424-428`、`:442`、`:447` — Task 2 — 第 10 行原地替換（不增減行數），所以 343 行以前的引用（`docs/90-agent/reference/subagents.md` 的 `:39`、`:163`-`:172`、`:208`）不動；342 行之後的三個各減 8，再跑 docs-check。已關的條目（cleanup-1、profile-2）與 `docs/99-archive`、`docs/90-agent/plans` 裡的舊行號是歷史紀錄，不改。
- `lib/blame.js` 的 `git` 多帶 `maxBuffer: 8 * 1024 * 1024`（`lib/blame.js:14`），profile.js 原本用預設的 1 MB — Task 2 — 只會讓大 repo 的 `git log` 不再因輸出過長而回 `null`，失敗時同樣回 `null`（`lib/blame.js:20-22`），既有的 `suggest` 測試（`tests/profile.test.js:63`、`:172`、`:191`）照原樣過。

## Task 1: fetchHealth 改用全域 fetch，先證明不拖住 hook 行程

**Files:**
- Modify: `lib/serve.js` — `fetchHealth` 改用 `fetch` 加 `AbortSignal.timeout`，刪掉不再用的 `node:http` require
- Modify: `docs/90-agent/todo/cleanup-2.md` — 劃掉第一項，記下 `post` 不改的原因
- Test: `tests/serve.test.js`
- Read: `hooks/inject.js` — 第 170 行附近經 `ensureServe` 呼叫 `fetchHealth`，這就是要保護的短命行程
- Read: `scripts/security-local.js` — `post` 用 `http.request`、沒有逾時，本 task 不改它

**Interfaces:**
- Consumes: none
- Produces: `fetchHealth(record, timeoutMs)` 簽名與回傳不變：`Promise<object | null>`。`probe`、`ensureServe` 照原樣呼叫它。

**Dispatch:** implementer, sonnet

1. 在自己的 worktree 跑 `git reset --hard <build agent 給的 sha>`。

2. 寫測試。在 `tests/serve.test.js` 裡，找到 `test('probe is true only for a listener naming the recorded pid, and false for a gone pid, another pid, or silence'` 這個測試結尾的 `});`，在它後面空一行加上（`LIB`、`listener`、`spawn` 都已在這個檔裡定義或 require）：

```js
// A hook calls fetchHealth and then has to exit on its own
// (hooks/inject.js, through ensureServe): whatever the request leaves
// behind must not hold the process open. The listener keeps an idle
// connection for Node's default 5 s and undici's client keeps one 4 s, so
// a referenced idle socket shows up as a child that takes seconds rather
// than a fraction of one.
test('a process that probes a station exits on its own, with no idle socket holding it open', async () => {
    const mine = await listener({ pid: process.pid });
    try {
        const script = "require(process.argv[1]).probe({ pid: Number(process.argv[2]), url: process.argv[3] }, 2000).then((ok) => { process.stdout.write(String(ok)); });";
        const began = Date.now();
        const out = await new Promise((resolve) => {
            const child = spawn(process.execPath, ['-e', script, LIB, String(process.pid), mine.url]);
            let text = '';
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', (c) => { text += c; });
            const kill = setTimeout(() => child.kill(), 15000);
            child.on('close', () => { clearTimeout(kill); resolve(text); });
        });
        const took = Date.now() - began;
        assert.equal(out, 'true', 'the child reached the station');
        assert.ok(took < 3000, 'the child exited on its own: ' + took + ' ms');
    } finally {
        await mine.close();
    }
});
```

3. 跑 `node --test tests/serve.test.js`，全綠（舊的 `http.get` 加 `agent: false` 本來就不留 socket，這個測試在改之前就該過）。

4. 對照：證明這個測試抓得到留住的 socket。在步驟 2 的 `script` 字串最前面暫時加上 `require('node:net').connect(Number(new URL(process.argv[3]).port), '127.0.0.1'); `，跑 `node --test tests/serve.test.js`，新測試要紅，訊息是 `the child exited on its own:` 加上約 15000 ms。記下那一行，然後把加的那段刪掉，回到步驟 2 的原文。對照沒紅就停下來回報 BLOCKED，貼出輸出。

5. 改實作。在 `lib/serve.js`，刪掉 `const http = require('node:http');` 這一行（這個檔只有 `fetchHealth` 用它）。再把從 `// The shared fetch behind \`probe\` and \`ensureServe\`'s staleness check:` 開始、到 `function fetchHealth(record, timeoutMs) {` 那個函式結尾的 `}` 為止的整段（註解六行加函式），換成：

```js
// The shared fetch behind `probe` and `ensureServe`'s staleness check:
// `null` for a pid the OS denies, a timeout, a connection error, a status
// other than 200, or a body that is not JSON; the parsed body otherwise,
// unchecked against what the caller expected it to say. `timeoutMs` bounds
// the whole request, body included, as `probe` always has. Global fetch
// leaves no idle socket holding a short-lived hook process open: the test
// that spawns a probing child is what says so.
function fetchHealth(record, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 500;
    if (!record || typeof record.url !== 'string' || !live.running(record.pid)) return Promise.resolve(null);
    return fetch(record.url + 'station/health', { signal: AbortSignal.timeout(ms) })
        .then((res) => res.text().then((text) => (res.status === 200 ? JSON.parse(text) : null)))
        .catch(() => null);
}
```

   這段在 `lib/serve.js` 裡；非 200 也讀完 body，是為了不留一條沒讀完的連線。

6. 跑 `node --test tests/serve.test.js`，全綠。若只有步驟 2 的新測試紅（子行程超過 3000 ms），就是 keep-alive 拖住了行程：把 `lib/serve.js` 用 Edit 還原成步驟 5 之前的樣子（`git diff lib/serve.js` 要變空），新測試留著（它對舊實作同樣成立），步驟 7 改用第二種寫法，回報 DONE_WITH_CONCERNS 並貼出那一行毫秒數。

7. 改條目。在 `docs/90-agent/todo/cleanup-2.md`：
   - `description:` 那一行刪掉 `fetchHealth 改用 fetch、` 這幾個字（步驟 6 還原了就不刪）。
   - 內文把 `一、lib/serve.js 的 fetchHealth 與 scripts/security-local.js 的 post 改用全域 fetch 加 AbortSignal.timeout，先驗證 keep-alive 不會拖住短命的 hook 行程（hooks/inject.js 會呼叫 fetchHealth），驗不過就不做。` 整句換成下面第一種；步驟 6 還原了就換成第二種，`<N>` 填測得的毫秒數：

```md
（fetchHealth 已在 2026-10-05 改用全域 fetch，子行程探測後自己結束的測試守著它。scripts/security-local.js 的 post 不改：全域 fetch 的 undici 預設 headersTimeout 是 300 秒，ollama 以 stream: false 生成超過五分鐘會被切斷，http.request 沒有這個上限。）
```

第二種（步驟 6 還原時用），寫進 `docs/90-agent/todo/cleanup-2.md`：

```md
一、fetchHealth 改用 fetch：2026-10-05 驗過，探測的子行程 <N> 毫秒才結束，keep-alive 會拖住 hook 行程，不做；post 同樣不改（undici 預設 headersTimeout 300 秒會切斷 ollama 的長回應）。
```


8. 跑 `node scripts/todo-check.js`（exit 0）與 `node scripts/docs-check.js`（`Every reference resolves.`）。

9. 回報要提交的路徑 `lib/serve.js`、`tests/serve.test.js`、`docs/90-agent/todo/cleanup-2.md`，訊息 `refactor: fetchHealth uses global fetch, guarded by a probing-child exit test`（還原時改成 `test: a probing child exits on its own; fetchHealth stays on http.get`），以及步驟 4 對照紅的那一行與步驟 6 的結果行。

## Task 2: profile.js 改用 blame.js 匯出的 git

**Files:**
- Modify: `lib/profile.js` — 第 10 行 require 原地替換，刪掉 335-342 行的 `git` 與其後空行
- Modify: `docs/01-guide/profile.md` — 第 58 行三個 `lib/profile.js` 行號各減 8
- Modify: `docs/90-agent/todo/cleanup-2.md` — 劃掉第二項、改標題
- Read: `lib/blame.js` — `git(dir, args)` 匯出於 `module.exports`，失敗回 `null`
- Read: `tests/profile.test.js` — 第 63、172、191 行的 `suggest` 測試是這次重構的護欄，不改

**Interfaces:**
- Consumes: `git(dir, args)` from `lib/blame.js` → `string | null`（stdout，失敗或不是 repo 時 `null`）
- Produces: none（`lib/profile.js` 的匯出不變）

**Dispatch:** implementer, sonnet

1. 在自己的 worktree 跑 `git reset --hard <build agent 給的 sha>`。跑 `node --test tests/profile.test.js`，記下全綠的結果行，這是重構前的基準。

2. 確認 `execFileSync` 在 `lib/profile.js` 只有 `git` 用：`grep -n execFileSync lib/profile.js` 只該印第 10 行與 `git` 函式裡那一行。多出別處就停下來回報 BLOCKED。

3. 在 `lib/profile.js`，把第 10 行 `const { execFileSync } = require('node:child_process');` 原地換成下面這一行（行數不變，所以 343 行以前的行號引用都不動）：

```js
const { git } = require('./blame.js');
```

4. 在 `lib/profile.js`，刪掉 `function git(cwd, args) {` 開頭的整個函式（七行，到單獨一行的 `}` 為止）連同它後面那一個空行，共 8 行。刪完後，`// What the history already answers:` 這行註解的前面是一個空行、再前面是上一個函式的 `}`。

5. 跑 `node --test tests/profile.test.js`，全綠，與步驟 1 的結果行同數。

6. 在 `docs/01-guide/profile.md` 第 58 行，把 `lib/profile.js:424-428` 改成 `lib/profile.js:416-420`、`lib/profile.js:442` 改成 `lib/profile.js:434`、`lib/profile.js:447` 改成 `lib/profile.js:439`。改完用 `sed -n '416,420p;434p;439p' lib/profile.js` 核對：416-420 是 `// Why \`lean\` hands every stage to a stage agent` 那段註解，434 是 `balanced` 的 `set:` 行（含 `'stage.agents': 'survey,build,verify'`），439 是 `lean` 的 `set:` 行（含 `'stage.agents': 'all'`）。不符就照實際行號改並在回報裡說明。

7. 在 `docs/90-agent/todo/cleanup-2.md`：
   - `title:` 那一行的 `cleanup-1 剩下的四項可刪項` 改成 `cleanup-1 剩下的可刪項`。
   - `description:` 那一行刪掉 `profile.js 的 git、` 這幾個字，並把 `；後三項刪了` 改成 `；這幾項刪了`。
   - 內文刪掉 `二、lib/profile.js 的 git 輔助函式改用 lib/blame.js 匯出的 git；刪掉會位移 docs/01-guide/profile.md 與 docs/90-agent/reference/subagents.md 以行號引用 profile.js 的位置，要一併改。` 整句。

8. 跑 `node scripts/docs-check.js`（要印 `Every reference resolves.`；它點名 `docs/01-guide/profile.md` 以外、本 task Files 以外的檔，就停下來回報 BLOCKED 並貼出那一行）與 `node scripts/todo-check.js`（exit 0）。

9. 回報要提交的路徑 `lib/profile.js`、`docs/01-guide/profile.md`、`docs/90-agent/todo/cleanup-2.md`，訊息 `refactor: profile.js uses blame.js's git, its own copy removed`，以及步驟 1、5 的測試結果行與步驟 8 的兩行輸出。

## Coverage

survey 報告沒有 `## N.` 的編號段落；本計畫要兌現的是使用者在 survey 關卡選的那一句，拆成條目裡的兩項：

| promise | task |
|---|---|
| lib/serve.js 的 fetchHealth 與 scripts/security-local.js 的 post 改用全域 fetch 加 AbortSignal.timeout，先驗證 keep-alive 不會拖住短命的 hook 行程 | Task 1（post 不改，理由見 Risks 與條目） |
| lib/profile.js 的 git 輔助函式改用 lib/blame.js 匯出的 git；刪掉會位移 docs/01-guide/profile.md 與 docs/90-agent/reference/subagents.md 以行號引用 profile.js 的位置，要一併改 | Task 2 |
| 不重蓋章、不動 model-3 與 stage-agents-14 | struck — 是不做的範圍，沒有 task |
