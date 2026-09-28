---
status: decision
last_verified: 2026-09-28
---

# Agent 壽命（09-28）：決策紀錄

一句話：build 改成一個 group 一個 brain、task 有讀取量上限、subagent 有 context 上限 hook、共用前綴逐字相同；另外修正 A/B 報告把累計花費重複相加的錯誤。

design 見 [../99-archive/2026-09-28-agent-lifetime-design.md](../99-archive/2026-09-28-agent-lifetime-design.md)，計畫見 [../99-archive/2026-09-28-agent-lifetime.md](../99-archive/2026-09-28-agent-lifetime.md)。

## 定了什麼

- 門檻是 `SOFT = 300000`、`HARD = 450000`（`lib/context.js`），不是 design 原本寫的 150k／250k。使用者 09-28 在 build 中途改的：300k 以下可以接受，450k 以上花費才明顯變多。`HARD` 高於主 session 的 `BUSY = 400000`，兩者本來就是不同 session 的獨立常數，原本的 `HARD < BUSY` 斷言改成 `HARD < 1000000`。
- 不另外限制每個 brain 做幾個 task。拿這次和 f44b1c61 的三個 brain 逐請求重算：每 40–60 次請求換一個 brain 最省（約省 30–35% 的快取讀取費），更勤反而被重付的暖機吃掉；最大的 group 是 6 個 task，已經落在這個範圍。
- 09-28 A/B 的更正數字是 opus $6.24、sonnet $8.63、k = 1.69，由修好的 `summarise.js` 對 `summary.json` 重算；最初交給這個 task 的 $6.19／$8.60／1.64 是抄錯的。

## 量到什麼

- brain 開場會把整份 plan 和 SKILL.md 讀進來，context 在 10 次請求內從 22–24k 升到 62–103k；這是換 brain 時要重付的暖機，也是下一步最划算的地方。
- 8 個最貴的 session 裡，peak 超過 250k 的 34 個 subagent 有 15 個是 plan writer，brain 只有 3 個；錢最多花在 verifier（$208）和 reviewer（$164），brain 合計 $42。

## 在哪裡回頭

- 這次 build 本身還是舊跑法：一個 brain 做到底，兩個 brain 分別長到 291k（失聯）和約 343k。
- `hooks/brief.js` 對巢狀 brain 也標 `inflight`，這次多出一個 group 3 標記；記在 `TODO.md` 的 Ready，沒修。
- verify 兩次把修改留在工作樹沒 commit，都退回 build 補 commit。
