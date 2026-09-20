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
| `## Waiting` | something that is not a person: real use, upstream, or another entry landing | grouped under `### <timing>`; every timing listed, one option once any is due |

Whoever defers a thing picks its heading, because they know at that moment which
of the three they are short of. A later reader has to guess.

A bullet may also open with a `〔word〕` prefix — `〔map〕`, `〔caveman〕`,
`〔station〕` and so on. It groups nothing the heading does not already
decide: it is there so bullets about one area sit together at a glance, and
it changes neither an entry's state nor what `/fankeel` offers. The heading
still answers what an entry is waiting for; the prefix only answers what it
is about, which is the question the heading is deliberately not asking.
Under `## Waiting` a `###` is not a topic either: it is the timing its entries
wait for, and they lift together when it comes.

Under `## Waiting` entries sit beneath a `### <timing>` — a title at most 28
columns wide, a CJK character counting two — whose next line is
`lifts when: <the event>` and then a `MM-DD` stamp. The event is what would make
the entries actionable — real use, upstream, or another entry landing — and it
is the one that says whether they belong under this heading at all. On
2026-09-06 twelve of the thirteen entries here named no event anybody could
write down, and four of those twelve turned out to be waiting on nothing that
was ever going to arrive. An event that opens with an `MM-DD` is a date, and its
timing is due that day. The stamp is **the day somebody last read the timing and
agreed it is still waiting**, not the day it was filed: re-read one, decide it is
still blocked, and move the stamp forward in the same change. The stamp goes
last, because that is where the check looks for it.

This is the only heading that asks for a timing. `## Ready` and
`## Needs a decision`'s newest few are read aloud every time `/fankeel` offers a
menu, so those get looked at whether anyone meant to or not. `## Waiting` is the
section nothing made you open, which is why it has to say what it is waiting for
and when you last agreed it was — and why `orient` now lists every timing each
time, and `/fankeel` offers one option to handle them once any is due.

`node scripts/todo-check.js` enforces all nine: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, an entry
under any other heading is one nobody said the state of, a `## Waiting` entry
under no timing is one nobody said what it waits for, a timing with no stamp is
one nobody can tell a fresh deferral from a forgotten one, a timing with no
`lifts when:` is one nobody is waiting for, a timing with no entries is waiting
for nothing, and a title over 28 columns is a sentence where a name belongs.

It also prints, without failing the run, every timing that is due — its date has
come, or its stamp is seven days old — with its event, so what you are asked is
whether that event has happened, which is a question about the world rather than
about you. That list is not a defect report: a timing can sit there correctly
filed for a month. On 2026-09-18 two entries left because their events had
happened, and both were found by somebody reading the section rather than by the
event announcing itself. The section is drained by being read, so the reading is
what gets scheduled.

## Ready

- 〔tests〕「匯出而沒人 import」只在 `module.exports = {…}` 是檔尾最後一句時才檢查，`assets/station/station.js` 的匯出因此不受檢；station-live 的 Task 7 審查找到兩個漏網的 — [tests/source.test.js](tests/source.test.js).
- 〔docs〕`conflict()` 有四個 predicate，`read` 那個（`Read:` 擋鄰居的 `Modify`/`Test`）在 `docs/subagents.md`、`docs/collisions.md`、`docs/pipeline.md` 三頁都沒提，三頁各自只算到兩三個 — [lib/plantasks.js](lib/plantasks.js).

## Needs a decision

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；Gemini CLI `BeforeAgent`、Codex CLI `UserPromptSubmit` 也能回 `additionalContext` — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多).
- 〔stage-agents〕主控＋站 agent 要不要推到其餘各站：看 survey 的量測；build 要 script 產生 workflow、design 要 SendMessage 轉話、station 要把第二層掛在派它的 agent 底下（現在平鋪）、插話要有人接 — [lib/stages.js](lib/stages.js).
- 〔stage-agents〕survey 的大腦調過四輪後組內花費已打平（1.05×、0.97×），但時間仍 1.4–1.6 倍、主控 context 仍多 8k，交接檔守字數上限那一行沒生效：要再調，還是認定這樣就夠 — [lib/render.js](lib/render.js).
- 〔docs〕寫成 `path:行-行` 的引用不帶引文，docs-check 只列不驗：一條這樣歪了四個 commit 沒人發現。剩三條要改寫，還是讓 docs-check 把範圍本身當缺陷 — [scripts/docs-check.js](scripts/docs-check.js).

## Waiting

### gates 滿一週
lifts when: 09-25 起，registry 的 `gates` 累積滿一週. 09-18.

- 〔profile〕`suggest` 只推 `land.*`：`class.default`、`design.mockup` 可以從 gate 答案推 — [lib/profile.js](lib/profile.js).

### 第一次處理 Waiting
lifts when: 09-25 起，第一次在 `/fankeel` 選了處理 Waiting. 09-19.

- 〔fankeel〕看 survey 是否把只有人看得到的事件放進一次 `multiSelect` 問完、build 是否整批移走並換戳記 — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md).

### 交接後 context 仍過 400k
lifts when: 交接選項（簡報 §6.2）實施後 context 仍常過 400k. 09-18.

- 〔session〕極端版：driver 逐站開 headless session、狀態走檔案、關卡問題走 station，每站從零開始；缺總輪數、花費、時間上限與回報 `status` 欄位 — [scripts/station.js](scripts/station.js).

### docs-audit 報未點名模組
lifts when: docs-audit 學會報未被點名的模組. 09-18.

- 〔docs〕兩個 `lib/*.js` 沒有 reference-role 頁面點名：`hook.js`、`report.js`；09-09 記的五個裡另外三個後來被點到了 — [docs/documents.md](docs/documents.md).

### 行內容漂移一次
lifts when: 一條沒帶引文的行內容漂移. 09-18.

- 〔docs〕todo-check 不驗 `path:line` 的行號：改成不存在的行仍然 exit 0 — [scripts/todo-check.js](scripts/todo-check.js). docs-check 補得到一部分，但卡 role、引文與讀得到目標三個前提。

### 判官歸檔造假一次
lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-18.

- 〔judge〕`judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript — [scripts/judge.js](scripts/judge.js).

### 旗標被忽略一次
lifts when: a run is seen ignoring a flag. 09-18.

- 〔ledger〕Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it.

### fanoutSync 溢位一次
lifts when: a `fanoutSync` overflow is observed. 09-18.

- 〔lib〕Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js).

### 需要第十一種語言
lifts when: a repository needs an eleventh language. 09-18.

- 〔survey〕Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human.

### 下一個前端任務
lifts when: 下一個前端任務出現. 09-18.

- 〔design〕design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).

### knip 認得 CJS namespace
lifts when: knip 認得 CJS namespace property access. 09-18.

- 〔build〕knip 的 unused exports 一格關著：6.37.0 仍認不得 CJS namespace 取用，開著回 156 個假陽性（09-18 重跑） — [docs/development.md](docs/development.md).

### guard 測試再紅一次
lifts when: `a claim whose process is gone does not block` 在整套裡再紅一次. 09-19.

- 〔tests〕09-19 在 39efee9 整套紅過一次（1563/1564，已死的 pid 被當 live 而 deny），同樹重跑 1564/0、單跑 5/5 綠；疑 `deadPid()` 的 pid 在並行時被重用，未證實 — [tests/guard.test.js](tests/guard.test.js).
