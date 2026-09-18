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

## 做法：照 SKILL 的 name / description

SKILL 分三層：`name` 短而好認；`description` 永遠在 context 裡，寫成「Use when…」，
本身就是觸發條件；body 用到才載入。模型每次看全部 description、拿眼前的情境比對，
那個比對就是判斷。Waiting 條目照這個形狀：

| SKILL | Waiting 條目 |
|---|---|
| `name` | 標題，24 字以內 |
| `description` | `lifts when [kind]:`，解除條件 |
| body | 連結的檔案 |

類比斷在一處：skill 的觸發比對的是眼前的 prompt，Waiting 的觸發比對的是 context
以外的世界。所以條件多標一個 `kind`，說**誰判斷得了**：

| kind | 證據在哪 | 誰判斷 |
|---|---|---|
| `date` | 條件裡的 `MM-DD` | 程式：日子到了就 `due` |
| `repo` | 這個 repository 或它的 registry | 處理 Waiting 的 session 去讀 |
| `upstream` | repository 以外：依賴的新版、別家 host 的文件 | 處理 Waiting 的 session 去查 |
| `seen` | 某人碰到一次的事故 | 使用者：一次 multiSelect 問完 |

09-06 的設計（`docs/archive/2026-09-06-waiting-lifts-when.md:414`）拒絕機判，理由是
五條只有兩條判得了、寫程式比讀還貴。這份不改那個結論：程式只判 `date`，其餘三種
是把判斷**分派**給判斷得了的人。`:427` 拒絕的 `--waiting` 列表，前提是「條目要先帶
事件」，那個前提 09-06 之後已經成立。

## 1. 條目格式

- `## Waiting` 的條目寫成兩行，第二行縮排，`entries()` 本來就把續行接回同一條
  （`scripts/todo-check.js:194`）：

  ```
  - 〔judge〕record 不驗 transcript：<脈絡> — [scripts/judge.js](scripts/judge.js).
    lifts when [seen]: 看到一次宣稱派了卻沒派的歸檔. 09-18.
  ```

- 標題是〔前綴〕之後、第一個 `：`、`: ` 或 ` — ` 之前的文字，去掉反引號後不超過
  24 字。
- `lifts when` 後面的 `[kind]` 必填，只收 `date`、`repo`、`upstream`、`seen`。
- `[date]` 的條件裡必須有一個 `MM-DD`；那個日子取戳記當天或之後第一次出現的那天，
  跨年照算。
- 戳記的意思不變：最後一次有人讀過、同意它還在等的那天，放在最後。

## 2. todo-check

- `todo-check.js` 匯出 `waiting(text, now)`，每條回
  `{ line, title, kind, event, stamp, due }`；orient 和 `report()` 都只讀它，
  不另寫一份解析。
- `due` 的規則：`[date]` 在日子到了那天起為真，之前不管戳記多舊都為假；其他三種在
  戳記滿 `REREAD_DAYS`（7 天）時為真。
- 沒有標題、標題超過 24 字、沒有 `[kind]`、`kind` 不認得、`[date]` 沒有 `MM-DD`，
  都是 problem，exit 1——和缺戳記、缺 `lifts when:` 同級。
- `report()` 印 `due` 的條目，每條帶 `kind` 和標題；`[date]` 在日子到之前不印。
  `due` 仍然不影響 exit code。

## 3. orient

- `todoBlock()` 每次都列出**全部** Waiting 條目，一條一行：`due` 標記、`kind`、
  標題、條件（截到 `TODO_ENTRY_WIDTH`）。`due` 的排前面，其餘照檔案順序。
- 標題行寫 `Waiting N — M due, offer one option` 或 `Waiting N — none due, not offered`，
  M 就是下面標了 `due` 的行數。

## 4. 選單與處理流程

- `lib/stages.js` 的 INIT 把 `` `## Waiting` stays out `` 換成
  `` `## Waiting` is one option when `orient` marks any `due` ``，其餘不動；
  `init+st` 仍在 `tests/render.test.js` 的 1400 以下（09-19 量到 1311）。
- `skills/fankeel/SKILL.md` 的 **Asking** 一節寫長版：選了「處理 Waiting」就用
  `--route "survey,build,land"` 開 task，survey 只判 `due` 的條目——`[date]` 核對
  條件其餘部分，`[repo]` 讀 repository 與 registry，`[upstream]` 查上游，`[seen]`
  用一次 `AskUserQuestion`、`multiSelect`，一條一個選項、條件放 description，
  問「這幾件發生過嗎？」；build 把解除的條目移到 `## Ready` 或
  `## Needs a decision` 並拿掉 `lifts when` 與戳記，沒解除的換上今天的戳記；
  land 跑 todo-check。
- 同一節原本寫 `## Waiting` 完全不提供（`skills/fankeel/SKILL.md:723`），改成上面這條。

## 5. 現有十條與文件

- `TODO.md` 的十條改寫成第 1 節的格式，kind 照 survey 的分類：`date` 1
  （〔profile〕，09-25）、`repo` 3（〔session〕、〔docs〕lib 模組、〔design〕）、
  `upstream` 1（〔build〕knip）、`seen` 5（〔docs〕行號、〔judge〕、ledger、〔lib〕、
  〔survey〕）。ledger 那條補上〔ledger〕前綴。
- `TODO.md` 開頭的說明：表格 Waiting 那列、`lifts when:` 與戳記那段補上標題與
  `kind`；`TODO.md:65-67` 與 `docs/development.md:58` 寫「`## Waiting` 從未因事件
  發生而縮小」，改成 09-18 的事實：兩條因事件解除，也都是有人讀了才發現。
- 描述格式的另外四處補上 `[kind]`：`docs/development.md:50`、
  `skills/fankeel/SKILL.md:618`、`skills/fankeel-land/SKILL.md:112`、
  `skills/fankeel-audit/rationale.md:153`。

## 驗收

- `tests/orient.test.js`：一份 fixture 放一條 `[date]` 09-25、戳記 09-18，和一條
  `[seen]`、戳記 09-01。now 設 09-20：兩條都列出，只有 `[seen]` 標 `due`，標題行寫
  `1 due`。now 設 09-26：兩條都 `due`，寫 `2 due`。今天這個測試會失敗——`todoBlock()`
  只印 `Waiting 2 — not offered`。
- `tests/todo-check.test.js`：缺 `[kind]`、`kind` 不認得、`[date]` 缺 `MM-DD`、標題
  超過 24 字，各自 exit 1。今天這四種都 exit 0。
- 實際產物：改寫後的 `TODO.md` 跑 `node scripts/todo-check.js` exit 0；跑
  `node scripts/orient.js`，標題行的 M 等於同一段裡標 `due` 的行數。
- `tests/render.test.js` 的 init 兩個上限測試照舊通過。

## 沒驗到的

處理流程是寫給 session 的規則，不是程式：「選了處理 Waiting 以後，`[seen]` 真的用
一次 multiSelect 問完」只能在實際跑一次 `/fankeel` 時看到。最早的機會是 09-25，
〔profile〕的日子到了、`[seen]` 五條的戳記也滿七天的那天。
