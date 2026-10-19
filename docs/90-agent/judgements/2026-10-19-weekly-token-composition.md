---
judged: 2026-10-19T11:24:34.811Z
model: fable
agent: fankeel-judge
task: "本週 token 花費成分分析（/fankeel-ask）"
session: 26b7d5f3-ebf8-41a8-b513-cd502c1be9f1
stage: survey
---

# Brief 16 — 這週的 token 花費成分：什麼在吃額度，由多到少

## Question

# Brief 16 — 這週的 token 花費成分：什麼在吃額度，由多到少

## 問題（使用者原話）

幫我分析一下這周的 TOKEN 花費成分分析 給我百分比 最多到最少 是甚麼再吃額度?

## 範圍

「這週」= 最近 7 天，2026-10-13 00:00 ~ 2026-10-19 23:59（UTC+8）。今天 2026-10-19 是週一，所以若只算自然週只有一天；用 7 天滾動區間，並在答案裡寫明這個選擇。涵蓋這台機器所有 Claude Code session（不只 fankeel 專案），含 subagent。

## 要拆的維度（每一維都給 USD 金額與百分比，由多到少排序）

1. **按 token 類別**：cache read、cache write（能拆 5m / 1h 就拆）、output、uncached input。
2. **按模型**：fable / opus / sonnet / haiku 等。
3. **按主對話 vs subagent**：主 session 自身 vs 各 subagent 類型（fankeel-reader、fankeel-brain、fankeel-judge、implementer、reviewer、Explore、general-purpose…，以 subagent jsonl 可辨識的 agent 類型為準）。
4. **按專案目錄**（`~/.claude/projects/` 底下的目錄名）。
5. **前 10 名最貴 session**：session id 前 8 碼、專案、首則使用者訊息摘要（一行）、USD、佔比。

最後一段：**「什麼在吃額度」的一句結論**——把上面數字串成因果（例如「Opus 主對話在大 context 下的 cache read 佔 X%」），並指出最大的單一可壓縮項。不需要提出修改方案的實作，只需點名。

## 要讀的路徑

- 對話紀錄：`C:\Users\user\.claude\projects\*\*.jsonl` 與 `<project>\<session>\subagents\agent-*.jsonl`。只取 assistant 行 timestamp 落在上述區間的。`message.usage` 有 input_tokens、output_tokens、cache_read_input_tokens、cache_creation_input_tokens（可能有 cache_creation.ephemeral_5m_input_tokens / ephemeral_1h_input_tokens），`message.model` 是模型。注意同一 message id 可能多行重複（串流），要去重。
- 定價：`F:/ymlab/fankeel/lib/spend.js`（以它的價目為準，不要憑記憶）。
- 現成工具（在 F:/ymlab/fankeel 跑）：
  - `node scripts/usage-compare.js --before 2026-10-06..2026-10-12 --after 2026-10-13..2026-10-19`：兩段區間比較，可順便給上週對照。
  - `node scripts/spend.js`：每個 registry session 的花費組成（輸出很長，用 grep/awk 過濾，不要整份讀）。
  - `lib/compare.js`：usage-compare 的計算。
- 背景參考：`docs/90-agent/judgements/` 內 10-16~10-18 主 session 花費的判斷（若已歸檔），`profile` 的 `quota.week`（未設）。

現成工具若無法按上述維度拆，reader 可寫一次性 node 腳本放 `.fankeel/build/ask/` 底下跑（唯讀讀紀錄，不改任何專案檔）。

## 什麼算答案

每一維都有具體 USD 與百分比、加總對得上總額（誤差 < 1%）、寫明去重方式與區間。總額要和 `usage-compare.js` 的 after 區間對照，差距要解釋。

## 回傳形狀

六個欄位照 judge 的固定格式；`## Summary` 內放上述五張表（Markdown 表格，由多到少）與一句結論；最後附上週對照（若取得）。

## Answer

pick: 本週（10/13–10/19 七天滾動，UTC+8）總計 USD 2,520.89；吃額度的是 Opus 5.5 主對話（67.7%），其中「1h cache write $732.51（29.1%）」＋「cache read $710.09（28.2%）」合計 57%，起因是主對話平均 context 190–240K、峰值 414–420K 且每回合寫入走 1h 快取價；最大單一可壓縮項＝主對話 1h cache write，最大可整塊不花的項＝ilsbench 探針 $343.85（13.6%）。
why: 按類別 cache read 41.1% / cache write 1h 29.1% / cache write 5m 15.6% / output 14.3% / input 0.0%；按模型 opus 86.9% / sonnet 10.4% / fable 2.6%；主對話 67.7% vs agents 32.3%（implementer 9.9%、reviewer 6.5%、general-purpose 5.0%、reader 3.4%、judge 2.5%…）；按專案 SBIR 50.3% / fankeel 35.4% / ilsbench 暫存目錄 13.6%。
五維加總皆 = 2,520.89（T4 因 4,128 列四捨五入差 $0.71，<0.03%）。總額與 usage-compare 同一方法：reader 早先跑得 $2,493.72，我算完後重跑得 $2,522.25，差額全是仍在跑的 session 期間繼續花費，同一瞬間一致。
前 10 名 session 佔 44.6%，9 個峰值 context 414–420K；這些 session 的「首則使用者訊息」多半是跨 session agent 回報轉送，正是主對話前綴被持續寫大的來源。
Reader A 被 hooks/guard.js 擋下（read-only agent 不得含 `>`），改由我用專案的 lib/compare.js + lib/usage.js + lib/prices.js 經 `node -` stdin 計算，未建任何檔。
would flip if: 若 ilsbench 4,128 個 session 其實有 subagent 或非 main（我依每目錄 1 session、$0.54 推定為 `claude -p` 主對話），main/agent 的 13.6% 會移位；或若改以 assistant 逐則時間戳過濾（而非 session 起始），最多 4 個跨週 session 的本週部分會加入（幅度未量化）。
unread: nothing（對話 jsonl 由腳本讀取、無人整檔開啟；`scripts/spend.js` 全表只看了前 10 列，因它無日期欄、無法按週切）
delegated: Reader A opus — F:/ymlab/fankeel/lib/spend.js、F:/ymlab/fankeel/lib/prices.js、F:/ymlab/fankeel/lib/usage.js:88-93、C:/Users/user/.claude/projects 檔案佈局（其 node 腳本被 guard 擋下，未產出數字）；Reader B sonnet — scripts/usage-compare.js（執行）、lib/compare.js、lib/usage.js、lib/prices.js、scripts/spend.js（執行）、lib/spend.js；Reader C sonnet — docs/90-agent/judgements/2026-10-18-main-session-cost.md、.fankeel/profile.json、.fankeel/map.md
checklist: 1 對話紀錄五維拆解 — answered（我自跑，見 Summary）；2 lib/spend.js 價目 — answered（價目實在 lib/prices.js:42-53，spend.js:13 引入，抽查相符）；3 usage-compare 兩區間 — answered（$777.39 / $2,493.72，重跑 $2,522.25）；4 lib/compare.js 計法 — answered（本地時間邊界、以 session 起始歸區間、requestId 去重，抽查 :22-23、:98、usage.js:112-124 相符）；5 scripts/spend.js — answered（registry 全期表、無日期欄，不能按週）；6 10-16~10-18 判斷書 — answered（抽查 :77-80 相符）；7 profile quota.week — answered（未設；profile.json 無 quota 鍵，僅 compact.at 350000 於 :19）

## Summary

### 區間、來源與計法

- **區間**：2026-10-13 00:00 ～ 2026-10-19 23:59（UTC+8；機器時區偏移 −480 分鐘已確認），即 UTC 2026-10-12T16:00Z ～ 10-19T16:00Z。今天 10-19 是週一，自然週只有一天，故採七天滾動。10-13 當天沒有任何 session 開始，實際有花費的是 10-14～10-19 六天。
- **歸屬規則**（與 `scripts/usage-compare.js` 完全相同，用同一套 lib）：一個 session 以其主 transcript 第一個時間戳落在區間內為準（`F:/ymlab/fankeel/lib/compare.js:22-23` 本地時間、結束日含；`:98` `s.start >= from && s.start < to`），整個 session 連同其 `subagents/agent-*.jsonl` 與 `subagents/workflows/*/agent-*.jsonl`（`F:/ymlab/fankeel/lib/usage.js:187-217`）全數計入。mtime 早於區間起點的 595 個檔直接跳過（`compare.js:54`）。與 brief 要的「assistant 逐則時間戳」相比，差別只在 10-12 以前開始、延續到本週的 session：4,310 個本週有改動的檔中 4,306 個起始在區間內，所以最多 4 個 session 的本週部分未計。
- **去重**：同一檔內以 `requestId` 為鍵、後行蓋前行（`usage.js:120-124`），無 requestId 的行各算一筆；主 transcript 內 `isSidechain` 行跳過、只由 agent 檔計（`usage.js:113`）；`<synthetic>` 無價目、0 tokens。
- **定價**：`F:/ymlab/fankeel/lib/prices.js:43-52`（verified 2026-10-08，USD/M tokens）：opus-5-5 in 4 / out 20 / cacheRead 0.2 / write5m 5 / write1h 8；sonnet-5-5 2 / 10 / 0.2 / 2.5 / 4；fable-5-1 10 / 50 / 0.25 / 12.5 / 20；haiku-5-5 0.1 / 0.5 / 0.01 / 0.125 / 0.2（context >100K 另一列）。`lib/spend.js` 本身沒有價目表，`spend.js:13` 引入 prices.js；5m/1h 分開計價（`usage.js:33-38`）。
- **agent 類型**：每個 `agent-*.jsonl` 旁的 `agent-*.meta.json` 的 `agentType`（去掉 `fankeel:` 前綴合併），本週 2,329 個 agent 檔全部解析成功，無 unknown。
- **樣本量**：4,306 個 session、主對話 20,651 個 request、agent 27,850 個 request；其中 4,128 個 session 是 `C--Users-user-AppData-Local-Temp-ilsbench-claude-*` 的 ilsbench 探針（每目錄一個 session、各約 $0.54）。

### 表一：按 token 類別（由多到少）

| 類別 | tokens | USD | 佔比 |
|---|---:|---:|---:|
| cache read | 5,179.1M | 1,034.98 | 41.1% |
| cache write（1h） | 93.0M | 732.80 | 29.1% |
| cache write（5m） | 100.9M | 393.06 | 15.6% |
| output | 18.4M | 359.65 | 14.3% |
| uncached input | 0.1M | 0.40 | 0.0% |
| **合計** | | **2,520.89** | 100% |

1h 寫入幾乎全在主對話（主 w1h $732.80、agents w1h $0）；5m 寫入全在 agents。

### 表二：按模型

| 模型 | USD | 佔比 | cache read | write 1h | write 5m | output | input |
|---|---:|---:|---:|---:|---:|---:|---:|
| claude-opus-5-5 | 2,190.47 | 86.9% | 921.59 | 732.51 | 207.29 | 328.81 | 0.27 |
| claude-sonnet-5-5 | 263.33 | 10.4% | 107.97 | 0 | 138.49 | 16.81 | 0.06 |
| claude-fable-5-1 | 66.65 | 2.6% | 5.32 | 0 | 47.26 | 14.00 | 0.07 |
| claude-haiku-5-5 | 0.44 | 0.0% | 0.10 | 0.29 | 0.03 | 0.02 | 0.00 |
| `<synthetic>` | 0.00 | 0.0% | — | — | — | — | — |

### 表三：主對話 vs 各 subagent 類型

| 種類 | USD | 佔比 | cache read | write 1h | write 5m | output |
|---|---:|---:|---:|---:|---:|---:|
| 主對話（main） | 1,705.82 | 67.7% | 710.18 | 732.80 | 0 | 262.67 |
| ・其中 ilsbench 探針（推定為 `claude -p` 主對話） | ≈343.85 | 13.6% | | | | |
| ・其中互動式主對話 | ≈1,361.97 | 54.0% | | | | |
| fankeel-implementer | 248.61 | 9.9% | 109.90 | 0 | 102.55 | 36.11 |
| fankeel-reviewer | 163.66 | 6.5% | 61.25 | 0 | 93.09 | 9.28 |
| general-purpose | 126.09 | 5.0% | 62.34 | 0 | 45.45 | 18.27 |
| fankeel-reader | 86.77 | 3.4% | 32.77 | 0 | 46.35 | 7.64 |
| fankeel-judge | 62.38 | 2.5% | 4.97 | 0 | 43.37 | 13.97 |
| fankeel-verifier | 51.40 | 2.0% | 20.67 | 0 | 24.66 | 6.06 |
| fankeel-brain | 29.17 | 1.2% | 15.59 | 0 | 13.12 | 0.45 |
| fankeel-mockup | 17.61 | 0.7% | 7.15 | 0 | 8.02 | 2.44 |
| Explore | 12.13 | 0.5% | 4.09 | 0 | 7.90 | 0.14 |
| fankeel-fixer | 7.37 | 0.3% | 0.95 | 0 | 4.58 | 1.84 |
| fankeel-implementer-high | 3.98 | 0.2% | 2.90 | 0 | 0.88 | 0.21 |
| fankeel-mutator | 2.19 | 0.1% | 0.70 | 0 | 1.25 | 0.24 |
| fankeel-reviewer-high | 2.19 | 0.1% | 1.19 | 0 | 0.97 | 0.04 |
| fankeel-render-reviewer | 0.86 | 0.0% | | | | |
| claude-code-guide / fankeel-slimmer / fankeel-writer / fankeel-init-scout | 0.66 | 0.0% | | | | |
| **agents 小計** | **815.07** | **32.3%** | | | | |

模型 × 主/agent 交叉：opus 主對話 $1,705.41（67.7%：cache read 710.09 ＝總額 28.2%、write 1h 732.51 ＝ 29.1%、output 262.65 ＝ 10.4%）；opus agents $485.05（19.2%）；sonnet agents $263.33（10.4%）；fable agents $66.65（2.6%，judge 用）；haiku 主 $0.40。judge 的 fable 成本結構是 write 5m 為主（$43.37 / $62.38），因為每個 judge 都是新 context。

### 表四：按專案目錄（`~/.claude/projects/` 目錄名）

| 專案目錄 | USD | 佔比 | sessions |
|---|---:|---:|---:|
| F--ymlab-SBIR-ProjectWorkspace | 1,268.39 | 50.3% | 22 |
| F--ymlab-fankeel | 891.78 | 35.4% | 75 |
| C--Users-user-AppData-Local-Temp-ilsbench-claude-*（4,128 個目錄） | 343.85 | 13.6% | 4,128 |
| F--ymlab-fankeel--claude-worktrees-nice-euler-d96cbb | 10.91 | 0.4% | 1 |
| F--ymlab-fankeel--claude-worktrees-quirky-haslett-21e2dc | 3.95 | 0.2% | 1 |
| C--Users-user-AppData-Local-Temp-fankeel-bench-*（75 個目錄） | 1.28 | 0.1% | 75 |
| C--Users-user-AppData-Local-Temp-opus-probe、…-Temp | 0.02 | 0.0% | 4 |
| **合計** | **2,520.18**（四捨五入差 0.71） | | 4,306 |

### 表五：前 10 名最貴 session

| # | session | 專案 | 首則使用者訊息（一行） | USD | 佔比 | 主/agents | 主回合 | 平均 ctx / 峰值 |
|---|---|---|---|---:|---:|---|---:|---|
| 1 | 90754278 | SBIR | 「解放 AGENT 數量限制 請多開一些 避免漏讀取」（10/15 16:54Z–10/16 11:24Z） | 242.65 | 9.6% | 93.33 / 149.32（264 個 agent） | 983 | 234K / 417K |
| 2 | 4b72ae2c | SBIR | 首則皆為跨 session agent 回報轉送，無使用者原文（10/15–10/16） | 202.74 | 8.0% | 104.46 / 98.29（129） | 1,120 | 240K / 418K |
| 3 | e3f3fd12 | SBIR | 「剛剛不是有個任務是 FABLE 判官分析的」（10/15–10/17） | 153.59 | 6.1% | 91.45 / 62.14（75） | 867 | 239K / 420K |
| 4 | 22d6980f | SBIR | 跨 session 回報轉送（10/17–10/18） | 123.57 | 4.9% | 79.69 / 43.88（87） | 936 | 216K / 417K |
| 5 | 53617a40 | SBIR | 跨 session 回報轉送（10/18–10/19） | 80.40 | 3.2% | 45.27 / 35.13（57） | 585 | 199K / 417K |
| 6 | a5b19999 | SBIR | 「# Workflow authoring reference…」（workflow 注入；10/14） | 79.23 | 3.1% | 38.08 / 41.15（168） | 447 | 235K / 414K |
| 7 | 9cf97941 | fankeel | 「開啟 STATION CLICK 有效 可以把 TODO 關閉這個任務」（10/16） | 69.65 | 2.8% | 45.05 / 24.60（78） | 559 | 241K / 417K |
| 8 | 1452cf01 | fankeel | 「注入的字可以請 FABLE 審核看看 看對於我們設計的工作留是否有影響」（10/18–10/19） | 68.59 | 2.7% | 40.45 / 28.14（117） | 579 | 191K / 317K |
| 9 | 336dd664 | SBIR | 跨 session 回報轉送（10/17–10/19） | 57.90 | 2.3% | 35.98 / 21.92（12） | 402 | 185K / 417K |
| 10 | f391d997 | SBIR | 跨 session 回報轉送（10/14–10/15） | 46.66 | 1.9% | 39.74 / 6.92（17） | 383 | 220K / 414K |

前 10 名合計 $1,124.98（44.6%）；超過 $10 的 session 共 48 個；中位數 $0.04（被 4,128 個探針拉低）。「平均 ctx」＝主對話 cache read tokens ÷ 主 request 數；「峰值」＝單一 request 的 input+cache read+cache write 最大值。10 個裡 9 個峰值 414–420K，與 profile `compact.at 350000` 的設定不符（這些多數是 SBIR 專案 session，是否套用同一 profile 未查）。

### 按日（session 起始日，UTC+8）

| 日 | USD | 佔比 | sessions |
|---|---:|---:|---:|
| 10-13 | 0 | 0% | 0 |
| 10-14 | 271.06 | 10.8% | 8 |
| 10-15 | 465.49 | 18.5% | 451 |
| 10-16 | 897.89 | 35.6% | 1,937 |
| 10-17 | 333.77 | 13.2% | 1,885 |
| 10-18 | 253.14 | 10.0% | 14 |
| 10-19 | 299.54 | 11.9% | 11 |

10-16、10-17 的 session 數是 ilsbench 探針的爆量；10-16 單日 $897.89 是本週高峰。

### 一句結論：什麼在吃額度

**Opus 5.5 主對話在 190–240K 平均 context（峰值 414–420K）下，每一回合重讀整段前綴（cache read $710.09，28.2%），而每回合新寫進前綴的內容又走 1h 快取價 $8/M（cache write 1h $732.51，29.1%）——這兩項合計 57.2%，再加上 opus agents 19.2%、sonnet agents 10.4%，就是本週 $2,520.89 的 97%。** 最大的單一可壓縮項是**主對話的 1h cache write $732.51（93.0M tokens）**：依 10-18 判斷書（`F:/ymlab/fankeel/docs/90-agent/judgements/2026-10-18-main-session-cost.md:81`）其內容七成是每回合新增（assistant 輸出與 thinking、工具結果、agent 回報、跨 session SendMessage 轉送——前 10 名 session 的「首則使用者訊息」幾乎全是 agent 回報轉送，可見其量），19% 是 1h TTL 過期後整段重寫。其次是 **ilsbench 探針 $343.85（13.6%，4,128 個 `claude -p` session）**，是純基準測試開銷、可整塊不花的最大項。

### 上週對照（`node scripts/usage-compare.js --before 2026-10-06..2026-10-12 --after 2026-10-13..2026-10-19`）

| | 10/06–10/12 | 10/13–10/19 |
|---|---:|---:|
| sessions | 588 | 4,306 |
| 總額 | $777.39 | $2,522.25（重跑時；reader 早先跑得 $2,493.72，我算得 $2,520.89） |
| 每 session | $1.32 | $0.59 |
| 中位數 | $0.01 | $0.04 |
| subagent 佔比 | 25% | 32% |
| opus / sonnet / fable | 58% / 17% / 25% | 87% / 10% / 3% |

本週是上週的 3.2 倍；opus 佔比由 58% 升到 87%、fable 由 25% 降到 3%。三個總額數字（2,493.72 → 2,520.89 → 2,522.25）差距只來自量測時仍在跑的 session 持續花費，方法與選取規則完全相同。

### 各 reader 所得與抽查

- Reader A（opus）：被 `F:/ymlab/fankeel/hooks/guard.js:81-85` 擋下（read-only agent 的指令含 `>` 即視為寫檔，`lib/guard.js:352-354` `writesFiles`），未算出任何數字；但給出價目位置（`lib/prices.js:43-52`、`rateFor` :58-69、haiku >100K 規則 `usage.js:88-93`）與檔案佈局（4,324 主檔、2,077 agent 檔、348 個 workflows 巢狀 agent 檔、`agent-*.meta.json` 帶 `agentType`）。抽查 `prices.js:42-69` 相符。
- Reader B（sonnet）：usage-compare 輸出 12 行（上表）；`compare.js:22-23` 本地時間邊界、`:98` 以 session 起始歸區、`usage.js:112-124` requestId 去重，抽查相符；`scripts/spend.js` 是 registry 全期表（`lib/spend.js:105-120`），無日期欄，不能切週，前 10 列全是全期累計（最貴 a6cad39c $838.77），只作背景。
- Reader C（sonnet）：`2026-10-18-main-session-cost.md` 的 verdict（:77）與數字（:79-81：10/16–18 三天 $1,209，主 64%／agents 36%，主 cacheRead 53.4%／cacheWrite 33.6%／output 13%，cacheWrite 七成是回合新增、19% 是 1h TTL 重寫）抽查相符；`.fankeel/profile.json` 無 `quota` 鍵，只有 `compact.at 350000`（:19）；`.fankeel/map.md` 未提到這四支工具。
- 本週數字由我在 judge 內以 `node -`（stdin）執行一段只呼叫 `lib/compare.js`、`lib/usage.js`、`lib/prices.js` 的彙總腳本得出，13 秒跑完，未建立任何檔案；輸出超過工具上限，由 harness 存到 `C:/Users/user/.claude/projects/F--ymlab-fankeel/26b7d5f3-ebf8-41a8-b513-cd502c1be9f1/tool-results/bf8kds9nu.txt`，表格內容由該檔 grep 取出。先前兩次自寫的全量掃描腳本被 auto-mode classifier 拒絕，已放棄，改用專案自己的 lib。
