---
judged: 2026-10-19T16:40:30.428Z
model: fable
agent: fankeel-judge
task: "Chartroom 取代 Mermaid 與 station 擴充；cursor/plugins README 補比"
session: 53027795-6acd-4aa4-8047-d92bcaa74227
stage: survey
---

# Brief: Chartroom as fankeel's Mermaid replacement, a more capable station, and what every cursor/plugins plugin offers

## Question

# Brief: Chartroom as fankeel's Mermaid replacement, a more capable station, and what every cursor/plugins plugin offers

## Question

Two linked questions from the user, answered as one judgement:

1. **Chartroom.** The user built https://github.com/FanFantom9452/Chartroom
   (cloned at `F:/ymlab/_ext/chartroom`) intending it to **replace Mermaid** as the
   way an AI shows structure to a human. Judge how far it gets there today, what is
   missing for that role, and how it should fold into fankeel's station so the
   station becomes "more all-round" (更加全能).
2. **cursor/plugins, every plugin.** https://github.com/cursor/plugins (cloned at
   `F:/ymlab/_ext/cursor-plugins`) — read **each plugin's README first** (each says
   what the plugin does), then go deeper where a plugin bears on fankeel or the
   station. A prior judgement already covered **pstack** in depth; do not redo it —
   cover the other plugins, and name only what changed in pstack since.

Answer: **what should the station gain (from Chartroom and from the cursor plugins),
in what order, and what should be deliberately rejected?**

## Options (the shape of each recommendation)

For each item:
- A. Adopt — fankeel/station lacks it and should gain it (name the fankeel file it lands in).
- B. Adapt — fankeel has a weaker/different version; say what to change.
- C. Reject — conflicts with fankeel's design (no build step, no dependencies, nonce on every POST, gates asked by the user); say why.
- D. Already equivalent — name the fankeel file:line.

Plus one overall pick: the **first** thing to build next for the station.

## Background

- fankeel (`F:/ymlab/fankeel`) is a Claude Code plugin: task registry, staged route
  (survey/design/plan/build/verify/audit/land), gates via AskUserQuestion, stage agents,
  reader fan-outs, a one-shot judge. It has **no build step and no npm dependencies**.
- The **station** (監控站) is `scripts/station.js` (906 lines), documented in
  `docs/90-agent/reference/station.md`: a local HTTP page showing every session,
  spending, gates; every POST carries the nonce printed by that `serve`.
- Decision `docs/03-decisions/2026-10-07-station-chartroom.md` (user's own answers):
  the whiteboard appears **only when the AI has something to show**, not as a
  per-project standing board; its goal is to **take Mermaid's place** in AI→human
  communication, more readable than Mermaid and able to draw by large architecture;
  reference the approach of https://github.com/QingYunA/answer-me-with-html;
  Chartroom is to be **merged into fankeel, usable on install**; writes use the
  station's nonce rule, no exception. Open problem it left: Chartroom uses
  React + Vite while fankeel has no build and no deps — commit built assets, or
  rewrite build-free?
- Today the profile has `station.chartroom` (an install path for Chartroom; unset =
  no whiteboard) — see `docs/01-guide/profile.md` and `scripts/station.js`. Related
  archived designs: `docs/99-archive/2026-10-08-station-chartroom-design.md`,
  `docs/99-archive/2026-10-08-station-chartroom.md`; open TODO
  `docs/90-agent/todo/station-15.md`.
- Chartroom: React + Vite whiteboard; boards are one-record-per-line `.board` files,
  the file on disk is the truth; humans drag-edit like draw.io, the AI reads/writes
  through the same `ops` via file, CLI or HTTP; changes not made by you glow and get
  an undo card; nested sub-boards with breadcrumbs. `createHandler(boardPath)` serves
  one board; POST checks Origin vs Host and JSON only, no nonce.
- The prior judgement: `docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md`
  (read its `## Answer` and `## Summary` only, to avoid repeating it). Related
  report: `docs/90-agent/reports/2026-10-19-memory-vs-pstack.md`.
- **Clone state:** `F:/ymlab/_ext/cursor-plugins` working tree is at 0148b78
  (2026-10-18); `origin/main` has been fetched at d457567 (2026-10-19, 41 files
  changed). The working tree cannot be updated this stage — readers must read the
  newest version with `git -C F:/ymlab/_ext/cursor-plugins show origin/main:<path>`
  and list files with `git ls-tree -r --name-only origin/main <dir>`.

## Paths to read

Chartroom (`F:/ymlab/_ext/chartroom`): `README.md`, `TODO.md`, `docs/`, `schema/`,
`src/` (structure, the ops model, the layout/rendering of nodes and edges),
`bin/chartroom.js`, `examples/*.board`, `package.json` (dependencies, build).

fankeel: `scripts/station.js`, `docs/90-agent/reference/station.md`,
`docs/03-decisions/2026-10-07-station-chartroom.md`, the two archived station-chartroom
pages, `docs/90-agent/todo/station-15.md`, `docs/01-guide/profile.md` (station keys).

cursor/plugins at `origin/main`, **each plugin's README.md first**: advisor,
agent-compatibility, cli-for-agent, continual-learning, create-plugin, cursor-sdk,
cursor-team-kit, docs-canvas, dyl-stack, grok-voice, harness, orchestrate,
origin-apps, pr-review-canvas, pstack (changes since 0148b78 only), ralph-loop,
teaching, thermos, plus top-level `README.md`, `third_party/` (list what is there)
and `schemas/`. Go past the README into skills/scripts where a plugin touches
visual communication (docs-canvas, pr-review-canvas, origin-apps, teaching are
likely), orchestration, or a session-monitoring surface.

## What counts as an answer

- Chartroom: a verdict on whether it can replace Mermaid for AI→human diagrams,
  with the concrete gaps (e.g. can an AI author a board in one shot as easily as
  writing a Mermaid block? auto-layout? reading in chat vs browser? diff/undo?),
  each tied to a file it read.
- The packaging question (React+Vite vs fankeel's no-build/no-deps) answered with one pick.
- A table of **every** cursor plugin: one line on what its README says it does, then
  A/B/C/D for fankeel or the station, with the fankeel file it would touch.
- One ordered list: what the station gains first, second, third.
- Every claim about a file names the file; unknowns stay unknown.

## Shape of the answer

The judge's six fields (with `pick:` naming the first thing to build for the
station), then `## Summary` in 繁體中文, containing:
1. Chartroom 取代 Mermaid：判定、缺口表（缺口 / 證據路徑 / 建議）。
2. 打包方式：一個選擇與理由。
3. cursor/plugins 全表：plugin / README 說它做什麼 / A-B-C-D / 落在 fankeel 哪個檔。
4. 監控站擴充順序：第一、第二、第三。
5. 刻意不做的事與理由。

## Answer

pick: 監控站第一件要做的：把 Chartroom 的純 Node 層（src/core、src/geometry、src/server，共 2,647 行，只 import node:*）原樣併入 fankeel 的 lib/chartroom/，scripts/station.js 新增 GET `/station/board/<session>/<name>.svg`，以 geometry/svg.js 的 toSVG 把該 task 在 `.fankeel/build/` 下的 .board 直接畫成 SVG，session 卡片出現「AI 畫的圖」連結——零 build、零依賴、GET 不碰 nonce。
why: Chartroom 今天已讓 AI 不寫座標一次寫完一張板（README.md:107；src/geometry/layout.js:1 自動排版）、直角 A* 繞線與標籤避讓（route.js:6；scene.js:10）、形狀涵蓋 Mermaid flowchart 全套（fields.js:6-11）——架構圖／流程圖這一塊已勝過 Mermaid。
真正的缺口不在畫法而在打包與規矩：React 19 peer dep＋Vite、dist/ 被 .gitignore（package.json:27-38）；現行 `/chartroom/` 路由從安裝路徑 require 並刻意繞過 nonce（scripts/station.js:399-421）；板子是每專案常駐檔（lib/station.js:419-421）——三點都與 2026-10-07 裁定（:18、:24、:30）相反。
幾何與伺服層本來就是純函式、不 import React（scene.js:2、svg.js:2、layout.js:2），CLI 已能無瀏覽器匯出 SVG（bin/chartroom.js:211-230），所以「看」這一半不用改寫就能零 build 進站；「拖」才需要以 vanilla JS 重寫 React 層（約 3,885 行）。
cursor/plugins 18 個裡沒有可移植的白板：兩個 canvas 外掛綁 Cursor 私有 SDK（docs-canvas/skills/docs-canvas/SKILL.md:23），唯一可移植的是 cursor-team-kit 的「一次性 HTML 頁＋127.0.0.1 python 靜態伺服器、無 token」（skills/pr-review-canvas/SKILL.md:158），只值得借「有東西才生一頁」的形狀。
pstack 自 0148b78 只有一個 commit（d457567，0.15.28）：新增 maintain-formal-verification-skill、create 技能改記覆蓋檔案與同步 commit——沿用前判決 #11 C，#10 A 加一欄。
would flip if: 使用者把「能拖」排在「零 build」之前——第一步就改為把 Chartroom 的 dist/app 整包提交進 assets/ 以 iframe 掛站；或 lib/chartroom 在 fankeel 的 Node 下限載不起來（Chartroom README.md:9 要 Node 24，fankeel 下限未查）。
unread: brief 點名的路徑都開了；只 grep 未全讀：Chartroom docs/plans/2026-10-05-chartroom.md（13,574 行）、docs/archive/2026-10-19-editor-intuitiveness.md（5,794 行）、station.md 887-1026／1152-1339／1379-1489、pstack docs/guide 01/02/07/09/10 的小修；answer-me-with-html 與 Cursor Canvas SDK（~/.cursor）不在本機，未讀。
delegated: F:/ymlab/_ext/chartroom/{README.md,TODO.md,docs/**,schema/board.schema.json,package.json,.gitignore}（opus）；F:/ymlab/_ext/chartroom/{src/**,bin/chartroom.js,examples/levelmark.board}（opus）；F:/ymlab/fankeel/{scripts/station.js,lib/station.js(grep),assets/station/station.js(grep),docs/90-agent/reference/station.md,docs/01-guide/profile.md(station 段)}（sonnet）；F:/ymlab/fankeel/docs/{03-decisions/2026-10-07-station-chartroom.md,99-archive/2026-10-08-station-chartroom-design.md,99-archive/2026-10-08-station-chartroom.md,90-agent/todo/station-15.md,90-agent/judgements/2026-10-18-cursor-plugins-pstack.md(Answer+Summary),90-agent/reports/2026-10-19-memory-vs-pstack.md}（sonnet）；cursor-plugins origin/main：README.md、third_party/(ls)、schemas/*、advisor、agent-compatibility、cli-for-agent、continual-learning、create-plugin、cursor-sdk 的 README＋tree（sonnet）；cursor-team-kit、dyl-stack、grok-voice、harness（含 docs/harness/claude-code.md、playbooks/orchestrate.md）、orchestrate（SKILL.md、references/planner.md、prompts/andon-block.md）、ralph-loop（hooks/*）、thermos 的 README＋tree（sonnet）；docs-canvas、pr-review-canvas、origin-apps、teaching 全部檔案＋cursor-team-kit/skills/pr-review-canvas/{SKILL.md,template.html,renderer.js(grep)}＋third_party/excalidraw/README.md（opus）；`git log/diff --stat 0148b78..origin/main`、pstack 全 diff、`ls-tree origin/main`、pstack/README.md 開頭（sonnet）。
checklist: 1 Chartroom README/TODO/docs/schema/package.json — answered；2 Chartroom src/bin/examples — answered；3 station.js/station.md/profile.md — answered；4 決定、兩份封存、station-15、前判決、記憶報告 — answered；5 cursor-plugins 根 README/third_party/schemas＋六個 README — answered；6 cursor-team-kit…thermos 七個＋harness/orchestrate 深讀 — answered；7 docs-canvas/pr-review-canvas/origin-apps/teaching 深讀 — answered；8 0148b78..origin/main diff 與 pstack 變化 — answered。

## Summary

### 0. 抽查結果

八位讀者各抽一處，全部與原文相符：
- Chartroom README.md:107「沒有 `x,y` 的節點是「未擺放」：畫面上自動排在已擺放內容的右側…不寫回檔案，直到有人拖過它」；package.json:27-38 只有 peerDependencies（react、react-dom ^19.2.8）與 devDependencies（vite ^6、vitest、playwright、@vitejs/plugin-react），無 dependencies。
- src/geometry/layout.js:1-2「自動排版：只擺未擺放的節點。結果固定…絕不移動已擺放的節點、不與任何節點重疊。// 純函式：不 import React、不碰 DOM」；src/server/handler.js:131 Origin≠Host → 403，:135 非 application/json → 415；src/core/ops.js:115-121 只有 add／set／del 三個 op。我自己 `wc -l`：core＋geometry＋server＝2,647 行，react＋app＝3,885 行，與讀者的「約 2,650／4,500（含 CSS）」一致。
- scripts/station.js:399-430 `/chartroom/<name>/…` 在 nonce 檢查之前交給 `require(<station.chartroom>/src/server/handler.js).createHandler(file, {staticDir:'dist/app'})`，註解明寫「on purpose… the AI posting ops from a shell has no nonce to send」；:433-438 `formOf()` 是唯一的 nonce 檢查，錯誤 403。
- docs/03-decisions/2026-10-07-station-chartroom.md:16-34 三段裁定原文如讀者所引（白板隨內容出現、寫入不開 nonce 例外、整個併進 fankeel 不引用安裝路徑）。
- cursor-plugins origin/main：advisor/README.md:3、orchestrate/README.md:3 與 :9-10（bun、CURSOR_API_KEY）、cursor-team-kit/skills/pr-review-canvas/SKILL.md:155-163（python http.server 8432 --bind 127.0.0.1）、docs-canvas SKILL.md:21-24 與 :40-45（~/.cursor/skills-cursor/canvas SDK；「DAG layout, mermaid」）、pstack/README.md:153 新增 maintain-formal-verification-skill 列、`git log 0148b78..origin/main` 恰一個 commit、third_party/excalidraw/README.md:3-5——全部相符。

一處措辭校正：brief 與 station.md 說「serve 印出的 nonce」，實際上 nonce 不印在終端機，而是埋在頁面資料 `station-data.js`（scripts/station.js:316 產生、:471 序列化進 `window.STATION`；終端只印網址 :860）。不影響判定。

### 1. Chartroom 取代 Mermaid：判定與缺口表

**判定：對「AI 把架構圖／流程圖畫給人看」這個用途，Chartroom 今天已經比 Mermaid 好，可以取代；對 Mermaid 的其他圖種（sequence、state、gantt、class、ER、timeline）它沒有也不該追。** 真正擋在「取代」前面的是打包與規矩，不是畫法。

已達成的（每項有檔）：
- 一次寫完：一行一個 JSON 物件，四種紀錄 view／node／edge／stroke，node 只有 `in` 必填（README.md:93-94；schema/board.schema.json:56-58；src/core/fields.js:4、:78）。沒有座標就自動排版（README.md:107；layout.js:1、:206 最長路徑分層＋重心掃描，確定性），且「沒選『規定 AI 一律給座標』，因為 AI 送的子板常常只有結構」（docs/decisions/2026-10-06-todo-patrol.md:16）。examples/levelmark.board 第 15-17 行的子板節點就全無座標。
- 連線：直角、A* 繞障礙、找不到退 L 形（route.js:1、:6、:23），同側多線分埠（route.js:158-220），標籤沿線找七個位置避讓（scene.js:10、:102-114）；箭頭 none／end／both，頭型 arrow／circle／cross（fields.js:13、:16）。
- 形狀：19 種，註解說明一對一對應 Mermaid flowchart 形狀（fields.js:6-11）。
- 人改回去 AI 看得到：檔案是唯一真相，三個寫入口收斂到同一個 apply→原子寫→廣播（store.js:1、:176）；AI 一次讀一層（context.js:24-31；README.md:23）；「改一個節點只動一行 diff」（README.md:110）。
- 非本人變更發光＋變更卡＋一鍵復原（反操作由 diff 算出，ops.js:148；Editor.jsx:83-97、:93）；AI 提案可「套用／套用但不含座標／不套用」（ProposalBar.jsx:1-23、ops.js:157）。
- 子板內嵌同一檔，`detail` 指向另一個 view，麵包屑與子板樹（fields.js:45；viewTree.js:1-33；README.md:17）。
- 無瀏覽器輸出：`chartroom export --svg`（bin/chartroom.js:21-26、:211-230），幾何層純函式（scene.js:2、svg.js:2）。
- TODO.md 兩節皆空（TODO.md:1-6）。

缺口表：

| 缺口 | 證據路徑 | 建議 |
|---|---|---|
| 只有「結構圖」一種圖型；Mermaid 的 sequence／state／gantt／class／ER 沒有對應 | src/core/fields.js:4 `KINDS=['view','node','edge','stroke']`；README.md:94 | 不追全替代。技能規則寫成：架構圖、流程圖、依賴圖用 .board；時序與甘特留 Mermaid |
| 離開瀏覽器只剩 SVG；Mermaid 在 GitHub／文件工具可直接渲染 | bin/chartroom.js:21-26（export --svg 是唯一無瀏覽器輸出）；handler.js:188 頁面要先 `npm run build` | 監控站把 .board 渲成 SVG（第一步）；文件要圖時把匯出的 SVG 放進 docs |
| JSON 每行必帶 `"in"`，比 `A-->B` 囉嗦；刻意「沒有文法」 | README.md:93；design.md:38；examples/levelmark.board:4-12 | 接受。AI 不寫座標、不寫 w/h 即可，技能附 10 行範本 |
| 打包：React 19 peer dep、Vite build、dist/ 不進 git、要 Node 24 | package.json:5、:20-38；.gitignore `dist/`；README.md:9；`git ls-files dist` 空 | 見第 2 節 |
| 寫入沒有 nonce；現行站的 `/chartroom/` 路由刻意繞過 nonce——與裁定相反 | handler.js:131、:135、:196（Host／Origin／JSON 三道）；scripts/station.js:399-406；decision:24；todo/station-15.md 完成紀錄「Chartroom 的 POST 不驗 nonce」 | 第二步統一走監控站 `POST /board`＋`formOf()`；AI 走檔案通道（Edit .board），本來就不需要 HTTP |
| 板子是每專案常駐 `<root>/.fankeel/architecture.board`——與「有東西要給人看才出現」相反 | lib/station.js:419-421；scripts/station.js:417-418；decision:18 | 板檔跟著 task 的 build 產物走（`.fankeel/build/<task>/<name>.board`），session 卡片出現「AI 畫的圖」；task 歸檔即隨之歸檔 |
| 監控站沒有「AI 新畫了圖」的訊號，只有專案卡片一條連結、開新分頁 | assets/station/station.js:2717-2719；station.md:1106 | 第一步在 session 序列化加 `boards[]`，現有 3 秒輪詢（station.js:6481）自然帶到 |
| 從安裝路徑 `require` Chartroom，fankeel 不帶頁面——與「整個併進、不引用安裝路徑」相反 | scripts/station.js:419-421；lib/profile.js:39；profile.md:46；decision:30 | 第二步落地後刪 `station.chartroom` 鍵與 `/chartroom/` 路由 |
| Node 端量字是近似（CJK 1em、其他 0.6em），SVG 中文字寬可能略偏 | measure.js:16-26 | 接受；驗收看 examples/levelmark.board 的 SVG |
| 無 PNG CLI 匯出（只在瀏覽器） | src/react/export.js:2；design.md:55-56 | 不需要 |

Chartroom 自己的設計文件早已預留這條路：「FanKeel 優先：放進預建、自足的 dist/…由 FanKeel 既有的 station 伺服器掛載 createHandler，不新增第三個伺服器」（docs/plans/2026-10-05-chartroom-design.md:52、:143-144），並在 smoke test 模擬掛在 `/cr/` 子路徑（plan:13170）。一個已知坑：`store.apply` 同步重試以 `Atomics.wait` 最壞卡宿主事件迴圈約 630 ms（plan:38）——併進站時要記得。

### 2. 打包方式：一個選擇

**選「改寫成免 build」，分兩層，而且第一層不用改寫。** 把 Chartroom 的 src/core、src/geometry、src/server 原樣搬進 fankeel 的 lib/chartroom/（它們只 import `node:*` 與彼此，README.md:177「CLI 與 serve 只用 Node 標準庫」），監控站用 toSVG 直接畫；拖拉編輯器之後以 vanilla JS 重寫在 assets/station/ 下，因為幾何、路由、diff、反操作全是純函式，React 層其實只是把 scene 畫出來（Board.jsx）加互動（interact.js）。

不選「提交建好的 dist/app」：那是一包含 React 19 的壓縮碼，審不了、diff 不了，等於把 build 步驟藏到另一個 repo；而且 Chartroom 自己把 dist/ 排除在 git 外（.gitignore），fankeel 要自己跑 `npm install && npm run build` 才拿得到——「零依賴」只是換了地方。不選「維持安裝路徑 require」：使用者 10-07 第 3 題明說「不另裝 Chartroom、不引用它的安裝路徑」。

一個要先驗的前提：Chartroom 是 ESM（package.json:5 `"type":"module"`）、要求 Node 24（README.md:9）；fankeel 是 CJS，station.js 已用 `require(esm)`（:421）。搬進來要嘛保留 .mjs 以 `require(esm)` 載入，要嘛改成 .cjs。fankeel 的 Node 下限我沒查。

### 3. cursor/plugins 全表（origin/main d457567）

判定字母：A 採用／B 改造／C 拒絕／D 已等價。「前判決」指 docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md 的列號。

| plugin | README 說它做什麼 | 判定 | 落在 fankeel 哪個檔 |
|---|---|---|---|
| advisor | 「給 Cursor 的 agent 一個更強的第二模型，在重大決定前、卡住時、宣告完成前諮詢」（advisor/README.md:3）；hooks.json 綁 Cursor 事件，狀態在 .cursor/advisor/ | D | fankeel-judge 代理即「決定前問一次」、verify 的 adversary reviewer 即「完成前」；前判決 #30 C 維持 |
| agent-compatibility | 「檢查 repo 在 agent 工作流下撐不撐得住，配 npm CLI 與四個審查 agent」（README.md:3）；`npx -y agent-compatibility@latest`（:47） | C | 要外部 npm 套件；前判決 #42 C |
| cli-for-agent | 「給 coding agent 驅動的 CLI 的模式：非互動旗標、分層 --help、stdin、--dry-run、冪等」（README.md:3） | C | 可當 scripts/*.js --help 的檢查表，不需引入；前判決 #42 C |
| continual-learning | 「從逐字稿變化自動、增量更新 AGENTS.md」（README.md:3）；要 bun、Cursor stop hook、followup_message | C | fankeel-retro 是「使用者點頭才改」的版本；前判決 #31 C |
| create-plugin | 「建立 marketplace-ready Cursor 外掛的 meta 工作流」（README.md:3） | C | 無 |
| cursor-sdk | 「幫使用者在 Cursor TypeScript SDK（@cursor/sdk）上開發」（README.md:3） | C | 無 |
| cursor-team-kit | 「CI、code review、出貨、測試可靠度的內部式工作流，不需第三方整合」（README.md:3）。其 skills/pr-review-canvas 是本 repo 唯一可移植的視覺模式：AI 一次寫 body HTML，注入 template.html 的 `/* INJECT_CSS */`、`/* INJECT_JS */`、`<!-- INJECT_BODY -->` 三個 slot（template.html:8-16），寫到 /tmp（SKILL.md:136），`python3 -m http.server 8432 --bind 127.0.0.1`（:158），無 token、無 Origin 檢查，頁面唯讀、不回傳給 agent | B | 借「有東西才生一頁」的模板形狀到監控站第三步（scripts/station.js 新 GET、assets/station/ 模板）；不借第二台伺服器 |
| docs-canvas | 「把文件渲染成可導覽的 Cursor Canvas 而非扁平 markdown」（README.md:3）；自稱「initial scaffold」（README.md:7）、「Status: placeholder」（SKILL.md:16）；全靠 ~/.cursor/skills-cursor/canvas SDK（SKILL.md:23）；圖用「DAG layout, mermaid」（:44） | C | 私有 SDK，無可移植物 |
| dyl-stack | 「疊在 pstack 上的個人風格：幾道閘門、一貼就完的 PR review、Figma→UI 流程」（README.md:3） | B（前判決 #35 維持） | 與監控站無關 |
| grok-voice | 「在 Grok 上做語音功能的四個技能」（README.md:3） | C | 無 |
| harness | pstack 的 Claude Code 生成副本（harness/pstack/README.md:3「Do not edit it by hand」）＋ Cursor→Claude Code 名稱對照表（docs/harness/claude-code.md:3、:9 Task→Agent、:23 cloud→worktree）。orchestrate playbook 的狀態面全是檔案：status.md 由 units.tsv／ledger.tsv 推導、gates.md 停人閘門「問題、選項、沒回答時的預設」（playbooks/orchestrate.md:30-32）；無 HTTP、無成本追蹤 | D | 監控站已從檔案畫閘門、各 session 狀態與花費（lib/station.js:776-807）；gate.station 逾時即「沒回答時的預設」（profile.md:47）；前判決 #38 D |
| orchestrate | 「透過 Cursor SDK 把大任務扇出到平行雲端 agent；planner 發任務、worker 往上交接、script 從磁碟與 git 重建樹」（README.md:3）；要 bun＋CURSOR_API_KEY（:9-10）；監看面只有 Slack 串、`inspect` CLI、attention.log；Andon 停線「Halts new spawns across the whole tree」（prompts/andon-block.md）；沒有使用者閘門 | C | 前判決 #24-27 維持；「站上停線鈕」仍可討論，但站今天只寫檔不送訊號 |
| origin-apps | 「在 Cursor Origin（code forge）上建 Origin App、呼叫 API、收 webhook、搬 GitHub App」（README.md:3-7）；只產 ORIGIN-PORTING-BRIEF.md（:55） | C | 無視覺面（brief 猜錯方向） |
| pr-review-canvas（根層） | 「把 PR diff 渲染成依審查理解順序而非檔案樹順序組織的 Cursor Canvas」（README.md:3）；同樣只靠 Canvas SDK（SKILL.md:17）；要 gh（:21） | C（排序準則 B，小） | 「Core logic → Wiring & integration → Boilerplate」（SKILL.md:27）可寫進 reviewer 讀 diff 的指示 |
| pstack（只列 0148b78 之後） | 唯一 commit d457567「chore(pstack): bump to 0.15.28」：新增 skills/maintain-formal-verification-skill/SKILL.md（+58，disable-model-invocation，「只改驗證、不改產品碼」，回報「哪些失敗是驗證漂移、哪些是程式 bug」）；create-formal-verification-skill 預設 TLA+、「記錄每個檢查覆蓋哪些檔案／函式，以及上次確認的 commit」；setup-pstack 新第 8 步主動提議；poteto-help 加 Claude Code 安裝句（`/plugin install pstack@cursor-plugins`，指令加 `pstack:` 前綴）與 /ketchup 配方；docs/guide/06 新節「Prove a property…」；harness 鏡像同步；marketplace 新 third_party/meta-ads、zoom 1.0.2 | C（formal 工具）／B（「程式改了就重對驗證、分清漂移與 bug」） | 前判決 #10 每功能驗證表的落點加「同步 commit」一欄；#11 C 維持 |
| ralph-loop | 「讓 Cursor 自我循環，每回合把同一提示餵回去直到完成」（README.md:3）；停於 `<promise>` 或 max_iterations（hooks/stop-hook.sh:44-51），預設無上限（README.md:27） | C | 沒有閘門；前判決 #32 C |
| teaching | 「教學工作流：技能地圖、練習計畫、回饋迴圈」（README.md:3）；純文字、只用 Ask user（SKILL.md:22） | C | 無視覺面（brief 猜錯）。真正的畫圖教學句在 pstack/skills/teach/SKILL.md:17「畫一個系列，每張重畫上一張、只多一個部件」——可寫進 AI 畫板技能：一批 ops 加一個部件，發光正好顯示「這次多了什麼」 |
| thermos | 「熱核分支審查：正確性與安全深審、嚴苛可維護性準則、平行子代理編排」（README.md:3）；兩個子代理平行再彙整（:46-49） | B（前判決 #33 維持） | reviewer 紀律；與監控站無關 |
| third_party/ | 數十個 SaaS 的 MCP 連接器（各含 .cursor-plugin/plugin.json、mcp.json，少數有 skills/）；本次新增 meta-ads（遠端 MCP `https://mcp.facebook.com/ads`）。excalidraw 是「透過 Excalidraw 官方遠端 MCP 從聊天畫並匯出手繪圖」（third_party/excalidraw/README.md:3-5） | C | excalidraw 是 Chartroom 的對照組：雲端、檔案不是真相、無 nonce；playwright 已由 fankeel 的 render script 等價 |
| schemas/ | plugin.schema.json「defines a single Cursor plugin's metadata, components, and configuration」、marketplace.schema.json（各 :5） | C | 無 |
| 根 README | 外掛總表；`.cursor-plugin/marketplace.json` 列全部外掛；每外掛一個 `.cursor-plugin/plugin.json`（README.md:3、:115-131） | — | 無 |

小結：18 個外掛裡，與「AI 畫給人看」有關的只有 docs-canvas、pr-review-canvas（私有 SDK，C）與 cursor-team-kit 的 HTML 頁（B，借形狀）；與「監控面」有關的只有 harness／orchestrate 的檔案狀態與 Slack 鏡像（D／C）。沒有一個外掛用 React 白板、react-flow、d3 或自動排版（讀者 grep 無果）。

### 4. 監控站擴充順序

**第一：看（零 build 進站）。**
- lib/chartroom/{core,geometry,server}/：從 Chartroom src/ 原樣搬，含 README.md:177 聲明的零相依；以 station.js 既有的 `require(esm)` 載入或改 .cjs。
- scripts/station.js：新 GET `/station/board/<session>/<name>.svg`——讀 `<root>/.fankeel/build/<task>/<name>.board` → core/format 解析 → geometry/layout（只擺未擺放的）→ scene → svg.toSVG，`image/svg+xml`。GET 不碰 nonce，與 `/station/shot/<id>.png`（:515-535）同一類。
- lib/station.js：session 序列化加 `boards[]`；assets/station/station.js 的 session 卡片列「AI 畫的圖」，3 秒輪詢自然更新（:6481）。
- 一條技能規則：AI 要畫架構／流程／依賴圖時，寫 `.board`（一行一紀錄、不寫座標、每批加一個部件）而非 ```mermaid；時序與甘特仍用 Mermaid。
- 測試：node --test 用 examples/levelmark.board 產 SVG、比對節點數與邊數；再用一張無座標板確認自動排版不重疊。
- 現有 `/chartroom/<name>/` 路由暫留，等第二步取代。

**第二：拖（nonce 統一、刪安裝路徑）。**
- assets/station/board.js（vanilla JS）：平移／縮放／選取／拖曳／Enter 鑽入子板／麵包屑；拖完送 `POST /board`，form 帶 `nonce`＋`ops`（JSON 字串），走 `formOf()`。
- scripts/station.js：`POST /board` → lib/chartroom/server/store.js 的 apply（原子寫、`If-Match` rev 衝突 409）。變更卡與發光：頁面輪詢 rev，反操作用 core/diff.js 算；不必搬 SSE（站本來就輪詢）。
- 刪 `/chartroom/<name>/` 路由（station.js:399-430）、`station.chartroom` 鍵（lib/profile.js:39；profile.md:46）、station.md:1061-1108 改寫；todo/station-15.md 完成紀錄加一句「三項裁定被 2026-10-07 決定取代」。

**第三：一次性 HTML 答覆頁。**
- AI 有「非圖」的東西要給人看（比較表、diff 走讀、驗證證據）時，寫 `.fankeel/build/<task>/show/<name>.html`（只有 body，無外部 script／CDN）；station GET `/station/show/<id>/<name>` 用 `<iframe sandbox>`（不給 allow-same-origin）包起來，頁內 script 拿不到父頁的 nonce；session 卡片列出。借 cursor-team-kit 的 template＋slots 形狀（template.html:8-16），不借 python http.server。
- 前提：先讀 answer-me-with-html（10-07 決定:34 也要求；本判決未讀）。

### 5. 刻意不做的事與理由

- 不提交 Chartroom 的 dist/app：壓縮的 React 19 包審不了，且 build 仍在別的 repo（.gitignore `dist/`；package.json:21）。
- 不保留 `station.chartroom` 安裝路徑與 `/chartroom/` 的 nonce 例外：直接違反 2026-10-07 裁定 :24 與 :30；station.js:399-406 的註解理由（「AI 從 shell 送 ops 沒有 nonce」）在 AI 走檔案通道後不成立（store.js:1 三入口等價）。
- 不做每專案常駐的 `architecture.board`：裁定 :18；板子跟內容走。
- 不讓 Chartroom 覆蓋 Mermaid 全部圖種：它的紀錄只有四種（fields.js:4）；sequence／gantt 硬塞進 node/edge 只會比 Mermaid 難讀。
- 不採 docs-canvas、pr-review-canvas（根層）：綁 ~/.cursor Canvas SDK（SKILL.md:23／:17），無一行可移植。
- 不採 third_party/excalidraw：遠端 MCP，檔案不是真相、無 nonce、離線不可用。
- 不採 cursor-team-kit 的 python http.server：第二台無 token 的伺服器；站是唯一的伺服器與唯一的 nonce 來源。
- 不採 orchestrate 的 Slack 鏡像／Andon／雲端 agent、ralph-loop、continual-learning：要 bun＋Cursor API 或 Cursor hooks，且都是「不問人就繼續」，與閘門由使用者答的設計相反（前判決 #21、#26、#31、#32 已 C）。
- 不在這一步搬 SSE：站的 3 秒輪詢已夠（assets/station/station.js:6481）；Chartroom 的事件流（handler.js:153-159）留到第二步評估是否需要。

### 6. 一處要先解的矛盾

docs/03-decisions/2026-10-07-station-chartroom.md（status: decision）與 docs/99-archive/2026-10-08-station-chartroom-design.md（status: current，卻在 99-archive）在三件事上相反，而後者已落地（todo/station-15.md state: done，sha 36f226c7；scripts/station.js:399-430）。設計頁從未引用決定頁。第一步動工前，先把 station-15 的完成紀錄與 station.md:1061-1108 標成「被 2026-10-07 決定取代」，否則下一位讀者會把現行路由當成裁定。
