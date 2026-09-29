---
status: current
last_verified: 2026-09-29
source_of_truth: https://code.claude.com/docs/en/advisor 、https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool 、https://code.claude.com/docs/en/settings-reference#advisormodel
---

## 問題

Claude 的 advisor 能不能拿來做 `/fankeel-ask` 現在做的事：一題具體的問題，交給比 session 強的模型（`fable`）判一次，答案原文存檔。

## 怎麼查

09-29 派一個 `claude-code-guide` 讀者（sonnet）讀上面三頁官方文件，逐條附來源。沒有實跑，沒有另外逐頁核對；release notes 與 Claude Code changelog 沒讀。

## 查到的

| 項目 | 文件說的 |
|---|---|
| 名稱與位置 | API：server tool `advisor_20260301`（`name: "advisor"`），beta header `advisor-tool-2026-03-01`。Claude Code：`/advisor [model\|off]`、設定 `advisorModel`、flag `--advisor`、關掉用 `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` |
| 誰決定叫 | executor 模型自己決定。Claude Code 沒有設定能強制或限制次數；API 有每個 request 的 `max_uses` |
| 傳什麼 | executor 發出的 `server_tool_use` input 是**空的**；server 把整段 transcript（system prompt、工具定義、所有 turn 與 tool result）交給 advisor。**不能指定問題** |
| 拿回什麼 | `advisor_tool_result`，只有建議文字（約 400–700 token，thinking 不回）。Opus 5 以後的模型回 `advisor_redacted_result`，client 讀不到內容 |
| advisor 能不能用工具 | 不能 |
| 模型搭配 | advisor 至少跟 executor 一樣強。Sonnet 5.5 可配 Fable；Fable 5.1 只能配 Fable 5.1；Haiku 4.5 能叫但不能當 advisor。配錯：API 回 400，Claude Code 拒絕或不帶 advisor 重試 |
| 參數 | `model`（必填）、`max_uses`、`max_tokens`（含 thinking，最少 1024）、`caching`（ephemeral，5m／1h，預設關，叫 3 次以上才划算） |
| 計費 | 照 advisor 模型費率，記在 `usage.iterations[]` 的 `type: "advisor_message"`；頂層 usage 只算 executor。訂閱方案算進額度；某些方案 Fable 當 advisor 扣 usage credits，要先 `/model fable` 同意 |
| 限制 | beta；advisor 那段不串流（executor 串流會停住，約 30 秒一個 ping）；可能回 `pause_turn` 要重送。只在 Claude API 與 AWS 上的 Claude Platform；Bedrock、Vertex、Foundry 沒有 |
| subagent | 沿用 session 設定的 advisor，以 subagent 自己的模型檢查搭配 |
| plugin／hook | 文件沒寫能呼叫，也沒寫能傳問題。plugin 能做的只有設 `advisorModel`／`--advisor`，或在 prompt 裡叫模型去諮詢 |

## 結論

advisor **取代不了** `/fankeel-ask`：判官要的是一題具體的問題、一份 brief、固定格式的答案原文存進 `docs/90-agent/judgements/`；advisor 不能指定問題、回的是泛用建議、新模型的內容 client 還讀不到，所以無法存檔。

兩者是並存關係：advisor 是 session 背景裡的第二意見，模型自己決定何時叫；`/fankeel-ask` 是需要明確裁決時由人觸發。要不要替 fankeel 的角色（主 session、`fankeel-brain`、implementer）設 `advisorModel`，是 [model-choice.md](../reference/model-choice.md) 的 d 項，還沒決定。

## 附記：09-29 實跑一次

使用者要求實跑後才信這份報告，所以在原頁補這一節；上面各節沒改。

跑法：Claude Code 2.1.284，repo 在 `4cc249ad`，`claude -p --model sonnet --advisor fable --setting-sources "" --output-format stream-json --verbose`，prompt 叫模型先諮詢 advisor 一次再用一句話回答一題小問題。輸出留在本機 `.fankeel/build/task-20260929T051938/advisor-probe/run.jsonl`（gitignored，沒進 repo）。

| 項目 | 實跑看到的 | 對上面的表 |
|---|---|---|
| executor／advisor | `claude-sonnet-5-5` 叫 `claude-fable-5-1`，一次 | 符合「Sonnet 5.5 可配 Fable」 |
| 叫的時候傳什麼 | `server_tool_use` 名稱 `advisor`，input `{}` | 符合「input 是空的、不能指定問題」 |
| 拿回什麼 | `advisor_redacted_result`，只有 `encrypted_content` | 符合「新模型的建議 client 讀不到」 |
| advisor 讀了多少 | `advisor_message` 那筆 input 31,810 token、output 1,011；executor 自己第一輪才 26 output | 符合「整段 transcript 交給 advisor」：一題小問題也是整段送 |
| 花費 | 共 $0.438，advisor（Fable）$0.369，占 84% | 計費照 advisor 模型費率，記在 `usage.iterations[]` |

沒測到的：互動 session 的 `/advisor` 指令、subagent 是否沿用、沒被叫時 executor 會不會自己去叫。結論不變——答案存不了檔，取代不了 `/fankeel-ask`；而且一次諮詢的錢大半花在 advisor 重讀整段 transcript，d 項決定要不要設 `advisorModel` 時該算進去。
