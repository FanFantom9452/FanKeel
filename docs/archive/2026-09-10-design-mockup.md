---
status: current
last_verified: 2026-09-10
source_of_truth: docs/plans/2026-09-10-design-mockup-design.md
---

# design 的 mockup 步驟 Implementation Plan

**Goal:** design 在前端專案多一步 mockup，由一個 profile 鍵同時決定要不要做與吃什麼模型。
**Architecture:** 新增 profile 鍵 `design.mockup`（值 `false | sonnet | opus | fable`，內建 `false`）。`lib/profile.js` 的 `parseValue` 已經把 `'false'` 轉成布林，`lib/stages.js` 的 `holds()` 已經把布林 `false` 當關，所以一個鍵同時是開關與模型值，兩支檔案的既有邏輯一行都不改。design 的 stage 物件掛一條 `when: 'design.mockup'` 規則；`rules` 與 `template` 不動，因為 `template` 不受 `when` 過濾。程序寫進 `skills/fankeel-design/SKILL.md`。
**Tech Stack:** Node.js，無執行期相依（`package.json` 是 `private`，`dependencies` 不存在）。測試是 `node --test`。
**Spec:** [2026-09-10-design-mockup-design.md](2026-09-10-design-mockup-design.md)

## Global Constraints

從這棵樹讀出來的，不是記得的：

- **沒有 `CLAUDE.md`，也沒有 `AGENTS.md`。** 慣例只能從程式碼讀。
- **縮排是逐檔的，不是逐目錄。** `lib/` 與 `scripts/` 是 4 空格（`lib/profile.js:56-63`）。`tests/` 兩種都有：`tests/profile.test.js` 是 4 空格（13-95 行），`tests/stages.test.js` 是 2 空格（14-16 行）。改哪一支就照哪一支，不要從目錄推。
- **不得新增相依。** `package.json` 沒有 `dependencies` 也沒有 `devDependencies`，`"private": true`，`"test": "node --test"`。
- **注入上限 2400 字元**，量在 59 字元的參考 plugin root 上——`tests/render.test.js:543`。今天 design 是 **2164**。
- **每個 stage 的 rules 上限 2000 字元**——`tests/stages.test.js:93`。design 今天遠低於此，綁的是上面那條。
- **`ALWAYS` 最多 4 條**——`tests/stages.test.js:58`。這次不動它。
- **行尾是 LF。** `.gitattributes` 是 `* text=auto eol=lf`。工作區的 md 檔是 CRLF，git 在 add 時正規化——不要為此改檔。
- **`docs/plans/` 的 role 是 `plan`**（`.fankeel/map.md` 的 filing）。plan 與 design 兩份都是 `status: design-intent`，落地後才轉 `current` 並封存。
- **`docs/plans/2026-09-09-design-class-prompt.md` 是 design-intent。** 它描述系統要變成的樣子，不是已經存在的東西；本計畫不實作它，也不得把它寫成既有行為。
- **commit 訊息是 conventional commits，小寫，主旨說的是為什麼**——`git log` 最近五筆：`chore:`、`merge:`、`docs:`、`docs(decisions):`、`docs(todo):`。

## File structure

| file | responsibility |
|---|---|
| `lib/profile.js` | 鍵表 `KEYS` 與三層合併；`summary()` 決定哪些鍵出現在注入的 `profile:` 行 |
| `lib/stages.js` | 每個 stage 的 `rules`、`when` 與 `template` |
| `skills/fankeel-design/SKILL.md` | design 的程序：步驟、判準、輸出格式 |
| `docs/pipeline.md` | 七個 stage 的說明與三層 tier |
| `tests/profile.test.js` | 鍵表與合併規則的斷言 |
| `tests/stages.test.js` | 每個 stage 的規則與 template 的斷言 |
| `tests/render.test.js` | 整段注入的字元上限 |
| `TODO.md` | 索引；這條 entry 在 `## Ready` 底下 |

## Task 1: `design.mockup` 進 `KEYS`

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加一列；`summary()` 硬寫的三鍵陣列加一項
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: profile 鍵 `design.mockup`，值域 `['false', 'sonnet', 'opus', 'fable']`，內建 `false`。`profile.read()` 之後 `values['design.mockup']` 是布林 `false` 或字串 `'sonnet'`/`'opus'`/`'fable'`，`sources['design.mockup']` 是 `'builtin'`/`'machine'`/`'project'`

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，是抄寫加測試。

`parseValue`、`read()`、`write()` 一行都不改。`read()` 的 `if (KEYS[key].builtin !== null)`（`lib/profile.js:82`）對布林 `false` 成立，`parseValue(key, false)` 會把它變成 `String(false)` 也就是 `'false'`，落在值域裡，轉回布林 `false`。這是這個設計成立的地方，不要「順手」把它改成 `!= null` 或加特例。

在 `lib/profile.js`，`KEYS` 物件裡 `judge.model` 那一列下面，加：

```js
    'design.mockup': { values: ['false', 'sonnet', 'opus', 'fable'], builtin: false },
```

在 `lib/profile.js` 的 `summary()` 裡，把那個 `for...of` 的陣列換成：

```js
    for (const key of ['guard', 'dispatch.floor', 'judge.model', 'design.mockup']) {
```

`summary()` 只印非內建的鍵，所以沒有人設定的專案在注入的 `profile:` 行上看不到它——這是刻意的，也是為什麼關閉時字元成本是零。

在 `tests/profile.test.js` 末尾加：

```js
test('design.mockup is both the switch and the model', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    // The builtin is the off position, and it survives read() as a boolean.
    const off = profile.read(d, cfg);
    assert.equal(off.values['design.mockup'], false);
    assert.equal(off.sources['design.mockup'], 'builtin');
    // A model name is the on position, and it is the value the rule names.
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'design.mockup': 'opus' }));
    const on = profile.read(d, cfg);
    assert.equal(on.values['design.mockup'], 'opus');
    assert.equal(on.sources['design.mockup'], 'project');
    // Anything outside the four is refused, not silently taken.
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'design.mockup': 'off' }));
    assert.equal(profile.read(d, cfg).values['design.mockup'], false);
});

test('summary names design.mockup once somebody sets it', () => {
    const values = { 'design.mockup': 'opus' };
    const sources = { 'design.mockup': 'project' };
    assert.match(profile.summary(values, sources), /design\.mockup opus/);
    assert.equal(profile.summary({ 'design.mockup': false }, { 'design.mockup': 'builtin' }), '');
});
```

## Task 2: design 的 `when` 規則

**Files:**
- Modify: `lib/stages.js` — design 的 stage 物件加 `when` 陣列
- Modify: `docs/pipeline.md` — design 那節；`when` 的說明從一個使用者改成兩個
- Modify: `tests/render.test.js` — `PROFILES` 的 fixture 補第七個鍵，開關兩種都量
- Read: `lib/profile.js` — `design.mockup` 的值域，Task 1 產出
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: profile 鍵 `design.mockup`（Task 1）
- Produces: design 的 `when` 陣列，一個條目，`when: 'design.mockup'`

**Dispatch:** implementer, sonnet — 規則文字在計畫裡逐字帶著，剩下的是量一個數字。

`rules` 陣列與 `template` 字串**一個字都不動**。`template` 不經過 `when` 過濾（`lib/stages.js:557` 只過濾 `found.when`），所以加在 template 的槽連沒有前端的專案都要付。產物路徑寫在既有的 `spec:` 行上。

在 `lib/stages.js`，design 的 stage 物件裡、`template` 屬性之前，加：

```js
        when: [
            { when: 'design.mockup', text: 'Frontend work gets a mockup first: one page at the model `design.mockup` names, saved under `.fankeel/build/`, its path on the `spec:` line — the gate approves the page, not the paragraph.' },
        ],
```

那條規則是 188 字元。加上接它的換行是 189。開啟時注入的 `profile:` 行還會多 `' · design.mockup opus'`，21 字元。2164 + 189 + 21 = **2374**，離 2400 剩 26。

**這個數字要量，不要引。** 寫完跑：

```
node --test tests/render.test.js
```

讀它印出來的 `design ... chars at a 59-char root` 診斷行。若超過 2400，把規則裡的一句理由挪進 design 的 skill，那是 Task 3 的檔案——不要提高上限。那支測試自己的註解（506-527 行）說明為什麼第四次提高不該發生。

在 `tests/stages.test.js` 末尾加：

```js
// design's rule rides `when`, so a project with no frontend pays nothing for it.
// `land` used to be the only stage with a `when` array; this is the second.
test('the mockup rule is on only where design.mockup names a model', () => {
  const on = rulesFor('design', null, { 'design.mockup': 'opus' }).join('\n');
  assert.match(on, /mockup/, 'design.mockup opus did not switch the mockup rule on');
  assert.match(on, /design\.mockup/, 'the rule does not name the key that carries its model');
  const off = rulesFor('design', null, { 'design.mockup': false }).join('\n');
  assert.equal(/mockup/.test(off), false, 'the mockup rule rides a design stage with no frontend');
  const absent = rulesFor('design', null, {}).join('\n');
  assert.equal(/mockup/.test(absent), false, 'an unset key is not the off position');
});

// The template is not filtered by `when`, so a slot added there is paid for by
// every project. The path goes on the existing `spec:` line instead.
test('the design template gained no slot', () => {
  const { template } = byName('design');
  assert.equal(/mockup/.test(template), false, 'the mockup path took a template slot');
});
```

`byName` 要在這支測試的 require 清單裡；`rulesFor` 已經在了。

在 `docs/pipeline.md`，design 那節加一段說明 `design.mockup`；`when` 那段（提到 `land.archivePlan` 是唯一使用者的地方）改成兩個使用者。pipeline 的文件測試釘住 design 的錨句 `the test that fails now and passes after`——那句話要留在那一節裡。

**這個 fixture 跟規則是同一個交付物，不是下一個任務。** `PROFILES` 今天六個鍵、兩個 archive 答案，測試取其中最大的一份來量。第七個鍵沒進去之前，`profile.read` 給不出 `design.mockup`，`when` 就不成立，量到的是關閉那一份——量了等於沒量。所以規則與 fixture 一起改，一起量。

在 `tests/render.test.js` 的 `PROFILES` 定義處，把它換成開關兩種都涵蓋的四份：

```js
  const PROFILES = [true, false].flatMap((archive) => [false, 'opus'].map((mockup) => ({
    values: { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': archive, guard: 'ask', 'dispatch.floor': 'sonnet', 'judge.model': 'fable', 'design.mockup': mockup },
    sources: { 'land.integration': 'project', 'land.push': 'project', 'land.archivePlan': 'project', guard: 'project', 'dispatch.floor': 'machine', 'judge.model': 'machine', 'design.mockup': mockup === false ? 'builtin' : 'project' },
    unreadable: [],
  })));
```

`design.mockup` 關閉時 `sources` 是 `'builtin'`，因為 `summary()` 只印非內建的鍵——寫成 `'project'` 會讓關閉那一份也多付 21 字元的 `profile:` 行，量出來的關閉成本就是假的。

`assert.ok(size < 2400, ...)` 那一行不動；測試自己會取四份裡最大的。跑完把它印出來的 design 診斷行貼進 verify 的證據裡——那是這次改動的 artefact 準則。

## Task 3: `fankeel-design` 的 mockup 步驟

**Files:**
- Modify: `skills/fankeel-design/SKILL.md` — 第 2 步與第 3 步之間插一步，其餘編號後推；「The gate never scales down」與「Not a defect」各加一句
- Modify: `TODO.md` — 拿掉 `## Ready` 的第一條
- Read: `docs/plans/2026-09-10-design-mockup-design.md` — §3 說這一步要寫什麼

**Interfaces:**
- Consumes: profile 鍵 `design.mockup`（Task 1）；`when` 規則的措辭（Task 2），因為 skill 的文字要跟它一致
- Produces: none

**Dispatch:** implementer, opus — 這一步的措辭要在六支已安裝的設計 skill 之間站得住，而計畫沒有辦法逐字帶著它；那是判斷，不是抄寫。

新的一步要寫進去的六件事，每一件都要在文字裡出現：

1. **判準**——怎麼認定這個任務是前端工作。這是 per-task 的判斷，跟 `class` 一樣說出來讓人推翻；`design.mockup` 回答的是 per-project 的「這個專案有前端嗎」，兩者不是同一個問題。
2. **產物**——一頁 HTML，寫到 `.fankeel/build/<date>-<topic>/mockup.html`，涵蓋 approach 影響到的畫面。不進版控。design 跑在 plan 之前，所以那一刻還沒有 ledger 目錄，`bounded` 連 design 檔與 plan 檔都不會有；能知道的是 stem——有檔的時候三者共用它，沒檔的時候從日期與題目直接取。
3. **抓哪支 skill**——本機已安裝的是 `taste-skill:taste-skill`、`taste-skill:soft-skill`、`taste-skill:minimalist-skill`、`frontend-design:frontend-design`、`ui-ux-pro-max:ui-ux-pro-max`、`impeccable:impeccable`。挑一支，不要全掛。
4. **dispatch 行**——`implementer, <design.mockup 的值>`，理由是視覺設計不吃 `dispatch.floor`。
5. **subagent 拿不到 profile**——`renderBrief({mine, agentType})`（`lib/render.js:359`）沒有 profile 參數，`hooks/brief.js:39` 只傳這兩個，所以模型與路徑必須由派它的 session 寫進 prompt。這一步要明說。
6. **gate**——design 的 option one 的 description 要指到那個檔案，核准的是那張畫面。

「The gate never scales down」那節加一句：mockup 是核准的對象，不是附件。「Not a defect」表加一列：後端任務的 design 沒有 mockup 不是漏做。

`tests/skills.test.js:310-313` 釘的兩句話都在 Output 那節（`| file | change | dispatch |` 與 `a row without one is a design failure`），插入新步驟不會動到它們——但改完要跑一次確認。沒有任何測試釘 `fankeel-design` 的步驟編號。

`TODO.md` 拿掉的是這一條：

```
- design 的 mockup 步驟：frontend task 在 design 多一步 mockup，用 survey 的專案背景與 hallmark 類 skill；`when` 條件規則已落地，只差規則與 skill 文字 — [pipeline.md](docs/pipeline.md)、[design skill](skills/fankeel-design/SKILL.md).
```

拿掉後 `## Ready` 只剩 collisions.md 那一條，所以整個檔仍然通過 `node scripts/todo-check.js`。

## Coverage

承諾照 design 的行逐字抄，因為 `ledger.js lint` 比對的是每個第一層 bullet 的第一行。

| promise | task |
|---|---|
| `lib/profile.js` 的 `KEYS` 加一列： | Task 1 |
| `summary()`（`lib/profile.js:145`）硬寫的 `['guard', 'dispatch.floor', 'judge.model']` | Task 1 |
| `parseValue` 與 `read()` 一行都不改——現有的轉換規則已經給出想要的語意 | Task 1 |
| 內建值是 `false`：沒人開就沒有專案付這段字元，fankeel 自己（無 UI）維持關閉 | Task 1 |
| `lib/stages.js` 的 design 物件加 `when: [{ when: 'design.mockup', text: <下面那條> }]` | Task 2 |
| 該 stage 的 `rules` 陣列與 `template` **一個字都不動** | Task 2 |
| 規則文字要說四件事：什麼時候做、產物寫到哪、用 `design.mockup` 指名的模型派一個 | Task 2 |
| 產物路徑是 `.fankeel/build/<date>-<topic>/mockup.html`——design 跑在 plan 之前， | Task 2、Task 3 |
| **字元預算**：開啟時 design 的注入必須 < 2400。今天 2164，餘 235。規則寫完先跑 | Task 2 |
| 路徑寫在 `spec:` 行而不是新增一個 `mockup:` 槽，因為 template 不受 `when` 過濾 | Task 2 |
| `skills/fankeel-design/SKILL.md` 在第 2 步「One approach」與第 3 步「The success | Task 3 |
| 新步驟要寫：判準（怎麼認定這個任務是前端工作）、產物長什麼樣（一頁 HTML，涵蓋 | Task 3 |
| 「The gate never scales down」那節加一句：mockup 是核准的對象，不是附件 | Task 3 |
| 「Not a defect」表加一列：後端任務的 design 沒有 mockup 不是漏做 | Task 3 |
| **本檔的 survey 那節已經記下**：subagent 拿不到 `design.mockup` 的值，所以派它的 session | Task 3 |
| `tests/profile.test.js`：新鍵在 `KEYS`、四個值都被接受、`'off'` 之類被拒、 | Task 1 |
| `tests/stages.test.js`：`rulesFor('design', null, { 'design.mockup': 'opus' })` | Task 2 |
| `tests/render.test.js`：`PROFILES` 的六鍵 fixture 改七鍵，開與關兩種都量， | Task 2 |
| `docs/pipeline.md`：design 那節描述新步驟；`when` 的說明從「只有 land」改成兩個使用者 | Task 2 |
| `TODO.md`：拿掉 `## Ready` 第一條（design 的 mockup 步驟） | Task 3 |
| **會失敗的測試**：`tests/stages.test.js` 的新測試——開啟時 design 的規則含 mockup | Task 2 |
| **artefact 那條**：`node --test tests/render.test.js` 的 design 診斷行，在第七個鍵 | Task 2 |
