---
status: design-intent
---

# TODO 全表盤點（10-16）：測試的子行程要有逾時 Implementation Plan

**Goal:** `npm test` 與 `suite.js` 裡任何一個同步子行程永遠不結束時，那條測試在逾時後變紅，整份 suite 照樣跑完。
**Architecture:** 一個 task。新的預載模組 `tests/subprocess-timeout.js` 在測試檔載入前包住 `node:child_process` 的 `execFileSync`、`spawnSync`、`execSync`，沒給 `timeout` 的呼叫補預設值；`package.json` 的 `test` 與 `test:fast` 在 `--test` 之後加 `--require` 載入它。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit 7cf8940b。
**Spec:** [2026-10-16-test-subprocess-timeout-design.md](2026-10-16-test-subprocess-timeout-design.md)

## Global Constraints

由 `node scripts/map.js`（940 markdown files, 23 planned, not built, 290 retired, 22 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。預載模組不 export 任何東西。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `lib/suite.js:18` 的 `NODE_TEST` 是 `/\bnode\s+--test\b/`：`package.json` 的 test script 必須仍以 `node --test` 開頭，`--require` 放在後面。
- `engines.node` 是 `>=22.5`；不加 dependencies。
- 縮排：`tests/` 兩格（`tests/orient.test.js` 原樣）。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 列）；本計畫與它的 design 的索引列由 plan 站補，task 不必再補。
- 版本號只用 `scripts/version.js` 動（`CONTRIBUTING.md` 的 Version numbers 列）；task 不動版本。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目由 land 站關，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `execFileSync(file, options)` 與 `spawnSync(file, options)` 可以省略 args，options 落在第二個位置；包裝只看第三個位置的話這種呼叫拿不到預設 timeout——Task 1——包裝先判斷第二個參數是不是陣列或 null／undefined，測試裡第三條直接驗省略 args 的形狀。
- 有測試本來就跑得久（`@slow`），120000 毫秒若太短會把正常的慢測試弄紅——Task 1——實作者跑完自己的測試檔後，跑 `npm run test:fast` 一次並回報 fail 數；suite 收尾時跑整套，紅的測名若含 `ETIMEDOUT` 就回到這裡把預設值調高，不逐檔加例外。
- `--require` 的路徑是相對 cwd 的 `./tests/...`；`suite.js` 在專案根跑，`npm test` 也在專案根——Task 1——不處理其他 cwd。

## Task 1: 預載模組與兩個 test script

**Files:**
- Modify: `package.json` — `scripts.test` 與 `scripts['test:fast']` 在 `--test` 之後加 `--require ./tests/subprocess-timeout.js`
- Modify: `tests/subprocess-timeout.js` — 新檔，預載包裝
- Modify: `README.md` — `## Development` 在 git timeout 那段之後加一段
- Read: `lib/suite.js` — `NODE_TEST`（第 18 行）與 `runSuite`，確認 script 仍被認作 node --test
- Test: `tests/subprocess-timeout.test.js`

**Interfaces:**
- Consumes: none
- Produces: 環境變數 `FANKEEL_TEST_SUBPROCESS_TIMEOUT`（毫秒，預設 120000）；`tests/subprocess-timeout.js` 載入後 `require('node:child_process').execFileSync`／`spawnSync`／`execSync` 是包裝過的版本

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/subprocess-timeout.test.js`, write:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PRELOAD = path.join(__dirname, 'subprocess-timeout.js');
const ROOT = path.join(__dirname, '..');

const child = (script, ms) => spawnSync(process.execPath, ['--require', PRELOAD, '-e', script], {
  encoding: 'utf8',
  timeout: 30000,
  env: { ...process.env, FANKEEL_TEST_SUBPROCESS_TIMEOUT: String(ms) },
});

test('a subprocess that never exits turns the call red instead of hanging', () => {
  const r = child("require('node:child_process').execFileSync(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])", 500);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ETIMEDOUT/);
});

test('a timeout the caller names is kept', () => {
  const r = child("const r = require('node:child_process').spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeout: 300 }); process.stdout.write(String(r.error && r.error.code))", 60000);
  assert.equal(r.stdout, 'ETIMEDOUT');
});

test('a call that leaves out args still gets the default', () => {
  const r = child("const r = require('node:child_process').spawnSync(process.execPath, { input: 'setInterval(() => {}, 1000)' }); process.stdout.write(String(r.error && r.error.code))", 500);
  assert.equal(r.stdout, 'ETIMEDOUT');
});

test('both test scripts load the preload and still read as node --test', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const name of ['test', 'test:fast']) {
    assert.match(scripts[name], /--require \.\/tests\/subprocess-timeout\.js/);
    assert.match(scripts[name], /\bnode\s+--test\b/);
  }
});
```

2. Run it and watch it fail: `node --test tests/subprocess-timeout.test.js` — 四條都紅（`Cannot find module`，`package.json` 沒有 `--require`）。

3. Write the preload. In `tests/subprocess-timeout.js`, write:

```js
'use strict';

// Loaded by `node --test --require ./tests/subprocess-timeout.js` (package.json's
// test and test:fast). A synchronous subprocess that never exits blocks the event
// loop, so --test-timeout cannot fire and the whole suite hangs — seven of eight
// runs did on 2026-10-16 (docs/90-agent/reports/2026-10-16-inflight-4-6-8.md §3).
// Every execFileSync, spawnSync and execSync that names no timeout gets one here,
// so a stuck child turns one test red instead.

const cp = require('node:child_process');

const ms = Number(process.env.FANKEEL_TEST_SUBPROCESS_TIMEOUT) || 120000;
const withTimeout = (opts) => (opts && opts.timeout !== undefined ? opts : { ...opts, timeout: ms });

for (const name of ['execFileSync', 'spawnSync']) {
  const original = cp[name];
  cp[name] = function (file, args, opts) {
    if (args == null || Array.isArray(args)) return original.call(this, file, args || [], withTimeout(opts));
    return original.call(this, file, withTimeout(args));
  };
}

const execSync = cp.execSync;
cp.execSync = function (command, opts) {
  return execSync.call(this, command, withTimeout(opts));
};
```

4. In `package.json`, change the two scripts so they read:

```json
    "test": "node --test --require ./tests/subprocess-timeout.js",
    "test:fast": "node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js",
```

5. Run it and watch it pass: `node --test tests/subprocess-timeout.test.js` — `ℹ pass 4`、`ℹ fail 0`。然後跑一次 `npm run test:fast 2>&1 | grep -E "^ℹ (pass|fail)"` 並回報兩行；有 fail 時另外回報 `grep -n ETIMEDOUT` 的命中數。

6. In `README.md`, under `## Development`, after the paragraph ending `set it to 30000.`, add this paragraph:

```md
Every synchronous subprocess a test starts has a timeout even when the test names none: `npm test` and `npm run test:fast` load `tests/subprocess-timeout.js` with `--require`, which gives `execFileSync`, `spawnSync` and `execSync` a default of 120000 milliseconds, or `FANKEEL_TEST_SUBPROCESS_TIMEOUT` when it is set. A child that never exits turns its own test red with `ETIMEDOUT` instead of hanging the run. Running one file with a bare `node --test tests/<file>` skips it; add `--require ./tests/subprocess-timeout.js` to get it there too.
```

7. `git add tests/subprocess-timeout.js tests/subprocess-timeout.test.js`，寫 commit 檔：`fix(tests): every synchronous subprocess in the suite has a timeout`。

## Coverage

| promise | task |
|---|---|
| 新檔 `tests/subprocess-timeout.js`：載入時把 `node:child_process` 的 `execFileSync`、`spawnSync`、`execSync` 換成同名包裝 | Task 1 |
| 預設值讀環境變數 `FANKEEL_TEST_SUBPROCESS_TIMEOUT`（毫秒），沒設時是 120000。 | Task 1 |
| 包裝在測試檔 `require('node:child_process')` 之前裝好，所以解構出來的 `execFileSync` 也是包裝過的；`tests/` 的 285 個測試檔都是 CommonJS，沒有 ESM。 | Task 1 |
| 逾時時 `execFileSync`／`execSync` 丟出 `ETIMEDOUT`，`spawnSync` 回傳的 `error.code` 是 `ETIMEDOUT`：那條測試變紅，其他測試照跑，suite 結束。 | Task 1 |
| 為什麼不逐處補 timeout：`tests/` 裡有 341 處 `execFileSync(`、125 處 `spawnSync(`、2 處 `execSync(`，其中只有 21 個檔提到 timeout；逐處改是 468 個呼叫的機械改寫，而且下一個新寫的測試就會漏掉。預載是一個地方管全部。 | struck — 理由說明，不是要做的事 |
| TODO 原本的做完條件是「grep `tests/` 找不到沒帶 timeout 的呼叫」；換成預載後這條 grep 不再適用，改由下面的兩條測試證明，條目關閉時在 body 記一句。 | struck — land 站關條目時在 body 記一句，不是 task 的工作 |
| `test` 從 `node --test` 改成 `node --test --require ./tests/subprocess-timeout.js` | Task 1 |
| `--require` 必須放在 `--test` 之後：`lib/suite.js:18` 的 `NODE_TEST` 是 `/\bnode\s+--test\b/`，放前面就認不出是 node --test，`runSuite` 不加 tap reporter、紀錄的 pass／fail 變成 null。 | Task 1 |
| `node --test` 會把 `--require` 傳給每個測試檔的子行程（Node v24.21.0 實測 `node --test --test-reporter=tap --require ./pre.js a.test.js`：preload 設的旗標在測試檔裡讀得到，`# pass 1`）。`scripts/suite.js` 讀的就是這兩個 script，所以 `suite.js` 與 `suite.js --fast` 也帶上。 | Task 1 |
| 不加 `--test-timeout`：同步呼叫卡住時事件迴圈停著，`--test-timeout` 的計時器根本不會觸發；非同步子行程卡住的情形量測裡沒有出現。struck，理由如上。 | struck — 同步呼叫卡住時計時器不會觸發，見 design |
| README 的 `## Development` 在 git timeout 那段之後加一句，說預載的存在、預設 120000 毫秒和那個環境變數。 | Task 1 |
| 子行程睡過逾時會紅而不是掛住 | Task 1 |
| 呼叫端自己給的 timeout 不被蓋掉 | Task 1 |
| 兩個 test script 都帶預載，suite 仍認得 | Task 1 |
