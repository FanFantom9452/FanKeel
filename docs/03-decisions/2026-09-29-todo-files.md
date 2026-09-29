---
status: decision
last_verified: 2026-09-29
---

# TODO 一筆一檔（09-29）：決策紀錄

一句話：TODO 的每個條目變成 `docs/90-agent/todo/<id>.md` 一個檔，`TODO.md` 改由 `scripts/todo.js index` 產生；完成的條目不刪，標 `state: done` 並記下收尾的 sha 與 session；station 的專案頁列出未完成與已完成的條目。

design 見 [../99-archive/2026-09-29-todo-files-design.md](../99-archive/2026-09-29-todo-files-design.md)，計畫見 [../99-archive/2026-09-29-todo-files.md](../99-archive/2026-09-29-todo-files.md)，條目的規則見 [../90-agent/reference/todo.md](../90-agent/reference/todo.md)。

## 定了什麼

- 一筆一檔，frontmatter 放 `label`、`title`（≤28 欄）、`description`（≤200 字元）、`state`，背景寫在本文。完成的條目留在同一個資料夾（survey 的 gate，使用者答）。
- 兩種模式並存：專案的 `.fankeel/docs.json` 宣告 `todo` 桶才走資料夾模式；沒宣告的專案照舊手寫 `TODO.md`、照舊的規則（design，使用者答）。`todo-check`、`orient`、`blame`、station 兩種都讀。
- `sha` 是持久的連結；`session` 選填，因為 `.fankeel/sessions/` 被 gitignore、只在跑它的那台機器上解得開。遷移前已完成的條目不回填 session（verify 的 gate，使用者答）。
- `todo-completions.md` 的 69 筆遷成 11 筆 `done` 條目後封存到 `docs/99-archive/2026-09-29-todo-completions.md`；plan 的 Risks 段記了這個與另外三處刻意的偏離。
- 讀不到的條目檔、條目資料夾、`TODO.md` 與 `git ls-tree` 失敗，都要回報，不能當成「沒有 TODO」：verify 兩輪各抓到一層被吞掉的錯誤。

## 量到什麼

- 全套 `npm test`：2421 過、0 失敗（`863c5a23`，含另一個 session 同時加的測試）；`docs-check` 全部解析，`todo-check` 31 條全過。
- verify 退回 build 兩次：第一次是 station 讀檔的靜默 catch、survey skill 兩處過時引用、24 個被截成「…」的標題、一個沒審過的修正提交；第二次是分支搬動的 42 個引用、`readFolder` 與 `trackedIn` 吞錯。第二次之後 build 的審查加上跑 `docs-check` 與全分支的 silent-failure 掃描。
- audit 的 adversary 找到 land、build、audit 三個 skill 與規則文字裡 8 處「刪條目／寫一行 `TODO.md`」的說法，`863c5a23` 改成資料夾模式用 `todo.js new`／`done`。

## 在哪裡回頭

- plan 第 3 組的變異測試被 guard 擋下後一直沒補跑；`unreadable folder` 分支與 `LC_ALL=C` 沒有會紅的測試；`--migrate` 的 `completions()`、`commitDay` 仍吞錯——都在 TODO 的 `todo-2`。
- `tests/plantasks-lint-cap.test.js` 把 `assets/station/station.js` 寫死成 5170 行——TODO 的 `tests-2`。
- station 面板在 verify 以元素截圖看過；讀檔錯誤那一列沒有渲染檢查。
