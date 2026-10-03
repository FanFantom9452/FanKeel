---
status: design-intent
last_verified: 2026-10-03
---

# 極小實驗 mod：四項實測各自的判定、記錄與回退

session c0d39e91-3df8-484e-9e35-444b00ba90b9 的 design。survey（`.fankeel/build/task-20261003T023224/survey.md`）的結論是：fankeel 要不要把注入與 hook 改走 Claude Code mod，取決於四件讀型別檔查不到的事（survey.md:63 的 a 到 d）。使用者在 survey gate 選「design 實驗規格」：這一站只設計那個極小實驗 mod，路線維持 architectural 七站。這頁寫的是要做的實驗，不是現狀；實驗本身不改 fankeel 的任何檔案，量完之後要不要遷移，由使用者另開 task 決定。

用語：「mod」是 Claude Code 的 function-hook plugin，一個資料夾，`hooks/hooks.json` 的 `modules` 指向一支 ES module，匯出 `register(on)`；它在沒有 Node 的環境裡執行，對外一律經過 `$`（plugin-authoring 的 `reference.md:11-24`）。「command hook」是 fankeel 現在用的那種：`hooks.json` 的 `hooks` 底下、由 Claude Code 啟動一個 `node` 行程的 hook。下文的 d.ts 指 `C:/Users/Owner/AppData/Local/Temp/claude/bundled-skills/2.1.288/2e2cabe37e78a1318b6edaff92390520/plugin-authoring/types/claude-code.d.ts`，Claude Code 2.1.288 的型別權威檔。「量測日」指第 7 節 M0 那天的日期，寫成 `YYYY-MM-DD`。

## 1. 實驗用的 mod 本身

- 放在 `C:/Users/Owner/.claude/dev-mods/c0d39e91-3df8-484e-9e35-444b00ba90b9/fankeel-mod-probe/`：plugin-authoring skill 規定的本 session 資料夾，2026-10-03 確認存在且是空的。三個檔：`.claude-plugin/plugin.json`（name 為 `fankeel-mod-probe`）、`hooks/hooks.json`、`hooks/probe.ts`。不放進 fankeel repo，也不改 fankeel 的任何 hook、agent 檔或 `lib/`。
- `hooks/hooks.json` 同時寫 `modules: ["probe.ts"]` 與一條 command hook：`UserPromptSubmit` 執行一行 `node -e`，在第 2 節的記錄資料夾寫一個 `command-hook-<毫秒>.json`。這一條只為第 6 節「同一個 hooks.json 能不能兩種並存」而存在。
- `probe.ts` 掛六個事件：`session.start`、`prompt.compose`、`agent.spawn`、`turn.step`、`classic.SubagentStart`、`session.append`（只記 `door` 為 `hook-context` 的列）。每個 hook 都先記錄、再 `next(e)`；只有三處改寫，其餘派遣與 prompt 原封不動：
  - `prompt.compose`：在 `next(e)` 回來的 sections 尾端加一段 `{ id: "fankeel-mod-probe:marker", scope: "session" }`，內文固定一行 `MOD-PROBE-COMPOSE-<nonce>：量測標記，不需理會。`
  - `agent.spawn`：只對 description 含 `mod-probe b` 的派遣，在 prompt 尾端加一行 `MOD-PROBE-SPAWN-<nonce>`。
  - `turn.step`：只對首則訊息含 `MOD-PROBE-EFFORT=<level>` 的子代理請求，把 `effort` 改成該等級再送出。這個事件是串流事件，hook 要寫成 `async function*`，以 `yield* next({ ...e, effort })` 送出（reference.md:28-30）。
- nonce：`session.start` 先讀 `$.store` 的 `probe.nonce`，沒有才用 `crypto.randomUUID()` 產生並存回，再寫進記錄；啟用與熱重載都會讓 `session.start` 再跑一次（d.ts:4057），沿用舊值才不會中途換號。nonce 不寫在任何 repo 檔裡。
- 驗收：`claude plugin validate <上述資料夾>` exit 0，輸出列出這六個事件。這一行現在會失敗，因為資料夾是空的。

## 2. 記錄方式

- 每次 hook 觸發，寫一個 JSON 檔到 `F:/ymlab/fankeel/.fankeel/build/task-20261003T023224/mod-probe/`，檔名是 `<Date.now() 補零到 13 位>-<event>-<4 個隨機字元>.json`。`$.fs.write` 只能整檔寫入、沒有 append（d.ts:3041），所以一事件一檔，兩個同時觸發的 hook 才不會互相蓋掉；檔名依時間排序，排出來就是事件發生的順序。
- 每個檔都有 `event` 與 `at`（毫秒），再加各事件判定要用的欄位，不記整段 prompt：
  - `prompt.compose`：`model`、`promptModel`、`traits`、完整的 `tools` 名單、`surfaces`。
  - `agent.spawn`：`tool_use_id`、原樣的 `description`、`subagentType`、`parentAgentId`、改寫前後的 prompt 長度、`next(e)` 回來的 `agentId` 與 `model`。
  - `turn.step`：`agentId`、`index`、`model`、改寫前的 `effort`、實際送下去的 `effort`、結果的 `usage.output_tokens`。
  - `classic.SubagentStart`：`agent_id`、`agent_type`。
  - `session.append`（hook-context）：`agentId`、`origin`、內文前 80 字。
  - `session.start`：`nonce`、`isInteractive`。
- 跑完後，記錄資料夾與 mod 的三個檔原樣複製到 `docs/90-agent/reports/evidence/<量測日>-mod-probe/`。報告引用的每一行記錄，都必須能在那裡用 `grep -F` 找到。這照 `docs/90-agent/reports/2026-09-28-subagent-hook-probe.md` 的先例：儀器與原始記錄一起進 repo，報告跑一次就不再更新。

## 3. (a) 子代理吃不吃得到 prompt.compose

- 主 session 的正控制組（第 7 節 M1）：主 session 不用任何工具，回答它的系統提示裡有沒有以 `MOD-PROBE-COMPOSE-` 開頭的一行並逐字引用，同時回答有沒有以 `MOD-PROBE-CONTROL-` 開頭的一行（這一行從未注入）。引用出的 nonce 與記錄相符、CONTROL 答「沒有」，控制組才成立；不成立時 (a) 判「無效」，不判「否」，因為連主 session 都沒吃到，子代理沒吃到不說明任何事。
- 受測（M2）：主 session 在同一個回應裡派兩個子代理，`general-purpose` 與 `fankeel:fankeel-reader`，description 分別是 `mod-probe a general` 與 `mod-probe a reader`，prompt 相同：不用任何工具，回報系統提示裡有沒有上述兩種開頭的行，有就逐字引用。
- 子代理的 transcript 只要出現任何 tool_use，該次作廢：記錄資料夾裡有 nonce，用工具讀得到，那就不是盲測。
- 判定，兩個型別分開寫：
  - 「會觸發」：派遣到返回之間有一筆 `prompt.compose` 記錄，其 `tools` 名單與主 session 的不同（reader 應恰為 Read、Grep、Glob、Bash，`agents/fankeel-reader.md:4`），而且子代理逐字引用出記錄裡的 nonce、CONTROL 答沒有。
  - 「不觸發」：沒有這樣的記錄，而且子代理兩行都答沒有。
  - 兩個訊號不一致：判「未定」，兩者都寫進報告，不挑其中一個。
  - `general-purpose` 的 `tools` 若與主 session 的完全相同，記錄分辨不出是誰的 compose；這時只憑引用判定，並在判定後註明「僅憑引用」。
- 身分：比對主 session 與子代理的 compose 記錄，哪些欄位不同（`tools`、`model`、`traits`），寫成「compose 裡能拿來分辨子代理的只有這些」。輸入沒有 agentId 已由型別確定（d.ts:7779），不再測。

## 4. (b) agent.spawn 改寫 prompt 之後，SendMessage 再送達時的行為

- 受測（M3）：主 session 派 `fankeel:fankeel-reader`，`name` 為 `mod-probe-b`，description 為 `mod-probe b`，prompt 是「不用任何工具，逐字回覆你收到的任務 prompt 的最後一行」。mod 的 `agent.spawn` 在 prompt 尾端加一行 `MOD-PROBE-SPAWN-<nonce>`。加在尾端而不是開頭，是因為 `hooks/brief.js:95` 的 `stageOfPrompt` 靠 prompt 的第一個字判斷 brain 是為哪一站而派，日後遷移也得保留第一個字。
- 它返回後，主 session 對 `mod-probe-b` 用 SendMessage 送「不用任何工具，再逐字回覆一次你原始任務 prompt 的最後一行」，等第二次返回。
- 四個量全部寫進報告：
  - `agent.spawn` 記錄裡 description 含 `mod-probe b` 的筆數（預期 1）。
  - `classic.SubagentStart` 記錄裡 `agent_id` 等於這個子代理的筆數；`hooks/brief.js:91` 的註解說每次 SendMessage 送達都會再觸發，預期 2。
  - 子代理 transcript `subagents/agent-<id>.jsonl` 的第 1 行是否以 `MOD-PROBE-SPAWN-<nonce>` 結尾；brief.js 的 `promptOfAgent`（`hooks/brief.js:62`）讀的正是這一行。
  - 兩次回覆是否都逐字引用出那一行。transcript 出現 tool_use 同樣作廢。
- 結論只照下列方式寫：「spawn 一次、SubagentStart 再觸發、第 1 行是改寫後的版本」表示遷移時 brief 可以交給 `agent.spawn`，但 inflight 重新標記仍須留一個 SubagentStart（command hook 或 mod 的 `classic.SubagentStart`）；「agent.spawn 也再觸發」表示 mod 單獨就能做；其他組合照實記錄，不推論。

## 5. (c) turn.step 在子代理 loop 改 effort 有沒有真的送出

- 受測（M4）：主 session 在同一個回應裡派兩個 `fankeel:fankeel-reader`（agent 檔的 effort 是 medium，`agents/fankeel-reader.md:6`），description 為 `mod-probe c low` 與 `mod-probe c high`，prompt 只差第一行 `MOD-PROBE-EFFORT=low` 或 `MOD-PROBE-EFFORT=high`，其餘是同一道不用工具的推理題。
- mod 的 `turn.step` 對帶 `agentId` 的請求，讀 `$.session.messages({ agentId })` 的第一則（d.ts:2562），找到標記就改 effort；回來的是 `{ deny }` 時當作沒有標記、照原樣送出，並記下。用首則訊息辨識，而不是靠 `agent.spawn` 回傳的 agentId，是因為子代理的第一個 step 可能早於 `agent.spawn` 的 `next` 回來；兩者的時間都有記錄，先後順序順便寫進報告。
- 判定：
  - 決定性的訊號是子代理 transcript 每個 assistant 行頂層的 `effort` 欄位。主 session 的這個欄位見 `lib/usage.js:102`；2026-10-03 本 session 的兩個子代理 transcript 也有，值分別是 `medium` 與 `xhigh`，各自等於它的 agent 檔。兩次都等於改寫值（low、high），且 `turn.step` 記錄的改寫前值是 medium，判「有送出」：設定值是 medium，不可能記成 low 或 high。
  - transcript 仍是 medium，判「未證實」。`usage.output_tokens` 只列出供參考，單一樣本不拿來判定。

## 6. (d) mod 與現有 command hooks 並存、以及載入規則

- 載入：使用者在主 session 開啟本 mod（M0）後，記錄裡出現 `session.start`。沒出現，整個實驗停止，報告寫「未載入」。
- 同一個 hooks.json 兩種並存：M1 那句 prompt 之後，記錄資料夾出現 `command-hook-*.json`（mod 自己 hooks.json 裡的 command hook 寫的）。出現表示可以並存，fankeel 日後能把 mod 與現有 command hooks 放在同一個 plugin；沒出現表示要分成兩個 plugin。
- fankeel 的 command hooks 照常運作：`session.append` 的記錄裡，主 loop 有內文含 fankeel 區塊的 hook-context 列（`hooks/inject.js` 的輸出），M2 到 M4 每個子代理的 agentId 下也各有一列（`hooks/brief.js` 的輸出）。缺任何一處，表示 mod 干擾了 fankeel，立刻做 M5 關掉 mod。
- 順序：`agent.spawn` 記錄的 description 若帶 `hooks/title.js` 加的「模型 · effort:」前綴，表示 PreToolUse 的 command hook 先跑、它的改寫進得了 mod；不帶則相反。本 session 子代理的 meta.json 記的 description 已含前綴（如 `opus · xhigh: design stage agent`），但那是派遣完成後的紀錄，不代表 `agent.spawn` 當下看到的值。

## 7. 主 session 執行的步驟

下列步驟由主 session（使用者與主控）做，不由 build 的 brain 或它派的 agent 做，原因有二：熱重載的開關只有使用者在主 session 按得到；子代理要從主 session 派，量到的才是主 loop 的 `agent.spawn`（`parentAgentId` 為空，d.ts:289）與一層深的子代理，brain 派出去的是兩層深，結果不能代表 fankeel 的主控派遣。plan 把這些寫成一個 `**Dispatch:** user` 的 task，排在「寫 mod」與「寫報告」兩個 task 之間，每一步要貼的 prompt 全文都由 plan 寫死，主 session 照貼，不自己改寫。

- M0（使用者）：在主 session 對 `fankeel-mod-probe` 按 `Enable for this session`，開啟熱重載；然後確認記錄資料夾出現 `session.start` 檔。
- M1（主 session，不用工具）：使用者貼上第 3 節的控制組問題，主 session 直接回答。這句 prompt 同時觸發第 6 節的 command hook 檢查。
- M2（主 session）：同一個回應派第 3 節的兩個子代理，等兩個都返回。
- M3（主 session）：派第 4 節的 `mod-probe-b`，返回後對它 SendMessage，等第二次返回。
- M4（主 session）：同一個回應派第 5 節的兩個子代理，等兩個都返回。
- M5（使用者）：關掉 mod；再打一句話，確認記錄資料夾不再新增檔案。
- M1 到 M4 期間，主 session 不做 fankeel 的其他工作。fankeel 的 `hooks/guard.js` 只攔 `fankeel-brain` 的派遣（`hooks/guard.js:150-152`），受控階段主 session 派 `general-purpose` 或 reader 不會被擋；主 session 也不需要 Edit 或 Write，記錄由 mod 經 `$.fs` 寫。

## 8. 回退

- 全域：實驗只新增 dev-mods 資料夾裡的三個檔。任何時候做 M5 關掉 mod，或刪掉那個資料夾，就回到原狀；寫報告之前，fankeel repo 沒有任何變動。mod 的 hook 拋錯時，引擎跳過它、鏈照常繼續（reference.md:72），不會擋住 prompt 或派遣。
- 改寫範圍：`agent.spawn` 與 `turn.step` 只動帶 `mod-probe` 標記的派遣；`prompt.compose` 加的是一行固定的被動標記，不含指令，內容不變，所以只在加上去的那一次耗一次快取。
- 單項失敗不重跑整套：某一項判「無效」或「未定」時，報告照實寫，並寫出重跑那一步需要什麼條件；要不要重跑那一步，由使用者在 gate 決定，其他項的結果照用。
- 各項結果對遷移的意義，只寫進報告，本 task 不動手：
  - (a) 不觸發：子代理的 brief 維持 `hooks/brief.js` 或改走 `agent.spawn`，`prompt.compose` 只考慮主 session。
  - (b) SubagentStart 不再觸發，或 transcript 第 1 行不是改寫後的版本：brief.js 的 inflight 標記照舊。
  - (c) 未證實：保留 effort 變體 agent 檔與 `scripts/variants.js`。
  - (d) 同一個 hooks.json 不能並存：mod 另成一個 plugin，或維持 command hooks。

## 9. 量測報告

- `docs/90-agent/reports/<量測日>-mod-probe.md`，frontmatter 照先例：`status: current`、`last_verified`、`source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新`。
- 一張四列的表：項目、判定（是、否、未定、無效）、依據（evidence 下的檔名與逐字引用的那一行）、對遷移的意義。
- 寫上量測時的 HEAD sha 與 Claude Code 版本（2.1.288，d.ts 第 1 行），因為 mod API 會隨版本改。

## 不做的事

- 不測 `prompt.compose` 的觸發頻率、`prompt.context`、`$.agent.register`，也不測 `budget.js`、`guard.js` 的遷移；不寫任何遷移程式碼。
- 不用 headless `claude -p --plugin-dir`：使用者規定 mod 放在本 session 的 dev-mods 資料夾、由主 session 開關並派遣。

## 尚未證實

- (c) 若兩次 transcript 都記 medium，無法分辨「沒送出」與「transcript 記的是設定值而非送出值」；這種情況只能判「未證實」。
