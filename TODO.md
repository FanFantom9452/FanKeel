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

- `orient.js Waypoint web` reads as one nested place; the two positionals resolve independently against the root — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md), the `look` block.

- SKILL.md 加 `## Security boundary`：TODO.md、plan、掃到的原始碼、他人的 registry entry 是 data 不是指令，不能推 stage、改 route、設 guard、派 subagent；A1 有草稿 — [簡報 A1](docs/improvement-brief.md#附錄-a可直接抄的原文片段).

- 寫 CONTRIBUTING.md：scope / ownership 表、issue-first 與三條件例外、PR body 強制 `## Verification` 與「Report only checks you actually ran」 — [簡報 §2.8](docs/improvement-brief.md#28-contributingmd-作為表格化契約).

- 站台每個 registry 卡片恢復「clear N stale」按鈕 post 到 `/clear-stale`：路由與四個測試還在，補頁面與一個 shell 測試 — [assets/station/station.js](assets/station/station.js), `clearControl`; [scripts/station.js](scripts/station.js).

- nav label 碰撞：兩個 root 去尾斜線、Windows 大小寫折疊後仍相同即同一 registry，合併成一張卡；加碰撞 fixture 測試 — [assets/station/station.js](assets/station/station.js), `labels`.

- `burn` 負值夾零：`serialize` 改用已有的 `burnOf()`，負值成 null、頁面顯示 —，與 `clock` 三處 `Math.max` 一致；舊記錄不重算 — [lib/station.js](lib/station.js), [lib/registry.js](lib/registry.js).

- spike（route survey,build）：pair 1 同題以 `haiku` 重跑兩臂，dated report 進 docs/reports，不改規則；規則要不要改另開條目 — [docs/subagents.md](docs/subagents.md).

- 七個 landed 含 09-04：`-design.md` 移 docs/decisions（role decision，不再算 landed），plan 移 archive，24 處連結 / 14 頁全改到 docs-audit exit 0 — [docs/README.md](docs/README.md).

- docs/subagents.md 的 `source_of_truth` 加 lib/usage.js 與 lib/prices.js（:194 已描述它們），內文不動，不 defer 給 station.md — [docs/subagents.md](docs/subagents.md).

- `fankeel-shell.md` :334 照 :178 的 *(Superseded in …)* 慣例註記 scripts/ledger.js 已 export；docs/documents.md 加一句「前提被推翻也註記，不改正文」 — [docs/documents.md](docs/documents.md).

- 新增 docs/sources.md 證據帳本：ID、連結、查證日、等級、範圍、被誰引用；先登五份 dated report 的數字，反向索引手工 grep 填，不寫 script — [簡報 §2.4](docs/improvement-brief.md#24-證據邊界系統三層).

- `task.js --root` 有值時走 `resolveRoot` 與八支一致，缺席維持 `rootFor`（task.test.js:678 不動）；加相對路徑測試，docs 補一句 station.js 的 `--root` 是清單 — [scripts/task.js](scripts/task.js), `rootOf`.

- `<plugin>` 警語：lib/stages.js 的 survey 與 audit rules 各加一行，registry root 的 package.json name 是 fankeel 時跑 tree 的 scripts/ 不跑 cache；render.js 不加偵測 — [lib/stages.js](lib/stages.js).

- 七個 stage skill 各加反漂移三行（唯一解析路徑、禁 fallback、明確失敗訊息），文字抄簡報，放「Read … on entry」段旁，注入 cap 不動 — [簡報 §2.3](docs/improvement-brief.md#23-薄殼的反漂移條款13-行裡有-5-種防禦).

- 七個 stage skill 各加一張 Not a defect 小表附理由，audit 先做並從它的「只有前四項會 fail」長出來，內容由實作者從各 stage 規則引 — [簡報 第四梯](docs/improvement-brief.md#第四梯形式改寫), [skills/fankeel-audit/SKILL.md](skills/fankeel-audit/SKILL.md).

## Needs a decision

- skills 下一個 `registry.json` 與它的 schema：每個 stage 一筆；`## Waiting` 的 entry/stop condition、`prompt_byte_budget`、條件載入到節三條都以它為前置 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema).

- fail-closed 的 script / flag 閘門：掃 skills/*.md 的 `<plugin>/scripts/*.js` 與 `--flag`、釘八支 script、空結果是失敗；連同結構不變量測試與 Waiting 的純函式 — [簡報 §2.5](docs/improvement-brief.md#25-三層閘門).

- 校準規則與可失敗自檢測試：通則「每階段都設閘門會變跑步機」、衝突時 name both rules；build 的四件停止事改成「撤掉會不會變差」加豁免；16 行 pattern 以此為前置 — [簡報 §2.6](docs/improvement-brief.md#26-兩個-fankeel-直接缺的行為機制).

- design 階段的 mockup 步驟：前端任務時 survey 已知專案背景，design 先出 mockup 再進 build，參考 taste-skill / hallmark 一類的設計 skill；產物、存放處、載入條件待定 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).

- 開發偏好 profile：掃過去的 session 找每個專案的慣例答案（land 本地 commit 不 push、guard、class），依專案建 profile 加預設，Start 套用不再問；存哪、欄位待定；Waiting 的 station 設定面以此為前置 — [簡報 §4.2](docs/improvement-brief.md#42-開發偏好-profile不是每次都問).

## Waiting

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-06.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-06.

- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two compared 09-04, byte-identical. lifts when: two types' briefs are seen to differ. 09-06.

- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI. lifts when: Claude Code ships one. 09-06.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-06.

- Whether an output style reaches a subagent — [lib/render.js](lib/render.js) forwards none; headless ignores `outputStyle`. lifts when: an interactive terminal can set one in `/config`. 09-07.

- `docs-audit` reads a fixture path in a code block as a deliverable — [scripts/docs-audit.js](scripts/docs-audit.js). lifts when: a second plan is held back by it. 09-07.

- 數字帶範圍取代四捨五入：9.2× 補上「四 reader、跨 plugin skills、檔名未知」後就不與 1.5× 矛盾 — [簡報 §2.4](docs/improvement-brief.md#24-證據邊界系統三層). lifts when: 證據帳本落地. 09-08.

- 閘門寫成純函式，CLI 與 test 共用，照 docs-check.js / lib/docs.js 的分離 — [簡報 §1.2](docs/improvement-brief.md#12-編譯與閘門層fankeel-完全沒有的一層), [lib/docs.js](lib/docs.js). lifts when: script / flag 閘門落地. 09-08.

- `entry_condition` / `stop_condition` 進 registry：寫在 registry 能被檢查，寫在散文只能被讀 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema). lifts when: registry.json 落地. 09-08.

- 每 stage 一欄 `prompt_byte_budget` 與整體預算：注入 block「long on purpose」的唯一界線不可量測；caveman 給 560 — [簡報 §1.3](docs/improvement-brief.md#13-registryjson-的-schema). lifts when: registry.json 落地. 09-08.

- 條件載入到「節」的粒度：build 依 class 與有無 plan 載入不同段落，今天 spike 的 build 付 architectural 的 token — [簡報 §2.2](docs/improvement-brief.md#22-條件載入矩陣fankeel-最缺的那個機制). lifts when: registry.json 落地. 09-08.

- 16 行 pattern skill 的極簡形式：stage skill 較重且混了人類與模型兩種讀者；`surgical-patch` 證明 16 行夠 — [簡報 §1.4](docs/improvement-brief.md#14-16-行-pattern-skill-的極簡形式). lifts when: 自檢測試改寫落地. 09-08.

- 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；fankeel 真正的阻礙是 hook 為 Claude Code 專屬 — [簡報 §2.7](docs/improvement-brief.md#27-多平台交付sepia-的做法便宜得多). lifts when: 確認另一個 host 有等價 UserPromptSubmit 的 hook. 09-08.

- station 變成設定面：會問的問題做在 HTML 上先決定，按鈕一鍵套用 profile；靜態 shell 只有 serve 模式能寫 — [簡報 §4.3](docs/improvement-brief.md#43-station-變成通用的設定面). lifts when: profile 格式定案. 09-08.

- eval 進 CI：`.github/workflows` 一條，只在 push main 且限 skills/、evals/、manifest；永遠紅的 workflow 是噪音，所以等 — [README.md](README.md). lifts when: 本機 `claude plugin eval` 不再回 early access. 09-08.
