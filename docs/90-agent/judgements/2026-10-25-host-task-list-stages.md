---
judged: 2026-10-25T12:09:12.556Z
model: fable
agent: fankeel-judge
task: "分析：前端修改為何沒自動跑渲染 reviewer"
session: ef3cf326-729b-4cb4-b000-fe4b94ba20b2
stage: survey
---

# 31 — Desktop 的勾選清單：原理、CLI 為何沒有、stage 能不能借它拆得更細

## Question

# 31 — Desktop 的勾選清單：原理、CLI 為何沒有、stage 能不能借它拆得更細

## 問題

使用者在 Claude Desktop（Code 分頁）截圖，圈起主 session 回覆下方的勾選清單
（「Check active task and judge model / Write the brief / Dispatch one judge /
Record the answer verbatim」，第一列轉圈、其餘虛線圓圈）。他問：

1. 這張清單的原理是什麼？他印象中舊版本「都會寫 TASK」，但在 Claude Code CLI
   裡看不到這張清單——為什麼 Desktop 有、CLI 沒有？
2. 如果 fankeel 的 stage 裡面改成透過這個 TASK（清單）來做，理論上是不是可以達成
   更細部的拆解流程？

## 先前的判決（請先讀，不要重做）

`docs/90-agent/judgements/2026-10-16-desktop-task-list.md` 已回答「這張清單是誰畫的」。
這次只補兩件它沒答的：CLI 那一側的對應物，以及 stage 能不能、該不該借它拆細。

## 已知的事實（主 session 提供；判官無法看到主 session 的工具表，請採信並核對 repo 這一側）

1. 這個主 session 在 Desktop Code 分頁裡，宿主系統提示給它
   `mcp__ccd_turn__update_plan`（`items` / `advance` / `done` / `start` / `scope`）與
   `mcp__ccd_turn__wrap_up`。提示原意：使用者看的是 app 釘在最新訊息下的清單；
   這張清單「取代 Claude Code 自己的任務清單工具（TaskCreate、TaskUpdate、TaskList、
   TaskGet），不要去找它們」；凡改檔或跑多個指令的請求，第一個工具呼叫就要一起送整份計畫。
2. 所以：清單是**宿主（Desktop app）**提供的 MCP 工具 + 宿主注入的提示要求模型去填；
   不是 fankeel 畫的，也不是 Claude Code 核心畫的。CLI 沒有 `ccd_turn` 這組工具，
   也沒有那段提示；CLI 有自己的任務清單工具（TodoWrite／Task* 系列），在 terminal
   以文字清單呈現，是否顯示、何時顯示由 CLI 與模型決定。主 session 這次的工具表裡
   沒有 TaskCreate／TodoWrite（被宿主換掉）。
3. 清單是**主 session（controller）**在填。fankeel 的站 agent `fankeel:fankeel-brain`
   工具只有 Read, Grep, Glob, Bash, Write, Agent（見 `agents/fankeel-brain.md`
   frontmatter），沒有 `update_plan`。`stage.agents` = survey,build,verify，這三站的
   工作在 brain 的乾淨 context 裡跑，controller 只轉路徑、問 gate——它看不到 brain
   內部的步驟，所以清單上只會有 controller 自己的粗步驟（派 brain、等、問 gate）。
4. fankeel 已有自己的細部進度機制：build 的 ledger（`scripts/ledger.js`）、
   右側 Pane（`hooks/pane.ts`）、band、監控站頁、handoff 檔（`lib/handoff.js`）。

## 請判官讀（交給 reader）

- `docs/90-agent/judgements/2026-10-16-desktop-task-list.md`
- `agents/fankeel-brain.md`（tools、它怎麼回報進度）
- `lib/stages.js`（controller 注入規則；有沒有提清單／update_plan／TodoWrite）
- `scripts/ledger.js`、`skills/fankeel-build/SKILL.md`（ledger 是什麼粒度）
- `hooks/pane.ts`、`hooks/pane-status.ts`（Pane 顯示什麼進度、從哪讀）
- `lib/handoff.js`、`scripts/await.js`（brain 跑時 controller 能看到什麼）
- `grep -rn "update_plan\|ccd_turn\|TodoWrite\|TaskCreate" lib hooks skills scripts agents`
- 如需確認 CLI 一側：`docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code-tools/index.d.ts` 裡有沒有 TodoWrite／Task 工具型別。

## 什麼算答案

1. 原理：清單是誰提供、誰填、為何 Desktop 有 CLI 無（含「舊版會寫 TASK」對應到什麼）。
2. 判斷：stage 透過這張宿主清單拆細，理論上可不可行；可行的話卡在哪
   （brain 沒這工具、清單只在 Desktop 存在、CLI／手機／監控站看不到、與 ledger／Pane 重複）。
3. 結論 pick：A 不做（細部進度留在 fankeel 自己的 ledger／Pane／監控站）；
   B controller 把 brain 的 handoff／ledger 進度同步進宿主清單（只在 Desktop 生效）；
   C 讓 brain 也拿到清單工具；或判官提出別的。附最小改法與代價。

## 回覆格式

六個欄位（pick / why / evidence / risk / instead / delegated），`pick:` 行必填，
接 `## Summary`，繁體中文，給使用者看，長度不限但先講結論。

## Answer

pick: A — 不做：細部進度留在 fankeel 自己的 ledger／Pane／監控站；宿主清單讓 controller 照舊填粗步驤即可。若要收斂，只在 `lib/stages.js:705-726` controlRules 加一句「清單以 route 站名或 plan `## Task N:` 標題填、每條 `commit.js:` 行 advance 一格」，不碰 brain。
why: 清單是 Desktop 宿主的 `mcp__ccd_turn__update_plan` + 宿主提示，由主 session 填；repo 內 lib/agents/skills 零命中（reader grep），只有 `hooks/wrap-up.js:4` 鉤 `wrap_up`、`scripts/escape-scan.js:20` 把 update_plan/TodoWrite 當掃描桶。
CLI 側對應物是 TodoWrite／TaskCreate 等（`index.d.ts:680-727` 有型別），Desktop 宿主宣告取代之，故「舊版會寫 TASK」= CLI 的 TodoWrite 文字清單。
brain 的 tools 是 `[Read, Grep, Glob, Bash, Write, Agent]`（`agents/fankeel-brain.md:4`），且「Return once」（`:232`）；controller 只在 handoff mtime 變或 commit 檔出現時醒來（`lib/handoff.js:689-691`、`scripts/await.js:175-184`），看不到 brain 內部步驄。
所以 controller 能同步進清單的最細粒度 = build 的每 task commit，與 Pane tasks 塊（`hooks/pane-status.ts:133` 讀 progress.md 的 `Task N: complete`）完全重複，且只有 Desktop 看得到。
would flip if: 宿主會把子 agent 的 `update_plan` 呼叫也畫在主訊息下，且使用者只用 Desktop——那 C 才有意義；或 handoff 改成 brain 跑時逐步 append 進度欄位——那 B 才有真粒度。
unread: nothing（brief 所列路徑全交 reader；未寫 context.md：brief 未給 session id，且此事實與主任務「渲染未自動跑」後續站無關）
delegated: docs/90-agent/judgements/2026-10-16-desktop-task-list.md (sonnet); agents/fankeel-brain.md (sonnet); lib/stages.js (sonnet); scripts/ledger.js + lib/ledger.js + skills/fankeel-build/SKILL.md (sonnet); hooks/pane.ts + hooks/pane-status.ts (sonnet); lib/handoff.js + scripts/await.js (sonnet); grep lib/hooks/skills/scripts/agents/docs + docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code-tools/index.d.ts (sonnet)
checklist: 1 先前判決 — answered；2 brain tools／回報 — answered；3 stages.js 注入規則 — answered；4 ledger 粒度 — answered；5 Pane 顯示／來源 — answered；6 handoff／await 可見性 — answered；7 grep 四個關鍵字 — answered；8 index.d.ts CLI 工具型別 — answered

## Summary

### 結論先講

1. **這張清單的原理**：是 Claude Desktop（Code 分頁）這個「宿主」提供的 MCP 工具 `mcp__ccd_turn__update_plan`，加上宿主注入的系統提示，要**主 session** 在第一個工具呼叫時把整份計畫送上去、之後逐格 advance。fankeel 沒畫它、Claude Code 核心也沒畫它。10-16 判決已確認這點（`F:/ymlab/fankeel/docs/90-agent/judgements/2026-10-16-desktop-task-list.md:62-63`），這次 reader 重跑 grep：`lib`、`agents`、`skills` 仍是零命中。
2. **CLI 為何沒有**：CLI 沒有 `ccd_turn` 這組工具，它有自己的 TodoWrite／TaskCreate／TaskUpdate／TaskList／TaskGet（型別在 `F:/ymlab/fankeel/docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code-tools/index.d.ts:680-727`，`TodoWrite` 的 `todos[].status: "pending" | "in_progress" | "completed"` 在 `:721-727`）。使用者記得的「舊版都會寫 TASK」就是 CLI 在 terminal 用 TodoWrite／Task* 畫的文字清單；Desktop 宿主的提示明說「取代 Claude Code 自己的任務清單工具，不要去找它們」，所以同一個模型到 Desktop 就改填宿主清單，到 CLI 則由 CLI 與模型自行決定要不要寫 TodoWrite——fankeel 既不要求也不禁止（`scripts/escape-scan.js:20` 只是把 TodoWrite／update_plan 當成 CJK 逃逸掃描的桶，不是規則）。
3. **stage 能不能借它拆細**：理論上只有 controller 能填，而 controller 看不到 brain 內部步驄，所以能填的最細粒度就是 build 站「每個 task commit 一格」——這和 Pane 的 tasks 塊、ledger 的 `done N of M` 完全重複，且只有 Desktop 看得到。**選 A 不做**。

### 各 reader 找到什麼

**先前判決**（`F:/ymlab/fankeel/docs/90-agent/judgements/2026-10-16-desktop-task-list.md`）：`:62` pick 是「宿主畫的……是主 session 把 plan 站的規則抄成五格填進宿主的清單」；`:65` 指出 build 站若填「Task 1/2/3 實作與審查」會與 Pane tasks 塊重複；`:66` 建議(1)不動 (2)若收斂就在 `stages.js` 加一行、但注入貼 2400 字上限。它完全沒提 CLI 側（TodoWrite／TaskCreate 未出現），這是本次補的。抽查 `:62-68` 與 reader 轉述一致。

**brain 定義**（`F:/ymlab/fankeel/agents/fankeel-brain.md`）：`:4` `tools: [Read, Grep, Glob, Bash, Write, Agent]`，沒有 update_plan、TodoWrite、TaskCreate。`:232` 「Return once, when the stage is done or blocked」——brain 不中途回報，只在結束時寫 handoff 檔並回傳路徑（`:28-29`、`:244-246`）。build 站的 ledger 由 brain 透過 `ledger.js` 記（`:31-33`、`:175-176`）。抽查 `:4`、`:232` 一致。

**controller 注入規則**（`F:/ymlab/fankeel/lib/stages.js:705-726`）：`:706` 「You are the controller for <stage>… Do not do its work or restate its report: dispatch, relay a path, ask.」；`:718` 派一個 brain；`:721` AWAIT_RULE 跑 `await.js` 後結束回合、never poll；`:723` 收到路徑就印、讀 handoff 最後的 json gate、AskUserQuestion。grep `update_plan|ccd_turn|TodoWrite|TaskCreate|checklist|task list` 零命中。抽查 `:705-726` 一致。這就是截圖上「Check active task / Write the brief / Dispatch one judge / Record the answer」四格的來源——controller 自己的粗步驄。

**ledger 粒度**（`F:/ymlab/fankeel/lib/ledger.js`、`F:/ymlab/fankeel/scripts/ledger.js`、`F:/ymlab/fankeel/skills/fankeel-build/SKILL.md`）：ledger 是 `.fankeel/build/<plan>/progress.md` 純文字（`lib/ledger.js:51-53`），行型是 `Task N: complete [range] note`／`Fix:`／`Ruling:`／`Plan:`（`scripts/ledger.js:341`）。SKILL.md `:522` 每個 plan task 審完寫一條 `complete`，`:519` 每輪 fix 寫一條 `Fix:`；寫的是 build 站本身（brain），不是 implementer。讀者：build 自己（resume、`ready`）、verify（`skills/fankeel-verify/SKILL.md:171-174`）、報告的 `done:` 行（`:726-734`）。抽查 `SKILL.md:518-523` 一致。

**Pane**（`F:/ymlab/fankeel/hooks/pane.ts`、`F:/ymlab/fankeel/hooks/pane-status.ts`）：Pane 讀 `.fankeel/sessions/<id>.json`（pane.ts:96）、`progress.md`（pane.ts:153-155）、plan 檔（pane.ts:165）、`live.json`（:183）、Claude Code 自己的 subagents 目錄（:250-321）；tasks 塊用 `/^Task (\d+): complete\b/` 判完成（pane-status.ts:133）、`## Task N:` 取名（:149）；路線點 `route N/M`（:186）。沒有任何 update_plan／TodoWrite／ccd_turn 引用，「Claude Desktop」只在 Svg 繪製分支（pane.ts:729-731）出現。抽查 `pane-status.ts:124-135` 一致。**即：fankeel 已有一個跨 surface（CLI／Desktop／監控站）的細部進度面，粒度是 route 站 → plan task。**

**handoff／await**（`F:/ymlab/fankeel/lib/handoff.js`、`F:/ymlab/fankeel/scripts/await.js`）：handoff 檔沒有 status／progress／steps 欄位，結構化部分只有 gate 的 `questions[]` 與 `next`（handoff.js:386-418）；`awaitState` 只看 commit 檔有無新增、handoff 檔 mtime 是否變（`:689-691`），內容不讀。`await.js:175-184` `lineFor` 只印一行：`handoff <path>`／`commit <file>`／`lost`／`timeout`。build 的 commit 是唯一的中途事件（`:182`）。抽查 `handoff.js:686-698`、`await.js:174-185` 一致。**即：controller 對 brain 的可見性 = 「還在跑／commit 了／寫完 handoff 了／失聯了」四種狀態，沒有步驄層級。**

**grep 與 CLI 型別**：lib／agents／skills 零命中；`F:/ymlab/fankeel/hooks/wrap-up.js:4` 是 `mcp__ccd_turn__wrap_up` 的 PreToolUse 鉤子（拒絕帶 `ask`／`actions` 的呼叫、導回 AskUserQuestion，見 `:4-14`）；`F:/ymlab/fankeel/scripts/escape-scan.js:20-27` 把 `update_plan`、`wrap_up`、`TodoWrite` 列為掃描桶並按 `mcp__<server>__<tool>` 最後一段比對。所以 repo **知道**宿主有 `ccd_turn` 這組工具，但只鉤 `wrap_up`，沒鉤也沒用 `update_plan`。index.d.ts 確認 CLI 側 TodoWrite／Task* 型別存在（`:680-727` 輸入、`:5139-5190` 輸出），無 `update_plan`。抽查 `wrap-up.js:1-30`、`escape-scan.js:14-27`、`index.d.ts:719-727` 一致。

### evidence（對應 brief 要的欄位）

- 清單是宿主的、主 session 填的：10-16 判決 `:62-63`；repo lib/agents/skills 零命中 `update_plan|ccd_turn`。
- brain 沒工具、不中途回報：`agents/fankeel-brain.md:4`、`:232`。
- controller 看不到步驄：`lib/handoff.js:689-691`、`scripts/await.js:175-184`。
- 已有細部進度面：`hooks/pane-status.ts:133`、`:149`、`:186`；`lib/ledger.js:35`、`:51-53`；`skills/fankeel-build/SKILL.md:522`。
- CLI 對應物：`index.d.ts:680-727`。
- repo 已鉤宿主工具的先例：`hooks/wrap-up.js:4`。

### risk（三個選項各自卡在哪）

- **A 不做**：使用者在 Desktop 看到的清單仍是 controller 的四格粗步驄，和 Pane 的路線點／tasks 塊是兩套畫面。這是現狀，沒有新風險；10-16 判決也選了它。
- **B controller 同步 handoff／ledger 進度進宿主清單**：能同步的只有 build 站的 commit 事件（每 task 一格）；survey／plan／design／verify 站 brain 跑完才回來，清單整段只能是「等 brain」一格——拆不細。Desktop 以外（CLI、手機、監控站）看不到。與 Pane tasks 塊 100% 重複。還吃 `stages.js:105-107` 的 2400 字注入上限（10-16 判決 `:66`）。
- **C 讓 brain 也拿到清單工具**：brain 的 `tools:` 是白名單（`agents/fankeel-brain.md:4`），得加 `mcp__ccd_turn__update_plan`；但 (a) 這工具只在 Desktop 存在，CLI 下 agent 定義會帶一個不存在的工具名；(b) 宿主提示說清單釘在**主 session**最新訊息下，子 agent 的呼叫會不會畫出來、畫在哪，無法在 repo 側驗證；(c) brain 的設計是「乾淨 context、Return once」，塞 UI 同步呼叫進去會讓它每步多一次工具往返、吃 context。代價最高、收益最不確定。

### instead（若使用者還是想「看得更細」）

細部進度本來就該走 fankeel 自己的面：ledger 行（`Task N: complete`／`Fix:`／`Ruling:`）→ Pane tasks 塊／監控站，這三處 CLI、Desktop、手機都看得到。若覺得 task 以下還要更細（例如「派 implementer → review → commit」），正確的落點是在 ledger 多一種行型、Pane 多畫一列，不是宿主清單。

最小可做的「收斂」是 10-16 判決 `:66` 的 (2)：在 `F:/ymlab/fankeel/lib/stages.js:705-726` controlRules 加一句，例如「宿主清單（update_plan）用 route 站名填 items，收到 `commit.js:` 行時 advance」——約 100 字，要從現有 2400 字裡換；只影響 Desktop 的清單文字，不動 brain、不動 ledger、不動 Pane。另有一條未驗證的路：`hooks/wrap-up.js` 已證明 fankeel 能對 `mcp__ccd_turn__*` 掛 PreToolUse，理論上可對 `update_plan` 掛鉤改寫 items；但 PreToolUse 能否改寫 input、宿主會不會接受，這次沒查，不列為建議。

### 沒查到的

- 主 session 的工具表（含 `update_plan` 的參數與宿主提示原文）照 brief 採信，未在 repo 側驗證——repo 只有 `wrap_up` 的鉤子與 escape-scan 的工具名，沒有 `update_plan` 的 schema。
- 子 agent 呼叫 `update_plan` 時宿主會不會畫、畫在哪：repo 沒有證據。
- `hooks/pane-band.ts`、`hooks/pane-gate.ts`：reader 只透過 pane.ts 的 import 看到，未開。
- 未寫 context.md：brief 未提供 session id，且此判決與主任務「前端修改為何沒自動跑渲染」的後續站無交集。
