---
status: decision
last_verified: 2026-10-19
---

# 不讓常備答案代答 gate（10-19）

一句話：使用者宣告離開時，gate 仍然要問人；fankeel 不加「由 profile 常備答案代答階段 gate」的鍵。

這是 [gate-13](../90-agent/todo/gate-13.md) 的結論。來源是判官對 cursor/plugins 的 pstack 與 fankeel 的比較（[judgements/2026-10-18-cursor-plugins-pstack.md](../90-agent/judgements/2026-10-18-cursor-plugins-pstack.md)，比較表 #1、#21，判官評為 C 拒）。

## 決定

- 不加常備答案的 profile 鍵；每一站結束仍以 AskUserQuestion 問人。
- 現有的 `gate.away` 不變：context 很大時多問一題「離開」，答要離開就在這輪結束時壓縮，不替人回答。
- gate-13 以 abandoned 關閉。

## 為什麼

`hooks/gate.js` 的去重（同一題被重問時沿用第一次的時間）、stage agent 交回的 gate 必須逐字複製的檢查，以及答完後的 resume 流程，全都假設 gate 一定被問。常備答案會讓這三件事各自要多一條「沒問」的分支，而 gate 是使用者唯一核准一站成果的地方：代答等於讓下一站建立在沒人看過的報告上。

## 放棄了什麼

- 常備答案代答指定階段：能真正無人值守，但要改 `hooks/gate.js` 與它的測試，並失去 gate 作為核准點的意義。
- 只批次或延後提問：改動較小，但不能真正無人值守，等於現有 `gate.away` 的變形。

## 還沒驗的

- 過夜長跑的實際需求有多常出現；若之後有具體案例，再開新條目重議。
