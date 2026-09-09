---
status: design-intent
last_verified: 2026-09-09
---

# 少問已知的答案：profile、一次性判斷、結構唯讀的讀者

**目標：** gate 不再問專案早就答過的問題；讀者結構上不能改檔；主 agent
會問人的階段內問題先交給一個一次性判斷 agent，判斷落成可追溯的文件；
`.fankeel/` 每一區的壽命寫在一張表裡。

**一句話：** 一份 `profile.json`（專案內提交、機器預設兜底）注入每個 prompt，
兩個 plugin 自帶的 custom agent（`fankeel-reader` 唯讀、`fankeel-judge` 一次性
判斷），一個 `scripts/judge.js record` 把判斷寫進新的 `docs/judgements/` bucket。

**不做：** design 的 mockup 步驟（§4.1）。這份 spec 只留 §5 的條件規則機制當它的
地基；畫面引擎、hallmark 整合、axis 盤點的四個缺口另開任務，接
[design-class prompt](2026-09-09-design-class-prompt.md)。MCP 不做：它加的是
新工具，減不掉 subagent 已有的 Edit／Write，對「讀者不能改檔」沒有幫助。

## 背景（survey 2026-09-09）

- 可預答的問題 14 條，其中 per-project 穩定 5 條：project、land 的 menu
  （`skills/fankeel-land/SKILL.md:163-171`）、archive plan（`lib/stages.js:357`）、
  `guard`、dispatch 的 model 下限。106 筆 session 裡 `project`／`guard` 皆為 0，
  land 的答案只在 `git log --merges`（47/49 本地 merge、0 PR）
  （[profile 證據](../reports/2026-09-09-profile-evidence.md)）。
- docs.json 的專案查找在 `lib/docs.js:226 projectRootsFor()`，不在
  `hooks/inject.js`；`registry.readFile`（`lib/registry.js:139`）是 parse-or-null。
- 注入層：`lib/render.js:141 render({ mine, others, now, root, launch, transcript,
  unclaimed })`；`hooks/resume.js:29` 自己重算 root、走 `renderResume()`，不共用。
  `{{NEXT}}`／`{{PONYTAIL}}` 在 `lib/stages.js:404-407 RENDER_TOKENS`，
  `render.js:121` 填值。2400 字元的上限只在 `tests/render.test.js:538`。
- build 的 task reviewer（`skills/fankeel-build/SKILL.md:273-325`）已是一次性
  判斷 agent 的形，但裁決只回 parent，經 ledger 落 `progress.md`，沒有獨立紀錄。
- `hooks/brief.js:36` 已把 `payload.agent_type` 交給 `renderBrief`，可依型別分支。
- `.claude/agents/brief-probe.md` 無 `tools:`；`plugin.json` 無 `agents` 欄位；
  caveman 的 `cavecrew-investigator.md` 用 `tools: [Read, Grep, Glob, Bash]`。
  `tools: []` 拒絕啟動，且 agents 目錄只在 process 啟動時讀一次
  （`docs/reports/2026-09-07-brief-probe.md:51`）。
- `lib/docs.js normalise()` 只驗 role 在 `ROLES` 內，不驗目錄存在；
  `tests/docs.test.js:460` 要 `docs/README.md` 的 Roles 表列出每個 bucket。
- station：`lib/station.js:325 gather()` → `serialize()` 給頁面
  `{generatedAt, configDir, pricesVerified, scanStats, serve, projects[], sessions[]}`；
  頁面以 `S.serve` 分支（`assets/station/station.js:642,658,750`）；serve 的
  POST 樣式是 `/clear`（nonce → 403、`readBody` → `URLSearchParams`、303）。
  `scripts/task.js:79 claudeDir()` 解析機器設定目錄，station 已寫
  `<configDir>/fankeel/`。

## 1. profile：格式與查找

- `<project>/.fankeel/profile.json` 與 `docs.json` 同層、版本控制；
  `<configDir>/fankeel/profile.json` 是機器預設。生效值 = 專案 > 機器 > 內建，
  **逐鍵**合併，每個鍵記得自己來自哪一層。
- `lib/profile.js` 匯出 `KEYS`、`read(projectRoot, configDir)`、
  `write(file, key, value)`、`suggest(projectRoot, registryRoot)`。`read` 回
  `{ values, sources }`，缺檔或壞檔視為空（同 `registry.readFile`），壞檔另回
  `unreadable: [path]` 讓注入層說一次。
- `KEYS` 是全部的鍵，每個帶允許值與內建預設；`write` 拒絕不在表上的鍵或值：

| 鍵 | 值 | 內建預設 | 誰讀它 |
|---|---|---|---|
| `land.integration` | `merge` \| `pr` \| `keep` | 無（問） | land 的 menu |
| `land.push` | `true` \| `false` | 無（問） | land 的 menu |
| `land.archivePlan` | `true` \| `false` | 無（問） | `lib/stages.js:357` |
| `guard` | `ask` \| `deny` \| `off` | `ask` | `task.js start` |
| `dispatch.floor` | `sonnet` \| `opus` \| `fable` | `sonnet` | plan 的 `**Dispatch:**` 規則、survey 的讀者 |
| `judge.enabled` | `true` \| `false` | `true` | §3 的規則 |
| `judge.model` | `sonnet` \| `opus` \| `fable` | `fable` | §3 的 dispatch |

- 專案查找走 `lib/docs.js projectRootsFor()` 同一條路：task 的 `project` 與
  claims 決定哪個 repo，`profile.json` 與 `docs.json` 在同一個 `.fankeel/`。
  registry root 就是專案時（本 repo 的情形）就是 `.fankeel/profile.json`。
- `.fankeel/.gitignore` **不加** `profile.json`：它跟 `docs.json` 一樣是要進版本
  控制的那一個。`docs/registry.md`、`skills/fankeel/SKILL.md` 的「Where the
  files are」樹加上這一行。

## 2. profile：CLI、注入、套用

- `scripts/task.js profile show [--project X]` 印生效值，每鍵一行帶來源
  （`project` / `machine` / `builtin`）。`profile set <key> <value> [--project X]`
  寫專案檔；加 `--default` 寫機器檔。`profile suggest [--project X]` 讀
  `git log --merges` 的形（本地 `merge:` 與 PR 各幾筆）與 registry 裡這個專案的
  class 分佈，印一份建議的 JSON 與 `profile set` 指令，**不寫檔**——一次確認，
  之後不問。
- `hooks/inject.js` 與 `hooks/resume.js` 都讀 profile，`render()` 與
  `renderResume()` 各多一個 `profile` 參數。**只有 resume 區塊**帶一行
  `profile: land merge, no push · guard ask · judge fable`，只列有值的鍵，
  來源不是專案的鍵加 `(machine)`；沒有任何值就沒有這一行，壞檔時改說
  `profile: unreadable <path>`。每個 prompt 的區塊**不帶**這一行：build gate
  （2026-09-09）量到無 profile 的區塊離 2400 只剩 3–34 字，七鍵全設的一行有
  146 字，兩者無法並存；值要看就 `task.js profile show`，規則透過
  `{{PROFILE_LAND}}` 與 `when` 仍讀得到它。
- `RENDER_TOKENS` 加 `{{PROFILE_LAND}}`：land 的 menu 規則改成「profile 答了
  就照做、一行說明、不問；沒答才開 menu」。`{{PROFILE_LAND}}` 在 `rulesLines()`
  填成 `merge, no push`（有值）或空字串（無值），規則文字的兩種讀法由此決定。
  archive plan 的規則同樣讀 `land.archivePlan`。
- `task.js start` 讀生效的 `guard`：非內建預設時寫進 entry 的 `guard` 並在輸出
  多一行 `guard: deny (profile)`。這不違反不變量 6——profile 是使用者寫下的
  常設指示，`start` 是在執行它；`skills/fankeel/SKILL.md` 的不變量 6 加一句說明。
- 2400 上限：整個區塊仍受 `tests/render.test.js:538` 管，而且那個測試改成
  **帶七鍵 profile** 渲染（兩種 `land.archivePlan` 各一次），因為 profile 決定
  哪些 `when` 規則在區塊裡；land 規則改寫以**替換**為主，總長不增。
  `{{PROFILE_LAND}}` 為空時規則仍要讀得通。

## 3. `fankeel-judge`：一次性判斷

- `agents/fankeel-judge.md`：`tools: [Read, Grep, Glob, Bash]`、`model: fable`。
  body 說它的工作：讀 brief 指的檔，回答**一次**，格式固定——`pick:` 一行、
  `why:` ≤5 行、`would flip if:` ≤2 行、`unread:` 它沒讀的東西。不追問、不寫檔、
  不派自己的 subagent。`.claude-plugin/plugin.json` 加 `"agents": [...]`。
- 觸發規則進 `ALWAYS`（一行，換掉現有第三條裡可移入 skill 的半句以守上限）：
  「階段內會問人的問題——design 的一次一問、survey 的 class、plan 的拆法、build
  停下來的選擇——先寫 brief 派 `fankeel-judge` 一次，`judge.js record`，照它的
  答案走並一行說明；stage gate 永遠不交給它。」`judge.enabled: false` 時這條
  不注入（§5 的機制）。
- brief 由主 agent 寫到 `.fankeel/build/<plan>/judge-<n>-brief.md`（沒有 plan
  時用 task slug）：問題一行、選項（若有）、背景、要讀的檔案**路徑**（不貼
  內容）、什麼算答完、回傳格式。dispatch 帶 `model: <judge.model>`。
- `scripts/judge.js record --session <id> --brief <path> --answer <path|->`
  寫 `docs/judgements/YYYY-MM-DD-<slug>.md`：frontmatter `judged`（ISO）、
  `model`、`agent: fankeel-judge`、`task`、`session`、`stage`；正文是 brief 全文
  與答案全文，逐字。同名檔已存在就加 `-2`，永不覆寫。同時在
  `docs/README.md` 的 judgements 表加一列（問題一行 + 連結 + *judged, model*），
  沒有那張表就建。印出兩個路徑。
- `hooks/brief.js`／`renderBrief`：`agent_type` 是 `fankeel-judge` 時，brief 多一行
  「answer once; the parent will not message you again」，其餘同今天。
- 主 agent 在下一個 gate 的 option 1 description 裡點名這個 stage 依據的判斷檔，
  人在 gate 看到的是「這個 approach，依 `judgements/…`」。

## 4. `fankeel-reader`：結構唯讀

- `agents/fankeel-reader.md`：`tools: [Read, Grep, Glob, Bash]`、`model: sonnet`。
  Edit／Write／NotebookEdit 不在表上就無法呼叫，不靠散文。Bash 留著給 `git`、
  `node scripts/survey.js`——它仍能寫檔，這是**具名的殘餘**，body 的 Refusals
  說清楚，brief 的 `touched:` 行照舊。
- `lib/stages.js` survey／verify／audit 說「dispatch readers」的規則、
  `skills/fankeel/SKILL.md` §Subagents、`skills/fankeel-survey/SKILL.md` §4、
  `skills/fankeel-verify/SKILL.md`、`docs/subagents.md`：讀者的
  `subagent_type` 一律 `fankeel-reader`，model 讀 `dispatch.floor`。以替換字詞
  為主，不加行。
- `tests/agents.test.js`（新）：兩個 agent 檔的 frontmatter 可解析、`tools` 不含
  Edit／Write／NotebookEdit、`plugin.json` 的 `agents` 列到它們、`name` 與檔名一致。

## 5. 條件規則：D 的地基

（survey 2026-09-09 對 hallmark 的盤點，留給 mockup 任務：nutlope/hallmark 的 SKILL.md 558 行加 references；pre-flight 先讀專案的 design token；21 個可釘選主題；58 個 gate，禁用與門檻混寫；輸出 HTML 加 tokens.css；MIT；只 clone 到 scratchpad 讀，沒安裝。）

- `lib/stages.js` 的 rule 可以是字串，也可以是 `{ when: 'judge.enabled', text }`
  ——`when` 是 profile 鍵名，前綴 `!` 取反。`rulesFor(stage, ctx)` 過濾掉
  `when` 為假的，`ctx.profile` 是 §1 的生效值。今天只有 §3 那一條用它；
  §4.1 的 mockup 規則之後用 `when: 'design.mockup'`。
- `tests/stages.test.js`：`when` 為假時規則不出現、為真時出現、沒有 `when`
  的規則行為不變；`rulesFor` 少了 `ctx.profile` 時視為全空（今天的所有測試不動）。

## 6. docs tree：judgements 與壽命表

- `.fankeel/docs.json` 加 `{ "path": "docs/judgements", "role": "report" }`；
  `docs/README.md` 的 Roles 表加一列，並加一張 judgements 表（§3 的 script
  往那裡寫列）。docs-check 對 `report` 不驗連結（`scripts/docs-check.js:201`），
  所以判斷檔引用已刪的程式碼不是缺陷——它記的是判斷當時。
- `docs/documents.md` 加一節「`.fankeel/` 各區的壽命」，一張表：

| 路徑 | 提交？ | 壽命 |
|---|---|---|
| `docs.json` | 是 | 跟文件一起版本控制 |
| `profile.json` | 是 | 專案的常設答案，改了就是改偏好 |
| `sessions/<id>.json` | 否 | 一個 session 一筆，永不刪，`active:false` 即結束 |
| `map.md` | 否 | 每次 `map.js` 重生 |
| `build/<plan>/` | 否 | 一個 task 的 ledger、brief、judge brief；列出不清理 |
| `index.html`、`station/` | 否 | 這台機器的 station 副本，每次 prompt 重寫 |
| `docs/judgements/` | 是 | 判斷紀錄，寫完不改（`report`） |

- `skills/fankeel/SKILL.md` 的「Where the files are」樹加 `profile.json` 與
  `docs/judgements/`，並連到那張表。

## 7. station：設定面

- `lib/station.js gather()` 對每個 registry 的每個 project 讀
  `lib/profile.read`，機器預設讀一次；`serialize()` 多一個 `profiles`：
  `{ machine: {values}, projects: { <path>: {values, sources} } }`。
- `assets/station/station.js`：每個 project 多一張 **profile** 卡，
  每鍵一列：生效值、來源、允許值。`S.serve` 時每列是一個 `<select>` + 套用
  按鈕，POST `/profile`；靜態頁時同一列右側是可複製的
  `node <plugin>/scripts/task.js profile set <key> <value> --project <path>`。
  機器預設同形，放在 overview 的一張卡。監測（stale／live）的版面不動。
  **位置（plan Task 8 改的，verify 2026-09-09 記）**：原本寫 detail 面板最下方；
  plan 把專案卡接進 `registryNote()`——每個 registry 的卡後面一張——detail
  面板不動，overview 的機器卡在 registry note 之後。
- `scripts/station.js serve` 加 `POST /profile`：nonce 錯 403；body
  `scope=project|machine`、`project=<path>`、`key`、`value`；不在 `KEYS` 的鍵或值
  400；成功走 `lib/profile.write` 後 303 回原頁。`/station/health` 不變。
- 「快速套用」按鈕：「把機器預設套到這個專案」一鍵——就是逐鍵 POST
  `/profile`，不另設端點。位置（plan Task 8 改的，audit 2026-09-09 記）：原本寫
  overview 的機器卡；落地是每張專案卡的標頭（`applyMachineControl` 只在 scope 為
  `project` 時拼進去），機器卡只顯示。

## 檔案表

| file | change | dispatch |
|---|---|---|
| `lib/profile.js`（新） | `KEYS`、`read`、`write`、`suggest` | implementer, sonnet |
| `scripts/task.js` | `profile show\|set\|suggest`；`start` 套 `guard` | implementer, sonnet |
| `lib/render.js`、`hooks/inject.js`、`hooks/resume.js` | `profile` 參數、`profile:` 行、`{{PROFILE_LAND}}` | implementer, sonnet |
| `lib/stages.js` | land menu／archive 規則改讀 token；`when` 規則；judge 規則進 `ALWAYS`；reader 規則換字 | implementer, sonnet |
| `agents/fankeel-judge.md`、`agents/fankeel-reader.md`（新）、`.claude-plugin/plugin.json` | 兩個 agent 定義與 manifest 的 `agents` | implementer, sonnet |
| `scripts/judge.js`（新） | `record` 子命令 | implementer, sonnet |
| `hooks/brief.js` | judge 型別多一行（`renderBrief` 在 render 那列） | 同 render 那列 |
| `lib/station.js`、`scripts/station.js`、`assets/station/station.js`、`assets/station/index.html` | `profiles` 資料、`POST /profile`、profile 區 | implementer, sonnet |
| `.fankeel/docs.json`、`docs/README.md` | judgements bucket、Roles 列、judgements 表 | in-session — 兩個一行的編輯 |
| `docs/documents.md`、`docs/registry.md`、`docs/subagents.md`、`docs/station.md`、`docs/pipeline.md` | 壽命表、profile.json、reader／judge、設定面、`when` | implementer, sonnet |
| `skills/fankeel/SKILL.md`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`skills/fankeel-verify/SKILL.md` | 檔案樹、不變量 6 的一句、menu 讀 profile、reader 型別 | implementer, sonnet |
| `tests/profile.test.js`、`tests/judge.test.js`、`tests/agents.test.js`（新）；`tests/render.test.js`、`tests/stages.test.js`、`tests/task.test.js`、`tests/station-cli.test.js` | §8 的準則（`tests/docs.test.js:460` 的 Roles 斷言已存在，不改） | 隨各實作 task |

## 8. 成功準則

- `tests/profile.test.js`：專案值蓋機器值蓋內建值、逐鍵而非整檔；`set` 拒絕
  未知鍵與未知值（exit 1）；`suggest` 對一個有三筆本地 `merge:`、零 PR 的
  fixture repo 提議 `land.integration: merge`、`land.push: false`，且不寫檔。
- `tests/render.test.js`：有 profile 時區塊帶 `profile:` 行、無值時沒有這一行；
  `renderResume` 同；上限 2400 的斷言在加了 judge 規則之後仍綠。
- `tests/stages.test.js`：land 規則含 `{{PROFILE_LAND}}` 且填空後仍為完整句；
  `when` 規則的三個 case（§5）。
- `tests/task.test.js`：`start` 在 profile `guard: deny` 時 entry 的 `guard` 是
  `deny` 且輸出含 `(profile)`；profile 無值時 entry 沒有 `guard` 欄位（今天的
  行為）。
- `tests/judge.test.js`：`record` 寫出的檔案 frontmatter 六個鍵齊全、正文含
  brief 與答案逐字；同 slug 第二次寫成 `-2` 而原檔 byte 不變；
  `docs/README.md` 多一列且只多一列；缺 `--session` exit 1。
- `tests/agents.test.js`：§4 的四條斷言。
- `tests/station-cli.test.js`：`POST /profile` 對 nonce 錯回 403、未知鍵回 400、
  正確時專案檔多了那個鍵並 303；靜態頁的 profile 區含 `profile set` 指令字串。
- `tests/docs.test.js:460` Roles 表列出 `docs/judgements/`；`tests/source.test.js`
  在兩個 agent 檔與 `scripts/judge.js` 加入後仍綠。
- **artefact 一列**：對一個 profile 寫了 `land.push: false` 的專案，station 頁面
  profile 區顯示的值與來源，和 `task.js profile show` 印出的同一鍵同一來源——
  兩個讀法一個來源，必須一致。
- **行為一列**：在本 repo 開一個新 process 走一次 survey，dispatch 的
  `subagent_type` 是 `fankeel-reader`（從 transcript 的 tool_use 讀）；同一
  session 在 design 的第一個澄清問題上出現 `judge.js record` 與一個
  `docs/judgements/` 新檔。

## 對照 map

- `docs/subagents.md`、`docs/registry.md`、`docs/documents.md`、
  `docs/station.md`、`docs/pipeline.md` 都是 current 的 reference，這份設計會讓
  五頁各有一段不再為真——檔案表已列，verify 的 docs-check 會點名。
- `skills/fankeel/SKILL.md` 不變量 6「Never set or clear `guard` on your own」與
  §2 的 `start` 套 guard 表面衝突：profile 是使用者寫的，`start` 執行的是它。
  那一句加一個子句，不改語意。
- `docs/plans/2026-09-09-design-class-prompt.md`（planned, not built）：這份
  spec 不動它，只提供 §5 的機制給它用；它的三個問題仍未答。
- 沒有 current 頁面說 subagent 一定是 `general-purpose`，也沒有頁面說
  `.fankeel/` 只有五個名字——`2026-09-08-ready-and-station-serve-design.md`
  說「四個名字」，那是它的時點，`profile.json` 是第五個，land 時補記。

## 未驗證

- `model: fable` 的 agent 定義能不能啟動：本機從未派過 fable 的 subagent，且
  agents 目錄只在 process 啟動時讀，本 session 無法試。build 第一個 task 完成後
  在新 terminal 派一次；不行就 `judge.model` 內建預設退到 `opus`，agent 檔不釘
  model，由 dispatch 的 `model` 參數帶。
- plugin 的 `agents` 欄位在這個 Claude Code build 對 cache 載入的 plugin 是否
  生效：caveman 同機制在跑，視為可行，同一次試驗一起驗。
