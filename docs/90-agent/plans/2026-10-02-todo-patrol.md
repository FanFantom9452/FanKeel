---
status: design-intent
---

# TODO 巡檢 10-02：readObject 收掉重複的 JSON 讀檔、刪兩個死常數 Implementation Plan

**Goal:** 依 10-02 巡檢的 gate 答案，新增 `lib/json.js` 的 `readObject` 並換掉 20 處 `JSON.parse(fs.readFileSync(...))` 加 registry／agentfile／usage 三個私有讀檔函式，刪掉 `assets/station/station.js` 的 `WIZ_FE_NO`、`WIZ_FE_YES`，並關掉 json、station-12、sessions、tour 四個條目。
**Architecture:** Task 1 建 `readObject` 與它的測試；Task 2–6 依檔案分五組換掉各處讀檔（每組至多三個檔，彼此不重疊，都消費 `readObject`，所以在 Task 1 落地後同時派出）。Task 7 刪死常數，並把使用者決定保留的 sessions、tour 兩條以 `abandoned` 關掉，和 Task 1 同時派出。Task 8 等 Task 2–7 都落地，用它們的 commit 關 json 與 station-12。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.91.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261002T021348/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條路線沒有 design 站。使用者在 survey 的 gate 答：plan；json 做；sessions 保留並移出 TODO；tour v4 保留；do now 刪 station.js 的 `WIZ_FE_NO`／`WIZ_FE_YES`。

## Global Constraints

由 `node scripts/map.js`（exit 0；499 份 markdown、6 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`lib/json.js` 只 require `node:fs`。
- 每個 hook 在每條路徑都 exit 0，包括它自己的錯誤（`CONTRIBUTING.md` 的 Hooks 列）。
- 測試：`node --test`；每個 export 都要有 importer（`tests/source.test.js:117`）；新檔要先 `git add`，`tests/source.test.js` 才看得到。新檔由 build agent 的 commit 檔帶進去，實作者不 `git add`。
- 實作者只跑自己 task 列出的測試指令，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。`Modify:` 的行號是本計畫寫成時（commit af0b5a80）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`assets/station/station.js` 四格；新檔 `tests/json.test.js` 四格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。程式裡不寫 `\uXXXX` 跳脫，BOM 用 `charCodeAt(0) === 0xFEFF` 判斷。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> --disposition done|measured-no-change|abandoned`；改完跑 `node scripts/todo-check.js`，exit 0。跑過 `todo.js` 的 task，提交路徑要帶上 `TODO.md`。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- `readObject` 對陣列回 null，原本幾處讓陣列通過（`lib/detail.js` 的 `kept`、`lib/usage.js` 的 `runsOf`）— Task 3 — 這兩個檔案的合法內容都是物件，陣列本來就讀不出有用欄位；跑 `tests/detail*.test.js`、`tests/usage*.test.js` 確認不變。
- `hooks/brief.js` 的 meta 檔若是 `null`，原本在 try 外讀 `meta.spawnDepth` 會拋錯，換後回 `false` — Task 4 — 這是變安全，不是變行為；跑 `tests/brief.test.js`。
- 兩處讀檔失敗要拋錯而不是吞掉：`scripts/tune.js` 的 `doneLive`（`const snap = JSON.parse(...)`，前面已 `existsSync` 檢查）與 `scripts/upgrade.js` 的 `writeReport` — Task 6 — 這兩處不換，留原樣；條目寫的「約 23」因此是 20 處加三個私有函式。
- worktree 從 `origin/main` 開，可能落後很多 commit — 全部 task — 開工第一步 `git reset --hard <sha>`，`lib/json.js` 不存在就停手回報（Task 2–6）。
- Task 2–6 改的檔彼此 require（例如 `scripts/station.js` require `lib/station.js`），`ledger.js groups` 因此列出 require 邊 — Task 2–6 — 這些 task 只換私有讀檔、不動任何 export，彼此在各自 worktree 平行做不會互相影響；邊只讓該組不走 workflow，stage agent 本來就用 agents。
- `TODO.md` 由 Task 7、8 各自重產；兩個 task 若平行，cherry-pick 會撞 — Task 7、8 — Task 8 消費 Task 7 的 commit，等 Task 7 落地才派，在新 HEAD 上重產。

## Task 1: `lib/json.js` 的 `readObject`

**Files:**
- Modify: `lib/json.js` — 新檔
- Test: `tests/json.test.js`

**Interfaces:**
- Consumes: none
- Produces: `readObject(file: string) -> object | null` — 檔案內容是 plain object（非陣列、非 null、非純量）時回那個物件，其他一律 null：沒檔、讀不了、不能 parse。開頭的 BOM 先去掉。 commit 訊息第一行 `feat: lib/json.js readObject, one reader for a JSON object file`。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`。

2. 寫測試，新檔 `tests/json.test.js`：

```js
'use strict';
// lib/json.js: readObject reads a JSON file whose absence or damage is not an
// error, and answers null for anything but a plain object.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('../lib/json.js');
const tmp = require('./tmp.js');

test('a file holding a JSON object reads as that object', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'a.json');
    fs.writeFileSync(file, '{"port":7817,"src":["a.js"]}');
    assert.deepEqual(readObject(file), { port: 7817, src: ['a.js'] });
});

test('no file, a directory and bytes that do not parse all read as null', () => {
    const dir = tmp('fankeel-json-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{"port":');
    assert.equal(readObject(path.join(dir, 'missing.json')), null);
    assert.equal(readObject(dir), null);
    assert.equal(readObject(bad), null);
});

test('JSON that parses to anything but a plain object reads as null', () => {
    const dir = tmp('fankeel-json-');
    for (const [name, body] of [['arr', '[1,2]'], ['nul', 'null'], ['num', '7'], ['str', '"x"'], ['yes', 'true']]) {
        const file = path.join(dir, name + '.json');
        fs.writeFileSync(file, body);
        assert.equal(readObject(file), null, name);
    }
});

test('a leading byte-order mark is dropped before parsing', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'bom.json');
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}')]));
    assert.deepEqual(readObject(file), { a: 1 });
});
```

3. 跑 `node --test tests/json.test.js`，看它失敗（`Cannot find module '../lib/json.js'`）。

4. 寫新檔 `lib/json.js`：

```js
'use strict';
// One reader for a JSON file whose absence or damage is not an error: a
// record a hook or a server may not have written yet, half-written, or
// replaced by hand. Every caller had its own try/catch around
// JSON.parse(fs.readFileSync(...)); this is that, once.

const fs = require('node:fs');

// The parsed contents of `file` when they are a plain object — not an array,
// not null, not a scalar — and null for anything else: no file, a file that
// cannot be read, bytes that do not parse. A leading byte-order mark is
// dropped first, the way lib/registry.js and lib/agentfile.js always did.
function readObject(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return null;
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

module.exports = { readObject };
```

5. 跑 `node --test tests/json.test.js`，四個測試都過。

6. 不 commit。回報提交路徑 `lib/json.js`、`tests/json.test.js`，訊息：

```text
feat: lib/json.js readObject, one reader for a JSON object file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 2: handoff、serve、live 改用 `readObject`

**Files:**
- Modify: `lib/handoff.js` — `readPending`、`answersSince`、`answeredOf` 迴圈、`handedOffSince` 四處
- Modify: `lib/serve.js` — `readServeRecord`、`diskFingerprint` 兩處
- Modify: `lib/live.js` — `runningSessions` 迴圈一處
- Read: `lib/json.js` — `readObject`，不改

**Interfaces:**
- Consumes: `readObject` from Task 1
- Produces: commit 訊息第一行 `refactor: handoff, serve and live read JSON through readObject`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；`test -f lib/json.js || echo MISSING`，印出 MISSING 就停手回報。

2. 三個檔都在 `const path = require('node:path');` 那一行下面加一行（`fs` 三個檔都還在別處用，保留）。`lib/handoff.js`、`lib/serve.js`、`lib/live.js` 各加：

```js
const { readObject } = require('./json.js');
```

3. `lib/handoff.js` 的 `readPending`，把

```js
    let got;
    try { got = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
    if (!got || !Array.isArray(got.questions) || !(got.until > (now || Date.now()))) return null;
```

在 `lib/handoff.js` 換成

```js
    const got = readObject(file);
    if (!got || !Array.isArray(got.questions) || !(got.until > (now || Date.now()))) return null;
```

4. `lib/handoff.js` 的 `answersSince`，把

```js
    let got;
    try { got = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
    const a = got && got.answers;
```

在 `lib/handoff.js` 換成

```js
    const got = readObject(file);
    const a = got && got.answers;
```

5. `lib/handoff.js` 的 `for (let lap = 1; lap <= last; lap++)` 迴圈裡，把

```js
            let got;
            try { got = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }
            const answers = got && got.answers;
```

在 `lib/handoff.js` 換成

```js
            const got = readObject(file);
            const answers = got && got.answers;
```

6. `lib/handoff.js` 的 `handedOffSince`，把

```js
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')).handoff === 'terminal';
    } catch (e) {
        return false;
    }
```

在 `lib/handoff.js` 換成

```js
    const got = readObject(file);
    return !!got && got.handoff === 'terminal';
```

7. `lib/serve.js` 的 `readServeRecord`，把函式本體

```js
    try {
        const data = JSON.parse(fs.readFileSync(serveRecordPath(configDir), 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (e) {
        return null;
    }
```

在 `lib/serve.js` 換成

```js
    return readObject(serveRecordPath(configDir));
```

8. `lib/serve.js` 的 `diskFingerprint`，把

```js
    let version = 'unknown';
    try {
        version = JSON.parse(fs.readFileSync(path.join(String(pluginDir), 'package.json'), 'utf8')).version || 'unknown';
    } catch (e) { /* version stays 'unknown' */ }
```

在 `lib/serve.js` 換成

```js
    const pkg = readObject(path.join(String(pluginDir), 'package.json'));
    const version = (pkg && pkg.version) || 'unknown';
```

9. `lib/live.js` 的 `for (const name of names)` 迴圈，把

```js
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
```

在 `lib/live.js` 換成

```js
        const data = readObject(path.join(dir, name));
        if (!data) continue;
```

10. `grep -n "JSON.parse(fs.readFileSync" lib/handoff.js lib/serve.js lib/live.js` 沒有輸出；跑 `node --test tests/handoff.test.js tests/handoff-relay.test.js tests/serve.test.js tests/live.test.js`，全過。

11. 不 commit。回報提交路徑 `lib/handoff.js`、`lib/serve.js`、`lib/live.js`，訊息：

```text
refactor: handoff, serve and live read JSON through readObject

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 3: station、detail、usage 改用 `readObject`

**Files:**
- Modify: `lib/station.js:15-335` — `readRawRoots`、`tuneOf` 的 serve 埠兩處
- Modify: `lib/detail.js:14-700` — `readDetail` 一處
- Modify: `lib/usage.js:15-455` — 私有 `readJson` 換成 `readObject`
- Read: `lib/json.js` — `readObject`，不改

**Interfaces:**
- Consumes: `readObject` from Task 1
- Produces: commit 訊息第一行 `refactor: station, detail and usage read JSON through readObject`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；`test -f lib/json.js || echo MISSING`，印出 MISSING 就停手回報。

2. 在 `lib/station.js`、`lib/detail.js` 的 `const path = require('node:path');` 下面各加一行：

```js
const { readObject } = require('./json.js');
```

3. `lib/station.js` 的 `readRawRoots`，把函式本體

```js
    let data;
    try {
        data = JSON.parse(fs.readFileSync(rootsPath(configDir), 'utf8'));
    } catch (e) {
        return {};
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
```

在 `lib/station.js` 換成

```js
    return readObject(rootsPath(configDir)) || {};
```

4. `lib/station.js` 裡 `const rows = queueState(text);` 之後，把

```js
    try {
        const port = JSON.parse(fs.readFileSync(path.join(state, 'serve.json'), 'utf8')).port;
        if (Number.isInteger(port) && port > 0) url = 'http://127.0.0.1:' + port + '/';
    } catch (e) { /* no server recorded */ }
```

在 `lib/station.js` 換成

```js
    const rec = readObject(path.join(state, 'serve.json'));
    const port = rec && rec.port;
    if (Number.isInteger(port) && port > 0) url = 'http://127.0.0.1:' + port + '/';
```

5. `lib/detail.js` 的 `readDetail`，把

```js
    let old = null;
    try {
        old = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        old = null;
    }
```

在 `lib/detail.js` 換成

```js
    let old = readObject(file);
```

6. `lib/usage.js`：刪掉整個 `function readJson(file) {` 函式（`try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }` 那七行，以及它後面的一個空行），並在 `const { readTail } = require('./context.js');` 下面加：

```js
// The three callers below each add their own fallback; readJson is their name
// for lib/json.js's readObject.
const { readObject: readJson } = require('./json.js');
```

7. `grep -n "JSON.parse(fs.readFileSync" lib/station.js lib/detail.js lib/usage.js` 沒有輸出；跑 `node --test tests/station.test.js tests/station-tune.test.js tests/detail.test.js tests/detail-cache.test.js tests/detail-tasks.test.js tests/usage.test.js tests/usage-peak.test.js tests/usage-series.test.js`，全過。

8. 不 commit。回報提交路徑 `lib/station.js`、`lib/detail.js`、`lib/usage.js`，訊息：

```text
refactor: station, detail and usage read JSON through readObject

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 4: registry、agentfile、brief hook 改用 `readObject`

**Files:**
- Modify: `lib/registry.js` — 私有 `readFile` 換成 `readObject`
- Modify: `lib/agentfile.js` — `readJson` 改成呼叫 `readObject`
- Modify: `hooks/brief.js` — `nestedBrain` 一處
- Read: `lib/json.js` — `readObject`，不改

**Interfaces:**
- Consumes: `readObject` from Task 1
- Produces: commit 訊息第一行 `refactor: registry, agentfile and the brief hook read JSON through readObject`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；`test -f lib/json.js || echo MISSING`，印出 MISSING 就停手回報。

2. `lib/registry.js`：刪掉從註解 `// A file that does not parse, or parses to something that is not a plain object,` 起、到 `function readFile(file) {` 函式結尾的 `}` 為止（約 141-160 行：三行註解加整個函式，函式裡有一個含 BOM 字元的 `raw.replace(...)`），連同後面一個空行；再在 `const path = require('node:path');` 下面加：

```js
// A file that does not parse, or parses to something that is not a plain object,
// is not an error worth propagating: the caller is rendering a hook line, and one
// broken entry must not cost the other entries or the turn. lib/json.js's
// readObject is that reader, named readFile here for the callers below.
const { readObject: readFile } = require('./json.js');
```

   `grep -n "readFile(" lib/registry.js` 的呼叫處（`readSession` 與目錄迴圈）不用改。

3. `lib/agentfile.js`：在 `const path = require('node:path');` 下面加

```js
const { readObject } = require('./json.js');
```

   再把 `lib/agentfile.js` 裡整個 `function readJson(file) {` 函式（約 37-46 行，`readText` 加 BOM 去除加 try/catch）換成：

```js
function readJson(file) {
    return readObject(file) || {};
}
```

   `readText` 還有三處呼叫，保留。

4. `hooks/brief.js`：在 `const path = require('node:path');` 下面加

```js
const { readObject } = require('../lib/json.js');
```

   再在 `hooks/brief.js` 的 `nestedBrain` 裡把

```js
    let meta;
    try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    } catch (e) {
        return false;
    }
```

   在 `hooks/brief.js` 換成

```js
    const meta = readObject(metaFile);
    if (!meta) return false;
```

5. `grep -n "JSON.parse" lib/registry.js lib/agentfile.js hooks/brief.js` 不再有讀檔那幾處；跑 `node --test tests/registry.test.js tests/registry-seen.test.js tests/agentfile.test.js tests/agentfile-start.test.js tests/brief.test.js`，全過。

6. 不 commit。回報提交路徑 `lib/registry.js`、`lib/agentfile.js`、`hooks/brief.js`，訊息：

```text
refactor: registry, agentfile and the brief hook read JSON through readObject

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 5: await、orient、station 三個 script 改用 `readObject`

**Files:**
- Modify: `scripts/await.js` — `holder`、`release` 兩處
- Modify: `scripts/orient.js:18-515` — `overlapsIn`、`auditLine` 兩處
- Modify: `scripts/station.js:28-215` — `forget`、`writeScanRecord` 兩處
- Read: `lib/json.js` — `readObject`，不改

**Interfaces:**
- Consumes: `readObject` from Task 1
- Produces: commit 訊息第一行 `refactor: await, orient and station scripts read JSON through readObject`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；`test -f lib/json.js || echo MISSING`，印出 MISSING 就停手回報。

2. 三個檔都在 `const path = require('node:path');` 下面加一行。`scripts/await.js`、`scripts/orient.js`、`scripts/station.js` 各加：

```js
const { readObject } = require('../lib/json.js');
```

3. `scripts/await.js` 的 `holder`，把函式本體

```js
    try {
        const m = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!m || !alive(m.pid)) return null;
        return m.agentId && agentId && m.agentId !== agentId ? null : m;
    } catch (e) {
        return null;
    }
```

在 `scripts/await.js` 換成

```js
    const m = readObject(file);
    if (!m || !alive(m.pid)) return null;
    return m.agentId && agentId && m.agentId !== agentId ? null : m;
```

4. `scripts/await.js` 的 `const release = () => {`，把它的本體

```js
        try {
            if (JSON.parse(fs.readFileSync(marker, 'utf8')).pid === process.pid) fs.unlinkSync(marker);
        } catch (e) { /* gone already */ }
```

在 `scripts/await.js` 換成

```js
        const m = readObject(marker);
        if (!m || m.pid !== process.pid) return;
        try { fs.unlinkSync(marker); } catch (e) { /* gone already */ }
```

5. `scripts/orient.js` 的 `overlapsIn`，把

```js
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
```

在 `scripts/orient.js` 換成

```js
    const data = readObject(file);
    if (!data) return [];
```

6. `scripts/orient.js` 的 `auditLine`，把

```js
    let last;
    try {
        last = JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'audit.json'), 'utf8')).last;
    } catch (e) {
        return null;
    }
```

在 `scripts/orient.js` 換成

```js
    const rec = readObject(path.join(dir, '.fankeel', 'audit.json'));
    if (!rec) return null;
    const last = rec.last;
```

7. `scripts/station.js` 的 `forget`，把

```js
    let before;
    try {
        before = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        before = {};
    }
    if (!before || typeof before !== 'object' || Array.isArray(before)) before = {};
```

在 `scripts/station.js` 換成

```js
    const before = readObject(file) || {};
```

8. `scripts/station.js` 的 `writeScanRecord`，把

```js
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        data = {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
```

在 `scripts/station.js` 換成

```js
    const data = readObject(file) || {};
```

9. `grep -n "JSON.parse(fs.readFileSync" scripts/await.js scripts/orient.js scripts/station.js` 沒有輸出；跑 `node --test tests/await.test.js tests/await-pending.test.js tests/orient.test.js tests/station-cli.test.js tests/station-serve.test.js`，全過。

10. 不 commit。回報提交路徑 `scripts/await.js`、`scripts/orient.js`、`scripts/station.js`，訊息：

```text
refactor: await, orient and station scripts read JSON through readObject

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 6: task、tune 兩個 script 改用 `readObject`

**Files:**
- Modify: `scripts/task.js:20-60` — `pluginVersion` 一處（檔案 1593 行，只動這一段）
- Modify: `scripts/tune.js` — `liveOf`、`notify` 兩處；`doneLive` 的 `const snap = JSON.parse(...)` 不動
- Read: `lib/json.js` — `readObject`，不改

**Interfaces:**
- Consumes: `readObject` from Task 1
- Produces: commit 訊息第一行 `refactor: task and tune scripts read JSON through readObject`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；`test -f lib/json.js || echo MISSING`，印出 MISSING 就停手回報。

2. 兩個檔都在 `const path = require('node:path');` 下面加一行。`scripts/task.js`、`scripts/tune.js` 各加：

```js
const { readObject } = require('../lib/json.js');
```

3. `scripts/task.js` 的 `pluginVersion`，把函式本體

```js
    try {
        return JSON.parse(fs.readFileSync(path.join(PLUGIN, 'package.json'), 'utf8')).version;
    } catch (e) {
        return undefined;
    }
```

在 `scripts/task.js` 換成

```js
    const pkg = readObject(path.join(PLUGIN, 'package.json'));
    return pkg ? pkg.version : undefined;
```

4. `scripts/tune.js` 的 `liveOf`，把函式本體

```js
    try {
        const rec = JSON.parse(fs.readFileSync(SERVE, 'utf8'));
        return Array.isArray(rec.src) && rec.src.length ? { src: rec.src, rebuild: typeof rec.rebuild === 'string' ? rec.rebuild : null } : null;
    } catch (e) {
        return null;
    }
```

在 `scripts/tune.js` 換成

```js
    const rec = readObject(SERVE);
    return rec && Array.isArray(rec.src) && rec.src.length ? { src: rec.src, rebuild: typeof rec.rebuild === 'string' ? rec.rebuild : null } : null;
```

5. `scripts/tune.js` 的 `notify`，把

```js
    let port;
    try {
        port = JSON.parse(fs.readFileSync(SERVE, 'utf8')).port;
    } catch (e) {
        return then();
    }
```

在 `scripts/tune.js` 換成

```js
    const rec = readObject(SERVE);
    if (!rec) return then();
    const port = rec.port;
```

6. `grep -n "JSON.parse(fs.readFileSync" scripts/task.js scripts/tune.js` 只剩 `scripts/tune.js` 的 `const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));` 一行；跑 `node --test tests/task.test.js tests/tune.test.js tests/tune-overlay.test.js`，全過。

7. 不 commit。回報提交路徑 `scripts/task.js`、`scripts/tune.js`，訊息：

```text
refactor: task and tune scripts read JSON through readObject

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 7: 刪 `WIZ_FE_NO`／`WIZ_FE_YES`，關 sessions 與 tour

**Files:**
- Modify: `assets/station/station.js:2036-2048` — 刪兩個無引用的 SVG 常數（檔案 5488 行，只動這一段）
- Modify: `docs/90-agent/todo/sessions-1.md` — 補決定段，`todo.js done --disposition abandoned`
- Modify: `docs/90-agent/todo/tour-1.md` — 補決定段，`todo.js done --disposition abandoned`

**Interfaces:**
- Consumes: none
- Produces: commit 訊息第一行 `chore(station): drop the unreferenced WIZ_FE_NO and WIZ_FE_YES`，Task 8 以它找 sha。

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`；記下 `BASE=$(git rev-parse HEAD)`。

2. 刪前再 grep 一次，只能有定義那兩行：

```sh
git grep -n "WIZ_FE_NO\b\|WIZ_FE_YES\b" -- assets lib scripts hooks tests
```

   輸出不是恰好 `assets/station/station.js` 的兩行 `var WIZ_FE_NO =`、`var WIZ_FE_YES =`，就停手回報輸出。

3. 在 `assets/station/station.js`，刪掉從 `    var WIZ_FE_NO = '<svg class="vg" viewBox="0 0 220 80" aria-hidden="true">'` 起、到 `WIZ_FE_YES` 最後一行 `        + '<path class="docl dr d3" pathLength="1" d="M111 28H141M111 36H137M111 44H131"/></g></svg>';` 為止的八行。上面 `// Step 3, 前端:` 那段註解與下面的 `    var WIZ_FE_MODELS = [` 保留。

4. 跑 `node --test tests/station-wizard.test.js tests/station-wizard-motion.test.js tests/station-i18n.test.js tests/station-view.test.js`，全過。

5. 在 `docs/90-agent/todo/sessions-1.md` 檔尾（frontmatter 結束的 `---` 之後）加：

```md

## 決定 2026-10-02

TODO 巡檢的 gate，使用者選「保留，移出 TODO」：scripts 下的 sessions.js 是帶 shebang 的 CLI，可能有人手動跑；保留成本只是 183 行，不刪。
```

6. 在 `docs/90-agent/todo/tour-1.md` 檔尾加：

```md

## 決定 2026-10-02

TODO 巡檢的 gate，使用者選「保留」：promo30v4 是 09-29 決定留下的封存版本，tour-ring.js 的那一段、tour-record.js 的 NAMES／OLD_NAMES 與 v4 的測試都留著。
```

7. 關兩個條目：

```sh
node scripts/todo.js done sessions-1 --sha "$BASE" --disposition abandoned
node scripts/todo.js done tour-1 --sha "$BASE" --disposition abandoned
node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0；兩個檔的 frontmatter 都是 `state: done`；`TODO.md` 的 Needs a decision 不再有〔sessions〕、〔tour〕兩條，〔docs-check〕仍在。

8. 不 commit。回報提交路徑 `assets/station/station.js`、`docs/90-agent/todo/sessions-1.md`、`docs/90-agent/todo/tour-1.md`、`TODO.md`，訊息：

```text
chore(station): drop the unreferenced WIZ_FE_NO and WIZ_FE_YES

- station.js: the two wizard SVG constants had no reference left
- sessions-1 abandoned: scripts/sessions.js stays, the user may run it by hand
- tour-1 abandoned: promo30v4 stays as the archived cut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Task 8: 關 json 與 station-12

**Files:**
- Modify: `docs/90-agent/todo/json-1.md` — `todo.js done`
- Modify: `docs/90-agent/todo/station-12.md` — `todo.js done`

**Interfaces:**
- Consumes: Task 1–7 的 commit，以訊息第一行找：`feat: lib/json.js readObject, one reader for a JSON object file`、`refactor: handoff, serve and live read JSON through readObject`、`refactor: station, detail and usage read JSON through readObject`、`refactor: registry, agentfile and the brief hook read JSON through readObject`、`refactor: await, orient and station scripts read JSON through readObject`、`refactor: task and tune scripts read JSON through readObject`、`chore(station): drop the unreferenced WIZ_FE_NO and WIZ_FE_YES`
- Produces: none

**Dispatch:** implementer, sonnet

1. `git reset --hard <build agent 給的 sha>`，再找出七個 commit，每個都要有 sha；任一為空就停手回報這七行：

```sh
for s in 'feat: lib/json.js readObject, one reader for a JSON object file' \
         'refactor: handoff, serve and live read JSON through readObject' \
         'refactor: station, detail and usage read JSON through readObject' \
         'refactor: registry, agentfile and the brief hook read JSON through readObject' \
         'refactor: await, orient and station scripts read JSON through readObject' \
         'refactor: task and tune scripts read JSON through readObject' \
         'chore(station): drop the unreferenced WIZ_FE_NO and WIZ_FE_YES'; do
  echo "$(git log -1 --format=%H -F --grep="$s") $s"
done
```

2. json 以六個 readObject commit 中最新的一個為收尾，station-12 用 Task 7 的：

```sh
J=$(git log -1 --format=%H -F --grep='read JSON through readObject'); echo "J=$J"
S=$(git log -1 --format=%H -F --grep='chore(station): drop the unreferenced WIZ_FE_NO and WIZ_FE_YES'); echo "S=$S"
grep -rn "JSON.parse(fs.readFileSync" lib scripts hooks
node scripts/todo.js done json-1 --sha "$J" --disposition done
node scripts/todo.js done station-12 --sha "$S" --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   `grep` 只剩 `scripts/tune.js` 的 `const snap = ...` 與 `scripts/upgrade.js` 的 `const v = ...` 兩行（多了就停手回報）；todo-check exit 0；`TODO.md` 的 Needs a decision 只剩〔docs-check〕。

3. 不 commit。回報提交路徑 `docs/90-agent/todo/json-1.md`、`docs/90-agent/todo/station-12.md`、`TODO.md`，訊息：

```text
docs: close json-1 and station-12

- json-1 done: lib/json.js readObject replaces 20 inline reads and three private readers; tune doneLive and upgrade writeReport keep throwing on purpose
- station-12 done: WIZ_FE_NO and WIZ_FE_YES deleted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DfgcKgXwE64pwmy2F9EeL2
```

## Coverage

| promise | task |
|---|---|
| 〔json〕lib/json.js 加 readObject，取代約 23 處 JSON.parse(readFileSync) | Task 1–6，Task 8 關條目 |
| 〔station〕WIZ_FE_NO、WIZ_FE_YES 兩個 SVG 常數無引用；刪除前再 grep 一次 | Task 7（第 2 步 grep），Task 8 關條目 |
| 〔sessions〕保留，移出 TODO | Task 7 |
| 〔tour〕promo30v4 保留 | Task 7 |
| 〔docs-check〕排下次巡檢 | struck — 使用者這次沒問到，條目留在 Needs a decision |
| Blocked 14 條重蓋日期 | struck — stamp 是 10-01，只差一天，不改條目檔；下次巡檢照 seven-day 規則再看 |
