---
judged: 2026-10-29T14:51:46.401Z
model: fable
agent: fankeel-judge
task: "評估 Anthropic 程式碼審查實務對 fankeel 的借鏡"
session: bbac9d48-ff67-4add-a917-0716b477e67e
stage: survey
---

# Brief 44 — Anthropic's internal AI code-review practice: what should fankeel take?

## Question

# Brief 44 — Anthropic's internal AI code-review practice: what should fankeel take?

html: yes

## Question

The user pasted a 繁體中文 summary said to come from an Anthropic-internal guide on AI code review and asked: 「參考評估看看 CLAUDE 自家作法」 — evaluate it against fankeel (this repo: a Claude Code plugin that runs a task through survey/design/plan/build/verify/audit/land stages with subagents, gates at each stage end via AskUserQuestion). What should fankeel borrow, what does it already do, what should it deliberately not do? fankeel is used by one user (sometimes a small lab), on their own repos, mostly without PRs (land.integration = merge, land.push = false here) — weigh every point against that scale, not Anthropic's monorepo.

## The summary's claims (user's paste — unverified as Anthropic's actual guide; the figures are the paste's, treat as unverified)

Core shift: ask "what can go wrong with this change, and which check — automation or a human — best catches it", not "has someone read it". Reported: PR merges ×2, revert rate −40%, 1-pass review 65%→78%, ≥5-round PRs 8.9%→1.5%, substantive comment rate 16%→54%.

Stage 1, pre-PR: deterministic checks (tests, build, lint, types, screenshot-vs-design) run and fixed by the AI; verification commands in CLAUDE.md for a self-correction loop; Prettier via hooks; `/code-review` runs a fresh-context subagent on the diff, prompt says ignore style.

Stage 2, post-PR: skip draft/closed/trivial PRs; 4 parallel agents (2 check CLAUDE.md rules, 2 hunt logic bugs); each finding cross-verified by another subagent, posted only at confidence ≥80. CLAUDE.md = dev rules; REVIEW.md = review-only goals, severity rubric, exemptions (e.g. don't repeat what CI blocks). Severity: Important (breaks behaviour) / Nit (max 5) / Pre-existing. Separate `/security-review` (injection, authz, data leakage) blocks merge. Review-loop limits: at round 3 the author redesigns; later rounds review only the new diff; label findings by pattern so they get fixed at once; recurring findings go into CLAUDE.md / REVIEW.md / a lint rule.

Stage 3, humans: a classifier routes by risk not author — low (docs, copy, behind a flag) needs no human; medium (product logic, caching, auto-updater, system prompt) 1 human; high (billing, CI workflows) 2. One-way doors (can't be reverted: publishing, charging, deleting data, prod deploy shape) have fixed mechanical checks that block merge, overridable with an `ai-override` label whose rate is tracked. Agent approval never counts as a human vote; a human approval is for one commit — new pushes need re-approval. Human duties: direction and taste, high-risk areas, architecture patterns others will copy, reading the test evidence (can't name the automation's blind spot → don't approve), you land it you own it.

Stage 4, evaluation: incident-based quiz — past incident PRs replayed daily against the reviewer; a prompt/model change is kept only if the score rises. Guardrails: human review time, and revert/incident rate (if that rises, time just moved from review to firefighting). Missing: a circuit breaker that tightens gates when reverts spike.

## Background in this repo (these decide the answer — check each, path:line)

- Deterministic checks / self-correction: `scripts/suite.js`, `scripts/review-check.js`, `scripts/gate-check.js`, `scripts/design-lint.js`, `scripts/residue.js`, `scripts/css-dead.js`, `scripts/skills-check.js`, `scripts/docs-check.js`; render review vs mockup: `agents/fankeel-render-reviewer.md`, `scripts/render.js`. CLAUDE.md verification commands (repo root `CLAUDE.md`).
- Fresh-context review: `agents/fankeel-reviewer.md` (+ `-high`, `-xhigh`), how build reviews each task (`skills/fankeel-build/SKILL.md`, search "review"), verify's adversary (`skills/fankeel-verify/SKILL.md`), `scripts/lenses.js` — what lenses exist (security? sensitive?), `scripts/security-local.js`, profile keys `security.local`, `sensitive.review`.
- Confidence threshold / cross-verification / severity: does the reviewer return a severity or confidence today? Is a finding re-verified before it reaches the implementer? Does anything cap nits?
- REVIEW.md analogue: is review guidance separated from per-turn rules (e.g. lenses, reviewer agent body) — or would a per-project REVIEW.md be new? Note the cost rule: every per-turn line rides every prompt.
- Review-loop limit: does build cap fix/review rounds per task (search `skills/fankeel-build/SKILL.md` and `scripts/ledger.js` for round/retry/attempt limits)? What happens on the 3rd failure?
- Recurring findings → rules: `skills/fankeel-retro-all/SKILL.md`, `agents/fankeel-retro.md`, `docs/90-agent/reference/improvement-brief.md` — fankeel's own path from repeated failure to a skill/rule edit.
- Risk classification: task classes spike/bounded/architectural (`skills/fankeel-survey/SKILL.md`), route choice, `dispatch.floor` raising architectural to opus/high. Is risk class per change content or per task?
- One-way doors: `skills/fankeel-land/SKILL.md` (merge/pr/keep, push off), `docs/03-decisions/2026-10-19-no-unattended-gate.md`, guard/collisions (`docs/90-agent/reference/collisions.md`), `sensitive.mode`, `commit.js`. The memory rule "release on every fankeel change" (version bump + `plugin update`) — is publishing a release a one-way door here?
- Human sign-off layer: gates at design/plan/verify evidence; `docs/01-guide/concepts.md`. Does any stage approval count an agent's approval as the user's? Does a gate re-ask after new commits?
- Evaluation / guardrails: `scripts/eval.js`, `scripts/bench.js`, `docs/90-agent/reference/evals.md` — is there an incident-replay set (past bugs replayed against reviewer/skills)? Any revert-rate or rework metric (`scripts/spend.js`, `scripts/weekly.js`, git `revert` count)?
- Consistency with the closest prior judgement: `docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md` (measure, don't read) and `2026-10-26-karpathy-skills.md`, `docs/03-decisions/2026-09-24-optimise-own-first.md` — agree or say why not.
- Queued work: `docs/90-agent/todo/` and `docs/90-agent/reference/sources.md` — anything already about review rounds, severity, security review, revert metrics.

## Options

A. Already covered — name where each stage's mechanism lives; no change.
B. Borrow named pieces, ranked by value/cost for a one-user plugin — e.g. reviewer findings carry severity (Important/Nit/Pre-existing) with a nit cap; a second-pass verify of each finding before it reaches the fixer; a round cap per build task (3 → back to design/plan); a per-project REVIEW.md read only by the reviewer; an incident-replay eval from fankeel's own past bugs; a revert/rework guardrail in the weekly or station; one-way-door list at land. Each with target file and first concrete edit.
C. Adopt the full pipeline (risk classifier, multi-human approval, ai-override) — argue if scale justifies it.
D. Something else.

## What counts as an answer

One pick. Then a table: each mechanism in the summary → fankeel today (path:line, or "absent") → take / already have / reject, one-line why (scale, cost-per-turn, or duplication). For every "take", the first concrete step, target file and rough cost. Say which items make no sense at one-user scale. Anything not verified from files is labelled unverified.

## Shape

Six fields (`pick:` first), `## 白話` (≤600 chars, 繁體中文), then `## Summary` in 繁體中文 with the table; a ```chartroom fence is welcome if it makes the take/have/reject split clearer.

## Answer

pick: B — 只借一件有自家證據的：把 fankeel 自己記錄過的漏抓（11 次 verify 退回、3 筆真 revert）做成事故回放 eval；其餘貼文機制 fankeel 已有（多半更硬）或在單人、本地 merge、不 push 的規模下沒有對象；順帶修一個發現：-high/-xhigh reviewer 變體漏掉 base 的反 nit 規則。
why: Stage 1–3 幾乎逐條已有：diff 新 context 審、忽略風格（fankeel-reviewer.md:21-26,69-82）；每條發現先由 Verify-mode 確認者過濾（skills/fankeel-build/SKILL.md:478-486）；五輪封頂＋第三輪前寫共同前提＋只審新 sha（:487-491,:514）；專案 REVIEW.md 只給 reviewer 讀（reviewer.md:57-65）；全 nit 回 clean（:77-78）；gate 只問人（docs/03-decisions/2026-10-19-no-unattended-gate.md:8,20）；無綠紀錄不記整合（skills/fankeel-land/SKILL.md:96-98）。
why: 唯一真缺口在 Stage 4：evals/ 10 案全是植入題、手動跑、無「分數要升才留」規則（docs/90-agent/reference/evals.md:46-50），但 fankeel 有自己的事故紀錄可回放（sources.md:102 VERIFY-ELEVEN-RETURNS-261001）——合 optimise-own-first:8「先有自己的問題再看對方」。
why: revert 護欄、斷路器不收：嚴格數 `Revert "` 自 9/1 起 3/4741，量了≈0；四個平行審查員、依內容風險派 1–2 人簽、ai-override 計率，在單人且 land.integration=merge、push=false 下沒有對象。
why: 與 10-26 karpathy（A，實質已有不加第二份）、10-28 uncle-bob（B，借量測不借架構）一致。
would flip if: evals/ 裡已有任一案取自真實 verify 退回或 revert（則 A，無事可做）；或 lab 改走多人 PR、land.push=true（則依路徑風險路由、push 後重簽值得收，部分 C）。
unread: nothing named left unopened；部分：docs/90-agent/reference/improvement-brief.md 只讀 1-762/1252 其餘 grep；根目錄 CLAUDE.md 不存在（Glob 只在 .fankeel/build 下見舊副本）。
delegated: sonnet — scripts/suite.js, scripts/review-check.js, scripts/gate-check.js, scripts/design-lint.js, scripts/residue.js, scripts/css-dead.js, scripts/skills-check.js, scripts/docs-check.js, scripts/render.js, agents/fankeel-render-reviewer.md, .claude-plugin/plugin.json, hooks/stop.js；opus — agents/fankeel-reviewer.md, agents/fankeel-reviewer-high.md, agents/fankeel-reviewer-xhigh.md, skills/fankeel-build/SKILL.md(review), skills/fankeel-verify/SKILL.md, scripts/lenses.js, lib/lenses.js, scripts/security-local.js, lib/profile.js(security.local/sensitive.review), docs/01-guide/profile.md:53, skills/fankeel-init/SKILL.md:145；opus — skills/fankeel-build/SKILL.md(rounds), scripts/ledger.js, agents/fankeel-reviewer.md(REVIEW.md), tests/agents.test.js:342, skills/fankeel/SKILL.md:262,528-530, docs/90-agent/reference/subagents.md:280；sonnet — skills/fankeel-retro-all/SKILL.md, agents/fankeel-retro.md, docs/90-agent/reference/improvement-brief.md, docs/90-agent/records/2026-10.md；sonnet — skills/fankeel-survey/SKILL.md, lib/profile.js:23-25,98-99, skills/fankeel/SKILL.md:969-976, lib/stage-registry.js:31；sonnet — skills/fankeel-land/SKILL.md, docs/03-decisions/2026-10-19-no-unattended-gate.md, docs/90-agent/reference/collisions.md, scripts/commit.js, docs/01-guide/concepts.md, lib/sensitive.js, docs/01-guide/profile.md:34-35,59, docs/01-guide/development.md:248；sonnet — scripts/eval.js, scripts/bench.js, docs/90-agent/reference/evals.md, evals/*, scripts/spend.js, scripts/weekly.js, lib/weekly-collect.js, git log；sonnet — docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md, docs/90-agent/judgements/2026-10-26-karpathy-skills.md, docs/03-decisions/2026-09-24-optimise-own-first.md, docs/90-agent/todo/*, docs/90-agent/reference/sources.md
checklist: 1 確定性檢查／CLAUDE.md 驗證指令 — answered（有七支腳本＋suite 綠紀錄；根 CLAUDE.md 不存在）；2 reviewer 新 context／嚴重度／信心／交叉驗證／nit 上限／security lens — answered；3 build 輪數上限與第三輪／REVIEW.md 類比 — answered；4 重複失敗→規則的路徑 — answered；5 風險分類依任務或依內容／dispatch.floor — answered；6 單向門／gate 只問人／新 commit 後重問 — answered（重問：無）；7 事故回放 eval／revert 指標 — answered（皆無；真 revert 4/5266）；8 前判與佇列 — answered（review-1、reviewer-1 皆已 done）

## 白話

選 B：fankeel 該向這份 Anthropic 作法借的只有一件——把自己過去真的漏掉的 bug 做成「重考題」，每次改審查員的說明書就拿來考一次，分數掉了就不收；其餘要嘛早就有，要嘛是大公司車隊才需要的。像家裡只有一個人開車，不必裝公司的派車與雙主管簽核系統，但行車記錄器值得裝。fankeel 已經有：新眼睛審 diff、每條發現先由第二個審查員確認才交給修的人、修五輪封頂、第三輪前先寫下共同前提、專案自訂審查規則檔、安全掃描、每站停下來問人、沒綠燈不准合併。不該學的：四個審查員同時跑、依風險指派一到兩個人簽、撤回率警報——你近兩個月的撤回紀錄只有三筆，量了等於零。順帶一提：新加的兩個高強度審查員副本漏抄了「全是小毛病就回乾淨」那條，補上即可。

## Summary

### 讀者發現與抽查

八個 reader 各一段，我每段抽查一處引文，全部與原文相符；差異只有一處數字：reader 7 以 `grep -i revert` 數到 44 筆，但那包含「reworded」等雜訊，我以 `--grep='^Revert "'` 嚴格數為全史 4 筆、2026-09-01 起 3 筆／4741 commit（≈0.06%）。本次 dispatch 未給 session id，故未執行 `context.js add`；chartroom 格式未驗證，不冒險放 fence，以下用表。

- Reader 1（確定性檢查）：`scripts/review-check.js:3-12` 抽查符合——它是 build 每任務審查的「機械部分」，印三張表、1 代表有發現，reviewer 只判表判不了的事。`suite.js:3-11` 跑測試並為 `task.js land` 記錄；`skills-check.js:4-14`、`docs-check.js:4-15`、`design-lint.js:3-7`、`css-dead.js:3`、`residue.js:4`、`gate-check.js:4-9` 各管一事，失敗皆非零退出。`render.js:3-11` 只拍不比，比對由 `agents/fankeel-render-reviewer.md:45-72` 的 LLM 逐 data-block 對 mockup。根目錄無 CLAUDE.md（Glob 證實，只有 `.fankeel/build/` 下舊副本與他人 repo 的）；plugin.json 的 PostToolUse/Stop hook 無 lint/format/test（reader 未讀 hooks/hooks.json 內容，列為未驗）。
- Reader 2（reviewer，opus）：`agents/fankeel-reviewer.md:57-83` 抽查符合——先讀專案根 REVIEW.md，其「不報」清單併入 Never a finding，其 Important 定義決定嚴重度；內建不報：diff 前就有的、linter 會抓的、純風格、已 disable 的；全 nit 回 `clean`；追不到真實呼叫點的假設不報；「我會用別的做法」不是發現。`:150-154` 抽查符合——Security lens 每條 `conf: 0.x`，低於 0.7 丟棄。回傳格式（:301-304；build:398-400）為「一行一條、最嚴重在前」，無 Important/Nit 標籤。`-high`/`-xhigh` 兩個變體（未追蹤）缺 base 的 :77-83、`## Numbering`、四條推定裁切、context.md 行，`last_verified` 10-09 vs base 10-23。lenses.js 只有 `silent-failure`、`comment`（lib/lenses.js:42-43）；Security（:126）與 Sensitive（:205）是 reviewer.md 內的 lens 段，Security 在 verify 必跑，Sensitive 由 `sensitive.review`（profile.js:99，預設 false）開；`security.local`（profile.js:67）是本地 ollama 先篩。
- Reader 3（輪數，opus）：`skills/fankeel-build/SKILL.md:478-503` 抽查符合——第一輪有發現就派一個 Verify-mode reviewer 整批確認，只有 CONFIRMED/PLAUSIBLE 進修正輪；修正輪五輪封頂；第三輪前用 `ledger.js ruling` 寫下前兩輪共同前提再修；五輪後仍開的寫成 rulings、任務標完成。`:514` 每輪只審 `前一 sha..新 sha`；`:648-650` 停滯就換上一階模型。ledger.js 無每任務計數器，輪數由 `Fix:` 行數推（build:538 station gate 頁計）。無 `review.*` profile 鍵；REVIEW.md 只 reviewer 讀，tests/agents.test.js:342 有測。每回合成本規則在 skills/fankeel/SKILL.md:528-530。
- Reader 4（retro）：`skills/fankeel-retro-all/SKILL.md:44-55` 抽查符合——兩包以上才算 recurring、才出 hunk（最多五條）；一次的只記 `once:`；需要程式碼的寫 `backlog:` 不出 hunk。agents/fankeel-retro.md:49-53 每 hunk 附 evidence 行、:58-61 由人核准。沒有自動把重複發現變成 lint 的路；improvement-brief.md 另有「寫在 registry 能被檢查、寫在散文只能被讀」（:544）的偏好。
- Reader 5（風險分類）：`lib/profile.js:20-25` 抽查符合——`land.integration`/`land.push` builtin null（docs/01-guide/profile.md:34-35 寫預設 merge/false，reader 未解此歧異）；`dispatch.floor` 預設 sonnet，architectural 自動抬至 opus/high。類別（survey:272-278）依任務形狀：spike／bounded（既有流程）／architectural（新子系統或介面），「有疑慮取重的」（:280）；無依路徑或內容（billing/CI）的分類；`sensitive.mode` 掃 commit 內容詞彙非路徑。
- Reader 6（land/gate）：`skills/fankeel-land/SKILL.md:96-99` 抽查符合——`task.js land` 沒有「程式碼未變的 sha 上的綠紀錄」就不記整合。`docs/03-decisions/2026-10-19-no-unattended-gate.md:8,20` 抽查符合——gate 一律問人，不加代答鍵；「gate 是使用者唯一核准一站成果的地方」。其他機械拒絕：commit.format（commit.js:254-261）、sensitive block（:293）、不 `-D`、不 `--force`（land:397,415）、merge 後重跑 suite（:377-380）；無 override 旗標。release 只在使用者說是 release 時（land:210），`npm test` 在版本與 changes 不符時失敗（:207）；`plugin update` 不在 land skill 內（只在記憶規則）。gate「新 commit 後重問」：無（grep 無命中）。
- Reader 7（evals/指標）：`docs/90-agent/reference/evals.md:46-50` 抽查符合——花真錢、不進 CI、只在 release 前手跑；無「分數要升」規則。evals/ 10 案皆植入題（security-lens、route-typo…），grep incident/regression/bug/revert 無命中。spend.js:44,59、weekly-collect.js:198-210 欄位皆成本與活動量，無 revert/rework。
- Reader 8（前判與佇列）：`docs/90-agent/todo/review-1.md`（自訂 review.md）2026-09-29 done；`reviewer-1.md`（過濾紀律：全 nit 回 clean、假設追呼叫點、「我會用別的做法」駁回、verify 確認者換模型）2026-10-19 done——兩者抽查符合。前判：10-26 karpathy pick A；10-28 uncle-bob pick B（借量測）；optimise-own-first:8,15「先對到 fankeel 自己的一個問題再問」。sources.md 是自家報告索引：REVIEWER-COST-260907（一任務一 reviewer 值不值）、VERIFY-ELEVEN-RETURNS-261001（verify 退回 build 十一次、review 各漏了什麼）。

### 逐項對照表

| # | 貼文機制 | fankeel 今天 | 判 | 一行理由 |
|---|---|---|---|---|
| 1 | 確定性檢查先由 AI 跑並修 | suite.js:3-11；review-check.js:3-12；skills-check.js:4-14；docs-check.js:4-15；design-lint.js:3-7；css-dead.js:3；residue.js:4；land:96-98 紅即拒 | 已有 | 且是拒絕而非句子 |
| 2 | CLAUDE.md 列驗證指令自我修正 | 根 CLAUDE.md 不存在；指令住各站 skill，可壓縮的才上每回合（skills/fankeel/SKILL.md:528-530） | 已有（形式不同） | 每回合成本規則不允許再加 |
| 3 | Prettier via hooks | 無 format/lint hook（plugin.json；hooks.json 未驗） | 拒 | 是專案的事，不是外掛該帶的 |
| 4 | 截圖 vs 設計 | render.js:3-11 拍；render-reviewer.md:45-72 對 mockup | 已有 | — |
| 5 | /code-review 新 context、忽略風格 | reviewer.md:21-26,69-82 | 已有 | — |
| 6 | 跳過草稿／瑣碎 PR | class spike/bounded 路由（survey:272-274） | 已有 | 依任務形狀而非 PR 狀態 |
| 7 | 4 個平行 agent（2 規則 2 邏輯） | 每任務 1 reviewer＋1 確認者（build:478-486）；verify adversary＋opus 確認者（verify:313-322） | 拒 | 單人成本無證據；sources.md:56 問的正是一個 reviewer 值不值 |
| 8 | 每條交叉驗證、信心≥80 才貼 | build:478-486 CONFIRMED/PLAUSIBLE；Security conf≥0.7（reviewer:153） | 已有 | 一般發現不加數字：確認者就是機制，數字是假精度 |
| 9 | CLAUDE.md／REVIEW.md 分離、豁免 CI 已擋的 | reviewer.md:57-65 讀專案根 REVIEW.md，只 reviewer 讀；:69-75 豁免 linter 會抓的；todo/review-1 done | 已有 | fankeel 自己沒寫 REVIEW.md——可選不排名（無記錄問題） |
| 10 | Important／Nit／Pre-existing、Nit≤5 | 無標籤；最嚴重在前（build:398-400）；Pre-existing 即「不報」（reviewer:69-70）；全 nit 回 clean（:77-78）；REVIEW.md 可定 Important（:63-64） | 已有實質 | 不加 rubric；但 -high/-xhigh 變體漏 :77-83——補 |
| 11 | 獨立 /security-review 擋 merge | verify 全分支 Security lens 必跑（verify:260-266）；security.local 先篩（profile.js:67） | 已有／擋 merge 拒 | 單人：gate 就是人 |
| 12 | 第 3 輪重設計、後續只審新 diff、依模式歸類、重複入規則 | 五輪＋第三輪前提（build:487-491）；只審新 sha（:514）；停滯升階（:648-650）；五輪後 rulings（:501-503）；retro 兩包才改（retro-all:44-48） | 已有 | 「3 輪退回 design」不收：gate 看得到 rulings |
| 13 | 風險分類器：低 0 人／中 1／高 2 | 類別依任務形狀（survey:272-278）；architectural 抬 opus/high（profile.js:25）；無依路徑風險 | 拒 | 單人無多人簽；無 billing/CI 路徑；機密由 sensitive.txt 詞彙掃描（profile.js:98） |
| 14 | 單向門機械檢查、ai-override 計率 | land:96-98；commit.js:254-261,293；不 -D／--force（land:397,415）；無 override 旗標；rulings 即 override 紀錄（ledger.js:758） | 已有 | 本設定本地 merge、push=false：幾乎無單向門；不加清單、不計率 |
| 15 | agent 核准不算人；核准綁一個 commit | gate 只問人（no-unattended-gate:8,20）；suite 綠紀錄綁 sha（land:96-98）；gate 無「新 commit 重問」 | 已有實質 | 每站各自 gate 已涵蓋 |
| 16 | 人看測試證據、說不出盲點不簽、誰 land 誰負責 | concepts.md:47 核准的是做法與證據表；verify adversary 四問（verify:251-258） | 已有 | — |
| 17 | 事故回放 eval、分數升才留 | evals/ 10 案皆植入題、手跑、不進 CI、無升分規則（evals.md:46-50） | **收（第一名）** | fankeel 有自己的事故：sources.md:102 十一次 verify 退回、3 筆真 revert |
| 18 | 護欄：人審時間、revert／事故率；斷路器 | spend/weekly 無 revert/rework 欄；真 revert 3/4741（9/1 起） | 拒 | 量測值≈0；fix 輪數 station gate 已算（build:538） |

### 收的項目：第一步、目標檔、成本

1. **事故回放 eval**（表 #17）。目標：`evals/verify-return-01/`（`case.yaml`、`prompt.md`、`graders/*.md`，沿 evals.md:13 既有格式）。第一步：從 `docs/90-agent/reports/2026-10-01-verify-eleven-returns.md` 挑一筆 diff 仍在 git 的漏抓，prompt 給 reviewer 當時的 diff 範圍與 brief，grader 用 regex 比對它當年漏掉的 `path:line`；evals.md 加一句「改 `agents/fankeel-reviewer.md` 前後各跑一次，掉分不收」。成本：一案約一小時，跑一次 `claude -p` 的錢；三到五案即可。這是唯一同時合 optimise-own-first:8（先有自家問題）與 10-28「量，不讀」的項目。
2. **-high／-xhigh 變體補齊**（表 #10 順帶發現，非貼文機制）。目標：`agents/fankeel-reviewer-high.md`、`agents/fankeel-reviewer-xhigh.md`。第一步：確認未追蹤的 `scripts/variants.js` 是否由 base 產生這兩檔（**未驗**）；是就重跑，不是就把 base :77-83、`## Numbering`、四條推定裁切、context.md 行補進去。成本：幾分鐘。不補的話，高強度審查反而少了反 nit 規則。
3. **可選、不排名**：fankeel 自己的根 `REVIEW.md`，一行「skills-check／docs-check／review-check 已擋的不報」——零每回合成本（只 reviewer 讀），但目前無記錄顯示 reviewer 重複報這些，依 optimise-own-first:15 先不問，等第一次出現再寫。

### 單人規模下沒有意義的項目

四個平行審查員（#7）、依內容風險派 1–2 人簽（#13）、ai-override 標籤與其比率（#14）、revert／事故率護欄與斷路器（#18）、獨立 security-review 擋 merge（#11）、Prettier hook（#3）。共同理由：對象是多人、多 PR、有 billing/CI 路徑、revert 可量的 monorepo；這裡是一人、本地 merge、不 push、近兩月 3 筆 revert。

### 未從檔案驗證、須標 unverified

貼文的所有數字（×2、−40%、65→78%…）；`scripts/variants.js` 是否產生變體；`sessions.js --breakdowns` 的實際輸出（只見 todo/foreign-1:12 文字）；repo 是否有 eslint/prettier；`CONTRIBUTING.md` 內容；`lib/suite.js` blocker 與 `task.js land` 原始碼（依 skill 文字）；`hooks/hooks.json` 內容；`land.integration`/`land.push` 在 profile.js builtin null 與 profile.md 寫預設 merge/false 的歧異。

### 與前判的一致性

10-26 karpathy pick A（實質已有就不加第二份）——本判 16/18 項「已有」沿用同一準則；10-28 uncle-bob pick B（借量測、不動架構）——本判唯一的收是量測工具（回放 eval）；09-24 optimise-own-first——收的那件對到 VERIFY-ELEVEN-RETURNS-261001 這個自家記錄過的問題，拒的都是「對方有、fankeel 沒有」而無自家問題對應。
