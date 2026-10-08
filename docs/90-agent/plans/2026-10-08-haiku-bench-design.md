---
status: design-intent
last_verified: 2026-10-08
source_of_truth: lib/prices.js, lib/usage.js, scripts/eval.js, docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
---

# Haiku 5.5 的派工與可重置的模型實驗台

這份設計回答兩件事。第一，Haiku 5.5 是不是只能當最簡單的子 agent。答案是不必：另一份外部實測（repo 根目錄的 `model-bench-report.md`，共 228 次）顯示，Haiku 5.5 在有硬門檻的任務形狀上，連寫腳本、審查、多來源驗證、agentic 修復都 n/n 全過，成本只有 Sonnet 5.5 的 1/15 到 1/25。它接不住的是約 45k token 以上、塞在 prompt 裡的計數。第二，怎麼做一個能重置、能重複、能算清 token 與錢的實驗台。做法是把專案現成的兩種重置方式（`scripts/eval.js` 的暫存目錄加 scaffold，以及 `ab.sh` 的 `git worktree add --detach <sha>`）收成一支 `scripts/bench.js`，借用外部實測的方法，量外部實測沒量到的那一段。

為什麼要自己再量：外部實測量的是「單一任務形狀」走 `claude -p` 的結果，它自己在第 10 節列為限制的，正好是 fankeel 派工真正走的路——Agent tool 子代理的前綴與快取沒量；也沒有量到「一個角色在完整工作流裡」的表現，例如 reader 要回傳帶目錄的 `path:line`，mutator 要還原檔案。2026-09-29「haiku 暫不用」的裁定（`docs/90-agent/reference/model-choice.md:23`）是針對 Haiku 4.5 做的，當時沒有任何數字；要推翻它，需要 fankeel 自己角色上的成對數字。外部報告的證據目錄 `model-bench/` 在另一個 repo 的分支上，這個 repo 裡沒有，所以它的數字只能參考，這裡無法重算。

## 1. 先修量測：Haiku 5.5 的價錢

今天 `lib/prices.js:31` 沒有 Haiku 5.5 這一列，它被當成 Haiku 4.5 以 $1/$5 計價並標 `estimated`，比實價 $0.10/$0.50 高十倍。Haiku 5.5 在 prompt 超過 100K 時改收 $0.50/$2.50，這條線是按每一個 request 算的。子 agent 的每個 request 都會重送整個 context，所以同一次 run 裡，前段的 request 便宜、後段的貴；只看整次 run 的 token 總數，分不出哪些 request 落在線的哪一邊。

- `lib/prices.js` 加 `claude-haiku-5-5` 一列（input 0.10、output 0.50、cacheRead 0.01、cacheWrite5m 0.125、cacheWrite1h 0.2），另加 `claude-haiku-5-5>100k` 一列（0.50、2.50、0.05、0.625、1.0），`verified` 改成讀到這組數字的日期。一小時快取寫入計 2 倍 input，這和外部實測核對 228 列的結果一致，也是 `tests/prices.test.js` 已經對每一列檢查的比率。
- `lib/usage.js` 的 `summarise` 記帳時，prompt 大小（`contextOf(usage)`，也就是 input、cache read、cache write 三者相加）超過 100,000 的 Haiku 5.5 request，改記在 `claude-haiku-5-5>100k` 這個 id 下，其餘照舊。這樣 station、`scripts/spend.js` 和實驗台都不必改，就會依每個 request 落在線的哪一邊計價，而且過線的 request 有幾個可以直接讀到。
- 取捨：station 的模型欄會出現 `claude-haiku-5-5>100k` 這個不是真實模型的 id。這是刻意的，好讓過線的 request 看得見；代價是凡是用字串比對 model id 的地方都要認得這個後綴，所以 build 要 grep 一次 `claude-haiku` 的所有使用處。

## 2. 實驗專案：可重置的起點，每個檢查都有兩側控制組

一個實驗專案是 `bench/<name>/` 底下的四樣東西：`setup.sh` 從零建出專案，或把 fankeel 本身切到某個 sha；`task.md` 是交給 session 的任務原文；`check.sh` 判定任務有沒有完成，exit 0 才算過；`controls/` 放一份已知該過、一份已知該不過的終態。重置的方式是丟掉這次的目錄、重新跑 `setup.sh`，因此每次 run 都從同一個起點開始。

- 起手三個合成專案：一個是修一個有失敗測試的 bug；一個是照寫好的計畫加一個小功能並補測試；一個是審查專案，在一份 fixture diff 裡植入四個缺陷，給 reviewer 審。fankeel 本身在固定 sha 上做一條真實 TODO，則放到第二輪。
- 審查專案的 `check.sh` 讀 reviewer 的回報：植入的四個缺陷至少命中三個、每條引文要逐字出現在所指的 `path:line`、假陽性不超過兩個，只要有一條捏造的引文就整份作廢。這是外部實測審查題的門檻，換成 fankeel reviewer 的回報格式。
- 每個 `check.sh` 都必須有兩側控制組：`node scripts/bench.js selftest` 會對 `controls/pass` 與 `controls/fail` 各跑一次，缺一側或判錯一側就報錯。外部實測正是靠這一步，在第一輪就抓到兩個門檻缺陷（把 `__pycache__` 算成改了測試、把換行的引文判成不符）。
- `check.sh` 放在 `bench/<name>/` 而不是複製進專案目錄，所以 agent 讀不到答案；測試檔用 sha256 鎖住，被改就判失敗。
- 有 seed 的專案，第 2、3 次 run 換 seed 重新生成 fixture，避免模型只是記住了同一題。

## 3. 實驗臂：Haiku 5.5 放在哪裡、effort 開多大

一個臂就是一組模型與 effort 的指派，臂與臂之間只差一個變數。指派方式用現成的 `task.js profile set agent.<name>.model <m>` 和 `agent.<name>.effort <e>`（`lib/profile.js:280` 已經接受 haiku 這個值），在重置後的目錄裡設好再開跑，和 `ab.sh` 的做法相同。

- 基準臂：今天的設定，也就是全部 sonnet，brain 在 design 與 plan 階段用 opus。
- 子 agent 臂：reader、mover、mutator、verifier 改成 haiku@high，其餘不動。外部實測量到 Haiku 的 high 比 medium 只多 15% 成本，卻修掉了四分之三的失誤，xhigh 則完全沒有增益，所以預設用 high，不再另開 medium 臂。
- 實作臂：build 的 implementer 改成 haiku@high，只用在計畫 Dispatch 行寫 `implementer, haiku` 的任務上；`lib/plantasks.js:555` 已經為這種任務設了窄門。這一臂量的就是「強模型規劃、便宜模型照計畫實作」這條路。
- reviewer 臂：build 的 reviewer 改成 haiku@high，只在審查專案上跑。2026-10-08 使用者在 design 關卡選了加測 reviewer。外部實測裡 haiku 審查 4/4 命中、0 假陽性，但那不是 fankeel 的 reviewer 與它的回報格式，所以要在這裡量。
- 不跑 brain 臂，也不跑整個 session 換 haiku 的臂：brain 背著長 context，正好是外部實測裡 haiku 在任何 effort 下都不穩的形狀（5/9），花錢去確認一個預期會輸的結果並不划算。

## 4. 執行與記帳：`scripts/bench.js`

用法是 `node scripts/bench.js <project> --arms <a,b> --runs <n> --cap <usd> [--dry]`：每個臂跑 n 次，同一批之內臂的順序依輪次奇偶交替。快取是按模型分開的，所以交替會讓每個模型各付一次冷啟；在一小時的 TTL 內這只發生一次，換來的是兩臂不會因為批次不同而漂移。每次 run 的流程是：重置、寫入這一臂的指派、以 `claude -p` 帶 `--setting-sources project --plugin-dir <tree> --max-budget-usd <剩餘預算>` 開跑、跑完執行 `check.sh`，再把 transcript 與 subagents 目錄複製到 `.fankeel/build/bench/<run>/`。

- 每次 run 記下：`check.sh` 過或不過；花費（以 `lib/usage.js` 加 `lib/prices.js` 從 transcript 算，按 `requestId` 去重）；每個模型的 token；過 100K 線的 request 數；子 agent 的固定前綴大小與快取命中率，這是外部實測沒量到的 Agent tool 路徑；殼層量到的牆鐘秒數；主控來回次數。
- 只有當被指派 haiku 的角色真的跑在 `claude-haiku-5-5` 上，這次 run 才算有效。判斷方式是讀每個 subagent transcript 的 `message.model`；跑錯模型的 run 會列出來，但不計入結果。
- 每批開跑前寫 provenance，內容是 HEAD、`git status --porcelain`、`claude --version` 和 bench.js 的 md5，寫進 `docs/90-agent/reports/evidence/<date>-haiku-bench/`。
- `--dry` 不會呼叫 claude，只印出每次 run 的指令與指派，讓人在花錢前先檢查。
- 裁定規則沿用外部實測：每個角色取最便宜、且 n/n 全過的臂；只要有一次失敗就不算乾淨。結論寫成報告放進 `docs/90-agent/reports/`，再據此改寫 `model-choice.md` 的 b 項。

## 5. 使用者要決定的事

以下這些沒有對錯，是預算與風險的取捨，設計只給預設值：

- 每臂次數與每次預算上限：預設每臂 3 次、每次上限 $5。兩個實作專案各跑基準、子 agent、implementer 三臂，審查專案跑基準與 reviewer 兩臂，每臂三次，共 24 次，最壞約 $120；照外部實測的價差，haiku 臂實際會遠低於上限。
- 權限模式：預設用 `--permission-mode bypassPermissions`，因為 headless run 沒有人可以按允許；只在暫存目錄或 detached worktree 裡跑，而且每批開跑前問一次。

## 6. 外部報告的歸檔

- `model-bench-report.md` 現在是 repo 根目錄裡一個未追蹤的檔案。把它移到 `docs/90-agent/reports/2026-10-08-external-model-bench.md`，開頭加一行，註明證據在另一個 repo、這裡無法重算，並在 `model-choice.md` 的 b 項引用它。

## 測試

- `tests/prices.test.js`：`rateFor('claude-haiku-5-5')` 要回傳 input 0.1，而且沒有 `estimated`。現在會失敗，因為它回傳 Haiku 4.5 的 1 並帶 `estimated`。
- `tests/usage.test.js`：一份有兩個 request 的 fixture transcript，prompt 分別是 90K 與 120K，都是 `claude-haiku-5-5`；`summarise` 要把第二個記在 `claude-haiku-5-5>100k` 下。現在會失敗。
- `tests/bench.test.js`：`selftest` 遇到缺了 `controls/fail` 的專案要報錯；`--dry` 印出的每一行都要帶該臂的指派，而且臂的順序依奇偶輪交替。
- 產物檢查：bench 彙整表上每個臂的錢，要等於它各次 run 的錢相加，也要等於從原始 transcript 重算的結果。
