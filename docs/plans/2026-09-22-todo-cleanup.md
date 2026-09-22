# 清 TODO：Ready 11 項 + 三個待決定項 Implementation Plan

**Goal:** 把 TODO.md 的 Ready 段 11 項與三個已決定的「需要決定」項目（design.mockup 濾規則、
build/verify 文件補述、lock 測試放寬時序）全部落地，每項完成後移除對應的 TODO.md bullet。
**Architecture:** 13 個獨立或近獨立的小修，多數各自一個檔案或一組緊密相關的檔案；沒有共用的
新介面，彼此之間沒有 produce/consume 關係。最後一個 task 收尾 TODO.md。
**Tech Stack:** Node.js（無額外依賴），`node --test`，plain JS，Markdown。
**Spec:** [2026-09-22-todo-cleanup-design.md](2026-09-22-todo-cleanup-design.md)

## Global Constraints

（`node scripts/map.js` 已讀；本專案沒有 CLAUDE.md／AGENTS.md，慣例記在 CONTRIBUTING.md）

- 測試只用 `node --test`（`package.json:8`），沒有第二套跑法。
- `lib/*.js` 不得 reach into `scripts/` 或 `hooks/`，只能反方向（`CONTRIBUTING.md:15`）。
- 文件歸檔跟著 `.fankeel/docs.json` 的角色走：`docs/` 是 reference（要跟程式碼一致）、
  `docs/decisions` 是 decision（寫一次不維護）、`docs/plans` 是 plan（落地後過期）
  （`CONTRIBUTING.md:20`，`.fankeel/map.md` 的 filing 表）。
- 新測試檔要先 `git add` 過，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。
- `lib/registry.js:321-323` 的鎖常數是硬限制：`LOCK_ATTEMPTS=200 × LOCK_DELAY_MS=5ms`＝1s
  等待上限，`LOCK_STALE_MS=5000`＝5s 才判過期。Task 3 放寬測試時序時，子行程持鎖時間必須
  遠低於 5s，等待上限的餘裕也不能逼近這兩個常數。
- 受控站的注入區塊有字元上限（`tests/render.test.js` 對每一站量測，目前上限 2400），Task 11
  更新行號時不得讓任何一站的量測值誤植成超過此上限的數字。

## Task 1: design.mockup 規則在受控 design 站濾掉

`agentsFor('design')`（`lib/stages.js:645-646`）落到 `BRAIN_AGENTS = [reader, reviewer]`
（`lib/stages.js:638`），沒有能 Write/Edit 頁面的 agent；`design.mockup` 的規則
（`lib/stages.js:258`）不分受控與否一律進 brief。`holds(when, values)`（`lib/stages.js:135-142`）
只認得單一 key 的真值（或其否定），不能直接在 `when` 陣列裡寫複合條件，所以濾掉的位置是
`rulesFor` 內部：受控 design 站時，把要拿去判斷 `when` 的 values 複本裡的 `design.mockup`
key 蓋成 `false`，其餘 key 不動。

**Files:**
- Modify: `lib/stages.js` — `rulesFor` 加一段：`stage === 'design'` 且
  `controlling('design', v)` 為真時，用一份 `design.mockup` 蓋成 `false` 的 values 複本去
  過濾 `found.when`。
- Modify: `docs/subagents.md` — 在 `### What a stage agent is told to read, and what it may
  write` 這段（`docs/subagents.md:501-505`）後面加一段：brain 的 Write 只給它的交接檔、
  `build`／`design`／`plan` 的 commit 檔和 `design`／`plan` 那一個 `docs/plans/` 檔
  （`docs/subagents.md:46` 已這樣描述），不含 `design.mockup` 要的 `mockup.html`；
  `agentsFor('design')` 也只有 reader 與 reviewer，沒有能寫頁的 agent；所以受控 design 站
  現在直接濾掉 `design.mockup` 這條規則，等真的有前端任務落在受控 design 下再補 implementer
  路徑（`TODO.md` 的 `〔stage-agents〕下一個前端任務` 那條）。
- Test: `tests/stages.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Needs a decision` 段裡 `TODO.md:95` 那條
  `〔stage-agents〕受控 design 站遇上 design.mockup` 的 bullet（TODO.md 自己的規矩：完成的人
  在同一個變更裡移除對應的條目）。

**Interfaces:**
- Consumes: 無
- Produces: 無（`rulesFor` 的對外簽章不變）

**Dispatch:** implementer, sonnet — 單一函式的過濾邏輯加文件說明，轉錄加測試，同一個 commit
順手清掉自己的 TODO.md bullet。

在 `lib/stages.js`，`rulesFor` 裡（現在的 `lib/stages.js:566-572`），把：

```js
function rulesFor(stage, subs, values) {
    const found = byName(stage);
    const v = values || profile.read(null, null).values;
    const on = (list) => (list || []).filter((r) => holds(r.when, v)).map((r) => r.text);
    const all = ALWAYS.concat(on(ALWAYS_WHEN), found ? found.rules.concat(on(found.when)) : []);
    return substitute(all, subs);
}
```

在 `lib/stages.js`，改成：

```js
function rulesFor(stage, subs, values) {
    const found = byName(stage);
    const v = values || profile.read(null, null).values;
    // A controlled design station has no agent that can Write or Edit a
    // mockup page — agentsFor('design') is reader and reviewer only — so the
    // rule telling the brain to make one would ask for something it cannot
    // do. Filtered here, on a values copy, rather than in `holds`, which
    // only ever compares one key.
    const forWhen = (stage === 'design' && controlling('design', v)) ? { ...v, 'design.mockup': false } : v;
    const on = (list) => (list || []).filter((r) => holds(r.when, forWhen)).map((r) => r.text);
    const all = ALWAYS.concat(on(ALWAYS_WHEN), found ? found.rules.concat(on(found.when)) : []);
    return substitute(all, subs);
}
```

`controlling` is already defined above in this file and already exported; no new import.

In `tests/stages.test.js`, after the existing test at `tests/stages.test.js:730-737`
(`'the mockup rule is on only where design.mockup names a model'`), add:

```js
test('the mockup rule is filtered when design is controlled, even with a model named', () => {
  const uncontrolled = rulesFor('design', null, { 'design.mockup': 'opus' }).join('\n');
  assert.match(uncontrolled, /mockup/, 'sanity: the rule is on with no stage.agents at all');
  const controlled = rulesFor('design', null, { 'design.mockup': 'opus', 'stage.agents': ['design'] }).join('\n');
  assert.equal(/mockup/.test(controlled), false, 'a controlled design station has no agent that can write the page');
});
```

## Task 2: docs/subagents.md 的 accounting 段更新

`docs/subagents.md:610-614` 說 `scripts/ctx.js` 只印控制端的序列與 agent 加總，「還缺
per-agent series」——但 `scripts/ctx.js` 的 `measure()`（`scripts/ctx.js:99-127`）已經能
直接吃單一 agent 檔（`isAgentFile`，`scripts/ctx.js:90-93`），對它印出它自己的序列。這句話
過期了，先只改文件敘述，build/verify 其餘接縫按 design 的決定不動程式碼。

這個 task 同時處理 TODO.md 上兩條不同的 bullet：`TODO.md:88`（Ready 段，專講這句過期敘述）
完全被這個修正解決，移除；`TODO.md:94`（Needs a decision 段，講整批十來個接縫）的決定是「先
記錄不修」——這是一個決定，不是一個修完的碼，所以不是移除，而是搬到 `## Waiting`，比照
TODO.md 既有的「等一次事故再動手」慣例（例如 `guard 測試再紅一次` 那個 timing）。

**Files:**
- Modify: `docs/subagents.md` — 改寫 `docs/subagents.md:613-614` 那句話，從「還缺
  per-agent series」改成「`node scripts/ctx.js <agent 檔>` 現在能直接印出那個 agent 自己的
  序列」。
- Modify: `TODO.md` — 移除 `TODO.md:88` 的 Ready bullet（accounting 那句已經修正）；把
  `TODO.md:94` 的 `〔stage-agents〕受控 build／verify 還有十來個接縫` bullet從
  `## Needs a decision` 搬到 `## Waiting`，新增一個 `### build/verify 接縫一次` 小節，
  `lifts when: 十來個接縫（缺 AskUserQuestion/Edit、插話起第二個 brain、profile 翻轉、
  accounting、claims、commit 位置）任一個被觀察到. 2026-09-22.`，bullet 文字不變，原樣搬過去。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 一句話的文件更正加兩處 TODO.md 編輯（一移除一搬移）。

## Task 3: lock 測試時序放寬

`tests/registry.test.js:722` 的 `a writer waits out a lock somebody else is holding` 測試
讓子行程持鎖 300ms，`lib/registry.js:321-323` 的 `withLock` 等待上限是
`LOCK_ATTEMPTS(200) × LOCK_DELAY_MS(5ms)`＝1000ms。兩次整套紅（3784eb7、40e3e12）都沒碰到
鎖碼或測試本身，讀出來的證據指向並行負載下時序過緊，不是 pid 重用（這把鎖只看 mtime，沒有
pid 檢查）。把子行程持鎖時間降到跟上限有更大餘裕的位置，同時保留在 `LOCK_STALE_MS`（5s）之下
很遠。

**Files:**
- Modify: `tests/registry.test.js`
- Test: `tests/registry.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Needs a decision` 段裡 `TODO.md:103` 那條
  `〔tests〕a writer waits out a lock...` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 常數調整加註解，同一個 commit 順手清掉自己的 TODO.md
bullet。

在 `tests/registry.test.js`，`a writer waits out a lock somebody else is holding` 測試裡
（現在的 `tests/registry.test.js:715-722`），子行程持鎖的呼叫：

```js
spawn(process.execPath, [releaser, lock, '300'], ...)
```

把 `'300'` 改成 `'150'`（持鎖時間減半，讓並行負載下的排程延遲有更大餘裕，同時仍遠低於
`LOCK_STALE_MS` 的 5000ms），並把 `tests/registry.test.js:720-721` 那句註解
（"Well past a spin, and well inside both the 1s cap and the 5s staleness threshold"）
改成反映新數字（150ms 相對 1s 上限與 5s 過期門檻的餘裕）。跑 `node --test tests/registry.test.js`
確認這個測試本身仍然綠；並行下是否還紅要在整套跑幾次裡看（`proves it done` 那一列）。

## Task 4: conflict() 的第 4 個 predicate 補進三份文件

`lib/plantasks.js` 的 `conflict()`（`lib/plantasks.js:115-141`）有 4 個回傳值：
`'undeclared'`（:119）、`'files'`（:124）、`'read'`（:129）、`'interface'`（:139）。
`docs/subagents.md:345`「three predicates」、`docs/collisions.md:169`「the pair of
predicates」、`docs/pipeline.md:564`「the two predicates」都沒提到 `read` 這一個，數字也
互相不一致。三處都補到 4 個，並點名 `read` 擋的是什麼（一個task的 `Read:` 撞另一個task 宣告
中的 `Modify:`/`Test:`）。

**Files:**
- Modify: `docs/subagents.md` — `docs/subagents.md:345` 附近的段落，"three predicates"
  改成 "four predicates"，並在列出的清單裡加上 `read`（一個 task 的 `Read:` 撞另一個 task 的
  `Modify:` 或 `Test:`，視為序列化而非平行）。
- Modify: `docs/collisions.md` — `docs/collisions.md:169` 附近，"the pair of predicates"
  改成 "the four predicates"，補一句點名 `read`。
- Modify: `docs/pipeline.md` — `docs/pipeline.md:564` 附近，"the two predicates" 改成
  "the four predicates"。
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:80` 那條
  `〔docs〕conflict() 有四個 predicate` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 三處文件的數字與清單更正，彼此呼應，同一個 task 做完避免
三個 implementer 各自對不上數字，同一個 commit 順手清掉 TODO.md bullet。

## Task 5: scripts/station.js 的 cache-control header

`scripts/station.js:422-434` 處理 `/station/station.css` 與 `/station/station.js` 的
handler 只送 `content-type`，同檔的 `/`（:377-380）、`/station/station-data.js`（:393-396）、
`/station/detail/*.js`（:410）三處都送 `'cache-control': 'no-store'`。升版後瀏覽器可能跑到舊
的用戶端腳本。

**Files:**
- Modify: `scripts/station.js`
- Test: `tests/station-cli.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:78` 那條
  `〔station〕serve 送 .js 與 .css 時不帶 cache-control` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 兩行 header 加一個新測試斷言，同一個 commit 順手清掉
TODO.md bullet。

在 `scripts/station.js`，`/station/station.css`、`/station/station.js` 的 handler 裡
（現在的 `scripts/station.js:431-434`）：

```js
res.writeHead(200, {
    'content-type': name.endsWith('.css')
        ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
});
```

在 `scripts/station.js`，改成：

```js
res.writeHead(200, {
    'content-type': name.endsWith('.css')
        ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
    'cache-control': 'no-store',
});
```

在 `tests/station-cli.test.js`，既有測試（`tests/station-cli.test.js:153-154`）已經對這兩條
路徑各發一次 GET 並斷言 `status === 200`：

```js
assert.equal((await request(s.url + 'station/station.css', { method: 'GET' })).status, 200);
assert.equal((await request(s.url + 'station/station.js', { method: 'GET' })).status, 200);
```

在同一個測試裡，這兩行後面各加一行，斷言 `headers['cache-control']` 為 `'no-store'`
（`request()` 回傳的物件已經帶 `headers`，跟這個檔案其他斷言 `status` 的寫法一致，照抄它讀
header 的寫法；若 `request()` 目前沒有回傳 headers，改讀它就近的簽章補上）。

## Task 6: 「依版本」的顏色與圖例收攏

`assets/station/station.js:258-266`（`colorOf`）的 fallback（`Math.min(i,5)`）是 `'project'`
和 `'version'` 共用的分支，讓第 7 個以後的版本全落在 `--p-5`；`legendHtml`
（`assets/station/station.js:554-566`）的收攏邏輯（`own.length < bars.keys.length` 印「其他
N 個」）只在 `o.dim === 'project'` 時才會讓 `own` 變窄，`'version'` 底下 `own === bars.keys`
恆真，收攏永遠不會觸發。讓 `'version'` 也比照 `'project'` 收攏。

**Files:**
- Modify: `assets/station/station.js`
- Test: `tests/station-view.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:79` 那條
  `〔station〕首頁圖例在依版本下不收攏` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 一個條件判斷的收攏邏輯加測試，同一個 commit 順手清掉
TODO.md bullet。第一步務必先讀
`legendHtml`／`colorOf` 目前對 `'project'` 怎麼收攏，讓 `'version'` 用同一條路徑而不是另開
一份邏輯。

第一步在 `assets/station/station.js` 讀 `legendHtml`（:554-566）目前對 `o.dim === 'project'`
怎麼收攏 `own`（narrow 到前幾名 + 「其他 N 個」），把同一段邏輯的觸發條件從只認
`o.dim === 'project'` 改成 `'project'` 與 `'version'` 都觸發，讓 `colorOf` 的 `--p-5` 溢出
分支在兩個 dim 下都對應到圖例的「其他 N 個」。

在 `tests/station-view.test.js`，仿照既有測試 `'version gives each real version its own
palette slot...'`（`tests/station-view.test.js:663-670`）與 `'the 未記版本 legend entry...'`
（`tests/station-view.test.js:676-682`）的資料建置方式，用超過 7 個相異版本的資料建一組
`bars`，斷言 `legendHtml` 對 `dim: 'version'` 印出「其他 N 個」而不是把每個版本都列成獨立
一行。

## Task 7: 4 條歪掉的 code-comment path:line

commit fb2f734 之後，`tests/station-hide.test.js` 與 `tests/station-view.test.js` 裡有 4 條
（不是 TODO 原寫的 3 條）指向錯誤行號的 code-comment `path:line`：

| 位置 | 現在寫的 | 實際 |
|---|---|---|
| `tests/station-hide.test.js:10` | `lib/station.js:481` | `serialize()` 的 `profiles.projects` 迴圈在 `lib/station.js:604` |
| `tests/station-view.test.js:747` | `lib/usage.js:470` | `split` 建在 `lib/usage.js:468`，定義在 `:366` |
| `tests/station-view.test.js:999` | `scripts/station.js:766` | 該檔只有 762 行，不存在 |
| `tests/station-view.test.js:1050` | `assets/station/station.js:2072` | `p.innerHTML =` 在 `assets/station/station.js:2470` |

**Files:**
- Modify: `tests/station-hide.test.js`
- Modify: `tests/station-view.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:81` 那條
  `〔tests〕程式註解裡的 path:line 沒人驗` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 純註解修正，逐條核對，不動邏輯或斷言，同一個 commit
順手清掉 TODO.md bullet。

把上表 4 處註解裡的行號改成「實際」欄的數字。改之前先各自重新確認一次目標行今天的內容仍是
表裡描述的那段程式（這幾個檔案在這個 task 之前的其他 task 不會動到，但保險起見用
`git log -1 --format=%H` 記一下當下的 HEAD，跟報告裡的核對時間點一致）。

## Task 8: quota 定錨的連結與方法

TODO Ready#5 的連結指向 `scripts/spend.js`，但那個檔案（94 行，已讀過全文）完全沒有
`quotaLimits`，也沒有任何 13 筆定錨的邏輯——它是 session 成本組成的報表，跟 quota 無關。真正
跟 `quotaLimits` 有關的程式在 `docs/reports/evidence/2026-09-21-quota-calibration/basis.js`
（已讀過全文）：它的 block 4（:216-263）只是**掃描**每一筆帶 `quotaLimits` 的 transcript
記錄並印出來，自己的註解明講「Nothing in this report uses it yet; it is the next
measurement, not this one」——也就是說，basis.js 本身**沒有**做 TODO 描述的「13 筆定錨
100%」；那個方法（如果存在）要在同目錄的 `windows.js` 或 `roundings.js`，或
`docs/reports/2026-09-21-quota-calibration.md` 報告本文裡找。

**Files:**
- Read: `docs/reports/evidence/2026-09-21-quota-calibration/windows.js`
- Read: `docs/reports/evidence/2026-09-21-quota-calibration/roundings.js`
- Modify: `docs/reports/2026-09-21-quota-calibration.md` — 讀完兩個 Read 檔與現有本文之後定案：
  若舊的「13 筆定錨 100%」方法確實在 `windows.js`／`roundings.js` 裡，把報告本文改寫成
  引用 `basis.js` 的兩點定錨法；若那個方法根本不存在，把本文改成如實描述 `basis.js` 現在
  做的事，不勉強造一個不存在的舊方法出來對比
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:82` 那條
  `〔quota〕用 quotaLimits 的 13 筆被拒紀錄定錨 100%` 的 bullet（連結錯誤與方法都在這個
  task 裡定案並修正，不留一條只改連結、內容照舊的殘留 bullet）。

**Interfaces:**
- Consumes: 無
- Produces: 無（下游沒有其他 task 依賴這裡定案的結果）

**Dispatch:** implementer, sonnet — 這個 task 的前三分之一是調查，不是轉錄；調查完把定案寫成
一則 `task.js note`，再動手改。若調查後發現「13 筆定錨 100%」這個方法根本不存在（basis.js 的
兩點法已經是唯一實作），就把 TODO 的敘述改成如實描述 basis.js 現在做的事，而不是勉強造一個
不存在的舊方法出來對比。

## Task 9: session record 存 profile 快照

`scripts/task.js:587` 目前只有 `guard` 會寫進 session record（`prof.sources.guard &&
prof.sources.guard !== 'builtin'` 才寫）。`lib/profile.js:17-32` 的 `KEYS` 共 9 個
（`land.integration`、`land.push`、`land.archivePlan`、`class.default`、`guard`、
`dispatch.floor`、`judge.model`、`design.mockup`、`station.hide`、`stage.agents`）。`start`
時把每一個非 builtin 來源的值都存一份快照到 `data`，欄位取名 `profile`（物件，key 是
profile key，value 是實際值），跟 `guard` 那個既有欄位並存（不刪 `guard` 欄位，避免動到既有
讀者）。

**Files:**
- Modify: `scripts/task.js`
- Modify: `docs/registry.md` — `docs/registry.md:31` 那一列，`guard` 欄位的敘述後面補一句
  新的 `profile` 欄位（非預設值的快照）
- Test: `tests/task.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:83` 那條
  `〔registry〕session 記錄只存 guard` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 讀 `lib/profile.js` 的 `read()`（`lib/profile.js:110-`
附近）回傳的 `{ values, sources }` 形狀，照 `guard` 現有寫法（`scripts/task.js:587`）的判斷式
（`sources[key] !== 'builtin'`）逐一 key 套用。

在 `scripts/task.js`，緊接著現有的：

```js
if (prof.sources.guard && prof.sources.guard !== 'builtin') data.guard = prof.values.guard;
```

（`scripts/task.js:587`）加一段，把 `lib/profile.js` 的 `KEYS` 裡除了 `guard` 以外、
`prof.sources` 不是 `'builtin'` 的每個 key 存進 `data.profile`（一個物件；沒有任何非預設值時
不加這個欄位，保持跟現在一樣「不寫等於全預設」的讀法）。`KEYS` 從
`require('../lib/profile.js')` 拿（`task.js` 已經 `require` 了 `profile`，不需要新 import）。

在 `tests/task.test.js`，靠近既有 guard 相關測試（`tests/task.test.js:1564` 附近），加一個
測試：`profile set` 兩個非 guard 的 key（例如 `class.default bounded` 與
`dispatch.floor opus`）之後 `task.js start`，斷言寫出來的 session record 的 `data.profile`
含這兩個 key 的值，且不含任何仍是 builtin 的 key。

## Task 10: docs/registry.md 補 4 列缺的檔案

`docs/registry.md` 的「files written」表（`docs/registry.md:29-41`）沒有列
`build/task-<time>/` 的交接檔（`<stage>.md`、`-answer.md`、`-commit.md`）、`serve.json`、
`station/detail/`、`station/cache/`。

**Files:**
- Modify: `docs/registry.md`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:84` 那條
  `〔docs〕registry.md 的「寫入的檔案」表缺` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 表格加 4 列，格式比照既有列（路徑、是否版本控制、寫入者）；
寫入者的敘述照 `lib/handoff.js`（交接檔）、`lib/station.js`（`serve.json`、
`station/detail/`、`station/cache/`）裡實際負責的函式名，同一個 commit 順手清掉 TODO.md
bullet。

## Task 11: 過期的 last_verified 與行號註解

`docs/development.md:3` 的 `last_verified: 2026-09-17` 早於它自己 :89 講的
「Until 2026-09-18 no page did」；`skills/fankeel-land/SKILL.md:6` 的
`last_verified: 2026-09-11` 早於它 09-22 的實質修改（commit `242d653`）。
`tests/render.test.js:487-489` 的註解說「`audit` is the binding stage at 2397」，今天實跑
（`node --test tests/render.test.js`）量到的數字是
`survey 2350, design 2396, plan 2350, build 2254, verify 2372, audit 2391, land 2396`——
binding 的是 `design`／`land`（2396），不是 `audit`（2397 完全沒出現）。
`scripts/task.js:712` 與 `:722` 兩處註解都還寫「2393」，同一次量測 `build` 是 2254。

**Files:**
- Modify: `docs/development.md`
- Modify: `skills/fankeel-land/SKILL.md`
- Modify: `tests/render.test.js`
- Modify: `scripts/task.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡 `TODO.md:85` 那條
  `〔docs〕development.md 與 land skill 的 last_verified` 的 bullet。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 同一個 commit 順手清掉 TODO.md bullet。動手前先重新跑一次
`node --test tests/render.test.js`，用那次實跑的數字，不要抄這個 task 寫的數字（可能因為
前面幾個 task 已經改了字元數而變動）。

`docs/development.md:3` 的 `last_verified` 改成落地那天的日期；`skills/fankeel-land/SKILL.md:6`
同樣改成落地那天。`tests/render.test.js:487-489` 的註解改成當下重跑量到的數字與哪一站是
binding；`scripts/task.js:712` 與 `:722` 的「2393」改成當下重跑量到的 `build` 數字。

## Task 12: scripts/ctx.js 的小尾巴

`scripts/ctx.js:64`（`if (!entry || entry.isSidechain === true) return;`）的
`isSidechain === true` skip 沒有 fixture 單獨釘住；`:72`
（`if (t === null) return;`）跟 :73 的 `if (t > seen)` 重複（`null > seen` 恆假）；
`isAgentFile`（:90-93）可以改用「`summarise` 回傳是否為 null」判斷，省掉自己重新掃描 requests
的邏輯；:95-98 的註解說「each line is copied with isSidechain false」，實際上
（:105）只有 `isSidechain === true` 的行被改寫，其餘行原樣通過。

**Files:**
- Modify: `scripts/ctx.js`
- Test: `tests/ctx.test.js`
- Modify: `TODO.md` — 同一個 commit 移除 `## Ready` 段裡兩條 bullet：`TODO.md:86`
  `〔stage-agents〕ctx.js --by-stage 的 stageRows 還有兩個小尾巴` 與 `TODO.md:87`
  `〔stage-agents〕ctx.js 讀 agent 檔還有三個小尾巴`（第三小尾巴——`isAgentFile` 改法——若
  step 3 判斷不能換，只移除 stageRows 那條和已經修好的部分，`isAgentFile` 那半句留在
  bullet 裡並記一則 note 說明還沒換成功）。

**Interfaces:**
- Consumes: 無
- Produces: 無

**Dispatch:** implementer, sonnet — 四處都是小改動，同一個檔案一次做完，跑
`node --test tests/ctx.test.js` 確認既有測試都還綠，同一個 commit 順手清掉 TODO.md 的兩條
bullet。

1. `scripts/ctx.js:72` 刪掉 `if (t === null) return;` 這一行（:73 的 `if (t > seen)` 已經
   涵蓋 `t === null` 的情況）。
2. 在 `tests/ctx.test.js`，加一個 fixture／測試，混合 main 與 sidechain 的 entries，斷言
   `stageRows` 對 `isSidechain === true` 的那行確實被跳過（不進 `turns`／`woken`／`reread`
   的計算）。
3. `isAgentFile`（`scripts/ctx.js:90-93`）：先確認 `usage.summarise(file, { sidechain: true,
   series: true })` 對一個「全 sidechain」檔案與一個「非 agent 檔」分別回傳什麼（`summarise`
   在 `lib/usage.js`），若「非 agent 檔」在 `sidechain: true` 模式下確實回傳 null 或某個可
   辨識的形狀，把 `isAgentFile` 改成讀那個回傳值而不是自己重新 filter+every 一次
   requests；若讀完發現兩者形狀不能直接互相替代，保留現有實作，在這個 task 的 note 裡寫下
   為什麼不能換，不要硬套。
4. `scripts/ctx.js:95-98` 的註解，把「each line is copied with `isSidechain` false」改成
   「only the lines whose `isSidechain` is already `true` are rewritten to `false`; the
   rest of an agent file's lines pass through unchanged」，跟 :105 的實作一致。

## Task 13: 全域驗證收尾

Task 1-12 各自在自己的 commit 裡移除了自己的 TODO.md bullet（`TODO.md` 自己的規矩：完成的人
在同一個變更裡移除對應的條目）；Task 2 額外把一條決定（build/verify 接縫先記錄不修）從
`## Needs a decision` 搬到 `## Waiting`。這個 task 是最後一道全域檢查，抓任何單一 task 自己
的測試看不到、只有全部落地後才看得出來的問題：TODO.md 有沒有殘留、文件引用有沒有互相打架。
這是 in-session 做：兩個現成的檢查腳本各跑一次，不值得為此開一個新 context，且要等其餘 task
都落地才有意義，天然排在最後。

**Files:**
- Read: `TODO.md`

**Interfaces:**
- Consumes: Task 1-12 落地後的樹狀態——文字說明，非型別介面
- Produces: 無

**Dispatch:** in-session — 兩個腳本各跑一次，讀結果，是一次性的核對，不值得開一個新 context；
且要等其餘 task 都落地才有意義，天然排在最後。

跑 `node scripts/todo-check.js` 確認沒有殘留指向已刪除或已改變角色的連結、`## Waiting` 新加的
`### build/verify 接縫一次` 小節格式正確（標題 ≤28 欄、有 `lifts when:` 與日期戳）；跑
`node scripts/docs-check.js` 確認所有文件修改後的引用仍然成立。兩個都不綠就回頭找漏掉的
task，不在這裡就地修。

## Coverage

| promise | task |
|---|---|
| `lib/stages.js` — `design.mockup` 的 `when` 規則加上 `controlling('design', values)` 條件 | Task 1 |
| `docs/subagents.md` — 補一句：受控 design 站目前不觸發 `design.mockup` | Task 1 |
| `docs/subagents.md` — 補齊 accounting 段：`scripts/ctx.js` 現在已經能印單一 agent 檔的 per-agent series | Task 2 |
| `tests/registry.test.js` — `a writer waits out a lock somebody else is holding` 的持鎖時間或等待上限之間的餘裕加大 | Task 3 |
| `scripts/station.js` — `/station/station.js`、`/station/station.css` 的 handler 加 `cache-control: no-store` | Task 5 |
| `assets/station/station.js` — `colorOf`／`legendHtml` 讓「依版本」比照「依 project」收攏第 7 個以後的顏色 | Task 6 |
| `lib/plantasks.js` 相關文件 — `docs/subagents.md`、`docs/collisions.md`、`docs/pipeline.md` 各自補上 `conflict()` 的第 4 個 predicate | Task 4 |
| `tests/station-hide.test.js`、`tests/station-view.test.js` — 修正 code-comment 裡歪掉的 `path:line` | Task 7 |
| `docs/reports/2026-09-21-quota-calibration.md`（或其定錨邏輯實際所在的 basis.js）— TODO Ready#5 的連結指到 `scripts/spend.js` | Task 8 |
| `scripts/task.js` — session record 除了 `guard`，start 時把其餘 profile 值一併存一份快照 | Task 9 |
| `docs/registry.md` — 「files written」表補上 `build/task-<time>/` 的交接檔（`<stage>.md`、`-answer.md`、`-commit.md`） | Task 10 |
| `docs/development.md`、`skills/fankeel-land/SKILL.md` — `last_verified` 更新到重讀後的日期 | Task 11 |
| `scripts/ctx.js` — `stageRows` 的 `isSidechain === true` skip 補一個 fixture 釘住，刪掉多餘的 `t === null` return | Task 12 |
| `TODO.md` — 每項完成後在同一個 commit 移除對應 bullet | Task 1-12，各自在自己的 commit 裡 |
| `node --test` 全綠 | 全部 task（每個 task 自己的 Test 綠，Task 13 前跑一次整套） |
| lock 測試整套連跑 3 次不紅 | Task 3 |
| 「依版本」render 後 8 版本以上收攏 | Task 6 |
| `curl -I` 對 station.js/.css 見到 `no-store` | Task 5 |
| `docs-check`／`todo-check` 綠 | Task 13 |

## Dispatch

13 個 task（design.mockup 的兩個檔案表列併入 Task 1，所以編號到 13 而非 14）。Task 1-12
每個都在自己的 Files 裡 Modify `TODO.md`（各自移除自己的 bullet），所以 `conflict()` 的
`files` predicate 會把它們兩兩串起來，序列化程度比檔案內容本身看起來的還高；實際分批用
`node scripts/ledger.js --plan docs/plans/2026-09-22-todo-cleanup.md groups` 決定，不要
用本文的敘述去猜。全部 sonnet；沒有一個需要更高的模型，都是轉錄＋既有測試型式的延伸。Task 13
in-session，其餘 implementer。
