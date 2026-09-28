---
status: current
last_verified: 2026-09-28
source_of_truth: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/` 下的逐站 json、`summary.json`、`provenance.txt`、`opus-diff.txt`、`sonnet-diff.txt`；`ab.sh`（md5 `e833bba76b6f0c5cbdbc691b3b82cdab`）與 `pin.sh`（md5 `99d3fa4400dd7f43adf5631d226f10e0`）在起點 sha `9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4` 上跑出。價格換算用 `lib/prices.js` 的 `costOf`。本頁每一個數字都從那些檔來，本頁不會重新產生
---

# `ab.sh` profile-pin 重跑 — 2026-09-28

> **更正 2026-09-28：** §4 的「四站合計（不含 start）」與「全部含 start（即 `summary.json` 頂層 k）」兩格，是把各站累計的 `total_cost_usd` 逐站相加算出來的，重複計入了更早的站。真正的總花費是 verify 站自己的累計值：opus $6.19、sonnet $8.60，k = 1.64。修法見 `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js`（同一支腳本，這次的證據也用它重算）。

**這是 [2026-09-25 報告](2026-09-25-controller-multiplier.md) 的重跑，同一個 task、同一個起點 sha、同一條路線，opus controller 對 sonnet controller 各跑一次（n=1 per arm，不是任何母體的平均），`--max-budget-usd` 每個 arm 各 62.50。跟 09-25 唯一不同的地方是 `pin.sh` 這次把 `stage.agents` 的 override **commit** 進 worktree，而不是只寫進工作目錄——09-25 §7 診斷出那次 override 是未 commit 的檔案改動，中途被一次 `git stash ... drop` 連帶清掉，verify 站因此被誤判成受控站。這次的重點是確認那個修法有沒有守住整趟跑。**

## 1. 怎麼跑的、跟 09-25 差在哪裡

除了 `pin.sh` 這一點，其餘全部跟 09-25 一致：同一段 task 文字（todo-check 不驗行號那條）、同一個起點 sha、同一條路線 `design,plan,build,verify`、同一份 survey report 當輸入、旗標 `--setting-sources project --plugin-dir <worktree> --permission-mode bypassPermissions --output-format json`、每一站一次 `claude -p --resume`，關卡一律自動答 option one。Claude Code 版本這次是 **2.1.283**（09-25 是 2.1.282）。

`pin.sh` 這次在每個 arm 的 worktree 裡把 `stage.agents=false` 寫進 `.fankeel/profile.json` 之後，額外做一次 `git commit`，把這筆 override 變成 worktree 自己歷史裡的一個 commit，而不是工作目錄裡一筆未 commit 的修改。`provenance.txt` 記下了兩個 pin commit：opus arm `488efc72771e73372c7ddedf15c400ac7fc1c371`，sonnet arm `4e55b53c6d355098ccc790a656ed2bc4e114593a`。commit 過的檔案不會被 `git stash`／`git checkout` 之類清掉工作目錄的指令連帶動到，這正是要修的洞。

`k` 的定義跟 09-25 一致：sonnet arm 的 `total_cost_usd` 除以「opus arm 裡 opus 模型的 token 改用 `claude-sonnet-5` 費率透過 `costOf` 重算、非 opus 模型維持原本 `costUSD`」的總和。`kTokens` 是 token 數的比值。

## 2. `summary.json` 是怎麼補出來的（重跑本身的一個插曲）

`ab.sh` 收尾時呼叫的 `summarise.js`——就是它自己目錄旁那份、沒被改過的檔案——執行失敗，錯誤是 `MODULE_NOT_FOUND`，指向 `../../../../lib/prices.js`（见 `provenance.txt` 尾端的 stack trace）。原因是那個相對路徑是在證據還放在 `docs/reports/evidence/...`（少一層）時寫的；證據目錄後來搬到 `docs/90-agent/reports/evidence/...`，多了一層，`../../../../` 就打不到 `lib/prices.js` 了。

`summary.json` 因此不是 `ab.sh` 這次跑直接吐出來的，而是另外在 build scratch 之外，拿一份只改了那一個 require 路徑的 `summarise.js` 副本，對著同一批 `opus-*.json`／`sonnet-*.json` 證據檔重跑產生的——本頁引的所有數字都是那次重算的輸出。這件事直說在這裡，不藏在別處。

## 3. `stage.agents` 這次有沒有守住

`opus-diff.txt` 與 `sonnet-diff.txt` 各自是「`git diff <pin-commit> --stat` 加上 `git status --porcelain`」，在跑完之後、還在 worktree 裡取的。兩份都只列出 task 本身改動的檔案：

- opus：`TODO.md`、`docs/plans/2026-09-28-todo-check-line.md`、`scripts/docs-check.js`、`scripts/todo-check.js`、`tests/todo-check.test.js`
- sonnet：`TODO.md`、`docs/development.md`、`docs/plans/2026-09-28-todo-check-line-numbers.md`、`docs/station.md`、`scripts/docs-check.js`、`scripts/todo-check.js`、`tests/todo-check.test.js`

兩份都沒有 `.fankeel/profile.json`。也就是說從 pin commit 之後到跑完為止，沒有任何東西再動過那個檔案——`stage.agents` 在兩個 arm 全程都留在 `false`，跟 09-25 被 stash drop 掉的那次不一樣。這是這次重跑要驗的東西，也是它驗到的結果。

## 4. 逐站 `k`

每一站的 opus 重算值，是讀 `opus-<stage>.json` 的 `modelUsage`，對 id 符合 `/opus/` 的 entry 用 `costOf({ 'claude-sonnet-5': mix }).usd` 重算（`mix` 的欄位對應 `inputTokens`／`outputTokens`／`cacheReadInputTokens`／`cacheCreationInputTokens`，跟 09-25 `summarise.js` 的 `mix()` 同一種形狀），非 opus 的 entry 維持它自己的 `costUSD`，逐 entry 加總。

| 站 | opus | opus 以 sonnet 價重算 | sonnet | k |
|---|---|---|---|---|
| design | $0.4263 | $0.2035 | $0.5071 | 2.4919 |
| plan | $1.5847 | $1.0496 | $2.4940 | 2.3763 |
| build | $3.2785 | $2.4994 | $6.2872 | 2.5155 |
| verify | $6.2417 | $5.0948 | $8.6290 | 1.6937 |
| design+plan+build（不含 start） | $5.2895 | $3.7524 | $9.2884 | 2.4753 |
| design+plan+build+verify（不含 start） | $11.5313 | $8.8473 | $17.9174 | 2.0252 |

`start` 站另列，不折進上面任何一行：opus $0.1626、以 sonnet 價重算 $0.0594、sonnet $0.1012。跟 09-25 標「（含 start）」的那一行不同，這裡選擇把 start 獨立列出而不是折進 design+plan+build，因為這次重跑真正要驗的是 verify 這站的 `k` 有沒有意義（09-25 verify 是空的），把 start 分開比較容易看清四站各自的數字。

算術跟 `summary.json` 的總數對得上：四站（不含 start）的 opus 加總 `$11.5313` 加上 start 的 `$0.1626` 等於 `$11.693826...`，跟 `summary.json` 的 `arms.opus.usd` 一致；同法 sonnet 四站加 start 等於 `$18.018543...`，跟 `arms.sonnet.usd` 一致；opus 重算四站加 start 的重算值等於 `$8.906673...`，跟 `summary.json` 的 `oldAtSonnetRates` 一致，兩者相除得到 `k = 2.023038...`，跟 `summary.json` 頂層的 `k` 完全一致（到小數點後可對到的位數）。這就是「全部（含 start）」這個總覽數字的來源：`k = 2.0230`、`kTokens = 2.3216`（`summary.json` 的 `kTokens`）。

## 5. 跟 09-25 與破平衡點比

09-25 在可比的幾站上（design+plan+build，含 start）測到 `k` 落在 2.29–2.74 之間；[投影頁 §4](2026-09-21-long-task-projection.md) 的破平衡點是 `k = 2.5052`。

這次重跑：
- design（2.49）、plan（2.38）、build（2.52）三站個別的 `k` 都落在 09-25 的 2.29–2.74 範圍內，build 的 2.52 也緊貼破平衡點 2.5052。
- design+plan+build 合併（不含 start，2.4753）同樣落在 09-25 的範圍內，略低於破平衡點。
- verify 這次終於是一個站得住的數字（09-25 那格是空的，因為 sonnet arm 的 verify 沒跑完）：`k = 1.6937`，明顯低於 09-25 的範圍下緣 2.29，也低於破平衡點。
- 四站合計（不含 start，2.0252）與全部含 start 的總覽數字（2.0230，即 `summary.json` 頂層的 `k`）都低於 09-25 的範圍與破平衡點。

verify 這站把總數拉低，是這次跟 09-25 最大的不同——09-25 沒能測到 verify 的 `k`，這次測到了，而它比 design/plan/build 都省。但這仍然只是 n=1 per arm 的一次量測：跟 09-25 的兩輪 opus 之間本身就有 11% 的差距一樣，這裡不能把任何一格數字當成母體平均，只能說「這一次落在哪裡」。

## 6. 這次跑歪的地方

`provenance.txt` 記下兩個 arm 各自跑完之後，`git worktree remove` 都失敗，錯誤是 `Permission denied`（Windows 檔案鎖住 wt-opus／wt-sonnet）。這只影響 worktree 清不掉，不影響任何花費或 token 數字——兩個 arm 的 `claude -p` 呼叫本身都以 `exit=0` 收尾，成本數字是在清除失敗之前就已經記下的。另外，`summary.json` 的產生方式見第 2 節，本身也是一個跑歪之處，已在那裡說明。

Claude Code 版本 `2.1.283`，`ab.sh` md5 `e833bba76b6f0c5cbdbc691b3b82cdab`，`pin.sh` md5 `99d3fa4400dd7f43adf5631d226f10e0`，兩個 arm 各自的 `--max-budget-usd` 上限都是 `62.50`，起點 sha `9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4`。
