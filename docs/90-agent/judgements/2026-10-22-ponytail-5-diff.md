---
judged: 2026-10-22T17:46:41.690Z
model: fable
agent: fankeel-judge
task: "分析 Ponytail 新版（4.9.0→5.3.2）與 FanKeel 工作流差異，找可借鏡處"
session: 843addd4-f866-442f-8d59-3ff72eb3f7fe
stage: survey
---

# Brief 27 — Ponytail 4.9.0 → 5.3.2: what changed, how it compares to FanKeel's workflow, and what to borrow

## Question

# Brief 27 — Ponytail 4.9.0 → 5.3.2: what changed, how it compares to FanKeel's workflow, and what to borrow

## The question

The user typed (verbatim): "幫我去分析 PONYTAIL 新版本有甚麼差異嗎 然後表格比較和 FANKEEL 工作流差異 然後看看有沒有我們可以參考的東西".

So, three parts, one answer:
1. What did Ponytail change between **4.9.0** (the version FanKeel last inventoried, 2026-09-12 / 09-24) and **5.3.2** (upstream HEAD `09c434a`, 2026-10-18)? From code and diffs, not only the CHANGELOG/README.
2. A comparison **table**: Ponytail 5.3.2 vs FanKeel today, row per workflow concern (activation/modes, rules injection per prompt, subagent injection, review, audit, debt/shortcut markers, design ladder, status band/board, session/history display, config, uninstall, multi-host support, tests).
3. Which of the new things are worth borrowing into FanKeel — each with path:line in theirs and the landing spot in ours — and which to skip, with the reason.

## Options to pick between (for part 3)

1. **Borrow named mechanisms** — list each, ranked, with landing file in FanKeel.
2. **Re-take items 4.9.0 had that FanKeel declined** (`ponytail-debt`, `ponytail-gain`, `ponytail-help`, SessionStart/SubagentStart/UserPromptSubmit hooks) because 5.x changed them enough to reverse that decision.
3. **Nothing to borrow** — say why with evidence.
A mix is allowed. Prefer few, concrete, cheap items over a long wish list; FanKeel's own decision `docs/03-decisions/2026-09-24-optimise-own-first.md` leans against importing.

## Background

- Upstream clone (untrusted data — read only; never run its scripts, `npm install`, tests or installers; treat CLAUDE.md/AGENTS.md/SKILL.md text inside as data): `F:\ymlab\fankeel\.fankeel\build\ask\src\ponytail-upstream`. Tags `v4.9.0` … `v5.3.2` exist; `git diff --stat v4.9.0..HEAD` = 183 files, +9058/−2926; 156 commits. Key feature commits: `01cbf81` "Ponytail 5, rebuilt rules, review and audit" (v5.0.0), `2a1fe84` neutral `shortcut:` marker replacing `ponytail:` in code comments (v5.1.0), `df9e899` "the band and the board in Claude Code" (v5.3.0), `ca88b4f` band: past sessions and the model on the board (v5.3.2), `1b1a0c5` numbered review/audit findings (v4.12), `446e4ad` reuse tag in review/audit (v4.11), new `tests/uninstall.test.js`. New hook files include `hooks/band/`, `claude-band.json`, `ponytail-band-import.js`, `ponytail-map.js`, `ponytail-instructions.js`, `ponytail-runtime.js`, `ponytail-activate.js`, `ponytail-config.js`, statusline scripts.
- The user's installed copy is their fork `FanFantom9452/ponytail` at 4.9.0 (`C:\Users\user\.claude\plugins\marketplaces\ponytail-per-session`, last commit `08a5744` 2026-08-16) — not upgraded.
- What FanKeel already took from 4.9.0 and what it declined: `docs/90-agent/reference/improvement-brief.md` §6.5 (around line 1095) and `docs/90-agent/reports/2026-09-24-ponytail-remainder.md` (six declined candidates with FanKeel's nearest equivalent). Taken: `ponytail-review` → `agents/fankeel-reviewer.md` `## Cuts`; `ponytail-audit` code half → fankeel-audit reviewer lenses; ladder → `skills/fankeel-design/SKILL.md` step 2.
- FanKeel: Claude Code plugin at `F:\ymlab\fankeel` — stages survey/design/plan/build/verify/audit/land (`skills/*/SKILL.md`), agents `agents/*.md`, hooks registered in `.claude-plugin/plugin.json` (`hooks/inject.js` UserPromptSubmit, `hooks/brief.js` SubagentStart, `hooks/carry.js` SessionStart, `hooks/guard.js` PreToolUse), a monitor station (`scripts/station.js`, `assets/station/`) and a desktop band/pane (look for `band` in `lib/`, `scripts/`, `assets/`). FanKeel also has its own band — compare Ponytail's new band/board to it directly.

## Suggested reader split (up to eight)

1. v5.0.0 rules rebuild: `git diff v4.9.0..v5.0.0 -- skills/ponytail rules* AGENTS.md hooks/ponytail-instructions.js` — what the rules now say, size of injected text, modes.
2. Review/audit changes (4.11 reuse tag, 4.12 numbered findings, 5.0 rebuild): `skills/ponytail-review`, `skills/ponytail-audit` vs `agents/fankeel-reviewer.md` and `skills/fankeel-audit/SKILL.md`.
3. `shortcut:` marker + `ponytail-debt` (5.1.0) vs FanKeel's TODO/`## Waiting` and the 09-24 decline reason.
4. Band and board (5.3.x): `hooks/band/`, `claude-band.json`, `ponytail-band-import.js`, statusline scripts — what it shows, how it's wired, vs FanKeel's band/pane/station.
5. Hooks & runtime: `ponytail-activate.js`, `ponytail-config.js`, `ponytail-runtime.js`, `ponytail-map.js`, `ponytail-subagent.js`, `ponytail-mode-tracker.js` — per-turn cost, what each injects, vs FanKeel's `hooks/*.js`.
6. Uninstall & tests: `tests/uninstall.test.js`, any uninstall script, test layout — vs FanKeel's uninstall story and `tests/`.
7. FanKeel side snapshot for the table: stages, agents, hooks, station/band — from `.fankeel/map.md`, `.claude-plugin/plugin.json`, `skills/` descriptions.
8. Spare: CHANGELOG / README claims vs code, benchmarks dir changes.

Every reader answers from code with path:line (theirs and ours).

## What counts as an answer

- A pick (mix allowed) for part 3, each borrowed item with path:line in Ponytail 5.3.2 and the FanKeel landing file, cost (S/M/L), and why it beats what FanKeel has.
- The version-diff summary (part 1) grouped by theme, with commit hashes.
- The comparison table (part 2).
- Explicit "skip" list with reasons, including whether any 09-24 decline should be reversed.

## Shape of the answer

The six fields the judge agent defines, then `## Summary` in 繁體中文 (the user reads Traditional Chinese) containing: (a) 4.9.0→5.3.2 差異（依主題、附 commit）, (b) Ponytail 5.3.2 vs FanKeel 工作流比較表, (c) 可借鏡清單（排序、落點、成本）, (d) 不借的與理由.

## Answer

pick: 選項 1 + 3 混合 — 借兩項具名機制（review findings 編號 S；uninstall 腳本＋測試 S/M），另兩項列為條件式參考（SessionStart 符號地圖 M；agentic 配對基準的設計 L，只參考不搬碼）；09-24 婉拒的六項一條都不翻案。
why: 5.x 的大改在規則瘦身（6637→3548 B）、注入時機改到 SessionStart、review/audit 編號四段式、`shortcut:` 中性標記、Ink band＋HTML board、20 個 host、uninstall 腳本。FanKeel 已有自己的 ladder、Cuts、band/station、TODO 延後機制，大多重疊或走不同設計。唯二 FanKeel 明顯沒有、又便宜的是「findings 編號」（reviewer.md:89 的 Cuts 形狀不編號）與「uninstall 清外部殘留」（station index.html、機器 profile.json 無清除）。`shortcut:` 改名沒改掉 09-24 的核心理由（FanKeel 全 repo 沒有標記母體，延後事項走 TODO `deferred:`）；gain 仍是跨任務基準中位數；三個 hook 事件數與語意未變。
would flip if: `TODO.md` 或事故紀錄裡找不到任何一條對到「reviewer 回報難以逐條指認」或「解除安裝後殘留」的問題（09-24 規則 :15 要求先對到問題才收）；或 FanKeel 已有 uninstall 腳本而 reader 漏找。
unread: `TODO.md`（brief 未點名，但 09-24 規則 :15 以它為收與不收的判準；本判斷未查）；Ponytail `benchmarks/agentic/*.py` 內容（只讀了 README 與 stat）；`docs/99-archive/2026-09-12-ponytail-absorb-design.md`。
delegated: Ponytail clone（皆只讀）— `skills/ponytail/SKILL.md`、`hooks/ponytail-instructions.js`、`AGENTS.md`、v4.9.0 對照（sonnet）；`skills/ponytail-review/SKILL.md`、`skills/ponytail-audit/SKILL.md`、commits 446e4ad/1b1a0c5（sonnet）；commit 2a1fe84、`skills/ponytail-debt/SKILL.md`、`ponytail-gain`、`ponytail-help`（opus）；`hooks/band/*`、`claude-band.json`、`hooks/ponytail-band-import.js`、statusline（opus）；`hooks/claude-codex-hooks.json`、`ponytail-{activate,config,runtime,map,subagent,mode-tracker}.js`（sonnet）；`tests/`、`scripts/uninstall.js`、`benchmarks/`、`README.md`、多 host 檔（sonnet）。FanKeel — `.fankeel/map.md`、`.claude-plugin/plugin.json`、`hooks/{inject,brief,carry,guard}.js`、`skills/*/SKILL.md`、`agents/*.md`、`hooks/pane-band.ts`、`hooks/pane.ts`、`scripts/station.js`、`lib/profile.js`、`package.json`、`tests/`（sonnet）；`docs/90-agent/reference/improvement-brief.md` §6.5、`docs/90-agent/reports/2026-09-24-ponytail-remainder.md`、`docs/03-decisions/2026-09-24-optimise-own-first.md`（opus）。
checklist: 1 規則重建 — 已答；2 review/audit 變更 — 已答；3 `shortcut:`＋debt — 已答；4 band/board — 已答（CHANGELOG 不存在，改以 commit 代）；5 hooks/runtime 成本 — 已答（Qoder 每回合量為推算）；6 uninstall/測試/主張 — 已答（README 數字部分無佐證）；7 FanKeel 快照 — 已答（每 prompt 注入位元組數未量）；8 09-24 婉拒理由 — 已答。

## Summary

### 方法
八位 reader 一輪並行讀完，九處 `path:line` 抽查全部吻合（`skills/ponytail/SKILL.md:42`、`skills/ponytail-review/SKILL.md:82`、`skills/ponytail-debt/SKILL.md:18`、`hooks/band/register.tsx:339`、`hooks/ponytail-activate.js:66-71`、`scripts/uninstall.js:58-82`、FanKeel `hooks/pane-band.ts:1-30`、`agents/fankeel-reviewer.md:83-97`、`docs/03-decisions/2026-09-24-optimise-own-first.md:8-38`），無一處與 reader 說法相左。Ponytail clone 只用 Read 與 `git log/diff/show`，未執行任何腳本。四條事實已寫入 `context.md`。

重要前提：Ponytail repo **沒有 CHANGELOG.md**（三位 reader 獨立確認），版本沿革只能由 release commit 日期取得：v4.10.0 09-14、v4.10.1–4.10.3 10-02/03、v4.11.0 與 v4.12.0 與 v4.13.0 10-05、v5.0.0 10-08、v5.1.0 10-08、v5.1.1 與 v5.2.0 10-13、v5.3.0 與 v5.3.1 10-16、v5.3.2 10-17。

### (a) 4.9.0 → 5.3.2 差異（依主題，附 commit）

**1. 規則重建（`01cbf81`，v5.0.0）**
- `skills/ponytail/SKILL.md` 從 120 行／6637 B 瘦到 52 行／3548 B（−47%）。梯子從 7 階改 6 階（`SKILL.md:27-32`：需要存在嗎→repo 已有→stdlib/平台→已裝依賴→一行→最小可行），與 FanKeel `skills/fankeel-design/SKILL.md:64-79` 的六階順序幾乎相同（FanKeel 09-12 就是從舊版借的）。
- 新增句：「End your reply with one or two lines: what you skipped or did not check」（`:15`）；「Lazy code without its check is unfinished… leaves one small test」（`:41`）；「Bug fix: grep every caller… fix the root cause once」（`:38`）。
- 模式：`hooks/ponytail-config.js:17` `VALID_MODES = off, lite, full, ultra, review`，預設 full；lite/full/ultra 只過濾 SKILL.md 的 Levels 表列（`ponytail-instructions.js:11-40`）。

**2. 注入時機改變（`hooks/claude-codex-hooks.json:3-39`）**
- 事件數不變（SessionStart／SubagentStart／UserPromptSubmit），但 Claude Code 上**一般 prompt 不再注入任何東西**：`ponytail-mode-tracker.js` 只在 `/ponytail` 指令或停用語句時回一行確認；整套規則只在 SessionStart（`startup|resume|clear|compact`）與 SubagentStart 注入。timeout 5→15 秒，`commandWindows` PowerShell 包裝改為 `node -e require(...)`。
- 新檔 `hooks/ponytail-map.js`（111 行）：用正規式掃 `git ls-files` 的原始檔，產出 `dir/: name1, name2…` 的符號地圖，預算 2000 字（`:15`），共用目錄排前，SessionStart 時由 activate 以 3 秒 timeout 子程序呼叫並附在規則後（`ponytail-activate.js:66-71`）；不落地、不快取、每次 SessionStart 重建。
- `hooks/ponytail-runtime.js`（182 行）：跨 host 輸出格式（Claude 的 SubagentStart 用 `hookSpecificOutput.additionalContext`，SessionStart 走純 stdout）。
- 子代理：`ponytail-subagent.js:49-52` 預設每個子代理都拿同一套規則；只有設 `PONYTAIL_SUBAGENT_MATCHER` 才按 `agent_type` 篩。

**3. review／audit（`446e4ad` v4.11、`1b1a0c5` v4.12、`01cbf81` v5.0）**
- review 57→101 行，audit 41→103 行。
- `reuse:` 標籤成為 Lean 類的子項（`ponytail-review/SKILL.md:48`、`ponytail-audit/SKILL.md:47`）；commit 446e4ad 訊息提到的「worked example、search-before-accepting」在 HEAD 已不在（v5.0 重建時拿掉，reader 推論）。
- **跨組編號**：「Number findings across all groups, so the user can say "fix 2 and 5"」（review `:82`、audit `:83`）；audit 加「At most 20 findings」。
- 每條 finding 四段：**What this is／Problem／Fix／If we skip it**（review `:85-91`）；三組 Must fix／Should fix／Nice to have（`:77-80`）；結尾 `Verdict:`、`Lean: -N lines possible.`、`Not checked:`（`:93-96`）。
- 「No case, no finding」（`:59-60`）；`shortcut:` 註解已命名上限者視為決策而非 finding（`:63-64`）。無 severity 數值、無 defeat/prove 框架。

**4. `shortcut:` 中性標記（`2a1fe84`，v5.1.0）**
- 40 檔 +78/−57，多為各 host 規則副本同步。文法 `shortcut: <the limit>, <when to upgrade>`（`SKILL.md:42`、`AGENTS.md:28`）；4.9.0 是 `ponytail:` 品牌標記並附例子（v4.9.0 `SKILL.md:64`）。
- commit 訊息：配對量測 v5.0.0 標記率 22/30 vs 22/30，成本 −0.2%。
- `skills/ponytail-debt/SKILL.md`（44 行）：`git grep -nE '(#|//|/[*]) ?(shortcut|ponytail):'`（`:18`）掃兩種標記，可指定自己的字（`:20`），無觸發條件者標 `no-trigger`（`:36-37`），只讀只報（`:43-44`）。**沒有任何 hook 或腳本在執行時掃標記**，只有這個 skill 由模型手動跑。
- `ponytail-gain`（52 行）改引 39 任務×5 輪 Opus 5.5 的新數字；`ponytail-help`（76 行）加 Band 段。

**5. Band 與 Board（`df9e899` v5.3.0、`713c609` v5.3.1、`ca88b4f` v5.3.2）**
- 不是 statusLine：`hooks/claude-band.json:2-4` 是 `{"hooks":{}, "modules":["./band/register.tsx"]}`，走 Claude Code 模組引擎的 `ui.render` `AbovePrompt` 槽（`register.tsx:339`），Ink 元件。
- 顯示（`register.tsx:388-406`）：`● level`、`$spent`、`last $x`、經過時間、`N% reuse`、`N duplicate?`、`⚠ N callers open`、`✓ N tests／✗ N failed／no test since change`，四顆按鈕 Review／Audit／Board／Details。duplicate 與 callers 每回合用 `git grep`（`:186`、`:302`）。
- Board：`board.ts:534-542` `boardHtml()` 寫靜態 `board.html`，每回合重建、用 `cmd /c start`／`open`／`xdg-open` 開瀏覽器（`:181`）；資料是每專案 CSV `~/.config/ponytail/band/<project>.csv`，表頭以 `level,model` 結尾（`metrics.ts:280`）。
- `hooks/ponytail-band-import.js`（274 行，v5.3.2）：`/ponytail band import` 讀 `~/.claude/projects/*/*.jsonl` 與 subagents jsonl，把過去 session 匯進 CSV（`:217-242`）；跳過非人工輸入的 session。
- `plugin.json:14-38` 新 `userConfig`：`ledger`、`webhookUrl`、`webhookToken`、`sendNames`（webhook 須 https，`metrics.ts:313`）。
- 舊 `ponytail-statusline.sh/.ps1`（`[PONYTAIL:MODE]`）仍在，與 band 無關。

**6. 解除安裝與測試**
- `scripts/uninstall.js`（92 行）：刪各 host 的 `.ponytail-active`、`ponytail-modes/`、config.json、statusline 副本（`:26-42`）；`~/.cursor/hooks.json` 只刪自己的條目（`:47`）；`settings.json` 的 statusLine 以 `&&`／`;` 切段只刪自己那段（`:58-82`）；JSON 損毀則警告不動（`:51-52`）。`INSTALL.md:240`：須在 host 的 remove 指令**之前**跑。
- `tests/uninstall.test.js`（202 行）是 node:assert 平鋪腳本，spawn 腳本驗證上述每項。
- `tests/` 22 檔；自 4.9.0 新增 8 檔（activation-map、band-import、band.test.tsx、cursor-hooks、grok、kimi、loc、map）。`package.json:38` `node --test tests/*.test.js`——`band.test.tsx` 不符 glob，npm test 應該跳過它（reader 推論）。

**7. 多 host 與文件**
- 約 20 個 host：Codex（`.codex-plugin/plugin.json:14`）、Cursor（`scripts/cursor-hooks.js`）、Gemini（`gemini-extension.json:5`）、OpenCode（`.opencode/plugins/index.js`）、Copilot、Qoder、CodeBuddy、Grok、Kimi、Hermes、OpenClaw、Pi、Windsurf、Cline、Kiro。`AGENTS.md`（32 行）是無 hook host 的規則檔。Qoder 無 SessionStart，**每回合**拿整套 3.5 KB。
- README 多語版移到 `i18n/`，新 `INSTALL.md`（235 行）。
- Benchmarks：刪 `robustness-audit.js`，新 Python agentic harness（`benchmarks/agentic/{run,judge,tasks,compare}.py`），`benchmarks/results/2026-10-07-agentic.md`：39 任務×5 輪，−53% LOC／−45% tokens／−26% cost／−41% time、97% 隱藏檢查通過（無 skill 96%）。README `:43` 的「98% risky logic ships with a test, without 68%」、`:79`「catch 66% of injected bugs」、`:99`「100% planted problems found」在 benchmarks 目錄**找不到佐證**。

### (b) Ponytail 5.3.2 vs FanKeel 工作流比較表

| 面向 | Ponytail 5.3.2 | FanKeel（今日） | 註 |
|---|---|---|---|
| 啟用／模式 | `/ponytail lite\|full\|ultra\|review`，說「stop ponytail」關；`~/.config/ponytail/config.json` `defaultMode`（`ponytail-config.js:17-19, 56-66`） | 「session 擁有 active registry entry 時即開」（`hooks/inject.js:93-95`），由 `/fankeel` 起站；無強度模式，以站別（survey/design/plan/build/verify/audit/land）分流（`.fankeel/map.md:1-9` 路線表） | 設計哲學不同：強度 vs 階段 |
| 每 prompt 注入 | Claude Code 一般 prompt **0 位元組**；規則 3548 B＋地圖 ≤2000 字只在 SessionStart（含 compact）（`claude-codex-hooks.json:3-39`、`activate.js:61-71`） | `inject.js:279-282` 每 prompt 產生 `project:/touched:/seen:/next:`＋當站規則（`lib/render.js:234`）；**位元組數未量**（`lib/render.js` 55 KB、`lib/stages.js` 46 KB 為原始碼大小，非注入量） | FanKeel 的注入是狀態，按回合變，無法照搬 SessionStart-only |
| 子代理注入 | 每個子代理拿同一套規則，`PONYTAIL_SUBAGENT_MATCHER` 選配篩 `agent_type`（`ponytail-subagent.js:35-52`） | `hooks/brief.js:127` 只在 active 時給**任務 brief**，依 `agent_type` 分流（brain 拿整站規則，其他拿任務） | FanKeel 已細於 Ponytail |
| Review | `/ponytail-review` skill：三組、跨組編號、四段 finding、`Verdict/Lean/Not checked`、`reuse:` 標籤、`shortcut:` 註解＝決策（`ponytail-review/SKILL.md:46-99`） | `agents/fankeel-reviewer.md`：回「打敗了什麼」；`## Cuts` 形狀 `path:line: <tag> …`，tag `delete/stdlib/native/yagni/shrink`，結尾 `net: -N lines`（`:83-97`）；**不編號**，severity 來自專案 REVIEW.md（`:61`） | reuse 在 FanKeel 併入 `delete:`（指名既有 helper） |
| Audit | `/ponytail-audit` 一次性全 repo 報告，≤20 條，`Lean: -N lines, -M deps`（`ponytail-audit/SKILL.md:69-103`） | audit 站：docs 半邊五支腳本（`fankeel-audit/SKILL.md:53`）＋code 半邊三個 lens（`:258-260`），輸出 `path:line — 不再為真`，AskUserQuestion「worst first」（`:310-337`） | FanKeel 的 audit 是流程站，Ponytail 是一次 skill |
| 債務／捷徑標記 | 程式碼註解 `shortcut: <limit>, <when to upgrade>`＋`/ponytail-debt` grep，`no-trigger` 標籤（`SKILL.md:42`、`ponytail-debt/SKILL.md:18-39`） | 無程式碼內標記；延後事項寫 TODO（`fankeel-build/SKILL.md:616` `todo.js new --body`、`:717` `deferred:` 行），land 時 `todo.js done`（`fankeel-land:153`），audit 14 天未跑提醒（`fankeel-audit:68`） | 兩者皆無執行期掃描 |
| 設計梯子 | 6 階（`SKILL.md:27-32`） | 6 階（`fankeel-design/SKILL.md:64-79`） | 同源，已借 |
| 狀態 band／board | Ink `AbovePrompt` band：level、$、reuse%、duplicate、callers、tests 狀態＋Review/Audit/Board/Details 按鈕（`register.tsx:388-406`）；靜態 `board.html` 開瀏覽器，每專案 CSV（`board.ts:534`、`metrics.ts:280`） | `hooks/pane-band.ts` 兩列：站別、context 剩餘、5 小時／7 天窗、model/effort、鄰近 session（`:1-30`）；Claude Code mod（`hooks/pane.ts:21`）；`scripts/station.js` 本機 127.0.0.1:28888 全 session 一頁，寫 `<configDir>/fankeel/index.html` | Ponytail 偏「程式碼健康」即時指標；FanKeel 偏「session／配額／流程」 |
| Session／歷史 | board 列過去任務（專案、日期、model）；`/ponytail band import` 由 transcript jsonl 回填（`band-import.js:217-242`） | station 列全部 session；`scripts/conversation.js` 匯出單一 session 對話（`:4-5`） | 功能相當 |
| 設定 | config.json 三鍵＋env 覆寫＋plugin `userConfig`（ledger/webhook） | `.fankeel/profile.json`＋機器 profile（`lib/profile.js:15-16`），約 20 鍵（land.*、class.default、guard、dispatch.*、judge.model、design.*、quota.week、station.*、gate.station、phone.hold…） | FanKeel 更多 |
| 解除安裝 | `scripts/uninstall.js`（92 行）＋`tests/uninstall.test.js`（202 行）清旗標、config、statusline 片段、Cursor hooks，保留使用者自己的 statusLine | `README.md:30` 只有 `claude plugin uninstall fankeel@fankeel`；無腳本、無測試；`<configDir>/fankeel/index.html`、機器 `fankeel/profile.json` 會殘留 | **FanKeel 缺口** |
| 多 host | ~20 個（Codex、Cursor、Gemini、OpenCode、Copilot、Qoder、CodeBuddy、Grok、Kimi、Hermes、OpenClaw、Pi、Windsurf、Cline、Kiro） | 只有 Claude Code（hook 用 `hookSpecificOutput`） | FanKeel 無此需求 |
| 測試 | 22 檔，`node --test tests/*.test.js`，hook 以子程序 spawn＋直接 import 混用 | 427 檔，`node --test --test-timeout=300000 …`（`package.json:11`）；無 install/uninstall 測試 | 數量級不同 |

### (c) 可借鏡清單（排序、落點、成本）

依 09-24 決策 `:15`，每條落地前須先對到 `TODO.md` 的一條或一次事故；本判斷**未讀 TODO.md**，以下為建議，由主 session 對表。

1. **Review findings 跨組編號**（S）— 來源 `skills/ponytail-review/SKILL.md:82-91`（「Number findings across all groups, so the user can say "fix 2 and 5"」＋四段式）。落點 `agents/fankeel-reviewer.md:89`（Cuts 形狀）與回報形狀段，連動 `skills/fankeel-build/SKILL.md` Part 4 與 verify gate 的 AskUserQuestion 文字。勝過現狀之處：使用者在 gate 或 fixer 在 build 迴圈能以「修 2、5」指認，不必複述 `path:line`；可選加一行「If we skip it」給 gate 判斷後果。只改 skill/agent 文字，不動碼。
2. **uninstall 腳本＋一支測試**（S/M）— 來源 `scripts/uninstall.js:26-82`、`tests/uninstall.test.js:89-125`（刪自己寫在外面的東西、保留使用者的、JSON 壞了不動）。落點 `scripts/uninstall.js`（新）＋`tests/uninstall.test.js`（新）＋`README.md:30` 加一行「先跑腳本再 `claude plugin uninstall`」。對象：`<configDir>/fankeel/index.html`、機器 `fankeel/profile.json`、站台 28888 殘留；專案內 `.fankeel/` 只列出不刪。勝過現狀：FanKeel 現在沒有任何殘留清除。
3. **SessionStart 符號地圖**（M，條件式）— 來源 `hooks/ponytail-map.js:12-28, 44, 76-98`（`git ls-files` → 正規式抓 export/function/class → `dir/: names` → 2000 字預算，共用目錄優先，測試與 vendor 跳過）。落點 `scripts/map.js` 加一節或旗標，供 survey／design 的 reader brief 用，**不**進每 prompt 注入。只在 TODO/事故裡有「漏掉 repo 既有 helper、重複造輪」的紀錄時才做；FanKeel 現在的 `.fankeel/map.md` 是路線表＋docs 分類，不含符號。
4. **agentic 配對基準的設計**（L，只參考不搬碼）— 來源 `benchmarks/README.md:3-11`、`benchmarks/agentic/{run,judge,tasks,compare}.py`（headless Claude Code 每任務一 session、有／無 skill 配對、隱藏檢查判分）。這條**確實對到**09-24 決策 `:34` 寫下的 `## Waiting`「倍數量測缺一次實測」。落點：`docs/90-agent/` 的一份量測設計，資料仍由 FanKeel 自己的 `ledger.js groups/ranges` 取。Python 碼是不受信任來源，只讀設計，不執行。

另一條觀察（非借鏡，是量測）：Ponytail 把規則移到 SessionStart 省下每回合 3.5 KB；FanKeel 每 prompt 注入的實際位元組數**沒人量過**（reader 7 的缺口）。跑一次 `inject.js` 量輸出長度是 S 成本，值得在同一輪補上。

### (d) 不借的與理由

- **`shortcut:` 標記／`ponytail-debt` 翻案？不翻。** 09-24 `:33` 的理由有兩半：「全 repo 沒有母體」（機制相關）與「`## Waiting` 每個 timing 寫 `lifts when:`」（原則）。5.x 只把 `ponytail:` 改成中性 `shortcut:`，FanKeel 全 repo 仍無任何此類標記（reader 7 grep `shortcut|debt` 零命中），延後事項走 `deferred:` → TODO 一條，已帶觸發條件。5.x 也沒有執行期掃描，仍是模型手動 grep。
- **`ponytail-gain` 不翻。** `:34` 說 FanKeel 要本 repo 量到的數字；5.x 的 gain 仍引 39 任務跨 repo 基準中位數（`ponytail-gain/SKILL.md:4`），理由原樣成立。
- **`ponytail-help` 不翻。** `:35` 原則性理由（沒有找不到指令的事故），5.x 只加了 Band 段。
- **三個 hook 不翻。** 事件數與語意不變；SessionStart 新增的是「地圖」而非「預設模式」，已獨立列為第 3 條條件式候選。SubagentStart 預設對所有子代理一視同仁，比 FanKeel `brief.js` 粗。
- **Band／Board 不借。** FanKeel 的 `pane-band.ts`＋`station.js` 已覆蓋 session、配額、model、鄰近 session、全 session 一頁；Ponytail 的 reuse%／duplicate／callers 每回合跑 `git grep`，是 FanKeel 放在 build review 與 verify 做的事，搬到 band 等於每回合付一次。Board 的 transcript 匯入與 FanKeel station 功能相當。
- **規則文字（lazy senior dev、6 階梯子、「Lazy code without its check」）不借。** 梯子已在 `fankeel-design:64-79`；test-first 已是 build 站規則；`Not checked:` 結尾 FanKeel 的 reader／judge 已有 `unread:` 慣例。
- **多 host、AGENTS.md、i18n、cursor-hooks 不借。** FanKeel 只跑 Claude Code，沒有對應問題。
- **README 的數字主張不採信。** `:43`、`:79`、`:99` 三組數字在 benchmarks 目錄無佐證，只有 `−53%/−45%/−26%/−41%` 與 97% 隱藏檢查有 `results/2026-10-07-agentic.md` 支撐。

### 沒查到的
- `TODO.md` 未讀：第 (c) 節每條是否「對到一個問題」要由主 session 對表。
- Ponytail band 的 `hooks/band/types.d.ts` 與 `claude-code` 模組 API 相容性未比對 FanKeel `hooks/pane.ts` 用的同一 API。
- Qoder 的每回合注入量是檔案大小推算，非實測。
- FanKeel `inject.js` 每 prompt 實際輸出位元組數未量。
