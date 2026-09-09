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
- design 的 mockup 步驟：frontend task 在 design 多一步 mockup，用 survey 的專案背景與 hallmark 類 skill；`when` 條件規則已落地，只差規則與 skill 文字 — [pipeline.md](docs/pipeline.md)、[design skill](skills/fankeel-design/SKILL.md).

## Needs a decision
- `dispatch.floor` 只有 skill 文字讀它：`lib/profile.js` 之外沒有程式碼強制，reader 派錯 model 不會被擋；要不要讓 `hooks/brief.js` 把 floor 注入 brief、或 `task.js` 在 dispatch 前檢查 — [subagents.md](docs/subagents.md).

- 結構不變量測試要斷言什麼：擋「多一個 md 就多一個 subagent」這類 auto-discovery 事故，但要釘的不變量本身還沒定；`skills-check.js` 釘的是 script 與 flag，不是這個 — [簡報 §2.5](docs/improvement-brief.md#25-三層閘門).

- skills 下一個 `registry.json` 與它的 schema：每個 stage 一筆；`## Waiting` 的 entry/stop condition、`prompt_byte_budget`、條件載入到節三條都以它為前置 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema).

- 校準規則與可失敗自檢測試：通則「每階段都設閘門會變跑步機」、衝突時 name both rules；build 的四件停止事改成「撤掉會不會變差」加豁免；16 行 pattern 以此為前置 — [簡報 §2.6](docs/improvement-brief.md#26-兩個-fankeel-直接缺的行為機制).

- design class：盤點與 prompt 已進 repo（§4.1 補記）；待決 route 與 ratchet 位置、軸鎖定檔格式、Mode 優先路由表、三個 stage skill 增修、prompt 的三個設計問題 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).

- A/B 量測的 provenance 要記幾條通道：`eval.js` 六條都落地了，但 `docs/reports/evidence/` 的 A/B 腳本只控 model 與 tools，其餘四條要不要寫進 provenance 檔 — [簡報 §5.3](docs/improvement-brief.md#53-六個污染控制第二部-21).

- 規則改寫成 pre-send check 形：每條配成因事實與 Bad/Good 範例、例外清單，「the constraint wins, the shape stays」；`lib/stages.js` 的規則哪幾條先改 — [簡報 §5.7](docs/improvement-brief.md#57-規則的五個成因與六個例外第三部-g1g2).

- eval 例外 case 集：每條例外條款一個 case、判準是分數不該動，baseline/candidate 成對跑；`evals/` 今天一個 case，要不要照這個形擴 — [簡報 §5.10](docs/improvement-brief.md#510-評測層的五個新項目第五部-53附錄-a10a14).

## Waiting

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-06.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-06.

- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two compared 09-04, byte-identical. lifts when: two types' briefs are seen to differ. 09-06.

- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI. lifts when: Claude Code ships one. 09-06.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-06.

- Whether an output style reaches a subagent — [lib/render.js](lib/render.js) forwards none; headless ignores `outputStyle`. lifts when: an interactive terminal can set one in `/config`. 09-07.

- `docs-audit` reads a fixture path in a code block as a deliverable — [scripts/docs-audit.js](scripts/docs-audit.js). lifts when: a second plan is held back by it. 09-07.

- `entry_condition` / `stop_condition` 進 registry：寫在 registry 能被檢查，寫在散文只能被讀 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema). lifts when: registry.json 落地. 09-08.

- 每 stage 一欄 `prompt_byte_budget` 與整體預算：注入 block「long on purpose」的唯一界線不可量測；caveman 給 560 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema). lifts when: registry.json 落地. 09-08.

- 條件載入到「節」的粒度：build 依 class 與有無 plan 載入不同段落，今天 spike 的 build 付 architectural 的 token — [簡報 §2.2](docs/improvement-brief.md#22-條件載入矩陣fankeel-最缺的那個機制). lifts when: registry.json 落地. 09-08.

- 16 行 pattern skill 的極簡形式：stage skill 較重且混了人類與模型兩種讀者；`surgical-patch` 證明 16 行夠 — [簡報 §1.4](docs/improvement-brief.md#14-16-行-pattern-skill-的極簡形式). lifts when: 自檢測試改寫落地. 09-08.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；fankeel 真正的阻礙是 hook 為 Claude Code 專屬 — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多). lifts when: 確認另一個 host 有等價 UserPromptSubmit 的 hook. 09-08.

- eval 進 CI：`.github/workflows` 一條，只在 push main 且限 skills/、evals/、manifest；永遠紅的 workflow 是噪音，所以等 — [README.md](README.md). lifts when: 本機 `claude plugin eval` 不再回 early access. 09-08.

- 五個 `lib/*.js` 沒有任何 reference-role 頁面點名：`fanout.js`、`hook.js`、`report.js`、`skills.js`、`tracked.js`；另外 20 個都有 — [docs/documents.md](docs/documents.md). lifts when: docs-audit 學會報未被點名的模組. 09-09.

- `evals/route-typo` 同一棵樹上分數會跳：09-08 兩次 2/3 與 3/3，09-09 一次 1/3；CI threshold 0.7 會擋掉三次裡的兩次 — [evals/route-typo/case.yaml](evals/route-typo/case.yaml). lifts when: 同一個 commit 連跑五次. 09-09.
