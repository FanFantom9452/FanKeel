---
status: current
last_verified: 2026-09-03
source_of_truth: 一組成對量測（`ab.sh`，2026-09-03，`HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402`）的直接輸出——`ab-provenance.txt`、兩份 `claude -p --output-format json` 輸出 `arm-dispatch.json`、`arm-inline.json`，以及確認 `--disallowedTools Agent` 移除的是工具本身的前導測試 `pilot-dispatch.json`、`pilot-inline.json`；本頁每一個數字都可回溯到這五個檔案之一，本頁不會重新產生
---

# Dispatch 對 Inline 的成對量測 — 2026-09-03

同一個問題，逐字相同，送進兩個全新的 session；唯一的變因是 session 有沒有 `Agent` 工具。這是一組對照組，補的是 `docs/subagents.md` 之前的量測裡一直缺的一半。

**Dispatch 買到的是主執行緒 context 小 9.2 倍（57,652 對 532,322 tokens），代價是 1.85 倍的錢、4.7 倍的 token、1.75 倍的 wall-clock——它不是省錢也不是省時間的做法，是用錢買 residue 小這件事，而這是這個 repo 第一次替這筆交易標出價錢。**

## 1. 為什麼量這個

`docs/subagents.md:52` 記過一次 2026-08-26 的量測：四個讀者各一個 lens 的 fan-out，花掉 240,881 tokens，回傳大約 4,000 個字元，花了 121 秒而不是循序的 352 秒。那次量測算的是四個讀者花了多少，拿來比較的對象是空的——沒有一組 inline 的 arm 可以對照。`TODO.md` 曾把這件事放在它當時唯一的 `## Ready` 項目底下。這一對量測，就是把那個缺的對照組補上。

## 2. 方法

| 項目 | 內容 |
|---|---|
| 唯一變因 | session 有沒有 `Agent` 工具 |
| 問題文字 | 逐字相同；只有結尾的方法句不同 |
| 各 arm 的 session | 各 1 個，全新、乾淨樹，`HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402` |
| 共用旗標 | `claude -p --output-format json --model opus --permission-mode bypassPermissions` |
| Arm A（dispatch）額外旗標 | `--disallowedTools "Edit Write NotebookEdit"` |
| Arm B（inline）額外旗標 | `--disallowedTools "Edit Write NotebookEdit Agent"` |
| n | 每個 arm 1 次（見 §6 的限制） |

兩個 arm 送進去的完整提問文字，逐字引自 `ab.sh`：

Arm A（dispatch）：
> In the repository at F:/ymlab/fankeel, answer one question: which rules injected by lib/stages.js have no counterpart in the stage skill they belong to (skills/fankeel-<stage>/SKILL.md), and which rules does a stage skill state that lib/stages.js does not inject? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary. Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, one lens each, splitting the seven stages between them; each returns at most 6 anchored lines. Then judge their returns and write the answer. Do not read the skill files yourself.

Arm B（inline）：
> In the repository at F:/ymlab/fankeel, answer one question: which rules injected by lib/stages.js have no counterpart in the stage skill they belong to (skills/fankeel-<stage>/SKILL.md), and which rules does a stage skill state that lib/stages.js does not inject? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary. Method you must use: read the files yourself in this session. Do not delegate any of the reading.

拿掉 `Agent` 工具用的是 `--disallowedTools`，這移除的是工具本身，不是只擋呼叫——這一點有一組前導測試（`pilot-dispatch.json`、`pilot-inline.json`）為證：兩邊都是同一個極短的提問，要求「剛好 dispatch 一次 Agent」；拿到 `--disallowedTools Agent` 的那一份 `subagent_stats.spawned` 是 0，另一份是 1，而拿掉工具的那一份在 `result` 裡明講「No dispatch-capable `Agent` tool exists in this session」——講的是工具不存在，不是呼叫被拒絕。

`ab-provenance.txt` 的 header，逐字：

```
date: 2026-09-02T23:29:47Z
HEAD: 86a104e1bc87f7e82eec45cb84b6e32459a32402
porcelain:
claude: 2.1.259 (Claude Code)
```

（`porcelain:` 後面沒有任何一行，即乾淨樹。`date` 是 UTC，因為 `ab.sh` 用的是 `date -u`；本頁的日期標的是執行機器的本地日曆日，不是這個 UTC 戳章，兩者不必是同一天，不是打錯。）

兩個 arm 實際上有沒有走上不同的方法，機械上的證明是 `subagent_stats.spawned`：Arm A 是 4，Arm B 是 0。這不是自我宣稱，是 `claude -p` 自己記的執行統計。

兩份回答都經過人手核對，確認不是空轉：各自回傳 10 行，每行都帶著一個 `file:line` anchor，抽出其中四個 anchor 手動打開檔案核對——`lib/stages.js:270`、`lib/stages.js:196`、`skills/fankeel-verify/SKILL.md:47`、`skills/fankeel-plan/SKILL.md:107`——四個都對得上。若其中一個 arm 是死的（例如工具被拒絕呼叫導致答非所問、或回傳空內容），這一對量測就作廢。

## 3. 數字

| 項目 | Arm A（dispatch） | Arm B（inline） | 比值（A ÷ B） |
|---|---|---|---|
| `subagent_stats.spawned` | 4 | 0 | — |
| all-model tokens（`modelUsage` 加總） | 2,541,508 | 543,396 | ≈4.68× |
| `total_cost_usd` | $2.2350 | $1.2091 | ≈1.85× |
| wall-clock（shell 量，`ab-provenance.txt` 的 `shell_seconds`） | 280 秒 | 160 秒 | 1.75× |
| `duration_ms` | 45,586 | 153,810 | ≈0.30×（見 §5a，此欄不可信） |
| `duration_api_ms` | 679,764 | 149,753 | ≈4.54×（見 §5a） |
| main-thread final context（`usage` 的 `input_tokens+cache_read_input_tokens+cache_creation_input_tokens`） | 57,652 | 532,322 | ≈0.108×（即 B 是 A 的 9.23 倍） |
| `result` 字數 | 1,156 | 1,106 | ≈1.05× |
| `num_turns` | 1 | 13 | — |

`modelUsage` 的拆分：Arm A 的 2,541,508 tokens 由兩個 model 組成——`claude-sonnet-5` 2,140,264 tokens／US$1.4056（四個 subagent 讀者），`claude-opus-5` 401,244 tokens／US$0.8293（parent）。token 的加總是精確值：2,140,264+401,244=2,541,508，跟 all-model tokens 的數字完全一致。顯示用的四位小數金額則是捨入後的結果：US$1.4056 加 US$0.8293 等於 US$2.2349，比 `total_cost_usd` 顯示的 US$2.2350 少 US$0.0001，差在兩個數字都先捨入到四位小數才相加；`modelUsage` 裡未捨入的原始值相加，精確等於 `total_cost_usd`。Arm B 全部由 `claude-opus-5` 產生：543,396 tokens／US$1.2091，與 `total_cost_usd` 的 1.2091464999999997 一致（只有一個 model，不涉及加總捨入）。

## 4. 結論

一句話：dispatch 買到的是主執行緒 context 小 9.2 倍（57,652 對 532,322 tokens），付出的代價是 1.85 倍的錢、4.7 倍的 token、1.75 倍的 wall-clock。所以 dispatch 不是省錢的做法，也不是省時間的做法——它是拿錢去買 residue 小這件事，而這是這個 repo 第一次替這筆交易標出價錢。`docs/subagents.md` 已經主張過 residue 才是真正要付的成本；這一對量測收回的，是把 2026-08-26 那筆數字誤讀成「dispatch 同時也比較便宜、比較快」的任何讀法。

## 5. 量測本身的兩個陷阱

**(a) `duration_ms` 嚴重低估 dispatch 這個 arm。** Arm A 的 `duration_ms` 是 45,586 ms，而 shell 量到的 wall-clock 是 280 秒（280,000 ms 量級）；`duration_api_ms`（679,764 ms）則是四個 subagent 的 API 時間總和，不是 wall-clock。如果只信 JSON 自己的 `duration_ms`（45,586 對 153,810），報告會說 dispatch 快了大約三倍——事實上它慢了 1.75 倍。wall-clock 必須從 process 外面用 shell 量，不能信 JSON 自報的欄位。

**(b) `modelUsage` 與 `total_cost_usd` 確實把 subagent 的花費算進去了。** Arm A 的主執行緒 `usage` 只顯示 57,652 tokens，但 `modelUsage` 加總是 2,541,508 tokens——一個 fan-out 真正的成本要看這個加總，而不是主執行緒自己的 `usage`。per-model 的拆分（`claude-sonnet-5` 對 `claude-opus-5`）正好把四個 sonnet 讀者跟 opus parent 的花費分開看。

## 6. 這一對沒有回答的

- n=1（每個 arm 各跑一次），這裡的數字說不了任何關於變異的事。
- 只問了一個問題，而且是特意選的「寬讀」問題——正是 dispatch 被宣稱適合的那種案例；換一種問題形狀，這組比值不保證成立。
- 兩個 arm 的 parent 都是 `opus`。
- 四個讀者是提問文字裡指定的，不是 model 自己判斷要不要 dispatch、要 dispatch 幾個；這一對量測比較的是兩種方法本身，不是 model 在什麼情況該選哪種方法的判斷力。
- Arm A 因為多了 `Agent` 這個工具定義，兩個 arm 的 system prompt 本身就不同，不是純粹只有「用不用」這一個維度乾淨到底。
- `docs/subagents.md:92` 的 `Workflow` 主張（一個 fan-out 餵給下一個 fan-out，靠 `pipeline` 而不是巢狀 dispatch）完全沒有被這一對量測碰到。

## 7. 附錄

**Arm A（dispatch）的完整回答**（`arm-dispatch.json` 的 `result` 欄位）：

```
`lib/stages.js:195` 注入「讀這塊的既有文件，不符就當場說」——`skills/fankeel-survey/SKILL.md` 查無對應（agent grep「stale/disagree/documents this area」只中到分類段的無關字）。
`lib/stages.js:270` 注入「新文件是最後手段；寫出來要帶 status、last_verified、source_of_truth」——`skills/fankeel-build/SKILL.md` 只有 frontmatter 欄位，沒有這條指示。
`lib/stages.js:114-117` 的 ALWAYS 四條在七個 stage skill 全部查無對應——但它們不歸屬任何單一 stage，是刻意只活在注入層，不是缺口。
`skills/fankeel-plan/SKILL.md:107` 要求每個 task 帶 `**Interfaces**`（Consumes/Produces 簽名）——`lib/stages.js:248` 只點名 `**Files:**` 與 `**Dispatch:**`，全檔無 Interfaces。
`skills/fankeel-verify/SKILL.md:47` 要求 red-green（revert the fix, watch it fail, restore）——`lib/stages.js:285-294` 未注入。
`skills/fankeel-verify/SKILL.md:109` 要求有 ledger 時每個完成 task 一個 verifier——`{{LEDGER}}` 只出現在 build 的 `lib/stages.js:267`，verify 的規則裡沒有。
`skills/fankeel-land/SKILL.md:23` 要求整套測試綠燈才給整合選單（紅燈就停）——`lib/stages.js:343-352` 未注入，儘管 land 的 skill 描述寫的就是「a green suite」。
`skills/fankeel-build/SKILL.md:225` 把修復輪次上限訂在五輪——`lib/stages.js:266-271` 沒有任何輪次界線。
`skills/fankeel-design/SKILL.md:93` 的五點自審清單（Placeholders、一致性、Scope、歧義、對照專案）——`lib/stages.js:219-225` 未注入。
`lib/stages.js:310-316`：audit 這一輪兩個方向都沒回報 stage 專屬落差，只回報了上面那條 ALWAYS。
```

**Arm B（inline）的完整回答**（`arm-inline.json` 的 `result` 欄位）：

```
lib/stages.js:196 注入了「用一句話說出需求並先取得確認」，fankeel-survey/SKILL.md 的六個步驟裡沒有任何對應，該技能只要求把分類說出口。
lib/stages.js:270 注入的「新文件是最後手段，寫出來的要帶 status、last_verified、source_of_truth」在 skills/fankeel-build/SKILL.md 完全沒有對應段落。
lib/stages.js:311 注入的「死路徑在參考文件是錯誤、在封存是歷史」這個區分，skills/fankeel-audit/SKILL.md 談 docs-check 時未提。
lib/stages.js:223 注入「用 `task.js route` 把 plan 放上路線」，skills/fankeel-design/SKILL.md:127 只說那是 plan 的工作，沒有改路線這個動作。
skills/fankeel-design/SKILL.md:39 要求「兩三個方案並列權衡」，而 lib/stages.js:225 注入的是「一個方案，不是型錄」，兩者互相牴觸。
skills/fankeel-design/SKILL.md:85 規定 architectural 要寫出 `-design.md` spec 檔並 commit，design 的注入規則 lib/stages.js:218-225 沒有這一條。
skills/fankeel-plan/SKILL.md:107 規定每個任務都要有 **Interfaces:** 區塊，lib/stages.js:248 只把 `**Files:**` 與 `**Dispatch:**` 缺席算作 plan failure。
skills/fankeel-build/SKILL.md:97 規定進迴圈前要掃描計畫並跑 `ledger.js groups` 分組，lib/stages.js:267 只注入 `show` 與 `complete`。
skills/fankeel-verify/SKILL.md:109 規定有 ledger 時每個任務派一名 verifier（`ledger.js ranges`），lib/stages.js:285-293 沒有注入任何 ledger 相關規則。
skills/fankeel-land/SKILL.md:18 的「整套測試綠燈、紅就全停」與 :123 的三選一整合選單與 worktree 清理，在 lib/stages.js:343-351 一條都沒注入。
```

**Provenance header，逐字**（`ab-provenance.txt` 全文）：

```
date: 2026-09-02T23:29:47Z
HEAD: 86a104e1bc87f7e82eec45cb84b6e32459a32402
porcelain:
claude: 2.1.259 (Claude Code)
--- arm A: dispatch
exit=0 shell_seconds=280
--- arm B: inline
exit=0 shell_seconds=160
done
```

[Back to the index](../README.md) · [Back to the front page](../../README.md)
