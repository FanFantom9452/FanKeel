---
status: decision
last_verified: 2026-10-29
---

# 手機只配對一台，由那台去拿其他電腦的 session（10-29）

一句話：手機連著的那台 station 用自己的 device token 向 tailnet 上其他已配對的 station 取資料，合併成 `/m` 的一張列表，連同沒登記在 fankeel 的 Desktop/CLI session 與 RC 對話；手機仍然只配對一台、只跟一台說話。

設計在 [../90-agent/plans/2026-10-29-mobile-sources-design.md](../90-agent/plans/2026-10-29-mobile-sources-design.md)，計畫在 [../90-agent/plans/2026-10-29-mobile-sources.md](../90-agent/plans/2026-10-29-mobile-sources.md)。

## 推翻了什麼

[2026-10-27 的判斷](../90-agent/judgements/2026-10-27-one-phone-three-pcs.md)說三台各自配對、手機上三個網址、`/m` 沒有切換器，並把「一頁看三台」列為不在範圍的新功能。這份決定推翻其中「不合併」那一半：`/m` 現在合併所有已配對電腦的 session，標題下有依電腦篩選的 chips。另一半照舊成立：cookie `fk_device` 仍是 host-only（`lib/remote.js` `cookieFor`），手機若要直接開別台的 `/m`，仍要在那台另外配對；`phone.hold` 的交還仍只走那台自己 registry 底下的檔案。

## 決定

- 電腦之間沿用手機的 8 碼配對：在 B 的「手機遠端」卡上拿碼，在手機上 A 的測站 sheet 裡 B 那一列輸入；A 的伺服器以 B 的 Origin 代 POST 到 B 的 `/station/remote/pair`，B 照常發 device token，A 存在 `<configDir>/fankeel/peers.json`。B 端不改一行，B 的卡上會多一台叫「電腦 A」的裝置，可以照常解除。
- A 每 5 秒最多讀一次每台已配對電腦的 `/station/mobile.json?own=1`；`own=1` 只回那台自己的列，所以兩台互讀不會巢狀。
- 一台被拒（401）或連不上，就標為離線，保留最後一次讀到的列與時間，不讓整頁失敗；那台的 gate 不列入等你，因為答不到。
- 手機點進別台的 session，由 A 轉送到 B（`/station/peer/<名稱>/…`），只轉手機自己的那幾條 session 路由。
- 未登記 session 的對話用 session id 在設定目錄的 transcript 索引找（`lib/detail.js` `transcriptOf`），手機上只能看。
- RC 對話分頁是各台本機看過的、`bridge` 為真的 session，含 48 小時內已結束的；Anthropic 沒有帳號層級的 RC 清單 API，這是能做到的上限。

## 為什麼

使用者要在手機上一次看到每台電腦在做什麼，而不是存三個捷徑輪流開。沿用現有配對，安全邊界不變：每把 token 都是對方發的、可以在對方的卡上解除，手機的 cookie 不離開手機。

## 放棄了什麼

- 讓手機把自己的 cookie 交給 A 去讀 B：cookie 是 host-only，而且 A 拿到手機的 cookie 就能冒充那支手機。
- 新的電腦對電腦配對協定（自動交換金鑰）：B 端要多一條路由與一套信任規則，現有的 8 碼流程已經夠用。
- 帳號層級的 RC 清單：沒有 API（anthropics/claude-code#35607 未實作），只能合併各台本機看到的。
