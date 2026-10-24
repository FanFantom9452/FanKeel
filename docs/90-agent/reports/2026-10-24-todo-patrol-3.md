---
status: decision
last_verified: 2026-10-24
---

# TODO 全表盤點第三輪（10-24）：做了什麼、沒做什麼

一句話：gate 頁的摺疊撐得過重畫、可以自由輸入、能跳回 talk 頁；talk 頁逐筆列出回話時間、用了哪些工具、派了哪些子 agent，點子 agent 看得到它的過程；文件頁與設定頁（快速、詳細）搬成 `FK_DOCS`、`FK_SETTINGS`、`FK_SETDETAIL` 模組，舊文件卡與七步精靈刪掉；頁尾顯示 fankeel 版本。

兩份計畫：[2026-10-24-station-gate-talk.md](../../99-archive/2026-10-24-station-gate-talk.md)（8 個任務）與 [2026-10-24-station-docs-settings.md](../../99-archive/2026-10-24-station-docs-settings.md)（10 個任務）。

## 做了什麼

- gate 頁的摺疊在 5 秒重畫後仍保持開合，右側問題多了自由輸入欄，並有按鈕跳回這個專案的 talk 頁（6d73fa28、0580b006、d55d7bda）。
- talk 頁每則回話標出時間與耗時，列出工具呼叫與子 agent 派遣；點子 agent 開對話框看它的逐步紀錄，執行中的會標成 running（021be014、3be99227、ee8983ff、406c025a、a7c54626、02971fce）。
- shells 計數收進較不顯眼的位置，頁尾顯示外掛版本（d2f27d07、02971fce）。
- 文件頁改由 `FK_DOCS` 畫，資料來自 `scripts/docs-health.js`；重新檢查失敗時會說（cd962c3f、f6fdf142、b1a5da94）。
- 設定頁分成快速設定（`FK_SETTINGS`，推薦由 `lib/settingsuggest.js` 算出）與詳細設定（`FK_SETDETAIL`），POST /profile 會說 agent 檔沒同步（19215e3e、8848fcdf、73904527、b4db237b、a99766a1、f83b03d4、cdf6e67d）。
- 舊文件卡、七步精靈與它們的字串刪掉，station.js 從 6393 行降到 5727 行；說明文件與 init skill 不再描述它們（b57d7504、f9fd3cc2、7a14dfa6、5a2cd67a）。
- 五個 Blocked 條目重新蓋章，遠端條目記下「繼續評估 VPN」，新開條目「station.css 的死樣式」（9fc6b17c）。

## 沒做什麼

- 「gate 頁重畫，摺疊點不開」的完成標準要使用者自己在瀏覽器點過，條目維持 Ready。
- 「設定頁待調整」：詳細設定頁沒有逐項對照 mockup，條目維持 Ready。
- 「station 留 vanilla、拆完模組」的 (b) 還沒達成：station.js 5727 行，目標 1500 行以內，days、list、focus 仍在檔內。
- station.css 約 378 行的 `.wz` 與 `.dsx*` 死樣式沒刪，已開條目。
- `profile.md` 第 74 行的 `PRESETS.balanced` 引用沒有引文，docs-check 只提示。
- plan 2 group 5 的審查沒跑 mutation 檢查（hook 擋寫入）。
