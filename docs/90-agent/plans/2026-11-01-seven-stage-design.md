---
status: design-intent
last_verified: 2026-11-01
---

# 七段詳細設計與實例單頁 Implementation Plan

**Goal:** 交付一份中文詳細設計頁、一頁去識別化的七段實例 HTML，並把 README 精簡到只剩簡介與安裝。

**Architecture:** 設計頁是設計階段逐段確認過的草稿定稿，放在給人讀的 `docs/01-guide/`。
單頁 HTML 自含（inline CSS、無外部資源），用白板任務的真實時間與事件畫八段。
README 只留簡介、安裝、三行用法與連結；每項交付各配一個 node:test 檔鎖住它的形狀。

**Tech Stack:** Node >=22.5（`package.json` engines），`node:test`、`node:assert/strict`，無任何依賴。

**Spec:** ../../../.fankeel/build/2026-11-01-seven-stage-design/design-draft.md

## Global Constraints

- `package.json` 沒有 `dependencies`，不得新增；測試只用 `node:test`、`node:assert/strict`、`node:fs`、`node:path`。
- `docs/01-guide/` 是 `role: reference`、`audience: human`（`.fankeel/docs.json`）：繁體中文，frontmatter 帶 `status`、`last_verified`、`source_of_truth`。
- docs-check 的 `long-sentence`：一句最多 160 欄（`scripts/docs-check.js:521` 的 ORDER 之一）。
- `docs/README.md:9` 寫著 `Twenty-six pages`；`tests/contract.test.js:361-383` 數 reference bucket 底下的 `.md` 頁，新增一頁就要改成 `Twenty-seven pages`。
- `README.md` 必須保留 `node <plugin>/scripts/uninstall.js` 且在 `claude plugin uninstall fankeel@fankeel` 之前（`tests/uninstall.test.js:72-77`）。
- `README.md` 必須含 `.fankeel/station.bat` 與 `station.sh`（`tests/station-launchers.test.js:75-80`）。
- 一次只跑一個 `npm test`（`README.md` 開發段）。
- 去識別詞（設計頁與單頁不得出現）：`F:/`、`F:\`、`ymlab`、`Chartroom`、`chartroom`、`Latex`、`claude.ai/code`、`ddb6de22`、`FanFantom`、`.ts.net`、`d89cc304`、`94f510ec`、`d5a8f499`、`893f29f8`、`943ee70d`、`36f226c7`、`40b61b39`。

## Risks

- 設計頁的長表格列超過 160 欄 — Task 1 — 寫完先跑 `node scripts/docs-check.js` 看有沒有 `long-sentence` 指向 `docs/01-guide/design.md`。
- docs-check 或 docs-audit 把 `docs/01-guide/seven-stages.html` 當未歸檔或孤兒 — Task 2 — 寫完跑 `node scripts/docs-audit.js | grep seven-stages`，有命中就在報告列出，不改 `docs.json`。
- 其他頁連到 `README.md#指令` 之類被刪的錨點 — Task 3 — 先跑 `grep -rn "README.md#" docs skills` 確認。

## Task 1: 詳細設計頁

**Files:**
- Modify: `docs/01-guide/design.md` — 新檔，草稿定稿
- Modify: `docs/README.md` — 索引加兩列，頁數字改成 Twenty-seven
- Read: `.fankeel/build/2026-11-01-seven-stage-design/design-draft.md` — 定稿的來源
- Test: `tests/guide-design.test.js`

**Interfaces:**
- Consumes: none
- Produces: 檔案 `docs/01-guide/design.md`，Task 3 的 README 連到它

**Dispatch:** in-session — 內容是這個 session 在設計階段逐段跟使用者確認的，轉手只會丟失那些修正。

1. Write the failing test.

In `tests/guide-design.test.js`, write:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'design.md');
const BANNED = ['F:/', 'F:\\', 'ymlab', 'Chartroom', 'chartroom', 'Latex', 'claude.ai/code', 'ddb6de22',
    'FanFantom', '.ts.net', 'd89cc304', '94f510ec', 'd5a8f499', '893f29f8', '943ee70d', '36f226c7', '40b61b39'];
const STAGES = ['INIT', 'SURVEY', 'DESIGN', 'PLAN', 'BUILD', 'VERIFY', 'AUDIT', 'LAND'];

test('the design page has eight stage sections, each with a mermaid diagram', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    STAGES.forEach((s, i) => assert.match(text, new RegExp('^## ' + i + '\\. ' + s + ' ', 'm'), s));
    assert.ok((text.match(/^```mermaid$/gm) || []).length >= 8, 'fewer than eight mermaid blocks');
});

test('the design page carries no identifying string', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const w of BANNED) assert.ok(!text.includes(w), 'design.md contains ' + w);
});

test('the docs index lists the design page and the seven-stage page', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'docs', 'README.md'), 'utf8');
    assert.ok(index.includes('01-guide/design.md'));
    assert.ok(index.includes('01-guide/seven-stages.html'));
});
```

2. Run it and watch it fail: `node --test tests/guide-design.test.js` — ENOENT on `design.md`.

3. Write the page. Copy the draft from its `## 0. INIT` heading through the end of `## 全程`, and drop `## 交付` and `## What proves it done`.
Then make exactly these edits:
   - `` `/chartroom/<專案>/` `` becomes `` `/board/<專案>/` ``.
   - Every sentence over 160 columns is split at its `；` or `——` into two sentences.

In `docs/01-guide/design.md`, put this above the copied `## 0. INIT`:

```md
---
status: current
last_verified: 2026-11-01
source_of_truth: lib/stages.js, lib/plantasks.js, lib/profile.js, docs/02-architecture/pipeline.md
---

# 詳細設計：一件任務怎麼走完七段

這頁把一件任務從 `/fankeel` 到收工逐段拆開：每段做什麼、為什麼、產出什麼，各配一張流程圖。
例子是一件真實跑完七段的任務，已去識別化——「監控站掛上另一個專案的白板」，下稱白板任務。
同一件任務畫成一頁的版本在 [seven-stages.html](seven-stages.html)；每段的英文規格在 [pipeline.md](../02-architecture/pipeline.md)。
```

4. In `docs/README.md`, change `Twenty-six pages` on line 9 to `Twenty-seven pages`.
On lines 9-10 replace `The front page has install, update and
uninstall, the two diagrams and a short introduction to each of these;` with
`The front page has install, update and
uninstall and a short introduction; the detailed design is design.md;`.
In `docs/README.md`, after the `concepts.md` row (line 18), add:

```md
| 一件真實任務逐段怎麼走：每段做什麼、平行派工、Agent 與 Workflow 差在哪（詳細設計） | [design.md](01-guide/design.md) |
| 同一件任務畫成一頁：八段時間軸、等待與做事、派工泳道 | [seven-stages.html](01-guide/seven-stages.html) |
```

5. Run it and watch it pass: `node --test tests/guide-design.test.js`; then `node --test tests/contract.test.js`.
Then run `node scripts/docs-check.js | grep design.md` and split any sentence it names.

6. Commit: `docs(guide): seven-stage detailed design page`.

## Task 2: 七段實例單頁

**Files:**
- Modify: `docs/01-guide/seven-stages.html` — 新檔，自含單頁
- Read: `.fankeel/build/2026-11-01-seven-stage-design/design-draft.md` — 每段的文字與數字來源
- Read: `assets/station/station.css` — 配色與字體的參考，不連結、不複製整檔
- Test: `tests/guide-seven-stages.test.js`

**Interfaces:**
- Consumes: none
- Produces: 檔案 `docs/01-guide/seven-stages.html`，Task 1 的索引與 Task 3 的 README 連到它

**Dispatch:** implementer, opus — 版面、長條圖與泳道怎麼畫是視覺設計判斷，計畫只給資料與結構。

1. Write the failing test.

In `tests/guide-seven-stages.test.js`, write:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'seven-stages.html');
const BANNED = ['F:/', 'F:\\', 'ymlab', 'Chartroom', 'chartroom', 'Latex', 'claude.ai/code', 'ddb6de22',
    'FanFantom', '.ts.net', 'd89cc304', '94f510ec', 'd5a8f499', '893f29f8', '943ee70d', '36f226c7', '40b61b39'];
const STAGES = ['init', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

test('the page has one section per stage, in route order', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    const found = [...text.matchAll(/data-stage="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(found)], STAGES);
    assert.match(text, /<html lang="zh-Hant">/);
});

test('the page loads nothing from outside itself', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    assert.doesNotMatch(text, /(src|href)="https?:/);
    assert.doesNotMatch(text, /@import/);
});

test('the page carries no identifying string', () => {
    const text = fs.readFileSync(PAGE, 'utf8');
    for (const w of BANNED) assert.ok(!text.includes(w), 'seven-stages.html contains ' + w);
});
```

2. Run it and watch it fail: `node --test tests/guide-seven-stages.test.js` — ENOENT.

3. Write the page. One file, `<html lang="zh-Hant">`, all CSS in one `<style>`, any script inline, no font or library from a URL.
It follows `prefers-color-scheme`. Every number on it comes from the data below; nothing is invented.

In `docs/01-guide/seven-stages.html`, embed this data in an inline `<script>` and draw from it:

```js
const RUN = {
    task: '監控站掛上另一個專案的白板',
    cls: 'architectural',
    total: { wall: '6 時 30 分', waited: '5 時 24 分', work: '約 1 時 6 分' },
    stages: [
        { id: 'init', name: 'INIT', wallMin: 0, waitMin: 0, does: '看現場、看別人、問一題、登記任務', sample: '任務來自 TODO 的「待決定」，使用者在選單選它' },
        { id: 'survey', name: 'SURVEY', wallMin: 10, waitMin: 8, does: '讀地圖、掃描、記事實、分類', sample: '掃 2075 檔，找到 3 個事實、3 件不知道，分類 architectural' },
        { id: 'design', name: 'DESIGN', wallMin: 19, waitMin: 16, does: '一個做法、檔案表、會失敗的完成標準', sample: '3 筆裁定、6 列檔案表、判斷不畫 mockup' },
        { id: 'plan', name: 'PLAN', wallMin: 16, waitMin: 1, does: '拆任務、產生約束、分組、lint、審計畫', sample: '3 個任務一條依賴鏈；reviewer 抓到 2 個缺口並修好' },
        { id: 'build', name: 'BUILD', wallMin: 322, waitMin: 290, does: '派實作者、逐任務審、提交、文件跟上、全套測試', sample: '3 組依序；修 15 條文件引用；3686 項 1 項搶埠失敗' },
        { id: 'verify', name: 'VERIFY', wallMin: 11, waitMin: 5, does: '宣稱對證據、平行 verifier、突變、對手審查', sample: '3 個 verifier 全過；對手抓到 2 點；先紅再綠未檢查' },
        { id: 'audit', name: 'AUDIT', wallMin: 5.5, waitMin: 4, does: 'docs-check、殘留、死碼、docs-audit、真的去讀', sample: '索引缺 2 頁、來源 TODO 還寫待決定；舊帳分開列' },
        { id: 'land', name: 'LAND', wallMin: 6, waitMin: 0.5, does: '全綠、TODO 結案、封存、重寫地圖、整合', sample: '3685 過、1 略過、0 失敗；merge 不推送' },
    ],
    tokens: { survey: '3k', design: '13k', plan: '9k', build: '66k', verify: '2k', audit: '4k' },
    depth: { chain: { tasks: 3, groups: 3 }, patrol: { tasks: 23, sequential: 15, byDepth: 6 } },
};
```

The page holds, top to bottom, each block a `<section>`:
   - a header: the task line, the class, and the three totals, with `等使用者` visibly the largest;
   - a horizontal bar per stage, split into 做事（`wallMin - waitMin`）and 等使用者（`waitMin`）, build drawn to scale;
   - eight `<section data-stage="<id>">` cards in route order, each with its name, `does`, `sample` and, where `tokens` has it, the token count;
   - inside the `build` card: two swimlanes, 多個 Agent（主控逐份收、回來一個提交一個、能插手）and Workflow（腳本內 implement→review、只回彙總、跑完前不提交）;
   - inside the `build` card: the depth comparison, 白板任務 3 tasks → 3 groups in a line, 盤點任務 23 tasks → 15 sequential vs 6 by depth;
   - a footer line linking `design.md` for the full write-up.

4. Run it and watch it pass: `node --test tests/guide-seven-stages.test.js`.

5. Commit: `docs(guide): seven-stage run as one page`.

## Task 3: README 精簡

**Files:**
- Modify: `README.md` — 只留簡介、安裝、三行用法、連結與開發
- Modify: `docs/02-architecture/pipeline.md:299-410` — 兩處仍說首頁有每段一行與 gate 圖
- Read: `tests/uninstall.test.js` — README 要保留的移除順序
- Read: `tests/station-launchers.test.js` — README 要保留的兩個啟動檔名
- Test: `tests/readme-short.test.js`

**Interfaces:**
- Consumes: 路徑 `docs/01-guide/design.md`（Task 1）與 `docs/01-guide/seven-stages.html`（Task 2），只當連結
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶全文，轉錄加測試。

1. Write the failing test.

In `tests/readme-short.test.js`, write:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

test('the README stays short: no diagram, under seventy lines', () => {
    assert.ok(!README.includes('```mermaid'), 'README carries a mermaid block');
    assert.ok(README.split('\n').length < 70, 'README is ' + README.split('\n').length + ' lines');
});

test('the README keeps install and points at the design pages', () => {
    assert.ok(README.includes('claude plugin install fankeel@fankeel'));
    assert.ok(README.includes('docs/01-guide/design.md'));
    assert.ok(README.includes('docs/01-guide/seven-stages.html'));
});
```

2. Run it and watch it fail: `node --test tests/readme-short.test.js` — the mermaid assertion fails.

3. Replace the whole of `README.md` with:

````md
# FanKeel

> **English.** fankeel is a Claude Code plugin for long-running projects. Each session holds one task and walks it through up to seven stages — survey, design, plan, build, verify, audit, land — stopping at a gate after each to ask you. It remembers what was tried and warns when two live sessions edit the same file. The guides are in Traditional Chinese under [docs/01-guide](docs/01-guide/); the design reference, [docs/02-architecture](docs/02-architecture/), is in English.

fankeel 是 Claude Code 插件。每個 session 扛一件任務，照路線一段一段走，每段做完停下來問你。
它記得試過什麼，兩個 session 動到同一個檔時會提醒你。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。不用裝別的套件，Node 22.5 以上即可。

**更新**——先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

**移除**——先跑 `uninstall.js` 清掉專案外的檔（加 `--dry-run` 只列不刪），再移除插件。
`<plugin>` 在 `~/.claude/plugins/cache/fankeel/fankeel/<版本>/`；專案裡的 `.fankeel/` 會留著。

```
node <plugin>/scripts/uninstall.js
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

## 怎麼用

1. 在專案目錄打 `/fankeel`，說要做什麼。
2. 每段做完停在 gate：選項一往下一段，選項二留下，選項三暫停。
3. 監控站把所有 session 畫成一頁；分頁關了，Windows 雙擊 `.fankeel/station.bat`，其他系統執行 `.fankeel/station.sh`。

## 想看更多

| 想知道 | 頁面 |
|---|---|
| 一件真實任務逐段怎麼走（詳細設計） | [design.md](docs/01-guide/design.md) |
| 同一件任務畫成一頁 | [seven-stages.html](docs/01-guide/seven-stages.html) |
| 從安裝到走完第一條路線 | [開始使用](docs/01-guide/getting-started.md) |
| 七段、三種類別、指令 | [概念](docs/01-guide/concepts.md) |
| 全部文件 | [docs/README.md](docs/README.md) |
| 開發與測試 | [development.md](docs/01-guide/development.md)、[CONTRIBUTING.md](CONTRIBUTING.md) |

## 開發

```
npm test
claude plugin validate .
```

一次只跑一個 `npm test`。
````

4. In `docs/02-architecture/pipeline.md`, lines 300-301: replace `and in one line each on the
[front page](../../README.md).` with
`and walked through on one real task in
[design.md](../01-guide/design.md).`.
Lines 408-409: replace `so the gate is drawn once, on the
[front page](../../README.md), and left off all seven here.` with
`so the gate is described once, in
[concepts.md](../01-guide/concepts.md), and left off all seven here.`.

5. Run it and watch it pass: `node --test tests/readme-short.test.js tests/uninstall.test.js tests/station-launchers.test.js`.

6. Commit: `docs: README cut to intro and install`.

## Coverage

| promise | task |
|---|---|
| `docs/01-guide/design.md` 本草稿定稿：八段，每段 mermaid＋步驟表＋去識別化的白板例子 | Task 1 |
| `docs/01-guide/seven-stages.html` 單頁、自含：八段時間軸、等待與做事長條、Agent／Workflow 泳道、依賴深度對照 | Task 2 |
| `README.md` 只留簡介與安裝（含更新、移除），刪 mermaid 與長段，連到上面兩頁 | Task 3 |
| `docs/README.md` 索引加兩列，頁數字改成 Twenty-seven | Task 1 |
| `tests/guide-design.test.js`：設計頁存在、八段各有 mermaid、無去識別詞 | Task 1 |
| `tests/guide-seven-stages.test.js`：單頁存在、八個 `data-stage`、不載入外部資源、無去識別詞 | Task 2 |
| `tests/readme-short.test.js`：README 無 mermaid、少於 70 行、連到兩頁、保留安裝指令 | Task 3 |
| `node scripts/docs-check.js` 無這次造成的 finding | Task 1 |
