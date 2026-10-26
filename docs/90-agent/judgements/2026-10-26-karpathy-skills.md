---
judged: 2026-10-26T17:59:36.318Z
model: fable
agent: fankeel-judge
task: "比對 andrej-karpathy-skills 與 fankeel 的 SKILL"
session: feb572cd-2bdf-492b-84a4-1bc7358205fa
stage: survey
---

# Brief 37 — multica-ai/andrej-karpathy-skills vs fankeel's skills: have we compared deeply, and what should we take?

## Question

# Brief 37 — multica-ai/andrej-karpathy-skills vs fankeel's skills: have we compared deeply, and what should we take?

## Question

The user pointed at https://github.com/multica-ai/andrej-karpathy-skills and asked (繁體中文): 「我們 SKILL 有深度比對過這個嗎?」 — have fankeel's skills been compared in depth against this repo? Answer two things: (1) has such a comparison already been done in this repo (judgements, reports, TODOs, plans) — yes/no with the path if yes; (2) doing it now: what, if anything, in that repo's skill(s) is absent from or better than fankeel's own skills, rules and agents, and what should fankeel do about it.

## What the repo is (unverified — readers must read it)

Read it from raw GitHub files (`https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/main/...`) or clone into a fresh empty temp dir outside this repo; never run its code. As commonly described, it packages Andrej Karpathy's observations on LLM coding pitfalls as a CLAUDE.md / skill: think before coding (state assumptions, ask when unclear), simplicity first (least code, no speculative abstraction), surgical changes (touch only what the request needs, match existing style), goal-driven execution (define verifiable success criteria, loop until met). Verify every one of these from its actual files — README, SKILL.md(s), CLAUDE.md, any plugin manifest — and list any rule it has that is not in this list.

## Background in this repo (these decide the answer)

- fankeel's own skills: `skills/*/SKILL.md` (esp. `fankeel-design` — success criterion that can fail; `fankeel-plan`; `fankeel-build`; `fankeel-verify`; `fankeel-explain`), agents `agents/*.md` (esp. `fankeel-implementer.md` — "least code that does the job", reuse, comments only for what code cannot say; `fankeel-fixer.md` — surgical), and the per-stage rules injected every turn (`hooks/inject.js`, `lib/render.js`, rule text wherever `ALWAYS` is defined).
- Project and workspace CLAUDE.md: `CLAUDE.md`, `../CLAUDE.md` if present.
- Prior "outside thing vs ours" judgements — read pick + Summary, keep consistent or say why not: `docs/90-agent/judgements/2026-10-19-explain-output-formats.md` (a different Karpathy post, already adopted as explain-1), `2026-10-22-graphify-knowledge-graph.md`, `2026-10-22-understand-anything.md`, `2026-10-25-mermaid-renderers-vs-chartroom.md`, and the newest files in that directory (incl. untracked `2026-10-26-archify-vs-chartroom.md`).
- Sources ledger: `docs/90-agent/reference/sources.md` — check whether this repo is already listed.
- Search the whole repo (docs/, skills/, agents/, .fankeel/build/ask/, docs/90-agent/todo/) for `karpathy-skills`, `multica`, `andrej-karpathy`.
- Cost constraint: every line added to a per-turn rule or ALWAYS rides every prompt; fankeel prefers putting discipline in the stage skill or agent that needs it. A rule fankeel already has in substance does not get a second copy.

## Options

A. Already covered — every principle there exists in fankeel in substance; name where each lives (path:line). No change.
B. Mostly covered, borrow named pieces — list each missing/better piece, where it would go (file), and the first concrete edit.
C. Recommend it to users as a separate CLAUDE.md/skill alongside fankeel (no code change), with any conflict it would cause named.
D. Something else.

## What counts as an answer

A yes/no (with path) for "compared before"; then one pick, with a principle-by-principle table: their rule → fankeel's equivalent at path:line, or "absent". Anything about the repo not verified from its files is labelled unverified.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文, including the table.

## Answer

pick: A — already covered, no change. (1) Compared before: yes in substance, no judgement file — `F:/ymlab/fankeel/tests/stages.test.js:106-123` records a line-by-line check of Karpathy's guidelines against the stage rules that took two rules (design's success criterion, `lib/stages.js:256`; build's orphan clean-up, `lib/stages.js:312`) and left "over-engineering" to audit on purpose; this judgement is the first filed one. (2) Every one of its 4 sections and 15 bullets has a fankeel equivalent at path:line (table below); the two places they differ (ask-when-uncertain at build; "trivial tasks, use judgment") are fankeel's deliberate stance, not gaps. Not in sources.md, and sources.md is a ledger of internal reports with no GitHub entries, so no entry belongs there.
why: Verified from the repo's own files: SKILL.md is 67 lines / 365 words, four sections, nothing outside the commonly-described list except "present multiple interpretations" (:19), "push back" (:20), "mention unrelated dead code, don't delete" (:43) and a "Tradeoff" line (:11) — all four have equivalents (design SKILL.md:252/:83-84, :192-193, build SKILL.md:210-211) or a deliberate inversion (design SKILL.md:42-45).
why: Simplicity and surgical are already stronger in fankeel than there: the six-rung ladder (design:72-79, implementer:48-57), `yagni:`/`delete:` reviewer findings (reviewer:105,108), fixer's three-file refusal (fixer:34-36), and reviewer Part 1 `Extra:` (build:348-349) are mechanisms, where Karpathy's are advice.
why: Goal-driven is where fankeel borrowed from it once already (tests/stages.test.js:106-117) and goes further: the Ask→Criterion table (design:173-178), red-green steps (plan:281-288), a fix loop bounded at five with a premise check before round three (build:487-491), and verify's "no completion claim without fresh evidence" (verify:44-56).
why: Consistent with 2026-10-19 (pick A; same source family, nothing new) and the standing rule at judgements/2026-10-19:102/:104 — a rule present in substance gets no second copy, and the per-turn block sits at 2397/2400 so nothing could ride every turn anyway.
why: The plugin is already installed on this machine (`andrej-karpathy-skills@karpathy-skills 1.0.0` in `.fankeel/build/2026-10-17-spawn-probe/debug.log:73`) and its description auto-triggers "when writing, reviewing, or refactoring code"; its :18/:21 "if uncertain, ask" and :11 "trivial tasks, use judgment" pull against build:45 and design:43 — low risk because fankeel's rules are injected every turn, but worth knowing; C would add nothing.
would flip if: the repo's EXAMPLES.md (headings only scanned) held a rule with no fankeel equivalent, or design SKILL.md:192-193 / lib/stages.js:312 were ever cut — then B, one sentence back into the design skill.
unread: `.fankeel/map.md` (not named); the repo's EXAMPLES.md, CURSOR.md, README.zh.md, `.cursor/rules/*.mdc` bodies (headings only); the six judgements dated 2026-10-22..25 not named in the brief; `CLAUDE.md` and `../CLAUDE.md` do not exist (ls confirmed). No session id was given, so nothing was added to context.md.
delegated: multica-ai/andrej-karpathy-skills (README.md, CLAUDE.md, skills/karpathy-guidelines/SKILL.md, .claude-plugin/plugin.json, tree) — opus; `docs/90-agent/reference/sources.md` + whole-repo grep — sonnet; `skills/fankeel-design/SKILL.md`, `skills/fankeel-plan/SKILL.md` — sonnet; `skills/fankeel-build/SKILL.md`, `skills/fankeel-verify/SKILL.md`, `skills/fankeel-explain/SKILL.md` — sonnet; `agents/fankeel-implementer.md`, `agents/fankeel-fixer.md`, grep over `agents/*.md` — sonnet; `hooks/inject.js`, `lib/render.js`, `lib/stages.js` ALWAYS/per-stage rules — sonnet; `CLAUDE.md`, `../CLAUDE.md`, `.claude/` — sonnet; `docs/90-agent/judgements/` (five named + two newer) — sonnet.
checklist: 1 external repo rules — answered; 2 sources.md + prior mention grep — answered; 3 design/plan mapping — answered; 4 build/verify/explain mapping — answered; 5 agents mapping — answered; 6 per-turn rules + ALWAYS — answered; 7 CLAUDE.md files — answered (neither exists); 8 prior judgements pattern — answered.

## Summary

### 一、之前比對過嗎？

**實質上比過，但沒有存檔成 judgement。** 唯一的紀錄在 `F:/ymlab/fankeel/tests/stages.test.js:106-123`，原文：「Two rules taken from Karpathy's guidelines after checking them against these line by line. Most of that list was already here in one form or another, and over-engineering is the one subject left out on purpose: audit's code half owns it」。當時逐行比對後拿了兩條：

- design 的成功判準：`lib/stages.js:256`「Name what would prove it done — the test that fails now and passes after. "Make it work" is not a criterion.」（測試在 `:114-117`）
- build 的孤兒清理：`lib/stages.js:312`「Remove what your own change orphaned.」（測試在 `:126-131`，註解寫明是這個 repo 拔掉一個 skill 後留下五個孤兒檔的教訓）

同一段註解 `:118-123` 還記了第三條「push back — or the ask itself looks wrong, say so before building it」曾經也釘在每回合規則裡，後來為了 2400 字元的 render cap 砍掉，現在只留在 design skill（`skills/fankeel-design/SKILL.md:192-193`）。

其他地方全部沒有：`docs/90-agent/judgements/`、`todo/`、`plans/`、`reports/*.md` 頂層、`skills/`、`agents/` 對 `multica|andrej-karpathy|karpathy-skills` 零命中；唯一的 Karpathy judgement（`2026-10-19-explain-output-formats.md`）談的是另一篇輸出格式的貼文，已以 explain-1 採納。`docs/90-agent/reference/sources.md`（129 行）沒有這個 repo，而且它是 `docs/90-agent/reports/*.md` 的證據索引，整份沒有任何 GitHub repo 條目——不是放外部來源的地方，不用補。

另一個事實：這個 plugin 本機早就裝了。`.fankeel/build/2026-10-17-spawn-probe/debug.log:73` 等多處記錄 `andrej-karpathy-skills@karpathy-skills 1.0.0` 從 `C:\Users\user\.claude\plugins\cache\karpathy-skills\...` 載入；`.fankeel/build/2026-09-19-survey-brain/audit/removed/session-31b5f48b-full.md:487` 的 skill 清單也有它。

### 二、對方到底寫了什麼（reader A 讀原始檔，我抽查 SKILL.md:1-21、35-58、CLAUDE.md:1-6、63-65）

- 檔案樹 14 個路徑：`.claude-plugin/{marketplace,plugin}.json`、`.cursor/rules/karpathy-guidelines.mdc`、`CLAUDE.md`、`CURSOR.md`、`EXAMPLES.md`、`README.md`、`README.zh.md`、`skills/karpathy-guidelines/SKILL.md`。沒有 LICENSE 檔（README:171、SKILL.md:4 宣稱 MIT）。
- `SKILL.md` 67 行 / 365 字，`CLAUDE.md` 65 行 / 352 字，兩者正文相同（偏移 6 行）。來源是 Karpathy 的 X 貼文 `https://x.com/karpathy/status/2015883857489522876`（SKILL.md:9）。
- 安裝方式：plugin（README:105、:110；`plugin.json:10` 指向 `./skills/karpathy-guidelines`）或 curl 進 CLAUDE.md（README:115-125）；Cursor 版 `alwaysApply: true`。
- SKILL.md:3 的 `description` 寫「Use when writing, reviewing, or refactoring code」——會在 build 類工作時自動觸發。
- 四節之外的句子只有：`:11` Tradeoff（「bias toward caution over speed. For trivial tasks, use judgment」）、`:19`「If multiple interpretations exist, present them - don't pick silently」、`:20`「Push back when warranted」、`:43`「If you notice unrelated dead code, mention it - don't delete it」、CLAUDE.md:65「working if」三個徵兆。README 沒有任何量測數據（README:142-147 只有定性描述），也沒提與其他指令集的衝突。EXAMPLES.md 只掃了標題（`:498` Anti-Patterns Summary），**未逐行讀**。

### 三、逐條對照表

| 對方的規則（SKILL.md 行） | fankeel 的對應（path:line） | 判定 |
|---|---|---|
| 1a 明說假設；不確定就問（:18） | design `SKILL.md:54-57` 一次一問（目的、限制、成功判準）；`:271` `unverified:` 欄位；survey `lib/stages.js:229`「State the ask in one line and have it confirmed」；build `lib/stages.js:311`「Decide, record `Ruling:`」、`build SKILL.md:594-600` 只有四件事停下來 | 有；build 刻意改成「決定並記錄」而非「問」 |
| 1b 多種解讀就全部列出，別默默選（:19） | design `:252`「Ambiguity — pick one, make it explicit」、`:83-84`「Say which way you decided, because it is a judgement someone can overturn」；`:35`、`:276`「one approach, not a catalogue」 | 有，立場相反：fankeel 選一個並說出來，不列菜單 |
| 1c 有更簡單的做法就說；該頂就頂（:20） | design `:192-193`「If a simpler approach exists, or the ask itself looks wrong, say so before building it」（曾在每回合規則，因 cap 砍掉，見 `tests/stages.test.js:118-123`） | 有 |
| 1d 不清楚就停、點名、問（:21） | design 閘門 `:50`、`:258`；build `lib/stages.js:309`「ambiguous, ask that turn」；implementer `agents/fankeel-implementer.md:21-22` 回 `blocked: <file>`（子代理回傳，不問） | 有，觸發條件較窄 |
| 2 最少程式碼、不投機；單次使用不抽象；senior-engineer test（:25、:28、:33） | design `:68-79` 六階梯（「If two hundred lines could be fifty, it should be fifty」）；`lib/stages.js:255`；implementer `:48-60`「No abstraction nobody asked for」；reviewer `agents/fankeel-reviewer.md:105,108` `delete:`/`yagni:` | 有，且是機制不是勸告 |
| 3a 別順手改旁邊的程式、註解、格式（:40） | `lib/stages.js:312`；build `SKILL.md:208-211`；implementer `:82-83`「No comment or docstring added to code you did not change」 | 有 |
| 3b 沒壞的別重構（:41） | plan `SKILL.md:104-106`「Do not unilaterally restructure」；design `:178` refactor 列「reverted if it does not leave the code easier to read」 | 有 |
| 3c 跟現有風格（:42） | `lib/stages.js:312`「Follow the patterns here」；plan `:104`；build `:374-375` | 有 |
| 3d 無關的死碼：提，不刪（:43） | build `SKILL.md:210-211`「dead code you did not create gets mentioned, not deleted」 | 有（逐字等義） |
| 3e 清掉自己造成的孤兒（:46-47） | `lib/stages.js:312`「Remove what your own change orphaned」——就是從 Karpathy 拿的那條 | 有（已借） |
| 3f 每一行改動都追得到需求（:49） | `lib/stages.js:312`「Every changed line traces to the ask」；build reviewer Part 1 `Extra:`（`:348-349`）、Part 3（`:374`） | 有，且由 reviewer 執行 |
| 4a 定成功判準，迴圈到驗證過（:53） | design `:167-169` / `lib/stages.js:256`（已借）；build `:487-491` 修正迴圈上限五輪、第三輪前先驗前提；verify `:44-56`「NO COMPLETION CLAIM WITHOUT FRESH VERIFICATION EVIDENCE」 | 有，且迴圈有界 |
| 4b 任務→可驗證目標（:56-58） | design `:173-178` Ask→Criterion 表（validation、fix the bug、faster、refactor）；plan `:281-288` red-green 四步；implementer `:64-67` 先重現再修、`Root cause: X because Y` | 有 |
| Tradeoff：瑣碎任務自行判斷（:11） | design `:42-45`「The approval does not scale… simple tasks are where unexamined assumptions cause the most wasted work」 | 刻意相反 |
| CLAUDE.md:65「working if」徵兆 | 無對應句；fankeel 以 verify 證據表與 reviewer `Extra:` 直接量，不靠徵兆 | 不需要 |

每回合注入的 ALWAYS（`lib/stages.js:125-128`，687 字元）四條都不碰這四個原則；它們分別落在 design（`:254-256`）、build（`:309-312`）、verify（`:331-332`）的 stage 規則，與各 skill／agent 正文。這正是 brief 第 18 行的成本原則：紀律放在需要它的 stage，不騎每一個 prompt。`judgements/2026-10-19:104` 記錄每回合區塊 2397/2400，`tests/stages.test.js:100-103` 把每 stage 規則壓在 2000 字元下——就算想加也沒位置。

### 四、抽查結果

八個 reader 各抽一處，全部與原文相符：SKILL.md:18-21、:40-49、:53-58（curl）；`tests/stages.test.js:106-131`；design `:40-50`、`:190-193`；build `:205-212`；implementer `:12-29`；`lib/stages.js:306-316`；`judgements/2026-10-19:100-105`；`ls` 確認兩個 CLAUDE.md 都不存在。無一處 reader 說錯。

### 五、結論與建議

**選 A。** 對方 15 條 bullet 每一條在 fankeel 都有實質對應，其中兩條本來就是從它借的（`tests/stages.test.js:106`）；兩處不同（build 時「決定並記 Ruling」而非「問」；閘門不隨任務大小縮）是 fankeel 的刻意設計，各有理由寫在 `build SKILL.md:580-592` 和 `design SKILL.md:42-45`。無可借之物，不改任何檔案；本篇 judgement 就是存檔的深度比對。

兩個附帶事實，供使用者自行決定：

1. 這個 plugin 本機已裝、會在「writing, reviewing, or refactoring code」時自動載入。它的 `:18`/`:21`「不確定就問」和 `:11`「瑣碎任務自行判斷」在 build 階段與 `build SKILL.md:45`「This stage does not stop at a question until it is done」、`design SKILL.md:43`「The approval does not scale」方向相反。風險低——fankeel 的 stage 規則每回合注入，而它只是一次性的勸告——但若發現 build 中途莫名停下來問，這是第一個嫌疑。留或拔都不需要 fankeel 改碼。
2. `sources.md` 不收外部 repo（整份無 GitHub 條目），不必為它開一列。

**沒查到的**：對方 `EXAMPLES.md`、`CURSOR.md`、`README.zh.md`、`.mdc` 正文只掃標題；`.fankeel/map.md` 未讀；judgements 目錄裡 10-22 到 10-25 之間六個未被點名的檔未開；brief 沒給 session id，故未寫 context.md。
