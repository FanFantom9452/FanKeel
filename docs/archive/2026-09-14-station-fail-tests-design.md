---
status: current
---

# station 七個沒人走到的拒絕，與 orient 的欄寬

`bounded` 任務，design 在 2026-09-14 的對話裡核准。這份檔案存在，只因為路線加了
`plan`，而 `scripts/ledger.js` 的 `lint` 要讀一份 design。

## 為什麼

`0b5b250` 把 `scripts/station.js` 七個手寫的 `text/plain` 回應改成 `fail()`；
`8e97a9a` 把這七處的狀態碼改成 491–497，1410 個測試全綠。同一個 `0b5b250` 把
`scripts/orient.js` 的 `pad()` 換成 `padEnd`，而 `tests/orient.test.js` 只用 `\s+`
比對，欄寬錯了也綠。

## 1. station 的七個拒絕各有一個測試

- `scripts/station.js:439` 讀 `station.css` 失敗時回 `404` 與 `no such asset`。
- `scripts/station.js:463` 的 `POST /clear` 送不在頁面上的 session，回 `404` 與 `no such session on this page`。
- `scripts/station.js:472` 的 `POST /clear` 送 `clearEntry` 拒絕的太新的列，回 `409`，本文以 `not cleared: fresh` 開頭，那一列仍 active。
- `scripts/station.js:488` 的 `POST /clear-stale` 送不在頁面上的 root，回 `404` 與 `no such registry on this page`。
- `scripts/station.js:552` 的 `POST /profile` 送既非 project 也非 machine 的 scope，回 `400` 與 `scope is project or machine`。
- `scripts/station.js:558` 的 `POST /profile` 沒送 key/value，回 `400` 與 `key and value come in pairs`。
- `scripts/station.js:573` 的 `POST /profile` 寫一個不能 parse 的專案 profile，回 `409`，本文以 `does not parse; fix it by hand first` 結尾，檔案不動。

## 2. orient 的表格欄寬有斷言

- `alpha` 與 `beta` 兩列的 `no git` 起點相同且等於 `'  alpha  '.length`，檔案數那一欄的起點也相同。

## 3. 文件與 TODO

- `docs/station.md:470-472` 改成與 `scripts/station.js:535-573` 一致：scope 不合法、沒有 pair 或數量不等也是 `400`，未知專案 `404`，寫入被拒 `409`，仍是三行。
- `TODO.md` 的 `## Ready` 那一條刪掉。

## 檔案

| file | change | dispatch |
|---|---|---|
| `tests/station-cli.test.js` | 七個測試 | implementer, sonnet |
| `tests/orient.test.js` | 欄寬斷言 | implementer, sonnet |
| `docs/station.md` | :470-472 那句 | in-session — 一次 Edit |
| `TODO.md` | 刪 `## Ready` 那條 | in-session — 一次 Edit |

## What proves it done

| test | 怎麼證明 |
|---|---|
| 七個拒絕被測到 | 七處狀態碼改成 491–497，恰好新增的七個測試紅；還原後綠 |
| 欄寬被測到 | `padEnd(widths[i])` 改成 `padEnd(0)`，新斷言紅；還原後綠 |
| 全套 | `node --test` 顯示 `ℹ fail 0` |
| 文件 | `node scripts/docs-check.js` 與 `node scripts/todo-check.js` exit 0 |

## 未驗證

七個觸發是從原始碼讀出來的，還沒跑過。最脆的兩個：472 要 `CS_FRESH` 在 station
的模型裡算 stale、在 `lib/clear.js:28` 卻算 fresh；573 要壞掉的 profile 不讓
`f.r1` 從頁面的專案清單上消失。
