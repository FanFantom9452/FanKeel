---
status: current
last_verified: 2026-09-10
---

# TODO 十條一次清 — 設計

**Goal:** 清掉 `TODO.md` 的 `## Ready` 一條與 `## Needs a decision` 九條。九條的決定
已在 2026-09-10 的 design 閘門逐條問過使用者，每題都取推薦選項；這份檔案記的是
那九個答案各自變成什麼改動。

**Architecture:** 十條彼此幾乎不相干，共用的只有 `lib/stages.js` 與
`skills/fankeel/SKILL.md` 這兩個檔案，所以節 4 與節 7 併成一個 task，節 3 排在它們
之後。其餘每節縮到它最小的那個改動：一個 agent 檔、一支測試、一個 role、四個
case 目錄、七個 provenance 檔各補四行、兩段文件改寫。design class（節 5）不做，
只把 entry 改到正確的 heading 底下。

**基準:** `.fankeel/build/2026-09-10-todo-ten/baseline-test.txt` 記 HEAD 與
`ℹ pass / fail`；`node scripts/docs-check.js` 與 `node scripts/todo-check.js`
在動工前各跑一次，exit code 記在同一個目錄。

## 1. `fankeel-reviewer` agent

- 新增 `agents/fankeel-reviewer.md`：frontmatter 照 `agents/fankeel-reader.md` 的形
  （`name`、`description`、`tools: [Read, Grep, Glob, Bash]`、`model: sonnet`、
  `status`、`last_verified`、`source_of_truth`）；正文是兩個審者共用的契約——只讀，
  git 只用 `show`/`diff`/`log`，只回它推翻的東西並說為什麼，每行回傳都留在派它的
  context 裡被重讀到 session 結束。
- `.claude-plugin/plugin.json` 的 `agents` 加第三個路徑；`tests/agents.test.js` 的
  `NAMES` 加 `fankeel-reviewer`，兩個測試的名字從 both 改成寫數字以外的說法。
- `skills/fankeel-build/SKILL.md` 步驟 5 的 reviewer 與 `skills/fankeel-verify/SKILL.md`
  的 adversary 各加一句：派 `subagent_type: fankeel-reviewer`，model 由 agent 檔釘死，
  dispatch 不再手寫。template 本身不動，它帶的是每次不同的 range、brief 與 rows。
- `docs/subagents.md:28` 的「The two agents」改成三個，補一段說 reviewer 與 reader 的
  差別是問題的形狀而不是工具清單，並寫明這是 `dispatch.floor` 唯一被 harness 執行
  的釘點：SubagentStart 的 payload 只有 `agent_id` 與 `agent_type`（`docs/subagents.md:340`），
  hook 看不到 model。
- `lib/stages.js` 在這一節不動：`:278` 與 `:300` 的 reviewer 措辭留給節 4 一起改，
  兩節不搶同一個檔案。

## 2. exact-set 推廣到 skills 與 hooks

- 新增 `tests/inventory.test.js`：`skills/` 底下的目錄名 deep-equal 一份硬編碼名單；
  名單裡每個目錄都有 `SKILL.md`；`lib/stages.js` 的每個 stage 都有 `skills/fankeel-<stage>/`；
  `hooks/` 底下的 `*.js` deep-equal `plugin.json` `hooks` 區塊引用的檔名集合。
- 名單寫在測試檔裡，不從目錄產生：多一個 `.md` 或多一支 hook 檔就紅，紅的訊息說出
  多出來的那個名字。
- `tests/agents.test.js` 保留，不搬進來：agents 的三個測試已經對，搬動只是換位置。

## 3. `skills/registry.json`

- `lib/stages.js` 的每個 stage 物件加一個 `budget` 數字，是該 stage 注入 block 的位元
  數上限；數字取節 4 與節 7 落地後量到的大小往上取整到百位，`build` 取
  `tests/render.test.js` 現有那個 2400 上限。
- 新增 `scripts/stage-registry.js`，`--print` 印到 stdout、無旗標寫
  `skills/registry.json`；每 stage 一筆 `{ name, entry_condition, stop_condition,
  prompt_bytes, prompt_byte_budget }`：`entry_condition` 取該 stage 規則裡
  `Read the fankeel-<stage> skill on entry:` 那句的後半，`stop_condition` 取
  `skills/fankeel-<stage>/SKILL.md` 的 `**Done when**` 那句，`prompt_bytes` 是
  `lib/render.js` 對該 stage 的實際輸出長度，`prompt_byte_budget` 是 `budget`。
- 檔案是 generated：frontmatter 的等價物是頂層 `"generated_by": "scripts/stage-registry.js"`，
  `tests/stage-registry.test.js` 重新產生一次並 deep-equal 已 commit 的檔案，再斷言
  每 stage `prompt_bytes <= prompt_byte_budget`。任何一個 stage 的規則長了而沒有調
  `budget`，或改了 `Done when` 沒有重新產生，都紅。
- `docs/pipeline.md` 的三層表加一列說這個檔案是哪一層的東西；`README.md` 的 script
  表加一列。`skills-check.js` 的 `REQUIRED_CORE` 不加：它只在 README 出現，照
  `eval.js` 的前例當 unnamed-script。
- `TODO.md` `## Waiting` 的兩條——`entry_condition / stop_condition 進 registry` 與
  `每 stage 一欄 prompt_byte_budget`——由這一節做掉，直接刪；`條件載入到「節」的粒度`
  的 lifts when 已發生，改到 `## Needs a decision`，拿掉 stamp。

## 4. 校準規則、build 的停止條件，與 reachability test

- `lib/stages.js:301` build 第三條改寫成「撤掉會不會變差」的形：停止只在 git 無法回
  復一個錯的 ruling 的地方——irreversible、security-sensitive、workspace 之外的副作用、
  每條路都是猜；豁免是 git 能 revert 的一切。四個條件不變，改的是它們的判準與豁免。
- `skills/fankeel/SKILL.md` 新增一節 `## Calibration`，放統管所有規則的三條通則：每個
  stage 都設閘門會變跑步機，閘門只在 stage 結尾；兩條規則衝突時 name both，說哪一條
  贏與為什麼；constraint 贏、shape 留（節 7 的表放在同一節底下）。
- `tests/stages.test.js` 新增 reachability test：對 `ALWAYS` 與每個 stage 的每條規則，
  用 `lib/render.js` 在該 stage 的某個 context 下 render，斷言那句出現；再把那條從
  複本裡拿掉 render 一次，斷言少的正好是它、其餘一句不少。它證明的是每條規則都到得
  了注入 block——一條被 `when` 擋住而 profile 沒開的規則會在這裡紅——不是每條規則
  都值得存在；後者是 eval 的事，節 8。
- `lib/stages.js:278` 與 `:300` 的 reviewer 措辭改成 `fankeel-reviewer`，字數與今天
  相同或更少。

## 5. design class 只改 heading

- `TODO.md` 的 design class entry 從 `## Needs a decision` 移到 `## Waiting`，內容改成
  一句：mockup 步驟已在 0.58.0 落地，其餘（軸鎖定檔、路由表、三個 skill 增修、三個設計
  問題）是另一個 architectural 任務；`lifts when: 下一個前端任務出現，執行
  docs/plans/2026-09-09-design-class-prompt.md`，stamp `09-10`。
- 連結仍指 `docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務`，plan 的路徑用反引號寫而不做連結：
  `todo-check.js` 拒絕落在 plan role 的連結。
- `docs/plans/2026-09-09-design-class-prompt.md` 不動、不封存：它還沒執行。

## 6. provenance 六條通道

- `docs/reports/evidence/` 底下七個 `*-provenance.txt` 各補四行：`cwd:`、`settings:`、
  `always-on flag:`、`budget:`；值從該目錄的 `ab*.sh`／`probe.sh` 讀出來寫實際狀況，
  未控的標 `uncontrolled`（例如 `cwd: the checkout, uncontrolled`；`always-on flag: n/a,
  fankeel has none`）。已經寫了的通道不重複。
- 腳本一行不改：這些報告的數字是舊腳本跑的，改腳本會讓紀錄對不上它描述的那次執行。
- `docs/sources.md` 若有帳本列引用這些檔案，不動；`scripts/eval.js` 不動。

## 7. ALWAYS 四條的 pre-send check 形

- `lib/stages.js` 的 `ALWAYS[2]`（Say what you actually did…）句尾加一句：where a rule
  and the shape conflict, the constraint wins and the shape stays。只這一句，不加第五條：
  `tests/render.test.js:346` 的 `WORDS[ALWAYS.length]` 釘著條數。
- 位元數由節 4 的改寫吐回來：build 的 block 落地後不得比今天長，節 3 的 `budget`
  測試守著這件事。
- `skills/fankeel/SKILL.md` 的 `## Calibration` 底下放一張四列表，一列一條 ALWAYS：
  規則、成因（哪一次 session 的什麼失敗）、Bad／Good 一句範例、豁免。成因取自
  `lib/stages.js` 已有的註解與 `docs/decisions/` 的紀錄，不新編。
- 其餘 59 條不動；TODO entry 刪除，因為「先改哪幾條」已經答了。

## 8. 四個 eval case

- `evals/` 新增四個目錄，照 `evals/route-typo/` 的形（`case.yaml`、`prompt.md`、
  `graders/*.md`），一條例外一個：`stage-skip-said`（typo fix 說出跳過哪些 stage）、
  `pipe-not-agent`（一個 `npm test` 結果的問題用 pipe 而不派 Agent）、`one-call-not-agent`
  （讀一個點名的檔案不派 Agent）、`subagent-no-entry`（派了 reader 之後 `task.js start`
  只出現一次）。
- grader 只用 `tool_used` 與 regex 兩種，`llm` 型今天回 skipped 所以不用；每個 case
  的 `graders/` 至少一個 `max: 0` 的反向斷言，讓分數有路可以掉。
- baseline／candidate 成對跑與「分數不該動」判準不做：`route-typo` 自己的分數還在跳
  （`## Waiting` 已有那條），機制做了也量不出東西。
- verify 時每個 case 用 `node scripts/eval.js` 跑一次，分數與 model 記進
  `.fankeel/build/2026-09-10-todo-ten/`；一次 headless session 一個 case，四次。

## 9. role `fixture`

- `lib/docs.js:33` 的 `ROLES` 加 `fixture`；`.fankeel/docs.json` 的 `evals` bucket 改成
  `fixture`。
- `scripts/docs-check.js` 不需要新分支：`:201` 只對 `archive`／`report` 早退，`:279` 與
  `:307` 只對 `reference` 做符號與引文檢查，所以 `fixture` 自然剩下連結與 `past-end`
  兩項——這正是要的。`scripts/docs-audit.js:375` 的 `current()` 要求 `reference`，
  `fixture` 自然不算 drift。若 `lib/docs.js` 的推斷表把 `evals` 猜成別的 role，改成
  `fixture`。
- `docs/documents.md:14-20` 的角色表加一列：`fixture` — 測試的輸入，本身不描述系統，
  只驗連結。
- `tests/docs.test.js` 新測：一個 `fixture` bucket 裡沒有 frontmatter 的 `.md` 不產生
  undeclared 或 contract 類 finding，而它裡面一條死連結照報。

## 10. collisions.md 的「Two rules」

- `docs/collisions.md:139-164` 改寫：`blockers()`（`lib/guard.js:123`）裡防鎖死的是一條
  規則的兩個檢查——`isLive`（`:130`）與 `claimedFirst`（`:131`）；「task 不擋自己」是另一個
  機制，`hooks/guard.js:45` 在 `blockers()` 跑之前就把 `others` 過濾成別的 session。
  subagent 繼承 parent 的 session id 那段保留，改掛在第二個機制底下。
- 標題句「Two rules keep it from becoming a lockout」改成說一條規則兩個檢查，數字對得上
  程式碼。

## 11. TODO.md 與索引

- `TODO.md` `## Ready` 一條與 `## Needs a decision` 八條刪除（節 5 那條移到
  `## Waiting`）；`## Waiting` 依節 3 刪兩條、升一條，並把 `16 行 pattern skill` 那條
  升到 `## Needs a decision`——它的 lifts when 是「自檢測試改寫落地」，節 4 落地了。
- `docs/README.md` 索引加這份 design 與它的 plan。
- `node scripts/todo-check.js` 與 `node scripts/docs-check.js` 在 land 前都 exit 0。

## What proves it done

| 主張 | 證據 |
|---|---|
| 第三個 agent 存在且不能寫 | `tests/agents.test.js` 名單加一後綠；加之前對新檔紅 |
| 多一個 skill 目錄或 hook 檔會紅 | `tests/inventory.test.js` 新測，用暫時多建的目錄證明它紅過 |
| registry.json 與程式碼一致、每 stage 在預算內 | `tests/stage-registry.test.js` 新測；改一條規則不重產生時紅 |
| 每條規則都到得了注入 block | `tests/stages.test.js` reachability 新測；把一條規則藏到未開的 `when` 後面時紅 |
| build 的 block 沒有變長 | `prompt_bytes` 對 `build` 不大於基準量到的數字 |
| 四個 eval case 各有一個可掉的分數 | 每個 case 跑一次，分數與 `max: 0` grader 的判定記在 build 目錄 |
| `fixture` 只驗連結 | `tests/docs.test.js` 新測，今天紅（role 不存在） |
| collisions.md 的數字對得上 `blockers()` | 改寫後三個 `path:line` 都由 `docs-check.js` 驗過，exit 0 |
| TODO 分類正確 | `node scripts/todo-check.js` exit 0 |
| 沒有弄壞既有的東西 | `npm test` 仍 `ℹ fail 0`，通過數不低於基準 |

## Against the map

`.fankeel/map.md` 列為 current 的頁面裡，這份設計動到 `docs/subagents.md`（三個 agent）、
`docs/collisions.md`（節 10）、`docs/documents.md`（新 role）、`docs/pipeline.md`（三層表），
四頁都在對應節裡改到與程式碼一致。`docs/plans/2026-09-09-design-class-prompt.md`
是 design-intent，節 5 明說不執行它，沒有把它當成已存在的東西。

## Unverified

Claude Code 用 `Agent` 工具派 `subagent_type: fankeel-reviewer` 時，agent 檔的
`model: sonnet` 是否在 dispatch 端沒傳 `model` 的情況下也生效——`docs/subagents.md`
只對 reader 與 judge 量過。verify 用 `modelUsage` 對一次 reviewer dispatch 量。
