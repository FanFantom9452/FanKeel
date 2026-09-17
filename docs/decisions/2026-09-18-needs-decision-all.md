---
status: current
last_verified: 2026-09-18
source_of_truth: lib/gates.js, hooks/leave.js, lib/usage.js, scripts/todo-check.js, lib/skill-overlap.js, docs/pipeline.md
---

# TODO Needs a decision 二十七條一次清 — 決策

使用者的問題是「TODO.md `## Needs a decision` 全部 26 條：逐條定案並落地」。
survey 途中發現第 27 條——別的 plugin 的 process skill 會不會撞到 fankeel 的
stage——使用者要求併進來一起處理。這份記的是三個送到關卡的問題怎麼答的、
build 到 audit 各自撈回什麼、以及哪些是刻意不做的。

十一個任務，十三筆修正，範圍從 `6bd54fb` 到 `8ae4c87`，彼此不重疊。

## 三個問使用者，二十四個自己決

- **A（N04、N06）：關卡問了什麼、使用者選了什麼，要留在哪。** 答案是
  SessionEnd 另存摘要，不塞進 registry 的主體。`hooks/leave.js` 寫 `gates`，
  條件在 `lib/gates.js`；`registry` 本身只多一個欄位。
- **B（N10）：新加的檢查要不要進 CI。** 不進，發版前手動跑。理由是這個
  專案的檢查本來就是 land 前跑的那三支，多一層 CI 只是把同一件事挪到更遠
  的地方失敗。
- **C（N27）：別的 plugin 的 process skill 與 fankeel 的 stage 誰贏。**
  任務進行中 fankeel 贏。`lib/skill-overlap.js` 帶著那張重疊表，
  `docs/pipeline.md` 的表逐列與它相同，並有測試守著。

其餘二十四條由 build 當場裁決，每一條都寫進 ledger 的 `Ruling:` 行——包含
四條「不做」：`lib/blame.js` 自帶的 `git()` 不併進 `scripts/orient.js`（repo
慣例是每個檔案自帶一份），以及 Task 7 reviewer 提的共用 helper 不抽（那要
動計畫以外的相鄰程式）。

## 一條 ruling 被自己的對手推翻

這次最值得記的不是哪一條定案，是一條 ruling 錯了。

verify 為四個新測試做紅綠，log 卻跑在測試檔還沒 commit 的髒樹上。當時的
ruling 說不用重跑，理由是「`git show HEAD:<path>` 與工作區 md5 一致，且
porcelain 為空」。

那個橋是假的。乾淨的樹上，`HEAD:<path>` 與工作區必然相同——那正是
porcelain 為空的定義。它證明不了 log 跑的當下那個檔案的內容，因為當下的樹
是髒的。一個沒有失敗可能的檢查不是證據。

對手在 verify 的最後一輪把這條連同四列一起打掉。四個突變因此在 `e65e4d7`
的乾淨樹上原地重跑，第 12 列的論證換成同一次跑印出的 `porcelain=[]` 與
`porcelain after=[]`——那個比較是拿磁碟內容對 commit 的 blob，任何一次
`finally` 還原少一個位元組都會冒出 `M <path>`，它有失敗的路。

## verify 撈回十六條，三條是真的缺口

十一份證據表共 204 列，186 列成立，16 列被各自的對手打掉。其中十三列是取證
方法的毛病——grep 樣式漏字、範圍寫錯、拿描述當輸出——在同一個 stage 裡用
正確的命令重取就結案了。

真的缺口有三個，全部退回 build 各自 commit：

- `tests/registry.test.js` 沒守住「沒讀到數值時 `touch` 只記兩個元素」。
- `tests/orient.test.js` 沒斷言 `claude.md:` 那幾列的路徑與大小。
- `tests/orient.test.js` 沒斷言沒安裝的 overlap 列不會印出來。

三個都是綠的突變——改壞了程式，測試照樣過。補上斷言後各自由綠轉紅。

另外兩條是假敘述：`docs/station.md` 沒把 `gates` 列進 `hooks/leave.js` 寫的
欄位，`docs/decisions/2026-09-11-todo-eight.md` 的兩個引用指到無關的行。

## audit 找到的，與 reviewer 打掉的

43 對共用檔案的頁面配對讀了最前面 4 對，三對回 clean，一對帶回兩句假敘述和
一處單一真相來源沒有互指：

- `docs/station.md` 說 `spans` 的四種區間都被夾在 session 的頭尾請求之間。
  `lib/detail.js` 只夾 `main` 與 `wait`；`agent` 與 `workflow` 走 agent 檔
  自己的頭尾，函式自己的註解就寫了。
- `docs/station.md` 說 transcript 不在本機時「沒有 detail，面板會這樣說」。
  `lib/detail.js:674` 在找不到 transcript 時回傳先前快取的那份。
- `docs/registry.md` 與 `docs/station.md` 各自完整講了誰寫 station 頁、哪些
  檔案只在位元組不同時才覆寫，兩邊都沒互指。

改完之後，audit 自己的 commit 也送了 reviewer，又被抓到兩條：寫進 TODO.md
的裁切條目說「其餘十一個 CLI 都用 `parseArgs`」，實際是十五個 `require('node:util')`，
而且 `scripts/survey.js` 也是手寫的、理由記在它自己的註解裡；`docs/registry.md`
那格只是把指標接在後面，重述整段還留著，commit 訊息卻宣稱兩頁不再重複。兩條都
在 `8ae4c87` 修掉。

## 這次沒做，而且是刻意的

- **計畫檔 `:2421` 與 Coverage `:2774` 把讀 transcript 記在 `lib/replay.js`。**
  錯在計畫不在實作。計畫是 `design-intent`，land 時歸檔；會被當現況讀的
  `docs/registry.md` 已經改成 `lib/gates.js`。
- **三個 brief 裡的錯數字。** 同理，只存在於歸檔的計畫與 brief。
- **audit 三個裁切鏡頭找到的 26 行。** 一行程式都沒動。verify 已經在
  `e65e4d7` 簽過名，這些改動要有自己的紅綠與 review；三條寫進 TODO.md 的
  `## Needs a decision`，留給下一輪決定。
