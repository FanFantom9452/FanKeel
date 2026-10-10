---
judged: 2026-10-10T11:32:50.031Z
model: fable
agent: fankeel-judge
task: ""
session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
stage: init
---

# fankeel 這套工作流現在哪些設計還能精進、哪些環節漏掉了？

## Question

fankeel 這套工作流現在哪些設計還能精進、哪些環節漏掉了？

## 問題

使用者的原話：「請你再次深度幫我盤點當前這個工作流 那些設計可以再精進 或是說 那些部分可能有漏掉」。

「工作流」指 fankeel 這個 plugin 本身：一個任務從 `/fankeel` 起，經 survey、design、plan、build、verify、audit、land 這條 route 走完的整套機制，包含 registry、hooks、stage 規則注入、gate、站 agent（`stage.agents`）、子代理派發、TODO 盤點（patrol）、文件樹與 docs-check/docs-audit、監控站。

「再次」表示這類盤點以前做過。已經記在 TODO、judgements 或 reports 裡的項目不算新發現；重提一筆舊項目只有在它的前提已經變了的時候才算數，並且要說出哪裡變了。

## 這不是選擇題

沒有預設選項。要的是一份排過序的清單，分兩類：

- **可精進**：現有設計能運作，但有具體代價（多花的 token、多出的一輪、會靜默失敗的地方、規則彼此打架、兩處各寫一份而會漂移）。
- **漏掉**：流程裡該有而沒有的環節，或某個失敗模式沒有任何 script、hook、規則接得住。

## 背景

- 規則的落點分四層，依序嘗試：script 能檢查或拒絕的、anchor（模板欄位或 stage 進場那一行）、skill、`skills/registry.json`。`docs/02-architecture/pipeline.md` 有表。
- 目前 profile：`stage.agents = survey`（只有 survey 交給站 agent）、`guard = deny`、`dispatch.floor = sonnet`、`judge.model = fable`、`worktree = false`、`gate.station = off`、`land.integration = merge`、`land.push = false`。
- TODO 現況：Ready 2 筆（brief-3 子代理 brief 改走 spawn、station-24 站頁看得到對話全文）、Needs a decision 0、Blocked 14 筆、Watch 11 筆，其中「整套再紅一次」有兩筆。
- 最近的提交 `fa81b4bb` 記下測試套件第三次變紅，而且是在第三個不同的測試上。
- 已安裝的 superpowers 有六個 skill 與 fankeel 的 design、plan、build、verify、land 重疊（`orient.js` 的 `overlap:` 行）。

## 要讀的路徑

都相對於 `F:\ymlab\fankeel`：

- `skills/fankeel/SKILL.md`，以及 `skills/fankeel-survey`、`fankeel-design`、`fankeel-plan`、`fankeel-build`、`fankeel-verify`、`fankeel-audit`、`fankeel-land`、`fankeel-init`、`fankeel-ask` 各自的 `SKILL.md`
- `lib/stages.js`（`ALWAYS`、每站規則、`INIT`、output shape）、`lib/render.js`、`lib/handoff.js`、`lib/plantasks.js`
- `hooks/`（inject、touch、gate、resume、brief、title、leave）與 `.claude-plugin/` 的 manifest
- `scripts/task.js`、`ledger.js`、`suite.js`、`commit.js`、`todo.js`、`todo-check.js`、`docs-check.js`、`docs-audit.js`、`judge.js`
- `agents/` 底下的 agent 定義
- `docs/02-architecture/pipeline.md`、`docs/90-agent/reference/`（registry、subagents、collisions、documents、station、statusline）
- `docs/90-agent/todo/`（已知的待辦，用來排除重複）、`docs/90-agent/judgements/`、`docs/90-agent/reports/`（最近幾份）、`docs/03-decisions/`

## 什麼才算答案

- 每一筆都指到 `path:line`，並說出具體的失敗情境或代價：什麼輸入或狀態會導致什麼結果。只有「可以更好」而說不出代價的不算。
- 每一筆都對過 `docs/90-agent/todo/`：已有對應項目的，寫出它的 id 並說明這筆多了什麼；沒有多的就不要列。
- 每一筆附一個最小的修法，並說它該落在四層裡的哪一層。
- 沒讀到的範圍要明說，不要寫成全面清查。
- 最多十二筆，依「不修的代價」由高到低排。寧可少而確實。

## 回傳的形狀

用繁體中文，程式概念維持原文（`gate`、`stage`、`claims` 不翻譯）。

```
## 結論
<一到兩句：最該先動的是哪一筆，為什麼>

## 可精進
| # | 位置 path:line | 現況的代價 | 最小修法 | 落點層 | 已有 TODO |

## 漏掉
| # | 該在哪裡 | 沒有它會發生什麼 | 最小修法 | 落點層 | 已有 TODO |

## 沒讀到
<範圍，一行一項>
```

## Answer

## 結論
最該先動的是 #1：`suite.js` 的 record 只留最後一跑，而 10-09 起 `task.js land` 對紅燈是 refusal 而非句子——偶發紅（10-10 已第三個測試）每次都逼全套重跑、紅測名字靠人手抄進 TODO。其次是 #7：`bounded` 是預設 class，build 的分母只在對話裡，壓縮即失。

## 可精進
| # | 位置 path:line | 現況的代價 | 最小修法 | 落點層 | 已有 TODO |
|---|---|---|---|---|---|
| 1 | `lib/suite.js:89-95`（`record` 覆寫 suite.json）、`:118-120`（`rec.ok !== true` → `land stops`）、`scripts/task.js:1479-1480` | 偶發紅一次 = 重跑 ~3900 測試一次；重跑綠後第一跑的 `failed` 名單被覆寫，證據只剩人手寫進 TODO（fa81b4bb 正是這樣做）；merge 後那跑用 `npm test`（`skills/fankeel-land/SKILL.md:261`）根本不記錄 | `record` 改 append 成 `runs[]`；`task.js land` 印 `green on run N; earlier red: <names>`，land 模板 `suite:` 行帶上 | script | test-1、test-4（watch，只記證據）、tests-5（done，但只留單跑）。前提已變：10-09 起紅燈是 refusal，不再是句子；本筆多的是跨次歷史與 land 時浮現 |
| 2 | `lib/suite.js:131`（非 `.md` 一律算 code）vs `skills/fankeel-land/SKILL.md:39`（步驟 1 跑 suite）→ `:120-137`（2a `version.js` 改 package.json、plugin.json）→ `:236-240`（步驟 6 `task.js land`） | 每次發版 land 必被 `blocker` 拒：「package.json changed since — run suite.js again」，全套再跑一次；skill 沒寫任何一句提醒 | skill 把 2a 移到步驟 1 之前，或 `version.js` 末行印 `run suite.js again` | anchor（skill 順序）+ script（version.js 提示） | 無（land-1 是 `--tree`） |
| 3 | `docs/02-architecture/pipeline.md:127,131,134-140` 引的 build 規則 vs `lib/stages.js:304`（多了 `task.js intends <f>`）、`:308`（`At close: suite, then docs-check`）、`:316`（模板 `docs-check:` 行） | 這頁 `last_verified: 2026-10-09` 卻示範舊規則；docs-check 看不到（無 path:line），讀者從這頁學到的注入是假的 | `tests/` 加一條：`rulesFor('build')` + `templateFor('build')` 的每一行都出現在該頁的 fence 內 | script | docs-1 只管 mermaid 流程圖且 blocked；本筆是引文區塊 |
| 4 | `lib/stages.js:308`（build close「suite」未指名腳本）、`:325`（verify「Run the tests」）、`:398`（只有 land 用 `{{SUITE}}`）；`lib/suite.js:125-134` 已能判「record 之後無 code 變更」 | 一個任務全套跑三到四次，只有 land 那跑有紀錄；verify 若用 `suite.js` 記了，land 步驟 1 本可免跑 | verify 規則改寫成 `node {{SUITE}} --session <id>`；land 規則改「record 過期（`task.js land` 說）才重跑」 | anchor | 無 |
| 5 | `scripts/task.js:1471-1495` `cmdLand` 不看有無分支／worktree 就寫 `integration: merge`；`skills/fankeel-land/SKILL.md:248-251` 步驟 7 Merge 無「已在 base 上」分支；profile `worktree=false, land.integration=merge` | 本 repo 每個任務都直接在 main 提交，land 卻被注入「merge, no push — do that」：多花一輪說「沒東西可 merge」，record 餵給 `profile suggest`（`task.js:1470` 註解）的是從未發生的 merge | `cmdLand` 偵測「無 worktree 且 HEAD 無 `fk/` 分支」→ 記 `integration: direct`（新 verb）並印一行；skill 步驟 7 加一句 | script | 無（profile-1 是 suggest 範圍） |
| 6 | `skills/fankeel-build/SKILL.md:20-31`、`fankeel-verify:20-31`、`fankeel-land:18-29`、`fankeel-ask:20-31`（同一段「One path, never a search」九份） | 改一次解析規則（例如 `package.json names fankeel` 例外）要改九處；`skills-check.js` 只查腳本路徑，不比對這段，漂移無人見 | `skills-check.js` 斷言九份逐字相同，或收進 fankeel skill 一處 | script | 無（cuts-1 是程式 helper） |

## 漏掉
| # | 該在哪裡 | 沒有它會發生什麼 | 最小修法 | 落點層 | 已有 TODO |
|---|---|---|---|---|---|
| 7 | `lib/stages.js:593-594`：`DESIGN_TO_BUILD` 只在 build 受控、design 不受控時注入；現 profile 只控 survey | `bounded`（預設 class）的 build 分母是 design 的 file table，只在對話裡；`skills/fankeel-build/SKILL.md:186-188` 說「`next` 那 120 字是它的 ledger」；`hooks/compact.ts:30-41` 壓縮指令只保「plan file path」，bounded 沒有 → 450k 壓縮後 `done: n of m` 無 m | 去掉 `controlling('build', v)` 條件：design→build 路線一律寫 `.fankeel/build/task-<started>/design.md`；`instructionsFor` 多一行保該路徑 | script（條件）+ anchor | compact-1/2、design-2 都不涵蓋 |
| 8 | `lib/render.js:667-678` `pushContext` 只進 brief；主會話注入塊與 `hooks/compact.ts:30-41` 都不提 `context.md` | `skills/fankeel-survey/SKILL.md:306-310` 要 survey 把事實寫進 `context.md`「給之後每個 brief」；但 design/plan/build 在本 profile 下都在主會話跑，壓縮後自己重讀自己記的事實 | 主塊加一行 `context: <path> (<n> facts)`（只給路徑不貼內容），或 `instructionsFor` 多一行 | anchor | 無 |
| 9 | `hooks/gate.js:206-214`：`readGate`（≥3 選項、含 pause）只在 `controlled` 時跑；未受控只 `gateOpen` 打時間戳 | 現 profile 七站六站未受控，兩選項或沒 pause 的 gate 直接出去，`ALWAYS[0]` 是唯一防線；gate-4 記到 brain 三次兩選項，主會話沒人看 | `!controlled` 且 `questions[0].header` 等於 stage 名時，檢查選項數 ≥3，違反只出 `systemMessage` 不 deny | script | gate-4（done）只管 handoff 的 gate；本筆是主會話那一半。若 registry `gates` 資料顯示主會話從未違反，可降級 |
| 10 | `hooks/guard.js:125-142` 受控站拒寫只看 `WRITE_TOOLS`；`:77-101` 的 shell 分支只查 read-only agent 與 commit | 受控站主控用 `sed -i`／`node -e`／`git mv` 寫檔不會被擋，`claimWrites` 隨後把它記成任務的 claim，「主控不動手」的保證有洞 | shell 分支加 `!payload.agent_id && controlled && writesFiles(command)` → 同一句 deny | script | 2026-09-10-shell-whitelist 判的是子代理；stage-agents-3 是反方向。現只控 survey，頻率低 |

## 沒讀到
- `skills/fankeel-plan`、`fankeel-audit`、`fankeel-init` 的 SKILL.md 全未開；`fankeel-survey` 只讀 267-383、`fankeel-design` 只讀 222-251
- `lib/handoff.js` 只讀 `skipReason`；`lib/render.js` 只讀 655-694；`lib/plantasks.js`、`scripts/ledger.js`、`todo-check.js`、`docs-check.js`、`docs-audit.js`（只 grep 到 audit.json）未開
- `agents/` 只看 `fankeel-brain.md` frontmatter；`docs/90-agent/reference/` 只 grep `subagents.md` 的 `DESIGN_TO_BUILD`，registry／collisions／documents／station／statusline／todo 未開
- judgements 只讀 2026-09-10-shell-whitelist 前 40 行；reports 只 grep compact-probe；`docs/03-decisions/` 一篇未開
- TODO 只讀 tests-5、test-1、gate-4、verify-1、design-2、docs-1 正文，其餘 180 筆只對過標題；`hooks/dispatch-gate.js`、`carry.js`、`gate-write.js`、`mod.ts` 未開
