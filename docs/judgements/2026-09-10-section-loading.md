---
judged: 2026-09-10T15:04:31.356Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 4：條件載入要不要做到「節」的粒度

## Question

# 判斷 4：條件載入要不要做到「節」的粒度

## 問題

今天一個 `spike` 的 build 階段，付的是 `architectural` 的 token：`build` 的
SKILL.md 整檔載入，裡面關於 plan 與 ledger 的段落對 spike 完全用不上。要不要做
一個到「節」粒度的條件載入？做的話切在哪個接縫？

## 你可以自己讀的檔

- `lib/stages.js:474-487` — `CLASSES`：`spike` 是 `[survey, build]`、`bounded` 是
  `[survey, design, build, verify, land]`、`architectural` 是全部七站
- `lib/stages.js:491-494` — `routeForClass(name)`
- `lib/stage-registry.js:85-86` — `fs.readFileSync` 整檔讀入一份 SKILL.md，
  全 repo 沒有任何依 class 切片的程式
- `skills/fankeel-build/SKILL.md:15-18` — 「denominator is the ledger where there
  is a plan … design's file table where there is no plan, which is every
  `bounded` task. A `spike` has neither」
- `skills/fankeel-build/SKILL.md:83` — 「With no plan file there is no ledger and
  nothing to `init`」
- `lib/stages.js:256-257,396-398` — 另一個軸：`holds()` 依 profile 鍵（`design.mockup`、
  `land.archivePlan`）決定個別規則要不要注入。這個機制已經存在，但鍵的是 profile，
  不是 class 也不是有沒有 plan
- `docs/improvement-brief.md:179` — §2.2 的提案本文：一個依四個維度決定載入哪些
  參考檔（細到單一檔案的指定小節）的 router

## 已知的事實

- 今天唯一在運作的條件載入是 route 這一層：不在 route 上的 stage，它的規則從頭
  到尾不會被注入。省下的是整個 stage，不是 stage 內部。
- `skills/fankeel-build/SKILL.md` 裡的 class/plan 分歧是**散文**，寫在一個整檔
  載入的檔案裡。也就是說今天已經有「條件」，只是條件由模型在讀的時候自己判斷。
- SKILL.md 是 session 開始時讀一次（`lib/stages.js:56`），不是每個 prompt 都送。
  所以省的是一次性的成本，不是每輪的成本。這一點會不會讓整件事不划算，是你要
  判的。
- `lib/stages.js:256-257,396-398` 的 `holds()` 證明「規則層級的條件注入」在這個
  外掛已經有現成機制，只是鍵不同。要不要沿用它而不是新造一個 router，是這題的
  一半。

## 算什麼是答案

做或不做。做的話：切在哪（SKILL.md 內的標記、`lib/stages.js` 的規則陣列、還是
一個新的 router）、鍵是什麼（class、有無 plan、profile、還是組合）、以及怎麼
測。不做的話：說出「一次性成本」這個事實是不是足以把整題否掉，以及散文條件
留在整檔載入的檔案裡有沒有別的代價。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

pick: 不做節粒度條件載入。plan/no-plan 的分歧留在 `skills/fankeel-build/SKILL.md` 單檔，用測試守；不新造 router，不改 `holds()`，不以 class 為鍵。
why: brief 的「session 開始讀一次」引錯：`lib/stages.js:56` 說的是 `skills/fankeel/SKILL.md`；stage skill 是進站時讀（`lib/stages.js:307`、`tests/skills.test.js:176`），而且讀進來就常駐、之後每輪以 cache 價重付——不是一次性。但修正後數字仍小：24,400 bytes ≈ 6k tokens，no-plan 用不到的約四成，對 1M context 不到 0.3%，token 這條理由怎麼算都撐不起工程。
執行期沒有任何程式載入 SKILL.md：`lib/stage-registry.js:85-86` 是 registry 產生器抓 `**Done when**`，真正載入是 harness 的 Skill/Read 整檔進 context，所以「節」唯一的切法是拆檔（`rationale.md` 那種）；而 `holds()` 只管注入行，cap 以最壞情況量（`lib/stage-registry.js:29-34`），加 `route.plan` 鍵一個位元組都省不到。
plan-only 文字不是連續的節：Setup §2–3（:55-148）可整段搬，但 loop 裡 step 2 的 brief（:187-201）、step 4 的 workflow（:236-257）、step 7 的 ledger（:344-362）嵌在編號步驟中間；拆出去等於 plan 讀者要自己合併兩檔的步驟，正是 `14ec966` 那種爛法（loop 頭的段落與底下的 loop 自相矛盾），還多一個檔。
重播動機案例：兩次真實 rot——`f883dc4`（2026-08-29，Done when 只認 ledger）與 `14ec966`（2026-08-31，loop 對 no-plan 路線講 groups）——都落在拆檔後仍留在 SKILL.md 的部分，拆檔一件也擋不住；擋住它們的是逐頁讀加一條測試（`tests/skills.test.js:238-250`），機制已在。散文條件的真實代價是「每加一句 plan-path 就多一次忘掉 no-plan 讀者的機會」，對症的是再一條測試（`ledger.js`/`groups`/`brief` 只能出現在 loop 頭那條規則之後或被 no-plan 句括住），不是拆檔。
鍵也錯：class 是路線的名字，`task.js route` 一改就對不上（`lib/stages.js:496-500`），`bounded` 依 design 規則可加 `plan`（:251）；SKILL.md 自己已以「有無 plan」分歧（:15-18、:83），§2.2 的 class 維度買不到東西。
would flip if: 一份 build transcript 顯示 no-plan 路線真的跑了 `ledger.js init`/`groups` 或停下來等 plan 檔——那是讀取時失敗而非寫作時失敗；屆時切 Setup §2–3 成 `plan.md`、鍵用「route 上有 `plan`」、測試沿 `tests/skills.test.js:183-230` 的 SPLIT 模式。
unread: `docs/improvement-brief.md` 只讀 150-217 行；`skills/fankeel-build/rationale.md` 只 grep（plan/spike 零命中）未通讀；未查 session transcript 是否發生過 no-plan 誤跑 ledger。
