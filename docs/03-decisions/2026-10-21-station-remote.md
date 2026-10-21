---
status: decision
last_verified: 2026-10-21
---

# 監控站可以用手機透過自己的 Tailscale 看與回答，並用 ntfy 通知（10-21）

一句話：打開 `station.remote` 後，手機透過自己的 tailnet 開 `/m`，配對一次就能看每個任務走到哪一站、回答正在等的 gate；gate、換站與 session 結束可以用 ntfy 推播到手機。

設計與計畫在 [99-archive/2026-10-21-station-remote-design.md](../99-archive/2026-10-21-station-remote-design.md)。

## 決定

- 監控站照舊只聽 `127.0.0.1`，由 `tailscale serve --bg` 把那個 port 包成 tailnet 內的 https 位址；沒有 tailscale 或設定失敗只會警告，本機照常可用。
- `station.remote` 預設關閉；關閉時只回答本機 Host 的請求，其他一律拒絕。
- 手機用一次性的 8 碼配對碼（10 分鐘內有效）換一個裝置 cookie；從 tailnet 來的請求除了手機頁和配對以外都要這個 cookie，每台裝置都可以個別解除。
- `/m` 是手機頁：待答、任務、完成三個分頁，可以裝成 PWA，離線時顯示離線畫面。
- 通知走 ntfy，預設 `ntfy.sh` 加隨機 topic；gate、換站、session 結束三種觸發各自開關，預設都關，送出的只有站名、第一個問題、截短的任務、專案與花費。

## 為什麼

使用者要在離開電腦時也知道任務卡在哪個 gate，並且能直接回答。沿用 VoiceLedger 已經在用的 Tailscale 做法，不必開任何對外的 port，也不必自己管 https 憑證。通知選 ntfy，是因為手機不必裝 fankeel 自己的 app 就能收到；內容會送到第三方，使用者在 survey 時已經接受。

## 放棄了什麼

- `tailscale funnel` 或其他公開網址：會讓整個網路都連得到監控站，所以完全不用；機器開了 Funnel 時遠端維持關閉。
- 沿用每次啟動換一次的 nonce 當遠端憑證：nonce 寫在頁面資料裡，任何能讀頁面的人都拿得到，所以 tailnet 這邊改用配對過的裝置 cookie。
- 自架推播或 Web Push：要多一個服務或憑證管理，ntfy 一個 POST 就夠。
- 手機實機檢查（掃 QR、從手機回答 gate、收三種通知、安裝 PWA）沒有在這次做，已改記成 TODO。
