---
status: design-intent
last_verified: 2026-10-01
---

# TODO 全表盤點：退回 build 的 gate、主控轉述、suggest 推 class、STATION 改版

session 5481b548-26be-4f12-b6c0-5ccd9e4befa5 的 design。survey 的 gate 使用者選「plan：放行 profile 與 station」：
除 Ready 的〔stage-agents〕與 Needs a decision 的〔controller〕，另放行 Blocked 的〔profile〕
（原等 10-02）與〔station〕三條（原等影片定案）。這頁描述要做成的樣子，不是現在的樣子。

四件互不共用檔案、彼此不餵資料，由 plan 拆成獨立 task。

## 1. 退回 build 的 brain 自己寫 gate（stage-agents-13）

現況：`lib/render.js:533` 只分兩種 case——「task 編號的 group」與「`build close`」；
verify 退回時主控送出的是裸的 `build`（`lib/stages.js:675` 的通用派工句），兩種都不是，
brain 就不寫 gate。`lib/handoff.js:55-61` 的 `fileFor` 給退回那圈的檔名是 `build-2.md`，
`build-fix.md` 是 brain 自己編的。

- `lib/render.js:533` 的 case 說明加第三種：prompt 沒有 group 編號也不是 `build close`
  （裸的 `build`，含 verify 退回）時，照 `build close` 辦：跑全套、報告與 gate 寫到 brief 指名的 handoff。
- `tests/brief.test.js` 新增一個測試：lap 2 的 build brain brief 含這第三種 case 的句子與 `build-2.md`；
  改動前失敗、改動後通過。
- `agents/fankeel-brain.md:92-95` 同步一句，`tests/agents.test.js:357-362` 仍通過。

## 2. 主控轉述、不疊 await（controller-1）

使用者答：brain 之間用代號即可；主 session 要轉述，或 STATION 顯示各 session 在做什麼。
STATION 的 live lane（`assets/station/station.js:1516-1536`）已列 stage agent 與每個 subagent 的
`description`；缺的是主控對使用者的話與疊開的 await。

- 主控規則加一句：對使用者轉述時用 TODO 條目的標題，不用 `await-1` 這類 id。
  受控區塊離 2400 上限只剩幾十字元（`lib/stages.js:664-670`），新增字數要從同區塊其他句省回來，上限不動。
- `scripts/await.js` 對同一 session、同一個 in-flight mark 只許一個 waiter：開始時寫
  `<handoff>.await` 標記（含 pid），第二個 waiter 看到活的 pid 就印一行 `already awaiting <agentId>` 後 exit 0；
  waiter 結束時刪掉標記，pid 已死的標記視為沒有。
- `tests/await.test.js` 新增：同一個 mark 起兩個 await，第二個印 `already awaiting`；
  改動前第二個會一直等。

## 3. `suggest` 推 `class.default`（profile-1）

`lib/profile.js:311` 的 `suggest` 只讀 git 與 registry 的 `land`。gates 裡幾乎沒有 class 或 mockup 的選擇
（1384 個 gate 中 class 約 1 個、mockup 1 個，reader 的 regex 掃描），但每個 session 檔的 `class` 欄位有值
（architectural 67、bounded 73、spike 1）。

- `suggest` 從同一 project 的 registry entry 的 `data.class` 數票，至少 3 筆且最多那一類過半才填 `class.default`，
  evidence 加一行 `class records: <n> architectural, <n> bounded, ...`。
- `design.mockup` 不推：紀錄裡沒有足夠的答案。條目的這半句以 `measured-no-change` 的理由寫進關閉說明。
- `tests/profile.test.js` 新增：fixture registry 放 3 筆 bounded、1 筆 architectural，`suggest` 回 `class.default: bounded`；
  只有 2 筆時不填。改動前 `class.default` 永遠 undefined。

## 4. STATION 改版（station-9、station-10、station-11）

資料不用新增伺服端：`lib/station.js:358-391` 的 `todoOf` 已把每個 project 的 `open[]`（含 `state`）放進
`S.projects[].todos`。偏好沿用 `localStorage`（`assets/station/station.js:16-17` 的 `stored`/`store`）。
mockup 在 `.fankeel/build/2026-10-01-station-redesign/mockup.html`（gitignored，只在主 checkout；design 時由 `tune.js serve --port 7851` 開在 http://127.0.0.1:7851/.fankeel/build/2026-10-01-station-redesign/mockup.html），gate 核可的是那一頁。

- 儀表板新增卡片 `data-block="dash-todo"`：每個 project 一列，Ready 數與 Ready 條目標題，另列待決定／Blocked 數。
- 儀表板卡片可選可排序：`data-block="dash-chooser"`，存 `localStorage` 的 `station.dash`，附「還原預設」；
  預設與今天的四卡加 TODO 卡相同。
- 專案頁 `todo-done` 預設只列最新 10 條，「展開全部（N）」展開；`todoPanelHtml` 仍 export 給測試。
- 整頁視覺跟著宣傳片（`assets/station/tour.css`）的色盤與字；舊樣式保留成可切換的「經典樣式」
  （`data-block="style-classic"`，存 `localStorage`），現有功能一項不減。
- `docs/90-agent/reference/station.md:594-611`（「四張卡」）與 `:663`（「兩個 `localStorage` key」）隨改動更新。
- 驗收：`tests/station-todo-panel.test.js` 與新的 dashboard 測試新增——dash-todo 的 Ready 數等於同一份 `S.projects[].todos` 裡 `state==='ready'` 的條數；
  done 超過 10 條時只渲染 10 個 `td-row` 加展開鈕；render 出的頁上 dash-todo 的總數與專案頁 TODO 面板的 Ready 數一致。
