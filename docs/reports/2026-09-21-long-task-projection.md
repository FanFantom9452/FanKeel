---
status: current
last_verified: 2026-09-21
source_of_truth: 兩支 evidence 腳本與它們綁著 sha 的輸出——`docs/reports/evidence/2026-09-21-long-task-projection/stages.js`（輸出 [evidence/2026-09-21-long-task-projection/stages-at-8365088.txt](evidence/2026-09-21-long-task-projection/stages-at-8365088.txt)，在 `8365088` 產生）與同目錄的 `project.js`（輸出 [project-at-f24916f.txt](evidence/2026-09-21-long-task-projection/project-at-f24916f.txt)，在 `f24916f` 產生）。逐站的錢由 `lib/registry.js` 的 `seriesOf` 與 `lib/prices.js` 的 `costOf` 算出，不是本頁算的；價格比由 `project.js` 從 `lib/prices.js` 的費率表逐分量算出來而不是寫死。S 的兩個端點來自 [evidence/2026-09-20-survey-brain-ab/ab7-table.txt](evidence/2026-09-20-survey-brain-ab/ab7-table.txt) 的逐模型列。額度讀數來自一次 statusline payload 捕捉，2026-09-20T16:30:41Z。本頁每一個數字都從那些檔來，本頁不會重新產生
---

# 長任務換 Sonnet 主控的投影 — 2026-09-21

**這個 repo 的 43 筆長任務 session，把主控從 Opus 換成 Sonnet 的投影是 $3,848.10 → $1,695.88–1,716.66，比值 0.4407–0.4461。破平衡點 k = 2.5052：Sonnet 要在沒有大腦的站上花掉超過 2.5 倍的 token，換主控才會變貴。[2026-09-20 的 A/B](2026-09-20-survey-brain-ab.md) 之所以只量到打平，是因為它量的是唯一一個有大腦的站——而 survey 在一個長任務裡的中位數佔比只有 7.96%。這是投影不是量測：它整個架在「Sonnet 在 build 與 verify 上花掉和 Opus 差不多的 token」這個假設上，而那一格沒有任何人量過。**

這一頁接著 [decisions/2026-09-20-survey-brain.md](../decisions/2026-09-20-survey-brain.md) 第三節與
[2026-09-20-long-task-cost-composition.md](2026-09-20-long-task-cost-composition.md) 第五節留下的問題：前者說換模型只打平，後者說那個結論不能外推到長任務，而且 94 筆可定價的**全部是舊模式，沒有一筆對照組**。沒有對照組就不能量，只能投影——所以這一頁做的是投影，並且把投影站在什麼上面寫清楚。

## 1. 分母

`.fankeel/sessions` 掃到 180 個 entry，0 個讀不出來，其中 **79 個帶 `spend` 欄位**。那 79 個攤開成 **551 個 stage 列**（parent 與 subagents 分開記），合計 **$3,966.20**、**67.9 億 token**。

551 列裡**沒有一列是無報價的**。registry 存的模型 id 是 `claude-opus-5`、`claude-sonnet-5`、`claude-fable-5-1`、`claude-haiku-4-5-20251001`，加上一個 `<synthetic>`——`[1m]` 那個後綴在寫進 registry 之前就被去掉了，所以 1M context 的 session 是按標準 Opus 費率計價的。第 6 節再談這件事。

投影只取 `requests` 落在 `200-799` 或 `800+` 兩桶的 session，共 **43 筆**（22 + 21），合計 **$3,848.10**——長任務吃掉這個 registry 97% 的錢。桶由 `lib/spend.js` 自己的 `buckets` 分，本頁沒有複製邊界。

**單位是 session，不是 task。**43 筆裡有 2 筆沒有 survey 站：`2bbed13d` 只有 design/build/verify/land，`e6f10192` 只有 audit/build/verify/land。它們整筆套價格比、不套 S，投影比值因此恰好是 0.4000；block 3 的中位數也把它們以 0.00% 計入。一個任務的 survey 若在另一個 session 裡跑過，那個 session 不在這 43 筆裡。

## 2. 價格比，算出來的

`project.js` 從 `lib/prices.js` 的費率表逐分量算 Sonnet ÷ Opus，四個分量全部相等：

```
four ratios equal: yes, r = 0.4
```

`lib/prices.js:17` 是 Sonnet 那一列：

```
    'claude-sonnet-5':           { input: 2,  output: 10, cacheRead: 0.2,  cacheWrite5m: 2.5,  cacheWrite1h: 4 },
```

對上 Opus 的 `5 / 25 / 0.5 / 6.25 / 10`，五個都是 0.4，含兩種快取寫入 TTL。**這件事讓後面的換算變乾淨**：既然每個分量的比值相同，成分組合就不影響結果，一段工作換模型之後的花費比值等於 `0.4 ×（token 量的倍數）`。

## 3. 投影

逐站套兩種乘數：

| 站 | 乘數 | 從哪來 |
|---|---|---|
| `survey` | `S`，兩個端點 0.973 與 1.049 | [ab7-table.txt](evidence/2026-09-20-survey-brain-ab/ab7-table.txt) 逐模型列：(0.3303+0.4673)÷0.8199 = 0.9728，(0.3076+0.6655)÷0.9279 = 1.0487 |
| 其餘每一站 | `r` = 0.4 | 第 2 節。這些站沒有大腦，主控就是全部成本 |

survey 之所以不是 `r`，是因為新模式在這一站多付一整個 Opus 大腦。而 `lib/stages.js:598` 說有大腦的只有這一站：

```
const CONTROLLED = ['survey'];
```

全體加總：

```
TOTAL	43 sessions	-	3848.0960	1695.8834	1716.6600	0.4407	0.4461
```

survey 佔一筆長任務 `old_usd` 的中位數是 **7.96%**。範圍很寬——最低 0.00%（那兩筆沒有 survey 站的），最高 44.99%。**佔比越低，大腦那筆固定開銷越被稀釋，換主控越划算**；而長任務就是佔比低的那一端。

## 4. 敏感度，與破平衡點

第 3 節假設 Sonnet 在沒有大腦的站上花掉和 Opus 一樣多的 token。那個假設沒有被驗過，所以把它變成參數 `k`（Sonnet 需要的 token 倍數），非 survey 站的投影改成 `old × r × k`：

| k | old | new | 比值 |
|---|---|---|---|
| 1.00 | 3848.0960 | 1695.8834 | 0.4407 |
| 1.25 | 3848.0960 | 2053.3553 | 0.5336 |
| 1.50 | 3848.0960 | 2410.8272 | 0.6265 |
| 2.00 | 3848.0960 | 3125.7710 | 0.8123 |
| 2.50 | 3848.0960 | 3840.7148 | 0.9981 |
| 3.00 | 3848.0960 | 4555.6586 | 1.1839 |

```
break-even k (new_total == old_total, survey held at S_low): 2.5052
```

破平衡點不是 1/r，因為 survey 站不隨 `k` 變——所以它由腳本解出來，不是寫死的。

**ab7 量到的 k 是多少？**那四臂裡主控單獨的花費比值是 0.3076÷0.9279 = 0.3315 與 0.3303÷0.8199 = 0.4028。除以 r = 0.4，得到主控的加權 token 倍數 **0.83 與 1.01**。第 2 節的「每個分量比值相同」是這個除法成立的理由。

**但那兩個數字不能拿來當 build 與 verify 的 k**，這是本頁最重要的一條邊界：ab7 的主控在那一站**把工作交給了大腦**，它自己沒做 survey。build 與 verify 的主控是自己做事的。那一格空著。

## 5. 額度：5h 與 7d

一次 statusline payload 捕捉，2026-09-20T16:30:41Z：

| | |
|---|---|
| 5h | 用掉 **2%**，視窗 2026-09-20T15:40Z 開始，20:40Z 重置 |
| 7d | 用掉 **0%**，2026-09-24T19:00Z 重置 |
| 這個 session 當下 | $12.80，45 分鐘 |

那個 5 小時視窗裡只有這一個 session：同期另外兩個 transcript，一個在視窗內只有 1 行且 0 token，另一個最後的內容停在前一天。

**7d 的 0% 與 registry 對不起來。**以 `resets_at` 往前推七天，該視窗從 2026-09-17T19:00Z 開始；registry 在那之後記到 **$1,094.68**、**18.9 億 token**、43 個 session、190 個 stage 列。若計量與這些成正比，三天前就該撞牆。它不是，而**一個整數讀數只給得出上界**，給不出分母。那 18.9 億裡 95.8% 是快取讀取、非快取（input+output）只有 1,676 萬——就算計量完全不算快取讀取，0% 反推出來的週額度仍要大於 33 億非快取 token，一樣不可信。

能說的只有兩句：**這個帳號當下在 5h 2%、7d 0%**；以及**花費與額度怎麼掛勾，一個點測不出來，要序列**。序列要靠 TokenBar 把它已經組好的那一行寫成檔案，那是另一個 repo，記在 `TODO.md` 的 `## Needs a decision`。

順帶，全 population 的滾動視窗（不分桶，因為額度視窗不分桶）：最高的 5 小時視窗是 2026-09-08T07:46:51.564Z 起的 4.71 億 token（3 個 session、14 個 stage）；以最早事件起算的自然 7 天視窗，最大的一格是 2026-09-07T17:07:15.090Z–2026-09-14T17:07:15.090Z 的 40.9 億 token（30 個 session、173 個 stage）。**那是自然視窗，不是額度視窗**，兩者的起點不同，不要混著引。

## 6. 這一頁答不了什麼

- **最大的一條：`k` 在 build 與 verify 上沒有任何量測。**整個投影的支點是它，而第 4 節唯一的實測來自一個把工作交出去的主控。要驗只能真的跑一對長任務。
- **S 只有 n=2**，而且來自 survey 一站、六到十四輪的短任務。
- **不是隨機分派。**43 筆是觀察到的長任務，沒有人把任務指派到某一桶。
- **樣本是這個 repo 自己的開發**，和 [2026-09-20-long-task-cost-composition.md](2026-09-20-long-task-cost-composition.md) 第五節同一條限制。
- **`<synthetic>` 的 token 被排除在美元之外，卻留在 token 總數裡。**兩個數字的母體因此差一點點。
- **1M context 可能被低估。**`[1m]` 後綴在進 registry 前被去掉，所以本頁所有的錢都是按標準費率算的。如果 1M 變體在 20 萬 context 以上有溢價，這個專案的每一筆都偏低——而這個專案幾乎都跑在 1M。沒有查證。
- **兩筆沒有 survey 站的 session**，見第 1 節。

## 7. 對 `TODO.md` 那條決策的意義

`## Needs a decision` 有一條問：survey 的大腦調過四輪後花費已打平、時間仍 1.4–1.6 倍、主控 context 仍多 8k，**要再調還是認定這樣就夠**。

這一頁給的答案是：**再調大腦，對長任務幾乎沒有意義。**大腦只在一站，而那一站在長任務裡的中位數佔比是 7.96%。把大腦的成本再壓一成，全局動的是 0.8%。

真正沒被量的是另一件事——**Sonnet 主控在沒有大腦的六站上表現如何**。那裡的槓桿是 0.4，破平衡點是 2.5 倍，而那一格是空的。所以下一步不是繼續調 survey 的大腦，是去量那六站。

## 8. 怎麼自己重跑

```
node docs/reports/evidence/2026-09-21-long-task-projection/stages.js
node docs/reports/evidence/2026-09-21-long-task-projection/project.js
```

第一支讀 `.fankeel/sessions`，第二支讀第一支的輸出表——**derived 檔從來源表自己的欄位重算**，和 [2026-09-20-long-task-cost-composition.md](2026-09-20-long-task-cost-composition.md) 同一個慣例。兩支都只寫自己的輸出檔，不碰別的。

額度那一格要重取，把 `CLAUDE_STATUSLINE_DEBUG=1` 放進 `~/.claude/settings.json` 的 `env`，statusline 下一次 render 就會把整包 payload 丟到 `%TEMP%\claude-statusline-payload.json`。**不需要重開 Claude Code**，這一點實測過。
