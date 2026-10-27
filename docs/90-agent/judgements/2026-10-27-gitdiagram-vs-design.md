---
judged: 2026-10-27T05:33:36.166Z
model: fable
agent: fankeel-judge
task: "gitdiagram 對照 fankeel 設計差距"
session: bdd6fe89-0ba8-4400-b685-051ea8621eef
stage: survey
---

# Brief 39 — gitdiagram's picture of fankeel vs our own design: where is the gap, and what do we do about it?

## Question

# Brief 39 — gitdiagram's picture of fankeel vs our own design: where is the gap, and what do we do about it?

## Question

The user pointed at https://gitdiagram.com/fanfantom9452/fankeel (an AI-generated architecture diagram of this repository, made 2026-10-27 from the file tree, the README and a *sample* of source files) and asked: how far is it from our design? Two parts:

1. **The gap** — where the diagram is wrong, missing or misweighted against how fankeel is actually designed.
2. **The action** — what, if anything, fankeel should do because of it.

## What the diagram says (fetched 2026-10-27 from https://gitdiagram.com/fanfantom9452/fankeel.md — copied here, readers do not need to fetch it)

Overview sentence: "a Claude Code plugin for managing long-running project tasks. A user starts or resumes a task, FanKeel selects a staged route, dispatches work, pauses for approval at each gate, and records progress so a later session can continue. Separate capabilities track changed files and conflicts, provide context and handoff support, and present session status in a machine-wide monitoring station and optional pane." It admits some links "rely on the SOURCE INDEX because their source was not excerpted".

26 components, 35 connections, in four groups plus a user node:

- **Task workflow**: Session hooks (`hooks/`), Stage gates `hooks/gate.js`, Stage routes `lib/stages.js`, Handoff reports `lib/handoff.js`, Context monitor `lib/context.js`, Session initialization `hooks/inject.js`, Agent definitions `lib/agentfile.js`.
- **Project state**: User profiles `lib/profile.js`, Session registry `lib/registry.js`, Changed-file tracking `lib/tracked.js`, Project TODOs `lib/todo.js`, Documentation checks `lib/docs.js`.
- **Session visibility**: Monitoring station `lib/station.js`, Status pane `hooks/pane.ts`, `pane-status.ts`, `pane-band.ts`, `pane-bar.ts`, `pane-lang.ts`.
- **Chartroom**: `lib/chartroom/core/{fields,format,ops}.js`, `lib/chartroom/geometry/{route,layout,scene}.js`, geometry dir.

Edges: user → hooks "starts task"; hooks → gate "routes gate events"; gate → registry/profile/stages/handoff; user → inject "invokes command"; inject → registry/handoff/context/station/tracked; profile → registry, profile → agentfile; docs → tracked; user → station "views sessions"; station → registry/tracked/profile/todo/handoff; pane → pane-status → band/bar/lang; pane -.-> registry; Chartroom internal edges only (format→fields, ops→fields/format, route→fields, layout→format/geometry, scene→layout/route). **Chartroom has no edge to anything outside itself.**

Things I notice are absent (verify, do not trust): `skills/` (the seven stages + ask/audit/explain/init/weekly/retro-all) entirely; `agents/` (brain, reader, reviewer, implementer, verifier, fixer, mutator, mover, judge, writer, mockup, render-reviewer, retro, slimmer, init-scout); `scripts/` (task.js, judge.js, await.js, commit.js, station.js server, weekly.js, todo.js, version.js…); `hooks/guard.js` (the file-claim guard / deny); the stage-agent + handoff + gate loop (`stage.agents`, controller vs brain); the ledger; the weekly report; dispatch discipline (`dispatch.floor`, `dispatch.inflight`); the docs tree / map; the sensitive-word check.

## Background in this repo (these decide the answer)

- `README.md` and `docs/01-guide/` — what a reader of the repo is told fankeel is; gitdiagram read the README, so its gaps partly measure the README.
- `CLAUDE.md` (repo root) and the project map it points at (find the map file under `docs/` — the architecture/map page the survey stage reads first).
- `docs/90-agent/reference/` (station.md, subagents.md, others) — the agent-facing design reference.
- `docs/03-decisions/` — standing decisions, esp. Chartroom ones (`2026-10-07-station-chartroom.md`, `2026-10-20-task-boards-as-svg.md`) — to judge whether "Chartroom isolated" is a diagram error or a real coupling we have (who calls `lib/chartroom`: `lib/board.js`, `scripts/station.js`).
- `hooks/hooks.json` (or wherever hooks are registered) and `hooks/guard.js`, `hooks/gate.js`, `hooks/inject.js` — check whether gitdiagram's edge directions are true (e.g. does gate.js really write the registry? does inject.js "provide station link"?). Spot-check the 30 "with evidence" edges, a handful is enough.
- `lib/station.js` vs `scripts/station.js` — which one is the station.
- Prior "outside tool vs ours" judgements, read pick + Summary, keep consistent or say why not: `docs/90-agent/judgements/2026-10-22-graphify-knowledge-graph.md`, `2026-10-22-understand-anything.md`, `2026-10-25-mermaid-renderers-vs-chartroom.md`, and the archify one (brief 36, `.fankeel/build/ask/36-archify-vs-chartroom-brief.md`; its filed judgement under `docs/90-agent/judgements/` if present).

## Options

A. **No change** — the diagram is a third-party AI summary; its gaps are its sampling, nothing for us to do.
B. **Fix our own front door** — the gaps that come from the README / map not saying it (e.g. skills and agents being the core, not hooks/lib) are ours; name the README / map sections to add or reword, first change named.
C. **Adopt it** — add the gitdiagram badge/picture to the README, or use gitdiagram (or its `.md`) as a periodic outside check that the README conveys the architecture.
D. **Draw our own** — fankeel already has Chartroom boards; draw the real architecture as a board/diagram in the docs instead (where it lives, what it shows).
E. Some combination — say which and in what order.

## What counts as an answer

1. A gap table: each row = one thing the diagram gets wrong / omits / overweights, the truth with a `path:line`, and whether the cause is gitdiagram's sampling or our own docs not saying it. Mark any row not verified from source as unverified.
2. One pick, and if it changes anything, the first concrete change (file + what it does). Consistency with the prior outside-tool judgements stated.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文 holding the gap table.

## Answer

pick: E — A 為主（圖本身不採用、不加 badge、不為它改 README、不畫 architecture.board），外加一項 B：補 docs/02-architecture/layout.md 漏列的 lib/chartroom/ 與 lib/board*.js（順手補 weekly 檔），再跑 node scripts/map.js 讓 map 跟上。
why: 驗證 14 條有證據的邊，12 條成立（gate.js:50-54、inject.js:18-23、profile.js:11-12、lib/station.js:20-33、pane.ts:3）；錯的兩處——Chartroom 孤島、pane→registry——都是靜態 require 掃描看不到 dynamic import()（lib/board.js:58-63）與註解所致，是工具取樣。
整層 skills/（16）、agents/（15）、scripts/（59）、guard.js、stage-agent 迴圈全缺，但 layout.md:24,29,33,55,70 與 pipeline.md:379-385 都寫了；README 不放目錄樹是 10-21 決定（readme-quickstart :8），不是缺口。
我們自己的一個真缺口：layout.md 沒有任何一行提到 lib/chartroom、lib/board.js 或 weekly 程式碼（grep 只命中 :25 assets），而 README.md:83 正把「每個目錄與檔案負責什麼」指向這頁。
C 違反 archify 判決 :99（不替沒審過的外部工具背書）；D 違反 10-19 判決 :170/:239（不做常駐 architecture.board）與 10-26 決定 :8/:17（人讀的文件寫 Mermaid，Chartroom 只畫任務板）。
would flip if: 使用者要 GitHub 上只看 README 的人就看出 skills+agents 是核心——那就改 B 本體：README.md:3 英文摘要加一句點名 skills/、agents/、hooks/、lib/、scripts/ 各做什麼。
unread: CLAUDE.md（repo 根目錄不存在，find 無結果）；gitdiagram 網頁本身（用 brief 抄錄）；pipeline.md 與 station.md 僅 grep 命中段；lib/agentfile.js 本體（註解在 :5 被截斷）；.fankeel/build/ask/36-archify-vs-chartroom-brief.md（改讀其歸檔判決）。
delegated: README.md、docs/README.md、docs/01-guide/concepts.md、docs/01-guide/what-runs.md — sonnet；.fankeel/map.md、docs/02-architecture/layout.md、docs/02-architecture/pipeline.md — sonnet；hooks/mod.ts、hooks/gate.js、hooks/inject.js、hooks/guard.js、.claude-plugin/plugin.json — sonnet；lib/station.js、scripts/station.js、lib/board.js、lib/board-edit.js、lib/requires.js、lib/chartroom/ 目錄 — sonnet；lib/profile.js、lib/docs.js、lib/agentfile.js、lib/stages.js、hooks/pane.ts、hooks/pane-status.ts、skills/registry.json、skills/fankeel/SKILL.md、agents/fankeel-brain.md、lib/ledger.js、lib/sensitive.js、scripts/{weekly,task,judge,await}.js — sonnet；docs/90-agent/reference/station.md、subagents.md — sonnet；docs/03-decisions/2026-10-07-station-chartroom.md、2026-10-20-task-boards-as-svg.md、2026-10-26-station-mermaid-pele.md、2026-10-27-gate-board-inline.md、2026-10-27-design-catalog.md — sonnet；docs/90-agent/judgements/2026-10-22-graphify-knowledge-graph.md、2026-10-22-understand-anything.md、2026-10-25-mermaid-renderers-vs-chartroom.md、2026-10-26-archify-vs-chartroom.md、2026-10-19-chartroom-mermaid-station.md — opus。
checklist: 1 README/guide 前門說了什麼 — answered；2 map/architecture 的設計形狀與 chartroom 呼叫者 — answered；3 hooks 登錄與 gate/inject/guard 邊 — answered；4 哪個是 station、Chartroom 是否孤島 — answered；5 lib 邊與被漏掉的檔存在 — answered；6 reference 的 station 檔、agents 名冊、dispatch、stage.agents — answered；7 Chartroom 決定 — answered；8 先前四份外部工具判決 — answered。

## Summary

### 一、gitdiagram 讀到了什麼、為什麼長這樣

總覽句逐段對得上 README.md 的英文摘要與五分鐘上手：「long-running projects」「route of up to seven stages」「stopping at a gate after every stage」「remembers what was tried」「warns when two live sessions edit the same file」在 README.md:3；「下一步寫進 registry，下次 /fankeel 接著做」在 :46；`[FANKEEL:CLASH]` 在 :47；「監控站把這台機器的所有 session 畫成一頁」在 :48，Pane 在 :69。它的 26 個元件幾乎就是 README 裡出現過的名詞（gate、route、handoff、context、registry、profile、tracked、todo、docs、station、pane）各配一個同名 `lib/*.js`，所以它畫出來的是「README 名詞 × 靜態 require 邊」的交集。README 唯一一張圖是 :50-53 的七站 mermaid；沒有目錄樹——那是 2026-10-21 readme-quickstart 決定 :8 刻意搬去 docs 的（「目錄樹和開發者材料搬進 docs」），README.md:82-83 再把 pipeline.md、layout.md 連出去。

### 二、差距表

| # | 圖怎麼說 | 真相（path:line） | 原因 |
|---|---|---|---|
| 1 | 沒有 skills/ | 16 個 SKILL.md；layout.md:70 一句列全；skills/registry.json:1-3 七站各一條；skills/fankeel/SKILL.md:3 描述整個 route。README.md:59-69 列 `/fankeel-*` 指令但沒說它們是 skill | gitdiagram 取樣（.md 不當元件）；README 不列目錄是 10-21 決定，不算我們的缺口 |
| 2 | 沒有 agents/ | 15 個 agents/*.md；layout.md:24；subagents.md:28,32「The fifteen agents」；what-runs.md:56-73 整張表；agents/fankeel-brain.md:3 | 取樣 |
| 3 | 沒有 scripts/ | 59 支；layout.md:55「the command line, thin wrappers over lib/」；map.md:98 `scripts/station.js — required by 58`；scripts/task.js:4、judge.js:4、await.js:4 | 取樣（整個目錄沒抽到） |
| 4 | 沒有 hooks/guard.js | plugin.json:130,152,163 三個 PreToolUse；guard.js:4-12 標頭；layout.md:33（scope guard、read-only agents、無 brain、sensitive.txt 掃 commit） | 取樣 |
| 5 | 沒有 stage-agent 迴圈（stage.agents / brain / controller / handoff / await） | pipeline.md:379-385；subagents.md:578-581、:759-764；agents/fankeel-brain.md:3；scripts/await.js:4；layout.md:32 gate.js 驗 controller 問句逐字抄 handoff gate | 取樣 |
| 6 | 沒有 ledger、sensitive、dispatch 紀律、docs 檢查 | layout.md:62（ledger）、:49/:33（sensitive）、:47/:64（docs.js、docs-check）；pipeline.md:587,667,721 與 subagents.md:335-339（inflight 預設 8、floor） | 取樣 |
| 7 | 沒有 weekly report | scripts/weekly.js:3；lib/weekly-{collect,git,modules,render,store}.js 存在；README.md:68 只有一列指令；**layout.md 沒有任何 weekly 的 lib/scripts 行**（grep 只命中 :25 assets/weekly/report.css） | 兩者——我們的 layout.md 也沒寫 |
| 8 | **Chartroom 是孤島，對外零邊** | 錯。lib/board.js:58-63 與 lib/board-edit.js:15 以 `import()` 載入 core/format、geometry/measure、scene、svg、core/validate、fields、ops；lib/station.js:29、scripts/station.js:48-50、lib/weekly-render.js:9、hooks/resume.js:26 都經 board*.js 用到；決定 10-20:15「lib/board.js --loads via dynamic import()-->」；station.md:701-705 `GET /station/board/<session>/<name>.svg` | 兩者——靜態 require 看不到 dynamic import（取樣）；**layout.md 沒有 lib/chartroom、lib/board.js 任何一行**（我們的） |
| 9 | Chartroom 內部六檔 | 實際 13 檔：core 6（多 diff、util、validate）、geometry 7（多 lanes、measure、shapes、svg）；10-20:14「只抄 10 檔」已再長 | 取樣 |
| 10 | Monitoring station = lib/station.js | 一半。lib/station.js:2-5 是資料與頁面模型（layout.md:50）；開 port 的是 scripts/station.js:1180,1243（layout.md:63「writes the station page, or serves it live」） | 取樣 |
| 11 | 「Session hooks (hooks/) routes gate events → gate.js」 | hooks/hooks.json 只有 `{"modules":["mod.ts"]}`；mod.ts 不碰 gate.js；gate.js 登錄在 plugin.json:141，只跑 PreToolUse AskUserQuestion（gate.js:4-7） | 取樣（方向沒錯、機制錯） |
| 12 | gate → registry / profile / stages / handoff | 成立：gate.js:50,51,53,54；且 gate **寫** registry：setAway :180、gateOpen :186、clearInflight :414 | — |
| 13 | inject → registry / handoff / context / station / tracked；「provides station link」 | 前四條成立：inject.js:18,19,23,22；station link 成立：:167 `station.write` → :177 `renderInit({station: page})`；**tracked 非直接**，經 lib/guard.js:23、lib/dirty.js:43、lib/render.js:28 | tracked 一條是取樣的鬆（間接邊畫成直接） |
| 14 | profile → registry、profile → agentfile；docs → tracked | 成立：profile.js:11,12；docs.js:254（lazy） | — |
| 15 | station → registry / tracked / profile / todo / handoff | 成立（對 lib/station.js）：:21,:20,:26,:33,:28 | — |
| 16 | pane → pane-status → band / bar / lang；pane -.-> registry | 前者成立：pane.ts:3；pane-status.ts:6,7,12。**pane → registry 沒有 import**，pane-status.ts:1,122,277 只有註解 | 取樣（它自己已標虛線） |
| 17 | 「Agent definitions = lib/agentfile.js」 | 鬆。agentfile.js:3-5 是 `task.js profile set agent.<name>.*` 寫進 `.claude/agents/` 的覆寫檔；定義本體在 agents/*.md（subagents.md:30-31）。未讀本體（註解 :5 被截）→ **未驗證** | 取樣 |
| 18 | 總覽句 | 忠實改寫 README.md:3,46-48 | — |

未驗證：第 17 列的 agentfile 本體；第 13 列只 grep 了 inject 所需 15 個 lib 中的 6 個找 tracked；docs/README.md:9-11 說首頁有「the two diagrams」而 README 現只剩一張 mermaid（:50-53）——可能是 docs/README.md 的舊句，與本題無關，留給 audit。

### 三、抽查結果

每位 reader 抽一處原文：README.md:3、:46-53、:71-86；layout.md:22-41（agents/hooks/lib 行與 :39「nothing here reaches into scripts/ or hooks/」）；map.md:98-112（目錄邊表）；gate.js:178-187（setAway、gateOpen）；inject.js:165-178（station.write、renderInit）；lib/board.js:56-64（六個 dynamic import）；profile.js:11-13；station.md:699-705；10-26 決定 :6-27；archify 判決 :93-99；10-19 判決 :168-171；plugin.json:138-143。全部與 reader 回報相符，無一處出入。另用 grep 自驗 layout.md 全文：chartroom／board／weekly 僅命中 :25 一行 assets，lib/ 與 scripts/ 共列 38 行卻沒有 Chartroom、board、weekly 任何一行。

### 四、推到 pick

1. **這張圖的錯，九成是它自己的取樣。** 它只拿 README 名詞配 `lib/*.js`，不把 .md 當元件（skills、agents 全消失），沒抽到 scripts/，靜態 require 看不到 `import()`（Chartroom 孤島）。十四條有證據的邊有十二條成立，說明它抽到的那一小塊是準的——問題是整層紀律（skills→brain→readers→handoff→gate）不在它的抽樣面上。
2. **我們自己的那一成是 layout.md。** README 不列目錄是 10-21 決定，守住就好；但 README.md:83 把「每個目錄與檔案負責什麼」指向 layout.md，而這頁對 lib/chartroom（13 檔）、lib/board.js／board-edit.js／board-look.js、以及整組 weekly 程式碼一字未提。這兩塊各有一條決定背書（10-20、10-27；weekly 近五筆 commit），早該在 layout.md 有一列。map.md 的樹抄 layout.md（map.md:7「Generated… re-run node scripts/map.js」），補完再跑 map.js 即同步。
3. **C 不選。** archify 判決 :99：「先前四份判決沒有一份把外部工具推給使用者……fankeel 沒審過不該代為推薦」；gitdiagram 是外部 LLM 服務、產物會隨抽樣變，掛 badge 等於替它的錯圖背書。拿它的 .md 做「定期檢查」也不選：它檢查的是「README 名詞＋靜態 require」，這兩樣我們自己的 scripts/map.js（map.md:100-112 目錄邊表、:98 most-required）與 lib/requires.js（含 dynamic import）已經做得比它準——graphify、understand-anything 兩份判決正是把這個想法借進 map.js 收尾的，沒有再借一次的缺口。
4. **D 不選。** 10-19 判決 :170、:239 明拒常駐 `architecture.board`（「有東西要給人看才出現」「板子跟內容走」）；10-26 決定 :8、:17、:26 把方向反過來：人讀的文件與 gate 寫 Mermaid，Chartroom 只畫任務 `.board`。所以「用 Chartroom 畫 fankeel 架構放進 docs」同時撞兩條。若真要一張元件圖，10-26 下只能是 Mermaid，而 10-25 判決 :58「今天沒有任何東西因為缺圖而失敗」——README.md:50-53 的七站圖加 layout.md 的樹就是現行的架構圖，沒壞，不加。
5. **所以 E = A 加一項 B。** 與五份先前判決一致：不採用外部工具（10-25 A、archify :99）、不借沒缺口的想法（archify :94）、有缺口才動自己幾行（graphify :186、UA :189）。

### 五、第一個具體變更

`docs/02-architecture/layout.md`，lib/ 區塊（:50 `station.js` 附近）加一列：

`board.js` — a task's Chartroom `.board` files under `.fankeel/build/task-<started>/`, listed for the station card (`GET /station/board/<session>/<name>.svg`), drawn inline and editable on the gate page, checked by `scripts/board.js`; `board-edit.js` applies the gate page's edits through `chartroom/core/ops.js`, `board-look.js` holds the categories and heat colours; `chartroom/` is the 13 ESM files vendored from Chartroom (core/ 6, geometry/ 7, see 2026-10-20 and 2026-10-27), loaded only by `board.js` and `board-edit.js` with dynamic `import()`.

同一次編輯再加一列 `weekly-collect.js, weekly-git.js, weekly-modules.js, weekly-render.js, weekly-store.js` 與 scripts/ 區塊的 `weekly.js`（描述取自 scripts/weekly.js:3-4）。然後 `node scripts/map.js` 重生 .fankeel/map.md。README、skills、agents、hooks 一行不動；不加 badge；不畫 architecture.board。

已寫進 context.md（F:/ymlab/fankeel/.fankeel/build/task-20261027T052313/context.md）三條：README.md:3 是總覽句來源且 README 無目錄名；lib/chartroom 只被 board.js:58-63、board-edit.js:15 dynamic import；hooks 登錄在 plugin.json:141 而非 hooks.json。
