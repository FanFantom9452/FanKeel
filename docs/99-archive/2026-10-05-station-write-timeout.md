---
status: current
---

# /fankeel hook 逾時修正 — Implementation Plan

**Goal:** 讓 `hooks/inject.js` 裡的 `station.write` 不再穿過 `.fankeel/build/` 下的 Windows junction 去數整個 `~/.claude/projects`，數檔受 `gather` 的同一個時限約束，並讓 `ensureServe` 在 `until` 已過期時仍給活著的 station 250ms 的探測，不把它誤判為沒在跑。
**Architecture:** Task 1 把 `lib/station.js` 的 `buildDirs` 改成自己逐層走目錄：`Dirent.isSymbolicLink()` 為真的項目（Windows junction 在 `Dirent` 上就是這樣報的）一律不進去，並吃 `gather` 的 `until`，過期就停止數檔；同一個 task 拆掉本機 `.fankeel/build/task-20261003T114747/shots-v3/` 下 `cfg/projects` 與 `cfgB/projects` 兩個 junction，再量一次 `station.write` 的耗時。Task 2 把 `lib/serve.js` 的 `probeMs` 下限從 1 改成 250（呼叫者自己要更短的 `probeMs` 時照給）。兩個 task 不共用檔案、互不依賴。
**Tech Stack:** Node 24（本機 v24.9.0）內建模組與 `node --test`；`fs.readdirSync(dir, { withFileTypes: true })` 的 `Dirent`，`fs.symlinkSync(target, path, 'junction')`（非 Windows 上 `'junction'` 被忽略、建成一般 symlink，`isSymbolicLink()` 一樣為真）。
**Spec:** [design.md](../../../.fankeel/build/task-20261004T182656/design.md)

## Global Constraints

- 不得新增相依套件：`package.json` 沒有任何 dependency，`"test": "node --test"`（`package.json:8`）。
- repo 根目錄沒有 `CLAUDE.md`；慣例取自程式碼本身：JS 檔第一行 `'use strict';`、`lib/` 與 `tests/` 用 4 格縮排（`lib/station.js`、`tests/serve.test.js` 皆是）。
- `.gitattributes` 是 `* text=auto eol=lf`：寫 LF。
- `.fankeel/map.md` 的樹：`lib/` 是「the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/」；`tests/` 是「node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from」——新測試的暫存目錄一律用 `tests/tmp.js`。
- 測試呼叫 `station.gather` 一律帶 `cwd` 指向暫存目錄：不帶時 `discover` 會從 `process.cwd()` 找到本機真正的 registry（`lib/station.js:156` 起的 `discover`，`if (opts.cwd) add(registry.findStateRoot(opts.cwd))`）。
- `DETAIL_BUDGET_MS = 1500`（`lib/station.js:818`），`write()` 以它呼叫 `gather`；hook 的總時限是五秒，`hooks/inject.js:170` 傳 `until: began + SERVE_BUDGET_MS` 給 `ensureServe`。
- implementer 只跑自己 task 寫的測試檔（Task 1 另跑既有的 `tests/station.test.js`），不跑全套；全套由派它的 brain 在 commit 前跑。

## Risks

- `gather` 的 `until` 在讀 transcript 時可能已經花完，`buildDirs` 之後就把每個 build 目錄數成 0，station 頁上的檔數變少 — Task 1 — 這是 design 接受的取捨（過期就停止數檔）；測試把「過期時目錄仍列出、檔數為 0」寫成明確斷言，讓這個行為是刻意的而不是意外。
- 拆 junction 時若誤用遞迴刪除，會刪到 junction 指向的 `C:\Users\Owner\.claude\projects` 本體 — Task 1 — 只用不帶 `/s` 的 `cmd //c rmdir`（對非空的真目錄會失敗，不會刪內容），拆完先確認 `C:/Users/Owner/.claude/projects` 仍在，再確認兩個 junction 不在。
- 本機 loopback 的 health 回應可能在 1ms 內完成，Task 2 的新測試在改之前就綠，證明不了什麼 — Task 2 — 測試用的 `listener` 加一個 `delayMs` 選項，延遲 50ms 才回應，保證 1ms 探測必定逾時、250ms 探測必定接到。
- worktree 隔離的 implementer 看不到 gitignored 的 `.fankeel/build/`，junction 只在主 tree — Task 1 — 拆 junction 與量測的命令一律用主 tree 的絕對路徑 `F:/ymlab/fankeel/...`。

## Task 1: buildDirs 不跟 junction、受 until 限制，並拆掉兩個 junction

**Files:**
- Modify: `lib/station.js` — `buildDirs`（201-220）改為逐層走目錄、跳過 symlink／junction、吃 `until`；`gather` 的呼叫點（546）傳入 `until`
- Test: `tests/station-build-dirs.test.js`
- Read: `lib/registry.js` — 測試用 `registry.ensureLayout(root)` 建出 `.fankeel/` 讓 `discover` 認得這個 root
- Read: `tests/tmp.js` — 暫存目錄的來源
- Read: `tests/station.test.js` — 第 4 步一併跑，它在 107 行斷言 `build` 的既有形狀，本 task 不改它
- Read: `lib/profile.js` — 第 6 步的量測命令用它的 `configDirOf()` 取真正的 config 目錄

**Interfaces:**
- Consumes: none
- Produces: `buildDirs(root, until)`（模組內部函式，不匯出）——`until` 是毫秒時間戳，不是數字或是 `NaN` 時視為不限；回傳形狀不變，仍是 `[{ name, files }]` 依名稱排序。`gather()` 回傳的 `registries[i].build` 形狀不變。

**Dispatch:** implementer, sonnet — plan 帶著完整程式碼，是轉寫加測試。

1. Write the failing test。在 `tests/station-build-dirs.test.js` 寫入：

In `tests/station-build-dirs.test.js`:

```js
'use strict';
// lib/station.js buildDirs, through gather: a build directory holding a
// junction is counted without walking into it, and a spent budget stops the
// count while the directory is still listed. On 2026-10-04 a junction under
// .fankeel/build pointing at ~/.claude/projects cost station.write three
// seconds inside a five-second hook.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

function fixture() {
    const base = tmp('fankeel-builddirs-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    const task = path.join(root, '.fankeel', 'build', 'task-a');
    fs.mkdirSync(path.join(task, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(task, 'ledger.md'), '# ledger\n');
    fs.writeFileSync(path.join(task, 'sub', 'shot.png'), 'x');
    // The junction points at a directory inside this same scratch tree, so
    // nothing outside it is at stake if anything follows the link.
    const far = path.join(base, 'far');
    fs.mkdirSync(far);
    for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(far, i + '.jsonl'), '{}\n');
    fs.symlinkSync(far, path.join(task, 'sub', 'projects'), 'junction');
    return { base, cfg, root };
}

const buildOf = (f, extra) => {
    const m = station.gather(Object.assign({ configDir: f.cfg, roots: [f.root], cwd: f.base }, extra));
    return m.registries.find((r) => r.root === path.resolve(f.root)).build;
};

test('a junction under a build directory is not walked into', () => {
    const f = fixture();
    assert.deepEqual(buildOf(f), [{ name: 'task-a', files: 2 }]);
});

test('a spent budget stops the count, and the directory is still listed', () => {
    const f = fixture();
    assert.deepEqual(buildOf(f, { detailBudgetMs: -1 }), [{ name: 'task-a', files: 0 }]);
});
```

2. Run it and watch it fail：兩個測試都紅——第一個數到 7（穿過 junction 數到 `far` 的 5 個檔），第二個也是 7（沒有時限）。

```sh
node --test tests/station-build-dirs.test.js
```

3. Write the minimal implementation。在 `lib/station.js` 把整個 `buildDirs`（201-220 行，從 `function buildDirs(root) {` 到 219 行的 `return out.sort(...)` 與 220 行收尾的 `}`）換成：

In `lib/station.js`, replacing `function buildDirs(root)` whole:

```js
// Files under one build directory, walked one level at a time rather than
// with `recursive: true`, which follows a Windows junction: one left under
// .fankeel/build pointing at ~/.claude/projects cost `write()` about three
// seconds on 2026-10-04. A link — a junction reports `isSymbolicLink()` on
// its Dirent — is never entered. `until` is `gather`'s own deadline; past it
// the count stops where it is.
function countFiles(dir, until) {
    let files = 0;
    const stack = [dir];
    while (stack.length && Date.now() < until) {
        const at = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(at, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const ent of entries) {
            if (ent.isSymbolicLink()) continue;
            if (ent.isDirectory()) stack.push(path.join(at, ent.name));
            else if (ent.isFile()) files += 1;
        }
    }
    return files;
}

function buildDirs(root, until) {
    const deadline = typeof until === 'number' && !Number.isNaN(until) ? until : Infinity;
    const dir = path.join(root, '.fankeel', 'build');
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of names) {
        if (!d.isDirectory()) continue;
        out.push({ name: d.name, files: countFiles(path.join(dir, d.name), deadline) });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
```

   再在 `lib/station.js` 的 `gather` 裡（546 行，`registries.push({ root, gone: false, ...`）把 `build: buildDirs(root)` 改成 `build: buildDirs(root, until)`：

In `lib/station.js`, in `gather()` at the `registries.push` for a live root:

```js
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root, until), mapAt: mapDate(root), sessions, profiles, docs, todos });
```

   `until` 是 `gather` 在 398 行定義的同一個常數，在 546 行的範圍內。

4. Run it and watch it pass，連同既有斷言 `build` 的測試（`tests/station.test.js:107`）：

```sh
node --test tests/station-build-dirs.test.js tests/station.test.js
```

5. 拆掉主 tree 的兩個 junction（gitignored，worktree 裡沒有，一律用絕對路徑；`rmdir` 不帶 `/s`，對真目錄會失敗而不刪內容）：

```sh
cmd //c dir "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg" "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB" | grep -i junction
cmd //c rmdir "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg\projects"
cmd //c rmdir "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB\projects"
ls C:/Users/Owner/.claude/projects | head -3
cmd //c dir "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg" "F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB" | grep -ci junction
```

   第一行應列出兩個 `<JUNCTION> projects`；`ls` 必須仍列出 `C:/Users/Owner/.claude/projects` 的內容；最後一行應印 `0`。任何一步不符就停下，回 `blocked:` 附輸出。

6. 量一次 `station.write` 的耗時（以本 worktree 的 `lib/station.js`，對主 tree 與真正的 config 目錄，和每次 prompt 時 `hooks/inject.js:107` 做的事相同），在 worktree 根目錄執行，把印出的那一行原樣放進回報：

```sh
node -e "const w=process.cwd();const s=require(w+'/lib/station.js');const c=require(w+'/lib/profile.js').configDirOf();const t=Date.now();s.write({configDir:c,cwd:'F:/ymlab/fankeel',root:'F:/ymlab/fankeel',plugin:w});console.log('station.write ms',Date.now()-t)"
```

   design 的門檻是低於 1500ms；超過不算失敗，照實回報數字。

7. Commit：不由 implementer 做；回報檔案路徑與測試輸出，由 brain 寫 commit 區塊。

## Task 2: ensureServe 的探測給 250ms 保底

**Files:**
- Modify: `lib/serve.js` — 130 行 `probeMs` 的下限從 1 改為 250（呼叫者給更短的 `probeMs` 時照給）；`ensureServe` 上方 115-123 行的註解同步
- Test: `tests/serve.test.js`

**Interfaces:**
- Consumes: none
- Produces: `ensureServe(opts)` 的簽名與四種回傳不變；只有 `until` 已過期或所剩不到 250ms 時，探測仍等 `min(250, opts.probeMs ?? 1000)` 毫秒。

**Dispatch:** implementer, sonnet — plan 帶著完整程式碼，是轉寫加測試。

1. Write the failing test。先在 `tests/serve.test.js` 的 `listener` 加一個 `delayMs` 選項：把 `createServer` 回呼裡 `if (o.hang) return;` 之後的四行（55-59 行附近：組 `body`、`fingerprint`、`writeHead`、`end`）包進一個 `answer` 函式，有 `delayMs` 時延後呼叫：

In `tests/serve.test.js`, in `listener()`, replacing the lines after `if (o.hang) return;` up to the callback's closing `});`:

```js
        const answer = () => {
            const body = { station: true, pid: o.pid, started: new Date().toISOString() };
            if (o.fingerprint !== undefined) body.fingerprint = o.fingerprint;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        if (o.delayMs) setTimeout(answer, o.delayMs);
        else answer();
    });
```

   同時把 `listener` 上方的註解末尾補一句：

In `tests/serve.test.js`, at the end of the comment above `function listener(opts)`:

```js
// `delayMs` holds the answer back that long, for a probe that must outwait it.
```

   再在 `tests/serve.test.js` 的 `test('a station that answers is running, and nothing is started', ...)` 之後加：

In `tests/serve.test.js`, after the test named `a station that answers is running, and nothing is started`:

```js
test('a deadline already spent still gives a live station its probe, so it is running and nothing is started', async () => {
    // hooks/inject.js hands `until` in after a synchronous station.write; when
    // that write ran long, `until` had passed and the probe got 1 ms, so a
    // live station read as down and a second one was started.
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN), delayMs: 50 });
    writeRecord(cfg, { pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() });
    const calls = [];
    try {
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() - 1000 });
        assert.deepEqual(got, { state: 'running', url: st.url });
        assert.equal(calls.length, 0, 'a live station is not started again');
    } finally {
        await st.close();
    }
});
```

2. Run it and watch it fail：新測試紅，`got.state` 是 `starting`，`calls.length` 是 1。

```sh
node --test tests/serve.test.js
```

3. Write the minimal implementation。在 `lib/serve.js` 把 130 行換成：

In `lib/serve.js`, in `ensureServe()`, replacing the `const probeMs = ...` line:

```js
    const asked = Number.isFinite(o.probeMs) ? o.probeMs : 1000;
    const probeMs = Math.max(Math.min(PROBE_FLOOR_MS, asked), Math.min(asked, until - Date.now()));
```

   並在 `lib/serve.js` 的 `function ensureServe(opts) {`（124 行）正上方、115-123 行那段註解之後加常數：

In `lib/serve.js`, directly above `function ensureServe(opts) {`:

```js
// The least the probe waits even when `until` has already passed:
// hooks/inject.js computes `until` before a synchronous station.write, and a
// write that ran long left a 1 ms probe that read a live station as down.
const PROBE_FLOOR_MS = 250;
```

   並改那段註解裡講探測的句子。原本 120-121 兩行是：

```text
// is null for those two and for `starting`. The probe waits `probeMs`, a
// second, and never past `until`. A live station too slow to answer inside it
```

   換成下面三行（其後 122 行 `// gets a second \`serve\`, ...` 不變）：

In `lib/serve.js`, in the comment above `ensureServe`, replacing lines 120-121:

```js
// is null for those two and for `starting`. The probe waits `probeMs`, a
// second, and never past `until` — except that it always gets
// `PROBE_FLOOR_MS`. A live station too slow to answer inside it
```

4. Run it and watch it pass，含既有的 `took >= 900`、`took < 2600` 等時限斷言：

```sh
node --test tests/serve.test.js
```

5. Commit：不由 implementer 做；回報檔案路徑與測試輸出，由 brain 寫 commit 區塊。

## Coverage

| promise | task |
|---|---|
| `buildDirs` 改成自己逐層走目錄、遇到 `isSymbolicLink()` 的項目一律不進去 | Task 1 |
| 並且吃 `gather` 的同一個 `until`，過期就停止數檔 | Task 1 |
| `ensureServe` 的探測時間給 250ms 保底，`until` 過期也不再只剩 1ms | Task 2 |
| 最後拆掉 `.fankeel/build/task-20261003T114747/shots-v3/` 下 `cfg/projects` 與 `cfgB/projects` 兩個 junction | Task 1 |
| 測試用 `fs.symlinkSync(..., 'junction')` 造一個指向含檔目錄的 junction，數檔不得把它算進去 | Task 1 |
| 測試給已過期的 `until` 和一個活著的假 station，要回 `running` 而不是再起一個 | Task 2 |
| 加上在本機量一次 `station.write` 的耗時，必須低於 1500ms | Task 1 |
