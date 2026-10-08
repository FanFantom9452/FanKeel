---
status: current
last_verified: 2026-10-08
source_of_truth: lib/bench.js, scripts/bench.js, hooks/title.js, docs/90-agent/reference/model-choice.md
---

# 四個角色為什麼改跑 Haiku 5.5，按角色的實驗台量到什麼

## 決定

- 2026-10-08 使用者裁定 `fankeel-mutator`、`fankeel-mover`、`fankeel-implementer`（只限計畫已經寫好程式碼的地方，也就是計畫 Dispatch 行的 `implementer, haiku`）和 `fankeel-reader` 改跑 haiku。出處是 `docs/90-agent/reference/model-choice.md` 的 b 項：「Settled 10-08: `haiku` for `fankeel-mutator`, `fankeel-mover`, `fankeel-implementer`」。
- 其他角色（reviewer、verifier、brain 等）沒有裁定，沒有任何 profile 或計畫對它們送 `haiku`。
- 09-29 的「haiku 不行」裁定針對的是 Haiku 4.5，當時沒有數字撐著。Haiku 5.5 改用 `scripts/bench.js`（邏輯在 `lib/bench.js`）重量一次，一次一個角色。
- 實驗台的做法：每個 run 在可重置的暫存目錄裡跑，每個角色在 `bench/roles/<role>/` 下有及格與不及格的對照組，每個臂跑 5 次（haiku 對 sonnet），只算那個子 agent 自己的 token 與花費。
- 量的過程中找到並修了一個 bug：派工上明寫的 `model` 會蓋過 profile override 釘的模型。`hooks/title.js:38` 現在是 `if (pinned && typeof input.model === 'string' && input.model !== pinned) next.model = pinned;`，讓 override 的模型取代明寫的模型。`lib/title.js:127` 的 `overrideModel` 負責讀出 override 釘的模型；若它與外掛檔案的模型相同，就視為不是使用者設的，回傳 null。
- 使用者要自己用 `node scripts/task.js profile set agent.fankeel-<role>.model haiku` 逐一設定。這份決策與 model-choice 頁都沒有改 profile。

## 為什麼

- 結果見 `docs/90-agent/reports/2026-10-08-haiku-bench.md`，批次摘要在 `docs/90-agent/reports/evidence/2026-10-08-haiku-bench/` 各目錄的 `summary.md`。以下數字我都對過兩邊，報告表與 summary.md 一致。每個角色取報告指定的有效批次，花費是子 agent 自己的合計（美元，5 次）：

  | 角色 | 批次 | sonnet 通過 / 有效 | haiku 通過 / 有效 | sonnet 合計 | haiku 合計 |
  |---|---|---|---|---|---|
  | mutator | role-mutator-20261008T132213 | 5 / 5 | 5 / 5 | 0.1161 | 0.0101 |
  | mover | role-mover-20261008T141648 | 5 / 5 | 5 / 5 | 0.0682 | 0.0049 |
  | implementer | role-implementer-20261008T141917 | 4 / 4 | 5 / 5 | 0.2217 | 0.0183 |
  | reader | role-reader-20261008T143157 | 4 / 5 | 4 / 5 | 0.0787 | 0.0065 |

- mutator、mover、implementer 三個角色的 haiku 臂 n/n 有效且全過，報告的結論行都寫 `haiku`。
- implementer 的 sonnet 臂只有 4 個有效：r5-sonnet 因為 relay 被派了兩次而無效。所以 sonnet 合計 0.2217 是 4 次，不是 5 次，平均 0.0443 對 haiku 的 0.0037。
- reader 沒有達到報告自己的門檻（haiku 臂 n/n 過），報告結論行寫 `not haiku`。重跑那批兩個臂各一個沒過：sonnet 的 r1 第 3 題答了 DEFAULT_PORT 而不是 8417，是真的答錯；haiku 的 r2 答案都對，但路徑寫成 Windows 反斜線，`check.sh` 的路徑檢查認不出來，是 bench 太嚴。使用者看過後推翻這個結論行，仍把 reader 放上 haiku。這是使用者的裁定，不是量出來的 n/n。
- 作廢的批次不算數：role-reader-20261008T141426 是 bench 沒剝掉 task-notification 外殼的缺陷（commit 967fa8ae 修正）；role-mutator-20261008T130828 的 r4-haiku 實際跑在 sonnet 上，所以該臂 5 個只有 4 個有效。
- 找到 bug 的來源是 fix-bug 整次 run（fix-bug-20261008T092518）：sub 臂 3 個 run 全部無效，原因是 `fankeel-mutator` 跑的是 `claude-sonnet-5-5`（r1、r3），r2 則是四個角色一個都沒派。那批的結論行是 `fix-bug: base`，也就是整次 run 沒有任何子 agent 臂比 base 便宜又全過。
- 價格：`lib/prices.js` 現在有 `claude-haiku-5-5` 自己的一列（輸入 0.1、輸出 0.5，美元每百萬 token），提示超過 100K 的請求另記在 `claude-haiku-5-5>100k` 列（0.5、2.5）。檔案註解說這兩列是 2026-10-08 依核准的 design 加入，沒有重讀價目頁。Haiku 4.5 一列是 1 與 5。所以 Haiku 5.5 的價格來源是 design，不是官方價目頁，這點沒驗證過。
- 花費差距：以上表的合計相除，mutator 約 11.5 倍、mover 約 13.9 倍、reader 約 12.1 倍；implementer 以平均相除約 12 倍（sonnet 只有 4 次）。這是子 agent 自己的花費，不含 relay。

## 沒做的

- 沒量 Agent tool 路徑與 `claude -p` 路徑的差別。外部報告自己也寫「量的是 `claude -p` 路徑；Agent tool 子代理的前綴大小與快取行為可能不同，未量」；本實驗台的 run 是在 `claude -p` 底下派子 agent，沒有在互動 session 的 Agent tool 上重做。
- 沒量價目頁。Haiku 5.5 的兩列價格出自 design，沒有對官方價目重讀；fix-bug 表的 over 100K 欄全是 0；角色批次的表沒有這一欄，我沒有核對。
- 每個臂只有 5 次（fix-bug 是 3 次），n/n 全過不等於失敗率為零，也沒有統計檢定。
- 角色輸入是單一任務形狀，每個角色一組輸入加兩側對照組。實際 build 裡更大、更雜的 mutator、reader、implementer 工作沒有量。implementer 只量了「計畫已有程式碼」那一種，不能推到要自己想的實作。
- reader 的 haiku 臂沒有 n/n 過，是使用者推翻了報告的結論行；路徑檢查太嚴這點，我沒有看到修過的紀錄，所以那一批不是乾淨的證明。
- 三個批次（reader、mover、implementer）與 reader 重跑是在另一台機器 DESKTOP-DE33TOH 上跑的，那台載入了帳號的 claude.ai connector。報告記有一個 haiku run 在 Grep 結果裡看到要它建立文件的文字，agent 回報了並沒有照做；這個因素沒有控制。
- 外部 228 次 `claude -p` 的測量證據在另一個 repository，本 repo 無法重算（`docs/90-agent/reports/2026-10-08-external-model-bench.md`）。
- 這份決策沒有跑 `profile set`，所以當下 profile 仍是 sonnet；四個角色真正跑在 haiku 要等使用者設定後，在實際的 build 與 verify 裡才看得到。
- 計畫與設計存放在 `docs/99-archive/2026-10-08-haiku-bench-design.md`、`docs/99-archive/2026-10-08-haiku-bench.md`、`docs/99-archive/2026-10-08-haiku-bench-roles.md`。
