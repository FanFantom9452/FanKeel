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
