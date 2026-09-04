---
status: current
last_verified: 2026-09-04
source_of_truth: 本頁是兩個 session 的記錄，不隨程式碼更新；規則以 skills/fankeel/SKILL.md 的 Subagents 段為準
---

# 一次 dispatch 換一次喚醒 — 2026-09-04 的記錄

有人觀察到「前面都是 background agent，上下文疊得特別快；如果是 subagent 就一次做完
一次傳」，要求量它。這一頁是量出來的東西，而**第一個發現是那個對比在這個 harness 裡
不存在**。

## `Agent` 工具沒有前景/背景之分

session `f1816f3e-12b5-4291-a42c-a72483b1bc15` 裡 31 次 `Agent` 呼叫，input 的 key
只有四個——`description`、`model`、`subagent_type`、`prompt`——**沒有任何一個帶
background 旗標**，而 31 次的 tool_result 全都是 `Async agent launched successfully`。
所以沒有一個「前景 subagent」的對照組可以擺在旁邊比：這個工具只有一種模式。

那 31 次的組成是 30 個 `general-purpose` 加 1 個 `claude-code-guide`，全部 `sonnet`。

要問的問題因此換成別的：**喚醒次數跟著什麼長。**

## 喚醒跟著 dispatch 數長，不跟著 agent 數長

| | agent 數 | 喚醒次數 |
|---|---|---|
| `Agent`，四個 reader 同一個 response 送出 | 4 | **4** |
| `Workflow`，五個 implementer 一支 script | 5 | **1** |
| `Workflow`，八個 reviewer 一支 script | 8 | **1** |

上表是 session `b7045836-2bf5-4603-b956-ecd1fb50f7cf` 自己的三次 fan-out。四個
`Agent` reader 是**在同一個 response 裡送出的**，所以它們確實同時跑——但每一個回來
時都各自喚醒 parent 一次。平行不會減少喚醒；收進一支 workflow 才會。

`f1816f3e` 那邊也有一次同樣形狀的觀察：它三支 `Workflow` 其中一支的 `agentCount`
是 **10**，同樣只換一次喚醒。一次執行，沒有對照組。

同一個 session 的用量，供對照，但**不是成本比較**（見最後一節）：

```
四個 Agent reader      410,481 subagent tokens   145 tool uses
五個 implementer       369,392 subagent tokens   107 tool uses   299,800 ms
八個 reviewer          620,150 subagent tokens   176 tool uses   326,239 ms
```

`f1816f3e` 那一邊的比例沒有這麼乾淨：34 次 dispatch（31 `Agent` + 3 `Workflow`）對
27 次喚醒，其中 7 次 dispatch 沒有在自己的 id 底下收到對應的通知——兩次後來是用
`SendMessage` 續跑的，一次 `Workflow` 的通知落成 attachment 而不是 user turn，其餘
到 session 結束都沒有解釋。

## 喚醒不是把上下文疊起來的原因

`f1816f3e` 跑了十小時，1724 行、475 則 assistant、255 則 user。有效上下文的峰值是
**658,718 tokens**，十二個等距取樣：

```
73,010   130,489   176,073   267,592   340,044   375,614
418,405  457,377   511,443   562,490   604,292   658,718
```

累計 output 1,434,490 tokens，累計 cache read 176,563,502 tokens。

但 **27 次喚醒對 475 則 assistant 回合是 5.7%**。喚醒本身不是把上下文推到 659k 的
東西——落進來的**回傳內容**才是，而它會在此後每一回合被重讀。`skills/fankeel/SKILL.md`
的 *Dispatch by default* 早就寫了這句：the return value is the expensive part。這次
量到的東西支持那句話，沒有替它加上任何新東西。

subagent 自己的字則完全不進來：parent 的 transcript 裡 `isSidechain: true` 是 **0**
行（1201 行是 `false`），它們的 19,076,379 bytes 全部留在 `subagents/` 底下——遞迴
數是 125 個檔案。頂層是 63 個項目（31 個 transcript、31 個 meta、1 個 `workflows/`
目錄），佔其中的 10,988,455 bytes；把頂層的項目數配上遞迴的位元組數是兩個不同的
分母，這一頁原本就是那樣寫的。

## 這一頁不說的

- **沒有對照組。** 沒有把同一件工作分別以 `Agent` 和 `Workflow` 跑過一次擺在旁邊。
  上面那張表的三列做的是三件不同的事——四個 reader 在找東西，五個 implementer 在
  改檔，八個 reviewer 在讀 diff——所以每個 agent 的 token 數之間不能互相比。**能比
  的只有喚醒次數**，因為那是結構決定的，不是工作量決定的。
- 兩個 session、一台機器、一天。`f1816f3e` 的 27:34 比例有三個缺口是有解釋的（見
  上一節），其餘沒有。
- 上面每一個 token 數都是 harness 自己回報的 `subagent_tokens` 與 `usage`，沒有第二
  個來源可以交叉核對。
- 這裡完全沒有量「一支 workflow 比四個 dispatch 便宜或貴」。`docs/reports/2026-09-03-dispatch-vs-inline.md`
  那三對量的是 dispatch 對 in-session，不是 `Agent` 對 `Workflow`；那個比較還沒有人做。

[回到索引](README.md) · [回到首頁](../../README.md)
