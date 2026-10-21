---
judged: 2026-10-21T03:03:47.449Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 739fa960-d08b-4a8a-bfe4-7503befe3d11
stage: survey
---

# 判官題目：await.js 要不要直接印出去掉 CRLF 的 gate 區塊

## Question

# 判官題目：await.js 要不要直接印出去掉 CRLF 的 gate 區塊

## 問題

`scripts/await.js` 交接時，要不要直接印出交接檔最後一個 `json gate` 區塊，CRLF 先去掉，讓主控不必自己解析？

## 選項

- **做，印整段 JSON**：印出 `{"questions":[…],"next":"…"}` 整段。
- **做，只印 questions**：只印 `questions` 陣列，正好是 AskUserQuestion 要的參數。
- **不做**：維持現狀，把這條 TODO 關掉或改成 keep，理由寫清楚。

## 背景

- 現況：`await.js` 只印交接檔路徑和 `page:` 行，主控每次都要自己寫 awk，把最後一個 ```` ```json gate ```` 區塊挖出來。
- 交接檔在 Windows 上是 CRLF，awk 會回傳空白，要再加 `tr -d '\r'` 才正常。
- 上一次 patrol（session 9f451488）手寫了 19 次，這次 survey 又寫了 4 次。
- 控制者的規則要求「`questions` copied verbatim」，而且 `hooks/gate.js`（或它呼叫的 lib）會檢查主控問的題目和交接檔一致。印出的內容要能直接照抄。
- 來源 TODO：「await 印出去掉 CRLF 的 gate」（docs/90-agent/todo/await-12.md）。
- 要確認的事：`lib/handoff.js` 或其他 lib 是否已經有解析最後一個 gate 區塊的函式，能不能直接拿來用；`await.js` 印出更多內容，會不會跟現有的輸出契約或測試衝突；gate 檢查比對的是整段，還是只比對 questions。

## 要讀的路徑

- scripts/await.js
- lib/handoff.js（gate 區塊的解析、`gateProblem`，以及它比對的內容）
- hooks/gate.js
- lib/stages.js 裡控制者規則提到 `json gate` 和 `copied verbatim` 的地方
- tests/ 裡 await 和 handoff 的測試
- docs/90-agent/todo/await-12.md

## 怎樣才算答案

答「做」或「不做」，理由要指到 path:line。答「做」的話，要再說清楚：

1. 印整段，還是只印 `questions`，為什麼；
2. 要重用哪個現有的解析函式，還是要新寫；
3. 控制者規則裡要求手動讀 gate 區塊的那句，要不要跟著改。

## 回答的格式

六個欄位，`pick:` 那一行必填，後面接 `## Summary`。

## Answer

pick: 做，只印 questions
why: 主控要抄的只有 `questions`：`hooks/gate.js:335` 用 `gateMatches(asked, gate.questions)` 只比對 questions 陣列（`lib/handoff.js:463-465` 深比對），`next` 不比。現成的 `readGate`（`lib/handoff.js:427-449`，已匯出）本來就取最後一個區塊、regex `\r?\n` 容忍 CRLF（:223）、並補 `multiSelect:false`——它回傳的 `questions` 正是 hook 比對的右手邊，印它比主控自己讀原始檔更保險。`scripts/await.js` 目前只 `statSync` 和 `workflowOf`（:178、:199），不碰 gate；輸出全走一個 `text`（:290、:299），加一行 `questions: <單行 JSON>` 最小。`tests/await.test.js:537、:555、:569` 斷言行數，要跟著改；TODO 要求的 CRLF 測試現在沒有（`tests/handoff.test.js:247` 只測 `readsOf`）。規則句 `lib/stages.js:723` 不改：區塊已貼近 2400 上限（:683-684），指令比照 `PAGE_OPEN` 先例（:194-196）放在 await 自己的 handoff 行上。
would flip if: 主控多半在 await 印出前就從 brain 的 hand-back 拿到路徑而直接讀檔，印出的行沒人用；或 `readGate` 不帶 rules 時會把合法 gate 判成 invalid（`gateProblem` :411、:421 的 pause/option-one 檢查在無 rules 下仍觸發）。
unread: nothing
delegated: scripts/await.js 與 tests/await*.test.js（opus）；lib/handoff.js 與 hooks/gate.js（opus）；lib/stages.js、docs/90-agent/todo/await-12.md、skills/ agents/ docs/ lib/ 的消費者 grep（sonnet）；tests/handoff.test.js 與 tests/ 裡 handoff/gate 測試 grep（sonnet）
checklist: 1 await.js 現在印什麼——answered；2 await 測試對 stdout 的斷言——answered；3 handoff.js 的解析函式與 `gateProblem` 比對內容——answered；4 gate.js 讀檔與比對——answered；5 stages.js 控制者規則句——answered；6 handoff/gate 測試覆蓋——answered（grep 被截在 80 行，gate*.test.js 本體未開）；7 await-12.md 原文——answered；8 await.js 輸出的消費者——answered（subagents.md 幾行長行被工具省略）

## Summary

### 各讀者的發現與抽查

**`scripts/await.js`（opus）**：交接時唯一的 stdout 寫入是 `process.stdout.write(text + '\n')`（`F:/ymlab/fankeel/scripts/await.js:299`）；`text` 在 :290 組成 `line + (page ? PAGE_OPEN : '') + page`。`line` 在 :180 是 `handoff <path> — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.`；`PAGE_OPEN`（:196）和 `pageLine`（:197-203）負責 `\npage: <url>f/<session>/<tab>`，group、workflow、或不在 `PAGE_TAB` 的 stage 不印。從 `lib/handoff.js` 匯入的（:25）沒有任何 gate 相關函式；讀交接檔內容的只有 `workflowOf`（:178、:199）。抽查 :174-205 與 :284-301 屬實。

**`lib/handoff.js` 與 `hooks/gate.js`（opus）**：`BLOCK = /`{3}json gate\r?\n([\s\S]*?)\r?\n`{3}/g`（`F:/ymlab/fankeel/lib/handoff.js:223`）圍欄前後已容忍 CRLF；`readGate(file, next, route, rules)`（:427）用 `matchAll` 讓最後一個區塊勝出（:432）、`JSON.parse`（:435）、無 `questions` 回 null（:436）、`gateProblem` 不過回 `{invalid, detail, next}`（:441）、補 `multiSelect:false`（:446-447）後回傳整個 gate 物件（:448）。`gateProblem`（:379-424）只檢查 gate 格式，不比對主控問的題目；真正比對的是 `gateMatches(asked, filed)`（:463-465），`isDeepStrictEqual` 深比對兩個 questions 陣列。`hooks/gate.js:291-292` 用 `handoffPath` 找檔、`readGate(file, nextStage(...), route, { pause: true, floor, ids, patrol })`；:334-335 `asked = payload.tool_input.questions`、`gateMatches(asked, gate.questions)`；不符且看起來像在抄這個 gate 時拒絕，訊息為「copy its `questions` array exactly」（:356-358）。gate.js 自己不去 `\r`。抽查 :221-224、:425-466、:330-359 屬實。讀者推論：區塊內部行尾的 `\r` 留在 `m[1]` 裡，但 `JSON.parse` 把 `\r` 當空白，所以解析得過——這是「awk 失敗、`readGate` 卻沒事」的原因。

**`lib/stages.js`、TODO、消費者（sonnet）**：控制者規則句在 `F:/ymlab/fankeel/lib/stages.js:723`：`'Print a returned path' + (LINK_RULE | REPORT_RULE) + ', then read {{HANDOFF}}\'s last `json gate` block and call AskUserQuestion with `questions` copied verbatim. …'`；:683-684 註明控制者區塊「sits within a few dozen characters of the 2400 cap」，:691-693 說 LINK_RULE 多的 24 字是靠砍別句的尾巴換來的。`:194-196` 的先例：`PAGE_OPEN` 的指令寫在 await 的 handoff 行上，「so the controller's block only has to print the page line」。`docs/90-agent/todo/await-12.md` 全文：state `decision`，要做成「await.js 交接時直接印出最後一個 json gate 區塊，已去掉 CRLF」，完成條件「判官裁定；做的話，有測試用 CRLF 交接檔驗證印出的區塊可直接解析」。消費者 grep：沒有任何 skill、agent、docs 說 await.js 會印 gate；描述 await 輸出的只有 `page:` 行（`docs/90-agent/reference/station.md:294、:333、:633`、`subagents.md:603`）和 workflow 行（`docs/03-decisions/2026-10-16-build-workflow-script.md:14、:23`）。awk / `tr -d` 只出現在 `docs/90-agent/records/2026-10.md:330` 和 TODO 本身。抽查 :680-695、:721-724 屬實。

**tests/（sonnet）**：`tests/handoff.test.js:31-37` 測「最後一個 json gate 區塊勝出」（:33 寫兩個區塊，:35 斷言 `'new'`）；:247-251 是唯一的 CRLF 測試，但只測 `readsOf`，gate 區塊部分仍用 `\n`——`readGate` 沒有 CRLF 測試。`gateProblem` 沒被任何測試匯入，只在 `gate-write.test.js:60`、`gate-check.test.js:40` 的標題出現。抽查 :30-37、:246-251 屬實。

**await 測試（opus）**：所有斷言檢查 `main().text`，不檢查原始 stdout。`tests/await.test.js:536-537`（plan：`lines[1]` 是 `page:`、`lines.length === 2`）、:553-555（land：同上，`lines[0]` 以 `PAGE_OPEN` 結尾）、:569-570（verify/audit 只有一行；survey/design/build `lines[1]` 是 page）、:256（group handoff 全文精準比對）、:269（`endsWith`）。抽查 :530-571 屬實。在 `page:` 後面加行會壞 :537、:555；在前面加會壞 :536、:553、:570。這些 fixture 是否含 gate 區塊沒看（多半是 `at(path, Date.now())` 只 touch 檔），所以實際壞幾條要實作時跑了才知道。

### 怎麼得出 pick

1. **做**：成本真實（19 + 4 次手寫 awk，CRLF 每次先失敗），而現成的 `readGate` 已把「最後一個區塊、CRLF、JSON 解析、`multiSelect` 補值」全做完，await.js 只要呼叫它並 `JSON.stringify` 印一行；不用新寫解析。更重要的是它印的就是 `gateMatches` 右手邊那個物件，主控照抄比自己讀原始檔更貼近 hook 的比對對象。
2. **只印 `questions`**：hook 只比 `questions`（`hooks/gate.js:335`），規則句也只說 `questions` copied verbatim（`stages.js:723`）；`next` 是 `task.js next --from-gate` 自己從檔案讀的（`handoff.js:437-438`），主控不需要。印整段多出 `next` 和其他欄位，只會增加主控抄錯的面積和 context。建議格式是單行 `questions: <JSON.stringify(gate.questions)>`，接在 `page:` 行之後（或無 page 時直接接在 handoff 行後），單行保證沒有 CRLF 也不會打亂 `lines[]` 模型。`readGate(o.handoff)` 回 null 或 `{invalid}` 時不印這行，交給 hook 原本的拒絕訊息（:326-330）。排除條件比照 `pageLine`（:199）的 group 與 workflow。
3. **重用 `readGate`**，不新寫。要留意不帶 `next/route/rules` 呼叫時 `gateProblem` 的行為：`tests/handoff.test.js:34` 的 `readGate(file)` 無 rules 能回合法 gate，表示 pause / option-one 檢查在無 rules 下不觸發；實作時用 CRLF 交接檔加一條測試即可同時滿足 TODO 的完成條件。
4. **規則句 `stages.js:723` 不改**：控制者區塊貼近 2400 上限，而且主控也可能在 await 印出前就從 brain 的 hand-back 拿到路徑，所以「讀檔案最後一個區塊」這條後備路徑必須留著。指令改放在 await 自己的 handoff 行（:180）——例如把 `ask its gate as your rules say` 改成提到下方的 `questions:` 行——這正是 `PAGE_OPEN`（:194-196）用過的手法，不佔控制者區塊的字數。

### 沒能查的
- `tests/gate*.test.js`、`drive.test.js` 的測試本體沒開，只從 grep 行判斷它們各寫單一 gate 區塊。
- await 測試各 fixture 是否含 gate 區塊沒看，所以「加一行會壞幾條測試」是推論：至少 :537、:555 要改，其餘視 fixture 而定。
- `docs/90-agent/reference/subagents.md:603、:606、:607、:917` 的長行被工具省略，可能還有描述 await 輸出的句子要同步更新。
- 沒有跑測試套件。
