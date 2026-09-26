---
status: decision
last_verified: 2026-09-26
---

# design 交棒、security 本地先篩、ab.sh 釘 profile：決策紀錄

一句話：`TODO.md` 的兩條 Ready 和「design 核准後怎麼交給 build 站 agent」這個待決問題，這次都處理完了。bounded route 上，如果 build 由站 agent 跑，design 在 gate 前把核准的設計寫到 `.fankeel/build/task-<started>/design.md`，build 站 agent 就讀得到。設了 `security.local` 時，verify 會先用 ollama 掃一遍，reviewer 只逐條確認它找到的候選。`ab.sh` 的 profile 釘選改在 worktree 裡 commit，stash 就清不掉它。

design 見 [../archive/2026-09-26-three-ready-design.md](../99-archive/2026-09-26-three-ready-design.md)，計畫見 [../archive/2026-09-26-three-ready.md](../99-archive/2026-09-26-three-ready.md)。

## 選了什麼，為什麼

- **交棒走檔案，不在 dispatch 時多帶一行。** build 站 agent 本來就會用 `previousHandoff` 往回找前一站的 handoff 檔，所以只要 design 把檔案寫在那裡就接得上，不用改 hook，也不會新增讀檔的地方。檔案不會因為 compaction 消失；dispatch 帶的那一行做不到這點。
- **只在 design 的下一站就是 build 時才寫。** route 上有 plan 的話，`previousHandoff` 會先找到 design.md，蓋過 plan 檔，所以這種情況不寫。條件用現成的 `subs.next` 判斷，不用把 route 傳進 `rulesFor`。
- **本地模型只做先篩，由 reviewer 裁決。** 9B/14B 的模型誤報多，所以最後判斷的仍是 reviewer 自己的模型。prompt 從 `agents/fankeel-reviewer.md` 的 `## Security` 段直接讀出來，不另外存一份，免得兩邊內容漂移。
- **清單對齊退回 Waiting。** 「AI CODING SECURITY」在 repo 裡只有一個名字，沒有可以讀的清單。這條之所以回到 Ready，是 d0c7158d 批次清理時機械式搬過去的，那個專案其實沒有進展。
- **ab.sh 只修不重跑。** 舊的 evidence 目錄屬於 report 角色，只寫一次，所以修好的 script 放在新目錄 `docs/reports/evidence/2026-09-26-ab-profile-pin/`。重跑大約要 $30，另開一條 Waiting，等使用者核准。

## 反過來的地方

- 為了讓 verify 的新規則塞得進 2400 字元的注入上限，刪掉了 `lib/stages.js` 裡一句「A change that is correct and leaves three pages … is half verified.」。fankeel-verify skill 裡還保留同一句。
- audit 發現，交棒這條管道讓四個地方的說法不再成立，其中兩處是會在執行時注入的字串：`CLASSES.bounded.means`，以及 design template 的 `spec:` 行。這些都在 820a574b 一起修掉了。
- 同一個 task 裡還記了一條待決問題：要不要把 `fankeel-brain` 拆成各站專屬的 agent。結論是等 verify 的 k 值量出來再決定。
