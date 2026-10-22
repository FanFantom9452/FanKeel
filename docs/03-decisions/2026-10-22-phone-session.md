---
status: decision
last_verified: 2026-10-22
---

# 手機頁直接接上 Claude Code session（10-22）

一句話：手機頁 `/m` 接上一個 session 後，Stop hook 在每輪結束時先等手機的訊息，收到就把它當成下一個指示送回去；回覆就是那一輪的最後一段話，所以手機可以取代 Claude mobile 跟同一個 session 對話。

設計在 [99-archive/2026-10-22-mobile-session-design.md](../99-archive/2026-10-22-mobile-session-design.md)，計畫在 [99-archive/2026-10-22-mobile-session.md](../99-archive/2026-10-22-mobile-session.md)。

## 決定

- `lib/phone.js` 管每個 session 的手機頻道檔：接上、等著的那一則訊息、正在等的時間、背景工作和對話紀錄。
- `hooks/stop.js` 每輪結束都記下回覆與背景工作；手機接著時，沒被 stage 擋下的那次結束會等手機訊息最久 `phone.hold` 秒（預設 1800），收到就以 `（手機）<訊息>` 擋下，讓它成為下一輪的指示。
- 在電腦上打字就把 session 拿回來；`/fankeel-phone` 把一個停下的 session 交給手機。
- 手機頁照方向 A「訊息 app」重畫：首頁一張清單，分成等你答、在跑（含手機接著、跑中、背景跑中）和停下來；每個 session 一頁對話，gate 卡片直接在對話裡回答，輸入框和自己寫答案欄都有麥克風鈕。
- 對話中的工具呼叫記成步驟，一輪收成一行，跑著時展開最後三步。
- 傳輸維持只走 Tailscale；Windows 上 `tailscale` 不在 PATH 時改找 Program Files。

## 為什麼

使用者要用手機取代 Claude mobile，直接跟正在跑的 session 說話，並且一眼分清楚哪些 session 在等回答、哪些還在背景跑、哪些真的停了。實測 Stop hook 的 `decision: block` 會把 reason 當成下一輪執行，是唯一不必改啟動方式就能接上同一個 session 的路。

## 放棄了什麼

- Channels：要另外帶啟動旗標，而且還是研究預覽。
- `claude --resume`：會分出另一個 session，不是同一個對話。
- 區網 0.0.0.0 或公開 tunnel：手機頁能讓 session 執行指令，只走 Tailscale 的判斷記在 [judgements/2026-10-22-phone-reach.md](../90-agent/judgements/2026-10-22-phone-reach.md)。
- 通知：使用者說這次先不管。
- 已停 session 的待答在首頁顯示、`chat.jsonl` 同時寫入掉行、重複的回覆氣泡：記成待辦，沒在這次修。
