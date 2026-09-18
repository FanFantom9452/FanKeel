---
status: design-intent
last_verified: 2026-09-19
---

# Waiting 判斷機制 — 設計

09-15 使用者說：`## Waiting` 不進選單在工作流上是好事，可是沒有任何機制去判斷
這些條目什麼時候可以做。那條記成〔todo〕待決，09-17 以 N11「七天門檻運作正常」
結案，程式沒改。N11 回答的是門檻印不印得出來，沒回答誰來判斷；09-18 那次重讀
解除的兩條，事件早就發生了，是有人去讀才發現。

survey 查到的現況：`hooks/` 沒有一支讀 `TODO.md`；`scripts/orient.js:525` 只印
Waiting 的條數；`scripts/todo-check.js:253` 算出的 `overdue[].lifts` 只有
`report()` 讀，而 todo-check 只在 land 與 audit 由模型手動跑。

## 做法：時機當標題，照 SKILL 的 name / description

SKILL 分三層：`name` 短而好認；`description` 永遠在 context 裡，寫成「Use when…」，
本身就是觸發條件；body 用到才載入。模型每次看全部 description、拿眼前的情境比對，
那個比對就是判斷。

Waiting 等的是時機，時機到了，等它的事一起拉上來做。所以標題掛在**時機**上，
不掛在單一條目上：

| SKILL | `## Waiting` 底下 |
|---|---|
| `name` | `### <時機>`，24 字以內 |
| `description` | 緊接的一行 `lifts when: <事件>. MM-DD.`，一個時機只寫一次 |
| body | 時機底下的條目，時機到了一起變成一個 task |

不照〔前綴〕分群：前綴是主題，同主題的兩條常在等不同的時機——〔docs〕那兩條，
一條等 docs-audit 加功能，一條等一次事故。`###` 分群 09-11 立為待決、沒有實作
（`docs/decisions/2026-09-11-todo-split.md:64`），後來 `08cc2b2` 以〔前綴〕慣例結案，
談的都是主題分群；這裡的 `###` 只在 `## Waiting` 底下，分的是時機，其他三個 `##`
照舊。

**不加 kind 標籤。** 會改變行為的只有兩件：日期到了程式能判，只有人看得到的事要問
使用者。日期寫在條件開頭就讀得出來；哪些事只有人看得到，由處理的 session 當下讀
句子決定，不存下來，就沒有會跟內容脫節的標籤。處理失敗也不會留下髒狀態：改動在
build 才寫、land 才 commit，沒處理好的時機戳記沒動，下次 `/fankeel` 仍然 `due`，
再問一次——失敗退回「再問」，不會變成「被忘記」。

09-06 的設計（`docs/archive/2026-09-06-waiting-lifts-when.md:414`）拒絕機判，理由是
寫程式比讀還貴。這份不改那個結論：程式只判日期，其餘交給判斷得了的人。`:427`
拒絕的 `--waiting` 列表，前提是「條目要先帶事件」，那個前提已經成立。

今天這 10 條沒有兩條在等同一個時機，改完是 10 個時機、各 1 條。分群的好處在之後：
新延後的事等的時機若已經在，就放到那個 `###` 底下。

## 對照實際專案（09-19）

兩個 reader，一個回放本 repository 自 09-06 起的 `TODO.md` 歷史，一個看這台機器上
其他專案的 TODO；引用都抽查過。

| 問題 | fankeel 歷史 | 其他專案 |
|---|---|---|
| 同一時機等了兩條以上 | 約 35 條裡 1 例：`47059a6` 三條都寫 `lifts when: registry.json 落地` | 3 個專案有：ils-bench 三條等范董（它的 TODO 第 7 行起）、Trovara 四列「等范董拍板」（第 40–45 行）、ESP32s3-pressure 三條「需燒錄」（第 67、73、137 行） |
| 每週 `due` 比實際處理早或晚 | 因事件解除的 6 條：早 2、同 2、晚 2；晚的兩條是有人主動重讀，當天就解除 | — |
| 事件文字改寫 | 4 條共 5 次；改成時機標題，改寫的成本一樣 | — |
| 套不上的 | — | 多數專案的延後是「待決」或缺陷索引，屬 `## Needs a decision`；ESP32s3 的「0.6 擋 D-2」是任務相依，屬 plan，不是等時機 |

結論：分群有真實的先例，外面比這裡多；每週 `due` 不比過去差，差別在讀一定會發生，
不再靠有人剛好想起來。等外部某個人（范董）拍板的，事件只有人看得到，走問使用者那條。

## 1. 格式

- `## Waiting` 底下每個時機寫成：

  ```
  ### gates 滿一週
  lifts when: 09-25 起，registry 的 gates 累積一週. 09-18.

  - 〔profile〕`suggest` 只推 `land.*`：… — [lib/profile.js](lib/profile.js).
  ```

- 時機標題去掉反引號後不超過 24 字。
- 標題後第一個非空行是 `lifts when: <事件>. MM-DD.`，戳記的意思不變：最後一次有人
  讀過、同意它還在等的那天，放在最後。
- 時機底下至少一條 bullet；bullet 不再各自帶 `lifts when:` 與戳記。
- 事件以 `MM-DD` 開頭的是日期時機；那個日子取戳記當天或之後第一次出現的那天，
  跨年照算。

## 2. todo-check

- `entries()` 在 `## Waiting` 底下遇到 `###` 不重設 section，改給後面的條目帶上
  `timing`；其他 `##` 底下的 `###` 行為不變。
- 匯出 `timings(text, now)`，每個時機回 `{ line, title, event, stamp, date, due, items }`；
  orient 和 `report()` 都只讀它。
- `due`：日期時機從那天起為真，之前不管戳記多舊都為假；其他時機在戳記滿
  `REREAD_DAYS`（7 天）時為真。
- 下列各是 problem、exit 1：`## Waiting` 底下不在任何 `###` 裡的 bullet；時機缺
  `lifts when:` 行或缺戳記；時機底下沒有 bullet；標題超過 24 字。原本「每條 Waiting
  條目要有 `lifts when:` 與戳記」的檢查移到時機上。
- `report()` 印 `due` 的時機：標題、事件、條數；`due` 仍然不影響 exit code。

## 3. orient

- `todoBlock()` 每次列出全部時機，一個一行：`due` 標記或日期、標題、條數。`due`
  的排前面，其餘照檔案順序。
- 標題行寫 `Waiting N timings, M entries — K due, offer one option`，沒有 `due` 時寫
  `— none due, not offered`；K 等於下面標了 `due` 的行數。

## 4. 選單與處理流程

- `lib/stages.js` 的 INIT 把 `` `## Waiting` stays out `` 換成
  `` `## Waiting` is one option when `orient` marks any `due` ``，其餘不動；
  `init+st` 仍在 `tests/render.test.js` 的 1400 以下（09-19 量到 1311）。
- `skills/fankeel/SKILL.md` 的 **Asking** 一節寫長版：選了「處理 Waiting」就用
  `--route "survey,build,land"` 開 task。survey 只判 `due` 的時機：讀得到證據的
  （repository、registry、上游）自己去查；只有人看得到的，全部放進一次
  `AskUserQuestion`、`multiSelect`，一個時機一個選項、事件放 description，問「這幾件
  發生過嗎？」。build：解除的時機，底下的條目一起移到 `## Ready` 或
  `## Needs a decision`，`###` 與 `lifts when:` 行拿掉；沒解除的換上今天的戳記，
  日期到了事件卻還沒成立的換一個新日期。land 跑 todo-check。
- 同一節原本寫 `## Waiting` 完全不提供（`skills/fankeel/SKILL.md:723`），改成上面這條。

## 5. 現有十條與文件

- `TODO.md` 的十條改成十個時機，各一條：gates 滿一週（09-25，〔profile〕）、交接後
  context 仍過 400k（〔session〕）、docs-audit 報未點名模組（〔docs〕lib 模組）、行內容
  漂移一次（〔docs〕行號）、判官歸檔造假一次（〔judge〕）、旗標被忽略一次（ledger，
  補上〔ledger〕前綴）、fanoutSync 溢位一次（〔lib〕）、需要第十一種語言（〔survey〕）、
  下一個前端任務（〔design〕）、knip 認得 CJS namespace（〔build〕）。
- `TODO.md` 開頭的說明：表格 Waiting 那列、`lifts when:` 與戳記那段改成時機的寫法、
  〔前綴〕那段補一句 `###` 在 `## Waiting` 底下分的是時機；`TODO.md:65-67` 與
  `docs/development.md:58` 寫「`## Waiting` 從未因事件發生而縮小」，改成 09-18 的
  事實：兩條因事件解除，也都是有人讀了才發現。
- 描述格式的另外四處改成時機的寫法：`docs/development.md:50`、
  `skills/fankeel/SKILL.md:618`、`skills/fankeel-land/SKILL.md:112`、
  `skills/fankeel-audit/rationale.md:153`。

## 驗收

- `tests/orient.test.js`：fixture 放兩個時機——A 的事件是 `09-25 起…`、戳記 09-18、
  一條；B 的事件是 `看到一次…`、戳記 09-01、兩條。now 設 09-20：標題行寫
  `2 timings, 3 entries — 1 due`，只有 B 標 `due`，A 顯示 09-25。now 設 09-26：
  `2 due`。今天這個測試會失敗——`todoBlock()` 只印 `Waiting 3 — not offered`。
- `tests/todo-check.test.js`：不在時機裡的 bullet、缺 `lifts when:` 行的時機、沒有
  bullet 的時機、超過 24 字的標題，各自 exit 1，且 problem 說的是那個原因；時機底下
  的 bullet 不帶戳記，exit 0。斷言原因而不只 exit code：今天 `###` 會被當成另一個
  標題，帶 `###` 的四種全報成「不在三個標題之下」，不帶的那種則放過。
- 實際產物：改寫後的 `TODO.md` 跑 `node scripts/todo-check.js` exit 0；跑
  `node scripts/orient.js`，標題行的 N、M 分別等於 `TODO.md` `## Waiting` 底下 `###`
  與 bullet 的數目，K 等於同一段裡標 `due` 的行數。
- `tests/render.test.js` 的 init 兩個上限測試照舊通過。

## 沒驗到的

處理流程是寫給 session 的規則，不是程式：「選了處理 Waiting 以後，只有人看得到的
那幾件真的用一次 multiSelect 問完」只能在實際跑一次 `/fankeel` 時看到。最早的機會是
09-25：gates 那個時機的日子到了，其餘九個的戳記也滿七天。
