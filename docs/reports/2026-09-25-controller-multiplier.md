---
status: current
last_verified: 2026-09-25
source_of_truth: `docs/reports/evidence/2026-09-25-controller-multiplier/` 下的逐站 json 與 `summary.json`，由同目錄的 `ab.sh`（md5 `8e1220a272e135627606e70fe3d08270`，commit `8866b19f`）在起點 sha `9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4` 上跑出；第一輪只有 opus 的資料在 `run1-opus-only/`（`ab.sh` md5 `d8c2cfb5d6b611ca968f14f062e0dfb3`，commit `0e02a65d`）。價格換算用 `lib/prices.js` 的 `costOf`。本頁每一個數字都從那些檔來，本頁不會重新產生
---

# Sonnet 主控倍數 k 的第一次實測 — 2026-09-25

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
