---
status: current
---

# TODO 全清：Ready 五條 ＋ Needs a decision 兩條 ＋ ADR 一條 — design

一句話：build 的派工從「貪婪分批」改成「依賴滿足就派」，plan 多一種 `**Dispatch:** user` 讓 build 一開跑就問，`await.js` 改讀派工當下蓋上的 lap，profile 多一族 `prompt.<stage|all>` 每輪注入一句，兩個最慢的測試檔拆開；/doctor 與 station 回放是使用者親手的 task；ADR 只記一條 TODO。

依據：survey 報告 `.fankeel/build/task-20260924T115442/survey.md`（per-machine，未提交），與 design 階段四個 reader 的回報。

## 1. ready-queue 派工

- `lib/plantasks.js` 新增並匯出 `ready(tasks, done)`：回傳尚未完成、且每個與它 `conflict()` 的**較早** task 都已在 `done` 裡的 task，照 plan 順序。`groups()` 與 `surfaces()` 保留不動，`ledger.js groups` 的輸出不變。
- `conflict()` 的 `files` 判斷把索引檔排除：`TODO.md` 與 `docs/README.md`（常數 `INDEX_FILES`，相對於 plan 所在 repo 的根）兩個 task 都列它們時不算撞檔。`read` 與 `interface` 兩種衝突照舊。
- `scripts/ledger.js` 新增 `ready` 動詞：讀 ledger 的完成集合，印出現在可以派的 task 編號，一行一個；沒有就印 `none`。
- `agents/fankeel-brain.md` 與 `skills/fankeel-build/SKILL.md` 的 build 迴圈改成：每收到一個 implementer 完成（含 review 通過），跑 `ledger.js ready`，把新的可派 task 在同一個回應裡派出去；提交請求在「沒有 implementer 在跑」時送出一次，涵蓋上次提交以來完成的所有 task。
- **不做 worktree**：每個 implementer 各開 worktree、由 brain merge，這次不做。`scripts/commit.js` 不認得 worktree（`docs/90-agent/reference/subagents.md` 的「在哪提交」接縫），brain 又不能 `git commit`，兩者都得先改。索引檔的豁免只靠 `Edit` 逐字比對：兩個 implementer 改同一個檔案的不同行時，後到的那次若 `old_string` 已變就會失敗重讀，不會蓋掉別人的改動。worktree 這一半改記成一條 `## Waiting`，lifts when: 共用樹上出現一次 implementer 互相蓋檔。

## 2. plan 標出使用者親手的 task

- `**Dispatch:**` 多第三種形式：`user — <使用者要做什麼>`。`skills/fankeel-plan/SKILL.md` 的 Dispatch 段落與「no third form」那句一起改。
- `lib/plantasks.js` 解析 `**Dispatch:**` 的第一個字（`implementer`／`in-session`／`user`），放進 task 物件的 `dispatch` 欄位。
- `scripts/ledger.js` 新增 `hands` 動詞：列出 `dispatch === 'user'` 的 task 編號與破折號後的說明；沒有就印 `none`。
- `lib/render.js:471` 判斷 implementer 的地方，把 `user` 也當成「不派 implementer」。
- build 開跑（brain 與 in-session 兩種都一樣）第一步跑 `ledger.js hands`；有列出東西時，先寫一份只有 gate 的 handoff，問使用者現在做、做完再回報、還是跳過，**不等** implementer 被擋住才回報。使用者親手的 task 由握有 `AskUserQuestion` 的那個 session 跑，也就是主控 session；時間點在 stage agent 的 task 都做完之後、build 的 gate 之前。

## 3. await.js 的 lap

- `lib/registry.js` 的 `markInflight` 多記一個 `lap`：`hooks/brief.js` 計算 brief 裡的 `commitPath` 時用的那個 N。
- `scripts/await.js` 盯檔時，`inflight.stage === data.stage` 且帶有 `lap` 的話就用這個 lap，否則照舊用 `lapOf(data, stage)`。
- 三次誤報是 `moves` 在派工之後又多出一筆 `build`，觸發點沒有找到；這個修法不管觸發點是什麼都讓兩邊一致。`tests/await.test.js` 補一個「重回 build」的 fixture。

## 4. profile 的自訂 prompt

- `lib/profile.js` 的 `KEYS` 新增 `prompt.all` 與 `prompt.<stage>`（七個 stage 各一），值是自由文字：新增一個 passthrough 的 parser，拒絕空字串與換行，長度上限 200 字元。
- 注入：`lib/render.js` 在 `rulesLines`（每輪）、`controlBlock`（主控）、`renderResume`（答完 gate）、`renderBrainBrief`（stage agent）四處，在 stage rules 最後附上 `prompt.all`，再附上 `prompt.<當下 stage>`，一句一行 `  - `。`renderBrief`（reader 等一般 subagent）不附：它們的回報給主控看，不給人看。
- `task.js profile set prompt.*` 設定時印出兩行：`+~N tok/輪`（`input-check.js` 的 `estimateTokens`）；以及附上這句之後，各 stage 的 rule 區塊大小對 2400 上限的餘裕，超過的 stage 名稱標出來。只警告，不拒絕。
- station 的設定精靈不加欄位，只能從 CLI 設定：精靈目前沒有自由文字的欄位型態，要加得另開一條。

## 5. 測試提速

- `tests/station-cli.test.js`（序列跑 78 秒）照 describe 拆成三個檔，並把 `:259-260` 固定的 `setTimeout(r, 900)` 換成輪詢子行程的輸出。
- `tests/task.test.js`（36 秒，約 100 次 spawn）照 describe 拆成兩個檔。
- `docs/01-guide/development.md` 更新整套測試的秒數，寫上量測日期與方法。

## 6. 使用者親手的兩件事

- station 回放逐塊調：沿用封存的 todo-four 計畫 Task 8 的步驟（`docs/99-archive/2026-09-24-todo-four.md:2113`），`Dispatch: user`，在瀏覽器上跟使用者來回。
- 記憶瘦身：使用者跑 `/doctor`，前後各跑一次 `node scripts/input-check.js` 記下 tok 數；/doctor 留下而 `input-check` 仍然報出的重複、死連結、過大段落，由主控在記憶目錄裡修掉。repo 的程式碼不改。

## 7. TODO 與文件

- `TODO.md`：關掉這次處理的七條；`## Needs a decision` 新增〔docs〕ADR 機制一條（參考 Trovara 的 `docs/04-architecture/adr/`，不是每個 task 都呼叫，何時觸發待定），連結 `docs/90-agent/reference/documents.md`；`## Waiting` 新增 worktree 那一半（§1）。
- `git mv` 把 `docs/plans/2026-09-24-todo-sweep-design.md` 與 `-sweep.md` 搬到 `docs/archive/`，`docs/README.md` 的索引狀態一起改。
- `docs/90-agent/reference/subagents.md`、`docs/90-agent/reference/registry.md`（`inflight.lap`）、`docs/02-architecture/pipeline.md` 中講到分批派工的句子，跟著 §1–§4 改。

## 成功標準

- `tests/plantasks.test.js`：plan 裡 1、2 撞檔，3 與兩者無關，4 只和 1 共用 `TODO.md` → `ready([], …)` 回傳 `[1,3,4]`；`ready([1], …)` 回傳 `[2]`。改之前沒有 `ready`，測試紅。
- `tests/plantasks.test.js`：`**Dispatch:** user — 跑 /doctor` 解析成 `dispatch: 'user'`；`ledger.js hands` 印出這個 task。
- `tests/await.test.js`：`moves` 有三筆 `build`、`inflight: {stage:'build', lap:2}` → 盯的是 `build-2-commit.md`。改之前盯 `build-3`，紅。
- `tests/render.test.js`：profile 帶 `prompt.all='用繁體中文回答'` → `render()`、`renderResume`、`renderBrainBrief` 三者輸出都有這一行；`prompt.verify` 只出現在 verify。
- 產出物檢查：`profile set prompt.all …` 印出的 `+~N tok` 必須等於 `estimateTokens` 對那句的結果，也必須等於注入前後 block 的 tok 差。三個數字出自同一個來源，所以必須相同。
- 測試：拆檔之後，逐檔序列計時最慢的檔 < 40 秒；整套的時間前後各量一次，記在 `docs/01-guide/development.md`。
