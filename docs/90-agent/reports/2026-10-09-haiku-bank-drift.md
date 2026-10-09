---
status: current
last_verified: 2026-10-09
source_of_truth: scripts/bench.js, lib/drift.js, lib/bench.js
---

# Haiku 角色題庫與長任務飄移（2026-10-09）

這一頁由 `node scripts/bench.js report` 從各批的 `runs.jsonl` 重算後寫出。兩個問題的判準是設計頁 `docs/90-agent/plans/2026-10-09-haiku-bank-drift-design.md` 第 9 段事先寫定的，這裡只套用。

## 兩個問題

「haiku 能接長任務」成立：關閉重注入時，haiku 任務通過 10、全程無違規 1，sonnet 是 3、0；判準是兩個數都至少是 sonnet 的減一。每格十次時，差一次只是雜訊。

「重注入值得」對 sonnet 不成立：重注入臂全程無違規 1、關閉臂 0，implementer 每次 run 的平均美元多 36%；判準是至少多兩次無違規，而且平均美元增加不到兩成。每格十次時，差一次只是雜訊。

「重注入值得」對 haiku 成立：重注入臂全程無違規 5、關閉臂 1，implementer 每次 run 的平均美元多 11%；判準是至少多兩次無違規，而且平均美元增加不到兩成。每格十次時，差一次只是雜訊。

## 題庫：角色 × 臂 × 層

| 角色 | 臂 | 層 | run | 有效 | 通過 | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | haiku | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | haiku | mid | 12 | 12 | 8 | 1 | 3 | 0 | 0 | 0 | 0 |
| reader | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | haiku | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | haiku | mid | 12 | 11 | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | sonnet | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mutator | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | haiku | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | haiku | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | haiku | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | haiku | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | sonnet | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| implementer | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |

失敗類別只算有效 run；`unclassified` 是檢查的最後一行沒有寫出類別的失敗。

## 飄移 2×2

| 臂 | run | 有效 | 任務通過 | 全程無違規 | 第一次違規步數中位數 | 守規率（每十步） | 守規率（每 20K context） | 注入次數 | 注入字元 | implementer 平均美元 | 平均送出 token |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet | 10 | 3 | 3 | 0 | 11 | 1-10 96%; 11-20 91%; 21-30 87%; 31-40 92%; 41-50 97% | 0K 90%; 20K 97% | 0 | 0 | 0.1920 | 333729 |
| haiku | 10 | 10 | 10 | 1 | 3 | 1-10 70%; 11-20 86%; 21-30 89%; 31-40 89%; 41-50 79%; 51-60 100% | 0K 77%; 20K 87% | 0 | 0 | 0.0169 | 642553 |
| sonnet-reinject | 10 | 3 | 3 | 1 | 37 | 1-10 100%; 11-20 96%; 21-30 96%; 31-40 98%; 41-50 100%; 51-60 100%; 61-70 0% | 0K 97%; 20K 98% | 32 | 9216 | 0.2602 | 547172 |
| haiku-reinject | 10 | 10 | 10 | 5 | 4 | 1-10 82%; 11-20 88%; 21-30 91%; 31-40 90%; 41-50 88%; 51-60 96%; 61-70 100% | 0K 83%; 20K 90% | 94 | 27072 | 0.0188 | 752355 |

注入的直接花費是注入次數乘上字元數。間接花費是同一個模型的重注入臂減去關閉臂：

- sonnet：implementer 每次 run 多 $0.0682，多送出 213443 token（每次請求送出的 token 加總，含快取讀取與寫入）。
- haiku：implementer 每次 run 多 $0.0019，多送出 109802 token（每次請求送出的 token 加總，含快取讀取與寫入）。

## 怎麼重算

每一批重跑下面這一行，表上每一格的 run 數、有效數、通過數與美元都要一樣：

- `node scripts/bench.js tally .fankeel/build/bench/drift-20261009T033354`
- `node scripts/bench.js tally .fankeel/build/bench/role-reader-20261009T033513`
- `node scripts/bench.js tally .fankeel/build/bench/role-mutator-20261009T031134`
- `node scripts/bench.js tally .fankeel/build/bench/role-mover-20261009T034226`
- `node scripts/bench.js tally .fankeel/build/bench/role-implementer-20261009T032559`

## 這次批次的旁註

這一段是手寫的，`bench.js report` 不會產生它；重跑 report 之後要再補回來。

- **sonnet 兩格各只有 3 次有效 run。** 兩臂各 10 次裡有 7 次只用了 3 到 10 次工具呼叫就做完整個長任務：先用一次 `cat` 讀完其餘七個模組，再用一個 shell 函式依序跑紅燈、改檔、綠燈、lint 與 commit。這些 run 任務都通過，但不到 30 步，依 `MIN_STEPS` 判為無效。有效的 6 次走了 45 到 61 步。所以上面「重注入值得」對 sonnet 的結論只建立在每格 3 次上，差 1 次就只是雜訊，不足以下判斷。haiku 兩臂 20 次全部有效，走了 42 到 63 步。
- **違規幾乎都是 zh-Hant。** 在有效 run 裡，haiku 關閉臂的說明文字有 101/131 處不是繁體中文，重注入臂是 70/135；sonnet 兩臂分別是 18/21 與 5/26。vendor、lint-every-3 與 commit-format 三條加起來，四格都不到 1%。所以「守規」主要量的是說明文字的語言，不是檔案操作。
- **`vendor` 的誤判已修正後重算。** 第一次算的時候，有三個 haiku 步驟是 commit 之後順手用 `git diff -- vendor/` 確認沒動到 vendor/，卻被記成寫入 vendor/。修正 `lib/drift.js` 之後重算，haiku 重注入臂的全程無違規從 4 變成 5。原始 transcript 沒有重跑。
- **兩批題庫作廢後重跑。** reader 第一批的 easy-who-requires 只問「哪個檔案」，6 次裡有 4 次答了正確的 `signup.js`，卻被要 `lib/signup.js` 的判分判錯；題目改成要從 repo 根算起的路徑之後重跑。mover 第一批的 41 次失敗，全都是題目給的 commit 訊息後面多了一行 `Co-Authored-By`，那是 Claude Code 自己的 commit 規則要加的；判分改成不比那一行之後重跑。作廢的兩批和兩次飄移試跑都留在 `evidence/` 底下，上面的表沒有算進去。
- **各角色的裁定**，判準是 haiku 臂每次 run 都有效而且全部通過：
  - implementer 與 mover 可以交給 haiku。
  - reader 不行：mid-config-chain 三次都引到 re-export 那一行，mid-env-default 有一次答錯。
  - mutator 不行：35 次有效 run 全部通過，但有 1 次被判無效，原因是 relay 改動了派出去的 prompt，不是 haiku 自己答錯。
- **原始批次只在跑的那台機器上。** 它們放在 `.fankeel/build/bench/` 底下，不進 git。`evidence/` 只保留每一批的 `summary.json` 與 `summary.md`。
