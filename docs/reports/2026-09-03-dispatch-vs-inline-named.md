---
status: current
last_verified: 2026-09-03
source_of_truth: 一組成對量測（`ab2.sh`，2026-09-03，`HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402`）的直接輸出——`ab2-provenance.txt`、`arm2-dispatch.json`、`arm2-inline.json`；`--disallowedTools Agent` 移除的是工具本身這一點沿用第一對的前導測試（`pilot-dispatch.json`、`pilot-inline.json`），這一對沒有重跑那一步；本頁每一個數字都可回溯到這三個檔案之一，本頁不會重新產生
---

# Dispatch 對 Inline 的第二對量測：檔案已經點名 — 2026-09-03

同一個 harness，同一棵樹，同一組旗標。唯一改的是提問文字：七個檔案直接點名，兩個 arm 都不必先去找。

**residue 的優勢從 9.2 倍塌到 1.5 倍，而錢仍然貴 1.59 倍、wall-clock 仍然慢 2.77 倍。第一對量到的 9.2 倍，主要不是 dispatch 少讀了什麼，是 inline arm 得自己去找。**

## 1. 為什麼量這個

[2026-09-03-dispatch-vs-inline.md](2026-09-03-dispatch-vs-inline.md) 的 §6 第二條寫著：那一對「只問了一個問題，而且是特意選的寬讀問題——正是 dispatch 被宣稱適合的那種案例」。這一對換的就是那個變因。

換之前有一個數字先指了方向。第一對要讀的目標集是 `lib/stages.js` 加七個 stage skill，合計 106,392 bytes，大約兩萬多個 token；而它的 inline arm 最後留下 532,322 tokens 的 context。讀 106KB 用不掉那麼多，差額是**找**——搜尋、開錯檔案、走掉的路。所以 9.2 倍這個數字裡，有多少是 dispatch 替你省掉閱讀、有多少是替你省掉搜尋，第一對分不出來。點名檔案就是把搜尋這一項拿掉。

## 2. 方法

| 項目 | 內容 |
|---|---|
| 唯一變因 | 提問文字：七個檔案點名（本對）對要自己找（第一對） |
| 不變的 | 旗標、model、強制四個 `sonnet` 讀者的方法句形狀、`M_INLINE` 一字未改、`git checkout 86a104e` 的同一棵樹、同一版 CLI `2.1.259` |
| 共用旗標 | `claude -p --output-format json --model opus --permission-mode bypassPermissions` |
| Arm A（dispatch）額外旗標 | `--disallowedTools "Edit Write NotebookEdit"` |
| Arm B（inline）額外旗標 | `--disallowedTools "Edit Write NotebookEdit Agent"` |
| n | 每個 arm 1 次（見 §6） |

`ab2.sh` 相對 `ab.sh` 有五處差異，`diff` 逐行核對過：檔頭說明這支腳本在量什麼的註解、`SP` 與三個輸出檔名、`QUESTION`、`M_DISPATCH` 裡跟著問題規模縮的行數上限（10→7 行、每個 subagent 6→3 行），以及把樹切到 `86a104e` 再切回 `main` 的三行。除此之外，兩個 `claude` 呼叫各自從三行的續行寫法併成一行；旗標字串本身一字未改，兩個 arm 的 `--disallowedTools` 與第一對逐字相同。

兩個 arm 送進去的完整提問文字，逐字引自 `ab2.sh`：

共用的問題：
> In the repository at F:/ymlab/fankeel, read exactly these seven files and nothing else: hooks/brief.js, hooks/carry.js, hooks/gate.js, hooks/guard.js, hooks/inject.js, hooks/resume.js, hooks/touch.js. Answer one question: which of them read the session record, which of them write it, and which do neither? Answer in at most 7 lines, one line per file, every line anchored with a file:line. No preamble, no summary.

Arm A（dispatch）接的方法句：
> Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, splitting the seven named files between them; each returns at most 3 anchored lines. Then judge their returns and write the answer. Do not read the files yourself.

Arm B（inline）接的方法句：
> Method you must use: read the files yourself in this session. Do not delegate any of the reading.

`ab2-provenance.txt` 全文，逐字：

```
date: 2026-09-03T04:08:43Z
HEAD: 86a104e1bc87f7e82eec45cb84b6e32459a32402
porcelain:
claude: 2.1.259 (Claude Code)
--- arm A: dispatch
exit=0 shell_seconds=86
--- arm B: inline
exit=0 shell_seconds=31
restored: main
done
```

（`porcelain:` 後面沒有任何一行，即乾淨樹。`date` 是 UTC，因為 `ab2.sh` 用的是 `date -u`；本頁的日期標的是執行機器的本地日曆日。）

兩個 arm 確實走上不同的方法，機械上的證明一樣是 `subagent_stats.spawned`：Arm A 是 4，Arm B 是 0。

兩份回答都不是空轉：各自回傳七行、一行一檔、每行帶 `file:line`，兩邊對七個檔的判定完全一致。抽出八個 anchor 用 `sed` 逐行打開核對，八個全中——`hooks/brief.js:33` `readSession`、`hooks/carry.js:61` `readActive`、`hooks/gate.js:31` `gateOpen`、`hooks/guard.js:24` `readSession`、`hooks/inject.js:59` `readSession`、`hooks/inject.js:143` `claimWrites`、`hooks/resume.js:54` `gateClose`、`hooks/touch.js:45` `addClaim`。`hooks/` 自 `86a104e` 以來未改動（`git diff --stat 86a104e..HEAD` 只列出兩個 `skills/` 檔），所以在 `main` 上核對與在受測樹上核對是同一件事。

## 3. 數字

| 項目 | Arm A（dispatch） | Arm B（inline） | 本對比值 | 第一對比值 |
|---|---|---|---|---|
| `subagent_stats.spawned` | 4 | 0 | — | 4 對 0 |
| main-thread final context | 74,603 | 113,518 | 0.657×（B 是 A 的 1.52 倍） | 0.108×（B 是 A 的 9.23 倍） |
| `total_cost_usd` | $0.8193 | $0.5140 | 1.594× | 1.848× |
| all-model tokens（`modelUsage` 加總） | 309,656 | 115,145 | 2.689× | 4.677× |
| wall-clock（`shell_seconds`） | 86 秒 | 31 秒 | 2.774× | 1.750× |
| `duration_ms` | 79,993 | 25,278 | 3.165×（見 §5，此欄仍不可信） | 0.30× |
| `duration_api_ms` | 106,951 | 23,346 | 4.581× | 4.54× |
| `result` 字數 | 517 | 673 | 0.768× | 1.05× |
| `num_turns` | 5 | 8 | — | 1 對 13 |

main-thread context 的定義與第一對相同：`usage` 的 `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`。`modelUsage` 加總的定義也相同——每個 model 的 `inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens` 四欄，不含 `maxOutputTokens`（那是上限設定）與 `thinkingTokens`（已含在 `outputTokens` 裡）。這個定義不是猜的：抽數字的腳本先跑過第一對的兩份 JSON，逐一重現了那份報告印出來的 2,140,264、401,244、2,541,508、543,396、$2.2350、$1.2091、57,652、532,322，然後才拿來跑這一對。第一版腳本把 `maxOutputTokens` 和 `thinkingTokens` 也加了進去，重現不出來——那次失敗就是這個定義的來源。

Arm A 的 309,656 tokens 由兩個 model 組成：`claude-sonnet-5` 230,103 tokens／US$0.2795（四個讀者），`claude-opus-5` 79,553 tokens／US$0.5398（parent）。230,103+79,553=309,656，與加總一致；0.2795003+0.539844=0.8193443，與 `total_cost_usd` 完全相等（這一對只有兩個 model 且未先捨入，所以沒有第一對那 US$0.0001 的捨入差）。Arm B 全部由 `claude-opus-5` 產生：115,145 tokens／US$0.5140。

## 4. 結論

**dispatch 的 residue 優勢幾乎全部來自搜尋，不是來自閱讀。** 檔案要自己找的時候，inline arm 的 context 是 dispatch arm 的 9.23 倍；檔案點名之後，只剩 1.52 倍。而付出的代價沒有跟著縮：錢還是貴 1.59 倍（第一對 1.85 倍），wall-clock 甚至更差，慢 2.77 倍（第一對 1.75 倍）——工作變小，dispatch 的固定開銷佔比就變大。

`docs/subagents.md` 說「dispatch by default」，兩個例外是 pipe 已經清掉殘留、或只有一次工具呼叫。這一對把那條規則的邊界標出來了：真正決定 dispatch 划不划算的，是**這個問題要不要先找東西**，而不是要讀多少。一個檔案已經點名、只是量大的工作，dispatch 買到的 residue 很少，錢和時間照付。

## 5. 這一對自己的兩個觀察

**(a) `duration_ms` 仍然不可信，但這次的方向不同。** Arm A 的 `duration_ms` 是 79,993 ms，實測 wall-clock 86 秒——這次接近了；比值 3.165× 對真實的 2.774×，方向對、量級錯。第一對是方向就錯（JSON 說 dispatch 快三倍，實際慢 1.75 倍）。同一個欄位在兩對裡錯得不一樣，這正是不能信它的理由：它不是有固定偏差，是不可靠。wall-clock 一律從 process 外面量。

**(b) 小工作裡，parent 比四個讀者還貴。** Arm A 的 opus parent 花了 US$0.5398，四個 sonnet 讀者合計 US$0.2795——parent 是讀者的 1.93 倍。第一對正好相反：parent US$0.8293，讀者 US$1.4056。工作量一小，dispatch 的成本就從「讀者讀了多少」翻轉成「parent 光是張羅就要多少」。

## 6. 這一對沒有回答的

- n 仍然是每個 arm 1 次，這裡的數字說不了任何關於變異的事。第一對的 §6 第一條原封不動地留著。
- 現在有兩個問題形狀，不是一條曲線。兩個點之間（要找、但只要找一點）沒有量過。
- 兩個 arm 的 parent 都是 `opus`，讀者都是 `sonnet`。
- 四個讀者仍然是提問文字指定的，不是 model 自己判斷要不要 dispatch、要幾個。
- Arm A 因為多了 `Agent` 這個工具定義，兩個 arm 的 system prompt 本身就不同——第一對消不掉，這一對也沒消掉。
- 前導測試（`--disallowedTools Agent` 移除的是工具本身而不是擋呼叫）沒有重跑，沿用第一對的 `pilot-dispatch.json`／`pilot-inline.json`。
- `docs/subagents.md` 的 `Workflow` 主張仍然沒有被碰到。

## 7. 附錄

**Arm A（dispatch）的完整回答**（`arm2-dispatch.json` 的 `result` 欄位）：

```
hooks/brief.js:33 — 只讀：`registry.readSession(rootFor(payload), payload.session_id)`
hooks/carry.js:61 — 只讀：`registry.readActive(root)` 掃全部活躍紀錄，無寫入
hooks/gate.js:31 — 讀＋寫：readSession 之後以 `registry.gateOpen(root, session_id)` 回寫
hooks/guard.js:24 — 只讀：`registry.readSession(root, payload.session_id)`，全檔無寫入呼叫
hooks/inject.js:59 — 讀＋寫：readSession 取出 entry，再由 claimWrites/touch 更新
hooks/resume.js:31 — 讀＋寫：readSession 取出 entry，再由 gateClose/touch 更新
hooks/touch.js:28 — 讀＋寫：`registry.readSession` 讀入，`registry.addClaim` 寫回
```

**Arm B（inline）的完整回答**（`arm2-inline.json` 的 `result` 欄位）：

```
`hooks/brief.js:33` 只讀 — `registry.readSession` 取父 session 記錄後只輸出 brief，全檔無寫入呼叫。
`hooks/carry.js:61` 只讀 — `registry.readActive` 掃其他 session 的記錄（第 66 行跳過自己），第 28 行註解言明「It writes nothing」。
`hooks/gate.js:27` 讀，`hooks/gate.js:31` 寫 — `readSession` 後以 `registry.gateOpen` 記下閘門開啟時刻。
`hooks/guard.js:24` 只讀 — `readSession` 加第 45 行 `readActive`，輸出只是 permission decision，無寫入。
`hooks/inject.js:59` 讀，`hooks/inject.js:143`、`hooks/inject.js:181` 寫 — `claimWrites` 補登 claim、`registry.touch` 更新時間戳。
`hooks/resume.js:31` 讀，`hooks/resume.js:54` 寫 — `gateClose` 與 `registry.touch` 成對收尾。
`hooks/touch.js:28` 讀，`hooks/touch.js:45` 寫 — `readSession` 後未覆蓋的路徑才 `registry.addClaim`；七個檔沒有一個是兩者皆非。
```

[Back to the index](../README.md) · [Back to the front page](../../README.md)
