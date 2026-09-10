---
status: design-intent
last_verified: 2026-09-10
source_of_truth: docs/plans/2026-09-10-todo-eight-design.md
---

# TODO 八條 Implementation Plan

**Goal:** 關掉 `TODO.md` 的 1 條 `## Ready` 與 7 條 `## Needs a decision`，其中七條的定案來自七份已歸檔的判斷。
**Architecture:** 七份 `docs/judgements/2026-09-10-*.md` 已經把四題判成「不要蓋」、兩題判成「要蓋」、一題判成「問題本身問錯了」。這份計畫只執行判斷指向的改動：一條 brief 規則、一條長度斷言、四顆 grader 的修正、一支新 agent、兩處文件的接線，以及 `TODO.md` 的收尾。沒有任何一列是這份計畫自己想出來的。
**Tech Stack:** Node.js 24（`node --test`，`package.json:8`），零執行期相依，`private: true`。外掛版本 `0.59.0`，同時寫在 `package.json:3` 與 `.claude-plugin/plugin.json:3`。
**Spec:** [2026-09-10-todo-eight-design.md](2026-09-10-todo-eight-design.md)

## Global Constraints

從專案本身取，不是背的。

- **測試指令是 `node --test`**（`package.json:8`）。沒有 test runner 相依，沒有 `devDependencies`，`private: true`——**不得新增任何相依**。
- **沒有 `CLAUDE.md`，也沒有 `AGENTS.md`。** 慣例出自 `CONTRIBUTING.md`：Verification 一節只能寫實際跑過的檢查；跑不動的放 `Not run:` 並附理由，**而且那不算過**。
- **既有的尺寸斷言，數字照抄：**
  - `tests/brief.test.js:126` — subagent brief `text.length < 1400`（JS `.length`，UTF-16 code unit）。
  - `tests/render.test.js:498` — 整塊注入最壞情況 `worst < 3000` 字元，在 59 字元的 `REFERENCE_ROOT` 下。
  - `tests/render.test.js:546` — 每個 stage `size < 2400` 字元，同一個參考 root。
  - `tests/render.test.js:571,583` — init 區塊 `size < 1400` 字元。
  - `tests/stage-registry.test.js:32` — 每 stage `prompt_bytes <= prompt_byte_budget`，**位元組**，與上面四條的字元不同單位。
- **`tests/agents.test.js:30`** — 每一支 agent 的 `tools` 都不得列 `Edit`、`Write`、`NotebookEdit`。
- **`tests/agents.test.js:37,39`** — `.claude-plugin/plugin.json` 的 `agents` 與 `agents/` 目錄的內容，必須與 `NAMES` 三者逐字相等。新增一支 agent 要同時改這三處。
- **`tests/inventory.test.js:12-22`** — `skills/` 只能有那九個目錄，加一個 `registry.json`，硬編不是掃出來的。
- **`tests/skills.test.js:183`** — `const SPLIT = ['fankeel-build', 'fankeel-plan', 'fankeel-audit'];` 是「哪幾支 skill 有 rationale.md」的契約；`:186-195` 斷言檔案存在、標題相同、且 SKILL.md 在前言恰好連它一次。
- **`.fankeel/.gitignore`** — `sessions/`、`map.md`、`build/`、`index.html`、`station/`。`.fankeel/build/` 不進版控，所以任何要保留的證據都得搬出來。
- **`.fankeel/map.md` 的 filing**：`docs/judgements` 是 `report`、`agents` 與 `skills` 與 `output-styles` 與 `docs` 是 `reference`、`evals` 是 `fixture`、`docs/plans` 是 `plan`、`docs/decisions` 是 `decision`、`docs/reports` 是 `report`、`docs/archive` 是 `archive`。
- **map 列為 planned, not built 的五頁**，不得當成已存在的東西引用：`docs/archive/2026-09-09-fankeel-ask-design.md`、`docs/archive/2026-09-09-fankeel-ask.md`、`docs/archive/2026-09-09-profile-judge-reader-design.md`、`docs/archive/2026-09-09-profile-judge-reader.md`、`docs/plans/2026-09-09-design-class-prompt.md`。
- **收尾必須綠：** `node scripts/todo-check.js`、`node scripts/docs-check.js`、`node --test`。

## File structure

| file | responsibility |
|---|---|
| `lib/render.js` | 注入文字與 subagent brief 的唯一產生處；`RETURN_RULES` 在 `:353-357` |
| `tests/brief.test.js` | brief 的形狀與 1400 上限 |
| `tests/resume.test.js` | `renderResume()` 的內容斷言；本計畫加上它的尺寸斷言 |
| `docs/pipeline.md` | resume 區塊的字數說明，目前七處是人手量的 |
| `evals/*/graders/*.md` | 行為 eval 的評分準則；三顆比對錯的工具名 |
| `evals/*/prompt.md` | 各 case 的 `allowed_tools` |
| `docs/reports/evidence/2026-09-10-exception-cases/` | 四個例外 case 首跑的可提交存證 |
| `tests/skills.test.js` | skill 文字的契約：SPLIT 陣列、rationale 標題、no-plan 讀者 |
| `skills/fankeel-verify/SKILL.md` | verify 的程序；本計畫改它的 rationale 拆分與兩處 verifier 說明 |
| `skills/fankeel-verify/rationale.md` | 新檔，承接 verify 的量測段落 |
| `agents/fankeel-verifier.md` | 新檔，verify 的 verifier 型別 |
| `.claude-plugin/plugin.json` | 外掛 manifest；`agents` 陣列要與 `agents/` 相符 |
| `tests/agents.test.js` | agent 檔的契約；本計畫加一條具名例外 |
| `tests/guard.test.js` | scope guard 的行為；`:233` 的沉默要升格為明說的設計 |
| `docs/collisions.md` | scope guard 的參考頁 |
| `TODO.md` | 八條的收尾 |

---

## Task 1: brief 的第四條規則

`lib/render.js:353-357` 的 `RETURN_RULES` 有三條：回傳值的成本、說出沒查到的、不得自己派 subagent。沒有一條講工作樹。判斷 6 明白把它列為三層保護的第一層（`docs/judgements/2026-09-10-shell-whitelist.md`），因為 hook 那一層被判成不做。

**Files:**
- Modify: `lib/render.js` — `RETURN_RULES` 陣列加第四個字串
- Test: `tests/brief.test.js` — 斷言新規則出現在算好的 brief 文字裡

**Interfaces:**
- Consumes: none
- Produces: none — 新規則是 `RETURN_RULES` 內部的字串，沒有其他 task 依賴它的名字

在 `lib/render.js`，`RETURN_RULES` 陣列第三個字串之後，加第四個：

```js
    'You do not change the working tree outside the job you were sent to do. No `git stash`, `git checkout`, `git reset`, `git clean`, no deleting or moving files you were not asked to change. A parallel reader is working in this same tree.',
```

在 `tests/brief.test.js`，緊接在 `:122-126` 那條 1400 上限的測試之後，加：

```js
test('the brief tells a subagent not to change the working tree', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /working tree outside the job you were sent to do/,
    'the brief carries no working-tree rule');
});
```

跑 `node --test tests/brief.test.js`：新測試先紅（規則還不存在），加了字串後綠，而同檔的 1400 上限兩次都要綠——今日實測 brief 是 823 至 830 字元，加約 230 字元後仍在 1100 以內。

**Dispatch:** in-session — 兩處都是已知行號的單次 Edit，派工的成本高於工作本身。

---

## Task 2: `renderResume` 的長度斷言

`lib/render.js:278` 的 `renderResume()` 在 `tests/` 底下只有四處出現（`tests/resume.test.js:11,244,245,249`），全部是內容 regex，沒有任何尺寸斷言。判斷 1 定案：加，cap `< 2600` 字元。

判斷 1 同時更正了一件事，實作時不要搞混：`render()` 的 2400 是 `tests/render.test.js:546` 的**字元**上限；`skills/registry.json:8-9` 的 2377/2400 是 survey 的**位元組**預算。兩個 2400 不同源。

2600 而非 2400 的理由，照抄判斷：`profile:` 行只上 resume 區塊（`lib/render.js:193-198`），七個 key 那行 146 字元，所以 resume 本來就被允許超過 2400。判斷實測有戳無 profile 是 2204–2366、有 profile 是 2359–2531，最重的是 `bounded@design` 且 `design.mockup` 開著。2531 對 2600 餘 69。

無戳的 `gate:` 行（+226 → 2758）**不計入** cap：那是 hook 未註冊的退化狀況，`tests/gate.test.js:118` 已經斷言它存在。

**Files:**
- Modify: `tests/resume.test.js` — 加尺寸斷言與非空保護
- Modify: `tests/reference-size.js` — 新檔，把 `REFERENCE_ROOT` 與 `sizeAtReference` 從 `tests/render.test.js` 抽出來共用
- Modify: `tests/render.test.js` — `:441,449` 的兩個定義改成 `require('./reference-size.js')`，行為一個字都不變
- Read: `lib/render.js` — `renderResume()` 在 `:278`，`profile:` 行在 `:193-198`
- Read: `lib/stages.js` — `routeForClass` 由 `:581` 匯出，直接 require
- Read: `tests/stage-registry.test.js` — 它的控制組寫法，這一列刻意不照抄

**這一列帶一個 build 階段的裁決**，記在 ledger 裡：計畫原本寫的程式碼用了四個 `tests/resume.test.js` 沒有的名字。`routeForClass` 從 `lib/stages.js:581` 匯出，直接 require 即可；`REFERENCE_ROOT` 與 `sizeAtReference` 是 `tests/render.test.js` 的模組私有值，抽成 `tests/reference-size.js` 給兩邊共用——複製一份正是這次要修的「兩個 2400 不同源」的來源。`PROFILES` 是 `tests/render.test.js:536` 某個測試內的區域 const，在新測試裡照它的形狀重建四格，不要跨檔引用。

**Interfaces:**
- Consumes: none
- Produces: 逐格的 `t.diagnostic` 輸出，Task 3 的文件數字從那裡取

在 `tests/resume.test.js` 檔尾，加：

```js
test('renderResume stays a readable size across every route and profile', (t) => {
  let worst = 0;
  let name = '';
  for (const cls of ['spike', 'bounded', 'architectural']) {
    for (const stage of routeForClass(cls)) {
      for (const profile of [null].concat(PROFILES)) {
        const mine = entry(MINE, { stage, class: cls, gateAt: NOW - 60000 });
        const out = renderResume(profile ? { mine, profile } : { mine }) || '';
        const size = sizeAtReference(out);
        if (size > worst) { worst = size; name = cls + '@' + stage + (profile ? '+profile' : ''); }
        t.diagnostic(cls + '@' + stage + (profile ? '+profile' : '') + ': ' + size);
      }
    }
  }
  assert.ok(worst < 2600, 'worst resume is ' + name + ' at ' + worst + ' chars under a ' + REFERENCE_ROOT + '-character root');
});
```

控制組**不是**照 `tests/stage-registry.test.js:42-52` 壓 cap，判斷說明了為什麼：那裡兩邊都是被測碼產的，這裡 cap 是字面量，唯一空過的路徑是 `renderResume` 回 `null` 讓 `(null||'').length` 變 0。所以控制組是一條非空保護，加在同一個測試的迴圈裡，緊接在 `const size = sizeAtReference(out);` 之後：

```js
        assert.match(out, /^stage rules:$/m, cls + '@' + stage + ' rendered nothing to measure');
```

跑 `node --test tests/resume.test.js`：新測試綠，且 `t.diagnostic` 印出每一格的大小。把 `renderResume` 暫時改成 `return null` 應該讓非空保護紅——確認後還原，不要留在樹上。

**Dispatch:** implementer, sonnet — 計畫已經帶了程式碼，是抄寫加跑測試。

---

## Task 3: `docs/pipeline.md` 的七個數字

`docs/pipeline.md:226,227,228,229,232,233,239` 有七個人手量的 resume 數字。2026-09-10 一次錯三處，就是因為沒有東西會紅。Task 2 的 `t.diagnostic` 現在會把每一格印出來，這一列把文件接上它。

判斷 3 另外指出：`tests/render.test.js:498` 有整塊注入 `< 3000` 的斷言，而文件裡沒有任何一處指向它——「缺的是一處文件引用，不是一個欄位」。這一列一併補。

**Files:**
- Modify: `docs/pipeline.md` — 七處數字改為引用測試輸出，並補一處指向 `tests/render.test.js:498` 的說明
- Read: `tests/resume.test.js` — Task 2 寫進去的 `t.diagnostic` 輸出格式與實際數字
- Read: `tests/render.test.js` — `:498` 那條斷言的原文

**Interfaces:**
- Consumes: Task 2 的 `t.diagnostic` 逐格輸出
- Produces: none

七處各自改成「由 `node --test tests/resume.test.js` 的 `t.diagnostic` 印出，cap 在 `tests/resume.test.js` 的 `< 2600`」的說法，並保留當日實測值加註日期——不要刪掉數字，數字加上出處才有用。補的那一處說明放在講注入大小的段落，寫明整塊最壞情況由 `tests/render.test.js:498` 的 `worst < 3000` 守。

跑 `node scripts/docs-check.js`，每一處 `path:line` 都要解析得到。

**Dispatch:** implementer, sonnet — 文字改寫，數字從 Task 2 的輸出取。

---

## Task 4: 三顆 grader 比對錯的工具名

判斷 2 是這七題裡最重的一份。四顆正向 grader 有三顆是 grader 自己壞的：它們比對 `tool: Task`，而這個 harness 的派工工具叫 `Agent`。`min: 1` 那顆永遠不過、兩顆 `max: 0` 永遠不紅。第四顆 `pipe-or-grep` 也錯：模型確實跑了 `node --test`，只是沒接管線。

`reads-the-file` 那一顆的反斜線問題 `3771e7e` 已經修掉，`input_match` 現在是 `lib[\\/]+thing\.js`，不要再動它。

**Files:**
- Modify: `evals/subagent-no-entry/graders/dispatches-a-reader.md` — `:3` 的 `tool: Task` 改 `Agent`，並改 `:6-7` 講 `Task` 的散文
- Modify: `evals/one-call-not-agent/graders/no-agent-dispatch.md` — `:3` 的 `tool: Task` 改 `Agent`
- Modify: `evals/pipe-not-agent/graders/no-agent-dispatch.md` — `:3` 的 `tool: Task` 改 `Agent`，並改 `:7` 講 `Task` 的散文
- Modify: `evals/pipe-not-agent/graders/ran-the-suite.md` — 新檔名，由 `pipe-or-grep.md` 改名而來，`input_match` 放寬、描述改寫
- Modify: `evals/pipe-not-agent/graders/pipe-or-grep.md` — 改名後刪除，不得留在樹上
- Modify: `evals/one-call-not-agent/prompt.md` — `allowed_tools` 裡的 `Task` 改 `Agent`
- Modify: `evals/pipe-not-agent/prompt.md` — 同上
- Modify: `evals/subagent-no-entry/prompt.md` — 同上
- Read: `lib/eval.js` — `tool_used` 是拿哪個欄位去比對的，改名之前先確認

**Interfaces:**
- Consumes: none
- Produces: none

`pipe-or-grep` 的 `input_match` 現在是 `\|\s*(grep|tail|head|wc)\b`，量的是「接了管線」而不是「跑了測試」。判斷 2 記錄的實際行為是模型跑了 `node --test 2>&1; echo "EXIT=$?"`。改成量測試有沒有被跑。在 `evals/pipe-not-agent/graders/pipe-or-grep.md`，`input_match` 那一行換成：

```markdown
input_match: node\s+--test|npm\s+(run\s+)?test
```

grader 檔名 `pipe-or-grep.md` 與新的準則不符，一併改名為 `ran-the-suite.md`，並把檔內描述改寫成「跑了測試套件」。三顆 `Task` 的改法是逐字換成 `Agent`，散文裡解釋 `Task` 的句子也要改，否則下一個讀的人會以為是筆誤。

跑 `node --test`：`tests/eval.test.js` 若有引用這些檔名要一併更新。**不要跑 eval 本身**——那是 `claude -p`，花費未經授權。

**Dispatch:** implementer, sonnet — 八個檔的字串替換加一次改名。

---

## Task 5: 首跑存證搬成可提交

判斷 2 查到那次跑的產物一直都在：`.fankeel/build/2026-09-10-todo-ten/eval-*.json`，五份，2026-09-10 20:10–20:43，全部 `claude-opus-5`、CLI 2.1.267。survey 沒找到是因為 `.fankeel/.gitignore` 第 3 行是 `build/`，掃描只走 git 追蹤的檔。

`build/` 不進版控是對的，但一次 $2 以上的跑動不該只活在一個被忽略的目錄裡。

**Files:**
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/eval-one-call-not-agent.json` — 新檔，複製
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/eval-pipe-not-agent.json` — 新檔，複製
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/eval-stage-skip-said.json` — 新檔，複製
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/eval-subagent-no-entry.json` — 新檔，複製
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/eval-subagent-no-entry-task.json` — 新檔，複製
- Modify: `docs/reports/evidence/2026-09-10-exception-cases/provenance.txt` — 新檔，記來源路徑、日期、模型、CLI 版本、以及當時的 HEAD

**Interfaces:**
- Consumes: none
- Produces: `docs/reports/evidence/2026-09-10-exception-cases/` 這個路徑，Task 10 的 `TODO.md` 條目會連它

同目錄的五份 `.txt` 摘要也一起搬。`provenance.txt` 至少要有：來源是 `.fankeel/build/2026-09-10-todo-ten/`、五份檔的原始 mtime、`claude-opus-5`、CLI 2.1.267、以及搬移當下 `git rev-parse HEAD` 的結果——寫解析出來的 sha，不要寫 `HEAD`。

**Dispatch:** in-session — 複製與一行 provenance，讀不到任何需要判斷的東西。

---

## Task 6: 守 no-plan 讀者的測試

判斷 4 判「不做節粒度條件載入」，理由是 no-plan 讀者用不到的約四成、對 1M context 不到 0.3%，工程撐不起來。但它同時指出散文條件的真實代價，並且指名對症的做法：

> 散文條件的真實代價是「每加一句 plan-path 就多一次忘掉 no-plan 讀者的機會」，對症的是再一條測試

它也重播了兩次真實的 rot：`f883dc4`（2026-08-29，`Done when` 只認 ledger）與 `14ec966`（2026-08-31，loop 對 no-plan 路線講 groups）。

**Files:**
- Modify: `tests/skills.test.js` — 加一條測試
- Read: `skills/fankeel-build/SKILL.md` — `:15-18` 與 `:83` 是現有的 no-plan 分歧句，`:62-69`、`:187-201`、`:236-257`、`:344-362` 是提到 ledger 的段落

**Interfaces:**
- Consumes: none
- Produces: none

測試的形狀：在 `skills/fankeel-build/SKILL.md` 裡，每一處出現 `ledger.js`、`groups` 或 `brief` 的行，往上找最近的段落開頭，斷言那個範圍內存在一句 no-plan 的括號句（`no plan`、`without a plan`、`design's file table` 之類），否則報出行號。

```js
test('fankeel-build: every ledger mention sits inside a paragraph that names the no-plan reader', () => {
  const skill = fs.readFileSync(path.join(DIR, 'fankeel-build', 'SKILL.md'), 'utf8');
  const paras = skill.split(/\n\n+/);
  const LEDGER = /`ledger\.js`|\bgroups\b|\bbrief\b/;
  const NOPLAN = /no plan|without a plan|file table|spike/i;
  const orphans = [];
  for (const p of paras) {
    if (LEDGER.test(p) && !NOPLAN.test(p)) orphans.push(p.split('\n')[0].slice(0, 60));
  }
  assert.deepEqual(orphans, KNOWN_LEDGER_PARAGRAPHS,
    'a ledger paragraph stopped naming the no-plan reader: ' + JSON.stringify(orphans));
});
```

`KNOWN_LEDGER_PARAGRAPHS` 是一個硬編的白名單常數，放在測試檔上方，內容是**今天實際存在且確實不需要提到 no-plan 的段落開頭**——先跑一次把 `orphans` 印出來，逐段讀過，確定每一段都真的與 no-plan 無關才放進白名單。放進去之前沒讀過的段落，就是這條測試本來要抓的東西。

**Dispatch:** implementer, sonnet — 計畫帶了測試骨架，白名單要逐段讀過才填。

---

## Task 7: verify 的 rationale 拆分

判斷 5 判「不採用 16 行 pattern skill」，理由是注入規則塊本身就是那個形狀（`lib/stages.js:301-309`，2290 bytes、cap 2400、每個 prompt 重送），而 SKILL.md 承載的是注入塊放不下的模板與命令文法。它同時指名該做的事：

> 該做的是把 `2026-09-05-skill-split-design.md` 的拆分做完：當時 `verify` 被列為 0 行 rationale、196 行，現在 244 行且 `:109-135` 是整段 2026-08-26 的量測——先拆 `verify`

判斷 5 那句話有兩半，`build` 那半一樣要做：

> `build` 從拆後 458 行漲回 473（Claude Code 上限 500），殘留 7 行帶日期的量測句要再搬一次

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md` — 移出 `:109-135` 的量測段落，在前言加一次 rationale 連結
- Modify: `skills/fankeel-verify/rationale.md` — 新檔，承接那段量測，標題與 SKILL.md 的相同
- Modify: `skills/fankeel-build/SKILL.md` — 移出殘留的帶日期量測句，前言的 rationale 連結已經在，不要加第二條
- Modify: `skills/fankeel-build/rationale.md` — 承接那幾句，放進標題相同的既有小節
- Test: `tests/skills.test.js` — `:183` 的 `SPLIT` 加 `fankeel-verify`，並更新 `:180` 那句「其他四支沒有 rationale」的註解

**Interfaces:**
- Consumes: none
- Produces: `skills/fankeel-verify/rationale.md` 這個路徑，以及一份行號已經位移過的 `skills/fankeel-verify/SKILL.md`——Task 8 要改同一個檔，靠的是引文而不是行號

`build` 那半：`skills/fankeel-build/SKILL.md` 現在還有帶日期的量測句散在 `:37`、`:128`、`:214`、`:323-324`、`:360` 一帶。逐句讀過再搬——一句話有日期不代表它是量測，判斷 5 要搬的是「某年某月量到某個數字」那種，不是「2026-08-29 那次 rot」那種指事件的。搬完 `skills/fankeel-build/SKILL.md` 的行數要低於 500，`tests/skills.test.js` 若有行數斷言要一併看。

`tests/skills.test.js:186-195` 已經定好契約，照它做：檔案要存在、標題要與 SKILL.md 的相同、SKILL.md 要在前言恰好連 `[rationale.md](rationale.md)` 一次。看 `skills/fankeel-build/rationale.md` 與 `skills/fankeel-plan/rationale.md` 的既有寫法照做，不要自創格式。

`:180` 的註解現在寫「The other four stage skills have no rationale to move — measured」，拆完之後剩三支，數字與名單都要改。

判斷 5 留了一個翻案條件，實作前必須先確認：`docs/decisions/2026-09-05-skill-split-design.md:158` 那條「模型會不會從 plugin cache 跟著相對連結去讀 `rationale.md`」至今沒有驗證紀錄。若真的沒有，把這一列停下來回報，不要繼續搬——搬了等於把理由丟掉。

跑 `node --test tests/skills.test.js`：`SPLIT` 加名字後先紅（`rationale.md` 不存在），建檔後綠。

**Dispatch:** implementer, sonnet — 段落搬移加一個陣列元素，契約已由測試釘死。

---

## Task 8: `fankeel-verifier` 這支 agent

判斷 7 判：Workflow 段的寫檔要求留下、理由句改寫，verifier 釘一支新的 `fankeel-verifier`。它查證了「`agent()` 回傳留在腳本裡」成立（session `07a6a1d4` 的 `wf_448647af-83d` 十個 agent 只喚醒 parent 一次），所以寫檔擋的不是「回傳進 session」而是「列進 join」——理由成立但原本寫錯了。

**這一列有一堵判斷 7 沒看到的牆。** `tests/agents.test.js:30` 斷言每一支 agent 的 `tools` 都不得列 `Edit`、`Write`、`NotebookEdit`，而判斷 7 要的 verifier 帶 `Write`。這不是可以繞過的細節，實作時要正面處理：把那條斷言從「全體皆禁」改成「除了具名的例外」，並在測試檔裡寫下例外的理由——`Write` 受 `guard.js` 管（`.claude-plugin/plugin.json:75-85` 的 `PreToolUse` matcher 就是 `Edit|Write|NotebookEdit`），而 `Bash` 不受管，所以帶 `Write` 的 agent 比帶 `Bash` 的更受約束，不是更不受。

**Files:**
- Modify: `agents/fankeel-verifier.md` — 新檔
- Modify: `.claude-plugin/plugin.json` — `agents` 陣列加 `./agents/fankeel-verifier.md`
- Modify: `skills/fankeel-verify/SKILL.md` — 兩處，用引文定位不用行號，見下
- Test: `tests/agents.test.js` — `NAMES` 加名字，`:30` 的禁列改為具名例外
- Read: `agents/fankeel-reviewer.md` — frontmatter 的欄位順序與 `model: sonnet` 的寫法，照它做
- Read: `skills/fankeel-build/SKILL.md` — `Dispatch it as` 那一句的形狀，以及 build reviewer 在 scratch copy 上做 red-green 的段落。Task 7 已經改過這個檔，讀的是它改完之後的樣子
- Read: `docs/judgements/2026-09-10-verifier-agent.md` — 判斷全文，特別是為什麼 red-green 不歸 verifier

**Interfaces:**
- Consumes: Task 7 已經改過 `skills/fankeel-verify/SKILL.md`，把 `:109-135` 那段搬走並加了一行 rationale 連結，所以這一列之後那個檔的行號整體位移約 26 行。**這一列不得使用任何 `skills/fankeel-verify/SKILL.md` 的行號**，兩處都以引文定位。
- Produces: agent 名 `fankeel-verifier`；`skills/fankeel-verify/SKILL.md` 引用它時寫 `subagent_type: fankeel-verifier`，Workflow 腳本裡寫 `agentType: 'fankeel:fankeel-verifier'`

`skills/fankeel-verify/SKILL.md` 的兩處，各以它自己的句子定位：

- 第一處是「One verifier per task, where a ledger exists」那個標題底下、講「the verifiers go out in one response — four is still the ceiling, and a plan of six goes four then two」的那一段。在那句之後補上 `subagent_type: fankeel-verifier`，寫法照 `skills/fankeel-build/SKILL.md` 裡 `Dispatch it as` 那一句的形狀。
- 第二處是「the verifier for a task writes its evidence rows to a file and returns the path; the adversary for that task reads the path」那一段。理由句改寫，證據檔的路徑從 scratchpad 改成該 plan 在 .fankeel/build 底下的自有目錄——scratchpad 會被清，那個目錄不會。

`agents/fankeel-verifier.md` 的 frontmatter：

```markdown
---
name: fankeel-verifier
description: Writes one task's evidence rows to a file and returns the path — verify's per-task verifier. Runs tests and read-only git; writes nothing but the evidence file it was given a path for.
tools: [Read, Grep, Glob, Bash, Write]
model: sonnet
status: current
last_verified: 2026-09-10
source_of_truth: docs/judgements/2026-09-10-verifier-agent.md
---
```

本文要寫明三件判斷 7 說了的事：Write 只用於被指定路徑的證據檔；Bash 用於跑測試與唯讀 git，不改樹；red-green 不歸它——verify 的 SKILL 在兩處把 red-green 留在 session（判斷 7 引的是 137-138 與 209-210 兩段），因為並行的 verifier 共用一棵樹；要紅得照 build reviewer 的做法在 scratch copy 上，否則那一列寫 `no negative path`。

`tests/agents.test.js:30` 改成：

```js
        const MAY_WRITE = { 'fankeel-verifier': ['Write'] };
        const allowed = MAY_WRITE[name] || [];
        for (const banned of ['Edit', 'Write', 'NotebookEdit']) {
            if (allowed.includes(banned)) continue;
            assert.ok(!tools.includes(banned), name + ' lists ' + banned);
        }
```

`:181-183` 的理由句改寫成：寫檔擋的是證據列進入 Workflow 的 join，而不是進入 session 的 context——`agent()` 的回傳本來就留在腳本裡。路徑從 scratchpad 改成 `.fankeel/build/<plan>/`，因為 scratchpad 會被清。

跑 `node --test tests/agents.test.js`：`NAMES` 加名字後先紅（檔案不存在、manifest 不符），三處都補上後綠。

**Dispatch:** implementer, sonnet — 計畫帶了 frontmatter 與測試改法，是抄寫加三處同步。

---

## Task 9: guard 對 shell 的沉默，升格為明說的設計

判斷 6 判「不擋」，並指出 `tests/guard.test.js:233` 的測試名是「沒帶路徑就不說話」，講的是 payload 形狀不是 Bash。它要的是把行為升格為明說的設計，行為本身不動。

它也重播了唯一在案的「樹被切走」事件：`docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab2.sh:9` 與 `ab3.sh:11` 的 `git checkout --quiet 86a104e`——那是主線程跑的腳本，hook 只看得到 `bash ab2.sh`。對自身動機案例零命中的檢查是錯的檢查。

**Files:**
- Test: `tests/guard.test.js` — `:233` 的測試名改寫，加一行註解指向判斷
- Modify: `docs/collisions.md` — 加一節，記操作者可以自己加的 `permissions.deny`

**Interfaces:**
- Consumes: none
- Produces: none

測試名從「沒帶路徑就不說話」改成明說 Bash 與 PowerShell 不在守備範圍，並在測試上方加註解指向 `docs/judgements/2026-09-10-shell-whitelist.md`。斷言本身一個字都不要改——`:237` 的 `tool_name: 'Bash'` 回空字串是既有行為，這一列只是讓它有名字。

`docs/collisions.md` 那一節寫成**操作者的一步**，不是外掛出貨的東西：判斷 6 列的 `Bash(git stash:*)`、`Bash(git checkout:*)`、`Bash(git reset:*)`、`Bash(git clean:*)`、`PowerShell(Remove-Item:*)` 放進使用者自己的 settings 的 `permissions.deny`。同時照抄判斷的保留：`permissions.deny` 在 `defaultMode: "auto"` 與 bypassPermissions 下是否仍生效，**沒有人驗過**——這句話要寫進去，不要漏掉。

**不要修改任何 settings 檔。** 這一列只寫文件。

跑 `node --test tests/guard.test.js`：行為不變，全綠。

**Dispatch:** implementer, sonnet — 一個測試名、一段文件。

---

## Task 10: `TODO.md` 的收尾

八條全部有了結論，這一列把它們關掉或改寫，並更正一個沒人對得上的數字。

`TODO.md:63` 的 `777` 是錯的：`lib/render.js` 與 `tests/brief.test.js` 都 grep 不到這個數字，兩次獨立實測是 823 與 830。這條在關掉時順手更正。

**Files:**
- Modify: `TODO.md` — 八條關掉或改寫，新條目進 `## Ready` 或 `## Waiting`
- Read: `docs/judgements/2026-09-10-resume-assertion.md` — 判斷 1 的翻案條件
- Read: `docs/judgements/2026-09-10-exception-cases.md` — 判斷 2 的五連跑要求
- Read: `docs/judgements/2026-09-10-pattern-skill.md` — 判斷 5 的翻案條件

**Interfaces:**
- Consumes: Task 5 產生的 `docs/reports/evidence/2026-09-10-exception-cases/` 路徑
- Produces: none

八條的處置：`## Ready` 那條與決議 1、3、4、5、6、7 由 Task 1 到 9 關掉，直接刪除條目。決議 2 改寫——`stage-skip-said` 的歸因仍未定，因為 n=1 分不出 prompt 與模型，判斷 2 要求同一個 commit 五連跑（約 $2.8）。它移到 `## Waiting`，`lifts when: stage-skip-said 在同一個 commit 跑滿五次`，加 `09-10` 戳，連到 Task 5 搬出來的存證路徑。

判斷帶出的新工作各自成條：判斷 5 的「`rationale.md` 相對連結能不能被讀到」若 Task 7 確認未驗證，進 `## Waiting`，`lifts when: 一次 headless 探測證實模型會不會跟相對連結` 加 `09-10` 戳。判斷 6 的「`permissions.deny` 在 auto 模式下是否生效」同樣進 `## Waiting`。

跑 `node scripts/todo-check.js`：六條規則都要過——連結解析得到、不指向 plan/decision/report/archive、不超長、標題是那三個之一、`## Waiting` 的有 `lifts when:` 與戳。

**Dispatch:** in-session — 讀三份已經在這個 session 裡的判斷，改一個檔。

---

## Coverage

design 的每一條第一層 bullet 逐字引用其首行，再指到 task。

| promise | task |
|---|---|
| `lib/render.js:353-357` 的 `RETURN_RULES` 加第四條，說 subagent 不得改動被派 | Task 1 |
| `tests/brief.test.js` 加一條斷言：算好的 brief 文字含這條新規則。 | Task 1 |
| `tests/brief.test.js:126` 的 `assert.ok(text.length < 1400)` 必須仍然綠。今日 | Task 1 |
| `TODO.md:63` 的 `777` 是錯的——`lib/render.js` 與 `tests/brief.test.js` 都 grep | Task 10 |
| 這是提醒層不是防線，`TODO.md:63` 自己就這麼寫。§3 的判斷才決定防線在哪。 | Task 1 — 判斷 6 已把它列為三層保護的第一層 |
| 決議 3（總預算）與決議 4（切節）：一個到節的載入器會改變「每 stage 一欄位元組 | Task 3 — 兩題都判不加，落地的是那一處文件引用 |
| 決議 4（切節）與決議 5（16 行 skill）：若 SKILL.md 縮到 16 行，就沒什麼可切； | Task 6、Task 7 |
| 決議 6（hook matcher）與決議 7（`subagent_type`）：matcher 是防線， | Task 8、Task 9 |
| 決議 2：那次跑的產物在整個 repository 裡不存在（`docs/reports/`、 | struck — 判斷 2 證明它一直在 `.fankeel/build/2026-09-10-todo-ten/`，gitignore 讓掃描看不到；Task 5 把它搬出來 |
| 決議 7：`skills/fankeel-plan/SKILL.md` 有和 verify 一模一樣的 `subagent_type` | struck — 判斷 7 證明 `:290` 有釘 `fankeel-reviewer`，plan 無缺口 |
| **第 2 題最重**：那次跑的產物一直都在，`.fankeel/build/2026-09-10-todo-ten/eval-*.json` | Task 4、Task 5 |
| **第 1 題**：兩個 2400 不同源。`render()` 的 2400 是 `tests/render.test.js:505-507` | Task 2 |
| **第 7 題**：`skills/fankeel-plan/SKILL.md:290` 有釘 `subagent_type: fankeel-reviewer`， | struck — 是一處更正而非工作 |
| 另外第 3 題指出 `tests/render.test.js:498` 有整塊注入 `< 3000` 的斷言，第 4 與 | Task 3 |
| 第 2 題說 `stage-skip-said` 是唯一真訊號，而 n=1 分不出 prompt 與模型；要定案 | Task 10 — 移進 `## Waiting`，五連跑的花費另外問 |
| 第 5 題的翻案條件：`docs/decisions/2026-09-05-skill-split-design.md:158` 那條 | Task 7 開頭確認，Task 10 視結果建條目 |
| `TODO.md` 八條各自關掉或改寫。判斷帶出的新工作以新條目進 `## Ready` 或 | Task 10 |
| `docs/README.md` 的 `## Judgements` 表格與 `docs/judgements/` 目錄，在這個 | struck — 已完成於 design 階段，七列已補 |
| `node scripts/todo-check.js` 與 `node scripts/docs-check.js` 都要綠。 | Task 10 |
| `tests/brief.test.js` 多一條斷言：現在紅（規則不存在），加了之後綠；同檔 | Task 1 |
| `tests/resume.test.js` 多一條長度斷言與一個控制組：控制組把 cap 壓到 1 時 | Task 2 — 判斷 1 把控制組改成非空保護，理由記在判斷裡 |
| 產物那一列：`docs/reports/evidence/2026-09-10-exception-cases/` 的四份 JSON 裡 | Task 4、Task 5 |
| `node scripts/todo-check.js`、`node scripts/docs-check.js`、`node --test tests/` | Task 10 |
