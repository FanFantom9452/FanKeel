---
status: decision
last_verified: 2026-10-24
---

# TODO 全表盤點（10-23）：做了什麼、沒做什麼

一句話：任務進行中，下一步框不能再拿來問決定；通知面板的已讀通知會變灰並保留，Editing 列可以刪；taken 的 tune 請求 24 小時後自動過期，也能用 `tune.js drop` 收掉；改過的區塊只在原本那頁發光；進行中頁的「可能已停止」有快速入口，停掉的列各有清除鈕；gate 頁的選項預設全部展開；`survey.js --affected` 會列出誰引用某個檔。

計畫在 [2026-10-23-todo-patrol.md](../../99-archive/2026-10-23-todo-patrol.md)，遠端方案的研究在 [2026-10-23-station-remote-options.md](2026-10-23-station-remote-options.md)。

## 做了什麼

- 任務進行中，`hooks/wrap-up.js` 會直接拒絕帶 ask 或 actions 的下一步框，決定一律走 AskUserQuestion；hook 數改成十六，hooks 頁也補了這一列（49420823、d1764cc9、e35596ed、9ba01ca5）。
- 通知面板：打開就算已讀，已讀的變灰並留在列表裡，鈴鐺只數未讀；Editing 列有 ×，只從面板隱藏，不動佇列（845782ca）。
- taken 的 tune 請求 24 小時後過期，`tune.js drop <id>` 可以手動收掉；監控站不再把它們列成編輯中（364cb730、e336df65）。
- 改過的區塊只在發出請求的那頁發光（8325cd00）。
- 進行中頁的「可能已停止」膠囊點了會跳到列表，已服務的 live 頁上停掉的列各有清除鈕（c71b81b9、268ef831、377a5202）。
- gate 頁每個選項的說明預設都展開（3aff69f5）。
- `requireGraph` 讀得到 `import()`；`survey.js --affected <file>` 列出誰引用了這個檔；map.md 多了閱讀順序與循環引用兩段（466c87db、a9f302c0、f2ea374c、5b05ab8b、ed4fff5a）。
- 兩次 verify 都退回同一類問題：請求 id 在每個專案都從 r-0001 開始，所以兩個專案的通知會互相清掉。已隱藏的 Editing 列和已完成、被拒絕的通知，現在都改用「專案＋id」當鍵（b066b952、d42b13f8、788bac5b、d61699f8）。

## 沒做什麼

- 文件頁、設定頁、骨架依版型分家、station 拆模組四條沒排進這次計畫：一起排的話 `assets/station/station.js` 會有六個任務同時要改。草稿留在任務目錄的 plan-E.keep、plan-F.keep，之後另立計畫。
- 遠端方案只做了研究，推薦 Cloudflare Tunnel + Access 與 NetBird，還沒選定，也還沒動工。
- 「gate 頁重畫，摺疊點不開」還要使用者在瀏覽器點過才能結案；「tune 抓不到點了才出現的元素」留到下一輪。
- 這次沒有人在瀏覽器實際開過 #/live；版面只靠讀程式碼和測試確認。
