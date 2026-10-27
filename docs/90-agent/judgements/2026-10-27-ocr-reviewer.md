---
judged: 2026-10-27T16:30:59.287Z
model: fable
agent: fankeel-judge
task: "評估 OCR（open code review）對 fankeel reviewer 的借鑑價值"
session: ef7573a1-f680-457d-968b-8684de235394
stage: survey
---

# Brief 40 — Alibaba's OCR (open code review) vs fankeel-reviewer: is anything worth taking?

## Question

# Brief 40 — Alibaba's OCR (open code review) vs fankeel-reviewer: is anything worth taking?

## Question

The user (繁體中文): 「分析看看對我們的 REVIEWER 有沒有用」 — does the open-source code-review tool "OCR" (Alibaba; Go; benchmarked on their own AACR-Bench) offer anything fankeel's reviewer should adopt? Which pieces, where would each go, and what is the first concrete edit — or is the answer "nothing / not worth it"?

## What the tool is (from an earlier session's reading — UNVERIFIED here)

An earlier session cloned the GitHub source to a temp dir and read it (did not install; the npm package has a `postinstall` that downloads a prebuilt Go binary — never install or run it). Its claims, to be verified against source where a reader can reach it (find the repo via GitHub; clone into a fresh empty temp dir outside this repo, or read raw files; never run its code, never `npm install`):

1. **File selection in code, no LLM** (`selection.go`): drop binaries, secret paths (`.env`), extensions outside a whitelist; by default drop tests, generated code, fixtures, snapshots (`default_exclude_patterns.json`); skip any file whose diff exceeds a token cap.
2. **Grouping** (`grouping.go`): < 4 files → no LLM; small change → one group, else one file per group. Larger → small LLM prompt returns JSON groups, ≤ 10 files each. Groups run in parallel, isolated contexts.
3. **Rule injection by glob** (`system_rules.json`): ~57 language rule files (`go.md`, `pom_xml.md`, SQL mapper…); each group gets only its matching rules. Rules are written precision-over-recall ("false positives destroy trust", "don't report what go vet/staticcheck/compiler catch", "don't assume concurrency or attacker-controlled input without evidence").
4. **Plan phase only for big changes** (≥ 50 lines in a file or ≥ 100 per group) → risk list; dropped from round 2 on so the model does not only follow the list.
5. **Main loop**: 6 tools (`file_read`, `code_search`, `file_find`, `file_read_diff`, `code_comment`, `task_done`), no shell; 1–3 rounds by effort (default 2); stop early on a round with nothing new or at 30 findings per group; compaction at 60%/80% context into a fixed 5-section summary.
6. **Location by verbatim code, not line numbers**: `code_comment` requires `existing_code` copied from the diff; code locates it by sliding window; on miss, a tiny re-location prompt asks the LLM to copy the snippet verbatim.
7. **Reflection filter** (`review_filter_task_*.md`): a second LLM with the group's diff deletes only comments the diff proves wrong — (A) code cited is not in that file's diff, (B) a diff line literally contradicts the comment. Never deletes: memory safety, concurrency, declaration mismatch, behaviour/compat changes, unused params. Tool schema puts `analysis` before `comment_ids` so the model reasons before committing to deletions.

Benchmark (their README, their own bench): OCR+Opus 4.6 F1 25.1% / P 33.9% / R 20.0% / 385K tokens vs Claude Code+Opus 4.6 F1 11.6% / P 7.2% / R 28.9% / 5,664K. Opus 4.8: OCR P 37.8% R 11.7% 352K vs CC P 15.9% R 12.7% 2,062K. The Claude Code arm's prompt/skill is unknown. OCR trades recall for precision; tests excluded by default.

## Background in this repo (these decide the answer)

- The reviewer itself: `agents/fankeel-reviewer.md` (303 lines; sections Job, Tools, Refusals, project REVIEW.md, Never a finding, Numbering, Cuts, Security, Sensitive, Silent failure, Comment, Verify, Return). What it already does about precision, location (path:line?), false positives, and scope.
- Where it is dispatched and with what input: build's per-task review (`skills/fankeel-build/SKILL.md`), verify's adversary and lenses (`skills/fankeel-verify/SKILL.md`), plan review (`skills/fankeel-plan/SKILL.md`), audit's code half (`skills/fankeel-audit/SKILL.md`), and the stage agent `agents/fankeel-brain.md`. How diffs are split/grouped today, whether tests are reviewed, whether there is any second-pass filter of findings, how many reviewers run in parallel (`dispatch.inflight` 8).
- Any script that already does in code what OCR does in code (file selection, grouping, line location): search `scripts/` and `lib/` (e.g. anything building review briefs, `ledger.js`, `brief`, `review`).
- Note: fankeel's reviewer reviews its own implementer's diffs inside a task, not third-party PRs; tests are part of what it must check (test-first build). Weigh that against OCR's test exclusion.
- Prior "outside thing vs ours" judgements — read pick + Summary, stay consistent or say why not: `docs/90-agent/judgements/2026-10-26-karpathy-skills.md`, `2026-10-27-gitdiagram-vs-design.md`, `2026-10-26-archify-vs-chartroom.md`, `2026-10-22-graphify-knowledge-graph.md`.
- Sources ledger `docs/90-agent/reference/sources.md` — is OCR already listed? Search repo for `open code review`, `AACR`, `alibaba`.
- Cost constraint: per-turn rules ride every prompt; discipline goes into the agent/skill that needs it. A rule fankeel already has in substance gets no second copy.

## Options

A. Nothing to take — fankeel's reviewer already covers each idea in substance, or the idea does not fit (name where/why per item).
B. Borrow named pieces — e.g. a reflection/filter pass, verbatim-snippet location, precision-first wording, per-language rule injection, code-side file selection/grouping. List each with target file and first concrete edit; say which ones to reject and why.
C. Use OCR itself (e.g. `ocr delegate`) alongside fankeel — with the cost/risk named.
D. Something else.

## What counts as an answer

One pick. A per-idea table (OCR idea 1–7 → fankeel's equivalent at path:line, or "absent" → adopt / reject + why). Anything about OCR not verified from its source is labelled unverified. If adopting, an ordered list of edits small enough to become TODO entries.

## Shape

The judge's six fields (`pick:` first), then `## Summary` in 繁體中文, including the table.

## Answer

pick: A 為主，加一項 B（一句話）— OCR 七項裡六項 fankeel 已有同義機制或刻意反其道；只借 OCR review_filter_task_user.md:49/:64「判斷主張、不判斷引註」這一條，改寫 F:/ymlab/fankeel/agents/fankeel-reviewer.md:281-282「A finding whose path or line no longer exists is dropped, never PLAUSIBLE」為：path 不在範圍、或所述程式碼在範圍內任何地方都找不到 → dropped；程式碼在、只是行號偏了 → 照主張判 CONFIRMED/PLAUSIBLE，回傳時把行號改對。C（用 OCR 本體）不選。
why: (1) 想法 1–5 已有對應：任務 brief 的 Files 塊＋釘死的 BASE..sha 就是選檔（build SKILL.md:329-342）；一任務一 reviewer（build:328,334），audit 刻意按 lens 不按目錄切（audit:260-262）；REVIEW.md（reviewer:59-65）＋lib/lenses.js:3 就是「只注入相關規則」；精準度措辭 reviewer:69-83、:142-145、:153（conf≥0.7）、:292-294（fails when）已齊。
(2) 想法 7（反思過濾）fankeel 的 Verify 模式（reviewer:267-282，build:478-486，verify:312-321）同義且更強：確認者開檔、跑 git，OCR 的過濾器只看 diff（agent.go:1845-1852、review_filter_task_system.md:3）；verify 階段還換成 opus 以避開同模型盲點（verify:318-321），對應 OCR 的 protected-subject 否決（filter:41「你的信心最不可信」）。
(3) 唯一的真缺口在想法 6：reviewer:281-282 行號不在就丟、永不 PLAUSIBLE，而同一倉庫 lib/reviewcheck.js:14-18 對實作者的引註容忍 off by N（NEAR=20）；OCR filter:49「引錯行但問題真 → 判主張不判引註」、:64「先在整個 diff 找它描述的東西，不只看它引的片段」。一句話改在 agent 檔內，零 per-turn 成本。
(4) C 不選：零依賴硬規矩（archify 判決:93）、不推沒審過的外部工具（archify:99）；OCR 預設排除測試（default_exclude_patterns.json：**/*_test.go、**/*.test.js、**/__tests__/**、**/*.snap…）與 test-first 相衝；它審 PR 沒有 brief，做不了 fankeel reviewer 的主業「對照它該證明的東西」；基準表是圖片（imgs/benchmark-en.png），Claude Code 那一臂的 prompt/skill 在 repo 內 NOT FOUND。
(5) 其餘細節無處著力：token 上限、30 則上限、60%/80% 壓縮對「單任務、單次派送、只回 defeats」的 reviewer 沒有對象；輸出附 verbatim 片段會增加留在母 context 的行數（reviewer:302-303）；protected-subject 清單是 lens 制的 fankeel 不需要的第二份分類。
would flip if: 有紀錄顯示 build 的確認者曾因第一輪行號偏差丟掉真 finding → 升級成較大的 B（把 scripts/review-check.js 檢查 (c) 擴到 reviewer 的回傳）；反之若確認者實務上已把「line no longer exists」讀成「程式碼不在範圍」，連這一句也不必改（純 A）。
unread: AACR-Bench repo 與 HF dataset card（基準方法、是否排除測試）未讀；OCR package.json 的 postinstall（brief 說會下載 Go binary）未驗證，標為 unverified；OCR 規則檔內容注入 prompt 的位置只讀了 glob 對照表，沒讀注入點。brief 點名的本倉庫路徑全部讀了。
delegated: agents/fankeel-reviewer.md — opus；skills/fankeel-build/SKILL.md、agents/fankeel-brain.md — sonnet；skills/fankeel-verify/SKILL.md、skills/fankeel-plan/SKILL.md、skills/fankeel-audit/SKILL.md — sonnet；scripts/review-check.js、lib/reviewcheck.js、lib/lenses.js、lib/sensitive.js、lib/refs.js、scripts/ledger.js、scripts/context.js、lib/profile.js、.fankeel/profile.json — sonnet；docs/90-agent/judgements/2026-10-26-karpathy-skills.md、2026-10-27-gitdiagram-vs-design.md、2026-10-26-archify-vs-chartroom.md、2026-10-22-graphify-knowledge-graph.md、docs/90-agent/reference/sources.md、全倉庫 grep — sonnet；github.com/alibaba/open-code-review @ 375f64cd6f67a48a135da83cfcf59c52669a09cb（淺 clone 於 C:/Users/user/AppData/Local/Temp/ocr-src-r6）internal/agent/selection.go、grouping.go、agent.go、config/allowlist/secret_path.go、default_exclude_patterns.json、config/rules/system_rules.json、rule_docs/go.md、config/template/template.go、task_template.json、prompts/grouping_task_system.md、plan_task_system.md — sonnet；同 repo（clone 於 …/ocr-src-r7）internal/tool/definitions.go、config/template/effort.go、llmloop/compression.go、agent/util.go、agent/agent.go、config/toolsconfig/tools.json、diff/resolver.go、prompts/re_location_task_user.md、review_filter_task_user.md、review_filter_task_system.md、memory_compression_task_system.md、README.md、imgs/benchmark-en.png — opus
checklist: 1 agents/fankeel-reviewer.md — answered；2 build SKILL.md + brain — answered；3 verify/plan/audit SKILL.md — answered；4 scripts/、lib/、profile.json — answered；5 四份判決 + sources.md + grep — answered；6 OCR 來源想法 1–4 — answered；7 OCR 來源想法 5–7 + README 基準 — answered（Claude Code 臂的設定 NOT FOUND）

## Summary

### 題目與結論
使用者問 Alibaba 的 OCR（open code review，Go 寫的，用自家 AACR-Bench 跑分）對 fankeel 的 reviewer 有沒有用。七位 reader 把 brief 點名的本倉庫檔案與 OCR 原始碼（兩個淺 clone，commit 375f64c，只讀不跑）各讀一遍，我再對每位 reader 引的一段逐一開檔核對，七處都與 reader 所述相符。結論：fankeel 的 reviewer 已在實質上涵蓋 OCR 的 1、2、3、5、7，4 不適用；只有 6 露出一個小缺口，值得改一句話。OCR 本體不用。

### 逐項對照表（OCR 出處皆已從原始碼驗證；brief 內未驗證的只有 postinstall 一說）

| # | OCR 想法 | OCR 出處（已驗證） | fankeel 的對應 | 判定 |
|---|---|---|---|---|
| 1 | 選檔在 code 側不經 LLM：丟二進位、.env、白名單外副檔名；預設排除測試/生成碼/fixtures/snapshots；diff 超 token 上限就跳過 | internal/agent/selection.go:57「pure — no git or LLM access」、:75 IsBinary、:85 IsSecretPath、:98 IsAllowedExt；config/allowlist/secret_path.go:71；default_exclude_patterns.json（**/*_test.go、**/*.test.{js,ts}、**/__tests__/**、**/*.snap、**/fixtures/**、**/package-lock.json…）；token 上限 = 80% × MAX_TOKENS（compression.go:29、task_template.json:44，推算 160K） | 選檔由 plan 與 brief 做：reviewer 拿的是釘死兩端的 `BASE..<sha>`（build:329-331）與 brief 的 Files 塊（build:339）；lib/reviewcheck.js:50 的 isTest 只用於檢查 (a) 跳過測試檔的 listener 掃描；測試是必審項（build:351-359 跑 review-check.js、挑一條 red-when 突變驗證） | 拒。排除測試直接與 test-first 相衝；二進位/lockfile 沒有壞例，任務級 diff 本就小；Sensitive lens（reviewer:209-224）管的是反方向（資料不該隨 diff 進倉庫） |
| 2 | 分組：<4 檔不經 LLM；總改動 <200 行一組，否則一檔一組；大改由 LLM 回 JSON 分組，每組 ≤10 檔；各組平行、各自 context | grouping.go:22 maxFilesPerGroup=10；template.go:128-135（GROUPING_MIN_FILES 4、BUNDLE_LINE_THRESHOLD 200）；agent.go:669-737 WaitGroup、MaxConcurrency 預設 8 | 一任務一 reviewer（build:328「One reviewer, on this template and no other」、:334）；任務切分是 plan 的事（ledger.js scan/groups 分的是任務不是檔）；audit 的 code half 明文「By lens, never by directory — a reviewer holding a third of the tree cannot see the caller in another third」（audit:260-262） | 拒。fankeel 是刻意反向：按 lens 切、不按檔切 |
| 3 | 按 glob 注入語言規則（57 個 .md）；規則措辭精準優先：「false positive costs trust」「gofmt/go vet/staticcheck/compiler 抓得到的不報」「先確認攻擊者可控再報」 | config/rules/system_rules.json:2-13（default.md、**/pom.xml→pom_xml.md、**/*{mapper,dao}*.xml…）；rule_docs/ 57 檔；go.md:2、:56、:69 | REVIEW.md 於 repo 根、整檔讀、「do not report」併入 Never a finding（reviewer:59-65）；lib/lenses.js:3 用 diff 內容決定派不派 Silent failure / Comment lens——同樣是 code 側選規則；精準措辭已齊：linter 抓得到的不報（:69-73）、假設要追到真實呼叫者才算（:77-83）、「不同寫法不是 finding」「空的 review 是結果」（:77-83）、source→sink 追完才寫（:142-145）、conf<0.7 不印（:153）、寫不出「fails when」就不報（:292-294） | 已涵蓋。57 份語言規則對以 REVIEW.md 承接專案規則的設計是多餘的；REVIEW.md 按 glob 分段沒有壞例，依 10-25「沒東西壞就不動」 |
| 4 | 大改（單檔 ≥50 行或 ≥2 檔且 ≥100 行）才先出風險清單；第二輪起拿掉，免得變成覆蓋上限 | template.go:71-77；task_template.json:39-40；agent.go:1467-1470「Round 2+ strips the plan to avoid it acting as a coverage ceiling」（我親自核對） | reviewer 每輪拿的是 brief 與 plan 的 coverage rows（build:339-342）——那是規格，不是模型自生的清單；獨立於 brief 的 lens（Security、Silent failure、Comment、Sensitive）保證不只跟著清單看 | 不適用。OCR 要解的「自生清單變天花板」在 fankeel 沒有對應物 |
| 5 | 主迴圈：6 個工具無 shell；1–3 輪依 effort（預設 2）；一輪無新發現即停；每組 30 則即停；60%/80% 壓縮成五段摘要 | internal/tool/definitions.go:19-24（但 :51 Dynamic() 會加 MCP 工具，「無 shell」只對內建集成立）；effort.go:36-38；agent.go:1544-1550；util.go:49 confirmedCap=30；compression.go:21-22；memory_compression_task_system.md:7-23 | 工具受限：Bash 只准 git show/diff/log、node --test 一檔、plugin 唯讀腳本（reviewer:32-42）；單次派送、無內部輪次；修正輪上限五（build:487）；「你回傳的每一行都留在母 context」（reviewer:302-303）已逼回傳精簡 | 拒。30 則上限與壓縮對單任務單次派送沒有對象 |
| 6 | 定位靠 verbatim 片段不靠行號：code_comment 要 existing_code 照抄；滑動視窗比對；比對失敗先跨檔純字串找，再派小 prompt 要模型照抄 | tools.json:33、:49、:86；diff/resolver.go:48-54、:221-230、:301-305（去空白與 +/-）、:88-96；re_location_task_user.md:4 | finding 以 path:line 定位（reviewer:101、:133、:257）；lib/reviewcheck.js:14-18 檢查 (c) 把實作者回傳與測試註解裡的 path:line 連同引文對 `git show <sha>:<path>` 核對，容忍 `off by N`（NEAR=20）；但 Verify 模式 reviewer:281-282「path or line no longer exists is dropped, never PLAUSIBLE」 | 借一句。缺口是：同倉庫對實作者引註容忍偏移、對 reviewer 自己的 finding 卻行號一偏就丟。不借片段輸出格式（增加母 context 行數）、不借滑動視窗碼（lib/refs.js:54 quoteBeside 與 reviewcheck (c) 已有，等有壞例再擴到 reviewer 回傳） |
| 7 | 反思過濾：第二個 LLM 只拿該組 diff，預設全部核准，只刪 diff 能證明錯的（A 所引程式碼不在該檔 diff；B 某行白紙黑字反駁）；記憶體安全/並行/宣告一致/行為相容/未用參數永不刪；工具 schema 把 analysis 排在 comment_ids 前 | review_filter_task_user.md:7、:11、:19、:29、:35-41、:45-50、:56-68（我親自整檔核對）；review_filter_task_system.md:3「只看得到 diff」；agent.go:1572-1579（欄位順序 load-bearing）、:1845-1852（只填 {{diff}} 與 {{comments}}） | Verify 模式（reviewer:267-282）：第二個 reviewer 一次拿整份清單，逐條「open what it names and follow it the way its own lens would — git show, git diff, the file itself」，標 CONFIRMED / PLAUSIBLE（「could go either way and nothing settles it」≈ OCR :48「Unverifiable is not incorrect」）/ drop；build:478-486 只有 CONFIRMED/PLAUSIBLE 進修正輪；verify:312-321 確認者換 opus，「a confirmer sharing the adversary's model shares its blind spots」 | 已涵蓋，且兩處更強：確認者能開檔與跑 git（OCR 只有 diff）；換模型對應 OCR 的 protected-subject 否決。不借 protected 清單（fankeel 是 lens 制，每個 lens 自帶分類）；不借 analysis-before-ids（fankeel 逐行標記、沒有批次 id 清單，無對應物；drop 不回傳是 :278-279 為省母 context 的刻意設計） |

### 抽查結果
- agents/fankeel-reviewer.md:267-303：Verify 三態與 :281-282 的丟棄規則、:292-294 fails when、:302-303 母 context 成本——與 R1 所引一致。R1 把「drop 的判準」標為 INFERRED，實際文字是三態的殘餘情形，唯一明寫的丟棄規則就是 :281-282。
- skills/fankeel-build/SKILL.md:478-486：確認 pass 一次拿整份清單、只有 CONFIRMED/PLAUSIBLE 進修正輪——一致。
- skills/fankeel-verify/SKILL.md:312-321：確認者換 opus 及其理由——一致。
- lib/reviewcheck.js:14-18、:50：檢查 (c) 的 ok / off by N / missing、NEAR=20、isTest——一致。
- docs/90-agent/judgements/2026-10-27-gitdiagram-vs-design.md:118：「不採用外部工具、不借沒缺口的想法、有缺口才動自己幾行」——一致，本判決沿用。
- OCR agent.go:1467-1470：plan 第二輪清空——一致。
- OCR review_filter_task_user.md 整檔：Ground A/B、:29「指不出那一行就核准」、:35-41 五類否決、:49「引錯行但問題真，判主張」、:64「先在整個 diff 找它描述的東西」——一致。

### 建議的編輯（可直接成 TODO）
1. **agents/fankeel-reviewer.md:281-282**（唯一要做的）：把「A finding whose path or line no longer exists is dropped, never `PLAUSIBLE`.」改為兩句：path 不在範圍、或它描述的程式碼在範圍內任何地方都找不到 → dropped，never PLAUSIBLE；程式碼在而行號偏了 → 照主張判，回傳的那一行把 path:line 改對。依 release 規則這是 agent 檔變更：patch 版號、跑完整 suite。
2. **不是從 OCR 來、但順手看到的不一致（交給母 session 決定）**：verify:318-321 明文確認者要換模型以避開同模型盲點，但 build:481-483 的確認 pass 沒有傳 model，仍由 agent 檔釘 sonnet（reviewer.md:5），與第一輪同模型。要嘛 build 也換、要嘛寫下為何 build 不必。
3. **先不做**：把 scripts/review-check.js 檢查 (c) 擴到 reviewer 回傳——等有「真 finding 因行號被丟」的紀錄再做。

### 其他事實
- sources.md 沒有 OCR；它的每一列都對應 docs/90-agent/reports/ 的日期報告（sources.md:14-18，tests/sources-doc.test.js 強制），與前四份判決一樣，本判決檔本身就是紀錄，不加 sources.md 列。全倉庫（排除 node_modules、.git）對 `open code review|AACR|alibaba` 無命中；整字 `OCR` 只出現在 reports/evidence 的 mod-probe 請求本文裡，是 PDF 技能描述，無關。
- OCR 的 README 跑分（imgs/benchmark-en.png，表是圖片）：Opus 4.6 OCR F1 25.10% / P 33.90% / R 20.00% / 385K vs Claude Code v2.1.169 F1 11.57% / P 7.23% / R 28.90% / 5,664K；Opus 4.8 OCR 17.90% / 37.80% / 11.70% / 352K vs CC 14.13% / 15.93% / 12.70% / 2,062K。Claude Code 那一臂的 prompt、skill、設定在 repo 任何文字中 NOT FOUND；是否排除測試也 NOT FOUND。所以「省 9 倍 token」是對裸 Claude Code 比，不是對 sonnet 單任務、只回 defeats 的 fankeel reviewer 比，不能據以選 C。
- 沒做的事：context.md 未寫——`scripts/context.js add` 必須帶 `--session <id>`，本次派送沒給 session id，而猜一個 `.fankeel/sessions/*.json` 會寫進錯的任務資料夾。兩個 OCR 淺 clone 留在 C:/Users/user/AppData/Local/Temp/ocr-src-r6 與 ocr-src-r7（倉庫外、未執行任何東西），母 session 可刪。
