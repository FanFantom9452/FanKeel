- agents/fankeel-judge.md +9/-5 — 判官的 reader 數取自 brief 的 `inflight:`，沒有就跑 `task.js profile show`；`unlimited` 不設上限，檔案怎麼分給 reader 由判官自己決定
- lib/render.js +4 — 判官的 SubagentStart brief 由 hook 帶 `inflight: <n|unlimited>`（來自 `dispatch.inflight`），不靠 ask 手動傳
- skills/fankeel-ask/SKILL.md、docs/90-agent/reference/subagents.md — 去掉「最多八位」，改為 profile 決定，ask 頁說明 hook 帶值
- tests/inflight-text.test.js、tests/agents.test.js、tests/render.test.js — 舊措辭先紅後綠；新測試：三頁不得用數字限制 reader；judge brief 在 12、unlimited、未設、無 profile 下帶正確的 `inflight:`，其他 agent 不帶

hook/lib 檢查：`hooks/dispatch-gate.js:138` 本來就用 `inflightOf(values)`，沒有寫死 8；真正缺的是判官看不到 profile，現在由 render 補上。

done: 1 of 1 — 無 plan；範圍 efbd1639..a75f2f1e 各段 reviewer 均 clean，最後一段的措辭指正已修（最後兩個小提交只改 ask 頁與測試正則，未再派 reviewer）
suite --fast：在加入 render 變更後 6146 pass、0 fail（@ dce746fd）；之後只改了 ask 頁與一條測試，已重跑相關三個測試檔 120 pass，未重跑整個 suite。
docs-check：未執行
未驗證：新測試的「紅」是依程式推理與 reviewer 檢查，render 那條我沒有親眼看過先紅；沒實際派一個判官確認它讀到 brief 裡的值。

reads:
lib/render.js — judge 的 `inflight:` 行（約 879-882）

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : 判官 reader 數讀 profile","options":[{"label":"Go to Verify (Recommended)","description":"判官 brief 現在由 hook 帶 profile 的 inflight，頁面與測試都已同步；suite 6146 全綠"},{"label":"Stay in Build","description":"若還想改別的（例如補驗證真實判官讀到值），在此繼續"},{"label":"暫停","description":"先停在這裡"}]}],"next":"verify：確認 render 的 inflight 行、判官措辭與三組測試"}
```
