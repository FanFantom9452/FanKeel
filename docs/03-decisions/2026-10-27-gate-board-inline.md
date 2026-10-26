---
status: decision
last_verified: 2026-10-27
---

# gate 頁上的任務板內嵌、可編輯（10-27）

一句話：session 停在 gate 時，gate 頁把任務的 `.board` 以內嵌 SVG 畫出來，可以直接編輯並寫回檔案；session 卡片仍用 `<img>`。

這是 [10-20 決定](2026-10-20-task-boards-as-svg.md)「卡片用 `<img>`、不嵌 SVG」的例外，設計在 [plans/2026-10-27-board-upgrade-design.md](../90-agent/plans/2026-10-27-board-upgrade-design.md)。

## 決定

- 只有 gate 頁內嵌，只有 session 停在 gate 時能寫；寫入走 `POST /station/board/<session>/<name>`，帶 nonce。
- 套用用上游 Chartroom 的 `ops.js`：整批成功或整批不動，會新增參照問題的整批拒絕。
- 每筆寫入與標記記在板子旁的 `<name>.changes.jsonl`，由 `hooks/resume.js` 附進 gate 的回答。

## 為什麼

使用者要在看圖的地方直接改，並讓改動自動進回答。10-20 不嵌的理由是 agent 寫的文字要自己跳脫；`toSVG` 的每段文字與屬性都已跳脫，圖示只來自 fankeel 自帶的表，所以嵌入的風險只剩這一個頁面。gate 時 agent 在等回答，不會同時寫檔。

## 放棄了什麼

- 搬 Chartroom 的 React 編輯器：要 build 與 React，違反沒有 build、沒有 dependency。
- 頁面自己把改動附進回答：從 Claude Desktop 回答時不會經過頁面；改由 PostToolUse 的 hook 附，兩條路都會經過。
