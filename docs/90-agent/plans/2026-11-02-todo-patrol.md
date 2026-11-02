---
status: design-intent
last_verified: 2026-11-02
---

# TODO 全表盤點（11-02）Implementation Plan

**Goal:** 這輪盤點 do now 的十條加上新項「shell 標示」做完：Pane 與 station 的背景 shell 列看得出在跑什麼；兩條 TODO 依 survey gate 的答案改狀態（station 導覽改 Watch、「先問完、剩下自己跑」重開）。
**Architecture:** 七組改動合成一份計畫，只有兩對任務共用檔案而前後排（Task 5 與 12 都改 `docs/01-guide/profile.md`、Task 3 與 14 都改 `tests/skill-size.test.js`）：TODO 狀態（Task 1）、三個小修（Task 2-4）、閒置壓縮與 init（Task 5-7）、shell 標示（Task 8-11）、blast-radius lens（Task 12-14）、背景等待三條（Task 15-17）、dispatch gate 走 decider（Task 18）；兩個要使用者在自己的 session 親手觀察的任務放最後（Task 19、20），沒有任何 dispatched 任務依賴它們。「評估 Monitor 取代背景 Bash」的結論是不取代，寫進 Task 17，重開條件由 Task 19 的觀察決定。
**Tech Stack:** Node `>=22.5`（package.json），零 runtime 依賴，無 build；測試用 `node:test` + `node:assert/strict`；`hooks/*.ts` 在測試裡以 `import(pathToFileURL(...))` 載入（見 `tests/pane-shell.test.js`）。
**Spec:** ../../../.fankeel/build/task-20261102T121659/survey.md

## Global Constraints

- 4 格縮排、`'use strict';` 開頭（`.js`）、單引號字串；`hooks/*.ts` 沿用該檔現有風格（2 格縮排、無分號）。
- 零 runtime 依賴；不加 npm 套件（CONTRIBUTING.md）。
- CONTRIBUTING.md「Tests」：`node --test`；每個匯出名要有 importer；新測試檔寫完要 `git add`，`tests/source.test.js` 才看得到。
- 一個實作者只跑自己的測試檔，never the full suite；整套由 build 的父層跑（`suite.js --fast`）。
- 版本號只用 `scripts/version.js` 動；本計畫不動版本，land 階段一次處理（改到程式與 skill，bump minor）。
- TODO 條目只用 `scripts/todo.js` 建與關；`todo.js` 沒有改狀態的子命令，改狀態直接改 frontmatter，改完跑 `node scripts/todo-check.js`。
- `tests/stages.test.js:992` 要求每個 controlled 階段的 await 規則含 ``run `node <plugin>/scripts/await.js --session sid` with Bash `run_in_background`, end your turn; never poll.``，且以 `After the dispatch, each SendMessage` 開頭——新句只能接在 `never poll.` 後面。
- `tests/render.test.js` 的 controlled 區塊每階段 `< 2400` 字元；`tests/stages.test.js:1241-1246` 的 `prompt_bytes <= prompt_byte_budget`。今天 survey 2423/2450、build 2425/2450、land 2502/2550——調高任何 `budget` 是設計決定，實作者不得自行調。
- skill 大小上限在 `tests/skill-size.test.js`；動上限的任務要寫出實測位元組。
- `tests/plantasks-workflow.test.js:97` 逐字比對 `cd into it before every command.`；本計畫不動 `lib/plantasks.js`。
- `docs/90-agent/reference/subagents.md` 只有兩個任務改：Task 17（:312 一詞、:344-348 的 ask 句、:628-677、:925-928）與 Task 19（:640-654）；行號以當時的檔為準，用 Edit 的逐字 `old_string` 定位。

## Risks

- todo-check 對 watch 的 `timing` 格式有比 pane-18 更嚴的要求 — Task 1 — 先跑 `node scripts/todo-check.js` 看 pane-18 這種形狀是否無錯，照錯誤訊息補。
- 加入架上條目後，花費統計的總額與 `scanned` 變大，既有 spend 測試若用了含架上條目的固定 fixture 會多算 — Task 4 — 先跑 Step 5 列的八個 spend 相關測試檔，有紅就停下回報，不調斷言。
- ask skill 只剩 7 位元組餘裕，加句會撞 `tests/skill-size.test.js` 的上限；此 TODO 稱 docs-only，實際動了測試檔與 skill，land 須跑全套而非只 `version.js` + `todo-check.js` — Task 3 — 先 `wc -c` 量，再決定升到 9000 或縮句。
- :312 的一詞由 Task 17 補，與同任務的 :628-677、:925-928 同檔不同段；前面的編輯會挪動行號，以文字（``else the agent file's `effort:` ``）定位而非行號 — Task 17 — 先 grep 該句再改。
- `process.env.CLAUDE_CODE_SUBAGENT_EFFORT` 在跑測試的 shell 若已設，會污染 `tests/title-hook.test.js` 等走真實 env 的測試 — Task 2 — 該類測試顯式傳 `env`（`title.test.js` 傳 `{}`）；若 hook 測試因環境變數變紅，在其 spawn 的 env 清空該變數。
- `lib/spend.js` 與 `scripts/render.js` 被「移除 station tour」的 session 佔著（guard deny）的說明寫在 TODO；若仍被佔，寫入會被拒 — Task 4 — 先 `git log -3 -- lib/spend.js scripts/render.js` 與 `task.js intends` 看有無 warn，有就停下回報。
- 把 `lib/profile.js:56` 的 desc 一起改會讓 `docs/01-guide/profile.md` 的 `PROFILE_TABLE` 與來源不符 — Task 5 — 先確認只在表格外加段落，`node scripts/docs-check.js` 與 `tests/profile*.test.js` 仍綠。
- init SKILL.md 新 bullet 提到 `.claude/settings.local.json` 與 `.fankeel/build/**` 這類在 git 之外或萬用字元的路徑，docs-check 可能當成死連結 — Task 6 — 跑 `node scripts/docs-check.js`，若報，這兩處改成不帶反引號的描述（`docs/90-agent/todo/stage-agents-10.md` 是真檔，保留）。
- init-4 改 watch 後缺 `group` 或 `stamp`，todo-check 報 undated — Task 7 — 跑 `node scripts/todo-check.js`；`stage-agents-10.md` 的 front matter 是同形式的對照。
- Idle compaction 的說法（200K+、cache 過期、`/config` 可關）出自 2.1.314 changelog :66 的判決轉述，沒有在實機驗過 — Task 5、Task 6 — 實作者逐字只用判決 `docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md:88` 已有的說法，不加新事實。
- 縮短規則誤傷真實指令（例如 `node --test scripts/x.js` 或引號內含空白的路徑被切壞） — Task 8 — 測試先寫「不變」案例（`node --test`、`npm test`、`cd F:/ws` 單獨一個），再寫縮短案例；規則只認 `node` 後面緊接 `…/scripts/<name>.js`。
- 兩份規則（`hooks/pane-shell.ts` 與 `lib/shells.js`）日後分岔，Pane 與 station 同一個 shell 標示不同 — Task 10 — 兩邊測試用同一組輸入輸出對照表，Task 10 先逐項對 Task 8 的表。
- `AWAIT_RULE` 多一句後超過 `render.test.js` 的 2400 字元或某階段 `prompt_byte_budget`（今天 survey 只剩 27、build 25 bytes） — Task 11 — 先改句子，跑 `buildRegistry` 印每階段 bytes 與 budget、再跑 `tests/render.test.js`；超過就用 Task 11 步驟 4 的更短句，仍超過就停下回報，不自行調高 `budget`（那是設計決定）。
- station 列的 `label` 多一個欄位，既有 `deepEqual` 測試全紅 — Task 10 — 先 `grep -n "startedAt" tests/shells.test.js tests/station-shells.test.js` 列出所有期望列，逐一補 `label`。
- `lib/plantasks.js:449` 的 Workflow implementer 提示「cd into it before every command」留著不動 — Task 11 — 不改的理由：Workflow 的 implementer 是在 worktree 路徑外起的 agent，shell 的起始目錄不保證是 worktree，那句是為了不寫錯目錄；`tests/plantasks-workflow.test.js:97` 也逐字比對它。有了 description 與縮短規則，那種 `cd` 開頭的 shell 在 Pane 上本來就只剩指令本體，所以不需要動它。
- `git grep` 的候選篩選漏掉一種引用寫法（動態 `require(path.join(…))`、`require.resolve`、`export … from`）使呼叫者少算 —— Task 13 —— 先在本 repo 對 `lib/profile.js` 跑 `callersOf`，和 `git grep -l "profile"` 的人工結果比對，差的是不是只剩動態引用；`export … from` 已被 `from` 涵蓋，動態的明說不算。
- 門檻用 `>=`（「N 個以上」）而 TODO 寫的是「超過」 —— Task 12、Task 13 —— `desc` 寫的是「這麼多個檔以上」，測試用 4 個呼叫者設 4 釘住邊界；若判官要嚴格大於，改 `blastFor` 的比較與 `desc` 兩處。
- 預設 10 太吵或太鬆，這個 repo 的樞紐檔（`lib/registry.js` 165 個含測試）每次改都觸發 —— Task 12 —— 數字是 2026-11-02 的人工量測，進計畫前不再改；覺得吵的是使用者，用 `task.js profile set verify.blast <n>` 調。
- `verify.blast` 加進 `KEYS` 後，有測試逐鍵檢查其他表（站設定頁、wizard、`profile.md` 生成表）而紅 —— Task 12 —— 步驟 6 一次跑 `profile.test.js`、`profile-table.test.js`、兩個 `station-settings-*` 測試；`profile.md` 一定要先跑 `node scripts/profile-table.js` 再比。
- `skills/fankeel-verify/SKILL.md` 只剩 10 bytes 餘裕，加段落必超過 `skill-size.test.js` 的上限 —— Task 14 —— 先量再改上限，改成量到大小之上最小的 100 倍數，不事先猜數字。
- Windows 上 `git grep` 輸出路徑分隔、CRLF 使 `^([^:]+):\d+:(.*)$` 解析錯 —— Task 13 —— 測試在 Windows 跑 `callersOf`，git 一律輸出正斜線；磁碟機代號的冒號不會出現，因為 `git grep` 印的是 repo 相對路徑。
- 在 `scripts/lenses.js` 讀 profile 時，使用者機器層（`~/.claude/fankeel/profile.json`）設了 `verify.blast` 影響測試 —— Task 13 —— 測試把專案層寫成 4 或 5 或 off，專案層優先於機器層（`read` 內 `p` 先於 `m`），不受機器層影響。
- `BACKGROUNDED` 正規式比對的是還沒見過的字樣，真實文字不含「running … background」就認不出，仍會誤判 lost —— Task 15 —— 先用 Task 19 步驟 5 的一行指令拿真實結果文字驗證，印 false 就退回改正規式
- 正規式過寬，一個 Bash 結果（例如 grep 輸出）碰巧含 “running in the background” —— Task 15 —— 後果只是 `lost` 晚到 `BUSY_MS`（11 分鐘），測試鎖住 Read 結果不算、已通知的不算；不處理更多
- 背景 shell 的 `<task-notification>` 是否帶 `<tool-use-id>` 沒有觀察過（`launched` 對背景 Agent 才驗過）；沒帶的話 Task 15 的「已通知就不算」只靠 `BUSY_MS` 兜底 —— Task 15 —— Task 19 觀察時順便看 `~/.claude` 下該 session 的 transcript 有沒有這個標籤，沒有就在報告中講
- `shell` 改成含 Monitor 後，`emitCommit` 的提早返回沒有獨立測試（tmp 目錄不是 git repo，Bash 與 Monitor 都不輸出） —— Task 16 —— 不另造 git 夾具；review 時看那行提早返回在 `emitCommit` 第一行即可
- 改 `hooks/guard.js` 的 `shell` 常數會影響 Bash／PowerShell 的既有拒絕 —— Task 16 —— 步驟 6 一併跑 `tests/guard.test.js`，有任何一個紅就停下
- Task 17 與 Task 19 都改 `docs/90-agent/reference/subagents.md`，Task 17 的 :669-677 在 :653-654 之後 —— Task 17、Task 19 —— 兩邊都用 Edit 的逐字 `old_string`（不靠行號），行號會因別組的編輯而移動；`old_string` 找不到就停下回報，不要憑印象改
- `skills/fankeel/SKILL.md` 的 `last_verified` 與版本號沒有跟著動 —— Task 17 —— 版本號只由 `scripts/version.js` 在 land 階段動，本計畫不碰
- Task 19 的觀察只在一個 Desktop 版本上做，另一個版本可能不同 —— Task 19 —— 句子裡寫版本與日期，不寫成永久事實
- core 交給 mod 的 `next(e)` 結果裡，`reason` 不是 classic PreToolUse hook 的 `permissionDecisionReason`（型別只說 core 的 reason 是 "the rule or check that decided"），前綴比對永遠不中，handler 變成無聲放行、行為退回今天 —— Task 20 —— 第 2 步的對話框若仍被分類器代答，先在 handler 裡 `$.ui.log(JSON.stringify(out), { to: 'debug' })` 看一次 `out` 的實際欄位，再決定改比 `out.hook === 'PreToolUse'` 或改由 dispatch-gate.js 依 `tool_use_id` 寫標記檔讓 mod 讀。
- 本機型別檔（`.claude-plugin/types/claude-code/index.d.ts`，10-14 產生）沒有 `decider` 欄位，引擎若對 mod 的回傳做欄位驗證會丟掉它或拒載 mod —— Task 20 —— 第 1 步先確認 mod 有載入、band 與 Pane 還在；`decider` 的唯一文件是 changelog 2.1.304 :530 一行。
- matcher `{ tool: 'Agent' }` 沒涵蓋舊名 `Task`（型別說 "a matcher on any name the host declares for the tool admits it"，未實測）—— Task 18 —— 測試只驗 matcher 形狀；Task 20 的實測用的是 Agent，`Task` 名稱的呼叫未覆蓋。
- 改 `tests/mod.test.js` 事件清單時 pane.ts 已另有人加了 `tool.check`（平行 session 共用 checkout）—— Task 18 —— 先 `grep -n "tool.check" hooks/*.ts`，pane.ts 已有就把清單改成兩個 `tool.check` 並確認兩個 handler 不互相覆寫。

## Task 1: 兩條 TODO 依 survey gate 的答案改狀態

**Files:**
- Modify: `docs/90-agent/todo/tour-2.md` — frontmatter 由 ready 改 watch，補 group／timing／stamp，正文末加一行 11-02 紀錄
- Modify: `docs/90-agent/todo/gate-22.md` — frontmatter 由 decision 改 ready，正文末加一行 11-02 紀錄
- Read: `docs/90-agent/todo/pane-18.md` — watch 條目 frontmatter 的形狀（group、timing `if:`、stamp）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — 兩個檔的 frontmatter 照抄改值，正文各加一行。

使用者在 survey gate 答了兩題：station 導覽改成 Watch；「先問完、剩下自己跑」重開 10-19 的決定。`todo.js` 沒有改狀態的子命令（`node scripts/todo.js` 的 usage 只有 list／new／done／migrate），所以直接改 frontmatter，改完跑 `todo-check.js`。

1. Write the new frontmatter of `docs/90-agent/todo/tour-2.md`，取代原本第 1-7 行：

In `docs/90-agent/todo/tour-2.md`, replace the frontmatter with:

```md
---
label: tour
title: station 導覽之後做回來
description: 2026-11-02 station 的導覽（#/tour、promo 影片、錄影腳本、測試）整組移除，之後重做一頁更小的；做完 = 左側列有入口、serve 開得出來、有測試、文件寫著
state: watch
link: docs/90-agent/reference/station.md
group: 要對外展示 station
timing: if: 使用者提出要對外展示 station、或要錄導覽／講解影片
stamp: 2026-11-02
---
```

2. Write，在 `docs/90-agent/todo/tour-2.md` 正文最後一段之後空一行加：

In `docs/90-agent/todo/tour-2.md`, append:

```md
2026-11-02 盤點（task-20261102T121659）：導覽當天才整組移除，使用者在 survey gate 選「改成 Watch」，事件是使用者提出要對外展示或錄導覽；在那之前不再當成 do now。
```

3. Write，`docs/90-agent/todo/gate-22.md` 第 5 行 `state: decision` 改成 `state: ready`，其餘 frontmatter 不動；正文最後一段之後空一行加：

In `docs/90-agent/todo/gate-22.md`, append:

```md
2026-11-02 盤點（task-20261102T121659）：使用者在 survey gate 選「重開該決定」，依 docs/03-decisions/2026-10-19-no-unattended-gate.md:29 以 10-21 夜的案例重議。下一步是開一個 design 任務，把上面「要決定的」四點（預答在哪一站問、已預答的 gate 怎麼過 hooks/gate.js、硬停清單、與 10-19 決定及 handoff／resume 的共存）在 design gate 定下來，再改 hooks/gate.js 與其測試。
```

4. Run `node scripts/todo-check.js` — 沒有錯誤行。若它對 watch 條目要求別的欄位，照它的訊息補，並在回報裡寫出補了什麼。
5. Hand back for commit `docs: station tour entry to watch, unattended-gate entry reopened (patrol 11-02)`.

## Task 2: title.js 認 CLAUDE_CODE_SUBAGENT_EFFORT

**Files:**
- Modify: `lib/title.js` — `prefixFor` 的 effort 鏈在 `fm.effort` 之後、`'inherit'` 之前多認 env
- Read: `hooks/title.js` — 它把 `env: process.env` 傳進 `prefixFor`，不改
- Test: `tests/title.test.js`

**Interfaces:**
- Consumes: `prefixFor({ toolInput, pluginRoot, projectDir, configDir, transcriptPath, env })`（`lib/title.js`，已存在）
- Produces: 無新名字；`prefixFor` 的 effort 優先序變成 call 的 `effort` → agent 檔 `effort:` → `env.CLAUDE_CODE_SUBAGENT_EFFORT` → `inherit`

**Dispatch:** implementer, sonnet — 一行邏輯加一則測試，計畫已帶全部程式碼。

- [ ] **Step 1: 先寫失敗的測試。** 在 `tests/title.test.js` 檔尾（`a dispatch carrying effort titles with it` 那則之後）加：

```js
test('CLAUDE_CODE_SUBAGENT_EFFORT fills in when neither the call nor the agent file names an effort', () => {
    const w = world();
    fs.mkdirSync(path.join(w.configDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(w.configDir, 'agents', 'bare.md'), '---\nname: bare\nmodel: haiku\n---\n');
    const withEnv = (toolInput, env) => prefixFor({ toolInput, pluginRoot: w.plugin, projectDir: w.projectDir,
        configDir: w.configDir, transcriptPath: w.transcriptPath, env });
    const env = { CLAUDE_CODE_SUBAGENT_EFFORT: 'xhigh' };
    assert.equal(withEnv({ subagent_type: 'bare', description: 'x' }, env), 'haiku · xhigh');
    assert.equal(withEnv({ subagent_type: 'bare', description: 'x' }, {}), 'haiku · inherit');
    assert.equal(withEnv({ subagent_type: 'bare', effort: 'low', description: 'x' }, env), 'haiku · low');
    assert.equal(withEnv({ subagent_type: 'fankeel:fankeel-reader', description: 'x' }, env), 'sonnet · medium');
});
```

- [ ] **Step 2: 跑它，看它失敗。** `node --test tests/title.test.js`，預期新測試第一條斷言得到 `haiku · inherit`。
- [ ] **Step 3: 改實作。** 在 `lib/title.js` 的 `prefixFor` 中，把

```js
    const effort = (typeof input.effort === 'string' && input.effort) || fm.effort || 'inherit';
```

在 `lib/title.js` 換成：

```js
    const envEffort = env && typeof env.CLAUDE_CODE_SUBAGENT_EFFORT === 'string' && env.CLAUDE_CODE_SUBAGENT_EFFORT;
    const effort = (typeof input.effort === 'string' && input.effort) || fm.effort || envEffort || 'inherit';
```

- [ ] **Step 4: 跑測試。** `node --test tests/title.test.js tests/title-hook.test.js tests/title-docs.test.js tests/title-override.test.js tests/title-rule.test.js`，全綠。subagents.md :312 的一詞由 Task 17 補。
- [ ] **Step 5: Commit。** `git add lib/title.js tests/title.test.js` 後 `git commit -m "feat: title.js reads CLAUDE_CODE_SUBAGENT_EFFORT"`。

## Task 3: ask skill 註明判官已 xhigh

**Files:**
- Modify: `skills/fankeel-ask/SKILL.md:74-80` — 第 2 步（Dispatch it once）末加一句
- Modify: `tests/skill-size.test.js` — `fankeel-ask` 的位元組上限 8800 → 9000
- Read: `agents/fankeel-judge.md` — frontmatter 第 6 行 `effort: xhigh`，不改
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: 無
- Produces: 無（文件句）；`CAPS['fankeel-ask']` 變 9000

**Dispatch:** implementer, sonnet — 要先量實際位元組再定上限，不是純轉抄。

註：`skills/fankeel-ask/SKILL.md` 現為 8793 位元組，上限 8800，只剩 7 位元組；skill 有 per-skill 位元組棘輪（`tests/skill-size.test.js` 的 `CAPS`，「最小的 100 倍數高於實測」）。skills/registry.json 的 `prompt_byte_budget` 只管六個 stage 的 prompt，不含 ask。所以加句必須同改上限，這不是 docs-only：land 要跑全套，不只 `version.js` + `todo-check.js`。

- [ ] **Step 1: 先寫失敗的測試。** 在 `tests/agents.test.js` 檔尾加（`ROOT` 與 `fs`、`path`、`test`、`assert` 該檔已有，見第 187 行對 `fankeel-ask` 的讀法）：

```js
test('the ask skill says the judge already runs at xhigh, so no effort: and no ultrathink', () => {
    const ask = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-ask', 'SKILL.md'), 'utf8');
    assert.match(ask, /effort: xhigh/);
    assert.match(ask, /ultrathink/);
});
```

- [ ] **Step 2: 跑它，看它失敗。** `node --test tests/agents.test.js`，預期新測試因找不到 `ultrathink` 失敗（若 `effort: xhigh` 先已命中也無妨）。
- [ ] **Step 3: 加句。** 在 `skills/fankeel-ask/SKILL.md` 第 2 步，`— one judge, on whatever \`judge.model\` answered.` 之後、`The judge writes a checklist` 之前，插入：

```md
   The judge's agent file pins `effort: xhigh`, so the dispatch carries no `effort:` and the brief no `ultrathink`.
```

- [ ] **Step 4: 量位元組並升上限。** `wc -c skills/fankeel-ask/SKILL.md`（預期約 8900）。在 `tests/skill-size.test.js` 的 `CAPS`，若量到的值 ≤ 9000 則把 `'fankeel-ask': 8800,` 換成：

```js
    'fankeel-ask': 9000,
```

  量到 > 9000 就把句子縮短，不再升上限。
- [ ] **Step 5: 跑測試。** `node --test tests/agents.test.js tests/skill-size.test.js tests/skills.test.js`，全綠。
- [ ] **Step 6: Commit。** `git add skills/fankeel-ask/SKILL.md tests/skill-size.test.js tests/agents.test.js` 後 `git commit -m "docs: ask skill says the judge already runs xhigh"`。

## Task 4: spend 與 render 補架子

**Files:**
- Modify: `lib/spend.js` — :120 的 `registry.readAll(root)` 加 `{ shelf: true }`
- Modify: `scripts/render.js:260-266` — :263 註解的 `22.5 floor` 改 `22.13 floor`
- Test: `tests/shelf-readers.test.js`
- Read: `lib/registry.js` — `readAll(projectRoot, opts)` 的 `opts.shelf === true` 會併入架上條目，不改

**Interfaces:**
- Consumes: `registry.readAll(root, { shelf: true })`（`lib/registry.js:170`，已存在）
- Produces: `spend.sessionsOf(roots)` 的 `scanned` 與 `rows` 含架上條目；其他呼叫者不變

**Dispatch:** implementer, sonnet — 兩處機械改動加拿掉 `todo` 旗標，程式碼都在計畫裡。

- [ ] **Step 1: 先讓測試真的會失敗。** 在 `tests/shelf-readers.test.js` 把

```js
test('spend counts shelved entries', { todo: 'lib/spend.js held by neighbour session' }, () => {
```

In `tests/shelf-readers.test.js`, change it to:

```js
test('spend counts shelved entries', () => {
```

- [ ] **Step 2: 跑它，看它失敗。** `node --test tests/shelf-readers.test.js`，預期 `spend counts shelved entries` 因 `scanned` 為 0 而失敗（架上條目未被讀進）。
- [ ] **Step 3: 改 spend。** 在 `lib/spend.js` 的 `sessionsOf`，把

```js
        const { entries, unreadable: bad } = registry.readAll(root);
```

In `lib/spend.js`, change it to:

```js
        const { entries, unreadable: bad } = registry.readAll(root, { shelf: true });
```

- [ ] **Step 4: 改 render 註解。** 在 `scripts/render.js` 第 263 行，把 `so on the 22.5 floor` 改成 `so on the 22.13 floor`（`package.json` 的 engines 已是 `>=22.13`）。
- [ ] **Step 5: 跑測試。** `node --test tests/shelf-readers.test.js tests/spend.test.js tests/spendrange.test.js tests/spendrange-models.test.js tests/conversation-spend.test.js tests/station-spend-page.test.js tests/station-spend-route.test.js tests/station-talk-spend.test.js`，全綠；`grep -n "22\.5" scripts/render.js` 無輸出。
- [ ] **Step 6: Commit。** `git add lib/spend.js scripts/render.js tests/shelf-readers.test.js` 後 `git commit -m "fix: spend reads shelved entries, render comment says 22.13"`。

## Task 5: 文件寫明 Desktop 閒置壓縮與 compact.at 的分工 (compact-8)

**Files:**
- Modify: `docs/01-guide/profile.md` — 表格後加一段分工；`last_verified` 改 2026-11-02
- Modify: `docs/01-guide/what-runs.md` — compact 一行補一句
- Modify: `skills/fankeel/SKILL.md:818-823` — `context:` 段落後加一段
- Test: `tests/idle-compaction-doc.test.js`

**Interfaces:**
- Consumes: none
- Produces: 三份文件都含 `Idle compaction` 與 `2.1.314`；profile.md 含 `永遠不會先觸發`。Task 6 的 init 文字與這三處同一說法。

**Dispatch:** implementer, sonnet — 文字已在計畫裡，照抄加一個 grep 測試。

lib/profile.js:56 的 `compact.at` desc 是 `docs/01-guide/profile.md` 表格（`PROFILE_TABLE` 標記之間）的來源，改它就要重產表格，所以 desc 不動，分工寫在表格之外。

1. 先寫失敗的測試。Create `tests/idle-compaction-doc.test.js`:

```js
'use strict';

// docs/90-agent/todo/compact-8.md: Claude Code 2.1.314's Desktop idle
// compaction acts before a compact.at of 350000 or more, and the documents
// say who goes first.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('profile.md says Claude Code compacts an idle 200K+ conversation first', () => {
    const page = flat('docs/01-guide/profile.md');
    assert.match(page, /2\.1\.314/);
    assert.match(page, /Idle compaction/);
    assert.match(page, /`350000` 以上時，只在你沒離開的時候才輪到 fankeel/);
    assert.match(page, /沒有 1M 的帳號，`compact\.at` 在 `350000` 以上永遠不會先觸發/);
});

test('what-runs.md compact line names the host compaction', () => {
    const page = flat('docs/01-guide/what-runs.md');
    assert.match(page, /\*\*compact\*\*：[^-]*Idle compaction/);
});

test('the fankeel skill says compact.at 350000 and above waits its turn', () => {
    const skill = flat('skills/fankeel/SKILL.md');
    assert.match(skill, /Claude Code 2\.1\.314 compacts a 200K\+ conversation by itself/);
    assert.match(skill, /`\/config` → Idle compaction/);
    assert.match(skill, /never reaches it before the host does/);
});
```

2. Run `node --test tests/idle-compaction-doc.test.js` — three failures.
3. In `docs/01-guide/profile.md`, insert the paragraph below on its own, with a blank line either side, immediately before the line that begins `` `station.remote` 只讀機器層 profile``:

```md
`compact.at` 不是唯一會壓縮的東西。Claude Code 2.1.314 起，Desktop 與 VS Code 在 200K 以上的對話閒置、prompt cache 過期時，會先用摘要壓縮，可在 `/config` 關掉 Idle compaction；2.1.302 的 auto mode 過長壓縮與 2.1.311 的 200K 壓縮續跑也是外部觸發。所以 `compact.at` 設 `350000` 以上時，只在你沒離開的時候才輪到 fankeel 自己壓；你離開到 cache 過期，由 Claude Code 先壓，時機不由 fankeel 決定。沒有 1M 的帳號，`compact.at` 在 `350000` 以上永遠不會先觸發。要讓 fankeel 決定壓縮的時機，就在 `/config` 關掉 Idle compaction；接受它也可以，代價是離開期間壓縮的內容不由 fankeel 挑。`gate.away` 只在 gate 問到且你答要離開時動作，不替閒置壓縮擋任何事。（[判決](../90-agent/judgements/2026-11-02-cc-2-1-300-316.md)）
```

   Also change the frontmatter line `last_verified: 2026-10-21` in that file to `last_verified: 2026-11-02`.
4. In `docs/01-guide/what-runs.md`, replace the line

   `- **compact**：context 到 profile 的 `compact.at`（預設 350k tokens）時自動壓縮。`

   with:

```md
- **compact**：context 到 profile 的 `compact.at`（預設 350k tokens）時自動壓縮。Desktop 與 VS Code 上，Claude Code 2.1.314 起會在 200K 以上的對話閒置、cache 過期時先自己壓縮（`/config` 的 Idle compaction 可關），所以 `compact.at` 設 350k 以上時，只在你沒離開時才輪到它。
```

5. In `skills/fankeel/SKILL.md`, after the paragraph that ends `nagging gets ignored exactly when it stops being nagging.` (line 822) and before the paragraph that begins `A \`gate:\` line`, insert, blank line either side:

```md
Not every compaction is fankeel's. Claude Code 2.1.314 compacts a 200K+ conversation by itself on Desktop and VS Code once it has idled past the prompt-cache expiry (`/config` → Idle compaction turns it off), so a `compact.at` of 350000 or more only gets its turn while the user has not left, and an account without a 1M window never reaches it before the host does. In that case neither `compact.at` nor `gate.away` chose the moment; the `context:` line is what shows the loss afterwards. Say so when the user asks why a session compacted before `compact.at`.
```

6. Run `node --test tests/idle-compaction-doc.test.js` — passes. Run `node scripts/docs-check.js` — exits 0.
7. Hand back for commit `docs: Desktop idle compaction vs compact.at (compact-8)`.

## Task 6: init 提示 /auto-mode-setup，並在壓縮視窗那題寫明閒置壓縮 (init-4, compact-8)

**Files:**
- Modify: `skills/fankeel-init/SKILL.md:119-130` — 壓縮視窗那題補一句；其後加 `/auto-mode-setup` 一題
- Test: `tests/init-auto-mode.test.js`

**Interfaces:**
- Consumes: Task 5 的說法（`Idle compaction`、`2.1.314`）；兩者不共用檔案，不互相等
- Produces: init 技能含 `/auto-mode-setup` 一題；`tests/init-auto-mode.test.js`

**Dispatch:** implementer, sonnet — 文字已在計畫裡，照抄加一個 grep 測試。

`skills/fankeel-init/SKILL.md` 沒有 byte 預算：skills/registry.json 的 `prompt_byte_budget` 量的是 lib/stages.js 的站 prompt，不是 SKILL.md；tests/skills.test.js 只限 frontmatter description 長度（< 500），這次不碰。

1. 先寫失敗的測試。Create `tests/init-auto-mode.test.js`:

```js
'use strict';

// docs/90-agent/todo/init-4.md and compact-8.md: init names /auto-mode-setup
// once and never runs it, and the compact-window question says the host
// compacts an idle conversation first.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const init = fs.readFileSync(path.join(__dirname, '..', 'skills/fankeel-init/SKILL.md'), 'utf8').replace(/\s+/g, ' ');

test('init asks once about /auto-mode-setup and never runs it', () => {
    assert.match(init, /`\/auto-mode-setup` \(Claude Code 2\.1\.304\)/);
    assert.match(init, /no subagent can run a slash command/);
    assert.match(init, /the skill never runs the command itself/);
    assert.match(init, /docs\/90-agent\/todo\/stage-agents-10\.md/);
});

test('the compact-window question says idle compaction goes first', () => {
    assert.match(init, /Claude Code 2\.1\.314 compacts an idle 200K\+ conversation on its own/);
    assert.match(init, /`\/config` → Idle compaction/);
    assert.match(init, /never reaches 350000 and above first/);
});
```

2. Run `node --test tests/init-auto-mode.test.js` — two failures.
3. In `skills/fankeel-init/SKILL.md`, step 1, in the compact-window bullet, find the sentence `The answer runs` (it starts the line `` `node <plugin>/scripts/task.js profile set compact.at <value> --default`` is after it; the line reads `that 350000, 600000 and 1000000 have not been measured. The answer runs`). Put the following sentence between `have not been measured.` and `The answer runs`, so the two lines read on from each other; rewrap to 80 columns if needed:

```md
The descriptions also say that on Claude Desktop and VS Code, Claude Code 2.1.314 compacts an idle 200K+ conversation on its own once the prompt cache expires, so 350000 and above only act while the user stays; an account without a 1M window never reaches 350000 and above first; and `/config` → Idle compaction turns the host's one off. No answer to this question turns Idle compaction on or off.
```

4. In `skills/fankeel-init/SKILL.md`, after the bullet's last sentence `window as it is.` and before the line `## 2. The gate`, add a new bullet (blank line before and after):

```md
- `/auto-mode-setup` — Claude Code 2.1.304's command that reads the project
  and recent sessions and teaches auto mode this environment. Asked last in
  step 1, whatever the scout's rows say. One `AskUserQuestion`, two options in
  this order: **現在跑** — the user types `/auto-mode-setup` in this session and
  says when it is done (no subagent can run a slash command), and the
  description says why: a build's writes under `.fankeel/build/**` rest on an
  allow rule in `.claude/settings.local.json`, and auto mode has still answered
  `no verdict` to them (`docs/90-agent/todo/stage-agents-10.md`); **下次再說** —
  writes nothing. Nothing goes into the profile and the skill never runs the
  command itself. Whether it helped is recorded by the re-test that TODO
  already holds, not here.
```

5. Run `node --test tests/init-auto-mode.test.js tests/init-ci.test.js tests/skills.test.js` — passes. Run `node scripts/docs-check.js` — exits 0.
6. Hand back for commit `feat: init suggests /auto-mode-setup and notes idle compaction (init-4, compact-8)`.

## Task 7: TODO 條目對齊 — init-4 改為等重驗、spend-6 指向分工

**Files:**
- Modify: `docs/90-agent/todo/init-4.md` — 改 `watch`，等 stage-agents-10 重驗
- Modify: `docs/90-agent/todo/spend-6.md` — 末尾加一行指向 profile.md 的分工

**Interfaces:**
- Consumes: none
- Produces: init-4 變成 `state: watch`，`timing: if:` 帶重驗事件；spend-6 多一行紀錄

**Dispatch:** implementer, sonnet — 兩個條目檔的全文已在計畫裡。

scripts/todo.js 只有 `new` 和 `done`，沒有改 state 的指令；init-4 完成條件的後半（「在 stage-agents-10 重驗後記錄是否有效」）要等一個之後才發生的事件，所以條目留著，改成 watch 加 `timing: if:`（和 docs/90-agent/todo/stage-agents-10.md 同形式），直接改檔。init 提示那半由 Task 6 做完。compact-8 不在這裡動：它的完成條件（文件與 SKILL 段落更新）隨 Task 5、2 達成，由 land 階段用 `todo.js done compact-8 --sha <sha>` 收掉。

1. Replace the whole of `docs/90-agent/todo/init-4.md` with:

```md
---
label: init
title: 建議執行 /auto-mode-setup
description: CC 2.1.304 的 /auto-mode-setup 讀專案與近期 session 教 auto mode 認環境；init 已提示，等 stage-agents-10 重驗後記錄是否有效。
state: watch
link: skills/fankeel-init/SKILL.md
group: 放行規則有沒有效
timing: if: stage-agents-10 重驗完成 — 看 /auto-mode-setup 之後 no verdict 有沒有消失
stamp: 2026-11-02
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.304 changelog :532：/auto-mode-setup 讀專案與近期 session 教 auto mode 認環境。目前 .fankeel/build/** 的寫入靠 .claude/settings.local.json 的 allow 規則，仍有 no verdict 事故（見 stage-agents-10）。

2026-11-02 落地一半：skills/fankeel-init/SKILL.md 步驟 1 最後加一題，問使用者要不要現在在本 session 打 /auto-mode-setup；init 只提示，不自己跑，也不寫 profile。

剩下的一半要等事件：stage-agents-10 重驗（2.1.316 之後 no verdict 是否還發生）完成時，記錄使用者跑過 /auto-mode-setup 之後是否有效——沒跑過就寫沒跑過，不當作無效。記完就關這條；若 no verdict 本來就不再發生，直接寫「無從判斷」關掉。
```

2. In `docs/90-agent/todo/spend-6.md`, after its last line (the one ending `（judgement: docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md）`), add a new line:

```md
- 2026-11-02 分工寫進 docs/01-guide/profile.md：compact.at 設 350000 以上時只在使用者沒離開時輪到 fankeel，離開到 cache 過期由 CC 先壓；沒有 1M 的帳號 350000 以上永遠不會先觸發。「要不要加閒置壓縮」這半不必再自己做，剩下要決定的是離開前壓縮與回報長度上限（compact-8）
```

3. Run `node scripts/todo-check.js` — exits 0. Run `node scripts/todo.js list` — init-4 is listed under watch, spend-6 unchanged in state.
4. Hand back for commit `docs: init-4 waits on the stage-agents-10 re-test; spend-6 points at the compact split`.

## Task 8: Pane 的 `shellLabel`

**Files:**
- Modify: `hooks/pane-shell.ts` — 加 `description?` 欄位與 `shellLabel`
- Test: `tests/pane-shell.test.js`

**Interfaces:**
- Consumes: none
- Produces: `shellLabel`、`Shell` —— `type Shell` 多 `description?: string`；`export function shellLabel(command: string, description?: string): string` —— description 非空就回它的第一行（空白壓成一格）；否則回 `commandLine(command)` 去掉開頭 `cd`/`chdir`/`Set-Location` 後，把 `node <路徑>/scripts/<name>.js` 縮成 `<name>.js`；去掉 cd 後剩空字串就保留原行。`commandLine` 不變。

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 先寫失敗測試。In `tests/pane-shell.test.js`, append after the `commandLine` test:

```js
test('shellLabel: a description wins; without one, a leading cd goes and node <path>/scripts/<name>.js becomes <name>.js', async () => {
    const m = await load();
    assert.equal(m.shellLabel('cd F:/ws && node x.js', '  Run the\nfast suite '), 'Run the');
    assert.equal(m.shellLabel('cd F:/ws && node x.js', '   '), 'node x.js');
    assert.equal(m.shellLabel('cd F:/ymlab/fankeel && node F:/ymlab/fankeel/scripts/suite.js --fast'), 'suite.js --fast');
    assert.equal(m.shellLabel('node C:\\Users\\u\\plugins\\fankeel\\scripts\\await.js --session s1'), 'await.js --session s1');
    assert.equal(m.shellLabel('node scripts/todo.js new'), 'todo.js new');
    assert.equal(m.shellLabel('cd /d F:\\ws && npm test'), 'npm test');
    assert.equal(m.shellLabel('cd "C:/a b" && npm test'), 'npm test');
    assert.equal(m.shellLabel('Set-Location F:/ws; node scripts/x.js'), 'x.js');
});

test('shellLabel leaves what it does not recognise as it was', async () => {
    const m = await load();
    assert.equal(m.shellLabel('node --test'), 'node --test');
    assert.equal(m.shellLabel('node --test scripts/x.js'), 'node --test scripts/x.js');
    assert.equal(m.shellLabel('cd F:/ws'), 'cd F:/ws');
    assert.equal(m.shellLabel('cd F:/ws &&'), 'cd F:/ws &&');
    assert.equal(m.shellLabel('npm  test\nsecond'), 'npm test');
});
```

2. Run `node --test tests/pane-shell.test.js` — fails: `m.shellLabel is not a function`.
3. In `hooks/pane-shell.ts`, change the `Shell` type line to carry the optional description:

```ts
export type Shell = { id: string; command: string; description?: string; at: number; end: number | null; code: number | null }
```

4. In `hooks/pane-shell.ts`, after `commandLine`, add:

```ts
// A leading `cd <path> &&` (or `;`, `cd /d`, Set-Location) only says where the command ran, not what it is.
const CD_PREFIX = /^(?:cd|chdir|set-location)\s+(?:\/d\s+)?(?:"[^"]*"|'[^']*'|[^\s&;|]+)\s*(?:&&|;)\s*/i
// `node <anything>/scripts/<name>.js` is `<name>.js`: the plugin's scripts are named by their file.
const NODE_SCRIPT = /\bnode\s+"?(?:\S*[\\/])?scripts[\\/]([\w.-]+\.js)"?/

// What a shell row shows: the Bash `description` when the call carried one, else the command made short.
export function shellLabel(command: string, description?: string): string {
  const said = (description ?? '').trim().split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim()
  if (said) return said
  const line = commandLine(command)
  const bare = line.replace(CD_PREFIX, '')
  return (bare || line).replace(NODE_SCRIPT, '$1')
}
```

5. Run `node --test tests/pane-shell.test.js` — passes.
6. Hand back for commit `feat: pane-shell.ts shellLabel — description first, cd and script path stripped`.

## Task 9: Pane 記下 description 並用 `shellLabel` 畫列

**Files:**
- Modify: `hooks/pane.ts:714-722` — `tool.call` 觀察者把 `description` 存進 shell
- Modify: `hooks/pane-status.ts:10` — import 換成 `shellLabel`
- Modify: `hooks/pane-status.ts:436` — 列名改用 `shellLabel`
- Test: `tests/pane.test.js`
- Test: `tests/pane-status.test.js`

**Interfaces:**
- Consumes: `shellLabel`、`Shell`（Task 8）—— `shellLabel(command, description?)`、`Shell.description?`
- Produces: Pane 的 shells 列顯示 description 或縮短後的指令；`Shell` 記下的 `description` 只有字串時才存

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 先寫失敗測試。In `tests/pane-status.test.js`, append after the shells block test:

```js
test('a shell row shows the description when there is one, else the command without its cd and script path', async () => {
    const m = await load();
    const rows = status(m, { agents: oneAgent, cols: 60, shells: [
        { id: 'b1', command: 'cd F:/ymlab/fankeel && node F:/ymlab/fankeel/scripts/await.js --session s', description: 'await: survey stage agent', at: NOW - MIN, end: null, code: null },
        { id: 'b2', command: 'cd F:/ymlab/fankeel && node F:/ymlab/fankeel/scripts/suite.js --fast', at: NOW - MIN, end: null, code: null },
    ] });
    const lines = text(rows, 'shells');
    assert.ok(lines.some((l) => l.includes('await: survey stage agent')), lines.join('\n'));
    assert.ok(lines.some((l) => l.includes('suite.js --fast')), lines.join('\n'));
    assert.ok(!lines.some((l) => l.includes('cd F:')), lines.join('\n'));
});
```

2. In `tests/pane.test.js`, append after `'a shell whose output file vanishes is listed as ended with no code'`:

```js
test('a background Bash call carrying a description is listed by it; without one, by the command without its cd', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), { [OUTPUT]: 'working\n', [TEMP + '/claude/F--proj/' + ID + '/tasks/b2.output']: 'working\n' }), env: { TEMP } });
    log.now = Date.now();
    await hooks['session.start']($, {}, passed);
    await hooks['tool.call']($, Object.assign(background('cd F:/proj && node F:/proj/scripts/await.js --session s'), { description: 'await: survey stage agent' }), answered('b1'));
    await hooks['tool.call']($, background('cd F:/proj && node F:/proj/scripts/suite.js --fast'), answered('b2'));
    await log.ticks[0].fn();
    const lines = paneLines(await hooks['ui.render']($, PANE));
    assert.ok(lines.some((l) => l.startsWith(' ○ await: survey stage agent · ')), lines.join('\n'));
    assert.ok(lines.some((l) => l.startsWith(' ○ suite.js --fast · ')), lines.join('\n'));
});
```

3. Run `node --test tests/pane.test.js tests/pane-status.test.js` — the two new tests fail (rows show `cd F:/proj && node …`).
4. In `hooks/pane.ts`, in the `tool.call` observer (:716-724), replace the call type and the `remember(...)` line so the block reads:

```ts
    const call = e as unknown as { tool?: string; command?: unknown; description?: unknown }
    const result = (out as unknown as { result?: { backgroundTaskId?: unknown } }).result
    const task = result && typeof result === 'object' ? result.backgroundTaskId : undefined
    if ((call.tool === 'Bash' || call.tool === 'PowerShell') && typeof task === 'string' && task && typeof call.command === 'string') {
      const description = typeof call.description === 'string' && call.description.trim() ? call.description : undefined
      state.shells = remember(state.shells, { id: task, command: call.command, description, at: await $.clock.now(), end: null, code: null })
      state.shellAt = 0
    }
```

5. In `hooks/pane-status.ts`, change the import on :10 to `import { cutShells, shellLabel, KEEP_MS } from './pane-shell.ts'` and the name line (:436) to:

```ts
    const name = cut(shellLabel(s.command, s.description), Math.max(4, inner - 2 - width(after) - width(exit)))
```

6. Run `node --test tests/pane.test.js tests/pane-status.test.js tests/pane-shell.test.js` — passes. Then `grep -n "commandLine" hooks/pane-status.ts` prints nothing (the import was the only use).
7. Hand back for commit `feat: the Pane lists a shell by its Bash description (shell-label)`.

## Task 10: station 的 shell 列同一套標示

**Files:**
- Modify: `lib/shells.js` — 記下 `input.description`，每列多 `label`
- Modify: `assets/station/nav.js:157` — `shellsHtml` 顯示 `label`
- Test: `tests/shells.test.js`
- Test: `tests/station-shells.test.js`
- Test: `tests/station-shells-fold.test.js`

**Interfaces:**
- Consumes: Task 8 的輸入輸出對照（`shellLabel` 的規則，這裡重寫一份 CommonJS 版，不 import）
- Produces: `shellsOf(...)` 回傳的每列是 `{ id, command, label, state, code, startedAt }`；`label` = 與 Task 8 `shellLabel` 相同規則的結果；`shellsHtml` 的文字是 `label`（沒有 `label` 的舊資料退回 `command`），tooltip 是原始 `command`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 先寫失敗測試。In `tests/shells.test.js`, append after the last test:

```js
test('a launch carries its description into label; without one, label is the command without its cd and script path', () => {
    const withDesc = launch('u1', 'cd F:/ws && node F:/ws/scripts/await.js --session s', at(1)).replace('"run_in_background":true', '"run_in_background":true,"description":"await: survey stage agent"');
    const s = session([], {});
    fs.writeFileSync(s.transcript, withDesc + started('u1', 'b1', at(1)) + launch('u2', 'cd F:/ws && node F:/ws/scripts/suite.js --fast', at(2)) + started('u2', 'b2', at(2)));
    fs.writeFileSync(path.join(s.tasks, 'b1.output'), 'x\n');
    fs.writeFileSync(path.join(s.tasks, 'b2.output'), 'x\n');
    const rows = shells.shellsOf(s.transcript, s.tasks);
    assert.deepEqual(rows.map((r) => [r.id, r.label]), [['b2', 'suite.js --fast'], ['b1', 'await: survey stage agent']]);
    assert.equal(rows[0].command, 'cd F:/ws && node F:/ws/scripts/suite.js --fast');
});

test('shellLabelOf leaves what it does not recognise as it was', () => {
    const l = shells.shellLabelOf;
    assert.equal(l('node --test'), 'node --test');
    assert.equal(l('node --test scripts/x.js'), 'node --test scripts/x.js');
    assert.equal(l('cd F:/ws'), 'cd F:/ws');
    assert.equal(l('cd F:/ws &&'), 'cd F:/ws &&');
    assert.equal(l('cd /d F:\\ws && npm test'), 'npm test');
    assert.equal(l('cd "C:/a b" && npm test'), 'npm test');
    assert.equal(l('Set-Location F:/ws; node scripts/x.js'), 'x.js');
    assert.equal(l('node C:\\Users\\u\\plugins\\fankeel\\scripts\\await.js --session s1'), 'await.js --session s1');
    assert.equal(l('cd F:/ws && node x.js', '  Run the\nfast suite '), 'Run the');
    assert.equal(l('npm  test\nsecond'), 'npm test');
});
```

   In `tests/shells.test.js` the existing `session(launches, outputs)` writes the transcript itself from `launches`; `s.transcript` and `s.tasks` are the paths it returns, so the test above overwrites the transcript with `fs.writeFileSync`. Before relying on that, run `sed -n 24,45p tests/shells.test.js` and, if `session` returns different property names, use those.
2. In `tests/station-shells-fold.test.js`, append:

```js
test('the row text is the label, the tooltip the whole command; an old row without a label shows its command', () => {
    const { V } = page();
    const a = V.shellsHtml([{ id: 'b1', command: 'cd F:/ws && node F:/ws/scripts/suite.js', label: 'suite.js', state: 'running', code: null, startedAt: '2026-10-21T00:56:00.000Z' }], NOW);
    assert.match(a, /<span class="sa-desc" title="cd F:\/ws &amp;&amp; node F:\/ws\/scripts\/suite\.js">suite\.js<\/span>/);
    const b = V.shellsHtml(ONE, NOW);
    assert.match(b, /<span class="sa-desc" title="node --test">node --test<\/span>/);
});
```

3. Run `node --test tests/shells.test.js tests/station-shells-fold.test.js` — the new tests fail; the existing `deepEqual` cases in `tests/shells.test.js` (:67-69, :108) and `tests/station-shells.test.js` (`want`, :72-73, :100) still pass for now.
4. In `lib/shells.js`, above `launchesOf`, add:

```js
// The same rule as hooks/pane-shell.ts shellLabel (that file is TypeScript for the Pane engine, this one is CommonJS for the station; neither imports the other).
const CD_PREFIX = /^(?:cd|chdir|set-location)\s+(?:\/d\s+)?(?:"[^"]*"|'[^']*'|[^\s&;|]+)\s*(?:&&|;)\s*/i;
const NODE_SCRIPT = /\bnode\s+"?(?:\S*[\\/])?scripts[\\/]([\w.-]+\.js)"?/;

function shellLabelOf(command, description) {
    const said = String(description || '').trim().split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
    if (said) return said;
    const line = String(command || '').trim().split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
    const bare = line.replace(CD_PREFIX, '');
    return (bare || line).replace(NODE_SCRIPT, '$1');
}
```

5. In `lib/shells.js`, in the transcript reader, record the description beside the command — change the `c.uses.set(...)` line to:

```js
                c.uses.set(b.id, { command: b.input.command, description: typeof b.input.description === 'string' ? b.input.description : '', startedAt: typeof o.timestamp === 'string' ? o.timestamp : '' });
```

   and, in `lib/shells.js`, the `c.shells.set(...)` line to:

```js
        c.shells.set(id, { id, command: use.command, description: use.description, startedAt: use.startedAt, end: null });
```

6. In `lib/shells.js`, in `shellsOf`, change the returned row to carry the label:

```js
        return { id: s.id, command: s.command, label: shellLabelOf(s.command, s.description), state: s.end ? 'ended' : 'running', code: s.end ? s.end.code : null, startedAt: s.startedAt };
```

   and the last line to `module.exports = { shellsOf, tasksDirOf, parseTail, cutShells, shellLabelOf };`.
7. In `assets/station/nav.js:157`, replace the `sa-desc` line in `shellsHtml` with:

```js
                        + '<span class="sa-desc" title="' + esc(x.command) + '">' + esc(x.label || x.command) + '</span>'
```

8. Add `label` to every expected row that already exists: in `tests/shells.test.js` the rows at :67-69 get `label: 'suite.js'`, `label: 'gone'`, `label: 'npm test'` and the row at :108 gets `label: 'sleep 5'`; in `tests/station-shells.test.js` every `{ id, command, state, ... }` in `want` (:72-73) and the `node --test 2>&1 | tail -40` row (:100) gets `label` equal to what `shellLabelOf` returns for its command (`'npm test'`, `'sleep 60'`, `'node --test 2>&1 | tail -40'`).
9. Run `node --test tests/shells.test.js tests/station-shells.test.js tests/station-shells-fold.test.js` — passes. If another station test fails on a shell row, `grep -rn "startedAt" tests/*.js` for the expectation and add its `label` the same way.
10. Hand back for commit `feat: the station's shell rows carry a label — description, else the command without its cd (shell-label)`.

## Task 11: AWAIT_RULE 要 await 的背景 Bash 帶 description、不加 cd

**Files:**
- Modify: `lib/stages.js:702` — `AWAIT_RULE` 接一句
- Test: `tests/await-rule-description.test.js`

**Interfaces:**
- Consumes: none
- Produces: 每個 controlled 階段的 await 規則在 `never poll.` 後面多一句，說背景 Bash 帶 `description`（例 `await: survey stage agent`）且不加 `cd`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 先寫失敗測試。Write `tests/await-rule-description.test.js`:

```js
'use strict';
// AWAIT_RULE tells the controller to give the background await a description and no cd prefix,
// so the Pane and the station can name the shell (shell-label); the sentence rides after the
// phrase tests/stages.test.js:992 pins.
const test = require('node:test');
const assert = require('node:assert/strict');
const { controlFor } = require('../lib/stages.js');

test('every controlled stage tells the background await to carry a description and no cd', () => {
    const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    for (const stage of all) {
        const rules = controlFor(stage, { 'stage.agents': all }, { await: '<plugin>/scripts/await.js', session: 'sid' }).rules;
        const rule = rules.find((r) => r.startsWith('After the dispatch, each SendMessage'));
        assert.ok(rule, stage + ': no await rule');
        assert.ok(rule.includes('never poll. '), stage + ': ' + rule);
        assert.match(rule, /`description` `await: survey stage agent`, no `cd` prefix\.$/, stage + ': ' + rule);
    }
});
```

2. Run `node --test tests/await-rule-description.test.js` — fails: the rule ends at `never poll.`.
3. In `lib/stages.js:702`, change the line to:

```js
const AWAIT_RULE = 'After the dispatch, each SendMessage, and a no-path finish notification, run `node {{AWAIT}} --session {{SESSION}}` with Bash `run_in_background`, end your turn; never poll. That Bash gets `description` `await: survey stage agent`, no `cd` prefix.';
```

4. 量預算。Run:

```
node -e "const {buildRegistry}=require('./lib/stage-registry.js');for(const s of buildRegistry('.').stages)console.log(s.name,s.prompt_bytes,s.prompt_byte_budget,s.prompt_bytes<=s.prompt_byte_budget)"
```

   然後 `node --test tests/await-rule-description.test.js tests/stages.test.js tests/render.test.js`。今天 survey 只剩 27 bytes、build 25，這一句約 70 bytes，多半會超。超過時，依序：(a) 把句子換成更短的 `That Bash gets `description` `await: survey stage agent`, no `cd`.`，同時把測試最後的正規式結尾改成 ``no `cd`\.$``；(b) 仍超過，停下回報哪些階段超過多少 bytes，不要自行調高 `lib/stages.js` 各階段的 `budget`、不要刪別條規則 —— 那是設計決定，交給父層。
5. Run `node --test tests/await-rule-description.test.js tests/stages.test.js tests/render.test.js` — passes.
6. Hand back for commit `feat: AWAIT_RULE asks for a description and no cd on the background await (shell-label)`.

## Task 12: profile 加 `verify.blast` 門檻鍵

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加 `verify.blast`，加 `parseBlast`，`parseValue` 接上
- Modify: `docs/01-guide/profile.md` — 由 `scripts/profile-table.js` 重生成表格，不手改
- Read: `scripts/profile-table.js` — 重生成表格的指令，不改它
- Test: `tests/profile-blast.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profile.parseValue('verify.blast', raw) → { value: number | 'off' } | { error: string }`；`profile.read(root, configDir).values['verify.blast']` 沒設時是數字 `10`

**Dispatch:** implementer, sonnet — 照 `phone.hold` 的寫法抄一個整數鍵，程式碼全在計畫裡。

預設值取 10 的理由：2026-11-02 在本 repo 數 require 的檔案數（含測試）——lib/ledger.js 8 個、lib/stages.js 36 個、lib/docs.js 42 個、`lib/profile.js` 72 個；8 個是一個內聚模組的正常呼叫面，30 以上才是樞紐。取 10 讓 ledger.js 這種中型模組剛好不觸發、樞紐一定觸發。使用者嫌吵就調高，嫌漏就調低，`off` 整個關掉。

1. 先寫失敗的測試。Write `tests/profile-blast.test.js`:

In `tests/profile-blast.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('verify.blast takes off or a whole number from 1 to 1000', () => {
    assert.deepEqual(profile.parseValue('verify.blast', '3'), { value: 3 });
    assert.deepEqual(profile.parseValue('verify.blast', ' 1000 '), { value: 1000 });
    assert.deepEqual(profile.parseValue('verify.blast', 'OFF'), { value: 'off' });
    for (const bad of ['0', '1001', 'x', '2.5', '', '-4']) {
        assert.equal(profile.parseValue('verify.blast', bad).error, 'verify.blast is off or a whole number from 1 to 1000', bad);
    }
});

test('verify.blast defaults to 10, one line, and is no wizard key', () => {
    const got = profile.read(tmp('fankeel-profile-blast-'), null);
    assert.equal(got.values['verify.blast'], 10);
    assert.equal(got.sources['verify.blast'], 'builtin');
    assert.equal(Object.keys(profile.WIZARD_KEYS).includes('verify.blast'), false);
    assert.match(profile.KEYS['verify.blast'].desc, /^[^\n]+$/);
});
```

2. Run `node --test tests/profile-blast.test.js` — fails (`unknown key: verify.blast`).
3. In `lib/profile.js`, in the `KEYS` literal right after the `'sensitive.review'` line, add:

```js
    // verify.blast: lib/lenses.js `blastFor`'s threshold — how many files must
    // require or import a changed file before verify lists them as callers in
    // the adversary's brief. 10 because the 2026-11-02 count in this repo ran
    // lib/ledger.js 8, lib/stages.js 36, lib/docs.js 42, lib/profile.js 72:
    // a cohesive module's own callers stay under it, a hub is far over.
    // Free text like `phone.hold`, so `values` is empty; `parseBlast` is the check.
    'verify.blast': { values: [], builtin: '10', free: '`off`，或 1 到 1000 的整數', desc: 'verify 派對手審查員前，改到的檔被這麼多個檔以上 require／import，就把呼叫者列進簡報（## Blast radius）；off 不算' },
```

4. In `lib/profile.js`, directly above the comment line ``// `dispatch.inflight`: how many Agent calls one response may make before``, add:

```js
// `verify.blast`: `off`, or the fan-in at which scripts/lenses.js lists a
// changed file's callers.
const BLAST_MAX = 1000;
function parseBlast(raw) {
    const s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (s === 'off') return { value: 'off' };
    const n = /^\d+$/.test(s) ? Number(s) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= BLAST_MAX) return { value: n };
    return { error: 'verify.blast is off or a whole number from 1 to ' + BLAST_MAX };
}

```

5. In `lib/profile.js`, in `parseValue`, directly after ``if (key === 'phone.hold') return parsePhoneHold(raw);`` add:

```js
    if (key === 'verify.blast') return parseBlast(raw);
```

6. Run `node scripts/profile-table.js` (rewrites the table in `docs/01-guide/profile.md`), then `node --test tests/profile-blast.test.js tests/profile.test.js tests/profile-table.test.js tests/station-settings-steps.test.js tests/station-settings-quick.test.js` — passes.
7. Hand back for commit `feat: verify.blast profile key, the fan-in threshold (verify-5)`.

## Task 13: lenses 算 fan-in，超過門檻列呼叫者

**Files:**
- Modify: `lib/lenses.js` — 加 `callersOf`、`blastFor`
- Modify: `scripts/lenses.js` — 讀 `verify.blast`，在 lens 名稱後印 `## Blast radius` 區塊
- Read: `lib/profile.js` — `read(projectRoot, configDir)` 與 `configDirOf()` 的簽名，Task 12 加的鍵
- Test: `tests/blast-lens.test.js`

**Interfaces:**
- Consumes: Task 12 —— `profile.read(root, configDir).values['verify.blast']` 是數字或 `'off'`
- Produces: `callersOf(root, file) → string[]`（相對於 root、排序、不含 file 自己）；`blastFor(root, files, threshold) → [{ file, callers }]`，只回 `callers.length >= threshold` 的檔，`threshold` 是 `'off'` 時回 `[]`；`scripts/lenses.js` 在有結果時於 lens 名稱行之後印 `## Blast radius`、每個檔一行 `<file> — <n> callers`、每個呼叫者一行縮排的路徑

**Dispatch:** implementer, sonnet — 偵測規則與輸出格式都已定死，計畫帶完整程式碼。

偵測規則：只算**相對路徑**的 `require('…')`、`from '…'`、`import '…'`、`import('…')`，把說明符對著呼叫者所在目錄解析，去掉副檔名後等於被改檔去掉副檔名（或等於以它為目錄的 `index`）才算。這避開兩個目錄各有一個 `stage.js` 互相算進對方的錯，也不把 `node:path` 這種裸說明符算進去。`git grep` 先用被改檔的 stem 篩候選，再由 JS 精確解析。範圍是 `git diff --name-only <range>` 列出的原始碼檔（`.js .cjs .mjs .ts .tsx`），已刪除的檔也算——它的呼叫者還在，就是壞掉的呼叫者。

1. 先寫失敗的測試。Write `tests/blast-lens.test.js`:

In `tests/blast-lens.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { callersOf, blastFor } = require('../lib/lenses.js');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'lenses.js');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function put(dir, rel, text) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
}

// lib/core.js is required by three files, lib/other.js by one, and a second
// core.js in sub/ by none; HEAD~1..HEAD changes lib/core.js, lib/other.js and
// sub/core.js.
function repo() {
    const dir = tmp('fankeel-blast-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    put(dir, 'lib/core.js', 'module.exports = 1;\n');
    put(dir, 'lib/other.js', 'module.exports = 1;\n');
    put(dir, 'sub/core.js', 'module.exports = 1;\n');
    put(dir, 'a.js', "const c = require('./lib/core.js');\n");
    put(dir, 'b.js', "const c = require('./lib/core');\n");
    put(dir, 'lib/c.js', "const c = require('./core');\nconst o = require('./other.js');\nconst p = require('node:path');\n");
    put(dir, 'esm.mjs', "import core from './lib/core.js';\n");
    put(dir, 'sub/uses.js', "const c = require('./core.js');\n");
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    put(dir, 'lib/core.js', 'module.exports = 2;\n');
    put(dir, 'lib/other.js', 'module.exports = 2;\n');
    put(dir, 'sub/core.js', 'module.exports = 2;\n');
    git(dir, 'commit', '-qam', 'change');
    return dir;
}

test('callersOf: resolves each specifier against its caller, so sub/core.js is not lib/core.js', () => {
    const dir = repo();
    assert.deepEqual(callersOf(dir, 'lib/core.js'), ['a.js', 'b.js', 'esm.mjs', 'lib/c.js']);
    assert.deepEqual(callersOf(dir, 'sub/core.js'), ['sub/uses.js']);
    assert.deepEqual(callersOf(dir, 'lib/other.js'), ['lib/c.js']);
});

test('blastFor: fires at the threshold and lists every caller; one under stays quiet', () => {
    const dir = repo();
    assert.deepEqual(blastFor(dir, ['lib/core.js', 'lib/other.js'], 4), [
        { file: 'lib/core.js', callers: ['a.js', 'b.js', 'esm.mjs', 'lib/c.js'] },
    ]);
    assert.deepEqual(blastFor(dir, ['lib/core.js'], 5), []);
    assert.deepEqual(blastFor(dir, ['lib/core.js'], 'off'), []);
});

test('scripts/lenses.js: a changed file with N callers prints ## Blast radius and the N callers @slow', () => {
    const dir = repo();
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', '4').ok, true);
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, [
        '## Blast radius',
        'lib/core.js — 4 callers',
        '  a.js',
        '  b.js',
        '  esm.mjs',
        '  lib/c.js',
        '',
    ].join('\n'));
});

test('scripts/lenses.js: under the threshold prints none, and verify.blast off never counts @slow', () => {
    const dir = repo();
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', '5').ok, true);
    let r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.stdout, 'none\n');
    assert.equal(profile.write(profile.projectFile(dir), 'verify.blast', 'off').ok, true);
    r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.stdout, 'none\n');
});
```

2. Run `node --test tests/blast-lens.test.js` — fails (`callersOf is not a function`).
3. In `lib/lenses.js`, directly under `'use strict';`, add the imports:

```js
const { execFileSync } = require('node:child_process');
const path = require('node:path');
```

4. In `lib/lenses.js`, directly above `module.exports`, add:

```js
// blast-radius, the third lens and the only one that is not a regex over a
// diff: how many files require or import each file the range changed. A file
// many others lean on can break a caller the diff never shows, so past the
// profile's `verify.blast` the callers go in the adversary's brief to be read.
// Only a relative specifier counts, resolved against the caller's own
// directory: two files named core.js do not count each other, and
// `require('node:path')` is nobody's caller.
const SOURCE = ['*.js', '*.cjs', '*.mjs', '*.ts', '*.tsx'];
const SOURCE_EXT = /\.(js|cjs|mjs|ts|tsx)$/;
const SPECIFIER = /(?:require\(|\bfrom\s+|\bimport\s*\(?\s*)['"](\.[^'"]*)['"]/g;

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function callersOf(root, file) {
    const target = file.replace(SOURCE_EXT, '');
    const stem = path.posix.basename(target);
    let out;
    try {
        out = execFileSync('git', ['grep', '-nIE', '(require|from|import)[^\'"]*[\'"]\\.[^\'"]*' + escapeRe(stem) + '([.][a-z]+)?[\'"]', '--', ...SOURCE], { windowsHide: true, cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        // git grep exits 1 when nothing matched: no callers, not a failure.
        if (e.status === 1) return [];
        throw e;
    }
    const found = new Set();
    for (const row of out.split(/\r?\n/)) {
        const m = /^([^:]+):\d+:(.*)$/.exec(row);
        if (!m || m[1] === file) continue;
        for (const spec of m[2].matchAll(SPECIFIER)) {
            const at = path.posix.join(path.posix.dirname(m[1]), spec[1]).replace(SOURCE_EXT, '');
            if (at === target || at === path.posix.join(target, 'index')) found.add(m[1]);
        }
    }
    return [...found].sort();
}

// `threshold` is a number (fire at that many callers or more) or 'off'.
function blastFor(root, files, threshold) {
    if (threshold === 'off') return [];
    const out = [];
    for (const file of files) {
        if (!SOURCE_EXT.test(file)) continue;
        const callers = callersOf(root, file);
        if (callers.length >= threshold) out.push({ file, callers });
    }
    return out;
}

```

5. Replace the last line of `lib/lenses.js`, ``module.exports = { lensesFor, addedLines };``, with:

```js
module.exports = { lensesFor, addedLines, callersOf, blastFor };
```

6. In `scripts/lenses.js`, replace the line ``const { lensesFor } = require('../lib/lenses.js');`` with:

```js
const { lensesFor, blastFor } = require('../lib/lenses.js');
const profile = require('../lib/profile.js');
```

7. In `scripts/lenses.js`, replace the final two statements of `main` — from ``const lenses = lensesFor(diff);`` through ``return 0;`` — with:

```js
    const lenses = lensesFor(diff);
    // verify-5: the profile's fan-in threshold; a range that changed no file
    // anything else requires prints nothing here.
    let blast = [];
    try {
        const names = execFileSync('git', ['diff', '--name-only', '--no-renames', args.range], { windowsHide: true, cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        const threshold = profile.read(args.root, profile.configDirOf()).values['verify.blast'];
        blast = blastFor(args.root, names.split(/\r?\n/).filter(Boolean), threshold);
    } catch (e) {
        process.stderr.write('blast radius skipped in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
    }
    const lines = [...lenses];
    if (blast.length) {
        lines.push('## Blast radius');
        for (const b of blast) {
            lines.push(b.file + ' — ' + b.callers.length + ' callers');
            for (const c of b.callers) lines.push('  ' + c);
        }
    }
    process.stdout.write((lines.length ? lines.join('\n') : 'none') + '\n');
    return 0;
```

8. In `scripts/lenses.js`, in the header comment, replace ``// neither — and `none` when lensesFor found nothing. Exit 0 whatever it`` with:

```js
// neither — then, when a changed file has `verify.blast` or more requirers, a
// `## Blast radius` block listing them; `none` when nothing fired. Exit 0 whatever it
```

9. Run `node --test tests/blast-lens.test.js tests/lenses.test.js` — passes (the old `comment` and `none` cases still hold: their repos have no requirers).
10. Hand back for commit `feat: lenses lists the callers of a file many others require (verify-5)`.

## Task 14: verify 的 SKILL 點名 blast-radius，bytes 上限跟著動

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md:269-272` — 在 Silent failure／Comment 旁加 Blast radius
- Modify: `tests/skill-size.test.js:15-30` — `fankeel-verify` 的上限升到新大小之上最小的 100 倍數
- Read: `scripts/input-check.js` — `--skills` 量 bytes 的指令，不改它
- Test: `tests/blast-skill.test.js`

**Interfaces:**
- Consumes: Task 13 —— `scripts/lenses.js` 輸出的 `## Blast radius` 區塊
- Produces: none

**Dispatch:** implementer, sonnet — 一段文字加一個上限數字，測試斷言字串。

`skills/fankeel-verify/SKILL.md` 現在 19790 bytes，上限 19800，只剩 10 bytes：這段文字一加就超，所以上限要在同一個 task 提高。上限的規則（`tests/skill-size.test.js` 檔頭）是「量到的大小之上最小的 100 倍數」，所以數字由量測決定，不事先寫死。

1. 先寫失敗的測試。Write `tests/blast-skill.test.js`:

In `tests/blast-skill.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('verify names the blast-radius lens beside the other two, and the profile key that sets it', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8');
    assert.match(text, /`## Blast radius`/);
    assert.match(text, /`verify\.blast`/);
});
```

2. Run `node --test tests/blast-skill.test.js` — fails.
3. In `skills/fankeel-verify/SKILL.md`, replace the paragraph that opens ``Before dispatching, run `node <plugin>/scripts/lenses.js <the base>..HEAD` over`` (it runs four lines, to ``whichever it named.``) with:

```md
Before dispatching, run `node <plugin>/scripts/lenses.js <the base>..HEAD` over
that same whole range and put what it printed in the brief too: `none`, or the
`## Silent failure` lens and the `## Comment` lens by name, whichever it named,
and, when it printed `## Blast radius`, that block as it stands — a changed file
that `verify.blast` (`task.js profile show`) or more files require, with the
callers listed. Tell the adversary to read those callers against the change.
```

4. Run `node scripts/input-check.js --skills` and read the byte count printed for `skills/fankeel-verify/SKILL.md`. In `tests/skill-size.test.js`, in `CAPS`, replace ``'fankeel-verify': 19800,`` with that count rounded up to the next multiple of 100 (for example a count of 19990 gives ``'fankeel-verify': 20000,``; a count of 20000 or more gives the next hundred above it).
5. Run `node --test tests/blast-skill.test.js tests/skill-size.test.js tests/agents.test.js tests/skills.test.js` — passes.
6. Hand back for commit `docs: verify asks for the blast-radius lens (verify-5)`.

## Task 15: 逾時轉背景的 shell 結果不算 lost（await-17）

**Files:**
- Modify: `lib/handoff.js` — 新增 `backgroundedShell(file)`，抽出 `notifiedIds(entries)` 給它和 `launched` 共用，`awaitState` 在 idle 判斷多問一句，匯出新名字
- Test: `tests/await-backgrounded.test.js`

**Interfaces:**
- Consumes: `tailEntries(file)`、`mtimeOf`、`BUSY_MS`、`pendingTool`、`owesReply`（都在 `lib/handoff.js` 內）
- Produces: `backgroundedShell(file: string) → boolean`（匯出）：transcript 尾端有一筆 Bash／PowerShell 的 tool_result 文字說命令仍在背景跑，且該 tool_use 還沒收到 `<task-notification>`。`notifiedIds(entries: object[]) → Set<string>`（模組內部，不匯出）

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，照抄加測試。

背景：CC 2.1.311 起前景命令逾時不再卡住 tool call，而是回一筆「目前輸出，命令仍在背景跑」的結果（changelog :282）。tool_use 因此立刻有了結果，`pendingTool` 變 false；stage agent 接著寫一句「等它」就收手，transcript 靜止，三分鐘後 `awaitState` 判 `lost`，但那條 shell 還在跑。修法是把這種結果視為仍有工作在外，跟未回覆的 tool_use 一樣撐到 `BUSY_MS`。結果的確切字樣還沒在 live session 觀察過（Task 19），所以比對用寬鬆的正規式，Task 19 會用真實文字驗它。

1. 寫失敗的測試。建立 `tests/await-backgrounded.test.js`：

```js
'use strict';

// await-17: Claude Code 2.1.311 answers a foreground command that reaches its
// timeout with the output so far and a line saying it still runs in the
// background. The tool call is answered, so pendingTool is false; the agent
// then waits for the shell and writes nothing, and awaitState read it `lost`
// after idleMs while the shell ran. A shell result that says so now holds
// `lost` off until busyMs, like an unanswered tool_use, until the shell's
// <task-notification> arrives.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, backgroundedShell } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const user = (blocks) => line({ type: 'user', message: { content: blocks } });
const use = (id, name) => ({ type: 'tool_use', id, name: name || 'Bash', input: { command: 'node --test' } });
const result = (id, text) => ({ type: 'tool_result', tool_use_id: id, content: text });
const say = (text) => ({ type: 'text', text });

const MOVED = 'Command timed out after 120000ms. Output so far:\nstart\n\nThe command is still running in the background (shell b1a2c3).';

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-backgrounded-'), 'agent-a1.jsonl');
    fs.writeFileSync(file, body);
    if (ms) fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

const WAITING = asst('m1', [use('t1')]) + user([result('t1', MOVED)]) + asst('m2', [say('waiting for the shell')]);
const PLAIN = asst('m1', [use('t1')]) + user([result('t1', 'ok')]) + asst('m2', [say('done')]);
const NOTIFIED = WAITING + user([say('<task-notification><tool-use-id>t1</tool-use-id><status>completed</status></task-notification>')]) + asst('m3', [say('it finished')]);

test('backgroundedShell: a shell result saying it still runs in the background counts', () => {
    assert.equal(backgroundedShell(transcript(WAITING)), true);
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1', 'PowerShell')]) + user([result('t1', MOVED)]))), true);
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1')]) + user([result('t1', [{ type: 'text', text: MOVED }])]))), true, 'content as an array of blocks');
});

test('backgroundedShell: an ordinary result, a notified shell, another tool or no file do not', () => {
    assert.equal(backgroundedShell(transcript(PLAIN)), false);
    assert.equal(backgroundedShell(transcript(NOTIFIED)), false, 'its task-notification came back');
    assert.equal(backgroundedShell(transcript(asst('m1', [use('t1', 'Read')]) + user([result('t1', MOVED)]))), false, 'a file read that quotes the phrase');
    assert.equal(backgroundedShell(path.join(tmp('fankeel-await-backgrounded-'), 'none.jsonl')), false);
    assert.equal(backgroundedShell(transcript('')), false);
});

test('awaitState: a backgrounded shell holds lost off until busyMs; an ordinary finish does not', () => {
    const dir = tmp('fankeel-await-backgrounded-');
    const base = { handoff: path.join(dir, 'build.md'), commit: path.join(dir, 'build-commit.md'), since: T, idleMs: 180000, busyMs: 660000, started: T - 900000 };
    const moved = transcript(WAITING, T - 200000);
    assert.equal(awaitState({ ...base, activity: [moved], now: T }), null, '200 s after the result is busy, not lost');
    assert.equal(awaitState({ ...base, activity: [moved], now: T + 470000 }), 'lost', '670 s is past busyMs');
    assert.equal(awaitState({ ...base, activity: [transcript(PLAIN, T - 200000)], now: T }), 'lost', 'an ordinary finish idle 200 s is lost, as before');
    assert.equal(awaitState({ ...base, activity: [transcript(NOTIFIED, T - 200000)], now: T }), 'lost', 'the shell reported back: nothing is out any more');
    assert.equal(awaitState({ ...base, activity: [transcript(WAITING, T - 200000)], waiting: ['c1'], now: T }), null, 'held before stalled is asked');
    assert.equal(awaitState({ ...base, activity: [transcript(WAITING, T - 200000)], waiting: ['c1'], now: T + 470000 }), 'stalled', 'past busyMs a brain with background children is stalled, as before');
});
```

2. Run `node --test tests/await-backgrounded.test.js` and watch it fail (`backgroundedShell is not a function`).
3. 在 `lib/handoff.js` 的 `owesReply()` 之後、`// await-16: the children a brain dispatched in the background, read off its` 那行之前，加入兩個函式。用 Edit，`old_string` 取那行註解，`new_string` 是下面的程式碼接著原註解行：

```js
// The tool_use ids a transcript's `<task-notification>` blocks name: a
// background child or shell whose result already came back, in a user text
// block or an attachment prompt. launched() and backgroundedShell() both
// subtract these.
function notifiedIds(entries) {
    const blocks = (e) => (e.message && Array.isArray(e.message.content) ? e.message.content : []);
    const done = new Set();
    for (const e of entries) {
        if (!e) continue;
        const texts = e.attachment && typeof e.attachment.prompt === 'string' ? [e.attachment.prompt] : [];
        if (e.type === 'user') for (const b of blocks(e)) if (b && b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
        for (const t of texts) if (t.includes('<task-notification>')) for (const m of t.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) done.add(m[1].trim());
    }
    return done;
}

// await-17: Claude Code 2.1.311 answers a foreground shell command that
// reached its timeout with the output so far and a line saying it still runs
// in the background. The tool_use is answered, so pendingTool() is false, yet
// the shell is out: an agent waiting on it writes nothing, and `lost` would
// fire at idleMs. True while such a result has had no <task-notification>. The
// wording was not observed when this was written (docs/90-agent/reference/
// subagents.md, "How the controller waits"), so the match is loose; the
// worst a false match does is keep `lost` back until busyMs. A result whose
// tool_use is in the tail and is not a shell does not count (a file read can
// quote the phrase); one whose tool_use fell out of the tail does.
const BACKGROUNDED = /\b(?:running|continu\w*|moved|sent)\b[^.\n]{0,40}\bbackground\b/i;
function backgroundedShell(file) {
    const entries = tailEntries(file) || [];
    const blocks = (e) => (e && e.message && Array.isArray(e.message.content) ? e.message.content : []);
    const names = new Map(entries.filter((e) => e && e.type === 'assistant').flatMap(blocks)
        .filter((b) => b && b.type === 'tool_use' && b.id).map((b) => [b.id, b.name]));
    const done = notifiedIds(entries);
    return entries.filter((e) => e && e.type === 'user').flatMap(blocks).some((b) => {
        if (!b || b.type !== 'tool_result' || done.has(b.tool_use_id)) return false;
        const name = names.get(b.tool_use_id);
        if (name !== undefined && name !== 'Bash' && name !== 'PowerShell') return false;
        const text = Array.isArray(b.content) ? b.content.map((c) => (c && c.text) || '').join('\n') : String(b.content || '');
        return BACKGROUNDED.test(text);
    });
}

// await-16: the children a brain dispatched in the background, read off its
```

4. 在 `lib/handoff.js` 的 `launched()` 內，把重複的通知解析換成共用函式。`old_string`：

```js
    const done = new Set();
    for (const e of entries) {
        if (!e) continue;
        const texts = e.attachment && typeof e.attachment.prompt === 'string' ? [e.attachment.prompt] : [];
        if (e.type === 'user') for (const b of blocks(e)) if (b && b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
        for (const t of texts) if (t.includes('<task-notification>')) for (const m of t.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) done.add(m[1].trim());
    }
```

`lib/handoff.js` 的 `new_string`：

```js
    const done = notifiedIds(entries);
```

5. 在 `lib/handoff.js` 的 `awaitState()`，把這一行：

```js
    if (idle < busyMs && activity.some((f) => pendingTool(f) || owesReply(f)))return null;
```

在 `lib/handoff.js` 換成：

```js
    if (idle < busyMs && activity.some((f) => pendingTool(f) || owesReply(f) || backgroundedShell(f))) return null;
```

並把 `awaitState` 上方註解裡 `Past idleMs, a tool call still\n// out, or a reply still owed, in any activity file` 一句改成 `Past idleMs, a tool call still\n// out, a reply still owed, or a shell result saying it still runs in the background (await-17), in any activity file`。

6. 在檔尾 `module.exports` 那行，把 `pendingTool, owesReply, launched,` 換成 `pendingTool, owesReply, backgroundedShell, launched,`（只加一個名字）。
7. Run `node --test tests/await-backgrounded.test.js tests/await-pending.test.js tests/await-stalled.test.js` — 全過（後兩個是 `awaitState` 與 `launched` 重構的回歸）。
8. Commit：`await: a shell result that says it still runs in the background holds lost off until busyMs (await-17)`。

## Task 16: guard.js 把 Monitor 當 shell 呼叫（await-18）

**Files:**
- Modify: `hooks/guard.js` — 新增 `SHELL_TOOLS`，`shell` 改用它，`emitCommit` 對 Monitor 提早返回
- Read: `lib/guard.js` — `writesFiles`、`readOnlyAgentType` 的定義，不改
- Read: `.claude-plugin/plugin.json` — `Bash|PowerShell` matcher（:148），不改
- Test: `tests/guard-monitor.test.js`

**Interfaces:**
- Consumes: `writesFiles(command) → boolean`、`readOnlyAgentType(agentType) → boolean`（`lib/guard.js`）；hook 輸入 `tool_input.command`（Monitor 的 `command` 欄位，`.claude-plugin/types/claude-code-tools/index.d.ts:433-446`）
- Produces: `tool_name` 為 `Monitor` 時，guard.js 走和 Bash 一樣的兩條拒絕（唯讀 agent 寫檔、controlled stage 的 controller 寫檔），不做 commit 掃描

**Dispatch:** implementer, sonnet — 兩處小改動加測試，程式碼都在計畫裡。

背景：CC 2.1.314 起 matcher 為 `Bash` 的 hook 也會收到 Monitor 的 shell 命令（changelog :95），只能 block 或 ask。`plugin.json:148` 的 matcher 因此已經在把 Monitor 的呼叫送進 `hooks/guard.js`，而目前 `shell` 只認 `Bash`、`PowerShell`，Monitor 會一路沉默通過：controlled stage 裡 controller 用 Monitor 跑 `sed -i` 就繞過「stage agent 才寫檔」的規則。Monitor 的 `command` 欄位和 Bash 同名，所以 `writesFiles(command)` 直接可用。commit 掃描（`emitCommit`）會輸出 `additionalContext` 類的 verdict，而 Monitor 的 hook 不能 approve／rewrite，且沒有人會用 watch 去 commit，所以對 Monitor 略過。

1. 寫失敗的測試。建立 `tests/guard-monitor.test.js`：

```js
'use strict';

// await-18: a hook matching Bash also runs on a Monitor's shell command since
// Claude Code 2.1.314 (it can block or ask, not approve). hooks/guard.js reads
// Monitor as a shell call for its two refusals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000018';

function project() {
    const root = tmp('fankeel-guard-monitor-');
    const now = new Date().toISOString();
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({ task: 'x', claims: [], stage: 'build', active: true, started: now, updated: now }));
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
    return root;
}

function run(root, payload) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-guard-monitor-config-') }),
    });
}

const monitor = (root, command, extra) => Object.assign({
    session_id: SID, cwd: root, tool_name: 'Monitor',
    tool_input: { command, description: 'watch', timeout_ms: 60000 },
}, extra);
const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

test('a Monitor command that writes is denied for the controller while its stage is controlled', () => {
    const root = project();
    const out = run(root, monitor(root, 'sed -i s/a/b/ x.js'));
    assert.equal(decisionOf(out), 'deny');
    assert.match(reasonOf(out), /build is a controlled stage — this command writes to disk/);
});

test('a Monitor command that only reads, or runs await.js, is let through', () => {
    const root = project();
    for (const command of ['tail -f build.log', 'node scripts/await.js --session x', 'until [ -f done.md ]; do sleep 5; done; echo done']) {
        assert.equal(run(root, monitor(root, command)), '', command);
    }
});

test('a Monitor command that writes is denied for a read-only agent', () => {
    const root = project();
    const out = run(root, monitor(root, 'echo hi > x.txt', { agent_id: 'ag1', agent_type: 'fankeel-reader' }));
    assert.equal(decisionOf(out), 'deny');
    assert.match(reasonOf(out), /read-only agent_type fankeel-reader/);
});

test('a Monitor command that writes is let through for a subagent that is not read-only', () => {
    const root = project();
    assert.equal(run(root, monitor(root, 'echo hi > x.txt', { agent_id: 'ag1', agent_type: 'fankeel-implementer' })), '');
});
```

2. Run `node --test tests/guard-monitor.test.js` and watch tests 1 and 3 fail (Monitor 目前沉默通過)；2 和 4 此時就過，它們鎖住「放行」那一側。
3. 在 `hooks/guard.js`，`WRITE_TOOLS` 那行：

```js
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
```

在 `hooks/guard.js` 後面加：

```js

// The tools whose `tool_input.command` is a shell command. Monitor is here
// since Claude Code 2.1.314 runs a hook matching Bash on its commands too
// (await-18); it can only block or ask there, which is all the two refusals
// below do.
const SHELL_TOOLS = new Set(['Bash', 'PowerShell', 'Monitor']);
```

4. 在 `hooks/guard.js` 的 `main()`，把：

```js
    const shell = payload.tool_name === 'Bash' || payload.tool_name === 'PowerShell';
```

在 `hooks/guard.js` 換成：

```js
    const shell = SHELL_TOOLS.has(payload.tool_name);
```

5. 在 `hooks/guard.js` 的 `emitCommit()`，函式的第一行（`const command = ...` 之前）加：

```js
    if (payload.tool_name === 'Monitor') return;
```

6. Run `node --test tests/guard-monitor.test.js tests/guard.test.js` — 全過（後者是 `shell` 改寫的回歸）。
7. Commit：`guard: read a Monitor command as a shell call for the write refusals (await-18)`。

## Task 17: 文件——Desktop 背景語意、lost 判斷、Monitor 結論（docs-15、await-17、await-18）

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:308-928` — 補 :312 一詞與 :344-348 的 ask 句，改寫 :669-677，補 :636 與 :925-928 的 lost 說明，加 Monitor 結論段
- Modify: `skills/fankeel/SKILL.md:930-960` — 在 `## When to dispatch one` 一節的派工段後加 run_in_background 一段
- Read: `lib/handoff.js` — `backgroundedShell` 的名字與行為（Task 15 寫的），不改
- Read: `hooks/guard.js` — `SHELL_TOOLS`（Task 16 寫的），不改

**Interfaces:**
- Consumes: `backgroundedShell`（Task 15）、`SHELL_TOOLS` 與 guard 對 Monitor 的行為（Task 16）、Task 18 的 mod `tool.check` decider person（只寫進文件，不讀它的碼；段落寫的是 Task 18 做完之後的樣子）
- Produces: none

**Dispatch:** implementer, sonnet — 每一段的新文字都在計畫裡，是替換不是撰寫。

不碰 `lib/stages.js` 的 `AWAIT_RULE`（另一組負責）。:312 與 :344-348 兩處是原本 Task 2 與 Task 18 各自的文件編輯，併進這裡，字句不變。不動 :653-654 那句「未觀察」，那是 Task 19 親手觀察後才能寫的。

1. 在 `docs/90-agent/reference/subagents.md`，用 Edit 把 :669-677 這一整段（`old_string` 逐字如下，注意是 9 行）：

```text
A stage agent's or a judge's own readers go the other way: each goes out
with `run_in_background: false` (`agents/fankeel-judge.md`'s `## Reading`,
`agents/fankeel-brain.md`'s `## Tools`), so its result comes back as the
dispatching agent's own tool result. On 2026-10-19 a judge sent a reader in
the background, and the reader's hand-back reached the top session rather
than the judge, which was left with nothing to judge. The design-stage judge
of the same day sent six readers in the foreground and all six returned to
it. Whether a background `/fankeel-ask` judge with foreground readers gets
them all back is not yet observed.
```

換成下面兩段（Monitor 結論在前，讀者語意在後）：

```text
**Monitor does not replace the background Bash (await-18, decided 2026-11-02).**
Claude Code 2.1.310 added a `Monitor` tool: a `command` whose every stdout
line is an event, a `timeout_ms` capped at 1800000, and a notification to
Claude when it exits or expires. `await.js` already is that until-loop and
prints one line, then exits, so a Monitor would carry the same single event
with a deadline equal to `await.js`'s own thirty minutes and a re-arm step
added; the five states are decided in `awaitState`, not by whatever launches
the script. Nothing in the changelog says a Monitor event wakes the
controller better than a background Bash exit, and neither has been observed
here (above), so the switch buys nothing. What 2.1.314 did change is that a
hook matching `Bash` also runs on a Monitor's shell command and can only
block or ask: `hooks/guard.js` takes `Monitor` as a shell call for its two
refusals (a read-only agent's write, and the controller's write in a
controlled stage) and skips its commit scan. Reopen this if the observation
above finds that a background Bash exit does not start a controller turn.

A stage agent's or a judge's own readers go the other way: each goes out
with `run_in_background: false` (`agents/fankeel-judge.md`'s `## Reading`,
`agents/fankeel-brain.md`'s `## Tools`), so its result comes back as the
dispatching agent's own tool result. Claude Code 2.1.302 made that the
default for a subagent's own `Agent` calls in `claude -p`, the Agent SDK,
the desktop app and VS Code, and in the same release made the desktop app and
VS Code run every subagent the main conversation dispatches in the
background: a `run_in_background` on the controller's dispatch changes
nothing there, the dispatch returns at once and the result arrives as a
notification. On 2026-10-19 a judge sent a reader in the background, and the
reader's hand-back reached the top session rather than the judge, which was
left with nothing to judge; a nested call is foreground by default, so that
reader went to the background only because the judge asked for it. The
design-stage judge of the same day sent six readers in the foreground and all
six returned to it. Observed on 2026-11-02: the `/fankeel-ask` judge of that
day ran in the background, as the desktop app runs every subagent of the main
conversation, and its eight foreground readers all returned to it. So a
background judge with foreground readers does get them back.
```

2. 在 `docs/90-agent/reference/subagents.md` 的 :636（`lost <id>` 那段），Edit：`old_string` 是 ``in an unanswered `tool_use`, which is not lost until 11 minutes (`BUSY_MS`)``，`new_string` 是 ``in an unanswered `tool_use`, or in a shell result saying the command still runs in the background (`backgroundedShell`, `lib/handoff.js`), which is not lost until 11 minutes (`BUSY_MS`)``。
3. 在同一檔 :925-928，Edit：`old_string`

```text
  `lost`, because a foreground Bash call may run that long with nothing written.
  That wait stays.
```

換成：

```text
  `lost`, because a foreground Bash call may run that long with nothing written.
  Since Claude Code 2.1.311 a foreground call that reaches its timeout is
  answered with the output so far and a line saying it still runs in the
  background; `backgroundedShell` (`lib/handoff.js`) reads such a result, until
  the shell's `<task-notification>` arrives, as a call still out, so `lost`
  waits the same eleven minutes for it (await-17).
  That wait stays.
```

4. 在同一檔 :312，Edit：`old_string` 是 ``else the agent file's `effort:`, else `inherit`, and``，`new_string` 是 ``else the agent file's `effort:`, else `CLAUDE_CODE_SUBAGENT_EFFORT`, else `inherit`, and``。只這一詞。
5. 在同一檔 :344-348，Edit：`old_string`

```text
asks the
user. It guards API spend, the main context's residue
```

換成：

```text
asks the
user. Where the mod is loaded, `hooks/mod.ts` hands that ask to the person
(`tool.check` with `decider: "person"`, Claude Code 2.1.304), so the auto-mode
classifier cannot answer it and a session with nobody to ask refuses the call
with the gate's reason; without the mod it is a plain ask. It guards API spend, the main context's residue
```

6. 在 `skills/fankeel/SKILL.md`，Edit：`old_string` 是這一行（整行，獨立成段）：

```text
Everything else is a dispatch, and several of them go out in one response.
```

`new_string` 是同一行加兩段：

```text
Everything else is a dispatch, and several of them go out in one response.

**Where the result lands depends on the host, not on `run_in_background`.**
The desktop app and VS Code run every subagent the main conversation
dispatches in the background (Claude Code 2.1.302), so there a dispatch
returns at once and its result arrives as a notification whatever the call
said; a subagent's own `Agent` calls run in the foreground by default in
`claude -p`, the Agent SDK, the desktop app and VS Code, so a stage agent or
a judge hears its readers back as tool results. Write no plan or rule that
needs the main conversation's `run_in_background` to take effect. The runs are
in [docs/subagents.md](../../docs/90-agent/reference/subagents.md), `### How the controller waits`.
```

7. 驗證：Run `grep -c "CLAUDE_CODE_SUBAGENT_EFFORT" docs/90-agent/reference/subagents.md`（至少 1）、`grep -c "decider: \"person\"" docs/90-agent/reference/subagents.md`（1）、`grep -c "Monitor does not replace the background Bash" docs/90-agent/reference/subagents.md`（1）、`grep -c "Whether a background \`/fankeel-ask\` judge" docs/90-agent/reference/subagents.md`（0）、`grep -c "Where the result lands depends on the host" skills/fankeel/SKILL.md`（1）。
8. Commit：`docs: Desktop runs main-conversation subagents in the background, Monitor not replacing await, backgrounded shells are not lost, title reads the subagent effort env, the dispatch gate's ask goes to the person (docs-15, await-17, await-18, gate-21)`。

## Task 18: dispatch gate 的 ask 經 mod tool.check 交給人（decider person）

**Files:**
- Modify: `hooks/mod.ts` — 加 `GATE_PREFIX`、`personDecides()` 與一個 `tool.check` handler
- Modify: `tests/mod.test.js` — 第一個 case 的事件清單多一個 `tool.check`
- Read: `hooks/dispatch-gate.js` — :121 的 reason 開頭字串、:143 的 `'ask'`（不改，mod 沒載入時照舊）
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `ToolCheckResult`、`ToolCheckInput`（本機型別是 10-14 產的，早於 2.1.304，沒有 `decider` 欄位）
- Test: `tests/mod-decider.test.js`

**Interfaces:**
- Consumes: `hooks/dispatch-gate.js` 每個 ask 的 `permissionDecisionReason` 都以 `fankeel: this is Agent call ` 開頭（:121 `head`）
- Produces: `hooks/mod.ts` 匯出 `GATE_PREFIX: string` 與 `personDecides(out: Verdict): Verdict`，`Verdict = { decision: string; reason?: string; decider?: string; [k: string]: unknown }`；mod 註冊 `on('tool.check', { tool: 'Agent' }, handler)`

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼；轉錄加測試。

做法：不搬 dispatch gate 的計數邏輯（它讀 transcript、registry、profile，留在 hooks/dispatch-gate.js）。mod 的 `tool.check` 先 `await next(e)` 拿到 core 的決定——classic PreToolUse hook 的 ask 就在這裡面（型別註解：`hook` 是 "the classic hook event that decided, or whose ask the verdict was reached under"）——只在它是 dispatch gate 的 ask 時加上 `decider: 'person'`（changelog 2.1.304 :530：只有權限對話框或 host callback 能批，沒人可問時以 mod 的 reason 拒絕）。其他判決原樣放行。mod 沒載入時 hooks/dispatch-gate.js:143 的 `'ask'` 照舊，行為退回今天。hooks/wrap-up.js:12 不動：它拒絕的是 wrap_up 上的「決策」，要的是 AskUserQuestion，不是權限對話框，decider person 改變不了這件事。

1. 寫失敗的測試。

In `tests/mod-decider.test.js`:

```js
'use strict';
// gate-21: past dispatch.inflight the dispatch gate's ask goes to the person —
// CC 2.1.304 tool.check decider "person" — never to the auto-mode classifier;
// with nobody to ask the engine refuses it with the hook's reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

async function checkHook() {
    const { register } = await load();
    let found = null;
    register((name, matcher, fn) => { if (name === 'tool.check') found = { matcher, fn }; });
    return found;
}

const REASON = 'fankeel: this is Agent call 9 in one response, past dispatch.inflight (8). No figure: no stage has recorded spend and no bench ran reader.';

test('mod registers one tool.check, matched on the Agent tool', async () => {
    const found = await checkHook();
    assert.ok(found, 'no tool.check registered');
    assert.deepEqual(found.matcher, { tool: 'Agent' });
});

test('a dispatch-gate ask leaves with decider person, its decision and reason kept', async () => {
    const { fn } = await checkHook();
    const core = { decision: 'ask', reason: REASON, hook: 'PreToolUse' };
    const out = await fn({}, { tool: 'Agent', input: {} }, async () => core);
    assert.deepEqual(out, { decision: 'ask', reason: REASON, hook: 'PreToolUse', decider: 'person' });
});

test('nobody present: the answer is one only a person can approve, so the engine refuses it with the reason', async () => {
    const { personDecides } = await load();
    const out = personDecides({ decision: 'ask', reason: REASON });
    assert.equal(out.decider, 'person');
    assert.notEqual(out.decision, 'allow');
    assert.equal(out.reason, REASON, 'the reason is what the refused model reads');
});

test('every other verdict passes untouched', async () => {
    const { fn } = await checkHook();
    for (const core of [
        { decision: 'allow' },
        { decision: 'deny', reason: REASON },
        { decision: 'ask', reason: 'Bash(git push:*)', rule: 'Bash(git push:*)' },
        { decision: 'ask' },
    ]) {
        const out = await fn({}, { tool: 'Agent', input: {} }, async () => core);
        assert.equal(out, core, JSON.stringify(core));
        assert.equal(out.decider, undefined);
    }
});

test('the prefix is the one hooks/dispatch-gate.js opens every ask with', async () => {
    const { GATE_PREFIX } = await load();
    const src = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'dispatch-gate.js'), 'utf8');
    assert.ok(src.includes("'" + GATE_PREFIX), 'hooks/dispatch-gate.js no longer opens its reason with ' + JSON.stringify(GATE_PREFIX));
});
```

2. Run `node --test tests/mod-decider.test.js` — 失敗：沒有 `tool.check` 註冊，`personDecides`、`GATE_PREFIX` 是 undefined。

3. 改 `hooks/mod.ts`。

In `hooks/mod.ts`, after `const PROMPT_MAX = 200`, add:

```ts

// hooks/dispatch-gate.js opens every ask with these words (its `head`, :121);
// tests/mod-decider.test.js reads the hook's source for them.
export const GATE_PREFIX = 'fankeel: this is Agent call '

type Verdict = { decision: string; reason?: string; decider?: string; [k: string]: unknown }

// A dispatch-gate ask is the person's to answer, never the auto-mode
// classifier's (CC 2.1.304 decider "person"): with nobody to ask, the engine
// refuses it with the hook's reason. Every other verdict passes as it came.
export function personDecides(out: Verdict): Verdict {
  if (!out || out.decision !== 'ask' || typeof out.reason !== 'string' || !out.reason.startsWith(GATE_PREFIX)) return out
  const answer: Verdict = { ...out, decider: 'person' }
  return answer
}
```

In `hooks/mod.ts`, inside `register`, after `pane(on, options)`, add:

```ts

  // The classic PreToolUse hook (hooks/dispatch-gate.js) has already asked inside next(e);
  // this only names who may answer that ask.
  on('tool.check', { tool: 'Agent' }, async ($, e, next) => {
    const out = await next(e)
    return personDecides(out as unknown as Verdict) as unknown as typeof out
  })
```

4. 改 `tests/mod.test.js` 第一個 case。

In `tests/mod.test.js`, replace the first test with:

```js
test('mod register wires the compact hook, the pane, the band, one turn.complete, the turn.step effort observer, the tool.call shells observer, the dispatch-gate decider, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['agent.spawn', 'command.run', 'session.start', 'tool.call', 'tool.check', 'turn.complete', 'turn.step', 'ui.render', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
    assert.deepEqual(calls.filter((a) => a[0] === 'ui.render').map((a) => a[1].component).sort(), ['AbovePrompt', 'Pane']);
});
```

5. Run `node --test tests/mod-decider.test.js tests/mod.test.js tests/mod-load.test.js` — 全過。subagents.md 裡「asks the user」那句的補述由 Task 17 寫。

6. Hand back for commit `feat: dispatch gate ask goes to the person through mod tool.check (gate-21)`.

## Task 19: 親手觀察背景 Bash 的喚醒與逾時轉背景的結果文字（await-17）

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:640-654` — 把「Whether a background Bash exit wakes the controller … has not been observed」換成觀察結果
- Read: `lib/handoff.js` — `backgroundedShell`，用來驗證真實文字被認得，不改

**Interfaces:**
- Consumes: `backgroundedShell(file)`（Task 15）
- Produces: none

**Dispatch:** user — 要在使用者自己的 Desktop session 裡看一個背景 Bash 結束時主對話會不會自己開新一輪，subagent 與 `claude -p` 都代替不了這個觀察。

build 在所有派出去的任務之後、gate 之前和使用者一起做。做完一次說「做完了」，其餘（改文件、跑驗證）由 session 做。

1. 在要觀察的 Desktop session 的終端機取版本與日期，記下來：

```sh
claude --version && date
```

2. 對那個 session 說：「用 Bash 工具、`run_in_background` 設 false、`timeout` 設 5000，執行 `node -e "console.log('start');setTimeout(()=>console.log('end'),30000)"`。結果回來後只回一個字『等』，然後停，不要輪詢、不要再呼叫工具。」把工具結果的整段文字複製下來（逾時那一筆，內容應有 `start` 和一句說命令還在背景跑）。
3. 約 30 秒後看那個 session：命令結束時它有沒有**自己**開新一輪（沒有你輸入任何東西）。記下有或沒有。
4. 再對它說：「用 Bash 工具、`run_in_background` 設 true 執行同一個命令，送出後只回『等』然後停。」同樣等 30 秒，記下結束時有沒有自己開新一輪。這一次才是 :654 問的「背景 Bash 結束是否喚醒 controller」。
5. 在 repo 根目錄用步驟 2 複製的文字驗證 `backgroundedShell` 認得它（把引號內換成貼上的整段文字）：

```sh
node -e "const fs=require('fs'),os=require('os'),path=require('path');const {backgroundedShell}=require('./lib/handoff.js');const f=path.join(os.tmpdir(),'bg-probe.jsonl');const t=process.argv[1];fs.writeFileSync(f,[{type:'assistant',message:{id:'m',content:[{type:'tool_use',id:'t',name:'Bash',input:{}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'t',content:t}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');console.log(backgroundedShell(f))" "貼上的整段文字"
```

印 `true` 就繼續。印 `false`：停下，回報貼上的文字，build 回頭改 Task 15 的 `BACKGROUNDED` 正規式（`lib/handoff.js`）與 `tests/await-backgrounded.test.js` 的 `MOVED`，再重做這一步。
6. 在 `docs/90-agent/reference/subagents.md`，Edit：`old_string`

```text
Whether a background Bash
exit wakes the controller the way a hand-back does has not been observed.
```

依步驟 4 的結果換成其中一段（`<version>`、`<date>` 填步驟 1 的輸出，`<result text>` 填步驟 2 複製的文字，單行化）。有開新一輪：

```text
Observed on <date>, Claude Code <version>: a background Bash exit starts a
controller turn by itself, so the line `await.js` prints on exit is the wake
it was built to be. A foreground call that reached its timeout came back as
`<result text>`, and the shell went on.
```

沒有開新一輪：

```text
Observed on <date>, Claude Code <version>: a background Bash exit did not
start a controller turn; the session saw the exit only on its next turn.
`await.js`'s line therefore waits for the user's next message, and the
Monitor tool's per-event notification becomes the candidate to try (await-18
reopened). A foreground call that reached its timeout came back as
`<result text>`, and the shell went on.
```

7. 沒開新一輪的話：把步驟 4 的觀察與日期告訴 session，由 session 在 land 用 `todo.js new` 開一條「評估 Monitor 取代背景 Bash（背景 Bash 結束不喚醒）」（land 的 TODO 動作，不在本任務的 Files）；有開新一輪就不動 TODO。Commit：`docs: observed what a background Bash exit and a timed-out foreground call do (await-17)`。

## Task 20: 實機確認 auto mode 下 dispatch gate 由人回答、沒人時拒絕

**Files:**
- Modify: `docs/90-agent/todo/gate-21.md` — 只在 body 末手加一行實測結果（`todo.js` 沒有改 body 的子命令），frontmatter 不動，改完跑 `node scripts/todo-check.js`
- Read: `hooks/mod.ts` — Task 18 的 `tool.check` handler
- Read: `hooks/dispatch-gate.js` — reason 字串

**Interfaces:**
- Consumes: Task 18 —— `hooks/mod.ts` 的 `tool.check` handler 已 commit 並由 `plugin update` 裝進本機
- Produces: none

**Dispatch:** user — 要在使用者自己的 auto mode session 裡看權限對話框出現，並開一個沒人能答的 headless run；`claude -p` 由 subagent 代跑看不到對話框。

1. 在一個暫存目錄放 `.fankeel/profile.json` 內容 `{"dispatch.inflight": 1}`，在那裡開一個新 session（auto mode），確認 mod 已載入（`/fankeel-pane` 指令存在，或 transcript 沒有 mod 載入失敗行）。
2. 請 Claude 在同一個回應裡派兩個 Explore agent。期待：第二個出現權限對話框，內文是 `fankeel: this is Agent call 2 in one response, past dispatch.inflight (1).` 開頭；auto mode 分類器沒有自己批掉它。
3. 在同一目錄跑：

```
claude -p "In one response, dispatch two Explore agents that each list the files in this directory." --permission-mode auto
```

期待：第二個 Agent 呼叫被拒，模型看到的錯誤是同一段 `fankeel: this is Agent call 2 …` reason。
4. 任一步不符就停：記下看到的是什麼（對話框沒出現、分類器批了、headless 照跑），回報給 build。最可能的原因見 Risks 第一條。
5. 結果手加一行到 `docs/90-agent/todo/gate-21.md` 的 body 末（frontmatter 不動），再跑 `node scripts/todo-check.js`，例如「2026-11-0x 實測：auto mode 對話框出現；headless 拒絕，reason 一致」。

## Coverage

| promise | task |
|---|---|
| station 導覽：改成 watch，事件是使用者提出要對外展示或錄導覽 | Task 1 |
| 先問完、剩下自己跑：重開該決定，用 2026-10-21 夜的案例開新條目討論無人值守的 gate | Task 1（重開）；「開新條目」struck — 這條本身就是重議 gate-13 的條目、正文已有 10-21 夜的案例，另開會是重複；改 ready 讓下一輪挑它開 design 任務 |
| title.js 認 SUBAGENT_EFFORT: 加一則測試（設 env 時 title 顯示該 effort）通過 | Task 2 |
| title.js 認 SUBAGENT_EFFORT: lib/title.js:153-155 在 fm.effort 之後、'inherit' 之前多認 CLAUDE_CODE_SUBAGENT_EFFORT，並在 subagents.md:312 補一詞 | Task 2（lib/title.js）、Task 17（subagents.md:312） |
| title.js 認 SUBAGENT_EFFORT: 全套測試綠 | Task 2（title 相關測試；全套由 land 跑） |
| title.js 認 SUBAGENT_EFFORT: bump patch 版本 | struck — land 統一 bump，不在任務內 |
| ask skill 註明判官已 xhigh: 「判官由 agent 檔跑 effort: xhigh，dispatch 不帶 effort:、brief 不寫 ultrathink」已寫入 skills/fankeel-ask/SKILL.md | Task 3 |
| ask skill 註明判官已 xhigh: docs-only 依規則跑 version.js 與 todo-check.js 通過 | Task 3（改成動了 skill 與 skill-size 上限，land 跑全套，含這兩支） |
| ask skill 註明判官已 xhigh: bump patch 版本 | struck — land 統一 bump，不在任務內 |
| spend 與 render 補架子: lib/spend.js:120 改成 registry.readAll(root, { shelf: true }) | Task 4 |
| spend 與 render 補架子: 拿掉 tests/shelf-readers.test.js 裡 spend 那條測試的 todo | Task 4 |
| spend 與 render 補架子: scripts/render.js:263 的「22.5 floor」改成 22.13 | Task 4 |
| Desktop 閒置壓縮的分工: 文件寫明 compact.at 350000 以上只在使用者沒離開時才輪到 | Task 5 |
| Desktop 閒置壓縮的分工: init 或設定頁建議關 Idle compaction 或接受 | Task 6（init 壓縮視窗那題）；Task 5（profile.md 即設定頁文件） |
| Desktop 閒置壓縮的分工: 連 spend-6 | Task 7 |
| Desktop 閒置壓縮的分工: 完成條件 — 上述文件與 SKILL 段落更新（`lib/profile.js:53,:56`、`hooks/compact.ts:149-159`、`skills/fankeel/SKILL.md:817-829`） | Task 5（profile.md、what-runs.md、SKILL.md）；`lib/profile.js` desc 與 `hooks/compact.ts` struck — 只動文件，desc 是產表來源，hook 行為沒變 |
| Desktop 閒置壓縮的分工: 註明沒 1M 的帳號 compact.at 在 350000 以上永不先觸發 | Task 5、Task 6 |
| 建議執行 /auto-mode-setup: init 建議跑一次 /auto-mode-setup | Task 6 |
| 建議執行 /auto-mode-setup: 完成條件 — init 流程提示該指令 | Task 6 |
| 建議執行 /auto-mode-setup: 完成條件 — 在 stage-agents-10 重驗後記錄是否有效 | Task 7（init-4 改 watch，`timing: if:` 等重驗事件；不在本計畫內做） |
| shell 標示: Pane stores `description` from the `tool.call` event and shows it first | Task 9 (record and draw), Task 8 (`shellLabel`) |
| shell 標示: with no description, a leading `cd <path> &&` (also `cd /d`, `Set-Location`, `;`) is stripped | Task 8 |
| shell 標示: with no description, `node <anything>/scripts/<name>.js` is shortened to `<name>.js` | Task 8 |
| shell 標示: `lib/shells.js` applies the same rule so the station rows match | Task 10 |
| shell 標示: one sentence in AWAIT_RULE — the background Bash carries a `description` (e.g. "await: survey stage agent") and runs without a `cd` prefix | Task 11 |
| shell 標示: `lib/plantasks.js:449` left alone unless trivially safe | struck — the sentence is pinned verbatim by `tests/plantasks-workflow.test.js:97` and exists so Workflow agents write to the right directory; see Risks |
| verify 加 blast-radius lens: lenses 算 base..HEAD 改到的每個檔被幾個檔案 require／import | Task 13 |
| verify 加 blast-radius lens: 超過門檻就把呼叫者列進對手審查員的簡報 | Task 13、Task 14 |
| verify 加 blast-radius lens: lib/lenses.js 對 range 內每個改到的檔，用 `git grep` 數 require／import 它的檔案數，超過 profile 門檻就輸出 `## Blast radius` 與呼叫者清單 | Task 12、Task 13 |
| verify 加 blast-radius lens: skills/fankeel-verify/SKILL.md:269-271 在 Silent failure／Comment 旁點名它 | Task 14 |
| verify 加 blast-radius lens: 先開 lib/lenses.js 確認沒有同名功能 | struck — 已確認：`lib/lenses.js` 只有 `lensesFor`、`addedLines`，沒有 fan-in；見 Task 13 的 Modify |
| verify 加 blast-radius lens: tests/ 一條測試——改一個被 N 個檔引用的檔時 lens 觸發並列出 N 個呼叫者，現在失敗、改完通過 | Task 13 |
| 逾時轉背景的 lost 判斷: 重新觀察 :654 的喚醒行為，並讓 :927 的 lost 判斷認得逾時轉背景的結果文字，不再誤判 | Task 15 (lost 判斷)、Task 19 (觀察) |
| 逾時轉背景的 lost 判斷: 觀察結果寫回 subagents.md | Task 19 |
| 逾時轉背景的 lost 判斷: await 對轉背景結果有測試 | Task 15 |
| 評估 Monitor 取代背景 Bash: 評估 Monitor 取代背景 Bash 等 handoff 的可行性與喚醒行為 | Task 17 (結論與理由)、Task 19 (喚醒觀察，結果可重開) |
| 評估 Monitor 取代背景 Bash: 確認 guard.js 在 tool_name 非 Bash 時的 verdict 合理 | Task 16 |
| 評估 Monitor 取代背景 Bash: 留下取代或不取代的結論與理由 | Task 17 |
| 評估 Monitor 取代背景 Bash: 取代則改 await 並補測試 | struck — 結論是不取代（Task 17 的 Monitor 段），沒有要改的 await；Task 19 若觀察到背景 Bash 不喚醒會重開條目 |
| subagent 背景語意改寫: 改寫 :669-677，寫明主對話的 run_in_background 在 Desktop 無效、巢狀預設前景，收掉 :676-677 的『未觀察』 | Task 17 |
| subagent 背景語意改寫: subagents.md 與 SKILL 對應段落改寫完成 | Task 17 |
| dispatch gate 走 decider: 超過 dispatch.inflight 的 ask 經 mod tool.check 帶 decider person | Task 18 |
| dispatch gate 走 decider: 測試涵蓋沒人在時拒絕（mod 給出只有人能批的答案、reason 保留） | Task 18 |
| dispatch gate 走 decider: 其他判決與 mod 未載入時行為不變 | Task 18 |
| dispatch gate 走 decider: auto mode 下一定由人回答（實機） | Task 20 |
| dispatch gate 走 decider: 沒人在時實際被拒、reason 一致（headless 實機） | Task 20 |
