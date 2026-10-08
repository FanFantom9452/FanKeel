---
status: design-intent
last_verified: 2026-10-08
source_of_truth: lib/bench.js, scripts/bench.js, hooks/title.js, lib/prices.js, lib/usage.js
---

# Haiku 5.5 的派工：按角色量

這份設計是 2026-10-08 第二版。第一版（77aac5c4）用整次 session run 比較臂與臂；fix-bug 那一批跑完後，使用者裁定改成按角色量。結論是：每次只派一個角色、給固定的輸入，haiku 與 sonnet 各跑幾次，量那一個角色自己的花費與成功率；並先修好一個 bug，讓 profile 指定的 haiku 真的生效。使用者的原話是：「他只做簡單的事情 那他做簡單的事情一定比 sonnet 還省 … 他不可能當作 BRAIN 或是當作 撰寫程式的 他可能做最簡單的事情」。

## 1. 已經做好、留下來的東西

第一版 build 到 Task 6 為止的成果全部保留，因為按角色量也用得到：

- `lib/prices.js` 的兩列 Haiku 5.5 價目，以及 `lib/usage.js` 把 prompt 超過 100K 的 request 記到 `claude-haiku-5-5>100k` 下。
- `scripts/bench.js` 的 `probe`（確認 `haiku` 這個別名指向 Haiku 5.5）、`selftest`（每個 `check.sh` 對兩側控制組各跑一次）、`tally`，以及 f5d855de 的暫存目錄清除重試。
- `bench/` 底下的三個專案。`add-feature` 會被 implementer 角色重用；`fix-bug` 與 `review-planted` 留著不跑。
- 整次 run 的 `bench.js run` 不刪，但不再是這次的實驗：剩下的 add-feature、review-planted 兩批不跑。

## 2. 為什麼整次 run 看不出差別

fix-bug 那一批（`.fankeel/build/bench/fix-bug-20261008T092518/`）每次 run 都通過 `check.sh`，但從 transcript 逐角色重算後，一次 run 花 $1.1 到 $1.9，其中主 session（sonnet）佔 $0.40 到 $0.91、brain 佔 $0.55 到 $0.85；換成 haiku 的 implementer 只佔 $0.002，換之前是 $0.030。haiku 的角色約是一次 run 的 2%，而主 session 每次 22 到 49 個 request 的起伏遠大於這 2%，所以整次 run 的總額比較不出省下的錢。

同一批裡 `sub` 臂三次都無效：brain 派 mutator 時明寫了 `"model":"sonnet"`，蓋過了 profile 的 `agent.fankeel-mutator.model=haiku`；reader、mover、verifier 在這條流程裡根本沒被派出去。第 4 節修前一件事，第 3 節的做法讓後一件事不再發生。

## 3. 候選角色：四個「最簡單的事」

一個角色要列入候選，條件是它的工作有一個不靠判斷的對錯：

- `fankeel-reader`：讀檔、回答有標準答案的問題，並附 `path:line`。
- `fankeel-mutator`：在指定的 `path:line` 套一個變異、跑一條 `node --test`、還原檔案。
- `fankeel-mover`：做一個 `git mv` 並以給定的訊息 commit。
- `fankeel-implementer`，但只在計畫已經把程式碼寫好、它只是照抄的情況（計畫 Dispatch 行寫 `implementer, haiku` 的那種，`lib/plantasks.js:555` 已經為它設了窄門）。

不列入的是 brain、主 session、reviewer、verifier：它們的產出要靠判斷，正是使用者說 haiku 不該做的事。`review-planted` 專案已經建好，日後若要量 reviewer 可以直接用，這次不跑。

## 4. 先修：profile 指定的模型要蓋過派工時明寫的模型

今天每一份 skill 都要求派工時明寫模型（`skills/fankeel/SKILL.md:1071`，`dispatch.floor`，預設 sonnet），verify 與 audit 的 brief 也直接寫出 mutator、mover 用 `dispatch.floor`（`lib/render.js:587`、`lib/render.js:595`）。而 `task.js profile set agent.<name>.model haiku` 寫出的 override 檔，只改了 agent 檔的 `model:` 那一行；Agent tool 收到明寫的 `model` 時，以明寫的為準。所以 override 的 effort 會生效、model 不會，fix-bug 那批的 title 寫著「sonnet 5.5 · high」就是這樣來的。

- `hooks/title.js` 已經在有 override 時把 `subagent_type` 從 `fankeel:<name>` 換成 `<name>`（`hooks/title.js:28`）。改成：override 檔的 frontmatter 有 `model:` 時，`updatedInput.model` 也換成那個值；title 也就跟著顯示 haiku。
- 為什麼改在這裡而不是各個 brief：明寫模型的地方散在十幾份 skill 與 brief 裡，而 hook 是所有派工都會經過的唯一一點；`profile.read` 也讀不到 `agent.<name>.model`（`lib/profile.js:323` 只走 `KEYS`），改 brief 還得先改 profile。override 是使用者自己下的指令，比 floor 更具體，蓋過它是對的。
- override 只設 effort、沒設 model 時，明寫的模型照舊。

## 5. 一個角色怎麼單獨量：`bench.js role`

用法是 `node scripts/bench.js role <role> --arms sonnet,haiku --runs <n> --cap <usd> [--dry]`。每次 run 的流程是：

1. 在新的 mkdtemp 目錄跑該角色的 `setup.sh`，建出固定的起點。
2. haiku 臂執行 `task.js profile set agent.fankeel-<role>.model haiku`；sonnet 臂什麼都不設。effort 兩臂都用 agent 檔自己的值，兩臂只差模型這一個變數。
3. 以 `claude -p --model haiku` 開一個只負責轉交的主 session：它的 prompt 要它呼叫一次 Agent tool，`subagent_type` 是 `fankeel:fankeel-<role>`、`model` 是 `sonnet`（和 brain 今天的做法一樣），`prompt` 是該角色 `input.md` 的原文，然後結束。haiku 臂因此同時驗證了第 4 節的修正。
4. 從主 transcript 取出那個 Agent 呼叫的 tool_result 原文，寫到 `<dir>/.bench/result.txt`，再跑 `check.sh <dir>`。

一次 run 有效的條件有三個：主 session 恰好派了一次；派出去的 prompt 與 `input.md` 一字不差；那個子 agent 的 transcript 裡每個 `message.model` 都是該臂的模型（haiku 臂必須是 Haiku 5.5，沿用 `lib/bench.js` 的 `runFigures` 判斷）。無效的 run 會列出原因，但不計入結果。

## 6. 每個角色的輸入與成功檢查

每個角色是 `bench/roles/<role>/` 底下的 `setup.sh`、`input.md`、`check.sh` 與 `controls/pass*`、`controls/fail*`；`bench.js selftest` 一併檢查它們，所以每個檢查都證明過自己能判過、也能判不過。

| 角色 | 固定輸入 | 成功的條件 | 必須判不過的控制組 |
|---|---|---|---|
| reader | 約三十個檔的合成 repo，三個有標準答案的問題 | 三題答案都對；每個引用的 `path:line` 存在，且該行含有答案字串 | 一個捏造的 `path:line` |
| mutator | 一個小 lib 與它的測試，一個指定的變異與 `node --test` 指令 | 回報變異前全過、變異後有測試失敗；跑完後 `git status --porcelain` 為空，檔案 sha256 與起點相同 | 檔案沒還原 |
| mover | 一個小 git repo，一個 `git mv` 與 commit 訊息 | 新路徑的 blob 與原檔相同、舊路徑不在、HEAD 的訊息相符、其餘檔案沒變 | 搬的同時改了內容 |
| implementer | 沿用 `bench/add-feature` 的 `setup.sh`；`input.md` 是它計畫裡那個 task 的原文 | 沿用 `bench/add-feature/check.sh` | 沿用 add-feature 既有的 fail 控制組 |

## 7. 花費怎麼算

角色的花費只算那一個子 agent 的 transcript，用 `lib/usage.js` 依 `requestId` 去重、再以 `lib/prices.js` 計價；轉交用的主 session 另列一欄，不算進角色。Claude Code 自己回報的 `total_cost_usd` 也記下來放在旁邊，但報告用的是重算值：fix-bug 那批顯示前者約比後者高 10%，報告要寫明用的是哪一個。

- 彙整表一列是「角色 × 臂」：次數、有效次數、通過次數、角色花費的平均與總和、轉交 session 的花費。
- 裁定規則：haiku 臂 n/n 有效且全過，該角色才可以改用 haiku；只要有一次失敗就不算。失敗的角色可以日後再開一個 haiku@high 臂，這次不跑。

## 8. 角色改用 haiku 時，fankeel 要改什麼

第 4 節修好之後，改一個角色不需要再改程式：使用者執行 `task.js profile set agent.fankeel-mutator.model haiku`（加 `--default` 則寫進整台機器的設定），之後所有 brain 派它時，不論寫了什麼模型都會跑在 haiku 上。implementer 照舊由計畫的 Dispatch 行決定。要不要直接改 `agents/*.md` 的 `model:` 讓所有使用者預設都用 haiku，由報告出來後的 `model-choice.md` b 項裁定，不在這次範圍。

## 9. 使用者要決定的事

- 次數與預算：預設每個角色每臂 5 次、每次上限 $1，四個角色共 40 次，最壞 $40。照 fix-bug 那批的數字，sonnet implementer 一次約 $0.03，所以實際應該只有幾塊美元。
- 權限模式：沿用 `--permission-mode bypassPermissions`，只在 mkdtemp 目錄裡跑，每批開跑前問一次。

## 10. 暫存目錄被鎖住

fix-bug 那批每次 run 結束時，暫存目錄都被鎖住超過 5 × 500ms 的重試（EPERM），幾分鐘後才刪得掉。這不擋實驗：`cleanup` 已經把留下的目錄記在該次 run 的 `dir` 欄。這次不改，只在報告裡記一筆。

## 測試

- `tests/title-hook.test.js`：一個帶 `generated_by` 標記、`model: haiku` 的 override 檔，加上 `model: "sonnet"` 的派工輸入，`updatedInput.model` 要是 `haiku`，description 要以 haiku 開頭。現在會失敗，因為 `updatedInput` 保留了 `sonnet`。只設 effort 的 override 則必須保留 `sonnet`。
- `tests/bench.test.js`：轉交 prompt 含 `input.md` 原文；派了零次或兩次、prompt 與 `input.md` 不同、子 agent 跑錯模型，各自讓 run 無效；角色花費不含轉交 session 的花費。
- `node scripts/bench.js selftest` 印出含 `roles/reader`、`roles/mutator`、`roles/mover`、`roles/implementer` 的 `selftest ok`。
- 產物檢查：角色彙整表上每列的花費，等於各次 run 的花費相加，也等於從原始子 agent transcript 重算的結果。
