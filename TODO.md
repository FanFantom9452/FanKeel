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
| `## Blocked` | something a session can check: a date, another piece of work, an upstream release | grouped under `### <timing>`; every timing listed; the patrol, always the last option, walks them |
| `## Watch` | an event only whoever meets it will know of: an incident happening again, a demand turning up | grouped under `### <timing>`; every timing listed; the patrol walks them and asks keep-or-drop of a stale one; whoever meets the event moves the entry out |

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
`orient` lists every Blocked and Watch timing each time, and `/fankeel` always offers
the patrol, `TODO 全表盤點`, as its last option.

`node scripts/todo-check.js` enforces every one of these: a link that no longer
resolves is an entry someone forgot to close, a `path:line` whose line is past
the end of the file is a citation the code moved out from under, a link that
still resolves but points at a plan, a decision record, a report or an archive is
the same entry one step earlier — those four roles record a moment rather than
the present — an entry over the length cap is detail written here instead of
where it belongs, an entry under any other heading — `## Waiting` included, which
`node scripts/todo-check.js --migrate` empties of every timing whose condition is
typed — is one nobody said the state of, an entry under `## Blocked` or `## Watch` under no
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

## Needs a decision

- 〔commit〕並行 build 的兩個洞：group 共用一份 `build-commit.md`，09-28 重送已提交的 tune 改動報 conflict；09-29 00:13 主樹被 `git reset` 回 4f180f58、吃掉 5846a00f，疑為 implementer 的 `reset --hard` 沒進 worktree — [lib/render.js](lib/render.js).
- 〔todo〕刪掉的條目沒留下結果：加一頁完成紀錄（原文、做了／量過不改／放棄、sha），`todo-check` 擋沒記的刪除；land 時讓使用者確認新條目的 heading — [scripts/todo-check.js](scripts/todo-check.js).
- 〔verify〕要不要把 lint／build 列成 verify 必過一關：先比對 AI-Native SDLC playbook 的 Triple-Check 與現有 verify，再決定 — [skills/fankeel-verify/SKILL.md](skills/fankeel-verify/SKILL.md).
- 〔plan〕要不要給 plan 加 Risks 欄：先比對 playbook 的 plan.md 範本與現有 plan，再決定 — [skills/fankeel-plan/SKILL.md](skills/fankeel-plan/SKILL.md).
- 〔review〕要不要支援專案自訂 `review.md`：先比對 playbook 的審查 SOP 與現有 reviewer lens，再決定 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
- 〔skills〕09-24 對照 addyosmani/agent-skills、mattpocock/skills 是 WebFetch 摘要、沒 clone，六個候選沒挑：clone 下來逐字重看，再和使用者逐條挑 — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md).
- 〔workflow〕要不要拿掉 Workflow、統一成 brain＋背景 agent：brain 沒有 Workflow，但 ledger groups 三個以上仍印 workflow；budget.js 也不量 subagents/workflows/ 底下的 agent — [lib/plantasks.js](lib/plantasks.js).
- 〔await〕09-28 build 的 group 號按派工順序編（1、2、3）不是 ledger group，await 三次指到舊 `build-g<n>.md`；做完的 brain 的 `inflight` 沒清，await 報 2 個在跑 — [scripts/await.js](scripts/await.js).
- 〔stage-agents〕brain 停掉時它的背景 implementer 還在跑，完成報告落到主控、沒人接：重派的 brain 又做一次 Task 8。要不要讓 brain 等完子 agent 才能交回 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
- 〔gate〕brain 寫的 `json gate` 直到主控問時才被 `hooks/gate.js` 擋（header 超寬、`next` 放進 question）：寫檔時就驗，或 `readGate` 報格式錯 — [lib/handoff.js](lib/handoff.js).

## Blocked

### fankeel 功能全部完成
after: fankeel 其餘功能都落地、使用者換到新機器測試. 09-28.

- 〔audit〕Trovara 的 docs 搬到 preset：在新機器的 Trovara 跑 `docs-move.js` 出搬移表、核可後 apply，再跑一次分批 `/fankeel-audit` — [scripts/docs-move.js](scripts/docs-move.js).

### gates 滿一週
on: 10-02 起，registry 的 `gates` 累積滿一週. 09-26.

- 〔profile〕`suggest` 只推 `land.*`：`class.default`、`design.mockup` 可以從 gate 答案推 — [lib/profile.js](lib/profile.js).

### 受控 build/verify 實跑
after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）. 09-28.

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
after: `tokenbar-usage.jsonl` 有跨過一次 7d reset 的真實讀數；09-25 查到的 347 行全落在 09-22 的 15 分鐘內，是測試資料，09-23 起沒再寫. 09-28.

- 〔quota〕7d 水位兩點差 4.7 倍，是延遲還是計別的：TokenBar 每次 render 已把 5h／7d 讀數 append 到 `<CLAUDE_CONFIG_DIR>/tokenbar-usage.jsonl`（TokenBar 的 `statusline.ps1`／`.sh`），拿第三點以後的序列來分 — [scripts/spend.js](scripts/spend.js).

### knip 認得 CJS namespace
upstream: knip 認得 CJS namespace property access. 09-28.

- 〔build〕knip 的 unused exports 一格關著：6.38.0 仍認不得 CJS namespace 取用，開著回 178 個假陽性（09-28 重跑） — [docs/development.md](docs/01-guide/development.md).

### AI CODING SECURITY 定案
upstream: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型. 09-26.

- 〔security〕reviewer 的 `## Security` lens 可先交本地模型篩（`security.local`）；四類清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).

## Watch

### 需要第十一種語言
if: a repository needs an eleventh language. 09-26.

- 〔survey〕Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human.

### 放行規則有沒有效
if: 放行規則存在下 no verdict 再發生一次. 09-28.

- 〔stage-agents〕已加規則 `Edit(/.fankeel/build/**)`，對照量測仍重現不出 no verdict，效果無法證明，見 `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` — [subagents.md](docs/90-agent/reference/subagents.md).

### 第二個平台的使用者
if: 出現第二個 host（Gemini CLI、Codex CLI 等）的使用者或 issue. 09-26.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；hook 對等只查過 Gemini CLI `BeforeAgent` 與 Codex CLI `UserPromptSubmit` 兩個 — [簡報 §2.7](docs/90-agent/reference/improvement-brief.md#27-多平台交付sepia-的做法便宜得多).

### 程式碼大到要查結構
if: 某個專案的程式碼大到 grep 加 read 找不到跨檔關係. 09-27.

- 〔survey〕graphify 可接為查詢工具；獨立實測未穩定省錢，接之前先解決它的 PreToolUse hook 擋 Read 與 guard 衝突、Windows 上 hook 靜默失效（其 issue #140） — [scripts/survey.js](scripts/survey.js).

### wizard-motion 再紅一次
if: `the chosen card animates, and under reduced motion nothing is running` 在整套裡再紅一次. 09-27.

- 〔tests〕09-27 四次整套紅兩次（2072/2073）、單跑 3/3 綠；之後整套 10 次全綠，沒抓到失敗訊息，紀錄在 `.fankeel/build/2026-09-27-five-items/flake.txt` — [tests/station-wizard-motion.test.js](tests/station-wizard-motion.test.js).

### build 五個 task 以上
if: 下一次有 5 個以上 task 的 build 開跑. 09-28.

- 〔station〕看第 7 段加的 station 欄位：沒有任何 subagent 的 context 峰值超過 450k（基準 f44b1c61 的 544k）、最貴的單一 subagent 佔 subagent 總花費低於 15%（基準 31%） — [station.md](docs/90-agent/reference/station.md).
