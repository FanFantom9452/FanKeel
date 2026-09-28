---
status: decision
last_verified: 2026-09-28
---

# guard 的 `seen` 與 ab.sh 重跑（09-28）：決策紀錄

一句話：鄰居 session 的 `seen` 不再讓 guard 攔下編輯，只留在撞檔警告裡；ab.sh 的 profile-pin 重跑兩個 arm 都跑完，總共 $29.71，verify 站第一次量到 `k`。

design 見 [../99-archive/2026-09-28-guard-seen-ab-rerun-design.md](../99-archive/2026-09-28-guard-seen-ab-rerun-design.md)，計畫見 [../99-archive/2026-09-28-guard-seen-ab-rerun.md](../99-archive/2026-09-28-guard-seen-ab-rerun.md)，報告見 [../90-agent/reports/2026-09-28-ab-profile-pin.md](../90-agent/reports/2026-09-28-ab-profile-pin.md)。

## 定了什麼

- `lib/guard.js` 的 `blockers()` 對鄰居只看 `claimsOf(data)`。`seen` 是 git 看到的，不知道是誰寫的：鄰居的 git pass 會比我們的下一個 prompt 更早收進我們剛寫的 untracked 檔，09-27 就這樣在 `deny` 下擋了我們自己的 plan。`effectiveClaims` 與 `sharedWith` 不變，`seen` 照舊進警告。
- 代價是：鄰居用 shell 或 script 改的檔（只在它的 `seen`）不再在 `ask`／`deny` 下跳提示，只剩警告。git 說不出寫的人是誰，拿它來拒絕編輯就會誤擋。
- ab.sh 照原本的 `CAP=62.50` 跑，沒有壓低上限；使用者在 survey 時核准了花費。

## 量到什麼

- 全套 `npm test`：2235 過、0 失敗（land 時在 `d176156a` 上重跑）。
- ab.sh：opus arm $11.69、sonnet arm $18.02。design、plan、build 三站的 `k` 分別是 2.49、2.38、2.52，都在 09-25 的 2.29–2.74 之內；verify 的 `k = 1.6937`，低於破平衡點 2.5052；全部合計 2.0230。每個 arm 只跑一次（n=1）。

**更正 2026-09-28：** 上一行的「opus arm $11.69、sonnet arm $18.02」與「全部合計 2.0230」都是把各站累計的 `total_cost_usd` 逐站相加算出來的計算錯誤；真正的總花費是 verify 站自己的累計值，opus $6.19、sonnet $8.60，k = 1.64，一樣低於破平衡點 2.5052，見 [報告](../90-agent/reports/2026-09-28-ab-profile-pin.md) 開頭的更正區塊。

## 在哪裡回頭

- ab.sh 最後呼叫 09-25 的 `summarise.js` 時 `MODULE_NOT_FOUND`：那支檔的 `require('../../../../lib/prices.js')` 是在搬到 `docs/90-agent/` 之前寫的，少了一層。證據目錄不改；複製到 `.fankeel/build/` 修掉路徑之後重產 `summary.json`，commit 訊息裡有寫。
- build 的第一個 stage agent 在 ab.sh 跑完之前就停了；ab.sh 結束後它自己又恢復，送出一份會把 0 byte 的 `summary.json` 一起 commit 的請求。controller 攔下這份請求，等 `summary.json` 重產後才 commit。
- `git worktree remove` 在 Windows 上遇到 Permission denied，`.fankeel/build/2026-09-26-ab-profile-pin/wt-opus` 與 `wt-sonnet` 兩個資料夾留在磁碟上；git 的登記已清，資料夾本身是 gitignored 的 build 目錄。
