---
status: design-intent
last_verified: 2026-09-14
---

# `## Needs a decision` 的四條 — design

`## Ready` 是空的，`## Needs a decision` 有四條，這份文件把四條一起關掉。三條是
station 的，一條是 hook 的。

四條的答案在 2026-09-14 由使用者在一個 `AskUserQuestion` 裡選定：全遮不算總額、
只存 option label 並把 clip 提到 240、guard 兩個欄位都要看、slash command 加頁面
自偵測。

survey 與 design 兩輪各派了四個 `fankeel-reader` 加一個 `path:line` 檢查階段，
共 16 個 subagent、790,506 tokens；下面每一條括號裡的行號都是那兩輪開檔確認過的，
不是推的。

## 這份設計依賴的一個結構事實

`lib/station.js:375-380` 的 `flatten(model)` 是 **每個 session 進入頁面資料的唯一
一點**：

```js
function flatten(model) {
    const sessions = [];
    for (const r of model.registries) {
        for (const s of r.sessions) sessions.push(Object.assign({ root: r.root }, s));
    }
    return sessions;
}
```

頁面端所有各自加總、各自渲染的地方都在它下游，所以過濾放在這裡，那些地方一行都不
用改：

| 位置 | 它做什麼 | 為何不用改 |
|---|---|---|
| `assets/station/station.js:1143` | `facetsHtml` 直接 `S.sessions.forEach` 數狀態與階段 | `S.sessions` 來自 `flatten` |
| `assets/station/station.js:1151` | 「全部」facet 的標籤用生的 `S.sessions.length` | 同上 |
| `assets/station/station.js:1154` | Registry facet 把每個 `S.projects` 都畫成按鈕 | `S.projects` 同樣在下游 |
| `assets/station/station.js:1186` | 清單計數 `R.length + ' / ' + S.sessions.length` | 同上 |
| `assets/station/station.js:1376` | `genText` 的 `S.projects.reduce` 加總 `unreadable` | 同上 |
| `assets/station/station.js:1077` | 對照專案渲染 `NAMES[k]`，來源是 `:872` 未過濾的 `PKEYS` | 同上 |
| `assets/station/station.js:265` | `windowTotals` 跨 session 加總 `s.days` | 同上 |
| `assets/station/station.js:354` | `projectRows` 逐專案累加 `r.usd` | 同上 |
| `assets/station/station.js:751` | `costModel` 一次 forEach 填 stage、model、main/agent、total | 同上 |
| `assets/station/station.js:312` | `dayPanel` 累加每個 session 的 `mine.usd` | 同上 |
| `assets/station/station.js:890` | `routeGroups` 逐 route 累加 ms/wait/burn/usd | `:1090` 以 `mine` 呼叫，`mine` 在下游 |

`lib/detail.js:602` 的 `largestRemainder` 不受影響：它在 `extract()` 裡對**單一
session** 取整，整個 session 被過濾掉它根本看不到。設計初稿曾以為要改它，那是錯的。

不在 `flatten` 下游、必須各自處理的只有四處，第 1 節逐一列出。

## 1. 不上站的專案

- `station.hide` 加進 `lib/profile.js:17` 的 `KEYS`，值照 `land.push`（`:19`）的布林
  慣例，預設照 `guard`（`:22`）給一個真的值而不是 `null`：
  `{ values: ['true', 'false'], builtin: 'false' }`。`KEYS` 裡每個值都是字串，
  `land.push` 用的就是 `['true', 'false']`。`lib/profile.js:59` 的 `parseValue`
  是唯一驗證點，`:90` 的 `write` 在碰硬碟前先過它，兩者都由 `KEYS` 表驅動，所以加
  一個鍵不需要動任何驗證碼。`parseValue` 同時轉型（`:65` 回 `s === 'true' ? true : s === 'false' ? false : s`，`:78` 的 `pick` 讀檔時也過它），所以下游比的是布林 `true`。
- `lib/station.js:375-380` 的 `flatten` 過濾：`station.hide` 為 `'true'` 的 pkey 之下
  的 session 不進 `serialize()` 的 `sessions`。pkey 的算法是既有的
  `lib/station.js:446` `s.project ? s.root + '/' + s.project : s.root`。
- 判斷「這個 pkey 被藏了嗎」寫成 `lib/station.js` 匯出的一個函式，所有過濾點都呼叫
  它。CONTRIBUTING 的 Scope 表要求 `lib/` 不得反向依賴 `scripts/` 或 `hooks/`，而同
  一個判斷寫兩份就是兩份會分岔的判斷。`scripts/station.js` 只有 `--json` 那一處直接
  呼叫；文字回覆讀 `write()` 回傳的計數，因為 `:743` 的 `const out = station.write(...)`
  之後 model 不在那個 scope 裡。
- `lib/station.js:412` 的 `projects: Object.assign({}, ...model.registries.map((r) => r.profiles || {}))`
  一併過濾。profiles 以專案絕對路徑為鍵（`lib/station.js:335`），留著就等於公布被藏
  專案的路徑和它被設成 `'true'` 這件事。
- `lib/station.js:533-537` 的 detail 檔迴圈跳過同一批 session。它直接走
  `model.registries` → `r.sessions`，不經過 `flatten`，所以要自己的 skip；否則
  `station/detail/<id>.js` 會留在硬碟上供直接取用。
- `scripts/station.js:677` 的 `--json` 自己過濾一次。它寫的是 `station.gather()`
  回的 model，**繞過 `serialize()` 與 `flatten()`**。
- `scripts/station.js:768` 的文字回覆與它的來源 `lib/station.js:479-483` 的 `tally()`
  過濾後多印一行 `N projects hidden by station.hide`，只給數量不給名字。
- 頁面上不加任何指示。`assets/station/station.js` 為這一條一行不改。
- 代價寫下來：藏起來之後 `POST /profile`（`scripts/station.js:545`）會 404，因為
  `scope='project'` 要求目標專案已被跑著的 model 認識，而它剛被過濾掉。解除只能走
  `node scripts/task.js profile set station.hide false`。
- 第二個代價：`assets/station/station.css:15` 的 `--p-0` 到 `--p-5` 是按順序指派給
  專案的，所以藏掉一個會讓其餘專案換色。接受它 —— 顏色不是身分。改成由 pkey 雜湊
  決定顏色會動到每個既有專案的顏色，範圍比這一條大，不放進來。mockup 的螢幕 1 就是
  重排後的樣子。

## 2. gate 的選項標籤與首頁一格

- `lib/replay.js:118` 的 `qs` 條目多一個 `labels` 欄位，存每個選項的 `label`。
  `:117` 已經把 labels 算出來了，只用來決定 `own` 這個 boolean 就丟掉；存它是刪掉
  一個丟棄動作，不是新增擷取。`description` 不存。
- `lib/replay.js:118` 的兩個 `clip(..., 120)` 改成一個具名常數 `GATE_CLIP = 240`，
  宣告在 `lib/replay.js` 檔頂。`lib/registry.js:35` 的 `MAX_NEXT_LEN = 120` 與
  `lib/detail.js:138` 的 `slice(0, 120)` 是不同的東西，不動。
- `lib/station.js` 的 `serialize()`（398-448）多一個跨 session 的 gate 彙總欄位。
  這一步不能省：gate 事件目前只存在 `:537` 寫的 per-session detail 檔裡
  （`lib/detail.js:613` → `:646` → `:677` → `lib/station.js:262` → `:321` → `:464`
  → `:466`），而 `serialize()` 不帶 detail，首頁看不到任何一筆。
- `assets/station/station.js:367` 的 `kpiHtml` 多一個 `roHtml`（`:364`，
  `<div class="ro">` 三格：label、value、delta）格子，讀那個新欄位。
- 彙總量的是 `a !== labels[0]`，按 `labels[0]` 分組：哪一句「選項一」最常輸掉。
  `labels` 是有序陣列，`labels[0]` 就是選項一，而選項一是批准本身，所以它常被換掉
  等於那句批准寫得不對 —— 這正是 TODO 那條想看見的訊號。不是 `lib/replay.js:118`
  的 `own`：`own` 是 `a !== null && !labels.includes(a)`，為真代表答案不在任何選項
  裡，也就是使用者打了 Other，那是另一個量。
- 彙總在 `serialize()` 算完，所以新格子讀的是序列化好的欄位而**不是** `R`。
  `homePage`（`assets/station/station.js:1028`）在 `:1037` 呼叫
  `kpiHtml(windowTotals(R, DAYS), windowTotals(R, PREV))`，那兩個參數是花費的窗口
  總計；gate 彙總跨的是 session 而不是窗口，接 `R` 會讓它隨搜尋框變動而失去「跨
  session」的意思。
- 新格子放進既有那一列，不另開一列。它會讓讀數面板長高約 130px，而 `.hero-top` 的
  `align-items: flex-end` 會把 hero 標題壓到底部；接受那個位移，`align-items` 不改。
  mockup 的螢幕 2 是它的實際樣子。
- 只做「被換掉最多的 label」一個數字。mockup 另外加了「換成什麼」與「最常被選中」
  兩行排行，那超出這條 TODO 問的事，砍掉。

## 3. guard 同時看 agent_id 與 agent_type

- `hooks/guard.js:45` 之前加 `if (!payload.agent_id) return;`。沒有 `agent_id` 就是
  主 session，`agent_type` 是什麼都不擋。`agent_id` 目前在整個 `hooks/guard.js` 裡
  出現零次。
- `hooks/guard.js:52` 的 reason 字串跟著改，把兩個條件都說出來。
- `tests/guard.test.js:361` 的 `bashCall()` 加 `agent_id`。它現在只設 `agent_type`，
  而用它的八個測試（`:366` `:374` `:381` `:387` `:393` `:399` `:406` `:421`）都沒有
  設 `agent_id`；不加的話它們量的東西會從「唯讀 agent 被擋」變成「主 session 被放
  行」，八個一起變綠而什麼都沒測到。
- 新增一個測試：`agent_type` 是唯讀型別、**沒有** `agent_id`、指令會寫檔，斷言放行。
  這個測試現在不存在 —— `agent_id` 在整個 `tests/guard.test.js` 裡是零筆 —— 而它是
  這一條唯一的紅綠證據。
- `docs/collisions.md:181` 與 `:230` 要改。它們是 current 的 reference 頁，`:181`
  直接引 `hooks/guard.js:45` 那一行，`:230` 說判斷有兩個條件；改完變三個。
- `docs/subagents.md:437` 不改。它已經把 `agent_type` 判定叫做 trap，`:430-435` 還引
  了 Claude Code 自己的說明；這個改動是讓程式碼追上那一頁，不是牴觸它。

## 4. `/fankeel-station` 與頁面自偵測

- `skills/fankeel-station/SKILL.md`，frontmatter 用 `skills/fankeel-explain/SKILL.md:1-8`
  的六個欄位：`name`、`description`、`version`、`status`、`last_verified`、
  `source_of_truth`。
- `tests/inventory.test.js:13` 手寫的 `SKILLS` 陣列加一筆。不加就是
  「skills/ holds exactly the known directories」（`:35-47`）紅，而
  `:49-54` 另外要求每個列出的目錄有 `SKILL.md`。
- 技能內容只做一件事：`node <plugin>/scripts/station.js serve --open`。
  `scripts/station.js:51-59` 的 `serve` 與八個旗標都是字面量，`lib/skills.js` 的
  `unknown-flag`（push 在 `:103`）認得；`REQUIRED_CORE`（`:63-66`）對 `station.js`
  的要求已由 `skills/fankeel/SKILL.md:650` 滿足。
- `skills/registry.json` 不動。它由 `scripts/stage-registry.js` 產生
  （`skills/registry.json:2`），而 `lib/stage-registry.js:91-92` 只走
  `lib/stages.js:447` 的七個階段名，`fankeel-station` 不是階段，
  `prompt_byte_budget` 不適用。
- `assets/station/station.js` 加一個輕量輪詢打 `station/health`
  （`scripts/station.js:425` 提供，回 `{ station: true, pid, started }`；
  `:244` 的 `probe()` 用同一條並比對 `pid`）。
- 失敗時的畫面：說數字凍結於何時，不清掉內容。時間戳用頁面自己的 `gen`
  （`assets/station/index.html:15` 的 `<span id="gen">`），不是 health 回的 `started`
  —— `started` 是伺服器開始跑的時間，不是資料寫成的時間。
- 這一條只在 `serve` 下有意義。`--open` 直接開檔（`scripts/station.js:770`）時沒有
  伺服器，輪詢必須自己關掉而不是永遠顯示死亡。

## 什麼算做完

| test | 現在 | 改完 |
|---|---|---|
| `tests/guard.test.js` 新測試：`agent_type` 唯讀、無 `agent_id`、指令寫檔 | 紅 —— `hooks/guard.js:45` 擋下 | 綠 |
| `tests/profile.test.js` 新測試：`station.hide` 設 `'true'` 後 `flatten()` 不回那個 pkey 的 session | 紅 —— `parseValue` 回 `unknown key` | 綠 |
| `tests/replay.test.js` 新測試：gate 事件帶 `labels`，`q` 在 121 到 240 字之間不被截 | 紅 —— `:118` 截在 120 且不存 labels | 綠 |
| `tests/inventory.test.js` 既有的「skills/ holds exactly the known directories」 | 綠 | 加了目錄與陣列條目後仍綠 |
| 整個 `node --test` 套件 | 綠 | 綠 |

加一列在成品上，因為單元測試全綠而頁面上兩個數字差三倍的事在 2026-09-06 發生過：

- **頁面自身一致性**：算出頁面上「30 天花費」那一格的數字，再把 `station-data.js`
  裡可見 session 的 `s.days` usd 自己加總一次，兩者必須相等。在把一個專案設成
  `station.hide: 'true'` **之前與之後各做一次**，兩次都要相等。這句話量的是兩個由同一
  來源導出的圖形是否一致，任何重新設計都不能讓它變得無法被推翻。

## 對照 `.fankeel/map.md`

- `docs/station.md` —— reference，current。`## What each row holds`（`:90`）、
  `## Filtering, and the two views`（`:312`）、`## When it is written, and where`
  （`:411`）、`## Setting a profile from the page`（`:510`）四節都要改。
- `docs/collisions.md` —— reference，current。第 3 節已列出兩處。
- `docs/subagents.md` —— 不衝突，這個改動讓程式碼追上 `:437`。
- map 列為 `planned, not built` 的有兩份，一份是這份文件自己（寫它就把計數從 1 推到
  2），另一份是 `docs/plans/2026-09-09-design-class-prompt.md`，與這四條無關。這份設計
  沒有把任何 design-intent 的東西當成已經存在。

## 沒驗過的一件事

Claude Code 自己的 skill loader 要不要求 `SKILL.md` frontmatter 帶上那六個欄位以外
的東西，才會註冊成一個真的 slash command。本 repo 的測試只斷言既有檔案帶了什麼，
不是 loader 的最低契約，而 loader 在 repo 之外。
