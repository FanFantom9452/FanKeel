---
status: current
last_verified: 2026-09-07
source_of_truth: 這一次 build 自己的紀錄——`.fankeel/build/2026-09-07-todo-thirteen/progress.md` 的 26 條 Ruling 與 9 條完成行、`main..todo-thirteen` 的 13 個 commit，以及每一次 dispatch 回報的 `subagent_tokens`；沒有任何數字是估的
---

# 一個 task 一個 reviewer、一個 fix 一次 mutation，值不值 — 2026-09-07

`TODO.md` 有一則寫著：*whether a reviewer per task and a mutation per fix earn their cost; measure the next build, which returns the mutations*。**這一次 build 就是那個 next build。**

**答案：reviewer 值。它抓到的五個發現，測試套件一個也抓不到——五次的當下套件都是綠的。** mutation 只跑了一次，而且它證實的東西是 reviewer 先發現的，不是它自己發現的；這一點下面說清楚。

## 1. 規模

| | |
|---|---|
| 計畫的 task | 11 |
| 實際跑的 task | 10（Task 8 沒跑，它服務的 TODO 項目被既有證據直接關掉） |
| dispatch 出去的 reviewer | 10 |
| commit | 13 |
| 記錄的 Ruling | 26 |
| fix round | 3 |
| 跑過的 mutation | 1 |

## 2. 十個 reviewer 回了什麼

| 判決 | 次數 | 是哪幾個 |
|---|---|---|
| `clean` | 4 | Task 1、6、7、9 |
| departure，收下 | 3 | Task 2、4、5 |
| 實質發現，觸發 fix round | 3 | Task 3（兩則）、兩個 fix commit 的複審（一則）、Task 10（兩則） |

三次實質發現一共五則。**五則全部發生在套件是綠的時候。**

| 發現 | 當下套件 | 測試抓得到嗎 |
|---|---|---|
| Task 3 的 gone-branch 比 task 授權的更寬 | 綠（它自己的測試會過） | 抓不到——那個測試對錯兩邊都會過 |
| `docs/station.md` 的兩句話被 Task 3 弄成假的 | 綠 | 抓不到——沒有測試讀散文 |
| 修好的那個測試其實不能分辨對錯兩邊 | 綠 | 抓不到，這正是問題本身 |
| Task 10 的報告從「沒生效」滑到「根本沒被讀」 | 綠 | 抓不到 |
| Task 10 沒承認計畫指定的儀器根本沒被試過 | 綠 | 抓不到 |

## 3. 反過來也成立

套件抓到三個 reviewer 沒抓到的：`tests/orient.test.js` 兩則、`tests/source.test.js` 的孤兒 export 一則。

**這不是 reviewer 失職，是分工的直接結果。** group 2 的四個 implementer 各自只被允許跑自己那一個測試檔——四個人共用一棵工作樹，跑全套等於在讀別人半成品；reviewer 也被明講不要跑套件，理由相同。所以跨檔的紅只可能由 parent 的全套跑抓到，而它抓到了。

**兩者不重疊。** reviewer 抓語意，套件抓跨檔，各自看不見對方那一半。

## 4. mutation 只跑了一次，而且要說清楚它做了什麼

一次：把 `lib/station.js:105` 從窄的分支改回寬的，跑 `tests/station.test.js`，看那一條新斷言變紅，再改回來看它變綠。47/47 → 46/47 → 47/47，紅的是 `a gone root never recorded before gains no entry` 這一條，沒有別條。

**它證實的是 reviewer 先發現的東西，不是它自己發現的。** 發現「這個測試對錯兩邊都會過」的是複審那一則；mutation 做的是證明改寫之後真的能分辨。這個順序值得寫下來，因為把 mutation 講成偵測手段會高估它——在這一次 build 裡它是**證明**手段。

代價：三個指令，幾秒。以這個價錢，一個 fix 一次 mutation 顯然划算；但 n=1，這一頁沒有資格說它在別的 fix 上也會這麼便宜。

## 5. 錢

工作流以外的六次 reviewer 與六次 implementer，各自回報的 `subagent_tokens`：

| | tokens |
|---|---|
| reviewer 六次合計 | 438,284 |
| implementer 六次合計 | 776,324 |
| 比值 | reviewer 是 implementer 的 **0.56×** |

group 2 是一個 Workflow，八個 agent（四 implementer、四 reviewer）只回報一個總數 612,507，**沒有 per-agent 拆分**——`agent-<id>.meta.json` 只有 `agentType`、`spawnDepth`、`model`，沒有 label。八個都確認是 `sonnet`，所以模型下限有守住，但這四個 reviewer 的錢分不出來，上表因此只算工作流以外的六次。

## 6. 這一頁的洞

- **n=1。** 一次 build，一種任務形狀（多半是照著計畫抄的改動加文件更正）。一個需要真正設計判斷的 build，比值會不會一樣，沒有量。
- **mutation 只有一次**，而且是證明用途。「一個 fix 一次 mutation」這個做法本身沒有被測試過——三次 fix round 只有一次跑了 mutation。
- **reviewer 的發現沒有對照組。** 沒有一個「不派 reviewer」的平行 build 可以比，所以「這五則沒有 reviewer 就會漏掉」是推論而不是量測——能量到的只有「當下套件是綠的」。
- **判決分類是我自己下的。** clean／departure／實質發現三分法沒有第二個人覆核。
