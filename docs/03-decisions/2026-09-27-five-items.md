---
status: decision
last_verified: 2026-09-27
---

# 五件（09-27）：決策紀錄

一句話：這一輪走完 survey 到 land 六站。`#/live` 改成四塊：等你的 gate、正在跑、可能停了、閒置的 registry。wizard-motion 的瞬斷沒有重現，所以沒改程式。另外新增四頁給人讀的 01-guide，把 ab.sh 的 evidence 路徑修正到 `docs/90-agent/reports/evidence/`，並讓 mockup agent 回傳網址前先自己開 serve 驗收。

design 見 [../99-archive/2026-09-27-five-items-design.md](../99-archive/2026-09-27-five-items-design.md)，計畫見 [../99-archive/2026-09-27-five-items.md](../99-archive/2026-09-27-five-items.md)。

## 定了什麼

- `#/live` 的四塊在原始碼裡都寫出字面的 `data-block`（`live-gate`、`live-run`、`live-maybe`、`live-idle`）。閒置的 registry 收成一排 chip，不再一個 registry 一張「沒有進行中的 session」卡片。
- 抓不到的 flake 不改程式，也不放寬斷言。整套測試 10 次全綠就改記到 TODO 的 `## Watch`，`if:` 寫「再紅一次」。`station-cli` 的逾時比照這個先例處理。
- mockup 的驗收以使用者實際會打開的 serve 網址為準，不用 `file://`。起因是 design 站給出的網址因為 `../../../assets/...` 超出 serve 根目錄而 404，整頁沒有樣式。
- ab.sh 只修路徑、不重跑。重跑約需 $30，仍留在 `## Needs a decision`。

## 量到什麼

- land 時整套測試跑 2087 個，2086 個通過。唯一的紅是 `tests/source.test.js:206`：`#/tour` session 的 `2026-09-27-tour-design.md` 帶了一個沒有程式讀的 `mockup:` frontmatter 鍵，那個檔不在這個 plan 裡，使用者決定交給那個 session 修。
- verify 核對了 20 條 promise，20 條都有證據；render reviewer 對 `#/live` 的結論是 ship。

## 在哪裡回頭

- build 最後做 whole-branch review 時，reviewer 把 `station.md` 兩個原本正確的行號引用（`:1387`、`:1381`）改成指向 `function navHtml` 的宣告行和一行註解。Task 1 的 verifier 用「那一行存在」這種寬鬆比對放行了同樣兩行。verify 的 adversary 用行號對應的內容去比對才抓到，這兩行回到 build 修正（`6ceaf4ca`）。docs-check 抓不到這種錯，因為這兩個引用沒有附引文。
- verify 第一次的 gate 標題太長，第二次的第一個選項沒寫站名，兩次都被 `hooks/gate.js` 擋下，交回 stage agent 重寫。
