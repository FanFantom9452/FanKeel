---
judged: 2026-10-26T16:53:04.321Z
model: fable
agent: fankeel-judge
task: "archify 和 Chartroom 比較分析"
session: 59c296b4-3520-4f28-9665-03bd51e683a6
stage: survey
---

# Brief 36 — archify vs our Chartroom: adopt, borrow, or ignore?

## Question

# Brief 36 — archify vs our Chartroom: adopt, borrow, or ignore?

## Question

The user pointed at https://github.com/tt-a1i/archify and asked: analyse it against our Chartroom. What, if anything, should fankeel take from archify — replace Chartroom, borrow specific ideas, or nothing?

## What archify is (from its GitHub page, fetched 2026-10-27; readers should verify by reading the repo — clone into a fresh empty temp dir outside this repo, or read raw files on GitHub; never run its code)

- An agent skill (Claude Code, Codex, Cursor, opencode…) plus a claimed zero-dependency Node CLI `archify/bin/archify.mjs` (Node >=18). Apache-2.0 (historic MIT grants in `LICENSE-MIT`, `NOTICE`). ~89.7k stars.
- Input: natural language or a repo the agent analyses → agent writes a **typed JSON IR** (`archify/schemas/`) → CLI builds a **self-contained offline HTML** (SVG inside), exports PNG/WebP/JPG/PDF and share cards.
- Layout chosen by the agent, not generic auto-layout (unverified — find out what the CLI actually does with coordinates).
- 10 diagram types: Architecture, Workflow, Sequence, Data Flow, Lifecycle, ERD, Class, Tree, Timeline, Waterfall; plus explainer pages and "Architecture Delta" comparisons.
- Dark/light themes, several styles, locales incl. zh-TW.
- `validate --json` returns stable rule codes + repair guidance for the agent; a failed build keeps the last good output; loopback-only preview; opt-in source evidence pinned to a commit; does not parse Mermaid.
- Repo paths: `archify/` (SKILL.md, schemas, examples), `viewer/`, `examples/`, `docs/`, `integrations/`, `test/`.

## Background in this repo (these decide the answer)

- `lib/chartroom/` (README, core/, geometry/) — the vendored pure-Node layer: `.board` format → `toSVG`. Zero external imports.
- `docs/03-decisions/2026-10-07-station-chartroom.md`, `docs/03-decisions/2026-10-20-task-boards-as-svg.md`, `docs/03-decisions/2026-10-15-pane-svg.md` — standing decisions (no build, no dependency; boards drawn server-side as SVG on the station).
- Prior judgements, read pick + Summary: `docs/90-agent/judgements/2026-10-19-chartroom-mermaid-station.md`, `2026-10-25-mermaid-renderers-vs-chartroom.md` (picked "no change", zero-dep, unauditable bundles rejected), `2026-10-22-graphify-knowledge-graph.md`, `2026-10-22-understand-anything.md` (similar "outside tool vs ours" calls — keep consistent or say why not).
- Where boards are authored/consumed: `skills/fankeel-design/SKILL.md` (board section), `lib/board.js`, `scripts/station.js`, `assets/station/`, `docs/90-agent/reference/station.md`.
- `package.json` — fankeel ships as a plugin with no runtime deps.

## Options

A. No change — Chartroom stays; archify is a different product (standalone shareable HTML), nothing to take.
B. Keep Chartroom, **borrow named ideas** from archify (e.g. a `validate --json` with stable rule codes the agent can repair against; keep-last-good on failed build; typed schema for `.board`; more diagram kinds such as sequence/timeline; export PNG) — name which, and the first one.
C. Replace Chartroom's `.board` with archify's JSON IR / vendor archify's renderer.
D. Something else (e.g. recommend archify to users as a separate skill for shareable diagrams, no code change).

Weigh: zero-dep / auditable-source policy, consistency with the prior judgements, what Chartroom actually lacks today (anything failing or repeatedly hand-fixed?), and licence compatibility if anything is copied.

## What counts as an answer

One pick; if B, the ordered list of ideas worth borrowing with the first concrete change (file + what it does); if anything about archify could not be verified from its source, label it unverified.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文.

## Answer

pick: B — keep Chartroom; borrow exactly one idea now, archify's agent-facing `validate --json` (stable rule codes + fix hints, run by the agent right after writing the board). First change: `lib/board.js` gains `checkBoard(text)` → `{ok, problems:[{code, line, message, fix}]}` wrapping parse+scene, exposed as `node scripts/board.js check <file> --json`, and `skills/fankeel-design/SKILL.md:224-229` gains one sentence telling the agent to run it and fix what it reports. No code copied from archify. Decline the rest (keep-last-good, JSON schema, sequence/timeline kinds, PNG export).
why: C is impossible under standing rules: archify is ~47.5k lines of CLI/renderer plus minified `explainer/vendor/pele/chunks/*.js` and a 772K template (bundles rejected at judgements/2026-10-19:182,:237; zero-dep hard rule at 2026-10-25:58), its `finalize` needs a real browser (archify/SKILL.md:47), and it has no auto-layout — the agent writes `pos`/`row`/`col` (grid.mjs:1, render-architecture.mjs:500), the opposite of SKILL.md:227 "no coordinates; the station lays it out" and decision 2026-10-20:8.
Nothing fails today (R7: 6 commits on the paths, 1 fix, route-level; no todo; only `tests/fixtures/levelmark.board` tracked), so by the 10-25 standard a renderer change is out — but a verified blind spot exists: `parse` throws 7 free-text ParseErrors only (format.js:83-105), unknown keys pass silently (format.js:38), `validateDoc` is referenced but not vendored (fields.js:95), and the design skill has no check step, so a bad board surfaces only as a 422 on GET that the agent never sees (lib/board.js:115-116, station.md:710-713).
That is the graphify/understand-anything pattern (G:186, U:188): borrow the idea into ~50 lines of our own code, zero deps, no licence obligation (Apache-2.0 NOTICE §4(d) applies only if code is copied — none is).
would flip if: the user does not intend agents to keep writing `.board`s during design (feature stays at one fixture) → A, nothing to do. Or upstream Chartroom's `validateDoc` is a self-contained file → re-copy it under README.md:9's "不改、只重抄" instead of writing our own check (still B, different first change — unverified, upstream not read).
unread: nothing — every named path was read by a reader; 2026-10-19 judgement lines 1-121 (header) not read, pick/why/summary were.
delegated: archify clone (/tmp/tmp.en8LfufH9m/archify: package.json, archify/package.json, archify/bin/archify.mjs, renderers/architecture/{grid,render-architecture}.mjs, renderers/shared/{diagnostics,atomic-output}.mjs, LICENSE, LICENSE-MIT, NOTICE, viewer/export.js) opus; archify clone (/tmp/tmp.AbyBsbdbyl/archify: archify/SKILL.md, archify/schemas/*, examples/checkout-request.waterfall.json, viewer/*) sonnet; lib/chartroom/{README.md,package.json,core/*,geometry/*} + package.json sonnet; docs/03-decisions/2026-10-07-station-chartroom.md, 2026-10-20-task-boards-as-svg.md, 2026-10-15-pane-svg.md, judgements 2026-10-19-chartroom-mermaid-station.md, 2026-10-25-mermaid-renderers-vs-chartroom.md sonnet; judgements 2026-10-22-graphify-knowledge-graph.md, 2026-10-22-understand-anything.md sonnet; skills/fankeel-design/SKILL.md (board section), lib/board.js, scripts/station.js (board lines), assets/station/{station.js,diagram.js}, tests/*board*.test.js sonnet; docs/90-agent/reference/station.md (board spans), docs/90-agent/todo/*, docs/90-agent/plans/*, git log, tests/fixtures/levelmark.board sonnet.
checklist: 1 archify CLI/renderer (zero-dep, layout, validate, keep-last-good, licence) — answered; 2 archify SKILL + schemas — answered; 3 lib/chartroom + package.json — answered; 4 decisions + chartroom judgements — answered; 5 graphify + understand-anything judgements — answered; 6 board authoring/consumption pipeline — answered; 7 what Chartroom lacks today — answered (nothing failing).

## Summary

### archify 實際是什麼（讀原始碼，未執行）

兩個 reader 各自把 https://github.com/tt-a1i/archify 淺層 clone 到 repo 外的空暫存目錄（/tmp/tmp.en8LfufH9m、/tmp/tmp.AbyBsbdbyl），只讀不跑。

- **零依賴宣稱屬實，但「可審閱」不成立。** 根 `package.json` 與 `archify/package.json` 都沒有 `dependencies` 鍵（只有 devDependencies ajv、simple-icons、parse5 等）；`archify/bin/archify.mjs:3-8` 的靜態 import 全是 `node:*`。但 CLI 本體 7,289 行、`bin/*.mjs` 12,373 行、`renderers/*/*.mjs` 30,189 行，bin+renderers+explainer+delta+migrations 合計約 47,505 行；另有 `archify/explainer/vendor/pele/chunks/*.js` 七個壓縮檔（單行 12,249 字元，磁碟 146K）、`renderers/shared/generated-validators.mjs:3` 8,890 字元的產生碼、`assets/template.html` 772K。我抽查 `wc -l bin/archify.mjs` = 7289、pele chunks 目錄確實存在。對照 `lib/chartroom` 的 1,768 行、零 import，差 27 倍，而且含壓縮包。
- **版面由 agent 決定，不是自動排版。** `renderers/architecture/grid.mjs:1`「Grid placement for architecture IR (#8). Not auto-layout — fixed cell math only.」；`render-architecture.mjs:500`「Component "${c.id}" must include pos [x, y] when layout.mode is omitted (free placement).」；`schemas/architecture.schema.json:89-91` 有 `row`、`col`、`pos`；workflow schema :270-284 每個節點必填 `lane` 與 `col`。`archify/SKILL.md:38` 要 agent「write the complete candidate directly without planning coordinates in prose」——座標還是 agent 寫，只是不准在散文裡先規劃。兩處我都抽查到原文。這和 brief 的「layout chosen by the agent」一致，已驗證。
- **validate --json。** 輸出形狀 `bin/archify.mjs:4290-4305` `{schemaVersion, ok, command, stage, type, input, error, diagnostics…}`；每則 diagnostic 是 `renderers/shared/diagnostics.mjs:19-26` 的 `{code, severity, message, subject, evidence, supportedFixes[]}`；規則碼是行內字串 `'<area>/<slug>'`（例 `architecture/non-finite-component-geometry`，render-architecture.mjs:510-514，抽查到原文），regex 粗估約 166 個，沒有集中登錄表（count 未驗證）。
- **keep-last-good 屬實。** `renderers/shared/atomic-output.mjs:1108-1115`（抽查到原文）：先備份既有輸出、候選檔驗過才取代，自述「recoverable but not crash-atomic」；`bin/archify.mjs:4937`「Final artifact check failed; the previous artifact was preserved.」
- **finalize 需要真瀏覽器。** `archify/SKILL.md:47`「A passing receipt proves the included validate, deliver, strict check, and real-browser browser-check gates passed.」（抽查到原文）；`bin/visual-check.mjs:1342-1348` 找系統 chrome/chromium 並 spawn。PNG/WebP/JPG 匯出在瀏覽器端 canvas（`viewer/export.js:56,578`），無 puppeteer/sharp/resvg。
- **十種圖型屬實**（SKILL.md:36 列十種，schemas 另有 explainer 第 11 個）。locale 是 pattern 不是 enum（common.schema.json:10-14），zh-TW 符合 pattern，但只看到 `examples/locales/fr.partial.json`——zh-TW 語言包是否存在**未驗證**。Mermaid：SKILL.md:79 只讀拓樸後重寫 JSON，不渲染 Mermaid。
- **授權。** `LICENSE` Apache-2.0；`LICENSE-MIT` 歷史 MIT（tt-a1i 2026、Cocoon AI 2025）；`NOTICE:5,10-11,20`。若複製任何程式碼，Apache-2.0 §4(d) 要求帶著 NOTICE 與 LICENSE。`vendor/pele` 的授權（THIRD_PARTY_NOTICES.md）**未讀**。

### 我們的 Chartroom 今天是什麼

- 格式：JSON Lines，四種紀錄 `view/node/edge/stroke`（core/fields.js:4），19 種 shape、LR/TB、arrow none/end/both、head arrow/circle/cross、dash 布林（fields.js:7-22,62）。沒有「圖型」概念，所有板都是 view 內的 node/edge。
- 版面：**自動排版未擺放的節點、絕不移動已擺放的、確定性**（geometry/layout.js:1；measure.js:28-29 `isPlaced`）；分層＋重心掃描 4 輪（layout.js:15,223）。設計技能 SKILL.md:224-229 要 agent「one record per line, no coordinates; the station lays it out」（抽查到原文）。這是和 archify 相反的哲學：我們把排版留給 299 行確定性程式，archify 把排版推給模型再用 validate→repair 迴圈收斂。
- 驗證：`parse` 只丟 7 種自由文字的 `ParseError(message, line)`（format.js:8-13, 83-105），無代碼；未知欄位靜默保留（format.js:38，抽查到原文）；未知 kind 靜默存起來（:103）。**`validateDoc` 在 fields.js:95 被提及「指向的東西存不存在由 validateDoc 判斷」但沒 vendor 進來**（抽查到原文）——所以 edge 的 from/to 指向不存在的 node、shape 不在 enum，parse 都不會擋，scene/toSVG 會怎樣 reader 未追。
- 消費端：`lib/board.js:73-77` parse→scene→toSVG（抽查到原文）；失敗時 `:115-116` 422（ParseError）或 500，純文字；station.js:789-810 同樣；卡片以 `<img>` 顯示（assets/station/station.js:2603-2605），CSP `default-src 'none'`；無匯出、無縮放、無 fallback 到舊 SVG。
- 依賴：lib/chartroom 全部相對 import，無 `node:`、無 bare package、無 `require(`；根 package.json 無 `dependencies` 鍵，`node >=22.5`，v0.117.0。
- 現況：`git log -- lib/chartroom lib/board.js` 共 6 個 commit，唯一的 `fix(` 是 6205f68e（路由層 redirect/500），非繪圖問題（我自己跑過 git log 核對）。todo/plans 沒有任何開放的 board 需求；docs 沒人要過 sequence/timeline/ERD/PNG 匯出；全 tree 只追蹤一個 `.board`——`tests/fixtures/levelmark.board`（20 行，且它是手放座標的範例）。結論：**今天沒有東西壞、沒有反覆手修**；板子功能 10-20 才上線，幾乎沒被用。

### 既有裁決與先前判決

- 10-07:30「fankeel 現在沒有 build 步驤、沒有 dependency」；:38 補記（10-26）「station 照舊畫 Mermaid，Chartroom 只畫任務的板」。10-20:8,14-17 只複製 10 檔、伺服端畫 SVG、`<img>` 顯示、不編輯；:26-28 明列放棄「整個 Chartroom」「require(esm)」「內嵌 SVG」。10-15 與渲染器無關。
- 10-19 判決 :123 pick vendor 純 Node 層；:149,:165「sequence／state／gantt／class／ER／timeline 它沒有也不該追……時序與甘特留 Mermaid」；:182,:237 拒絕提交壓縮 dist/app「審不了、diff 不了」。
- 10-25 判決 :57-59（抽查到原文）pick A 無變更；why (1)「今天沒有任何東西因為缺 Mermaid 渲染器而失敗」；(3)「零依賴是硬規矩……lib/chartroom 是 1768 行可讀原始碍、零外部 import……壓縮 bundle 已拒絕過」。
- graphify（G:70-77, :186-190，抽查到原文）與 understand-anything（U:68-75, :188-191）：兩者都不推薦外部工具給使用者、都不整包採用，都以「把一個想法借進我們自己的 ~100 行 JS」收尾，並明列第一個具體改動（scripts/map.js 兩節；survey.js --affected）。兩份都沒有寫成通則，但模式一致：**借想法不借程式碼，且只借我們有缺口的那一項**。

### 推理到 pick

1. **C 不可能。** 三條硬規矩都撞上：47.5k 行＋壓縮 pele chunks＋772K template（10-19:182、10-25:58 拒絕同類）；`finalize` 要 real-browser gate（違反「無 build、伺服端 SVG」）；IR 要 agent 寫座標（違反 SKILL.md:227 與 10-20:8「station 在伺服器端畫」）。另外 archify 的產物是獨立 HTML 頁，我們的是 `<img>` 裡的 SVG，兩者是不同產品。授權（Apache-2.0）本身相容，但不是問題所在。
2. **D 不選。** 先前四份判決沒有一份把外部工具推給使用者；archify 的技能第 4 步就是跑 47k 行程式再啟瀏覧器，fankeel 沒審過不該代為推薦。使用者若自己要可分享的獨立頁，自行用 archify 是他的事，fankeel 不表態。
3. **A 與 B 之間。** 以 10-25「沒東西壞就不動」的標準，A 成立；但 10-25 擋的是「加一個依賴」，而這裡的借法是 graphify/UA 模式——幾十行自己的程式、零依賴。而且缺口是查證過的：agent 寫完 `.board` 沒有任何檢查步驤，Chartroom 的 parse 不查參照與 enum（validateDoc 沒 vendor），唯一回饋是 station GET 時的 422——agent 永遠看不到，卡片上就是一張破圖。archify 的 `validate --json`＋穩定代碍＋`supportedFixes`，正好是補這個洞的形狀。所以 **B，但只借一項**。
4. **B 內的排序與取捨：**
   - **(1) 借：** agent 可呼叫的 `validate --json`。第一個具體改動——`lib/board.js` 加 `checkBoard(text)`，把 ParseError（含 `.line`）與 scene/toSVG 失敗包成 `{ok, problems:[{code, line, message, fix}]}`，code 用 `board/not-json`、`board/duplicate-id`、`board/dangling-edge` 這類穩定 slug；以 `node scripts/board.js check <file> --json` 暴露；`skills/fankeel-design/SKILL.md:224-229` 加一句「寫完跑它、修完才算完」。不改 `lib/chartroom/`（README.md:9「不改、只重抄」），不複製 archify 程式碼，無 NOTICE 義務。
   - **(2) 不借 keep-last-good：** 我們沒有「build 輸出」可保留，板子是 agent 寫的檔、station 在 GET 時畫；要保留舊 SVG 得加狀態，今天無需求。
   - **(3) 不借 JSON Schema：** fields.js 的 FIELDS 表已是型別表，再寫 schema 是重複。
   - **(4) 不加 sequence/timeline/ERD：** 10-19:149,:165 已裁定留給 Mermaid，station 10-26 起用 pele 畫 Mermaid（10-07:38）。
   - **(5) 不加 PNG 匯出：** archify 也是瀏覽器端 canvas 做的；我們的 SVG 可另開分頁存檔；docs/todo 無人要過。
   - **(6) 以後可看：** archify 的「source evidence 釘在 commit」（節點→path:line）對架構板有意思，但無需求、不列入。

### 未能驗證（標示）

- `vendor/pele` 授權、`template.html` 是否內嵌第三方壓縮碍、非 architecture 圖型是否有別種自動排版、repair limit 數字、zh-TW 語言包是否存在、規則碼精確數量——皆未讀或只是 regex 估計。
- 上游 Chartroom 的 `validateDoc` 是否為可獨立重抄的檔案——不在 brief 的路徑內，未讀；若是，第一個改動應改為重抄它。
- 10-19 判決 1-121 行（表頭）未讀。
- 已把三個後續階段會用到的事實寫進 `F:/ymlab/fankeel/.fankeel/build/task-20261026T164215/context.md`（fields.js:95 的 validateDoc 缺口、layout.js:1 vs archify grid.mjs:1 的排版哲學差異、SKILL.md:224 無檢查步驤）。未更動任何其他檔案；兩個 archify clone 留在 /tmp 暫存目錄，未執行其任何程式。
