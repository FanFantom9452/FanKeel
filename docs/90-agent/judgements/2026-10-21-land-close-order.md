---
judged: 2026-10-21T03:03:00.633Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 739fa960-d08b-4a8a-bfe4-7503befe3d11
stage: survey
---

# 判官題目：land 的結案順序要不要改成「紀錄寫完才結案」

## Question

# 判官題目：land 的結案順序要不要改成「紀錄寫完才結案」

## 問題

land 階段結案 TODO 條目的順序，要不要改成等 `record.js write` 印出 `filed:` 之後才跑 `todo.js done`，並讓每行 done 都帶 `--record`？

## 選項

- **做**：`lib/stages.js` 注入的 land 規則和 `skills/fankeel-land/SKILL.md` 的結案段，都改成先寫紀錄、再結案；`stage land` 印出的每行 `todo.js done` 帶 `--record <path>`；用 stages 測試釘住新順序。
- **不做**：維持現狀，兩條 TODO 改成 keep 或關掉，理由寫清楚。

## 背景

- `lib/stages.js` 的 land 規則（約第 398 行）先寫「Close the TODO entries … (`todo.js done` lines from `stage land`)」，寫紀錄的 `record.js write` 排在後面，在 Output 規則裡（約第 405 行）。
- `stage land` 印出的 `todo.js done` 行沒有帶 `--record`。
- `skills/fankeel-land/SKILL.md` 的結案段也是同一個順序。
- 上一次 patrol（session 9f451488）的 retro 第 120 回合：四個條目在 `record.js write` 之前就結案，沒帶 `--record`，所以條目裡沒有任務紀錄的連結。
- 來源 TODO 有兩條，同源，一起裁定：「land 規則先紀錄後結案」（docs/90-agent/todo/stages-1.md），「land 先寫紀錄再結案」（docs/90-agent/todo/land-7.md）。
- 要確認的事：`todo.js done` 是否真的接受 `--record`、它拿這個值做什麼；`record.js write` 印出的 `filed:` 路徑長什麼樣；`stage land` 在哪裡印出 done 行（task.js 或 lib 裡）；上面的事實是否屬實。

## 要讀的路徑

- lib/stages.js（land 那一段，約第 390–415 行）
- skills/fankeel-land/SKILL.md（結案段）
- scripts/todo.js（`done` 子命令，以及 `--record`）
- scripts/record.js（`write` 子命令，以及它印出的 `filed:`）
- scripts/task.js，以及它呼叫的 lib 檔，找 `stage land` 印出 `todo.js done` 行的地方
- tests/stages.test.js（land 規則目前怎麼測）
- docs/90-agent/todo/stages-1.md、docs/90-agent/todo/land-7.md

## 怎樣才算答案

答「做」或「不做」，理由要指到 path:line。答「做」的話，要再說清楚：

1. `--record` 要指向哪個檔：`record.js write` 印出的那個紀錄檔路徑，還是別的檔；
2. 印 done 行的地方要怎麼拿到這個路徑：它印的時候紀錄還沒寫，路徑能不能事先算出來，還是要等 `filed:` 之後再印。

## 回答的格式

六個欄位，`pick:` 那一行必填，後面接 `## Summary`。

## Answer

pick: 做 — 但範圍縮到 `lib/stages.js:398`、`scripts/task.js:848-850` 和 stages 測試；`skills/fankeel-land/SKILL.md` 不用動，它已經是先紀錄後結案。
why: `lib/stages.js:398` 的結案規則排在第二條、`record.js write` 在最後一條 `:405`，全檔沒有 `--record`；`scripts/task.js:850` 印出的 done 行只有 `--sha <sha> --session <id> --root <dir>`。
  `skills/fankeel-land/SKILL.md:117` 已有「2.0 File the record first」，`:144-145` 的 `todo.js done` 已帶 `--record "<一兩句>. 詳見 <link>" --commits`，且說明連結就是 `filed:` 路徑；這段 2026-10-19（d74e66ba）就在，早於 retro 的 session，所以 retro 第 120 回合是注入規則和印出行蓋過了 skill。
  `--record` 不是檔案路徑：`lib/todo.js:514-517` 把它當自由文字接成 `## 完成紀錄` 段，不驗證、不能事後補（`:507` 已 done 就拒絕）。
  路徑無法在 `stage land` 印出時精算：`scripts/record.js:168-176` 的月份、日期取寫入當下時鐘，anchor 靠掃既有月檔計數；`recordsRel` 也沒 export（`:333`）。所以 done 行只能印佔位符，和現有 `--sha <sha>` 同一做法。
  測試只釘 Output 規則在最後（`tests/stages.test.js:1216`），沒釘先後也沒釘 `--record`；land 規則現 781 / 2500 位元組，加字有餘裕。
would flip if: `lib/todo.js` 的 `--record` 其實是路徑欄位且 `record.js` 有 export 可事先算出 `filed:`——那就該由 `task.js` 直接算好印出，而不是佔位符。
unread: nothing（session 9f451488 的 retro 原文不在點名清單，只透過兩條 TODO 的轉述）。
delegated: scripts/todo.js + lib/todo.js（opus）；scripts/record.js（sonnet）；scripts/task.js + lib/registry.js + grep lib/ scripts/（sonnet）；lib/stages.js + tests/stages.test.js（sonnet）；skills/fankeel-land/SKILL.md + docs/90-agent/todo/stages-1.md + docs/90-agent/todo/land-7.md（sonnet）。
checklist:
  1. scripts/todo.js — `done` 是否接受 `--record`、寫到哪 — 已答（接受；自由文字進 `## 完成紀錄`）。
  2. scripts/record.js — `filed:` 格式、能否事先算 — 已答（`<records bucket>/<YYYY-MM>.md#r-<day>-<id8>[-N]`；檔名可估、anchor 不可精算）。
  3. scripts/task.js — 哪裡印 done 行、手上有什麼 — 已答（`todoLines` :841-850，進站時印；只有 root、session id、project dir）。
  4. lib/stages.js land 規則順序 — 已答（結案 :398 在前、write :405 在後、無 `--record`）。
  5. tests/stages.test.js — 怎麼測 — 已答（:1216 只釘 Output 最後；無順序、無 `--record` 斷言）。
  6. skills/fankeel-land/SKILL.md 結案段 — 已答（已是先紀錄、已帶 `--record`；簡報背景此點不符現況）。
  7. 兩條 TODO — 已答（皆 `state: decision`，同源；land-7 對 skill 的要求已成立）。

## Summary

### 各讀者找到什麼

**todo.js（opus）**：`scripts/todo.js:23` 的 usage 列出 `done <id> --sha <sha> [--session <id>] [--disposition done] [--record <text> --commits <sha,sha>]`，`:88` 把 `record` 當字串、`commits` 切逗號。真正寫入在 `lib/todo.js:514-517`：`--record` 非空時，body 尾端接 `## 完成紀錄`（`lib/plain.js:19`）＋原文＋每個 sha 一行 `- commit <sha>`；沒給就什麼都不加、沒有佔位。`:507` 已 done 的條目再跑 `done` 會丟錯，`todo.js` 只有 `list | new | done | migrate`，所以結案後補不回去。`scripts/todo.js:9` 的檔頭註解 usage 還是舊的、沒有 `--record`（順帶一提，不影響裁定）。抽查 `lib/todo.js:505-526` 屬實。

**record.js（sonnet）**：`scripts/record.js:187` 印 `filed: <rel>#<anchor>`，`rel` 是 repo 相對路徑；`:170` 檔名 = `recordsRel(projectRoot) + '/' + <寫入當下 UTC 年月>.md`，預設 bucket `docs/90-agent/records`（`:137`）；`:172-176` anchor = `r-<UTC 日期>-<session 前 8 碼>`，同一月檔已有同名 anchor 時加 `-N`，N 靠掃現有檔計數。`:333` 只 export `parse, problems, appendUnder`，沒有 dry-run 或 path 子命令。`write` 不碰 TODO 條目（`:166` 只讀 id 來抓裸代碼）。抽查 `:163-193` 屬實。

**task.js（sonnet）**：`scripts/task.js:841-850` 的 `todoLines(root, id, data)` 由 `openingLines` 在 `data.stage === 'land'` 時呼叫（`:810-812`），也就是進站那一刻印。印出 `node <plugin>/scripts/todo.js done <id> --sha <sha> --session <id> --root <dir>`，沒有 `--record`、`--commits`。手上只有 registry root、session id、session 資料、project dir；沒有紀錄路徑，也沒有任何 lib 在 `record.js` 之外算紀錄路徑。`stage land` 的輸出也沒有 `record.js write` 行（那只存在於 `lib/stages.js:405` 的規則字串）。抽查 `:803-851` 屬實。

**stages.js + 測試（sonnet）**：`lib/stages.js:396-406` 的 `rules` 是平陣列：`COMMIT`、`:398` 結案、`:399` last_verified、…、`:404` gate 問 `record.js session`、`:405` `Output: … pipe the record to record.js write`。grep `--record` 無命中。`tests/stages.test.js:1216` 斷言 `land[land.length-1]` 以 `Output:` 開頭（釘 Output 在最後），`:1219` 釘 2500 位元組預算；全檔沒有 `todo.js done`、沒有順序或 `--record` 的斷言。抽查 `:394-411`、`:1212-1225` 屬實。我另外跑 `byName('land')` 算出 land 規則現為 781 位元組，預算 2500。

**SKILL.md + 兩條 TODO（sonnet）**：`skills/fankeel-land/SKILL.md:111` 是「2. Close the documents」，`:117` 是「2.0 File the record first」，`:123` 是 `record.js write` 指令，`:136` 說它印 `filed: <file>#<anchor>`，`:138-139` 說任務此時仍 active 所以 write 要在 Execute 收台之前跑；`:144-145` 才是結案指令，done 行已帶 `--record "<一兩句>. 詳見 <link to the record>" --commits <sha,sha>`，並明說連結是 `filed:` 路徑「寫成相對 TODO 檔的 markdown 連結、文字 任務紀錄、含 anchor」。抽查 `:111-146` 屬實。`git log -S'File the record first'` 顯示這段由 d74e66ba（2026-10-19）帶入，早於 2026-10-21 的 retro session。兩條 TODO（`docs/90-agent/todo/stages-1.md:9`、`land-7.md:9`）都是 `state: decision`，互指同源；land-7 的「要做成」有兩半：skill 改成等 `filed:` 再結案（現況已如此）、`stage land` 印的 done 行加 `--record`（和 stages-1 同一件事）。

### 怎麼推到 pick

1. 事實鏈成立：注入規則 `lib/stages.js:398` 把結案排在前、`record.js write` 排在最後；`scripts/task.js:850` 印的 done 行沒 `--record`；`lib/todo.js:507` 讓結案後補不回去。三者合起來，照注入規則與印出行做，條目就永遠少完成紀錄——這正是 retro 第 120 回合的結果。
2. 但 skill 不是病因：`SKILL.md:117-145` 在 retro 之前就已是先紀錄、後結案、帶 `--record`。session 之所以還是先結案，是因為注入規則每回合都在眼前、印出行可直接複製，兩者都說「先結案、不帶 --record」，蓋過了只在進站時讀一次的 skill。所以修的地方是 `lib/stages.js` 和 `scripts/task.js`，不是 skill。
3. 簡報問的兩點：
   - **`--record` 指向哪個檔**：不指向檔。`lib/todo.js:517` 把它當一兩句自由文字接進 `## 完成紀錄`；`SKILL.md:145` 要求那段文字內含 markdown 連結，目標是 `filed:` 印出的 `<records>/<YYYY-MM>.md#<anchor>` 改寫成相對 TODO 檔的路徑（例如 `../records/2026-10.md#r-2026-10-21-<id8>`）。所以 `--record` 的值 = 句子 + 指向 `filed:` 路徑的連結，而不是路徑本身。
   - **印 done 行時怎麼拿到路徑**：拿不到，也不該拿。`todoLines` 在進站時印（`task.js:810-812`），紀錄還沒寫；檔名部分（bucket + 當月）雖可估，但 `recordsRel` 未 export（`record.js:333`），anchor 的 `-N` 要掃寫入當下的月檔（`:175-176`），跨 UTC 月界還會換檔；而且句子本來就是 session 自己要寫的。正確做法是印佔位符——現行 `--sha <sha>` 已經是佔位符，加上 `--record "<一兩句>. 詳見 [任務紀錄](<filed: 路徑，相對 TODO 檔>)" --commits <sha,sha>` 是同一種做法——並把表頭「close at land, each with the sha that landed it:」改成說明「等 `record.js write` 印出 `filed:` 之後」再跑。
4. 規則改法：`tests/stages.test.js:1216` 釘 Output 規則在最後，所以別把結案規則移到陣列尾端去追 `record.js write`，而是把 `:398` 的文字改成明說依賴——「After `record.js write` prints `filed:`, close the TODO entries this work finished … each `todo.js done` line from `stage land` with `--record` carrying the sentences and the 任務紀錄 link, then run `node {{TODO_CHECK}}`」之類；順序用字講清楚，陣列位置不動。新測試斷言結案規則匹配 `/after .record\.js write. prints .filed:/` 與 `/--record/`，再加一條對 `todoLines` 輸出含 `--record` 的斷言（task.js 的測試檔由實作者定位）。781 / 2500 位元組，加這些字不會撞預算。
5. 兩條 TODO 的處置：stages-1 照上面做；land-7 的 skill 半邊已由 d74e66ba 完成、`stage land` 半邊和 stages-1 是同一處改動，建議在同一次 land 一起關掉，完成紀錄註明 skill 早已先紀錄、真正改的是 `lib/stages.js:398` 和 `scripts/task.js:848-850`。

### 沒查到的

retro 原文（session 9f451488 第 120 回合）沒開，只憑 TODO 轉述；`lib/render.js` 怎麼把 rules 串起來、是否加標題，沒讀——不影響「結案規則在前、write 在後」這個順序事實。`scripts/todo.js:9` 檔頭註解缺 `--record` 是順手看到的小不一致，不在本題範圍。
