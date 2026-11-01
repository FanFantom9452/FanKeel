---
judged: 2026-11-01T18:04:45.302Z
model: fable
agent: fankeel-judge
task: "評估 vercel-labs/agent-desktop 對 fankeel 有沒有用"
session: 8e732f8b-dc93-427d-a338-b6f0f047d998
stage: survey
human: yes
---

# Brief 47 — vercel-labs/agent-desktop: is it any use to fankeel?

## Question

# Brief 47 — vercel-labs/agent-desktop: is it any use to fankeel?

## Question

The user pointed at https://github.com/vercel-labs/agent-desktop and asked (繁體中文): 「分析看看這個有沒有用」 — analyse whether this is useful. Useful to what: to fankeel as a plugin (its stages, agents, render reviewer, station, phone/remote features, desktop-pane integration), or to the user's own workflow alongside fankeel. Answer: what the repo actually is, whether anything in it should change what fankeel does, and if so the first concrete step.

## What the repo is (unverified — readers must read it)

Read it from raw GitHub files (`https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/...`, try `master` if `main` 404s) or the GitHub API (`https://api.github.com/repos/vercel-labs/agent-desktop` and `/contents`), or clone into a fresh empty temp dir outside this repo; never run its code. Nothing is known about it beyond its name: it may be a desktop app for running coding agents, a computer-use / desktop-control tool for agents, a sandboxed desktop environment, or something else. Read README, package manifest(s), license, last commit date, stars, and the top-level source layout, and say from those what it is, what it depends on (Vercel AI SDK? a specific model provider? Electron? a cloud sandbox?), what platforms it runs on (fankeel's user is on Windows 11), and how mature it is.

## Background in this repo (these decide the answer)

- What fankeel already does that might overlap: the station (`scripts/station*.js` or wherever `station` lives; `docs/` pages on it), the render reviewer (`agents/fankeel-render-reviewer.md`, `scripts/render*.js`, `.fankeel/render.json`), the desktop pane / Claude desktop app integration (search docs and TODO for `pane`, `desktop`), phone/remote access (`phone.hold`, `station.remote`), and the project map `docs/README.md` / `CLAUDE.md`.
- Prior "outside thing vs ours" judgements — read pick + Summary of the newest few in `docs/90-agent/judgements/` (e.g. graphify, understand-anything, karpathy-skills, gitdiagram, archify, tencentdb-agent-memory, and the untracked `2026-11-01-*` files) and stay consistent or say why not.
- Sources ledger `docs/90-agent/reference/sources.md` and TODOs `docs/90-agent/todo/` — check whether this repo or a similar idea is already listed or planned.
- Search the whole repo for `agent-desktop`, `vercel`.
- Cost constraint: fankeel prefers not adding a dependency or a per-turn rule for something that is not used; a recommendation to the user to install a separate tool is fine and costs fankeel nothing.

## Options

A. Not useful — it solves a problem fankeel or the user does not have (say which problem it solves).
B. Borrow named ideas into fankeel — each idea, where it would go (file), and the first edit.
C. Useful to the user as a separate tool alongside fankeel (no fankeel change) — say for what, and any conflict with Claude Code / the desktop app.
D. Something else.

## What counts as an answer

What the repo is, from its files, with anything not verified labelled unverified; then one pick with a short table: what it offers → fankeel's equivalent at path, or "absent", and whether it matters.

## Shape

The judge's seven fields (`pick:` first, `ask human:` last), then `## 白話` (≤600 characters, 繁體中文), then `## Summary` in 繁體中文 including the table.

## Answer

pick: A — 對 fankeel 沒用：不裝、不借、不開 TODO。它解的是「agent 要操作原生桌面程式（Word、檔案總管那類）」，fankeel 的介面全是終端、網頁與 markdown；使用者若另有要讓 Claude Code 操作的 Windows 桌面程式，才自己裝來當獨立工具（C），fankeel 不動。
why: agent-desktop 是 Rust CLI＋C library，經 OS 無障礙樹（Windows 走 UIAutomation）讀寫桌面程式，headless 預設、無 AI 依賴、Apache-2.0、6399 星、2026-11-01 仍有 commit，Windows 全表支援（README.md:3,:12,:79,:126-135 raw main；npm/package.json 無 dependencies）。
why: fankeel 要看的畫面只有網頁：scripts/render.js:3-16 用機器現有 Chromium 拍 PNG＋DOM、--act 可點擊輸入（agents/fankeel-render-reviewer.md:34-44），.fankeel/render.json:2-19 的頁全是 localhost station；repo 內沒有任何桌面 GUI 要操作。
why: station／手機是網頁＋Tailscale（scripts/station.js:28-32），Pane 是宿主內的側欄（docs/01-guide/what-runs.md:49；gate-7.md:14 待做的是 Pane 與 station 面板分工，不是桌面控制）；agent-desktop 碰不到這兩層的問題。
why: 全 repo 無 agent-desktop／vercel；395 條 TODO 無一提桌面自動化或 computer-use；sources.md 無相關列。
why: 既往 11 件「外物 vs 自家」判決 0 件裝工具、1 件 A、6 件 B，準則「先有自己的問題再看對方」（2026-10-29-anthropic-review-practice.md:68）；這次連可借的點子也沒有，render.js 已有同構的「結構快照→動作→再拍」。
would flip if: 使用者確有要讓 Claude Code 操作的 Windows 桌面程式（如 RH 專案的 Lumos X／Remote X，docs/90-agent/todo/foreign-1.md:16）→ C；或驗出它能讀 Claude Desktop（Electron）的 UIA 樹且 Pane 真機檢查（todo compact-4/compact-6）要常做 → C 限該用途。
unread: nothing the brief named；root CLAUDE.md 不存在（reader 5 查過）。超出 brief 未讀：agent-desktop 的 docs/、skills/、CONCEPTS.md、AGENTS.md；fankeel 的 lib/station.js、lib/render.js 全文。
delegated: (1) api.github.com/repos/vercel-labs/agent-desktop + /contents + /commits；raw main README.md、npm/package.json、Cargo.toml、crates/windows/Cargo.toml、apps/docs/package.json — opus；(2) scripts/station.js、lib/profile.js、lib/remote.js、lib/qr.js、hooks/stop.js、scripts/task.js、docs/01-guide/station.md、docs/01-guide/profile.md、skills/fankeel-phone/SKILL.md — sonnet；(3) agents/fankeel-render-reviewer.md、scripts/render.js、lib/shots.js、.fankeel/render.json、docs/01-guide/what-runs.md、docs/90-agent/reference/station.md（grep）、docs/90-agent/todo/{compact-4,compact-6,gate-6,gate-7,pane-10,pane-11}.md — sonnet；(4) docs/90-agent/judgements/（76 檔列出，開 11 檔：graphify×2、understand-anything、karpathy-skills、gitdiagram、archify、tencentdb-agent-memory、kg-into-fankeel、shared-session-state、anthropic-review-practice、uncle-bob）— sonnet；(5) 全 repo grep agent-desktop／vercel、docs/90-agent/reference/sources.md、docs/90-agent/todo/（395 檔 grep）、README.md、.fankeel/map.md、docs/README.md:390,814 — sonnet
checklist: 1 外部 repo 是什麼／依賴／平台／成熟度 — answered；2 station 與 station.remote／phone.hold — answered；3 render reviewer 怎麼看畫面 — answered；4 desktop／pane 整合是否存在或規劃 — answered（有 Pane 側欄，無桌面控制，無此類 TODO）；5 fankeel 是什麼（README.md:3、.fankeel/map.md）— answered；6 既往外物判決的 pick 與準則 — answered；7 sources.md 與 todo/ 是否已列 — answered（皆無）；8 全 repo grep agent-desktop／vercel — answered（無，僅 reports/evidence 的抓包 JSON）
ask human:
  - q: 你現在或近期有沒有要讓 Claude Code 代你操作的 Windows 桌面程式？例如 RH 專案要裝設的 Lumos X／Remote X，或想用機器而不是眼睛去看 Claude Desktop 裡的 Pane。
    option: 有，桌面程式要讓 agent 操作 → C：自己用 npm 裝 agent-desktop 當獨立 CLI，fankeel 不改；用 headless 預設、不開 --headed，且 station.remote 開著時桌面快照會隨對話進手機頁
      pro: 它活躍、Apache-2.0、Windows 全功能、零 npm 依賴，是目前最省事的「讀無障礙樹」工具。
      con: 多一支能看你整個桌面、剪貼簿的二進位；--headed 會搶滑鼠；能否讀 Claude Desktop 的 Electron 介面未驗。
    option: 沒有，只有終端與網頁 (assumed)
      pro: fankeel 零改動，沿用 render.js 與 station，無新依賴、無每回合成本。
      con: Pane 的 Desktop 真機檢查仍靠人眼。
    reason: 這是使用者自己的工作流與偏好；repo 裡只有 foreign-1.md:16 提到要裝 Lumos X／Remote X，沒說要不要 agent 代為操作，沒有檔案或指令能替他回答。

## 白話

這個對 fankeel 沒用，不裝也不借；只有你另外有想讓 Claude 幫你「點」的 Windows 程式時，才自己裝來用，fankeel 不必動。
agent-desktop 像一支給 AI 用的螢幕閱讀器加遙控器：它不看像素，而是讀 Windows 告訴它的視窗元件清單，再幫 agent 點按鈕、打字，用來操作 Word、檔案總管這類桌面軟體。
fankeel 要看的畫面只有自己的網頁（監控站、手機頁），早就有一支零依賴小工具用電腦現成的 Chrome 拍圖、抓結構、點按鈕，功能對等，沒有缺口。
fankeel 也沒有任何桌面程式要操作，待辦與來源清單裡從未出現這類需求；過去十一次評外部工具，從不為用不到的東西裝依賴。
如果你之後真要讓 Claude 操作 RH 專案的 Lumos X 這類桌面軟體，它是合格、活躍、支援 Windows 的選擇，自己裝就好。

## Summary

### 這個 repo 是什麼（來自它的檔案）

reader 1（opus）以 HTTP 讀 GitHub API 與 raw 檔，未 clone、未執行：
- README.md:3（raw main）「Computer use for AI agents: read and operate desktop apps through the OS accessibility tree.」；:12「A CLI and C library for macOS, Windows and Linux. A snapshot returns JSON with a ref for every element an agent can act on. The agent acts on a ref and snapshots again to check, with no pixel matching; the loop stays in your agent.」
- 類型判定：(b) computer-use／桌面控制工具。不是 Electron 桌面 app、不是雲端沙盒、不是 AI SDK 範本。
- API 中繼資料：Rust、Apache-2.0、6399 星、464 fork、88 open issues、建於 2026-02-19、最後 push 2026-11-01、homepage agent-browser.dev/desktop（agent-browser 的兄弟專案）、topics 含 computer-use、desktop-automation、mcp、macos。
- 版面：Cargo workspace；crates/{core,ffi,linux,macos,windows}；src/ 是 Rust CLI；npm/ 是啟動預編譯二進位的殼（npm/package.json 無 dependencies、os darwin/win32/linux）；apps/docs 是文件網站（唯一出現 next/react/ai/@ai-sdk 的地方）。無 Dockerfile、.env.example、vercel.json、CLAUDE.md。
- 依賴：crates/windows/Cargo.toml:16 用 `uiautomation` 與 windows crate 的 Win32_UI_Accessibility、Graphics_Capture；無模型供應商依賴。模型 key 只在可選的 JEV helper 用到（README.md:16），且 :16 明示快照、剪貼簿、截圖可能含私密桌面內容。
- 平台：README.md:20「Install on macOS, Windows or Linux with npm」、:35「Windows needs no grant for apps at your terminal's integrity level」、:126-135 平台表 Windows 每列 Yes。
- 行為：:79 headless 預設，不動指標不搶焦點；--headed 才做實體輸入。:110 約 60 個指令（snapshot、click、type、screenshot、launch、clipboard-*、notifications…）。:93-96 以 `npx skills add … --skill agent-desktop` 裝進 agent harness。
- 最近 5 個 commit 皆 2026-10-31～11-01（游標覆層、macOS 插入點修正），活躍。
- 未驗（unverified）：是否真有 MCP server（README 未提，只有 topic）；docs/、skills/、CONCEPTS.md、AGENTS.md 未讀；能否讀 Claude Desktop（Electron）的 UIA 樹。

### fankeel 這邊已有什麼

reader 2（sonnet，station／遠端）：
- scripts/station.js:3「每個 fankeel session 都在這一頁」；:10-11 127.0.0.1 的 node:http 伺服器；:28 零依賴；:30-32 station.remote 關時非 loopback Host 回 421，開時唯一入口是 `tailscale serve`。
- lib/profile.js:49、docs/01-guide/profile.md:48：station.remote 預設 false、只讀機器層 profile；scripts/task.js:1262 開啟需 --confirm。
- docs/01-guide/station.md:61-63：只跑 tailscale serve 不跑 funnel；手機配對 QR 一次性十分鐘；:73 不推播；:83 閒置 session 不能從手機驅動；:89 手機連發上限 8 則。lib/qr.js:2 手寫 QR 零依賴。
- 結論：遠端／手機層是「網頁＋Tailscale」，與桌面控制無交集。

reader 3（sonnet，render／desktop／pane）：
- agents/fankeel-render-reviewer.md:3 描述；:19-22 Bash 只跑 node scripts/render.js；:30-32 --config 產 index.json；:34-44 --act 可 click/drag/type/wait/shot。
- scripts/render.js:3-5「a screenshot and the DOM after JS ran, from whatever Chromium-family browser this machine already has. Zero dependencies」；:29-33 --headless=new 截圖＋--dump-dom；:38-39 FANKEEL_BROWSER 優先。
- .fankeel/render.json:2-19 全是 localhost station 頁（28888/28889/28890），含手機寬 412,900。
- Pane：docs/01-guide/what-runs.md:46,49 是 hooks/pane.ts 的側欄；:52 Claude Desktop 跑的是安裝快照。docs/01-guide/station.md:39 gate 答案在 Claude Desktop 給。skills/fankeel-ask/SKILL.md:118「browser pane, then AskUserQuestion」是用宿主的瀏覽器 pane，不是驅動它。
- TODO：compact-4.md:3「Desktop 真機看壓縮視窗」、compact-6.md:4 確認 Desktop 新 session 出現 Pane、pane-10.md:15 真機已驗、gate-6.md:18 決定不做 Desktop 報告面板、gate-7.md:14 推翻改為先設計 Pane 與 station 面板分工。沒有任何 GUI 自動化、computer-use、electron、vnc 條目。

reader 5（sonnet，grep／sources／todo／map）：
- 全 repo（排除 node_modules、.git、.playwright-mcp、reports/evidence）無 agent-desktop／vercel；evidence 目錄裡的命中是 2026-10-03/04 mod-probe 抓包 JSON，與專案內容無關。一次全樹 grep 逾時，「無」以 Grep 工具結果為據。
- docs/90-agent/reference/sources.md:3-15 是自家 63 份報告的證據總帳；關鍵字命中（:87 station.write、:89 冷啟動）全是內部量測。
- docs/90-agent/todo/ 395 檔；相關命中只有 foreign-1.md:16（RH 專案要裝 Lumos X／Remote X 才跑得起來）、brief-3.md:18（Desktop 會載入 mod）、design-4.md:18（手機版寬度）。無桌面 app／computer-use／沙盒提案。
- README.md:3 fankeel 是 Claude Code plugin，七段 stage 各停 gate。root CLAUDE.md 不存在。docs/README.md:814 input-check.js 列每回合載入；未找到明文「不加依賴」規則（零依賴以 render.js:4-5、station.js:28 的程式註解與既往判決為據）。

reader 4（sonnet，既往判決）：
- 11 件外物判決：graphify-knowledge-graph:70 試驗後→graphify-run-it:55「移除」；understand-anything:68 有上限可逆試驗＋借機制；karpathy-skills:50 A 已有不加；gitdiagram:67 E＝A 為主＋補自家缺頁；archify:57 B 借一個 validate --json；tencentdb:89 B 借四規則不裝 proxy；kg-into-fankeel:57 D 不搬碼借一概念；anthropic-review-practice:66 B 借一件有自家證據的；uncle-bob:64 B 借四小件；shared-session-state:58 A（自家設計題）。
- 統計：0 件把工具裝進 fankeel、1 件 A、6 件 B、2 件試驗後定奪。準則：anthropic-review-practice.md:68「先有自己的問題再看對方」、karpathy-skills.md:54「a rule present in substance gets no second copy」；硬限制：零依賴、拒 bundle、每回合區塊 2397/2400。
- 判決目錄無 agent-desktop／vercel／computer use；相關：2026-10-22-phone-reach.md:83 只留 Tailscale；2026-10-26-station-desktop-rc-sessions.md:68 只抓本機 registry 的 session。

### 抽查結果

七處全部與 reader 所述一致：raw README.md:3,:12,:16,:20,:35,:79,:93-96,:126-135（curl 逐行印出）；scripts/station.js:28-32；scripts/render.js:3-16；docs/90-agent/judgements/2026-10-29-anthropic-review-practice.md:66-70；README.md:3；docs/90-agent/todo/foreign-1.md:16（確認是「clone、裝 Lumos X 與 Remote X、設 Datapath、同步 NAS」的一次性環境準備，沒說要 agent 操作）；docs/90-agent/todo/gate-7.md:14。無一處與 reader 摘要相違。

### 對照表

| agent-desktop 提供 | fankeel 的對應 | 重要嗎 |
|---|---|---|
| 以無障礙樹讀寫原生桌面程式（snapshot/click/type 等約 60 指令，README.md:110） | 無；fankeel 的介面是終端、網頁（station、Pane）、markdown | 不重要：fankeel 沒有要操作的桌面程式，TODO 395 條無一條 |
| 結構化快照（JSON ref）取代像素比對（README.md:12） | scripts/render.js:3-5 的 PNG＋DOM dump（網頁用） | 同等；fankeel 只有網頁要看 |
| 動作序列後再拍（act→snapshot loop） | render.js --act click/drag/type/wait/shot（agents/fankeel-render-reviewer.md:34-44） | 同等，無可借 |
| headless 預設、不搶滑鼠（README.md:79） | render.js --headless=new（scripts/render.js:29-33） | 同等 |
| 截圖、剪貼簿、通知、視窗管理 | render.png 限 Chromium 頁；其餘無 | 不需要 |
| Windows 原生、零 npm 依賴的預編譯二進位 | fankeel 零依賴（render.js:4-5、station.js:28） | 相容但不需要；裝了就是一支新二進位依賴，違既往 0/11 的紀錄 |
| 以 skill 裝進 harness（README.md:93-96） | fankeel 本身是 plugin，skills/ 自有 | 無關；裝了會多佔每回合 skill 列表 |
| JEV helper 送螢幕描述給模型供應商（README.md:16） | 無 | 不需要，且有隱私面 |
| 手機／遠端 | 無；fankeel 有 station＋Tailscale（station.js:30-32） | 反向無關 |
| 可能缺口：Claude Desktop（Electron）真機看 Pane（todo compact-4、compact-6、pane-10） | 目前人眼看 | 唯一可能用處，但未驗 Electron 的 UIA 樹可讀、頻率低，不值一支依賴 |

### 怎麼得到 pick

repo 本身是真的、成熟、Windows 可用，但它解的問題（agent 操作原生桌面 GUI）fankeel 不存在：fankeel 要看的全是自己的網頁，render.js 已有同構的「結構快照→動作→再拍」且零依賴；station、手機、Pane 三層都不涉桌面控制；TODO、sources、全 repo 無此需求。依「先有自己的問題再看對方」與 0/11 裝工具的既往，選 A，連 B 都沒有可借的點子。唯一能翻成 C 的是使用者自己工作流裡的桌面程式（foreign-1.md:16 的 Lumos X／Remote X 只是裝機步驗，未說要 agent 操作），故列入 ask human 而非擅自假定。

### 沒查到的

- agent-desktop 是否真能讀 Claude Desktop（Electron）的 UIAutomation 樹——需實機試，未做。
- 是否有 MCP server——README 未提，GitHub 程式碼搜尋需登入。
- lib/station.js、lib/render.js、docs/90-agent/reference/station.md 全文未讀（reader 只讀標頭與 grep 命中）。
- 既往判決只讀 pick／why／Summary，未讀全文；J/2026-10-19、J/2026-10-25 的零依賴與 bundle 規則是轉引。
- 未寫 context.md：pick 為 A，後續無 stage 需要重用此事實。

## 人類的回答

answered: 2026-11-01T18:26:10.068Z

| 題目 | 判官假設 | 回答 | 分支 |
|---|---|---|---|
| 你現在或近期有沒有要讓 Claude Code 代你操作的 Windows 桌面程式？例如 RH 專案要裝設的 Lumos X／Remote X，或想用機器而不是眼睛去看 Claude Desktop 裡的 Pane。 | 沒有，只有終端與網頁 | 幾乎沒有 基本上就是瀏覽器測試而已 真實的我不敢讓他測試 | 分支外 |
decision: 分支外 — 第二次 /fankeel-ask 帶 --record F:\ymlab\fankeel\docs\90-agent\judgements\2026-11-01-agent-desktop.md

