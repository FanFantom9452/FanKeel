---
status: design-intent
last_verified: 2026-10-12
---

# fankeel-init 設自動壓縮視窗 Implementation Plan

**Goal:** fankeel-init 的第 7 步在沒設視窗的機器上問一題，答是就把 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫進使用者層 `settings.json` 的 `env`，答否記住、不再問。
**Architecture:** 一支新的命令列腳本 `scripts/compact-window.js` 有三個動詞：`show` 讀現況、`set <n>` 寫入、`decline` 記下「不設」。skill 的第 7 步只負責問那一題並呼叫腳本。不動 `lib/`、不動 `onboard.js`、不新增 profile 鍵。
**Tech Stack:** Node 內建模組（`node:fs`、`node:path`、`node:test`、`node:assert/strict`）；`package.json` 沒有任何 dependency，不得新增。
**Spec:** [2026-10-12-init-compact-window-design.md](2026-10-12-init-compact-window-design.md)

## Global Constraints

- 測試用 `node --test`（`package.json` 的 `scripts.test`）；實作者只跑自己的測試檔，整套由主 session 跑。
- 新檔要先 `git add`，`tests/source.test.js` 才看得到它（`CONTRIBUTING.md:19`）。
- 每個匯出的名字都要有人 import（`CONTRIBUTING.md:19`）：`scripts/compact-window.js` 不匯出任何東西，測試走命令列。
- `scripts/` 與 `lib/` 縮排 4 個空白，`tests/` 縮排 2 個空白，檔頭 `'use strict';`。
- 測試要暫存目錄一律用 `require('./tmp.js')`（`tests/tmp.js`），不自己 `mkdtemp`。
- `README.md` 的目錄樹每一列都要有職責說明，否則 `onboard.js` 的 `tree` 檢查 fail（`lib/onboard.js:31`）。
- 不得改 `lib/context.js` 與 `docs/01-guide/profile.md`：另一個還活著的 session 握著它們，guard 是 `deny`。
- skill 與腳本的說明文字用英文，和所在檔案一致；commit 訊息照 `git log` 的樣子：`type: 一句話 - path: 細節`。
- 版本號不手改（`scripts/version.js` 才能動）。

## Risks

- `set` 重寫整個 `settings.json`，原本的縮排與註解樣式會變成兩格縮排的 JSON — Task 1 — 測試只比對解析後的內容相等，並在 `set` 的輸出印出檔案路徑讓使用者知道哪個檔被改。
- 寫在 `settings.json` `env` 的變數，主機的自動壓縮是否照樣吃到，沒有量過 — Task 2 的問題說明 — 這份 plan 不解，留給 verify 在真的 session 量。
- `tests/init-skill.test.js` 之外若有測試釘住 skill 的位元組上限 — Task 2 — 主 session 在 commit 前跑整套。

## Task 1: compact-window.js

**Files:**
- Modify: `scripts/compact-window.js` — 新檔，`show`、`set <n>`、`decline`
- Modify: `README.md:236-240` — 目錄樹在 `onboard.js` 那一列下面多一列
- Read: `lib/profile.js:118-132` — `machineFile` 與 `configDirOf`
- Read: `scripts/onboard.js` — `main` 回 `{ text, code }` 的寫法
- Read: `tests/onboard-cli.test.js:1-45` — 用 `execFileSync` 與 `CLAUDE_CONFIG_DIR` 跑腳本的寫法
- Test: `tests/compact-window.test.js`

**Interfaces:**
- Consumes: `profile.configDirOf(env)` 回設定目錄的字串或 `null`；`profile.machineFile(configDir)` 回 `<configDir>/fankeel/profile.json`
- Produces: 命令列 `node scripts/compact-window.js show` 印 `set <n>`、`declined` 或 `unset` 並 exit 0；`set <n>` 成功 exit 0、拒絕 exit 1；`decline` exit 0；其他用法 exit 2

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. Create `tests/compact-window.test.js`:

```js
'use strict';

// docs/90-agent/plans/2026-10-12-init-compact-window-design.md §1 and §2.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'compact-window.js');
const WINDOW = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function run(cfg, args, extra) {
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
  delete env[WINDOW];
  Object.assign(env, extra);
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env }).trim(), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || '').trim(), code: e.status };
  }
}

const settings = (cfg) => path.join(cfg, 'settings.json');

test('show prints unset on a machine with nothing set', () => {
  assert.deepEqual(run(tmp('fankeel-cw-'), ['show']), { out: 'unset', code: 0 });
});

test('show prints set <n> from the environment and from settings.json', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['show'], { [WINDOW]: '450000' }).out, 'set 450000');
  fs.writeFileSync(settings(cfg), JSON.stringify({ env: { [WINDOW]: '200000' } }));
  assert.equal(run(cfg, ['show']).out, 'set 200000');
  fs.writeFileSync(settings(cfg), JSON.stringify({ env: { [WINDOW]: '0' } }));
  assert.equal(run(cfg, ['show']).out, 'unset');
});

test('decline is remembered, and a later set wins over it', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['decline']).code, 0);
  assert.ok(fs.existsSync(path.join(cfg, 'fankeel', 'compact-window.declined')));
  assert.equal(run(cfg, ['show']).out, 'declined');
  assert.equal(run(cfg, ['set', '450000']).code, 0);
  assert.equal(run(cfg, ['show']).out, 'set 450000');
});

test('set keeps every other key, and show reads back the number it wrote', () => {
  const cfg = tmp('fankeel-cw-');
  fs.writeFileSync(settings(cfg), JSON.stringify({ model: 'opus', env: { FOO: '1' } }));
  const got = run(cfg, ['set', '450000']);
  assert.equal(got.code, 0);
  assert.ok(got.out.includes(settings(cfg)), got.out);
  const written = JSON.parse(fs.readFileSync(settings(cfg), 'utf8'));
  assert.deepEqual(written, { model: 'opus', env: { FOO: '1', [WINDOW]: '450000' } });
  assert.equal(run(cfg, ['show']).out, 'set ' + written.env[WINDOW]);
});

test('set creates settings.json where there was none', () => {
  const cfg = tmp('fankeel-cw-');
  assert.equal(run(cfg, ['set', '300000']).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(settings(cfg), 'utf8')), { env: { [WINDOW]: '300000' } });
});

test('set refuses a bad number, a file that does not parse and an env that is no object, and writes nothing', () => {
  const cfg = tmp('fankeel-cw-');
  for (const bad of ['abc', '0', '-5', '4.5', '']) {
    assert.equal(run(cfg, ['set', bad]).code, 1, JSON.stringify(bad));
    assert.ok(!fs.existsSync(settings(cfg)), JSON.stringify(bad));
  }
  for (const body of ['{ not json', '[]', '{"env":"x"}']) {
    fs.writeFileSync(settings(cfg), body);
    const got = run(cfg, ['set', '450000']);
    assert.equal(got.code, 1, body);
    assert.ok(got.out.includes(settings(cfg)), got.out);
    assert.equal(fs.readFileSync(settings(cfg), 'utf8'), body);
  }
});

test('anything else is a usage line and exit 2', () => {
  const cfg = tmp('fankeel-cw-');
  for (const args of [[], ['get'], ['set'], ['show', 'x']]) {
    const got = run(cfg, args);
    assert.equal(got.code, 2, args.join(' '));
    assert.match(got.out, /usage: compact-window\.js show \| set <n> \| decline/);
  }
});
```

2. Run it and watch it fail:

```sh
node --test tests/compact-window.test.js
```

Expected: every test fails, because `scripts/compact-window.js` does not exist.

3. Write the implementation. Create `scripts/compact-window.js`:

```js
#!/usr/bin/env node
'use strict';

// Whether this machine has an auto-compact window, and the one write that
// gives it one:
//
//   node scripts/compact-window.js show
//   node scripts/compact-window.js set <n>
//   node scripts/compact-window.js decline
//
// `show` prints `set <n>`, `declined` or `unset`. `set` writes the variable
// under "env" in <configDir>/settings.json and leaves every other key as it
// was; `decline` leaves a marker so fankeel-init does not ask again.
// docs/90-agent/plans/2026-10-12-init-compact-window-design.md §1 and §2.
// The name and the positive-number rule are lib/context.js's, typed again
// here the way tests/render.test.js does: that module exports neither.

const fs = require('node:fs');
const path = require('node:path');

const profile = require('../lib/profile.js');

const WINDOW = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function windowOf(env) {
    const n = Number(env && env[WINDOW]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// A missing file is an empty one; a file that is there and does not hold a
// JSON object is `unreadable`, and nothing is written over it.
function readSettings(file) {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? { values: {} } : { unreadable: true }; }
    try {
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { unreadable: true };
        return { values: parsed };
    } catch (e) {
        return { unreadable: true };
    }
}

const settingsFile = (configDir) => path.join(configDir, 'settings.json');
const declinedFile = (configDir) => path.join(path.dirname(profile.machineFile(configDir)), 'compact-window.declined');

function show(configDir, env) {
    const n = windowOf(env) || windowOf((readSettings(settingsFile(configDir)).values || {}).env);
    if (n) return 'set ' + n;
    return fs.existsSync(declinedFile(configDir)) ? 'declined' : 'unset';
}

function set(configDir, raw) {
    const file = settingsFile(configDir);
    if (!/^[1-9]\d*$/.test(raw)) return { ok: false, reason: 'set <n>: a positive whole number of tokens, such as 450000' };
    const current = readSettings(file);
    const fix = '; fix it by hand first';
    if (current.unreadable) return { ok: false, reason: file + ' does not parse' + fix };
    const env = current.values.env;
    if (env !== undefined && (!env || typeof env !== 'object' || Array.isArray(env))) return { ok: false, reason: file + ' has an "env" that is not an object' + fix };
    const next = Object.assign({}, current.values, { env: Object.assign({}, env, { [WINDOW]: raw }) });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, file };
}

function decline(configDir) {
    const file = declinedFile(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, new Date().toISOString() + '\n');
    return file;
}

function main(argv, env) {
    const configDir = profile.configDirOf(env);
    if (!configDir) return { text: 'compact-window.js: no config directory to read', code: 1 };
    const [verb, n] = argv;
    if (verb === 'show' && argv.length === 1) return { text: show(configDir, env), code: 0 };
    if (verb === 'decline' && argv.length === 1) return { text: 'declined  → ' + decline(configDir), code: 0 };
    if (verb === 'set' && argv.length === 2) {
        const out = set(configDir, n);
        if (!out.ok) return { text: 'compact-window.js: ' + out.reason, code: 1 };
        return { text: 'set ' + n + '  → ' + out.file + '\nRestart Claude Code: every session opened on this machine reads it from then on.', code: 0 };
    }
    return { text: 'usage: compact-window.js show | set <n> | decline', code: 2 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2), process.env);
    process.stdout.write(text + '\n');
    process.exitCode = code;
}
```

4. In `README.md`, in the directory tree under `├── scripts/`, directly below the `onboard.js` row, add this row (keep the tree's own box characters and indentation as on the row above it):

```text
│   ├── compact-window.js  whether this machine has an auto-compact window: show, set <n>, decline
```

5. Stage the new files so `tests/source.test.js` can see them, then run the test and watch it pass:

```sh
git add scripts/compact-window.js tests/compact-window.test.js
node --test tests/compact-window.test.js
```

Expected: `pass 7`, `fail 0`.

6. Write the commit file the brief footer asks for, with the three paths `scripts/compact-window.js`, `tests/compact-window.test.js`, `README.md` and this message:

```text
feat: compact-window.js shows, sets and declines the auto-compact window - scripts/compact-window.js: show prints set <n>, declined or unset; set writes env.CLAUDE_CODE_AUTO_COMPACT_WINDOW in the user-level settings.json and keeps every other key; decline leaves a marker - tests/compact-window.test.js: the three states, the refusals and the read-back - README.md: the tree names the script
```

## Task 2: fankeel-init 第 7 步問那一題

**Files:**
- Modify: `skills/fankeel-init/SKILL.md` — 第 7 步多一項，frontmatter 的 `last_verified` 與 `source_of_truth`
- Read: `scripts/compact-window.js` — Task 1 寫出的三個動詞與它們印的字
- Test: `tests/init-skill.test.js`

**Interfaces:**
- Consumes: Task 1 的命令列 — `compact-window.js show` 印 `set <n>`、`declined` 或 `unset`；`compact-window.js set <n>`；`compact-window.js decline`
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus one test.

1. Write the failing test. In `tests/init-skill.test.js`, append at the end of the file:

```js
// docs/90-agent/plans/2026-10-12-init-compact-window-design.md §3.
test('step 7 asks for the auto-compact window only when show prints unset, and writes only on an answer', () => {
  const t = text();
  const step = t.slice(t.indexOf('## 7. Profile'), t.indexOf('## 8. Close'));
  const f = step.replace(/\s+/g, ' ');
  assert.match(f, /scripts\/compact-window\.js show/);
  assert.match(f, /only `unset` is asked/);
  assert.match(f, /450000/);
  assert.match(f, /scripts\/compact-window\.js set <n>/);
  assert.match(f, /scripts\/compact-window\.js decline/);
  assert.match(f, /the user's own `settings\.json`/);
  assert.match(f, /restarted/);
  assert.match(f, /No answer writes nothing/);
  assert.match(t.split(/\n---\r?\n/)[0], /^source_of_truth: .*scripts\/compact-window\.js/m);
});
```

2. Run it and watch it fail:

```sh
node --test tests/init-skill.test.js
```

Expected: the new test fails on `scripts/compact-window.js show`; the six older tests pass.

3. Write the text. In `skills/fankeel-init/SKILL.md`, at the end of `## 7. Profile` — after the `commit.format` bullet and before the `## 8. Close` heading — add this paragraph and bullet:

```md
One more question belongs to the machine, not to the profile, and is asked
whatever the scout's `profile` row says:

- The auto-compact window —
  `node <plugin>/scripts/compact-window.js show` prints `set <n>`, `declined`
  or `unset`, and only `unset` is asked: one `AskUserQuestion` with 450000 as
  the recommended option, 不設 as the second, and **Other** for a number of
  the user's own. The descriptions say what a yes does: it writes
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` under `env` in the user's own
  `settings.json`, every session opened on this machine reads it and not only
  fankeel's, and Claude Code has to be restarted before it takes effect. A
  number runs `node <plugin>/scripts/compact-window.js set <n>`; 不設 runs
  `node <plugin>/scripts/compact-window.js decline`, and no later run asks
  again. No answer writes nothing.
```

4. In `skills/fankeel-init/SKILL.md`, in the frontmatter at the top of the file, replace the `last_verified:` and `source_of_truth:` lines with:

```md
last_verified: 2026-10-12
source_of_truth: scripts/onboard.js, lib/onboard.js, agents/fankeel-init-scout.md, scripts/compact-window.js
```

5. Run the test and watch it pass:

```sh
node --test tests/init-skill.test.js
```

Expected: `pass 7`, `fail 0`.

6. Write the commit file the brief footer asks for, with the two paths `skills/fankeel-init/SKILL.md`, `tests/init-skill.test.js` and this message:

```text
feat: fankeel-init asks for the auto-compact window on a machine that has none - skills/fankeel-init/SKILL.md: step 7 runs compact-window.js show and asks only on unset; a number runs set, a no runs decline - tests/init-skill.test.js: the step names the three commands and what a yes writes
```

## Coverage

| promise | task |
|---|---|
| `show` 印一行狀態：`set <n>`（環境變數或 `<configDir>/settings.json` 的 `env` 已有正數）、`declined`（標記檔存在）、或 `unset`；`set` 優先於 `declined`。 | Task 1 |
| `set <n>` 把 `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫成字串 `<n>`，檔案裡其他的鍵與 `env` 裡其他的變數原樣保留；檔案不存在就建立只含這個 `env` 的檔。 | Task 1 |
| `set` 拒絕不是正整數的 `<n>`，也拒絕解析不了的 `settings.json`，兩種都不寫檔、exit 非 0，並印出檔案路徑。 | Task 1 |
| `decline` 寫下標記檔 `<configDir>/fankeel/compact-window.declined`，這是「答否不再重問」記住的地方。 | Task 1 |
| `<configDir>` 用 `lib/profile.js` 的 `configDirOf()`；變數名與「正數才算設了」的判斷在腳本裡自己寫一份，和 `tests/render.test.js:502` 一樣。 | Task 1 |
| 不新增 profile 的鍵；答否由 `compact-window.js decline` 的標記檔記住，寫在機器層，因為視窗是每台機器一次的設定。 | Task 1 |
| `skills/fankeel-init/SKILL.md` 第 7 步多一項：跑 `compact-window.js show`，只有 `unset` 才問一題 `AskUserQuestion`；scout 的 `profile` 列是 `done` 也照跑。 | Task 2 |
| 那一題三個選項：設 450000（建議）、不設、Other 讓使用者自己填數字；說明寫清楚它改的是使用者自己的 Claude 設定檔、對這台機器之後開的每個 session 都生效、要重開 Claude Code 才吃到。 | Task 2 |
| 答是跑 `compact-window.js set <n>`；答否跑 `compact-window.js decline`；沒有答案什麼都不寫。 | Task 2 |
