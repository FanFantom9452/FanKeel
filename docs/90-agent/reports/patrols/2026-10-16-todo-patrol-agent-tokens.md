---
status: decision
last_verified: 2026-10-16
---

# TODO 全表盤點（10-16 晚）：做了什麼、沒做什麼

一句話：拿掉沒人畫的 `turn.running`，Pane 的子代理樹把還在跑的排前面、每列加上 token，tasks 超過十個畫成一條長條，Pane 拿掉和 band 重複的 context 區塊；結案「拿掉沒人畫的 turn.running」與「確認 0.111.4 mod 載入」兩條。

計畫在 [2026-10-16-todo-patrol-agent-tokens.md](../../../99-archive/2026-10-16-todo-patrol-agent-tokens.md)。

## 起因

使用者在開任務時選了 TODO 全表盤點。survey 時使用者說 Desktop 已經看到 0.111.4 的 band 與 Pane，那條可以結案，又加了兩件 Pane 子代理樹的改動：時間之外顯示 token，還沒跑完的排前面。verify 時使用者再加 tasks 超過十個改畫長條；build 時再加 Pane 拿掉 context 區塊，因為 band 已經顯示了。

## 做了什麼

- 刪掉 `hooks/turn.ts`，`hooks/pane.ts` 與 `hooks/compact.ts` 不再讀寫 `turn.running`。
- 子代理樹的排序看整棵：一個已結束的節點底下還有在跑的，就和跑著的排在一起。
- 每個子代理那一列在分鐘後面接 token，例如 ` · 79.4k`。口徑是 input、cache 寫入與 output 相加，不含 cache 讀取；使用者在 plan 站改選這個口徑，因為只算 input 與 output 時一個實際用了 79k 的 agent 只顯示 892。讀不到 transcript 時那一段不畫。
- Desktop 的 tasks 九個以內一列 30px 格子，十個一列 24px，十一個起畫成四段長條。
- Pane 拿掉 context 區塊（終端與 Desktop 都是），band 的 ctx 長條與 ⚠ 不動。

build 有三輪修正：一條測試分不出遞迴與只看一層的排序；讀 transcript 失敗會讓整棵樹不見；Task 5 留了一個沒人讀的 `context` 輸入與四句過時註解。三輪都各自審過。verify 兩輪的對抗審查第一輪推翻四列「沒實際跑過」的證據，當場補跑紅綠；第二輪沒有推翻。整套 4427 個測試通過。

## 沒做什麼

- Ready 的另外五條（brief-3、compact-4、pane-1、pane-7、stage-agents-5）都要真機或互動式 session，沒有動。
- 使用者這次另提的兩件事記成 TODO：Pane 底部一個跳到 station TODO 清單的按鈕（pane-10），route 與 tasks 可收合（pane-11）。
- Desktop 上的 token 數字與長條還沒在真機看過。
