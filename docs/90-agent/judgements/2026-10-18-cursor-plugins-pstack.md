---
judged: 2026-10-18T21:03:14.480Z
model: fable
agent: fankeel-judge
task: "分析 cursor/plugins（尤其 pstack）與 fankeel 工作流的差異"
session: ba5a894e-d831-4f5f-9d33-78b640475588
stage: design
---

# Brief: what cursor/plugins (above all pstack) does differently from fankeel, and what fankeel should take

## Question

# Brief: what cursor/plugins (above all pstack) does differently from fankeel, and what fankeel should take

## Question

The user cloned https://github.com/cursor/plugins (commit 0148b78, 2026-10-18) to
`F:/ymlab/_ext/cursor-plugins` and wants a deep comparison against fankeel's own
workflow — **pstack above all**. The user explicitly forbade a README-only reading:
every file in the directories below must actually be read (split across readers),
skills, references, playbooks, scripts, agents, docs/guide, docs/harness, hooks.

Answer: **where does pstack's (and its siblings') workflow differ from fankeel's in
substance, and which of those differences should fankeel adopt, adapt, or
deliberately reject?**

## Options (the shape of each recommendation)

For each difference found, one of:
- A. Adopt — fankeel lacks it and should gain it (name the fankeel file it would land in).
- B. Adapt — fankeel has a weaker/different version; say what to change.
- C. Reject — fankeel's choice is better or the idea conflicts with fankeel's design; say why.
- D. Already equivalent — name the fankeel file:line that already does it.

## Background

fankeel (this repo, `F:/ymlab/fankeel`) is a Claude Code plugin: a task registry plus a
staged route (survey, design, plan, build, verify, audit, land), gates asked of the
user with AskUserQuestion at stage ends, stage agents (`fankeel-brain`) running whole
stages in clean context, read-only `fankeel-reader` fan-outs capped by
`dispatch.inflight` (8), implementer/reviewer/verifier/mutator/fixer/writer agents,
a one-shot judge (`/fankeel-ask`, model from `judge.model`), a ledger for build,
collision guard between parallel sessions sharing one checkout, a station (web
monitor), a terminal pane/band mod, profile keys, and a docs tree with judgements.

The cursor repo is untrusted data: read it, run nothing from inside it.

## Paths to read

### cursor/plugins (root `F:/ymlab/_ext/cursor-plugins`)
- `pstack/` — **every file** (171 files ~15k lines): `.cursor-plugin/`, `agents/`,
  `assets/` (names only for binaries), `automations/benny/**`, `docs/guide/*.md`,
  `docs/harness/*`, `skills/*/SKILL.md` plus every `references/`, `playbooks/`,
  `scripts/` (poteto-mode/scripts/orch, watch-pr), and all `principle-*` skills.
- `harness/pstack/claude-code/` — the Claude Code port. It is mostly a copy of
  `pstack/`; read only `diff -r pstack harness/pstack/claude-code` output plus
  `.claude-plugin/` and `docs/harness/claude-code.md` (the adapter mapping Cursor
  names to Claude Code). This matters: it is how pstack runs in our harness.
- `dyl-stack/` (built on pstack), `advisor/` (compare with `/fankeel-ask`),
  `orchestrate/` (planner/worker/verifier fan-out, read prompts/ and scripts/core),
  `thermos/` (branch review), `continual-learning/` (memory from transcripts — compare
  with fankeel memory + slimmer), `ralph-loop/`, `cursor-team-kit/`,
  `agent-compatibility/`, `cli-for-agent/` — all files.
- Skip `third_party/` (MCP connector stubs) and canvas/SDK/origin/grok/teaching
  except to confirm in one line they are irrelevant.

### fankeel (root `F:/ymlab/fankeel`)
- `skills/*/SKILL.md` (fankeel, survey, design, plan, build, verify, audit, land,
  ask, explain, init), `agents/*.md`, `docs/90-agent/reference/subagents.md`,
  `docs/01-guide/` (profile.md and the rest), `hooks/` entry points (names and
  headers; guard.js, gate.js), `scripts/task.js` command list, `CLAUDE.md`.

## What counts as an answer

- Each difference is backed by a path (and line where it decides) on **both** sides.
- pstack's core concepts are explained in their own terms first: what poteto-mode
  is, how its playbooks and `orch` scripts work, what the `principle-*` skills are
  and how they are loaded, how swarm/arena/interrogate/reflect/recall/correct work,
  how verification skills are created and maintained, what `benny` automations do,
  how pstack handles "never block on the human" versus fankeel's gates.
- Cost/context footprint: how much pstack loads per prompt versus fankeel.
- An honest list of where pstack is **better** than fankeel, not just different.

## Shape of the answer

Six fields, then `## Summary` (any length; 繁體中文 for prose, identifiers as-is):

```
verdict: <one line — the single most important thing fankeel should take or refuse>
options: <A/B/C/D counts>
evidence: <the 3–6 path:line pairs that decide the verdict>
risk: <what goes wrong if fankeel adopts the top items>
unknowns: <what the readers could not establish>
delegated: <reader → files it read>
```

In `## Summary`: (1) pstack 架構總覽, (2) each sibling plugin in a few lines,
(3) a comparison table: 面向 | pstack 做法 | fankeel 做法 | 建議 (A/B/C/D) | 落點檔案,
(4) a ranked shortlist of the top 5 to adopt with effort estimate, (5) the
points the user should decide in discussion.

## Answer

verdict: 取 pstack 的「每功能驗證技能＋feature map」（create/maintain-verification-skill）落入 verify＋audit，並把它的「可觀察的事實不問人」分類器加進階段中規則；拒把「never block on the human」套到階段結束閘門——hook 強制的閘門與 guard 正是 pstack 沒有的東西。
options: A 2 / B 14 / C 13 / D 13（共 42 列，見比較表）
evidence: pstack/skills/poteto-mode/SKILL.md:20（AskQuestion 分類器）、pstack/skills/principle-never-block-on-the-human/SKILL.md:9-15、pstack/skills/create-verification-skill/SKILL.md:36,40（feature map；未執行過的技能只是草稿）、F:/ymlab/fankeel/skills/fankeel/SKILL.md:386,469-472（閘門永不省略）、F:/ymlab/fankeel/skills/fankeel-build/SKILL.md:649,663-669（階段內不等人，只有四種停）、pstack/docs/harness/claude-code.md:21,60（Claude Code 移植把 readonly 降為 Explore＋Bash、自動化一律 skip）
risk: feature map 是會腐爛的維護品（pstack 自己要每日跑 maintain）；verify 若每功能實機驅動會變長變貴；種類 lens 若寫進 stage skill 會讓 build 806 行再長，與 audit 的瘦身方向相反；reflect 一次三個 reviewer 的成本；若放寬閘門，gate.js 的去重／handoff 流程都要重寫——故拒。
unknowns: watch-pr 的 cli.test.ts、github.test.ts 與 policy.test.ts 大半只讀了 describe/it 標題；orchestrate 的 __tests__ 只讀標題、11 個測試檔連標題都未列；pstack/README.md 的兩行 benny 連結差異外 port 是否還有行為差異只靠 diff；Cursor Custom Mode 是否真的每回合重送 149 行無法在此驗證；pstack 任何檔案都沒有 token 數字；fankeel 的 lib/stages.js、lib/render.js 本體、skills/*/rationale.md、docs/02-architecture/pipeline.md 未讀；受控階段的注入區塊大小未量；使用者是否走 PR／Bugbot 流程（決定 watch-pr、benny 的相關性）不明。
delegated: opus → pstack/skills/poteto-mode/{SKILL.md, playbooks/*(23), references/bugbot-triage.md, scripts/{bootstrap.ts,check-plan.mjs,check-plan.test.ts,package.json,worktree-audit.sh,orch/orch.ts,orch/store.ts,orch/orch.test.ts}}, pstack/agents/{poteto-agent,comment-sicko}.md；sonnet → pstack/skills/principle-*/SKILL.md(24), setup-pstack, poteto-help(+2 refs), pstack/{README.md,plugin.json,.cursor-plugin/plugin.json,.gitignore}, scripts/watch-pr/{cli,github,policy,render,types,types.compile,fakes.test-helper}.ts, tsconfig.json, watch-pr（測試檔標題）；opus → swarm, arena, interrogate(+4), reflect(+4), recall, correct, show-me-your-work(+tsv,+log.sh), architect(+3), create-verification-skill(+3), create-formal-verification-skill, maintain-verification-skill, tdd, blast-radius, benchmark-checklist；sonnet → why(+12 refs), how(+2), figure-it-out, ketchup, unslop, no-comments, technical-writing, typescript-best-practices(+patterns.md), make-bot-ui, automate-me, bro, sharpen, in-your-own-words, teach；sonnet → pstack/docs/guide/*(11), pstack/docs/harness/claude-code.md, harness/pstack/claude-code/{.claude-plugin/plugin.json,plugin.json,docs/harness/claude-code.md,README.md}, diff -r 兩樹, pstack/automations/benny/**(12)；sonnet → orchestrate/**（prompts、references、schemas、scripts/core、cli、adapters、tools、measurements、models、schemas 全文；tests 標題）；sonnet → advisor/**, dyl-stack/**, thermos/**, continual-learning/**, ralph-loop/**, cursor-team-kit/**, agent-compatibility/**, cli-for-agent/**, 根目錄其餘子目錄 README 首行；opus → F:/ymlab/fankeel/{CLAUDE.md(不存在), skills/*/SKILL.md(13), agents/*.md(14), docs/90-agent/reference/subagents.md, docs/01-guide/*(5), hooks/{gate.js,guard.js} 全文＋其餘 hook 檔頭, scripts/task.js 指令表, .fankeel/profile.json, .fankeel/map.md:1-40, skills/registry.json}

## Summary

### 0. 抽查結果

每位讀者各抽一處引用，全部與原文相符：

- poteto-mode/SKILL.md:20 確為 AskQuestion 分類器全文；:83-87 Autonomy（Just do it／Always pause／Session overrides）；:123-125 路由段逐字相符。
- principle-never-block-on-the-human/SKILL.md 15 行全文相符；setup-pstack/SKILL.md:39-45 確只寫 `~/.cursor/rules/pstack-models.mdc`、`alwaysApply: true`、整檔覆寫。
- create-verification-skill/SKILL.md:25-44：Launch/Doctor/Drive/Evidence/Cleanup/Helpers 六節、feature map 四個 H2、「A generated skill that was never executed is a draft, not a deliverable」皆在。reflect/SKILL.md:47「wait for explicit approval before applying any Accepted edit」相符。
- why/SKILL.md:13「Do not use readonly/Ask mode. It strips MCP access」相符。
- docs/harness/claude-code.md:17-28 子代理對映表、:58-67 Cursor-only 一律 `Skipped in Claude Code:` 一行帶過，相符。
- orchestrate loop.ts:123-150 `spawnReadyPending` 逐一 spawn 所有 deps 滿足的 pending 任務，無上限；Andon 時只暫停新 spawn。相符。
- continual-learning-stop.ts:215-232 觸發條件四合一、只印 `followup_message`；advisor stop-hook.sh:42-47 只發 followup、不能阻擋停止。相符。
- fankeel skills/fankeel/SKILL.md:386、:469-472，fankeel-build/SKILL.md:649、:663-669 逐字相符。

### 1. pstack 架構總覽（以它自己的用語）

**形狀。** 31 個 slash skill＋24 個 `principle-*` skill＋2 個 agent（`poteto-agent`、`comment-sicko`），沒有 hooks、沒有會 spawn 的腳本（`.cursor-plugin/plugin.json:29-30` 只宣告 skills 與 agents）。每個 SKILL.md 都是 `disable-model-invocation: true`，所以模型不能憑 description 自選，一律由使用者打 `/名稱`（各 SKILL.md 第 4 行；poteto-help/SKILL.md:41「Installing changes nothing until the user invokes a skill」）。

**poteto-mode 是什麼。** 一個「模式」skill（149 行）：收到 `/poteto-mode <任務>` 的那個聊天視窗自己執行 playbook，不委派（SKILL.md:93）。它做三件事：(a) 把任務對到 23 本 playbook 之一，**把該 playbook 的步驟逐字複製進 todolist**，不做的步驟留在清單上註 `skip: <reason>`（SKILL.md:123）；(b) 依觸發條件路由到其他 skill——跨函式邊界的程式碼→architect、並行→swarm/arena、有爭議的設計→interrogate、任何散文→unslop、commit 前→deslop、review 前→no-comments（SKILL.md:19-36）；(c) 回覆時點名「哪條原則改變了哪個決定」，且只能引用本 session 真的讀過葉檔的原則（SKILL.md:15, :40）。大型或使用者會離開的工作改走 **figure-it-out**（自製一次性 playbook），多日多 PR 的計畫走 **Orchestrate** playbook（SKILL.md:125）。它不是常駐：Cursor 用 Option+Enter 設成 Custom Mode 才會每回合留在 context（docs/guide/01-setup.md:60）；Claude Code 沒有對應機制，每次要打 `/pstack:poteto-mode`（port README:28）。

**playbooks。** 23 本、每本 10–155 行，是步驟清單而非 skill（poteto-help:116）。有代表性的：bug-fix（自己在同一介面重現、二分法找因、先提交失敗的 repro 再修，:7-11）；feature（how→architect→throughput checkpoint→委派或 arena，「Mandatory: no skip-with-reason escape」:12）；refactoring（先釘住行為契約、不留 shim、「diff 若沒有降低任何讀者負擔就 revert」:7-13）；perf-issue（基線 trace→七條 mantra 依序→達標即停）；multi-phase-plan（只產計畫不實作、用 `check-plan.mjs` lint 骨架、交回後等 operator 明確 go，:3-11）；autonomous-run（先定可檢驗的結束謂詞、用 Cursor `/loop` 喚醒、每輪最小改動→驗證→commit 或丟棄、「plateau 不是停」:5-11）；babysit（把 PR 推到 merge-ready、**絕不 merge**、CI flake 只重跑一次，:16-21）；shipping（每 PR 一個獨立 verifier 給 PASS/FAIL、從底往上 land 連續通過段，:5-8）；autopilot-full/stack、session-pickup、pause-safely、worktree-cleanup、eval、hillclimb、opening-a-pr（每本 playbook 結尾都會接它，SKILL.md:149）。

**orch 腳本。** `scripts/orch/orch.ts`（590 行）＋`store.ts`（1677 行）是一個 commander CLI，管理 Orchestrate playbook 的 store：`units.tsv`（任務登記）、`ledger.tsv`（以 PR＋head SHA 為鍵的驗證判決，新 SHA 即作廢）、`inbox/`、`gates.md`（停住等 operator 的問題，附預設答案）、`decisions.tsv`、`preferences.md`、`frontier.json`。**它只記錄狀態，從不 spawn、不等待、不喚醒任何 agent**（playbooks/orchestrate.md:15；store.ts 的外部呼叫只有 `gh`/`origin pr list`、`git rev-parse`）。`.orch.lock` 是 store 的寫入互斥（pid 檔，死 pid 自動取代），不是 checkout 的碰撞守衛。`check-plan.mjs` 檢查計畫骨架（每個 PR 段的 9 個子區塊順序、驗證框要有 `Save`/`Pass when`、review gate 要提到截圖／影片／operator）；`worktree-audit.sh` 是唯讀分桶（hold-wip／hold-open-pr／verify-recent-chat／safe／review）。`watch-pr/`（3.7k 行 TS）是唯讀 GitHub PR 監看器：輪詢 checks、review threads、Bugbot、merge 狀態，只輸出判決（READY／WAITING／BLOCKER／TIMEOUT／COMPLETE），從不 merge、push、重跑 CI（github.ts 全是 `gh ... view/list/checks` 與 GraphQL query）；只有 babysit.md:12 與 shipping.md:9 會呼叫它。

**principle-\* 是什麼、怎麼載入。** 24 個 9–34 行的小 skill，每個一條規則（共 434 行）。它們**不會**自動載入（全部 `disable-model-invocation: true`），也不會被 setup-pstack 複製到 rules 或 AGENTS.md。載入途徑只有兩條：poteto-mode 的 SKILL.md:38-79 內嵌索引寫著每條何時適用，模型「應用哪條就讀哪條葉檔」（:40）；或使用者直接打 `/principle-<名稱>`（poteto-help:129）。使用者拿名稱當方向盤：「apply prove it works. show me the real output.」（docs/guide/08-principles.md:5-18）。

**swarm／arena／interrogate。** swarm：N 個 `generalPurpose` 雲端 worker 一次全發，用來做覆蓋矩陣、競速、gauntlet；報告只有 PASS／ISSUES／BLOCKED，缺 SHA 與方法的結果重發一次、再缺記成 gap（swarm/SKILL.md:21-41）。arena：N 個候選實作同一件事（預設 opus＋grok 各一、各自 worktree），一個不同模型家族的唯讀裁判逐條評 3–6 項 rubric，lead 自己也評，選一個 base 再把輸家的好部位手工嫁接進去；若候選差太遠代表 Phase A 規格不清，重來而非取平均（arena/SKILL.md:16-40）。interrogate：對 `git diff main...HEAD` 派一位 reviewer 每個模型（預設 opus＋grok），共用 rubric（Correctness／Root causes／Structural integrity／Verification／Complexity budget／Security）＋code-quality lens；lead 把發現分成 Act on／Consider／Noted／Dismissed，兩模型獨立提出的最有力；**不自動套用**（interrogate/SKILL.md:9,42-51）。reviewer 可以回「no findings」且那是合法結果（reviewer-prompt.md:45）；lead-judgment.md 列假陽性規則：全是 nit 就說程式沒問題、null 假設要追到呼叫點、「我會不同做法」一律駁回。

**reflect／recall／correct。** reflect：三個 reviewer（judgment／tooling／divergent）並行讀本 session 的 `agent-transcripts/*.jsonl`，synthesizer（opus）產 Accepted／Rejected／Backlog 表，**路由到既有 skill 的具體編輯**，能用 lint／腳本強制的移到 Backlog，**必須等使用者明確核准才套用**（reflect/SKILL.md:15-56）。沒有獨立記憶檔，記憶就是 skill 本身。recall：從最近 7 天 transcripts 切片平行讀＋`why` 的調查員掃共享紀錄＋`git`/`gh` 比對現況，回一份 Capsule／Threads／Problems／Next move（recall/SKILL.md:15-31）。correct：找 repo 裡 agent 重複犯的錯（發生兩次就算一類），依序用架構→型別＋lint（錯誤訊息要寫出修法）→測試→文件 讓它**不可能再犯**，每個檢查要證明會在真實的過去錯誤上失敗，並在 agent 指令檔維護「規則↔強制機制」表（correct/SKILL.md:15-30）。

**驗證技能的建立與維護。** `/create-verification-skill` 先「訪談 repo 不訪談人」，寫出專案本地的 `.cursor/skills/verify-<app>/SKILL.md`（Launch／Doctor／Drive／Evidence／Cleanup／Helpers）＋ `features/README.md` 與每功能一檔的 feature map（四個 H2：Sub-features／How to get to it (user POV)／Driving it with <harness>／Gotchas），**必須自己跑過一次**：launch→doctor→驅動一個功能→取證→cleanup→確認證據還在（SKILL.md:25-44）。`/maintain-verification-skill` 是週期性人工觸發（guide 建議每日自動化）：每功能一個唯讀子代理讀原始碼、協調者親自做一次實機 live pass、產出 clean／changed／blocked、最多一個 PR、絕不改產品碼（maintain/SKILL.md:15-39）。`/create-formal-verification-skill` 針對測試最難觸及、bug 代價最高的地方（並行、重試、狀態機、parser）產出用 TLA+／SMT 等工具的專案技能，每個性質要在壞掉的變體上失敗過才算（:9-37）。

**benny。** 休眠的 Cursor Automations 包（Cursor-only）：Slack 頻道新訊息觸發 triage（分類 Bug／Performance／Feature／Question／Reroute、去重、只在七條件下開 ticket、回覆一則帶 `[benny:bug]` 標記）與 reproduce-and-fix（等 triage 標記、用 control adapter＋feature map 在真實 UI 重現兩次、媒體 reviewer 確認、修補後兩次驗證、**只開 draft PR 絕不 merge/deploy**；feature map 沒涵蓋就標 blocked 而非自創 selector）。控制適配器是「怎麼啟動與驅動受測 app」的契約，缺任何能力就 fail closed。

**「never block on the human」如何運作。** 三層：(1) 原則葉檔：人類非同步監督，可逆的事先做再呈現，不可逆（force-push、刪生產資料、對外訊息）仍要確認（principle 檔 :9-15）；(2) poteto-mode 的分類器：要問之前先分類——**能用跑程式觀察到的事實不是人類的問題**，走 Prototype playbook 讓結果決定；只有實驗無法解決的產品／偏好判斷才問；全自主授權下自己決定並報告，且「絕不給使用者一個可回打的速記 token」（SKILL.md:20）；(3) Autonomy 段：Always pause 清單＋session overrides（「going to bed」即不再問）（:83-87）。真正硬停的點很少：multi-phase-plan 交回等 go（:11）、babysit 絕不 merge（:21）、shipping 要獨立 verifier 判決（:5）、Orchestrate 的 `gates.md`（:106）、reflect 套用前要核准（:47）、architect 只在 `with checkpoint` 時停（:43-45）。注意內部矛盾：bugbot-triage.md:13「When in doubt, ask」與 orchestrate.md:108「review-thread triage never reaches the human」相衝。

**Claude Code 移植。** `harness/pstack/claude-code/` 是生成副本：21 個 SKILL.md 各插一行「先讀 adapter」，其餘逐字相同；沒有 hooks、沒有 `.mdc`；benny 整包不在。adapter 把 `Task`→`Agent`、`AskQuestion`→`AskUserQuestion`、`readonly: true`→`subagent_type: "Explore"`（**仍保留 Bash**，只能靠 brief 說「別改檔」再看 `git status`，:21）、`environment: "cloud"`→`isolation: "worktree"`、grok/gpt slug→省略 model（**跨家族多模型審查在 Claude Code 全部退化成同一模型**，:32-38）；Automations／Bugbot／雲端 agent 一律印 `Skipped in Claude Code: …` 繼續（:60）。對映是模型在執行時自己套，沒有任何程式強制——這就是它在我們 harness 裡的真實樣子。

**成本／context 足跡。** pstack 沒有任何 token 數字（guide 只說「pstack spends extra tokens on subagents and review panels」01-setup.md:43）。文字載入量：每次 `/poteto-mode` 約 149（mode）＋10–155（一本 playbook）＋34（opening-a-pr）＋需要時 142（bugbot-triage）≈ 190–340 行，再加所引用原則葉檔（每個 9–34 行）與被路由到的 skill（how 36、architect 79、interrogate 74…）。每個 `poteto-agent` 子代理都重讀 149 行。Custom Mode 下 Cursor 每回合重送 mode skill（無法在此驗證）。扇出沒有上限：multi-phase-plan 每 PR 10 條 live lane（:13）、Orchestrate 每子協調者約 10 個在飛（:16）、swarm N 任意。fankeel 側（讀者實測）：在模式中每個 prompt 由 inject.js 注入約 2,200–2,330 字元／27–41 行（≈600 token），每次閘門回答後 resume.js 再送一次；MEMORY.md 613 B；skill 描述合計 4,465 字元、agent 描述 4,638 字元；進入階段時讀一次 SKILL.md：fankeel 1243 行、build 806、survey 414、plan 396、land 357、audit 332、verify 325、design 279。結論：**pstack 的每次文字載入比 fankeel 的 stage skill 小一個量級，但把錢花在子代理面板上；fankeel 常駐成本小，主要重量在 stage skill 本體。**

### 2. 姊妹外掛

- **harness/pstack/claude-code**：見上，生成副本＋adapter 文件，無 hook 強制，模型多樣性消失。
- **orchestrate**（約 16k 行，含測試）：用 `@cursor/sdk` 的 `Agent.create` 開 Cursor 雲端 agent（agent-manager.ts:634-644），root planner 自驅；角色 Planner／Subplanner／Worker／Verifier；狀態在 `.orchestrate/<slug>/{plan.json,state.json,handoffs/}` 並 commit 進 git；bun 腳本每 10 秒掃一次 deps 滿足的 pending 任務全部 spawn（無上限）；worker 約 75 分鐘上限，死掉時腳本代寫 `handoffs/<task>-failure.md` 並分類 cap-hit／oom／tool-error／network-drop／unknown，loop-hygiene.md 給 planner 一張重試策略表（兩次後放棄）；`measurements[]` 讓腳本在 worker 分支上**重跑它自稱的量測指令**，偏差 >10% 記 `attention.log`；Andon 是 Slack `:rotating_light:` 反應，只暫停新 spawn，清除需 operator-mode 檔；planner 文件裡**沒有任何「問人」規則**，worker「不能中途問問題，寫每個任務時當作沒有第二次機會」（spawning.md:54）。沒有閘門、沒有每任務 reviewer（verifier 是 planner 選配的任務型別）、沒有跨 session 碰撞守衛。
- **advisor**：per-project 模式；`afterFileEdit` 標 pending、`subagentStop` 記錄諮詢、`stop` hook（loop_limit 3）在「改了檔卻沒諮詢」時**只發一句 followup 提醒**，不能阻擋停止（stop-hook.sh:42-47）；advisor-subagent 是 grok-4.6 唯讀，回 Verdict／Why／Recommendations／Risks／Answers／Confidence；主 agent 對 `stop` 判決要重想或帶去問使用者，「advisor 是第二意見不是權威」（SKILL.md:101-106）。與 `/fankeel-ask` 的差別：advisor 是常駐、可 resume、有 hook 催促；fankeel 的 judge 是使用者打才跑、一次、存檔。
- **dyl-stack**：疊在 pstack 上的個人 overlay（要求 pstack＋cursor-team-kit 已裝，dyl-mode/SKILL.md:20），`dyl-mode` 是「poteto-mode 的薄路由，衝突時 Dylan 的 gate 勝」（:18）；加的東西：修 bug 前 todo 必須有 `Root cause: <X> because <Y>`（Y 是證據裡看到的機制，null guard／吞 try-catch／`.skip`／retry 算症狀修），品味否決即轉向，**本回合**未授權絕不 merge；`dyl-review` 快／深兩檔、🟢🟡🔴 一個標記；`dyl-ready-pr` 深審最多 4 輪再接 babysit；`build-figma` 的 visual judge 是 7 列 pass/fail rubric（任一 Fail 即 NOT VERIFIED）；`principle-the-algorithm` 是 Musk 五步。
- **thermos**：兩個子代理（bug/security/devex/feature-leak 與 code quality）並行再綜合；code-quality rubric 與 cursor-team-kit 的副本逐位元相同（192 行）：「不得因行為看似正確就核准」、推定阻擋項（檔案跨過 1000 行、散落的 feature check、不必要的 wrapper/cast、重複 helper）、「少量高把握的評論」。無模型欄、無 hook。
- **continual-learning**：`stop` hook 只讀 transcript 的 mtime，每 10 回合＋120 分鐘（trial 3／15）觸發一句 followup，叫 agent 跑 `agents-memory-updater`（model inherit）去掃 `agent-transcripts/` 新檔、把「高訊號的重複糾正與穩定的工作區事實」寫進 repo 根 `AGENTS.md` 兩節、每節最多 12 條、語意去重（agents-memory-updater.md:17-30）。README 說 trial 模式已啟用，hooks.json 卻沒有 env——文件與程式不符。
- **ralph-loop**：`stop` hook（loop_limit null）讀 `.cursor/ralph/scratchpad.md`，只要沒看到 `<promise>精確字串</promise>` 且未達 max_iterations，就把原 prompt 以 followup 重送；不讀 `status`，錯誤回合也會重送；**完成與否只靠 agent 的誠實**。
- **cursor-team-kit**：18 個小 skill（control-ui／control-cli 驅動介面；loop-on-ci 以 `gh pr checks --watch --fail-fast` 為真相、flake 只重跑一次；verify-this 把主張寫成條件／指標／門檻、baseline 對 treatment、三態 VERIFIED／NOT VERIFIED／INCONCLUSIVE、「不得軟化負結果」；deslop；workflow-from-chats 從 transcripts 抽「偏好原子」評 strong/medium/weak/contradicted；pr-review-canvas 本地 HTML diff）；兩條 alwaysApply rule；ci-watcher agent（model fast）。無 hook。
- **agent-compatibility**：跑 npm CLI 掃描＋三個行為 reviewer（冷啟動、驗證成本、文件可靠度，固定錨點 93/84/68/27/12），綜合分 0.7×靜態＋0.3×工作流。**cli-for-agent**：一份給 agent 用的 CLI 設計檢查表（非互動路徑、`--dry-run`、`--yes`、結構化輸出）。
- 其餘：third_party（約 100 個 SaaS MCP 連接器）、cursor-sdk、origin-apps、grok-voice、teaching、docs-canvas、pr-review-canvas（根層）——與工作流比較無關（各 README 首行確認）。

### 3. 比較表

| # | 面向 | pstack 做法 | fankeel 做法 | 建議 | 落點檔案 |
|---|---|---|---|---|---|
| 1 | 階段結束是否問人 | never-block 原則；Always-pause 只限不可逆寫入；「going to bed」即不再問（poteto-mode:20,83-87） | 每階段結束必以 AskUserQuestion 問、永不因「下一步顯然」省略（fankeel/SKILL.md:386,469-472）；gate.js 去重／拒壞閘門 | **C** 拒 | skills/fankeel/SKILL.md:386 |
| 2 | 階段中的問題分類 | 能跑出來觀察的事實不問人、走 prototype；只有產品／偏好判斷才問（poteto-mode:20） | build 不等人、四種停（fankeel-build:649,663-669）；其他階段靠 /fankeel-ask | **B** 把「可觀察即不問」一句加進 calibration，與四種停對齊 | skills/fankeel/SKILL.md:917-920；skills/fankeel-build/SKILL.md:663 |
| 3 | 任務種類 playbook | 23 本、每本 10–25 行、種類專屬紀律（bug-fix:7-11、refactoring:7-13、perf-issue:7-16） | 三個 class 決定路線（fankeel/SKILL.md:300-311）；只有 design 準則表三種（design:173-177）與 implementer bug-fix 節（:62-66） | **B** 以 lens 形式加 bug-fix／perf／refactor 三條紀律，不引入 23 本 | skills/fankeel-design/SKILL.md:173；agents/fankeel-implementer.md:62 |
| 4 | 步驟逐字進 todo、跳過要註 `skip:<reason>` | poteto-mode:123 | 注入規則與 report 形狀，無「跳過理由」欄 | **B** 小：階段報告加「未做的步驟＋理由」一行 | skills/fankeel/SKILL.md 報告形狀段；lib/stages.js:118-123 |
| 5 | 原則目錄 | 24 個一條規則的 skill，用名稱當方向盤（08-principles.md:5） | 4 條 ALWAYS＋calibration＋設計階梯；audit 有「沒人寫的規則」刪除測試（audit:135-170） | **C** 拒整套；fankeel 的方向是規則少而強制 | lib/stages.js:118-123 |
| 6 | attack-the-premise | 兩次共前提的修法都失敗→先寫下前提測它（principle:19） | 修補輪上限 5 再 ruling（build:540-559） | **B** 小：第 3 輪強制寫下前提 | skills/fankeel-build/SKILL.md:540 |
| 7 | 多候選設計（architect→arena） | 至少兩個結構不同候選、跨家族裁判、嫁接（arena:16-40；architect:33） | 一個方案不是目錄（design:35,268）＋mockup | **C** 預設拒（成本；Claude Code 無跨家族）；architectural class 可討論 | skills/fankeel-design/SKILL.md:35 |
| 8 | 多模型 rubric 審查 | interrogate 六維 rubric、四桶（:46-51） | verify 對手 reviewer 四問＋Security/Silent-failure/Comment lens＋Verify 模式確認（verify:229-297） | **D** | skills/fankeel-verify/SKILL.md:229；agents/fankeel-reviewer.md:71 |
| 9 | 審查假陽性紀律 | lead-judgment.md:7-19（nit 引力、假設 vs 實際、「我會不同做」駁回）；「no findings」合法（reviewer-prompt:45） | 有 Verify 模式確認（CONFIRMED/PLAUSIBLE），無駁回規則清單 | **B** 把三條駁回規則與「空審查合法」寫進 reviewer | agents/fankeel-reviewer.md |
| 10 | 每功能驗證技能＋feature map | create-verification-skill:25-44；maintain:15-39；執行過才算交付 | verify 要新鮮證據（verify:43-71）、verifier/mutator/adversary；`.fankeel/render.json` 只管頁面截圖；無跨次持久的功能地圖 | **A** | skills/fankeel-verify/SKILL.md:171；skills/fankeel-audit/SKILL.md:67；agents/fankeel-verifier.md；.fankeel/render.json |
| 11 | 形式驗證技能 | create-formal-verification-skill:9-37 | 無 | **C** 專案特定，不進外掛 | — |
| 12 | 量測數字檢查 | benchmark-checklist 七問；explain-the-number | verify 主張→證據表（:62-71）無效能列 | **B** 小：表加一列「效能數字：限制因子＋≥5 次中位數與範圍」 | skills/fankeel-verify/SKILL.md:62 |
| 13 | 決策日誌 | show-me-your-work TSV、append-only、另一家族模型審日誌（:46-74） | `ledger.js ruling` what/why/cost（build:647-660）、決策紀錄（land:137-144）、judgements | **D** | skills/fankeel-build/SKILL.md:653 |
| 14 | session 回顧→skill 編輯 | reflect 三 reviewer＋synthesizer、核准後才改（:15-56） | 無；leave.js 只記花費；slimmer 提案 diff 模式 | **B** 在 land「搬到耐久處」步驟加可選 reflect，沿用 slimmer 的「提案 diff＋核准」 | skills/fankeel-land/SKILL.md:181；agents/fankeel-slimmer.md |
| 15 | 讓重複錯誤不可能＋規則↔強制表 | correct:19-30 | hook 確實強制很多規則，但沒有一張「哪條規則由哪個 hook/腳本強制」的表 | **A** 小：一頁參考表 | docs/90-agent/reference/（registry.md 旁） |
| 16 | 任務開始的回想 | recall 讀 7 天 transcripts＋共享紀錄 | orient 的 todo 區、carry.js 交接、context.md（SKILL.md:763-797；subagents.md:746-757） | **D** | skills/fankeel/SKILL.md:763 |
| 17 | 歷史調查（why）＋epistemics 分層 | 七類來源並行、Direct/Supported/Inferred/Speculative/Unknown、必有「不知道什麼」節（epistemics.md:7-71） | survey 讀者 lens；讀者已用 EXTRACTED/INFERRED 標記；無 git 歷史 lens | **B** survey 的 architectural class 加「history」lens（blame／`log -S`／PR body） | skills/fankeel-survey/SKILL.md:233 |
| 18 | 程式走讀（how） | 2–4 explorer＋1 explainer | survey＋explain | **D** | skills/fankeel-survey/SKILL.md:40 |
| 19 | PR 到 merge 的迴圈 | 唯讀 watch-pr＋babysit（絕不 merge）＋shipping（獨立 verifier、底往上 land） | land 開 PR 回報 URL 即止（land:321） | **B** 選配：`land.watch` 用 `gh pr checks --watch`（≈loop-on-ci 50 行），不搬 3.7k 行 watcher | skills/fankeel-land/SKILL.md:321；docs/01-guide/profile.md |
| 20 | Bugbot 分流＋學到的 pattern | bugbot-triage.md:7-82 | 無 | **C** 除非走 Bugbot | — |
| 21 | 過夜自主跑 | 可檢驗結束謂詞＋worktree＋決策日誌＋`/loop`（07-overnight.md:3-56） | 無無人值守模式；gate.station 可從網頁答；結束謂詞＝「現在失敗、之後通過的測試」已有（design:167-189） | **C** 閘門不放；結束謂詞 D | skills/fankeel-design/SKILL.md:167 |
| 22 | worktree 稽核 | worktree-audit.sh 唯讀分桶 | residue.js 列廢棄 worktree（audit:88-94）；land.js merge/clean | **D** | skills/fankeel-audit/SKILL.md:88 |
| 23 | 狀態存放（orch store） | units/ledger/inbox/gates/decisions TSV，CLI 只記錄 | task.js 登記＋ledger.js（build:62-166）＋handoff 檔 | **D** | skills/fankeel-build/SKILL.md:62 |
| 24 | 重跑 worker 自稱的量測 | orchestrate measurements.ts 在分支上重跑指令、偏差>10% 記錄 | review-check.js＋mutation 檢查測試主張（build:369-450）；效能數字無 | **B** 小：與 #12 合併處理 | skills/fankeel-build/SKILL.md:369 |
| 25 | 死掉的子代理 | 腳本代寫 failure handoff＋分類＋重試表（failure-handoff.ts:25-93；loop-hygiene.md） | await.js 回 lost/timeout（subagents.md:612-628），無分類與下一步 | **B** lost/timeout 時寫合成 handoff 註明模式與建議 | docs/90-agent/reference/subagents.md:612；scripts/await.js |
| 26 | Andon 停線 | Slack 反應暫停新 spawn；operator 才能清（andon.ts） | 閘門＋station | **C** 現階段不需；可討論 station 停線按鈕 | — |
| 27 | 扇出上限 | 無（10 lanes／PR 只是文字） | dispatch.inflight 8，hook 強制（dispatch-gate.js） | **D** fankeel 較佳 | skills/fankeel/SKILL.md:1116 |
| 28 | 平行 session 碰撞 | 純文字「一 worktree 一寫者」＋store pid 鎖 | guard.js 以 claim 阻擋（:170-196） | **D** fankeel 較佳 | hooks/guard.js:170 |
| 29 | 每角色模型設定 | setup-pstack 寫 alwaysApply rule 檔 | profile.json 覆寫 agent 模型 | **D** | docs/01-guide/profile.md |
| 30 | 停止前強制諮詢 | advisor stop hook 只能提醒 | 閘門是工具呼叫，Stop 不觸發（gate.js:9-11）；verify 的對手 reviewer 是結構等價物 | **C** | hooks/gate.js:9 |
| 31 | transcript 自動寫記憶 | continual-learning 每 10 回合寫 AGENTS.md | slimmer 專門刪每回合讀的東西；memory-check 修錯 | **C** | agents/fankeel-slimmer.md；skills/fankeel-audit/SKILL.md:108 |
| 32 | 重送直到完成 | ralph-loop 靠 `<promise>` 誠實 | build 迴圈＋四種停＋ledger | **C** | skills/fankeel-build/SKILL.md:43 |
| 33 | 推定阻擋項（1k 行等） | thermos code-quality:183-190 | audit 三個 cut lens（:236-244）；reviewer cuts lens | **B** 把四條推定阻擋項加進 cuts lens | agents/fankeel-reviewer.md；skills/fankeel-audit/SKILL.md:236 |
| 34 | 三態判決含 INCONCLUSIVE | verify-this:26；figure-it-out:42「inconclusive 不是通過」 | 證據列＋CONFIRMED/PLAUSIBLE | **D** | skills/fankeel-verify/SKILL.md:62 |
| 35 | `Root cause: X because Y` todo | dyl-mode:66 | implementer bug-fix 節 | **B** 微：加一行 | agents/fankeel-implementer.md:62 |
| 36 | 從 transcripts 生個人模式 | automate-me；workflow-from-chats | init＋profile preset | **C** | skills/fankeel-init/SKILL.md |
| 37 | 註解清除 | no-comments＋comment-sicko | implementer「只註解程式說不出的」＋reviewer Comment lens | **D** | agents/fankeel-reviewer.md |
| 38 | 跨 harness 移植 | adapter 文件由模型自行套用；readonly 保留 Bash | 原生 Claude Code；guard.js:68-74 拒唯讀型別的 shell 寫入 | **D** fankeel 較佳 | hooks/guard.js:68 |
| 39 | 文字載入量 | mode 149＋playbook ≤155 | build SKILL 806 行、fankeel 1243 行 | **B** 討論：用 input-check 量後瘦身 stage skill | skills/*/SKILL.md；scripts/input-check.js |
| 40 | 計畫 lint | check-plan.mjs 骨架檢查 | ledger.js lint＋plan reviewer（plan:322-370） | **D** | skills/fankeel-plan/SKILL.md:322 |
| 41 | 盲評 skill 本身（eval playbook） | eval.md:5-23 | 無（Claude Code 有 `claude plugin eval`） | **C** 現階段不做 | — |
| 42 | agent-compatibility／cli-for-agent | 評分 repo 友善度；CLI 檢查表 | init scout 檢查上手；scripts 已是 JSON＋exit code | **C** | skills/fankeel-init/SKILL.md:37 |

計數：A 2（#10、#15）、B 14（#2,3,4,6,9,12,14,17,19,24,25,33,35,39）、C 13（#1,5,7,11,20,21,26,30,31,32,36,41,42）、D 13（#8,13,16,18,22,23,27,28,29,34,37,38,40）。

**pstack 確實比 fankeel 好的地方（誠實清單）：** (1) 每功能驗證技能＋feature map 是持久、被執行過、可維護的工件（#10）；(2) 種類專屬的短紀律（先自己重現、先提交失敗 repro；refactor 不降讀者負擔就 revert）（#3）；(3) 回顧→skill 編輯＋「讓錯誤不可能」的階梯與規則↔強制表（#14、#15）；(4) `why` 的證據分層與強制的「我們不知道什麼」節（#17）；(5) reviewer 假陽性紀律與「空審查合法」（#9）；(6) 跨模型家族當對抗訊號（Claude Code 做不到）；(7) 每次載入的文字量小（#39）；(8) 腳本重跑自稱的量測、腳本代寫失敗 handoff 並分類（#24、#25）；(9) 無人值守的設計完整：謂詞、worktree、決策日誌、「時長不是結束條件」。

**fankeel 比 pstack 好的地方：** 閘門、碰撞守衛、扇出上限、唯讀型別的 shell 阻擋、token 預算都是 hook 強制而非文字（pstack 自己的原則 separate-before-serializing 說「Instructions and conventions are not concurrency control」，它對 session 卻只有文字）；ledger 跨 compaction 存活；stage agent 乾淨 context＋handoff 檔；audit 階段（文件真偽、殘留、記憶檢查、注入量檢查、陳舊規則刪除測試）pstack 完全沒有；原生 Claude Code，無 adapter 退化；judge 答案逐字存檔。

### 4. 建議採納的前五名（排序＋工作量）

1. **每功能驗證地圖（#10，A）**：新增 `.fankeel/verify/README.md`＋每功能一檔（Sub-features／怎麼到達／怎麼驅動／Gotchas），或擴充 `render.json`；verify 的 verifier 依地圖驅動真實介面並附 Doctor 檢查（「這個實例值得驅動嗎」）與「cleanup 不吃證據」規則；audit 的 14 天週期加一次地圖對帳（原始碼讀者＋一次 live pass→clean/changed/blocked）。工作量：大——2–3 個 build 任務，約 300 行 skill 文字、一個小 `verify-map.js` lint、verifier agent 改寫。
2. **種類 lens（#3＋#35＋#6，B）**：bug-fix（自己重現、`Root cause: X because Y`、失敗 repro 先入 commit）、perf（基線→限制因子→≥5 次）、refactor（先釘行為契約、不留 shim）寫進 design 準則表與 implementer；修補第 3 輪強制寫下共同前提。工作量：小–中，約 60 行、三個檔。
3. **land 的回顧＋規則↔強制表（#14＋#15，B/A）**：land「搬到耐久處」步驟可選派一個讀 transcript 的 reviewer，以 slimmer 的「提案 diff、使用者核准」形式提出 skill／CLAUDE.md 修改；另寫一頁「每條注入規則由哪個 hook／腳本強制」。工作量：中（新 agent 約 150 行＋測試）＋小（一頁文件）。
4. **reviewer 紀律（#9＋#33，B）**：三條駁回規則、「no findings 是合法結果」、四條推定阻擋項；verify 的確認 reviewer 用與首輪不同的模型。工作量：小，約 30 行，agents/fankeel-reviewer.md 與 verify:292。
5. **階段中問題分類＋失敗 handoff（#2＋#25，B）**：calibration 加「能跑出來觀察的事實不問人」一句並與 build 四種停對齊；await.js 的 lost/timeout 寫合成 handoff（模式＋建議下一步）。工作量：小，約 40 行。

第六順位：survey 的 history lens（#17）。

### 5. 需要使用者在討論中決定的點

1. **無人值守**：是否允許一個 profile 鍵（例如 `gate.away: <stages>`）在使用者宣告離開時以 profile 的常備答案代答階段閘門。這直接牴觸 skills/fankeel/SKILL.md:469-472；我的判斷是不加，因為 gate.js 的去重與 handoff 流程全建立在「閘門一定被問」之上，但這是設計立場不是事實。
2. **PR 流程**：記憶顯示使用者在本機 commit／release，不走 PR；若未來走 PR，#19 的 `gh pr checks --watch` 與 Bugbot 分流才有意義。
3. **設計多候選**：architectural class 是否值得「兩個候選草圖＋judge 選一」（#7）。Claude Code 只有同家族模型，對抗訊號弱、成本雙倍。
4. **stage skill 瘦身**：build 806 行 vs pstack 一本 playbook 21 行。pstack 證明「短 mode＋短 playbook＋重委派」可行，但 fankeel 的長度有一部分在描述 hook 互動；是否用 input-check 量化後設上限。
5. **transcript 衍生的學習**：#14 要讀 session transcript，有成本與隱私面；是否只在 land 且使用者明說時跑。
6. **讀者輸出規範**：讀者已自發用 EXTRACTED/INFERRED；是否把 `why` 的五層與「不知道什麼」節正式寫進 fankeel-reader 的回傳形狀。

### 6. 覆蓋核對（checklist）

1–6 poteto-mode／playbooks／bugbot-triage／scripts／watch-pr／agents：已答（orch 全文、watch-pr 主檔全文、其測試僅標題）。7–9 principle-\*／setup／help／manifest／README：已答。10–11 審查與驗證技能：已答。12 其餘技能：已答。13 docs/guide：已答（圖檔只記名）。14 harness 對映與 diff：已答。15 benny：已答。16 orchestrate：已答（測試檔標題；11 個測試檔未列標題）。17–22 姊妹外掛：已答。23 無關目錄：已確認。24 fankeel 自身：已答（lib 本體、rationale.md、pipeline.md 未讀）。未讀：僅二進位檔、LICENSE、bun.lock，以及上述測試本體。
