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

- 〔test〕`tests/memory-check.test.js` 一次 `npm test` 漏 22 個暫存目錄（4 個是 git repo），從不清：09-15 掃到 2689 個、共 39M。`tests/tmp.js` 已經有會清的 helper — [tests/tmp.js](tests/tmp.js).

- 〔docs〕兩條引用指到不相干的內容，改文件前就如此：`docs/judgements/2026-09-10-total-budget.md:34`、`docs/reports/2026-09-02-process-state-review.md:123` — [docs/documents.md](docs/documents.md).

- 〔station〕session 詳情頁沒有 profile 卡：首頁、專案頁與清單頁三處都有 `profileCard()`，`docs/station.md:618` `No session view carries a **profile** card` 記著這是缺項而非缺陷 — [docs/station.md](docs/station.md).

## Needs a decision

- 〔subagent〕Agent 的 `fork` 繼承整份 context、忽略 model 覆寫，和派工要縮 context、壓 `sonnet` 底線正面衝突（跟 SessionStart 那個 `fork` 不同東西） — [docs/subagents.md](docs/subagents.md). 待決：寫成明文不用、還是留白。

- 〔docs〕`docs/judgements/2026-09-10-section-loading.md:73` 引的測試比它說擋住的兩次事故晚一週才加，但 judgements 是寫完不改的區 — [docs/documents.md](docs/documents.md). 待決：改判斷頁、加勘誤頁、還是放著。

- 〔survey〕Grep 慢的不是搜尋是回傳：442 檔全庫 0.099 秒，吐回 196KB。`survey.js` 有 25 列上限，reader 直接用 Grep 工具繞過它 — [scripts/survey.js](scripts/survey.js). 待決：reader 改走 survey.js、Grep 加回傳上限、還是縮 `docs/archive`。

- 〔fankeel〕每個 stage 與每次問使用者都該留下可回看的紀錄：現在只有 `moves` 的 `[stage, at]` 與 `burn`/`clock` 的數字 — [docs/registry.md](docs/registry.md). 待決：放 registry 還是資料檔、gate 存問題與選項還是只存結果、與下面 stage 紀錄那條合併還是各自做。

- 〔plan〕被派工的任務步驟寫「跑 `node --test`，全綠」，但 brief footer 只准跑自己那支，footer 贏 —— 本計畫 Task 5 因此漏了七個檔 — [skills/fankeel-plan/SKILL.md](skills/fankeel-plan/SKILL.md). 待決：footer 放寬、步驟改口、還是 Files block 規則要求宣告那些檔。

- 〔station〕stage 的紀錄只剩數字：`moves` 存 `[stage, at]`，`burn`/`clock` 存 token 與毫秒，回看不出為何這樣走 — [docs/station.md](docs/station.md). 待決：跳階與 reroute 的理由存不存、存 registry 還是資料檔、合成一頁還是掛 session 詳情。

- 〔subagent〕per-`agent_type` 的 brief：`lib/render.js:363` 已給 `fankeel-judge` 一行別人沒的規則，1189 對 1045 字元 — [lib/render.js](lib/render.js). 待決：每 type 一段、只留這特例、或改按能力宣告。

- 〔docs〕fence 裡的 fixture 路徑被當成沒交付，記錄這 quirk 的兩個 todo-thirteen 檔自己卡在 landed 外 — [scripts/docs-audit.js](scripts/docs-audit.js). 待決：fence 不算、加 `fixture:`、或只認 Files block。

- 〔docs〕`docs/improvement-brief.md` 沒有 `status:` 鍵，`lib/docs.js` 把缺鍵當成宣稱現況，backlog 被當 live reference — [docs/documents.md](docs/documents.md). 待決：標 design-intent、搬 reports/、或缺鍵改成失敗。

- 〔eval〕eval 進 CI 的阻礙沒了：2026-09-15 空目錄探測回 `No eval cases found`，early access 已開 — [docs/evals.md](docs/evals.md). 待決：threshold 訂多少（`route-typo` 三次 2/3、3/3、1/3）、只跑 push main、還是等分數穩。

- 〔todo〕`## Waiting` 十六條沒有機制判斷何時能動：`lifts when:` 是給人讀的句子，todo-check 只在戳記滿七天才印出來，今天最舊的差六天，一條都沒印 — [scripts/todo-check.js](scripts/todo-check.js). 待決：門檻降到幾天、改成可執行的判斷、還是排程複查。

- 〔subagent〕主 agent 被呼叫太多次：每個 background 或 workflow agent 回報都讓主 agent 再跑一輪、重送整份 context，成本隨堆疊放大；本週三種 agent 用量已拉平 — [docs/subagents.md](docs/subagents.md). 待決：回報改成寫檔只回路徑、提高派工門檻、還是一次收攏多個回報。

- 〔skill〕`rationale.md` 模型到不了：build、plan、audit 三個 SKILL.md 的相對連結，haiku 與 sonnet 四次沒一次去開 — [skills/fankeel-build/rationale.md](skills/fankeel-build/rationale.md). 待決：併回、改注入、或接受。

- 〔eval〕`stage-skip-said` 六次全 1/2，`says-which-stages-skipped` 一次沒過，是真訊號不是雜訊 — [evals/stage-skip-said/case.yaml](evals/stage-skip-said/case.yaml). 待決：改 skill、改 grader 判準、或標 design-intent。

- 〔eval〕`scripts/eval.js` 把 `allowed_tools` 組成 `--allowedTools`，但那支旗標不限制 `Agent` — [evals/subagent-no-entry/prompt.md](evals/subagent-no-entry/prompt.md). 待決：改用 `--disallowedTools`、還是拿掉宣告。

- 〔memory〕`memory-check.js` 列出 39 條引用的檔案已改過卻 exit 0，也沒有任何清理路徑 — [docs/improvement-brief.md](docs/improvement-brief.md). 待決：誰觸發、stale 要不要 fail、誰刪。

- 〔memory〕memory 的四個 type 不帶生命週期：57 條 `feedback` 裡一次性修正與長效規則混在一起，沒有欄位分得出來 — [docs/documents.md](docs/documents.md). 待決：比照 docs 的 role 加壽命、加 `last_verified`、還是不分。

- 〔registry〕131 個 session 只有 44 個有 `usage`、16 個有 `moves`，個別 session 分析看不到其餘三分之二 — [docs/registry.md](docs/registry.md). 待決：每個 stage 都寫、prompt hook 寫、還是接受。

- 〔registry〕`moves` 逐次記 stage 倒退、`burn` 每個 stage 只留首尾兩點，切不出單次倒退的成本：7 個 session 共 11 次 verify 回 build — [docs/registry.md](docs/registry.md). 待決：`burn` 改逐次記、倒退另記一欄、還是只報次數。

- 〔registry〕沒有欄位數得出「一次背景回報等於主 agent 重跑一輪」：`usage.subagents.agents` 是跑過幾個 agent，`usage.requests` 是主 session 發了幾輪 — [lib/usage.js](lib/usage.js). 待決：加欄位記、從 transcript 事後算、還是不記。

- 〔station〕token 用量要主動去查：`lib/usage.js` 的 `summarise` 讀 transcript 既有欄位、模型不算，但頁面與三支腳本都要人先去跑 — [lib/usage.js](lib/usage.js). 待決：比照 `caveman-stats` 做成 hook 當場給、維持現狀、還是兩者都要。

- 〔dashboard〕station 的畫面沒有用任何外部 skill：mockup 由 `design.mockup` 指定的模型畫、人核准後 implementer 逐項搬 — [lib/profile.js](lib/profile.js). 待決：把 dashboard 生成做成可重複流程、還是留在 design 階段通例。

- 〔subagent〕`lib/guard.js` 的 `WRITE_PATTERNS` 第一條把箭頭函式當成寫檔：reader、reviewer、judge 三型 subagent 的 Bash 因此擋掉 `x => y`，加 `> /dev/null` 也無效 — [lib/guard.js](lib/guard.js). 待決：regex 加排除、改判 shell 語法、還是接受。

- 〔todo〕`## Needs a decision` 25 條但 init 選單一條一個選項、`AskUserQuestion` 上限 4 而 Ready 佔一個，每次只排得進三條 — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md). 待決：分頁、改成分群、還是只提供最近的幾條。

- 〔profile〕使用者的 `CLAUDE.md` 是每輪重送的前綴，fankeel 沒東西量它：Trovara 實測兩層佔一輪 9,894 tokens，瘦身後每輪省 683 — [lib/profile.js](lib/profile.js). 待決：開頭一律問還是過門檻才問、衝突比對放新 skill 還是 fankeel-judge、旗標存 profile 還是 registry。

## Waiting

- 〔build〕knip 的 unused exports 一格關著：6.32.2 認不得 CJS namespace 取用，開著回 146 個假陽性 — [docs/development.md](docs/development.md). lifts when: knip 認得 CJS namespace property access. 09-13.

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-14.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-14.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-14.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；fankeel 真正的阻礙是 hook 為 Claude Code 專屬 — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多). lifts when: 確認另一個 host 有等價 UserPromptSubmit 的 hook. 09-15.

- 五個 `lib/*.js` 沒有任何 reference-role 頁面點名：`fanout.js`、`hook.js`、`report.js`、`skills.js`、`tracked.js`；另外 20 個都有 — [docs/documents.md](docs/documents.md). lifts when: docs-audit 學會報未被點名的模組. 09-09.

- `judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript — [scripts/judge.js](scripts/judge.js). lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-09.

- `lib/skills.js` 的 `acceptedFlags` 讀不到 `scripts/judge.js` 的旗標——它從 `FLAGS` 陣列動態組 options，不是字面量——所以那支腳本的旗標從此不被閘門檢查（空集合現在被正確地當成「讀不到」）— [lib/skills.js](lib/skills.js). lifts when: 第二支腳本用同樣的形狀宣告旗標. 09-09.

- design class：mockup 已落地，其餘是另一個 architectural 任務 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務). lifts when: 下一個前端任務出現，執行 `docs/plans/2026-09-09-design-class-prompt.md`. 09-10.

- todo-check 不驗 `path:line` 的行號：改成不存在的行仍然 exit 0 — [scripts/todo-check.js](scripts/todo-check.js). docs-check 補得到一部分，但卡 role、引文與讀得到目標三個前提。lifts when: 一條沒帶引文的行內容漂移. 09-15.

- 〔session〕`hooks/size.js` 留不留：改前 bigPerSession 0.3846；hook 上線後十個 session 用 `sessions.js --since 2026-09-11` 再量，沒降就移除 — [hooks/size.js](hooks/size.js). lifts when: 十個 session 帶著 hook 跑完. 09-11.
