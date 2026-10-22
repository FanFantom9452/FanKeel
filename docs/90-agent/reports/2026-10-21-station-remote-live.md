---
status: current
last_verified: 2026-10-22
source_of_truth: scripts/station.js, lib/remote.js, lib/tailscale.js, lib/notify.js, assets/station/mobile.js, assets/station/sw.js, assets/station/remote-card.js
---

# 監控站手機遠端，實機檢查 — 2026-10-22

一句話：S24 經自己的 Tailscale 能配對、能從手機答 gate，但 Windows 上第一次開遠端因 PATH 失敗、桌面卡片不會自己刷新、通知沒響，通知與後三格由使用者決定延後或不測。

計畫在 [2026-10-21-station-remote.md](../../99-archive/2026-10-21-station-remote.md)，設計在 [2026-10-21-station-remote-design.md](../../99-archive/2026-10-21-station-remote-design.md)。檔名沿用計畫給的 10-21，實測在 2026-10-22。

## 環境

- 電腦：Windows 11 Pro，Tailscale 1.104.2，MagicDNS 名稱 `<machine>.<tailnet>.ts.net`（已開 MagicDNS 與 HTTPS 憑證）
- 手機：Galaxy S24，**三星瀏覽器**（計畫寫的是 Chrome），Tailscale app 與 ntfy app 版本沒記
- fankeel：0.111.66（工作樹 973186eb）；hooks 從安裝的 cache 跑，監控站從工作樹 `node scripts/station.js serve --detach` 起
- 沒有開 scratch session：gate 由本任務自己的 AskUserQuestion 停到監控站，`gate.station` 暫設 300，測完還原

## 結果

| # | 檢查 | 期望 | 結果 |
|---|---|---|---|
| 1 | 打開手機遠端開關 | 卡片出現 tailnet 網址、QR、配對碼；`tailscale serve status` 只有一個 proxy，沒有 funnel | 通過，帶缺陷：第一次啟動卡片寫 `spawnSync tailscale ENOENT`。重啟後網址、QR、8 碼都出現，serve 只有一條 `/` 指到 127.0.0.1:28888、標 `(tailnet only)`，funnel 無 |
| 2 | 手機相機掃 QR | 打開 `/m` 並配對成功，卡片列出這支手機 | 通過，帶缺陷：手機配對成功，`/station/remote` 回 devices=1，桌面卡片卻仍寫「還沒有配對的手機」，重新整理才出現 |
| 3 | 頁內掃描 | S24 的瀏覽器有沒有 BarcodeDetector；沒有時只出現輸入配對碼 | 有：清掉 cookie 後 `/m` 有自己的相機掃描 |
| 4 | 安裝 PWA | 只有 SVG icon 的 manifest，給的是安裝還是加到主畫面 | 捷徑：三星瀏覽器只給「新增至主螢幕」，網址列沒有安裝圖示 |
| 5 | gate 通知 | priority 4 會響，「打開 gate」開到那個 gate 的 sheet | 不通過：兩則都以 priority 4 送到 ntfy.sh（輪詢 topic 看到），手機沒響；topic 是手抄的 |
| 6 | 從手機答 gate | 問題帶著手機的答案送出，gate 離開待答 | 通過：兩個 gate 從手機答，答案都帶回工作階段 |
| 7 | stage 完成通知 | 靜音，點開到任務那一列 | 延後：使用者決定先不管通知 |
| 8 | 任務結束通知 | 靜音，帶專案、stage 數與含 agent 的花費 | 延後：同上 |
| 9 | 手機 Tailscale 關掉 | 已安裝的 app 開出 pair-error，不是瀏覽器的錯誤頁 | 沒測；而且只有捷徑，沒有安裝的 app |
| 10 | 解除 | 手機下一次讀取回到配對畫面 | 沒測 |
| 11 | 開關關掉 | 手機重新整理得到 421；電腦上 `127.0.0.1` 照常；別的 serve 對應還在 | 沒測；也沒先建第二條 serve 對應，「其餘還在」無從證明 |

## 沒過的

- **第 1 格，PATH。** `lib/tailscale.js:15` spawn 不帶路徑的 `tailscale`。這台的機器 PATH 有 `C:\Program Files\Tailscale\`，但 Claude Code 程序比安裝早起，繼承到的 PATH 沒有它，子程序找不到。補上 PATH 重啟監控站才成功。另一個坑：`station.remote` 只讀機器層 profile，寫進專案的 `.fankeel/profile.json` 沒有作用，而且用 CLI 寫之後監控站要重啟才會去問 Tailscale。
- **第 2 格，卡片不刷新。** `assets/station/remote-card.js:7` 寫明狀態只在首次繪製與桌面操作後讀一次；手機配對不是桌面操作，所以卡片停在舊狀態。
- **第 5 格，通知沒響。** 送出端沒問題；壞在手機的訂閱。判官結論在 [2026-10-22-notify-channel.md](../judgements/2026-10-22-notify-channel.md)：維持 ntfy.sh，修訂閱入口。已開 TODO「手機頁訂閱通知按鈕」。
- **第 7 到 11 格。** 使用者決定通知延後、離線與關閉不測，方向改成把手機頁做成能直接接上工作階段，見下。

## 實測途中的決定

- 語音：`/m` 每題的「自己寫答案」欄已能送任意文字，手機鍵盤的語音鍵就能用。判官結論在 [2026-10-22-phone-voice-input.md](../judgements/2026-10-22-phone-voice-input.md)；頁內麥克風按鈕開成 TODO「手機頁麥克風按鈕」，註明語音會送 Google 辨識。
- 指南補了「ntfy.sh 的 topic 就是密碼」一段（[station.md](../../01-guide/station.md)），另寫了 [Tailscale 設定](../../01-guide/tailscale-setup.md)給要自己架的人。
- 使用者要的方向：手機頁不只回 gate，要能在沒有 gate 時直接接上工作階段，取代 Claude 手機 app。現在沒有這條通道（監控站只收 gate 答案），要另開任務設計。
