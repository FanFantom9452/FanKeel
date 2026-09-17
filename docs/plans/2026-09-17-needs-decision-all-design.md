---
status: design-intent
last_verified: 2026-09-17
---

# `## Needs a decision` 全部 27 條 — design

`TODO.md` 的 `## Needs a decision` 原有 26 條，任務中途加了第 27 條（別的外掛的流程 skill）。這份設計替每一條定案。

survey 派了四個 `fankeel-reader`，一個區塊一個，再由 checker 重新打開每個 `path:line`（結果存在 `.fankeel/build/needs-decision-all/survey.json`，HEAD `70771cd`）。design 階段另外派兩個 reader，補查 hook payload、注入上限、外掛清單和 guard。

**27 條裡，11 條不改程式直接關閉**：survey 查到的現況已經回答了它們。**其餘 16 條分成八段改動。** 三件要人拍板的事已在 2026-09-17 的 design 關卡答覆，結果列在最後。這些改動都不動畫面，所以不做 mockup。

## 1. 只關條目，不改程式

- N02〔docs〕report 區三條錯誤引用放著不改：report 和 judgement 寫完就不再改，而且 `c0eac43` 撤回過一次同樣的修正。
- N07〔subagent〕保留 `lib/render.js:363` 給 judge 的特例，不做每種 type 各一段 brief：需要特例的只有這一型，另外兩個方案都沒有量測支持。
- N11〔todo〕`## Waiting` 的七天門檻運作正常：今天 `node scripts/todo-check.js` 已印出四條逾期。條目寫下當天「一條都沒印」，是因為那時還沒滿七天。
- N12〔subagent〕主 agent 被喚醒的次數跟著派工次數走，不跟著 agent 數走（`docs/reports/2026-09-04-agent-wakeups.md:24-30`）。三個以上互相獨立的任務，`lib/plantasks.js` 的 `surfaces()` 本來就會派成一個 workflow，現行規則已經涵蓋。
- N13〔skill〕模型不去讀 `rationale.md` 就算了：這份檔案是寫給維護的人看的。fankeel 的分層規則本來就規定，必要的規則不能只寫在 skill 裡。
- N16〔memory〕memory-check 的 stale 由誰觸發、要不要 fail、誰來刪，`skills/fankeel-audit/SKILL.md:105-118` 和 `skills/fankeel-land/SKILL.md:114-118` 都已寫明：只列出、不 fail，刪不刪由使用者決定。
- N17〔memory〕memory 不加壽命欄位：memory 檔頭由 Claude Code 自己寫入和改寫，fankeel 加上去的欄位不保證留得住。
- N18〔registry〕詳情頁本來就會對每個 session 重讀 transcript（`lib/detail.js:580`），所以「個別 session 分析看不到三分之二」不成立。沒有 `usage` 時，空掉的只有列表那一格費用（`lib/station.js:259`）。
- N21〔station〕token 用量不另外做 hook：每次換階段，`task.js stage` 已經當場印出上一個階段花了多少 token、用了多少時間。
- N22〔dashboard〕station 的 mockup 流程留在 design 階段的通用做法（`design.mockup`）：目前只有一個例子，不值得獨立成一套流程。
- N25〔station〕詳情頁不加 profile 卡：設計和計畫兩層都刻意把它放在 registry 卡。

## 2. 階段與關卡的紀錄

- N04、N06〔拍板 A〕session 結束時，`hooks/leave.js` 用 `lib/replay.js` 從 transcript 讀出每一次 `AskUserQuestion`，每一題寫成 registry `gates` 欄位裡的一筆 `{ at, stage, header, picked }`。`stage` 從當時的 `moves` 推出來；`picked` 是選到的 label，選 Other 時是使用者打的字，最多 120 字。`gates` 最多 60 筆，超過就丟最舊的。
- 只有 session 正常結束時才會寫，因為 `hooks/leave.js` 只掛在 SessionEnd。沒有正常結束的 session 就沒有 `gates`，這個缺口在拍板時已經知道並接受。
- `gates` 只存不顯示：transcript 還在的時候，詳情頁的 replay（`lib/detail.js:613`）已經看得到同樣的內容。
- `docs/registry.md` 和 `skills/fankeel/SKILL.md` 裡「`hooks/leave.js` 寫四個欄位」的描述改成五個。
- N19 `moves` 的每一筆從 `[stage, at]` 改成 `[stage, at, used]`。`used` 是 `touch()` 寫入時手上的 context 讀數（`hooks/inject.js:195-196`）；拿不到讀數時照舊只記兩個元素。單次倒退花了多少，就是相鄰兩筆 `used` 的差。
- 所有讀 `moves` 的程式（從 `lib/detail.js:149` 的 `movesOf` 開始，連同 `assets/station/station.js`）都要能接受第三個元素。
- `docs/registry.md` 講 `moves` 格式的段落改成三個元素。

## 3. 喚醒次數

- N20 `lib/usage.js` 的 `summarise()` 多回傳一個 `wakes`：主 transcript（不含 sidechain）裡 `notificationOf()` 認得的行數。`hooks/leave.js` 本來就會把 `usage` 整包寫入，寫入點不用改。
- `docs/registry.md` 的 `usage` 說明補上 `wakes`。

## 4. guard 的寫檔誤判

- N23 `lib/guard.js:209` 的第一條 `WRITE_PATTERNS` 不再把這四種寫法當成 redirect：`=>`、`->`、`>&`（例如 `2>&1`）、引號內的 `>`。
- `echo x > f`、`cmd >> log`、`cmd 2> err.txt` 照樣判成寫檔。

## 5. eval

- N15 `scripts/eval.js` 改讀 `disallowed_tools`，傳給 `--disallowedTools`，不再讀 `allowed_tools`。五個 `evals/*/prompt.md` 的 `allowed_tools` 行刪掉；這一行從來沒有限制到任何東西，刪掉不會改變行為。
- N10〔拍板 B〕eval 不進 CI：每跑一次都要花錢，還要在 CI 放登入憑證。`docs/evals.md` 寫明改成發版前手動跑。
- N14 `task.js start` 和 `task.js route` 在 route 少了某些階段時，多印一行 `skipping: <stages> — say which and why`。這條規則原本只寫在 `skills/fankeel/SKILL.md:363-365`；注入區塊只剩 4 個字元的空間（`tests/render.test.js:527`），放不進去，所以改由工具輸出帶出來。

## 6. 文件與 TODO 工具

- N03 `agents/fankeel-reader.md` 加一段搜尋規則：先跑 `survey.js`；用 Grep 時排除 `docs/archive/**`，先用 `files_with_matches` 看有哪些檔，再看內容。
- N08 fixture 路徑的誤判就接受；`docs/plans/2026-09-07-todo-thirteen.md` 和 `docs/plans/2026-09-07-todo-thirteen-design.md` 手動用 `git mv` 移進 `docs/archive/`。
- N09 `docs/improvement-brief.md` 加上 `status: design-intent`。`todo-check.js` 只看 bucket 的 role、不讀 `status`（`scripts/todo-check.js:85`、`scripts/todo-check.js:296-297`），指向這份文件的 TODO 連結不受影響。
- N26 `todo-check.js` 的逾期清單也列出 `## Needs a decision` 裡最後一次編輯已滿七天的條目，只列不 fail。
- 編輯時間沿用 `scripts/orient.js:395` 的 `blameTimes`，把它搬進 `lib/`，讓 `orient.js` 和 `todo-check.js` 共用。

## 7. subagent 與 plan 的文字

- N01 `skills/fankeel/SKILL.md`「Always pass the model」那一條和 `docs/subagents.md` 各加一句：`subagent_type: "fork"` 會繼承整份 context，而且忽略 `model`（Agent 工具自己的說明就這樣寫），所以 fankeel 派工不用 fork。
- N05 `skills/fankeel-plan/SKILL.md:217` 的「Run it and watch it pass」改成只跑自己那支測試，全套測試由 parent 在 commit 一組任務前跑，跟 `scripts/ledger.js:122` 的 footer 一致。

## 8. CLAUDE.md 的大小

- N24 專案根目錄或設定目錄有 `CLAUDE.md` 時，`scripts/orient.js` 多印一行 `claude.md:`，列出每一層的路徑和大小。不問使用者、不設門檻、不存旗標；衝突比對不做。

## 9. 別的外掛的流程 skill

- N27〔拍板 C〕`skills/fankeel/SKILL.md` 的 Calibration 加一條：任務進行中，每一步的程序以 `fankeel-<stage>` 為準；別的外掛在同一步的流程 skill 就擱下，第一次擱下時要講出來。
- 已知會重疊的 skill 列成一張表，放在 `lib/` 的新模組：superpowers 的 `brainstorming` 對 design、`writing-plans` 對 plan、`executing-plans` 和 `subagent-driven-development` 對 build、`verification-before-completion` 對 verify、`finishing-a-development-branch` 對 land。`docs/pipeline.md` 放同一張表，並註明以那個模組為準。
- `scripts/orient.js` 讀設定目錄下的 `plugins/installed_plugins.json`，把表裡實際有裝的印成一行 `overlap:`。

## 10. 條目關閉

- 由最後一個任務把 27 條一次從 `TODO.md` 刪掉，前提是 ledger 顯示其他任務都已完成。如果每段各刪各的，所有任務都會碰到 `TODO.md`，就會被迫串行。第 1 段的全部工作就是刪條目。

## What proves it done

| test | 現在 | 之後 |
|---|---|---|
| `tests/guard.test.js`：`writesFiles` 對 `node -e "[1].map(x => x)"`、`git log -S '=> y'`、`cmd 2>&1` 回 false，對 `echo x > f` 回 true | 前三個回 true | 四個都照預期 |
| `tests/eval.test.js`：meta 設 `disallowed_tools: [Agent]` 時，組出的參數含 `--disallowedTools Agent`，不含 `--allowedTools` | fail | pass |
| task 測試：`task.js start --route "build,verify"` 的輸出含 `skipping: survey, design, plan, audit, land` | 沒有這行 | 有 |
| registry 測試：`touch()` 帶讀數 1234 換階段後，`moves` 最後一筆是 `[stage, at, 1234]` | 兩個元素 | 三個元素 |
| leave 測試：fixture transcript 有一次 `AskUserQuestion` 和它的答案，SessionEnd 之後 registry 多了 `gates: [{ at, stage, header, picked }]` | 沒有 `gates` | 一筆 |
| usage 測試：fixture 有兩行 task-notification，`summarise()` 回 `wakes: 2` | 沒有 `wakes` | 2 |
| todo-check 測試：fixture 有一條 `## Needs a decision` 最後編輯在 8 天前，它出現在逾期清單 | 不列 | 列出 |
| orient 測試：fixture 有 `CLAUDE.md` 時輸出含 `claude.md:`；fixture 的 `installed_plugins.json` 有 superpowers 時輸出含 `overlap:` | 都沒有 | 都有 |
| 成品：在真正的 `TODO.md` 上跑 `node scripts/todo-check.js` exit 0，`## Needs a decision` 底下沒有條目；`node scripts/docs-check.js` exit 0；`node scripts/map.js` 把 `docs/improvement-brief.md` 列在 planned, not built | 27 條 | 0 條 |

## 對照 map

- `docs/registry.md` 是 current，裡面寫 `moves` 是兩個元素，`usage` 也沒有 `wakes`。第 2、3 段會一併改這一頁，不是牴觸。
- planned, not built 只有 `docs/plans/2026-09-09-design-class-prompt.md`，跟本設計無關。
- 其他 current 頁面跟本設計都不牴觸。

## 還沒核實

- N14 多印那一行，能不能讓 `stage-skip-said` 的 `says-which-stages-skipped` 過關：要花錢實際跑 eval 才知道。

## 已拍板（2026-09-17，design 關卡）

- A（N04、N06）：在 SessionEnd 另存關卡摘要（推薦的是只以 transcript 為紀錄，使用者沒有採用）。
- B（N10）：eval 不進 CI，發版前手動跑。
- C（N27）：任務進行中，fankeel 勝過別的外掛的流程 skill。
