---
status: design-intent
last_verified: 2026-09-09
source_of_truth: docs/plans/2026-09-09-gate-and-controls-design.md
---

# Gate and Controls Implementation Plan

**Goal:** 一支 fail-closed 的 skills 閘門，加上 `eval.js` 兩條沒做的污染控制，加上讓
profile 格式決定有底的證據報告，加上 `sources.md` 缺的兩列。

**Architecture:** 閘門照這個 repo 已有的 CLI/lib 分離做——純函式在 `lib/skills.js`，
argv、掃描與報告文字在 `scripts/skills-check.js`，exit code 由 findings 數決定，形狀抄
`docs-check.js` / `lib/docs.js`。`eval.js` 改的是契約而不是用法：拒跑未釘 model，並把
花費從 stream-json 讀出來報。profile 這件只產證據，格式留給後續決定。

**Tech Stack:** Node 內建 `node:test`（`package.json` 的 `test` 是 `node --test`），
無外部相依，`private: true`。Node `util.parseArgs` 已在九支 script 用著。

**Spec:** [2026-09-09-gate-and-controls-design.md](2026-09-09-gate-and-controls-design.md)

## Global Constraints

從 `CONTRIBUTING.md` 的 `## Scope and ownership` 表、`.fankeel/map.md` 與
`package.json` 抄來的實數，不是回憶：

- `lib/*.js` 是純函式，直接測。**`lib/` 不得反向碰 `scripts/` 或 `hooks/`**，只有另一
  個方向可以（`CONTRIBUTING.md` 的 Core logic 列）。
- `scripts/*.js` 是 `lib/` 的薄殼（同表 CLI entry points 列）。
- 測試用 `node --test`。**每個 export 的名字都要有 importer，而且新檔要先 `git add`，
  `tests/source.test.js` 才看得見它**——它用 `git ls-files` 列檔（`tests/source.test.js:17-20`）。
- 文件：新頁面在**同一個 change** 裡拿到它的索引列（同表 Documentation 列）。歸檔照
  `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/reports` 是 report。
- `TODO.md`：一件事一個 bullet，細節放在 bullet 連過去的檔裡，不寫在條目上。
- 版本號用 `node scripts/version.js` 移動，十處一起（`scripts/version.js:4-16`）。本計畫
  不移動版本號。
- commit 用 conventional commits，這棵樹的實際樣子是 `fix(docs):`、`feat(map):`、
  `test(evidence):`（`git log --oneline`）。
- 注入區塊有位元組上限，`lib/stages.js` 的規則不預設有空間可加字——Task 2 有一步是量它。
- 每個 task 的收尾是 `node --test tests/` 全綠（spec reporter 看 `ℹ pass|fail`，沒有 ok
  行），不是等到最後一次才跑：共用一棵樹的時候，只跑自己那個測試檔看不見跨檔的紅。

## File structure

| file | 責任 |
|---|---|
| `lib/skills.js` | 新。純函式：從 skill 文字抽出 script 與 flag 引用、從 script 原始碼讀出它接受哪些 flag、把兩邊比對成 findings。不碰檔案系統以外的任何東西，不 require `scripts/`。 |
| `scripts/skills-check.js` | 新。薄殼：argv、掃 `skills/**/SKILL.md` 與 `lib/stages.js`、把 findings 印成一行一條、exit code。 |
| `tests/skills.test.js` | 新。`lib/skills.js` 的直接測試，每一類 finding 一條。 |
| `tests/skills-cli.test.js` | 新。CLI 的 exit code 與報告形狀，含空掃描。 |
| `scripts/eval.js` | 改。拒跑未釘 model、讀花費、透傳 `--max-budget-usd`。 |
| `lib/eval.js` | 改。從 stream-json 的 result 取出花費與 usage。 |
| `tests/eval.test.js` | 改。加拒跑與花費讀取兩條。 |
| `README.md` | 改。eval 那節的六通道落點，加 `skills-check.js` 一列。 |
| `skills/fankeel-land/SKILL.md` | 改。步驟裡點名閘門。 |
| `docs/reports/2026-09-09-profile-evidence.md` | 新。106 筆有什麼、沒什麼，land 的答案在哪。 |
| `docs/README.md` | 改。新報告的索引列。 |
| `docs/improvement-brief.md` | 改。§4.2 一行補記。 |
| `docs/sources.md` | 改。兩列，加標題與導言的計數。 |
| `TODO.md` | 改。關掉 Ready 那條與三條已決定的。 |

---

## Task 1: `lib/skills.js` — 抽取、讀 flag、比對

**Files:**
- Modify: `lib/skills.js` — 新檔，本任務建立
- Read: `lib/docs.js` — 純函式模組的既有形狀與 export 風格
- Read: `scripts/survey.js` — 字面比較那種 parse 形態，Step 4 拿它的真原始碼當測試輸入
- Read: `scripts/ledger.js` — `STRING_FLAGS` 那種形態，同上
- Read: `scripts/docs-check.js` — `parseArgs` options 表那種形態，同上
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: `REQUIRED_CORE` (string[]), `references(text, file)` → `{scripts: [{name, file, line, bare}], flags: [{flag, file, line, script}]}`, `acceptedFlags(source)` → `Set<string>`, `classify({refs, present, accepted, core})` → `[{tag, file, line, what, fail}]`，其中 `present` 是 `Set<string>` 的檔名、`accepted` 是 `Map<string, Set<string>>`

**Dispatch:** implementer, sonnet

### Steps

1. 寫 `tests/skills.test.js` 的第一條：`references()` 從一行 `<plugin>/scripts/map.js --print`
   抽出 script `map.js` 與 flag `--print`，且 `bare` 為 `false`。跑，看它紅。
2. 在 `lib/skills.js` 建立抽取器。`bare` 的判準是引用前面有沒有 `<plugin>/`：

在 `lib/skills.js`，檔案頂端，加：

```js
'use strict';

// 一行裡的 `scripts/<name>.js`。前面有 `<plugin>/` 的是完整形態，沒有的是裸引用——
// 它仍然是一次點名，所以算進 discovery，只是另外報一行形態。兩者不混為一談，因為
// 「形態錯」和「不存在」是兩種不同的事，而只有後者是缺陷。
const SCRIPT = /(<plugin>\/)?scripts\/([a-z0-9-]+\.js)/g;

// flag 只在與 script 同一行時才歸給那支 script。同行以外的歸屬要猜，而猜錯會產生
// 假失敗——一個會誤殺的閘門會被關掉，關掉的閘門比沒有更糟。
const FLAG = /--[a-z][a-z0-9-]+/g;

function references(text, file) {
    const scripts = [];
    const flags = [];
    text.split(/\r?\n/).forEach((line, i) => {
        const n = i + 1;
        const here = [];
        for (const m of line.matchAll(SCRIPT)) {
            here.push(m[2]);
            scripts.push({ name: m[2], file, line: n, bare: !m[1] });
        }
        for (const m of line.matchAll(FLAG)) {
            flags.push({ flag: m[0], file, line: n, script: here.length === 1 ? here[0] : null });
        }
    });
    return { scripts, flags };
}
```

3. 跑，看它綠。commit。
4. 寫 `acceptedFlags()` 的失敗測試：`survey.js` 的原始碼給進去要含 `--tree`，
   `ledger.js` 的要含 `--range`，`docs-check.js` 的要含 `--role`。跑，看它紅。
5. 三種 parse 形態各一條規則。survey 的 survey 量到這棵樹上就是三種，不是一種：

在 `lib/skills.js`，`references` 之後，加：

```js
// 三種形態，因為這棵樹上就是三種：字面比較（survey.js、station.js、todo-check.js、
// version.js）、parseArgs 的 options 表（九支）、STRING_FLAGS 物件（ledger.js、task.js）。
// 讀不到就當作沒宣告，而沒宣告的 script 不會產生 unknown-flag——閘門只在讀得到旗標表
// 的時候才敢說一個 flag 不被接受。
const LITERAL = /['"](--[a-z][a-z0-9-]+)['"]/g;
const OPTION = /^\s*'?([a-z][a-z0-9-]+)'?\s*:\s*\{\s*type:\s*'(?:string|boolean)'/gm;
const STRING_FLAGS = /const STRING_FLAGS = \{([\s\S]*?)\}/;

function acceptedFlags(source) {
    const out = new Set();
    for (const m of source.matchAll(LITERAL)) out.add(m[1]);
    for (const m of source.matchAll(OPTION)) out.add('--' + m[1]);
    const block = source.match(STRING_FLAGS);
    if (block) for (const m of block[1].matchAll(/([a-z][a-z0-9-]+)\s*:/g)) out.add('--' + m[1]);
    return out;
}
```

6. 跑，看它綠。commit。
7. 寫 `classify()` 的失敗測試，六類各一條：`missing-script`、`unknown-flag`、
   `core-dropped`、`empty-scan` 四類 `fail: true`；`bare-reference`、`unnamed-script`
   兩類 `fail: false`。跑，看它紅。
8. 實作 `classify()` 與 `REQUIRED_CORE`。清單是 survey 數出來的 12 支：

在 `lib/skills.js`，`acceptedFlags` 之後，加：

```js
// 2026-09-09 被 skills/ 或 lib/stages.js 點名的 12 支。scripts/ 裡另外兩支
// （eval.js、tmp-clean.js）只在 README 出現，所以不在這裡——它們是 unnamed-script，
// 只報不失敗。一支從這張清單上掉下來，不是刪檔忘了改文件，就是一條規則失去了它的
// script；兩種都要有人看一眼，所以是 fail。
const REQUIRED_CORE = [
    'docs-audit.js', 'docs-check.js', 'layout.js', 'ledger.js', 'map.js', 'orient.js',
    'residue.js', 'station.js', 'survey.js', 'task.js', 'todo-check.js', 'version.js',
];
```

在 `lib/skills.js`，`REQUIRED_CORE` 之後，加：

```js
// 讀不到旗標表的 script 不產生 unknown-flag：`accepted` 沒有它那一格就跳過。閘門只在
// 讀得到的時候才敢說一個 flag 不被接受，因為誤殺一次就會被關掉。
function classify({ refs, present, accepted, core }) {
    const out = [];
    const named = new Set(refs.scripts.map((s) => s.name));
    for (const s of refs.scripts) {
        if (!present.has(s.name)) {
            out.push({ tag: 'missing-script', file: s.file, line: s.line, fail: true,
                what: s.name + ' is named here and is not in scripts/' });
        } else if (s.bare) {
            out.push({ tag: 'bare-reference', file: s.file, line: s.line, fail: false,
                what: s.name + ' is named without the <plugin>/ prefix' });
        }
    }
    for (const f of refs.flags) {
        const flags = f.script && accepted.get(f.script);
        if (flags && !flags.has(f.flag)) {
            out.push({ tag: 'unknown-flag', file: f.file, line: f.line, fail: true,
                what: f.script + ' does not accept ' + f.flag });
        }
    }
    for (const name of core) {
        if (!named.has(name)) {
            out.push({ tag: 'core-dropped', file: '-', line: 0, fail: true,
                what: name + ' is required core and is named by no skill' });
        }
    }
    for (const name of present) {
        if (!named.has(name)) {
            out.push({ tag: 'unnamed-script', file: '-', line: 0, fail: false,
                what: name + ' is in scripts/ and named by no skill' });
        }
    }
    return out;
}

module.exports = { REQUIRED_CORE, references, acceptedFlags, classify };
```

9. 跑，看它綠。`git add lib/skills.js tests/skills.test.js`——先 add，否則
   `tests/source.test.js` 用 `git ls-files` 看不到新檔。然後 `node --test` 跑**整套**，
   不是只跑自己那個檔：共用一棵樹的時候，只跑自己那個測試檔看不見跨檔的紅。commit。

---

## Task 2: `scripts/skills-check.js` — CLI、land 的點名、README

**Files:**
- Modify: `scripts/skills-check.js` — 新檔，本任務建立
- Modify: `README.md` — script 清單加一列，說它檢查什麼
- Modify: `skills/fankeel-land/SKILL.md` — 步驟裡點名這支閘門
- Read: `scripts/docs-check.js` — argv、exit code 與報告文字的既有形狀
- Read: `lib/skills.js` — Task 1 產出的四個 export
- Modify: `lib/stages.js` — 條件修改：Step 6 量 land 規則的位元組空間，夠才加一句點名閘門，不夠就不動它並把量到的數字寫進 commit message
- Test: `tests/skills-cli.test.js`

**Interfaces:**
- Consumes: `REQUIRED_CORE`, `references`, `acceptedFlags`, `classify` from `lib/skills.js`
- Produces: `parseArgs(argv)` → `{root}`, `run(root)` → `{findings, scanned}`；exit 1 當任一 `fail` finding 存在或 `scanned.scripts === 0`

**Dispatch:** implementer, sonnet

### Steps

1. 寫 `tests/skills-cli.test.js` 的第一條：對一個只有一個 skill 檔、內容點名
   `<plugin>/scripts/map.js --print` 的暫時目錄跑 CLI，exit 0。跑，看它紅。
2. 照 `docs-check.js:440-447` 的 argv 形狀寫 `parseArgs`（`strict: false`、
   `allowPositionals: true`、`root` 是 `type: 'string'`），照 `docs-check.js:462-469`
   寫 exit code。掃描目標是 `skills/**/SKILL.md` 與 `lib/stages.js` 兩處。
3. 跑，看它綠。commit。
4. 寫空掃描的失敗測試：一個沒有任何 script 引用的暫時目錄，CLI 要 exit 1，訊息裡有
   `empty-scan`。跑，看它紅——這條特別重要，因為零很容易被讀成乾淨。`classify()` 已經
   產出這個 finding（Task 1 落地時記了 ruling 說為什麼是它而不是 CLI），所以這裡**不要**
   再判一次，只把 findings 印出來、讓任一 `fail: true` 決定 exit code。

在 `scripts/skills-check.js`，`run()` 之後，加：

```js
// exit code 由 fail 為真的 findings 決定，形狀照 scripts/docs-check.js:431,462-469。
// empty-scan 是 classify() 回來的其中一條，不是這裡另外判的——同一件事判兩次，零個
// 引用就會印出兩行說同一件事，而互相矛盾的報告比沒有報告更難用。
const bad = findings.some((f) => f.fail);
for (const f of findings) console.log(f.tag + ': ' + f.file + ':' + f.line + '  ' + f.what);
process.exit(bad ? 1 : 0);
```

5. 跑，看它綠。commit。
6. 量 land 規則的位元組空間，然後才決定要不要動 `lib/stages.js`：

```
node -e "const s=require('./lib/stages.js');const r=s.RULES?s.RULES.land:null;console.log(r?JSON.stringify(r).length:'no land rules export')"
node --test tests/inject.test.js tests/render.test.js
```

量到的數字寫進 commit message。**空間夠才加一句點名閘門**；不夠就只留在
`skills/fankeel-land/SKILL.md`，並在 commit message 說是哪個數字擋住的。兩種結果都不是
失敗，沒量就加才是。

7. `README.md` 的 script 清單加一列，`skills/fankeel-land/SKILL.md` 的步驟裡點名
   `<plugin>/scripts/skills-check.js`——用完整形態，因為裸引用是這支自己會報的東西。
8. `git add` 兩個新檔，`node --test` 全綠，且 `node scripts/skills-check.js` 對這棵樹
   exit 0。commit。

---

## Task 3: `eval.js` 的兩條通道

**Files:**
- Modify: `scripts/eval.js` — 拒跑未釘 model、報花費、透傳 `--max-budget-usd`
- Modify: `lib/eval.js` — 從 stream-json 的 result 取出花費與 usage
- Modify: `README.md` — eval 那節寫六通道各自的落點
- Read: `evals/route-typo/case.yaml` — 一個 case 今天的欄位
- Test: `tests/eval.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/eval.js` 多一個 `costOf(lines)` → `{costUsd, usage}`，`null` 當 result 不帶這些欄位

**Dispatch:** implementer, sonnet

### Steps

1. 寫拒跑的失敗測試：`parseArgs(['evals/route-typo'])` 不帶 `--model` 要回一個帶錯誤的
   結果而不是 `model: 'sonnet'`。跑，看它紅。
2. 改 `scripts/eval.js:56`，拿掉 `'sonnet'` 預設。訊息要說出為什麼，不只說缺什麼：

在 `scripts/eval.js`，`parseArgs` 裡 `model` 那一行的位置，改成：

```js
// 沒有預設。釘住的 model 是六條污染通道的第四條：沒釘的話一次模型 rollout 讀起來
// 會像 plugin 回歸，而那是量測本身壞掉、不是被量的東西壞掉。README 與
// behaviour-eval 計畫裡的用法本來就都帶 --model，所以這改的是契約，不是用法。
model: typeof values.model === 'string' ? values.model : null,
```

3. 跑，看它綠。commit。
4. 寫花費的失敗測試：一份含 `total_cost_usd` 的假 stream-json 行陣列進 `costOf()`，要
   拿到那個數字；不含的要拿到 `null`。跑，看它紅。
5. 在 `lib/eval.js` 實作 `costOf()`，跟 `lastMessage()`（`lib/eval.js:75`）讀同一個
   result 物件，並在 `scripts/eval.js` 的報告裡印出來。`--max-budget-usd` 透傳給
   `claude`——**名字用 `claude --help:123` 真正有的那個**，不是簡報 §5.3 寫的
   `--budget-usd`，那是另一支 Python runner 的旗標。
6. 跑，看它綠。commit。
7. `README.md` 的 eval 那節加一張六列的表：通道 1、2、6 已做到並指到行號，通道 4、5 是
   本任務做的，通道 3（always-on flag）寫「fankeel 沒有持續性的 always-on flag，所以
   沒有對應物」——那是答案，寫下來以免下一個人再找一次。
8. `node --test` 跑**整套**全綠，且 `node scripts/eval.js evals/route-typo` 不帶
   `--model` 時 exit 非零。花費那半這裡只用假的 stream-json 行做單元測試——真的
   `claude -p` 執行要花錢，留在 verify 跑一次，照
   `docs/plans/2026-09-08-behaviour-eval.md:871` 的先例。commit。

---

## Task 4: profile 的證據報告

**Files:**
- Modify: `docs/reports/2026-09-09-profile-evidence.md` — 新檔，本任務建立
- Modify: `docs/README.md` — 新報告的索引列
- Modify: `docs/improvement-brief.md` — §4.2 一行補記指向這份報告
- Read: `skills/fankeel-land/SKILL.md` — land 選單今天問什麼

**Interfaces:**
- Consumes: none
- Produces: 一個 report ID 給 Task 5 的 `sources.md` 列用：`PROFILE-EVIDENCE-260909`

**Dispatch:** in-session — 106 筆的欄位分佈、`git log --merges` 的十筆、land 選單的行號都已經在寫計畫這個 context 裡量過了，派出去等於叫人重跑一次已經有答案的掃描。

### Steps

1. 建報告，frontmatter 用 `status: current`、`last_verified: 2026-09-09`、
   `source_of_truth` 指向 `.fankeel/sessions/`（per-machine，不在版本控制裡）。
2. 記三件事，每一件帶它的指令：106 筆的欄位聯集與 `project` 0／`guard` 0／`class` 70
   （bounded 47、architectural 22、spike 1）；`git log --merges` 十筆全是本地 `merge:`
   而無 PR；`skills/fankeel-land/SKILL.md:154-162` 每次仍問三選一。
3. 寫下這份報告**不**涵蓋什麼：只查了兩條絕對路徑，station 說全機 5 live／4 stale，
   其餘 registry 沒有列舉。一個下限不是一次普查。
4. `docs/README.md` 加索引列（同一個 change，`CONTRIBUTING.md` 的 Documentation 列）。
5. `docs/improvement-brief.md` §4.2 加一行補記：那一節說 registry 有
   `project` 與 `guard`，106 筆裡一次都沒有。
6. `node scripts/docs-check.js` 綠。commit。

---

## Task 5: `sources.md` 兩列，與 TODO 的收尾

**Files:**
- Modify: `docs/sources.md` — 兩列，加標題與導言的計數
- Modify: `TODO.md` — 關掉 Ready 那條與三條已決定的
- Read: `docs/reports/2026-09-09-design-axis-inventory.md` — 它量的範圍，寫進 Scope 欄
- Read: `docs/reports/2026-09-09-profile-evidence.md` — Task 4 產出，同上

**Interfaces:**
- Consumes: `PROFILE-EVIDENCE-260909` from Task 4
- Produces: none

**Dispatch:** in-session — 兩列落在同一個檔的同一張表，拆成兩次派送會讓第二次讀到一個
改到一半的檔；而合成一次就只是三處編輯，比派送本身還短。

### Steps

1. 第一張表加 `DESIGN-AXIS-260909` 一列。Scope 欄要寫：掃描對象是這台機器上安裝的
   skill 而不是本 repo，原文照抄未改寫，所以結果不隨本 repo 的程式碼變化。
   Cited by 是 `docs/README.md`、`docs/improvement-brief.md`。
2. 加 `PROFILE-EVIDENCE-260909` 一列。
3. 改 `## The fifteen reports` 的數字，並改導言裡「Sixteen sit there and fifteen have a
   row」那一句——現在每一份都有列了，所以那句話要說的是別的事。
4. **成品自檢**：把標題裡的數字讀出來，把兩張表的列數數出來，兩邊要相等。
   **數的必須是渲染出來的列，不是開頭是 `|` 的行。** 一個 GFM 表格在遇到空行時就結束，
   所以在兩列之間插進一個空行，會把後面那些列變成段落——而 `grep -c '^| '` 照樣把它們
   數進去，於是自檢報「相等」而讀者看到少了兩列。要數的是**連續區塊**：以空行切開檔案，
   取開頭是 `|` 的區塊，每塊的列數是行數減去表頭與分隔線那兩行。這件事在 2026-09-09
   真的發生過，是 reviewer 用真的 markdown renderer 抓到的。
5. `TODO.md` 刪掉 Ready 那條，並刪掉 `## Needs a decision` 裡 §2.5、§5.3 兩條與 §4.2
   那條的證據半邊——§4.2 的格式決定還在，所以那條改寫而不是刪掉。
6. `node scripts/todo-check.js` 與 `node scripts/docs-check.js` 都綠，且 `node --test`
   跑**整套**全綠——這是這一捆最後一個 commit，前面每個 task 各自跑過的整套在這裡再跑
   一次，因為五個 task 的樹到這裡才合起來。commit。

---

## Coverage

| promise | task |
|---|---|
| **Discovery**：掃 `skills/**/SKILL.md` 與 `lib/stages.js`，抽出每個 `scripts/<name>.js` 與每個 `--flag` | Task 1, Task 2 |
| **Required core**：今天被點名的 12 支必須繼續被點名。一支從清單上消失，不是刪檔 | Task 1 |
| **形態錯 ≠ 不存在**：沒有 `<plugin>/` 前綴的裸散文引用（`layout.js` 兩處、 | Task 1 |
| **空結果是失敗**：掃出零個 script 引用就 exit 1。零代表掃描壞了，不代表 skills 乾淨。 | Task 2 |
| **flag 反向檢查**：skill 點名的每個 flag，對應 script 要收 | Task 1, Task 2 |
| **通道 4**：拿掉 `'sonnet'` 預設，沒給 `--model` 就拒跑並說出原因 | Task 3 |
| **通道 5**：從 stream-json 的 result 讀出花費與 usage 一起報，並把 `--max-budget-usd` 透傳給 `claude` | Task 3 |
| `node scripts/skills-check.js` 在今天這棵樹上 exit 0；把某條規則的 flag 改成 `--rnage` 的複本上 exit 1 | Task 2（綠臂）；紅臂在 verify 造 |
| `node scripts/eval.js evals/route-typo` 不帶 `--model` 時 exit 非零並說出缺什麼 | Task 3（拒跑那半，單元測試）；花費那半要一次真的 `claude -p` 執行，在 verify 跑，照 `docs/plans/2026-09-08-behaviour-eval.md:871` 的先例 |
| **成品自檢**：`docs/sources.md` 標題裡的數字與兩張表實際的列數相等——把數字讀出來、 | Task 5 |
| `node --test tests/` 全綠（spec reporter 看 `ℹ pass\|fail`，沒有 ok 行）。 | Task 1, 2, 3, 5 各自的最後一步都跑整套，不是只跑自己那個檔 |
