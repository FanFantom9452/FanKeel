---
status: design-intent
last_verified: 2026-10-02
---

# TODO：資料夾不再產生 TODO.md、條目 body 加厚、station 呈現 body、手寫 TODO.md 遷移改為詢問

session 9a6a429a-a483-48db-afda-4868efaf4b54 的 design。survey 的 gate 使用者選「去 TODO.md、條目加 body、
station 展開，加 station 啟動腳本 .bat/.sh」；第一版 design 之後使用者補充：手寫 `TODO.md` 留著——
使用者可能本來就習慣寫它——在專案 onboarding 時問要不要把它的內容遷進 docs，變成完整可追蹤的條目檔。
這頁描述要做成的樣子，不是現在的樣子。

現況（survey 已查，見 `.fankeel/build/task-20261002T051320/survey.md`）：`TODO.md` 由 `lib/todo.js`
的 `writeIndex` 從 `docs/90-agent/todo/*.md` 產生，沒有任何條目檔沒有的資訊；`todo.js new` 沒有 `--body`，
open 的 20 條裡 18 條 body 是空的；`lib/station.js:352` 的 `todoOf` 不把 `body` 傳給頁面，
`assets/station/station.js:2377` 的 `todoPanelHtml` 只畫 title 與 description；
`skills/fankeel-init/SKILL.md:79-84` 遇到既有 `TODO.md` 一律宣告 bucket 並 `todo.js migrate`，不問。

兩種模式並存，由 `.fankeel/docs.json` 有沒有 `role: todo` bucket 決定（`lib/todo.js` 的 `folderOf`，不變）：

- folder mode（有 bucket）：條目檔是唯一的來源，不再產生 `TODO.md`。
- 手寫模式（沒有 bucket）：使用者自己的 `TODO.md` 照舊被 `load()`、`orient`、todo-check 與 station 讀，
  行為不變。signpost 特判（`lib/docs.js`、`lib/map.js`、`lib/plantasks.js`、`scripts/docs-audit.js`、
  `scripts/docs-check.js`、`scripts/orient.js` 的 SIGNPOSTS）為這個模式保留，不動。

## 1. folder mode 不再產生 TODO.md

- `lib/todo.js`：`add`、`close` 不再寫 `TODO.md`；`writeIndex`、`render`、`preamble`、`bulletOf`
  只為產生索引而存在，一併刪除。`load()` 的兩種讀法與排序不變。
- `scripts/todo.js`：拿掉 `index` 動詞，新增 `list`：每條 open 條目印一行 `<state> <id> — <title>`，
  末行印總數。它是 patrol 的分母，也取代產生的 `TODO.md` 作為終端可讀的清單。
- 本 repo 的 `TODO.md` 刪除。
- `scripts/todo-check.js`：拿掉 `stale index` 規則；folder mode 的檢查錨點從 `<root>/TODO.md` 改成 root；
  新規則：有 `todo` bucket 時根目錄還有 `TODO.md` 即失敗，提示它的內容該用 `todo.js migrate` 收進資料夾，
  擋住一份不會被讀的手寫檔。手寫模式的規則不變。
- `scripts/station.js` 的「記成 TODO」：folder mode（`addTodoFile`）錨點從 `TODO.md` 改成 bucket 資料夾；
  手寫模式（`addTodo`）照舊寫 `TODO.md`。
- `scripts/orient.js` 的 `todoBlock`：folder mode 下 `orderByEdit(dir,'TODO.md',…)` 改成用每條條目檔
  自己的最後提交時間排序，`todo: TODO.md` 等文案改成 bucket 路徑；手寫模式照舊。

## 2. 條目 body 必須夠厚

- `todo.js new` 新增 `--body <text>`；非 `done` 的條目沒有 `--body` 就拒絕建立。
- `todo-check` 新規則（folder mode）：非 `done` 的條目 body 少於 200 字元即失敗。`done` 條目不要求
  （57/70 是空的，補寫沒有讀者）。
- body 寫什麼由 `docs/90-agent/reference/todo.md` 規定三段：從哪來（事件、session 或 sha）、
  要做成什麼樣、怎樣算完成。目的是幾週後審查時不必翻 git 就想得起原意。
- 本 repo 現有 18 條 body 空白的 open 條目逐條補寫，內容取自該條目的 git 歷史、`link` 頁與引入它的 commit，
  不憑記憶；查不到來源的條目在 body 寫明「來源不明」並列入 build 的 handoff。

## 3. 手寫 TODO.md 的遷移改為詢問

- `skills/fankeel-init/SKILL.md` 第 3 節：已有 `TODO.md` 時不再直接遷移，先問使用者一題，兩個選項——
  遷進 docs（宣告 `role: todo` bucket、跑 `todo.js migrate`，每條變成可追蹤的條目檔）或保留手寫
  `TODO.md`（不宣告 bucket，維持手寫模式）。沒有 `TODO.md` 時照舊宣告 bucket 並建空資料夾。
- `lib/todo.js` 的 `migrate`：每條條目的 body 寫入原本那行 bullet 的全文與一行來源
  （`從 TODO.md 遷移，<日期>，<遷移前的 HEAD sha>`）；寫完條目後刪除根目錄的 `TODO.md`
  （原檔留在 git 歷史），不再重新產生索引。
- 遷移後 init 跑 todo-check；body 未滿 200 字元的 open 條目，由 init 依該行 bullet 的 git 歷史
  （`git log -L` 或 blame 找到引入它的 commit）補寫，與第 2 節同一個做法。
- 選了保留的專案，之後隨時可以自己跑 `todo.js migrate` 遷移；`scripts/upgrade.js` 對「有 bucket、
  資料夾空、`TODO.md` 有條目」印出 migrate 指令的既有步驟不變。

## 4. station 呈現 body

- `lib/station.js` 的 `todoOf`：folder mode 下 open 與 done 的每一列都帶 `body`。
- `assets/station/station.js` 的 `todoPanelHtml`：有 body 的列可點開，在列下方展開 body
  （escape 後保留換行，反引號轉 `<code>`，與 description 同一個 `md`）；沒有 body 的列不可點。
  展開的區塊帶 `data-block="todo-body"`，供 build 用 `tune.js` live mode 調整。手寫模式的列沒有 body，畫法不變。
- 前端判斷：這是前端工作，但 design stage agent 不能派 `fankeel-mockup`，所以沒有畫 mockup；
  外觀在 build 寫出真頁後以 live mode 逐塊調整。

## 5. 根目錄啟動腳本

- 本 repo 根目錄新增 `station.bat` 與 `station.sh`，各一行：以腳本所在目錄解析
  `scripts/station.js`，執行 `serve --detach --open`（`scripts/station.js:6` 已支援；已有 server 時
  `--open` 開它的 url，`scripts/station.js:303`）。只做本 repo；其他專案的外掛路徑不固定，不在範圍內。

## 6. 規則與文件

- `lib/stages.js:154,163,303,317,392` 與 `skills/fankeel`、`fankeel-build`、`fankeel-audit`、`fankeel-land`、
  `fankeel-plan`、`fankeel-survey` 的 SKILL.md：指 `TODO.md` 的句子改成兩種模式都成立的說法——
  folder mode 指 todo bucket 與 `orient` 的 `todo:` 區塊，手寫模式指 `TODO.md`；patrol 的
  `entries: <n> listed, <m> in TODO.md` 在 folder mode 下 `<m>` 取自 `todo.js list` 的總數，
  手寫模式照舊 `grep -c '^- ' TODO.md`。
- `assets/station/i18n.js`、`assets/station/station.js`、`assets/station/tour-ring.js` 中提到 `TODO.md` 的字串
  依模式顯示 bucket 或 `TODO.md`。
- `docs/90-agent/reference/todo.md` 改寫：去掉產生索引的段落、寫明兩種模式與 init 的詢問、加 `list`、
  `--body` 與 body 三段、todo-check 的兩條新規則、`migrate` 的新行為；`source_of_truth` 去掉 `TODO.md`。

## 測試

- `tests/todo-files.test.js`：folder mode `add` 後 `TODO.md` 不存在——現在失敗。
- `tests/todo-check-folder.test.js`：open 條目 body 199 字元被拒、200 通過；有 bucket 時根目錄有 `TODO.md` 被拒——現在失敗。
- `todo.js new` 不帶 `--body` 建 open 條目時非零退出——現在失敗。
- `tests/todo-migrate-errors.test.js` 或新測試：`migrate` 後每條條目 body 含原 bullet 全文與來源行，
  且根目錄 `TODO.md` 已刪——現在失敗。
- 手寫模式不變：沒有 bucket 的 fixture，`load()`、todo-check、`addTodo` 的既有測試照舊通過。
- `tests/station-todo-panel.test.js`：有 body 的列輸出含 body 文字的展開區塊——現在失敗。
- `tests/skills.test.js` 或新測試：`skills/fankeel-init/SKILL.md` 第 3 節含遷移與保留兩個選項——現在失敗。
- artefact：渲染後的 station 專案頁，帶 body 的列數等於 `load()` 中 body 非空的條目數。
- 其餘提到 `TODO.md` 的測試檔隨行為更新，全套綠燈。
