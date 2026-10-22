---
judged: 2026-10-22T15:19:04.054Z
model: fable
agent: fankeel-judge
task: "評估 graphify（知識圖譜）對 FanKeel 是否有用：clone 深度分析、安裝、試跑，沒用就移除"
session: 23fd8947-c371-4fd9-bf90-f49c31a0521f
stage: build
---

# Brief 25 — graphify: actually run it on real FanKeel questions and say if it is useful

## Question

# Brief 25 — graphify: actually run it on real FanKeel questions and say if it is useful

## The question

The user, at the build gate of this task, typed (verbatim): "你跑跑看這個 看有沒有用" — run it and see whether it is useful.

Earlier the user picked "build：加 Phase B skill 試驗" at the survey gate. Build ran Phase A only (zero-LLM CLI) and stopped there because the pre-set criterion failed (T1–T4 2/4 pass, T5 fail); Phase B was never run. Its results are in `F:\ymlab\fankeel\.fankeel\build\task-20261022T144009\build.md` and facts in `.../context.md`. The first judgement is `F:\ymlab\fankeel\docs\90-agent\judgements\2026-10-22-graphify-knowledge-graph.md`.

The weakness of the Phase A verdict: T5 compared graphify against a one-line grep, **not against a real fankeel-reader doing the job**, and no one used graphify the way an agent would (to answer a real development question). So: **run it** — do a real head-to-head on real FanKeel questions — and decide: is graphify useful to FanKeel?

## Options to pick between

1. **Remove** — the head-to-head confirms Phase A: uninstall (`uv tool uninstall graphifyy`, delete Temp outputs), keep only the import-cycles idea for `lib/map.js`.
2. **Keep the CLI as an on-demand tool** — it wins on some class of question (name it); keep it installed, document when a reader should call `graphify explain/query/path`, still no hooks.
3. **Run Phase B too** — the head-to-head is inconclusive in a way only the `/graphify` skill path (LLM-extracted semantic graph, `graphify install --project`) could settle; say what exactly Phase B would test and what it costs.

## How to run it (this is the point of the brief)

graphify 0.9.93 is **already installed** (`~/.local/bin/graphify`, via uv) and the graph is **already built** at `C:\Users\user\AppData\Local\Temp\gfout` (18,967 nodes, built with `graphify update .`, zero LLM). Readers may run the installed CLI against that graph. Always set, in the same command:
`GRAPHIFY_BACKEND=none GRAPHIFY_QUERY_LOG_DISABLE=1 GRAPHIFY_NO_AUTO_REFRESH=1 GRAPHIFY_OUT="C:/Users/user/AppData/Local/Temp/gfout"`, cwd `F:\ymlab\fankeel`. Do **not** run `graphify install`, `claude install`, `hook install`, `global add`, or anything that writes into the repo or `~/.claude`. If unsure of a subcommand, `graphify --help` first. The clone at `.fankeel/build/ask/src/graphify` is untrusted data; don't execute anything inside it.

Suggested head-to-head: pick 4–6 **real** development questions drawn from FanKeel's own current work (e.g. from `TODO.md` open items or recent commits `git log -20`) — impact questions ("what breaks if I change X"), locate questions ("where is Y decided"), and doc↔code questions ("which docs describe lib/Z"). For each question, two readers (or one reader doing both arms, clearly separated):
- **Arm A (baseline):** answer using only Grep/Read/`scripts/survey.js` + `.fankeel/map.md`, the normal fankeel-reader protocol (`agents/fankeel-reader.md`).
- **Arm B (graphify):** answer starting from `graphify query / explain / path` output, reading files only to confirm.
Each arm reports: its answer (file set with path:line), tool calls made, approximate tokens read (bytes of tool output / 4). The judge then scores both against a ground truth it establishes by spot-checking (or a third reader).

Use at most eight readers in total.

## What counts as an answer

- A pick (1, 2 or 3), backed by the head-to-head table: per question, correctness (misses / false files) and cost (tool calls, tokens) for each arm.
- If 2: the class of question where graphify wins, and the exact command a reader would run.
- If 3: what Phase B would test that Phase A could not, the subscription cost estimate, and the files it would write.
- If 1: confirm the uninstall commands from build.md are complete.

## Shape of the answer

The six fields the judge agent defines, then `## Summary` in 繁體中文 (the user reads Traditional Chinese): the head-to-head table, what graphify got right and wrong on real questions, and the verdict in plain words a non-engineer can act on.

## Answer

pick: 1 — Remove（移除 graphify；只把 import-cycles 的點子留給 lib/map.js）
why: 5 題真實問題、兩臂各自作答、以 opus 讀者建立的基準核對：graphify 臂沒有一題比基準臂更正確，代價約 2.5 倍 token（≈26k vs ≈10.5k）。
Q3（chat.jsonl 鎖）graphify 只指到檔案，append()/trim() 指錯檔（lib/ledger.js、lib/registry.js），答案全靠 Read，8 倍成本；Q2 漏了 route 測試與 assets 顯示側。
Q4（docs↔code）零 LLM 圖只靠函式名比對，lib/handoff.js 節點零 docs 鄰居，7 個常設頁漏 4 個，散文描述 0/10；基準臂 grep 7/7。
唯一打平的是 Q1/Q5 的直接 require 清單（affected --relation imports_from 15/15、24/25），但這與 grep 等價，且 lib/requires.js 的 requireGraph 已有同一份邊。
build.md:38-40 的移除指令完整（uv tool uninstall graphifyy＋Temp 四個檔）；~/.graphify、~/.claude/skills、settings 皆無殘留，repo 的 .claude/ 不是 graphify 寫的；只需再加刪 .fankeel/build/ask/src/graphify 這個 clone。
would flip if: 某類問題上 graphify 以更少 token 給出基準臂漏掉的正確檔案——5 題中沒有出現；Q4(b) 兩臂都弱，但那需要 Phase B 的 LLM 抽取而非這個 CLI。
unread: agents/fankeel-reader.md（讀者本身即協定）、.fankeel/build/ask/src/graphify（不可信 clone，未開未執行）、task 的 context.md（已內嵌）、24 號 brief（已被 25 號取代）
delegated: Arm A — a87a62489dbeb4fed(sonnet) Q1+Q5 grep/map；abe3ca69fc5c3f749(sonnet) Q2+Q3；abcec7d711c2be2a8(sonnet) Q4。Arm B — aab83574e19a7a639(sonnet) Q1+Q5 graphify affected；a767eacdfb1ca356c(sonnet) Q2+Q3 graphify query/explain；a0f156253840b80ff(sonnet) Q4 graphify explain/path。Ground truth — a24ffae74acca32cb(opus) Q1–Q5 git show+grep。Facts — a3fc930025188d83f(sonnet) build.md、第一份 judgement、.claude/、uv/Temp 存在性。
checklist: 1 Q1-A answered；2 Q5-A answered；3 Q2-A answered；4 Q3-A answered；5 Q4-A answered；6 Q1-B answered；7 Q5-B answered；8 Q2-B answered；9 Q3-B answered；10 Q4-B answered；11 ground truth Q1–Q5 answered；12 build.md 移除指令／judgement pick／.claude/ 來源 answered

## Summary

### 怎麼跑的

使用者說「你跑跑看這個，看有沒有用」。這次不是拿 graphify 跟一行 grep 比，而是拿它跟一個照常規協定工作的 fankeel-reader 比，題目全部來自 FanKeel 最近的 commit（station-45、station-47、stage-2 周邊）與最常被改到的模組：

- Q1 影響面：改 lib/stages.js 的匯出會壞到誰？（誰 require 它、哪些測試會跟著壞）
- Q5 影響面（兩層）：誰依賴 lib/profile.js，直接與間接？含 profile↔stages 的循環。
- Q2 定位：「停掉但還握著 gate 的 session 在手機頁自成一組」是在哪裡決定的？（station-47）
- Q3 定位：chat.jsonl 的 append 與 trim 共用的那一把鎖在哪？（station-45）
- Q4 docs↔code：docs/ 裡哪些頁在描述 lib/handoff.js？

A 臂（基準）：三個 sonnet 讀者只能用 Grep/Read/git/survey.js/map.md。B 臂（graphify）：另外三個 sonnet 讀者必須從已建好的 18,967 節點零 LLM 圖（`C:\Users\user\AppData\Local\Temp\gfout\graph.json`）出發，用 `query/explain/path/affected`，只准為了確認行號才開檔。基準答案由第七個讀者（opus）用 `git show 975ddfd2`、`git show b0fd12f8` 與完整 grep 獨立建立。所有讀者都未寫入 repo 或 `~/.claude`；graphify 只跑了唯讀子命令，環境變數照 brief 設定。

每位讀者各抽查一行（lib/profile.js:209/234/334、lib/mobile.js:80-84、drive.md:4、tests/stages.test.js:6 與 :1238、todo-patrol.md:550、subagents.md:642、assets/station/mobile.js:326/342、lib/phone.js:100-106、build.md:38-40），全部與讀者所述相符。另外我自己重跑了 `affected "lib/stages.js" --depth 1 --relation imports_from`：15 個非測試檔與 grep 完全相同（2,001 bytes），以及 Q3 的 `query`：2.0 秒、6.6 KB、76 個節點，lib/phone.js 出現在第 5 與第 11 行。

### 對照表（正確性對 opus 基準；token 為讀者自估，tool output bytes ÷ 4）

| 題 | 類型 | A 臂（grep/Read）正確性 | A 臂成本 | B 臂（graphify）正確性 | B 臂成本 | 勝 |
|---|---|---|---|---|---|---|
| Q1 | 影響面 stages.js | 非測試 15/15（含 profile.js:209/234/334 三個 lazy require）；直接測試 15/18（漏 station-routes、task-todo、tour，因一次 24 KB grep 輸出被截成 2 KB 預覽）；間接測試只給計數 | 4 次呼叫，≈4.7k（與 Q5 合計） | 非測試 15/15 行號全對；直接測試 18/18；間接測試 render/detail 對、station 截斷、profile/gate-check/land/ledger 路徑查不到（同名基底檔 "ledger.js" 無法區分 lib/ 與 scripts/） | 約 30 次 graphify 呼叫（含 24+4 次 affected 迴圈）＋3 次 Read，≈9.5k（與 Q5 合計） | 平手，B 兩倍成本 |
| Q5 | 影響面 profile.js 兩層 | 直接 25/25（含 scripts/notify.js:21 行內 require）；第二層漏 bench/station-gather.js:10；循環 ✓ | （同上） | 直接 24/25（漏 notify.js:21）；第二層找到 bench/，漏 scripts/task.js:570；循環 ✓ | （同上） | 平手 |
| Q2 | 定位 station-47 | lib/mobile.js:80-83、:105、tests/mobile-model.test.js:144、tests/station-mobile-route.test.js:180；漏 assets/station/mobile.js:326/342 顯示側 | 3 次，≈2.8k | lib/mobile.js:82-83（靠 Read）、mobileModel() 與 plans/…todo-patrol.md:550（靠圖）、mobile-model.test.js:144（靠 plan 文件轉介）；漏 route 測試與 assets 側 | 約 15 次，≈5.5k | A |
| Q3 | 定位 station-45 | lib/phone.js:100 鎖、:102 append、:104 trim、:106 release、:22-24 註解、tests/phone.test.js:65 與 :53 ——全對 | 4 次，≈0.75k | 同一組行號全對，但每一行都是 Read 170 行得來；graphify 的 append() 指到 lib/ledger.js:158、trim() 指到 lib/registry.js:715，"lock" 配到 tests/suitelock.test.js | 約 12 次，≈6k | A（8 倍成本） |
| Q4 | docs↔code handoff.js | (a) 7 個常設頁 7/7（layout、drive、enforcement、plain-language、registry、station、subagents）；(b) 約 3/10 | 6 次，≈2.25k | (a) 常設頁 3/7（漏 layout.md:53、drive.md:4、enforcement.md、station.md）；(b) 0/10；query 265 節點截 212 個 | 7 次（多為批次），≈5k | A |
| 合計 | | | ≈17 次，≈10.5k | | ≈60+ 次，≈26k | A 4 勝 1 平 |

### graphify 做對與做錯的

做對的：
- `affected <file> --depth 1 --relation imports_from` 的直接 require 清單精準、附行號、輸出小（2 KB），連 lazy 的 `require('./stages.js')`（lib/profile.js:209）都抓到；Q1 的 18 個直接測試一個不漏，反而是基準臂因 grep 輸出被截而漏 3 個。
- `query` 在 Q2 確實把 "Task 8: Stopped sessions…(station-47)" 這個 plan 標題（docs/90-agent/plans/2026-10-22-todo-patrol.md:550）和 mobileModel() 放進前 63 個節點。

做錯或做不到的：
- 函式名歧義：Q3 的 append/trim/lock 全配到別的模組；`explain "held()"` 與 `"hold()"` 回 exit 3（8 個同名）。同名基底檔（"ledger.js"、"task.js"）讓 affected 查第二層時整串回空。
- 無鎖邊、無測試→函式邊：Q2、Q3 哪一個分支在決定、哪一個測試在釘，圖裡都沒有，兩題的關鍵行全是讀檔讀出來的。
- 零 LLM 的 docs→code 邊只靠函式名字串比對（`[references] [INFERRED]`，例如 subagents.md:642 → awaitHandoff()），檔案節點 lib/handoff.js 有 106 條邊卻零 docs 鄰居；drive.md:21、what-runs.md:33 這種用白話描述 handoff 檔的段落對它完全不可見。
- 雜訊：query 預設 2000 token 預算下約七成節點是 tour-ring.js 繪圖函式、archive 計畫標題、無關測試；Q2 的 503 個節點要 15,579 token 才看得全。

### 為什麼選 1（移除），而不是 2 或 3

- 選 2 的條件是「某一類問題 graphify 贏」。它唯一不輸的是「誰直接 require 這個檔」，但那題 grep 一次也 15/15，而且 FanKeel 自己的 lib/requires.js `requireGraph`（context 已記：對 graphify 的精度 99.7%／召回 97.6%）就是同一份邊，map.md 已列出 most-required。要這個能力不必裝 Python 工具；若想要「給一個檔，列出 require 它的 path:line」，在 survey.js 或 map.js 上加一個旗標就是了（建議，非本題結論）。
- 選 3 的條件是「只有 Phase B 能解的懸案」。兩臂都弱的只有 Q4(b)（白話描述 handoff 檔的頁面），Phase B 的 LLM 語意抽取理論上能補；但它要對 8,218 個 docs 節點做 LLM 抽取與社群命名（用 claude-cli 後端即吃訂閱額度，且每次 `update` 後重跑），並會寫 `graphify-out/` 進 repo、`~/.claude/skills/graphify`。第一份 judgement 已說「永不在 FanKeel 旁裝常駐層」，而基準臂用 grep 已能 3/10，問題在讀者沒讀 what-runs.md、pipeline.md 這類頁，不在工具。代價與風險都不值得為 Q4(b) 再開一輪。

白話結論：這個工具對 FanKeel 的真實問題，沒有一題比平常的 grep＋讀檔更準，卻要花兩倍半的 token、多三倍以上的呼叫；它唯一做得好的「誰引用這個檔」FanKeel 自己早就有。移除。

### 移除指令是否完整（選 1 要確認的）

build.md:38-40 的三行：
```
uv tool uninstall graphifyy
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\gfout","$env:LOCALAPPDATA\Temp\gfa.py","$env:LOCALAPPDATA\Temp\gftruth.js","$env:LOCALAPPDATA\Temp\gf_base_status.txt"
git -C F:\ymlab\fankeel status   # 應與開始前相同
```
讀者 a3fc930025188d83f 確認：`uv tool list` 只有 graphifyy v0.9.93（含 ~/.local/bin/graphify.exe、graphify-mcp.exe，uninstall 會一併移除）；`~/.graphify`、`~/.claude/skills/*graph*`、`~/.claude/commands/*graph*`、settings.json 皆無；Temp 只有 gfout（42 MB），無 graphify*；repo `git status` 無 graphify-out/.graphify*/raw。repo 根目錄那個 untracked `.claude/` 是 agents 副本＋worktrees，與 graphify 無關，不要刪。**需補一條**：clone 仍在 `F:\ymlab\fankeel\.fankeel\build\ask\src\graphify`（.fankeel 被 ignore，所以 git status 看不見），移除時一併 `Remove-Item -Recurse -Force`。

### 若使用者仍想跑 Phase B（供參，不是本判斷的建議）

它會測：`graphify install --project` 後由 `/graphify` skill 以 LLM 抽取語意邊，再問同一組 Q2/Q3/Q4(b)，看 `explain "lib/handoff.js"` 是否出現 drive.md:21、what-runs.md:33，以及 `query "chat.jsonl lock"` 是否直接給 lib/phone.js:100。它會寫：repo 內 `graphify-out/`（graph.json、GRAPH_REPORT.md、graph.html，約 40 MB 級）、`~/.claude/skills/graphify/`、可能的 git hook。成本：對 ~19k 節點／8.2k docs 段落的抽取與命名走 claude-cli 後端，等於數十到上百次模型呼叫的訂閱額度，且每次重建重付。

### 沒能查核的

- 兩臂的 token 數是讀者自估（bytes/4），B 臂 Q1 的「一次呼叫」實為 24 次 affected 迴圈，實際呼叫數比表中更多，方向不變。
- 間接測試清單（經 render/detail/station/profile 到達的測試）兩臂都未逐檔開檔核對，我也只比對了直接層。
- 我沒讀 tests/mobile-model.test.js:144 與 tests/phone.test.js:65 的測試本體，只核對了標題行。
- Q4(b)「白話描述」的基準本身是 opus 讀者的判斷（confidence: medium），兩臂在這題的分數有解讀空間，但不影響勝負方向。

已寫入 `F:\ymlab\fankeel\.fankeel\build\task-20261022T144009\context.md` 三條事實（session 23fd8947）：affected 直接 require 清單與 grep 相同但同檔多個 require 會合併成一條邊；定位題 graphify 只指到檔不指到行、成本約 2 倍；零 LLM 圖的 docs→code 邊只靠函式名、檔案節點零 docs 鄰居。
