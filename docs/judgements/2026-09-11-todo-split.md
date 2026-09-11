---
judged: 2026-09-11T05:03:14.890Z
model: fable
agent: fankeel-judge
task: "把 caveman/ponytail 去依賴、memory 清理、session 堆疊、station 單 session 細節與現有 TODO 拆成分群條目"
session: 3fe8fdd0-9649-407a-84b0-55c6ad427ff6
stage: design
---

# Brief 1 — todo-split

## Question

# Brief 1 — todo-split

## The question

How should the user's request below, plus the eight actionable entries already in
`TODO.md` (7 under `## Ready`, 1 under `## Needs a decision`), be decomposed into
`TODO.md` entries — which heading each goes under, how similar entries are grouped
together, and where each entry's detail lives — so that the result passes
`scripts/todo-check.js` and `/fankeel` can offer it as a task menu?

## The user's request, verbatim (zh-TW)

> 加上上面的TODO事項 還有memory 系統部分 原生 claude 就已經有這個機制了 不過他沒有自動清理的機制 也就是說 如果一開始你給的資訊不完整 或是有錯誤 他可能不小心紀錄到錯誤資訊 所以我們的 SKILL 應該也需要增加一個 清理機制 像是現在我們不是還外部依賴 ponytail 嗎? 然後 caveman.zip 你有解壓縮出來讀取嗎? 那個也是要判斷完有沒有用 如果有用就幫我計畫這個變更等等 另外 我現在不希望我的 FANKEEL 依賴 caveman 還有 ponytail 了 我們優先將 caveman所有功能分析一遍 然後和我討論 需要的功能拿下來 然後我們就排除這個 skill 依賴 再來深度分析 ponytail 這個 skill 然後再解除依賴這個 skill  我會希望我的 fankeel 是一套 完整的機制 像是我的 SBIR PROJECTWORKSPACE 的 SESSION 就是因為檔案太多 資訊又不對稱 所以開發難度越來越高 我的這個 SKILL 就是希望高度解決 系統長期開發文件內容過期 或是偏移問題 也不能讓 code 當作唯一來源 因為code 也會發生邏輯錯誤 所以最終都會回到文件必須是最新 等等的 另外 請你幫我分析 當前這個專案目錄下的所有已經使用過的 SESSION 我發現他們堆疊速度都很快 都是因為 丟給 BackGround Agent 然後回傳 又慢慢增加 還有那個 進入 VERIFY 又回來 BUILD 來來回回的 這些 除了我們像是 Custom Agent 還有甚麼作法可以提高效率 且不要讓主 Session 不要快速堆疊? 還有 station 現在還是很難用 雖然我可以看到整體的東西了 平均值等等 但是我還需要個別Session的詳細內容分析 可能是 他這個有幾個task 每個task負責做那些功能 主Agent 怎麼將任務切片的 也有可能有些地方不用 pipeline 而是可以平行處理的 請根據上面這些內容分段問題 拆成TODO 這些都是為了改進 skill 而做的 拆解完成後 相近任務放一起列回 TODO

The ordering the user stated is binding: caveman analysed first → discussed with
the user → wanted features taken in → caveman dependency removed; only then
ponytail deep-analysed → dependency removed. The deliverable of THIS task is the
TODO entries (and their detail), not the analyses themselves.

## Paths to read

- `TODO.md` — the whole file: its preamble states the heading contract; lines 61-79 are the eight existing actionable entries.
- `scripts/todo-check.js` — `MAX_ENTRY_CHARS = 200` at :47, `SECTIONS` at :59, any heading level resets the section at :174 (so a `###` under `## Ready` makes its bullets `unclassified`, :259-267), `STALE_ROLES` at :84.
- `.fankeel/docs.json` — `docs/` depth 1 is `reference`, so `docs/improvement-brief.md` is a legal link target; `docs/plans|decisions|reports|archive/` are not.
- `docs/improvement-brief.md` — sections 第零部 :35 … 第五部 :740, 附錄A :969, 附錄B :1077 (missing from its own 目錄 at :22-31), 覆核結果 :1094. §2.7 and §4.1 are already TODO link targets. It already analyses caveman at length (~30 lines mention it).
- `docs/judgements/2026-09-10-pattern-skill.md` — an earlier judgement on caveman's pattern skills.
- `lib/stages.js` — the `INIT` rule text: `## Ready` is offered as ONE task for the whole section, `## Needs a decision` one each, `## Waiting` never.
- `docs/station.md`, `lib/station.js`, `lib/usage.js:129-159,198-221`, `lib/registry.js:430-448`.
- `lib/render.js:108-110`, `lib/stages.js:352,441`, `skills/fankeel-audit/SKILL.md:144-147`, `skills/fankeel/SKILL.md:471-474,499-505`.

## What the survey already established (do not re-derive; spot-check if you doubt)

**caveman.zip** (repo root, 53 KB, gitignored `.gitignore:8`): 4 markdown documents, no skills/hooks/agents — a documentation snapshot of scanning a caveman checkout. Already read into the repo on 2026-09-09 (commit `65f1490`): two briefs folded into `docs/improvement-brief.md`, the other two became `docs/plans/2026-09-09-design-class-prompt.md` and `docs/reports/2026-09-09-design-axis-inventory.md`. Nothing unread remains in the zip.

**caveman the plugin** (installed, `~/.claude/plugins/cache/caveman-per-session/caveman/1.0.1`): 20 skills, 3 agents, 6 commands, 2 hooks (SessionStart activates its mode; UserPromptSubmit tracks it). fankeel's code coupling: none functional — `lib/badge.js:166,181` are comments about not deleting caveman's/ponytail's flags in the shared modes dir, pinned by `tests/badge.test.js:134-141`. Evals must pass `--setting-sources project` because without it haiku picked `caveman:surgical-patch` over fankeel (`docs/plans/2026-09-08-behaviour-eval.md:59-61`). The user's standing preference (memory): do not use or reinstall caveman; propose fankeel rules instead of its skills.

**ponytail** (installed 4.9.0): 6 skills = 6 commands (ponytail, -review, -audit, -debt, -gain, -help); 3 hooks — SessionStart injects its ruleset every start/resume/clear/compact, SubagentStart injects the same ruleset into EVERY subagent (fankeel's readers/reviewers/judge included), UserPromptSubmit only tracks mode. fankeel coupling: one boolean `has('ponytail')` → `lib/render.js:108-110` `ponytailLine` → `{{PONYTAIL}}` in the audit-stage rule `lib/stages.js:352,441`; prose in `skills/fankeel-audit/SKILL.md:144-147` and `skills/fankeel/SKILL.md:471-474,499-505`; tests `tests/route.test.js:198-239`, `tests/stages.test.js:101,230-231,323-330`, `tests/skills.test.js:107`. Uninstalling breaks nothing: every site falls back to "Nothing installed here does the code half; say so rather than skipping it." What is lost is the over-engineering code audit. Note `ponytail:` is also this repo's own debt-comment marker (`lib/live.js:34`), unrelated to the plugin.

**Native memory**: fankeel has nothing that reads, audits or prunes `~/.claude/projects/<proj>/memory/` or `MEMORY.md`. It only routes durable facts there (`skills/fankeel/SKILL.md` Task memory table; `lib/registry.js:18-35` rationale). This project's MEMORY.md has ~70 one-line entries, many naming files, flags, line numbers and measured figures — none of which anything re-checks.

**Session stacking** (all 153 top-level transcripts in `~/.claude/projects/F--ymlab-fankeel/`, 976 MB; script `.fankeel/build/ask/measure-sessions.js`):
- 34 of 153 ran `task.js start`. Peak context median 209k tokens, p90 509k.
- Top by peak: `1239ca79` 757k, 47 Agent calls, 109k chars returned, route design>plan>build>verify>build>verify>build>verify>audit>build>verify>audit>land (3 backward moves). `0d2263ef` 615k, 90 Agent calls, 295k chars returned, 15 backward moves, 6 land cycles in one session. 4 of the top 8 never ran fankeel at all.
- Subagent returns (they arrive as a later `task-notification` user message, not in the Agent tool_result, which is a ~1 KB launch ack in 1128/1141 cases) total 2.26M chars against ~25–28M chars of all tool results: ≈8–9%. So returns are NOT the dominant stacker; direct tool output in the main loop is ~90%.
- 15 sessions had ≥1 backward stage move; `verify>build` 29 times, `land>design` 7, `audit>build` 5.
- Caveat: stage moves made inside a subagent are invisible to the script.

**Station per-session gaps**: (a) a plan's tasks and what each did — absent (`lib/station.js` never reads the build ledger); (b) how the main agent sliced work into dispatches — partial: `agentsOf()` returns only a count, `agentFiles()` flattens plain vs workflow agents so the surface is lost; (c) per-stage cost per session — deliberately removed (`docs/station.md:128-130`), time per stage exists; (d) stage back-and-forth — structurally absent: `clock` keeps `[first, latest]` per stage name, so verify→build→verify is one long stay; (e) where a pipeline could have been parallel — absent.

**Small side finding**: the map lists four `docs/archive/2026-09-09-*` pages as `planned, not built` — archived pages still carrying `status: design-intent`.

## What counts as an answer

A decomposition that:
1. keeps every one of the eight existing entries (reworded only if grouping requires it; their links and facts unchanged);
2. turns each distinct concern in the user's request into one or more entries, each actionable on its own, respecting the user's stated caveman → ponytail order;
3. puts each entry under exactly one of `## Ready` / `## Needs a decision` / `## Waiting`, by what it is still short of — and every `## Waiting` entry ends `lifts when: <event>. MM-DD` (today 09-11);
4. fits `MAX_ENTRY_CHARS = 200` per entry and links only to a file whose role is not decision/plan/report/archive;
5. says how "相近任務放一起" is honoured given that `###` sub-headings currently fail `todo-check` — adjacency within a heading, a separate entry proposing `###` clusters (touching `todo-check.js` and the `INIT` rule), or something else — and which of those belongs in THIS task (a bounded TODO/doc edit) versus filed for later;
6. names, for each new entry whose detail does not fit in 200 chars, where that detail gets written (e.g. a new section of `docs/improvement-brief.md`, or a new reference page), in one line each.

## Answer shape

Return, in this order, no preamble:

1. `grouping:` one paragraph (≤5 lines) — how similar entries are kept together and why.
2. A table, one row per TODO entry in final file order: `| # | group | heading | entry text (zh-TW, identifiers in code, ≤200 chars incl. link) | link target | new? |`.
3. `detail:` one line per new detail section — file, section title, what it must hold.
4. `not in this task:` anything you considered and deliberately left out, one line each.
5. `confidence:` one line — what would change your answer.

At most ~70 lines. Every line you return is re-read on every later turn of the parent session for the rest of its life.

## Answer

grouping: 分群靠兩件事，都不動 `todo-check` 的契約。一是同一 `##` 底下相鄰排列（既有七條 Ready 保持相鄰，新的 map 條插在既有 map 條後面）；二是每條新條目以 `〔caveman〕〔ponytail〕〔memory〕〔session〕〔station〕〔todo〕` 開頭——bullet 文字合法、`LINK` 正則不碰、不與 `ponytail:` debt marker（`lib/live.js:34`）撞字，plan 階段可依前綴切片而 `INIT` 仍把 `## Ready` 當一個 task。`###` 分群另立一條 Needs a decision，因為 `todo-check.js:55-58` 明文反對主題分群，改它是契約變更，不屬本次的 bounded TODO/doc 編輯。使用者的順序用 heading 表達：caveman 取捨在 Needs a decision，caveman 解耦與 ponytail 兩條全在 Waiting，`lifts when` 指向前一條落地。

| # | group | heading | entry text (zh-TW, identifiers in code, ≤200 chars incl. link) | link target | new? |
|---|---|---|---|---|---|
| 1-6 | docs-contract | Ready | 既有六條原文不動：`quoteBeside` 四條、`E2 --> F`、uncovered 節點、sweep 類別表、`landed` 刪檔、`map.md` 每頁狀態 | 各自原有 | no |
| 7 | map | Ready | 〔map〕archive 桶裡 14 份仍掛 `status: design-intent`，`buildMap()` 把其中 4 份列成 planned, not built：archive 桶不該進 intent 桶 — [skills/fankeel-survey/SKILL.md](skills/fankeel-survey/SKILL.md) | skills/fankeel-survey/SKILL.md | yes |
| 8 | docs-contract | Ready | 既有：`skills/fankeel/SKILL.md:1095` 散文 defer 給 collisions.md（原文不動） | skills/fankeel/SKILL.md | no |
| 9 | station | Ready | 〔station〕`clock` 每階段只存 `[first, latest]`，verify→build→verify 看起來是一次長駐：`touch()` 另存 `moves` 逐筆 `[stage, at]`，既有欄位不動 — [lib/registry.js](lib/registry.js). 153 份裡 15 份倒退，verify>build 29 次 | lib/registry.js | yes |
| 10 | docs-contract | Needs a decision | 既有：`path:N-M` 範圍引用對 `docs-check` 隱形（原文不動） | docs/documents.md | no |
| 11 | caveman | Needs a decision | 〔caveman〕20 skill、3 agent、6 command、2 hook 逐項盤點與取捨：要的改寫成 fankeel 規則，不裝它的 skill；定案後拆成 Ready 條目 — [簡報 §6.4](docs/improvement-brief.md#64-caveman-去依賴). §1.5 六項與判斷 5 已在 | docs/improvement-brief.md | yes |
| 12 | memory | Needs a decision | 〔memory〕原生 memory 只寫不清：MEMORY.md 約 70 條引 `path:line` 與量測數字，沒有東西重驗。要定機制形狀——land/audit 時重讀？script 驗引用？ — [簡報 §6.1](docs/improvement-brief.md#61-memory-清理) | docs/improvement-brief.md | yes |
| 13 | session | Needs a decision | 〔session〕主 session 堆疊九成是主迴圈自己的工具輸出，subagent 回傳只佔 8–9%；15/153 有階段倒退。要定 Custom Agent 之外的手段：讀檔改派、倒退上限、閘門 compact — [簡報 §6.2](docs/improvement-brief.md#62-session-堆疊) | docs/improvement-brief.md | yes |
| 14 | station | Needs a decision | 〔station〕單 session 細節：task 從 build ledger 來、派工按 plain/workflow 分、階段來回從 `moves` 畫、哪段可平行；`lib/station.js` 三樣都沒讀 — [簡報 §6.3](docs/improvement-brief.md#63-station-單-session) | docs/improvement-brief.md | yes |
| 15 | todo | Needs a decision | 〔todo〕分群要不要用 `###`：`todo-check.js:174` 任何標題都重設 section，`INIT` 只認三個 `##`，:55 明說不按主題分；改就動兩處 — [scripts/todo-check.js](scripts/todo-check.js). 現以〔群組〕前綴代替 | scripts/todo-check.js | yes |
| 16-36 | (mixed) | Waiting | 既有 21 條原文與戳記不動，順序不動 | 各自原有 | no |
| 37 | caveman | Waiting | 〔caveman〕解耦：`lib/badge.js:166,181` 註解與 `tests/badge.test.js:134-141`、eval 的 `--setting-sources project` 說明、memory 那條偏好 — [lib/badge.js](lib/badge.js). lifts when: §6.4 取捨定案. 09-11 | lib/badge.js | yes |
| 38 | ponytail | Waiting | 〔ponytail〕深度分析：6 skill、3 hook（SubagentStart 把整套規則塞進 fankeel 每個 subagent）、audit 程式碼那半誰接 — [簡報 §6.5](docs/improvement-brief.md#65-ponytail-去依賴). lifts when: caveman 兩條落地. 09-11 | docs/improvement-brief.md | yes |
| 39 | ponytail | Waiting | 〔ponytail〕解耦 `has('ponytail')`：`lib/render.js:108-110`、`lib/stages.js:352,441`、兩份 SKILL.md 散文、三份測試；fallback 句已在 — [lib/render.js](lib/render.js). lifts when: §6.5 定案. 09-11 | lib/render.js | yes |

detail:
- `docs/improvement-brief.md` 新增 `## 第六部：使用者 09-11 提出的五個方向`（比照第四部），同時把第六部與缺漏的附錄 B 補進 :22-31 的目錄，`last_verified` 改 09-11。
- `### 6.1 memory 清理`：MEMORY.md 現況（~70 條、引檔名/旗標/行號/數字的比例）、`lib/registry.js:18-35` 只路由不重驗的理由、候選機制（land 時重讀、script 驗 `path:line`、過期標記）各一段。
- `### 6.2 session 堆疊`：`measure-sessions.js` 的數字全錄（34/153、median 209k、p90 509k、`1239ca79`/`0d2263ef` 兩例、回傳 2.26M vs 25–28M、倒退 29/7/5）、subagent 內移動不可見的但書、候選手段。
- `### 6.3 station 單 session`：五個缺口 (a)–(e) 各對到程式位置（`station.js` 不讀 ledger、`agentsOf()` 只回數量、`agentFiles()` 攤平 workflow、`docs/station.md:128-130` 刻意拿掉、`clock` 形狀）。
- `### 6.4 caveman 去依賴`：安裝路徑與 20/3/6/2 清單指標、耦合點四處、使用者「不用不裝」偏好、順序規則（caveman 先於 ponytail）；`### 6.5 ponytail 去依賴`：6 skill = 6 command、3 hook 行為、耦合點與 fallback 句、拆掉後失去的是過度工程稽核。

not in this task:
- caveman 與 ponytail 的分析本身（條目是交付物，分析是 #11、#38 的工作）。
- `caveman.zip` 的去留：gitignored、四份已讀進 repo（`65f1490`），無條目可開。
- `###` 分群的實作（#15 只立決定，不改 `todo-check.js` 與 `INIT`）。
- 把 `.fankeel/build/ask/measure-sessions.js` 升成 `scripts/`：折進 §6.2/§6.3 當資料來源，等 #14 定案。
- 使用者關於「文件必須最新、code 不是唯一來源」的宗旨：是 fankeel 的前提，不是待辦。

confidence: 若 parent 認為〔群組〕前綴本身就是 `todo-check.js:55` 反對的主題分群，改為只靠相鄰、刪前綴；若 `## Ready` 一個 task 裝不下 station clock 加七條文件契約，把 #9 移到 Needs a decision 併入 #14。既有 21 條 Waiting 我未逐條重讀事件是否已發生（#16-36 只保證原文不動）。
