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
| `## Needs a decision` | a person, to settle what the change should be | one task each, starting at `design` |
| `## Waiting` | something that is not a person: real use, upstream, or another entry landing | kept out of the menu — nothing here can move today |

Whoever defers a thing picks its heading, because they know at that moment which
of the three they are short of. A later reader has to guess.

An entry under `## Waiting` carries two things at its end, in this order:
`lifts when: <the event>`, and then a `MM-DD` stamp. The event is what would make
the entry actionable — real use, upstream, or another entry landing — and it is
the one that says whether the entry belongs under this heading at all. On
2026-09-06 twelve of the thirteen entries here named no event anybody could
write down, and four of those twelve turned out to be waiting on nothing that
was ever going to arrive. The stamp is **the day somebody last read it and
agreed it is still waiting**, not the day it was filed: re-read one, decide it
is still blocked, and move the stamp forward in the same change. The stamp goes
last, because that is where the check looks for it.

This is the only heading that asks for either. `## Ready` and
`## Needs a decision` are read aloud every time `/fankeel` offers a menu, so they
get looked at whether anyone meant to or not, and `## Waiting` is deliberately
skipped there. It is the section nothing makes you open, which is why it is the
one that has to say what it is waiting for and when you last agreed it was.

`node scripts/todo-check.js` enforces all six: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, an entry
under any other heading is one nobody said the state of, a `## Waiting` entry
with no stamp is one nobody can tell a fresh deferral from a forgotten one, and a
`## Waiting` entry with no `lifts when:` is one nobody is waiting for.

It also prints, without failing the run, the event of every `## Waiting` entry
whose stamp is seven days or older — so what you are asked is whether that event
has happened, which is a question about the world rather than about you. That
list is not a defect report: an entry can sit there correctly filed for a month.
Before the event was written down this printed the entry itself, and in this
repository's whole history `## Waiting` had never once shrunk by the thing an
entry waited for actually happening. It shrank when somebody read it.

## Ready

## Needs a decision

- 〔docs〕`path:N-M` 範圍引用對 `docs-check` 完全隱形：`PATHISH` 不收範圍，既不檢查也不列為「無引文」 — [docs/documents.md](docs/documents.md). reference 角色還剩 5 條。教它讀範圍要先定義範圍「持有」什麼；改單行則會把描述整個區塊的散文弄壞，本分支收窄 `defects()` 那條時就發生過一次。

- 〔audit〕drift 一律假設頁面過期（`scripts/docs-audit.js:417` `1. Drift.`），但 code 也會有邏輯錯誤，文件才是最後的依據。要定 drift 怎麼同時列出「頁過期」與「code 退化」兩個方向 — [scripts/docs-audit.js](scripts/docs-audit.js).

- 〔caveman〕逐項盤點 20 skill、3 agent、6 command、2 hook，和你討論要哪些：要的改寫成 fankeel 規則，不裝它的 skill；定案後拆成 Ready 條目 — [簡報 §6.4](docs/improvement-brief.md#64-caveman-去依賴). §1.5 已列六項。

- 〔memory〕原生 memory 只寫不清：錯的或過期的條目沒有東西重驗，本專案 MEMORY.md 有 76 條，多數引檔名、旗標、行號或量測數字。要定清理機制的形狀 — [簡報 §6.1](docs/improvement-brief.md#61-memory-清理).

- 〔session〕主 session 堆疊約九成來自主迴圈自己的工具輸出，subagent 回傳只佔 8–9%；15/153 個 session 有 stage 倒退（verify>build 29 次）。要定 custom agent 以外的手段 — [簡報 §6.2](docs/improvement-brief.md#62-session-堆疊).

- 〔station〕單一 session 的細節：plan 有幾個 task、各做什麼、主 agent 怎麼切派工（agent/agents/workflow）、stage 來回、哪段可以平行；`lib/station.js` 一樣都沒讀 — [簡報 §6.3](docs/improvement-brief.md#63-station-單-session).

- 〔todo〕分群要不要改用 `###`：`todo-check.js:174` 任何標題都會重設 section，`INIT` 只認三個 `##`，:55 明說不按主題分；要改就動兩處 — [scripts/todo-check.js](scripts/todo-check.js). 目前以〔群組〕前綴代替。

## Waiting

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-06.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-06.

- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two compared 09-04, byte-identical. lifts when: two types' briefs are seen to differ. 09-06.

- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI. lifts when: Claude Code ships one. 09-06.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-06.

- Whether an output style reaches a subagent — [lib/render.js](lib/render.js) forwards none; headless ignores `outputStyle`. lifts when: an interactive terminal can set one in `/config`. 09-07.

- `docs-audit` reads a fixture path in a code block as a deliverable — [scripts/docs-audit.js](scripts/docs-audit.js). lifts when: a second plan is held back by it. 09-07.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；fankeel 真正的阻礙是 hook 為 Claude Code 專屬 — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多). lifts when: 確認另一個 host 有等價 UserPromptSubmit 的 hook. 09-08.

- eval 進 CI：`.github/workflows` 一條，只在 push main 且限 skills/、evals/、manifest；永遠紅的 workflow 是噪音，所以等 — [docs/evals.md](docs/evals.md). lifts when: 本機 `claude plugin eval` 不再回 early access. 09-08.

- 五個 `lib/*.js` 沒有任何 reference-role 頁面點名：`fanout.js`、`hook.js`、`report.js`、`skills.js`、`tracked.js`；另外 20 個都有 — [docs/documents.md](docs/documents.md). lifts when: docs-audit 學會報未被點名的模組. 09-09.

- `evals/route-typo` 同一棵樹上分數會跳：09-08 兩次 2/3 與 3/3，09-09 一次 1/3；CI threshold 0.7 會擋掉三次裡的兩次 — [evals/route-typo/case.yaml](evals/route-typo/case.yaml). lifts when: 同一個 commit 連跑五次. 09-09.

- `judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript — [scripts/judge.js](scripts/judge.js). lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-09.

- `lib/skills.js` 的 `acceptedFlags` 讀不到 `scripts/judge.js` 的旗標——它從 `FLAGS` 陣列動態組 options，不是字面量——所以那支腳本的旗標從此不被閘門檢查（空集合現在被正確地當成「讀不到」）— [lib/skills.js](lib/skills.js). lifts when: 第二支腳本用同樣的形狀宣告旗標. 09-09.

- design class：mockup 已落地，其餘是另一個 architectural 任務 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務). lifts when: 下一個前端任務出現，執行 `docs/plans/2026-09-09-design-class-prompt.md`. 09-10.

- `stage-skip-said` 是四個例外 case 裡唯一的真訊號，但 n=1 分不出 prompt 與模型 — [evals/stage-skip-said/case.yaml](evals/stage-skip-said/case.yaml). lifts when: 同一個 commit 用 opus 連跑五次，約 $2.8. 09-11.

- verify 與 build 的 rationale 沒拆完：沒人驗過模型會不會跟著 SKILL.md 的相對連結去讀 rationale.md，沒驗就搬等於丟掉理由 — [skills/fankeel-verify/SKILL.md](skills/fankeel-verify/SKILL.md). lifts when: 一次 headless 探測證實連結會被跟. 09-11.

- `permissions.deny` 是 docs/collisions.md 給操作者的那一步，但它在 `defaultMode: "auto"` 與 bypassPermissions 底下還生不生效沒人驗過 — [docs/collisions.md](docs/collisions.md). lifts when: 一次探測證實它在 auto 模式下確實攔得住. 09-11.

- `--allowedTools` 吃哪個拼法沒人驗過：CLI 註冊表叫 `Task`，真實派工記成 `Agent`，兩種各跑過一次都沒派工 — [evals/subagent-no-entry/prompt.md](evals/subagent-no-entry/prompt.md). lifts when: 一次強制派工的跑動分出哪個拼法開得起工具. 09-11.

- todo-check 不驗 `path:line` 的行號：改成一個不存在的行仍然 exit 0 且說「no stale citations」 — [scripts/todo-check.js](scripts/todo-check.js). TODO.md 不在任何 bucket，docs-check 也不看它，兩支都不檢查。lifts when: 有行號過期被抓到. 09-11.

- `skills/fankeel-audit/SKILL.md:113` 把「十條、五頁」寫死在 reference 頁裡，靠一個「today」撐著 — [skills/fankeel-audit/SKILL.md](skills/fankeel-audit/SKILL.md). 沒有東西會重算它。lifts when: 那兩個數字變了而這句沒變. 09-11.

- 〔caveman〕解耦：`lib/badge.js:166,181` 的註解、`tests/badge.test.js:134-141`、eval 用 `--setting-sources project` 的理由一起改 — [lib/badge.js](lib/badge.js). lifts when: §6.4 的取捨定案. 09-11.

- 〔ponytail〕深度分析：6 skill、3 hook，其中 SubagentStart 把整套規則塞進 fankeel 每個 subagent；audit 的程式碼那一半由誰接 — [簡報 §6.5](docs/improvement-brief.md#65-ponytail-去依賴). lifts when: caveman 兩條落地. 09-11.

- 〔ponytail〕解耦 `has('ponytail')`：`lib/render.js:108-110`、`lib/stages.js:352,441`、兩份 SKILL.md、三份測試；fallback 句已經在 — [lib/render.js](lib/render.js). lifts when: §6.5 定案. 09-11.
