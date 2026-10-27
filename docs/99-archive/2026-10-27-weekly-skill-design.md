---
status: current
last_verified: 2026-10-27
source_of_truth: docs/90-agent/judgements/2026-10-27-weekly-report-skill.md (the judge's pick B and its ten open questions)
---

# fankeel-weekly：區間週報 skill

給兩位教授的週報：使用者選時間區間與 repo，skill 從 fankeel 的完成紀錄、session 紀錄與 git 收資料，模型把它寫成「做了哪幾件事」，使用者確認清單後，腳本把它畫成一頁自足的 HTML。

Frontend work：是。產出是一頁給人看的 HTML，所以有 mockup（`.fankeel/build/2026-10-27-weekly-skill/mockup.html`）。這頁是新頁、不是專案既有頁面的改版，沒有可 `<link>` 的專案樣式表，CSS 內嵌是刻意的——週報要能單檔寄出。

## 流程（三步、兩個 gate）

1. **問**（一次 AskUserQuestion，兩題）
   - 區間：`上週五到今天`（預設）／`近兩週`／自訂（Other 填 `YYYY-MM-DD..YYYY-MM-DD`）。
   - Repo：`weekly.js scan` 先掃，列出區間內有 commit 的 repo 與 commit 數，multiSelect，預設全勾。
2. **收**：`node <plugin>/scripts/weekly.js collect --since A --until B --repos p1,p2 --out <dir>/data.json`
   - 有 `docs/90-agent/records/` 的 repo：區間內每則 `## 日期 標題` 是一件事，帶五欄（不取花費欄）。區間跨月讀兩個月檔。
   - `.fankeel/sessions/*.json` 中 `updated` 落在區間、`stage` 不是 land、未 `ended` 的 → 進行中的事。
   - 每個 repo：每日 commit 數（時間軸用）；沒有 records 的 repo 另依 conventional-commit scope 分群（`feat(mip_extract)` → `mip_extract`），列出每群的 commit 標題。
3. **寫 + 確認**：模型讀 `data.json`，寫 `events.json`：每件事一則 `{ title, repo, status: done|ongoing, did, why, next, evidence }`，全繁中、對外說法、不用內部名詞；同標題的多則紀錄（如每週的「TODO 全表盤點」）併成一則並註次數。**Gate 1**：把清單以表格列出，問「照這份出頁／要改」，改的話照使用者的話改完再問一次。
4. **畫**：`node <plugin>/scripts/weekly.js render --events events.json --data data.json --out <dir>/weekly.html`，寫前守門；印出路徑，用 `start` 開啟。**Gate 2**：頁面可以，或指哪裡要改。

輸出位置：`<configDir>/fankeel/weekly/<迄日>.json` 與 `<迄日>.html`（與監控站的 `index.html`、`roots.json` 同一處），**不進任何 repo**——fankeel 是外掛的 repo，SBIR 的工作內容不能 commit 進去。

## 監控站整合（2026-10-27 使用者選「skill 產生，站上管理」）

- 站上新增 `#/weekly` 頁：依迄日由新到舊列出歷次週報（區間、完成、進行中、涉及專案），點一列在站內開該份 html；頁首有一個複製 `/fankeel-weekly` 指令的按鈕。站本身不產生週報（站沒有模型）。
- 前後期銜接：`collect` 讀最新一份 `weekly/*.json`，預設區間從它的迄日隔天開始；它的 `next` 進入這次的 data，週報多一個區塊 `carry`：「上次說的下週打算 → 這次做到沒」，每條標示 做到／部分／沒做，由模型對照這次的事來判斷，並在 Gate 1 一起給使用者確認。
- 進出（2026-10-27 核准時補充「要可以跳回 station，哪裡進來哪裡出去」）：進來是站上 `#/weekly` 列表點一列，站以 `GET /station/weekly/<迄日>.html` 回傳那份週報；這條路由在回傳前於 `<body>` 開頭注入一條導覽列（`data-block="weekly-nav"`）：「← 回週報列表」連回 `/#/weekly`，以及「上一份／下一份」連到相鄰迄日的週報。導覽列只由站注入、不寫進歸檔檔案，所以寄出去的單檔沒有它，教授看不到站的連結。產生完的 `start` 開啟也走站的這條路由（站有在跑時），讓剛產生的那份同樣有路回站上。
- 樣式：週報改用監控站的設計語言。`render` 讀 `assets/station/station.css` 的 `:root`、深色區塊，再疊上 `:root[data-style=keel]` 的淺色與深色區塊（站實際用 keel 樣式，`index.html` 設 `data-style="keel"`；只取 `:root` 會是舊的灰綠樣），寫進 html 的 `<style>`——單檔寄得出去，配色與字型和站一致。

## 架構圖：這週改到哪裡（2026-10-27 使用者第二輪意見）

使用者要週報「不是單純量化，而是讓人真正理解這一週做了什麼」，並問能否和 chartroom 結合：專案的架構畫成圖，這週被改到的部分上色。

- **模組從哪來**：repo 有 `.fankeel/map.md` 就用它的目錄樹與每列說明（那是專案自己維護的地圖）；沒有的 repo 用 `git ls-files` 的前兩層目錄（只有一層有意義的就一層），每個目錄是一個模組。
- **改動量**：`git log --numstat --since --until` 依模組加總新增／刪除行數與檔案數。
- **畫法**：`collect` 為每個專案寫一個 `.board`（chartroom 格式：模組是 node、上層目錄是 frame），依改動占比分四級上色，沒動到的灰掉；`render` 用 `lib/board.js` 的 `renderBoard` 畫成 SVG 內嵌。上色需要 `lib/board-look.js` 多一種「改動熱度」的類別色——這是 board 唯一要動的地方。
- **和逐事卡對上**：每張事卡列出它動到的模組（模型依該事的 commit 路徑標），卡上的模組標籤與架構圖上的方塊同色同名，教授能從圖看到「這件事改的是這一塊」。
- **事卡的模組怎麼來**：mockup 是用 commit 標題關鍵字比對的近似值；實作時用事實——fankeel 的事讀 session 紀錄的 `claims`（該任務動過的檔），只有 git 的 repo 的事就是它那群 commit 的檔案路徑。
- **熱度不被資料檔灌大**：mockup 實測 10/17–10/27 改動 +384,275／−30,114 行，其中資料與實驗輸出 +172,431、文件 +131,091。架構圖熱度與 KPI 主數字只算程式與測試；文件、資料另列小字。資料目錄的判定：`.gitattributes` 標 `linguist-generated`／`-diff` 的、或副檔名為 csv／json／jsonl／tsv 且單次 commit 超過 1,000 行的。
- **窄螢幕的圖**：768px 以下架構圖不再等比縮小（390px 時字只剩 5–7px），改成固定最小寬度、可橫向捲動，旁邊的「改動最多的五個模組」清單照舊。
- **KPI**：「有工作的天數」換成「改動量」：`+新增 / −刪除 行，N 個檔案`。四個 KPI：完成、進行中、涉及專案、改動量。
- **閱讀性**：頁首「本期重點」改成兩到三條主線（每條一句標題＋一句說明），區塊標題有編號與一句導讀，事卡標題放大、先一句結論再分欄。
- **RWD**：版面隨寬度變化——寬螢幕架構圖與事卡並排、窄螢幕單欄；熱度格在窄螢幕改成每個專案一列可橫向捲動；架構圖 SVG 以 `viewBox` 縮放。

## 十個問題的答案

| # | 問題 | 決定 |
|---|---|---|
| 1 | 事的粒度 | 一則 record 一張卡；同標題多則合一張註「×N」。只有 git 的 repo 一個 scope 一張。 |
| 2 | 確認 gate | 要。Gate 1 在出頁前看事清單——scope 分群不穩，這是唯一能改的地方。 |
| 3 | 對外一句話誰寫 | 模型每次現寫，存在該次的 `events.json`；不在 record 加欄位（land 不改）。 |
| 4 | 時間軸單位 | 日 × repo 的熱度格（git 每日 commit 數，分四級色），所有 repo 都有資料。 |
| 5 | KPI | 四個：完成的事、進行中的事、涉及專案數、改動量（+／− 行與檔案數）。commit 數、版號不進 KPI。 |
| 6 | 自足性 | CSS 內嵌、只用 inline SVG／CSS 畫圖、不引任何外部檔或字型。 |
| 7 | 輸出路徑 | `<configDir>/fankeel/weekly/<迄日>.{json,html}`，歸檔不 commit，監控站的週報頁讀它。 |
| 8 | 給自己模式 | 不做。第一版只有教授版，花費整條路不讀。 |
| 9 | 多語 | 全頁繁中；英文 commit 由模型轉述，不留原文。 |
| 10 | 禁詞守門 | `render` 寫前擋：內建詞表（session、gate、station、brain、TODO、subagent、`$` 金額、UUID 樣式 id）＋ `.fankeel/sensitive.txt`（重用 `lib/sensitive.js`）。命中就 exit 1 並列出哪張卡哪個詞，不寫檔。 |

## 頁面區塊

`data-block` 名稱即 mockup 上的名稱：

1. `header`：標題「工作週報」、區間、產生日期、涉及專案。
2. `summary`：本期一句話，三到五句。
3. `kpis`：四張 KPI 卡。
4. `timeline`：日 × repo 熱度格。
4b. `architecture`：每個專案一張 chartroom 架構圖，這週動到的模組依改動量上色。
5. `events`：逐事卡，完成在前、進行中在後；每卡：標題、專案標籤、狀態、做了什麼、為什麼、下一步，底部小字證據（紀錄日期或 commit 區間）。
6. `carry`：上次說的下週打算 → 這次做到沒（沒有上一份就不出這區）。
7. `next`：未完成與下週打算（從進行中的事與各卡的下一步彙整）；下一份週報的 `carry` 就是讀它。
8. `footer`：資料來源（records 月檔、git 區間、session 紀錄）。

站上的週報頁：`weekly-list`（歷次列表）、`weekly-copy`（複製指令按鈕）。

## 檔案

| file | change | dispatch |
|---|---|---|
| `skills/fankeel-weekly/SKILL.md` | 新：上面四步、兩個 gate、events.json 的欄位與寫法規則 | implementer, sonnet |
| `scripts/weekly.js` | 新：`scan`、`collect`、`render`（含守門）；HTML 由字串拼成、CSS 內嵌 | implementer, opus（render 要貼 mockup） |
| `tests/weekly.test.js` | 新：collect 的區間與跨月、合併、scope 分群；render 的禁詞擋與自足（無 `src=`/`href=` 外連） | 同上 |
| `assets/station/weekly-page.js`、`assets/station/weekly-page.css` | 新：`#/weekly` 頁，照 `docs-page` 的模組寫法；`station.js` 的 `PAGES` 與側欄加一項 | implementer, opus |
| `scripts/station.js` | 加 `GET /station/weekly`（列表 JSON）與 `GET /station/weekly/<迄日>.html`（回傳歸檔檔案） | implementer, sonnet |
| `docs/90-agent/reference/station.md` | 補週報頁與兩條路由 | writer |
| `lib/board-look.js` | 加改動熱度的四級類別色（淺深兩套） | implementer, sonnet |
| `lib/profile.js` | 加 `weekly.roots`：掃 repo 的根目錄，逗號分隔，預設為 registry root 的上一層 | implementer, sonnet |
| `docs/01-guide/station.md` | 加一節：怎麼跑週報 | writer |

Repo 掃描：`weekly.roots` 每個根目錄往下一層，以及再下一層（`F:\ymlab\SBIR\ProjectWorkspace\*` 這種），有 `.git` 的才算。

## 驗收

- `node --test tests/weekly.test.js`：現在檔案不存在、失敗；做完要過，其中一題是在一張卡塞「session」一詞，render 必須 exit 1 且不寫檔。
- 實跑 2026-10-17..2026-10-27，fankeel + Trovara + ils-bench，產出的頁經 `design-lint.js` 無錯、`render.js` 截圖與 mockup 同區塊齊全。

## 沒驗過

只有 git 的 repo 用 scope 分群，在 Trovara／ils-bench 真實 commit 上會分出幾群、群是否合理，沒有實測；Gate 1 是為這個留的。
