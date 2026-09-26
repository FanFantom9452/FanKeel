---
status: current
last_verified: 2026-09-26
source_of_truth: docs/90-agent/reports/evidence/2026-09-26-context-md/ab.sh
---

# context.md 省了多少 — 這一輪沒量到，2026-09-26

**這份報告的頭條不是一個倍數。頭條是：這一輪跑完全沒有派出任何 subagent，而 `context.md` 存在的唯一理由就是縮短派給 subagent 的 brief——所以這次量測對 `context.md` 的效果什麼都沒證明。下面的花費表是真的、跑出來的錢，但它量到的是兩個頂層 session 各自追一個過期 bug 報告花了多少，不是 `context.md` 省不省。**

## 1. 兩個 arm 怎麼分的

`S`（Task 4 落地 `scripts/context.js` 的那個 commit，完整 sha）：

```
93e8970b3a024d7a270ade8765ceb49cf692cfe6
```

在 `.fankeel/build/2026-09-26-context-md/` 下建兩個 worktree，都從 `S` 起跑：

- `with/`（brief 會點名 `context.md`，即 `lib/render.js` 在 `S` 落地的那段），session `df46e0a2-ff79-441e-ae61-ed15c0a6e323`
- `without/`（同一個 `S`，但反向套用 Task 4 那段 `lib/render.js` hunk 後另外 commit 一次，讓 brief 不再點名 `context.md`），session `517af87a-407a-49b0-91c3-907882ec3beb`

路線固定 `design,plan,build,verify`，`stage.agents` 兩邊都透過 `pin.sh` 釘死在 `survey,build,verify`（讓 build 站在有站 agent 的大腦裡跑，站內 implementer 理論上會拿到 brief）。任務文字兩邊逐字相同：todo-check 的行號驗證那條（`.fankeel/build/2026-09-26-context-md/{with,without}` 各自的 `ab.sh` 沿用了 `2026-09-26-ab-profile-pin/ab.sh` 的同一個 task）。

## 2. 結果先出：n=1 per arm，這是評估等級不是註腳

| | `with`（點名 context.md） | `without`（不點名） | 比值（without / with） |
|---|---|---|---|
| `total_cost_usd` | $2.5394805999999996 | $10.281673999999999 | 4.049× |
| token 總量（input+output+cacheRead+cacheWrite） | 6,039,357 | 29,539,693 | 4.891× |

逐項 token（模型皆 `claude-sonnet-5`，`result` 行的 `modelUsage`，重複行取最大值不取和）：

| | input | output | cache-read | cache-write (5m) |
|---|---|---|---|---|
| `with` | 188 | 53,427 | 5,773,193 | 212,549 |
| `without` | 586 | 177,522 | 28,567,365 | 794,220 |

## 3. 為什麼這組數字不能拿來說 context.md 省了 4×

- **兩個 arm 都沒有派出任何 subagent。** `find .fankeel/build/2026-09-26-context-md/with -path '*/subagents/*.jsonl'` 與同一條指令對 `without/` 都是空的——這次跑完全沒有一份 `<session>/subagents/*.jsonl`。
- `context.md` 存在的機制是縮短**派給 subagent 的 brief**（`scripts/context.js` 的 `contextPath`、`add`、`show`；`lib/render.js` 在 `S` 落地的那段把它的路徑塞進 brief）。沒有 subagent 被派出去，這個機制就從沒有機會被觸發——`with/` 的 worktree 裡從頭到尾沒有出現過一份 `context.md`（找過整個 worktree，唯一名字相符的是既有文件 `docs/subagents.md`）。
- 兩個 arm 在 design 階段各自獨立發現：`.fankeel/build/survey.md` 描述的 bug（todo-check 不驗 `path:line` 的行號）已經被 `02d32348`（2026-09-25 落地）修掉了，兩邊都用 `git log` 加自己重跑測試核實過。於是兩邊都判定不需要真的動代碼——`with/` 的 diff 是 **0 檔案改動**（`with-df46e0a2-ff79-441e-ae61-ed15c0a6e323-diff.txt` 是空檔，對應的 `.patch` 也是空的）；`without/` 產出了 3 個檔、85 行（`docs/README.md` 兩行索引 + 兩份 design-intent 計畫檔），記錄「已重查、非重建」這個結論，然後同樣判定不需要建置。
- 也就是說，兩邊都沒有走到「build 站真的動代碼、implementer 被派出去讀一份夾著或不夾 `context.md` 路徑的 brief」這一步。$2.54 對 $10.28 的差距，最可能反映的是兩個頂層 session 各自花多少功夫去追、核實、再放棄同一個過期 bug 報告——這件事跟 brief 裡有沒有一行 `context.md` 路徑無關。

## 4. 這次量測不能給出的結論

- **`context.md` 對 subagent brief 大小或 token 用量的效果：完全沒量到。** 機制沒有被觸發過一次。
- 4.049×／4.891× 這兩個比值不是 `context.md` 的效果量；它們是「同一個過期任務，兩個頂層 session 各自的追查成本」的比值，n=1，樣本裡連任務本身都是意外失效的。
- 這次也沒有留下任何一次 `context.js add` 呼叫可數——因為沒有 subagent 的 transcript 存在，`<session>/subagents/*.jsonl` 這條路徑本身就是空集合。
- 要重新量這件事，任務要先確認在這個 commit 上仍然成立（本次選的 todo-check 任務已經證明會被獨立、可靠地判定「已修好」，不能再用），而且要確認 build 階段真的會派出至少一個 subagent，否則 `context.md` 的機制照樣不會被觸發。

## 5. 花沒花錢是真的

兩個 arm 是真跑的 headless run（`claude -p --output-format json`，`--permission-mode bypassPermissions`，`stage.agents` 由 `pin.sh` 釘在 `survey,build,verify`），provenance 記在 `docs/90-agent/reports/evidence/2026-09-26-context-md/provenance.txt`（HEAD、porcelain、`claude --version` 2.1.283、`ab.sh`/`pin.sh` md5）。總花費 $2.5394805999999996 + $10.281673999999999 ≈ $12.82，在 arm 各自 `--max-budget-usd 62.50` 的上限之內。

這 $12.82 不是全部花費。在它之前另有兩次作廢的執行，共約 $5.50（數字取自 build 報告 `.fankeel/build/task-20260926T012847/build.md`），是先後兩次各自獨立的碰撞：第一次是一個把本 session 誤判為已失聯的重新派工，和本 session 自己的那一次同時跑了同一套 harness；後來又有第二個 implementer 並行跑了一次。當時 `ab.sh` 的輸出檔只按 arm 命名、不帶 session id，兩次都互相覆寫，資料無法使用。`ab.sh` 之後改成以 session id 命名每個輸出檔，才跑出上面這一次乾淨的結果。本 task 實際花費約 $18.3，都在核准的 $125 之內。
