---
judged: 2026-10-25T12:17:26.872Z
model: fable
agent: fankeel-judge
task: "分析：前端修改為何沒自動跑渲染 reviewer"
session: ef3cf326-729b-4cb4-b000-fe4b94ba20b2
stage: survey
---

# 30 — 前端修改為何沒有自動跑渲染 reviewer

## Question

# 30 — 前端修改為何沒有自動跑渲染 reviewer

## Question

近 30 天（2026-09-25 到 2026-10-25）凡是有前端畫面修改的 fankeel session，
plugin 明明設計了 `fankeel:fankeel-render-reviewer`，應該在 build 的前端任務
與 verify 站自動跑，但使用者回報「每次都要使用者在 gate 再選一次渲染測試才會跑」。
為什麼沒自動跑？根因在哪一層，該怎麼改成自動？

## Options（判官可推翻、可合併）

A. 規則／skill 文字層：build 或 verify 的 SKILL.md、`agents/fankeel-brain.md` 沒把
   render reviewer 寫成必派，或寫成「問使用者」的選項，所以站 agent 把它丟進 gate。
B. 觸發條件層：判斷「這是前端改動」的程式（`lib/stages.js`、`scripts/verify-map.js`、
   `lib/shots.js`、`.fankeel/render.json` 是否存在／是否涵蓋改到的檔）沒命中，
   自動路徑根本沒觸發，只剩 gate 選項可走。
C. 執行環境層：render reviewer 有被派，但 `scripts/render.js` 需要 Chrome
   （FANKEEL_BROWSER 完整路徑）、dev server 或 session 參數，失敗後被降級成
   「問使用者要不要跑」。
D. 站 agent 行為層：規則有寫要派，但 brain 在乾淨 context 裡為省成本／省時間
   選擇不派，改把它列成 gate 選項（規則被當成建議）。
E. 以上組合，或別的原因。

## Background

- `stage.agents` = survey,build,verify：這三站由 `fankeel:fankeel-brain` 在乾淨
  context 跑，主控只轉路徑、問 gate。
- `task.js stage <name> --render <file>`：help 說「leaving build with no plan, a page
  change needs the render reviewer's return」——有一道離開 build 的關卡跟 render 有關。
- `design.mockup` = opus：有前端的專案 design 站先畫 mockup，render reviewer 拿
  mockup 跟實際頁面比對。
- 使用者記憶：跑 suite 要把 FANKEEL_BROWSER 設成 chrome.exe 完整路徑並帶 --session，
  否則失敗或靜靜什麼都沒跑。這可能跟 C 有關。

## Paths to read

Plugin（F:/ymlab/fankeel）:
- `agents/fankeel-render-reviewer.md`, `agents/fankeel-brain.md`, `agents/fankeel-reviewer.md`
- `skills/fankeel-build/SKILL.md`, `skills/fankeel-verify/SKILL.md`
- `lib/stages.js`, `lib/guard.js`, `lib/shots.js`, `lib/settingsuggest.js`
- `scripts/task.js`（`--render` 的處理）, `scripts/verify-map.js`, `scripts/render.js`, `scripts/ledger.js`
- `.fankeel/render.json`（若存在）
- `git log --since=2026-09-25 -- agents/fankeel-render-reviewer.md skills/fankeel-verify skills/fankeel-build scripts/render.js lib/shots.js`

Session 證據（近 30 天）:
- 本機 transcripts：`C:/Users/user/.claude/projects/F--ymlab-fankeel/*.jsonl`（與其
  `<session>/subagents/agent-*.jsonl`），用 `node scripts/conversation.js`
  （含 `--sidechain`）讀。
- 每個任務的站報告與 gate：`.fankeel/build/task-*/build.md`、`verify.md`、
  `*-answer.md`；找 gate 裡出現「渲染」「render」「截圖」選項的，以及使用者選它之後
  才出現 render-reviewer dispatch 的。
- 至少找出 3 個具體 session／task 當案例：改了哪些前端檔（assets/station/*.css、
  *.html、*.js）、verify 有無派 render reviewer、gate 的選項文字、使用者選後發生什麼。

## What counts as an answer

- 指出根因落在哪一層（A–E），每個主張附 path:line 或 transcript／build 檔的具體行。
- 說明「自動」本該在哪個點觸發（哪個檔、哪條規則），以及實際上為何沒觸發。
- 給出最小修改：要改哪幾個檔、改成什麼行為，讓前端修改在 verify（或 build 前端任務）
  不經使用者選擇就派 render reviewer；若有必須保留的人工步驟（例如 Chrome 不在），說明它該怎麼失敗而不是變成 gate 選項。
- 不確定的地方寫不確定，不要猜。

## Answer shape

六個欄位（pick / why / evidence / risk / instead / delegated），`pick:` 行必填，
接 `## Summary`，用繁體中文寫，長度不限，含案例表（session 或 task id、日期、前端檔、
render reviewer 是否自動派、gate 怎麼問）。

## Answer

pick: E（B+D 的組合）：根因是觸發條件層 B——本 repo 從未有 `.fankeel/render.json`，所有程式強制（ledger.js/task.js renderRefusal）因此靜默放行；在沒有機械強制下，站 agent 行為層 D 接手——brain 把「沒有 render.json」誤讀成「不必派」，報告坦承「沒有實際渲染」後把補救寫成 gate 選項，使用者選了才跑。A（規則沒寫必派）與 C（Chrome 環境）排除。
why: 規則層已寫必派：skills/fankeel-build/SKILL.md:434「A page task runs it by default, every time」、:431「render.json where the project has one — a page path otherwise」；verify/SKILL.md:275-280 也要求派。程式層唯一強制是 scripts/ledger.js:537-545 與 scripts/task.js:963-966 的 renderRefusal，ledger.js:543 明寫「No render.json, or no page with src, is never refused」，而本 repo `.fankeel/render.json` 從未存在（git log --all 零筆）。brain 在乾淨 context 中因此一再寫「專案無 .fankeel/render.json,故未派渲染審查」（.fankeel/build/task-20261019T155003/build-g11.md:6；47bc7b65 a9ee7a1c:50；6e2bf71c abdb4cfa:143；33ca21cf ad1a4aa3:109；71c638b2 a39557e8:76）。gate 從沒有「要不要跑 render reviewer」選項，只有「回 build 補窄版渲染測試」（task-20261025T001313/verify-answer.md:12）、「先在瀏覽器看進行中頁——沒有跑渲染審查」（53b0565d.jsonl:2000）這類補救選項，這就是使用者「每次要在 gate 再選一次」的體感來源。C 排除：render.js 找不到瀏覽器是 stderr+exit 2（scripts/render.js:125-126），brain 都有 export FANKEEL_BROWSER，30 天內沒有任何因 Chrome 缺失而降級成 gate 的案例。
would flip if: 若 repo 內其他層級（例如 assets/station/.fankeel/render.json）存在且被 lib/shots.js nearestTargets 讀到、src 涵蓋 station 檔，則 B 不成立，根因純屬 D。若 10-19 之後的 build 其實多走 tuning loop（build/SKILL.md:434-436 合法跳過），則 D 的「誤讀」程度降低。
unread: nothing（所有 brief 列的路徑都由 reader 讀過；`.fankeel/render.json` 不存在；10-01~10-06 的三個 task 與 10-09~10-20 的四個 brain 線程只讀計數未讀內文，見 Summary）
delegated: agents/fankeel-render-reviewer.md、agents/fankeel-brain.md、agents/fankeel-reviewer.md — opus；skills/fankeel-build/SKILL.md、skills/fankeel-build/rationale.md、skills/fankeel-verify/SKILL.md — opus；scripts/task.js、lib/stages.js、lib/guard.js — sonnet；scripts/render.js、lib/shots.js、scripts/verify-map.js、lib/settingsuggest.js、scripts/ledger.js、.fankeel/render.json（不存在）、.fankeel/profile.json — sonnet；git log（指定路徑，--since 2026-09-25）— sonnet；.fankeel/build/task-*/{build,verify,*-answer}.md — sonnet；C:/Users/user/.claude/projects/F--ymlab-fankeel/*.jsonl（159 個主 session）— sonnet；…/<session>/subagents/agent-*.jsonl（3336 線程，355 個 brain）— sonnet
checklist: 1 render-reviewer.md 何時被派／需要什麼 — answered；2 brain.md 必派或選項 — answered；3 reviewer.md 有無取代 — answered；4 build SKILL 條件與 --render — answered；5 verify SKILL 條件 — answered；6 task.js/stages.js/guard.js 關卡怎麼判 — answered；7 render.js/shots.js 環境需求與失敗模式 — answered；8 verify-map/settingsuggest/ledger 偵測前端 — answered；9 .fankeel/render.json — answered（不存在，從未存在）；10 git log 30 天 — answered；11 task-* handoff 的 gate 文字 — answered（36 個前端 task 檢視，10-01~10-06 三個只計數）；12 主 session transcripts — answered（4 個 session 有真實派送，皆自動）；13 brain 子線程決策 — answered（10-21 之後逐一讀，10-09~10-20 四個只列未讀）

## Summary

### 一、問題的真正形狀

使用者的描述是「每次都要在 gate 再選一次渲染測試才會跑」。證據顯示 gate 裡**從來沒有**一個叫「跑 render reviewer」的選項；實際發生的是：brain 在 build 或 verify 站自己決定不派 render reviewer，在報告裡坦白寫「沒有實際渲染」，然後把補救動作（回 build 補渲染、先開瀏覽器看）列成 gate 選項之一。使用者選了那個選項，下一輪 brain 才派 render reviewer 或自己開 Chrome 看。所以「要再選一次」是結果，不是機制；機制在於為什麼 brain 第一輪不派。

### 二、逐層排查

**A. 規則／skill 文字層 — 排除。** 規則寫得很清楚、而且是「預設必派」：

- `F:/ymlab/fankeel/skills/fankeel-build/SKILL.md:428-431`：「A task that changes a page gets a second reviewer in the same response: subagent_type: fankeel:fankeel-render-reviewer … Give it … `.fankeel/render.json` where the project has one — a page path otherwise.」
- `:434-438`：「A page task runs it by default, every time.」唯二例外是 tuning loop 的單一請求，以及使用者當場說跳過（要寫 `Ruling: render skipped`）。
- `F:/ymlab/fankeel/skills/fankeel-verify/SKILL.md:275-280`：「When the claim under evidence is about what a page shows, dispatch … fankeel-render-reviewer beside it … Leave it off a change with no screen behind it.」
- `F:/ymlab/fankeel/agents/fankeel-brain.md:234-235`：「On a verify stage the adversary and the render review are such agents: the gate is written after both returned」——預設 verify 會有 render review。
- `agents/fankeel-reviewer.md:42-43`：「What a page renders is fankeel-render-reviewer's question, not yours.」——一般 reviewer 不會頂替。
- 兩個 SKILL.md 的 Output 區塊只寫「then AskUserQuestion」（build:729、verify:348），沒有任何預製的「渲染測試」選項。

git 歷史（reader 5）：render reviewer 於 2026-09-23 建立（523b5960），10-01 a5c55dd2 加入「page tasks 預設跑、tune 請求跳過」，10-15 一組 commit（bc09e9f9、1cff345a、df937719、d2d5175b、57c8b60f）加上 render.json `src` glob 與 ledger 拒絕。30 天內沒有任何 commit 把 render review 從自動改成 gate 選項。

但有一處文字鬆動值得注意：build/SKILL.md:428 說「changes a page」、verify/SKILL.md:275 說「claim is about what a page shows」、:280「no screen behind it」——這三處都沒有機械定義（不看 .css/.html），全交給 brain 判斷。這不是根因，但它讓 D 有空間。

**B. 觸發條件層 — 主根因。** 程式層唯一的強制點是 renderRefusal：

- `F:/ymlab/fankeel/scripts/ledger.js:537-545`（plan 路線的 `complete`／`fix`）與 `F:/ymlab/fankeel/scripts/task.js:963-966`（無 plan 路線離開 build：`if (from === 'build' && name !== 'build' && !route.includes('plan'))`），兩者都走 `lib/shots.js` 的 `pagesReached` → `verdictRefusal`（task.js:904-907）。
- 判斷「page change」的方式：每個改到的檔往上找最近的 `.fankeel/render.json`，比對 pages[].src glob（shots.js:130-166）。**沒有任何 .css／.html／assets 名稱偵測。**
- `ledger.js:543` 原文：「No render.json, or no page with `src`, is never refused」。
- `F:/ymlab/fankeel/.fankeel/render.json` **不存在，且 `git log --all` 零筆，從未存在**（reader 4）。`.fankeel/profile.json` 只有 `design.mockup: opus`，沒有任何 render／browser 鍵。
- 所以在這個 repo，所有強制都是空集合：build 不帶 `--render` 也能 complete、也能 `stage verify`；verify 站本身在 task.js 中沒有任何 render 檢查（reader 3 (c)）。
- `lib/settingsuggest.js:17,102` 其實已經有 `FRONT = /\.(html|css|vue|svelte|jsx|tsx)$/i` 判斷「這是前端專案」，但只用來決定 `design.mockup` 建議（:146-148），沒有接到 render 強制或建議建立 render.json。
- `scripts/verify-map.js:70-78,112` 讀 render.json 只為了 `kind: page` 的 feature 檔對應，沒有 render.json 時只 warn。

**D. 站 agent 行為層 — 次根因，而且是使用者體感的直接來源。** brain 在乾淨 context 裡，把「沒有 render.json」當成「不派」的理由，與規則 :431「a page path otherwise」相反：

- `.fankeel/build/task-20261019T155003/build-g11.md:6`：「專案無 .fankeel/render.json,故未派渲染審查」（抽查原文一致）。
- 47bc7b65 子線程 agent-a9ee7a1c:50：「專案沒有 .fankeel/render.json，所以沒派 render reviewer。」（抽查一致）
- 6e2bf71c abdb4cfa:143：「沒有派 render-reviewer，因為這個 repo 沒有 .fankeel/render.json；畫面改由 task 9 的 verifier 用 render.js … 截圖」
- 33ca21cf ad1a4aa3:109：「未派每任務的 verifier 與 render-reviewer（沒有 .fankeel/render.json，我自己用 Chrome 驗）」
- 71c638b2 a39557e8:76：「沒有在瀏覽器裡看實際的焦點頁…因此沒派 render reviewer」→ gate 選項「先在瀏覽器看焦點頁」
- task-20261023T165321/build-g1.md:17：「未做:render reviewer(此 repo 沒有 .fankeel/render.json)」
- 00e02e3b a9e0cbf8:52（verify，10-25）：靜默略過，報告寫「沒有實際渲染」→ gate 選項「回 build 補窄版渲染測試」（task-20261025T001313/verify-answer.md:12-13，抽查一致）
- 53b0565d af46c4cd:379：「沒跑渲染審查，也沒在真實瀏覽器看過那個頁面」→ gate 選項「先在瀏覽器看進行中頁 — 沒有跑渲染審查，也沒真的看過停了列的版面」（53b0565d.jsonl:2000，抽查一致）；使用者選了之後 :392 才派。

一個推論（INFERRED，非確證）：10-14～10-18 的四個 session（41d84a4b、349c5d13、a5d8d5db、cd62ad07）都**自動**派了 render reviewer，a5d8d5db 的 reviewer 甚至回「ship — No render.json… shot the single live page」，證明沒有 render.json 也能派、也能拍。10-19 之後「沒有 render.json 故不派」才成為常態。時間點恰好在 10-15 那組 commit 之後——skill 多了大段「Where .fankeel/render.json gives a page src globs … is refused」文字（1cff345a、df937719），brain 可能把「有 render.json 才拒絕」反讀成「沒有 render.json 就不需要」。這個因果我沒有直接證據，只有時序。

**C. 執行環境層 — 排除。**
- `scripts/render.js:68-85`：FANKEEL_BROWSER 先試，再依序試 Edge、Chrome、ms-playwright；找不到時 `:125-126` 印 stderr 並 `exit(2)`，是響亮失敗不是靜默。render.js 沒有 `--session` 旗標（reader 4）。
- `agents/fankeel-render-reviewer.md:76-78`：沒有瀏覽器時回 `disposition: recapture` 帶該行，不會變成「問使用者」。
- reader 8 掃過 355 個 brain 線程，所有 render.js 呼叫前都有 `export FANKEEL_BROWSER=".../chrome.exe"`；唯一的瀏覧器失敗是測試 suite 的 11 筆（33ca21cf a318560b:85），與 render reviewer 無關。
- render reviewer 真正回 recapture 的原因是「工具無法點擊、拍不到展開狀態」（cc4be444）與「stale :28888 server」（c626e3b0 a629d34c:72,87），都不是 Chrome。
- 使用者記憶「suite 需要 FANKEEL_BROWSER」屬實，但那是 tests 的事，不是本題。

### 三、案例表

| session / task | 日期 | 前端檔 | render reviewer 自動派？ | gate 怎麼問 |
|---|---|---|---|---|
| 41d84a4b | 10-14 | station gate 按鈕（Edit 掃描未抓到檔名） | 是，1 次，disposition fix | 無渲染選項 |
| 349c5d13 | 10-14 | assets/station/station.js, station.css | 是，1 次 | 無 |
| a5d8d5db / 2026-10-18-plan-gate-page | 10-17～18 | station.js, plan.css | 是，build 3 次 + verify 1 次；verify 回 ship「No render.json… shot the single live page」 | 無 |
| cd62ad07 | 10-18 | station.js, i18n.js, gate.css, fragment.html | 是，1 次 + 2 次 recapture 重拍 | 無 |
| 45487ab9 / task-20261019T155003 | 10-19～20 | assets/station/index.html, spend-*.js | **否**：build-g11.md:6「專案無 render.json,故未派」 | 無 |
| 47bc7b65 / task-20261020T111939 | 10-21 | station board cards | **否**：a9ee7a1c:50；build-g3.md:2 寫 skip ruling | 無 |
| 33ca21cf / task-20261022T021538 | 10-22 | remote-card.js, station.css | 派了→recapture（無 render.json、卡片需即時狀態）→寫 render skipped ruling；verify 未派 | 無 |
| 6e2bf71c / task-20261022T065333 | 10-22 | mobile.css, mobile.js | **否**：abdb4cfa:143 | 無 |
| cc4be444 / task-20261023T095452 | 10-23 | index.html, station.css | 是→recapture（無法點擊） | 「verify (Recommended)…目前只有讀 CSS 的測試,沒有渲染證據」／「我先手動看展開面板」 |
| 53b0565d / task-20261023T122952 | 10-23 | live-page.css, station.css, station.js | **build 否**；使用者選後才派（af46c4cd:379→:392），且拍失敗；verify 再略過（a5ea7d74:137） | 「先在瀏覽器看進行中頁 — 沒有跑渲染審查」 |
| 71c638b2 / task-20261024T123427 | 10-24 | focus-page.js, *.css | **否**：a39557e8:76 | 「先在瀏覽器看焦點頁 — 沒派 render reviewer」 |
| c626e3b0 / task-20261024T005748 | 10-24 | docs-page.js, gate-frame.js | build g6 派了→recapture（stale :28888）→skip ruling；verify 未派 | 無 |
| 00e02e3b / task-20261025T001313 | 10-25 | settings-detail.css, settings-page.js | **否**：verify 靜默略過 | 「land (Recommended)…沒有實際渲染」／「回 build 補窄版渲染測試」 |

另有 047bc73b（10-20）、1452cf01（10-18，有一筆 render skipped）、66a6563a（10-21）、9f451488、97a16e9b、d5098a7f 等前端 session 零派送。

### 四、「自動」本該在哪裡觸發、為何沒觸發

1. **build 站每個 page task 的審查回合**（build/SKILL.md:428-438）：規則要 brain 在派 fankeel-reviewer 的同一回應裡派 render reviewer。沒觸發是因為 brain 判斷「沒有 render.json ⇒ 不是 page task／不必派」。
2. **離開 build 的機械關卡**（task.js:963；ledger.js:545）：本該在沒有 `--render` 時拒絕。沒觸發是因為 pagesReached 找不到 render.json，回傳空集合，ledger.js:543 設計上就不拒絕。
3. **verify 站**（verify/SKILL.md:275）：純文字規則，task.js 沒有 verify 端檢查；brain 以「no screen behind it」或「沒有 render.json」略過。

### 五、最小修改

**(1) 必做：在本 repo 建 `F:/ymlab/fankeel/.fankeel/render.json`。** 依 lib/shots.js:9-10 的 schema，列 station 的頁（首頁、/f/<id>/plan、/f/<id>/gate、settings、live、docs、focus 等，url 用 `http://127.0.0.1:28888/...`，roles 至少 guest），每頁 `src` 涵蓋 `assets/station/**`、`lib/station*.js`、`scripts/serve.js`、`assets/station/index.html` 等真正畫頁面的檔。這一步不改任何程式，既有的 ledger.js:545／task.js:963 拒絕立即生效：改到 station 檔卻沒有 `--render <disposition: ship 檔>` 就不能 complete、不能離開 build，brain 不可能再「靜默略過然後寫成 gate 選項」，只能派 render reviewer 或明寫 `Ruling: render skipped — <why>`。附帶要求：brain 在派 render reviewer 前要確認 :28888 有活的 station（c626e3b0 的 stale server 就是沒做這步）。

**(2) 規則補一句，堵住誤讀。** 在 build/SKILL.md:431 之後與 verify/SKILL.md:280 之後各加：「沒有 `.fankeel/render.json` 不是略過的理由；給 page path 照派。要略過只能先寫 `Ruling: render skipped — <why>`。報告的 gate 不得以『先手動看』『回 build 補渲染』取代這個 ruling。」並在 agents/fankeel-brain.md:234 旁補：「沒有 render verdict 也沒有 skip ruling 時不得寫 gate。」

**(3) 建議：程式層補洞，讓沒有 render.json 的專案也不靜默。** 在 lib/shots.js `pagesReached`（或 ledger.js:545／task.js:904 呼叫處）加一條：當找不到任何 render.json、但改到的檔符合 settingsuggest.js:17 的 FRONT regex，回傳拒絕訊息「fankeel — this change touches <files> but no .fankeel/render.json names a page for it; add one, or note `Ruling: render skipped — <why>`」。同時 settingsuggest 的 `front` 判斷（:102）可在 init／settings 階段多產生一條「建立 render.json」建議。這與 docs/90-agent/plans/2026-10-15-render-gate-design.md §1「No render.json is never refused」的設計相違，需要先改那份設計決議。

**(4) Chrome 不在時該怎麼失敗。** 保持現狀即可：render.js:125-126 stderr + exit 2；render reviewer 依 agents/fankeel-render-reviewer.md:76-78 回 `disposition: recapture` 帶那行；因為 recapture ≠ ship，(1) 之後 ledger 會拒絕 complete，brain 只能寫 `Ruling: render skipped — no Chromium browser on this machine` 才能前進——這是一個留痕的失敗，不是 gate 選項。若要更早發現，brain 可在 build 開頭跑一次 `node scripts/render.js --config` 探測。

### 六、沒能確認的地方

- 10-01～10-06 的三個 task（20261001T093640、20261001T121340、20261005T165703）render 相關字樣 14／24／32 筆，只計數未讀內文。
- 10-09～10-20 的四個 brain 子線程（8e505921、9f451488、65a1bc64、1b483aed）未讀決策內文。
- 10-19 之後「不派」是否有部分屬於合法的 tuning loop 跳過，未逐一核對。
- 10-15 skill 文字改動與 10-19 起 brain 行為轉變之間的因果，只有時序，無直接證據。
- 未實測 render.js 對無法連線的 localhost URL 的行為（reader 4 推測可能拍到錯誤頁且 exit 0）。
- context.md 已新增 4 條事實（寫入 F:/ymlab/fankeel/.fankeel/build/task-20261025T120059/context.md，session ef3cf326）。
