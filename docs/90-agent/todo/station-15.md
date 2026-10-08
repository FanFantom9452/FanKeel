---
label: station
title: 監控站掛 Chartroom？
description: 監控站在 /chartroom/<專案>/ 開該專案的架構白板：spike 已證明 CJS 用 require(esm) 掛得上，動手前要先定白板位置、nonce、build 好的頁面放哪
state: done
done:
  at: 2026-10-08
  sha: 36f226c7
  disposition: done
  session: ddb6de22-2417-4ca8-841e-e83e171bd823
---

來源：2026-10-06 Latex/production 的 Chartroom spike（session 6247abb4）。Chartroom/.fankeel/build/spike/mount.cjs 照 station.js 的寫法，用 CommonJS 的 require(esm) 載入 Chartroom 的 createHandler，剝掉 /chartroom 前綴再轉交；9 項全過，監控站原本的路由與 404 不受影響。

要變成：監控站在 /chartroom/<專案>/ 底下打開該專案的架構白板，AI 照樣用 chartroom apply 或 POST /api/ops 改板，人在監控站裡看與拖。

動手前要決定三件事：(1) 每個專案的 .board 放哪；一個 createHandler 只管一塊板，station 要依專案各開一個，關閉時呼叫 close()。(2) Chartroom 的 POST 只擋跨來源與非 loopback Host、不驗 nonce，station 的 POST 一律驗 nonce，兩套規矩要統一或明說例外。(3) Chartroom 的頁面要先 npm run build 出 dist/app，fankeel 沒有 build 步驟，要決定是引用 Chartroom 的安裝路徑還是把 dist 帶進來。

算完成：監控站上點某個專案能打開它的白板，AI 改檔時畫面發光、出變更卡，三件事各有一筆裁定。

## 完成紀錄

監控站現在能在 /chartroom/<專案>/ 底下打開該專案的架構白板。profile 新增 station.chartroom 鍵，填 Chartroom 套件根的絕對路徑；沒設就沒有白板，請求照舊得到 404。三個懸而未決的問題這樣裁定：每個專案的板子由註冊根定出位置，第一次請求才建一個 handler，關閉監控站時一併 close；Chartroom 的 POST 不驗 nonce，改由它自己擋跨來源與非 loopback Host；頁面引用 Chartroom 安裝路徑下 build 好的 dist/app，fankeel 不帶 dist。專案卡片也多了開啟白板的連結。

- commit 94f510ec
- commit 40b61b39
- commit d5a8f499
- commit 893f29f8
