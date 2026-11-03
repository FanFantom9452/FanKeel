---
status: current
last_verified: 2026-11-03
---

# 跨機回顧：專案卡與來源分級 Implementation Plan

**Goal:** 別人送來的對話包能附專案卡、記下來源與版本，retro 與 retro-all 依「這項發現要不要懂那個專案」決定算不算數，本機找不到對話時有請使用者給 ZIP 的路徑。
**Architecture:** 送出端 `record.js export --project-card` 多放一個遮蔽過的 `project.md`；接收端 `record.js import` 接受只有對話包的非正式 ZIP，並在 `.fankeel/imports/<名稱>/intake.json` 記來源、有無專案卡、送出端版本，`sessions --list` 讀它；retro agent 給每項發現一個面向，架構面向在沒有專案卡又非本機時只回 `unverified:` 行；retro-all 照面向計入 recurring。
**Tech Stack:** Node >=22.13，沒有外部相依（`package.json` 無 dependencies）；測試用 `node:test` 與 `assert/strict`，暫存目錄一律取自 `tests/tmp.js`。
**Spec:** [../todo/record-2.md](../todo/record-2.md)

## Global Constraints

由 `node scripts/map.js` 與專案本身取得，原值照抄：

- 此 repo 沒有 `CLAUDE.md`；慣例來自既有檔案：`scripts/record.js` 與它的測試用 4 格縮排，`lib/registry.js` 與 `tests/docs.test.js` 這類用 2 格，改哪個檔就跟那個檔。
- `package.json` 的 `engines.node` 是 `>=22.13`，沒有 dependencies，不得新增相依。
- `scripts/record.js` 的 `fail(msg)` 把訊息印到 stdout 再 `process.exit(1)`（`record.js:48`）；測試讀的是 stdout 加 stderr 合併。
- `OPTIONS` 是 `lib/skills.js` 讀 script 旗標的字面表（`record.js:23` 註解）；新旗標必須寫進這張表。
- `tests/record-export.test.js:67` 釘死 manifest 的鍵集合，`:65` 釘死 ZIP 內容順序為 `manifest.json, report.md, bundles/…`：預設匯出（不給 `--project-card`）一個鍵、一個項目都不能多。
- `tests/record-export.test.js:194` 釘死拒收訊息開頭 `Nothing written: <zip> holds no export manifest.json`；有 `bundles/` 但無 manifest 的 ZIP 仍須被拒。
- `tests/record-bundle.test.js:88,127,137` 釘死 `sessions --list` 本機列的格式 `… MB  local  retro: none|filed`，imported 以外的列不得變。
- `tests/skill-size.test.js:27`：每個 SKILL.md 有自己的位元組上限（`fankeel-retro-all` 現為 3700，目前 3699 bytes）；超過要在同一個改動裡把上限調高。
- `tests/agents.test.js:451-470` 釘死 `agents/fankeel-retro.md`：tools 為 `[Read, Grep, Glob, Bash]`、model `opus`、`## Job` 含 `At most five hunks`、`## Return` 含 `` `evidence: turn <n> — ``、`A hunk with no evidence line is not returned`、`## Refuse` 含 `` `refused: no session id` ``。
- `tests/docs.test.js:548`：`.fankeel/.gitignore` 的每個路徑，`docs/90-agent/reference/documents.md` 的壽命表都要點名；`imports/` 一列已在該表。
- 文件頁帶 `last_verified:` frontmatter；改過的 agent 與 skill 檔把它更新為 `2026-11-03`。
- `lib/` 不得向上依賴 `scripts/` 或 `hooks/`；本計畫所有程式都在 `scripts/record.js`，不新增 `lib/` 引用方向。

## Risks

- 專案卡把 `.fankeel/map.md`、`CLAUDE.md` 內容帶出機器，可能含家目錄路徑或敏感字 — Task 2 — 先寫測試：家目錄與 `sensitive.txt` 的詞在 `project.md` 裡都不得出現，再寫實作。
- 接受非正式 ZIP 會放寬 `importZip` 的入口，可能讓檔名不合格的內容落進 `.fankeel/bundles/` — Task 3 — 只收 ZIP 頂層、檔名符合 `BUNDLE_NAME` 的項目；`bundles/…` 無 manifest 的 ZIP 仍被拒。
- Task 2 與 Task 3 都改 `scripts/record.js`，ledger 會讓它們依序跑 — Task 3 — 先確認 Task 2 的 `projectCard` 與 `--project-card` 已在，再動 `importZip`。
- retro-all 的 SKILL.md 只剩 1 byte 餘裕，改完必超過上限 — Task 5 — 改完先量 `wc -c`，在同一個 commit 調高 `tests/skill-size.test.js` 的上限。
- `ensureLayout` 每個 hook 都會跑，多一行 gitignore 不可拖慢它或改掉手寫的行 — Task 1 — 沿用已有的 `launched` 單次檢查與 `ensureIgnored` 的「只補缺的」行為。

## Task 1: `.fankeel/imports/` 進 gitignore

**Files:**
- Modify: `lib/registry.js:222-232` — `ensureLayout` 把 `imports/` 與站台啟動檔一起補進 `.fankeel/.gitignore`
- Modify: `.fankeel/.gitignore` — 本 repo 自己提交的那份補上 `imports/` 一行
- Test: `tests/registry-imports-ignore.test.js`

**Interfaces:**
- Consumes: `ensureIgnored(projectRoot, names)`（同檔，只補缺的行、不動手寫的行）
- Produces: 任何經 `ensureLayout` 的專案，`.fankeel/.gitignore` 都含一行 `imports/`

**Dispatch:** implementer, sonnet — 一行程式加測試，計畫已附全碼。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/registry-imports-ignore.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const ignoreOf = (root) => fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8').split(/\r?\n/).filter(Boolean);

test('ensureLayout lists imports/ in .fankeel/.gitignore on a fresh project', () => {
  const root = tmp('fankeel-imp-ign-');
  registry.ensureLayout(root);
  const lines = ignoreOf(root);
  assert.ok(lines.includes('sessions/'), lines.join(','));
  assert.ok(lines.includes('imports/'), lines.join(','));
});

test('ensureLayout adds imports/ to an older .gitignore and keeps a line added by hand', () => {
  const root = tmp('fankeel-imp-ign-');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', '.gitignore'), 'sessions/\nmine/\n');
  registry.ensureLayout(root);
  const lines = ignoreOf(root);
  assert.ok(lines.includes('mine/') && lines.includes('imports/'), lines.join(','));
  assert.equal(lines.filter((l) => l === 'imports/').length, 1);
});
```

- [ ] **Step 2: 跑，確認失敗**

```sh
node --test tests/registry-imports-ignore.test.js
```

預期：兩個測試都因缺 `imports/` 而失敗。

- [ ] **Step 3: 實作**

In `lib/registry.js`, in `ensureLayout()` (lines 222-232), the `try` block names `launchers.NAMES`; add `imports/` beside them so the function reads:

```js
function ensureLayout(projectRoot) {
    const dir = sessionsDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(stateDir(projectRoot), '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'sessions/\n');
    if (launched.has(projectRoot)) return;
    launched.add(projectRoot);
    try {
        // `imports/` holds ZIPs other people sent, unmasked here; nothing under
        // it is ever meant for git, whether `record.js import` or a hand unzip put it there.
        ensureIgnored(projectRoot, launchers.NAMES.concat('imports/'));
        launchers.write(projectRoot);
    } catch (e) { /* a launcher is a convenience; see above */ }
}
```

In `.fankeel/.gitignore`, append one line at the end of the file:

```text
imports/
```

- [ ] **Step 4: 跑，確認通過**

```sh
node --test tests/registry-imports-ignore.test.js tests/docs.test.js
```

預期：全綠（`docs.test.js:548` 讀到 `imports/`，壽命表已有該列）。

- [ ] **Step 5: Commit**

```sh
git add lib/registry.js .fankeel/.gitignore tests/registry-imports-ignore.test.js
git commit -m "fix: ignore .fankeel/imports/ in every project's gitignore"
```

## Task 2: 匯出可附專案卡

**Files:**
- Modify: `scripts/record.js` — `OPTIONS` 加 `project-card`；新增 `projectCard()`；`exportZip` 在旗標開啟時多放 `project.md`；usage 字串
- Read: `lib/sensitive.js` — `readList` 與 `redact(value, words, counts)` 的行為，不改
- Test: `tests/record-project-card.test.js`

**Interfaces:**
- Consumes: `registry.readAll(root).entries`（`{ sessionId, data }`，`data.task`、`data.route`、`data.record`、`data.sessions`）、`sensitive.redact`、`exportZip` 內既有的 `mask`
- Produces: `record.js export … --project-card` 在 ZIP 的 `report.md` 之後放 `project.md`（已遮蔽家目錄與敏感字）；stdout 多一行 `project.md: attached`；缺 `.fankeel/map.md` 時 `Nothing written:` 並退出 1。不給旗標時 ZIP 與 manifest 與現在完全相同。

**Dispatch:** implementer, sonnet — 計畫已附全碼，轉錄加測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/record-project-card.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const zip = require('../lib/zip.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const WIN = process.platform === 'win32';
const HOME = WIN ? 'C:\\Users\\zedtester' : '/home/zedtester';
const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';
const A = '2026-11-01-aaaaaaaa.jsonl.gz';

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, HOME, USERPROFILE: HOME } }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

// One bundle, one registry entry for its session, a sensitive word, and a
// map.md and CLAUDE.md that each carry the word and the home directory.
function seed({ map = true } = {}) {
    const root = tmp('fankeel-card-');
    fs.mkdirSync(path.join(root, '.fankeel', 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'bundles', A),
        zlib.gzipSync(JSON.stringify({ bundle: 1, sessions: ['aaaaaaaa'], files: ['aaaaaaaa.jsonl'], redacted: {} }) + '\n'));
    fs.writeFileSync(path.join(root, '.fankeel', 'sensitive.txt'), 'zedsecret\n');
    if (map) fs.writeFileSync(path.join(root, '.fankeel', 'map.md'), '# demo — map\n\nread first: README.md\nzedsecret lives at ' + HOME + '\\proj\n');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Rules\n\n- keep four spaces\nplain prose line that is not a highlight\n## Commits\n');
    registry.ensureLayout(root);
    registry.writeSession(root, SESSION, { task: '卡片任務', stage: 'land', route: ['design', 'land'], active: false, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    return root;
}

const exported = (root, out) => path.join(root, ...(/^export: (\S+)$/m.exec(out)[1]).split('/'));
const entries = (file) => new Map(zip.read(fs.readFileSync(file)).map((e) => [e.name, e.data]));

test('--project-card adds project.md with the map, CLAUDE.md highlights and the task route, masked', () => {
    const root = seed();
    const r = run(root, ['export', '--bundles', 'aaaaaaaa', '--project-card']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^project\.md: attached$/m);
    const got = entries(exported(root, r.out));
    assert.deepEqual([...got.keys()], ['manifest.json', 'report.md', 'project.md', 'bundles/' + A]);
    const card = got.get('project.md').toString('utf8');
    assert.match(card, /^# 專案卡/);
    assert.ok(card.includes('read first: README.md'), 'the map is missing');
    assert.ok(card.includes('# Rules') && card.includes('- keep four spaces') && card.includes('## Commits'), 'CLAUDE.md headings and bullets are missing');
    assert.ok(!card.includes('plain prose line'), 'CLAUDE.md prose is not a highlight');
    assert.ok(card.includes('卡片任務') && card.includes('design → land'), 'the task route is missing');
    assert.ok(!/zedtester/i.test(card), 'the home directory survived');
    assert.ok(!card.includes('zedsecret') && card.includes('[REDACTED:word]'), 'the sensitive word survived');
});

test('without --project-card the ZIP has no project.md', () => {
    const root = seed();
    const r = run(root, ['export', '--bundles', 'aaaaaaaa']);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual([...entries(exported(root, r.out)).keys()], ['manifest.json', 'report.md', 'bundles/' + A]);
    assert.doesNotMatch(r.out, /project\.md/);
});

test('--project-card with no .fankeel/map.md is refused by name and nothing is written', () => {
    const root = seed({ map: false });
    const r = run(root, ['export', '--bundles', 'aaaaaaaa', '--project-card']);
    assert.equal(r.code, 1);
    assert.match(r.out, /Nothing written: .*map\.md/);
    assert.ok(!fs.existsSync(path.join(root, '.fankeel', 'exports')));
});
```

- [ ] **Step 2: 跑，確認失敗**

```sh
node --test tests/record-project-card.test.js
```

預期：第一個與第三個測試失敗（旗標未知，`parseArgv` 丟出 unknown option）。

- [ ] **Step 3: 旗標與 usage**

In `scripts/record.js`, in the `OPTIONS` table, after the `'keep-home'` line add:

```js
    'project-card': { type: 'boolean' },
```

In `scripts/record.js`, in `main()`, in the last `fail(` usage string, change `[--global-packages] [--keep-home]` to:

```js
[--global-packages] [--keep-home] [--project-card]
```

- [ ] **Step 4: 專案卡函式**

In `scripts/record.js`, directly above `function exportZip(opts, cross) {`, add:

```js
const CARD_MAP_LINES = 120;
const CARD_CLAUDE_LINES = 60;

// 專案卡: what a reader who has never seen this project needs in order to
// judge a finding about its architecture — the map, CLAUDE.md's headings and
// bullets, and the route and record of the task each bundle came from. Null
// when there is no map. Unmasked: the caller masks the home directory and
// redacts the sensitive words, as it does the report.
function projectCard(root, projectRoot, ids) {
    const read = (rel) => { try { return fs.readFileSync(path.join(projectRoot, ...rel.split('/')), 'utf8'); } catch (e) { return null; } };
    const map = read('.fankeel/map.md');
    if (!map) return null;
    const out = ['# 專案卡', '', '## 地圖（.fankeel/map.md）', '', map.split(/\r?\n/).slice(0, CARD_MAP_LINES).join('\n'), ''];
    const claude = read('CLAUDE.md');
    const picked = claude ? claude.split(/\r?\n/).filter((l) => /^(#{1,3} |\s*[-*] )/.test(l)).slice(0, CARD_CLAUDE_LINES) : [];
    if (picked.length) out.push('## CLAUDE.md 重點', '', picked.join('\n'), '');
    const tasks = registry.readAll(root).entries.filter((e) => ids.some((id8) => e.sessionId.slice(0, 8) === id8
        || (Array.isArray(e.data.sessions) && e.data.sessions.some((s) => String(s).slice(0, 8) === id8))));
    if (tasks.length) {
        out.push('## 這次任務', '');
        for (const { data } of tasks) {
            out.push('- ' + (data.task || '（無名）') + '：路線 ' + (Array.isArray(data.route) ? data.route.join(' → ') : '?')
                + (data.record && data.record.file ? '，紀錄 ' + data.record.file + '#' + data.record.anchor : ''));
        }
        out.push('');
    }
    return out.join('\n');
}
```

- [ ] **Step 5: 接進 exportZip**

In `scripts/record.js`, in `exportZip()`, directly after the `const text = sensitive.redact(mask(…` statement, add:

```js
    let card = null;
    if (opts['project-card']) {
        const raw = projectCard(root, projectRoot, ids);
        if (!raw) fail('Nothing written: --project-card needs .fankeel/map.md; run node scripts/map.js first.');
        card = sensitive.redact(mask(raw), list.words, {});
    }
```

In `scripts/record.js`, in `exportZip()`, in the `zip.write([` list, put the card between the report and the bundles:

```js
        { name: 'report.md', data: Buffer.from(text) },
        ...(card ? [{ name: 'project.md', data: Buffer.from(card) }] : []),
        ...bundles.map((b) => ({ name: 'bundles/' + b.name, data: b.gz })),
```

In `scripts/record.js`, in `exportZip()`, in the closing `process.stdout.write([` array, insert before the `'把這個檔案用私下管道傳回去，不要上傳到 Gitea。'` element:

```js
        ...(card ? ['project.md: attached'] : []),
```

- [ ] **Step 6: 跑，確認通過**

```sh
node --test tests/record-project-card.test.js tests/record-export.test.js
```

預期：全綠；`record-export` 的 manifest 鍵與項目順序沒變。

- [ ] **Step 7: Commit**

```sh
git add scripts/record.js tests/record-project-card.test.js
git commit -m "feat: export can attach a masked project card"
```

## Task 3: 匯入接受非正式 ZIP，記下來源、專案卡與版本

**Files:**
- Modify: `scripts/record.js` — `importZip` 接受頂層放對話包的非正式 ZIP、寫 `intake.json` 與 `project.md`；`listBundles` 把匯入的包標成 `imported`
- Modify: `docs/90-agent/reference/documents.md:182-183` — `exports/` 與 `imports/` 兩列補上專案卡與 `intake.json`
- Read: `lib/zip.js` — `read`/`write` 的項目形狀（`{ name, data }`），不改
- Test: `tests/record-intake.test.js`

**Interfaces:**
- Consumes: ZIP 內的 `project.md`（Task 2 的 `--project-card` 產物）、`manifest.fankeel.installed|working`；`BUNDLE_NAME`、`readJson`、`sha256`、`fail`（同檔既有）
- Produces: `.fankeel/imports/<名稱>/intake.json` = `{ source: 'imported', imported: <ISO>, informal: boolean, projectCard: boolean, fankeelVersion: string|null, bundles: [<name>…] }`；有卡時同夾多一份 `project.md`；非正式 ZIP 的 `retro.md` 存成同夾的 `report.md`；`sessions --list` 對匯入的包印 `<路徑>  <大小> MB  imported  retro: <filed|none>  card: <yes|no>  fankeel <版本|?>`，其餘列不變；`record.js import` 多印一行 `intake: …`

**Dispatch:** implementer, sonnet — 計畫已附全碼，轉錄加測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/record-intake.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const zip = require('../lib/zip.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const NAME = '2026-11-02-e8d01398.jsonl.gz';
const LOCAL = '2026-11-01-aaaaaaaa.jsonl.gz';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const gz = (id) => zlib.gzipSync(JSON.stringify({ bundle: 1, sessions: [id], files: [id + '.jsonl'], redacted: {} }) + '\n');

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

function zipTo(root, stem, items) {
    const file = path.join(root, stem + '.zip');
    fs.writeFileSync(file, zip.write(items.map(([name, data]) => ({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) }))));
    return file;
}

test('an informal ZIP — a bundle and a retro.md, no manifest — is accepted and recorded as imported', () => {
    const root = tmp('fankeel-intake-');
    const file = zipTo(root, 'informal-2026-11-02', [['retro.md', 'retro: e8d01398 — 40 turns read, 0 hunks\nclean\n'], [NAME, gz('e8d01398')]]);
    const r = run(root, ['import', file]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^intake: imported · informal · project card no · fankeel \?$/m);
    assert.ok(fs.existsSync(path.join(root, '.fankeel', 'bundles', NAME)));
    const dir = path.join(root, '.fankeel', 'imports', 'informal-2026-11-02');
    assert.match(fs.readFileSync(path.join(dir, 'report.md'), 'utf8'), /^retro: e8d01398/);
    const intake = JSON.parse(fs.readFileSync(path.join(dir, 'intake.json'), 'utf8'));
    assert.equal(intake.source, 'imported');
    assert.equal(intake.informal, true);
    assert.equal(intake.projectCard, false);
    assert.equal(intake.fankeelVersion, null);
    assert.deepEqual(intake.bundles, [NAME]);
    assert.match(fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8'), /^imports\/$/m);
    const list = run(root, ['sessions', '--list']);
    assert.match(list.out, /e8d01398\.jsonl\.gz\s+[\d.]+ MB\s+imported\s+retro: none\s+card: no\s+fankeel \?/);
});

test('a formal export with project.md records the card and the sender\'s fankeel version', () => {
    const root = tmp('fankeel-intake-');
    const data = gz('e8d01398');
    const manifest = { export: 1, fankeel: { working: null, installed: '0.150.0' }, node: 'v22.13.0', platform: 'win32', osRelease: '10', claudeCode: [],
        bundles: [{ name: NAME, bytes: data.length, sha256: sha256(data) }] };
    const file = zipTo(root, 'retro-2026-11-02', [['manifest.json', JSON.stringify(manifest)], ['report.md', 'clean\n'], ['project.md', '# 專案卡\n'], ['bundles/' + NAME, data]]);
    const r = run(root, ['import', file]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^intake: imported · manifest · project card yes · fankeel 0\.150\.0$/m);
    const dir = path.join(root, '.fankeel', 'imports', 'retro-2026-11-02');
    assert.equal(fs.readFileSync(path.join(dir, 'project.md'), 'utf8'), '# 專案卡\n');
    const intake = JSON.parse(fs.readFileSync(path.join(dir, 'intake.json'), 'utf8'));
    assert.deepEqual([intake.informal, intake.projectCard, intake.fankeelVersion], [false, true, '0.150.0']);
    assert.match(run(root, ['sessions', '--list']).out, /imported\s+retro: none\s+card: yes\s+fankeel 0\.150\.0/);
});

test('a bundle made on this machine stays local in the list', () => {
    const root = tmp('fankeel-intake-');
    fs.mkdirSync(path.join(root, '.fankeel', 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'bundles', LOCAL), gz('aaaaaaaa'));
    const file = zipTo(root, 'informal-x', [[NAME, gz('e8d01398')]]);
    assert.equal(run(root, ['import', file]).code, 0);
    const out = run(root, ['sessions', '--list']).out;
    assert.match(out, /aaaaaaaa\.jsonl\.gz\s+[\d.]+ MB\s+local\s+retro: none\s*$/m);
    assert.match(out, /e8d01398\.jsonl\.gz\s+[\d.]+ MB\s+imported/);
});

test('a ZIP with neither a manifest nor a top-level bundle is refused, and writes nothing', () => {
    const root = tmp('fankeel-intake-');
    const nested = zipTo(root, 'nested', [['bundles/' + NAME, gz('e8d01398')]]);
    const stray = zipTo(root, 'stray', [['notes.txt', 'hello'], ['retro.md', 'clean\n']]);
    for (const file of [nested, stray]) {
        const r = run(root, ['import', file]);
        assert.equal(r.code, 1, file);
        assert.match(r.out, /Nothing written: \S+ holds no export manifest\.json and no <date>-<id8>\.jsonl\.gz at its top level/);
    }
    assert.ok(!fs.existsSync(path.join(root, '.fankeel')));
});
```

- [ ] **Step 2: 跑，確認失敗**

```sh
node --test tests/record-intake.test.js
```

預期：除了最後一個以外都失敗（非正式 ZIP 被拒、沒有 `intake:` 行）；最後一個失敗在訊息尾巴。

- [ ] **Step 3: 重寫 importZip**

In `scripts/record.js`, replace the whole `importZip` function (from `function importZip(opts, zipFile) {` through its closing `}` just above the `// docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §7` comment) with:

```js
function importZip(opts, zipFile) {
    if (!zipFile) fail('record.js import <zip>: name the ZIP to read.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    let entries;
    try { entries = zip.read(fs.readFileSync(zipFile)); } catch (e) { fail('Nothing written: ' + zipFile + ' — ' + (e.code || e.message) + '.'); }
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    const manifest = byName.has('manifest.json') ? readJson(byName.get('manifest.json')) : null;
    const formal = Boolean(manifest) && manifest.export === 1 && Array.isArray(manifest.bundles);
    // An informal ZIP is what somebody zipped by hand: bundles at its top level
    // and perhaps a retro.md, no manifest. One with `bundles/` and no manifest
    // is a damaged export, and stays refused.
    const topLevel = entries.map((e) => e.name).filter((n) => BUNDLE_NAME.test(n));
    if (!formal && (byName.has('manifest.json') || !topLevel.length)) {
        fail('Nothing written: ' + zipFile + ' holds no export manifest.json and no <date>-<id8>.jsonl.gz at its top level, so it is not a retro export.');
    }
    const listed = formal ? manifest.bundles : topLevel.map((name) => ({ name, sha256: sha256(byName.get(name)) }));
    const dataOf = (b) => byName.get((formal ? 'bundles/' : '') + b.name);
    const bad = [];
    for (const b of listed) {
        const data = dataOf(b);
        if (!BUNDLE_NAME.test(String(b.name))) bad.push(b.name + ' is not a bundle name');
        else if (!data) bad.push(b.name + ' is missing');
        else if (sha256(data) !== b.sha256) bad.push(b.name + ' does not match its sha256');
    }
    if (bad.length) fail('Nothing written: ' + bad.join('; ') + '.');
    // `...zip` leaves `..`, which would put manifest.json in .fankeel/ itself.
    const stem = path.basename(zipFile).replace(/\.zip$/i, '');
    if (/^\.*$|[\\/]/.test(stem)) fail('Nothing written: ' + JSON.stringify(path.basename(zipFile)) + ' leaves no folder under .fankeel/imports/ to file it in; rename it, e.g. retro-<date>.zip.');
    registry.ensureIgnored(projectRoot, ['bundles/', 'imports/']);
    const dir = path.join(projectRoot, '.fankeel', 'bundles');
    fs.mkdirSync(dir, { recursive: true });
    const written = [];
    const skipped = [];
    for (const b of listed) {
        const target = path.join(dir, b.name);
        if (fs.existsSync(target)) { skipped.push(b.name); continue; }
        fs.writeFileSync(target, dataOf(b));
        written.push(b.name);
    }
    const into = path.join(projectRoot, '.fankeel', 'imports', stem);
    fs.mkdirSync(into, { recursive: true });
    if (formal) fs.writeFileSync(path.join(into, 'manifest.json'), byName.get('manifest.json'));
    const report = byName.get('report.md') || byName.get('retro.md');
    if (report) fs.writeFileSync(path.join(into, 'report.md'), report);
    const card = byName.get('project.md');
    if (card) fs.writeFileSync(path.join(into, 'project.md'), card);
    const fk = (formal && manifest.fankeel) || {};
    const version = fk.installed || fk.working || null;
    // A name this ZIP skipped because an earlier import of the same ZIP wrote it
    // stays imported; one already here from this machine's own export does not.
    const before = readJson(path.join(into, 'intake.json'));
    const kept = before && Array.isArray(before.bundles) ? before.bundles.filter((n) => skipped.includes(n)) : [];
    const intake = { source: 'imported', imported: new Date().toISOString(), informal: !formal, projectCard: Boolean(card), fankeelVersion: version, bundles: written.concat(kept) };
    fs.writeFileSync(path.join(into, 'intake.json'), JSON.stringify(intake, null, 2) + '\n');
    const out = ['imported: ' + written.length + ' bundles into .fankeel/bundles/'];
    if (skipped.length) out.push('skipped: ' + skipped.join(', ') + ' (already here, not overwritten)');
    out.push('report: .fankeel/imports/' + stem + '/report.md',
        formal
            ? 'manifest: fankeel ' + (version || '?') + ' · node ' + manifest.node + ' · ' + manifest.platform + ' ' + manifest.osRelease
                + ' · Claude Code ' + ((manifest.claudeCode || []).join(', ') || '?') + ' · ' + manifest.bundles.length + ' bundles'
            : 'manifest: none — informal ZIP, ' + listed.length + ' bundles',
        'intake: imported · ' + (formal ? 'manifest' : 'informal') + ' · project card ' + (card ? 'yes' : 'no') + ' · fankeel ' + (version || '?'));
    process.stdout.write(out.join('\n') + '\n');
}
```

- [ ] **Step 4: 重寫 listBundles**

In `scripts/record.js`, replace the whole `listBundles` function with the two functions below (the `importedBundles` helper goes right above it):

```js
// The bundles this machine received rather than made: name -> its intake.json.
function importedBundles(projectRoot) {
    const base = path.join(projectRoot, '.fankeel', 'imports');
    const out = new Map();
    let dirs = [];
    try { dirs = fs.readdirSync(base); } catch (e) { return out; }
    for (const d of dirs) {
        const intake = readJson(path.join(base, d, 'intake.json'));
        if (intake && intake.source === 'imported' && Array.isArray(intake.bundles)) for (const n of intake.bundles) out.set(n, intake);
    }
    return out;
}

function listBundles(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const records = recordsRel(projectRoot);
    const recordsDir = path.join(projectRoot, ...records.split('/'));
    const months = monthsText(recordsDir);
    const imported = importedBundles(projectRoot);
    const rows = [];
    for (const [dir, where] of [['.fankeel/bundles', 'local'], [records + '/sessions', 'committed']]) {
        let names = [];
        try { names = fs.readdirSync(path.join(projectRoot, ...dir.split('/'))).filter((n) => n.endsWith('.jsonl.gz')).sort(); } catch (e) { continue; }
        for (const n of names) {
            const bytes = fs.statSync(path.join(projectRoot, ...dir.split('/'), n)).size;
            const filed = months.includes('<summary>retro ' + n.slice(11, 19) + ' ');
            const intake = where === 'local' ? imported.get(n) : null;
            rows.push(dir + '/' + n + '  ' + (bytes / 1048576).toFixed(1) + ' MB  ' + (intake ? 'imported' : where) + '  retro: ' + (filed ? 'filed' : 'none')
                + (intake ? '  card: ' + (intake.projectCard ? 'yes' : 'no') + '  fankeel ' + (intake.fankeelVersion || '?') : ''));
        }
    }
    process.stdout.write((rows.length ? rows.join('\n') : 'no bundles') + '\n');
}
```

- [ ] **Step 5: 更新壽命表**

In `docs/90-agent/reference/documents.md`, replace the two rows for `exports/` and `imports/` (lines 182-183) with:

```md
| `exports/retro-<day>-<hash>.zip` | 否 | `record.js export` 打包的 retro ZIP：報告與敏感字遮蔽後的對話；只有一個包時可不給 `--cross`，報告就只放該包的 retro；加 `--project-card` 時多附一張專案卡 `project.md`（地圖、CLAUDE.md 重點、任務路線，同樣遮蔽）；不清理 |
| `imports/<名稱>/` | 否 | `record.js import` 解開的 ZIP：`report.md`（非正式 ZIP 的 `retro.md` 也存成它）、有的話 `project.md`、驗過 CRC、sha256 的內容，以及 `intake.json`（來源 `imported`、有無專案卡、送出端 fankeel 版本）；不清理 |
```

- [ ] **Step 6: 跑，確認通過**

```sh
node --test tests/record-intake.test.js tests/record-export.test.js tests/record-bundle.test.js tests/docs.test.js
```

預期：全綠；`record-export.test.js:194` 的拒收訊息前綴仍相符，`record-bundle.test.js` 的 `local`/`committed` 列沒變。

- [ ] **Step 7: Commit**

```sh
git add scripts/record.js docs/90-agent/reference/documents.md tests/record-intake.test.js
git commit -m "feat: import takes an informal ZIP and records source, card and sender version"
```

## Task 4: retro agent 給每項發現一個面向

**Files:**
- Modify: `agents/fankeel-retro.md` — frontmatter `last_verified`、新增 `## Facets`、evidence 行帶面向、本機找不到對話時回 `needs: zip`
- Test: `tests/retro-facets.test.js`

**Interfaces:**
- Consumes: 派工 brief 的 `source local|imported`（缺省視為 `local`）與 `card <path>|none`
- Produces: 每個 hunk 的 evidence 行為 `evidence: turn <n> — "<引文>" · facet: <面向>`；不成立的架構面向發現回一行 `unverified: <發現> — turn <n> — facet: 架構理解疏漏`（不是 hunk）；本機找不到對話回單行 `needs: zip — no transcript for <id>`。六個面向名：`架構理解疏漏`、`鬼打牆`、`可平行未平行`、`關卡或驗證被跳過`、`工具故障`、`其他流程`。

**Dispatch:** implementer, sonnet — 計畫已附全文，轉錄加測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/retro-facets.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-retro.md'), 'utf8').replace(/\s+/g, ' ');

test('the retro names the six facets and tags each evidence line with one', () => {
  for (const f of ['架構理解疏漏', '鬼打牆', '可平行未平行', '關卡或驗證被跳過', '工具故障', '其他流程']) {
    assert.ok(text.includes('`' + f + '`'), f);
  }
  assert.match(text, /`evidence: turn <n> — "<at most fifteen words, quoted from that turn>" · facet: <facet>`/);
});

test('an architecture finding stands only for a local source or a card, else it is an unverified: line', () => {
  assert.match(text, /`source local\|imported`/);
  assert.match(text, /`card <path>\|none`/);
  assert.match(text, /`unverified: <finding> — turn <n> — facet: 架構理解疏漏`/);
  assert.match(text, /not a hunk/);
});

test('a conversation that is not on this machine comes back as needs: zip', () => {
  assert.match(text, /`needs: zip — no transcript for <id>`/);
  assert.match(text, /asks the user for a ZIP/);
});
```

- [ ] **Step 2: 跑，確認失敗**

```sh
node --test tests/retro-facets.test.js
```

預期：三個測試都失敗。

- [ ] **Step 3: 改 agent 檔**

In `agents/fankeel-retro.md`, in the frontmatter, change `last_verified: 2026-10-19` to:

```md
last_verified: 2026-11-03
```

In `agents/fankeel-retro.md`, directly above the `## Return` heading, insert these two sections:

```md
## Facets

Every candidate carries the one facet that fits it best:

- `架構理解疏漏` — the session misread how the project is built.
- `鬼打牆` — the same attempt or question repeated without anything new.
- `可平行未平行` — independent work done one piece after another.
- `關卡或驗證被跳過` — a gate, a test or a check the rules require was skipped or waved through.
- `工具故障` — a script, hook or tool failed.
- `其他流程` — anything else about how the work was run.

Only the first needs the project to check. Your brief may name
`source local|imported` (none means `local`) and `card <path>|none`. A
`架構理解疏漏` candidate stands when the source is `local`, or when a card is
named and you Read it and it backs the finding. Otherwise it is not a hunk:
return one line, `unverified: <finding> — turn <n> — facet: 架構理解疏漏`.
The other five facets need only the conversation and stand from any source.

## Not on this machine

When your brief names a session and no bundle, and
`conversation.js --session` prints `no transcript for session`, the
conversation is not under `~/.claude/projects` here. Return the single line
`needs: zip — no transcript for <id>` and stop; the session that sent you
asks the user for a ZIP, imports it with `record.js import`, and sends you
again with a `bundle`.

```

In `agents/fankeel-retro.md`, in `## Return`, replace the line that gives the evidence format with:

```md
`evidence: turn <n> — "<at most fifteen words, quoted from that turn>" · facet: <facet>`.
```

- [ ] **Step 4: 跑，確認通過**

```sh
node --test tests/retro-facets.test.js tests/agents.test.js
```

預期：全綠（`agents.test.js:465` 的 `` `evidence: turn <n> — `` 前綴仍在）。

- [ ] **Step 5: Commit**

```sh
git add agents/fankeel-retro.md tests/retro-facets.test.js
git commit -m "feat: retro tags each finding with a facet and marks unverifiable architecture findings"
```

## Task 5: retro-all 依面向計入 recurring，並寫明本機找不到對話時請使用者給 ZIP

**Files:**
- Modify: `skills/fankeel-retro-all/SKILL.md` — 步驟 1 到 5 與 frontmatter `last_verified`
- Modify: `tests/skill-size.test.js:27` — `fankeel-retro-all` 的上限調高（改完這個 skill 必超過 3700）
- Test: `tests/retro-all-facets.test.js`

**Interfaces:**
- Consumes: `sessions --list` 對匯入列印的 `imported`、`card: yes|no`、`fankeel <版本>`（Task 3）；`record.js export --project-card`（Task 2）；retro agent 的 `facet:`、`unverified:`、`needs: zip`（Task 4）；`record.js import` 收非正式 ZIP（Task 3）
- Produces: retro-all 的報告多一種行 `unverified: <問題> — <id8> turn <t>`；步驟 4 的 multiSelect 多一格 `附上專案地圖`（預設不勾，加 `--project-card`）

**Dispatch:** implementer, sonnet — 計畫已附全文，轉錄加測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/retro-all-facets.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-retro-all', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');

test('the dispatch passes the source and the card to each retro', () => {
  assert.match(text, /`source local\|imported`/);
  assert.match(text, /`card <path>`/);
  assert.match(text, /`card none`/);
});

test('only an architecture finding is weighed by source; the others count from anywhere', () => {
  assert.match(text, /`架構理解疏漏`/);
  assert.match(text, /`unverified:`/);
  assert.match(text, /never counted toward "two or more bundles"/);
  assert.match(text, /`鬼打牆`/);
});

test('the export gate offers 附上專案地圖, off by default, as --project-card', () => {
  assert.match(text, /附上專案地圖/);
  assert.match(text, /`--project-card`/);
});

test('a conversation not under ~/.claude/projects is asked of the user as a ZIP', () => {
  assert.match(text, /~\/\.claude\/projects/);
  assert.match(text, /informal/);
  assert.match(text, /`conversation\.js --bundle/);
});
```

- [ ] **Step 2: 跑，確認失敗**

```sh
node --test tests/retro-all-facets.test.js
```

預期：四個測試都失敗。

- [ ] **Step 3: 改 skill**

In `skills/fankeel-retro-all/SKILL.md`, in the frontmatter, change `last_verified: 2026-11-02` to:

```md
last_verified: 2026-11-03
```

In `skills/fankeel-retro-all/SKILL.md`, in `## 1. List`, directly after the line `Ask which to read — all, or a date range — with \`AskUserQuestion\`.`, add:

```md
A bundle from another machine reads `imported`, then `card: yes|no` and
`fankeel <version>`, which `record.js import` recorded.
```

In `skills/fankeel-retro-all/SKILL.md`, in `## 2. Read`, replace the sentence `prompt \`session <id8>\`, \`bundle <path>\` and \`<plugin>\`.` with:

```md
prompt `session <id8>`, `bundle <path>`, `<plugin>`, `source local|imported` as the
list says, and `card <path>` — the `project.md` beside that import's
`intake.json` in the import folder under .fankeel — or `card none`.
```

In `skills/fankeel-retro-all/SKILL.md`, in `## 3. Rank`, replace the paragraph that starts `A problem is **recurring**` with:

```md
A problem is **recurring** when two or more bundles carry evidence for it, by
its facet. `鬼打牆`, `可平行未平行`, `關卡或驗證被跳過`, `工具故障` and `其他流程`
count from any source. `架構理解疏漏` counts only from a `local` bundle or one
with a card; the retro returns the rest as `unverified:` lines, listed in the
report and never counted toward "two or more bundles". A bundle whose
`fankeel` is older than this plugin's gets `（fankeel <version> 較舊）` after
its evidence: the problem may be fixed. Only a recurring problem gets a hunk —
five at most, by bundles — touching `skills/`, `agents/`, `lib/stages.js` or
`CLAUDE.md`. A problem seen once is a `once:` line, no hunk: one session is no evidence. A fix that needs code is a `backlog:`
line.
```

In `skills/fankeel-retro-all/SKILL.md`, in the report template of `## 3. Rank`, add one line after the `once:` line:

```md
    unverified: <problem> — <id8> turn <t>
```

In `skills/fankeel-retro-all/SKILL.md`, in `## 4. File, then the gate`, replace the sentence that begins `On 匯出 ZIP 回傳` with:

```md
On 匯出 ZIP 回傳, one more `AskUserQuestion` with `multiSelect: true` and
no box preselected: 記錄全域 Node 套件 adds `--global-packages`;
保留原路徑（不換 [HOME]） adds `--keep-home`; 附上專案地圖 adds `--project-card`,
a masked `project.md` the reader needs to check architecture findings. Then run
```

In `skills/fankeel-retro-all/SKILL.md`, at the end of `## 5. 收到 ZIP`, add:

```md
A conversation that is not under `~/.claude/projects` on this machine — a retro
that returned `needs: zip`, or an older session from another computer — is asked of the
user as a ZIP. Either an export or an informal one will do: `<date>-<id8>.jsonl.gz`
at its top level, with or without a `retro.md`. Run `record.js import` on it,
then step 1; `conversation.js --bundle <file.jsonl.gz>` also reads one directly.
```

- [ ] **Step 4: 調高上限**

量改完的大小，並把 `tests/skill-size.test.js` 的 `fankeel-retro-all` 上限改成高於它的最小百分位數：

```sh
CAP=$(( ($(wc -c < skills/fankeel-retro-all/SKILL.md) / 100 + 1) * 100 ))
sed -i "s/'fankeel-retro-all': 3700,/'fankeel-retro-all': $CAP,/" tests/skill-size.test.js
grep -n "fankeel-retro-all" tests/skill-size.test.js
```

預期：那一行的數字大於 3700，且是 100 的倍數。

- [ ] **Step 5: 跑，確認通過**

```sh
node --test tests/retro-all-facets.test.js tests/skill-size.test.js tests/inventory.test.js
```

預期：全綠。

- [ ] **Step 6: Commit**

```sh
git add skills/fankeel-retro-all/SKILL.md tests/skill-size.test.js tests/retro-all-facets.test.js
git commit -m "feat: retro-all counts findings by facet and asks for a ZIP when the conversation is elsewhere"
```

## Coverage

| promise | task |
|---|---|
| 權重不按「誰送來的」，按「這項發現要不要懂那個專案」。鬼打牆、可平行未平行、關卡或驗證被跳過、工具故障，看對話就能判斷，任何來源都算數；只有「架構理解疏漏」要知道專案原貌才能查證。 | Task 4 (agent 面向與 `unverified:`)、Task 5 (retro-all 照面向計入) |
| 送出端：ZIP 多附一張專案卡 project.md，取自 map.md、CLAUDE.md 重點、這次任務的路線與任務紀錄，同樣經過敏感字遮蔽；匯出時多一個勾選「附上專案地圖」，預設不勾。 | Task 2 (`--project-card` 與 `project.md`)、Task 5 (勾選 附上專案地圖，預設不勾) |
| 接收端：import 時每個對話包記下來源（local 或 imported）、有沒有專案卡、送出端的 fankeel 版本（舊版的問題可能已修好）。 | Task 3 (`intake.json` 與 `sessions --list`)、Task 5 (較舊版本標註) |
| retro agent 回報的每一項標上面向；架構面向的發現只在有專案卡或是本機專案時算數，否則列為 unverified:，不計入「兩個以上 bundle」的 recurring 門檻。 | Task 4 (面向標籤與 `unverified:`)、Task 5 (不計入 recurring) |
| scripts/record.js 的 import 只收有 manifest.json 的 export ZIP；只含 `<date>-<id8>.jsonl.gz` 加 `retro.md` 的非正式 ZIP 會被拒絕。 | Task 3 |
| retro、retro-all 及需要查舊 session 的分析，預設對話紀錄在本機 ~/.claude/projects；找不到時沒有「請使用者給 ZIP、讀匯入的對話包」的路徑。scripts/conversation.js --bundle 已能讀 .jsonl.gz。 | Task 4 (`needs: zip`)、Task 5 (請使用者給 ZIP、讀匯入的包；`conversation.js` 不需改)；land 的 retro 不需處理：`skills/fankeel-land/SKILL.md:283-285` 一律帶剛在本機匯出的 `bundle <path>`，不會回 `needs: zip` |
| .fankeel/imports/ 不在 .fankeel/.gitignore，匯入的未遮蔽對話包可能被誤 commit。 | Task 1 |
| 開一個任務從 design 做，定案上面的設計方向。 | struck — 使用者 2026-11-03 同意直接進 plan，免 design |
| 匯出 ZIP 可選附專案卡，import 記下來源與有無專案卡。 | Task 2、Task 3 |
| retro 與 retro-all 依面向決定發現算不算數。 | Task 4、Task 5 |
| import 接受非正式 ZIP，或另有收件指令；相關 skill 寫明本機找不到對話時請使用者給 ZIP。 | Task 3 (接受非正式 ZIP)、Task 5 (skill 寫明請使用者給 ZIP) |
| .fankeel/imports/ 加進 gitignore。 | Task 1 |
