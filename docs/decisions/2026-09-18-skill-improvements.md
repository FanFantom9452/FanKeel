---
status: current
last_verified: 2026-09-18
source_of_truth: TODO.md, scripts/todo-check.js, scripts/orient.js
---

# 使用者 09-18 十五項改進意見分段成 TODO — 決策

使用者 2026-09-18 一次口述十五項改進意見,明確要求「根據上面這些內容分段問題,拆成
TODO」。這份記的是十五項各自去了哪裡、為什麼大部分沒有變成待辦、以及 audit 的對手
推翻了什麼。

一個任務,一個 commit,範圍 `eb5ffed..81e96a8`,只動 `TODO.md`。

## 十五項裡只有五項是真缺口

survey 對每一項查了現況。結果:

| 去向 | 幾項 | 是哪幾項 |
|---|---|---|
| **已完整存在** | 3 | 2(station 的 profile 按鈕)、3(一次性 Fable 判官)、8(ponytail 解依賴) |
| **已裁決過** | 6 | 1(design mockup,N22)、5 前半(唯讀 agent 誤判,N23)、6(memory 清理,N16/N17)、10(station 單 session,N18)、11(主 agent 叫醒,N12/N20)、12(redesign 重現,N22) |
| **已有結論** | 1 | 13(reader 平行化:09-15 實測 442 檔 0.394 秒,瓶頸不在讀取) |
| **成為新條目** | 5 | 4(docs tree 分區)、5 後半(唯讀 agent 有 Bash)、7(caveman 解依賴)、9(session 堆疊手段)、14(版本號)、15 後半(存全部選項) |

三項「已完整存在」值得單獨記下來,因為使用者以為它們不存在:

- **第 2 項的按鈕整套都在。** `scripts/station.js:533` 的 `POST /profile`,
  前端 `assets/station/station.js:1240` 每個 profile key 一個 `<select>` 加 `set` 鈕、
  `:1266` 每張專案卡一個「套用機器預設(N 鍵)」鈕。只在
  `node scripts/station.js serve --open` 底下看得到 —— `/fankeel` 每次寫的
  `.fankeel/index.html` 是靜態檔,`S.serve` 為 false,所以顯示的是可複製的指令。
  註解寫在 `assets/station/station.js:1307-1308`。
- **第 3 項就是 `/fankeel-ask`。** `agents/fankeel-judge.md` 已經是 `model: fable`、
  一次性、不追問,答案存成 `docs/judgements/<日期>-<slug>.md`。
  唯一的差別是現在只有使用者手動觸發,stage 規則不會自己叫它。
- **第 8 項 09-12 就做完了。** 程式碼零硬依賴,`tests/badge.test.js:144-151` 與
  `tests/source.test.js:167-176` 兩個反向測試守著。只剩使用者自己解除安裝。

## 第 11 項的資料推翻了使用者的假設

使用者說「主 Agent 一直被叫醒,每次重送整份 context,計費按堆疊總量指數增加」。

量出來的是:193 份 transcript 依 mtime 分桶,subagent 佔 token 的比例從 >14 天的
30.7% 升到本週的 53.4%,**這一半對**。但 `summarise()` 全期 `sumRequests` 21,376、
`sumWakes` 1,498 —— **叫醒只佔主 agent 回合的 7.0%**,而 subagent 回傳只佔工具輸出的
7.61%。

→ **要壓的是主迴圈自己的回合數,不是派工次數。** 這改變了第 9 項該怎麼選手段,
所以它寫進了〔session〕那條待決條目裡。

## 第 12 項的答案是一個負結果

使用者想在另一台機器重現 station 的 redesign。查下來:**沒有 skill 清單可以照裝。**

控制組是有效的:同一組 pattern 對 `docs/archive/2026-09-10-design-mockup.md` 命中
10 次,對所有 station 文件零命中。零不是因為沒查到,是因為真的沒用。

**Corrected 2026-09-18:** 負結果只對文件成立，對照組只掃了文件、沒掃 transcript。
session `d39444fc`（09-14 三層改版）畫 mockup 的 subagent（opus）叫過
`frontend-design:frontend-design` 與 `dataviz`；09-04 到 09-08 的五個改版 session
都沒叫設計 skill。

能搬的是流程,不是清單:`design.mockup` 指定的模型畫 mockup → 人核准 → implementer
逐字搬 CSS。那節寫在 `skills/fankeel-design/SKILL.md` 的「3. The mockup」。

## 發版沒做,寫成條目

`git rev-list --count origin/main..HEAD` → 30。`origin/main` 在 `70771cd`,
marketplace clone 也在 `70771cd`,`installed_plugins.json` 記 `version: 0.69.0`。
交付路徑是「本機 commit → push → marketplace 抓取 → 安裝」,**中間斷在 push**。

這一件事同時解釋了使用者的兩項:第 5 項前半(N23 修好的 guard 箭頭誤判沒在跑,
今天一個 reader 還撞上那個 16 小時前就修好的 bug)與第 15 項前半
(`lib/gates.js` 在 136 筆 registry entry 裡零筆)。

**沒發版。** 推送是對外且難以回復的動作,而 profile 是 `land.push false` ——
那是使用者自己設的立場。使用者在 design 關卡被明確問過一次,選了「先不發,
只寫成 TODO 條目」。

## audit 的對手推翻了四件

audit 這一站的發現清單被自己的對手打掉四處,四處全部接受並改正。兩處是理由錯了、
結論仍對,兩處是主張本身就是假的:

| 打掉什麼 | 原本寫的 | 實際 |
|---|---|---|
| **pair 全掃跑過了** | 09-17 那次 audit 今天凌晨掃完 43 對,不必重跑 | **假的。** 那次的閱讀發現只有 `registry × station` 一對。cut 那一半確實跑過(三條裁切條目在 `TODO.md`),pair 那一半只走了一對。**其餘 42 對從來沒被讀過** |
| **commit 清單** | `d8618b1` 之後只有三個 commit | 四個,漏了 `2d78d8a`(needs-decision-all 的落地) |
| **index 缺兩列的理由** | `docs/README.md:188` 說 `docs/plans/` 是 until the work lands | 那一列沒這個意思,而且同一頁就有反例:`plans/2026-09-09-design-class-prompt.md` 是未落地的計畫卻有索引列。**正確的理由**是 `d8618b1` 的前例 —— 它同一個 commit 把兩份計畫改名進 `archive/` **並**改 `README.md`,順序是先歸檔再寫索引,一次寫對 |
| **memory 那 50 條不必問** | 和 N16、N17 重複 | N16 裁的是掃描器行為(只列不 fail)並明寫刪不刪由使用者決定,N17 裁的是 schema。兩條都沒裁到「今天這 50 條要不要處理」 |

前兩件在 `.fankeel/build/2026-09-18-skill-improvements/audit-findings.md` 裡以
「更正 A」「更正 B」保留原文與更正,不是靜默改寫。

## 這一輪刻意沒做的

- **沒發版。** 見上。
- **沒掃剩下的 42 對。** 使用者選了「進 land 然後把剩下的記錄到 todo」,
  所以它成了 `## Ready` 的〔audit〕那條。
- **沒動 50 條 stale memory。** 成了 `## Needs a decision` 的〔memory〕那條。
- **沒把 `documents.md` 改成連向 `development.md`。** pair reader 查出三個共用檔
  都沒有事實矛盾,只是兩頁都不讓,SSOT 形式上破了。
  「Never move a document unasked」—— 成了〔docs〕那條待決。
- **沒動七頁的 `last_verified`。** 那七頁今天被 reader 讀過全文,但問的是
  「這個 diff 讓哪一行變假」,不是「整頁對照程式碼還對不對」。
  前者過了不等於後者,把日期往前推會變成一句沒人驗過的話。
- **沒重跑整支分支審查。** 分支只有一個 commit,範圍與 Task 1 剛審過的逐字相同。

## CJK 標點改全形

計畫的圍欄裡是半形,落地的條目是全形。理由:`TODO.md` 現有十條 CJK 條目 10/10
都用全形,被改的那一行自己也是。條目尾端那段分隔符(破折號、markdown 連結、句點)、
`lifts when:` 與 `MM-DD` 戳記維持半形,因為 `scripts/todo-check.js` 的 `LIFTS` 與
`STAMP` 正規式比對的是半形。

## 對照組是真的紅過

`TODO.md` 是一份文件,沒有新測試,所以紅綠對照組做在檢查器上:把〔caveman〕解除安裝
那條的 `lifts when:` 拿掉、戳記留著,`node scripts/todo-check.js` 必須紅在 `unlifted`。

主 session 跑了一次(紅:`TODO.md:103 unlifted`,綠:exit 0)。
verifier 又獨立重建了一次,而且**第一次建錯**:單獨複製一份 `TODO.md` 到別的目錄,
`check()` 會相對於 `path.dirname(file)` 解析連結,20 個連結全部變死連結,
24 個問題、exit 1 —— 與被測的變因無關。它在 scratchpad 建了帶 20 個 stub 檔的
控制目錄重做,A 臂綠、B 臂只有一個 `unlifted` 問題且落在被改的那一行,戳記檢查沒被波及。

`build` 的 reviewer 另外讀了 `scripts/todo-check.js:241-269`,確認 `stampAt` 與
`liftsAt` 是兩個互不相關的 `if`,所以拿掉 `lifts when:` 不可能經由戳記那條路徑轉紅。
