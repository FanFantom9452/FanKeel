---
status: design-intent
---

# workflow-gaps：judge 的十筆，核對後全部修掉 — Design

來源是 [2026-10-10-workflow-gaps.md](../judgements/2026-10-10-workflow-gaps.md) 的十筆。survey 逐筆開檔核對過：八筆屬實，兩筆部分屬實（「九份 One path 段落要有人比對」其實已經漂移成四種寫法；「design 的檔案表一律寫成檔」的嚴重度比 judge 寫的低，因為 `next` 行每回合都注入）。使用者在 survey 的關卡選了十筆全做。

class 為 bounded：十筆都改既有流程，沒有前端，沒有新的對外介面。route 是 `survey,plan,build,verify,land`，沒有 design 站，所以這一頁由 plan 站寫。

`lib/stages.js` 的規則被許多頁面用 `path:line` 引用，所以 §3 只在原行上改字，不增減行數。注入塊另有 2400 字元的上限（`tests/render.test.js`），land 與 verify 今天各剩不到 10 個字元，所以 §3 的兩條規則寫得比原句短，§6 不加注入規則而改由 script 提醒。

## 1. suite 紀錄保留每一次執行

- `lib/suite.js` 的 `record` 不再覆寫：`suite.json` 的頂層仍是最後一跑，`blocker` 讀的欄位不變；另加 `runs` 陣列，依序保存這個任務的每一跑（每筆不含 `runs` 自己），最多留最後 20 筆。
- `lib/suite.js` 新增並匯出 `redBefore(rec)`：回傳最後一跑之前每一筆 `ok !== true` 的 `{ run, sha, failed }`，`run` 從 1 起算；沒有 `runs` 的舊紀錄回空陣列。
- `task.js land` 成功時，`redBefore` 每回一筆就在輸出多一行 `suite: green on run <N>; red on run <n> — <failed 以 ", " 相接>`；那一筆的 `failed` 是 null 或空陣列時，名字的位置寫 `no names recorded`。
- `skills/fankeel-land/SKILL.md` 步驟 1 補一句：先紅後綠時，紅過的測試名在 `task.js land` 的輸出，照抄到報告的 `suite:` 行。

## 2. `suite.js --check`

- `scripts/suite.js --session <id> --check` 不跑測試、不寫檔：`blocker` 回 null 且有紀錄時印 `suite: record stands @ <sha8>`，exit 0；`blocker` 回 null 而沒有紀錄時印 `suite: no suite to run`，exit 0；`blocker` 回一句話時印 `suite: <那句話>`，exit 1。

## 3. verify 也用 suite.js 記錄

- verify 的第一條規則改成 ``Run `node {{SUITE}} --session <id>`, quote it.``，所以 verify 那一跑留下紀錄。
- land 的 `Output:` 規則改成 ``Output: `node {{SUITE}} --session <id> --check` first; red stops; shipped, cost, open, question.``；「`--check` 拒絕時才整套重跑」寫在 land skill 步驟 1。
- `skills/fankeel-verify/SKILL.md` 與 `skills/fankeel-land/SKILL.md` 步驟 1 各補一句說同一件事：verify 的紀錄還站得住時 land 不重跑，由 `--check` 說。
- 兩條規則改完後，verify 與 land 的注入塊仍在 2400 字元以內，`lib/stages.js` 的行數不變，`skills/registry.json` 用 `node scripts/stage-registry.js` 重新產生。

## 4. 發版先改版號再跑 suite

- `scripts/version.js <x.y.z>` 設定成功、而且真的改寫了 manifest 時，輸出的最後多一行 `suite: the manifests changed — run suite.js again before task.js land`。
- `skills/fankeel-land/SKILL.md` 步驟 1 補一句：這次是發版時，先做步驟 2a 設好版號並提交，再跑這一步。

## 5. 在 base 上提交不記成 merge

- `task.js land merge` 在三件事都成立時記成 `integration: 'direct'`：條目沒有登記 worktree、suite 紀錄沒有 `tree`、專案根目前的分支就是 base。輸出是 `fankeel — land: direct (already on <branch>, nothing to merge)`，後面照舊接 push 的字樣。
- 「目前的分支就是 base」的定義：`git symbolic-ref --quiet --short HEAD` 成功、名字不以 `fk/` 開頭，而且等於 `refs/remotes/origin/HEAD` 指的分支；沒有那個 ref 時，名字是 `main` 或 `master`。
- `direct` 也可以直接打：`LAND_VERBS` 多一個 `direct`。`lib/profile.js` 的 `suggest` 統計過去的 land 紀錄時不計 `direct`，因為 `land.integration` 的合法值只有 `merge`、`pr`、`keep`。
- `skills/fankeel-land/SKILL.md` 步驟 6 與步驟 7 各補一句：已經在 base 上就沒有東西可 merge，`task.js land merge` 會記成 `direct`，步驟 7 只剩 push 與否。

## 6. design 的檔案表一律寫成檔

- `task.js stage build` 在三件事都成立時多印一行 `design.md is missing — Write the approved file table to <path> before building; build reads its denominator there after a compaction.`：這一步是從 design 到 build、route 上沒有 plan、design 的 handoff 檔不存在。`<path>` 相對於 registry 根、用正斜線。三件事有一件不成立就不印。
- `lib/stages.js` 的 `DESIGN_TO_BUILD` 與 `rulesFor` 不動：把那條規則對每條 bounded route 都注入，在 `design.mockup` 開著時會讓 design 的注入塊到 2534 字元，超過上限。
- `hooks/compact.ts` 的 `instructionsFor` 多一行 `- the design.md and context.md paths under .fankeel/build/, when the conversation named them`。
- `skills/fankeel-build/SKILL.md` 講沒有 plan 的路線那一段改寫：檔案表在 `.fankeel/build/task-<started>/design.md`，受控的 build 由 design 的規則寫出，其他情況由 `task.js stage build` 提醒，壓縮之後從那裡讀回分母。

## 7. 主控看得到 context.md

- 主 session 的注入塊在任務有 `context.md` 且裡面至少一行事實時多一行 `facts: <相對於 registry 根的路徑> (<n>)`，`n` 是檔案裡以 `- ` 開頭的行數；只給路徑，不貼內容。
- 沒有 `context.md`、或檔案裡沒有事實行時，不出現這一行。回答問題之後送回的那一塊與 prompt 前的那一塊走同一個 builder，所以兩邊一致。

## 8. pipeline 頁的規則引文

- `tests/pipeline-doc.test.js` 多一條測試：`rulesFor('build', …)` 的每一條（`{{NEXT}}` 代 `verify`，腳本 token 代成 `<plugin>/scripts/<name>.js`）與 build 模板的每一行，都要一字不差出現在 `docs/02-architecture/pipeline.md` 的 fence 裡。
- `docs/02-architecture/pipeline.md` 的那個 fence 補到與 `lib/stages.js` 一致，`last_verified` 改成 2026-10-10。

## 9. One path 段落收斂

- `skills/fankeel-audit/SKILL.md` 與 `skills/fankeel-survey/SKILL.md` 的 `One path, never a search` 那一條拿掉句尾的 `The injected rule says the same thing in one line.`，與 build、design、land、plan、verify、ask 六份逐字相同。
- `skills/fankeel-init/SKILL.md` 的那一條換成同一段文字，所以 init 也帶著「registry 根的 `package.json` 名為 `fankeel` 時用工作樹的腳本」這個例外。

## 10. skills-check 比對 One path 段落

- `scripts/skills-check.js` 的 `run` 對每份含 `**One path, never a search.**` 的 `SKILL.md` 取出那一條（從該行到下一個以 `- **` 開頭的行之前），把空白壓成單一空格後比對；與多數不同的每一份回一筆 finding，沿用現有的 finding 形狀，印出來是 `one-path: <檔案>:<行>  differs from the <n> that agree`，`skills-check.js` 因此 exit 非零。
- 九份都相同時沒有這種 finding。

## 11. 未受控站的 gate 也檢查選項數

- `hooks/gate.js` 在站未受控時多一個檢查：第一題的選項少於三個，而且第一個選項的 label 含有 route 上的下一站名（不分大小寫、整字比對；route 的最後一站則看 `down` 或 `收工`），就發 `systemMessage`：`fankeel: this gate has <n> options — three at least, never dropping the pause.`。
- 只發訊息，不 deny：問題照常送出，`gateOpen` 的時間戳不受影響。同一次已經有 `gate not confirmed` 的訊息時，兩句以一個空格相接。
- 選項有三個以上、或第一個選項沒有點名下一站（站中途的一般提問）時，不發這一句。

## 12. 受控站擋主控的 shell 寫檔

- `hooks/guard.js` 的 shell 分支多一條：主執行緒（沒有 `payload.agent_id`）、站受控、`writesFiles(command)` 為真時 deny，理由是 `fankeel: <stage> is a controlled stage — this command writes to disk, and its stage agent does the writing here, not the controller. Dispatch it, relay a path, ask.`。排在 `emitCommit` 之前。
- 讀不到 profile 時照舊放行。唯讀指令、以及主控本來就要跑的 `node <plugin>/scripts/task.js … 2>&1 | head -40`、`node <plugin>/scripts/await.js --session <id>`、`node <plugin>/scripts/commit.js <file>` 都照常通過。
- 站未受控時這一條不作用。

## What proves it done

| test | how |
|---|---|
| 先紅後綠兩筆都留著 | `tests/suite.test.js`：對同一個條目 `record` 一筆紅的再一筆綠的，`readRecord` 的頂層是綠的那筆、`runs.length` 是 2，`redBefore` 回一筆、帶第一跑的 `failed`。現在是紅的。 |
| land 印出紅過的測試名 | `tests/task-control.test.js`：先紅後綠之後跑 `task.js land merge`，輸出含 `suite: green on run 2; red on run 1 — ` 與那個測試名。 |
| `--check` 不跑測試 | `tests/suite.test.js`：有綠燈紀錄時 `main([... '--check'])` 回 `suite: record stands @ `、`ok` 為 true，`suite.json` 的 mtime 與內容不變；紀錄之後有 code 變更時 `ok` 為 false。 |
| verify 與 land 的規則點名 suite.js | `tests/stages.test.js`：verify 的規則含 `{{SUITE}}`，land 的規則含 `--check`；`tests/render.test.js` 的上限測試與 `tests/stage-registry.test.js` 仍然是綠的。 |
| 設版號後提醒重跑 | `tests/version.test.js`：改寫了 manifest 的那次設定，輸出最後一行是 `suite: the manifests changed — run suite.js again before task.js land`。 |
| 在 main 上記成 direct | `tests/task-control.test.js` 與 `tests/profile.test.js`：在 `main` 上、沒有 worktree 時 `task.js land merge` 的輸出以 `fankeel — land: direct` 開頭、條目的 `land.integration` 是 `direct`；切到 `fk/x` 分支時仍是 `merge`。`suggest` 對三筆 `direct` 不建議 `land.integration`。 |
| bounded 進 build 時提醒寫 design.md | `tests/context-facts-required.test.js`：route 沒有 plan、design.md 不存在時 `task.js stage build` 的輸出含 `design.md is missing`；檔案存在時沒有；route 有 plan 時沒有。`tests/compact.test.js` 斷言壓縮指令含 `design.md and context.md`。 |
| 注入塊帶 facts 行 | `tests/render.test.js`：有兩行事實的 `context.md` 時輸出含 `facts: .fankeel/build/task-` 與 `(2)`；沒有檔時不含 `facts:`。 |
| pipeline 頁與 build 規則一致 | `tests/pipeline-doc.test.js` 新的那條在改頁面之前是紅的（缺 `task.js intends`、`At close: suite, then docs-check`、`docs-check:`），改完是綠的。 |
| 九份 One path 一致，改一個字會被抓到 | `tests/skills-cli.test.js`：fixture 裡三份 `SKILL.md`、其中一份改一個字，`run` 回一筆 `one-path:` finding 指名那一份；三份相同時沒有。對真正的 repo 跑 `node scripts/skills-check.js` exit 0。 |
| 未受控站的兩選項 gate 有訊息 | `tests/gate.test.js`：未受控的 `build` 站、兩個選項、第一個 label 是 `verify (Recommended)`，輸出的 `systemMessage` 含 `this gate has 2 options`，沒有 `permissionDecision: deny`；三個選項時沒有這一句；label 不含下一站時沒有這一句。 |
| 受控站主控的 `sed -i` 被拒 | `tests/guard.test.js`：受控站、沒有 `agent_id`、指令 `sed -i s/a/b/ x.js` 得到 deny 與 `is a controlled stage`；`git status`、`node scripts/task.js show --session x 2>&1 \| head -40` 沒有 deny；未受控站同一條 `sed -i` 沒有 deny。 |

## Files

| file | change |
|---|---|
| `lib/suite.js` | `record` 累加 `runs`，新增 `redBefore` |
| `scripts/suite.js` | `--check` |
| `scripts/task.js` | `cmdLand`：紅過的那幾行、`direct`；stage 指令的 design.md 提醒 |
| `lib/profile.js` | `suggest` 不計 `direct` |
| `scripts/version.js` | 設定成功後的提醒行 |
| `lib/stages.js` | verify 與 land 的規則 |
| `skills/registry.json` | 重新產生 |
| `hooks/compact.ts` | `instructionsFor` 多一行 |
| `lib/render.js` | 主塊的 `facts:` 行 |
| `hooks/gate.js` | 未受控站的選項數訊息 |
| `hooks/guard.js` | 受控站主控的 shell 寫檔 |
| `scripts/skills-check.js` | 比對 One path 段落 |
| `skills/fankeel-land/SKILL.md` | 步驟 1、6、7 的幾句 |
| `skills/fankeel-verify/SKILL.md` | suite.js 的一句 |
| `skills/fankeel-build/SKILL.md` | design.md 的一句 |
| `skills/fankeel-audit/SKILL.md` | One path 收斂 |
| `skills/fankeel-survey/SKILL.md` | One path 收斂 |
| `skills/fankeel-init/SKILL.md` | One path 收斂 |
| `docs/02-architecture/pipeline.md` | build 規則的 fence |
| `tests/suite.test.js` | 上表對應那一列的測試 |
| `tests/task-control.test.js` | 上表對應那一列的測試 |
| `tests/stages.test.js` | 上表對應那一列的測試 |
| `tests/version.test.js` | 上表對應那一列的測試 |
| `tests/profile.test.js` | 上表對應那一列的測試 |
| `tests/context-facts-required.test.js` | 上表對應那一列的測試 |
| `tests/compact.test.js` | 上表對應那一列的測試 |
| `tests/render.test.js` | 上表對應那一列的測試 |
| `tests/pipeline-doc.test.js` | 上表對應那一列的測試 |
| `tests/skills-cli.test.js` | 上表對應那一列的測試 |
| `tests/gate.test.js` | 上表對應那一列的測試 |
| `tests/guard.test.js` | 上表對應那一列的測試 |

## Unverified

- 沒有實際走一次發版來重現 `task.js land` 因版號變更而拒絕；§4 是照 `lib/suite.js` 的 `blocker` 讀出來的。
- registry 的 `gates` 資料裡「少於三個選項」的 134 次，有多少是站尾的 gate、多少是站中途的提問，沒有分開數；§11 用「第一個選項點名下一站」來分，這個判斷本身沒有拿那份資料回測。
- `writesFiles` 對主控常用指令的誤判率沒有量過；§12 只保證列出的那三條通過。已知：受控站的主控直接下 `git commit` 會被拒（要走 `commit.js`），指令的引號裡出現 `rm`、`mv`、`cp`、`tee` 這幾個字也會被擋。
- `facts:` 行約 58 個字元，沒有任何上限測試量到帶 `context.md` 的注入塊；bounded 的 design 塊今天 2389 字元，加上它會超過 2400。上限只在測試裡，執行時不擋。
