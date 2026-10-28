---
status: design-intent
last_verified: 2026-10-29
---

# 手機 /m：所有電腦的 session 放進一張列表 — design

使用者要在手機上看到每台電腦的 Desktop、CLI 對話，以及同一 Claude 帳號的 RC 對話。
核准的畫面：`.fankeel/build/2026-10-29-mobile-sources/mockup.html`（未 commit，
5 個畫面，區塊名見下）。這份設計推翻
[2026-10-27-one-phone-three-pcs.md](../judgements/2026-10-27-one-phone-three-pcs.md)
「不合併、無切換器、各機各自配對」的結論中「不合併」那一半：手機仍只配對一台，
由那台去拿其他台的資料。

## 1. 未登記 session 進手機

- `lib/mobile.js` 的 `mobileModel` 除了 registry 的 sessions，也帶 `model.unregistered`
  （`lib/station.js` 的 `unregisteredOf`：`entrypoint`、`bridge`、`name`、`status`、`cwd`）。
- 列表多一個「未登記」群組（`list-unregistered`）：Desktop/CLI 標籤、RC 小點、cwd、忙碌/閒置、電腦名。
- 點進去是唯讀的 session 畫面（`session-head-unregistered`、`session-chat-unregistered`）：
  分頁只有「對話 / 事件」，對話來自該 session 的 transcript；底部是「這裡只能看」加外連到 Claude app（`session-foot-unregistered`）。

## 2. 多台電腦合併

- 每筆 session（登記與未登記）帶 `machine`（電腦名）。
- 手機連到的那台 station 在伺服器端向 tailnet 上已配對的其他 station 取資料並合併；手機只跟一台說話，cookie 維持 host-only。
- 電腦之間用一把各自配對時交換的 token 認證，不沿用手機的 cookie。
- 標題下的電腦篩選 chips（`machine-filter`、`machine-filter-picked`）：全部 + 每台一顆，離線的帶斷線圖示。
- 一台連不上時，列表顯示「最後連上時間」與它最後看到的 session，標為最後看到的狀態（`list-offline-note`、`list-machine-offline`）。
- 測站 sheet 改為每台電腦一列：連上 / 離線 / 未配對（`machines-sheet`），原本的「重新配對」併進每列。

## 3. RC 對話分頁

- 底部 tab 增為 Session / 等你 / RC 對話 / 完成（`tabbar-rc`）。
- RC 分頁（`account-rc`）列出所有已連線電腦上 `bridge` 為真的 session，分「連著」與「已結束」，每列標電腦名。
- 區塊底部寫明「只含有開 station 的電腦」，並外連 claude.ai/code。Anthropic 沒有帳號層級 RC 清單的 API（anthropics/claude-code#35607 未實作），所以這是能做到的上限。

## 證明做完

- 測試：`mobileModel` 收到一筆未登記 session 與另一台電腦的資料，兩筆都出現在輸出且各帶 `machine`——現在失敗。
- 測試：另一台 station 的 token 錯誤時，取資料被拒，列表把那台標為離線而不是整頁失敗。
- 成品檢查：渲染後的 /m 上，篩選 chips 的每台 session 數加總等於「全部」下的列數。

## 未驗證

- 電腦之間 token 的配對流程：在哪一台按、怎麼交換，plan 要先定案。
- 未登記 session 的 transcript 路徑能否從 `cwd` 加 session id 穩定找到。
