---
status: decision
last_verified: 2026-09-19
---

# Waiting 判斷機制 — 決策紀錄

09-15 使用者說 `## Waiting` 沒有任何機制去判斷條目什麼時候可以做；09-17 那條以 N11
結案，程式沒改。09-19 在 `/fankeel` 上重提，路線七站全走，分支 `waiting-triggers`。
設計見 [archive/2026-09-19-waiting-triggers-design.md](../archive/2026-09-19-waiting-triggers-design.md)，
計畫見 [archive/2026-09-19-waiting-triggers.md](../archive/2026-09-19-waiting-triggers.md)。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 標題掛在哪 | `## Waiting` 底下的 `### <時機>`，等同一個時機的條目放在一起、一起解除 | 使用者：等的是時機，時機到了那些事一起拉上來做；照 SKILL 的 name / description |
| 事件與戳記 | 時機標題下一行 `lifts when: <事件>. MM-DD.`，只寫一次；條目不再各帶 | 事件屬於時機，不屬於單一條目 |
| 誰判斷 | 事件以 `MM-DD` 開頭的由程式判日期；其他時機戳記滿 7 天就 `due`；只有人看得到的事，處理時用一次 `multiSelect` 問 | 09-06 拒絕機判事件的結論不變：程式只判日期 |
| 要不要 kind 標籤 | 不加 | 使用者：處理不好時標籤會變成累贅；失敗只會讓戳記不動、下次再問 |
| 標題上限 | 顯示寬度 28 欄，中日韓文字算 2 | 使用者：要考慮中文和英文；算字數會讓中文標題寬一倍 |
| 在哪裡看到 | `orient` 每次列出全部時機；`/fankeel` 有 `due` 時給一個選項 | 讀一定會發生，不再靠有人剛好想起來 |

不照〔前綴〕分群：前綴是主題，同主題的兩條常在等不同的時機。對照 fankeel 自 09-06 的
`TODO.md` 歷史與這台機器上八個專案，同一時機等兩條以上的先例外面比這裡多。

## 二、落在哪

| task | 落在 |
|---|---|
| 1 | `scripts/todo-check.js`：`timings()`、`width()`、`mmdd()`；`untimed`、`empty timing`、`long title`；`TODO.md` 十條改成十個時機 |
| 2 | `scripts/orient.js`：`todo:` 區塊列出每個時機，`due` 在前、佔一格 |
| 3 | `lib/stages.js:154` 的 INIT 一個子句（行數不變，init+st 1345 < 1400）；`skills/fankeel/SKILL.md` 的處理流程 |
| 4 | `TODO.md` 開頭、`docs/development.md`、兩個 skill 頁改成時機的寫法 |

另有四筆 fix。不含 plan 與 design，14 個檔案 +468 −140；整套 1564/1564。

## 三、build、verify、audit 抓到的

- **轉錄換了碼位。** `WIDE` 的相容漢字區段開頭 U+F900，implementer 寫進去的是同形的
  U+8C48，範圍多吃 Latin Extended-D 與私用區。測試全綠；per-task reviewer 找到了卻說
  無害，實測 `width(U+A730 U+E000)` 回 4。改成 ASCII `\u` escape——而在工具參數裡打的
  `\u` 又會被解成字元，implementer 用 `String.fromCharCode(92)` 才寫進去。
- **plan 自己的缺陷三個**：`### under Ready` 測試只有一條條目會被 `vocabulary` 放過；
  `MAX_TITLE_WIDTH` 匯出了卻沒人 import；`tests/skills.test.js` 的錨點與
  `docs/pipeline.md:52` 那句沒有 task 點名。
- **verify 的文件 reader** 在 14 頁裡找到 3 行：`docs/README.md:162-163`、
  `skills/fankeel/SKILL.md:689`。adversary 推翻兩列證據（貼上的輸出被解碼、`due`
  分支沒被跑到），都在 session 內用可失敗的檢查重立。
- **audit 的 adversary** 找到 main 上本來就有的一句：land 第 4 步的延後條目說
  「`todo-check` fails the gate below」，但 todo-check 只在第 2 步跑。照使用者選的，
  改成寫完筆記再跑一次。

## 四、沒驗到的

選了「處理 Waiting」以後，只有人看得到的那幾件是否真的用一次 `multiSelect` 問完，只能在
實際跑 `/fankeel` 時看到。最早 09-25；記在 `TODO.md` 的 `### 第一次處理 Waiting`。
