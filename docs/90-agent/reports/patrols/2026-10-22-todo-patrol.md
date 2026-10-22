---
status: decision
last_verified: 2026-10-22
---

# TODO 全表盤點（10-22）：八條結案，三題當場裁定

一句話：41 條全部給了處置，五條 Ready 直接做完，Needs a decision 裡三題在 survey 閘門由使用者裁定後照做，共八條結案、一條解封、一條新開。

任務紀錄在 [2026-10 月紀錄](../../records/2026-10.md#r-2026-10-22-3751ce2a)。計畫封存在 `docs/99-archive/2026-10-22-patrol.md`。

## 做了什麼

- 「land 先寫報告再跑整套」結案：land skill 改成報告與索引列先寫並提交，再跑整套（76664184）。
- 「mockup 等待逾時改成一小時」結案：`tune.js wait` 預設 3600 秒（57d9e6b2）。
- 「Pane TODO 只留計數與跳轉鈕」結案：Pane 只顯示各狀態計數，按下跳到監控站的狀態群組（c246a8dc、e9807fa1）。
- 「遠端收尾三個缺口」結案：disable 只撤自己的 `/` 對應，enable 失敗立即撤銷，使用者文件說明手動指令（62b091a1、7b522463）。
- 「serve 訊號收尾沒測試」結案：抽出 `closeOnSignals`，SIGINT 與 SIGTERM 各有測試（c04f2983）。
- Workflow 門檻：使用者裁定改回三個，程式、brain 規則與 brief、三個 skill、subagents 參考頁與決策頁一起改（46ef9e07、7d199708、19327c1e、c43209c5）。
- 整套重跑：使用者接受放寬，整套只紅一個檔時單獨重跑，過了記綠並註記 retried 與測試名（ca9ffcfe）。
- build 改文字查測試：使用者同意，build 審查範本加一句（026dbfa3）。
- build 收尾時四個 skill 長過上限，調整上限並修一個打字錯誤（483eab50）。

## 沒做什麼

- 「station 改版剩下的頁」要使用者看 mockup，留在 Ready。
- 「station 遠端的手機實測」條件已滿足，解封移到 Needs a decision；tailscale `--set-path=/ off` 的真機確認併進同一次實測。
- verify 找到三個不阻擋的小尾巴，記成新條目「station 文件長句與過時測試名」。
- 「各站交接改帶事實檔」與「source 測試不認 vm 載入」這輪沒問，留在 Needs a decision。
- knip 仍是 6.42.1，戳記改今天；其餘 Blocked 與 Watch 條件都還沒發生。
