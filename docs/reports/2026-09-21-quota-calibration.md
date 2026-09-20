---
status: current
last_verified: 2026-09-21
source_of_truth: 四份輸出都由 `docs/reports/evidence/2026-09-21-quota-calibration/` 底下同名腳本產生，各自帶著產生它的那個 sha — `windows-at-43daef5.txt`（全機 427 份頂層 transcript 的逐分段表）在 `43daef5`；`basis-at-3784eb7.txt`（兩次捕捉的對照、下限論證與 `quotaLimits`）在 `3784eb7`；`drift-at-b5abad3.txt`（66 個 session 的重分配）與 `sonnet-at-b5abad3.txt`（Sonnet 主控那一趟）在 `b5abad3`。三個 sha 是三次審查之後的修改：basis 補上第二份 transcript，drift 與 sonnet 把「文件裡提到指令」與「指令真的跑過」分開。`windows.js` 自 `43daef5` 起一個位元都沒動。兩次 statusline 捕捉分別是 `evidence/2026-09-21-long-task-projection/quota-capture-260920T163041Z.txt` 與 `evidence/2026-09-21-quota-calibration/quota-capture-260920T203515Z.txt`。費率表那次讀取的引文在 `pricing-read-260921.txt`。
---

# 5h 與 7d 額度怎麼掛勾，與逐站帳的戳記偏移

兩次 statusline payload 捕捉落在同一個 5 小時視窗與同一個 7 天視窗裡。
`docs/reports/2026-09-21-long-task-projection.md` 只有一次讀數，只能給上界；
兩次可以給速率。順帶量到一件本來不是在找的事：逐站的花費帳，中位數有一成以上
坐在錯的站。

## 1. 兩次讀數

| | 讀數 A | 讀數 B |
|---|---|---|
| 時刻 | 2026-09-20T16:30:41Z | 2026-09-20T20:35:15Z |
| 5h | 2% | 13% |
| 7d | 0% | 3% |
| 該 session 的 `cost.total_cost_usd` | $12.5610 | $109.1055 |

兩次的 `resets_at` 在兩支表上都相同（5h `1789936800`、7d `1790276400`），所以是
同一組視窗的兩個時刻，差值才成立。

**為什麼只有兩點。** 額度的**水位**只出現在 statusline payload 裡，而 TokenBar 的
`statusline.ps1` 只在 `CLAUDE_STATUSLINE_DEBUG=1` 時把 payload 傾印到一個檔，那個
檔被之後每一次 render 覆寫。有讀數，是因為有人在下一次 render 之前把檔複製走了。
registry 裡沒有，`lib/`、`hooks/`、`scripts/` 裡也沒有任何程式讀它。

**但 transcript 不是什麼都沒有。** 這一句我原本寫成「transcript 沒有」，是錯的：
assistant 行會帶一個 `quotaLimits` 物件。全機 4,687 份 transcript（含每一個
subagents 樹）裡有 13 筆，欄位是 `status`、`rateLimitType`、`resetsAt`、
`overageStatus` 那一組 —— **沒有任何百分比欄**。所以它當不了序列。它記的是別的東西，
見 §7。

中間那一段：244.6 分鐘、760 個 request、1.59 億 token、**$91.68**。全機 427 份**頂層**
transcript 裡只有兩個 session 在這個 5 小時視窗裡有 request，所以那不是抽樣，
就是整個視窗（`windows-at-43daef5.txt` block 2）。

## 2. 5h 這支表按錢走，不按 token 走

把視窗切成兩段各自算速率，兩個整數讀數的 ±0.5 都帶進去：

```
五小時表，以美元計
  open -> A   delta 1.5-2.5 points   $5.10-$8.50 per point
  A -> B      delta 10.0-12.0 points $7.64-$9.17 per point
五小時表，以 token 計
  open -> A   delta 1.5-2.5 points   5,229,590-8,715,983 per point
  A -> B      delta 10.0-12.0 points 13,255,976-15,907,171 per point

  dollars: the two segments AGREE — $7.64-$8.50 per point
  tokens:  the two segments DISAGREE — no shared rate
```

美元區間有交集，token 區間完全不相交。第二段混進了便宜的 Sonnet —— 1,555 萬
token 只值 $6.98 —— 所以 token／點暴衝而 $／點沒動。**「這支表在數 token」可以
丟掉了。**

照 $7.64–$9.17：一整個 5 小時視窗約 **$764–$917**。

## 3. 7d 對不起來，而且對不起來的方式很具體

同一段（$91.68）讓 5h 走了 11 點、7d 走了 3 點，所以 7d 一點約
**$26.19–$45.84**，一週約 $2,619–$4,584。一個 7d 點值 2.9–6.0 個 5h 點。

但**累積讀數與這個矛盾**。讀數 A 那一刻，7 天視窗（09-17T19:00Z 開）裡已經有
**$1,231.94、21.13 億 token、16,659 個 request**，表卻讀 **0%**（那是
`7d-open..5h-open` 與 `5h-open..A` 兩段相加 —— 16,536+123 與
2,099,537,625+13,073,975，不是任何單一列）：

```
  at A the window held $1231.94 and the meter read 0%
  at B the window held $1323.62 and the meter read 3%
  A therefore puts a point above $2463.89
  B therefore puts a point at $378.18-$529.45
  shared rate? NO — B needs a point cheaper than A allows, by a factor of 4.7
```

兩個讀數共用不了同一個速率，差**至少 4.7 倍**。所以 7d 的**絕對水位**不是這個
帳號 transcript 記到的流量的函數。是延遲、是只計某一類流量、還是視窗的計帳起點
不等於 `resets_at` 說的開窗時刻，兩個點分不出來。

## 4. 這些數字是下限，不是點估計

每一個錢的數字都是 transcript 算出來的。兩次捕捉是唯一有第二個獨立數字的地方，
所以它們是這個基準的對照：

```
at                    transcript basis   Claude Code's own   gap        gap %
reading A 16:30:41Z    $12.7472           $12.5610           +$0.1862   +1.48%
reading B 20:35:15Z    $97.4441           $109.1055          $-11.6614  -10.69%
```

讀數 A 差 1.5%，讀數 B 差 −10.7%，中間開了 $11.85 的口。那一段裡發生過一次
compaction（20:33:29.8Z，讀數 B 前 1.8 分鐘），而**兩個** session 的 transcript
裡單筆最大的 raw `input_tokens` 是 2 與 4 —— 沒有任何一筆看起來像整段 context 的
未快取讀取。

這比一個機制弱：它沒有證明 Claude Code 不把摘要呼叫寫進 transcript，只證明
transcript 裡找不到那樣一筆。但方向是穩的 —— 這個基準看不見的成本只可能是漏算，
不可能是重複計算。**因此 $91.68 是下限**，上面每一個 $／點也都是下限。不把
$7.64–$9.17 當定值。

（`basis.js` 原本只查 Opus 那一份 transcript，而 $91.68 是兩個 session 相加，所以
下限只對一半成立。審查抓到，現在兩份都查。）

## 5. 逐站的帳歪了多少

`clock` 和 `moves` 原本只由 `registry.touch()` 蓋戳，而 `touch()` 從 hook 跑在
下一個提示上。所以邊界落在事後的 sighting，而不是造成它的那道 `task.js stage`
指令 —— 靠 `windowsFrom` 分桶的東西全部繼承了這個偏移，包括 `spend`、站台的逐站
表、`scripts/spend.js` 的欄位。

把每個 session 的 request 分兩次桶：一次照 `clock` 記的邊界，一次照該 session
自己 transcript 裡 `task.js stage` 指令的時刻。

| | |
|---|---|
| 量到的 session | 66，共 280 個邊界 |
| 中位數有多少花費換了站 | **13.9%** |
| 超過一成的 | 44 個 |
| 低於 2% 的 | 3 個 |
| 最壞的單一邊界 | **晚 183.1 分鐘** |
| ≥$50 的 31 個：中位數 | **7.2%**，最壞 18.9% |

兩種分桶的總額完全相等，所以這是純重分配而不是計數錯誤 —— 腳本把總額對不上的
session 當成 mismatch 丟掉並回報，這一趟是 0 個。

**那份長任務報告的結論沒被推翻。** 它有一句靠 survey 只佔中位數 7.96%：survey 是
第一個視窗、從 -Infinity 起算，所以晚到的第二個邊界會把下一站的工作算進 survey。
量出來的方向正是如此 —— 61 個以 survey 開頭的 session 裡有 **59 個** survey 變小，
中位數從 10.45% 降到 8.22%；≥$50 的 31 個裡 30 個變小，6.02% 降到 4.74%。7.96%
是**高估**，所以「再調 survey 大腦幾乎無效」更強而不是更弱。

修法是 `task.js` 自己蓋戳（`registry.stampEntry`），和 `lib/detail.js` 的
`stageSequence` 早就在做的事對齊，`docs/station.md` 也早就這樣承諾。已經寫下的紀錄不遷移
（數量每天在長，所以這裡不給一個會過期的計數）：它們的偏移只能像這裡一樣從
transcript 重算。

## 6. Sonnet 主控那一趟

一條臂，沒有配對。`sonnet-at-b5abad3.txt`：

- 主 transcript 每一輪都是 `claude-sonnet-5`，6 個 subagent 也全是。沒有 Opus。
- 五站走完、本地 merge，合完的那個 commit `ad14458` 上整套 1658 綠。那個數字不在
  任何 evidence 輸出裡，是另外跑的，所以它帶著 sha —— 換一個 commit 就是別的數字。
- **$6.9784**、1,555 萬 token。逐站（照指令邊界）：survey $0.64、design $0.24、
  build $2.51、verify $2.99、land $0.60。
- registry 裡沒有 `spend`：`hooks/leave.js` 在 session 結束才寫，那個終端機當時
  還開著。所以一個活著的 session，它的額度讀數和它自己的 registry 紀錄永遠碰不到。

## 7. 答不了什麼

- **`k` 還是沒量到。** Sonnet 主控在 build／verify 的 token 倍數需要同一條任務在
  Opus 上再跑一次。$6.98 沒有對照臂。
- **7d 的絕對水位。** 兩個點只證明它不是累積的流量函數，不能說它是什麼。
- **5h 那個 $7.64–$8.50 只有兩段。** 兩段一致是證據，不是定律。
- **兩段的 $/點都是下限**，因為 compaction 的 token 不在基準裡；差多少不知道。
- **`before-7d` 那 $11,900.41 涵蓋 2026-09-17 之前的全部歷史**，不是這個帳號的
  帳單，是 API 等價估算。

**而下一次量測該用什麼，這一趟順手找到了。** `quotaLimits` 沒有百分比，但它記的是
**請求被拒的那一刻** —— 額度確實用盡，也就是 100%。那是定錨，不是區間。全機 13 筆，
分三次：

| 何時 | 哪支表 | 視窗重設於 | 幾筆 |
|---|---|---|---|
| 2026-08-20T18:38Z | `seven_day` | 2026-08-20T19:00Z | 1 |
| 2026-09-02T04:47Z–13:13Z | `five_hour` | 三個不同視窗 | 6 |
| 2026-09-09T22:58Z | `seven_day` | 2026-09-10T04:00Z | 6 |

拿其中一次被拒的時刻，把該視窗開窗到那一刻的花費算出來，就得到「100% 值多少錢」，
不必再猜整數讀數的 ±0.5。這份報告沒有用它 —— 它是另一次量測，`basis-at-*.txt`
block 4 是它的入口。

## 8. 怎麼自己重跑

四支腳本都不改倉庫狀態——不碰 git、不碰 registry、不碰工作樹裡任何別人的檔；
它們唯一寫的就是自己那份輸出，見下一段。路徑一律從 `__dirname` 往上解，transcript
目錄走 `lib/live.js` 的 `liveConfigDir()`：

```
node docs/reports/evidence/2026-09-21-quota-calibration/windows.js
node docs/reports/evidence/2026-09-21-quota-calibration/basis.js
node docs/reports/evidence/2026-09-21-quota-calibration/drift.js
node docs/reports/evidence/2026-09-21-quota-calibration/sonnet.js
```

每一支把自己的輸出寫成 `<name>-at-<sha>.txt`，sha 取自跑的時候的 HEAD。**那個
sha 要是真的，產生輸出的那個 commit 就不能同時改腳本。** 這裡是三對 commit，一對一次修改：
`43daef5`／`640309e` 是四支腳本與它們的第一批輸出；`3784eb7`／`7a91474` 是 `basis.js`
的修改與它的新輸出；`b5abad3`／`80742ae` 是 `drift.js` 與 `sonnet.js` 的修改與它們的。
三個放輸出的 commit 裡 `.js` 檔案數都是 0，而 `windows.js` 自 `43daef5` 起沒動過，
所以它的檔名仍然是真的：

```
for c in 640309e 7a91474 80742ae; do git diff-tree --no-commit-id --name-only -r $c | grep -c '\.js$'; done
git diff --stat 43daef5..HEAD -- docs/reports/evidence/2026-09-21-quota-calibration/windows.js
```

`grep -c` 回 0 時結束碼是 1，所以上面用 `for` 而不是 `&&` 串——串起來會在第一個
0 就斷掉，而 0 正是要的答案。這個坑也踩過。

用 `git diff-tree --name-only` 而不是 `git show --stat | grep`：後者會把 commit
訊息也算進去，而這份報告的訊息裡就寫著 `.js`，所以那個寫法會回報 1。這個坑是落地
前一刻踩到的。

`drift.js` 的數字會隨 registry 長大而動 —— 同一支腳本四十分鐘前量到 61 個
session，落地時量到 66 個，因為量測用的那個 session 自己又換了幾次站。這正是
輸出要釘 sha 的理由，也是引用時要連 sha 一起引的理由。

**上面的散文有捨入，輸出沒有。** 「1.59 億 token」是 `159,071,706`、「1,555 萬」是
`15,550,552`、「差 1.5%／10.7%」是 `+1.48%`／`-10.69%`、「$11.85」是 `$11.8476`、
逐站的 `$0.24`／`$2.99` 是 `$0.2396`／`$2.9856`。有疑問時以 `-at-*.txt` 為準。
機械比對的結果，逐項算出來而不是估的：120 個數字，16 個不是逐字出現在輸出裡 ——
5 個是 commit sha 的片段、8 個是上一段列的捨入、2 個是檔名裡的日期（`203515`、
`260921`），剩下 1 個就是 §6 那個 1658，報告自己已經標明它不出自任何輸出。

這個比對抓得到「不在輸出裡」，抓不到兩件事，兩件都真的發生過：**抄錯了輸出裡的哪
一列** —— §3 的 request 數原本抄了 `7d-open..5h-open` 單獨一列的 16,536，而該處要
的是它加上 `5h-open..A` 的 123；以及**把表裡的數字加錯** —— §7 那張表的第三列原本
寫 5 筆，輸出裡是 6 筆，而同一段的散文寫著 13 筆，1+6+5 湊不出 13。兩個都是審查
抓的，不是這個比對抓的。
