---
judged: 2026-10-20T18:21:27.974Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: b7a7d8d4-46d0-4e7f-b839-06dbca750114
stage: land
---

# Brief: Pane 能不能像 Claude Code 官方 UI 一樣列出 background task

## Question

# Brief: Pane 能不能像 Claude Code 官方 UI 一樣列出 background task

## 問題

使用者原話：「background task 有辦法顯示嗎? 為甚麼 CLAUDE CODE 官方可以顯示? 我們 PANE 能顯示嗎?」

背景：這個 session 剛用 `run_in_background` 跑全套 suite（shell task），Claude Code 自己的 UI（終端的背景任務列、Desktop 的 tasks pane）看得到它與它的狀態；fankeel 的 Pane（`hooks/pane.ts` 的 `ui.render`，子代理樹在 `hooks/pane-agents.ts`）只列子代理，看不到 shell／monitor／workflow。

前情（必讀）：
- 判決 `docs/90-agent/judgements/2026-10-16-pane-background-tasks.md` 選 B（只做網頁服務按鈕），理由是引擎給 mod 的背景清單只在 `classic.Stop`／`classic.SubagentStop` 的 `background_tasks` 快照，沒有可每 tick 問的 API；`$.agent.list()` 只有 subagent。
- 依那份判決開的 `docs/90-agent/todo/pane-12.md` 在 10-17 以 `disposition: abandoned` 結案（sha deffe630），請讀它的完成紀錄看為什麼放棄。
- 型別檔 `.claude-plugin/types/claude-code/index.d.ts` 是 10-14 的；目前安裝的 Claude Code 是 2.1.304。若機器上有更新的型別（例如 Claude Code 安裝目錄或 plugin-authoring 技能附帶的 types），請比對有沒有新的 tasks 事件或 API。

要回答：

1. **官方為什麼看得到**：官方 UI 是 harness 本體，直接持有 task 管理器的內部狀態；mod 只拿得到引擎開放的部分。請以型別與文件確認現在 mod 引擎開放了什麼（事件、`$` API、ui.render 的輸入），有沒有比 10-16 判決時更多。
2. **我們能顯示到什麼程度**：用現有來源（`tool.call` 包裝取得 `backgroundTaskId`／`taskId`、`classic.Stop` 快照、`%TEMP%/claude/<slug>/<session>/tasks/<id>.output` 的結尾標記 `[exited with code N]`／`[killed]`、`<configDir>/projects/<slug>/<session>/workflows/`）能否組出一份「每 tick 都對」的清單？哪一類（shell、monitor、workflow、背景 subagent）能準、哪一類只能猜？
3. **pane-12 為什麼放棄**，那個原因是否也擋住這次的全清單？
4. **建議**：做（列在哪、怎麼裁）、只做 shell、或不做（等引擎 API，記 TODO）。

## 選項

- A：做全清單：Pane 的 agents 區塊旁加「背景」區，shell／monitor／workflow 各一列，狀態每 tick 由上述來源組出。
- B：只做背景 shell：只列 `run_in_background` 的 shell（id、命令前段、跑了幾分、結束碼），因為它有 .output 檔可每 tick 確認。
- C：不做：資料只能在 turn 末拿到或要猜，記成 TODO 等引擎開 API；回答使用者「官方看得到是因為它是 harness 本體」。

## 什麼算答案

選一個（或修改過的）選項，附資料來源的確切位置（型別檔路徑:行或磁碟路徑）、每類 task 能否每 tick 準確、pane-12 放棄的原因與是否相關、做的話約幾個檔與最大的不確定。

## 回答的形狀

第一行是選的選項與一句理由，然後依 1–4 各一小段，最後一行列出沒能查證的東西。繁體中文。

## Answer

pick: B（修改版）：只列背景 shell——它是唯一每 tick 都有可靠磁碟來源的類別；monitor／workflow 只有 turn 末快照，列了會半舊半新，記 TODO 等引擎 API。
why: 引擎到 2.1.302 仍只在 `classic.Stop`／`classic.SubagentStop` 給 `background_tasks?` 快照（index.d.ts:12135、:12265），`$` 無 task 命名空間（:2321–3618），`ui.render` 輸入只有 surface/component/requestId/viewport/props（:9723）；新型別只多 `$.ui.view`（spawn-probe 版 :2636）。
why: `$.tool.call`（:3030）能叫的 `TaskList` 是團隊 todo（tools:5405–5413 subject/pending），`GetTask`（tools:4655–4690）按 id 查且每次過權限與全部 hook，不能當 250ms 的 tick 來源。
why: shell 有磁碟來源：`%TEMP%/claude/F--ymlab-fankeel/<sid>/tasks/b*.output`，結束必有 `[exited with code N]`（本 session 實測，連無輸出的 bb9cxgei4 也有），無標記即在跑；命令字樣要靠 `tool.call` 包裝取 `backgroundTaskId`（tools:4400）。
why: 背景 subagent 已在 agents 樹（pane.ts:259–261 讀 subagents/ 目錄）；monitor 磁碟無任何檔，workflow 的 wf_*.json 無狀態欄且本 session 根本沒有。
why: pane-12 放棄是「Desktop preview 已能開本機網頁，重複」（pane-12.md:22），不是技術阻擋，不擋這次；但它第 18 行要先實測的 `classic.Stop` 是否帶 `background_tasks` 從未做，所以 A 的快照來源仍未證實。
would flip if: 引擎給每 tick 可問的清單 API（`$.tasks.list()` 或 `ui.render` 帶 `background_tasks`）→ 改 A；
would flip if: 探針證實 hooks module 的 `tool.call` `next(e)` 結果拿不到 `backgroundTaskId`（無命令字樣的列沒意義）→ 改 C 記 TODO。
unread: nothing（brief 點名的四個檔與兩個磁碟路徑全部開過；未開：hooks/agent-end.js、lib/agentends.js、Pane props :10320、其他 session 的 wf_*.json 內容）
delegated: affb6a118f4e9443a (opus) — docs/90-agent/judgements/2026-10-16-pane-background-tasks.md、docs/90-agent/todo/pane-12.md、git show deffe630；a5ad3548e14fe2775 (opus) — .claude-plugin/types/claude-code/index.d.ts、.claude-plugin/types/claude-code-tools/index.d.ts；a6e3c486cd6e2c52d (opus) — 全機搜尋 .d.ts：.fankeel/build/2026-10-17-spawn-probe/mod/.claude-plugin/types/claude-code/index.d.ts（2.1.302）、C:/Users/user/.claude/plugins/marketplaces/claude-code-plugins/mods/types/claude-code.d.ts（2.1.277）、~/.local/share/claude/versions/；a88040302b4ca4d26 (sonnet) — hooks/pane.ts、hooks/pane-agents.ts、hooks/pane-status.ts、grep hooks/ lib/ scripts/；a08e45d85bba19d9b (sonnet) — C:/Users/user/AppData/Local/Temp/claude/F--ymlab-fankeel/b7a7d8d4-46d0-4e7f-b839-06dbca750114/tasks/、~/.claude/projects/F--ymlab-fankeel/b7a7d8d4-…/
checklist: 1 判決引用的引擎限制 — answered；2 pane-12 放棄原因 — answered；3 10-14 型別的事件／`$`／ui.render／tool.call — answered；4 機器上更新型別 — answered（最新 2.1.302，無 2.1.303/304 的 .d.ts）；5 pane.ts 的 render 輸入與 tick — answered；6 pane-agents.ts 來源與既有 task 程式 — answered（hooks/ 無任何 backgroundTaskId 程式）；7 磁碟 tasks/ 與 workflows/ 實況 — answered；8 磁碟來源能否分辨四類 — answered（shell 準、subagent 準、monitor 無、workflow 無狀態）

## Summary

### 第一行
選 B 修改版：Pane 加「背景 shell」一區，只列 `run_in_background` 的 shell，因為它是四類裡唯一每 tick 都有可靠來源的；monitor／workflow 記 TODO 等引擎開 API；回答使用者「官方看得到是因為它是 harness 本體，mod 只拿到引擎開的那一小塊」。

### 1. 官方為什麼看得到、引擎現在給 mod 什麼

官方 UI 直接持有 task 管理器。mod 引擎開放的全部如下（讀者 a5ad3548 找、我逐行抽查）：

- `BackgroundTaskSummary`（`F:/ymlab/fankeel/.claude-plugin/types/claude-code/index.d.ts:799–830`）：`id`、`type`（字串標籤 shell/subagent/monitor/workflow，:802）、`status`（字串）、`description`、shell 才有 `command`（:813）、monitor 才有 `server`/`tool`（:821、:825）、workflow 才有 `name`（:829）。
- 它只掛在 `StopHookInput.background_tasks?`（:12135，註解「In-flight background work… registered in this session」）與 `SubagentStopHookInput.background_tasks?`（:12265）。也就是只在 `classic.Stop`／`classic.SubagentStop` 那一刻的快照，和 10-16 判決 :46 說的一樣。
- `$` 的頂層命名空間（:2321–3618）：plugin、ui、model、audio、mcp、session、turn、prompt、tool、command、config、telemetry、agent、fs、store、state、clock、http、process、settings、env——沒有 task／tasks／shell／background。`$.agent.list()`（:3194）回 `AgentInfo[]`（:122）只有 agent loop。
- `ui.render` 的輸入 `RenderInputOf`（:9723）：`surface`、`component`、`requestId`、`viewport?`、`props`——沒有 task。重畫靠 `$.clock.every`＋`$.ui.invalidate`（:2366、:3978–3985），pane.ts 已經這樣做（`hooks/pane.ts:584` `$.clock.every(POLL_MS, …)`，POLL_MS=250）。
- `tool.call` 結果：Bash `backgroundTaskId?`（`claude-code-tools/index.d.ts:4400`，我抽查屬實）、PowerShell :4913、Monitor `taskId` :4832、Agent `remote_launched` 帶 `taskId` :952–954。
- 我額外查的 `$.tool.call`（:3030）：mod 可以自己呼叫任何工具，但「runs through every hook but the calling one, the permission check and its dialog」。能叫的 `TaskList`（tools:771 輸入 `{}`；回傳 tools:5405–5413 `subject`／`pending|in_progress|completed`／`owner`／`blockedBy`）是團隊 todo 清單，不是背景 task；`GetTask`（tools:333–336 輸入 `taskId`；回傳 tools:4655–4690 `working|completed|failed|cancelled`＋`createdAt`/`lastUpdatedAt`）是按 id 單查，像是 MCP 非同步 task 用的，每 250ms 對每個 id 走一遍權限與全部 hook 不可行，而且仍無清單。
- 比 10-16 判決時多了什麼：讀者 a6e3c486 全機搜尋，機器上沒有 npm 版 Claude Code（`~/.local/share/claude/versions/` 只有 2.1.302–304 的原生 exe，無 .d.ts），最新型別是 `F:/ymlab/fankeel/.fankeel/build/2026-10-17-spawn-probe/mod/.claude-plugin/types/claude-code/index.d.ts`（第 1 行 `Written by Claude Code 2.1.302`，與 plugin cache 0.111.18–0.111.50 內的副本位元相同）。對比 10-14 版（2.1.296）的 1361 行 diff 裡與 task 有關的只有新增 `$.ui.view`（:2636，我抽查屬實）：「Puts an agent's transcript in the main view, as the person's own switch from the tasks list does」——它反證引擎自己有 tasks list，但只開了「切到某 agent 的畫面」，沒開清單本身。`background_tasks` 仍只在 :12711、:12848 兩處（Stop／SubagentStop）。2.1.303／304 的型別不存在於磁碟（要跑 `/plugin-types` 才會生成，它會寫檔，沒跑）。

結論：引擎開放的面與 10-16 判決時相同，沒有可每 tick 問的清單。

### 2. 我們能顯示到什麼程度（讀者 a08e45d8 實測本 session，我抽查目錄與一個 tail）

- **shell：能準。** `C:/Users/user/AppData/Local/Temp/claude/F--ymlab-fankeel/b7a7d8d4-…/tasks/` 存在，75 個檔全是 `*.output`，沒有 .json／.meta／.pid 之類旁檔，也沒有任何 `tasks.json` 登錄檔。shell 是 `b<8–9 字>.output`，約 16 個。結束必有尾標記——`bs2mzpnvp.output` 尾是 `suite: 4933 pass, 1 fail @ 2a0963d2 …` 然後 `[exited with code 0]`（我抽查屬實）；連完全沒輸出的 `bb9cxgei4.output` 也只有 `[exited with code 0]`，所以「無標記＝在跑」是可靠的推論；0 bytes 的 `bsny9bn5v.output`（02:17）就是正在跑的。`[killed]` 本 session 一個都沒有（grep 無命中），但 pane-12.md:16 與判決 :46 都記過它存在。兩個限制：(a) 磁碟上沒有命令字樣，要靠 `on('tool.call', { tool: 'Bash' })` 包 `next(e)` 取 `backgroundTaskId`＋`e.command`；(b) 讀者看到 `b94hxm9ag.output` 在兩次 listing 之間消失（先 1157 bytes、再 15 bytes、再不見），所以目錄不是穩定登錄，消失要當「已結束、結束碼未知」。
- **背景 subagent：能準，而且已經在列。** `~/.claude/projects/F--ymlab-fankeel/<sid>/subagents/agent-<id>.jsonl` 的 mtime 增長＋`.meta.json`（agentType、description、parentAgentId、spawnDepth、`requestShape: "foreground"`、model）；`tasks/a*.output` 多為 0 bytes 或轉錄的硬連結（inode 相同），不能當狀態。pane.ts:259–261 已每 tick 列這個目錄，pane-agents.ts:73、:84 以 `.fankeel/build/agents-<session>.json` 的 ended 表判在跑；它不分前景／背景，meta 的 `requestShape` 欄位可以廉價標出背景（此欄是否每個 meta 都有，未查）。
- **monitor：只能猜。** `$TEMP/claude` 與 projects 下 `-iname "*monitor*"` 零命中，無 monitors/ 目錄；唯一來源是 turn 末的 Stop 快照（`server`/`tool` 欄）。
- **workflow：只能猜。** 本 session 的 projects 目錄只有 `custom-title.json`、`subagents/`、`tool-results/`，沒有 `workflows/`；其他 session（705fc204 等）有 `workflows/wf_*.json`，判決 :46 記它只有 runId/taskId/script 無狀態欄（本次未重讀）。

所以「每 tick 都對」的清單只有 shell 與 subagent 兩類；A 的 monitor／workflow 列只能在 turn 末更新一次，且 module 的 `classic.Stop` 是否真帶 `background_tasks` 仍未實測。

### 3. pane-12 為什麼放棄、是否擋這次

`docs/90-agent/todo/pane-12.md:22`（我抽查屬實）：「不做了。使用者說 Desktop 內建的 preview 已經能偵測並打開本機網頁服務，測過沒問題，Pane 再做一顆一樣的按鈕是重複。fankeel 這邊沒有寫任何程式。」——是產品重複，不是技術阻擋，不擋「列背景 shell」。但要注意兩件事：(a) pane-12.md:18 的完成條件「先實測 hooks module 的 classic.Stop 是否真的帶 background_tasks」從未執行，判決 :49–51 列的最大不確定原封不動留到今天，這只擋 A 不擋 B；(b) 紀錄的 `sha: deffe630` 其實是結案時的 HEAD（`docs: land the patrol-every-entry check`，Oct 17 02:40:18），真正改 pane-12.md 的是 25 秒後的 27139b7f（`git log -- docs/90-agent/todo/pane-12.md`），無礙本題。

### 4. 建議（B 修改版）怎麼做

- **列在哪**：pane-status.ts:23 的 `Fold` 加 `'shells'`，放在 agents 區塊下面、獨立一區（不併進 agents，理由同判決 :49：agents 行有 model/effort/token，shell 沒有）；一行一個：`b79f1s93m · node scripts/suite.js --fast… · 3 分 · 跑` 或 `… · exit 0`。在跑的在前，結束的只留本 turn 內最後 2 個，最多 3 行，命令截到欄寬；一個都沒有時整區不畫（比照 pane-status.ts:416 `DROP` 以外的規則）。
- **資料流**：(1) `on('tool.call', { tool: 'Bash' })`（與 PowerShell）包 `next(e)`，結果有 `backgroundTaskId` 就記 `{ id, command: e.command, at: now, agentId }`；(2) 每 tick 在既有 `tick()` 裡 `$.fs.list` tasks 目錄取 `b*.output`，對「在跑」的 id 只讀尾 64 bytes 找 `[exited with code N]`／`[killed]`，檔消失視為結束；目錄裡有、包裝沒看到的 id（mod 載入前起的、或子代理起的）也列，命令欄留 `?`。tasks 目錄路徑用 `$.env`（:3595）的 TEMP＋slug＋session id，pane.ts 已有 configDir 與 slug 的推法可沿用。
- **檔數**：約 4–5 個——`hooks/pane.ts`（包裝＋tick 讀檔＋state）、`hooks/pane-status.ts`（新區塊）、新 `hooks/pane-shell.ts`（純函式：尾標記解析、截切、分鐘數）＋`tests/pane-shell.test.js`、`tests/pane-status.test.js` 補案例。可順手在 pane-agents.ts 用 meta 的 `requestShape` 給背景 subagent 標記（1 行）。
- **先做 10 分鐘探針**（比照 2026-10-17-spawn-probe）：丟棄式 mod 驗證 module 的 `tool.call` 包裝 `next(e)` 結果確實帶 `backgroundTaskId`、`e` 帶 `command`。這是唯一會翻到 C 的事實。
- **最大不確定**：上述探針；`.output` 中途消失的語意（TaskStop？清理？）；非 Windows 的 tasks 目錄路徑（推測 `$TMPDIR`／`/tmp/claude/<slug>/<session>/tasks`）；子代理起的 shell 是否寫進同一個 session 的 tasks 目錄；`$.fs.list` 每 250ms 列 75+ 檔的成本（pane.ts:259 列 subagents/ 171 檔已是現況，應可接受）。
- **TODO**：monitor／workflow 清單等引擎開每 tick API；觸發條件寫成「`$.tasks.list()` 出現、或 `background_tasks` 進 `ui.render`／`$.session.*`」。

### 抽查結果
五個讀者各抽一處以上，全部與原文相符：pane-12.md:22、判決 :45–51、index.d.ts:799–830 與 :12135、tools:4400、spawn-probe 版 :2620–2636、pane.ts:582–585 與 :257–261、tasks 目錄 listing 與 bs2mzpnvp.output 尾標記。沒有讀者摘要與原文不符的情況。

### 沒能查證的
hooks module 的 `tool.call` 結果在執行期是否真有 `backgroundTaskId`（型別有、未跑）；module 的 `classic.Stop` 是否真帶 `background_tasks`（只擋 A）；2.1.303／304 的型別（未跑 `/plugin-types`，它會寫檔）；`.output` 中途消失的原因；`[killed]` 的實際字樣（本 session 無樣本）；`requestShape` 是否每個 meta 都有；非 Windows 的 tasks 路徑；`GetTask` 是否接受 shell 的 `backgroundTaskId`；hooks/agent-end.js 對背景 subagent 是否寫 ended。
