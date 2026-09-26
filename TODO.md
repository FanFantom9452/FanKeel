# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

It is read twice. Once by whoever scans the list, and once by `/fankeel`, which
offers these entries clustered as the task options when a session starts. A
bullet nobody can understand on its own is a menu item nobody can pick.

The heading an entry sits under is its classification, and it answers one
question: **what is this still waiting for?** Not what it is about — topic groups
read well and answer the wrong question. What `/fankeel` needs to know is which
entries can become a task this morning, and two bullets about one file are as
often one that is ready and one that is still an argument.

| Heading | What it is waiting for | What `/fankeel` does with it |
|---|---|---|
| `## Ready` | nothing but someone's hands. The bullet is the specification | the whole section is offered as **one** task |
| `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one task each, starting at `design` |
| `## Blocked` | something a session can check: a date, another piece of work, an upstream release | grouped under `### <timing>`; every timing listed; a due one earns the patrol option |
| `## Watch` | an event only whoever meets it will know of: an incident happening again, a demand turning up | grouped under `### <timing>`; every timing listed; a stale one earns the patrol option; whoever meets the event moves the entry out |

Whoever defers a thing picks its heading, because they know at that moment which
of the four they are short of. A later reader has to guess.

A bullet may also open with a `〔word〕` prefix — `〔map〕`, `〔caveman〕`,
`〔station〕` and so on. It groups nothing the heading does not already
decide: it is there so bullets about one area sit together at a glance, and
it changes neither an entry's state nor what `/fankeel` offers. The heading
still answers what an entry is waiting for; the prefix only answers what it
is about, which is the question the heading is deliberately not asking.
Under `## Blocked` and `## Watch` a `###` is not a topic either: it is the timing
its entries wait for, and they lift together when it comes.

Under `## Blocked` and `## Watch` entries sit beneath a `### <timing>` — a title
at most 28 columns wide, a CJK character counting two — whose next line is a
typed condition and then a `MM-DD` stamp. Under `## Blocked` the condition is one
a session can check: `on: MM-DD` for a date, `after: <another piece of work>`, or
`upstream: <a release or project outside this one>`. Under `## Watch` it is
`if: <the event>` — an incident happening again, a demand turning up — which
nobody can check and only whoever meets it will know of. On 2026-09-27 a patrol
of the old `## Waiting` found sixteen timings of this second kind: the only
question it could ask of them was whether they had happened, and nobody could
answer. The stamp is **the day somebody last read the timing and agreed it still
holds**, not the day it was filed: re-read one, decide it stays, and move the
stamp forward in the same change. The stamp goes last, because that is where the
check looks for it.

A Blocked `on:` is due that day; an `after:` or `upstream:` is due once its stamp
is seven days old, and the patrol's survey goes and checks it. A Watch timing is
never due. Once its stamp is sixty days old it is stale, and the patrol asks only
whether to keep it — kept, the stamp moves forward; dropped, it goes. When a
session meets the event an `if:` names, that session moves the entry to
`## Ready` or `## Needs a decision` itself and drops the `###` and the `if:` line.
`## Ready` and `## Needs a decision`'s newest few are read aloud every time
`/fankeel` offers a menu, so those get looked at whether anyone meant to or not;
`orient` lists every Blocked and Watch timing each time, and `/fankeel` offers
one patrol option whenever any is due or stale.

`node scripts/todo-check.js` enforces every one of these: a link that no longer
resolves is an entry someone forgot to close, a `path:line` whose line is past
the end of the file is a citation the code moved out from under, a link that
still resolves but points at a plan, a decision record, a report or an archive is
the same entry one step earlier — those four roles record a moment rather than
the present — an entry over the length cap is detail written here instead of
where it belongs, an entry under any other heading — `## Waiting` included — is
one nobody said the state of, an entry under `## Blocked` or `## Watch` under no
timing is one nobody said what it waits for, a timing with no stamp is one nobody
can tell a fresh deferral from a forgotten one, a timing with no condition is one
nobody is waiting for, a condition under the wrong heading is a misfiled one, an
`on:` with no `MM-DD` after it is a date nobody can compare, a timing with no
entries is waiting for nothing, and a title over 28 columns is a sentence where a
name belongs.

It also prints, without failing the run, every Blocked timing that is due and
every Watch timing that is stale. Neither list is a defect report: a timing can
sit there correctly filed for a month. The sections are drained by being read, so
the reading is what gets scheduled.

## Ready

- 〔audit〕Trovara 的 docs 搬到 preset：在 Trovara 跑 `docs-move.js` 出搬移表、核可後 apply，再跑一次分批 `/fankeel-audit`（機制與 fankeel 自己的搬移已於 09-26 落地）— [scripts/docs-move.js](scripts/docs-move.js).
- 〔station〕「進行中」（`#/live`）的 card 改版第二步已核准但還沒做 — [docs/station.md](docs/90-agent/reference/station.md).

## Needs a decision

- 〔stage-agents〕ab.sh 改成在 worktree 裡 commit profile（`pin.sh`）；修好的 script 還沒重跑，重跑要核准約 $30 — [ab.sh](docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh).

## Blocked

### gates 滿一週
on: 10-02 起，registry 的 `gates` 累積滿一週. 09-26.

- 〔profile〕`suggest` 只推 `land.*`：`class.default`、`design.mockup` 可以從 gate 答案推 — [lib/profile.js](lib/profile.js).

### 交接後 context 仍過 400k
after: 交接選項（簡報 §6.2）實施後 context 仍常過 400k. 09-26.

- 〔session〕極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位 — [scripts/station.js](scripts/station.js).

### docs-audit 報未點名模組
after: docs-audit 學會報未被點名的模組. 09-26.

- 〔docs〕兩個 `lib/*.js` 沒有 reference-role 頁面點名：`hook.js`、`report.js`；09-09 記的五個裡另外三個後來被點到了 — [docs/documents.md](docs/90-agent/reference/documents.md).

### brain 的 context 撐不住
after: `scripts/ctx.js` 量到 build 或 verify 的站 agent 自己的 context 過 400k（`lib/context.js` 的線）. 09-26.

- 〔stage-agents〕站 agent 拿不到 `Workflow` 工具，所以 build 那一站的 workflow 要由 script 從 plan 的分組產生、主控用 `scriptPath` 開；分組與 surface 由 `ledger.js groups` 算好了 — [lib/plantasks.js](lib/plantasks.js).

### 受控 build/verify 實跑
after: main 已 push（08c4ecf 起），新 terminal 更新插件到 0.76.0 以後，並跑過一次 stage.agents=all 的真實 task. 09-26.

- 〔stage-agents〕安裝版還沒這次改動、本 session 的 hook 也釘死在 0.74.0，都量不了：新 terminal 更新插件、`stage.agents` 設 all、跑真實 task，用 `ctx.js --by-stage` 與 `modelUsage` 讀 — [subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕design 站跨輪對話已寫（`lib/stages.js` 的 `controlFor`）但沒實跑；build 每個 task 的提交要經 controller 兩回合，省不省 context 由同一次實跑的 `ctx.js --by-stage` 讀 — [lib/stages.js](lib/stages.js).
- 〔stage-agents〕接縫「站 agent 做不到的事」：受控 build 開跑時看 brain 在 main 上有沒有先問同意、開 worktree、加 TODO 行、續用同一個 implementer — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕接縫「第二個 agent」：gate 選 option one 以外、主控 SendMessage 同一個 agent 時看 `inflight` 是否已清；殺掉 agent 後看標記留多久 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕接縫「profile 中途翻轉」：受控站跑到一半在站頁套 preset，看下一次 inject、brief、gate、resume、guard 各做了什麼 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕接縫「記帳」：受控 build 後查續用的 agent 是否一次派工一則 notification、續用會不會重發 brief、transcript 留的是不是佔位題 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕接縫「claims」：受控 verify 的 mutation 編輯之後，看另一個 live session 會不會被報撞檔 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕接縫「在哪提交」：task 的 `project` 不是 cwd、或在 worktree 裡時跑受控 build，看 `scripts/commit.js` 提交到哪個 repo — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔stage-agents〕verify 的 mutation 要不要專屬 agent（工具或模型跟 fankeel-brain 不同才拆）；等受控 verify 實跑、k 重跑後再定 — [docs/subagents.md](docs/90-agent/reference/subagents.md).

### TokenBar 寫出真實序列
after: `tokenbar-usage.jsonl` 有跨過一次 7d reset 的真實讀數；09-25 查到的 347 行全落在 09-22 的 15 分鐘內，是測試資料，09-23 起沒再寫. 09-26.

- 〔quota〕7d 水位兩點差 4.7 倍，是延遲還是計別的：TokenBar 每次 render 已把 5h／7d 讀數 append 到 `<CLAUDE_CONFIG_DIR>/tokenbar-usage.jsonl`（TokenBar 的 `statusline.ps1`／`.sh`），拿第三點以後的序列來分 — [scripts/spend.js](scripts/spend.js).

### knip 認得 CJS namespace
upstream: knip 認得 CJS namespace property access. 09-26.

- 〔build〕knip 的 unused exports 一格關著：6.37.0 仍認不得 CJS namespace 取用，開著回 156 個假陽性（09-18 重跑） — [docs/development.md](docs/01-guide/development.md).

### AI CODING SECURITY 定案
upstream: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型. 09-26.

- 〔security〕reviewer 的 `## Security` lens 可先交本地模型篩（`security.local`）；四類清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).

## Watch

### 需要第十一種語言
if: a repository needs an eleventh language. 09-26.

- 〔survey〕Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human.

### 下一個前端任務
if: 下一個前端任務出現. 09-26.

- 〔design〕design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報 — [簡報 §4.1](docs/90-agent/reference/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).

### guard 測試再紅一次
if: `a claim whose process is gone does not block` 在整套裡再紅一次. 09-26.

- 〔tests〕09-19 在 39efee9 整套紅過一次（1563/1564，已死的 pid 被當 live 而 deny），同樹重跑 1564/0、單跑 5/5 綠；疑 `deadPid()` 的 pid 在並行時被重用，未證實 — [tests/guard.test.js](tests/guard.test.js).

### 放行規則有沒有效
if: 放行規則存在下 no verdict 再發生一次. 09-26.

- 〔stage-agents〕auto mode 曾對站 agent／implementer 的 Write／Edit 回 no verdict（09-22 六次以上）；已加規則 `Edit(/.fankeel/build/**)`，但放行前後探測都成功，證不出效果；再發生時查有沒有被讀到 — [subagents.md](docs/90-agent/reference/subagents.md).

### 第二個平台的使用者
if: 出現第二個 host（Gemini CLI、Codex CLI 等）的使用者或 issue. 09-26.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；hook 對等只查過 Gemini CLI `BeforeAgent` 與 Codex CLI `UserPromptSubmit` 兩個 — [簡報 §2.7](docs/90-agent/reference/improvement-brief.md#27-多平台交付sepia-的做法便宜得多).

### sonnet 花費成瓶頸或要離線
if: 渲染審查的 sonnet 花費成了瓶頸，或需要離線跑. 09-26.

- 〔render〕本地判斷模型當渲染審查前的篩子：moondream2（`ollama run moondream`）判畫面是否正常、UI-TARS 驅動頁面；兩者都沒在本機試過，Jev 是雲端不吃圖 — [agents/fankeel-render-reviewer.md](agents/fankeel-render-reviewer.md).

### implementer 互相蓋檔
if: 共用樹上出現一次 implementer 蓋掉另一個 implementer 的改動. 09-26.

- 〔build〕ready-queue 的 worktree 那一半：每個 implementer 各開 worktree、由 brain merge；`scripts/commit.js` 認不得 worktree、brain 不能 `git commit`，兩者都得先改 — [docs/subagents.md](docs/90-agent/reference/subagents.md).

### 站頁介面只有中文
if: 有使用者需要非中文的 station 介面出現. 09-26.

- 〔station〕assets/station/station.js 與 station.css 的介面文字（約 519 行 UI 字串）目前只有中文，沒有 i18n 機制 — [docs/station.md](docs/90-agent/reference/station.md).

### 文件全文搜尋有人要
if: 有人要 文件 頁的全文搜尋. 09-26.

- 〔station〕文件頁只讀 map.js 算好的統計卡，沒有全文搜尋；要做的話得加一個 server-side 的搜尋 payload — [docs/station.md](docs/90-agent/reference/station.md).

### 首次繪圖變慢一次
if: station-data.js 每次請求重算拖慢首次繪圖一次. 09-26.

- 〔station〕station-data.js 每個請求都重算，沒有 server cache；量到首次繪圖變慢時，加一個伺服端快取 — [lib/station.js](lib/station.js).

### gate 等待時間量不準
if: dashboard 的等你回答量到不準的等待時間一次. 09-26.

- 〔station〕dashboard 的『等你回答』卡片算等待時間，但 lib/handoff.js 沒留下 gate 的 `at`，量出來不是真的等待起點 — [lib/handoff.js](lib/handoff.js).

### tune 還原誤刪一次
if: tune.js done 在 live 模式又因為 untracked 檔誤還原一次改動. 09-26.

- 〔build〕tune.js 的 live 模式 `done` 在 --src 出現 untracked 檔（例如 .playwright-mcp）時會連它一起還原；09-24 這樣悄悄清掉過一次 r-0017 — [scripts/tune.js](scripts/tune.js).

### 即時 session 缺 subagent
if: 有人需要在即時 session 上看到進行中的 subagent. 09-26.

- 〔station〕station 讀不到 live session 的 subagent：只讀 leave.js 寫的 usage，不讀 subagents/*.meta.json 與 inflight 標記 — [lib/station.js](lib/station.js).

### git mv 漏一半提交
if: 出現一次 git mv 需要連刪除一起提交. 09-26.

- 〔build〕scripts/commit.js 加不了 git mv 的刪除那一半 — [scripts/commit.js](scripts/commit.js).

### 兩個 hook 逾時
if: UserPromptSubmit 或 PreToolUse Bash guard 再逾時一次. 09-26.

- 〔hooks〕/doctor 09-25 報 UserPromptSubmit 逾時 4/4 次（中位數 7.9s）、PreToolUse:Bash scope guard 逾時 2/2 次（50 個 session 裡） — [hooks/brief.js](hooks/brief.js).
