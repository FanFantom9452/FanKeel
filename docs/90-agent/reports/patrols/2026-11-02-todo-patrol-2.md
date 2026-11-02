---
status: decision
last_verified: 2026-11-03
---

# TODO 全表盤點（11-02 第二次）：shell 列看得出在跑什麼，派工 gate 在 auto mode 真的會問人

一句話：Pane 與 station 的背景 shell 列改顯示 Bash 的說明，不再一排 `cd F:/… &&`；背景 Bash 結束會自己喚醒主對話已在 Desktop 實測，所以不改用 Monitor；auto mode 下同一回應派第二個 Agent 會跳權限對話框、headless 會拒絕，途中修好了 headless 時數不到第幾個呼叫的問題；十一條 TODO 結案。

任務紀錄在 [2026-11 月紀錄](../../records/2026-11.md)。計畫封存在 `docs/99-archive/2026-11-02-todo-patrol-2.md`。

## 做了什麼

- 「shell 標示」：Pane 的 shell 列先用 Bash 呼叫的說明；沒有說明時拿掉開頭的 `cd <路徑> &&`，`node …/scripts/x.js` 縮成 `x.js`（1e34dbac、9701add2）。station 的 shell 列用同一套規則（64e6627f）。背景 await 的規則要求寫說明、不加 `cd`，範例說明照當站的名字（61c6e821、771024e1）。
- 「逾時轉背景的 lost 判斷」結案：前景命令逾時後轉到背景跑，不再被判成 lost（ec0cbc78）；真實結果文字是「Command did not complete within its 5s timeout and was moved to the background」，`backgroundedShell` 認得（065d8c10）。
- 「評估 Monitor 取代背景 Bash」結案：Claude Code 2.1.316 上背景 Bash 一結束就自己開新一輪，await.js 的喚醒本來就有效，所以不換（065d8c10、3e30089c）；guard.js 把 Monitor 當成 shell 呼叫一樣擋（4b1c6cfb）。
- 「dispatch gate 走 decider」結案：mod 的 `tool.check` 把派工 gate 的 ask 交給人（47cdeb07）。實測時發現 headless 下 hook 觸發那刻 transcript 還沒有這則訊息，每個呼叫都被算成第 1 個；改成 hook 自己寫標記檔來數（d8e5ad4f、6fb6f598）。之後 headless 第二個 Agent 被拒、互動 session 跳出對話框由人按允許（4f730b79）。
- 「verify 加 blast-radius lens」結案：profile 多一個 `verify.blast` 門檻，lenses 對被很多檔案引用的檔印出 Blast radius，verify 技能頁點名這個 lens（ad02f78a、34c05b96、0f1d097a）。
- 「title.js 認 SUBAGENT_EFFORT」「ask skill 註明判官已 xhigh」「spend 與 render 補架子」「Desktop 閒置壓縮的分工」「subagent 背景語意改寫」「建議執行 /auto-mode-setup」各自落地後結案（9ebddbdc、5e6a75b6、f69d9895、a5f1193c、79601f48、0cea8cb2、a5e08ceb）。
- 「station 導覽之後做回來」改成 Watch；「先問完、剩下自己跑」依使用者要求重開（9dfb96b6）。

## 沒做什麼

- dispatch gate 的標記檔放在暫存目錄的 `fankeel-dispatch-gate/`，不會自動刪；兩個 hook 同一瞬間觸發的情況沒有測試。
- `Task` 這個舊工具名的呼叫沒有實測，只驗了 `Agent`。
- Monitor 走 plugin.json 的 matcher 路由沒有實測，文件標為未實測。
- docs-check 還有 6 項本次之前就有的舊引用，沒有處理。
