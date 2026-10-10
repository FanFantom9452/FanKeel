---
status: decision
last_verified: 2026-10-09
---

# TODO 全表盤點（10-09）：定了什麼、沒做什麼

一句話：這一輪盤點把十條 Ready 裡的九條做掉，另替四條待決定的條目做了決定；brief-3 要使用者在互動 session 親手探測，沒有動；stage-agents-10 補了 10-08 的證據後仍然封鎖，等一次 `claude --debug` 的實跑。

計畫在 [2026-10-09-todo-patrol.md](../../../99-archive/2026-10-09-todo-patrol.md)。

## 做了什麼

- brief-4、brief-5：build brain 的固定散文搬進 agent 檔，brief 只留每次不同的路徑；上限從 9950 降到 9500，量 brief 時用固定長度的參考根目錄，worktree 路徑再長也不會把測試弄紅。
- build-9：ledger 用 registry 的根放帳本，worktree 裡的 build 寫到主樹同一份進度檔。
- tests-5：suite.json 記下每個失敗測試的名字，不只總數。
- station-17：detail 的快取版本升到 9，壓縮摘要不再當一般訊息計入；用兩份帶壓縮點的 transcript 當 fixture。
- docs-4：fankeel-explain、fankeel-station、docs/README.md 三頁逐段對照程式碼為真，日期改到 2026-10-09。
- title-4：agents 覆寫檔比行程啟動還新時，title hook 不改名；profile set 印出要開新終端機才生效。決定：hook 不改名並提示重開。
- dispatch-1：新的 PreToolUse hook 在同一則回覆的第五個 Agent 或 Task 派工時回 ask，附上 registry 的花費或 Haiku bench 的角色單價估價；四個以內不變。規則文字把四改成預設而不是上限，六處頁面另開 rules-1 待改。決定：hook 層加 gate，估價用 bench 角色價。
- stage-agents-17、stage-agents-15：不花約 60 美元跑 build 與 verify 的對照，以理由結案；stage.agents 只留 survey。
- gate-7：Pane 上的 gate 介面草稿由使用者逐項裁定五個未決事項，頁面改為 planned、核准日 2026-10-09；實作另開任務。
- todo-5：受控階段當場寫 TODO 的 guard 界線已在上一輪的規則裡成立，這一輪確認後結案。
- 十四條封鎖的條目全部重新蓋上 2026-10-09 的戳記；Watch 的十一條沒有逾期的。

## 沒做什麼

- brief-3（子代理 brief 改走 spawn）沒有動：探測要使用者在互動 session 按 Enable。
- stage-agents-10：10-08 再發生的證據補進了 2026-09-28 的報告，但 allow 規則有沒有被讀到查不出來，條目改成封鎖，等 `claude --debug` 的實跑。
- rules-1：六處頁面仍把四說成上限，是這一輪新開的條目，留在 Ready。

## 為什麼

- 四條待決定的都在 survey 的 gate 一次問完，設計與計畫才不用回頭；A/B 的錢不花，是因為 stage.agents 已經縮回 survey，對照的對象不存在了。
- verify 打掉了一列：dispatch gate 的 `-high`/`-xhigh` 後綴剝除沒有測試。使用者選擇回 build 補一條測試再回 verify，而不是記成 TODO，所以這一輪多了一個 fix 範圍。
- 第一次全套測試有一個 station CLI 的時間相關紅燈，單獨跑與第二次全套都綠，不是這一輪範圍內的檔案；照 10-07 的裁定，受時間上限約束的測試不放寬。
