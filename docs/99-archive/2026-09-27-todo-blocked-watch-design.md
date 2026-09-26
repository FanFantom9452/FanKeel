---
status: current
---

# TODO 分類重設：Waiting 拆成 Blocked 與 Watch — 設計

09-27 巡查 `## Waiting` 時，16 個時機只能問人「發生了沒」，人答不出來，只能重蓋戳記；
受控 survey 的見證提問又被 `hooks/gate.js` 擋下（`questions[0]` 的選項一必須是站名）。
使用者選了方案 A：四個標題，Blocked 用分型條件。取代
[2026-09-19 Waiting 判斷機制](../../03-decisions/2026-09-19-waiting-triggers.md)
的「不加 kind 標籤」一條；時機標題、戳記、28 欄上限、due 門檻照舊。

## 1. 四個標題

- `TODO.md` 的標題是 `## Ready`、`## Needs a decision`、`## Blocked`、`## Watch`；`## Waiting` 不再被接受。
- `Blocked` 放能檢查的等待：前一件事、日期、上游。`Watch` 放事故再發生與需求出現，只有撞到的人知道。
- 兩區都用 `### <時機>` 分組，標題上限仍是顯示寬度 28 欄。

## 2. 條件行

- `### <時機>` 的下一行是一個分型條件，取代 `lifts when:`：Blocked 用 `on: MM-DD`、`after: <文字>`、`upstream: <文字>`；Watch 用 `if: <事件>`。行尾照舊是 `MM-DD.` 戳記。
- 型別放錯區就被 `todo-check.js` 拒絕：Blocked 底下的 `if:`、Watch 底下的 `on:`／`after:`／`upstream:`。
- `on:` 後面必須是 `MM-DD`，否則拒絕。

## 3. 誰判斷、何時算到期

- Blocked：`on:` 由程式比日期，日期到了就 `due`；`after:`、`upstream:` 在戳記滿 7 天時 `due`，由 survey 去查。
- Watch：戳記滿 60 天算 `stale`，不問「發生了沒」，只問「還留嗎」；留就重蓋戳記，不留就刪。
- Watch 的條目在事件發生時，由撞到的 session 搬進 `## Ready` 或 `## Needs a decision`，拿掉 `###` 和 `if:` 行。

## 4. 在哪裡看到

- `orient.js` 的 `todo:` 區塊分兩行：Blocked 列每個時機、`due` 在前；Watch 列每個時機的標題與 `stale` 數。
- `/fankeel` 有 `due` 或 `stale` 時給一個「巡查」選項，兩者合在同一格；Watch 本身不佔選單格。
- 巡查走 `survey,build,land`。survey 直接查 due 的 Blocked；stale 的 Watch 放進 survey gate 同一次呼叫的第 2–4 題，每題最多 4 條、`multiSelect: true`，一次最多 12 條，其餘留到下次。`lib/handoff.js:204` 只驗 `questions[0]`。

## 5. 文字與測試

- `lib/stages.js` 的 INIT 句改寫成 Blocked／Watch，init+station 注入仍在 1400 以下。
- `skills/fankeel/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`skills/fankeel-build/SKILL.md`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-audit/rationale.md`、`docs/01-guide/development.md` 改成 Blocked／Watch 的寫法。
- 新決策 `docs/03-decisions/2026-09-27-todo-blocked-watch.md` 寫明取代 09-19 決策的哪幾條；09-19 那頁加 `superseded_by`。
- `tests/todo-check.test.js`、`tests/skills.test.js` 的錨點跟著改。

## 6. 搬移現有 25 個時機

| 去處 | 時機 |
|---|---|
| Blocked `on:` | gates 滿一週（10-02） |
| Blocked `after:` | 交接後 context 仍過 400k、docs-audit 報未點名模組、brain 的 context 撐不住、受控 build/verify 實跑、TokenBar 寫出真實序列 |
| Blocked `upstream:` | knip 認得 CJS namespace、AI CODING SECURITY 定案 |
| Watch `if:` | 需要第十一種語言、下一個前端任務、guard 測試再紅一次、放行規則有沒有效、第二個平台的使用者、sonnet 花費成瓶頸或要離線、implementer 互相蓋檔、站頁介面只有中文、文件全文搜尋有人要、首次繪圖變慢一次、gate 等待時間量不準、tune 還原誤刪一次、即時 session 缺 subagent、git mv 漏一半提交、兩個 hook 逾時 |
| `## Ready` | 進行中卡片改版第二步（已核准） |
| `## Needs a decision` | 重跑成對量測（要核准約 $30） |

## 證明做完

- `tests/todo-check.test.js` 新增的測試現在是紅的、改完是綠的：`## Watch` 底下的 `on:` 被拒；`## Waiting` 被報成未知標題；Watch 戳記 61 天前 → `stale`、59 天前 → 不 stale；Blocked `on:` 過期 → `due`。
- 產物那一列：搬完後的 `TODO.md` 跑 `todo-check.js` exit 0，而且 `orient.js` 印出的 Blocked 與 Watch 時機數加起來是 23；Ready 那 1 條、Needs a decision 那 1 條另外算，總數對得上 25。

## 沒驗到的

stale 的 Watch 放在 survey gate 的第 2–4 題，只讀過 `lib/handoff.js:174-212`，還沒實際從受控 survey 送出過一次。
