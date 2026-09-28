---
status: design-intent
date: 2026-09-28
task: 減少 subagent context 堆疊：group 並排 brain、小 task、共用資訊放 prompt 開頭
---

# Agent 壽命：並排 brain、小 task、共用前綴

一個 agent 的花費大約跟「請求數 × 平均 context」成正比。每一次請求都要把整段 context 重讀一遍，所以 agent 活得越久、context 越大，平方項就越大。在大 context 下，sonnet 和 opus 的快取讀取都是每百萬 $0.20（`lib/prices.js:35-41`），換模型省不到什麼錢，能省的是讓 agent 活得短一點。

基準數字來自 session f44b1c61：總花費 $111.65，其中 subagent 佔 $92.42。i18n implementer 一個就花了 $28.65，409 次請求，context 從 36k 長到 544k；build brain 花了 $18.14，247 次請求，context 長到 411k。survey 的查核結果在 `.fankeel/build/task-20260928T011854/survey.md`。

下面八段各自是一個單元。每段的第一層 bullet 都是一項承諾，plan 的覆蓋表就從這些承諾建立。

## 1. 按 group 並排 brain（build）

- controller 從 `ledger.js groups` 取得目前可以開工的 group，互不共用檔案的 group 在同一次回應裡一起派出，每個 group 一個 `fankeel:fankeel-brain`，brief 寫明它負責的 task 編號。
- 一個 brain 負責的 task 在 `progress.md` 裡都標成 `complete` 以後，這個 brain 就回報並結束。下一個 group 一律開新的 brain，從 ledger 接著做。
- 同一個 session 可以同時有好幾個 `inflight` 標記：`lib/registry.js:784-802` 的 `markInflight` 改成以 `agentId` 為鍵的清單，每筆帶 `group` 欄位；`clearInflight` 的作用範圍不變，仍然一次清掉整個 session 的所有標記——真正會比對成功的 gate 只會在所有 group 都交回報告之後才出現,那時已經沒有其他標記留著要保留,`hooks/gate.js:227` 對 `clearInflight` 的呼叫維持兩個參數,不narrow成一筆。
- 交接檔和 commit 檔的名稱加上 group：`lib/handoff.js:51-64` 產生 `build-g<N>.md` 和對應的 commit 檔，兩個 brain 不會寫到同一個檔。
- `scripts/await.js:85-100` 每有一個 brain 完成就回一行，並寫明是哪個 group、哪個 agent。controller 把每個 brain 的 commit 請求分開處理，用 SendMessage 回給那一個 brain。
- stage 的 gate 只問一次：所有 group 都完成以後，controller 再派一個收尾 brain（prompt 寫 `build close`），由它跑完整測試，寫出 `build.md` 和 gate。
- `lib/stages.js:638-661` 的 controller 規則、`lib/render.js:490-565` 的 `renderBrainBrief`、`agents/fankeel-brain.md:70-89` 和 `skills/fankeel-build/SKILL.md` 改成以 group 為單位描述。不做 brain 底下再開 brain。

## 2. task 大小上限（plan lint）

- `lib/plantasks.js` 的 `lint()` 新增讀取量檢查：把每個 task 的 `**Files:**` 裡 `Modify:` 檔案的行數加起來。寫成 `path:a-b` 的只算 b−a+1 行；`Create:` 不計入，因為新建檔沒有既有內容要讀。
- 讀取量超過 `READ_CAP = 1500` 行，或 `Modify:` 超過 `FILE_CAP = 3` 個，就列為 lint finding；這條跟既有的三項檢查一樣會擋下 plan gate。兩個常數由 `lib/plantasks.js` 匯出。
- `skills/fankeel-plan/SKILL.md` 的 task 範本說明大檔（例如 5095 行的 `assets/station/station.js`）必須寫出行號範圍；寫不出範圍，就代表 task 要拆開。

## 3. context 上限 hook（只作用在 subagent）

- 新增 `hooks/budget.js`，登記在 `.claude-plugin/plugin.json` 的 PreToolUse 和 PostToolUse。payload 沒有 `agent_id` 就立刻返回，主 session 完全不受影響。
- 它讀取這個 subagent 自己的逐字紀錄，並用 `lib/context.js` 的 `inspect()` 只讀檔案最後 512KB（`lib/context.js:36,55-73`）。
- context 達到 `SOFT = 150000` 時，PostToolUse 每一次都注入：「做完這一步，把進度寫進 `.fankeel/build/<task>/relay-<agentId>.md`，然後回報那個路徑。」
- context 達到 `HARD = 250000` 時，PreToolUse 拒絕所有工具呼叫，只有寫入 `.fankeel/build/` 底下檔案的 Write 和 Edit 例外；拒絕理由寫明交接檔的路徑。
- brain 收到一個 relay 路徑，就派一個新的 agent，prompt 只寫共用前綴（第 4 段）加上那個 relay 檔。`SOFT` 和 `HARD` 由 `lib/context.js` 匯出，放在 `BUSY` 旁邊。

## 4. 逐字相同的共用前綴

- `scripts/ledger.js brief` 新增 `--group <N> --prefix` 輸出，依序包含：`context.md` 的全文、這個 group 各 task 的 `Files`／`Consumes`／`Produces`，以及固定的 implementer 規則。輸出的字元只取決於檔案內容，不含時間或 agent id。
- brain 把這段輸出原封不動放在每一個 implementer prompt 的開頭，個別 task 的內容放在最後。同一個 group 裡可以同時開工的 implementer 在同一次回應裡一起派出，讓 5 分鐘的快取還沒過期時就能共用。
- `lib/render.js:600-602` 不再只列 `context.md` 的路徑，改成直接貼上內容，這樣 brain 和 reader 就不必自己 `Read` 這個檔。

## 5. `context.md` 要真的有人寫

- survey 和 plan 派出的 reader，brief 裡的回傳規定加一條：每查到一項以後還會用到的事實，就用 `scripts/context.js add` 寫一行。
- 離開 survey 和離開 plan 時，如果 `context.md` 裡一條事實都沒有，`task.js stage` 會印一行警告，不會擋下。

## 6. 模型分級：Haiku 只用在機械式 task

- plan 的 `**Dispatch:**` 行允許寫 `implementer, haiku`，但只限讀取量不超過 `READ_CAP / 2`，而且每一步都附有完整程式碼或逐字替換內容的 task；lint 會檢查這兩個條件，不符合就列為 finding。
- `dispatch.floor` 本身不改。允許 haiku 的判斷在 `lib/profile.js` 和 `lib/stages.js` 的 floor 檢查處，只有 lint 通過的 task 才能用。brain、reviewer 和 verifier 的 agent 檔維持 sonnet。

## 7. Station：每個 agent 的 context 峰值和請求數

- `lib/station.js` 的 `gather()`（:352，:420-421）改為對每個 subagent 呼叫 `lib/usage.js:80` 的 `summarise(path, {series:true})`，由此得到 `requests` 和 `peak`（每次請求 context 的最大值）；`serialize()`（:640）也要把這兩個欄位帶出去。
- `assets/station/station.js:3739-3745` 的派工表在 USD 後面加兩欄：「context 峰值」和「請求數」。表尾把請求數加總，圖的 `metric` 也多這兩個選項。文字寫在 `assets/station/i18n.js`，每種語言都要有。

## 8. 更正累計花費的加總錯誤

- `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js:30-31` 把各站的 `+=` 改成只取最後一站的 `total_cost_usd`，因為 `--resume` 給的本來就是累計值；改完重跑一次，把新的輸出存進同一個 evidence 目錄。
- 報告寫出去以後就不再改內文，所以 `docs/90-agent/reports/2026-09-25-controller-multiplier.md` 和 `2026-09-28-ab-profile-pin.md` 只在開頭加一個有日期的「更正」區塊，寫出正確的數字：09-25 是 opus $6.36、sonnet $8.95，k = 1.71；09-28 是 opus $6.19、sonnet $8.60，k = 1.64。
- `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md:8` 和 `2026-09-28-guard-seen-ab-rerun.md:21` 各加一行更正。`docs/90-agent/reference/sources.md:70-71` 和 `docs/README.md:152,247,253` 是會持續維護的文件，直接改成正確的數字。

## 收尾

- `TODO.md` Blocked 底下的「brain 的 context 撐不住」和「交接後 context 仍過 400k」由這個 task 處理完，最後一個 task 把這兩條移除。另外在 Watch 新增一條：下一次有 5 個以上 task 的 build，用第 7 段的欄位檢查成效。

## 成功標準

會先失敗、做完後通過的測試：
- lint 遇到一個 `Modify:` 整份 `assets/station/station.js`（5095 行）的 fixture task，會回報 finding；
- budget hook 拿到一份 160k 的 subagent 逐字紀錄時，會注入 `additionalContext`；拿到 260k 時，會拒絕 `Read`、允許寫入 `.fankeel/build/` 的 `Write`；沒有 `agent_id` 時什麼都不做；
- `inflight` 裡有兩個 brain 時，`await.js` 會分別回報兩個；
- `serialize()` 的輸出帶有 `peak` 和 `requests`；
- `ledger.js brief --prefix` 對同一個 group 執行兩次，輸出的 bytes 完全相同。

產出物本身的檢查：畫出來的 station 派工表中，表尾的請求數要等於各列請求數的總和；每一列的 `peak` 都不能大於那一列的 tokens。

上線後的成效用第 7 段的欄位衡量，對照 f44b1c61：沒有任何 subagent 的 context 峰值超過 250k（基準是 544k）；最貴的單一 subagent 佔全部 subagent 花費的比例低於 15%（基準是 31%）。這兩項會記成 Watch 條目，不當作 verify 的測試。

## 尚未證實

- PostToolUse 的 `additionalContext` 能不能送進 subagent 自己的模型，目前沒有紀錄。plan 的 Task 1 先用 `claude -p` 實測，同時記下 subagent 內 `transcript_path` 的實際值，確認它是不是就是 subagent 自己的 `agent-<id>.jsonl`。如果送不進去，第 3 段只保留 PreToolUse 拒絕：拒絕理由會以工具錯誤的形式回到 agent 身上。
- SubagentStart 注入的 brief 和 Agent 的 `prompt` 誰在前面，目前也不知道。這影響第 4 段的前綴能不能從 prompt 的第一個字就開始共用快取，但不影響逐字相同這件事本身；Task 1 會一併確認。
