---
judged: 2026-10-26T18:19:52.590Z
model: fable
agent: fankeel-judge
task: "分析近期 session 的 skill 使用量，列出不常用的 plugin／skill 以便精簡"
session: feb572cd-2bdf-492b-84a4-1bc7358205fa
stage: survey
---

# Brief 38 — Which plugins and skills do recent sessions actually use, and which can go?

## Question

# Brief 38 — Which plugins and skills do recent sessions actually use, and which can go?

## Question

The user (繁體中文): 「我要管理我的插件，請你幫我深度分析近期的 session 有使用到的 skill，那些不常用的 skill 幫我把它列出來，我想要做調整，讓我的 Claude kit 可以再簡化一些。」

Measure, from real transcripts, how often each installed plugin / skill / agent / MCP server was used in recent sessions, then list the rarely- or never-used ones with a recommendation per item (keep / disable / uninstall / disable per-project), so the user can slim what loads into every session. Do not change any setting or uninstall anything — this is a read-only analysis; the user decides.

## Where the data is (readers must read, never run untrusted code)

- Transcripts: `C:/Users/user/.claude/projects/*/*.jsonl` (≈5100 project dirs/files total — sample the **last 30 days** by mtime, across all projects, not just `F--ymlab-fankeel`; say how many sessions were counted). Subagent transcripts sit under `<session>/subagents/agent-*.jsonl`.
- Usage signals in a transcript: `Skill` tool_use with `input.skill`; `<command-name>/x</command-name>` user lines (slash commands); `Agent` tool_use `input.subagent_type`; tool names `mcp__<server>__*`; LSP tool use. Count per session (sessions that used it) and total calls.
- Helpers in this repo that may already do part of this — read them first, run them only if read-only: `scripts/conversation.js`, `scripts/skills-check.js`, `scripts/usage-compare.js` (F:/ymlab/fankeel/scripts/).
- Installed: `C:/Users/user/.claude/plugins/installed_plugins.json` (fankeel, impeccable, launch-video, taste-skill, pyright / rust-analyzer / typescript-language-server from claude-code-lsps), `known_marketplaces.json`, `C:/Users/user/.claude/settings.json` (`enabledPlugins`, MCP), `C:/Users/user/.claude/skills/` (incl. `synced/`), project `.claude/settings*.json` and `.mcp.json` where present.
- Also visible in this session's skill list but not plugins: `anthropic-skills:*` (docx, pdf, pptx, xlsx, docs, google-workspace, deep-research, morning, chrome-browser, built-in-browser, computer-use, artifact-emulator, consolidate-memory, import-memory, setup-claude, skill-creator, explain-usage), `dataviz`, built-ins. MCP servers seen: playwright, claude-in-chrome, a docs connector, mcp-registry, scheduled-tasks, visualize, terminal. Separate what the user can remove (their plugins, their skills dir, their MCP config) from what the app ships and cannot be removed — say which is which.
- Prior judgement: `docs/90-agent/judgements/2026-10-26-karpathy-skills.md` says andrej-karpathy-skills was installed; it is no longer in installed_plugins.json — confirm.
- fankeel's own skills are many (`skills/*/SKILL.md`, 15 dirs); report their usage too, but fankeel is the user's own product — flag rarely-used fankeel skills as "review", not "uninstall".
- Cost angle: each enabled plugin's skill/agent descriptions ride every session's system prompt. If measurable, give the per-item description size (chars) so the saving is concrete.

## Options

A. A ranked table + a short "remove/disable" list (user's own removable items only), plus a "keep though rare" list with the reason.
B. Same as A, and additionally a ready-to-run command list (e.g. `claude plugin disable <x>` / settings edits) — commands only, not executed.
C. Something else, if the data shows the question is wrong (e.g. nothing meaningful to cut).

## What counts as an answer

One pick; a table: item | kind (plugin/skill/agent/MCP) | removable by user? | sessions used (last 30d) | calls | per-session prompt cost | recommendation. State the sample (date range, session count, projects). Anything not measured is labelled unmeasured.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文 with the table.

## Answer

pick: B — a ranked table plus a remove/disable list and a ready-to-run command list (not executed); the data shows real cuts: taste-skill and rust-analyzer at 0 uses, launch-video and pyright at 1, impeccable at 6 of 305 sessions.
why: Non-bench sample is 305 sessions / 19 projects, 2026-10-07..10-26 (all 13,966 transcript files on disk fall inside 30 days; 5,079 of 5,384 in-window "sessions" are fankeel bench temp dirs and were excluded).
taste-skill: 0 Skill calls incl. subagent transcripts, `pluginUsage.usageCount 0` in ~/.claude.json, yet enabled at C:/Users/user/.claude/settings.json:25 and carrying the single largest description (948 chars, SKILL.md:3-13).
rust-analyzer: pluginUsage 0, LSP tool used in 1 session; launch-video: 1 session (cmd 1+2 calls); impeccable: 6 sessions/19 calls, its 4 agents 0; fankeel: every stage used, but phone/station/upgrade 0, explain 1, retro-all 1, slimmer 2.
Description text riding every session: 12,557 chars across 38 items; fankeel is 9,482 (75%); removable zero/one-use items are 1,953 chars (taste-skill + launch-video), 3,075 with impeccable.
would flip if: a project's `.fankeel` profile sets `design.skill` to `taste-skill:*` (lib/profile.js:31) for an upcoming design stage — then taste-skill becomes "disable per-project", not uninstall.
unread: `.fankeel/map.md` (not named, not needed); `lib/compare.js` / `lib/usage.js` bodies (reader A grepped only); the 45 `mcptool:*` rows (in the tool-results file, per-server totals suffice); description chars of the 14 app-synced `anthropic-skills` SKILL.md files (unmeasured — app-shipped, not removable).
delegated: sonnet — F:/ymlab/fankeel/scripts/usage-compare.js, scripts/skills-check.js (ran), scripts/conversation.js, lib/conversation.js, lib/usage.js (grep); sonnet — C:/Users/user/.claude/plugins/installed_plugins.json, known_marketplaces.json, C:/Users/user/.claude/settings.json, C:/Users/user/.claude.json (keys only via script), C:/Users/user/.claude/skills/** (listing), F:/ymlab/fankeel/.claude/settings.local.json, docs/90-agent/judgements/2026-10-26-karpathy-skills.md; sonnet — installed_plugins.json + every `skills/*/SKILL.md`, `agents/*.md` under C:/Users/user/.claude/plugins/cache/* (38 files, via script); opus — all 13,966 `*.jsonl` under C:/Users/user/.claude/projects (via script) + two spot-check greps.
checklist: 1 usage-compare.js — answered (date-range comparison, no per-skill count, writes nothing); 2 skills-check.js — answered (lint only, no size figure; run clean of errors); 3 conversation.js — answered (one session to md/jsonl, not a tally); 4 installed_plugins.json — answered (7 plugins, karpathy absent, 0 grep hits); 5 known_marketplaces.json — answered (11 marketplaces, 6 with no installed plugin); 6 settings.json — answered (7 enabledPlugins all true, no mcpServers); 7 ~/.claude.json — answered (user MCP: playwright only; skillUsage/pluginUsage ledgers read); 8 ~/.claude/skills — answered (only app-synced buckets, no user skill); 9 project settings/.mcp.json — answered (only settings.local.json permissions; no plugins/MCP); 10 karpathy judgement — answered (:55 says installed per 10-17 debug.log; now absent); 11 description chars — answered (12,557 chars / 38 items); 12 transcript counts — answered (bench-inflated run + non-bench recount of 305 sessions).

## Summary

### 樣本

- 資料：`C:/Users/user/.claude/projects/` 下全部 13,966 個 `.jsonl`（含 `<session>/subagents/agent-*.jsonl`），全部落在 30 天內；時間範圍 **2026-10-07 10:08Z ～ 2026-10-26 18:10Z**（磁碟上沒有更早的 transcript）。
- 第一次全量統計（reader D，opus）得 5,384 個 session、5,098 個 project，但其中 5,079 個 project 是 `*-bench-*` 暫存目錄（fankeel 自己的 bench 跑的），會灌水 fankeel 的 agent 數字。我自己用同一份邏輯排除 `bench` 目錄重算：**305 個真實 session、19 個 project**（F--ymlab-fankeel 166、F--ymlab-SBIR-ProjectWorkspace 66、C--ils-blind-* 六個共 49、其餘 24）。下表一律用這個非 bench 數字；非 fankeel 項目兩次數字完全相同，fankeel 的 implementer/reader/mover/mutator 則從 252/355/159/93 降到 130/121/12/21，證實灌水只在 fankeel 自家 agent。
- 交叉驗證：`~/.claude.json` 的 `skillUsage` / `pluginUsage`（Claude Code 自己的計數器）與 transcript 統計一致 — 例如 `taste-skill@taste-skill` usageCount 0、`rust-analyzer` 0、`pyright` 1、`launch-video@launch-video` 3、`fankeel:fankeel-explain` 1、`fankeel:fankeel-retro-all` 1。
- 本 repo 的三支 helper 都不做這件事：`scripts/usage-compare.js:4,13` 是兩個日期區間的 session 對照（無 Skill/Agent/mcp 解析）；`scripts/skills-check.js:5-13` 是 SKILL.md 的 lint（跑了，只有 10 條 bare-reference 與 17 條 unnamed-script，無尺寸數字）；`scripts/conversation.js:4,15` 是單一 session 轉 md/jsonl。所以統計是 reader D 用我給的 node 腳本現做的。
- 「每 session 提示成本」= 該項 `description:` 的字元數（reader C 量，38 個檔案；我抽查 `cache/fankeel/fankeel/0.118.0/agents/fankeel-brain.md:3` 為單行 description，`cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/SKILL.md:3-13` 為 10 行 folded 文字，與 948 字元相符）。SKILL.md 本文只在呼叫時才載入，不算在內。總計 **12,557 字元 / 38 項**，約 3,100 token/session。

### 表一：使用者可移除的項目（plugin、user-scope MCP、marketplace）

| 項目 | 類型 | 可移除？ | 使用 session（/305） | 呼叫數 | 每 session 提示成本 | 建議 |
|---|---|---|---|---|---|---|
| taste-skill@taste-skill | plugin（1 skill） | 可 | **0**（含 mockup 子代理 transcript；pluginUsage 0） | 0 | **948 字元**（全 kit 最大的單一 description） | **停用或解除安裝** |
| rust-analyzer@claude-code-lsps | plugin（LSP） | 可 | **0**（pluginUsage 0；LSP 工具全體只 1 session/3 次） | 0 | 0 字元（但啟動時載入 LSP 伺服器） | **解除安裝**（19 個 project 無一是 Rust；未量測各 project 語言，見下） |
| launch-video@launch-video | plugin（2 skills、1 agent） | 可（自家產品） | **1**（`/launch-video:launch-video` 1、`-render` 1 session 2 次；pluginUsage 3，最後 10-15） | 3 | **1,005 字元** | **全域停用，只在 F:/ymlab/launch-video 用專案 settings 啟用** |
| pyright@claude-code-lsps | plugin（LSP） | 可 | ≤1（pluginUsage usageCount 1） | — | 0 字元 | 停用；有 Python 專案再 per-project 啟用 |
| impeccable@impeccable | plugin（1 skill、4 agents） | 可 | skill 6（19 次）+ `/impeccable:impeccable` 2；**4 個 agent 全部 0** | 23 | **1,122 字元**（skill 591 + agents 531） | 稀用但保留，或改 per-project（前端專案才開） |
| typescript-language-server@claude-code-lsps | plugin（LSP） | 可 | transcript 看不出（LSP 工具 1 session）；pluginUsage 24,333、87 次啟動都在用 | — | 0 字元 | 保留 |
| playwright（`~/.claude.json` user-scope mcpServers） | MCP | 可 | 5 | 246 | 工具 schema（未量測） | 保留；若只有單一專案在用可改 project scope（哪個專案未量測） |
| fankeel@fankeel | plugin（15 skills、15 agents） | 可（自家產品） | `/fankeel:fankeel` 148、每個 stage 都有用 | — | **9,482 字元（佔全 kit 75%）** | 保留；內部 review 見表二 |
| 6 個沒有已安裝 plugin 的 marketplace：claude-plugins-official、ponytail-per-session、superpowers-dev、claude-code-plugins、designer-skills、karpathy-skills（known_marketplaces.json:2-6,10-14,19-23,28-32,46-50,64-68；settings.json extraKnownMarketplaces :33-102） | marketplace | 可 | — | — | 0（不進提示） | 可清，純整潔；claude-plugins-official 是官方源建議留 |

立即可省：taste-skill + launch-video = 1,953 字元（15.6%）；再加 impeccable = 3,075 字元（24%），約 500–770 token/session。

### 表二：fankeel 自家 skill／agent（標 review，不是 uninstall）

| fankeel skill | session | 呼叫 | desc 字元 | 標記 |
|---|---|---|---|---|
| fankeel-phone | **0** | 0 | 230 | review（20 天 0 用；檔案僅 937 字元，可能是新件） |
| fankeel-station | **0** | 0 | 419 | review（同上；可能是 board upgrade 新件） |
| fankeel-upgrade | **0** | 0 | 236 | review |
| fankeel-explain | 1 | 1 | 404 | review |
| fankeel-retro-all | 1（cmd） | 1 | 282 | review |
| fankeel-init | 6 | 6 | 286 | 保留（初始化本來就少） |
| fankeel-ask | 14 skill + 44 cmd | 71 | 272 | 保留 |
| fankeel-survey | 21 | 22 | 302 | 保留 |
| fankeel-audit | 22 | 22 | 292 | 保留 |
| fankeel-design | 30 | 30 | 297 | 保留 |
| fankeel-verify | 40 | 40 | 309 | 保留 |
| fankeel-build | 45 | 45 | 340 | 保留 |
| fankeel-plan | 56 | 56 | 295 | 保留 |
| fankeel-land | 60 | 60 | 273 | 保留 |
| fankeel | 18 skill + 148 cmd | 192 | 465 | 保留 |

| fankeel agent | session | 呼叫 | desc 字元 | 標記 |
|---|---|---|---|---|
| fankeel-slimmer | 2 | 2 | 264 | review |
| fankeel-retro | 5 | 5 | 307 | review |
| fankeel-writer | 6 | 6 | 321 | review |
| fankeel-init-scout | 6 | 6 | 376 | 保留（配 init） |
| fankeel-mover | 12 | 19 | 231 | 保留 |
| fankeel-render-reviewer | 16 | 39 | 321 | 保留 |
| fankeel-mutator | 21 | 52 | 359 | 保留 |
| fankeel-mockup | 25 | 94 | 404 | 保留 |
| fankeel-judge | 52 | 70 | 370 | 保留 |
| fankeel-verifier | 53 | 363 | 184 | 保留 |
| fankeel-fixer | 92 | 398 | 293 | 保留 |
| fankeel-brain | 112 | 702 | 493 | 保留 |
| fankeel-reader | 121 | 833 | 208 | 保留 |
| fankeel-implementer | 130 | 1,340 | 334 | 保留 |
| fankeel-reviewer | 140 | 1,930 | 315 | 保留 |

review 項合計：skill 側 1,571 字元、agent 側 892 字元（slimmer/retro/writer）。

### 表三：app 內建、使用者移不掉（只列數字，供對照）

| 項目 | 類型 | session | 呼叫 | 說明 |
|---|---|---|---|---|
| anthropic-skills:*（docx、pdf、pptx、xlsx、docs、google-workspace、deep-research、morning、chrome-browser、built-in-browser、computer-use、artifact-emulator、import-memory、skill-creator） | app 同步 skill | 只有 built-in-browser 1 session；其餘 **0** | 1 | 住在 `C:/Users/user/.claude/skills/synced/<bucket>/`，由 app 同步（有 `.bucket-*` 標記），`~/.claude/skills/` 本身沒有任何使用者自建 skill。刪目錄會不會被重新同步：未驗證。desc 字元未量測 |
| workflow-authoring / plugin-authoring / claude-api / update-config | Claude Code 內建 skill（pluginUsage 的 `cc-plugin-*@builtin`） | 12 / 4 / 1 / 1 | 14 / 4 / 1 / 1 | 不可移除 |
| dataviz | app 內建 | 2 | 8 | 不可移除 |
| ccd_turn / ccd_session / ccd_session_mgmt / ccd_view | MCP（Claude Desktop session 工具） | 87 / 19 / 6 / 1 | 1,179 / 30 / 13 / 2 | app 提供；fankeel 的 hook 掛在這些工具名上（`.claude-plugin/plugin.json:192,203`），plugin.json 沒有自己的 `mcpServers` |
| Claude_Browser / claude-in-chrome | MCP | 37 / 1 | 329 / 1 | app 內建瀏覽器與 Chrome 擴充 |
| docs connector、mcp-registry、scheduled-tasks、visualize、terminal | MCP | **0** | 0 | transcript 裡完全沒有 `mcp__` 呼叫；app 內建 |
| ils / bom / fsc / inc / apply / evidence / mip / mrc / tlca | 專案本地 skill（C--ils-blind-* 六個 project） | 各 6–7 | 各 6–7 | 不在全域 kit，不影響其他 session |
| askdraft@skills-dir | pluginUsage 有記錄（7,986、最後 10-26、87 次啟動） | — | — | `~/.claude` 下 Glob 找不到任何 `askdraft*`；**未定位**，可能在別的專案的 `.claude/skills/`，請自行確認 |

### 已經不在機器上的（視窗內有用過、現在已移除）

ponytail（最後 10-11）、security-guidance@claude-code-plugins（10-21）、superpowers（10-20）、understand-anything（10-22）、frontend-design（10-15）、**andrej-karpathy-skills**：`docs/90-agent/judgements/2026-10-26-karpathy-skills.md:55` 說它裝著（依 10-17 的 `debug.log:73`），現在 `installed_plugins.json` grep `karpathy` 0 筆、`enabledPlugins`（settings.json:24-32）七項裡也沒有 — **確認已移除**，只剩 marketplace 條目。

### 建議的指令（選項 B，未執行；子指令名稱請先以 `claude plugin --help` 核對）

```text
claude plugin uninstall taste-skill@taste-skill
claude plugin uninstall rust-analyzer@claude-code-lsps
claude plugin disable pyright@claude-code-lsps
claude plugin disable launch-video@launch-video
#   然後在 F:/ymlab/launch-video/.claude/settings.json 加：
#   {"enabledPlugins": {"launch-video@launch-video": true}}
claude plugin disable impeccable@impeccable          # 可選；前端專案的 .claude/settings.json 再開
claude plugin marketplace remove karpathy-skills
claude plugin marketplace remove designer-skills
claude plugin marketplace remove superpowers-dev
claude plugin marketplace remove ponytail-per-session
# 可選：claude mcp remove playwright -s user ；在真正用到的專案改以 .mcp.json 或 -s project 加回
```

### 沒量到的

- 各 project 用什麼語言（決定 pyright／rust-analyzer 是否真的不需要）— 只從 19 個 project 名稱判斷，沒有一個明顯是 Rust。
- playwright 是哪個 project 在用（統計沒分 project）。
- anthropic-skills 同步 skill 的 description 字元數；刪掉 `skills/synced/` 會不會被重新同步。
- `askdraft@skills-dir` 的位置。
- 全表（含 45 列 `mcptool:*`）在 `C:/Users/user/.claude/projects/F--ymlab-fankeel/feb572cd-2bdf-492b-84a4-1bc7358205fa/tool-results/bghj8jnq1.txt:5102-5245`。已用 `context.js add` 把樣本定義與兩個 0 用 plugin 記進 `F:/ymlab/fankeel/.fankeel/build/task-20261026T180540/context.md`。
