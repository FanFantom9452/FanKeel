---
status: design-intent
last_verified: 2026-10-02
---

# TODO 只留資料夾：去掉產生的 TODO.md、條目 body 加厚、station 呈現 body、根目錄啟動腳本

session 9a6a429a-a483-48db-afda-4868efaf4b54 的 design。survey 的 gate 使用者選「去 TODO.md、條目加 body、
station 展開，加 station 啟動腳本 .bat/.sh」。這頁描述要做成的樣子，不是現在的樣子。

現況（survey 已查，見 `.fankeel/build/task-20261002T051320/survey.md`）：`TODO.md` 由 `lib/todo.js`
的 `writeIndex` 從 `docs/90-agent/todo/*.md` 產生，沒有任何條目檔沒有的資訊；`todo.js new` 沒有 `--body`，
open 的 20 條裡 18 條 body 是空的；`lib/station.js:352` 的 `todoOf` 不把 `body` 傳給頁面，
`assets/station/station.js:2377` 的 `todoPanelHtml` 只畫 title 與 description。

範圍：只動有 `todo` bucket 的專案（folder mode）。沒有 bucket 的專案仍用手寫 `TODO.md`
（`load()` 的舊模式與 `scripts/upgrade.js` 不動），signpost 特判（`lib/docs.js`、`lib/map.js`、
`lib/plantasks.js`、`scripts/docs-audit.js`、`scripts/docs-check.js`、`scripts/orient.js` 的 SIGNPOSTS）
對一個不存在的檔無害，不動。

## 1. 不再產生 TODO.md

- `lib/todo.js`：folder mode 的 `add`、`close` 不再寫 `TODO.md`；`writeIndex`、`render`、`preamble`、
  `bulletOf` 只為產生索引而存在，一併刪除。`load()` 的 folder 讀法與排序不變。
- `scripts/todo.js`：拿掉 `index` 動詞，新增 `list`：每條 open 條目印一行 `<state> <id> — <title>`，
  末行印總數。它是 patrol 的分母，也取代 `TODO.md` 作為終端可讀的清單。
- 本 repo 的 `TODO.md` 刪除。
- `scripts/todo-check.js`：拿掉 `stale index` 規則；folder mode 的檢查錨點從 `<root>/TODO.md` 改成 root；
  新規則：有 `todo` bucket 時根目錄還有 `TODO.md` 即失敗（提示刪掉它），擋住手改一份不會被讀的檔。
- `scripts/station.js` 的「記成 TODO」（`addTodoFile`）錨點從 `TODO.md` 改成 bucket 資料夾，
  前後 `todoCheck.check` 的比對照舊。
- `scripts/orient.js` 的 `todoBlock`：`orderByEdit(dir,'TODO.md',…)` 改成用每條條目檔自己的最後提交時間排序；
  `todo: TODO.md` 等文案改成 bucket 路徑。

## 2. 條目 body 必須夠厚

- `todo.js new` 新增 `--body <text>`；非 `done` 的條目沒有 `--body` 就拒絕建立。
- `todo-check` 新規則：非 `done` 的條目 body 少於 200 字元即失敗。`done` 條目不要求（57/70 是空的，
  補寫沒有讀者）。
- body 寫什麼由 `docs/90-agent/reference/todo.md` 規定三段：從哪來（事件、session 或 sha）、
  要做成什麼樣、怎樣算完成。目的是幾週後審查時不必翻 git 就想得起原意。
- 現有 18 條 body 空白的 open 條目逐條補寫，內容取自該條目的 git 歷史、`link` 頁與引入它的 commit，
  不憑記憶；查不到來源的條目在 body 寫明「來源不明」並列入 build 的 handoff。

## 3. station 呈現 body

- `lib/station.js` 的 `todoOf`：open 與 done 的每一列都帶 `body`。
- `assets/station/station.js` 的 `todoPanelHtml`：有 body 的列可點開，在列下方展開 body
  （escape 後保留換行，反引號轉 `<code>`，與 description 同一個 `md`）；沒有 body 的列不可點。
  展開的區塊帶 `data-block="todo-body"`，供 build 用 `tune.js` live mode 調整。
- 前端判斷：這是前端工作，但 design stage agent 不能派 `fankeel-mockup`，所以沒有畫 mockup；
  外觀在 build 寫出真頁後以 live mode 逐塊調整。

## 4. 根目錄啟動腳本

- 本 repo 根目錄新增 `station.bat` 與 `station.sh`，各一行：以腳本所在目錄解析
  `scripts/station.js`，執行 `serve --detach --open`（`scripts/station.js:6` 已支援；已有 server 時
  `--open` 開它的 url，`scripts/station.js:303`）。只做本 repo；其他專案的外掛路徑不固定，不在範圍內。

## 5. 規則與文件改名

- `lib/stages.js:154,163,303,317,392` 與 `skills/fankeel`、`fankeel-build`、`fankeel-audit`、`fankeel-land`、
  `fankeel-plan`、`fankeel-survey`、`fankeel-init` 的 SKILL.md：folder mode 下指 `TODO.md` 的句子改指
  todo bucket 與 `orient` 的 `todo:` 區塊；patrol 的 `entries: <n> listed, <m> in TODO.md` 改成
  `<m>` 取自 `todo.js list` 的總數。
- `assets/station/i18n.js`、`assets/station/station.js`、`assets/station/tour-ring.js` 中提到 `TODO.md` 的字串改成 bucket。
- `docs/90-agent/reference/todo.md` 改寫：去掉產生索引的段落、加 `list`、`--body` 與 body 三段、
  todo-check 的兩條新規則；`source_of_truth` 去掉 `TODO.md`。

## 測試

- `tests/todo-files.test.js`：folder mode `add` 後 `TODO.md` 不存在——現在失敗。
- `tests/todo-check-folder.test.js`：open 條目 body 199 字元被拒、200 通過；有 bucket 時根目錄有 `TODO.md` 被拒——現在失敗。
- `todo.js new` 不帶 `--body` 建 open 條目時非零退出——現在失敗。
- `tests/station-todo-panel.test.js`：有 body 的列輸出含 body 文字的展開區塊——現在失敗。
- artefact：渲染後的 station 專案頁，帶 body 的列數等於 `load()` 中 body 非空的條目數。
- 其餘 20 個提到 `TODO.md` 的測試檔隨行為更新，全套綠燈。
