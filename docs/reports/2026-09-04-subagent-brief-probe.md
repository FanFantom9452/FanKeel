---
status: current
last_verified: 2026-09-04
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 hooks/brief.js 與 lib/render.js 為準
---

# subagent 實際收到什麼 — 2026-09-04 的量測

`TODO.md` 的 `## Waiting` 有三條停在「還沒實測」，從 09-01 起沒動過：per-`agent_type`
的 brief、output style 到不到得了 subagent、per-style 的 turn-reminder。它們停在那裡
是對的 —— 在這一天之前，這個 repo 沒有任何東西碰過**執行期的送達**。
`tests/brief.test.js` 驗的是 hook 行程的 stdout JSON 形狀（`contextOf()`，:51-55），
不是另一端收不收得到。

這一頁是那次量測。**它記錄 2026-09-04 當天的行為，之後不再更新。**

## 問題

一個 subagent 啟動時，`hooks/brief.js` 送出去的東西，有沒有真的進到它的 context？
如果有，裡面有什麼、沒有什麼？

## 方法

三個格子，每格問同一件事，但**提示裡一個字面針都不寫** —— 問的是「有沒有任何不是我
給的區塊被放進你的 context，有的話逐字全文重現」。針寫進提示裡，回答就會在提示裡找到
它，然後每一格都回報 PRESENT，包括什麼都沒送到的那些。

| 格 | 路徑 | 跑幾次 | 結果 |
|---|---|---|---|
| A | `Agent` tool，自訂型別 `brief-probe`（`tools: []`） | 0 | **跑不起來** |
| B | `Agent` tool，型別 `Explore` | 1 | 送達 |
| C | `Workflow` 的 `agent()`，預設型別 | 2 | 送達，兩跑一致 |

**控制是 harness 自己回報的 `tool_uses` 計數，不是任何人的宣告。** B 格回報
`tool_uses: 0` —— 它一個工具都沒呼叫過，所以它引出來的字串不可能是讀 `lib/render.js`
重建的。這個控制是觀察到的而不是宣告的，而且每次 dispatch 都免費附贈；A 格原本想用
宣告零工具達成同一件事，那條路更弱也更脆，見下。

## 收到的東西，逐字

B 格與 C 格拿到的 brief 本文**一字不差**，只有最後一行的標籤不同：

```
SubagentStart hook additional context: FANKEEL — you are a subagent of: probe what a
subagent actually receives: brief, agent_type, output style, turn-reminder @ build
touched: TODO.md, .claude/agents/brief-probe.md

  - Your final message is the return value. It is the only thing that reaches the
    parent, and it stays in that context for the rest of the session — findings and
    conclusions, not a narration of what you read.
  - Say plainly what you could not check. A gap the parent cannot see becomes a
    confident wrong answer there.
  - You do not dispatch subagents of your own — not a helper, and above all not a
    reviewer. Every review seat this work gets is dispatched by the session that
    dispatched you.
  - The project map is at .fankeel/map.md if it has been generated. Read it rather
    than asking what the project is: an answer pasted back stays in the parent
    context for the rest of the session.

(agent type: Explore)              <- B 格
(agent type: workflow-subagent)    <- C 格，兩跑都是
```

`touched:` 那行是活的：`.claude/agents/brief-probe.md` 是量測前十分鐘才建的檔，這條
只存在於 registry 的 JSON 裡，而 B 格零工具呼叫。

## 這一次定下來的

| | |
|---|---|
| brief 在執行期送達 | 是。前綴 `SubagentStart hook additional context:`，`Agent` tool 與 `Workflow` 兩條路都送 |
| `agent_type` 送不送 | 送，而且值是真的型別。`lib/render.js:353` 的行為在執行期成立 |
| **`workflow-subagent`** | **`Workflow` 的 agent 拿到的 `agent_type` 是這個字串。** 這個值在本 repo 的文件與測試裡都不存在；`tests/brief.test.js:48,98` 只跑過 `general-purpose` 與 `Explore` |
| stage 規則送不送 | 不送。四條就是 `RETURN_RULES` 加 map 那行，與 `docs/decisions/fankeel-shell.md:225-226` 相符 |
| output style 送不送 | 送出去的東西裡沒有任何 style 文字。**但這不是完整答案** —— 見下 |
| turn-reminder | brief 裡沒有 |

`docs/decisions/fankeel-shell.md:224`，**在 `ffd95c6` 也就是這次量測之前的狀態**，寫著
brief「carries the task, the scope, what the return value costs, and **the voice
digest if one is set**」。先前只證明了 `hooks/brief.js` 與 `lib/render.js` 裡 grep 不到
任何 style 參照；這次證明**送出去的東西裡也沒有**。

那一句已經在 `feabd15` 被刪除，所以上面的行號指的是刪除之前 —— 現在去讀 :224 看到的是
改過的版本。引用一個活的行號來當作刪除它的理由，會在下一次有人照著查的時候變成一個
自相矛盾的引文；這裡釘的是 sha。

## 這一次沒有定下來的

- **output style 那條仍然是半個答案。** 量測時 `C:/Users/Owner/.claude/settings.json`
  沒有 `outputStyle` 鍵，三個 style 一個都沒啟用。所以「brief 裡沒有 style 文字」是在
  「沒有 style 可送」的條件下量到的。要分開「不送」與「沒東西可送」，得先啟用一個再重跑。
  `TODO.md` 那條原本就寫著這個前提，它到今天仍然成立。
- **`tools: []` 這條路沒走通，而且它本來就走不通。** A 格回的是
  `Agent type 'brief-probe' not found` —— agent registry 只在行程啟動時讀，寫進
  `.claude/agents/` 的定義在已經在跑的行程裡不是活的（與 hook 清單同樣的性質）。
  但就算重啟也不會成功：Claude Code 的 sub-agents 文件說，當 `tools` 清單解析不到任何
  工具時，它會拒絕啟動該 subagent 並回傳錯誤。所以宣告零工具是死路，而
  `tool_uses: 0` 那個觀察到的控制才是對的做法。
- **C 格的 `agent_type` 是預設值。** `Workflow` 的 `agent()` 有 `agentType` 參數，但它從
  同一個 registry 解析，所以自訂型別在這個行程裡同樣不可用。`workflow-subagent` 是沒有
  指定型別時的值，不是唯一可能的值。
- **B 格只跑了一次。** C 格跑了兩次而且一致；B 格沒有自己的重複。

## 順帶量到的

`Workflow` 的 agent 收到的注入總量是 40,126 與 40,631 字元（兩跑），其中包含
`# claudeMd` 區塊 —— 使用者的 memory 索引。fankeel 的 brief 只是其中一小段。這一項不是
本次的問題，記在這裡是因為它影響「dispatch 買到的是父 context 的殘留」這個論證的分母。

## 出處

- 提交：`ffd95c6`（量測前的 HEAD）、`a77b5e2`、`eaef4c3`（探針 fixture 與它的修正）
- `hooks/brief.js`、`lib/render.js:335-356`（`renderBrief`）
- `.claude-plugin/plugin.json:61-72`：`SubagentStart` 沒有 matcher，所以對每一種
  subagent 開火 —— 這次的三個格子是那句話第一次有證據
