---
status: current
last_verified: 2026-09-18
source_of_truth: 每一列的現況都回溯到一個 `path:line`、commit 或 session id（八碼的是 session id，transcript 在 `~/.claude/projects/F--ymlab-fankeel/`）；現況由四個 `sonnet` reader 對程式碼讀出、本 session 抽查；數字出自 `docs/decisions/2026-09-18-skill-improvements.md`、`docs/improvement-brief.md` §6.2、`docs/reports/2026-09-03-dispatch-vs-inline.md` 與 `-named.md`、`TODO.md` 的〔session〕`hooks/size.js` 條目，價格出自 claude-api skill 的價目表（快取日 2026-06-24）；本頁不會重新產生
---

# 使用者 09-18 下午的十七項意見：逐條現況

**一句話：十七項裡十三項今天早上已經處理過，真正新的只有三項（給人讀的文件、context
回收、Sonnet 主控），而 Sonnet 主控不建議當第一步——它省的是單價，不是堆疊。**

早上那一輪是 `3e96a01`（決策紀錄 `docs/decisions/2026-09-18-skill-improvements.md`），
之後 `todo-six` 發了 0.70.0，裝好的時間是 2026-09-18T04:47Z。所以早上寫「卡在發版」
的兩件——唯讀 agent 的箭頭誤判修正、gate 記錄——現在都在跑了。

早上裁決過的六項，這次在 survey 關卡問過要不要重開，沒有選任何一項，全部維持。

## 總表

| 狀態 | 幾項 | 哪幾項 |
|---|---|---|
| 已完成 | 3 | A、C、D |
| 部分完成 | 7 | B、E、I、J、K、M、N |
| 待你決定（條目已在 TODO） | 2 | F、H |
| 前提，不單獨成條 | 1 | G |
| 已回答（更正早上的結論） | 1 | L |
| 新的 | 3 | O、P、Q |

## 逐條

| 項 | 你問的 | 現況 | 狀態 | 接下來 |
|---|---|---|---|---|
| A | design 階段加 mockup，參考 taste-skill 之類 | `skills/fankeel-design/SKILL.md:80` 第 3 步就是它：前端任務畫一頁 HTML 到 `.fankeel/build/<日期>-<題>/mockup.html`，用 `design.mockup` 指定的模型（這個專案是 opus），從六個設計 skill 裡指名一個 | 已完成 | 無 |
| B | station 預設開發偏好、land 不要每次問、入口不問改在 HTML 決定 | profile 有 9 個 key（`lib/profile.js:17`）；這個專案已設 `land.integration merge`、`land.push false`，land 不再問。`suggest` 只從 `git log` 與 registry 推 `land.*` 兩個 key（`lib/profile.js:112`）。「入口分析完不問、問題放 HTML」沒做 | 部分完成 | 新條目〔profile〕；入口改 HTML 併進 Q 的第 ③ 步 |
| C | Fable 一次性判官、判斷寫成文件可追溯、docs tree 要有判斷區與暫存區 | `/fankeel-ask` 就是它：`agents/fankeel-judge.md:5` 是 `model: fable`，一次、不追問，答案存 `docs/judgements/<日期>-<slug>.md`（`scripts/judge.js:83`）。只能手動觸發——09-10 裁決（`docs/decisions/2026-09-10-judge-to-ask.md`）。分區見下面的〈文件樹〉 | 已完成 | `.fankeel/build/` 要不要進 `docs.json` 已有待決條目 |
| D | sonnet 讀取任務想改檔被攔、要不要 custom agent 或 MCP | custom agent 已經有 5 個（`agents/`）。`hooks/guard.js:40` 擋唯讀 agent 用 Bash 寫檔，被擋時的訊息以 `fankeel:` 開頭——看訊息就知道是它還是 auto mode。MCP 不需要，理由見 O | 已完成 | 「乾脆拿掉 Bash」已有待決條目 |
| E | memory 自動清理 | `scripts/memory-check.js` 列出引用失效或過期的記憶，只列不刪，audit 與 land 各跑一次。早上讀了 27 條、4 條加更正行、刪 0 條（`728dd76`）。**界線：沒有引用任何程式碼的錯誤事實，它抓不到** | 部分完成 | 摘要行把引用數當條目數，已有 Ready 條目 |
| F | 解除 caveman、ponytail 依賴；caveman.zip 讀過沒 | caveman：程式碼零依賴，09-15 已停用。zip 在 `C:\Users\Owner\Desktop\caveman.zip`，09-09（session `73b21b2c`）與 09-12（session `6ef14250`）兩次解壓讀過。ponytail：09-12 完成，3 個功能收進 `fankeel-reviewer`，程式碼零引用；外掛還裝著但停用，fankeel 從沒有 session 用 Skill 叫過它 | 待你決定 | 〔caveman〕挑功能——建議當下一個任務；ponytail 剩你自己在 `/plugin` 解除安裝 |
| G | fankeel 要解決文件長期過期，code 不是唯一來源 | 09-11 判官裁定這是前提，不單獨成條（`docs/judgements/2026-09-11-todo-split.md`）。執行它的是四支掃描器：`docs-check`、`docs-audit`、`todo-check`、`memory-check` | 前提 | 無 |
| H | session 堆疊太快、verify↔build 來回 | 量過（簡報 §6.2，09-11）：153 份 transcript，context 峰值中位數 209k、p90 509k；15 個 session 有倒退，`verify>build` 29 次。堆疊約九成是主迴圈自己的工具輸出，subagent 回傳只佔 8–9%。`hooks/size.js` 上線後 bigPerSession 從 0.3846 升到 0.6136，不降反升 | 待你決定 | 〔session〕四個候選挑哪個；我們的建議見 Q |
| I | station 單 session 詳細分析：幾個 task、怎麼切片、哪裡可平行 | session 頁已有 task 區、派工表（agent 與 workflow 分列）、stage 泳道，以及「本來可以同一回應發出」的提示（`lib/detail.js:372`）。缺一段文字摘要說主 agent 怎麼分工。簡報 §6.3 還寫「沒有」，比程式碼落後 | 部分完成 | 早上裁決不重開；成本分解見新條目〔station〕 |
| J | station 上看不到 profile | 在，但只在 `node scripts/station.js serve --open` 底下改得了；`/fankeel` 寫的靜態頁只給可複製的指令，而且排在首頁最後（`docs/station.md:624`）。這是第二次找不到 | 部分完成 | 新條目〔station〕profile 卡 |
| K | 主 agent 被叫醒太多次、每次重送整份 context | 叫醒只佔主回合 7.0%（全期 `sumWakes` 1,498 ÷ `sumRequests` 21,376）。要壓的是主迴圈自己的回合數。`usage.wakes` 算了（`lib/usage.js:140`），但頁面沒顯示 | 部分完成 | 新條目〔station〕`wakes` |
| L | station redesign 用過哪些 skill，別台機器能不能照做 | **更正早上的結論。** 早上說「沒用任何 skill」，只查了文件。transcript 裡，session `d39444fc`（09-14 三層改版）畫 mockup 的 subagent（opus）叫過 `frontend-design:frontend-design` 與 `dataviz`。09-04 到 09-08 的五個改版 session 都沒叫設計 skill。別台機器：裝 fankeel 加 `frontend-design`，走 design 第 3 步；fankeel 本身不帶設計 skill | 已回答 | 決策紀錄加一行更正 |
| M | reader 讀 git 是 pipeline，能不能平行 | `scripts/survey.js:222` 讀檔確實是序列，但 09-15 量過 442 檔 0.394 秒，瓶頸不在這裡。看起來像 pipeline，是因為 reader 模型一回合只發一個工具呼叫；`agents/fankeel-reader.md` 沒叫它把互不相依的讀取放在同一個回應 | 部分完成 | 新條目〔agents〕 |
| N | 資料標版本號、記住每個問題的選項、答案當標註 | 0.70.0 起 `lib/gates.js:66` 每題存 `{at, stage, header, labels, picked}`：選項文字與你的答案都在，`(Recommended)` 在 label 裡。**問題本文與選項 description 沒存。**版本號一個都沒有 | 部分完成 | 新條目〔gates〕；版本號已有〔registry〕待決條目 |
| O | docs 是寫給 AI 的、grep 會引到兩處、archive 會被搜到、要不要 MCP | 見下面〈O：文件給誰讀〉 | 新的 | 三條新條目 |
| P | context 回收 | 見下面〈Q：Sonnet 主控評估〉的第 ② 步 | 新的 | 併進 Q |
| Q | Sonnet 5 當主控、不輸出、輸出 POST 到 station、動腦交給 Opus | 見下面〈Q：Sonnet 主控評估〉 | 新的 | 兩條新條目 |

## O：文件給誰讀

**archive 會不會被 grep 搜到：會，你的理解是對的。** `Grep` 工具底下是 ripgrep，它只跳過
`.gitignore`、`.ignore`、`.rgignore` 列的東西。`docs/archive/` 已 commit（100 個檔），
沒有被任何一個列到，所以照搜。只有 `fankeel-reader` 有「排除 `docs/archive/**`」這條規則
（`agents/fankeel-reader.md:34`）；主 session、其他 agent、`survey.js` 都沒有——這次
`survey.js profile station mockup judge` 列出的前 25 個檔名裡，19 個在 archive。

**grep 引到兩處要解矛盾：** `docs-audit` 的 pairs 就是抓「兩頁描述同一個原始檔」。早上
`728dd76` 讀完 41 對，事實矛盾 0 對，但有三處是同一件事寫在兩頁、沒決定哪頁是來源：
`development.md:79` 對 `contract.test.js:256`、`pipeline.md:985` 對
`fankeel-audit/rationale.md:65`、`registry.md:246` 對 `station.md:287`。這三處當時沒進
TODO，這次補上。

**文件是寫給 AI 的：對。** `docs/` 的 reference 頁是英文、密、滿是理由與量測，讀者預設是
下一個 session。給人讀的入口只有 `docs/README.md` 的索引。

**MCP：不需要。** 共通語言其實已經有了——`docs.json` 的 role 加上每頁 frontmatter 的
`status`、`last_verified`、`source_of_truth`。缺的是搜尋工具不懂它：Grep 不知道
archive 是退役的。MCP 會多一個常駐 process、每個 session 多一組工具定義，還要重寫一次
`survey.js` 已經在做的事。只有在另一個 host（例如 Codex）也要用同一套介面時才值得，
那已經是 `## Waiting` 的多平台條目。

## Q：Sonnet 主控評估

### 為什麼過了 400k 就貴得很快

價目表上沒有 400k 的加價門檻。1M context 一律標準價。貴，是因為**每一回合都要把整份
context 當 cache read 重讀一次**：

| 每回合重讀的費用 | Opus 5（$0.50/M） | Sonnet 5（約 $0.20/M） | Fable 5.1（$0.25/M） |
|---|---|---|---|
| 200k context | $0.10 | $0.04 | $0.05 |
| 400k context | $0.20 | $0.08 | $0.10 |
| 700k context | $0.35 | $0.14 | $0.175 |

Sonnet 5 的 cache read 是用「約 0.1 倍輸入價」推的，價目表沒直接列；Opus 5 與 Fable 5.1
是價目表的數字。訂閱額度怎麼換算沒有公開，這張表只用來比相對大小。

一回合的費用跟 context 成正比，而會堆到 400k 的 session 回合數也多，兩個相乘，所以
累計看起來像指數成長。

### 把這個概念拆成五個零件

| 零件 | 省到什麼 | 量到的 | 判斷 |
|---|---|---|---|
| 主控換成 Sonnet | 每回合重讀的單價，約 Opus 5 的四成 | — | 省單價，不省堆疊 |
| 主控不讀檔、只派工 | 主迴圈自己的工具輸出 | 堆疊約九成是這個（簡報 §6.2） | **這才是有效成分** |
| 主控不輸出文字 | 輸出 token | 輸出是零頭，錢花在每回合重讀的輸入 | 幾乎不省，你還看不到它在做什麼 |
| 動腦交給 Opus，一次就丟 | 主 context 的殘渣 | 派工的總花費是自己做的 1.59–1.85 倍（09-03，冷啟動要重讀） | 省主 context，不省總錢 |
| station 當控制站 | 把關卡從終端搬到網頁 | serve 已有 `POST /profile`、`/todo`、`/clear` | 可行，要新增回答端點，session 要有「等網頁回答」的通道 |

還有兩個結構問題：

1. **stage 規則只進主 session。** `hooks/inject.js` 是 `UserPromptSubmit` hook，subagent
   沒有 prompt，只拿到 brief。「動腦全丟給 Opus」等於每個 Opus 都看不到這一站的規則——
   這正是 fankeel「派一件工作，不派整個 stage」那條規則的理由。
2. **LLM 主控的 context 還是會長。** 每回合的注入、每次回傳都進來，只是慢一點。要真的
   回收 context，邊界必須是 session。

### 比較好的版本：主控不必是 LLM

route 已經是 registry 裡的資料，下一站是誰不需要判斷。一支 node driver 逐站開 headless
session（`claude -p`），站與站之間的狀態走檔案（plan、ledger、judgements、notes），
關卡的問題寫到 station 讓你按。每一站從零開始，這就是 context 回收。代價：每站冷啟動、
失去對話式互動、hook 在 `-p` 底下照跑但你看不到。

### 建議：三步，不要一次大改

| 步 | 規模 | 做什麼 | 對應條目 |
|---|---|---|---|
| ① 先量 | 小 | session 頁補上主迴圈成本分解：每站回合數、`wakes`、400k 以上回合的花費占比 | 〔station〕兩條新條目 |
| ② 便宜版 | 中 | stage 邊界換 session：context 過門檻時，關卡提示在新 session 接續；`/fankeel` → Adopt 已能帶走 task、route、notes、next | 既有〔session〕待決條目的 gate-Adopt 候選 |
| ③ 極端版 | 大 | driver 加 station 控制站 | 新的〔session〕Waiting 條目，①② 做完仍壓不住才解除 |

**Sonnet 主控本身不建議。** 它只省單價；做到第 ③ 步的話，主控連 Sonnet 都不需要。

站內的串接工作（review 接 verify）已經可以用 Workflow 跑：script 在步驟之間不叫醒主迴圈，
中間結果不進主 context。這是現在就有、不必改架構的那一塊。

## 文件樹：誰住哪裡、活多久

```
fankeel/
├── docs/                    reference：描述現在的系統，必須和程式碼一致
│   ├── README.md            索引，人手維護；docs-audit 兩個方向都查
│   ├── decisions/           decision：為什麼這樣做。寫一次，錯了加「更正」行
│   ├── plans/               plan：要做的事。落地後移進 archive
│   ├── reports/             report：某一天的量測快照，不再改
│   ├── judgements/          report：/fankeel-ask 判官的原文答案，追溯用
│   └── archive/             archive：退役文件。只查「沒有現行文件還指著它」
├── .fankeel/
│   ├── docs.json            上面這些分區的宣告（commit）
│   ├── profile.json         這個專案的開發偏好（commit）
│   ├── sessions/            registry，每個 session 一檔（不 commit）
│   ├── build/<日期>-<題>/    單一任務的暫存：mockup、ledger、證據、草稿（不 commit、不清除、不受任何檢查）
│   ├── map.md               每次重新產生的地圖（不 commit）
│   └── index.html、station/  站台的靜態頁（不 commit）
├── TODO.md                  待辦索引，todo-check 管
└── ~/.claude/projects/<專案>/memory/   原生記憶，不在 repo 裡，memory-check 管
```

`docs.json` 另外宣告了 `skills/`、`agents/`（reference）與 `evals/`（fixture）。
`.fankeel/` 各區的壽命在 `docs/documents.md:121` 有一張表。

## 這次新增的 TODO 條目

| 標題 | 條目 |
|---|---|
| Ready | 〔agents〕reader 把互不相依的讀取放同一個回應 |
| Ready | 〔station〕`usage.wakes` 有算沒顯示 |
| Ready | 〔docs〕`docs/sources.md` 漏了 09-15 報告的列 |
| Needs a decision | 〔station〕主迴圈成本分解 |
| Needs a decision | 〔station〕profile 卡兩次沒找到 |
| Needs a decision | 〔docs〕archive 會被 Grep 搜到 |
| Needs a decision | 〔docs〕給人讀的文件層 |
| Needs a decision | 〔docs〕三處同一件事寫在兩頁 |
| Needs a decision | 〔gates〕問題本文與 description 沒存 |
| Waiting | 〔session〕driver 加 station 控制站 |
| Waiting | 〔profile〕`suggest` 從 gate 答案推其他 key |

## 刻意沒做的

- **沒重開早上的六項裁決。** survey 關卡問過，沒有選。
- **沒改簡報 §6.3。** 它是 `design-intent` 的計畫頁，那一行寫的是 09-12 當時的缺口；程式碼
  已經有了，記在上面 I 那一列。
- **沒寫「station 設計手法可攜化」的條目。** 那是重開 N22，關卡上沒選；要做的話說一聲。
- **沒碰 caveman 與 ponytail 的解除安裝。** 那是你機器上的外掛設定。
- **沒補 09-15 報告在 `docs/sources.md` 的列。** build 時發現它在這之前就漏了；補它要先
  讀完那份報告，所以記成 Ready 條目。這份報告自己的列有補上。
