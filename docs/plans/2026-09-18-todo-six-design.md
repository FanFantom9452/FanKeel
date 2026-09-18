---
status: design-intent
last_verified: 2026-09-18
---

# TODO 六條一起做 — 設計

使用者在 `/fankeel` 的選單上選了「do it all」，取的是選單四項：`## Ready` 三條，
加 `## Needs a decision` 最新三條。共六條。`## Needs a decision` 剩下的 8 條不在
這一輪，survey 的關卡上問過，使用者選了進 design 而不是留下來定邊界。

survey 之後這六條不是六件等重的事。**其中兩條根本不是 build 的工作**：42 對 pair
與 50 條 stale 記憶都是 `audit` 這一站的工作，而這條路線本來就有 `audit`。第三條
（發版）是 `land` 的工作。真正要寫程式與改文件的只有三條。

這份設計的主張就是這個：**不要把六條攤成六個 build 任務，按它們該落在哪一站分。**
class 已經買下全七站，用它。

## 1. 兩處假敘述用更正行，不改寫

`docs/decisions/2026-09-18-needs-decision-all.md` 是 `decision` role，寫一次不維護。
但「寫一次不維護」保護的是**過期**，不是**當時就寫錯**。這兩處是後者。

- `:28` 的「其餘二十四條由 build 當場裁決，每一條都寫進 ledger 的 `Ruling:` 行」
  下面加一行 `**Corrected 2026-09-18:**`，寫明 ledger 實際只有 21 條 `Ruling:`，
  其中只有 N07、N08、N11 三條點名編號，其餘的實質裁決在 design 與 plan 文件裡。
- `:11` 的「這份記的是三個送到關卡的問題」下面加一行 `**Corrected 2026-09-18:**`，
  寫明同一頁 `:18`、`:21`、`:24` 自己列的是 A（N04、N06）、B（N10）、C（N27），
  四個編號而不是三個；「三」數的是英文字母分類，不是編號。
- 原文一個字都不刪。這是 `skills/fankeel-audit/SKILL.md:114-118` 已經寫下的慣例
  ——加更正行，永不靜默改寫——這份設計只是把它用在 `decision` 頁上。

## 2. `todo-check.js` 的重述：`documents.md` 改連過去

TODO 那條說有三處重述。survey 查下來**只有一處成立**，另外兩處是誤判。

- `docs/documents.md:287` 說 `TODO.md` 是「a list `scripts/todo-check.js`
  re-verifies in full on every run」，而 `docs/development.md:35-40` 整節逐條講
  `todo-check.js` 檢查什麼。這一處是真的重述，改法是 `documents.md` 那句改成連到
  `development.md` 的那一節，不再自己講一次。
- `docs/documents.md:148` 的 `lib/tracked.js:31` 是 docs-check 錨點引用的示範，
  `:92` 的 `tests/badge.test.js` 是 `survey.js badge` 的輸出清單。兩處都是把檔名
  當例子，沒有重述 `development.md` 對那兩個檔講的事。**不動。**
- 這條 TODO 的「三處」本身是錯的，但它會在交付時被移除，所以不必先改它。決策紀錄
  要寫下只有一處成立，否則下一個人會以為另外兩處被漏掉了。

## 3. `gates` 存下選項文字，`gateSummary` 改讀它

這是六條裡唯一要改程式的。TODO 給了三個選項：存全部選項、只存被換掉的、維持現狀。
**選存全部選項**，理由不是完整性，是現在有一個出貨中的統計會無聲失準。

- `lib/gates.js:56-61` 的 `gatesFrom()` 目前只推 `{at, stage, header, picked}`。
  加一個欄位存 `AskUserQuestion` 宣告順序的選項文字，沿用 `PICK_LEN` 的截斷與
  `MAX_GATES` 的上限，不新增常數。
- `lib/station.js:445` 的 `gateSummary()` 目前從 `lib/replay.js:122-127` 重算的
  `q.labels` 取 `labels[0]`。改成先讀持久化的欄位，讀不到才回頭用 `replay`。
- 為什麼要改：`replay` 需要 transcript。transcript 沒了，`picked` 還在（`gates`
  存了），選項文字不在，於是 `swapped` 的分母只算得到 transcript 還在的那些
  session。統計會隨時間縮水，而頁面上看不出來。這是缺陷，不是缺功能。
- `docs/registry.md:254-262` 現在寫著記錄是 `{at, stage, header, picked}` 且
  「Nothing reads it back」。這兩句都會因為這一節變成假的，**同一個任務裡改掉**。

## 4. 42 對 pair 是 audit 這一站的工作

`scripts/docs-audit.js:399` 的 `sweep()` 回 43 對，`docs/decisions/2026-09-18-skill-improvements.md:83`
記著只有 `registry × station` 被讀過。42 對沒人開過。

- 不在 build 裡拆。`skills/fankeel-audit/SKILL.md:186` 已經指名這條鏈是一個
  workflow——pair reader 之後接對手，用 `pipeline` 跑，每個 `agent` 帶 `model`，
  `sonnet` 是底。那條規則就是 host 的 opt-in。
- 清單由 `sweep()` 產生後交給 workflow，不讓 workflow 自己去找——那條規則也寫了。
- 回來的是 join，不是 42 份閱讀。裁決與 `routed:` 留在主回合。
- workflow 回來之後跑一次 `git status --porcelain`，再讀它的發現。

## 5. 50 條 stale 記憶與 pair 同一站

`scripts/memory-check.js:218` 的 `bad` 只看 `findings`，`stale` 永不 fail——這是
N16 已經裁過的行為，不重開。現在的問題只是這 50 條今天要不要處理。

- 在 audit 同一站走一遍，用 `skills/fankeel-audit/SKILL.md:114-118` 的慣例：錯的
  加 `**Corrected YYYY-MM-DD:**` 行。
- **刪除只刪使用者指名的那幾條**，不從掃描器推斷。這條規則照抄，不改。
- 現在是 103 條、50 stale；TODO 寫的 102 已經過期，但那條會被移除，不必先改。

## 6. 0.70.0 在 land 發版，push 是對 profile 的例外

- 發版排在最後，不排在最前。理由是推送後要換終端機，而換終端機會丟掉這個 session
  ——`/fankeel` → Adopt 救得回任務，但那是這一輪最後才值得付的代價。排在最後還有
  一個好處：0.70.0 就會裝著這一輪自己的成果。
- 代價要講明：在發版之前，裝著的 0.69.0 副本沒有 `f466f06` 修好的 guard 箭頭誤判，
  所以這一輪派出去的每個唯讀 subagent 的 Bash 都會把 `=>` 當成 redirect 擋掉。
  緩解是每份 brief 都寫一句「用 `function(){}`，不要箭頭」。survey 四個讀工都這樣
  派，四個都沒中招。
- `scripts/version.js 0.70.0` 改 13 個檔並自我驗證，`:163` 會拒絕非 semver。
- **push 是對 profile 的例外**：`land.push` 是 `false`，這條 TODO 明寫要推。land
  的關卡上要單獨問，不能當成 profile 的預設值默默做掉。
- 沒有任何成文的發版程序：`docs/development.md:71-79` 只講 `version.js` 做什麼，
  README 與 CONTRIBUTING 都沒有 push/tag 的步驟。這一輪把實際走過的步驟寫成
  `development.md` 的一節。

## 7. 六條 TODO 在各自交付的那一步移除

- 每一條在交付它的那個任務裡移除，不留到最後統一清。
- 三條數字已經過期（`## Ready` 的 30 實際是 33、〔memory〕的 102 實際是 103、
  〔docs〕的「三處」實際是一處），但三條都會被移除，所以不先改數字。
- `node scripts/todo-check.js` 在 land 之前跑，確認沒有斷掉的連結。

## 不做

- `## Needs a decision` 剩下的 8 條。survey 的關卡問過，不在這一輪。
- `scripts/memory-check.js` 的 fail 行為。N16 裁過。
- `gates` 的 schema 大改。N17 裁過，這一節只加一個欄位。
- mockup。**這一輪不是 frontend 工作**：站上那個 gate 面板沒有新畫面，`swapped`
  變的是資料來源不是呈現。這是一個判斷，可以被推翻。

## 這份設計動到的檔

| file | change |
|---|---|
| `docs/decisions/2026-09-18-needs-decision-all.md` | `:11`、`:28` 各加一行 `**Corrected 2026-09-18:**`，原文不刪 |
| `docs/documents.md` | `:287` 改連到 `development.md:35-40`，不再自己講 `todo-check.js` |
| `lib/gates.js` | `gatesFrom()` 加一個欄位存選項文字 |
| `lib/station.js` | `gateSummary()` 先讀持久化欄位，讀不到才回頭用 `replay` |
| `docs/registry.md` | `gates` 段的兩句被推翻，改掉 |
| `docs/station.md` | `gateSummary` 的描述一起查 |
| `TODO.md` | 六條在各自交付的那一步移除 |

## What proves it done

| test | 出自 |
|---|---|
| `tests/leave.test.js` 新案例：transcript 不存在的 session，`gateSummary` 仍數得到它的 gate。現在失敗，因為 `labels` 來自 `replay` | 第 3 節 |
| 站上 gate 面板讀出的 `swapped` 總數，與它來源的 gate 記錄逐筆加總相等 | 第 3 節（產物） |
| `node scripts/docs-check.js` 綠，且更正行引的數字用產生它的指令重跑一次對得上 | 第 1、2 節 |
| 43 對每一對都有一筆裁決，不是 12 筆——印出來的清單封頂 12，`sweep()` 才是全集 | 第 4 節 |
| `node scripts/memory-check.js` 的 stale 數下降，且每一條下降都對得上一行更正或一次使用者指名的刪除 | 第 5 節 |
| `node scripts/version.js` 說 `0.70.0, in all 13 places.`，且 `npm test` 綠 | 第 6 節 |
| `node scripts/todo-check.js` 綠，六條都不在 `TODO.md` 裡 | 第 7 節 |

## 對照地圖

`.fankeel/map.md` 列為 current 的頁裡，這份設計會讓 **`docs/registry.md` 的
`gates` 段落變成假的**（`:254-262`：記錄是四個欄位、且「Nothing reads it back」），
第 3 節同一個任務裡改掉。`docs/station.md` 描述 `gateSummary` 的部分要一起查。
其餘無衝突。

`planned, not built` 兩頁——`docs/improvement-brief.md`、
`docs/plans/2026-09-09-design-class-prompt.md`——這份設計都沒有當成已存在來引用。

## 還沒查的

完整測試套件（`npm test`）這一輪還沒跑過。所以「今天可以發版」目前只到版號 13 處
一致、工作樹乾淨為止。plan 的第一個任務就該跑一次，拿到基準線。
