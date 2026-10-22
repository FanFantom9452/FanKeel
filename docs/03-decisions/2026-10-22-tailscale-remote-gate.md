---
status: decision
last_verified: 2026-10-22
---

# Tailscale 遠端開啟前先擋一次，開著時印出手機網址（10-22）

一句話：Tailscale 遠端是進階功能，所以在 station 頁撥開關時先跳 modal、在 CLI 設 `station.remote true` 時要帶 `--confirm`；開著時 `station:` 行印出這台的 MagicDNS 手機網址，沒開成時印出原因。

計畫在 [99-archive/2026-10-22-tailscale-remote-gate.md](../99-archive/2026-10-22-tailscale-remote-gate.md)。

## 決定

- `scripts/station.js` 寫 `serve.json` 時，遠端開成功帶 `remote.url`，開了沒成功帶 `remote.warning`；冷啟動先問完 Tailscale 才寫第一筆紀錄。
- `lib/serve.js` 的 `ensureServe` 把 `remote` 傳下去，`lib/render.js` 的 `stationLine` 在原本的結尾後接 `phone: https://<dns>/m` 或 `remote off: <原因>`。
- station 頁的手機遠端卡，開關撥到開時先開 modal，預設焦點在「取消」，按「我了解，開啟」才寫 profile。
- `task.js profile set station.remote true` 沒帶 `--confirm` 就拒寫並要求先問使用者；設成 `false` 不用確認。

## 為什麼

使用者說 Tailscale 屬於進階功能，不推薦不熟的人用，要在設定時多一道關卡；而開了之後，要讓 agent 直接說出手機該開哪個網址，不必去 Tailscale 的管理頁找名字。

## 放棄了什麼

- 在 modal 裡附安裝 Tailscale 的完整指引：注入區塊與卡片都會變長，modal 只列出開之前要做到的兩件事。
- 冷啟動時先寫一筆不帶 `remote` 的紀錄再補寫：Tailscale 慢於 3 秒時會有一段沒有 `serve.json` 的空窗，使用者接受先列為已知限制。
