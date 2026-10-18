---
judged: 2026-10-18T13:04:11.282Z
model: fable
agent: fankeel-judge
task: "分析 10/16-10/18 session 花費：主 session 佔比與 cache read/write"
session: d96bfda4-b6c5-4810-84ee-cbcf51f43772
stage: survey
---

# Brief 1 — 為什麼主 session 花費佔比仍最高，cache read/write 為何仍大，compact.at 450K 該不該降

## Question

# Brief 1 — 為什麼主 session 花費佔比仍最高，cache read/write 為何仍大，compact.at 450K 該不該降

## 問題（使用者原話）

請分析 10/16 ~ 10/18 所有 SESSION 對話紀錄：為甚麼主 SESSION 花費佔比還是最高的？還有 CACHE READ WRITE 怎麼還是吃這麼多？是 450K 還是太多嗎？這樣要壓縮到 300K 嗎？還是 350K？先深度分析後和我討論。

## 選項

- A. 維持 `compact.at` 450000
- B. 降到 350000
- C. 降到 300000（注意：`scripts/compact-window.js` 的 `sync` 目前只接受 350000、450000、600000、1000000；300K 需改程式）
- D. 門檻不是主因——問題在別處（例如主 session 承擔了該派出去的工作、cache write 來自 cache 失效／TTL／前綴變動、hook 注入塊改變導致前綴失效、站 agent 回傳太長等），改的是那個東西

## 背景

- 現行設定：profile `compact.at` = 450000（machine 層），`~/.claude/settings.json` 的 env `CLAUDE_CODE_AUTO_COMPACT_WINDOW` = "450000"。
- 主 session 一般跑 Opus 5.5（最貴）；子 agent 依 `dispatch.floor` 最低 sonnet；本專案 `stage.agents` = survey。
- plugin 的前提：主對話殘留每回合重讀，所以 dispatch 預設；但 2026-09-03 量測顯示 dispatch 花 1.85 倍錢換殘留下降（docs/90-agent/reports/2026-09-03-dispatch-vs-inline.md）。
- 每回合成本 ≈ 前綴 cache read（context 大小 × cache read 價）＋ 新增部分 cache write。context 越大、回合越多，cache read 線性累加；cache write 在前綴被打斷（壓縮、TTL 過期、前段內容改動）時整段重寫。
- session 用 1 小時 prompt-cache TTL；超用時可能退回 5 分鐘。

## 要讀的路徑

- 對話紀錄：`C:\Users\user\.claude\projects\` 底下各專案目錄（主要 `F--ymlab-fankeel`、`F--ymlab`）的 `*.jsonl`，與 `<session>/subagents/agent-*.jsonl`。只取 timestamp 落在 2026-10-16 00:00 ~ 2026-10-18 23:59（UTC+8）的。assistant 行的 `message.usage` 有 input_tokens、output_tokens、cache_read_input_tokens、cache_creation_input_tokens（可能有 ephemeral_5m / 1h 拆分），`message.model` 是模型。
- 現成工具（在 F:/ymlab/fankeel 跑）：
  - `node scripts/spend.js`：每個 registry session 的花費組成（own / agents / input / output / cacheRead / cacheWrite / usd），約 393 行，用 grep/awk 過濾，不要整份讀。
  - `node scripts/usage-compare.js`：兩段日期區間比較（先讀檔頭看參數）。
  - `node scripts/sessions.js`：峰值中位數、p90、subagent 回傳佔比等。
  - `scripts/context.js`、`scripts/ctx.js`：context 讀數。
- 決策與量測：`docs/03-decisions/2026-10-12-compact-at.md`、`docs/03-decisions/2026-10-12-init-compact-window.md`、`docs/90-agent/reports/2026-10-12-compact-window-probe.md`、`docs/90-agent/judgements/2026-10-12-compact-before-build.md`、`docs/90-agent/reports/2026-10-16-inflight-4-6-8.md`、`lib/spend.js`（定價）。

需要的話自己寫一次性 node 腳本統計 jsonl（寫在系統暫存目錄，不要寫進 repo）。

## 什麼算答案

1. 數字：10/16–10/18 主 session vs 子 agent 的花費佔比；主 session 花費裡 cacheRead / cacheWrite / output / input 各佔多少。
2. cache write 大的實際來源（壓縮後重建、TTL 過期重建、前綴被改動、新 session 開場系統提示＋注入塊、或只是每回合新增量正常累積），附至少一個具體例子（session id + 時間）。
3. 估算：門檻改 350K 或 300K，這三天主 session 的 cacheRead 降多少、每次壓縮多付的 cache write＋壓縮輸出＋壓縮後重讀檔案增多少——淨效果，並說明假設。
4. 推薦 A/B/C/D 擇一（D 要說改什麼），以及什麼量測結果會推翻它。

## 回答格式

```
verdict: <A|B|C|D> — <一句話>
numbers:
  main vs agents: <...>
  main composition: cacheRead x% / cacheWrite y% / output z% / input w%
  cacheWrite sources: <前三名，各附佔比>
  example: <session id, 時間, 發生了什麼>
estimate:
  350K: <cacheRead 省 $ / 壓縮多付 $ / 淨>
  300K: <同上>
  assumptions: <...>
why main is still the biggest: <三點以內>
what to change: <最多三項，依影響排序>
overturned by: <什麼量測結果會推翻這個判斷>
```

全文繁體中文，程式名稱與欄位名保留原文。回傳只要上面這個格式，不要附過程紀錄——每一行都會落在主對話並在之後每回合被重讀。

## Answer

```
verdict: B — 降到 350000（並 `compact-window.js sync` 同步 env）：重播 3 天數據淨省約 $70（主 session 9%），是有效但次要的槓桿；主 session 佔比高的主因不是門檻，而是回合數（build/verify 在主 session 自己做）與 1h cache 過期後整段重寫，列在 what to change 2–3。
numbers:
  main vs agents: 10/16–10/18（UTC+8，fankeel+SBIR 兩專案 42 個主 session）總 $1,209：主 $772（64%）、agents $437（36%）；fankeel 單看 主 $333（72%）vs agents $131。主 9,106 回合、全 Opus 5.5、1h cache、平均 context 230K；agents 14,674 回合、5m cache、fankeel 的 agents 73% 是 sonnet。另有 bench/ilsbench `claude -p` 探針 $132 未計入。
  main composition: cacheRead 53.4%（$412）/ cacheWrite 33.6%（$260）/ output 13.0%（$100）/ input 0.0%（fankeel 單看 58.4 / 27.3 / 14.2 / 0）
  cacheWrite sources: ① 每回合正常新增 70%（$182；內容約一半是 assistant 輸出+thinking，Read/Bash/Grep 結果約 1/5，Skill 全文注入、跨 session SendMessage、背景 agent 回報合計約 1/4；hook 注入塊 UserPromptSubmit 834 次×3.1K 字只占 3–5%）② 1h TTL 過期後整段重寫 19%（$50，34 次，全部發生在 ≥55 分鐘空檔之後，平均重寫 184K）③ 壓縮後重建 8%（$22，49 次，壓後第一回合平均 creation 56K）；session 開場 2%。mid-session 前綴被打斷 = 0 次、cache 全 miss = 0 次：hook／注入塊沒有讓前綴失效。
  example: fankeel 5e181f59，10-16 08:52：AskUserQuestion gate 後使用者離開 69 分鐘，回來第一回合 cache_read 386K→38K、cache_creation 350K（1h 寫 $8/M ≈ $2.8）；SBIR 4b72ae2c 10-16 22:31 同型（67 分鐘，404K→19K，重寫 387K ≈ $3.1）。
estimate:
  350K: cacheRead 省 $130、壓縮點錯位多讀 $34 → 淨省 read $97 / 壓縮 49→72 次（+8 次/天），每次 ≈ $0.96（重讀 420K + 摘要 3.3K 輸出 + 34K 新前綴與 ~67K 重讀檔案以 1h 寫入），多付 ≈ $22 / 淨 ≈ +$70–75（主 9%、總 6%）
  300K: read 省 $163 − 多讀 $19 = $144 / 壓縮 49→93 次（+15 次/天），多付 ≈ $41 / 淨 ≈ +$99–103（主 13%、總 8%）；比 350K 只多省 $28 卻多 21 次壓縮（每次 40–80 秒等待＋工作狀態丟失），且要改 `scripts/compact-window.js` sync 與 `compact.at` 允許值——不值。
  assumptions: 以 9,106 筆主 session 請求逐筆重播；壓縮觸發 = T−30K（實測 47 次 auto 落在 416–428K、中位 418K，另 2 次 manual），壓後 34K（中位），每回合新增量與門檻無關；450K 基準重播得 49 次（= 實際），淨差 +$4 即誤差底線；定價用 lib/prices.js。agents 只計 `<session>/subagents/*.jsonl`，own 與 `scripts/spend.js` 逐一相符、agents 少算 ≤25%（cd62ad07 $17.6 vs 登錄 $23.1），主佔比最低仍 ~59%。未開 scripts/context.js、ctx.js，未跑 usage-compare.js、sessions.js。
why main is still the biggest: ① 回合數：主 session 3 天 9,106 回合，每回合把平均 230K 前綴重讀一次（$0.046/回合）；Bash 3,943、Read 1,536、Edit 654、Write 393 次 tool call 全在主 session——`stage.agents` 只有 survey，design/plan/build/verify/land 的工作主 session 自己做。② 全 Opus 5.5＋1h cache：進主 context 的每個 token 寫一次 $8/M（= 40 倍 read 價），3 天寫 32.5M；agents 用 5m（sonnet $2.5/M）。③ 1h TTL：在 gate 離開 >1 小時的 34 次，回來整段重寫 $50——與門檻無關。
what to change: ① `task.js profile set compact.at 350000` ＋ `node scripts/compact-window.js sync`（env 跟到 350000；不同步則主機仍在 418K 壓）——省主 ~9%。② 離開前先壓：gate 後預期離開 >1 小時就 `/compact`（或 hooks/compact.ts 在 gate 回合結束且 ctx >200K 時提示）；壓後重寫只 34K ≈ $0.3，每次省 ~$2，34 次 ≈ $60/3 天，與降檔同量級。③ 減少主 session 回合：build/verify 加進 `stage.agents`（主 session 只轉路徑），Read/Bash 探索交 reader；Skill 全文注入（48 次 ~0.95M tok）與跨 session SendMessage（~0.65M tok）縮短。09-03 的 1.85× 是舊價量的，Opus 5.5 read 已與 Sonnet 同價（$0.2/M），需重量。
overturned by: 改 350K 兩週後 `usage-compare.js` 顯示每 session 主 cacheRead 沒降 ≥8%，或壓縮次數 >2 倍且壓後 10 回合 creation 平均 >100K（重讀過多）→ 回 450K；若主 session 回合多數是 gate／relay 而非 Bash/Read（build 已外派）→ 第 ③ 項無效；若 TTL 事件多數不在 gate 後（無法預先壓）→ 第 ② 項無效。
```
