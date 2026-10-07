---
status: current
last_verified: 2026-10-07
---

# 重開 mod 路線 Implementation Plan

**Goal:** 寫一份新決策紀錄取代 10-03 與 10-05 兩份擱置決策、定下五項 mod 能力的先後，拆掉已證明失敗的 await-title，並把第三到五項開成 TODO 條目。
**Architecture:** 程式只動 `hooks/mod.ts` 一處：拿掉 await-title 的註冊，只留 compact；兩個檔刪除。其餘是文件：一份新決策、三個用 `scripts/todo.js new` 開的條目、兩份舊決策加 `superseded_by:`、`docs/README.md` 的索引列。title-3 的關閉由使用者執行，因為子代理執行 `todo.js done` 會被分類器拒絕。
**Tech Stack:** Node（`node --test`，`.ts` 由 node 直接載入，`tests/mod.test.js:7` 以 `import()` 讀 `hooks/mod.ts`）；沒有任何相依套件。
**Spec:** [2026-10-07-mod-reopen-design.md](2026-10-07-mod-reopen-design.md)

## Global Constraints

- 不加相依套件：`package.json` 沒有 `dependencies`，`npm test` 就是 `node --test`。
- `hooks/hooks.json` 只能有 `modules` 一個鍵，值是 `['mod.ts']`（`tests/inventory.test.js:74-78`）；這個計畫不動 hooks.json。
- hooks/ 底下每個 hook 在每條路徑都以 0 結束，邏輯放在 lib/（`.fankeel/map.md` 的 tree 列 `hooks/`）。
- 文件索引是 `docs/README.md`（`.fankeel/map.md` 的 filing：`index: docs/README.md`）；`docs/03-decisions` 是 decision 角色，`docs/90-agent/todo` 是 todo 角色。
- TODO 條目只用 `scripts/todo.js new` 建立（`lib/todo.js:466` 起：這是建立條目檔的唯一方式，id 不重用）；`--title` 最寬 28 欄，中日韓字算 2（`lib/todo.js:106`）；`--timing` 要以 `on:`、`after:`、`upstream:` 或 `if:` 開頭（`lib/todo.js:92`）。
- 被新決策取代的決策紀錄本文不改，只在前置資料加一行 `superseded_by:`，值是反引號包住的路徑（`docs/03-decisions/2026-09-19-waiting-triggers.md:4`）。
- 決策、條目與索引的文字用繁體中文（`.fankeel/profile.json:17` 的 `language`）。
- 被派出的 implementer 只跑自己 task 的測試指令，全套由 parent 在提交前跑。

## Risks

- `docs/90-agent/reference/documents.md:278-281` 說「前提被後來的程式推翻的決策」不改 status、只在句子後加括號註記；這裡是被一份新決策取代，屬於同頁 271-276 行說的 `superseded-by`，與 waiting-triggers 的先例一致 — Task 3 — 兩份舊決策只加 `superseded_by:`，本文一字不改；10-05 那份裡仍維持的注入一條，由新決策明寫「仍維持」，不去改舊頁。
- `docs/90-agent/todo/title-3.md` 與 `compact-2.md` 在工作樹裡有尚未提交的修改 — Task 4 — 使用者執行 `todo.js done` 前先 `git status --short docs/90-agent/todo/title-3.md`，有 `M` 就先提交那份實測紀錄，不然 `done` 寫入的版本會把兩件事混在一個 commit。
- 條目 id 固定為 `brief-3`、`effort-1`、`gate-7`，新決策直接連到這三個檔；若有人先開了同名條目，`todo.js new` 會拒絕 — Task 2 — 第一步先 `ls` 這三個檔，三個都必須不存在。
- implementer 各在自己的 worktree 裡做，Task 3 的索引列與 `superseded_by:` 指向 Task 2 才建立的決策檔，同時做會讓 Task 3 的 docs-check 紅 — Task 3 — 它把那個檔列在 `Read:`，所以排在 Task 2 落地之後。

## Task 1: 拆掉 await-title，mod 只註冊 compact

**Files:**
- Modify: `hooks/mod.ts` — 拿掉 await-title 的 import 與呼叫
- Modify: `hooks/await-title.ts` — 整檔刪除
- Modify: `tests/inventory.test.js:70-75` — 註解拿掉 await-title.ts
- Test: `tests/mod.test.js`
- Test: `tests/await-title.test.js` — 整檔刪除
- Read: `hooks/compact.ts` — 它只呼叫一次 `on('turn.complete', …)`（第 85 行），新斷言依此寫

**Interfaces:**
- Consumes: none
- Produces: `hooks/mod.ts` 的 `register` 只註冊 `turn.complete` 一個事件。

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，是照抄加測試。

1. 把 `tests/mod.test.js` 第 9 行起的測試整個換成下面這段：

In `tests/mod.test.js`, replace the test that starts at line 9 with:

```js
test('mod register wires only the compact hook', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]), ['turn.complete'],
        'mod.ts registers more than compact: ' + JSON.stringify(calls.map((a) => a[0])));
});
```

2. 執行，看它失敗：現在 await-title 還註冊了 `tool.call`，所以實際值是 `['turn.complete', 'tool.call']`。

```
node --test tests/mod.test.js
```

3. 把 `hooks/mod.ts` 整檔換成：

In `hooks/mod.ts`, the whole file becomes:

```ts
import type { Register } from 'claude-code'
import { register as compact } from './compact.ts'

export const register: Register = (on) => {
  compact(on)
}
```

4. 刪除兩個檔：

```
git rm hooks/await-title.ts tests/await-title.test.js
```

5. 改 `tests/inventory.test.js` 第 73 行的註解，前後三行變成：

In `tests/inventory.test.js`, lines 72-74 become:

```js
    // hooks/hooks.json exists only to declare the engine module
    // hooks/mod.ts (which imports compact.ts); a `hooks` key there would be a second list, so it may
    // hold `modules` and nothing else.
```

6. 執行，看它通過，並確認 hooks 與 tests 裡已沒有 await-title：

```
node --test tests/mod.test.js tests/inventory.test.js
git grep -n "await-title\|awaitTitle" -- hooks tests
```

第二行必須沒有任何輸出。

7. 提交由 controller 做；回報時附上第 2 步的失敗行與第 6 步的通過行。

## Task 2: 新決策紀錄與三個 TODO 條目

**Files:**
- Modify: `docs/03-decisions/2026-10-07-mod-reopen.md` — 新檔，全文在下面
- Create: `docs/90-agent/todo/brief-3.md`、`docs/90-agent/todo/effort-1.md`、`docs/90-agent/todo/gate-7.md` — 由 `scripts/todo.js new` 產生
- Read: `docs/90-agent/todo/title-3.md` — await-title 失敗的證據，新決策連到它

**Interfaces:**
- Consumes: none
- Produces: 條目 id `brief-3`、`effort-1`、`gate-7`；決策檔 `docs/03-decisions/2026-10-07-mod-reopen.md`，Task 3 的 `superseded_by:` 與索引列指向它。

**Dispatch:** implementer, sonnet — 計畫帶著決策全文與每條指令，是照抄加檢查。

1. 確認三個 id 都還沒被用掉；三行都必須是 `No such file or directory`：

```
ls docs/90-agent/todo/brief-3.md docs/90-agent/todo/effort-1.md docs/90-agent/todo/gate-7.md
```

2. 先跑會失敗的檢查，看它印 `FAIL`（決策檔與條目都還不存在）：

```
node -e "const fs=require('fs');const d='docs/03-decisions/2026-10-07-mod-reopen.md';const ids=['brief-3','effort-1','gate-7'];const miss=fs.existsSync(d)?ids.filter(id=>!fs.existsSync('docs/90-agent/todo/'+id+'.md')||!fs.readFileSync(d,'utf8').includes('todo/'+id+'.md')):['decision'];if(miss.length){console.log('FAIL',miss);process.exit(1)}console.log('ok')"
```

3. 開三個條目（單引號內不能再有單引號）：

```
node scripts/todo.js new --id brief-3 --label brief --state ready --link hooks/brief.js --title '子代理 brief 改走 agent.spawn' --description '依 2026-10-07 mod 重開決策的第三項：以 agent.spawn 改寫 prompt 取代 hooks/brief.js 的一部分；第一步是互動式 n>1 探測，不是搬遷' --body '來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第三項。已知：headless n=1 下 agent.spawn 改寫的 prompt 成為子代理 transcript 第 1 行（docs/90-agent/reports/2026-10-03-mod-probe-3.md:14）；session.append 帶 agentId 可把一列 user 文字加進執行中的子代理，這個 repo 沒測過。第一步：在互動式 session 按 Enable 後派至少三個子代理，看每一個的 transcript 第 1 行是否為改寫後的 prompt，並試一次 session.append 對執行中的子代理。完成條件：探測成立就另開 design 決定 hooks/brief.js 哪一部分搬到 agent.spawn；不成立就把結果寫進本條並關閉。共通規則：mod 沒載入時 hooks/brief.js 照舊運作。'
node scripts/todo.js new --id effort-1 --label effort --state blocked --link hooks/mod.ts --group '子代理 brief 改走 mod' --timing 'after: brief-3 的探測成立，agentId 與 Dispatch 行對得上' --title '每個子代理的 effort' --description '依 2026-10-07 mod 重開決策的第四項：以 turn.step 依 agentId 改寫每個子代理的 effort，取代 implementer-high 與 -xhigh 的 agent 檔複本' --body '來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第四項。已知：turn.step 的輸入帶 agentId，model 與 effort 每次請求都可改寫，d.ts 沒有 fast 或 speed 欄位；10-03 第三輪量到改的 effort 真的送進請求。依賴：要先有 brief-3 建立的 agentId 與 Dispatch 行的對應。第一步：brief-3 成立後，寫一個 turn.step hook 依對應改 effort，量一次請求本文。完成條件：成立就決定 fankeel-implementer-high 等複本是否退役；不成立就關閉本條。共通規則：mod 沒載入時照 agent 檔的 effort 跑。'
node scripts/todo.js new --id gate-7 --label gate --state ready --link assets/station/station.js --title 'Pane 上的 gate 介面' --description '依 2026-10-07 mod 重開決策的第五項：用 mod 的 Pane 顯示 gate 報告並能回答；動手前先讀 station 頁已有的 gate 面板，避免兩套' --body '來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第五項，取代 10-05 決策對終端與 Desktop gate 面板的否決。已知：Pane 在終端、Desktop、VS Code 與手機都能開，AbovePrompt 只在終端與 Desktop。station 頁在 gate.station 設成秒數時已有可回答的浮動面板（docs/90-agent/reference/station.md 的 Answering a gate from the page）。第一步：讀 station 的 gate 面板與 Pane 的型別，寫 design 決定兩者怎麼分工。完成條件：design 核准後另開 task 實作。共通規則：mod 沒載入時 gate 照舊用 AskUserQuestion。'
```

4. 建立決策檔，全文如下：

In `docs/03-decisions/2026-10-07-mod-reopen.md`, the whole file is:

```md
---
status: decision
last_verified: 2026-10-07
---

# 重開 mod 路線（10-07）：決策紀錄

一句話：fankeel 重開 mod 路線，mod 只做 command hook 做不到的事，command hook 照舊是底層；前提是使用者接受每個 session 在 `/plugin` 按一次 Enable for this session。這份紀錄取代 [10-03 的 mod 路線擱置](2026-10-03-mod-route.md) 與 [10-05 的函式 hook 與 gate 報告面板](2026-10-05-inject-gate-mod.md)，await-title 隨這份紀錄移除。

設計稿是 [2026-10-07-mod-reopen-design.md](../90-agent/plans/2026-10-07-mod-reopen-design.md)，計畫是 [2026-10-07-mod-reopen.md](../90-agent/plans/2026-10-07-mod-reopen.md)。

## 為什麼

- 10-03 的第一個理由是子代理拿不到 `prompt.compose` 的結果。這一條不再擋路：`agent.spawn` 改寫的 prompt 已量到成為子代理 transcript 的第 1 行（[mod-probe-3](../90-agent/reports/2026-10-03-mod-probe-3.md) 第 14 行，headless，n=1），子代理的 brief 可以走這條路，不必經過 `prompt.compose`。
- 10-03 的第二個理由是 hooks module 由 rollout 旗標決定載入。這一條降為接受的風險：旗標被撤時，下面那條共通規則讓 fankeel 照 command hook 跑。
- 10-03 的第三個理由是要改使用者設定。使用者在 2026-10-07 接受每個 session 在 `/plugin` 按一次 Enable for this session，這不改任何設定檔，所以不再與「裝好後大部分不需要修改 Claude 設定」衝突。
- 10-05 否決終端或 Desktop 的 gate 報告面板，理由是 command hook 畫不了介面；mod 的 Pane 在終端、Desktop、VS Code 與手機上都能開（Claude Code 2.1.292 的型別檔），所以這一條一併取代。

## 定了什麼

- 五項只有 mod 做得到的能力，依這個次序做：
  1. 拆 await-title：已證實不成立，host 拒絕從 `tool.call` hook 呼叫 `command.run`，而 `turn.complete` 要等使用者答完才來（[title-3](../90-agent/todo/title-3.md)）。這個 task 內已做完，`hooks/mod.ts` 只剩 compact。
  2. 自動 compact 與改寫每次 compaction 的指示：`hooks/compact.ts` 已落地，互動式實測壓縮成功；剩下的判準與文字在既有條目 [compact-2](../90-agent/todo/compact-2.md)，不另開。
  3. 子代理完整 brief：由 `agent.spawn` 改寫 prompt 取代 `hooks/brief.js` 的一部分。價值最高，但互動式 n>1 沒量過、`session.append` 對執行中的子代理沒測過，所以第一步是探測（[brief-3](../90-agent/todo/brief-3.md)）。
  4. 每個子代理的 effort：由 `turn.step` 依 agentId 改寫，依賴第三項建立的 agentId 與 Dispatch 行的對應，所以排在它後面（[effort-1](../90-agent/todo/effort-1.md)）。
  5. Pane 上的 gate 介面：範圍最大、與其他項不相依，放最後；動手前先讀 station 頁已有的 gate 面板，避免兩套（[gate-7](../90-agent/todo/gate-7.md)）。
- 共通規則：每個 mod 都要在沒載入時無害。旗標關、沒按 Enable、或 hook 拋錯或逾時被略過時，fankeel 照 command hook 的行為跑，不丟工作。
- 仍維持 10-05 的一條：UserPromptSubmit 注入不改成函式 hook，繼續用 `hooks/inject.js`。

## 沒做的

- 第三到五項只開了條目，沒有實作。
- 重新評估的時機：rollout 旗標被撤、Enable 在手機或 Remote Control 上按不到、或 `agent.spawn` 改寫在互動式 n>1 下不穩定。
```

5. 再跑第 2 步的檢查，必須印 `ok`；再跑條目檢查：

```
node scripts/todo-check.js
```

它不能列出 `brief-3`、`effort-1` 或 `gate-7`。

6. 提交由 controller 做；回報時附上第 2 步的 `FAIL` 行、第 5 步的 `ok` 行與 todo-check 的結尾行。

## Task 3: 取代兩份舊決策並補索引

**Files:**
- Modify: `docs/03-decisions/2026-10-03-mod-route.md` — 前置資料加 `superseded_by:`
- Modify: `docs/03-decisions/2026-10-05-inject-gate-mod.md` — 前置資料加 `superseded_by:`
- Modify: `docs/README.md` — 兩列舊決策加註、新增決策、設計、計畫三列
- Read: `docs/03-decisions/2026-10-07-mod-reopen.md` — Task 2 建立的新決策，兩個 `superseded_by:` 與索引列都指向它
- Read: `docs/03-decisions/2026-09-19-waiting-triggers.md` — `superseded_by:` 的寫法（第 4 行）

**Interfaces:**
- Consumes: Task 2 建立的 `docs/03-decisions/2026-10-07-mod-reopen.md`
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶著每一處的全文，是照抄加檢查。

1. 先跑會失敗的檢查，看它印 `FAIL`（兩份舊決策都還沒有 `superseded_by`）：

```
node -e "const fs=require('fs');const want='superseded_by: \`docs/03-decisions/2026-10-07-mod-reopen.md\`';const bad=['docs/03-decisions/2026-10-03-mod-route.md','docs/03-decisions/2026-10-05-inject-gate-mod.md'].filter(f=>!fs.readFileSync(f,'utf8').split('\n').slice(0,6).includes(want));if(bad.length||!fs.existsSync('docs/03-decisions/2026-10-07-mod-reopen.md')){console.log('FAIL',bad);process.exit(1)}console.log('ok')"
```

2. 兩份舊決策的前置資料各在 `last_verified:` 那行下面加一行，本文一字不改。

In `docs/03-decisions/2026-10-03-mod-route.md`, the front matter becomes:

```md
---
status: decision
last_verified: 2026-10-03
superseded_by: `docs/03-decisions/2026-10-07-mod-reopen.md`
---
```

In `docs/03-decisions/2026-10-05-inject-gate-mod.md`, the front matter becomes:

```md
---
status: decision
last_verified: 2026-10-05
superseded_by: `docs/03-decisions/2026-10-07-mod-reopen.md`
---
```

3. 索引：第 218 行（10-05 函式 hook 與 gate 報告面板那列）與第 226 行（10-03 mod 路線那列）的說明欄結尾、在 ` |` 之前各加 `（10-07 起由 mod 重開決策取代）`；再在第 226 行那列的正下方插入這三列：

In `docs/README.md`, insert directly below line 226:

```md
| 重開 mod 路線（10-07）定了什麼：前提是每個 session 按一次 Enable；五項 mod 能力的先後（拆 await-title、compact、子代理 brief、每個子代理的 effort、Pane gate 介面）；mod 沒載入時照 command hook 跑；取代 10-03 與 10-05 兩份決策 | [decisions/2026-10-07-mod-reopen.md](03-decisions/2026-10-07-mod-reopen.md) — *繁體中文* |
| 那份決定的 design：逐條回應 10-03 的三個理由、五項排序、拆 await-title 的範圍 | [plans/2026-10-07-mod-reopen-design.md](90-agent/plans/2026-10-07-mod-reopen-design.md) — *design-intent, 繁體中文* |
| 那份設計的四個 task：拆 await-title、新決策與條目、取代舊決策與索引、使用者關閉 title-3 | [plans/2026-10-07-mod-reopen.md](90-agent/plans/2026-10-07-mod-reopen.md) — *design-intent, 繁體中文* |
```

4. 再跑第 1 步的檢查，必須印 `ok`；再跑文件檢查：

```
node scripts/docs-check.js
```

它不能列出這個 task 修改的三個檔或新決策。

5. 提交由 controller 做；回報時附上第 1 步的 `FAIL` 行、第 4 步的 `ok` 行與 docs-check 的結尾行。

## Task 4: 使用者關閉 title-3

**Files:**
- Modify: `docs/90-agent/todo/title-3.md` — 由 `todo.js done` 改為 done
- Read: `hooks/mod.ts` — 確認 Task 1 已落地

**Interfaces:**
- Consumes: Task 1 的 commit sha
- Produces: none

**Dispatch:** user — `todo.js done` 從子代理執行會被分類器拒絕，要使用者在這個 session 以 `!` 執行。

1. 先確認 title-3 沒有未提交的修改；有 `M` 就先讓 controller 提交那份實測紀錄：

```
git status --short docs/90-agent/todo/title-3.md
```

2. 用 Task 1 的 commit sha 關閉（`<sha>` 換成 Task 1 落地的那個 commit）：

```
! node scripts/todo.js done title-3 --sha <sha> --record "await-title 已移除：hooks/await-title.ts 與 tests/await-title.test.js 刪除，hooks/mod.ts 只註冊 compact；決策見 docs/03-decisions/2026-10-07-mod-reopen.md。"
```

3. 確認它是 done：

```
node scripts/todo-check.js
grep -n "^state:" docs/90-agent/todo/title-3.md
```

第二行必須印 `state: done`。

## Coverage

| promise | task |
|---|---|
| 新增 `docs/03-decisions/2026-10-07-mod-reopen.md`，`status: decision`，一句話結論在最前：fankeel 重開 mod 路線，mod 只做 command | Task 2 |
| 「為什麼」逐條回應 10-03 的三個理由：子代理拿不到 `prompt.compose` 這一條不再擋路，因為 `agent.spawn` 改寫的 prompt | Task 2 |
| 「定了什麼」寫下五項的排序與每一項的理由，次序見第 3 節。 | Task 2 |
| 「定了什麼」寫下一條共通規則：每個 mod 都要在沒載入時無害——旗標關、沒按 Enable、或 hook 拋錯被略過時（d.ts 3908 起：拋錯或逾時的 | Task 2 |
| 「沒做的」寫下重新評估的時機：旗標被撤、Enable 在手機或 Remote Control 上按不到、或 `agent.spawn` 改寫在互動式 n>1 | Task 2 |
| `docs/03-decisions/2026-10-03-mod-route.md` 前置資料加 `superseded_by:` 指向新決策 | Task 3 |
| `docs/03-decisions/2026-10-05-inject-gate-mod.md` 同樣加 `superseded_by:`。它否決「終端或 Desktop 的 gate 報告面板」的理由是 command | Task 3（注入那一條仍維持，由 Task 2 的決策寫明） |
| 第一：拆 await-title。已證實不成立（`docs/90-agent/todo/title-3.md:16`：host 拒絕從 `tool.call` 呼叫 `command.run`，`turn.complete` 又要等使用者答完），留著只會每次 gate | Task 1 |
| 第二：自動 compact 與改寫每次 compaction 的指示。已落地（`hooks/compact.ts`）、互動式實測壓縮成功，缺的是判準改成認 `manual` 加同時間的 `fankeel | Task 2（決策列入排序並指向既有條目 compact-2，不另開條目） |
| 第三：子代理完整 brief，由 `agent.spawn` 改寫 prompt 取代 `hooks/brief.js` 的一部分 | Task 2（條目 brief-3） |
| 第四：每個子代理的 effort 由 `turn.step` 依 agentId 改寫 | Task 2（條目 effort-1） |
| 第五：Pane 上的 gate 介面。範圍最大、與其他項不相依，放最後；做它的時候要先讀過 station 頁已有的 gate 面板，避免兩套。 | Task 2（條目 gate-7） |
| 刪除 `hooks/await-title.ts` 與 `tests/await-title.test.js`。 | Task 1 |
| `hooks/mod.ts` 拿掉 `import { register as awaitTitle }` 與 `awaitTitle(on)`，只留 compact | Task 1 |
| `tests/mod.test.js:9` 的測試改成斷言 register 只接上 compact 的 hook | Task 1 |
| `tests/inventory.test.js:73` 的註解拿掉 await-title.ts。 | Task 1 |
| 完成後 `git grep -n "await-title\|awaitTitle" -- hooks tests` 沒有輸出 | Task 1 |
| 第三、四、五項各開一個 TODO 條目（用 `scripts/todo.js`） | Task 2 |
| title-3 在 await-title 拆完、全套測試綠之後關閉。`todo.js done` 從子代理會被分類器拒絕，所以這一步由使用者以 `!` 執行。 | Task 4 |
| `tests/mod.test.js` 新斷言「只有 compact」：現在因為 await-title 註冊了 `tool.call` 而失敗 | Task 1 |
| 產出物一列：兩份舊決策的 `superseded_by` 都指到同一個存在的檔案 | Task 3 |
