---
status: design-intent
last_verified: 2026-10-08
source_of_truth: lib/prices.js, lib/usage.js, scripts/eval.js, docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
---

# Haiku 5.5 的派工與可重置的模型實驗台

這份設計回答兩件事。第一，Haiku 5.5 是不是只能當最簡單的子 agent：答案是「不知道，但值得在四個子 agent 角色上量，brain 和整個 session 只放一個對照臂」。第二，怎麼做一個能重置、能重複、能算清楚 token 與錢的實驗台：答案是把專案現成的兩種重置方式（`scripts/eval.js` 的暫存目錄加 scaffold、`ab.sh` 的 `git worktree add --detach <sha>`）收成一支 `scripts/bench.js`，任務成敗由每個專案自帶的檢查指令判定，花費從 transcript 逐個 request 算。

為什麼是這個形狀：2026-09-29「haiku 暫不用」的裁定（`docs/90-agent/reference/model-choice.md:23`）是對 Haiku 4.5 做的，而且沒有數字；唯一一次 haiku 量測（`docs/90-agent/reports/2026-09-09-haiku-pair.md`）是 Haiku 4.5 當母 session、n=1、沒查對錯。要推翻或維持那條裁定，需要的是「同一題、同一起點、只差一個模型」的成對數字，而這正是 `ab.sh` 已經寫好的方法，只是它綁死在 brain 的 opus 對 sonnet 上。

## 1. 先修量測：Haiku 5.5 的價錢

今天 `lib/prices.js:31` 沒有 Haiku 5.5，它被估成 Haiku 4.5 的 $1/$5 並標 `estimated`，比實價 $0.10/$0.50 高十倍。而且 Haiku 5.5 的價錢在 prompt 超過 100K 時跳到 $0.50/$2.50，這條線是按「每一個 request」算的：一個 subagent 每個 request 都重送整個 context，所以同一次 run 裡前半段便宜、後半段貴。只把整次 run 的 token 加總，看不出哪些 request 在線的哪一邊。

- `lib/prices.js` 加 `claude-haiku-5-5` 一列（input 0.10、output 0.50、cacheRead 0.01、cacheWrite5m 0.125、cacheWrite1h 0.2），另加一列 `claude-haiku-5-5>100k`（0.50、2.50、0.05、0.625、1.0），`verified` 改成讀到這組數字的日期。
- `lib/usage.js` 的 `summarise` 在記帳時，對 prompt 大小（`contextOf(usage)`，即 input 加 cache read 加 cache write）超過 100,000 的 Haiku 5.5 request，記在 `claude-haiku-5-5>100k` 這個 id 底下；其餘照舊。這樣 station、`scripts/spend.js` 和實驗台都不必改，就會按 request 落在線的哪邊計價，而且「有幾個 request 過線」直接讀得到。
- 取捨：station 的模型欄會出現 `claude-haiku-5-5>100k` 這個不是真模型的 id。這是刻意的，它讓過線看得見；代價是任何按 model id 比對字串的地方要認得這個後綴，build 要 grep 一次 `claude-haiku` 的使用處。

## 2. 實驗專案：可重置的起點

一個「實驗專案」是 `bench/<name>/` 底下三個檔案：`setup.sh`（從零建出專案，或把 fankeel 本身切到某個 sha）、`task.md`（交給 session 的任務原文）、`check.sh`（任務做完沒有，exit 0 才算過；跑的是 agent 看不到的隱藏測試）。重置就是「丟掉這次的目錄、重新跑 `setup.sh`」，所以每一次 run 都從同一個起點開始，不需要還原腳本。

- 起手三個專案，涵蓋三種任務形狀：一個合成的小 JS 專案修一個有失敗測試的 bug（機械活）、一個合成專案加一個小功能並補測試（照計畫實作）、fankeel 本身在固定 sha 上做一條真實 TODO（走完整 plan、build、verify，最接近實戰）。
- 合成專案用暫存目錄加 `setup.sh`（`scripts/eval.js:85` 的做法）；fankeel 本身用 `git worktree add --detach <sha>`（`ab.sh` 的做法），因為它要用到 `.fankeel/` 和 plugin 本身。
- `check.sh` 放在 `bench/<name>/` 而不是複製進專案目錄，agent 讀不到答案。

## 3. 實驗臂：Haiku 5.5 放在哪裡

一個「臂」是一組模型指派，臂與臂之間只差一個變數。指派用現成的 `task.js profile set agent.<name>.model <m>`（`lib/profile.js:280` 已接受 haiku），在重置後的目錄裡寫好再開跑，和 `ab.sh` 一樣。

- 基準臂：今天的設定，全部 sonnet，brain 在 design、plan 是 opus。
- 子 agent 臂（主要問題）：reader、mover、mutator、verifier 改 haiku，其餘不動。這四個角色的工作形狀固定、有明確的完成回報，最可能撐得住。
- 實作臂：build 的 implementer 改 haiku，只用在計畫的 Dispatch 行寫 `implementer, haiku` 的任務上——`lib/plantasks.js:555` 已經為它設了窄門（讀量減半、每個 Write 步驟附完整程式碼）。這直接量「強模型規劃、便宜模型照計畫實作」這條路。
- 對照臂（只跑一輪）：brain 改 haiku，以及整個 session `--model haiku`。這兩臂預期會輸，跑它們是為了知道輸在哪裡，不是為了採用。
- reviewer、render-reviewer、judge、mockup、writer 不測：它們的錯是漏報或品味，量不出便宜的那一邊值多少。

## 4. 執行與記帳：`scripts/bench.js`

`node scripts/bench.js <project> --arms <a,b> --runs <n> --cap <usd> [--dry]` 跑每個臂 n 次，奇數輪 a 先、偶數輪 b 先（`context-arm-drifts-between-batches` 的教訓：同一迴圈內交替）。每次 run：重置、寫臂的模型指派、`claude -p` 帶 `--setting-sources project --plugin-dir <tree> --max-budget-usd <剩餘預算>`、跑完執行 `check.sh`、把 transcript 和 subagents 目錄複製到 `.fankeel/build/bench/<run>/`。

- 每次 run 記：`check.sh` 過或不過、錢（由 `lib/usage.js` 加 `lib/prices.js` 從 transcript 算，按 `requestId` 去重）、每個模型的 token、過 100K 線的 request 數、殼層牆鐘秒數、主控來回次數（Agent 與 SendMessage 呼叫數）。
- 一次 run 只在「被指派 haiku 的角色真的跑在 `claude-haiku-5-5` 上」時才算有效，從每個 subagent transcript 的 `message.model` 讀（`tally.js` 讀的是 hook 寫進 description 的模型字頭，這裡改讀更直接的 `message.model`）；跑錯模型的 run 列出來、不計入。
- 每次開跑前寫 provenance：HEAD、`git status --porcelain`、`claude --version`、bench.js 的 md5，寫進 `docs/90-agent/reports/evidence/<date>-haiku-bench/`。
- `--dry` 不呼叫 claude，只印出每次 run 的指令與模型指派，用來在花錢前檢查。
- 結果彙整成每臂一列：成功率、平均錢、平均 token、過線 request 數、牆鐘。結論寫成報告進 `docs/90-agent/reports/`，再據此改寫 `model-choice.md` 的 b 項。

## 5. 使用者要決定的事

這些沒有對錯，是預算與風險的選擇，design 只給預設：

- 專案數與任務種類：預設上面三個。
- 每臂次數與每次預算上限：預設每臂 3 次、每次 $5；四個臂乘三個專案乘三次，最壞情況約 $180，實際上 haiku 臂遠低於上限。
- 權限模式：預設 `--permission-mode bypassPermissions`，因為 headless run 沒有人按允許；只在暫存目錄或 detached worktree 裡跑，且每次批次開跑前問一次（`ab-scripts-bypass-permissions` 的規則）。另一個選擇是 `acceptEdits` 加 `--allowedTools` 白名單，比較安全，但 Bash 指令被擋時 run 會卡住而不是失敗，數字會髒。

## 測試

- `tests/prices.test.js`：`rateFor('claude-haiku-5-5')` 回傳 input 0.1 且沒有 `estimated`；現在失敗（回傳 Haiku 4.5 的 1 並帶 `estimated`）。
- `tests/usage.test.js`：一份兩個 request 的 fixture transcript，一個 prompt 90K、一個 120K，都是 `claude-haiku-5-5`，`summarise` 把第二個記在 `claude-haiku-5-5>100k`；現在失敗。
- `tests/bench.test.js`：`--dry` 對一個合成專案印出的每一行都帶該臂的模型指派，且臂的順序奇偶輪交替。
- 產物檢查：bench 的彙整表上，每臂的錢等於它各次 run 的錢相加，且等於從原始 transcript 重算的結果。
