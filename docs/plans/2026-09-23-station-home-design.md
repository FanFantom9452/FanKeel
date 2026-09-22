---
status: design-intent
---

# 站首頁：左側功能列與設定精靈

核可於 2026-09-23 的 design 關卡（對話內）。版面依據是已核可的 mockup
`.fankeel/build/2026-09-23-todo-ten/mockup.html`（不提交），規格來源是
[2026-09-23-todo-ten-design.md §7 與 §11](../archive/2026-09-23-todo-ten-design.md)。

## 1. 路由與功能列

- `parseHash` 認得 `#/`（現在）、`#/days`、`#/d/<day>`、`#/sessions`、`#/projects`、`#/docs`、`#/settings`；`#/p/`、`#/s/`、`#/list`、`#/cmp` 照舊，讀不懂的回到 `{ view: 'now' }`。
- 左側功能列 `navHtml` 分三組：看（現在／近 30 天／最近 sessions／專案／文件）、調（設定）、其他頁（清單／比較），目前的 view 標 `aria-current="page"`。
- 功能列的徽章由 `navCounts` 從頁面資料算出：live 數、30 天花費、最近 sessions 列數、專案列數、文件區塊數。
- `index.html` 頂端的清單、比較兩顆鈕移進功能列；CSS 用 `.sidenav`，不用已被路線條佔用的 `.rail`。

## 2. 五個「看」的 view

- 現在：每個沒消失的 registry 一張卡，列出它 live 與 stale 的 session，卡頭帶 `clearStaleControl`。
- 近 30 天：原首頁的 hero（`kpiHtml`、兩組 `segHtml`、`legendHtml`、`histSvg`）整塊搬過來；`#/d/<day>` 只把那一天標亮，不再有日細節面板，`dayPanel` 與 `dayPanelHtml` 刪除。
- 最近 sessions：`recentHtml` 列出 30 天內有花費或仍 live 的 session，不再截 12 筆。
- 專案：`projectsHtml(projectRows(...))`；文件：`docsCardHtml(...)`。
- 頁面上不再有 `profileCard`：`profileCard`、`profileRows`、`presetStrip`、`applyMachineControl` 與它們的呼叫都刪除，整頁沒有 `<select`。

## 3. 設定精靈

- 七步（收尾、任務大小、前端、context、撞檔、模型、監控站）的題目與習慣卡照 mockup 的 `STEPS` 逐字搬成 `WIZ_STEPS`。
- 第 3 步（前端）的細調加上 `design.skill`：六個 skill 加「每次問我」的按鈕群組，只在 `design.mockup` 不是 `false` 也不是空值時出現；摘要頁一律列出。
- 精靈的值從 `S.profiles`（machine 與每個 project）和 `S.profileKeys` 讀，不寫死；範圍按鈕是「機器預設」加上 `S.profiles.projects` 的每個目錄。
- 摘要頁列出 `S.profileKeys` 的全部 11 鍵，每列是按鈕群組、「改過建議」標記與「清成 (ask)」。
- 「寫入 N 鍵」的 N 是 `wizChanges` 的長度，也就是摘要裡標成會改的列數；served 時是一張 `POST /profile` 表單，帶 nonce、scope、project、每一個改動的 key／value 與 `back=#/settings`，靜態頁則列出等價的 `task.js profile set` 命令。

## 4. 寫入後回到原頁

- `POST /profile` 讀選填欄位 `back`：符合 `^#/[a-z]*$` 時 303 到 `/` 加上它，否則照舊回 `/`。

## 5. 逐塊即時調

- 每個 view 與精靈區塊帶 `data-block`：`nav`、`now`、`days`、`sessions`、`projects`、`docs`、`wizard`、`wizard-steps`、`wizard-step`、`wizard-summary`。
- build 最後一個 task 在 session 內與使用者逐塊調：開 serve、用 `scripts/render.js` 截圖，只改被點名的區塊，其餘不動。

## 6. 文件

- `docs/station.md` 的首頁、文件卡與「Setting a profile from the page」三節改寫成新版面。

## What proves it done

| check | how |
|---|---|
| `parseHash('#/settings').view === 'settings'`，`parseHash('#/')` 是 `now` | `tests/station-view.test.js` |
| 每個新 view 的輸出都不含 `<select` | `tests/station-view.test.js` |
| 精靈摘要列出 11 鍵，含 `design.skill` | `tests/station-wizard.test.js` |
| `POST /profile` 帶 `back=#/settings` 回 303，`location` 是 `/#/settings`；帶 `back=https://x` 仍回 `/` | `tests/station-cli.test.js` |
| 「寫入 N 鍵」的 N 等於摘要裡標成會改的列數 | `tests/station-wizard.test.js`，並在 render 出的頁面上數一次 |
| 功能列「現在」的 live 數等於現在頁 live 的列數 | `tests/station-view.test.js`，並在 render 出的頁面上數一次 |
