---
status: current
last_verified: 2026-09-18
---

# 把使用者 09-18 的十五項改進意見分段成 TODO — 設計

使用者 2026-09-18 一次口述十五項改進意見,明確要求「根據上面這些內容分段問題,拆成
TODO」。survey 對每一項查了現況,結果是**大部分已經存在或已經裁決過**,真正沒人碰過的
只有五項。

這份設計要做的不是實作那十五項,是**把它們放到正確的位置**:已存在的說清楚在哪、
已裁決的問使用者要不要重開、真缺口寫成 TODO 條目。

survey 的證據在 `.fankeel/build/2026-09-18-skill-improvements/`:
`survey-self.md`(主 session 自己讀的十三項發現,加四個 reader 的回報)、
`survey-rulings.md`(needs-decision-all 的 23 條定案全表)、
`todo-draft.md`(條目草稿本身,關卡核准的就是它)。

## 做法

一個任務,三件交付物:條目草稿進 `TODO.md`、一份決策紀錄、以及關卡上的兩組問題
(六條已裁決的要不要重開、發版現在做不做)。**不實作任何一項改進**,也**不發版** ——
推送是對外動作,而使用者的 profile 明確是 `land.push false`。

## 1. 發版不在這個任務裡做

- **發版寫成 `## Ready` 的條目,不在這個任務執行。** 推送 30 個 commit 到公開的
  GitHub repo 是對外且難以回復的動作,而使用者的 profile 是 `land.push false` ——
  那是使用者自己設的立場,不是這個任務可以代為推翻的。
- **關卡上明確問一次。** 這條卡住使用者十五項裡的兩項(第 5 條的誤判修正、第 15 條的
  `gates` 資料),所以不能只寫成條目就算數。

證據鏈:`git rev-list --count origin/main..HEAD` → 30;`origin/main` 在 `70771cd`;
`~/.claude/plugins/marketplaces/fankeel` 的 HEAD 也是 `70771cd`;
`installed_plugins.json` 的 `fankeel@fankeel` 記 `gitCommitSha: 70771cd`、`version: 0.69.0`。
交付路徑是「本機 commit → push → marketplace 抓取 → 安裝」,中間斷在 push。

## 2. TODO 條目:兩條 Ready、六條 Needs a decision、兩條 Waiting、一條修改

- **`## Ready` 兩條**:〔release〕0.70.0 發版;〔docs〕修
  `docs/decisions/2026-09-18-needs-decision-all.md` 的兩處假敘述。
- **`## Needs a decision` 六條**:〔registry〕版本號欄位;〔caveman〕20 skill 挑哪些;
  〔session〕堆疊手段挑哪個;〔docs〕`.fankeel/build/` 的定位;〔skill〕唯讀 agent 的
  Bash;〔gates〕要不要存全部選項。
- **`## Waiting` 兩條**:〔caveman〕解除安裝(等挑功能定案);〔gates〕第一筆資料
  (等發版加換終端機)。
- **修一條既有的**:`## Waiting` 的 design class 那條,補上它引用的三份必讀來源
  已經不存在。

每條都要過 `scripts/todo-check.js` 的六項檢查:200 字元上限、連結解析得到、連結不指向
plan/decision/report/archive 四種 role、必須在三個標題之一底下、`## Waiting` 要有
`lifts when:` 與 `MM-DD` 戳記。

## 3. 六條已裁決的,逐條問要不要重開

- **關卡上列出六條與它們的裁決,讓使用者逐條決定。** 使用者今天又提了一次,就是訊號 ——
  但重開一條 09-17 在 design 關卡核准過的決定,是使用者的權力,不是這個任務的。

| 使用者第幾條 | 編號 | 裁決 |
|---|---|---|
| 1 design mockup | N22 | 不獨立成流程,併入 `design.mockup` |
| 5 前半(誤判) | N23 | 修了 —— 卡在發版,不是裁決問題 |
| 6 memory 清理 | N16、N17 | 只列不 fail;不加壽命欄位 |
| 10 station 單 session | N18 | 「看不到三分之二」不成立 |
| 11 主 agent 叫醒 | N12、N20 | 不用另記;加 `wakes` |
| 12 redesign 重現 | N22 | 同第 1 條 |

## 4. 六件不進 TODO 的事,在關卡上說

- **第 2、3、8 條已完整存在**,要說的是「在哪裡、怎麼用」而不是寫成待辦。
- **第 12、13 條已有結論**,要說的是結論本身。
- **第 11 條的資料推翻了使用者的假設**,要說清楚,因為它會改變第 9 條怎麼選手段。

## 檔案表

| file | change | dispatch |
|---|---|---|
| `TODO.md` | 加 10 條、改 1 條 | in-session — 全部證據已在本 session 的 context 裡,派工要把十五項的查證結果重述一遍才能用,而回傳是同樣長度的文字:沒有殘渣可以移除 |

表上只有一列,因為 build 只動這一個檔案。本檔自己由 design 階段寫成,land 時歸檔;
決策紀錄由 land 階段寫。兩者都不是 build 的工作,所以不列在這張表上 ——
列進去會讓 `ledger.js lint` 要求某個任務去修改它們,而沒有任務應該修改它們。

## 成功準則

- **紅綠**:`node scripts/todo-check.js` 在條目落地後 exit 0。對照組 —— 把
  〔caveman〕解除安裝那條的 `lifts when:` 拿掉,它必須轉紅(那是 `## Waiting` 專屬的
  第六項檢查,拿掉 `lifts when:` 只會打到這一條,不會打到別條)。
- **產出物那一列**:`node scripts/orient.js` 的 `todo:` 區塊印出的三個數字
  (Ready N、Needs a decision N、Waiting N),要和 `TODO.md` 三節各自的 bullet 數一致。
  兩個數字來自同一份檔案的兩條路徑 —— `orient.js` 經 `lib` 解析,人工經 grep 計數 ——
  所以它們不一致就是解析器或檔案其中之一錯了。

## 對照 map

`.fankeel/map.md` 把 `docs/improvement-brief.md` 與
`docs/plans/2026-09-09-design-class-prompt.md` 列為 **planned, not built**。
新條目裡有三條連回 `docs/improvement-brief.md`。

**沒有衝突。** 那正是連結該指向的東西:TODO 條目是還沒做的工作,簡報是它的細節,
而 map 說簡報描述的工作沒被做 —— 兩邊講的是同一件事。既有的 `## Waiting` 條目也是
這樣連的。

本檔自己是 `status: design-intent`,land 時歸檔,所以不會變成第三份 map 要盯的
planned-not-built。

## 未驗證

四個送到關卡的決定(N04、N06、N10、N27),使用者當時的逐字選項沒有任何檔案記著。
reader 查過 ledger、archive 計畫、archive design、decisions 四處都沒有,要挖
`~/.claude/projects/F--ymlab-fankeel/*.jsonl` 的 `AskUserQuestion` tool_use 才拿得到。
這次沒挖 —— 它不改變任何一條 TODO 怎麼寫,而且它本身就是第 15 條要解決的問題。
