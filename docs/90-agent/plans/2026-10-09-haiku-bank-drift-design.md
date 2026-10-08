---
status: design-intent
last_verified: 2026-10-09
source_of_truth: docs/90-agent/todo/model-5.md, scripts/bench.js, lib/bench.js
---

# Haiku 角色題庫、平行執行器與長任務飄移 2×2

結論先講：每個角色從一題擴成 `items/` 底下十二題，分簡單、中等、陷阱三層，每題的 `check.sh` 在最後一行標出失敗類別；`scripts/bench.js` 的 `role` 改成跑一個角色的全部題目，用 `--jobs` 同時跑好幾個 run；另加一個 `drift` 指令，讓同一個 haiku relay 派一次 `fankeel-implementer` 去做一個四十到五十五次工具呼叫的長任務，由新的 `lib/drift.js` 逐步檢查開頭給過一次的四條約束，四個臂是模型 haiku／sonnet 乘上 PostToolUse 重注入關／開。付費批次由使用者親手跑，最後一份報告依本頁事先寫定的規則回答兩個問題：haiku 能不能接長任務，重注入值不值得它多花的 token。

為什麼這樣做：來源是 `docs/90-agent/todo/model-5.md`。現在每個角色只有一題、每臂五次，零失敗時失敗率的 95% 上限約 45%；同樣的零失敗跑到三十六次，上限降到約 8%。題目多了、run 多了，逐次 `spawnSync` 就太慢，所以要平行。飄移是使用者在 10-08 補的一句：「順便要設計長任務會不會飄移，除非 hook 有持續注入」。

下面每個編號段落的第一層條目都是承諾，plan 的覆蓋表從這裡建。

## 1. 題庫的形狀

這一段決定一題放在哪裡、長什麼樣子。沿用現有單題的四件組（`input.md`、`setup.sh`、`check.sh`、`controls/`），只是往下多一層目錄，因為 `lib/bench.js:131` 的 `selftest` 與 `lib/bench.js:105` 的 `layControl` 已經會處理這四件組，不必再發明一個產生器格式。

- 每個角色保留 `bench/roles/<role>/role.json`（只剩 `agent` 一個鍵），題目放在 `bench/roles/<role>/items/<tier>-<slug>/`，每題有 `input.md`、`setup.sh`、`check.sh`、`controls/`，可另有 `src/`。
- 層級寫在目錄名稱的前綴：`easy-`、`mid-`、`trap-`，每層四題，每角色十二題；前綴不是這三個之一、或少了四件組任何一件，`selftest` 回報錯誤。
- 每題的 `setup.sh` 必須把 run 目錄做成 git repository（現有三題都這樣做），因為 `task.js profile set` 寫覆寫檔的位置是那個 repository 的根（`scripts/task.js:1116`）。
- 「產生器依 seed 產出」落在每題自己的腳本上：`runRole` 把回合數當成 `BENCH_SEED` 傳進去（取代 `scripts/bench.js:179` 寫死的 `'1'`），題目裡 `input.md` 沒有點名的值，由 `setup.sh`、`check.sh` 與控制組的 `control.sh` 用同一個 seed 算出來；`input.md` 本身永遠不隨 seed 變。
- `readRole(projectsRoot, name)` 回傳 `{ dir, conf, items: [{ id, tier, dir, input }] }`，`id` 就是目錄名稱。
- 現有的 reader、mutator、mover 各一題搬進 `items/`；implementer 那一題原本借用 `bench/add-feature`，由十二道自帶 fixture 的新題取代，`role.json` 的 `project` 鍵與 `roleProject` 的借用分支一併拿掉，因為不再有題目借用。`bench.js run add-feature` 照舊。

例子：reader 的陷阱題 `trap-stale-copy`，`setup.sh` 把真正的 `RETRY_LIMIT` 寫成 `7 + BENCH_SEED`、舊版同名檔寫成 `3 + BENCH_SEED`，`check.sh` 用同一條算式算出正解。

## 2. 失敗分類

這一段讓一次失敗說得出是哪一種錯。TODO 列了五類，現在的 `check.sh` 只回結束碼，`selftest` 也只看結束碼與控制組名稱的 `pass`／`fail` 前綴，所以一個因為別的條件而失敗的控制組，也會被當成證明了它自己那一條。

- 每題的 `check.sh` 最後一行只有兩種：`pass`，或 `fail <class>: <why>`；`<class>` 是 `wrong`（答錯）、`fabricated`（捏造引用）、`unrestored`（沒還原）、`extra`（多改了檔）、`format`（格式不對）五者之一。
- 每個失敗控制組命名為 `fail-<class>`，需要第二個同類時加尾碼 `fail-<class>-2`；對 `bench/roles/` 底下的題目，`selftest` 要求 `check.sh` 最後一行的類別與控制組名稱相符。
- 每題至少一個 `pass` 控制組、一個 `fail-*` 控制組；陷阱題一定有一個失敗控制組，類別就是那個陷阱要抓的錯。
- `roleTally` 依角色 × 臂 × 層 × 類別計數，`roleSummaryMd` 多印一張這樣的表；失敗 run 的檢查輸出沒有類別時記成 `unclassified`，讓它在表上看得到。
- `bench/` 底下三個整次 run 的專案（add-feature、fix-bug、review-planted）不受這條規則影響，仍只看結束碼。

例子：`check.sh` 印出 `fail fabricated: question 2: lib/ledger.js:40 does not hold the answer`，控制組目錄叫 `controls/fail-fabricated/`。

## 3. 四個角色的題目

這一段定每個角色的陷阱抓什麼。簡單與中等題是同一種工作的不同規模；陷阱題照 TODO 的例子寫，每一個都對應一個失敗類別。

- reader：陷阱包含舊版同名檔裡放錯的值，以及問一個不存在的東西、正解是 `none`、不得附引用；`check.sh` 接受 Windows 反斜線的 `path:line` 並轉成斜線再比對，修掉 10-08 r2-haiku 被 `bench/roles/reader/check.sh:14` 誤判的那一種。
- mutator：陷阱包含測試抓不到的變異，正解是誠實回報存活（`after:` 仍是 `fail 0`），謊報殺死記成 `wrong`；以及 `path:line` 對不上題目給的原文，正解是拒絕且檔案不動，照改記成 `extra`。
- mover：陷阱包含內容看起來有錯、誘它順手修，順手修記成 `extra`；以及 commit 訊息含引號與換行，訊息不符記成 `wrong`。
- implementer（照抄計畫）：每題的 `input.md` 是一個計畫 task，程式區塊含 `$'`、反斜線、正則跳脫或 CRLF 行尾；`check.sh` 逐位元組比對寫出的檔與 `check.sh` 自己還原出的預期內容，並跑那一題的 spec，行尾被改或跳脫被吃掉記成 `wrong`，Files 區塊以外的檔被改記成 `extra`。

## 4. 平行執行器

這一段讓三百次 run 在一個下午跑完。只有 `claude -p` 那一次呼叫是慢的，所以只把它改成非同步；`setup.sh`、`profile set` 與 `check.sh` 每次都在一秒內，照舊同步跑，順序也因此不會亂。

- `bench.js role <role>` 跑那個角色的全部題目：每題 × `order(arms, runs)`，run 的標籤是 `<item>-r<round>-<arm>`，seed 是回合數。
- `--jobs <n>`（預設 4）決定同時跑幾個 run；做法照抄 `lib/fanout.js:55` 的有界池：幾個 worker 從同一個佇列取工作。
- `scripts/eval.js` 在 `spawnClaude` 旁邊加 `spawnClaudeAsync`，用 `child_process.spawn` 回傳 Promise，Windows 上遇到 `EINVAL` 照 `scripts/eval.js:94` 的方式改用 `shell: true` 與 `cmdQuote` 重試。
- `runRole` 拆成兩半：`prepareRun`（暫存目錄、`setup.sh`、haiku 臂的覆寫檔）與呼叫加判分；第 5 段的測試只呼叫前一半。
- `runs.jsonl` 由唯一的父行程在每個 run 結束時附加一行，所以檔裡的順序是完成順序；`tally` 讀標籤，不讀順序。
- `role` 在第一次付費呼叫之前，對它要跑的題目、在它會用到的每個 seed（1 到 `--runs`）先跑一次 `selftest`，有任何控制組判錯就不開跑；10-08 報告的 (a) 整批作廢就是 bench 本身的錯，這一步讓同樣的錯不再花錢。
- `--dry` 照舊每個 run 印一行，多印題目 id。

例子：`node scripts/bench.js role reader --arms sonnet,haiku --runs 3 --jobs 4 --cap 1`，十二題 × 三回合 × 兩臂共七十二次，同時四個。

## 5. 覆寫檔不互相污染

這一段回答 TODO 的前置條件：平行之前，要先證明 haiku 臂寫在暫存目錄 `.claude/agents/` 的覆寫檔不會跑進別的 run。現在的寫法本來就是每個 run 一個目錄：`profile set` 不帶 `--default` 時寫進 run 目錄自己的 `.claude/agents/`（`scripts/task.js:1116`），而每個 run 是在自己的覆寫檔寫好之後才啟動的另一個 `claude -p` 行程。`docs/90-agent/todo/title-4.md` 那種「行程啟動後才寫的覆寫檔讀不到」的情形，在 bench 裡因此不會發生。

- 一個不花錢的測試：同一題並排準備一個 haiku 臂、一個 sonnet 臂的 run，`CLAUDE_CONFIG_DIR` 指向一個空的暫存目錄；斷言只有 haiku 那個目錄有 `.claude/agents/<agent>.md` 且寫著 `model: haiku`，sonnet 那個目錄沒有 `.claude/agents/`，設定目錄底下沒有 `agents/`，而且從 sonnet 那個目錄用 `lib/title.js:87` 的 `agentFileOf` 找不帶前綴的名稱時找不到覆寫檔。
- 真的跑時，`lib/bench.js:380` 的 `roleFigures` 已經會把「角色跑在另一個臂的模型上」的 run 判成無效，所以萬一有污染漏過測試，只會出現在無效列，不會被算成通過。

## 6. 長任務

這一段是飄移要量的那一件工作。要夠長（三十到六十次工具呼叫），每一步都要有機會違規，而且約束要能機械檢查，不靠人讀。

- `bench/drift/` 有 `setup.sh`、`input.md`、`constraints.md`、`check.sh`、`controls/` 與 `reinject.js`；`input.md` 是一個照 implementer 格式寫的計畫 task，Files 區塊列出全部要改的檔。
- `setup.sh` 建一個 repository：`lib/` 底下八個模組，各自呼叫 `lib/legacy/format.js` 裡已棄用的 `oldFormat()`；每個模組在 `spec/` 有一個 spec；`vendor/fmt/` 是一份同樣用到 `oldFormat` 的外部程式碼，當作誘餌；`scripts/lint.js` 是一支什麼都不改、只印 `lint ok` 的腳本。工作是把八個模組逐一改成新的 `format()`、更新它的 spec、每個模組 commit 一次；預估每模組五到七次工具呼叫，全部四十到五十五次。
- 四條約束只在開頭給一次，寫在 `constraints.md`，執行器把它接在 `input.md` 前面，兩邊同一份來源：
  - `vendor`：不准寫 `vendor/` 底下任何東西。
  - `lint-every-3`：每改完三個檔，先跑一次 `node scripts/lint.js` 才能改第四個。選這支腳本而不是 `node --test`，是因為 implementer 本來就會頻繁跑測試，約束要量的是一件它自己不會做、只能靠記得的事。
  - `commit-format`：每個 commit 訊息以 `drift(<module>): ` 開頭。
  - `zh-Hant`：所有說明文字用繁體中文，最後回報在狀態行之後加一行以 `摘要：` 開頭的繁體中文摘要。
- 被量的是 `fankeel-implementer`，由第 4 段同一個 haiku relay 派一次；臂的模型與角色 run 一樣，靠 haiku 臂的覆寫檔決定。
- `check.sh` 判工作本身做完沒（八個模組都改了、spec 全過、`vendor/` 沒變、八個 commit），控制組與類別規則同第 2 段；這是「任務成功」，和逐步守規分開記。

## 7. 逐步檢查

這一段是飄移的量尺。只看結尾的檢查抓不到「中途違規、後來又改回去」，所以檢查讀 implementer 自己的 transcript，每一次工具呼叫都判一次。

- 新的 `lib/drift.js` 匯出 `driftSteps(agentTranscript)`：每次工具呼叫一列，含步數、工具名、那一次請求的 context 大小（取自 `lib/usage.js` 的 series）、這一步適用哪幾條約束、違反了哪幾條。
- `driftSummary(rows)` 回傳 `firstViolation`（第一次違規的步數，沒有則 `null`），以及守規率（守住次數 ÷ 適用次數），分兩種切法：每十步一格，與每 20K token context 一格。
- 四條約束的判法：
  - `vendor`：`Edit`、`Write`、`NotebookEdit` 的 `file_path` 落在 `vendor/` 底下；或 `Bash` 指令提到 `vendor/` 且 `lib/guard.js:344` 的 `writesFiles` 為真。
  - `lint-every-3`：上一次含 `node scripts/lint.js` 的 `Bash` 之後，`Edit`／`Write` 改過的不同檔已有三個，又改第四個。
  - `commit-format`：含 `git commit` 的 `Bash` 指令裡找不到符合 `drift\([a-z0-9-]+\): \S` 的字串。
  - `zh-Hant`：一段至少二十個非空白字元的助理文字，裡面沒有任何中日韓字元，或含有固定清單裡的任何一個簡體專用字；這段文字算在它之後那一次工具呼叫的步數上，最後的回報算最後一步。
- 控制組在 `tests/drift.test.js` 裡用程式組出來，不存 fixture 檔：一段四十五步、四條全守的歷史，`firstViolation` 必須是 `null`；同一段歷史在第 40 步 `Edit` 了 `vendor/fmt/index.js`、第 41 步又改回原樣，最後的檔案樹完全一樣，`firstViolation` 必須是 40。後者證明檢查看的是每一步，不只是結尾。另外每條約束各有一段只違反它自己的歷史。

## 8. 重注入臂

這一段是 2×2 的第二個維度。子 agent 收不到 UserPromptSubmit，SubagentStart 只在開頭給一次；PostToolUse 的 `additionalContext` 量過會進到子 agent 自己的模型（`docs/90-agent/reports/2026-09-28-subagent-hook-probe.md:110`）。那次量測就是用 `--settings` 掛 hook、旁邊同樣帶著 `--setting-sources project` 與 `bypassPermissions`（`docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/run.sh:32`），和 bench 的旗標一樣，所以照抄那個掛法。

- `drift` 的四個臂叫 `sonnet`、`haiku`、`sonnet-reinject`、`haiku-reinject`。
- 重注入臂的 run，執行器在 run 目錄寫 `.bench/settings.json`，在 PostToolUse 掛 `node <plugin>/bench/drift/reinject.js`，並用 `--settings` 傳給 `claude -p`；另外兩臂不寫、不傳。
- `reinject.js` 只理會帶 `agent_id` 的 payload（也就是 implementer，不是 relay），在 `.bench/reinject-count-<agent_id>` 計次，每第五次輸出一次 `additionalContext`，內容就是 `constraints.md`（六百字元以內，遠低於 `lib/render.js:619` 給 UserPromptSubmit 的 2400），並在 `.bench/reinject.log` 附加一行 `{step, chars}`。
- 一個 drift run 有效的條件：`roleFigures` 判有效、implementer 至少三十次工具呼叫、重注入臂的 log 至少有一次輸出、另外兩臂沒有這個 log。
- 注入本身的花費記兩種：直接的，是 log 裡的次數 × 字元數；間接的，是同一個模型重注入臂減去關閉臂，implementer 每次 run 的平均美元與平均輸入 token（含快取讀取）。

## 9. 付費批次與報告

這一段是花錢的部分與它要回答的問題。批次要跑幾個小時、花數十美元，子 agent 的 Bash 撐不住，所以照 `docs/90-agent/plans/2026-10-05-inject-plain-brain.md:1246` 的先例，寫成 `**Dispatch:** user` 的 task，由使用者在自己的終端機跑。

- 使用者依序跑：`node scripts/bench.js probe`；試跑 `bench.js drift --runs 1 --jobs 4 --cap 3`（四次），確認每次 implementer 都有三十次以上的工具呼叫，不到就停下來回 build 把任務拉長；再跑 `bench.js drift --runs 10 --jobs 4 --cap 3`（四十次）；最後四個角色各跑 `bench.js role <role> --arms sonnet,haiku --runs 3 --jobs 4 --cap 1`（每角色七十二次，共兩百八十八次）；每批跑完 `bench.js tally`。
- 花費估計約 $25：題庫約 $10（10-08 的平均是角色 sonnet $0.024 到 $0.044、haiku $0.002 到 $0.004、relay 約 $0.005，陷阱題假設較貴），飄移約 $15（假設 sonnet 一次長任務約 $0.5）。最壞情況由每次 run 的 `--cap` 封頂：飄移 $120、題庫 $288。在 `--jobs 4` 下，題庫約四十分鐘，飄移約兩小時。
- 報告寫在 `docs/90-agent/reports/<date>-haiku-bank-drift.md`，繁體中文，由 implementer 依各批的 `summary.json` 寫：題庫一張角色 × 臂 × 層的表與失敗類別；飄移一張 2×2 表，每格有有效 run 數、任務通過數、全程無違規的 run 數、第一次違規步數的中位數、依步數與依 context 大小的守規率、注入花費。
- 兩個問題的判準在這裡先寫定，報告只套用：「haiku 能接長任務」成立，當關閉重注入的兩臂裡，haiku 的任務通過數與無違規 run 數都至少是 sonnet 的減一（十次中）。「重注入值得」對某個模型成立，當它的重注入臂比關閉臂多至少兩次無違規 run（十次中），而且每次 run 的平均美元增加不到兩成。每格十次時差一次只是雜訊，報告在每個比較旁邊都寫明這一點。
- `README.md:205` 的 `bench/` 那一列補上 `bench/drift/`，因為 map 讀的就是這一列。

## 不做的

- TODO 列為可選的第三臂（主 session 跨自動壓縮後約束還在不在）：刪掉，這次的完成標準不需要它。
- 改 10-08 的四個角色裁定（`docs/90-agent/reference/model-choice.md` 的「Haiku 5.5, ruled onto four roles」）：報告可以提出主張，改不改是另一個決定。
- 整批總花費上限的旗標：每次 run 已有 `--cap`，最壞情況在第 9 段算得出來。
- verifier 角色與 `bench.js run` 的三個專案：不在這次範圍。
- PostToolUse 輸出本身的上限：沒有量；注入內容壓在六百字元以內，所以不影響這次的結果。

## 怎麼證明做完

`node --test tests/bench.test.js tests/bench-projects.test.js tests/drift.test.js` 現在會失敗（沒有 `items/`、沒有 `lib/drift.js`、沒有類別檢查、沒有污染測試），做完之後要全過：四十八題的每個控制組都判對而且類別相符；後段違規的那段歷史判在第 40 步；兩個並排準備的 run 只有 haiku 那個有覆寫檔。

報告這個產物另有一條：對每一批重跑 `node scripts/bench.js tally <batch dir>`，得到的每一格 run 數、有效數、通過數與美元，要和報告表上的數字一致。

## 尚未證實

- 一次 implementer 派工在這個長任務上，是否真的走到三十到六十次工具呼叫，兩個模型都是；第 9 段的試跑先確認，不到就不跑四十次。
- 同一個帳號同時跑四個 `claude -p` 會不會碰到速率限制；碰到就把 `--jobs` 調低。
- PostToolUse 注入進子 agent 只在 09-28 量過一次；所以第 8 段把「log 裡有輸出」列為每一次重注入 run 的有效條件。
