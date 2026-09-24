---
status: current
---

# TODO 全清（第二輪）Implementation Plan

**Goal:** 把 `TODO.md` 這次處理的七條做掉：build 改成依賴滿足就派（ready-queue）、plan 多一種 `**Dispatch:** user`、`await.js` 改讀派工當下蓋上的 lap、profile 多一族 `prompt.<stage|all>`、兩個最慢的測試檔拆開，外加兩件使用者親手的事（station 回放逐塊調、記憶瘦身），ADR 只記一條 TODO。
**Architecture:** 九個 task。Task 1、2 在 `lib/plantasks.js` 加 `ready()` 與 `**Dispatch:**` 的解析，`scripts/ledger.js` 加 `ready`、`hands` 兩個動詞，`task.js stage build` 把使用者親手的 task 當場印給握有 `AskUserQuestion` 的 session。Task 3 把 build 迴圈、brain 的提交節奏與 plan 的第三種 Dispatch 寫進 skill、agent 檔與 brain 的 brief。Task 4 讓 `markInflight` 記下 brief 用的 lap、`await.js` 照它盯檔。Task 5 加 `prompt.*` 鍵並在四個注入點附上。Task 6 拆測試檔、把固定 900ms 換成輪詢。Task 7 收文件、TODO 與量測秒數。Task 8、9 是 `Dispatch: user`，由握有 `AskUserQuestion` 的 session 帶使用者做。
**Tech Stack:** Node.js（本機 v24.9.0），CommonJS，`'use strict'`；測試 `node --test`（`package.json` 的 `"test": "node --test"`）；零 npm 依賴；Claude Code 2.1.281。
**Spec:** [2026-09-24-todo-clear-design.md](2026-09-24-todo-clear-design.md)

## Global Constraints

由 `node scripts/map.js --print`（277 份 markdown：127 current、6 planned、136 retired、8 undeclared）、`.fankeel/map.md`、`CONTRIBUTING.md`、`package.json`、`.fankeel/profile.json` 與測試檔取得。本 repo 沒有 `CLAUDE.md`，也沒有 `AGENTS.md`（`CONTRIBUTING.md` 第一段）。

- 測試是 `tests/*.test.js`，`node --test` 執行。派出去的 implementer 只跑自己 task 寫的那幾個測試檔，不跑整套；整套 `npm test` 由 parent 在提交之前跑（唯一例外寫在 Task 7 第 6 步，並說明為什麼）。
- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`；不加。只用 Node 內建模組。
- 每個匯出的名字都要有別的檔 import 它（`tests/source.test.js:117` 的 `every exported name is imported by something`）；新檔先 `git add`，`tests/source.test.js` 讀的是 `git ls-files`。這份計畫新增的測試檔：`tests/hands.test.js`（Task 2）、`tests/station-serve.test.js`、`tests/station-post.test.js`、`tests/task-control.test.js`（Task 6）。
- `lib/` 不 require `scripts/` 或 `hooks/`，只有反方向（`CONTRIBUTING.md` 的 Core logic 列）。
- 每個 hook 在每條路徑都 exit 0：`hooks/*.js` 經 `lib/hook.js` 的 `run(main)` 執行；`hooks/brief.js` 的 `markInflight` 呼叫留在它原本的 try/catch 裡。
- 這個 build session 跑的 hook、注入規則與 brain 的 brief 是**已安裝的 0.79.0**，不是工作樹：Task 2–5 改的 `hooks/brief.js`、`lib/render.js` 要等插件更新、新開 terminal 才生效。證據是測試，不是本 session 看到的注入。scripts 例外：`skills/fankeel-build/SKILL.md` 說 registry 根的 `package.json` 名為 `fankeel` 時跑工作樹的 scripts，所以 Task 1 落地後 `ledger.js ready` 就能用。
- 本 repo 的 `.fankeel/profile.json` 有 `"stage.agents": ["survey", "build", "verify"]`：build 由 `fankeel-brain` 跑，它沒有 Edit；主控在受控站也被 guard 擋掉 Edit／Write。Task 8、9 需要改檔的地方一律派 implementer。
- 縮排照檔案自己的：`lib/`、`hooks/`、`scripts/` 是 4 格；`tests/plantasks.test.js`、`tests/ledger.test.js`、`tests/render.test.js`、`tests/brief.test.js`、`tests/skills.test.js`、`tests/task.test.js` 是 2 格；`tests/await.test.js`、`tests/profile.test.js`、`tests/station-cli.test.js`、`tests/station.test.js`、`tests/station-wizard.test.js` 是 4 格。新檔照它從哪個檔拆出來或最像哪個檔。測試的暫存目錄一律從 `tests/tmp.js` 拿。
- 注入上限，不准調高：每個 stage 的 block 在參考根目錄（59 字元）下小於 2400 字元（`tests/render.test.js:482` 的 `no stage’s rules cost more than a readable preamble`，與 `:698` 的受控版）；init block 小於 1400（`:548`）；站 agent 的 brief 小於 10000 字元（`tests/brief.test.js:261`）；skill 的 frontmatter `description` 小於 500 字元（`tests/skills.test.js:82`）。`prompt.*` 只在設了值時才加行，上面幾條的 fixture 都沒設，所以不動它們。
- `skills/registry.json` 要等於重新產生的結果（`tests/stage-registry.test.js:21`）。它讀 `lib/stages.js` 的規則、每份 stage skill 的 `**Done when**` 第一句與 `render()` 的位元組數；這份計畫不動 `lib/stages.js`、不動任何 `**Done when**`、`render()` 在沒設 `prompt.*` 時輸出不變，所以預期不變，Task 3 與 Task 5 仍各跑一次那個測試。
- `tests/skills.test.js:428` 的 `fankeel-build: every ledger mention sits inside a paragraph that names the no-plan reader`：`skills/fankeel-build/SKILL.md` 裡含 `ledger.js`、`groups`、`brief` 的段落（以空行分段），要嘛也含 `no plan`／`without a plan`／`file table`／`spike` 其中之一，要嘛逐字列在 `tests/skills.test.js:30` 的 `KNOWN_LEDGER_PARAGRAPHS`（比對段落第一行前 60 字元）。縮排的程式碼段落也算一段。
- `tests/skills.test.js:843`：`skills/fankeel-plan/SKILL.md` 的 `Four rules about that line:` 底下要剛好四條編號規則。
- 站頁精靈：`tests/station-wizard.test.js:52` 斷言摘要 12 列、等於傳進去的鍵數；`tests/station.test.js:160` 斷言 `serialize()` 帶的 `profileKeys` 整份等於 `lib/profile.js` 匯出的那張表。
- 文件裡帶引文的 `path:line` 要在那一行找得到引文（`node scripts/docs-check.js`）。已知會移位、由 Task 7 統一照 docs-check 印的修：`docs/subagents.md` 引 `lib/profile.js:36`、`:89`、`:90`、`:92`、`:98`（Task 5 在 `KEYS` 加八行、在 `parseValue` 前加一個函式）；`skills/fankeel-survey/SKILL.md` 引 `scripts/task.js:1183`（Task 2、5 在它前面加行）。Task 4 動 `docs/registry.md` 時自己跑 docs-check。
- `TODO.md`：一條不超過 200 字元（`scripts/todo-check.js:49` 的 `MAX_ENTRY_CHARS = 200`）；`## Ready` 與 `## Needs a decision` 空著是合法的；`## Waiting` 的 `### <timing>` 標題不超過 28 欄（CJK 算兩欄），下一行 `lifts when: <事件>. MM-DD.`，戳記放最後。每個動 `TODO.md` 的 task 結束時 `node scripts/todo-check.js` exit 0。
- 工作樹裡這些檔是 CRLF（`.gitattributes` 是 `* text=auto eol=lf`）：`TODO.md`、`docs/*.md`、`skills/*/SKILL.md`、`lib/*.js` 都是。用 Edit 改，不用會改行尾的工具重寫整份；Python 寫檔要 `newline=''`。新檔用 Write 即可。
- 版本號只由 `scripts/version.js` 動；這份計畫不動版本。
- `.fankeel/map.md` 列為 planned、not built 的六頁不當成已存在的系統引用。
- `.fankeel/build/` 被 `.fankeel/.gitignore` 排除：量測輸出放 `.fankeel/build/2026-09-24-todo-clear/`，不提交，`git ls-files` 看不到。
- 提交用 `git commit -o <paths>`，只收自己的檔；主旨 `<type>: <繁體中文摘要>`（`fix`、`docs`、`feat`、`test`、`refactor`、`chore`）；訊息結尾一行 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`。不 push。
- 文件散文：`docs/*.md`、`skills/*/SKILL.md`、`agents/*.md` 的既有英文頁照英文寫，繁體中文頁照繁體中文；程式概念用程式裡的名字，不翻。
- Windows：不 `find /`；含反斜線或超過 100 行的內容用 Write／Edit，不用 heredoc。Playwright MCP 每次瀏覽都會在 repo 根目錄留下 `.playwright-mcp/`，提交前刪掉。

## 起草時查到、設計沒寫到的事

- **成功標準第一條的 `ready([1], …)`。** 設計寫它回傳 `[2]`，但 §1 的定義（尚未完成、且每個與它衝突的較早 task 都已完成）在 3、4 都沒完成時會回傳 `[2, 3, 4]`。`[2]` 是「完成 1 之後新放出來的」。Task 1 照定義實作，測試兩個都斷言：`ready([1])` 是 `[2, 3, 4]`，減掉 `ready([])` 是 `[2]`。brain 自己減掉已經派出去的。
- **索引豁免只給 `ready()`。** 直接改 `conflict()` 會讓 `groups()` 的輸出變，`tests/ledger.test.js:250` 的 `groups warns when nothing can run beside anything, and names the shared file` 就是三個 task 共用 `TODO.md`，會紅；設計同時說 `ledger.js groups` 的輸出不變。所以 `conflict(a, b, exempt)` 多一個選填參數，只有 `ready()` 傳 `INDEX_FILES`。
- **§2 的「先寫一份只有 gate 的 handoff」在受控 build 走不通。** 主控規則（`lib/stages.js:642`）對 option one 一律跑 `task.js stage <word>`，而 handoff 的 gate 驗證（`lib/handoff.js:179-190`）要求 option one 點名一個 route 上的 stage；`task.js stage build` 在已經是 build 時還會再蓋一筆 `moves`（`registry.stampEntry`），正是 §3 那三次誤報的觸發點。所以問法改由 `task.js stage build` 的輸出當場印給握有 `AskUserQuestion` 的 session（受控時是主控，不受控時就是那個 session，兩種一樣），它當場問、用 `task.js note` 記下答案——notes 每輪都注入在 `so far:`，一直到 build 的 gate 前都看得到。時間點、選項與「由主控在 stage agent 的 task 做完之後、gate 之前做」照設計。Task 2 做輸出，Task 3 寫規則。
- **受控 build 的主控改不了檔。** guard 在受控站擋主控的 Edit／Write（`docs/subagents.md` 的 guard 段），brain 也沒有 Edit。所以 Task 3 的規則寫明：使用者 task 裡要改檔的步驟派 implementer；Task 8 本來就逐則派，Task 9 的記憶修改也派。
- **`station-cli.test.js` 與 `task.test.js` 沒有 `describe`。** 兩個檔都是平鋪的 `test(...)`。Task 6 照主題拆：station 分成 CLI、serve 生命週期、POST 路由三檔；task 在第 939 行切成兩檔。每個 test 逐字搬，只改 `:254` 那一個（固定 900ms 換輪詢）。
- **900ms 不能換成 HTTP 輪詢。** `serve()` 的 idle timer 在每個請求上重設（`scripts/station.js:338` 的 `touch()`），打 `station/health` 會讓它永遠不 idle。改用 `net.connect` 探 port：只開 TCP 不送請求，不碰 timer；port 關掉的那一刻就是 idle 觸發了，子行程還活著才印 `SURVIVED`。比原本多證明一件事（timer 真的觸發過），而且觸發就結束，不等滿 900ms。
- **`+~N tok` 的三個數字不會逐字相等。** `estimateTokens` 是寬字元數加上 `ceil(其他字元 / 4)`，每次呼叫各自進位。注入的是 `'\n  - ' + 句子`，所以 CLI 印的 N 取 `estimateTokens('\n  - ' + 句子)`；注入前後整個 block 的差是 N 或 N−1（ASCII 在兩次呼叫裡的進位差）。只拿「那句」本身算會少掉前綴的 1–2 tok。Task 5 的測試照這個斷言，不假裝三者相同。
- **`KEYS` 也是站頁精靈的欄位表。** `lib/station.js:610` 把 `profile.KEYS` 整份送進頁面，摘要一鍵一列。設計說精靈不加欄位，所以 Task 5 匯出 `WIZARD_KEYS`（去掉 `prompt.*`）給 `lib/station.js`，並改兩個斷言表的測試。
- **參考根目錄 59 有三份。** `tests/reference-size.js`、`lib/stage-registry.js` 各寫一次 59，Task 5 的 CLI 又要一份。Task 5 把 `REFERENCE_ROOT` 與 `sizeAtReference` 搬進 `lib/render.js`，另外兩處改成 import。
- **整套秒數需要安靜的工作樹。** 拆檔前後的整套時間與逐檔序列時間，只有在沒有鄰居在改檔時量才有意義；Task 6 的 implementer 只量自己的五個檔。整套量測移到 Task 7：它的 `Read:` 讓它排在每個派出去的 task 之後，所以跑的時候樹是靜的。「之前」在 `a8bce07e`（這份計畫之前的 HEAD）的拋棄式 worktree 裡量。所以 `docs/development.md` 在 Task 7，不在 Task 6。
- **TODO 由交付的 task 關。** 七條裡五條由 Task 7 一次關（它們的程式在 Task 1–6）；station 回放由 Task 8、記憶瘦身由 Task 9 各自關，使用者選「跳過」時那條就留著。
- **`git mv` 會打斷一條連結。** `docs/decisions/2026-09-24-optimise-own-first.md:10` 連到 `../plans/2026-09-24-todo-sweep-design.md` 與 `-sweep.md`；Task 7 搬檔時一起改成 `../archive/`。
- **brain 的提交節奏有四處寫著「一組一次」。** `lib/render.js:470`（brief）、`agents/fankeel-brain.md:21`、`skills/fankeel/SKILL.md:1139-1140`、`docs/subagents.md` 三處；`tests/brief.test.js:389`、`:600-611` 斷言舊句子。前三處與測試在 Task 3，文件在 Task 7。
- **使用者 task 擋住後面依賴它的 task。** `ready()` 把沒完成的 `user` task 當成還沒完成，後面與它衝突的 task 不會被放出來，而它要等所有派出去的 task 做完才跑。Task 3 在 plan skill 寫明：`user` task 放最後，沒有派出去的 task 可以依賴它。

## Coverage

| promise | task |
|---|---|
| `lib/plantasks.js` 新增並匯出 `ready(tasks, done)`：回傳尚未完成、且每個與它 `conflict()` 的**較早** task 都已在 `done` 裡的 task，照 plan 順序。`groups()` 與 `surfaces()` 保留不動，`ledger.js groups` 的輸出不變。 | Task 1 |
| `conflict()` 的 `files` 判斷把索引檔排除：`TODO.md` 與 `docs/README.md`（常數 `INDEX_FILES`，相對於 plan 所在 repo 的根）兩個 task 都列它們時不算撞檔。`read` 與 `interface` 兩種衝突照舊。 | Task 1（只在 `ready()` 傳入時排除；見「起草時查到」第二條） |
| `scripts/ledger.js` 新增 `ready` 動詞：讀 ledger 的完成集合，印出現在可以派的 task 編號，一行一個；沒有就印 `none`。 | Task 1；Task 2 讓它不列 `user` task |
| `agents/fankeel-brain.md` 與 `skills/fankeel-build/SKILL.md` 的 build 迴圈改成：每收到一個 implementer 完成（含 review 通過），跑 `ledger.js ready`，把新的可派 task 在同一個回應裡派出去；提交請求在「沒有 implementer 在跑」時送出一次，涵蓋上次提交以來完成的所有 task。 | Task 3 |
| **不做 worktree**：每個 implementer 各開 worktree、由 brain merge，這次不做。`scripts/commit.js` 不認得 worktree（`docs/subagents.md` 的「在哪提交」接縫），brain 又不能 `git commit`，兩者都得先改。索引檔的豁免只靠 `Edit` 逐字比對：兩個 implementer 改同一個檔案的不同行時，後到的那次若 `old_string` 已變就會失敗重讀，不會蓋掉別人的改動。worktree 這一半改記成一條 `## Waiting`，lifts when: 共用樹上出現一次 implementer 互相蓋檔。 | Task 7（`## Waiting` 那條）；Task 3 把 `Edit` 的理由寫進 build skill |
| `**Dispatch:**` 多第三種形式：`user — <使用者要做什麼>`。`skills/fankeel-plan/SKILL.md` 的 Dispatch 段落與「no third form」那句一起改。 | Task 3；本計畫的 Task 8、9 用這個形式 |
| `lib/plantasks.js` 解析 `**Dispatch:**` 的第一個字（`implementer`／`in-session`／`user`），放進 task 物件的 `dispatch` 欄位。 | Task 2 |
| `scripts/ledger.js` 新增 `hands` 動詞：列出 `dispatch === 'user'` 的 task 編號與破折號後的說明；沒有就印 `none`。 | Task 2 |
| `lib/render.js:471` 判斷 implementer 的地方，把 `user` 也當成「不派 implementer」。 | Task 2 |
| build 開跑（brain 與 in-session 兩種都一樣）第一步跑 `ledger.js hands`；有列出東西時，先寫一份只有 gate 的 handoff，問使用者現在做、做完再回報、還是跳過，**不等** implementer 被擋住才回報。使用者親手的 task 由握有 `AskUserQuestion` 的那個 session 跑，也就是主控 session；時間點在 stage agent 的 task 都做完之後、build 的 gate 之前。 | Task 2（`task.js stage build` 印清單）、Task 3（規則）；gate-only handoff 換成當場問，見「起草時查到」第三條 |
| `lib/registry.js` 的 `markInflight` 多記一個 `lap`：`hooks/brief.js` 計算 brief 裡的 `commitPath` 時用的那個 N。 | Task 4 |
| `scripts/await.js` 盯檔時，`inflight.stage === data.stage` 且帶有 `lap` 的話就用這個 lap，否則照舊用 `lapOf(data, stage)`。 | Task 4 |
| 三次誤報是 `moves` 在派工之後又多出一筆 `build`，觸發點沒有找到；這個修法不管觸發點是什麼都讓兩邊一致。`tests/await.test.js` 補一個「重回 build」的 fixture。 | Task 4 |
| `lib/profile.js` 的 `KEYS` 新增 `prompt.all` 與 `prompt.<stage>`（七個 stage 各一），值是自由文字：新增一個 passthrough 的 parser，拒絕空字串與換行，長度上限 200 字元。 | Task 5 |
| 注入：`lib/render.js` 在 `rulesLines`（每輪）、`controlBlock`（主控）、`renderResume`（答完 gate）、`renderBrainBrief`（stage agent）四處，在 stage rules 最後附上 `prompt.all`，再附上 `prompt.<當下 stage>`，一句一行 `  - `。`renderBrief`（reader 等一般 subagent）不附：它們的回報給主控看，不給人看。 | Task 5 |
| `task.js profile set prompt.*` 設定時印出兩行：`+~N tok/輪`（`input-check.js` 的 `estimateTokens`）；以及附上這句之後，各 stage 的 rule 區塊大小對 2400 上限的餘裕，超過的 stage 名稱標出來。只警告，不拒絕。 | Task 5 |
| station 的設定精靈不加欄位，只能從 CLI 設定：精靈目前沒有自由文字的欄位型態，要加得另開一條。 | Task 5（`WIZARD_KEYS`） |
| `tests/station-cli.test.js`（序列跑 78 秒）照 describe 拆成三個檔，並把 `:259-260` 固定的 `setTimeout(r, 900)` 換成輪詢子行程的輸出。 | Task 6（沒有 describe，照主題拆；輪詢改探 port，見「起草時查到」） |
| `tests/task.test.js`（36 秒，約 100 次 spawn）照 describe 拆成兩個檔。 | Task 6 |
| `docs/development.md` 更新整套測試的秒數，寫上量測日期與方法。 | Task 7 |
| station 回放逐塊調：沿用封存的 todo-four 計畫 Task 8 的步驟（`docs/archive/2026-09-24-todo-four.md:2113`），`Dispatch: user`，在瀏覽器上跟使用者來回。 | Task 8 |
| 記憶瘦身：使用者跑 `/doctor`，前後各跑一次 `node scripts/input-check.js` 記下 tok 數；/doctor 留下而 `input-check` 仍然報出的重複、死連結、過大段落，由主控在記憶目錄裡修掉。repo 的程式碼不改。 | Task 9 |
| `TODO.md`：關掉這次處理的七條；`## Needs a decision` 新增〔docs〕ADR 機制一條（參考 Trovara 的 `docs/04-architecture/adr/`，不是每個 task 都呼叫，何時觸發待定），連結 `docs/documents.md`；`## Waiting` 新增 worktree 那一半（§1）。 | Task 7（五條、ADR、Waiting）；Task 8、9 各關一條 |
| `git mv` 把 `docs/plans/2026-09-24-todo-sweep-design.md` 與 `-sweep.md` 搬到 `docs/archive/`，`docs/README.md` 的索引狀態一起改。 | Task 7 |
| `docs/subagents.md`、`docs/registry.md`（`inflight.lap`）、`docs/pipeline.md` 中講到分批派工的句子，跟著 §1–§4 改。 | Task 7（subagents、pipeline）；Task 4（registry） |
| `tests/plantasks.test.js`：plan 裡 1、2 撞檔，3 與兩者無關，4 只和 1 共用 `TODO.md` → `ready([], …)` 回傳 `[1,3,4]`；`ready([1], …)` 回傳 `[2]`。改之前沒有 `ready`，測試紅。 | Task 1（`[2]` 讀成新放出的；見「起草時查到」第一條） |
| `tests/plantasks.test.js`：`**Dispatch:** user — 跑 /doctor` 解析成 `dispatch: 'user'`；`ledger.js hands` 印出這個 task。 | Task 2 |
| `tests/await.test.js`：`moves` 有三筆 `build`、`inflight: {stage:'build', lap:2}` → 盯的是 `build-2-commit.md`。改之前盯 `build-3`，紅。 | Task 4 |
| `tests/render.test.js`：profile 帶 `prompt.all='用繁體中文回答'` → `render()`、`renderResume`、`renderBrainBrief` 三者輸出都有這一行；`prompt.verify` 只出現在 verify。 | Task 5 |
| 產出物檢查：`profile set prompt.all …` 印出的 `+~N tok` 必須等於 `estimateTokens` 對那句的結果，也必須等於注入前後 block 的 tok 差。三個數字出自同一個來源，所以必須相同。 | Task 5（N 取注入的那一行；block 差是 N 或 N−1，見「起草時查到」） |
| 測試：拆檔之後，逐檔序列計時最慢的檔 < 40 秒；整套的時間前後各量一次，記在 `docs/development.md`。 | Task 6（拆檔）、Task 7（量測與紀錄） |

## Task 1: ready-queue

設計 §1 前三條與成功標準第一條。`ready()` 每次有 task 完成就重問一次，`groups()` 不動；索引檔的豁免只經 `ready()` 傳進 `conflict()`。

**Files:**
- Modify: `lib/plantasks.js` — `conflict()` 多一個選填的 `exempt`；新增 `INDEX_FILES` 與 `ready()`，匯出 `ready`
- Modify: `scripts/ledger.js` — `VERBS` 加 `ready`，新增 `ready` 分支
- Test: `tests/plantasks.test.js`
- Test: `tests/ledger.test.js`
- Read: `lib/ledger.js` — `completed(text)` 讀完成集合

**Interfaces:**
- Consumes: none
- Produces: `ready(input, done)` in `lib/plantasks.js` — `input` 是 plan 文字或 `parseTasks` 的結果，`done` 是完成的 task 編號陣列，回傳 `number[]`（plan 順序）；`conflict(a, b, exempt)` — `exempt` 是選填的路徑陣列；`ledger.js ready` 動詞，一行一個編號或 `none`

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 在 `tests/plantasks.test.js` 最後加上（檔頭已有 `task`、`readTask`、`parseTasks`、`conflict`、`groups`、`plantasks`）：

```js
// 2026-09-24: seven tasks, five rounds forced serial. A greedy group closes at
// the first conflict, and a task independent of the one that closed it waits
// for the next group anyway. `ready` is asked per task, every time one lands,
// and an index file is not a shared file there.
test('ready sends every task whose earlier conflicts are complete, and an index file is not one', () => {
  const text = task(1, ['lib/a.js', 'TODO.md'], [], [], [])
    + task(2, ['lib/a.js'], [], [], [])
    + task(3, ['lib/c.js'], [], [], [])
    + task(4, ['docs/d.md', 'TODO.md'], [], [], []);
  assert.deepEqual(plantasks.ready(text, []), [1, 3, 4]);
  assert.deepEqual(plantasks.ready(text, [1]), [2, 3, 4]);
  const released = plantasks.ready(text, [1]).filter((n) => !plantasks.ready(text, []).includes(n));
  assert.deepEqual(released, [2], 'what completing Task 1 releases');
  assert.deepEqual(plantasks.ready(text, [1, 2, 3, 4]), []);
});

test('the index exemption is ready()\'s alone: conflict() and groups() still count TODO.md', () => {
  const [a, , , d] = parseTasks(task(1, ['lib/a.js', 'TODO.md'], [], [], [])
    + task(2, ['lib/a.js'], [], [], [])
    + task(3, ['lib/c.js'], [], [], [])
    + task(4, ['docs/d.md', 'TODO.md'], [], [], []));
  assert.equal(conflict(a, d), 'files');
  assert.equal(conflict(a, d, ['TODO.md']), null);
  assert.deepEqual(groups([a, d]), [[1], [4]]);
});

test('ready still waits on a Read of a neighbour\'s file and on an interface edge', () => {
  const text = task(1, ['lib/a.js'], [], [], ['makeA'])
    + task(2, ['lib/b.js'], [], ['makeA'], [])
    + readTask(3, ['lib/c.js'], ['lib/a.js']);
  assert.deepEqual(plantasks.ready(text, []), [1]);
  assert.deepEqual(plantasks.ready(text, [1]), [2, 3]);
});

test('ready fails closed on a task with no Files block', () => {
  const [a] = parseTasks(task(1, ['lib/a.js'], [], [], []));
  const bare = { n: 2, name: 'x', modify: [], test: [], read: [], consumes: [], produces: [] };
  assert.deepEqual(plantasks.ready([a, bare], []), [1]);
  assert.deepEqual(plantasks.ready([a, bare], [1]), [2]);
});
```

2. 在 `tests/ledger.test.js` 最後加上（檔頭已有 `SCRIPT`、`root`、`fs`、`path`、`execFileSync`、`assert`）：

```js
// The loop asks this every time a task lands, so it prints nothing but the
// numbers: one a line, in plan order, or `none`.
test('ready prints the tasks that may go out now, one number a line, and none when nothing may', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '- Modify: `TODO.md`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '## Task 3: three', '', '**Files:**', '- Modify: `lib/c.js`', '- Modify: `TODO.md`', '',
  ].join('\n'));
  const cli = (...args) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' });
  cli('init');
  assert.equal(cli('ready'), '1\n3\n');
  cli('complete', '1', 'a.js');
  assert.equal(cli('ready'), '2\n3\n');
  cli('complete', '2', 'a.js again');
  cli('complete', '3', 'c.js');
  assert.equal(cli('ready'), 'none\n');
});

test('ready with no ledger yet says so, the way show does', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, ['## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', ''].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'ready'], { encoding: 'utf8' });
  assert.match(out, /none yet at .*Run `init` before the first task\./s);
});
```

3. 跑 `node --test tests/plantasks.test.js tests/ledger.test.js`，看新測試紅（`plantasks.ready is not a function`、`Verbs: …` 的拒絕訊息）。

4. 在 `lib/plantasks.js`，把 `conflict()` 的開頭到 `if (files.some(...)) return 'files';` 換成：

```js
// null when the pair may run at once; otherwise the predicate that refused it.
// `exempt` is paths that do not count as a shared file here — `ready()` passes
// `INDEX_FILES`, and nothing else passes anything, so `groups()` and every
// report built on it see the same conflicts they always did.
function conflict(a, b, exempt) {
    // Fail closed. A task that declared no files has no ownership to compare,
    // and reading "nothing declared" as "nothing shared" is how the one task
    // nobody checked runs beside the task it overwrites.
    if (!a.modify.length || !b.modify.length) return 'undeclared';
    const skip = Array.isArray(exempt) ? exempt : [];
    const own = (list) => (list || []).filter((p) => !skip.includes(p));
    const files = [
        [own(a.modify), own(b.modify)], [own(a.modify), own(b.test)],
        [own(a.test), own(b.modify)], [own(a.test), own(b.test)],
    ];
    if (files.some(([x, y]) => shares(x, y))) return 'files';
```

   `read` 與 `interface` 兩段照舊，用原始的清單，不經 `own`。原本在函式上方的那行 `// null when the pair may run at once; otherwise the predicate that refused it.` 被上面這段取代，不要留兩行。

5. 在 `lib/plantasks.js`，`groups()` 結尾的 `}` 之後、`// \`conflict()\` matches a backticked identifier` 那段註解之前，加上：

```js
// The index files every task may append a line to. Two implementers editing
// different lines of one of them do not overwrite each other: `Edit` matches
// its `old_string` exactly, so the second one to arrive after the first moved
// the text fails and re-reads. Relative to the root of the repository the plan
// lives in, the way every `Files:` path is.
const INDEX_FILES = ['TODO.md', 'docs/README.md'];

// Which tasks may go out now: not complete, and every earlier task each one
// conflicts with is. `groups()` answers once for the whole plan and closes a
// group at the first conflict, so a task that conflicts with nothing still
// waits behind the one that closed it; this is asked again every time a task
// lands. Only earlier tasks are compared, which keeps the plan's order the
// tie-break. Takes the plan's text or the tasks already parsed, like `groups`.
function ready(input, done) {
    const tasks = typeof input === 'string' ? parseTasks(input) : input;
    const complete = new Set((done || []).map(Number));
    return tasks
        .filter((t, i) => !complete.has(t.n)
            && tasks.slice(0, i).every((e) => complete.has(e.n) || !conflict(e, t, INDEX_FILES)))
        .map((t) => t.n);
}
```

6. 在 `lib/plantasks.js` 最後的 `module.exports` 裡，`groups,` 之後加 `ready,`。

7. 在 `scripts/ledger.js`，`VERBS` 改成：

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ready', 'scan', 'ranges', 'lint', 'brief', 'fix']);
```

8. 在 `scripts/ledger.js` 的 `main()`，`if (verb === 'groups') { ... }` 之後加上：

```js
    if (verb === 'ready') {
        // What the build loop sends next, asked again each time a task lands.
        // The completion set is this plan's own ledger, refused the way `show`
        // refuses one: none yet, or one belonging to another plan.
        const { contents, refusal } = readOwnLedger(root, opts);
        if (refusal) return refusal;
        const { text: planText } = readPlan(root, opts.plan);
        const open = plantasks.ready(plantasks.parseTasks(planText), ledger.completed(contents));
        return open.length ? open.join('\n') : 'none';
    }
```

9. 跑 `node --test tests/plantasks.test.js tests/ledger.test.js`，全綠；既有的 `groups warns when nothing can run beside anything, and names the shared file` 也綠（豁免沒漏進 `groups`）。每條新測試回報一個會讓它紅的 mutation，例如「`ready()` 不傳 `INDEX_FILES`」、「`ready()` 比對所有 task 而不只較早的」。

10. 提交（parent）：`git commit -o lib/plantasks.js scripts/ledger.js tests/plantasks.test.js tests/ledger.test.js`，主旨 `feat: plantasks.ready 與 ledger.js ready——依賴滿足就派，索引檔不算撞檔`。

## Task 2: Dispatch user

設計 §2 第二到第五條與成功標準第二條。`**Dispatch:**` 的第一個字進 task 物件；`ledger.js hands` 列出 `user` task；`ledger.js ready` 不列它們；`task.js stage build` 把清單印給握有 `AskUserQuestion` 的 session（取代設計的 gate-only handoff，理由見「起草時查到」第三條）；brain 的 brief 說 `user` task 不歸它。和 Task 1 共用 `lib/plantasks.js` 與 `scripts/ledger.js`，所以排在它後面。

**Files:**
- Modify: `lib/plantasks.js` — `parsePlan` 讀 `**Dispatch:**`，task 物件多 `dispatch`、`dispatchNote`
- Modify: `scripts/ledger.js` — `VERBS` 加 `hands`；新增 `hands` 分支；`ready` 分支濾掉 `user`；檔頭註解的動詞數
- Modify: `scripts/task.js` — 新增 `handsLines()`，`cmdStage` 進 build 時印出
- Modify: `lib/render.js` — `renderBrainBrief` 的 in-session 那行（今天第 471 行）加一句 `user`
- Test: `tests/plantasks.test.js`
- Test: `tests/hands.test.js`
- Test: `tests/brief.test.js`
- Read: `lib/docs.js` — `projectRootsFor`，`handsLines` 用它找專案根

**Interfaces:**
- Consumes: `ready(input, done)`（Task 1）
- Produces: `dispatch` 與 `dispatchNote` on every parsed task — `dispatch` 是 `**Dispatch:**` 第一個字的小寫（`'implementer'`、`'in-session'`、`'user'`），沒有那行時是 `null`；`dispatchNote` 是第一個 `—` 之後的文字；`ledger.js hands` 動詞，一行 `<n> — <說明>` 或 `none`；`handsLines(root, data)` in `scripts/task.js`

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 在 `tests/plantasks.test.js` 最後加上：

```js
test('the first word of a Dispatch line is the task\'s dispatch, and the text after the dash its note', () => {
  const body = (line) => [
    '## Task 1: name', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
    line, '',
  ].join('\n');
  const [user] = parseTasks(body('**Dispatch:** user — 跑 /doctor'));
  assert.equal(user.dispatch, 'user');
  assert.equal(user.dispatchNote, '跑 /doctor');
  assert.equal(parseTasks(body('**Dispatch:** implementer, sonnet — transcription.'))[0].dispatch, 'implementer');
  assert.equal(parseTasks(body('**Dispatch:** in-session — the user said so this session'))[0].dispatch, 'in-session');
  assert.equal(parseTasks(body('No dispatch line here.'))[0].dispatch, null);
  const fenced = parseTasks(body('```markdown\n**Dispatch:** user — an example\n```\n\n**Dispatch:** implementer, sonnet'));
  assert.equal(fenced[0].dispatch, 'implementer', 'a fenced example is not the task\'s own line');
});
```

2. 新增 `tests/hands.test.js`：

```js
'use strict';

// A task only the user can do — a slash command, a browser, an interactive
// probe — used to surface when a stage agent found itself blocked on it. It is
// declared now, `**Dispatch:** user — <what>`, never sent out, and said the
// moment build opens to the session that holds AskUserQuestion.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const LEDGER = path.join(__dirname, '..', 'scripts', 'ledger.js');
const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const SID = 'aaaaaaaa-1111-2222-3333-444444444444';

const PLAN = [
  '## Task 1: code', '', '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** implementer, sonnet — transcription.', '',
  '## Task 2: doctor', '', '**Files:**', '- Modify: `notes.md`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** user — 跑 /doctor', '',
].join('\n');
const WITHOUT_HANDS = PLAN.split('## Task 2')[0];

const ledgerCli = (dir, plan, ...args) => execFileSync(process.execPath, [LEDGER, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' });

// The same shape tests/task.test.js's `run` uses: --claude-dir and
// CLAUDE_CONFIG_DIR both point at a directory of this test's own, so no badge
// or liveness check reaches the machine's real config.
function taskCli(dir, args) {
  const cfg = path.join(dir, 'cfg');
  return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('ledger.js hands lists each user task with what the user does, and none when there are none', () => {
  const dir = tmp('fankeel-hands-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  assert.equal(ledgerCli(dir, plan, 'hands'), '2 — 跑 /doctor\n');
  fs.writeFileSync(plan, WITHOUT_HANDS);
  assert.equal(ledgerCli(dir, plan, 'hands'), 'none\n');
});

test('ledger.js ready never lists a user task, even once nothing holds it back', () => {
  const dir = tmp('fankeel-hands-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  ledgerCli(dir, plan, 'init');
  assert.equal(ledgerCli(dir, plan, 'ready'), '1\n');
  ledgerCli(dir, plan, 'complete', '1', 'a.js');
  assert.equal(ledgerCli(dir, plan, 'ready'), 'none\n');
});

test('entering build names the plan\'s user tasks and says to ask now; a plan with none adds nothing', () => {
  const dir = tmp('fankeel-hands-');
  taskCli(dir, ['start', '--session', SID, '--task', 'hands']);
  const plans = path.join(dir, 'docs', 'plans');
  fs.mkdirSync(plans, { recursive: true });
  fs.writeFileSync(path.join(plans, '2026-09-24-x.md'), PLAN);
  const out = taskCli(dir, ['stage', 'build', '--session', SID]);
  assert.match(out, /^hands — docs\/plans\/2026-09-24-x\.md:$/m);
  assert.match(out, /^  Task 2 — 跑 \/doctor$/m);
  assert.match(out, /Ask the user now, before the first dispatch/);
  assert.doesNotMatch(out, /Task 1 — /);
  fs.writeFileSync(path.join(plans, '2026-09-24-x.md'), WITHOUT_HANDS);
  assert.doesNotMatch(taskCli(dir, ['stage', 'build', '--session', SID]), /^hands/m);
});
```

3. 在 `tests/brief.test.js` 最後加上（檔頭已有 `tmp`、`seed`、`seedProfile`、`run`、`start`、`contextOf`）：

```js
test('a build brain is told a user task is not its to send', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const build = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(build, /One whose Dispatch line says user is not yours to send: `ledger\.js ready` never lists it, the controller runs it with the user after your report, and your report names it on a line `hands: <n>, <n>`\./);
});
```

4. `git add tests/hands.test.js`，跑 `node --test tests/plantasks.test.js tests/hands.test.js tests/brief.test.js`，看新測試紅。

5. 在 `lib/plantasks.js`，`const ENTRY = ...` 之後加：

```js
// A task's `**Dispatch:**` line. Its first word says who does the task — an
// `implementer`, this session (`in-session`) or the `user` — and the text after
// the first dash is what the plan says about it.
const DISPATCH = /^\*\*Dispatch:\*\*\s*(.*)$/;
```

6. 在 `lib/plantasks.js` 的 `parsePlan()`，task 物件字面值的 `interfaces: false,` 之後加 `dispatch: null, dispatchNote: '',`；再把 `if (!line) { block = null; continue; }` 之後加上：

```js
        // Only the first such line counts: a later one is prose quoting the
        // format, and a fenced example never reaches here at all.
        const dl = DISPATCH.exec(line);
        if (dl) {
            if (task.dispatch === null) {
                const word = /^([a-z][a-z-]*)/i.exec(dl[1]);
                task.dispatch = word ? word[1].toLowerCase() : '';
                const dash = dl[1].indexOf('—');
                task.dispatchNote = dash === -1 ? '' : dl[1].slice(dash + 1).trim();
            }
            block = null;
            continue;
        }
```

7. 在 `scripts/ledger.js`：檔頭註解第一句 `The ledger, from the command line. Ten verbs, because ten is what the build` 改成 `The ledger, from the command line. Twelve verbs, because twelve is what the build`，並在那段註解最後（`it in by hand.` 之後）加一行 `// \`ready\` and \`hands\` came on 2026-09-24: which tasks go out now, and which are the user's.`。`VERBS` 改成：

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ready', 'hands', 'scan', 'ranges', 'lint', 'brief', 'fix']);
```

8. 在 `scripts/ledger.js` 的 `main()`，把 Task 1 的 `ready` 分支整段換成下面兩段：

```js
    if (verb === 'ready') {
        // What the build loop sends next, asked again each time a task lands.
        // The completion set is this plan's own ledger, refused the way `show`
        // refuses one: none yet, or one belonging to another plan. A `user`
        // task is never sent, so it is never listed — `hands` lists it.
        const { contents, refusal } = readOwnLedger(root, opts);
        if (refusal) return refusal;
        const { text: planText } = readPlan(root, opts.plan);
        const tasks = plantasks.parseTasks(planText);
        const open = plantasks.ready(tasks, ledger.completed(contents))
            .filter((n) => tasks.find((t) => t.n === n).dispatch !== 'user');
        return open.length ? open.join('\n') : 'none';
    }

    if (verb === 'hands') {
        // The tasks whose Dispatch line reads `user`: the ones the session
        // holding AskUserQuestion runs with the user, after every dispatched
        // task and before build's gate.
        const { text: planText } = readPlan(root, opts.plan);
        const mine = plantasks.parseTasks(planText).filter((t) => t.dispatch === 'user');
        return mine.length ? mine.map((t) => t.n + ' — ' + (t.dispatchNote || t.name)).join('\n') : 'none';
    }
```

9. 在 `scripts/task.js`：`const { controlRulesFor, PLUGIN_MARK, PLUGIN_ROOT } = require('../lib/render.js');` 改成 `const { controlRulesFor, PLUGIN_MARK, PLUGIN_ROOT, newestPlan } = require('../lib/render.js');`，並在它下面加 `const plantasks = require('../lib/plantasks.js');`。在 `function cmdStage(` 之前加上：

```js
// The plan tasks the user does with their own hands: `**Dispatch:** user — …`.
// Said the moment build opens, to whichever session is running it — the
// controller when `stage.agents` names build, the session itself otherwise —
// because that is the one holding AskUserQuestion. A stage agent has no way to
// ask, and a gate in its handoff cannot carry this: option one of every such
// gate moves the stage. The answer goes into `note`, which rides every prompt
// until build's gate. docs/plans/2026-09-24-todo-clear.md, Task 2.
function handsLines(root, data) {
    const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
    const plan = newestPlan(projectRoot, data.started);
    if (!plan || plan.endsWith('-design.md')) return null;
    let text;
    try { text = fs.readFileSync(plan, 'utf8'); } catch (e) { return null; }
    const mine = plantasks.parseTasks(text).filter((t) => t.dispatch === 'user');
    if (!mine.length) return null;
    return ['hands — ' + path.relative(projectRoot, plan).split(path.sep).join('/') + ':']
        .concat(mine.map((t) => '  Task ' + t.n + ' — ' + (t.dispatchNote || t.name)))
        .concat(['Ask the user now, before the first dispatch: after the other tasks and before build\'s gate, in this session with them (Recommended); they do it first and say when; or skip, each becoming a TODO.md entry. Then `task.js note "hands: <the answer>"`.']);
}
```

10. 在 `scripts/task.js` 的 `cmdStage()`，`if (controller) line += NL + controller.join(NL);` 之後、`return line;` 之前加上：

```js
    if (name === 'build') {
        const hands = handsLines(root, data);
        if (hands) line += NL + hands.join(NL);
    }
```

11. 在 `lib/render.js` 的 `renderBrainBrief()`，把 `'` + profile.values['dispatch.floor'] + '` like any other: send it the task\'s brief.'` 那一行（今天第 471 行）的字串結尾 `send it the task\'s brief.'` 改成 `send it the task\'s brief. One whose Dispatch line says user is not yours to send: `ledger.js ready` never lists it, the controller runs it with the user after your report, and your report names it on a line `hands: <n>, <n>`.'`。

12. 跑 `node --test tests/plantasks.test.js tests/hands.test.js tests/brief.test.js tests/ledger.test.js`，全綠；`tests/brief.test.js` 裡既有的 `You have no Edit\. A task whose Dispatch line says in-session …` 斷言仍綠（新句接在後面）。每條新測試回報一個 mutation。

13. 提交（parent）：`git commit -o lib/plantasks.js scripts/ledger.js scripts/task.js lib/render.js tests/plantasks.test.js tests/hands.test.js tests/brief.test.js`，主旨 `feat: Dispatch user——plantasks 解析、ledger.js hands、進 build 當場列出`。

## Task 3: build 迴圈、提交節奏與第三種 Dispatch 寫進規則

設計 §1 第四條、§2 第一條與第五條的規則面。brain 的提交改成「沒有 implementer 在跑時送一次」，build 迴圈改成跟著 `ledger.js ready` 派，`user` task 的時間點寫進 build skill、plan skill 與主 skill。只動文字與斷言文字的測試。

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — 第 3 節 `groups` 那段的第一句；task loop 開頭的 no-plan 段與新的 hands 段；步驟 2 的兩段分批規則
- Modify: `skills/fankeel-plan/SKILL.md` — 「And it decides how they go out」那段；Dispatch 的形式從三種到四種；「no third form」那句；新增 `user` 段
- Modify: `skills/fankeel/SKILL.md` — 第 1139–1141 行的提交節奏，後面加一段 `user` task
- Modify: `agents/fankeel-brain.md` — `## Job` 的提交節奏與 `ready`；`## Return` 的一句
- Modify: `lib/render.js` — `renderBrainBrief` 的 build 提交那行（今天第 470 行）
- Modify: `skills/registry.json` — 只在 `node scripts/stage-registry.js` 重新產生後有差異時；預期不變
- Test: `tests/brief.test.js`
- Test: `tests/skills.test.js`
- Read: `scripts/ledger.js` — `ready`、`hands` 兩個動詞已存在
- Read: `scripts/task.js` — `handsLines` 印的那句問法，skill 照它寫

**Interfaces:**
- Consumes: `ready(input, done)`（Task 1）、`dispatch`（Task 2）、`handsLines(root, data)`（Task 2）
- Produces: none（規則文字）

**Dispatch:** implementer, sonnet — 每段新文字都在計畫裡，照抄；斷言跟著改。

步驟：

1. 在 `tests/brief.test.js`：
   - 第 389 行的 `Commit once per group[^\n]*write` 改成 `Ask for a commit only when none of your implementers is still running[^\n]*write`。
   - 第 600–611 行那個 test 整個換成：

```js
// 2026-09-24: a controlled build of 14 tasks sent its controller 19 commits,
// one round trip each; then one per `ledger.js groups` group, which waited on
// the slowest task of each group. Now: whenever nothing it sent is running.
test('a build brain asks for a commit only when none of its implementers is running, never per task', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const build = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(build, /Ask for a commit only when none of your implementers is still running, never per task: then write /);
  assert.match(build, /one block per task that returned since the last commit, the paths it owns one per line, a blank line, then its commit message, and a line `---` between blocks/);
  assert.doesNotMatch(build, /once per group `ledger\.js groups`/);
  assert.doesNotMatch(build, /may share one file/);
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  assert.match(file, /on build each time none of the implementers you sent is\s+still running, one block per task that returned since the last one, never per\s+task/);
  assert.match(file, /`ledger\.js ready`/);
  assert.doesNotMatch(file, /once per `ledger\.js groups` group/);
  assert.doesNotMatch(file, /first for each task or file/);
});
```

2. 在 `tests/skills.test.js`：
   - `KNOWN_LEDGER_PARAGRAPHS`（第 30 行起）刪掉兩項：`"   **A whole group goes out in one response**, and the \`grou"` 與 `"   \`groups\` answers which tasks *may* run together, never ho"`。
   - 檔案最後加上：

```js
// 2026-09-24: build sends what `ledger.js ready` lists, one task at a time as
// its dependencies land, and asks about the user's own tasks before the first
// dispatch. The plan skill carries the fourth Dispatch form that marks them.
test('build sends what ledger.js ready lists and asks about the hands first; plan carries the user form', () => {
  const build = read('fankeel-build');
  assert.match(build, /ledger\.js --plan docs\/plans\/<file>\.md ready/);
  assert.match(build, /ledger\.js --plan\s+docs\/plans\/<file>\.md hands/);
  assert.doesNotMatch(build, /A whole group goes out in one response/);
  const plan = read('fankeel-plan');
  assert.match(plan, /\*\*Dispatch:\*\* user — /);
  assert.match(plan, /Four alternatives, one of which every task carries/);
  assert.doesNotMatch(plan, /no third form of the line/);
  assert.match(plan, /put it last/);
});
```

3. 跑 `node --test tests/brief.test.js tests/skills.test.js`，看新斷言紅、`KNOWN_LEDGER_PARAGRAPHS` 那條也紅（兩段舊文字還在）。

4. 在 `lib/render.js` 的 `renderBrainBrief()`，build 那行（今天第 470 行）開頭的 `'  - You cannot commit: \`git commit\` and \`git add\` are refused to you. Commit once per group \`ledger.js groups\` printed, never per task: when every task in the group has returned and you have read what each changed, write ' + commit + ' — one block per task, the paths it owns one per line,` 換成 `'  - You cannot commit: \`git commit\` and \`git add\` are refused to you. Ask for a commit only when none of your implementers is still running, never per task: then write ' + commit + ' — one block per task that returned since the last commit, the paths it owns one per line,`；同一行裡的 `for a one-task group, or one` 改成 `for a one-block file, or one`。其餘字元不動。

5. 在 `agents/fankeel-brain.md` 的 `## Job`，把

```md
`json gate` block, and return the path — on a build, design or plan stage, a
`commit <path>` first: on build once per `ledger.js groups` group, never per
task; on design or plan once for its file. Open every dispatch's own
```

   在 `agents/fankeel-brain.md` 換成

```md
`json gate` block, and return the path — on a build, design or plan stage, a
`commit <path>` first: on build each time none of the implementers you sent is
still running, one block per task that returned since the last one, never per
task; on design or plan once for its file. On build, what you send is what
`ledger.js ready` lists: run it again each time a task is recorded complete and
send what it newly lists in that same response. A task whose Dispatch line
reads `user` is never listed and never yours. Open every dispatch's own
```

   `## Return` 裡的 `` `commit <path>` for a group to commit; `` 換成 `` `commit <path>` for the tasks that returned since the last commit; ``。

6. 在 `skills/fankeel/SKILL.md` 第 1139–1140 行，`on \`build\` once per` 與下一行開頭的 `\`ledger.js groups\` group, never per task` 換成 `on \`build\` each time` 與 `none of its implementers is still running, never per task`（句子其餘不動）。在第 1141 行（以 `has how.` 結尾）之後，空一行加上：

```md
A plan task whose `**Dispatch:**` line reads `user` is this session's, never the
stage agent's. `task.js stage build` lists them: ask the user right then —
after the other tasks and before the stage's gate, they do it first, or skip —
note the answer with `task.js note`, and run them with the user once the stage
agent's report is in and before you ask its gate, sending any edit the guard
refuses you here to an implementer.
```

7. 在 `skills/fankeel-plan/SKILL.md`：
   - 第 142–146 行那段換成：

```md
**And it decides how they go out.** `lib/plantasks.js` groups tasks by disjoint
`**Files:**` and by whether one consumes what another produces, then gives each
group a dispatch surface: one task is `agent`, two are `agents` in one response,
three or more are one `workflow`. `node <plugin>/scripts/ledger.js --plan <f>
groups` prints it, and `build` sends from `ledger.js ready`, which asks the same
predicates per task: a task goes out once every earlier task it conflicts with
is complete, and `TODO.md` and `docs/README.md` do not count as a shared file
there.
```

   - `And one line saying whether that implementer is dispatched at all. Three` 與下一行 `alternatives, one of which every task carries:` 改成 `And one line saying whether that implementer is dispatched at all. Four` 與 `alternatives, one of which every task carries:`。
   - 在 `skills/fankeel-plan/SKILL.md` 的 `**Dispatch:** implementer, opus — the lock protocol has to be reasoned about,` 那個範例的結尾 fence 之後，空一行加上：

````md
```markdown
**Dispatch:** user — run `/doctor` in this session and say when it is done; no
subagent can run a slash command.
```
````

   - `**One dispatch per task, and no third form of the line.**` 改成 `**One dispatch per task, and no batch form of the line.**`。
   - 在 `skills/fankeel-plan/SKILL.md` 那一段（以 `leaves the ledger saying both are open.` 結尾）之後，空一行加上：

```md
**`user` is the task the user does with their own hands** — a slash command, a
browser, an interactive probe `claude -p` cannot stand in for. `build` never
dispatches it: `ledger.js ready` leaves it out, `ledger.js hands` lists it, and
the session holding `AskUserQuestion` asks about it the moment build opens and
runs it with the user after every dispatched task and before build's gate. So
no dispatched task may depend on it: put it last.
```

8. 在 `skills/fankeel-build/SKILL.md`：
   - 第 3 節 `` `groups` now prints a surface beside each group, and it is the dispatch `` 與下一行 `decision rather than an input to one:` 換成 `` `groups` now prints a surface beside each group, and it is the batch `` 與 `` shape the scan records; what goes out next is step 2's `ledger.js ready`: ``。（第一行前 60 字元不變，`KNOWN_LEDGER_PARAGRAPHS` 那項照舊成立。）
   - 同一節下一段 `whose \`**Dispatch:**\` line reads \`in-session\` is not dispatched at all,` 改成 `` whose `**Dispatch:**` line reads `in-session` or `user` is not dispatched at all, ``。
   - `## The task loop` 的 no-plan 段裡 `the group in step 1's BASE rule, the whole group going out in step 2, the` 改成 `` the group in step 1's BASE rule, the tasks `ledger.js ready` sends in step 2, the ``。
   - 在 `skills/fankeel-build/SKILL.md` 那一段（以 `runs one row per pass, and every other step of the loop is unchanged.` 結尾）之後、`1. Record \`git rev-parse HEAD\` as BASE` 之前，空一行加上：

```md
**Before the first task, the hands** — on the plan path; a file table (no
plan) has no such row. `node <plugin>/scripts/ledger.js --plan
docs/plans/<file>.md hands` lists every task whose `**Dispatch:**` line reads
`user — <what the user does>`, and `none` when there is none. `task.js stage
build` already printed the same list to the session holding
`AskUserQuestion`, which asks the user then and there — after the other tasks
and before this stage's gate, in this session with them; they do it first and
say when; or skip, each becoming a `TODO.md` entry — and notes the answer with
`task.js note`, so it rides every prompt. A stage agent asks nothing and sends
none of them: `ready` never lists them, and its report names them on a line
`hands: <n>, <n>`. When the dispatched tasks are done, the session holding
`AskUserQuestion` runs them with the user — an edit the guard refuses it goes
to an implementer — commits and reviews each like any other task, and only
then asks this stage's gate.
```

   - `skills/fankeel-build/SKILL.md` 步驟 2 裡從 `   **A whole group goes out in one response**, and the \`groups\` command above` 到 `   two.` 的兩段換成：

```md
   **What goes out is what `ledger.js ready` lists**, on the plan path — with
   no plan the rows run one per pass, as above.
   `node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md ready` prints,
   one number a line, every task the ledger does not list as complete whose
   earlier tasks it conflicts with all are, and `none` when there is nothing
   to send. Send every task it lists that is not already out, in one
   response, and say how many and on which model. Each time a task is
   recorded complete, run it again and send what it newly lists in that same
   response: a task leaves the moment what it depends on has landed, not when
   a greedy group closes. `TODO.md` and `docs/README.md` do not count as a
   shared file there (`INDEX_FILES` in `lib/plantasks.js`): `Edit` refuses an
   `old_string` that moved, so the second implementer re-reads rather than
   writing over the first. A task whose `**Dispatch:**` line reads `user` is
   never listed — the hands paragraph above step 1 has it.

   **The ceiling of four in flight is still the ceiling**, and it binds only
   with a plan — with no plan one row is out at a time: `ready` listing six
   sends four, then one more as each returns. Three or more listed at once
   with nothing else in flight may go as one Workflow, step 4's `workflow`
   case; anything else goes as Agents.
```

9. 跑 `node scripts/stage-registry.js`，再 `git diff --stat -- skills/registry.json`：預期沒有差異；有的話它是這個 task 的檔。跑 `node --test tests/brief.test.js tests/skills.test.js tests/skills-cli.test.js tests/stage-registry.test.js tests/agents.test.js`、`node scripts/skills-check.js`，全綠。

10. 提交（parent）：`git commit -o skills/fankeel-build/SKILL.md skills/fankeel-plan/SKILL.md skills/fankeel/SKILL.md agents/fankeel-brain.md lib/render.js tests/brief.test.js tests/skills.test.js`（`skills/registry.json` 有差異時一起），主旨 `docs: build 跟著 ledger.js ready 派、brain 空檔時才提交、plan 多 Dispatch user`。

## Task 4: await 盯派工當下的 lap

設計 §3 與成功標準第三條。brief 用的 lap 蓋在 in-flight 標記上，`await.js` 照它盯檔。

**Files:**
- Modify: `lib/handoff.js` — `fileFor` 與三個路徑函式多一個選填的 `lap`；匯出 `lapOf`
- Modify: `lib/registry.js` — `markInflight` 多記 `lap`
- Modify: `hooks/brief.js` — 傳入 `lapOf(mine, mine.stage)`
- Modify: `scripts/await.js` — `waitFor` 與 `commitCandidates` 用標記上的 lap
- Modify: `docs/registry.md` — 第 223 行起的 `inflight` 段落
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lapOf(data, stage)` exported from `lib/handoff.js`；`handoffPath(root, data, stage, lap)`、`commitPath(root, data, stage, lap)`、`answerPath(root, data, stage, lap)` — `lap` 選填的正整數；`markInflight(projectRoot, sessionId, stage, agentId, lap)`；`inflight.lap` on the session record

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 在 `tests/await.test.js` 最後加上（檔頭已有 `fixture`、`at`、`SID`、`awaitCli`、`spawnSync`、`fs`、`path`）：

```js
// 2026-09-24: three `lost` reports on a build whose stage agent was still
// running. `moves` gained a `build` entry after the dispatch, so await
// recomputed lap 3 and watched `build-3-commit.md` while the agent, briefed at
// lap 2, wrote `build-2-commit.md`. The in-flight mark carries the lap the
// brief used, whatever added the move.
test('await.js watches the lap the in-flight mark carries, not one recomputed from moves', async () => {
    const moves = [['build', 1], ['build', 2], ['build', 3]];
    const f = fixture({ moves, inflight: { stage: 'build', at: 1, lap: 2 } });
    const lap2 = path.join(f.task, 'build-2-commit.md').split(path.sep).join('/');
    at(lap2, Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.ok(out.text.startsWith('commit ' + lap2 + ' — run'), out.text);

    const g = fixture({ moves, inflight: { stage: 'verify', at: 1, lap: 2 } });
    const lap3 = path.join(g.task, 'build-3-commit.md').split(path.sep).join('/');
    at(lap3, Date.now());
    const other = await awaitCli.main(['--session', SID, '--root', g.root, '--timeout', '0.5'], g.env);
    assert.ok(other.text.startsWith('commit ' + lap3 + ' — run'), 'a mark for another stage is not this stage\'s lap: ' + other.text);
});

test('a stage agent starting stamps the lap its brief named on the in-flight mark', () => {
    const f = fixture({ moves: [['build', 1], ['build', 2]] });
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'brief.js')], {
        input: JSON.stringify({ session_id: SID, cwd: f.root, hook_event_name: 'SubagentStart', agent_id: 'a3f9c2', agent_type: 'fankeel:fankeel-brain' }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.config }),
    });
    assert.equal(r.status, 0, r.stderr);
    const mark = JSON.parse(fs.readFileSync(path.join(f.root, '.fankeel', 'sessions', SID + '.json'), 'utf8')).inflight;
    assert.deepEqual([mark.stage, mark.agentId, mark.lap], ['build', 'a3f9c2', 2]);
});
```

2. 跑 `node --test tests/await.test.js`，看兩條新測試紅（第一條 `timeout — `，第二條 `mark.lap` 是 `undefined`）。

3. 在 `lib/handoff.js`，把 `fileFor`、`handoffPath`、`commitPath`、`answerPath` 四個函式換成：

```js
// The first visit keeps the name a stage has always had; the n-th, n >= 2, is
// `<stage>-<n>`, so a return to a stage is a file of its own and never the last lap's.
// `lap`, when given, is used as it is rather than recomputed from `moves`: the
// lap a stage agent was briefed with, read back off its in-flight mark, stays
// the lap its files carry even after `moves` gains an entry.
function fileFor(root, data, stage, suffix, lap) {
    const dir = dirFor(root, data);
    if (!dir || !stage) return null;
    const n = Number.isInteger(lap) && lap > 0 ? lap : lapOf(data, stage);
    return dir + '/' + stage + (n > 1 ? '-' + n : '') + suffix;
}

function handoffPath(root, data, stage, lap) {
    return fileFor(root, data, stage, '.md', lap);
}

function commitPath(root, data, stage, lap) {
    return fileFor(root, data, stage, '-commit.md', lap);
}

function answerPath(root, data, stage, lap) {
    return fileFor(root, data, stage, '-answer.md', lap);
}
```

   並在檔尾 `module.exports` 的 `lapsUsed,` 之前加 `lapOf,`。

4. 在 `lib/registry.js`，把 `markInflight` 前面的註解第一句 `A stage agent in flight: \`{ stage, at, agentId? }\`, written by` 改成 `A stage agent in flight: \`{ stage, at, agentId?, lap? }\`, written by`，函式換成：

```js
function markInflight(projectRoot, sessionId, stage, agentId, lap) {
    return update(projectRoot, sessionId, (data) => {
        const mark = { stage: String(stage || ''), at: Date.now() };
        if (typeof agentId === 'string' && agentId) mark.agentId = agentId;
        // The lap the brief's handoff and commit paths were built with, so
        // scripts/await.js watches those files and not a lap recomputed later.
        if (Number.isInteger(lap) && lap > 0) mark.lap = lap;
        data.inflight = mark;
        return true;
    });
}
```

5. 在 `hooks/brief.js`：`const profileLib = require('../lib/profile.js');` 之後加 `const { lapOf } = require('../lib/handoff.js');`；`registry.markInflight(root, payload.session_id, mine.stage, payload.agent_id);` 改成 `registry.markInflight(root, payload.session_id, mine.stage, payload.agent_id, lapOf(mine, mine.stage));`；上方註解最後加一句 `// \`lap\` is the one \`renderBrief\` below builds the brief's paths with.`。

6. 在 `scripts/await.js`，`commitCandidates` 換成：

```js
function commitCandidates(root, data, lap) {
    const candidates = [commitPath(root, data, data.stage, lap)];
    if (data.stage === 'build') {
        const plan = newestPlan(root, data.started);
        const ledger = ledgerCommitPath(root, plan, data.stage);
        if (ledger) candidates.push(ledger);
    }
    return candidates.filter(Boolean);
}
```

   `scripts/await.js` 的 `waitFor` 開頭到 `const agentId = ...` 換成：

```js
function waitFor(opts, env) {
    const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const data = registry.readSession(root, opts.session);
    if (!data) return { error: 'no session ' + opts.session + ' under ' + root };
    // The lap the running stage agent was briefed with, off its in-flight mark
    // (hooks/brief.js). A `moves` entry added after the dispatch — three false
    // `lost` reports on 2026-09-24 — would otherwise move the watch to a lap the
    // agent never writes. No mark for this stage: the lap from `moves`, as before.
    const mark = data.inflight && data.inflight.stage === data.stage ? data.inflight : null;
    const lap = mark && Number.isInteger(mark.lap) && mark.lap > 0 ? mark.lap : undefined;
    const handoff = handoffPath(root, data, data.stage, lap);
    if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
    let since = 0;
    try {
        since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
    } catch (e) { /* nothing answered yet: any report counts */ }
    const agentId = mark && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
```

   同一函式最後的 `commit: commitCandidates(root, data),` 改成 `commit: commitCandidates(root, data, lap),`。

7. 在 `docs/registry.md` 第 223 行，`` `inflight` — `{ stage, at, agentId? }` — `` 改成 `` `inflight` — `{ stage, at, agentId?, lap? }` — ``；同一段 `and, while it names the current stage, tells the controller to SendMessage that` 下一行 `agent rather than dispatch another.` 之後接上：

```md
`lap` is the lap `hooks/brief.js` built the brief's handoff and commit paths
with (`lapOf` in `lib/handoff.js`); while the mark names the current stage,
`scripts/await.js` watches that lap's files rather than one recomputed from
`moves`, so a `build` entry added after the dispatch — three false `lost`
reports on 2026-09-24 — no longer moves the watch off the files the stage agent
writes.
```

8. 跑 `node --test tests/await.test.js tests/handoff.test.js tests/brief.test.js tests/gate.test.js`，全綠；跑 `node scripts/docs-check.js`，照它印的修 `docs/registry.md`（這個 task 只修這一頁）。每條新測試回報一個 mutation，例如「`waitFor` 不讀 `mark.lap`」、「`hooks/brief.js` 不傳第五個參數」。

9. 提交（parent）：`git commit -o lib/handoff.js lib/registry.js hooks/brief.js scripts/await.js docs/registry.md tests/await.test.js`，主旨 `fix: await.js 盯 brief 當下的 lap，inflight 標記記下它`。

## Task 5: profile 的自訂 prompt

設計 §4 與成功標準第四、五條。`prompt.all` 與七個 `prompt.<stage>`，附在四個注入點的 stage rules 最後；`task.js profile set prompt.*` 印出代價；精靈與站頁的欄位表不收這八個鍵。

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加八個鍵、`parsePrompt()`、`parseValue` 分流、匯出 `WIZARD_KEYS`
- Modify: `lib/render.js` — `promptRules()`，接在 `controlBlock` 與 `rulesLines`；`REFERENCE_ROOT`、`sizeAtReference`、`BLOCK_CAP`、`blockSizes()` 匯出
- Modify: `lib/station.js` — `profileKeys: profile.WIZARD_KEYS`（今天第 610 行）
- Modify: `lib/stage-registry.js` — `REFERENCE_ROOT` 改從 `lib/render.js` import
- Modify: `scripts/task.js` — `cmdProfile` 的 `set` 對 `prompt.*` 多印三行
- Modify: `tests/reference-size.js` — 改成轉匯出 `lib/render.js` 的兩個名字
- Test: `tests/render.test.js`
- Test: `tests/profile.test.js`
- Test: `tests/station-wizard.test.js`
- Test: `tests/station.test.js`
- Read: `scripts/input-check.js` — `estimateTokens`（`:41`，匯出於 `:227`）

**Interfaces:**
- Consumes: none
- Produces: `prompt.all`、`prompt.survey` … `prompt.land` profile keys；`WIZARD_KEYS` from `lib/profile.js`；`promptRules(values, stage)`（`lib/render.js` 內部）；`REFERENCE_ROOT`、`sizeAtReference(out)`、`BLOCK_CAP`、`blockSizes(profile, root, now)` → `{ [stage]: number }` from `lib/render.js`

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 在 `tests/profile.test.js` 最後加上：

```js
test('prompt.all and prompt.<stage> take one line of free text, 1 to 200 characters, case kept', () => {
    const { FULL_ROUTE } = require('../lib/stages.js');
    assert.deepEqual(Object.keys(profile.KEYS).filter((k) => k.startsWith('prompt.')), ['prompt.all', ...FULL_ROUTE.map((s) => 'prompt.' + s)]);
    assert.equal(profile.parseValue('prompt.all', '  Use British spelling  ').value, 'Use British spelling');
    assert.equal(profile.parseValue('prompt.verify', '用繁體中文回答').value, '用繁體中文回答');
    assert.equal(profile.parseValue('prompt.all', 'x'.repeat(200)).value.length, 200);
    for (const bad of ['', '   ', 'two\nlines', 'x'.repeat(201)]) {
        assert.ok(profile.parseValue('prompt.all', bad).error, JSON.stringify(bad.slice(0, 20)));
    }
    const d = dir();
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    profile.write(profile.projectFile(d), 'prompt.verify', 'Run the suite first');
    assert.equal(profile.read(d, null).values['prompt.verify'], 'Run the suite first');
});

test('the station wizard gets every key but the free-text prompts', () => {
    const wizard = Object.keys(profile.WIZARD_KEYS);
    assert.ok(!wizard.some((k) => k.startsWith('prompt.')));
    assert.deepEqual(wizard, Object.keys(profile.KEYS).filter((k) => !k.startsWith('prompt.')));
});

// docs/plans/2026-09-24-todo-clear.md, "起草時查到": the printed N is
// estimateTokens of the line as injected, newline and `  - ` included, and the
// whole block grows by N or N-1 — estimateTokens rounds each call's ASCII up
// to a quarter, so two calls on overlapping text can differ by one.
test('profile set prompt.* prints what the line costs a turn and each stage\'s room under the cap', () => {
    const { estimateTokens } = require('../scripts/input-check.js');
    const { render } = require('../lib/render.js');
    const d = dir();
    const cfg = path.join(d, 'cfg');
    const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
    const run = (...args) => execFileSync(process.execPath, [TASK, ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    const sentence = '用繁體中文回答';
    const out = run('profile', 'set', 'prompt.all', sentence);
    const n = Number(/^\+~(\d+) tok\/輪/m.exec(out)[1]);
    assert.equal(n, estimateTokens('\n  - ' + sentence), 'the printed figure is estimateTokens of the injected line');
    const mine = { sessionId: 'aaaaaaaa-0000-4000-8000-000000000001', data: { task: 't', stage: 'survey', active: true } };
    const at = (values) => render({ mine, others: [], now: Date.now(), profile: { values, sources: {}, unreadable: [] } });
    const grew = estimateTokens(at({ 'prompt.all': sentence })) - estimateTokens(at({}));
    assert.ok(grew === n || grew === n - 1, 'the block grew by ' + grew + ' tok against ' + n + ' printed');
    assert.match(out, /^room under 2400: survey -?\d+ · design -?\d+ · plan -?\d+ · build -?\d+ · verify -?\d+ · audit -?\d+ · land -?\d+$/m);
    assert.match(out, /^every stage stays under the cap$/m);
    assert.equal(run('profile', 'set', 'guard', 'deny').split('\n').length, 1, 'a key that is not a prompt prints the one line it always did');
});

test('profile set prompt.all names every stage it pushes over the cap, and still writes it', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
    const out = execFileSync(process.execPath, [TASK, 'profile', 'set', 'prompt.all', 'x'.repeat(200), '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    const room = /^room under 2400: (.*)$/m.exec(out)[1].split(' · ').map((p) => p.split(' '));
    const over = room.filter(([, r]) => Number(r) <= 0).map(([s]) => s);
    assert.ok(over.length > 0, 'a 200-character sentence on blocks within a few hundred characters of the cap: ' + out);
    assert.match(out, new RegExp('^over the cap: ' + over.join(', ') + ' — set anyway', 'm'));
    assert.equal(JSON.parse(fs.readFileSync(profile.projectFile(d), 'utf8'))['prompt.all'], 'x'.repeat(200));
});
```

2. 在 `tests/render.test.js` 最後加上：

```js
// docs/plans/2026-09-24-todo-clear-design.md §4: the user's own sentence, last
// in every block a person reads the result of — every prompt, after a gate,
// the controller's, the stage agent's — and never in a reader's brief, whose
// return goes to the controller rather than to the person who wrote it.
test('prompt.all rides every stage\'s block and the stage agent\'s brief; prompt.<stage> only its own stage', () => {
  const { renderResume, renderBrief } = require('../lib/render.js');
  const values = { 'prompt.all': '用繁體中文回答', 'prompt.verify': '先跑整套測試' };
  const plain = { values, sources: {}, unreadable: [] };
  for (const stage of NAMES) {
    const mine = entry(MINE, { stage, started: '2026-09-19T09:30:12.345Z' });
    for (const out of [render({ mine, others: [], now: NOW, root: '/r', profile: plain }), renderResume({ mine, profile: plain, root: '/r' })]) {
      assert.ok(out.includes('\n  - 用繁體中文回答'), stage);
      assert.equal(out.includes('先跑整套測試'), stage === 'verify', stage);
    }
  }
  const on = { values: Object.assign({ 'stage.agents': NAMES.slice(), 'dispatch.floor': 'sonnet' }, values), sources: {}, unreadable: [] };
  const verify = entry(MINE, { stage: 'verify', started: '2026-09-19T09:30:12.345Z' });
  const controller = render({ mine: verify, others: [], now: NOW, root: '/r', profile: on });
  assert.ok(controller.includes('fankeel:fankeel-brain') && controller.includes('\n  - 用繁體中文回答') && controller.includes('\n  - 先跑整套測試'), 'the controller\'s block');
  const brain = renderBrief({ mine: verify, agentType: 'fankeel:fankeel-brain', root: '/r', profile: on });
  assert.ok(brain.includes('\n  - 用繁體中文回答') && brain.includes('\n  - 先跑整套測試'), 'the stage agent\'s brief');
  const reader = renderBrief({ mine: verify, agentType: 'fankeel:fankeel-reader', root: '/r', profile: on });
  assert.ok(!reader.includes('用繁體中文回答'), 'a reader\'s brief');
  const none = render({ mine: verify, others: [], now: NOW, root: '/r', profile: { values: {}, sources: {}, unreadable: [] } });
  assert.equal(render({ mine: verify, others: [], now: NOW, root: '/r', profile: { values: { 'prompt.design': 'x' }, sources: {}, unreadable: [] } }), none, 'another stage\'s prompt adds nothing');
});
```

3. 在 `tests/station-wizard.test.js` 第 14 行，`const KEYS = profile.KEYS;` 改成 `const KEYS = profile.WIZARD_KEYS;`。在 `tests/station.test.js` 第 160–168 行那個 test，標題改成 `serialize carries profile.WIZARD_KEYS and profile.PRESETS whole`，`plain(profile.KEYS)` 改成 `plain(profile.WIZARD_KEYS)`，上方註解 `a projection of \`profile.KEYS\` written later` 改成 `a projection of \`profile.WIZARD_KEYS\` written later`。

4. 跑 `node --test tests/profile.test.js tests/render.test.js tests/station-wizard.test.js tests/station.test.js`，看新測試紅（`unknown key: prompt.all`、`WIZARD_KEYS` 是 `undefined`）。

5. 在 `lib/profile.js` 的 `KEYS`，`'stage.agents': {...},` 之後、`};` 之前加上：

```js
    // Free text, one line each: the user's own sentence, appended last to the
    // rules of every stage (`prompt.all`) or of one (`prompt.<stage>`). `values`
    // is empty because nothing enumerates a sentence; `parsePrompt` below is the
    // check. Not in the station's wizard — `WIZARD_KEYS` — which has no
    // free-text field; `task.js profile set` is where they are set.
    'prompt.all': { values: [], builtin: null, desc: '每個 stage 的規則最後附上的一句自訂 prompt，每輪注入' },
    'prompt.survey': { values: [], builtin: null, desc: 'survey 站的規則最後附上的一句自訂 prompt' },
    'prompt.design': { values: [], builtin: null, desc: 'design 站的規則最後附上的一句自訂 prompt' },
    'prompt.plan': { values: [], builtin: null, desc: 'plan 站的規則最後附上的一句自訂 prompt' },
    'prompt.build': { values: [], builtin: null, desc: 'build 站的規則最後附上的一句自訂 prompt' },
    'prompt.verify': { values: [], builtin: null, desc: 'verify 站的規則最後附上的一句自訂 prompt' },
    'prompt.audit': { values: [], builtin: null, desc: 'audit 站的規則最後附上的一句自訂 prompt' },
    'prompt.land': { values: [], builtin: null, desc: 'land 站的規則最後附上的一句自訂 prompt' },
```

   在 `lib/profile.js` 的 `KEYS` 的 `};` 之後加上：

```js
// The keys the station's wizard and its summary list: every one but the
// free-text prompts, which have no field type there.
const WIZARD_KEYS = Object.fromEntries(Object.entries(KEYS).filter(([key]) => !key.startsWith('prompt.')));
```

6. 在 `lib/profile.js`，`function parseValue(` 之前加上：

```js
// `prompt.*`: the sentence as typed, trimmed but not lowercased. One line,
// because it is injected as one rule; 200 characters at most, because it is
// paid for on every prompt and the blocks it joins sit near their cap.
const PROMPT_MAX = 200;
function parsePrompt(key, raw) {
    const s = String(raw).trim();
    if (!s || /[\r\n]/.test(s) || [...s].length > PROMPT_MAX) return { error: key + ' is one line of 1 to ' + PROMPT_MAX + ' characters' };
    return { value: s };
}
```

   `parseValue` 裡 `if (key === 'gate.station') return parseGateStation(raw);` 之後加 `if (key.startsWith('prompt.')) return parsePrompt(key, raw);`。檔尾 `module.exports` 的 `KEYS,` 之後加 `WIZARD_KEYS,`。

7. 在 `lib/station.js` 第 610 行，`profileKeys: profile.KEYS,` 改成 `profileKeys: profile.WIZARD_KEYS,`。

8. 在 `lib/render.js`，`function controlBlock(` 之前加上：

```js
// `prompt.all`, then `prompt.<stage>`: the user's own sentences, one rule each,
// last in the block. `renderBrief` never reaches this — a reader's return is
// read by the controller, not by the person who wrote the sentence.
function promptRules(values, stage) {
    const v = values || {};
    const name = String(stage || '').trim().toLowerCase();
    return ['prompt.all', 'prompt.' + name].map((k) => v[k]).filter((s) => typeof s === 'string' && s.trim());
}
```

   `lib/render.js` 的 `controlBlock` 最後一行 `return controlFor(stage, values, Object.assign({ handoff, answer: answerPath(ctx.root, data, stage), session: ctx.sessionId }, subs), data && data.inflight);` 換成：

```js
    const control = controlFor(stage, values, Object.assign({ handoff, answer: answerPath(ctx.root, data, stage), session: ctx.sessionId }, subs), data && data.inflight);
    return control && Object.assign({}, control, { rules: control.rules.concat(promptRules(values, stage)) });
```

   `rulesLines` 裡 `const rules = control ? control.rules : rulesFor(data && data.stage, subs, values);` 換成 `const rules = control ? control.rules : rulesFor(data && data.stage, subs, values).concat(promptRules(values, data && data.stage));`。（`render`、`renderResume` 與 `renderBrainBrief` 都經 `rulesLines`；`controlRulesFor` 經 `controlBlock`。）

9. 在 `lib/render.js`，`function renderBrief(` 之前加上：

```js
// An installed plugin does not live where this checkout does. It lives under
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<version> — 59 characters once
// expanded, as in C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.24.0 —
// against the 16 this repository happens to sit at, so a block is sized as if
// the root were that long. One copy, shared by tests/reference-size.js,
// lib/stage-registry.js and `task.js profile set`, so the cap a test holds and
// the room a command prints are measured the same way.
const REFERENCE_ROOT = 59;
const BLOCK_CAP = 2400;
function sizeAtReference(out) {
    const roots = out.split(PLUGIN_ROOT).length - 1;
    return out.length + roots * (REFERENCE_ROOT - PLUGIN_ROOT.length);
}

// What each stage's per-prompt block costs under `profile`, on the sample entry
// tests/render.test.js sizes its cap with: an architectural task on the full
// route, two claims. `root` gives a controlled stage its handoff path.
const SAMPLE_SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
function blockSizes(profile, root, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const out = {};
    for (const stage of FULL_ROUTE) {
        const data = { task: 'rework the colour ramp', claims: ['statusline.ps1', 'statusline.sh'], stage, class: 'architectural', route: FULL_ROUTE.slice(), active: true, started: new Date(t - 2 * 3600e3).toISOString(), updated: new Date(t - 60e3).toISOString() };
        out[stage] = sizeAtReference(render({ mine: { sessionId: SAMPLE_SESSION, data }, others: [], now: t, root: root || '/r', profile }));
    }
    return out;
}
```

   檔尾 `module.exports` 最後的 `newestPlan` 之後加 `, REFERENCE_ROOT, BLOCK_CAP, sizeAtReference, blockSizes`。

10. `tests/reference-size.js` 整份換成：

```js
'use strict';

// Shared by tests/render.test.js and tests/resume.test.js. The pair lives in
// lib/render.js now, beside the `task.js profile set` measurement that uses it
// too: duplicating it is exactly the "two 2400s with different sources" the
// 2026-09-10 judgement found, and a copy that drifts defeats the cap on its own.
const { REFERENCE_ROOT, sizeAtReference } = require('../lib/render.js');

module.exports = { REFERENCE_ROOT, sizeAtReference };
```

11. 在 `lib/stage-registry.js`，`const { render, PLUGIN_ROOT } = require('./render.js');` 改成 `const { render, PLUGIN_ROOT, REFERENCE_ROOT } = require('./render.js');`，刪掉 `const REFERENCE_ROOT = 59;` 那一行。

12. 在 `scripts/task.js`：`const { controlRulesFor, PLUGIN_MARK, PLUGIN_ROOT, newestPlan } = require('../lib/render.js');`（Task 2 之後的樣子）改成 `const { controlRulesFor, PLUGIN_MARK, PLUGIN_ROOT, newestPlan, blockSizes, BLOCK_CAP } = require('../lib/render.js');`，並加一行 `const { estimateTokens } = require('./input-check.js');`。在 `function cmdProfile(` 之前加上：

```js
// What a `prompt.*` sentence costs, said when it is set: the tokens its
// injected line adds to every prompt, by input-check.js's own estimate, and
// each stage's block against the cap with the profile as it now reads. A
// warning, never a refusal — the cap is the tests', and the sentence is the
// user's.
function promptCost(root, projectRoot, cfg, sentence) {
    const n = estimateTokens('\n  - ' + sentence);
    const sizes = blockSizes(profile.read(projectRoot, cfg), root);
    const over = FULL_ROUTE.filter((s) => sizes[s] >= BLOCK_CAP);
    return [
        '+~' + n + ' tok/輪 — the injected line, by input-check.js estimateTokens',
        'room under ' + BLOCK_CAP + ': ' + FULL_ROUTE.map((s) => s + ' ' + (BLOCK_CAP - sizes[s])).join(' · '),
        over.length ? 'over the cap: ' + over.join(', ') + ' — set anyway; this is a warning, not a refusal' : 'every stage stays under the cap',
    ];
}
```

   `scripts/task.js` 裡 `cmdProfile` 的 `set` 分支最後的 `return 'fankeel — profile: ' + key + ' = ' + out.value + '  → ' + file;` 換成：

```js
        const head = 'fankeel — profile: ' + key + ' = ' + out.value + '  → ' + file;
        return key.startsWith('prompt.') ? [head].concat(promptCost(root, projectRoot, cfg, out.value)).join('\n') : head;
```

13. 跑 `node --test tests/profile.test.js tests/render.test.js tests/station-wizard.test.js tests/station.test.js tests/resume.test.js tests/stage-registry.test.js tests/brief.test.js tests/source.test.js`，全綠；`tests/render.test.js` 的兩條 2400 上限照舊綠（它們的 profile 沒有 `prompt.*`）。每條新測試回報一個 mutation，例如「`rulesLines` 不 concat `promptRules`」、「`parsePrompt` 把值轉小寫」、「`WIZARD_KEYS` 不濾 `prompt.`」。

14. 提交（parent）：`git commit -o lib/profile.js lib/render.js lib/station.js lib/stage-registry.js scripts/task.js tests/reference-size.js tests/render.test.js tests/profile.test.js tests/station-wizard.test.js tests/station.test.js`，主旨 `feat: profile 的 prompt.all 與 prompt.<stage>，設定時印出每輪代價與各站餘裕`。

## Task 6: 拆兩個慢的測試檔

設計 §5 前兩條。兩個檔都沒有 `describe`，照主題拆；每個 test 逐字搬，只改 `:254` 那一條（固定 900ms 換成探 port 的輪詢）。整套與逐檔秒數的量測在 Task 7（理由見「起草時查到」）。

**Files:**
- Modify: `tests/station-cli.test.js` — 只留不起 server 的 CLI 測試；`:254` 的探針改輪詢
- Test: `tests/station-serve.test.js` — 新檔，serve 的生命週期與 GET
- Test: `tests/station-post.test.js` — 新檔，POST 路由與「seven refusals」那一段
- Modify: `tests/task.test.js` — 留第 1–938 行
- Test: `tests/task-control.test.js` — 新檔，第 939 行到檔尾
- Read: `scripts/station.js` — `serve()` 的 idle timer（`:319-333`）與它回傳的 `url`（`:641`）

**Interfaces:**
- Consumes: none
- Produces: none（測試檔）

**Dispatch:** implementer, sonnet — 機械式搬移加一段計畫給好的探針。

步驟：

1. 量拆之前：`node --test tests/station-cli.test.js` 與 `node --test tests/task.test.js` 各跑一次，記下各自輸出的 `ℹ tests` 與 `ℹ duration_ms` 兩行（原文）。

2. 建 `tests/station-serve.test.js` 與 `tests/station-post.test.js`：兩檔都以 `tests/station-cli.test.js` 第 1–61 行開頭（`'use strict'`、requires、`CLI`、`LIVE`、`STALE`、`DAY`、`GONE_PID`、`fixture()`、`request()`），在 `'use strict';` 下面加一行說明這個檔收什麼（station-serve：`// serve()'s own life: binding, joining, idling, the shell and its assets, and the port it takes back. Split out of station-cli.test.js on 2026-09-24.`；station-post：`// Every POST route serve() answers, and the refusals each one gives. Split out of station-cli.test.js on 2026-09-24.`）。然後把下列 test 連同它上方緊貼的註解逐字**搬**過去（從 `tests/station-cli.test.js` 刪掉）：
   - `tests/station-serve.test.js`：`serve renders live, refuses a bad nonce, refuses a live row, clears a stale one, then exits when idle`（:110）、`serve answers the shell and its three siblings`（:137）、`GET / answers 404 when the shell cannot be read`（:163）、`a second serve() call joins the first rather than binding its own port`（:187）、`serve.json is written once the listener binds and removed once it closes`（:203）、`idleMs: 0 arms no timer, rather than the old default falling back on a falsy value`（:219）、`serve hands that budget to the walk on every request, and hands none when there is nothing to scan`（:634）、`every asset the shell references answers from the server`（:797）、`a serve.json naming a dead pid does not stop a new server binding`（:825）、`serve() ignores a serve.json whose pid is dead`（:860）、`serve() does not join a live pid whose port is not a station`（:885）、`a joining serve() writes its own leads into roots.json`（:911）、`a server pushed off its port rebinds it once it frees`（:927）、`GET /station/health names this process`（:962）。
   - `tests/station-post.test.js`：`CS_LIVE`、`CS_OLD_A`、`CS_OLD_B`、`CS_FRESH` 與 `clearStaleFixture()`（:303–336）及其後六個 test（:338、:373、:390、:412、:433、:469）；`// --- the seven refusals no test reached ---` 那一段整段（:490 起，含 `served()` 與 :514、:536、:549、:564、:577、:589、:601 七個 test）；:981 的 `POST /profile takes a stage list and an empty value clears a key; the data carries the presets`；`servedPairs()`（:1008）與其後四個 test（:1015、:1034、:1051、:1069）。
   - 留在 `tests/station-cli.test.js`：:62、:72、:83、:93、:254、:281、:291、:624、:674、:691、:710、:725 那十二個。

3. 在 `tests/station-cli.test.js` 的 `a bare idleMs never ends the calling process, but main()'s own --idle flag still does`，把 `const probe = ...` 那一句（今天第 256–259 行，含 `setTimeout(r, 900)`）換成下面這段，並把上方註解最後補一句 `The probe waits for the idle timer to close the port — a bare TCP connect, never a request, because a request resets the timer — rather than sleeping a fixed 900ms.`：

```js
    // `net.connect` and never `http.get`: `serve()` resets its idle timer on
    // every request (`touch()`), so polling over HTTP would keep it from ever
    // idling. A refused connect is the moment the timer fired and closed the
    // port; printing after it proves the process outlived it.
    const probe = "const net = require('node:net');"
        + "const { serve } = require(" + JSON.stringify(CLI) + ");"
        + "(async () => { const s = await serve({ configDir: " + JSON.stringify(cfg)
        + ", port: 0, idleMs: 300, open: false });"
        + " const port = Number(new URL(s.url).port);"
        + " const listening = () => new Promise((r) => { const c = net.connect(port, '127.0.0.1', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); });"
        + " const t0 = Date.now();"
        + " while (await listening()) { if (Date.now() - t0 > 4000) { console.log('NEVER IDLED'); s.close(); return; } await new Promise((r) => setTimeout(r, 25)); }"
        + " console.log('SURVIVED'); })();";
```

   其後的 `spawnSync`、`assert.equal(inProcess.status, 0, ...)` 與 `assert.match(inProcess.stdout, /SURVIVED/, ...)` 不動。

4. 建 `tests/task-control.test.js`：以 `tests/task.test.js` 第 1–82 行開頭（在 `'use strict';` 下面加一行 `// start, stage and task as the controller sees them, the model hint, liveness, show --all, the lock, laps, profile, land and next --from-gate. Split out of task.test.js on 2026-09-24.`），接著第 286–299 行（`runRaw` 與它上方的註解，不含其後的 `for` 迴圈），再接第 939 行（`// The turn \`start\` prints in has no injection yet` 那段註解的第一行）到檔尾。然後從 `tests/task.test.js` 刪掉第 939 行到檔尾。

5. `git add tests/station-serve.test.js tests/station-post.test.js tests/task-control.test.js`。跑 `node --test tests/station-cli.test.js`、`node --test tests/station-serve.test.js`、`node --test tests/station-post.test.js`、`node --test tests/task.test.js`、`node --test tests/task-control.test.js`，一次一個，各記 `ℹ tests`、`ℹ pass`、`ℹ fail`、`ℹ duration_ms`（原文）。三個 station 檔的 `ℹ tests` 加總等於第 1 步 station-cli 的數；兩個 task 檔加總等於第 1 步 task 的數。任何一個 `ℹ fail` 不是 0 就停，回報 `blocked: <檔> <失敗的 test 名>`。任一檔的 `ℹ duration_ms` 大於等於 40000 也回報出來（設計的門檻）。

6. 回報新測試的 mutation：只有 `:254` 那條變了——「把 `scripts/station.js` 的 `if (opts.exitOnIdle === true) process.exit(0);` 改成 `process.exit(0);`」會讓它紅（`SURVIVED` 不出現）。

7. 提交（parent）：`git commit -o tests/station-cli.test.js tests/station-serve.test.js tests/station-post.test.js tests/task.test.js tests/task-control.test.js`，主旨 `test: station-cli 拆成三檔、task 拆成兩檔，idle 探針改探 port`，訊息內文貼第 1 步與第 5 步的 `ℹ tests` 與 `ℹ duration_ms` 原文。

## Task 7: 文件、TODO 與量測

設計 §7 與 §5 第三條、成功標準最後一條。它讀 Task 1–6 動過的檔，所以 `ready()` 讓它排在每個派出去的 task 之後；工作樹在那時是靜的，整套量測放在這裡。

**Files:**
- Modify: `TODO.md` — 關五條，加 ADR 一條（`## Needs a decision`）與 worktree 一條（`## Waiting`）
- Modify: `docs/README.md` — sweep 兩列改成封存；本計畫加一列
- Modify: `docs/plans/2026-09-24-todo-sweep-design.md` — `git mv` 到 `docs/archive/`，frontmatter 改 `status: current`
- Modify: `docs/plans/2026-09-24-todo-sweep.md` — 同上
- Modify: `docs/archive/2026-09-24-todo-sweep-design.md` — `git mv` 之後的新路徑，frontmatter 在這裡改（先 mv 再改，`git add` 新路徑）
- Modify: `docs/archive/2026-09-24-todo-sweep.md` — 同上
- Modify: `docs/decisions/2026-09-24-optimise-own-first.md` — 第 10 行兩條連結改指 `../archive/`
- Modify: `docs/subagents.md` — 四處提交節奏與分批派工的句子，加一段 `user` task；docs-check 報的 `lib/profile.js` 行號
- Modify: `docs/pipeline.md` — build 段落與流程圖
- Modify: `docs/development.md` — 新增一節測試秒數
- Modify: `skills/fankeel-survey/SKILL.md` — docs-check 報的 `scripts/task.js` 行號
- Read: `lib/plantasks.js` — `INDEX_FILES`、`ready`
- Read: `scripts/await.js` — Task 4 已落地
- Read: `lib/profile.js` — Task 5 已落地
- Read: `skills/fankeel-build/SKILL.md` — 文件要跟它的步驟 2 與 hands 段一致
- Read: `tests/station-cli.test.js` — Task 6 已落地

**Interfaces:**
- Consumes: `ready`（Task 1）、`dispatch`（Task 2）、`inflight.lap`（Task 4）、`WIZARD_KEYS`（Task 5）
- Produces: none

**Dispatch:** implementer, sonnet — 文字都在計畫裡；量測是照抄的指令。第 6 步明文推翻 brief 頁尾「只跑自己的測試」那條，因為量測本身就是交付物，而這個 task 跑的時候沒有鄰居。

步驟：

1. `TODO.md`：
   - 刪掉 `## Ready` 的四條：〔tests〕整套 `node --test` 約 110 秒…、〔build〕派工改成 ready-queue…、〔plan〕plan 標出要使用者親手做的 task…、〔stage-agents〕重回 build 後主控規則與 `await.js` 盯 `build-3`…。〔station〕回放那條留著（Task 8 關）。
   - 刪掉 `## Needs a decision` 的〔profile〕profile 可設各 stage…那條；〔memory〕那條留著（Task 9 關）。在 `## Needs a decision` 最後加：

```md
- 〔docs〕要不要 ADR：參考 Trovara 的 `docs/04-architecture/adr/`，只在做架構選擇時寫、不是每個 task 都呼叫；在哪一站、由誰觸發，要人來定 — [docs/documents.md](docs/documents.md).
```

   - 在 `TODO.md` 的 `## Waiting` 最後，
     也就是最後一個 timing 的最後一條之後，加一個新 timing：

```md
### implementer 互相蓋檔
lifts when: 共用樹上出現一次 implementer 蓋掉另一個 implementer 的改動. 09-24.

- 〔build〕ready-queue 的 worktree 那一半：每個 implementer 各開 worktree、由 brain merge；`scripts/commit.js` 認不得 worktree、brain 不能 `git commit`，兩者都得先改 — [docs/subagents.md](docs/subagents.md).
```

   - 跑 `node scripts/todo-check.js`，exit 0。

2. 搬檔：`git mv docs/plans/2026-09-24-todo-sweep-design.md docs/archive/2026-09-24-todo-sweep-design.md`、`git mv docs/plans/2026-09-24-todo-sweep.md docs/archive/2026-09-24-todo-sweep.md`；**搬完**再用 Edit 把兩個新路徑的 frontmatter `status: design-intent` 改成 `status: current`（先改再搬，`git mv` 會把舊的 blob 放進 index）。`docs/decisions/2026-09-24-optimise-own-first.md` 第 10 行的 `../plans/2026-09-24-todo-sweep-design.md` 與 `../plans/2026-09-24-todo-sweep.md`（連結文字與目標都改）換成 `../archive/…`。

3. `docs/README.md`：
   - 第 179 行最後一格 `[plans/2026-09-24-todo-sweep-design.md](plans/2026-09-24-todo-sweep-design.md) — *design-intent, 繁體中文*` 換成 `` `docs/archive/2026-09-24-todo-sweep-design.md` — *built, 繁體中文* ``；第 180 行 `[plans/2026-09-24-todo-sweep.md](plans/2026-09-24-todo-sweep.md) — *design-intent, 繁體中文*` 換成 `` `docs/archive/2026-09-24-todo-sweep.md` — *built, 繁體中文* ``。
   - 第 181 行（todo-clear 的設計列）之後加一列：

```md
| 那份設計的九個 task：`plantasks.ready` 與 `ledger.js ready`、`Dispatch: user` 與 `ledger.js hands`、build 與 brain 的規則、`inflight.lap`、`prompt.*`、測試拆檔、文件與量測，加上兩個使用者親手的 task | [plans/2026-09-24-todo-clear.md](plans/2026-09-24-todo-clear.md) — *design-intent, 繁體中文* |
```

4. `docs/subagents.md`（英文頁；每處用 Edit，舊字串取單行）：
   - 第 361 行 `returns — or, for a build stage agent, once per \`ledger.js groups\` group` 改成 `returns — or, for a build stage agent, each time none of its implementers is`；第 362 行開頭 `after every task in it is read back, one block per task — never the implementer itself` 改成 `still running, one block per task that returned since the last one — never the implementer itself`。
   - 第 377–380 行從 `and prints which tasks may share one response. Two tasks in different groups` 到 `out together.` 換成：

```md
and prints the groups they make. The build loop sends from `ledger.js ready`
instead, which asks the same four per task: a task goes out once every earlier
task it conflicts with is complete, so it no longer waits for a greedy group to
close, and `TODO.md` and `docs/README.md` (`INDEX_FILES` in `lib/plantasks.js`)
do not count as a shared file there — `Edit` refuses an `old_string` that moved,
so a second implementer re-reads rather than writing over the first. The
ceiling above still bounds how many are in flight.
```

   - 在 `docs/subagents.md` 那一段（以 `group.` 單獨成行結尾，今天第 386 行）之後，空一行加上：

```md
A task whose `**Dispatch:**` line reads `user — <what the user does>` is not
dispatched at all: `ledger.js ready` leaves it out and `ledger.js hands` lists
it. `task.js stage build` prints that list to the session holding
`AskUserQuestion` — the controller, when `stage.agents` names build — which asks
the user then and there, notes the answer, and runs the task with them after
every dispatched task and before the stage's gate; an edit the guard refuses the
controller goes through an implementer.
```

   - 第 509 行（`| a commit (\`build\`, \`design\`, \`plan\`) |` 那一列）裡 `on build, one file per \`ledger.js groups\` group, never one per task` 改成 `on build, one file each time none of its implementers is still running, never one per task`，同一格裡的 `or \`<base>..<sha>\` for a one-task group` 改成 `or \`<base>..<sha>\` for a one-block file`。
   - 第 623 行 `back once per \`ledger.js groups\` group, never per task, in the controller's` 改成 `back each time none of its implementers is still running, never per task, in the controller's`。

5. `docs/pipeline.md`（英文頁）：
   - 第 521 行 `<b>Dispatch:</b> in-session, or a model said out loud` 改成 `<b>Dispatch:</b> in-session, a model said out loud,<br/>or user — what the user does`。
   - 第 544–547 行，從 `**It executes rather than decides.** \`ledger.js groups\` prints a dispatch` 到 `diagnostics that downgrade a group.` 換成：

```md
**It executes rather than decides.** `ledger.js ready` prints which tasks may go
out now — every task not yet complete whose earlier tasks it conflicts with all
are, with `TODO.md` and `docs/README.md` not counted as shared — and the loop
sends each as it appears rather than waiting for a greedy group to close;
`ledger.js groups` still prints the groups and their surface for the scan. A
task whose `**Dispatch:**` line reads `user` is never sent: `task.js stage
build` names it to the session holding `AskUserQuestion`, which asks the user at
once and runs it with them after the other tasks, before the gate.
```

   - 第 555–556 行 `the gate asking for a` 與 `group the ledger has not completed, the node sending a whole group out in one` 改成 `the gate asking what` 與 `` `ledger.js ready` lists, the node sending every task it lists out in one ``。
   - 流程圖：`L{"a group holding a task the ledger<br/>does not list as complete?"}` → `L{"ledger.js ready lists a task<br/>not already out?"}`；`D["<b>the whole group, on the surface groups printed</b><br/>agent · agents · workflow<br/><i>pass the model explicitly, say how many<br/>and on which model. Four dispatches at a time</i>"]` → `D["<b>every task ready lists, in one response</b><br/>four in flight at most<br/><i>pass the model explicitly, say how many<br/>and on which model</i>"]`；`the group's in-session tasks` → `the in-session tasks among them`；`E{"a task in this group<br/>not committed yet?"}` → `E{"a returned task<br/>not committed yet?"}`；`now — not when the group went out` → `now — not when it went out`。

6. 量測（這一步推翻頁尾「只跑自己的測試」：量測就是交付物，而 `ready()` 讓這個 task 在每個派出去的 task 之後才開始，樹是靜的）。用 Bash，每段 `run_in_background`，輸出寫進 `.fankeel/build/2026-09-24-todo-clear/`，先 `mkdir -p` 那個目錄：

```sh
d=.fankeel/build/2026-09-24-todo-clear
per_file() { # $1: the tree, $2: the output file
  { git -C "$1" rev-parse HEAD; git -C "$1" status --porcelain; echo ---
    for f in "$1"/tests/*.test.js; do s=$(date +%s%3N); node --test "$f" > /dev/null 2>&1; c=$?; e=$(date +%s%3N); echo "$((e-s)) $c ${f#$1/}"; done; } > "$2"
}
suite() { # $1: the tree, $2: the output file
  { git -C "$1" rev-parse HEAD; s=$(date +%s%3N); (cd "$1" && node --test) > "$2.log" 2>&1; c=$?; e=$(date +%s%3N); echo "exit $c ms $((e-s))"; } > "$2"
}
git worktree add ../fankeel-timing-before a8bce07e
per_file ../fankeel-timing-before "$d/per-file-before.txt"
suite ../fankeel-timing-before "$d/suite-before.txt"
git worktree remove ../fankeel-timing-before
per_file . "$d/per-file-after.txt"
suite . "$d/suite-after.txt"
```

   讀四個檔全文（不用 `head`），各自最慢的五個檔用 `sort -rn` 看、不截斷地讀。`per-file-after.txt` 裡第二欄不是 0 的行、或第一欄大於等於 40000 的行，任何一行都停下來回報 `blocked: <那一行>`。`suite-*.txt` 的 `exit` 不是 0 也停。

7. `docs/development.md`：在 `## Where the code lives` 之前加一節（英文頁；`<…>` 換成第 6 步讀到的數字，毫秒換成秒、一位小數）：

```md
## How long the suite takes

Measured on 2026-09-24, Windows 11 and Node v24.9.0, by
`docs/plans/2026-09-24-todo-clear.md` Task 7 step 6: each file alone with
`node --test <file>`, one after another, wall-clock from the shell; then the
whole suite with `node --test`, which runs files in parallel.

| | before the split, at `a8bce07e` | after, at `<the sha per-file-after.txt starts with>` |
|---|---|---|
| whole suite | <suite-before> s | <suite-after> s |
| slowest file | `tests/station-cli.test.js` <its time> s | `<the slowest file after>` <its time> s |

The split took `tests/station-cli.test.js` into three files by what they start —
the CLI alone, `serve()`'s own life, and the POST routes — and
`tests/task.test.js` into two at the controller's half. The idle test there no
longer sleeps a fixed 900ms: it probes the port until the idle timer closes it.
The five slowest after the split: <file — s, five of them>.
```

8. 跑 `node scripts/docs-check.js`，照它印的修：預期 `docs/subagents.md` 的 `lib/profile.js:36`、`:89`、`:90`、`:92`、`:98` 與 `skills/fankeel-survey/SKILL.md` 的 `scripts/task.js:1183` 移位，照 `— it is at :N` 改行號。它點名這個 task 的 Files 以外的檔，就停下來回報 `blocked: docs-check names <檔>`。再跑 `node scripts/todo-check.js`、`node --test tests/docs.test.js tests/skills.test.js tests/todo-check.test.js`。

9. 提交（parent）：`git commit -o TODO.md docs/README.md docs/archive/2026-09-24-todo-sweep-design.md docs/archive/2026-09-24-todo-sweep.md docs/plans/2026-09-24-todo-sweep-design.md docs/plans/2026-09-24-todo-sweep.md docs/decisions/2026-09-24-optimise-own-first.md docs/subagents.md docs/pipeline.md docs/development.md skills/fankeel-survey/SKILL.md`，主旨 `docs: ready-queue 與 Dispatch user 寫進文件、TODO 關五條、測試秒數、封存 sweep 計畫`；提交後 `git show --stat HEAD` 確認兩個搬移是 rename、沒有漏檔。

## Task 8: 在真 station 上逐塊調回放

設計 §6 第一條。步驟沿用封存的 todo-four 計畫 Task 8（`docs/archive/2026-09-24-todo-four.md:2113-2139`），由握有 `AskUserQuestion` 的 session 帶使用者在瀏覽器上來回；每則改動派一個 implementer（這個 session 在受控 build 裡改不了檔）。tune 以 `--proxy` 站在真的 `station.js serve` 前面；`station.js serve` 每次請求都重讀 `assets/station/` 的 css 與 js，不需要 `--rebuild`。

**Files:**
- Modify: `assets/station/station.js` — 使用者逐則請求的改動，只在 `sources` 指到的位置
- Modify: `assets/station/station.css` — 同上
- Modify: `docs/station.md` — docs-check 報的行號
- Modify: `TODO.md` — 刪 `## Ready` 的〔station〕回放那條
- Read: `scripts/tune.js` — `serve --proxy`、`wait`、`done`
- Read: `docs/archive/2026-09-24-todo-four.md` — 第 2113–2139 行的步驟

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 在瀏覽器上看 station 的回放頁、用 Alt+click 點要改的元素並寫下要怎麼改，直到說好；每則改動由 implementer 做。

步驟：

1. 重啟 7817：`curl -s http://127.0.0.1:7817/station/health` 讀出 `pid`，`MSYS_NO_PATHCONV=1 taskkill /PID <pid> /F` 停掉（一個 detached 的 serve 手上是它啟動時的 `lib/`），再從 repo 根目錄背景跑 `node scripts/station.js serve --port 7817`，再 `curl -s http://127.0.0.1:7817/station/health` 確認 `pid` 與 `started` 是新的。
2. 背景跑 `node scripts/tune.js serve --proxy http://127.0.0.1:7817 --src assets/station/station.js,assets/station/station.css`，讀它印的 url。
3. 驗證：Playwright MCP 開那個 url，`browser_evaluate` 跑 `() => ({ sessions: (window.STATION && window.STATION.sessions || []).length, serve: !!(window.STATION && window.STATION.serve), overlay: !!document.querySelector('script[src="/__live/overlay.js"]') })`，要 `sessions > 0`、`serve: true`、`overlay: true`；等 7 秒再 `browser_network_requests`，經過 proxy 的 `station/station-data.js` 與 `station/health` 都是 200；開一個有派工與 gate 的 session 的 `#/s/<id>/events`，`() => document.querySelectorAll('[data-block="segment-header"]').length` 大於 0；一般 click 一個段頭，它照常收合。任何一項不成立就停，用 `AskUserQuestion` 把看到的原文給使用者。
4. 把 url 給使用者，說明 Alt+click 選任意元素、Alt+滾輪往父層，並列出回放頁上八個 `data-block`（`cost-strip`、`toc`、`filter-bar`、`segment-header`、`gate-pair`、`agent-dispatch`、`tool-collapsed`、`tool-output`）各一句它現在長怎樣。
5. 迴圈，直到使用者說好：`node scripts/tune.js wait` 印出下一則請求；派一個 implementer，`description` 以 `opus 5.5 · inherit: ` 開頭，模型是 `.fankeel/profile.json` 的 `design.mockup`（`opus`），prompt 寫明 `note`、`selector`、`classes`、`text`、`sources` 的每個 `file:line`，只能改 `assets/station/station.js` 與 `assets/station/station.css`；它回來後跑 `node scripts/tune.js done <id>`。被拒就把 stderr 原文與 `.fankeel/build/tune/<id>.diff.txt` 給同一個 implementer 再改一次。第一則收下之後，請使用者確認重載後只有那個元素變了，把使用者的原話記進提交訊息。
6. 使用者說好之後：停掉 tune serve；`rm -rf .playwright-mcp`；跑 `node --test tests/station-dispatch-view.test.js tests/station-view.test.js`、整套 `npm test`、`node scripts/docs-check.js`（照它印的修 `docs/station.md`）；派 implementer 刪 `TODO.md` 的〔station〕回放那條，跑 `node scripts/todo-check.js`。
7. 提交：`git commit -o assets/station/station.js assets/station/station.css docs/station.md TODO.md`，主旨 `fix: station 回放在真頁面上逐塊調整`，內文列出收下的每一則請求（`r-NNNN` 與 `note`）、被拒的次數，與第 5 步使用者確認的原話。使用者在 build 開頭選了「跳過」時，這個 task 不做，`TODO.md` 那條留著，ledger 記 `ruling`。

## Task 9: 記憶瘦身

設計 §6 第二條。使用者跑官方 `/doctor`；前後各跑一次 `node scripts/input-check.js`；`/doctor` 留下、`input-check` 仍報的重複、死連結、過大段落，在記憶目錄裡修掉。repo 的程式碼不改，只有 `TODO.md` 關一條。

**Files:**
- Modify: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel/memory/MEMORY.md` — 與它連到的記憶檔；`/doctor` 之後仍報的問題
- Modify: `TODO.md` — 刪 `## Needs a decision` 的〔memory〕那條
- Read: `scripts/input-check.js` — 報表格式：`duplicates`、`deadLinks`、`bigSections`
- Read: `scripts/memory-check.js` — 索引與目錄一致、引用的路徑還在

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 在這個 session 打 `/doctor`，照它的提示走完，做完說一聲；slash command 只有使用者能下。

步驟：

1. 之前：`mkdir -p .fankeel/build/2026-09-24-todo-clear`，跑 `node scripts/input-check.js > .fankeel/build/2026-09-24-todo-clear/input-check-before.txt; echo "exit $?" >> .fankeel/build/2026-09-24-todo-clear/input-check-before.txt`，再跑 `node scripts/memory-check.js`，讀兩者全文，記下 `MEMORY.md` 的 tok 數。
2. 請使用者在這個 session 打 `/doctor` 並照它走完；等使用者說做完。
3. 之後：同第 1 步，輸出到 `input-check-after.txt`；讀全文，列出仍被報的每一項（重複、死連結、過大段落），與 `/doctor` 之前的 tok 數並排。
4. 仍被報的每一項，派一個 implementer（`general-purpose`，`sonnet`）改記憶目錄 `C:/Users/Owner/.claude/projects/F--ymlab-fankeel/memory/` 裡對應的檔：重複的留一份並讓另一處連過去、死連結改成還在的路徑或刪掉那行、過大段落拆到它連出去的檔；`MEMORY.md` 每行仍是 `- [標題](檔名.md) — 一句`。一次一個檔，讀它的回報再派下一個。
5. 再跑一次第 1 步的兩個指令，輸出到 `input-check-final.txt`；`memory-check.js` exit 0，`input-check` 不再報第 3 步列的任何一項（仍報的逐項寫進回報並說明為什麼留著）。
6. 派 implementer 刪 `TODO.md` 的〔memory〕那條，跑 `node scripts/todo-check.js`；提交 `git commit -o TODO.md`，主旨 `docs: TODO 關掉記憶瘦身那條`，內文寫前、`/doctor` 後、修完三次的 `MEMORY.md` tok 數。記憶目錄不在 repo 裡，不提交。使用者選「跳過」時，這個 task 不做，`TODO.md` 那條留著，ledger 記 `ruling`。
