---
status: current
last_verified: 2026-09-07
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 hooks/brief.js 與 lib/render.js 為準
---

# brief-probe 第一次跑出讀數 — 2026-09-07

`.claude/agents/brief-probe.md` 在 2026-09-04 建好，當天沒跑成：agent registry 只在
行程啟動時讀，那個 process 早於檔案，所以拿到的是
`Agent type 'brief-probe' not found`，死在比量測更前面的一步。
[2026-09-04 的報告](2026-09-04-subagent-brief-probe.md) 把這件事寫清楚了，並且留下一句
「修好的 fixture 從來沒有被跑過」。`TODO.md ## Ready` 底下也留了一條，等的是一個新的
終端機。

這一次的 process 載得到它。以下是它回的四行。

## 讀數

```
TOOLS: NONE
NEEDLE: PRESENT TODO.md ## Ready — 14 entries @ build
RULES: PRESENT if it has been generated.
TYPE: PRESENT brief-probe)
```

**這一輪是有效的。** fixture 自己的規則是「工具呼叫數非零就整輪作廢」，而 harness 回報的
`tool_uses` 是 **0**。

## 三個 needle 都送到了，而且帶著只有當下才有的續行

三題問的都不是那個字串本身，而是**它後面接什麼**。續行寫的是今天正在進行的工作，
fixture 的指令裡沒有，所以能寫出來就只能是真的收到了。

| 問的字串 | 續行 | 這證明了什麼 |
|---|---|---|
| `FANKEEL — you are a subagent of:` | `TODO.md ## Ready — 14 entries @ build` | subagent 收到了母 session 的**當前任務與階段**。那行字是這個 session 今天早上才寫進 registry 的 |
| `The project map is at .fankeel/map.md` | `if it has been generated.` | 地圖那條規則整句都在 |
| `(agent type:` | `brief-probe)` | agent 型別會被寫進 brief |

第三格順帶關掉了 `## Waiting` 底下那條 per-`agent_type` brief 的疑問的一半：型別**確實**
被寫進去了。它沒有回答的是兩個不同型別拿到的 brief 內容會不會不同 —— 09-04 比對過兩個
型別，位元組完全相同，那條仍然在等。

## `TOOLS: NONE` 跟 harness 講的不一樣

這一格值得單獨記，因為它是唯一一個對不上的。

這個 session 啟動時，harness 自己列出的 agent 清單寫的是
`brief-probe: ...（Tools: All tools）`。fixture 的 frontmatter 也**故意**沒有 `tools:`
這個鍵 —— 09-04 的教訓是 `tools: []` 會讓 subagent 根本啟動不了。所以按照設定，它應該
有全部工具。

它回的是 `NONE`。

fixture 那一題寫得很明白：「Answer from what you can call, not from what you expect to
have.」兩種解釋都還開著：

- 它**真的**沒拿到工具，那 harness 那份清單描述的是設定而不是實際交付的東西；
- 或者它是照預期答的，而不是照實際能呼叫的答的 —— 也就是這一格量到的是它的自我描述，
  不是它的能力。

`tool_uses: 0` 兩種都相容，所以這一輪的數據**分不開**這兩者。要分開需要另一個問法：
給它一個非做不可的工具呼叫，看它做不做得到。那是另一次量測，不是這一次。

在那之前，這一格不應該被當成「subagent 沒有工具」的證據引用。
