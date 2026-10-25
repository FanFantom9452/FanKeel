---
judged: 2026-10-25T16:43:23.999Z
model: fable
agent: fankeel-judge
task: "Mermaid 渲染器（Ply／Beautiful Mermaid／官方）對比 Chartroom：框架該用哪個"
session: 084e9936-a15b-4a76-992e-6fb0b2e72c60
stage: survey
---

# Brief 32 — Ply / Beautiful Mermaid / official Mermaid vs our Chartroom: what should fankeel draw diagrams with?

## Question

# Brief 32 — Ply / Beautiful Mermaid / official Mermaid vs our Chartroom: what should fankeel draw diagrams with?

## Question

The user watched a video (Muki, "Mermaid 太肥太慢？Obsidian 開源的 Ply") comparing five ways to turn text into diagrams and asked: we already have Chartroom vendored — pull everything into one analysis and decide **what fankeel should use** for diagrams.

## What the video claims (unverified — the judge's readers may check ply.run / GitHub if they can reach it; otherwise treat as claims)

- **Ply** (Obsidian, MIT): renderer for standard Mermaid syntax → SVG string. Claimed 0 deps, ~230KB gzipped (vs ~1.6MB mermaid.js), 0.05–0.3 ms per diagram, **fully synchronous** `render()` (no Promise, no DOM measuring), all colours as **CSS variables** so theme switch needs no re-render. Covers almost every official Mermaid diagram type; has a published incompatibility list. Author shipped a postinstall patch for state-diagram curves (v1.6.0).
- **Beautiful Mermaid** (Craft): Mermaid → SVG and **ASCII** output, 15 themes, only 6 diagram types (flowchart, state, sequence, class, ER, XY).
- **Official mermaid.js**: full coverage, ~1.6MB, async, needs DOM, re-render on theme change.
- **Diagram Design** (an agent skill, MIT): natural language → hand-tuned SVG, 40+ types; not diffable, non-deterministic.
- **AI hand-written SVG**: unlimited, but coordinates guessed; breaks as nodes grow.
- Video's integration pattern: render → inject theme CSS vars → DOMPurify sanitise → cache by content; rule-based autofix before calling an AI for broken syntax.

## Background in this repo (read these; they decide the answer)

- `docs/90-agent/judgements/2026-10-19-chartroom-mermaid-station.md` — the earlier judgement that chose Chartroom over Mermaid and vendored its pure-Node layer. Read its pick and Summary first; this question reopens it.
- `docs/03-decisions/2026-10-07-station-chartroom.md`, `docs/03-decisions/2026-10-20-task-boards-as-svg.md`, `docs/03-decisions/2026-10-15-pane-svg.md` — standing decisions.
- `lib/chartroom/` (README, core/, geometry/) — what we vendored, its `.board` format, `toSVG`.
- Where Mermaid is still referenced: `assets/station/docs-page.js`, `lib/chartroom/core/fields.js`, `lib/chartroom/geometry/measure.js`, `scripts/docs-audit.js`, `skills/fankeel/SKILL.md`, `skills/fankeel-audit/SKILL.md`, `skills/fankeel-design/SKILL.md`, `docs/02-architecture/pipeline.md`, `docs/01-guide/scanners.md`. Find out whether the station renders ```mermaid blocks in docs today, and how (mermaid.js from CDN? not at all?).
- `package.json` / dependency policy: fankeel ships as a Claude Code plugin with (check) zero runtime npm deps. A dependency is a real cost.
- `profile`: `station.chartroom` — the external Chartroom install path for the architecture whiteboard.

## Options

A. Keep Chartroom as the only renderer (`.board` → SVG via vendored `lib/chartroom`); docs keep ```mermaid blocks unrendered or as-is.
B. Chartroom for AI-drawn task boards, **plus** Ply (vendored or as a station-only asset) to render ```mermaid blocks in docs on the station page.
C. Replace Chartroom's board format with Mermaid syntax rendered by Ply everywhere.
D. Something else (e.g. Beautiful Mermaid's ASCII for terminal/gate reports; or nothing — no change).

Weigh: zero-dep policy, the two distinct uses (agent-authored boards vs human-authored doc diagrams), GitHub-native rendering of ```mermaid in the docs tree, diffability, maintenance (patches, incompat list), and whether anything in the repo actually fails today for lack of a Mermaid renderer.

## What counts as an answer

One pick naming which renderer serves which use in fankeel (boards, docs page on the station, terminal/gates), and the first concrete change if any — or an explicit "no change" with the reason. Claims about Ply that could not be verified must be labelled as such.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文.

## Answer

pick: A — Chartroom（vendored `lib/chartroom`，`.board` → SVG）仍是唯一渲染器；docs 裡的 ```mermaid 原樣保留、交給 GitHub 原生渲染；station 文件頁維持現狀（純文字 `<pre><code>`）；終端與 gate 維持純文字。不加 Ply、不加 Beautiful Mermaid、不加 mermaid.js——「無變更」。
why: (1) 今天沒有任何東西因為缺 Mermaid 渲染器而失敗：tests 只把 mermaid 當文字解析（tests/docs-audit.test.js:328-334、tests/pipeline-doc.test.js:29），hooks 無 mermaid；station 文件頁對所有 fence 一律輸出 `<pre><code>`（assets/station/docs-page.js:424-429），沒有 CDN、沒有壞掉的呼叫。(2) 兩種用途已各有歸宿且是既定裁決：agent 畫的架構／流程／依賴圖是 `.board`、由 station 伺服端畫成 SVG（docs/03-decisions/2026-10-20-task-boards-as-svg.md:8；skills/fankeel-design/SKILL.md:224-229）；人寫的 docs 圖只有 9 個 ```mermaid flowchart（docs/02-architecture/pipeline.md:417 等 8 處、README.md:50），都在 GitHub 原生渲染，10-19 判決早已把這點列為「不追全替代」的理由（judgements/2026-10-19:165-166）。(3) 零依賴是硬規矩：package.json:1-15 沒有 dependencies 鍵，10-07 裁定「沒有 build、沒有 dependency」（station-chartroom.md:30）；vendored lib/chartroom 是 1768 行可讀原始碼、零外部 import（lib/chartroom/README.md:3-7）。影片稱 Ply 約 230 KB gzipped——那是壓縮 bundle，10-19 判決已因「壓縮包審不了、diff 不了」拒絕過同類做法（judgements/2026-10-19:182、:237）。(4) Ply 的每一項宣稱皆無法驗證：ply.run 回空內容、github.com/obsidianmd/ply 404、npm `ply` 是無關套件——不能拿未驗證的第三方去推翻一週前的裁決。(5) 10-07 的方向是讓白板「取代 Mermaid 在 AI 與人溝通上的位置」（station-chartroom.md:8、:34）；在 station 加一個 Mermaid 渲染器是往反方向走。
would flip if: Ply 的「可讀原始碼」（非 bundle）被驗證為 MIT、零依賴、免 DOM、行數可比 lib/chartroom 一樣逐檔 vendor 審閱，且使用者明說 station 文件頁必須把 pipeline.md 的 8 張 flowchart 畫成圖——那時才值得考慮 B（只放 station 文件頁、不動 `.board`）。或 docs 的主要閱讀面不再是 GitHub／編輯器而是 station。
unread: 倉庫內 brief 點名的檔案全部由 reader 開過、無遺漏；外部來源讀不到——ply.run 回空 body、github.com/obsidianmd/ply 與 raw README 皆 404、npm `ply` 為無關套件、`@obsidianmd/ply` 404，故 Ply 的 a–g 七項宣稱（MIT、零依賴、230 KB、同步 render、CSS 變數、不相容清單、Node 免 DOM）全部標為「未驗證」。lib/chartroom 上游 `F:/ymlab/_ext/chartroom` 的授權檔未開。context.md 未寫入：read-only hook 擋下本 agent 的任何磁碟寫入，且未給 session id。
delegated: opus — docs/90-agent/judgements/2026-10-19-chartroom-mermaid-station.md、.fankeel/build/ask/1-chartroom-mermaid-station-brief.md；sonnet — docs/03-decisions/2026-10-07-station-chartroom.md、docs/03-decisions/2026-10-20-task-boards-as-svg.md、docs/03-decisions/2026-10-15-pane-svg.md；sonnet — lib/chartroom/README.md、lib/chartroom/package.json、lib/chartroom/core/{fields,format,util}.js、lib/chartroom/geometry/{lanes,layout,measure,route,scene,shapes,svg}.js、lib/board.js（grep）；sonnet — assets/station/docs-page.js、scripts/docs-audit.js；sonnet — skills/fankeel/SKILL.md、skills/fankeel-audit/SKILL.md、skills/fankeel-design/SKILL.md；sonnet — docs/02-architecture/pipeline.md、docs/01-guide/scanners.md、docs/**、README.md、tests/**、hooks/**（grep mermaid／.board）；sonnet — package.json、.fankeel/profile.json、scripts/station.js、docs/01-guide/profile.md、docs/03-decisions/2026-09-04-session-station-design.md（grep）；sonnet — 外部 ply.run／GitHub／npm（curl，全部讀不到）。
checklist: 1 judgements/2026-10-19 的 pick／why／flip — answered；2 station-chartroom 裁定範圍 — answered；3 task-boards-as-svg 的 `.board` 與作者 — answered；4 pane-svg 是否限制依賴或渲染器 — answered（無；只說終端不畫圖）；5 lib/chartroom 內容、`.board` 格式、toSVG 入口 — answered；6 fields.js／measure.js 的 Mermaid 引用性質 — answered（純註解）；7 station 文件頁是否渲染 ```mermaid — answered（否，`<pre><code>`）；8 docs-audit.js 對 mermaid 的處理 — answered（目錄清單稽核）；9 三份 SKILL.md 的 Mermaid 規則 — answered；10 pipeline.md／scanners.md 的 mermaid 內容 — answered；11 package.json 依賴與政策 — answered；12 profile `station.chartroom` 的意義 — answered；13 ```mermaid 數量與今天是否有東西失敗 — answered（9 個、無失敗）；14 外部驗證 Ply — not answered（網路讀不到，標為未驗證）。

## Summary

### 問題與判定

使用者看了 Muki 的影片（Ply／Beautiful Mermaid／官方 mermaid.js／Diagram Design／AI 手寫 SVG 五種比較），問 fankeel 既然已經 vendor 了 Chartroom，該用哪個畫圖。判定：**選 A，無變更**。三個面各自的渲染器如下——

| 用途 | 渲染器 | 依據 |
|---|---|---|
| agent 畫的架構／流程／依賴圖（任務板） | Chartroom `.board` → `lib/board.js` → vendored `lib/chartroom` 的 `toSVG`，畫在 session 卡片 | docs/03-decisions/2026-10-20-task-boards-as-svg.md:8、:14-16；skills/fankeel-design/SKILL.md:224-229；lib/chartroom/geometry/svg.js:9 |
| 人寫的 docs 圖（```mermaid） | 不裝渲染器；GitHub 原生渲染；station 文件頁維持 `<pre><code>` 純文字 | assets/station/docs-page.js:424-429；judgements/2026-10-19:166 |
| 終端／gate 報告 | 純文字；不需要 Beautiful Mermaid 的 ASCII | docs/03-decisions/2026-10-15-pane-svg.md:27「終端不畫圖，維持文字」 |

第一個具體變更：**沒有**。理由寫在下面。

### 各 reader 的發現

**1. 10-19 判決（opus）。** `pick:`（judgements/2026-10-19-chartroom-mermaid-station.md:123）是把 Chartroom 純 Node 層原樣併入 `lib/chartroom/`、station 把 `.board` 畫成 SVG，「零 build、零依賴」。:124 說 Chartroom 在架構圖／流程圖已勝過 Mermaid（自動排版、A* 繞線、形狀涵蓋 flowchart 全套）。:149 明確劃界：「對 Mermaid 的其他圖種（sequence、state、gantt、class、ER、timeline）它沒有也不該追」。缺口表 :165「技能規則寫成：架構圖、流程圖、依賴圖用 .board；時序與甘特留 Mermaid」、:166「Mermaid 在 GitHub／文件工具可直接渲染……文件要圖時把匯出的 SVG 放進 docs」。:182、:237 拒絕提交 Chartroom 的 dist/app：「壓縮的 React 19 包審不了、diff 不了……『零依賴』只是換了地方」。:222 的技能規則：AI 畫架構／流程／依賴圖時寫 `.board` 而非 ```mermaid。這份判決完全沒有談「在 station 文件頁渲染 ```mermaid」——因為那不是它要解的問題。抽查 :163-167 內容與 reader 引文一致。

**2. 三份裁決（sonnet）。** 2026-10-07-station-chartroom.md:8「目標是取代 Mermaid 在 AI 與人溝通上的位置」、:30「fankeel 現在沒有 build 步驟、沒有 dependency……不另裝 Chartroom、不引用它的安裝路徑」、:34「AI 要把架構或流程畫給人看時，用白板而不是 Mermaid」。2026-10-20-task-boards-as-svg.md:8 任務的 `.board` 由 station 伺服端畫成 SVG；:14 只複製 10 個檔 1768 行；:22 SVG 放 `<img>` 裡不能執行 script。2026-10-15-pane-svg.md 不限制依賴或渲染器，只有 :27「終端不畫圖，維持文字」。抽查 station-chartroom.md:28-34 與引文一致。

**3. vendored lib/chartroom（sonnet）。** README.md:3-7：從 Chartroom commit 47506de 原樣複製 10 個檔 1768 行，ESM，`lib/board.js` 以 dynamic import 載入，`src/server/` 未複製；:9「Do not edit these files: re-copy」。格式 :14-18：JSON Lines、header + view/node/edge/stroke、不寫 x/y/w/h。所有 import 皆相對路徑、無外部套件、連 `node:` builtins 都沒有；geometry 各檔有「不 import React、不碰 DOM」的註解。Mermaid 只出現在三行註解：core/fields.js:6（形狀對應 mermaid flowchart）、:24（筆畫上限沿用 LevelMark 的 mermaid-stroke-validator）、geometry/measure.js:9（圖片預設尺寸沿用 mermaid-label-measure）——**沒有任何 runtime 依賴 Mermaid**。唯一程式呼叫端是 lib/board.js:57-60。抽查 README.md:1-26 與引文一致。

**4. station 文件頁與 docs-audit（sonnet）。** docs-page.js 是手寫 markdown 轉 HTML：:424-429 遇到 ``` 就掃到下一個 ``` 為止、整段輸出 `<pre><code>`，**不看語言標籤**，所以 ```mermaid 就是純文字區塊；沒有 `<script`、沒有 CDN、沒有 import()。檔內的「mermaid」全是 UI 字串（:86、:153-154、:343-345，「Diagrams missing files」欄）。scripts/docs-audit.js:76 以 `MERMAID_FENCE` 認 fence、:51-54 註解說明：mermaid 圖若列了一個目錄大半卻漏檔，就是過期清單——這是**稽核**而非渲染，不禁止、不轉換。抽查 docs-page.js:420-431 與引文一致。

**5. 三份 SKILL.md（sonnet）。** skills/fankeel/SKILL.md:494 與 skills/fankeel-audit/SKILL.md:202 都只有 drift 稽核那一列（mermaid 圖列目錄大半即視為清單）。skills/fankeel-design/SKILL.md:224-229：「**A task's diagram is a `.board`.**……Sequence and gantt diagrams stay Mermaid.」tests/board-docs.test.js:21-25 把這句鎖住。沒有任何技能禁止 mermaid、要求轉成 `.board`、或宣稱 station 會渲染 mermaid。抽查 SKILL.md:222-230 與 board-docs.test.js:1-27 與引文一致。

**6. docs 裡的 mermaid 數量與今天有沒有東西失敗（sonnet）。** 現役文件共 9 個 ```mermaid：docs/02-architecture/pipeline.md 8 個（:417、475、522、581、631、655、703、763，全是 `flowchart TD`）+ README.md:50（`flowchart LR`）；另 9 個在 docs/99-archive。skills/、agents/ 沒有。`.board` 真檔只有 tests/fixtures/levelmark.board 一個（其餘 7 個是 .claude/worktrees 複本）。docs/01-guide/scanners.md:29 只說 audit 會抓「mermaid 圖列了一個目錄大半卻漏掉其餘檔案」。tests 裡的 mermaid 全是文字解析（docs-audit.test.js:328-334、contract.test.js:167、pipeline-doc.test.js:29、render.test.js:300-336）；hooks 無 mermaid。**今天沒有任何東西因缺渲染器而失敗。** 抽查 README.md:50、pipeline.md:417、scanners.md:29 與引文一致。

**7. 依賴政策與 profile（sonnet）。** package.json:1-15：沒有 dependencies／devDependencies／peerDependencies 鍵，`"license": "MIT"`（reader 漏引此行，不影響結論），`engines.node >=22.5`。政策來源：2026-09-04-session-station-design.md:70「package.json — no dependencies」與 10-07 裁定 :30。assets／scripts／index.html 沒有任何 CDN 引用。`station.chartroom`：docs/01-guide/profile.md:46 說是「監控站從哪個 Chartroom 安裝路徑開架構白板；沒設就沒有白板」；本 repo 的 .fankeel/profile.json 未設；scripts/station.js:555-568 仍 `require(<外部路徑>/src/server/handler.js).createHandler(file, { staticDir: 'dist/app' })`——這是「能拖」的那一半，仍走外部安裝路徑，與 10-07:30「不引用它的安裝路徑」尚有落差；vendored lib/chartroom 只覆蓋「看」的那一半。這是既有缺口，不是本題的變更。抽查 station.js:550-571 與引文一致。

**8. Ply 外部驗證（sonnet）。** `curl https://ply.run` 回空 body；github.com/obsidianmd/ply 與 raw README 404；npm `ply` 是 Alan Plum 的「Function.prototype.apply wrappers」0.1.0；`@obsidianmd/ply` 404；npm search「ply mermaid」只見 `@mermaid-js/parser`。**七項宣稱（MIT、零依賴、230 KB gzipped、同步 render、CSS 變數、不相容清單、Node 免 DOM）全部未驗證**。我自己想以瀏覽器 UA 重試一次，但 read-only hook 擋下含 curl 的指令，故未再試。

### 怎麼從這些推到 pick A

**為何不選 B（加 Ply 渲染 station 文件頁的 ```mermaid）。** 唯一受益處是 station 文件頁上 9 張 flowchart 從純文字變成圖；但那些頁的主要閱讀面是 GitHub／編輯器，GitHub 原生就渲染 mermaid（10-19 判決 :166 已記）。代價是：(a) 零依賴政策——Ply 若以 npm 裝就是第一個 runtime dep；若 vendor，影片說的 230 KB gzipped 意味解壓後是 MB 級的壓縮 bundle，正是 10-19 :182／:237 拒絕 Chartroom dist/app 的同一理由（審不了、diff 不了、零依賴只是換個地方）；lib/chartroom 能 vendor 是因為它是 1768 行可讀原始碼。(b) 影片提到 Ply 有不相容清單、靠 postinstall patch 修曲線——這是一個要跟上游的活動目標，而 lib/chartroom/README.md:9 的維護模式是「不改、只重抄」，Ply 進不了這個模式。(c) 一切宣稱都未驗證。(d) 方向相反：10-07:8、:34 要白板「取代 Mermaid 在 AI 與人溝通上的位置」，在 station 加 Mermaid 渲染器是把 Mermaid 請回來。

**為何不選 C（`.board` 全面改成 Mermaid 語法交 Ply 畫）。** 這會推翻 10-19 判決與 10-20 裁決：Chartroom 的自動排版、A* 直角繞線、標籤避讓（judgements:124）是選它的實質理由，Ply 作為 Mermaid 渲染器並不提供「沒有文法、一行一紀錄、每批加一個部件」這種 agent 友善的寫法；而且 `.board` 畫在 `<img>` 裡的安全模型（10-20:22）與 lib/board.js 的管線都要重寫。拿未驗證的工具換掉已落地、已有測試鎖住的裁決，沒有理由。

**為何不選 D 的 ASCII（Beautiful Mermaid 給終端／gate）。** pane-svg.md:27 已裁定終端只畫文字；gate 報告是表格與句子，沒有圖；而且 Beautiful Mermaid 只有 6 種圖型、又是一個依賴。

**為何 A 不是「忽視問題」。** 影片的痛點（mermaid.js 太肥、async、要 DOM、換主題要重畫）fankeel 一個都沒有：它根本沒載 mermaid.js；`.board` 的 SVG 在伺服端同步畫好、無 DOM；文件裡的 mermaid 由 GitHub 負責。影片的整合模式（render → 注入主題變數 → DOMPurify → 以內容快取）也是為瀏覽器內 mermaid.js 設計的，fankeel 的 `<img>` SVG 不需要 DOMPurify。

### 可以補一句給使用者的提醒

本題無變更，但 reader 7 看到的既有落差值得另立 todo（不屬本題）：scripts/station.js:555-568 的「可拖」白板仍走 profile `station.chartroom` 的外部安裝路徑與 `dist/app`，與 2026-10-07-station-chartroom.md:30「不引用它的安裝路徑」尚未對齊；10-19 判決 :129 也已預告「拖」那一半要另外以 vanilla JS 改寫。若將來 Ply 的真實倉庫與原始碼能讀到、且使用者要 station 文件頁把 pipeline.md 的圖畫出來，再重開 B；在那之前 docs 的 ```mermaid 原樣保留。
