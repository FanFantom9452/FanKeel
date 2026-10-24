---
label: station
title: Tailscale 以外的遠端方案
description: 設定精靈 Q7 的遠端連線方式待定，要評估 Tailscale 以外的 VPN 選項
state: decision
---

來由：使用者在設定精靈 Q7「常離開」的機器層確認卡（notify + station.remote 走 tailnet）上標記：遠端連線方式先待定，需要 Tailscale 以外的選項。
要查：支援「像區域網路一樣互連」的 VPN（Radmin VPN、ZeroTier、WireGuard 等），各自有沒有手機版客戶端；Radmin 據稱只有 Windows，未查證。
影響：station server 可能要能綁 0.0.0.0 而非只綁 localhost，讓 VPN 裡的其他裝置連得到；這會牽動安全面（誰能連、要不要驗證），要一起評估。先看 lib/tailscale.js、scripts/station.js 目前的綁定方式。
相關：設定精靈 mockup .fankeel/build/2026-10-21-station-redesign/route-settings-v9.html 的 Q7 卡標「待定」。
完成條件：選定一種（或確定只留 Tailscale），寫進設計，Q7 卡的待定拿掉。

使用者回答（2026-10-24，TODO 全表盤點 10-24 的 survey gate）：「也是可以 CLOUDFLARE 但是這個應該更進階」——Tailscale 維持預設，Cloudflare Tunnel + Access 可列為進階選項；NetBird 沒有被選。設定精靈 Q7 的寫法還沒改。

繼續評估 VPN（2026-10-24，TODO 全表盤點的 build 站）：下一步比較 ZeroTier 與 WireGuard 的手機客戶端，以及 station 綁定 0.0.0.0 的安全面；這一輪不實作。

## VPN 比較（2026-10-24，TODO 全表盤點第四輪）

結論：Tailscale 維持預設、Cloudflare Tunnel + Access 維持進階，ZeroTier 與 WireGuard 都不放進 Q7。兩者手機都有官方客戶端，但都只給一條 IP 通道，沒有 `tailscale serve` 那種替 station 掛 HTTPS、把請求轉進 127.0.0.1 的代理；要用它們，station 就得改綁 VPN 介面或 0.0.0.0、以純 HTTP 對外，而現在的安全做法在那種綁法下不成立（見下）。

| | ZeroTier | WireGuard |
|---|---|---|
| 手機客戶端 | ZeroTier One，iOS 與 Android 官方 app | WireGuard，iOS 與 Android 官方 app |
| 怎麼連上 | 加入一個 network ID，由控制器（ZeroTier Central 或自架）核准；會打洞穿 NAT，不必開埠 | 每台一把金鑰、手寫 peer 設定；沒有內建中繼，至少一端要有對外可達的 UDP 埠，否則要自架中繼 |
| 費用 | 免費 Personal 方案 10 台裝置、1 個 network，限個人非商用（2026-08-04 起）；付費 Essential 每月 18 美元起 | 免費、開源，沒有託管服務 |
| 給 station 的 HTTPS | 沒有 | 沒有 |

來源：
- ZeroTier 手機 app：https://www.zerotier.com/download/（連到 App Store id1084101492 與 Google Play com.zerotier.one）
- ZeroTier 方案：https://www.zerotier.com/pricing.md
- WireGuard 手機 app：https://www.wireguard.com/install/（App Store id1441195209、Google Play com.wireguard.android）
- WireGuard 穿 NAT：無官方文件；https://nettica.com/nat-traversal-hole-punch/ 與 https://forum.mikrotik.com/t/wireguard-best-approach-two-non-public-sites/271189 都說要一端有穩定可達的 IP:port，或靠中繼

現在的安全面（程式裡讀到的）：station 只綁 `127.0.0.1`（`scripts/station.js:1128`、`:1132`、`:1156`），所以只有本機的程式連得到；Host 不是 loopback 的請求回 421（`:476-477`）；遠端唯一的入口是 `tailscale serve`，它在 443 終結 TLS、帶著代理標頭轉進 loopback，`remote.hostKind` 依此判成 `tailnet`（`lib/remote.js:38-49`），之後未配對的裝置只拿得到手機頁與配對（`policy`，`:56`），POST 還要同源（`:51-54`）；配對換來的 device cookie 是 `HttpOnly; Secure; SameSite=Strict`（`:154-156`）。

改綁 0.0.0.0 會壞掉的三件事：
- Host 檢查不再是邊界。同一個網段的任何人送 `Host: 127.0.0.1:<port>`、不帶代理標頭，`hostKind` 就判成 `loopback`，整個 station（含 transcript 片段）都讀得到；nonce 就寫在 serve 回的資料腳本裡（`scripts/station.js:570`），所以 POST 也擋不住。今天安全，是因為綁的是 127.0.0.1，不是因為 Host 檢查。
- 純 HTTP 下瀏覽器不收 `Secure` cookie，配對完的手機帶不回 device cookie；`/sw.js` 的 service worker 與 PWA 安裝要 secure context，`http://10.x.x.x` 不算。
- 0.0.0.0 聽的是每一張網卡，不只 VPN：咖啡店 Wi-Fi 上的人也連得到。

若哪天真要支援 ZeroTier 或 WireGuard，最小的形狀是：只綁 VPN 介面的位址（不是 0.0.0.0）、把那個位址當成第三種 `hostKind`、所有路由都要 device cookie（不只 POST）、並且自帶 TLS——零依賴下只能是自簽憑證，手機會跳警告。這是一份設計，不在這一輪。

Q7 卡的寫法因此是：Tailscale（預設）、Cloudflare Tunnel + Access（進階）；ZeroTier／WireGuard 不列，一句話說它們沒有 HTTPS 代理。條目要不要因此結案（完成條件「選定一種」），由使用者在 land 決定。
