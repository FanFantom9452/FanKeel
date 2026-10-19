---
label: land
title: 回顧與規則強制表
description: land 收尾可選派 reviewer 讀 transcript 提案改 skill（沿用 slimmer 的提案 diff＋核准）；另寫一頁規則↔強制機制對照表
state: ready
link: skills/fankeel-land/SKILL.md
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #14、#15，判官評為 B／A、前五名第三）。pstack 的 reflect 用三個 reviewer 讀本 session 的 transcript，synthesizer 產 Accepted／Rejected／Backlog，路由到既有 skill 的具體編輯，必須等使用者核准才套用；correct 依架構→型別與 lint→測試→文件的順序讓重複錯誤不可能再犯，並在指令檔維護一張「規則↔強制機制」表。fankeel 的 leave.js 只記花費，沒有回顧；hook 確實強制許多規則，但沒有一張表說哪條規則由哪個 hook 或腳本強制。

要變成：land 的「搬到耐久處」步驟加一個可選的回顧 reviewer，以 fankeel-slimmer 的提案 diff 形式交給使用者核准；docs/90-agent/reference/ 加一頁規則對照表。transcript 讀取有成本與隱私面，只在使用者明說時跑。

完成的樣子：land 能在使用者同意下產出一份待核准的 skill 修改提案；對照表列出每條注入規則與其強制者，docs-check 通過。
