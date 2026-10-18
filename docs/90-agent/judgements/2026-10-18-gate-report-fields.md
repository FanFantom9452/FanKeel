---
judged: 2026-10-18T17:39:08.314Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 1452cf01-6856-4dc9-a1d7-2ba349b40338
stage: survey
---

# Brief — gate-11: put the missing gate-tab fields into the report templates?

## Question

# Brief — gate-11: put the missing gate-tab fields into the report templates?

## The question

The user picked, at the patrol's survey gate, to fill the gate tab's 14 missing
data items by **adding fields to the stage report templates in `lib/stages.js`**
(rather than having the station derive them from the session's own burn, clock
and ledger data). The user now asks: do the characters this adds to what is
injected affect the workflow we designed? Judge whether that choice is safe,
and if not, what the smallest safe shape of it is.

## Options

A. Add the fields to the report templates (`output shape:`) in `lib/stages.js`,
   as picked. Every field added is injected text.
B. Station derives them from session data (`burn`, `clock`, `moves`, ledger,
   suite records) — no template change, no injected characters.
C. Split: template carries only what only the stage agent can know (e.g.
   unverified / unopened counts, per-task fix rounds); station derives the rest
   (cost bars, durations, model/effort per dispatch, suite pass/fail).
D. Do none; the layout already matches the mockup.

## Background

- The 14 items, per `docs/90-agent/todo/gate-11.md`: survey's conclusion bullets,
  unverified/unopened counts, unknown/skipped arrays, TODO patrol summary;
  design's mockup thumbnail, still-open and unverified counts, model+effort per
  dispatch, inline code of what column changes; build's fix and verify counts,
  fix rounds per task, +/- subtotal per group; land's main-session duration,
  suite pass/fail and file list, per-stage time bars with legend.
- `lib/stages.js` ~95-115: the whole injection is capped at 2400 characters by
  `tests/render.test.js`; a rule added has to be bought by cutting another.
  Several stages carry `budget: 2400` (lines ~227, 286, 311). Build sits close
  to the cap (comment ~203).
- With `stage.agents` set, the stage's rules and shape go into the stage
  agent's brief (`hooks/brief.js`), and the controller gets a short controller
  block instead — so does the template's size still bind the controller's
  per-prompt injection, the brief, or both? Check, don't assume.
- `lib/gatereport.js` parses the handoff report by each stage's template keys
  (`KEYS`) for `assets/station/station.js`'s gate panel.
- Concern to weigh: every character in a stage's shape is re-read on every
  prompt (or in every brief), and the cap exists to keep the rules read to the
  end; fields that only feed a dashboard may crowd out rules that govern
  behaviour, and may make stage agents spend output on counts.

## Paths to read

- docs/90-agent/todo/gate-11.md
- lib/stages.js (the templates, budgets, ALWAYS, the cap comments)
- tests/render.test.js (how the cap is measured, per stage, current headroom)
- hooks/brief.js and hooks/inject.js (where the shape lands with and without stage agents)
- lib/gatereport.js, assets/station/station.js (what the gate panel already reads)
- wherever `burn`, `clock`, `moves` are written (lib/registry.js or similar); lib/suite.js
- docs/90-agent/reference/station.md

## What counts as an answer

A pick among A–D (or a named variant), with the per-stage headroom figures
from the test's own diagnostic, which of the 14 items need the template (only
the stage agent knows them) versus which the station can compute, and whether
option A as picked breaks or crowds out any existing rule.

## Shape

The six judge fields, then `## Summary`. Answer in Traditional Chinese;
identifiers stay in code.

## Answer

pick: C（拆開）——範本只加 build 一行 `fixes:`（每個 task 的修正輪數），其餘 13 項由 station 從 session 資料與既有報告鍵算出；選項 A 照原樣不安全。
why: 上限測試實測 headroom：survey 50、design 29、plan 49、build 48、verify 119、audit 8、land 3（`tests/render.test.js:568-569`，斷言是嚴格 `< 2400`）。land 的三項（時長、suite pass/fail、各站長條）在範本裡一個字都放不下，卻正是 `clock`、`spend`、`suite.json` 早已記錄的資料（`lib/registry.js:466`、`hooks/leave.js:62-66`、`lib/suite.js:84,106`）。
有 `stage.agents` 時 shape 進 brain brief（`lib/render.js:654`，上限 `BRIEF_MAX = 9500` 於 :729），controller 每個 prompt 只拿兩行 `CONTROL_TEMPLATE`（`lib/stages.js:700`）；但上限測試量的是「沒有 agent」的 `render()` 七個 stage 全跑（`:559-569`），所以範本每多一字都要過 2400，與 profile 無關。
`budget:` 欄位（2400/2500）測試不讀——綁住的是測試裡的常數。survey 範本自己寫 `skipped: <what, and why — not N>`（`lib/stages.js:238`），要「計數」與範本原意相衝，應由 station 把字串拆成陣列後算。
would flip if: 上限測試改成只量 controlled block（shape 永遠只進 9500 字的 brief），範本就有約 2,500 字的空間，A 變得可負擔；或 `suite.json`／`clock` 實際上沒有 pass/fail 與各站起訖。
unread: nothing——brief 列的九個路徑全部由 reader 開過或由我抽查；`tests/reference-size.js`、`lib/shots.js` 不在 brief 內，沒開。
delegated: `lib/stages.js` + `tests/render.test.js`（opus）；`hooks/brief.js` + `hooks/inject.js` + `lib/render.js`（sonnet）；`lib/gatereport.js` + `assets/station/station.js` + `docs/90-agent/reference/station.md` + `lib/detail.js` + `lib/station.js`（sonnet）；`docs/90-agent/todo/gate-11.md` + `lib/registry.js` + `lib/suite.js` + `lib/ledger.js` + `hooks/leave.js` + `lib/spend.js`（sonnet）。
checklist: 1 `gate-11.md` 14 項是什麼——answered（:9，散文一段，4+4+3+3）；2 `lib/stages.js` 範本／budget／ALWAYS／cap 註解——answered；3 `tests/render.test.js` cap 怎麼量、各 stage headroom——answered（實跑診斷）；4 `hooks/brief.js` 有 agent 時 shape 去向——answered（進 brief，:166 → `render.js:654`）；5 `hooks/inject.js` 無 agent 時——answered（每個 prompt 全量 `render.js:195,209`）；6 `lib/gatereport.js` `KEYS`——answered（:26-31）；7 `station.js` gate 面板已讀什麼——answered（:4729-4811）；8 `lib/registry.js` burn/clock/moves——answered（:463-499,526-538）；9 `lib/suite.js` 紀錄——answered（:84,106，無檔案清單）；10 `station.md` 資料來源——answered（:283-302，沒提 burn/clock/suite）。

## Summary

### 上限怎麼量、現在剩多少（reader 1，opus；我抽查 `lib/stages.js:105-114`、`lib/render.js:192-215`、`tests/render.test.js:565-575` 並自己重跑）

- 測試 `no stage's rules cost more than a readable preamble`（`tests/render.test.js:523-577`）對 `NAMES` 七個 stage 各呼叫 `render({mine: entry(MINE,{stage}), profile})`，跨四個 profile 取最大，用 `sizeAtReference` 換算成 59 字元 plugin root，斷言 `size < 2400`（:569）。這四個 profile 都沒設 `stage.agents`，所以量的是**沒有 stage agent 時**的每 prompt 注入：`rulesLines()`（`lib/render.js:192-215`）= facts 行 + `<plugin> =` 行 + `stage rules:`（ALWAYS + stage rules + when + promptRules）+ `output shape:`（範本縮排兩格，:209-213）。範本每行成本 = 字元數 + 2 縮排 + 1 換行。
- 我自己跑 `node --test tests/render.test.js` 的診斷（與 reader 回傳完全一致）：

  | stage | 長度 | 距 2400 | 可用（嚴格 `<`） |
  |---|---|---|---|
  | survey | 2350 | 50 | 49 |
  | design | 2371 | 29 | 28 |
  | plan | 2351 | 49 | 48 |
  | build | 2352 | 48 | 47 |
  | verify | 2281 | 119 | 118 |
  | audit | 2392 | 8 | 7 |
  | land | 2397 | 3 | 2 |

  另有幾個情境已貼到邊：`design → controlled build 2391`、`verify with security.local 2398`、`bounded design with a mockup 2396`。
- `lib/stages.js:105-114` 明說「a rule added here has to be bought rather than granted…take the diagnostic」；`:203-204` 的「build 差 43 字」已過期（實測 48），`render.test.js:528-531` 的各站數字也部分過期（build 2357→2352、verify 2277→2281）——判斷以實跑為準。
- `budget:` 欄（survey 2400 `:227`、design 2500 `:256`、plan 2400 `:286`、build 2400 `:311`、verify 2500 `:334`、audit 2500 `:362`、land 2500 `:400`）：我 grep `tests/render.test.js` 找 `budget` 只命中 :453 的註解「The number is not a budget」，測試不讀它。brief 背景說的「`budget: 2400`」不是約束，測試裡的常數才是。
- 測試另外釘住 land 範本必須保留 `suite: <suite.js line>` 一行（`:574-575`）。

### shape 落在哪裡（reader 2，sonnet；我抽查 `lib/render.js:194-195,209,654,667,729`、`lib/stages.js:700-716`）

- `hooks/inject.js` 本身沒有分支，只呼叫 `render()`。`lib/render.js:194-195`：`controlBlock` 非空就用 controller 的 rules，否則 `rulesFor(...).concat(promptRules)`；`:209` 同理選 `control.template` 或 `templateFor(stage)`。`controlFor()`（`lib/stages.js:711-716`）回傳 `CONTROL_TEMPLATE = ['<the path the agent returned>', 'then AskUserQuestion']`（:700）——stage 自己的 shape **不在** controller 的每 prompt 區塊裡。
- brain brief：`hooks/brief.js:166` → `renderBrief` → `renderBrainBrief`，`lib/render.js:654` 以 `rulesLines(data, profile, null)` 把完整 rules + shape 放進 brief，上限 `BRIEF_MAX = 9500`（:729），`fit` 只修剪 facts／answered／touched，不會截 shape。
- 結論：有 `stage.agents` 時，加進範本的字只進一次 brief（9500 上限，build brain 目前約 7000）；沒有時每個 prompt 重讀。**但上限測試是對無 agent 的 render 跑七個 stage，所以不管使用者的 profile 怎麼設，範本每多一字都要過 2400。** 這就是為何 A 不能靠「反正走 agent」繞過。

### gate 面板已經讀什麼（reader 3，sonnet；我抽查 `assets/station/station.js:4697-4814`、`lib/gatereport.js:1-80`）

- `KEYS`（`lib/gatereport.js:26-31`）：survey `planned, not built / not found / unknown / skipped / class / route`；design `proves it done / against the map / unverified / spec`；build `done / docs-check / deferred`；land `shipped / suite / cost / open / 白話`。`key: value` 行比對（:16），值存成**單一字串**（:79），未識別的行進 `parts.rest`。
- 面板（`station.js:4729-4802`）：survey 畫 conclusion（首行散文）、findings、class、route、unknown、skipped；design 畫 approach、檔案表（含 `dispatch` 欄）、mockup **連結**（:4753，無縮圖）、proves/map/unverified/spec；build 畫 task 卡（來自 ledger，`lib/detail.js:429-437`）、檔案依 code/test/doc 分組、全體 +/-（:4763-4767，**沒有每組小計但 `f.add`/`f.del` 已在手上**）；land 畫 白話、sha、shipped、`suite` 指令字串、cost、open。`gateText`（:4710）已把反引號畫成 `<code>`。
- 面板**沒讀** burn、clock、moves、spend、suite.json；但同一頁別處已有：`timelineModel.segs`（:949-983）各站起訖、`x.rows[].model`/cents/tokens（:954-968）、plan task 的 `model`/`effort`（`lib/detail.js:436`，plan tab :4566-4568）。
- `station.md:283-302` 只描述報告來源，沒說面板畫 burn/clock/suite。

### session 資料有什麼（reader 4，sonnet；我抽查 `lib/registry.js:463-499,526-538`（grep）、`lib/suite.js:84,106`（grep）、`lib/ledger.js:42`、`hooks/leave.js:58-67`、`lib/detail.js:426-437`）

- `clock[stage] = [first, last]`（`registry.js:466,528`）、`burn[stage] = [first, used]`（:497）、`moves` 逐次 `[stage, at, used]`（:480,537）；`spend[stage] = {requests, models}` + `.subagents`（`hooks/leave.js:62-66`），`lib/spend.js` 定價。
- `suite.json`：`{sha, at, command, pass, fail, failed, ok, runs}`（`lib/suite.js:84,106`），**沒有跑過的檔案清單**（`--tree` 另存 `tree`，未深究）。
- ledger `Fix:` 行**沒有 task 編號**（`lib/ledger.js:38-42`，註解明說）；`detail.js:433` 有每 task 的 `turns`。
- 沒有任何地方存 `+/-` 行數（grep `numstat|shortstat` 無命中）；但 build 報告的每檔 `+a/-d` 已被 gatereport 解析。

### 14 項歸類

| 項目 | 誰能知道 | 做法 |
|---|---|---|
| S1 survey 結論條列 | 報告已有（首行散文 + `rest`） | gatereport 把 lead 之後、findings 之前的 `- ` 行收成 `conclusion[]`；範本不動 |
| S2 沒驗／沒打開計數 | 報告已有 `unknown:`/`skipped:` 字串 | station 拆陣列後算長度；範本 `:238` 明寫「not N」，不要加計數鍵 |
| S3 unknown／skipped 陣列 | 同上 | gatereport 以 `;`/`,` 拆成陣列 |
| S4 TODO 盤點摘要 | 報告 `rest` 或 todo 目錄 | station 已有 `todoOf`（`lib/station.js:379`）可按 `state:` 計數 |
| D1 mockup 縮圖 | 檔案在磁碟（`parts.mockup.path`） | station 以 `<iframe>`/截圖呈現，範本不動 |
| D2 還要確定／沒驗計數 | 報告 `unverified:`（設計上就是「the one thing」，計數 0/1） | 面板直接畫；「還要確定」併入 `unverified:` 行，不加鍵（design 只剩 28 字） |
| D3 派工模型＋effort | 檔案表 `dispatch` 欄「implementer, sonnet」+ plan 的 `model`/`effort`（`detail.js:436`） | station 解析 `dispatch` 欄字串；effort 只有 plan 值 |
| D4 改什麼欄 inline code | 已支援（`gateText` 反引號→`<code>`） | 零改動；頂多 skill 文件提醒用反引號 |
| B1 修正／驗證計數 | ledger `Fix:` 行數 + `moves` 的 verify→build 往返（`registry.js:629-636`） | station 算 |
| B2 每 task 修正輪數 | **只有 build brain 知道**（`Fix:` 無 task 號） | 範本加一行 `fixes: <task n: rounds, or none>`（約 36 字，build 可用 47）；或改 ledger `Fix:` 帶 task 號——後者不佔注入字元，更好 |
| B3 每組 +/- 小計 | 報告每檔 `+a/-d` 已解析 | station 在 `byKind` 迴圈加總 |
| L1 主 session 時長 | `clock`/`started` | station 算 |
| L2 suite pass/fail＋檔案清單 | `suite.json` 有 pass/fail；檔案清單**無處記錄** | pass/fail 由 station 讀 `suite.json`；檔案清單需 `suite.js` 多存一欄或 `--tree`，不是範本的事（land 可用 2 字，什麼都放不下） |
| L3 各站時間長條＋圖例 | `timelineModel.segs` + `spend` | 面板複用 overview 已有的 segs |

### 選項 A 照原樣會不會撞到規則

- land：剩 2 字。三項全部要靠砍 land 規則（`:396-398`）或砍 ALWAYS（省下的字七站共享）才放得進，而這三項恰好是 session 資料已有的——用範本換等於花最貴的字買已經免費的資料。
- design：剩 28 字，連一行 `open: <n still to decide>` 都放不下；`design → controlled build` 情境 2391、`bounded design with a mockup` 2396 更緊。
- survey／build：各約 48 字，放得下一行短鍵，但 survey 範本 `:238` 的「not N」與「計數」互斥，加計數鍵是自打嘴巴。
- 字數上限（survey 120 字、design 200 字、build 80 字：`:225,:254,:309`）：計數類欄位每個只花 2-4 個字，不會把 agent 的輸出擠爆；但「suite 檔案清單」「每組 +/- 小計」這種列舉會。
- 有 agent 時 shape 只進一次 brief，controller 每 prompt 不受影響——這部分使用者的憂慮不成立；成立的是測試對無 agent 路徑的 2400 常數。

### 怎麼得出 pick

A 在 land 不可行、在 design 不可行、在 survey 與既有範本語意相衝；B 對 B2（每 task 修正輪數）無資料可算；D 不符 `gate-11.md:9` 的完成條件（data-gap 清單只能剩刻意不做的項目）。所以 C：範本側最多 build 一行（或改以 ledger `Fix:` 帶 task 號，零注入字元），其餘 13 項由 `lib/gatereport.js`（拆陣列、收條列）與 `assets/station/station.js`（讀 `clock`/`spend`/`suite.json`/`segs`，加每組小計）補齊；唯一真正缺資料的是 suite 跑過的檔案清單，該補在 `lib/suite.js` 的紀錄，不是報告範本。沒檢查的：`tests/reference-size.js` 的換算細節、`lib/shots.js` 是否已存 mockup 截圖、`suite.js --tree` 的 `tree` 欄是否足以當檔案清單。
