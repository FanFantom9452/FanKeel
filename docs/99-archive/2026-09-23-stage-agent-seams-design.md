---
status: current
---

# Stage agent 交接六接縫 — design

2026-09-23。來源：TODO.md `## Needs a decision` 的四條 〔stage-agents〕（plan handoff、brain 回報時機、`readGate` 驗 option one、verify 對手讀 transcript），加上同日這個 task 的 survey 實撞的兩條：`readGate` 收下沒有 `header` 的 gate、survey 的站 agent 用 `task.js route` 把開頭說定的 architectural 降成 bounded。Survey 報告：`.fankeel/build/task-20260923T075509/survey.md`（未提交）。

做法一句話：每個接縫在它唯一的出入口加一道檢查或一條退路，不加新的機制。

## 1. build 找得到 plan

- `lib/render.js` 的 `readFirst` 在 `previousHandoff` 回 null 時，改指向 `docs/plans/` 底下 mtime 晚於 task `started` 的最新一份 `*.md`（不含 `-design.md`，除非只有它）；都沒有才維持現在的 `read first: none`。
- 那一行說明它是 plan 檔、不是上一站的報告，讓 brain 不把它當 handoff 讀。
- 測試：`tests/render.test.js` 造一個 moves 只有 build、`docs/plans/` 有一份 `started` 之後的 plan 的 fixture，brief 的 `read first:` 行要點名那份 plan；一份 `started` 之前的 plan 不能被點名。

## 2. brain 只在交東西時回報

- `agents/fankeel-brain.md` 的 Return 段加一句：自己派出的每個 agent 都回來之前不回報；回報只有三種——handoff 路徑、`commit <path>`、或 brief 叫它回的東西。
- `lib/stages.js` 的主控規則（`controlFor`）加一句：站 agent 的回報不是路徑時，不轉述、繼續等；task-notification 說它結束了卻沒有路徑到達時，讀 brief 指定的 handoff 路徑，存在就照常出 gate。
- 測試：`tests/stages.test.js` 斷言主控規則含「不是路徑就等」與「沒路徑讀 handoff」兩句；`tests/brief.test.js` 或既有的 agent 檔測試斷言 `fankeel-brain.md` 的 Return 段含等待子 agent 的句子。

## 3. `readGate` 驗整個 gate

- `lib/handoff.js` 的 `readGate(file, next)` 驗：每題有字串 `header`（≤12 欄，CJK 算二）與 `question`；`options` 2–4 個，每個有字串 `label` 與 `description`；`multiSelect` 若有須是 boolean。
- 帶 `next` 時再驗 option one 的 `label` 含下一站名稱（最後一站含 `down` 或「收工」）；verify 想退回 build，退回要放 option two 以後。
- 驗不過回 `{ invalid: '<哪一欄>' }` 而不是 null；`hooks/gate.js` 收到 invalid 就用 PreToolUse 的 deny 擋下這次 AskUserQuestion，理由寫明哪一欄壞了、要主控 SendMessage 站 agent 重寫 gate。檔案不存在或沒有 gate 區塊仍回 null、維持現在的放行。
- brain 的 brief（`lib/render.js` 寫 gate 區塊那一行）點名 `header` 與 option one 必須是下一站。
- 測試：`tests/handoff.test.js` 用這次 survey.md 第一個 gate 區塊（缺 `header`）當 fixture，現在 `readGate` 收下，改後回 invalid；另一個 option one 寫成 build 的 verify gate 在 `next = audit` 時回 invalid。`tests/gate.test.js` 斷言 invalid 時輸出 deny。

## 4. verify 的對手讀得到 transcript

- verify 站的 brain brief 多一行 `subagents: <session 目錄>/subagents/`，路徑用 `lib/usage.js` 已有的 `sessionDirOf` 算。
- `skills/fankeel-verify/SKILL.md` 的對手段落：dispatch 對手時把這個路徑一起給它，「Was it run?」先查那裡有沒有對應的 `agent-*.jsonl`。
- 測試：`tests/render.test.js` 斷言 verify 站的 brain brief 含 `subagents/` 路徑、其他站不含。

## 5. 開頭說定的類別是下限

- `task.js start --class <c>` 在 entry 寫 `floor: <c>`；只給 `--route` 或用 profile 預設時不寫。
- `task.js route` 在新路線少了 floor 那個類別路線裡的任何一站時拒絕，訊息說明下限是誰定的、要升級可以、要降級請使用者重開 task。
- `adopt` 帶過 `floor`；`task` 改名保留它（和 `route` 一樣）。
- 測試：`tests/route.test.js` 在 `--class architectural` 開的 entry 上跑 `route "survey,design,build,verify,land"`，現在成功，改後 exit 非零；沒有 floor 的 entry 行為不變。

## 6. 文件跟上

- `docs/90-agent/reference/subagents.md`：gate 替換不再是無條件照抄——驗不過會被擋；brain 回報時機；verify brief 的 `subagents:` 行。
- `docs/90-agent/reference/registry.md` 與 `skills/fankeel/SKILL.md`：新欄位 `floor`，SKILL.md 裡另寫一段；「每個 session 帶的欄位」計數不動，因為只有 `--class` 開的 task 才帶 `floor`。
- TODO.md 的四條 〔stage-agents〕 在交付它們的 task 裡拿掉。

## 驗收

- 上面每條測試先紅後綠，整套 `npm test` 綠。
- 產物那一格：用這次的 survey.md 重跑 `hooks/gate.js`，第一個 gate 區塊被擋、第二個照常替換。

## 沒驗過的

- brain 在子 agent 還在跑時回報，是 brain 自己選擇回報、還是 Agent 工具在它等待時就結束了它的 turn——沒有程式碼能確認。第 2 節的指令修的是前者；若是後者，只有主控那半（讀 handoff 檔）有效。
