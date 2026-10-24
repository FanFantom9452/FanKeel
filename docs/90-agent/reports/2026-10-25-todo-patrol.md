---
status: decision
last_verified: 2026-10-25
---

# TODO 全表盤點（10-25）：做了什麼、沒做什麼

一句話：新增 CSS 死碼掃描器 `scripts/css-dead.js` 並接進 audit；station 伺服器的指紋涵蓋 index.html 與每個模組，過期時把 port 交給新程序；新增 `scripts/uninstall.js`；設定精靈 Q7 寫明 Tailscale 是預設、Cloudflare 是之後的進階選項。

一份計畫：[2026-10-25-todo-patrol.md](../../99-archive/2026-10-25-todo-patrol.md)（5 個任務）。

## 盤點

使用者在盤點 gate 的決定：「CSS 死碼掃描器」與「station server 供舊 HTML」進計畫；「Tailscale 以外的遠端方案」照比較結論結案（Tailscale 預設、Cloudflare 進階、不收 ZeroTier 與 WireGuard），措辭寫進 Q7；「受控站實跑一次 /fankeel-ask」在 land 結案；「在別的專案跑一週，數崩壞」選定 Trovara，條目維持 Blocked。design 階段討論 Ponytail 的四個候選：第 1 個已於 5728c7a6 落地；第 2 個（解除安裝腳本）這輪做；第 3 個（符號地圖）深入評估後留在 Watch；第 4 個（成對 benchmark）未決。

## 做了什麼

- 任務 1：`scripts/css-dead.js` 從 CSS 取出 class，檢查 js、html、jsx、tsx、vue、svelte 有沒有引用；前綴出現在樣板字串或字串串接時標成「可能是動態」；接進 audit 技能（4f9133dc），讀不到目錄時以 exit 2 拒絕（6c14767b）。
- 任務 2：`diskFingerprint` 涵蓋 index.html 與每個模組（075ad0ba）。
- 任務 3：過期的 station 在頁面載入時把 port 交給新程序（4b2ded6b）。
- 任務 4：`scripts/uninstall.js` 刪除 fankeel 產生的檔案，留下 `profile.json` 與各專案的 `.fankeel/`；README 寫明先跑它再 `claude plugin uninstall`（bf34b68d）。
- 任務 5：設定精靈 Q7 的遠端卡片寫明 Tailscale 是預設（4075bb78）。
- 收尾：兩筆條目結案與引文修補（ac8be2c4）、gate-18 描述的反引號（6a88ccc4）、phone-stop 測試改成輪詢 holding.json（1a887a49）並關閉其 Watch 條目（cfc2bc55）。

## 沒做什麼

- 「設定頁待調整」與「station 留 vanilla、拆完模組」這輪沒動，維持 Ready。
- 審查判為不修：uninstall 在 station 健康檢查逾時時仍會刪除，不另外警告；過期交棒的測試沒有釘住 `--roots`、`--idle` 的轉傳，臨時備用 port 的分頁要手動重新整理。
- Ponytail 第 4 個候選（成對 benchmark）未決。

## 驗證

- 快速套件 5269 過 0 失敗；第一次 verify 因 gate-18 條目描述紅燈，回 build 修好；phone-stop 測試在負載下第二次偶發失敗，改成有上限的輪詢。
- 審查者因 sandbox 擋寫入，沒有跑變異測試。
- 沒在真實瀏覽器裡看過過期交棒的換頁。
