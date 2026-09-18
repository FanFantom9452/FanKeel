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
| `## Waiting` | something that is not a person: real use, upstream, or another entry landing | kept out of the menu — nothing here can move today |

Whoever defers a thing picks its heading, because they know at that moment which
of the three they are short of. A later reader has to guess.

A bullet may also open with a `〔word〕` prefix — `〔map〕`, `〔caveman〕`,
`〔station〕` and so on. It groups nothing the heading does not already
decide: it is there so bullets about one area sit together at a glance, and
it changes neither an entry's state nor what `/fankeel` offers. The heading
still answers what an entry is waiting for; the prefix only answers what it
is about, which is the question the heading is deliberately not asking.

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
`## Needs a decision`'s newest few are read aloud every time `/fankeel` offers a
menu, so those get looked at whether anyone meant to or not, and `## Waiting` is
deliberately skipped there. It is the section nothing makes you open, which is
why it is the one that has to say what it is waiting for and when you last
agreed it was.

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

- 〔release〕0.70.0 發版：HEAD 領先 `origin/main` 30 個 commit，裝著的副本凍在 `70771cd`，所以 N23 修好的 guard 箭頭誤判與 `lib/gates.js` 都沒在跑 — [scripts/version.js](scripts/version.js). 推送後要換終端機。

- 〔audit〕`docs-audit` 列的 43 對只有 `registry × station` 被讀過，其餘 42 對沒人開過——09-17 那次 audit 的 pair 那一半只走了一對 — [docs/documents.md](docs/documents.md). 一對一個 reader，四個一批。

## Needs a decision

- 〔lib〕`lib/skill-overlap.js` 只有一個 production caller，折進 `scripts/orient.js` 既不多帶依賴也不會把測試推到 spawn 後面 — [lib/skill-overlap.js](lib/skill-overlap.js). 待決：折進去、還是留著。（audit 2026-09-18，8 行）

- 〔scripts〕`scripts/station.js` 手寫 argv 迴圈，十五個 CLI 用 `node:util`；另一個手寫的 `scripts/survey.js` 有理由，station 的固定旗標沒有 — [scripts/station.js](scripts/station.js). 待決：換掉、還是留著。（audit 2026-09-18，5 行）

- 〔lib〕三處重複：`lib/usage.js` 兩個函式各自重寫 `entriesOf()`、`lib/registry.js` 四個三行三元式、`lib/live.js` 手工組 Set — [lib/usage.js](lib/usage.js). 待決：三處都收、只收 usage.js、還是都不動。（audit 2026-09-18，13 行）

- 〔registry〕136 筆 entry 沒有任何版本欄位，`burn`/`usage`/`spend`/`clock` 全部無法歸因到哪一版外掛 — [lib/registry.js](lib/registry.js). 待決：記 plugin version、記 gitCommitSha、還是兩個都記。

- 〔caveman〕20 skill 裡要吸收哪些：`caveman-stats` 由 hook 算真實 token、Native Core 六個流程 skill、`cavecrew` 的委派決策指南 — [docs/improvement-brief.md](docs/improvement-brief.md). 待決：挑哪些改寫成 fankeel 規則。

- 〔session〕堆疊手段：subagent 佔 token 從 30.7% 升到 53%，但回傳只佔工具輸出 7.6%、叫醒只佔主回合 7% — [docs/improvement-brief.md](docs/improvement-brief.md). 待決：§6.2 四個候選挑哪個。

- 〔docs〕`.fankeel/build/` 不在 `docs.json` 任何 bucket，不受任何檢查管，但一份任務的證據全在那裡 — [lib/docs.js](lib/docs.js). 待決：進 docs.json 當 fixture、只寫進 documents.md、還是維持不管。

- 〔skill〕三個唯讀 agent 都有 Bash，而 Bash 寫得了檔：`fankeel-reader`、`fankeel-judge`、`fankeel-reviewer` 沒有 Edit/Write 但有 Bash — [agents/fankeel-reader.md](agents/fankeel-reader.md). 待決：拿掉 Bash、靠 hook 擋、還是接受。

- 〔gates〕`gates` 只存 `{at, stage, header, picked}`，沒存全部選項；station 讀了 `labels` 但只餵「最常被換掉」統計 — [lib/gates.js](lib/gates.js). 待決：存全部選項、只存被換掉的、還是維持現狀。

- 〔memory〕102 條原生記憶裡 50 條引用的檔案在寫完之後改過；`memory-check` 只列不 fail，刪哪一條是使用者的決定 — [docs/documents.md](docs/documents.md). 待決：逐條看、只看引用最多的、還是不動。

- 〔docs〕`docs-check` 不驗 `path#fragment` 的錨點：`scripts/docs-check.js:37` 的 LINK regex 片段群組是 non-capturing 且丟棄，`:180` 只跳過裸 `#...`，所以綠只證明檔案在 — [docs/documents.md](docs/documents.md). 待決：加上錨點解析、還是明寫這個界線。

## Waiting

- 〔build〕knip 的 unused exports 一格關著：6.32.2 認不得 CJS namespace 取用，開著回 146 個假陽性 — [docs/development.md](docs/development.md). lifts when: knip 認得 CJS namespace property access. 09-13.

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-14.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-14.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-14.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；fankeel 真正的阻礙是 hook 為 Claude Code 專屬 — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多). lifts when: 確認另一個 host 有等價 UserPromptSubmit 的 hook. 09-15.

- 五個 `lib/*.js` 沒有任何 reference-role 頁面點名：`fanout.js`、`hook.js`、`report.js`、`skills.js`、`tracked.js`；另外 20 個都有 — [docs/documents.md](docs/documents.md). lifts when: docs-audit 學會報未被點名的模組. 09-09.

- `judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript — [scripts/judge.js](scripts/judge.js). lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-09.

- `lib/skills.js` 的 `acceptedFlags` 讀不到 `scripts/judge.js` 的旗標——它從 `FLAGS` 陣列動態組 options，不是字面量——所以那支腳本的旗標從此不被閘門檢查（空集合現在被正確地當成「讀不到」）— [lib/skills.js](lib/skills.js). lifts when: 第二支腳本用同樣的形狀宣告旗標. 09-09.

- design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務). lifts when: 下一個前端任務出現. 09-18.

- todo-check 不驗 `path:line` 的行號：改成不存在的行仍然 exit 0 — [scripts/todo-check.js](scripts/todo-check.js). docs-check 補得到一部分，但卡 role、引文與讀得到目標三個前提。lifts when: 一條沒帶引文的行內容漂移. 09-15.

- 〔session〕`hooks/size.js` 留不留：改前 bigPerSession 0.3846；hook 上線後十個 session 用 `sessions.js --since 2026-09-11` 再量，沒降就移除 — [hooks/size.js](hooks/size.js). lifts when: 十個 session 帶著 hook 跑完. 09-11.

- 〔caveman〕解除安裝：程式碼零硬依賴，`settings.json` 的 `enabledPlugins` 09-15 已設 false，兩個反向測試守著 — [tests/badge.test.js](tests/badge.test.js). lifts when: 〔caveman〕挑功能那條定案. 09-18.

- 〔gates〕第一筆 `gates` 資料：程式碼 2026-09-18T00:18 落地，136 筆 entry 目前 0 筆有它 — [lib/gates.js](lib/gates.js). lifts when: 0.70.0 裝好、換終端機後有 session 正常結束. 09-18.
