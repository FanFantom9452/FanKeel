---
status: current
last_verified: 2026-09-25
source_of_truth: `docs/reports/evidence/2026-09-25-controller-multiplier/` 下的逐站 json 與 `summary.json`，由同目錄的 `ab.sh`（md5 `8e1220a272e135627606e70fe3d08270`，commit `8866b19f`）在起點 sha `9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4` 上跑出；第一輪只有 opus 的資料在 `run1-opus-only/`（`ab.sh` md5 `d8c2cfb5d6b611ca968f14f062e0dfb3`，commit `0e02a65d`）。價格換算用 `lib/prices.js` 的 `costOf`。本頁每一個數字都從那些檔來，本頁不會重新產生
---

# Sonnet 主控倍數 k 的第一次實測 — 2026-09-25

> **更正 2026-09-28：** §2 表格的「全部」與「design+plan+build（含 start）」兩列，以及「逐站花費」那一行，都是把 `--resume` 回傳的累計 `total_cost_usd` 逐站相加算出來的；`--resume` 給的本來就是累計到那一站為止的總花費，相加等於重複計入更早的站。真正的總花費是 verify 站自己的累計值（因為 verify 是最後一站，其累計值就是全程總花費）：opus $6.36、sonnet $8.95，k = 1.71。修法見 `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`。

**這一輪只量了一個很小的 task——TODO 的 todo-check 行號那條，1 個 task、約 3 個檔——sonnet arm 只跑了一次（n=1），opus arm 因為第一次起跑失敗又重跑了一次（n=2）。所以下面每一個 `k` 都只代表這一個 task，不是任何母體的平均。它填的是 [投影頁 §4](2026-09-21-long-task-projection.md) 留空的那一格：破平衡點 `k = 2.5052`。**

## 1. 怎麼跑的

兩個 arm 只有一件事不同：controller 的 `--model`（opus 或 sonnet）。其餘全部固定：

- 同一段 task 文字、同一個起點 sha、同一條路線 `design,plan,build,verify`。
- 每個 arm 各自的 worktree 裡 `stage.agents` 都是 `false`——worktree 帶著自己的 `.fankeel/sessions/`，所以 profile 讀到的是 worktree 自己那份，不是主 repo 的。
- 同一份 survey report 當輸入。
- 旗標固定：`--setting-sources project --plugin-dir <worktree> --permission-mode bypassPermissions --output-format json`。
- 每一站一次 `claude -p --resume`，關卡一律自動答 option one。
- 每個 arm 各自的花費上限 `--max-budget-usd` 62.50。
- Claude Code 2.1.282。

`k` 的定義：sonnet arm 的 `total_cost_usd` 除以「opus arm 的 opus 模型 token 改用 `claude-sonnet-5` 費率透過 `costOf` 重算、非 opus 模型維持 CLI 原本 `costUSD`」——也就是投影頁 §4 的 `old × r × k` 裡那個 `k`。`kTokens` 是 token 數的比值（input+output+cacheRead+cacheCreation 加總後相除）。

## 2. 結果

| 範圍 | opus（第二輪） | opus（第一輪） | opus 以 sonnet 價重算 | sonnet | k | k（以第一輪 opus 為分母） | kTokens |
|---|---|---|---|---|---|---|---|
| design+plan+build（含 start） | $5.11 | $5.84 | $3.53 | $9.67 | 2.742 | 2.291 | 3.168 |
| verify | $6.36 | $6.91 | $5.23 | $8.95 | 1.710 | 1.556 | 2.168 |
| 全部 | $11.47 | $12.75 | $8.76 | $18.62 | 2.125 | 1.867 | 2.577 |

逐站花費（sonnet / opus 第二輪）：start 0.10/0.15、design 0.83/0.41、plan 2.70/1.36、build 6.05/3.19、verify 8.95/6.36。

逐站輪數（sonnet / opus）：design 33/10、plan 39/19、build 13/21、verify 1/3。

## 3. `modelUsage`

兩個 arm 各模型的用量都在各自的 `<arm>-<stage>.json` 裡，`summary.json` 的 `arms.<arm>.models` 再按模型加總一次。opus arm 也用到了 `claude-sonnet-5`——它派出去的站內 subagent 有 sonnet 地板——這就是為什麼上面的重算只動 opus 那部分的 entry，sonnet 部分本來就已經是 sonnet 價。

## 4. verify 這一行不能比

verify 的兩個數字不是同一種東西，這裡直說原因：sonnet controller 在 `stage.agents` 為 `false` 的情況下，除了自己的 reader 與 verifier，還另外派了一個 `fankeel:fankeel-brain`（"Run verify stage"）；接著那次 `-p` 呼叫在第 1 輪就結束了，當時它正在等 `await.js`。也就是說 sonnet 的 verify 從沒跑完，它的 $8.95 裡包含一個跑到一半的站 agent。opus 的 verify 是跑完的（reader、三個 verifier、一個 adversary reviewer 都跑完）。所以真正能比的只有 design+plan+build 這一行,「全部」那個 k=2.125 不是一個站得住的標題數字。

## 5. 結論

在可比的那幾站上，`k` 落在 2.29–2.74 之間（看用哪一輪 opus 當分母），剛好跨在破平衡點 2.5052 兩側。這一對量測不能說「Sonnet 當主控在非 survey 的幾站上省錢」——它說的是投影假設的省 55–56%（相當於 k≈1）在這裡沒有出現：sonnet 在 design 與 plan 多花了不少輪（33 對 10、39 對 19）。另外也要記著,兩次 opus 重跑本身就差了 11%（$11.47 對 $12.75），這就是一對量測能解析到的極限。

## 6. 這次跑歪的地方（也是記錄的一部分）

第一次嘗試在花錢之前就中止了:`--project` 需要給值,而且一個沒有 `.fankeel/sessions/` 的 worktree 會回頭讀到主 repo 的 profile——這在 `0e02a65d` 修掉了。第二次只跑到 opus,因為 `ab.sh` 在跑的過程中被改動,bash 讀到偏移後的檔案位置,導致 `arm sonnet` 從沒跑起來——那份 opus 資料留存為第一輪(`run1-opus-only/`)。整次量測總花費 $42.84,在 $125 預算之內。

## 7. 追加診斷：sonnet 為什麼會在 verify 站派 brain（更正）

上一版這一節的結論是錯的：不是 sonnet 主控自己模仿 controller 模式、也不是 controlling() 誤判。直接讀 session 的 transcript（`~/.claude/projects/F--ymlab-fankeel--fankeel-build-2026-09-25-controller-multiplier-wt-sonnet/c48565bc-06b8-4108-90c4-5b552912a365.jsonl`）找到的是一個 harness 缺陷。

record 592 附近：sonnet 的 verify 站一開始確實在 session 內自己做——`git stash push -u -m verify-stage-check-9e54e1b7-baseline`、`git checkout 9e54e1b7 -- .`、跑 docs-check、`git checkout HEAD -- .`，這是它自己驗東西的正常流程。但 604-606 它接著把這個暫存的 stash **drop** 掉（"Dropping the temporary stash"），而不是 pop 回去。`ab.sh` 寫進 worktree 的 `stage.agents false` 是 `.fankeel/profile.json` 上一筆沒有 commit 的修改，這次 stash 連它一起帶走、drop 掉之後，profile 就回到 commit 過的原始值 `["survey","build","verify"]`——670-671 它自己 `cat .fankeel/profile.json` 印出來的正是這個陣列。663/673/675：下一次背景 reader 的 task-notification，prompt hook 看到 profile 又列了 verify，就照常注入了「You are the controller for verify. ...」那段 controller 規則；684：sonnet 照規則派了 `Agent(fankeel:fankeel-brain, prompt "verify", run_in_background)`，然後等 `await.js`，`-p` 就在這裡結束。json 裡的 `num_turns: 1`會誤導人：verify 站其實已經在 session 內做了約 30 筆紀錄的真實工作（docs-check、4 個 reader、1 個 verifier）才走到 684 那步。

所以根因是 harness：`ab.sh` 把 `stage.agents` 的 override 寫成 worktree 裡未 commit 的檔案，一旦 arm 自己的工作流程跑了 `git stash`/`git checkout` 這類會動到工作目錄的指令，這筆 override 就可能被連帶清掉，profile 一回到原始值，下一次 prompt 注入就會把它當成受控站處理。要修，需要讓這個 override 撐過 stash——例如在 arm 開始前把它 commit 進 worktree 自己的一個 commit，或是寫在 git 完全管不到的地方（例如 worktree 外、或 `.git/info/` 之類不受 `git stash`/`checkout` 影響的位置）。這也表示 verify 站的主控倍數量測仍然是空的，不是這次量到又被誤讀。

附帶一個發現：這個 arm 的 `git stash -u` 之後直接 drop，等於把當時工作目錄裡未追蹤的修改一起丟掉——跟本 repo 已知的另一起事件是同一種模式（stash 之後沒 pop 就 drop，遺失了本來該留住的東西）。
