---
status: decision
last_verified: 2026-10-27
---

# 轉交的站由 controller 填宿主清單，焦點頁每列可展開 plan 文字（10-27）

一句話：survey、build、verify 交給站 agent 跑時，主 session 的 controller 進站就用這一站的步驟填宿主清單（build 一個 plan `## Task N:` 一格，每條 `commit.js:` 後照 ledger 打勾）；監控站 plan 焦點頁每列多一個預設收起的摺疊，展開是該 task 在 plan 檔的全文。

計畫在 [99-archive/2026-10-27-plan-task-body.md](../99-archive/2026-10-27-plan-task-body.md)。

## 決定

- 清單句是 `lib/stages.js` 的 `LIST_RULE`，由 `scripts/task.js` 的 `controllerLines` 在進受控站時印一次，不放進每回合注入的 `controlRules`。
- `lib/detail.js` 的 `tasksOf` 把 `parsePlan` 已有的 `line` 與 `body` 送上站；焦點頁 `fpBody` 畫成 `<details data-gv="task-<n>">`，`keepOpen` 認得任何帶 `data-gv` 的摺疊，5 秒重繪不收起。
- 計畫分頁的卡片不加摺疊。

## 為什麼

站 agent 與所有 subagent 的工具清單都沒有 `update_plan`／`TodoWrite`，宿主清單只有主 session 能寫，所以由 controller 填。放進 `controlRules` 會讓受控 build 帶 mark 的注入到 2526 字，超過 2400 上限；進站時印一次就夠 controller 在那一回合建好清單。焦點頁原本只列 task 標題，plan 檔的內文要另開檔才看得到。

## 放棄了什麼

- 每回合都注入清單句：超過 2400 上限，得刪別的規則。
- 計畫分頁卡片也加摺疊：七欄卡片寬約 130px，展開後一行約 10 字，讀不了。
