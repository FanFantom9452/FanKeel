---
judged: 2026-10-19T17:55:13.091Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
stage: build
---

# 右側面板的 agents 和 TODO 有時候展不開

## Question

# 右側面板的 agents 和 TODO 有時候展不開

## 問題

使用者在 Claude desktop 右側的 fankeel 面板（`/fankeel-panel`，2026-10-20 截圖）看到：
- route 那一段正常顯示。
- 「▾ agents　2 在跑 · 66 完成」和「▾ TODO 41」只有標題那一行，底下是空的。

使用者問的是：為什麼「有時候」這兩段顯示不出內容？請找出原因，並給出修法。

截圖上看得到的線索：
- 兩個標題前面都是 ▾。在這個面板裡，▾ 可能代表「已展開」，也可能是收合的記號，請先確認是哪一種。
- 標題上的數字有算出來，例如 66 完成、TODO 41，所以資料讀得到；只是清單沒有畫出來，或者被收合了。
- 當下的狀態：這個 session 正在 build，有背景 agent 在跑，也有判官在跑。主迴圈正在串流回覆（「Creating 4.2k tokens」）。

## 請判斷這幾件事

1. 這兩段的清單內容是在哪裡產生的。
   - `hooks/pane.ts`、`hooks/pane-status.ts`，也可能有其他檔案，請給到 `path:line`。
   - 展開或收合的狀態存在哪裡、由誰決定。
2. 「有時候」空白是什麼情況觸發的。可能的方向：
   - 收合狀態被記住了，例如使用者曾經點過一次。
   - 面板重繪時把展開狀態重設了。
   - 內容太長被截掉，或超過字數上限。
   - 某個欄位為空，或格式不對，導致整段清單被略過。
   - 面板的寬度或高度限制。
   - 串流期間更新了一半。
   - 其他原因。

   每一種都要舉出證據：程式行號、測試，或 `docs/90-agent/todo/pane-*.md` 裡已經登記過的同類問題。
3. 這是不是已知問題：
   - 查 `docs/90-agent/todo/pane-*.md` 有沒有同一條。
   - 查 `docs/90-agent/judgements/` 裡的 pane 系列，以及 `docs/03-decisions/2026-10-12-fankeel-panel.md`、`2026-10-15-pane-svg.md`，看有沒有說明這個行為是設計好的。
4. 修法：
   - 給出最小的修改，寫到 `path:line`，說明要改什麼、要加哪個測試。
   - 如果是設計上故意這樣（例如預設收合），說明使用者該怎麼操作，以及是否該改預設。

## 要讀的路徑（`F:/ymlab/fankeel` 底下）

- `hooks/pane.ts`
- `hooks/pane-status.ts`
- 與 pane 相關的測試：`tests/` 底下 grep `pane`
- `docs/90-agent/todo/pane-1.md` 到 `pane-16.md`
- `docs/03-decisions/2026-10-12-fankeel-panel.md`、`2026-10-13-pane-colour.md`、`2026-10-15-pane-svg.md`
- `docs/90-agent/judgements/` 裡檔名有 pane 的檔案

## 怎樣算是答案

- 給出原因，並寫明確定的程度：已確認、推測，或還需要使用者提供某個資訊才能確定。
- 列出觸發條件。
- 給出修法，或給出「這是設計，操作方法是……」。
- 說明是否已有同一條 TODO；沒有的話，給出要登記的標題與內容摘要。

## 回答的形式

依照 fankeel-judge 的六個欄位作答，包含 `pick:` 行，後面接 `## Summary`。

## Answer

pick: 已確認不是收合、也不是資料問題：是列數預算的讓位迴圈（hooks/pane-status.ts:455-461）把 todo 與 agents 切到只剩標頭，標頭的 ▾ 不會跟著變；修法是讓位前先砍 agents 的子代理列、被切的標頭加「列數不夠」標記（兩處各一行）；Desktop 改成捲動要先問使用者面板會不會捲。
why: ▾ 只看 `folded`（pane-status.ts:79），收合只在記憶體、預設全開（pane.ts:508-511、:579）；而 `room` 不夠時 DROP 迴圈依 todo→notes→agents→tasks 把整塊 `slice(0,1)`（:416、:459），標頭留著、計數留著、▾ 也留著。Desktop 的 room 是引擎量到的 32 列（pane.ts:657-659）；agents 區塊最多 6 根×(1+3+1)+2 = 32 列（:380-381、:403-410），66 個完成的代理一到，單這塊就吃滿整個面板，所以「有時候」＝代理數多到塞不下的時候。tests/pane-status.test.js:556-562 正是把這個行為釘住：`['▌▾ TODO 3']`。
would flip if: Desktop 傳的 `props.scroll.offset` 代表面板本身會捲（pane.ts 從未讀 offset，測試 pane.test.js:613 刻意用 bodyRows 當 room），那正解是 Desktop 不切、讓它捲，而不是改砍法。
unread: nothing
delegated: hooks/pane.ts (opus); hooks/pane-status.ts (opus); hooks/pane-agents.ts, pane-band.ts, pane-bar.ts, pane-gate.ts, pane-svg.ts, .claude-plugin/plugin.json (sonnet); tests/pane.test.js, pane-status.test.js, pane-agents.test.js, pane-svg.test.js, pane-band.test.js, pane-bar.test.js, pane-gate.test.js (sonnet); docs/90-agent/todo/pane-1.md…pane-16.md 與 todo/ 其他含 pane 的檔 (sonnet); docs/90-agent/judgements/ 七個 pane 檔 (sonnet); docs/03-decisions/2026-10-12-fankeel-panel.md, 2026-10-13-pane-colour.md, 2026-10-15-pane-svg.md (sonnet); docs/90-agent/reports/patrols/2026-10-17-todo-patrol-pane-fold-todo.md, lib/todo.js, scripts/todo.js, lib/profile.js, docs/01-guide/profile.md, docs/90-agent/reference/station.md, todo.md (sonnet)
checklist: 1 hooks/pane.ts — answered；2 hooks/pane-status.ts — answered；3 其他 pane-*.ts 與 /fankeel-panel 接線 — answered；4 pane 測試 — answered；5 pane-1..16 — answered（無同一條）；6 pane 判決七篇 — answered；7 三篇決策 — answered；8 patrol 報告與 profile/todo 的 fold — answered

## Summary

### 1. 兩段的清單在哪裡產生、收合狀態在哪裡

**產生位置**（pane-status 讀者，opus；我抽查 F:/ymlab/fankeel/hooks/pane-status.ts:330-362、:378-465 全部吻合）：

- agents：`agentsBlock` 在 F:/ymlab/fankeel/hooks/pane-status.ts:389-412。標頭列在 :401，`head('agents', folded, 'agents')` 後面接 `dim(\`  ${running} 在跑 · ${every.length - running} 完成\`)`，所以「2 在跑 · 66 完成」是標頭列的一部分。清單列在 :403-410：最多 `AGENT_ROOTS = 6` 根（:380），每根下面最多 `AGENT_KIDS = 3` 個子代理（:381）加一列「└ 還有 N 個」，根超過 6 再加一列「還有 N 個」。
- TODO：`todoBlock` 在 :345-362。標頭列 :348 `TODO ${todos.length}`；:357 推進兩列四個狀態按鈕（Ready / Needs a decision / Blocked / Watch 各帶數量）；:358-360 只有在某個狀態被按下（`open`）時才列出標題，最多 `TODO_ROWS = 6` 條（:334）。
- 組裝：`statusRows` :420-465 把 task、clash、tasks、agents、notes、todo、foot 依序放進 `blocks`，再由 F:/ymlab/fankeel/hooks/pane.ts:679 `statusRows(input)` 取得列，:703 每列畫成 Box，Desktop 走 :708 `paneParts`。pane-svg 讀者確認 agents 與 TODO 在 Desktop 仍是文字列、不是 Svg（F:/ymlab/fankeel/hooks/pane-svg.ts:359-362 註解，抽查吻合）。

**▾ 的意思**：F:/ymlab/fankeel/hooks/pane-status.ts:78-79（抽查吻合）：`▾` 是展開、`▸` 是收合，純由 `folded` 旗標決定。截圖兩段都是 ▾，所以它們**沒有被收合**。

**收合狀態存在哪裡**：只在 mod 記憶體。F:/ymlab/fankeel/hooks/pane.ts:508-511（抽查吻合）：`// The blocks folded to their head row: memory only, so a new session starts with every block open.`；:579 初值 `folded: {}, todoOpen: null`；:695-699 只有標頭 Button 的 `onPress` 會翻旗標。pane.ts 沒有任何 writeFileSync；lib/profile.js 沒有 pane.* 鍵；F:/ymlab/fankeel/docs/01-guide/profile.md:63 寫明「收合只記在這個 session 的記憶裡，新的 session 一律展開」。所以「使用者曾點過一次被記住」這個方向排除：如果點過，標頭會是 ▸（tests/pane-status.test.js:484、tests/pane.test.js:1231 都這樣斷言）。

### 2. 「有時候」空白的觸發條件：列數預算

F:/ymlab/fankeel/hooks/pane-status.ts:414-416（抽查原文）：

```
// Given up in this order when the rows do not fit: `todo`, `agents` and `tasks` keep their head rows.
// The task, the clash and the foot never go.
const DROP = ['todo', 'notes', 'agents', 'tasks']
```

:454-461：`size()` 算所有區塊的列數加區塊之間的空白列，然後依 DROP 順序，只要 `size() > room` 就把那一塊 `slice(0, 1)`（notes 整塊刪掉）。被切的標頭列還是原本那一列：計數在、`press: 'fold'` 在、▾ 也在，因為切的是陣列不是旗標。這就是截圖的樣子：route 正常，「▾ agents  2 在跑 · 66 完成」與「▾ TODO 41」只剩標頭。

`room` 從哪裡來：F:/ymlab/fankeel/hooks/pane.ts:656-659（抽查原文）：

```
const props = (e.props ?? {}) as { bodyColumns?: number; scroll?: { bodyRows?: number } }
// The body's own cells where the surface measured them (41 by 32 on Claude Desktop); the viewport is the whole surface.
const room = Math.max(1, props.scroll?.bodyRows ?? (e.viewport?.rows ?? 24) - 4)
```

Desktop 給的是 32 列。tests/pane.test.js:587-613（抽查）用 `scroll: { offset: 0, bodyRows }` 模擬 Desktop，:613 斷言「the room is the body rows the surface gave, not the viewport」。

為什麼是「有時候」：agents 區塊的大小隨代理數長。68 個代理（2 跑 66 完成）時根數遠超 6，區塊 = 1 標頭 + 6 根 + 每根最多 3 子 + 「還有」列 + 尾列「還有 N 個」，最壞 32 列，剛好等於 Desktop 整個面板。再加 task 區塊約 5 列、tasks 最多 7 列（tests/pane-status.test.js:328「thirty tasks never take more than seven rows」）、notes 最多 4、TODO 3、foot 2、區塊間空白 5 列，總和遠超 32。於是 DROP 依序：TODO 切到標頭（連四個狀態按鈕都沒了）→ notes 整塊刪 → agents 切到標頭。任務剛開始代理少，全都塞得下；build 跑到判官與讀者一堆之後就塞不下。這次 session 正在 build、有判官在跑，正是這個情況。截圖裡 TODO 連狀態按鈕都沒有，所以不是「預設不列標題」那層（那層是設計：pane.ts:579 `todoOpen: null`、pane-status.ts:358 只列被按的狀態），而是被 room 切掉。

tests/pane-status.test.js:556-565（抽查原文）把這個行為釘死：`with no room the TODO block goes first, down to its head row`，`assert.deepEqual(text(rows(full - 1), 'todo'), ['▌▾ TODO 3'])`。注意測試期待的就是「▾ 加空白」。

其他方向逐一排除（證據）：
- 面板重繪重設狀態：重繪只在快照鍵變動時發生（pane.ts:564-566），`folded` 是 module 記憶體不隨重繪清；就算清了也是變成展開不是收合。排除。
- 內容太長被截：`SVG_MAX`（pane-svg.ts:14、:372）只管 route/clash 的 Svg，agents/TODO 不走 Svg（pane-svg.ts:397-398 `else keep(body)`）。欄寬只截每一列尾巴（pane-status.ts:365 `fit`、pane.ts:701 `wrap: 'truncate-end'`），不會砍整塊。排除；高度那層就是上面的 room。
- 欄位為空或格式不對：agentsBlock 用 `n.title || n.type || n.id` 回退（:397）不丟列；todoBlock 除了狀態沒有過濾（:358）。讀檔失敗時 `agentsOf`/`todosOf` 回 `[]`（pane.ts:322-324、:391-393），但那樣 `if (!nodes.length) return []`（:390、:346）連標頭都不會畫。計數有出來就代表資料在。排除。
- 串流期間更新一半：pane.ts:521 `if (state.busy) return` 是整個 tick 跳過、留上一份快照，不會畫一半；pane-status.ts 沒有任何 cache/throttle（pane-status 讀者）。排除。
- 寬度：見上，只截列尾。排除。

**確定程度**：機制「已確認」（程式與測試都對得上）。截圖那一刻的列數算術是「推測」——我沒有截圖的列數、tasks 數、notes 數。使用者可以這樣驗證：把 ▾ route 與 ▾ tasks 各按一下收起來，看 agents 與 TODO 的內容是否回來；回來就是 room。

### 3. 是不是已知問題

- pane-1 到 pane-16 全部 done（TODO 讀者逐一列標題）。沒有任何一條寫「標頭有數字、底下空白」。pane-11（F:/ymlab/fankeel/docs/90-agent/todo/pane-11.md:18、:26，抽查吻合）與 pane-15（:13）是加收合功能的，不是這個症狀。todo/ 其他含 pane 的檔也都不是（audit-2、compact-5、gate-10 等，讀者列過）。
- 讓位順序本身是設計：F:/ymlab/fankeel/docs/03-decisions/2026-10-13-pane-colour.md:19（抽查原文）「空間不夠時，先讓出 notes，再讓出 tasks 的清單（標題那一列留著）」；F:/ymlab/fankeel/docs/90-agent/judgements/2026-10-11-pane-right.md:90（抽查原文）「不做收合機制：條件顯示取代收合…列數不夠時丟 notes → plan → agent → context」；profile.md:63 寫現在的順序「TODO 的清單（留標頭）、notes、agents 的清單（留標題列）、tasks 的清單（留標頭）」。
- 設計沒考慮到的兩件事：(a) 10-17 加了收合按鈕（pane-11）後，標頭多了 ▾/▸ 語意，但被 room 切掉的標頭還是 ▾，使用者讀成「展開了但是空的」；(b) 10-19 加 agents 區塊（pane-15）時上限定成 6 根×3 子，最壞 32 列等於 Desktop 整個面板，一個跑久的 build 會讓它把 TODO 與 notes 擠光、最後自己也只剩標頭。判決 2026-10-17-pane-tasks-size 只管 tasks 的 Svg 條高度，沒碰這個。patrol 2026-10-17-todo-patrol-pane-fold-todo 是全表盤點報告，把 pane-10、pane-11 結案，沒有症狀條目。
- 結論：**沒有同一條 TODO**。要登記：
  - 標題：「Pane 列數不夠時 agents 與 TODO 只剩標頭，▾ 看起來像展開卻是空的」
  - 內容摘要：Desktop body 32 列；agents 區塊最壞 32 列（pane-status.ts:380-381、:403-410）；DROP 迴圈（:455-461）把 todo、agents 切到標頭但 ▾ 不變；修法見下；測試加在 tests/pane-status.test.js:556 旁邊。

### 4. 修法

最小修改，兩處各約一行，兩個表面都適用：

1. **讓位前先砍 agents 的子代理列**。F:/ymlab/fankeel/hooks/pane-status.ts:416 的 `DROP` 前面加一步（或在 :455 迴圈前）：當 `size() > room` 時，先把 agents 區塊裡以 ` ├ `、` └ ` 開頭的列與「└ 還有 N 個」列濾掉，只留標頭 + 6 根 + 「還有 N 個」= 8 列。這樣 68 個代理只花 8 列而不是 32，截圖這種情況大多直接塞得下，TODO 的四個按鈕與 agents 的「2 在跑」兩列都保得住。根是 live-first 排序（F:/ymlab/fankeel/hooks/pane-agents.ts:84-88），所以在跑的 2 個一定在最前面。
2. **被 room 切掉的標頭加標記**。:459 `blocks[at] = blocks[at].slice(0, 1)` 之後，給那一列再推一個 `dim(' · 列數不夠')` 段（或等價字樣），讓「切掉」與「展開但空」分得開。不要改成 ▸：▸ 按下去會變成「展開」卻什麼都不出現，更誤導。
3. **測試**：tests/pane-status.test.js:556 旁加兩個 case：(a) 6 根各 4 子的 agents 加 3 條 TODO，room 設成剛好少幾列，斷言 agents 的 ├/└ 列先消失、TODO 的 `Ready 3` 按鈕列還在；(b) room 再小，斷言被切的 `▌▾ TODO 3` 列帶「列數不夠」而 `folded: { todo: true }` 的 `▌▸ TODO 3` 不帶。現有 :556-565 的 `['▌▾ TODO 3']` 斷言要跟著改成含標記的版本。
4. 同步文件：profile.md:63 那句讓位順序補「agents 的子代理列」這一步；docs/03-decisions/2026-10-13-pane-colour.md:19 可補一句或另開一篇短決策。

**使用者現在能做的操作**（不改碼）：按 ▾ route 與 ▾ tasks 把它們收起（pane-11 的功能，Desktop 真機驗過），騰出的列會讓 DROP 迴圈提早停，agents 與 TODO 的內容回來；TODO 要看標題再按某個狀態按鈕（例如 Ready N）。代理數極多時（6 根都是帶 8 個讀者的判官）光收 route、tasks 不夠，agents 自己 32 列就滿了，這時只有上面第 1 項能解。

**沒查到、要使用者補的一件事**：Desktop 給 mod 的 `scroll: { offset, bodyRows }` 是否代表面板本身會捲動。pane.ts 從不讀 `offset`，測試 :613 刻意把 room 定成 bodyRows，所以這是當初選擇「塞進 32 列」而不是「讓它捲」。若 Desktop 真的會捲（使用者可以試：把 agents 區塊撐大後看面板有沒有捲軸），更好的修法是 pane.ts:659 在 `props.scroll` 存在時不設 room（或設很大），讓 Desktop 捲而終端照舊切；那時 :613 這條測試要改。這一點 repo 裡沒有證據，我不下判斷。

### 抽查結果

每個讀者各抽一到三處原文，全部與讀者所述相符：pane.ts:508-511、:656-659、:693-700；pane-status.ts:76-79、:330-362、:378-465；pane-svg.ts:359-362；tests/pane-status.test.js:556-565；tests/pane.test.js:580-614；pane-agents.ts:60-91；pane-11.md:16-27；2026-10-11-pane-right.md:88-91；2026-10-13-pane-colour.md:18-20；profile.md:63（grep 片段）。一處小出入：判決讀者先說「沒有任何判決含 收合」又說「只有 收合 與 收起 兩個詞」，自相矛盾，但它引的 pane-right.md:90「不做收合機制」原文在，結論不受影響。pane-* 讀者引 pane-status.ts:45、pane-status 讀者引 :46 指同一段註解，行號差一行，不影響判斷。
