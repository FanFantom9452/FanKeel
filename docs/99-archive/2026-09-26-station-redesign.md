---
status: current
last_verified: 2026-09-26
---

# 六個待決定、mockup 專屬 agent、effort 建議、station 改版、docs tree 規則 — Implementation Plan

**Goal:** 把 design 核准的十節做完：mockup 規則讓出 21 字元回到 2400 以下、新增 `fankeel-mockup` agent、agent 與主 session 的 effort 建議、station 上作答與 tune 通知、模型花費按版本分、設定精靈改版、ledger 旗標白名單、docs tree 第三種形狀與 binding 決策，最後清 `TODO.md`。
**Architecture:** 不動的部分先行並行：注入規則（`lib/stages.js`）、agent 檔與 manifest、`scripts/task.js` 的建議行、`scripts/ledger.js` 的旗標表、`lib/docs.js` 的形狀與 binding。station 的五件事都改 `assets/station/station.js`，排成一條線：先答題（伺服端 400 與頁面「其他」），再 tune 摘要與通知（`lib/station.js` 讀 `lib/tune.js` 的 `queueState`），再模型版本（`modelKey()`），再 effort 顯示，最後精靈照 mockup 改版。每個前端純函式放在 `module.exports` 守衛之上並匯出，測試直接呼叫；精靈的 reduced-motion 用真的瀏覽器量。
**Tech Stack:** Node（本機 v24.9.0），只用內建模組；`node --test`；前端是 ES5 IIFE（`assets/station/station.js` 沒有一個箭頭函式）；渲染檢查用 `scripts/render.js` 的 `findBrowser()` 找到的 Chromium 系瀏覽器。
**Spec:** [2026-09-26-station-redesign-design.md](2026-09-26-station-redesign-design.md)

## Global Constraints

`node scripts/map.js` 於 2026-09-26 跑過：`286 markdown files, 4 planned, not built, 144 retired, 8 undeclared`；`docs/plans/2026-09-26-station-redesign-design.md` 列在 planned, not built。這個 repo 沒有 `CLAUDE.md`，慣例寫在 `CONTRIBUTING.md`。

- `package.json`：`"test": "node --test"`，沒有任何 dependency，不加（`CONTRIBUTING.md` 的 Maintenance 條：「no new dependency, no new file under `hooks/`」）。
- `lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` Core logic 列）。`lib/station.js` 可以 require `lib/tune.js`。
- 新測試檔要先 `git add` 才會被 `tests/source.test.js` 看到；每個 export 都要有 importer（`CONTRIBUTING.md` Tests 列）。暫存目錄一律從 `tests/tmp.js` 拿。
- 注入上限：`lib/render.js:527` `const BLOCK_CAP = 2400;`、`lib/render.js:526` `const REFERENCE_ROOT = 59;`；`tests/render.test.js:527` `assert.ok(size < 2400, stage + ' injection is ' ...`，`tests/render.test.js:797` 同一個上限量 design→受控 build。上限不調高。
- 各站規則合計：`tests/stages.test.js:102` `assert.ok(size < 2000, name + ' rules are ' + size + ' chars');`。
- `skills/registry.json` 是 `node scripts/stage-registry.js` 產生的（`tests/stage-registry.test.js`），改了 `lib/stages.js` 的規則文字就重產。
- agents：`tests/agents.test.js:10` 的 `NAMES` 必須等於 `.claude-plugin/plugin.json` 的 `agents`（`tests/agents.test.js:60` `assert.deepEqual(manifest.agents, NAMES.map(...))`），也等於 `agents/` 目錄（`:62`）；可寫的 agent 只准列在 `tests/agents.test.js:29` `MAY_WRITE`。
- 精靈：`tests/station-wizard.test.js:52` `assert.equal(rows.length, 12);`、`:139` `assert.equal(V.WIZ_STEPS.length, 8);`，並靠 `data-block` 的 `wizard`、`wizard-steps`、`wizard-step`、`wizard-summary`；`POST /profile`（`scripts/station.js:534-579`）不動。
- gate：`lib/profile.js:31` `'gate.station': { values: ['off', '60', '120', '300'], ...}`；`POST /answer` 在 `scripts/station.js:504-531`，部分作答目前在 `:525` 放行。
- station 背景分頁：`tests/station-live.test.js:183` `a hidden tab re-reads nothing on its tick` 要繼續綠。
- detail 快取：`lib/detail.js:547` `const VERSION = 6;`；`tests/detail-cache.test.js:82-83` 釘住 `6`。`tests/usage.test.js:43` 對 `summarise()` 做 `deepEqual`，新欄位只在有值時才出現。
- 模型分段：`tests/station-view.test.js:377-379` 釘住 family 的 parts 與 keys，Task 9 改它。
- `TODO.md`：一條最多 200 字元（`scripts/todo-check.js:53` `const MAX_ENTRY_CHARS = 200;`），連到 plan、decision、report、archive 會被拒；`## Waiting` 是 `### <timing>`、`lifts when: <event>. MM-DD.`、空行、條目。
- docs-check 非零退出只看 findings；排序表在 `scripts/docs-check.js:489` `const ORDER = [...]`。
- 檔案用 Edit／Write 寫，不用 heredoc（會吃反斜線）；行尾 LF。縮排照各檔現況：`lib/*.js`、`scripts/*.js`、`agents.test.js`、`station-*.test.js`、`usage.test.js`、`detail-cache.test.js`、`assets/station/station.js` 4 格；`render.test.js`、`brief.test.js`、`ledger.test.js`、`task.test.js`、`docs.test.js`、`map.test.js` 2 格。
- 改到 `lib/stages.js`、`skills/**`、`docs/**` 的 task 都跑 `node scripts/docs-check.js`，照它點名的引用改。
- commit：`type: what changed`，60 字元內；每項一條 `- <what changed> — <module>`；只在本機 commit，不 push。每個 implementer 只跑自己的測試檔，整套由 parent 在提交前跑。

## 起草時查到

- **量過：** bounded route、`design.mockup: 'opus'`、沒有 `stage.agents`，`tests/render.test.js` 的 `entry()` 下 design 區塊是 2420；`Frontend work gets a mockup first: `（35 字元）換成 `Mockup first: `（14 字元）後是 2399，比上限少 1。`design.skill` 設了的子句比預設短，不會更大。
- **design 沒驗證的那一點，已驗證：** 主 session 的 effort 在 transcript 裡。session 8188d73a 的 transcript 每個 `type: "assistant"` 行都有頂層 `"effort":"medium"`（也有 `perTurnEffort`），137 行。Task 10 讀頂層 `effort`，取最後一個。
- **成功條件第 4 列寫的是 `station-post.test.js`，但 `POST /answer` 的測試與 fixture 在 `tests/station-answer.test.js`**（`station-post.test.js` 沒有懸著的 gate fixture）。Task 7 寫在 `station-answer.test.js`。
- **`--project` 要帶值：** `node scripts/task.js profile show --project` 回 `--project needs a value.`、exit 1。不帶 `--default` 時 `profile set` 本來就寫專案的 `.fankeel/profile.json`（`scripts/task.js` 的 `cmdProfile`），所以 Task 7 跑 `node scripts/task.js profile set gate.station 300`，就是使用者 2026-09-26 同意的專案層設定。
- **`fankeel-mockup` 的工具多一個 `Skill`：** design 列的是 Read, Grep, Glob, Bash, Write, Edit，但同一條也要它「先用 Skill 工具載入」指名的 design skill；工具清單沒有 `Skill` 就載不了。Task 2 加上。
- **背景分頁：** `refresh()` 在 `doc.hidden` 時直接 return（`assets/station/station.js` 的 `refresh`），分頁在背景就永遠看不到佇列變化，也發不出 `Notification`。Task 8 只在「有 session 的 tune 佇列還有進行中」時讓背景分頁繼續讀，沒有時照舊不讀，`station-live.test.js:183` 那條不變。
- **mockup 與 design 不一致的兩處，照 design：** mockup 的 `model-cost` 把「依 model 版本」做成另一個分段鈕，design 第 6 節說 `model` 維度直接改用 `modelKey()`，Task 9 照 design；mockup 的 gate 卡 `data-block` 叫 `gate-pending`，頁面與 `tests/station-answer.test.js:67` 用的是 `pending-gate`，Task 7 保留 `pending-gate`。mockup 的 toast 有倒數重整，design 第 5 節說 station 沿用 3 秒 refresh，Task 8 不做倒數重整。
- **plan gate 加進來：** `skills/fankeel-build/SKILL.md:381` 的 live mode 逐塊迴圈也寫「dispatch one implementer at `design.mockup`'s model」；使用者 2026-09-26 在 plan gate 決定它也改派 `fankeel-mockup`，併進 Task 2 Step 5b。Task 13 照改過的寫法跑。
- `tests/render.test.js:787` 的註解寫「see TODO.md's render entry」，那條會在 Task 12 刪掉；Task 1 同時改註解。
- `.fankeel/map.md` 是 `scripts/map.js` 從 `README.md` 的樹抽出來的（gitignored），「agents 那一行」的來源是 `README.md:200` 與 `:202`；Task 2 改 README 再重產 map。
- docs tree：`flat`、`phased` 兩個 preset 不加 `audience`——已經有 `docs.json` 的專案交給 `/fankeel-audit` 的後續任務（design 第 9 節第 3 條），這裡只讓 `normalise()` 認得這個欄位，並讓新形狀帶上它。

## File structure

| file | 責任 | task |
|---|---|---|
| `lib/stages.js` | mockup 規則前綴縮短 | 1 |
| `tests/render.test.js`、`tests/brief.test.js`、`skills/registry.json` | bounded＋mockup 上限測試；引用原文的 regex；重產 | 1 |
| `agents/fankeel-mockup.md`（新） | mockup 專屬 agent | 2 |
| `.claude-plugin/plugin.json`、`tests/agents.test.js` | agent 清單；`NAMES`、`MAY_WRITE`、mockup 測試（T2）；effort 測試（T3） | 2, 3 |
| `skills/fankeel-design/SKILL.md` | 第 3 步兩處派工改成 `fankeel:fankeel-mockup` | 2 |
| `docs/90-agent/reference/subagents.md`、`README.md`、`docs/README.md` | agent 數與清單 | 2 |
| `agents/fankeel-{reader,reviewer,verifier,render-reviewer,fixer,judge}.md` | frontmatter `effort:` | 3 |
| `scripts/task.js`、`tests/task.test.js` | `start`／`stage` 印建議 effort | 3 |
| `scripts/ledger.js`、`tests/ledger.test.js` | 每個 verb 的旗標白名單 | 4 |
| `lib/docs.js` | `audience` 欄位與第三種形狀（T5）；`isBinding`、`bindingOf`、`BINDING_CAP`（T6） | 5, 6 |
| `skills/fankeel/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`skills/fankeel-land/SKILL.md`、`docs/90-agent/reference/documents.md` | 形狀與 survey 的一次詢問（T5）；binding 規則（T6） | 5, 6 |
| `scripts/docs-check.js`、`lib/map.js` | binding 上限；map 列出 binding 決策 | 6 |
| `tests/docs.test.js`、`tests/map.test.js` | 紅綠 | 5, 6 |
| `scripts/station.js` | `POST /answer` 少答一題回 400 | 7 |
| `.fankeel/profile.json` | `gate.station: 300` | 7 |
| `lib/station.js` | tune 摘要（T8）；effort 欄位（T10） | 8, 10 |
| `assets/station/station.js` | 答題（T7）、tune 通知（T8）、`modelKey`（T9）、effort 晶片（T10）、精靈（T11） | 7–11 |
| `assets/station/station.css` | gate 卡（T7）、toast 與晶片（T8）、精靈（T11） | 7, 8, 11 |
| `assets/station/index.html` | 頁首 tune 晶片與 toast 容器 | 8 |
| `docs/90-agent/reference/station.md` | 各段描述 | 7, 8, 9, 11 |
| `lib/usage.js`、`lib/detail.js`、`tests/detail-cache.test.js` | transcript 的 effort；detail `VERSION` 7 | 10 |
| `tests/station-answer.test.js`、`tests/station-tune.test.js`（新）、`tests/station-live.test.js`、`tests/station-view.test.js`、`tests/station-effort.test.js`（新）、`tests/station-wizard.test.js`、`tests/station-wizard-motion.test.js`（新） | station 各 task 的紅綠 | 7–11 |
| `TODO.md` | 清掉六條、加 Ready 一條 | 12 |

Task 1、2、4、5、7 互不共用檔案，可以一起派；Task 3 接在 Task 2 後（`tests/agents.test.js`）；Task 6 接在 Task 5 後（`lib/docs.js`）；Task 7→8→9→10→11 共用 `assets/station/station.js`，排成一條線；Task 12 只動 `TODO.md`；Task 13 是使用者自己做，最後。

## Task 1: mockup 規則讓出 21 字元，bounded＋mockup 回到上限內

**Files:**
- Modify: `lib/stages.js` — 第 258 行規則開頭 `Frontend work gets a mockup first: ` 改成 `Mockup first: `
- Modify: `skills/registry.json` — `node scripts/stage-registry.js` 重產
- Read: `lib/render.js` — `render`、`BLOCK_CAP`、`sizeAtReference`，不改
- Test: `tests/render.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: 規則文字 `"Mockup first: one page at \`design.mockup\`'s model, {{DESIGN_MOCKUP_CLAUSE}}"`；Task 2 的 skill 文字不引用它。

**Dispatch:** implementer, sonnet — 計畫附了全部改動，照抄再跑測試。

- [ ] **Step 1：寫會失敗的上限測試。** 在 `tests/render.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 1. The cap test at :527
// measures the architectural route only; a bounded route with a front end
// switched on measured 2420 on 2026-09-26, over the cap. Shortening the
// mockup rule's opening is what brings it back.
test('a bounded design with design.mockup on and no stage agents is under the cap', (t) => {
  const { BLOCK_CAP } = require('../lib/render.js');
  const route = ['survey', 'design', 'build', 'verify', 'land'];
  const profile = { values: { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true, guard: 'ask', 'dispatch.floor': 'sonnet', 'judge.model': 'fable', 'design.mockup': 'opus' }, sources: {}, unreadable: [] };
  const out = render({ mine: entry(MINE, { stage: 'design', class: 'bounded', route }), others: [], now: NOW, profile });
  assert.match(out, /Mockup first: one page at `design\.mockup`'s model/, 'the rule is in the block being measured');
  const size = sizeAtReference(out);
  t.diagnostic('bounded design with a mockup ' + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
  assert.ok(size < BLOCK_CAP, 'the bounded design block with design.mockup on is ' + size + ' chars');
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test --test-name-pattern "bounded design with design.mockup" tests/render.test.js
```

預期失敗在 `assert.match`（規則還是舊開頭）；把 match 那行暫時註解掉再跑一次，會看到 `2420 chars`——這是控制組，證明上限那條真的量得到超標。量完把註解拿掉。

- [ ] **Step 3：改規則。** 在 `lib/stages.js` 第 258 行，把：

```js
            { when: 'design.mockup', text: "Frontend work gets a mockup first: one page at `design.mockup`'s model, {{DESIGN_MOCKUP_CLAUSE}}" },
```

`lib/stages.js` 那一行改成：

```js
            { when: 'design.mockup', text: "Mockup first: one page at `design.mockup`'s model, {{DESIGN_MOCKUP_CLAUSE}}" },
```

行數不變，別處引用 `lib/stages.js` 第幾行的地方不會錯位。

- [ ] **Step 4：引用原文的地方一起改。** `git grep -n "Frontend work gets a mockup"` 在 `docs/`、`skills/`、`tests/` 底下只剩 `tests/brief.test.js:286`。把 `tests/brief.test.js` 那一行：

```js
  const mockup = /Frontend work gets a mockup first: one page at `design\.mockup`'s model/;
```

`tests/brief.test.js` 那一行改成：

```js
  const mockup = /Mockup first: one page at `design\.mockup`'s model/;
```

同時把 `tests/render.test.js:786-787` 的註解尾巴「the mockup key is off here — see TODO.md's render entry.」改成「the mockup key is off here; the bounded + mockup case has its own test below.」（Task 12 會刪掉那條 TODO）。

- [ ] **Step 5：重產 registry、跑測試。**

```
node scripts/stage-registry.js
node --test tests/render.test.js tests/brief.test.js tests/stages.test.js tests/stage-registry.test.js
node scripts/docs-check.js
```

新測試的 diagnostic 應該是 `2399 chars`。

- [ ] **Step 6：commit。** `fix: mockup rule gives 21 chars back to the cap`，bullets 各一條 `— lib/stages.js`、`— tests/render.test.js`、`— skills/registry.json`。

## Task 2: fankeel-mockup 專屬 agent

**Files:**
- Modify: `agents/fankeel-mockup.md` — 新檔
- Modify: `.claude-plugin/plugin.json` — `agents` 陣列尾端加一筆
- Modify: `skills/fankeel-design/SKILL.md` — 第 3 步兩處派工
- Modify: `skills/fankeel-build/SKILL.md` — 第 381 行 live mode 迴圈的派工
- Modify: `docs/90-agent/reference/subagents.md` — 第 28-32 行標題與清單、第 63 行的數字、補一段 mockup 的寫入權
- Modify: `README.md` — 第 200、202 行的 agent 數與清單
- Modify: `docs/README.md` — 第 281 行 `agents/` 那列的數字
- Read: `agents/fankeel-render-reviewer.md` — frontmatter 與段落格式，不改
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: agent 名稱 `fankeel-mockup`，派工寫法 `subagent_type: fankeel:fankeel-mockup`；`tests/agents.test.js` 的 `NAMES` 以 `'fankeel-mockup'` 結尾，`MAY_WRITE['fankeel-mockup']` 是 `['Edit', 'Write']`。Task 3 的 effort 測試逐一讀 `NAMES`。

**Dispatch:** implementer, sonnet — agent 檔與 skill 文字計畫都寫好了，照抄。

- [ ] **Step 1：寫會失敗的測試。** 在 `tests/agents.test.js`：第 10 行 `NAMES` 陣列尾端加 `'fankeel-mockup'`；第 29 行 `MAY_WRITE` 加 `'fankeel-mockup': ['Edit', 'Write']`，並在它上面那段註解尾端加一句：

```js
// `fankeel-mockup` is the fourth: it draws the design stage's mockup page and,
// in a tuning loop, rewrites the one block it is sent — `Edit` and `Write` on
// that page, which is the whole of its job.
```

`tests/agents.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 2: the mockup has its own
// agent, pinned to opus, and the design skill sends both of its dispatches
// there by type rather than as an implementer at a model.
test('the mockup agent is pinned to opus and the design skill dispatches it by type', () => {
    const f = front(path.join(ROOT, 'agents', 'fankeel-mockup.md'));
    assert.equal(f.model, 'opus');
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Skill'), 'the agent loads the named design skill itself');
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8');
    const step3 = design.split('### 3. The mockup')[1].split('### 4.')[0].replace(/\s+/g, ' ');
    assert.equal((step3.match(/`subagent_type: fankeel:fankeel-mockup`/g) || []).length, 2, 'drawing and tuning both go to the agent');
    assert.doesNotMatch(step3, /implementer at `design\.mockup`'s model/);
    assert.doesNotMatch(step3, /Dispatch it as `implementer, <the value of design\.mockup>`/);
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test tests/agents.test.js
```

預期 `every agent parses` 讀不到 `agents/fankeel-mockup.md`、manifest 那條不相等、新測試紅。

- [ ] **Step 3：寫 agent 檔。** 新增 `agents/fankeel-mockup.md`：

```md
---
name: fankeel-mockup
description: Draws the design stage's mockup — one HTML page built from the project's own stylesheets and rendered DOM, every changed block carrying data-block — and, in a tuning loop, rewrites only the one block a request names. Loads the design skill the prompt names before drawing. Pinned to opus; the dispatching session passes a model only when design.mockup names another.
tools: [Read, Grep, Glob, Bash, Write, Edit, Skill]
model: opus
effort: high
status: current
last_verified: 2026-09-26
source_of_truth: skills/fankeel-design/SKILL.md
---

You draw the page a design gate approves. The session that sent you has an
approach and the screens it changes; you make one HTML page that shows them,
or — in a tuning loop — change one block of a page that already exists.

## Before drawing

The prompt names one design skill. Load it with the `Skill` tool first and
follow it; a prompt that names none is a prompt to say so in one line and
stop, not to pick one yourself.

The prompt also names the output path, under `.fankeel/build/`. Nothing you
write goes anywhere else.

## Built from the project's own parts

- Link the project's real stylesheets with `<link>`; never copy them. A copy
  drifts the day the original changes.
- Start from the DOM of the real page as it renders: run
  `node <plugin>/scripts/render.js <the page's url>` (`scripts/render.js` in
  this plugin) and take the part being redesigned out of the `render.html` it
  writes. Rewrite only that part.
- Write new styles only for what is new, in the page's own `<style>`.
- Every block the approach changes carries `data-block="<name>"`, spelled
  literally in the markup. The user, the tuning step and the render reviewer
  all point at a block by that name.

## Tuning one block

When the prompt names a `data-block` and a request, change the element
carrying that name and nothing outside it. An edit that reaches a neighbour
is put back by `tune.js done`, and the request comes back to you.

## Return

The page's path, then one line per `data-block` on it. Nothing else: the
dispatching session opens the page itself.
```

- [ ] **Step 4：manifest。** `.claude-plugin/plugin.json` 的 `agents` 陣列最後一項（render-reviewer 那筆）後面加一筆 ./agents/fankeel-mockup.md。

- [ ] **Step 5：design skill 第 3 步兩處。** 在 `skills/fankeel-design/SKILL.md`，把第 104-111 行這段：

```md
Dispatch it as `implementer, <the value of design.mockup>`. Visual design does
not take `dispatch.floor`, which is why the key carries a model at all. Name one
installed design skill in the prompt — `taste-skill:taste-skill`,
`taste-skill:soft-skill`, `taste-skill:minimalist-skill`,
`frontend-design:frontend-design`, `ui-ux-pro-max:ui-ux-pro-max` or
`impeccable:impeccable` — one, not the list. **No profile value reaches a
subagent**, so the model and the output path have to be written into the prompt
by the session dispatching it.
```

`skills/fankeel-design/SKILL.md` 換成：

```md
Dispatch it as `subagent_type: fankeel:fankeel-mockup` and pass no model: the
agent file pins `opus`, and that is the floor. Pass `model` only when
`design.mockup` names something other than `opus`. Visual design does not take
`dispatch.floor`, which is why the key carries a model at all. Name one
installed design skill in the prompt — `taste-skill:taste-skill`,
`taste-skill:soft-skill`, `taste-skill:minimalist-skill`,
`frontend-design:frontend-design`, `ui-ux-pro-max:ui-ux-pro-max` or
`impeccable:impeccable` — one, not the list; the agent loads it with the Skill
tool before it draws. **No profile value reaches a subagent**, so the skill and
the output path have to be written into the prompt by the session dispatching
it.
```

再把 `skills/fankeel-design/SKILL.md` 第 127-129 行的：

```md
`node <plugin>/scripts/tune.js wait` prints the next request as JSON;
dispatch one implementer at `design.mockup`'s model to rewrite only the
element carrying that `data-block` in the file it names; then
```

`skills/fankeel-design/SKILL.md` 換成：

```md
`node <plugin>/scripts/tune.js wait` prints the next request as JSON;
dispatch one `subagent_type: fankeel:fankeel-mockup` — no model, the same
rule as above — to rewrite only the
element carrying that `data-block` in the file it names; then
```

- [ ] **Step 5b：build skill 的 live mode 迴圈。** 在 `skills/fankeel-build/SKILL.md` 第 381 行，把：

```md
classes; dispatch one implementer at `design.mockup`'s model per request to
```

`skills/fankeel-build/SKILL.md` 換成：

```md
classes; dispatch one `subagent_type: fankeel:fankeel-mockup` per request —
no model unless `design.mockup` names one other than opus — to
```

換完讀第 380-383 行，確認句子仍接得上「change the source there and nothing else」。

- [ ] **Step 6：agent 數與清單。**
  - `docs/90-agent/reference/subagents.md` 第 28 行 `## The seven agents this plugin defines` → `## The eight agents this plugin defines`；第 30 行 `Seven subagent types` → `Eight subagent types`；第 32 行清單改成 `` `fankeel-reader`, `fankeel-judge`, `fankeel-reviewer`, `fankeel-verifier`, `fankeel-fixer`, `fankeel-brain`, `fankeel-render-reviewer` and `fankeel-mockup`. ``；第 62-63 行 `Six of` / `the seven agents hold` → `Seven of` / `the eight agents hold`。在第 46 行那句（`fankeel-brain` carries `Write` ...）所在段落的結尾加一句：「`fankeel-mockup` carries `Edit` and `Write` for the mockup page it draws under `.fankeel/build/` and the one block a tuning request names, and `Skill`, to load the design skill its prompt names.」
  - `README.md` 第 200 行 `the six agents` → `the eight agents`；第 202 行改成 `├── agents/            the eight subagents the stages dispatch — reader, reviewer, verifier, judge, fixer, brain, render-reviewer, mockup — with their tools and model`。
  - `docs/README.md` 第 281 行 `the six agents the plugin ships` → `the eight agents the plugin ships`。

- [ ] **Step 7：跑測試、重產 map、查引用。**

```
node --test tests/agents.test.js tests/skills.test.js
node scripts/map.js
node scripts/docs-check.js
```

`.fankeel/map.md` 的 tree 那一段應該讀到 `the eight subagents`。

- [ ] **Step 8：commit。** `feat: fankeel-mockup agent draws and tunes the mockup`，bullets：`— agents/fankeel-mockup.md`、`— .claude-plugin/plugin.json`、`— skills/fankeel-design/SKILL.md`、`— docs/subagents.md, README.md`。新檔先 `git add`。

## Task 3: effort 依角色、依站建議

**Files:**
- Modify: `agents/fankeel-reader.md` — frontmatter 加 `effort: medium`
- Modify: `agents/fankeel-reviewer.md` — frontmatter 加 `effort: medium`
- Modify: `agents/fankeel-verifier.md` — frontmatter 加 `effort: medium`
- Modify: `agents/fankeel-render-reviewer.md` — frontmatter 加 `effort: medium`
- Modify: `agents/fankeel-fixer.md` — frontmatter 加 `effort: low`
- Modify: `agents/fankeel-judge.md` — frontmatter 加 `effort: xhigh`
- Modify: `scripts/task.js` — `effortHint(cls, stage)`；`cmdStart` 與 `cmdStage` 各印一行
- Modify: `tests/agents.test.js` — effort 測試
- Read: `lib/stages.js` — `classForRoute`，不改
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: `tests/agents.test.js` 的 `NAMES` 含 `'fankeel-mockup'`，`agents/fankeel-mockup.md` 帶 `effort: high`（Task 2）。
- Produces: `start`／`stage` 輸出裡一行 `effort: <medium|xhigh> suggested for the main session at <stage> — the plugin cannot set it`。

**Dispatch:** implementer, sonnet — 六行 frontmatter、一個小函式與兩個呼叫點，計畫附全文。

- [ ] **Step 1：寫會失敗的 agent 測試。** 在 `tests/agents.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 3. The effort each role runs
// at, pinned per agent; none at `max`, which the user observed over-reasons
// (2026-09-26). `fankeel-brain` already carried `medium`.
const EFFORT = {
    'fankeel-reader': 'medium', 'fankeel-reviewer': 'medium', 'fankeel-verifier': 'medium',
    'fankeel-render-reviewer': 'medium', 'fankeel-fixer': 'low', 'fankeel-judge': 'xhigh',
    'fankeel-brain': 'medium', 'fankeel-mockup': 'high',
};
test('every agent names its effort, and none of them is max', () => {
    for (const name of NAMES) {
        const f = front(path.join(ROOT, 'agents', name + '.md'));
        assert.ok(f.effort, name + ' names no effort');
        assert.notEqual(f.effort, 'max', name + ' runs at max');
        assert.equal(f.effort, EFFORT[name], name);
    }
});
```

- [ ] **Step 2：寫會失敗的 task.js 測試。** 在 `tests/task.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 3: the main session's effort,
// suggested on the command's own output and never injected. Architectural
// design and plan are xhigh; every other stage, and every stage of a bounded
// or spike task, is medium.
test('start and stage print the effort suggested for the stage entered', () => {
  const dir = root();
  const arch = run(dir, ['start', '--session', A, '--task', 'x', '--class', 'architectural']);
  assert.equal(arch.code, 0, arch.out);
  assert.match(arch.out, /effort: medium suggested for the main session at survey/);
  assert.match(run(dir, ['stage', 'design', '--session', A]).out, /effort: xhigh suggested for the main session at design/);
  assert.match(run(dir, ['stage', 'plan', '--session', A]).out, /effort: xhigh suggested for the main session at plan/);
  assert.match(run(dir, ['stage', 'build', '--session', A]).out, /effort: medium suggested for the main session at build/);
  const other = root();
  assert.equal(run(other, ['start', '--session', B, '--task', 'y', '--class', 'bounded']).code, 0);
  assert.match(run(other, ['stage', 'design', '--session', B]).out, /effort: medium suggested for the main session at design/);
});
```

- [ ] **Step 3：跑兩個測試檔，看它們紅。**

```
node --test tests/agents.test.js tests/task.test.js
```

- [ ] **Step 4：frontmatter。** 在六個 agent 檔的 `model:` 下一行各插一行（`fankeel-brain.md` 已經有，`fankeel-mockup.md` 在 Task 2 寫好了）：`fankeel-reader.md`、`fankeel-reviewer.md`、`fankeel-verifier.md`、`fankeel-render-reviewer.md` 插 `effort: medium`；`fankeel-fixer.md` 插 `effort: low`；`fankeel-judge.md` 插 `effort: xhigh`。

- [ ] **Step 5：`effortHint`。** 在 `scripts/task.js` 的 `modelHint` 函式後面加：

```js
// The main session's effort, suggested per stage. Printed on `start` and
// `stage` only — never injected, so it costs the 2400-character block nothing,
// and it is advice: the plugin cannot set a session's effort. Architectural
// design and plan reason about structure; everything else is medium.
function effortHint(cls, stage) {
    const heavy = cls === 'architectural' && (stage === 'design' || stage === 'plan');
    return 'effort: ' + (heavy ? 'xhigh' : 'medium') + ' suggested for the main session at ' + stage + ' — the plugin cannot set it';
}
```

在 `scripts/task.js` 的 `cmdStart`，`if (hint) lines.push(hint);` 下一行加：

```js
    lines.push(effortHint(data.class || classForRoute(route), data.stage));
```

在 `scripts/task.js` 的 `cmdStage`，`const controller = controllerLines(...)` 那行的上面加：

```js
    line += NL + effortHint(data.class || classForRoute(route), name);
```

- [ ] **Step 6：跑測試。**

```
node --test tests/agents.test.js tests/task.test.js
node scripts/docs-check.js
```

- [ ] **Step 7：commit。** `feat: effort per agent role and per stage on task.js`，bullets：`— agents/*.md`、`— scripts/task.js`。

## Task 4: ledger 的旗標依 verb 放行

**Files:**
- Modify: `scripts/ledger.js` — `VERB_FLAGS`、`parseArgs(argv, verb)`、`main` 先算 verb
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: none
- Produces: `ledger.js --plan p.md --range x ranges` exit 1，stdout 含 `refused: --range`。

**Dispatch:** implementer, sonnet — 一張表和十幾行，計畫附全文。

- [ ] **Step 1：寫會失敗的測試。** 在 `tests/ledger.test.js` 第 334 行那條 `ranges names a completed task that recorded no range` 的後面加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 4. `strict: false` kept every
// flag a verb does not read silent, so `--range x ranges` exited 0 having read
// nothing of it. Each verb now has the flags it takes; any other is refused.
test('a flag its verb does not take is refused, not ignored', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'init'], { cwd: dir, encoding: 'utf8' });
  for (const argv of [['--range', 'x', 'ranges'], ['--range', 'aaaaaaa..bbbbbbb', 'show'], ['--bogus=y', 'groups']]) {
    let out = '';
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', ...argv], { cwd: dir, encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout || '');
      code = e.status;
    }
    assert.equal(code, 1, argv.join(' ') + ' should exit 1');
    assert.match(out, /refused: --(range|bogus)/, argv.join(' '));
  }
  const ok = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'aaaaaaa..bbbbbbb', 'complete', '1', 'first'], { cwd: dir, encoding: 'utf8' });
  assert.match(ok, /Task 1 complete/, 'complete still takes --range');
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test --test-name-pattern "its verb does not take" tests/ledger.test.js
```

- [ ] **Step 3：旗標表。** 在 `scripts/ledger.js` 的 `const VERBS = new Set([...]);` 下面加：

```js
// The flags each verb takes. `--root` and `--plan` everywhere; `--range` only
// where a range is recorded. A flag outside its verb's list is refused rather
// than ignored: `ranges --range x` used to exit 0 having read nothing of it.
const BASE_FLAGS = ['root', 'plan'];
const VERB_FLAGS = { init: BASE_FLAGS.concat(['range']), complete: BASE_FLAGS.concat(['range']), fix: BASE_FLAGS.concat(['range']) };
```

- [ ] **Step 4：`parseArgs` 收 verb。** 把 `scripts/ledger.js` 的 `function parseArgs(argv) { ... }` 整個換成：

```js
function parseArgs(argv, verb) {
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };

    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    const opts = {};
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
    // After the value check, so a flag left without its value is still named
    // as that — the refusal tests/ledger.test.js pins for `--root` and `--plan`.
    const allowed = VERB_FLAGS[verb] || BASE_FLAGS;
    const stray = Object.keys(values).filter((flag) => !allowed.includes(flag));
    if (stray.length) {
        fail(verb + ' takes ' + allowed.map((f) => '--' + f).join(', ') + '; refused: ' + stray.map((f) => '--' + f).join(', ') + '.');
    }
    return opts;
}
```

並把 `scripts/ledger.js` 的 `main` 開頭四行改成先算 verb：

```js
function main(argv) {
    const { head, verb: named, text } = splitAtVerb(argv, STRING_FLAGS, VERBS);
    const verb = String(named || 'show').toLowerCase();
    const opts = parseArgs(head, verb);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
```

（原本在 `if (!opts.plan)` 後面那行 `const verb = String(named || 'show').toLowerCase();` 刪掉。）同時把第 49-52 行註解的「`strict: false` keeps an unknown flag silent.」改成「`strict: false` lets an unknown flag through to the verb check below, which refuses it by name.」。

- [ ] **Step 5：跑整個 ledger 測試檔。**

```
node --test tests/ledger.test.js
```

`--root`／`--plan` 沒給值那兩條、`--plan <verb>` 那六條、`--range` 相關的都要綠。

- [ ] **Step 6：commit。** `fix: ledger.js refuses a flag its verb does not take`，bullet `— scripts/ledger.js`。

## Task 5: docs tree 的 audience 與第三種形狀

**Files:**
- Modify: `lib/docs.js` — `AUDIENCES`、`normalise` 保留 `audience`、`PRESETS.audience`、`detect` 認得它
- Modify: `skills/fankeel/SKILL.md` — `## Where documents live` 的形狀段
- Modify: `skills/fankeel-survey/SKILL.md` — 第 2 步：沒有 `docs.json` 時問一次
- Modify: `skills/fankeel-land/SKILL.md` — 給人看的頁在 gate 前點名
- Modify: `docs/90-agent/reference/documents.md` — 第 31-36 行的形狀與詢問理由
- Test: `tests/docs.test.js`

**Interfaces:**
- Consumes: none
- Produces: `PRESETS.audience`（`preset: 'audience'`，七個 bucket）；bucket 物件可帶 `audience: 'human' | 'agent'`；`detect(root)` 可回 `'audience'`。Task 6 在同一個 `lib/docs.js` 加 binding，不依賴這些名字。

**Dispatch:** implementer, sonnet — 資料表與 skill 文字都寫在計畫裡。

- [ ] **Step 1：寫會失敗的測試。** 在 `tests/docs.test.js` 第 56 行那條 `depth stops a flat bucket...` 的後面加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 5. The third shape: a
// person's pages numbered to the front, an agent's under one folder, and a
// bucket that says which reader it is for.
test('the audience shape files each folder by role and says who reads it', () => {
  const t = docs.normalise(docs.PRESETS.audience);
  assert.equal(t.preset, 'audience');
  assert.equal(docs.roleOf(t, 'docs/01-guide/start.md'), 'reference');
  assert.equal(docs.roleOf(t, 'docs/03-decisions/2026-09-26-x.md'), 'decision');
  assert.equal(docs.roleOf(t, 'docs/90-agent/plans/2026-09-26-x.md'), 'plan');
  assert.equal(docs.roleOf(t, 'docs/90-agent/reports/x.md'), 'report');
  assert.equal(docs.roleOf(t, 'docs/99-archive/x.md'), 'archive');
  const by = Object.fromEntries(t.buckets.map((b) => [b.path, b.audience]));
  assert.equal(by['docs/02-architecture'], 'human');
  assert.equal(by['docs/90-agent/reference'], 'agent');
  assert.equal(by['docs/99-archive'], undefined, 'an archive is read by nobody');
  const odd = docs.normalise({ buckets: [{ path: 'docs', role: 'reference', audience: 'robots' }] });
  assert.equal(odd.buckets[0].audience, undefined, 'an audience that is neither word is dropped');
  const root = tree({ 'docs/90-agent/plans/.keep': '', 'docs/01-guide/.keep': '' });
  assert.equal(docs.detect(root), 'audience');
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test --test-name-pattern "audience shape" tests/docs.test.js
```

- [ ] **Step 3：`lib/docs.js`。** 在 `const ROLES = [...]` 下面加：

```js
// Who a bucket is written for. `human`: short, in the user's language, with
// pictures, and read by the user at land. `agent`: dense, cites `path:line`,
// and docs-check reads it mechanically. Optional — a bucket without one says
// nothing about its reader, which is every tree declared before 2026-09-26.
const AUDIENCES = ['human', 'agent'];
```

在 `lib/docs.js` 的 `PRESETS` 裡 `phased` 後面加第三個形狀：

```js
    // `audience` is the third, from the 2026-09-26 design: the folders a person
    // reads are numbered to the front, and everything written for an agent sits
    // under one folder behind them. It is the first option survey offers a
    // project with no docs.json.
    audience: {
        preset: 'audience',
        index: 'docs/README.md',
        buckets: [
            { path: 'docs/01-guide', role: 'reference', audience: 'human' },
            { path: 'docs/02-architecture', role: 'reference', audience: 'human' },
            { path: 'docs/03-decisions', role: 'decision', audience: 'human' },
            { path: 'docs/90-agent/plans', role: 'plan', audience: 'agent' },
            { path: 'docs/90-agent/reference', role: 'reference', audience: 'agent' },
            { path: 'docs/90-agent/reports', role: 'report', audience: 'agent' },
            { path: 'docs/99-archive', role: 'archive' },
        ],
    },
```

在 `lib/docs.js` 裡，把「// Two shapes, both taken from real repositories rather than invented.」改成「// Three shapes: two taken from real repositories rather than invented, and a third that files by reader.」。在 `normalise` 裡 `if (Number.isInteger(b.depth) && b.depth > 0) bucket.depth = b.depth;` 下一行加：

```js
        if (AUDIENCES.includes(b.audience)) bucket.audience = b.audience;
```

在 `lib/docs.js` 的 `detect` 裡 `let phased = 0;` 上一行加：

```js
    if (has('docs/90-agent')) return 'audience';
```

- [ ] **Step 4：skill 與頁面。**
  - `skills/fankeel/SKILL.md` 第 605-610 行（開頭 `Two shapes ship, both taken from real repositories:`）整段換成：

```md
Three shapes ship: `flat` (one `docs/` with a numbered series) and `phased`
(`01-vision` through `99-archive`), both taken from real repositories, and
`audience` — the folders a person reads numbered to the front (`01-guide`,
`02-architecture`, `03-decisions`), everything written for an agent under
`90-agent/`, and `99-archive` last. A bucket may carry `audience: human` or
`audience: agent`: a person's page is short, in the user's language, and read
by the user at land; an agent's is dense, cites `path:line`, and docs-check
reads it. Only a project with no `docs.json` is asked, once, at survey — step 2
of the fankeel-survey skill — with `audience` first and the shape `detect()`
names second. A project that already has one is not asked again; the roles are
what fankeel needs, not the paths.
```

  - `skills/fankeel-survey/SKILL.md` 第 2 步，在第 88-90 行那段（開頭 `If it says \`filing: nothing declared\``）後面加一段：

```md
With no `docs.json`, ask once, here, whether to lay a tree down — one
`AskUserQuestion`, `audience` as option one (a person's folders numbered
first, an agent's under `90-agent/`), the shape `lib/docs.js`'s `detect()`
names as option two, and "leave it undeclared" last. An answer writes
`.fankeel/docs.json` with `lib/docs.js`'s `write(root, PRESETS[<shape>])`. A
project that already has a `docs.json` is not asked: moving an existing tree
is the `/fankeel-audit` follow-up's work, not survey's.
```

  - `skills/fankeel-land/SKILL.md`，在第 68-70 行那段（結尾「a whitespace fix does the first and proves nothing.」）後面加一段：

```md
A page under a bucket marked `audience: human` that this change touched is
named to the user at the gate: the person it is written for reads it, not a
reviewer.
```

  - `docs/90-agent/reference/documents.md` 第 31-36 行（開頭 `The two shapes that ship — \`flat\` and \`phased\``）整段換成：

```md
The three shapes that ship — `flat`, `phased` and `audience` — and what happens
to a markdown file in no bucket are stated in [the skill](../skills/fankeel/SKILL.md),
under *Where documents live*. What belongs here is why the question is put that
way: it is asked once, at survey, and only where no `docs.json` exists.
`audience` comes first because it is the one shape that says which reader each
folder is for; `detect()`'s answer comes second, so a project that already has
habits still sees its own shape on the list. A project with a `docs.json` is
not asked again — moving an existing tree is the `/fankeel-audit` follow-up's
work.
```

- [ ] **Step 5：跑測試、查引用。**

```
node --test tests/docs.test.js tests/contract.test.js tests/skills.test.js
node scripts/docs-check.js
```

- [ ] **Step 6：commit。** `feat: an audience docs tree survey offers once`，bullets：`— lib/docs.js`、`— skills/fankeel-survey/SKILL.md, skills/fankeel/SKILL.md`、`— docs/documents.md`。

## Task 6: binding 決策：最多七份，列進 map

**Files:**
- Modify: `lib/docs.js` — `BINDING_CAP`、`isBinding(text)`、`bindingOf(root, tree, files)`
- Modify: `scripts/docs-check.js` — `scan` 報第八份起的 binding；`ORDER` 加 `'binding'`
- Modify: `lib/map.js` — `buildMap` 列出 binding 決策
- Modify: `skills/fankeel-land/SKILL.md` — 決策紀錄那一步寫 binding 的時機
- Modify: `skills/fankeel/SKILL.md` — `## Where documents live` 的角色表下一句
- Modify: `docs/90-agent/reference/documents.md` — 新一小節 binding
- Test: `tests/docs.test.js`
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: `docs.frontmatter(text)`、`docs.roleOf(tree, rel)`（`lib/docs.js`，已存在）；`markdownUnder(root)`（`lib/map.js`）。
- Produces: `docs.BINDING_CAP === 7`；`docs.isBinding(text) -> boolean`；`docs.bindingOf(root, tree, files) -> string[]`（排序好的相對路徑）；docs-check finding tag `binding`；map 的段落標題 `binding decisions — <n>:`。

**Dispatch:** implementer, sonnet — 三個小函式與兩個呼叫點，計畫附全文。

- [ ] **Step 1：寫會失敗的 docs-check 測試。** 在 `tests/docs.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 6. A decision marked
// `binding: true` changes how code is written from then on; seven at most
// stand at once, and one with `superseded_by` has stopped counting.
test('an eighth binding decision fails docs-check; a superseded one does not count', () => {
  const files = {};
  for (let i = 1; i <= 8; i++) {
    files['docs/decisions/2026-09-2' + i + '-d' + i + '.md'] = '---\nstatus: current\nbinding: true\n---\n\n# d' + i + '\n';
  }
  const root = withTree(tree(files), 'flat');
  const over = run(root);
  assert.equal(over.code, 1, over.out);
  assert.match(over.out, /binding: docs\/decisions\/2026-09-28-d8\.md:1  8 binding decisions, at most 7/);
  fs.writeFileSync(path.join(root, 'docs', 'decisions', '2026-09-21-d1.md'),
    '---\nstatus: current\nbinding: true\nsuperseded_by: docs/decisions/2026-09-28-d8.md\n---\n\n# d1\n');
  const under = run(root);
  assert.equal(under.code, 0, under.out);
  assert.doesNotMatch(under.out, /binding decisions/);
  assert.equal(docs.isBinding('---\nbinding: true\n---\n'), true);
  assert.equal(docs.isBinding('---\nbinding: false\n---\n'), false);
});
```

- [ ] **Step 2：寫會失敗的 map 測試。** 在 `tests/map.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 6: the binding decisions are
// on the map, which design reads at its step 5; a superseded one is not.
test('the map lists binding decisions, and not one that was superseded', () => {
  const dir = withFiles({
    '.fankeel/docs.json': JSON.stringify(docs.PRESETS.flat),
    'docs/decisions/a.md': '---\nstatus: current\nbinding: true\n---\n# a\n',
    'docs/decisions/b.md': '---\nstatus: current\nbinding: true\nsuperseded_by: docs/decisions/a.md\n---\n# b\n',
    'docs/decisions/c.md': '---\nstatus: current\n---\n# c\n',
  });
  const out = map.buildMap(dir);
  assert.match(out, /\nbinding decisions — 1:\n  docs\/decisions\/a\.md\n/);
  assert.doesNotMatch(out, /docs\/decisions\/b\.md/);
  assert.doesNotMatch(out, /docs\/decisions\/c\.md/);
});
```

- [ ] **Step 3：跑兩個測試檔，看它們紅。**

```
node --test tests/docs.test.js tests/map.test.js
```

- [ ] **Step 4：`lib/docs.js`。** 在 `contractOf` 函式後面加：

```js
// A decision marked `binding: true` changes how code is written from then on;
// one that only explains why something was done is not. At most seven stand at
// once, so the map can list every one; a replaced one carries `superseded_by`
// and stops counting. docs/plans/2026-09-26-station-redesign-design.md §9.
const BINDING_CAP = 7;
function isBinding(text) {
    const fm = frontmatter(text);
    return Boolean(fm) && String(fm.binding || '').trim() === 'true' && !fm.superseded_by;
}
// Every decision-role page under `files` (relative paths) that is binding now.
function bindingOf(root, tree, files) {
    return files.filter((rel) => roleOf(tree, rel) === 'decision').filter((rel) => {
        try {
            return isBinding(fs.readFileSync(path.join(root, rel), 'utf8'));
        } catch (e) {
            return false;
        }
    }).sort();
}
```

並在 `module.exports` 加 `BINDING_CAP, isBinding, bindingOf`。

- [ ] **Step 5：docs-check。** `scripts/docs-check.js` 第 489 行改成 `const ORDER = ['open-fence', 'gone', 'past-end', 'moved', 'orphan', 'into-archive', 'binding'];`。在 `scan` 裡 `const unquoted = findings.filter(...)` 的上面加：

```js
    // Seven binding decisions at most. The eighth and after, in filename order,
    // are the findings, so the fix — `superseded_by` on the one each replaces —
    // is named where it is needed.
    const binding = docs.bindingOf(root, tree, markdown);
    for (const rel of binding.slice(docs.BINDING_CAP)) {
        findings.push({
            role: 'decision', file: rel, line: 1, tag: 'binding',
            what: binding.length + ' binding decisions, at most ' + docs.BINDING_CAP + ' — give the one this replaces superseded_by',
        });
    }
```

- [ ] **Step 6：map。** 在 `lib/map.js` 的 `buildMap` 裡，`planned, not built` 那個 `if (by.intent.length) { ... }` 區塊的後面加：

```js
    // The decisions that change how code is written now. Read at design's step
    // 5 with the rest of this file; never injected into any block.
    const binding = docs.bindingOf(root, tree, markdownUnder(root));
    if (binding.length) {
        lines.push('');
        lines.push('binding decisions — ' + binding.length + ':');
        for (const l of listing(binding)) lines.push(l);
    }
```

- [ ] **Step 7：寫 binding 的時機。**
  - `skills/fankeel-land/SKILL.md`，在第 72-74 行那段（開頭 `A landed plan leaves a decision record behind`）的前面加一段：

```md
Mark the record `binding: true` in its frontmatter only when it changes how
code is written from here on — never for one that explains why something was
done. `docs-check` refuses an eighth; when a record replaces another, give the
old one `superseded_by: <path>` and it stops counting. The map lists every
binding record, and design reads them there at its step 5.
```

  - `skills/fankeel/SKILL.md` 角色表（`| \`decision\` | why something is the way it is.`）下面、`Three shapes ship` 段的上面加一句：「A decision may carry `binding: true`: an ADR is a decision, not another role. At most seven stand at once — docs-check counts them, and `superseded_by` retires one.」
  - `docs/90-agent/reference/documents.md`，在 `## The list is the output, not the count` 標題的上面加：

```md
### `binding: true`, seven at most

An ADR is a `decision` page and nothing else: there is no seventh role for it.
What sets some decisions apart is `binding: true` in the frontmatter — the
record changes how code is written from then on, rather than explaining why
something was done. `docs-check` reports the eighth and every one after it, in
filename order, and a record carrying `superseded_by` has stopped counting.
`scripts/map.js` lists them under **binding decisions**, which is where design
reads them; no injected block carries them. Land is where one is marked.
```

- [ ] **Step 8：跑測試、查引用。**

```
node --test tests/docs.test.js tests/map.test.js tests/docs-check.test.js tests/map-cli.test.js
node scripts/docs-check.js
node scripts/map.js
```

- [ ] **Step 9：commit。** `feat: binding decisions capped at seven, listed on the map`，bullets：`— lib/docs.js`、`— scripts/docs-check.js`、`— lib/map.js`、`— skills/fankeel-land/SKILL.md, docs/documents.md`。

## Task 7: station 上看問題、答問題

**Files:**
- Modify: `assets/station/station.js` — `pgAnswers(questions, picks, others)`；`pendingGateHtml` 加「其他」與停用的送出鈕；點擊與輸入處理
- Modify: `assets/station/station.css` — gate 卡樣式從 mockup 搬過來
- Modify: `scripts/station.js` — `POST /answer` 少答一題回 400
- Modify: `.fankeel/profile.json` — `node scripts/task.js profile set gate.station 300`
- Modify: `docs/90-agent/reference/station.md` — `## Answering a gate from the page`
- Read: `.fankeel/build/2026-09-26-station-redesign/mockup.html` — `data-block="gate-pending"`（第 581-609 行）與它的 CSS（第 214-246 行），不改
- Test: `tests/station-answer.test.js`

**Interfaces:**
- Consumes: none
- Produces: `V.pgAnswers(questions, picks, others) -> { answers: {[question]: string}, missing: number }`；`view.pg` 的 key `<id>:<n>`（勾選）與 `<id>:<n>:other`（其他的文字）；`pendingGateHtml(s, picked)` 簽名不變。

**Dispatch:** implementer, sonnet — 邏輯與標記都在計畫裡，CSS 照 mockup 行號搬。

- [ ] **Step 1：寫會失敗的伺服端測試。** 在 `tests/station-answer.test.js`：把 `function fixture(until)` 改成 `function fixture(until, questions)`，裡面寫 pending 檔那行改成 `JSON.stringify({ questions: questions || Q, at: Date.now(), until })`。檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 7. Two questions, one
// answered: refused, where :525 used to send the one answer on and let the
// hook take it as the whole gate.
const Q2 = [Q[0], { question: '這次一起改哪些？', header: '範圍', multiSelect: true, options: [{ label: 'gate', description: 'a' }, { label: 'tune', description: 'b' }] }];
test('POST /answer refuses an answer that leaves a question asked unanswered', async () => {
    const f = fixture(Date.now() + 60e3, Q2);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (answers) => request(s.url + 'answer', new URLSearchParams({ nonce, root: f.r1, id: SID, answers: JSON.stringify(answers) }).toString());
        const file = answerPath(f.r1, f.data, 'build');
        const partial = await post({ [Q2[0].question]: '暫停' });
        assert.equal(partial.status, 400, partial.text);
        assert.match(partial.text, /every question/);
        assert.equal(fs.existsSync(file), false, 'a partial answer wrote nothing');
        const whole = await post({ [Q2[0].question]: '暫停', [Q2[1].question]: 'gate, 自己打的' });
        assert.equal(whole.status, 201, whole.text);
    } finally {
        s.close();
    }
});

test('the held gate offers 其他 on every question and keeps 送出 off until each has an answer', () => {
    const s = { id: SID, root: '/r', pending: { questions: Q2, until: Date.now() + 30e3 } };
    window.STATION.serve = true;
    try {
        const none = V.pendingGateHtml(s, {});
        assert.equal((none.match(/value="__other"/g) || []).length, 2, 'one 其他 per question');
        assert.equal((none.match(/data-pg-other="\d"/g) || []).length, 2, 'each with its own text box');
        assert.match(none, /data-answer disabled/);
        assert.match(none, /已答 <b class="pgn">0 \/ 2<\/b>/);
        const half = V.pendingGateHtml(s, { [SID + ':0']: ['暫停'] });
        assert.match(half, /data-answer disabled/);
        const all = V.pendingGateHtml(s, { [SID + ':0']: ['暫停'], [SID + ':1']: ['__other'], [SID + ':1:other']: '自己打的' });
        assert.doesNotMatch(all, /data-answer disabled/);
        assert.match(all, /value="自己打的"/);
    } finally {
        window.STATION.serve = false;
    }
});

test('pgAnswers takes typed text as the answer, and counts what is missing', () => {
    assert.deepEqual(V.pgAnswers(Q2, { 0: ['__other'], 1: ['gate', '__other'] }, { 0: '  換個做法 ', 1: 'docs' }),
        { answers: { [Q2[0].question]: '換個做法', [Q2[1].question]: 'gate, docs' }, missing: 0 });
    assert.deepEqual(V.pgAnswers(Q2, { 0: ['暫停'], 1: ['__other'] }, { 1: '   ' }),
        { answers: { [Q2[0].question]: '暫停' }, missing: 1 }, 'a 其他 with nothing typed is no answer');
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test tests/station-answer.test.js
```

- [ ] **Step 3：伺服端。** 在 `scripts/station.js` 的 `POST /answer`，第 525-528 行那個 `if (!keys.length || keys.some(...)) { fail(400, ...); return; }` 後面加：

```js
            // Every question asked, not some: a partial answer used to reach the
            // file, and the hook sent the gate out answered with the rest blank.
            if (keys.length !== asked.size) {
                fail(400, 'answers every question asked — ' + asked.size + ' asked, ' + keys.length + ' answered');
                return;
            }
```

- [ ] **Step 4：`pgAnswers`。** 在 `assets/station/station.js` 的 `pendingGateHtml` 上面加：

```js
    // What 送出答案 sends, and how many questions have no answer yet. Typed
    // 其他 text is the answer on a single-choice question and one more pick on a
    // multi-select one; the `__other` box itself is never an answer.
    function pgAnswers(questions, picks, others) {
        var answers = {}, missing = 0;
        (questions || []).forEach(function (q, i) {
            var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
            var text = String((others || {})[i] || '').trim();
            var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
            if (a) answers[q.question] = a;
            else missing++;
        });
        return { answers: answers, missing: missing };
    }
```

並在 `module.exports` 那個物件的 `pendingGateHtml: pendingGateHtml,` 後面加 `pgAnswers: pgAnswers,`。

- [ ] **Step 5：`pendingGateHtml`。** 把 `assets/station/station.js` 的 `function pendingGateHtml(s, picked) { ... }` 換成：

```js
    function pendingGateHtml(s, picked) {
        var p = s && s.pending;
        if (!p || !p.questions || !p.questions.length) return '';
        var on = picked || {};
        var left = Math.max(0, Math.round((p.until - (S.serve ? Date.now() : NOW)) / 1000));
        var picks = {}, others = {};
        p.questions.forEach(function (q, i) { picks[i] = on[s.id + ':' + i] || []; others[i] = on[s.id + ':' + i + ':other'] || ''; });
        var got = pgAnswers(p.questions, picks, others), n = p.questions.length;
        var dis = S.serve ? '' : ' disabled';
        var qs = p.questions.map(function (q, i) {
            var type = q.multiSelect ? 'checkbox' : 'radio', had = picks[i];
            return '<fieldset class="pgq"><legend>' + esc(q.header || '') + ' · ' + esc(q.question)
                + (q.multiSelect ? '<span class="multi">可多選</span>' : '') + '</legend><div class="opts2">'
                + (q.options || []).map(function (o) {
                    return '<label class="pgo o"><input type="' + type + '" name="pg-' + i + '" value="' + esc(o.label) + '"'
                        + (had.indexOf(o.label) >= 0 ? ' checked' : '') + dis + '> <b>' + esc(o.label) + '</b> <small>'
                        + esc(o.description || '') + '</small></label>';
                }).join('')
                + '<label class="pgo o other"><input type="' + type + '" name="pg-' + i + '" value="__other"'
                + (had.indexOf('__other') >= 0 ? ' checked' : '') + dis + '> <b>其他</b><input type="text" class="pgt" data-pg-other="' + i
                + '" value="' + esc(others[i]) + '" placeholder="自己寫…" aria-label="' + esc(q.header || q.question) + '：其他"' + dis + '></label>'
                + '</div></fieldset>';
        }).join('');
        return '<div class="pg gp" data-block="pending-gate" data-pg-root="' + esc(s.root) + '" data-pg-id="' + esc(s.id) + '">'
            + '<div class="h2">懸著的 gate <small>terminal 還等 ' + dur(left) + '，逾時就回 terminal 問</small></div>' + qs
            + (S.serve ? '<div class="act gpf"><span class="cnt">已答 <b class="pgn">' + (n - got.missing) + ' / ' + n + '</b></span>'
                + '<span class="why">每題都要有答案</span><span class="spacer"></span>'
                + '<button type="button" class="go" data-answer' + (got.missing ? ' disabled' : '') + '>送出答案</button></div>'
                + '<div class="pgr" role="status" aria-live="polite"></div>'
                : '<p class="tally">靜態頁不能作答：開 serve 的頁面，或回 terminal 答。</p>') + '</div>';
    }
```

（`tests/station-answer.test.js:75` 的 `/value="暫停" checked>/` 在 serve 時仍成立：`dis` 是空字串。）

- [ ] **Step 6：頁面上的同步與送出。** 在 `assets/station/station.js` 的點擊處理裡，`// 懸著的 gate: a tick is remembered...` 那段的 `var pgi = ...` 區塊換成下面這段，並把 `var ans = ...` 區塊裡算 `answers` 的 `forEach` 換成呼叫 `pgRead`：

```js
        // 懸著的 gate: a tick is remembered across the poll's re-read, the
        // count and the button follow it, and 送出答案 posts every answer.
        var pgi = e.target.closest('.pg input[name^="pg-"]');
        if (pgi) {
            var pgb = pgi.closest('.pg');
            pgSync(pgb);
            return;
        }
```

`assets/station/station.js` 的 `var ans = ...` 區塊裡，算 `answers` 的 `forEach` 換成：

```js
            var read = pgRead(pg, (who && who.pending && who.pending.questions) || []);
            if (read.missing) { pgr.className = 'pgr bad'; pgr.textContent = '還有 ' + read.missing + ' 題沒答'; return; }
            var answers = read.answers;
```

在 `assets/station/station.js` 的點擊處理函式外面（`function watched()` 的上面）加：

```js
    // The answers the form holds right now, read off the DOM with `pgAnswers`,
    // and the same read written back into `view.pg` so a redraw keeps them.
    function pgRead(pgb, questions) {
        var id = pgb.getAttribute('data-pg-id'), picks = {}, others = {};
        questions.forEach(function (q, i) {
            picks[i] = [].map.call(pgb.querySelectorAll('input[name="pg-' + i + '"]:checked'), function (el) { return el.value; });
            var t = pgb.querySelector('[data-pg-other="' + i + '"]');
            others[i] = t ? t.value : '';
            view.pg[id + ':' + i] = picks[i];
            view.pg[id + ':' + i + ':other'] = others[i];
        });
        return pgAnswers(questions, picks, others);
    }
    function pgSync(pgb) {
        var who = S.sessions.filter(function (x) { return x.id === pgb.getAttribute('data-pg-id'); })[0];
        var qs = (who && who.pending && who.pending.questions) || [];
        var got = pgRead(pgb, qs), btn = pgb.querySelector('[data-answer]'), cnt = pgb.querySelector('.pgn');
        if (btn) btn.disabled = got.missing > 0;
        if (cnt) cnt.textContent = (qs.length - got.missing) + ' / ' + qs.length;
    }
    // Typing in 其他 ticks its box, the way the mockup does, and re-counts.
    doc.addEventListener('input', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.pg [data-pg-other]') : null;
        if (!t) return;
        var box = t.closest('.o').querySelector('input[value="__other"]');
        if (box) box.checked = t.value.trim() !== '';
        pgSync(t.closest('.pg'));
    });
```

打字時 `repaint()` 本來就不重畫（`ae.tagName === 'INPUT'` 且不是 `#q`），所以文字不會被 3 秒的 refresh 吃掉。

- [ ] **Step 7：CSS。** 從 mockup `.fankeel/build/2026-09-26-station-redesign/mockup.html` 第 215-246 行（`.gp{...}` 到 `.gp .why{...}`）整段複製到 `assets/station/station.css` 的 `.pg{...}` 規則（第 1009-1015 行）後面，但**不要**複製 `.gp .clock` 三行與 `@keyframes drain`（第 220-223 行）：頁面沒有倒數條。`.pg` 原有的七行留著（`.pgr.ok`／`.pgr.bad` 還在用）。

- [ ] **Step 8：profile 與文件。** 跑：

```
node scripts/task.js profile set gate.station 300
```

它寫 `.fankeel/profile.json`，輸出以 `fankeel — profile: gate.station = 300` 開頭。注意：從此這個專案的每個 gate 會先在 station 上等 300 秒，terminal 那段時間不顯示問題——使用者 2026-09-26 同意過。`docs/90-agent/reference/station.md` 的 `## Answering a gate from the page`，把「and that every answer names a question asked (400 otherwise)」改成「that every answer names a question asked, and that every question asked has one (400 otherwise — a partial answer is refused rather than sent on)」，並在「送出答案 posts them to `POST /answer`」那句前面插一句：「Every question also has a 其他 box: typed text is the answer on a single-choice question and one more pick on a multi-select one (`pgAnswers`), and 送出答案 stays disabled until every question has an answer.」

- [ ] **Step 9：跑測試、查引用。**

```
node --test tests/station-answer.test.js tests/station-post.test.js tests/station-live.test.js
node scripts/docs-check.js
```

- [ ] **Step 10：commit。** `feat: station gate takes 其他 and refuses a partial answer`，bullets：`— scripts/station.js`、`— assets/station/station.js, station.css`、`— .fankeel/profile.json`、`— docs/station.md`。

## Task 8: tune 改完的通知

**Files:**
- Modify: `lib/station.js` — `tuneOf(dir)`；`gather` 的 session 多 `tune`；`serialize` 帶出去
- Modify: `assets/station/station.js` — `tuneOpen`、`tuneEvents`、`toastHtml`、`toastText`、`tuneChipHtml`；`refresh()` 比對並通知；`draw()` 畫頁首晶片；toast 關閉鈕
- Modify: `assets/station/station.css` — 晶片與 toast 樣式
- Modify: `assets/station/index.html` — 頁首 `#tunechip`、`#toasts` 容器
- Modify: `docs/90-agent/reference/station.md` — 新一小節 tune 通知
- Read: `lib/tune.js` — `queueState(text)`，不改
- Read: `.fankeel/build/2026-09-26-station-redesign/mockup.html` — `data-block="tune-toast"`（第 612-637 行）與 CSS（第 248-281 行），不改
- Test: `tests/station-tune.test.js`
- Test: `tests/station-live.test.js`

**Interfaces:**
- Consumes: `queueState(text) -> Array<{ id, status, block?, ... }>`（`lib/tune.js`）；`V.pendingGateHtml`／`view.pg` 不動（Task 7）。
- Produces: 序列化後每個 session 多 `tune: null | { open, done, rejected, url, items: [{ id, block, status }] }`；`V.tuneOpen(sessions) -> boolean`、`V.tuneEvents(prevSessions, nextSessions) -> [{ id, block, status }]`、`V.toastHtml(ev) -> string`、`V.toastText(ev) -> string`、`V.tuneChipHtml(sessions, permission) -> string`。

**Dispatch:** implementer, sonnet — 邏輯全在計畫裡，CSS 照 mockup 行號搬。

- [ ] **Step 1：寫會失敗的 model 與純函式測試。** 新增 `tests/station-tune.test.js`：

```js
'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 8: the station carries each
// project's tune queue beside a session's pending gate, and the page says when
// a block it was waiting on has been changed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const SID = 'ffffffff-8888-4888-8888-888888888888';
const row = (o) => JSON.stringify(o) + '\n';

function fixture(queue) {
    const base = tmp('fankeel-station-tune-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-09-26T10:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-26T10:00:00.000Z' }) + '\n');
    if (queue) {
        const dir = path.join(r1, '.fankeel', 'build', 'tune');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'queue.jsonl'), queue);
        fs.writeFileSync(path.join(dir, 'serve.json'), JSON.stringify({ port: 7819, pid: 1 }) + '\n');
    }
    return { cfg, r1 };
}
const served = (f) => {
    const ctx = { window: {} };
    vm.runInNewContext(station.serialize(station.gather({ configDir: f.cfg, details: false }), {}), ctx);
    return ctx.window.STATION.sessions.find((x) => x.id === SID);
};

test('serialize carries the tune queue summary beside pending, and null with no queue', () => {
    const f = fixture(row({ id: 'r-0001', status: 'queued', block: 'wizard-step' }) + row({ id: 'r-0001', status: 'taken' })
        + row({ id: 'r-0002', status: 'queued', block: 'model-cost' }) + row({ id: 'r-0002', status: 'taken' })
        + row({ id: 'r-0002', status: 'done', touched: [] }));
    assert.deepEqual(JSON.parse(JSON.stringify(served(f).tune)), {
        open: 1, done: 1, rejected: 0, url: 'http://127.0.0.1:7819/',
        items: [{ id: 'r-0001', block: 'wizard-step', status: 'taken' }, { id: 'r-0002', block: 'model-cost', status: 'done' }],
    });
    assert.equal(served(fixture(null)).tune, null);
});

const at = (status) => [{ id: SID, tune: { open: status === 'taken' ? 1 : 0, done: status === 'done' ? 1 : 0, rejected: status === 'rejected' ? 1 : 0,
    url: 'http://127.0.0.1:7819/', items: [{ id: 'r-0001', block: 'wizard-step', status }] } }];

test('one request moving from in progress to done or rejected is one event; nothing else is', () => {
    assert.deepEqual(V.tuneEvents(at('taken'), at('done')), [{ id: 'r-0001', block: 'wizard-step', status: 'done' }]);
    assert.deepEqual(V.tuneEvents(at('queued'), at('rejected')), [{ id: 'r-0001', block: 'wizard-step', status: 'rejected' }]);
    assert.deepEqual(V.tuneEvents(at('done'), at('done')), [], 'already done last time');
    assert.deepEqual(V.tuneEvents([{ id: SID, tune: null }], at('done')), [], 'never seen open: the first read of a page is not news');
    assert.deepEqual(V.tuneEvents(at('taken').concat(at('taken')), at('done').concat(at('done'))).length, 1, 'two sessions on one project, one event');
    assert.equal(V.tuneOpen(at('taken')), true);
    assert.equal(V.tuneOpen(at('done')), false);
});

test('the toast names the block; the chip counts and links the tune page', () => {
    assert.match(V.toastHtml({ id: 'r-0001', block: 'wizard-step', status: 'done' }), /class="toast done"[\s\S]*已修改完成：<code>wizard-step<\/code>/);
    assert.match(V.toastHtml({ id: 'r-0001', block: 'model-cost', status: 'rejected' }), /class="toast rej"[\s\S]*沒有修改：<code>model-cost<\/code>/);
    assert.equal(V.toastText({ block: 'wizard-step', status: 'done' }), '已修改完成：wizard-step');
    const chip = V.tuneChipHtml(at('taken'), 'granted');
    assert.match(chip, /tune 進行中 <b>1<\/b>/);
    assert.match(chip, /完成 <b>0<\/b>/);
    assert.match(chip, /href="http:\/\/127\.0\.0\.1:7819\/"/);
    assert.doesNotMatch(chip, /data-tune-notify/, 'permission already given');
    assert.match(V.tuneChipHtml(at('taken'), 'default'), /data-tune-notify/);
    assert.equal(V.tuneChipHtml([{ id: SID, tune: null }], 'default'), '', 'no queue, no chip');
});
```

- [ ] **Step 2：寫會失敗的背景分頁測試。** 在 `tests/station-live.test.js` 第 183 行那條 `a hidden tab re-reads nothing on its tick` 後面加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 8. The one exception to the
// test above: while a tune request is in progress the hidden tab keeps
// reading, so it can say the block was changed — a toast, and a browser
// notification when permission was given. With nothing in progress it still
// reads nothing, which is the test above.
test('a hidden tab with a tune request in progress re-reads, and says when the block is done', async () => {
    const tuned = (status) => Object.assign(station('live', 'tune ' + status), {
        sessions: [Object.assign({}, ROW, { state: 'live', task: 't', hasDetail: false,
            tune: { open: status === 'taken' ? 1 : 0, done: status === 'done' ? 1 : 0, rejected: 0, url: 'http://127.0.0.1:7819/',
                items: [{ id: 'r-0001', block: 'wizard-step', status }] } })],
    });
    const p = boot('#/s/aaaa1111-0000/cost', tuned('taken'), (src, win) => {
        if (src.indexOf('station/station-data.js') === 0) win.STATION = tuned('done');
    });
    const said = [];
    const win = p.doc.__win;
    win.Notification = function (text) { said.push(text); };
    win.Notification.permission = 'granted';
    await settle(); await settle();
    p.doc.hidden = true;
    const before = p.loaded.length;
    p.timers[3000]();
    await settle(); await settle();
    assert.equal(p.loaded.length, before + 1, 'the hidden tab read once');
    assert.deepEqual(said, ['已修改完成：wizard-step']);
    assert.match(p.doc.getElementById('toasts').innerHTML, /已修改完成：<code>wizard-step<\/code>/);
});
```

並在同檔的 `boot()` 裡，`const doc = { hidden: false, ...` 物件建好之後加一行 `doc.__win = win;`，讓測試拿得到頁面用的 `window`。

- [ ] **Step 3：跑兩個測試檔，看它們紅。**

```
node --test tests/station-tune.test.js tests/station-live.test.js
```

- [ ] **Step 4：`lib/station.js`。** 在檔頭 require 區加 `const { queueState } = require('./tune.js');`。在 `gather` 函式上面加：

```js
// What `scripts/tune.js` has queued for one project: counts, the url its
// server recorded, and each request's id, block and status — the page compares
// two reads of this to say a block was changed. Read from the files tune.js
// writes under the project's own `.fankeel/build/tune/`; null with no queue.
const TUNE_ITEMS = 50;
function tuneOf(dir) {
    const state = path.join(dir, '.fankeel', 'build', 'tune');
    let text;
    try {
        text = fs.readFileSync(path.join(state, 'queue.jsonl'), 'utf8');
    } catch (e) {
        return null;
    }
    const rows = queueState(text);
    if (!rows.length) return null;
    let url = null;
    try {
        const port = JSON.parse(fs.readFileSync(path.join(state, 'serve.json'), 'utf8')).port;
        if (Number.isInteger(port) && port > 0) url = 'http://127.0.0.1:' + port + '/';
    } catch (e) { /* no server recorded */ }
    const count = (list) => rows.filter((r) => list.includes(r.status)).length;
    return {
        open: count(['queued', 'taken']), done: count(['done']), rejected: count(['rejected']), url,
        items: rows.slice(-TUNE_ITEMS).map((r) => ({ id: r.id, block: typeof r.block === 'string' ? r.block : '', status: r.status })),
    };
}
```

在 `lib/station.js` 的 `gather` 裡 `sessions.push({ ... })`，`pending:` 那行下面加：

```js
                tune: data.active === true ? tuneOf(path.join(root, registry.projectOf ? (registry.projectOf(data) || '') : (data.project || ''))) : null,
```

在 `serialize` 裡，`pending: s.pending || null,` 下面加 `tune: s.tune || null,`。

- [ ] **Step 5：頁面的純函式。** 在 `assets/station/station.js` 的 `pgAnswers` 上面加：

```js
    // ---- tune: a block changed ----------------------------------------------
    // One project's queue can sit on several sessions' rows; an id is one
    // request wherever it appears. `tuneEvents` is every request that was in
    // progress on the last read and has settled on this one — a request first
    // seen settled is not news.
    function tuneItems(sessions) {
        var out = {};
        (sessions || []).forEach(function (s) {
            ((s.tune && s.tune.items) || []).forEach(function (it) { out[it.id] = it; });
        });
        return out;
    }
    function tuneOpen(sessions) {
        return (sessions || []).some(function (s) { return s.tune && s.tune.open > 0; });
    }
    function tuneEvents(prev, next) {
        var was = tuneItems(prev), now = tuneItems(next), out = [];
        Object.keys(now).forEach(function (id) {
            var a = was[id], b = now[id];
            if (a && (a.status === 'queued' || a.status === 'taken') && (b.status === 'done' || b.status === 'rejected')) {
                out.push({ id: b.id, block: b.block, status: b.status });
            }
        });
        return out;
    }
    function toastText(ev) {
        return (ev.status === 'done' ? '已修改完成：' : '沒有修改：') + ev.block;
    }
    function toastHtml(ev) {
        var done = ev.status === 'done';
        return '<div class="toast ' + (done ? 'done' : 'rej') + '" data-toast="' + esc(ev.id) + '">'
            + '<span class="ti">' + (done ? '✓' : '✕') + '</span>'
            + '<span class="tt">' + (done ? '已修改完成：' : '沒有修改：') + '<code>' + esc(ev.block) + '</code></span>'
            + '<button class="tx" type="button" data-toast-x aria-label="關閉">×</button>'
            + '<span class="tb">' + (done ? '改過的頁面由 tune 自己重新載入。' : '要求超出這個 block，已退回。') + '</span></div>';
    }
    // The masthead chip: in progress and done across every project on the
    // page, and the tune server's url when one project has one. `permission` is
    // `Notification.permission`; `default` adds the button that asks for it.
    function tuneChipHtml(sessions, permission) {
        var open = 0, done = 0, url = null, seen = {};
        (sessions || []).forEach(function (s) {
            if (!s.tune) return;
            var key = s.tune.url || s.root;
            if (seen[key]) return;
            seen[key] = true;
            open += s.tune.open;
            done += s.tune.done;
            url = url || s.tune.url;
        });
        if (!Object.keys(seen).length) return '';
        return '<a class="tchip"' + (url ? ' href="' + esc(url) + '" target="_blank" rel="noopener"' : '') + ' title="打開 tune 頁">'
            + '<i class="dot' + (open ? ' live' : '') + '"></i>tune 進行中 <b>' + open + '</b><i class="sep"></i>完成 <b>' + done + '</b>'
            + (url ? '<code>' + esc(url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</code>' : '') + '</a>'
            + (permission === 'default' ? '<button type="button" class="btn" data-tune-notify>背景時通知我</button>' : '');
    }
```

在 `module.exports` 加 `tuneOpen: tuneOpen, tuneEvents: tuneEvents, toastHtml: toastHtml, toastText: toastText, tuneChipHtml: tuneChipHtml,`。

- [ ] **Step 6：refresh、draw、點擊。** 在 `assets/station/station.js` 的 `refresh()`，第一行換成：

```js
        if (busy || (doc.hidden && !tuneOpen(S.sessions))) return;
```

`assets/station/station.js`：`S = w.STATION;` 前面加 `var before = S.sessions;`；`polledAt = Date.now();` 後面加：

```js
            tuneNotify(before, S.sessions);
            if (doc.hidden) { busy = false; return; }
```

在 `assets/station/station.js` 的 `function refresh()` 上面加：

```js
    // A settled tune request, said as a toast here and — with the tab in the
    // background and permission given — as a browser notification. The
    // changed page reloads itself through tune's own overlay.
    function tuneNotify(prev, next) {
        var box = doc.getElementById('toasts');
        tuneEvents(prev, next).forEach(function (ev) {
            if (box) box.innerHTML += toastHtml(ev);
            if (doc.hidden && w.Notification && w.Notification.permission === 'granted') {
                try { new w.Notification(toastText(ev)); } catch (err) { /* the browser refused it */ }
            }
        });
    }
```

在 `assets/station/station.js` 的 `draw()` 裡 `drawNav();` 前面加：

```js
        var tc = doc.getElementById('tunechip');
        if (tc) {
            var chip = tuneChipHtml(S.sessions, w.Notification ? w.Notification.permission : 'denied');
            tc.innerHTML = chip;
            tc.hidden = !chip;
        }
```

在 `assets/station/station.js` 的點擊處理裡（`// 懸著的 gate` 那段前面）加：

```js
        var tx = e.target.closest('[data-toast-x]');
        if (tx) { var t = tx.closest('.toast'); if (t && t.parentNode) t.parentNode.removeChild(t); return; }
        if (e.target.closest('[data-tune-notify]') && w.Notification) {
            w.Notification.requestPermission().then(function () { draw(); });
            return;
        }
```

- [ ] **Step 7：殼與樣式。** `assets/station/index.html` 第 9 行 `servedown` 那個 `<span>` 後面加一行 `  <span id="tunechip" hidden></span>`；`<footer class="foot">` 那行上面加 `<div class="toasts" id="toasts" role="status" aria-live="polite"></div>`。`assets/station/station.css` 檔尾加 mockup 第 252-280 行（`.tchip{...}` 到 `@keyframes tdrain{...}`）——`.tstage`、`.fmast`、`.ghost`、`.tlegend` 是 mockup 的展示框，不搬；`.toasts` 的 `position:absolute` 改成 `position:fixed;z-index:40`；`.toast .ttimer` 與 `.toasts.run` 三行不搬（沒有倒數）。再加一條：

```css
@media (prefers-reduced-motion:reduce){.toasts .toast,.tchip .dot.live{animation:none!important}}
```

- [ ] **Step 8：文件。** `docs/90-agent/reference/station.md`，`## Answering a gate from the page` 那一節的後面加：

```md
## When a tuned block is done

Each live session's row carries its project's tune queue (`tuneOf` in
`lib/station.js`, read with `lib/tune.js`'s `queueState` from
`.fankeel/build/tune/queue.jsonl`): how many requests are in progress, how many
are done, and the url `tune.js serve` recorded. While any is in progress the
masthead shows a chip with both counts and that url, and the three-second
re-read compares each request's status with the last read: one that moved from
in progress to done or rejected is a toast — 已修改完成 or 沒有修改, with its
`data-block` — and, with the tab in the background and notifications allowed
from the chip's button, a browser notification. A hidden tab keeps re-reading
only while a request is in progress. The changed page itself reloads through
tune's own overlay; the station opens no connection of its own for this.
```

- [ ] **Step 9：跑測試。**

```
git add tests/station-tune.test.js
node --test tests/station-tune.test.js tests/station-live.test.js tests/station-shell.test.js tests/station-answer.test.js
node scripts/docs-check.js
```

- [ ] **Step 10：commit。** `feat: station says when a tuned block is done`，bullets：`— lib/station.js`、`— assets/station/station.js, station.css, index.html`、`— docs/station.md`。

## Task 9: 模型花費按版本分

**Files:**
- Modify: `assets/station/station.js` — `modelKey`、`modelLabel`；`dimKey`、`orderKeys`、`colorOf`、`keyLabel`、`paletteOf` 的 `model` 分支
- Modify: `docs/90-agent/reference/station.md` — 第 344 行附近 `by \`family()\`` 那句不動；分段圖例一句
- Read: `lib/prices.js` — 計價本來就按版本，不改
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: none
- Produces: `V.modelKey(model) -> string`（`'opus-5-5'`、`'opus-5'`、`'haiku-4-5'`、`'other'`）；`V.modelLabel(key) -> string`（`'Opus 5.5'`）。`family()` 不變，仍是配色與 `sessionTotals` 用的。

**Dispatch:** implementer, sonnet — 純函式與五個分支，計畫附全文。

- [ ] **Step 1：寫會失敗的測試。** 在 `tests/station-view.test.js`：第 377-379 行三個斷言改成版本：

```js
    assert.deepEqual([usd.days[29].day, usd.days[29].total, usd.days[29].parts], ['2026-09-14', 6.75, { 'opus-5': 2, 'haiku-4-5': 0.75, 'fable-5-1': 4 }]);
    assert.deepEqual([usd.days[28].total, usd.days[28].parts], [1.75, { 'opus-5': 1.25, 'sonnet-5': 0.5 }]);
    assert.deepEqual(usd.keys, ['fable-5-1', 'opus-5', 'sonnet-5', 'haiku-4-5'], 'model keys in price order, then newest version first');
```

`tests/station-view.test.js` 第 370-373 行 `family names the model line...` 那條後面加：

```js
// docs/plans/2026-09-26-station-redesign.md Task 9: the model dimension is
// the version; `family` stays the colour.
test('modelKey tells versions of one family apart, and modelLabel names them', () => {
    assert.deepEqual(['claude-opus-5-5', 'claude-opus-5', 'claude-opus-5-5[1m]', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514', 'gpt-x', null].map(V.modelKey),
        ['opus-5-5', 'opus-5', 'opus-5-5', 'haiku-4-5', 'opus-4', 'other', 'other']);
    assert.notEqual(V.modelKey('claude-opus-5-5'), V.modelKey('claude-opus-5'));
    assert.equal(V.modelLabel('opus-5-5'), 'Opus 5.5');
    assert.equal(V.modelLabel('sonnet-5'), 'Sonnet 5');
    assert.equal(V.modelLabel('other'), 'other');
});

const TWO = [{ id: 'vvvv1111-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'two opus',
    state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 13, 10), updated: NOW, usd: 9, agentUsd: 9, hasDetail: true,
    days: [dayRow('2026-09-13', 'build', 'claude-opus-5-5', 'main', 1.25, 100), dayRow('2026-09-13', 'build', 'claude-opus-5-5', 'agent', 2, 100),
        dayRow('2026-09-13', 'build', 'claude-opus-5', 'main', 0.5, 100)], spans: [] }];

test('the Opus 5.5 segment is the sum of its own rows, in the family hue, the older version lighter', () => {
    const bars = V.dayBars(TWO, 'usd', 'model', DAYS);
    const i = DAYS.indexOf('2026-09-13');
    assert.equal(bars.days[i].parts['opus-5-5'], 3.25);
    assert.equal(bars.days[i].parts['opus-5'], 0.5);
    assert.deepEqual(bars.keys, ['opus-5-5', 'opus-5'], 'newest first');
    const o = Object.assign({}, O, { sel: null });
    const tip = V.segTip(bars, o, '2026-09-13', 'opus-5-5');
    assert.match(tip, /Opus 5\.5/);
    assert.match(tip, /\$3\.25/);
    const svg = V.histSvg(bars, o);
    assert.match(svg, /fill:var\(--m-opus\)/, 'the newest version is the family colour itself');
    assert.match(svg, /fill:color-mix\(in oklab, var\(--m-opus\) 70%, var\(--panel\)\)/, 'the older one is derived from it');
    assert.match(V.legendHtml(bars, o), /Opus 5\.5/);
});
```

- [ ] **Step 2：跑它，看它紅。**

```
node --test tests/station-view.test.js
```

- [ ] **Step 3：`modelKey`、`modelLabel`。** 在 `assets/station/station.js` 的 `function family(model) { ... }` 後面加：

```js
    // The model dimension is the version: `claude-<family>-<major>[-<minor>]`,
    // with a trailing date or `[1m]` dropped. `family()` stays for colour.
    function modelKey(model) {
        var m = /claude-(fable|opus|sonnet|haiku)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/.exec(String(model || ''));
        return m ? m[1] + '-' + m[2] + (m[3] ? '-' + m[3] : '') : 'other';
    }
    function modelLabel(key) {
        var p = String(key).split('-');
        if (p.length < 2) return String(key);
        return p[0].charAt(0).toUpperCase() + p[0].slice(1) + ' ' + p.slice(1).join('.');
    }
```

`module.exports` 裡 `family: family,` 後面加 `modelKey: modelKey, modelLabel: modelLabel,`。

- [ ] **Step 4：五個分支。** 在 `assets/station/station.js`：
  - `dimKey` 的 `if (dim === 'model') return family(r.model);` 改成 `if (dim === 'model') return modelKey(r.model);`
  - `orderKeys` 的開頭（`var fixed = ...` 上面）加：

```js
        if (dim === 'model') {
            var fam = function (k) { var i = MODEL_KEYS.indexOf(String(k).split('-')[0]); return i < 0 ? MODEL_KEYS.length : i; };
            var ver = function (k) { return String(k).split('-').slice(1).join('.'); };
            return Object.keys(seen).filter(function (k) { return seen[k]; })
                .sort(function (a, b) { return fam(a) - fam(b) || verCmp(ver(b), ver(a)); });
        }
```

  - `assets/station/station.js` 的 `colorOf` 裡 `if (dim === 'model') return 'var(--m-' + key + ')';` 換成：

```js
        // One hue per family, from `--m-<family>`; the newest version on the
        // chart is that colour, each older one mixed 30% further toward the
        // panel. `pkeys` is the bar set's own keys here, newest first.
        if (dim === 'model') {
            var f = String(key).split('-')[0];
            if (MODEL_KEYS.indexOf(f) < 0) f = 'other';
            var peers = (pkeys || []).filter(function (k) { return String(k).split('-')[0] === f; });
            var n = Math.max(0, peers.indexOf(key));
            return n === 0 ? 'var(--m-' + f + ')' : 'color-mix(in oklab, var(--m-' + f + ') ' + Math.max(100 - 30 * n, 25) + '%, var(--panel))';
        }
```

  - `keyLabel` 最後的 `return key;` 前面加 `if (dim === 'model') return modelLabel(key);`
  - `paletteOf` 的 `o.dim === 'version' ? bars.keys : ...` 改成 `(o.dim === 'version' || o.dim === 'model') ? bars.keys : ...`

- [ ] **Step 5：文件。** `docs/90-agent/reference/station.md` 裡描述首頁分段（`依 model`）的地方加一句：「`依 model` splits by version — `modelKey()`, `Opus 5.5` beside `Opus 5` — each family one hue from `--m-<family>`, the newest version that colour and each older one lighter; `family()` still colours everything else.」用 `grep -n "依 model\|dim" docs/station.md` 找那一段。

- [ ] **Step 6：跑測試。**

```
node --test tests/station-view.test.js tests/station-live.test.js
node scripts/docs-check.js
```

- [ ] **Step 7：commit。** `feat: station splits model spend by version`，bullets：`— assets/station/station.js`、`— docs/station.md`。

## Task 10: station 記錄主 session 的 effort

**Files:**
- Modify: `lib/usage.js` — `summarise` 取最後一個 assistant 行的頂層 `effort`
- Modify: `lib/detail.js` — `extract` 帶 `effort`；`VERSION` 6 → 7
- Modify: `lib/station.js` — `serialize` 的 session 帶 `effort`
- Modify: `assets/station/station.js` — `effortChip(effort)`；session 頁頭顯示
- Modify: `tests/detail-cache.test.js` — 第 82-83 行的 `6` 改 `7`
- Test: `tests/station-effort.test.js`

**Interfaces:**
- Consumes: `tuneOf` 與 `serialize` 裡的 `tune:`（Task 8，同檔相鄰行）。
- Produces: `summarise(...).effort`（只在 transcript 有時才有這個 key）；detail 的 `effort: string | null`；序列化 session 的 `effort: string | null`；`V.effortChip(effort) -> string`（`null` 回 `''`）。

**Dispatch:** implementer, sonnet — 四個檔各幾行，計畫附全文。

- [ ] **Step 1：寫會失敗的測試。** 新增 `tests/station-effort.test.js`：

```js
'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 10: the main session's
// effort, read from the transcript where Claude Code writes it on every
// assistant line (checked 2026-09-26: `"effort":"medium"` at the top level),
// carried to the page, and shown only when it is there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const usage = require('../lib/usage.js');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const SID = '99999999-1111-4111-8111-111111111111';
const line = (o) => JSON.stringify(o) + '\n';
const said = (rid, s, effort) => line(Object.assign({ type: 'assistant', requestId: rid, timestamp: '2026-09-26T10:00:0' + s + '.000Z',
    message: { model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 } } }, effort ? { effort } : {}));

function transcriptIn(cfg, text) {
    const dir = path.join(cfg, 'projects', 'F--ws');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), text);
}

test('summarise reads the last effort the transcript carries, and adds no key when there is none', () => {
    const cfg = tmp('fankeel-effort-usage-');
    transcriptIn(cfg, said('r1', 1, 'medium') + said('r2', 2, 'xhigh'));
    assert.equal(usage.summarise(path.join(cfg, 'projects', 'F--ws', SID + '.jsonl')).effort, 'xhigh');
    const bare = tmp('fankeel-effort-bare-');
    transcriptIn(bare, said('r1', 1, null));
    assert.equal('effort' in usage.summarise(path.join(bare, 'projects', 'F--ws', SID + '.jsonl')), false);
});

test('serialize carries the effort to the page, and the chip shows only when it is known', () => {
    const base = tmp('fankeel-effort-station-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    transcriptIn(cfg, said('r1', 1, 'xhigh'));
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: '2026-09-26T10:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-26T10:00:00.000Z' }) + '\n');
    const ctx = { window: {} };
    vm.runInNewContext(station.serialize(station.gather({ configDir: cfg }), {}), ctx);
    assert.equal(ctx.window.STATION.sessions.find((x) => x.id === SID).effort, 'xhigh');
    assert.match(V.effortChip('xhigh'), /effort <span class="mono">xhigh<\/span>/);
    assert.equal(V.effortChip(null), '');
});
```

- [ ] **Step 2：跑它，看它紅。**

```
git add tests/station-effort.test.js
node --test tests/station-effort.test.js
```

- [ ] **Step 3：`lib/usage.js`。** 在 `summarise` 裡 `let wakes = 0;` 下面加 `let effort = null;`；在迴圈裡 `if (!sidechain && entry.isSidechain === true) continue;` 下面加：

```js
        // The main session's effort rides on every assistant line, top level
        // (seen 2026-09-26); the last one read is the one in force.
        if (typeof entry.effort === 'string' && entry.effort) effort = entry.effort;
```

在 `lib/usage.js` 的 `const out = { model, usage: ... };` 下面加：

```js
    // Only when the transcript said: every caller that compares the whole
    // object — tests/usage.test.js among them — gets the shape it always did.
    if (effort) out.effort = effort;
```

- [ ] **Step 4：`lib/detail.js`。** `const VERSION = 6;` 改成 `const VERSION = 7;`，上面的註解加一行「7 carries the main session's `effort`.」；`extract` 回傳物件裡 `model: seen ? seen.model : null,` 下面加 `effort: seen && seen.effort ? seen.effort : null,`。`tests/detail-cache.test.js` 第 82 行 `[true, 6, true]` 改 `[true, 7, true]`，第 83 行 `.v, 6,` 改 `.v, 7,`。

- [ ] **Step 5：`lib/station.js`。** `serialize` 的 session 物件裡 `ended: s.ended, model: s.model,` 那行後面加：

```js
            effort: s.detail && s.detail.effort ? s.detail.effort : null,
```

- [ ] **Step 6：頁面。** 在 `assets/station/station.js` 的 `heroEyebrow` 上面加：

```js
    // The main session's effort, when its transcript said; nothing otherwise.
    function effortChip(effort) {
        return effort ? '<span class="chip" title="主 session 最後一次請求的 effort">effort <span class="mono">' + esc(effort) + '</span></span>' : '';
    }
```

`module.exports` 加 `effortChip: effortChip,`；`sessionPage` 裡 `主 session <span class="mono">' + esc(s.model) + '</span></span>' : '')` 後面接 `+ effortChip(s.effort)`。

- [ ] **Step 7：跑測試。**

```
node --test tests/station-effort.test.js tests/usage.test.js tests/detail-cache.test.js tests/detail.test.js tests/station-detail.test.js
```

- [ ] **Step 8：commit。** `feat: station shows the main session's effort`，bullets：`— lib/usage.js`、`— lib/detail.js`、`— lib/station.js`、`— assets/station/station.js`。

## Task 11: 設定精靈改版

**Files:**
- Modify: `assets/station/station.js` — `WIZ_SCENES`、`WIZ_CARD_TEXT`、`WIZ_ASK_ICON`、`wizCards`；`wizStepHtml`、`wizStepsHtml`、`wizHtml` 照 mockup 改畫法
- Modify: `assets/station/station.css` — 第 871 行起的精靈段換成 mockup 的樣式與動畫
- Modify: `docs/90-agent/reference/station.md` — `## Setting a profile from the page` 描述卡片與動畫
- Read: `.fankeel/build/2026-09-26-station-redesign/mockup.html` — `data-block` 的 `wizard`、`wizard-steps`、`wizard-step`、`wizard-summary`（第 323-575 行）與 CSS 第 32-212、303-305 行，不改
- Read: `scripts/render.js` — `findBrowser()`，不改
- Test: `tests/station-wizard.test.js`
- Test: `tests/station-wizard-motion.test.js`

**Interfaces:**
- Consumes: `WIZ_STEPS`、`wizLoad`、`wizApply`、`wizChanges`、`wizOpts`、`wizSummaryHtml` 的行為不變；`findBrowser()`（`scripts/render.js`）。
- Produces: 選項卡片 `<button class="ch" data-k="<key>" data-o="<value>" aria-pressed>`——`wizApply` 讀的就是 `data-k`／`data-o`，點卡片等於點原本的按鈕；`WIZ_SCENES[key][value]` 是 mockup 的 `<svg class="vg">` 字串。

**Dispatch:** implementer, opus — 卡片版面、動畫要停在哪一格、五個鍵之外的題目怎麼收成精簡版，是照 mockup 做的視覺判斷，計畫寫不出全部。

- [ ] **Step 1：寫會失敗的渲染測試。** 新增 `tests/station-wizard-motion.test.js`：

```js
'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 11: every new animation in
// the wizard rests under prefers-reduced-motion. Checked in a real browser —
// a rule that parses is not a rule that applies — with the same page shot
// twice: without the preference something must be running, or this test
// measures nothing; with it, nothing may be.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const profile = require('../lib/profile.js');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const CSS = pathToFileURL(path.join(__dirname, '..', 'assets', 'station', 'station.css')).href;
const PROFILES = { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} };

// Step 0, 收尾, with merge chosen: its card is the one that plays.
function page() {
    let W = V.wizLoad(PROFILES, profile.WIZARD_KEYS, 'machine');
    W = V.wizApply(W, profile.WIZARD_KEYS, PROFILES, { k: 'land.integration', o: 'merge' });
    const body = V.wizHtml(profile.WIZARD_KEYS, W, PROFILES, { serve: false, plugin: '/p', configDir: '/cfg' });
    return '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="' + CSS + '"></head><body>' + body
        + '<pre id="out"></pre><script>requestAnimationFrame(function(){requestAnimationFrame(function(){'
        + 'var run=document.getAnimations().filter(function(a){return a.playState==="running";}).length;'
        + 'document.getElementById("out").textContent="RUN="+run+" RM="+matchMedia("(prefers-reduced-motion: reduce)").matches;});});'
        + '</script></body></html>';
}

function shoot(file, reduce) {
    const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--virtual-time-budget=2000'];
    if (reduce) args.push('--force-prefers-reduced-motion');
    const r = spawnSync(findBrowser(), args.concat(['--dump-dom', pathToFileURL(file).href]), { encoding: 'utf8', timeout: 60000 });
    const m = /RUN=(\d+) RM=(true|false)/.exec(r.stdout || '');
    assert.ok(m, 'the page never reported: ' + String(r.stderr || '').slice(0, 300));
    return { running: Number(m[1]), reduced: m[2] === 'true' };
}

test('the chosen card animates, and under reduced motion nothing is running', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const file = path.join(tmp('fankeel-wizmotion-'), 'wizard.html');
    fs.writeFileSync(file, page());
    const plain = shoot(file, false);
    assert.equal(plain.reduced, false);
    assert.ok(plain.running > 0, 'the control: without reduced motion the chosen card plays');
    const reduced = shoot(file, true);
    assert.equal(reduced.reduced, true, '--force-prefers-reduced-motion did not reach the page');
    assert.equal(reduced.running, 0, reduced.running + ' animations still running under reduced motion');
});
```

- [ ] **Step 2：寫會失敗的結構測試。** 在 `tests/station-wizard.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-station-redesign.md Task 11: one card per option, and
// a moving picture for the five habits the mockup animates.
test('each option is a card carrying data-k and data-o, with a scene on the five animated keys', () => {
    const W = load();
    W.step = 0;
    const land = V.wizHtml(KEYS, W, PROFILES, CTX);
    for (const o of ['merge', 'pr', 'keep']) assert.match(land, new RegExp('class="ch[^"]*" data-k="land\\.integration" data-o="' + o + '"[^>]*>[\\s\\S]*?<svg class="vg'));
    assert.match(land, /class="ch ask" data-k="land\.integration" data-o=""/);
    assert.match(land, /data-k="land\.push" data-o="true"[^>]*>[\s\S]*?<svg class="vg/);
    assert.match(land, /data-k="land\.archivePlan" data-o="true"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'guard');
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="guard" data-o="deny"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'agents');
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="stage\.agents" data-o="survey,build,verify"[^>]*>[\s\S]*?<svg class="vg/);
    W.step = V.WIZ_STEPS.findIndex((s) => s.id === 'model');
    assert.doesNotMatch(V.wizHtml(KEYS, W, PROFILES, CTX), /<svg class="vg/, 'a key with no habit to show gets no scene');
    const again = V.wizApply(load(), KEYS, PROFILES, { k: 'land.integration', o: 'pr' });
    assert.equal(again.val['land.integration'], 'pr', 'a card click is the click wizApply already reads');
});
```

- [ ] **Step 3：跑兩個，看它們紅。**

```
git add tests/station-wizard-motion.test.js
node --test tests/station-wizard.test.js tests/station-wizard-motion.test.js
```

渲染測試紅在 `plain.running > 0`（現在的精靈沒有動畫）——這一格是控制組。

- [ ] **Step 4：場景與文字。** 在 `assets/station/station.js` 的 `var WIZ_STEPS = [` 上面加三張表。`WIZ_SCENES` 的每個值是 mockup 那張卡的 `<svg class="vg" ...>...</svg>` 元素，從 `.fankeel/build/2026-09-26-station-redesign/mockup.html` 逐字複製（不含外層 `<span class="wstg">`），接成一個字串：

| key | value | mockup 行 |
|---|---|---|
| `land.integration` | `merge` / `pr` / `keep` | 352-359 / 363-372 / 376-383 |
| `land.push` | `true` / `false` | 396-404 / 408-414 |
| `land.archivePlan` | `true` / `false` | 427-433 / 437-443 |
| `guard` | `ask` / `deny` / `off` | 464-471 / 475-482 / 486-492 |
| `stage.agents` | `false` / `survey` / `survey,build,verify` / `all` | 507-508 / 512-514 / 518-523 / 527-536 |

以第一格為例，`assets/station/station.js` 裡 `merge` 的值是：

```js
    var WIZ_SCENES = {
        'land.integration': {
            merge: '<svg class="vg" viewBox="0 0 220 76" aria-hidden="true">'
                + '<path class="ln" d="M12 54H208"/><circle class="cm" cx="26" cy="54" r="3.2"/><text class="lbl" x="12" y="71">main</text>'
                + '<g class="scene"><path class="br dr d1" pathLength="1" d="M40 54C56 54 54 24 72 24H128"/>'
                + '<circle class="cb p1" cx="88" cy="24" r="3.4"/><circle class="cb p2" cx="112" cy="24" r="3.4"/>'
                + '<path class="br dr d3" pathLength="1" d="M128 24C146 24 144 54 162 54"/>'
                + '<circle class="cmg p4" cx="162" cy="54" r="5"/></g></svg>',
```

其餘照表逐字接上。每張卡的一行字取自 mockup 的 `<span class="cl">`／`<span class="cd">`，寫進 `assets/station/station.js`：

```js
    var WIZ_CARD_TEXT = {
        'land.integration': { merge: { l: '本機合併', d: '分支併回 main，留在本機。' }, pr: { l: '開 PR', d: '推上去，review 過再合。' }, keep: { l: '留在分支', d: '分支停著，之後自己整合。' } },
        'land.push': { 'true': { l: '推上去', d: '收尾就 push。' }, 'false': { l: '留在本機', d: 'commit 在手上，自己推。' } },
        'land.archivePlan': { 'true': { l: '封存', d: '做完就收進 archive。' }, 'false': { l: '先留著', d: '計畫繼續開著。' } },
        guard: { ask: { l: '先問我', d: 'B 停下來等你點頭。' }, deny: { l: '擋掉', d: '等 A 放手才能改。' }, off: { l: '只提醒', d: '兩邊都改，閃個警告。' } },
        'stage.agents': { 'false': { l: '全自己跑', d: '看得最清楚。' }, survey: { l: '只交 survey', d: '讀 repo 最吃 context。' },
            'survey,build,verify': { l: '交三站', d: 'survey、build、verify。' }, all: { l: '全交出去', d: '主線只轉路徑。' } },
    };
    // `stage.agents` is offered as the four the mockup draws; the seven-stage
    // toggles under them (`wizOpts`) still set any other list.
    var WIZ_CARD_VALUES = { 'stage.agents': ['false', 'survey', 'survey,build,verify', 'all'] };
```

`WIZ_ASK_ICON` 是 mockup 第 387 行 `<span class="wstg">` 裡那個 `<svg viewBox="0 0 24 24" ...>` 元素，逐字複製成一個字串。

- [ ] **Step 5：`wizCards`。** 在 `assets/station/station.js` 的 `wizOpts` 後面加：

```js
    // One card per value: a label, one line, and on the five keys in
    // WIZ_SCENES a scene that plays while its card is chosen or hovered.
    // `data-k`/`data-o` are what `wizApply` reads, so a card click is the same
    // click the buttons were.
    function wizCards(keys, W, k) {
        var v = W.val[k], r = W.rec[k], hasRec = Object.prototype.hasOwnProperty.call(W.rec, k);
        var opts = (WIZ_CARD_VALUES[k] || keys[k].values).slice();
        if (keys[k].builtin === null) opts.push(null);
        var text = WIZ_CARD_TEXT[k] || {}, scenes = WIZ_SCENES[k] || {};
        return '<div class="chs c' + opts.length + '" role="group" aria-label="' + esc(k) + '">' + opts.map(function (o) {
            var id = o === null ? '' : o, t = text[id] || { l: o === null ? '問我' : o, d: o === null ? '到時再決定。' : '' };
            var scene = o === null ? WIZ_ASK_ICON : (scenes[id] || '');
            return '<button type="button" class="ch' + (o === null ? ' ask' : '') + '" data-k="' + esc(k) + '" data-o="' + esc(id)
                + '" aria-pressed="' + wizSame(v, o) + '">' + (hasRec && wizSame(r, o) ? '<span class="rec">建議</span>' : '')
                + (scene ? '<span class="wstg">' + scene + '</span>' : '')
                + '<span class="cl">' + esc(t.l) + '</span>' + (t.d ? '<span class="cd">' + esc(t.d) + '</span>' : '')
                + (o === null ? '' : '<span class="cv">' + esc(o) + '</span>') + '</button>';
        }).join('') + '</div>';
    }
```

- [ ] **Step 6：步驟卡的新畫法。** 改 `wizStepHtml`，保留 `data-block="wizard-step"`、上一題／下一題、`跳到摘要`、`station.hide` 的機器預設提醒：
  - 題目下面，habit 改成一排小膠囊「常見組合」（`<button type="button" class="pc" data-h="<j>" aria-pressed>`，`title` 放 `wsets` 原本的「鍵 → 值」），`wizApply` 的 `data-h` 分支照舊，建議徽章（`W.rec`）因此繼續有來源。
  - 這一題的每個鍵：在 `WIZ_SCENES` 裡的鍵畫成 mockup 第 348-392 行那樣的一組——`.grp` 容器、`.gh` 標題（鍵的 `desc` 加上鍵名的 code）、下面接 `wizCards(keys, W, k)`；`stage.agents` 在卡片下面接原本 `wizOpts(keys, W, profiles, 'stage.agents')` 的七站開關；其他鍵畫成 mockup 第 549-553 行的精簡列（`.mrow`：標題與鍵名，後接 `wizOpts(...)`），`design.skill` 仍只在 `design.mockup` 開著時出現。
  - `wizStepsHtml` 照 mockup 第 325-340 行的 rail 畫：`<nav class="wrail" data-block="wizard-steps">`、`已答 n / 8` 與進度條、每題 `<li class="done|cur"><button class="ri" data-go>`、`rn` 放號碼或勾、`rt` 題名、`rv` 目前值（`wizShow`）、最後一列摘要；`wizHtml` 的外層改成 `<div class="wz play" data-block="wizard">` + rail + `<div class="body">` + 卡。`data-go` 照舊。

- [ ] **Step 7：CSS。** `assets/station/station.css` 第 871 行 `/* ---- 設定: the wizard (2026-09-23) — every rule under .wz ---- */` 起到精靈段結束（`.wz` 開頭的規則都屬於它），換成 mockup 第 32-127 行（wizard）與第 128-212 行（motion vignettes 與 keyframes），並做三個改寫：選擇器 `.wz2` 一律改 `.wz`；第 211-212 行只留產品版規則，改成 `.wz .ch:not([aria-pressed="true"]):not(:hover):not(:focus-visible) .vg *{animation:none!important}` 與同樣條件的 `.ctxm i`；`.play .vg` 的 `.play` 就是 `wizHtml` 外層加的 class。`.sr`、`.srows`、`.scopebar`、`.writebar` 等摘要用的舊規則若 mockup 第 112-127 行沒有對應，留著。最後加：

```css
/* Every scene rests on its last frame; reduced motion runs none of them. */
@media (prefers-reduced-motion:reduce){.wz .vg *,.wz .ctxm i{animation:none!important}}
```

- [ ] **Step 8：文件。** `docs/90-agent/reference/station.md` 的 `## Setting a profile from the page`，把「Each step shows two to four habit buttons; pressing one sets every key it lists」那句起到該段結尾，改成描述現在的畫法：每題先是一排「常見組合」膠囊（按下去設它列的每個鍵，並成為建議），下面每個鍵一組卡片、一個值一張，`land.integration`、`land.push`、`land.archivePlan`、`stage.agents`、`guard` 的卡有一段小動畫，只有被選的與游標停著的那張在播，`prefers-reduced-motion: reduce` 底下全部停在最後一格；其他鍵是一排精簡選項。

- [ ] **Step 9：跑測試、看畫面。**

```
node --test tests/station-wizard.test.js tests/station-wizard-motion.test.js tests/station-view.test.js
node scripts/render.js .fankeel/build/2026-09-26-station-redesign/mockup.html --out .fankeel/build/2026-09-26-station-redesign/shot-mockup
node scripts/docs-check.js
```

`station-wizard.test.js` 原有的每一條都要照舊綠（12 列摘要、8 題、四個 `data-block`、`data-k="design.skill" data-o="impeccable:impeccable"`）。畫面比對交給 build 的 render reviewer。

- [ ] **Step 10：commit。** `feat: settings wizard as cards with habit scenes`，bullets：`— assets/station/station.js`、`— assets/station/station.css`、`— docs/station.md`。

## Task 12: TODO 清掉六條待決定，加兩條 Ready

**Files:**
- Modify: `TODO.md` — `## Needs a decision` 六條移除；stage-agents 那條縮寫後移到 `### 受控 build/verify 實跑`；`## Ready` 加兩條

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 使用者指定；六條的去向要對著 design 第 2、8、10 節逐條判，改的是這個 session 自己的決定紀錄。

- [ ] **Step 1：刪六條。** 刪掉 `TODO.md` 第 81-86 行（〔render〕、〔stage-agents〕、〔docs〕、〔judge〕、〔ledger〕、〔lib〕）。去向：render 由 Task 1 做完；docs（ADR）由 Task 5、6 做完；ledger 由 Task 4 做完；judge 與 lib 決定不改（design 第 8 節），理由寫進 land 時的決策紀錄；stage-agents 縮成下一步。`## Needs a decision` 標題留著，底下空。

- [ ] **Step 2：移到 Waiting。** 在 `### 受控 build/verify 實跑` 那一組的最後一條（第 140 行 〔stage-agents〕接縫「在哪提交」）後面加一行：

```
- 〔stage-agents〕verify 的 mutation 要不要專屬 agent（工具或模型跟 fankeel-brain 不同才拆）；等受控 verify 實跑、k 重跑後再定 — [docs/subagents.md](docs/subagents.md).
```

- [ ] **Step 3：Ready 兩條。** `## Ready` 底下加：

```
- 〔audit〕`/fankeel-audit` 擴充成定期清理機制：docs tree 合規、搬遷對照表、大 repo 分批、排程提醒；先搬 fankeel 自己的 docs，再跑 Trovara — [docs/documents.md](docs/documents.md).
- 〔context〕任務交換區 `.fankeel/build/task-*/context.md`：已驗證事實附 file:line 與 sha，brief 只給路徑、按需讀，上限 40 條，量省多少 — [docs/subagents.md](docs/subagents.md).
```

連到 `docs/90-agent/reference/documents.md`（reference），不連這份 plan 或 design——todo-check 拒絕 plan、decision、report、archive。

- [ ] **Step 4：測試。**

```
node scripts/todo-check.js
```

要 exit 0，第一行是 `1 ready, 0 needs a decision`。

- [ ] **Step 5：commit。** `docs: settle the six Needs-a-decision entries`，bullet `— TODO.md`。

## Task 13: 逐塊調真頁面

**Files:**
- Modify: `assets/station/station.js` — tune 請求改到的區塊
- Modify: `assets/station/station.css` — tune 請求改到的樣式
- Read: `skills/fankeel-build/SKILL.md` — 第 368-384 行 live mode 迴圈，不改

**Interfaces:**
- Consumes: Task 7–11 寫好的真頁面，`data-block` 的 `wizard`、`wizard-steps`、`wizard-step`、`wizard-summary`、`pending-gate`。
- Produces: none

**Dispatch:** user — design gate 選的是「逐塊」：build 寫完真頁面後，使用者在瀏覽器裡用 tune 的 live mode 一塊一塊調，verify 之前做完；沒有 subagent 能替人點頁面。

- [ ] **Step 1：開 station 與 tune。**

```
node scripts/station.js serve
node scripts/tune.js serve --proxy http://127.0.0.1:7817/ --src assets/station/station.js,assets/station/station.css
```

station 每個請求都重讀 `assets/station/`，所以不用 `--rebuild`；改完看不到變化時才補 `--rebuild`。把 tune 印出的網址（預設 7819）給使用者。

- [ ] **Step 2：迴圈。** 使用者按住 Alt 點要改的區塊、寫要改什麼；這個 session 跑 `node scripts/tune.js wait`，照 `skills/fankeel-build/SKILL.md:381`（Task 2 Step 5b 改過）派一個 `fankeel-mockup`，然後 `node scripts/tune.js done <id>`。直到使用者說頁面好了。

- [ ] **Step 3：commit。** `style: station blocks tuned on the real page`，bullets 各區塊一條。之後才進 verify。

## Coverage

| promise | task |
|---|---|
| `lib/stages.js:258` 的 mockup 規則開頭 `Frontend work gets a mockup first: ` 改成 | Task 1 |
| `tests/render.test.js` 加一條：bounded route、`stage: 'design'`、`design.mockup` 開、 | Task 1 |
| 規則原文被引用的地方（`docs/`、`skills/`、`tests/`）一起改，靠 grep 找，不靠記憶。 | Task 1 |
| 新增 `agents/fankeel-mockup.md`：`model: opus`、`effort: high`、工具 Read, Grep, Glob, | Task 2 |
| `.claude-plugin/plugin.json` 的 `agents` 和 `tests/agents.test.js` 的 `NAMES` 各加一筆。 | Task 2 |
| fankeel-design skill 第 3 步兩處派工（畫 mockup、tune 的逐塊改）改成 | Task 2 |
| verify 的 mutation agent 不在這輪：TODO 那條縮成只講它，移到 `## Waiting` 的 | Task 12 |
| `docs/90-agent/reference/subagents.md` 的 agent 數和清單、`.fankeel/map.md` 的 agents 那一行跟著改。 | Task 2 |
| 每個 agent 檔的 frontmatter 寫 `effort:`：reader、reviewer、verifier、render-reviewer | Task 3 |
| `task.js start` 和 `task.js stage` 的輸出多一行建議主 session 的 effort： | Task 3 |
| station 開始記錄 effort：transcript 裡有就讀出來放進 session 的資料，沒有就不顯示。 | Task 10 |
| 這個專案的 profile 設 `gate.station: 300`（使用者 2026-09-26 同意開；300 是精靈允許 | Task 7 |
| `pendingGateHtml` 每題加一個 Other 自由輸入框；打了字就以輸入的文字當答案。 | Task 7 |
| 送出鈕在每題都有答案之前是停用的；`POST /answer` 也改成少答一題就回 400，不再默默 | Task 7 |
| `lib/station.js` 的 model 帶上 tune 佇列的摘要：用 `lib/tune.js` 的 `queueState` 讀 | Task 8 |
| `assets/station/station.js` 的 `refresh()` 比對前後兩次佇列：有一筆從進行中變成 | Task 8 |
| 佇列不是空的時候頁首顯示 tune 狀態（進行中幾筆、完成幾筆）和 tune 的網址。 | Task 8 |
| 被改的頁面本身照舊由 tune 的 overlay 自己 reload；station 這邊沿用 3 秒一次的 | Task 8 |
| `family()`（`assets/station/station.js:220`）保留給配色；`model` 維度改用新的 | Task 9 |
| 同一家族的不同版本同色相、不同明度；顏色由 `--m-<family>` 推出來，不為每個版本 | Task 9 |
| 計價不動，`lib/prices.js` 本來就按版本。 | Task 9 — `lib/prices.js` 只列在 Read |
| 照 mockup 的方向：每個選項一張卡、一行字；開發習慣改成會動的小圖—— | Task 11 |
| 新動畫全部在 `prefers-reduced-motion: reduce` 底下停在最後一格。 | Task 11（Task 8 的晶片與 toast 各自一條） |
| `data-block` 的 `wizard`、`wizard-steps`、`wizard-step`、`wizard-summary` 四個名字 | Task 11 |
| 細節在 build 寫出真頁面之後用 tune 的 live mode 逐塊調（使用者選的「逐塊」路徑）。 | Task 13 |
| `scripts/ledger.js` 的 `parseArgs` 改成每個 verb 有自己允許的旗標清單，清單外的旗標 | Task 4 |
| `judge.js record` 不驗證 subagent transcript：背景派出去的 judge 寫檔可能還沒 flush、 | Task 12 — 不改碼，TODO 那條移除；理由進 land 的決策紀錄 |
| `fanoutSync` 不改：溢出 64MB 時已經降級成逐個 repo 重讀，不會壞；沒有任何量測顯示 | Task 12 — 不改碼，TODO 那條移除；理由進 land 的決策紀錄 |
| 後兩項的理由寫進一份 `docs/decisions/2026-09-26-*.md`，land 時寫。 | land — design 指定 land 時寫，不是 build 的 task |
| `docs.json` 的每個 bucket 除了 `role` 再加 `audience: human \| agent` | Task 5 |
| `lib/docs.js` 在 `flat`、`phased` 之外加第三種建議樹，給人看的資料夾用數字前綴排在 | Task 5 |
| 只有沒有 `docs.json` 的專案，在 survey 問一次要不要套用，這棵樹是第一個選項；已經有 | Task 5 |
| ADR 就是 decision 這一類，不另開：frontmatter `binding: true` 只給「會改變以後寫程式 | Task 6 |
| docs-check 限制一個 repo 最多 7 份 binding；被取代的那份必須有 `superseded_by`，有了 | Task 6 |
| binding 決策列進 `.fankeel/map.md`，design 第 5 步對照 map 時讀到；不進任何注入區塊。 | Task 6 |
| `## Needs a decision` 的六條全部移除，或照第 2 節縮寫後移到 `## Waiting`。 | Task 12 |
| `## Ready` 加一條：`/fankeel-audit` 擴充成定期清理機制，先搬 fankeel 自己的 docs， | Task 12 |
| render.test.js 新的 bounded＋mockup 案例（現在 2420） | Task 1 |
| agents.test.js：`NAMES` 與 plugin.json 都含 `fankeel-mockup`，frontmatter `model: opus` | Task 2 |
| agents.test.js：每個 agent 檔都有 `effort:` 且不是 `max`；task.js 測試：architectural 進 design 印 `xhigh` | Task 3 |
| station-post.test.js：少答一題的 `POST /answer` 回 400；station 測試：pending 卡片有 Other 輸入框 | Task 7 — 寫在 `tests/station-answer.test.js`，fixture 在那裡 |
| station 測試：serialize 出來的 model 帶 tune 佇列摘要；前後兩次佇列一筆轉 done 時產生一則通知 | Task 8 |
| station 測試：`modelKey('claude-opus-5-5')` 和 `modelKey('claude-opus-5')` 不同；畫出來的頁面裡 Opus 5.5 那格的金額等於該版本各列加總 | Task 9 |
| station-wizard.test.js 照舊綠；reduced-motion 下沒有 `animation` 在跑（渲染後檢查） | Task 11 |
| ledger 測試：`ranges --range x` exit 非 0 | Task 4 |
| docs 測試：`binding` 第 8 份時 docs-check 報錯；有 `superseded_by` 的不計 | Task 6 |
| `node scripts/todo-check.js` 綠 | Task 12 |
