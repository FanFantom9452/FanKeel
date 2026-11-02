---
judged: 2026-11-02T19:50:28.719Z
model: fable
agent: fankeel-judge
task: "已關閉任務的 ZIP 匯出：判官評估做法"
session: d9a52a0e-81f5-46f4-9051-1478a1346a5b
stage: survey
human: no
---

# 問題

## Question

# 問題

一個 fankeel 任務已在 land 選「收工」關閉，沒有走「匯出並回顧」。使用者事後想把那次的對話包加回顧 ZIP 寄回去給別人（或自己的 retro-all）用。現在做不到：

- `record.js session` 只接受還開著的任務：`scripts/record.js:131` 對 `mine.active !== true` 回 `No active entry for <session> under <root>`。
- `record.js export --cross <anchor> --bundles <id8,...>`（`scripts/record.js:418` 起）需要 `retro --cross` 印出的錨點；而 `fileCross`（約 `scripts/record.js:309`）只收含 `recurring:` 行或 `clean` 的報告。只有一個 session 時，回顧內容全是 once，報告被拒，沒有錨點。
- 手動把 transcript 與 retro.md 壓成 ZIP 會跳過正式打包的遮蔽（`.fankeel/sensitive.txt` 的字與金鑰樣式字串），有洩漏風險。

該怎麼讓「已關閉的任務」也能正式匯出 ZIP？

# 選項

A. 放寬 `record.js session`：加 `--closed`（或自動）讓已 stand down 的 entry 也能打包，沿用同一套遮蔽。
B. 新增獨立的事後匯出指令（例如 `record.js session --from <transcript.jsonl>` 或 `record.js export --session <id>`），不經任務登錄，直接從 transcript 打包加遮蔽；並讓單一 session 的 export 不需 `--cross` 錨點。
C. 不改程式：在 land 關卡把「收工」前強制提示匯出（或收工時自動打包對話包留在本機），事後匯出維持不支援。
D. 只記成 TODO，暫不處理。

# 背景

- 外掛根目錄：F:/ymlab/fankeel（工作樹即外掛）。
- 相關檔案：`scripts/record.js`（session / export / retro / import 動詞）、`skills/fankeel-land/SKILL.md`（匯出並回顧選項）、`skills/fankeel-retro-all/SKILL.md`、`agents/fankeel-retro.md`、`lib/` 下與遮蔽有關的模組（以 grep `sensitive` 找）、`tests/` 下與 record 相關的測試、`docs/` 下描述匯出的頁面。
- 專案規則：每次改 fankeel 都要發版（bug 修 patch、功能 minor）。
- 只有一個 session 的回顧本來就不進月檔（只收跨兩個以上 bundle 的 recurring）；問題是匯出 ZIP 被同一條件擋住，是否合理。

# 要讀的路徑

- scripts/record.js（全檔，特別是 exportSession、exportZip、fileCross、import）
- 遮蔽實作（grep `sensitive.txt`）
- skills/fankeel-land/SKILL.md、skills/fankeel-retro-all/SKILL.md
- tests/ 中 record 相關測試
- TODO.md（檢查是否已有相同待辦）

# 什麼算答案

選一個選項（或明確的組合），說明：改哪些檔、遮蔽是否保證一樣、單一 session 的 export 錨點問題怎麼解、要不要同時改 land 關卡、大約多少工作量、會不會破壞現有 import / retro-all 流程。若需要使用者先決定什麼，用 `ask human:` 問。

# 答案形狀

七個欄位，`ask human:` 最後；接 `## 白話`（600 字內），再接 `## Summary`。

## Answer

pick: A + B 的後半（組合）：`record.js session` 加 `--closed` 讓已 stand down 的 entry 走同一條 `bundle.pack` 遮蔽打包；`record.js export` 把 `--cross` 改成可選，單一 bundle 時 report.md 只放該包的 `## retro <id8>` 區塊；順手把 report.md 也過一次 `sensitive.redact`。不改 land 關卡選項。
why: 收工只翻 `active=false`（scripts/task.js:1392），record/configDir/sessions 全留；transcript 由 configDir + id 找，不在 entry 裡，所以打包路徑唯一擋住的就是 `activeEntry`（scripts/record.js:131）。
why: 遮蔽在 `bundle.pack`→`sensitive.redact`（lib/bundle.js:37、lib/sensitive.js:64）是獨立函式，`session --closed` 走同一條，遮蔽保證一樣；手動壓 ZIP 才會漏。
why: 錨點問題：`exportZip` 無 `--cross` 直接 fail（:419），而 `x-` 錨只由 `fileCross` 產生且只收 `recurring:`/`clean`（:309）；但 ZIP 內容對單一 bundle 只需 `retroBlock`（:456 已會抓 `r-<id8>`），import 又不驗 report.md（:526），所以 `--cross` 可選不破壞 import。
why: C 的「強制提示」已存在（land 每次都問，decision 2026-10-20），收工自動打包違反「使用者答應才匯出」且吃磁碟；D 不解決洩漏風險。
why: 工作量小：record.js 約 25 行、land/retro-all 各一兩句、documents.md:181 與 pipeline.md:894 各一句、一頁 decision、3–4 個測試；功能 → minor 版。
would flip if: `skills/fankeel-retro-all/SKILL.md:61-72` 已規定單一 bundle 時以 `clean` 行送 `retro --cross`（則錨點已存在，只需 A）；或 Claude Code 會定期清掉舊 transcript（則 A 失效，只剩 C 的收工自動打包）。
unread: skills/fankeel-retro-all/SKILL.md 與 agents/fankeel-retro.md 我未親開（讀者讀了，未抽查）；docs/90-agent/todo/ 中 cleanup-1.md:16、cuts-2.md:13、design-2.md:20 三個長行讀者未展開。
delegated: scripts/record.js（opus：session/exportSession 路徑；sonnet：fileCross/exportZip/import）；lib/sensitive.js、lib/bundle.js（sonnet）；skills/fankeel-land/SKILL.md、skills/fankeel-retro-all/SKILL.md、agents/fankeel-retro.md（sonnet）；tests/record-bundle.test.js、tests/record-retro.test.js、tests/record-export.test.js、tests/sensitive-redact.test.js、tests/bundle.test.js（sonnet）；docs/90-agent/todo/*.md、docs/**（sonnet）；scripts/task.js、lib/registry.js、scripts/conversation.js、lib/detail.js、hooks/*（sonnet）
checklist: 1 record.js session/exportSession 需要哪些欄位、遮蔽在哪 — answered（:131、:198-223、lib/bundle.js:37）；2 export/fileCross/import 錨點與 ZIP 格式 — answered（:309、:419、:456、:479、:526）；3 遮蔽實作可否重用 — answered（lib/sensitive.js:25、:43-75 獨立匯出）；4 land/retro-all 各跑什麼 — answered（SKILL.md:263-291；retro-all 由讀者答，未抽查）；5 測試釘住什麼 — answered（無 active:false 測試；record-retro.test.js:77-85；record-export.test.js:106-113）；6 TODO 與 docs — answered（無相同 TODO；documents.md:181-183、pipeline.md:894）；7 收工對 entry 做什麼 — answered（scripts/task.js:1385-1394）
ask human: nothing

## 白話

建議：讓「已收工」的任務也能用原本那套正式指令打包，並讓只有一個對話包時也能做成 ZIP；不要去動收工那個關卡。

比喻：收工只是把檔案夾上貼了「結案」標籤，裡面的東西一張都沒抽走；現在卡住的只是打包程式看到「結案」就拒收。加一個 `--closed` 開關讓它收，遮蔽敏感字的流程跟原本一模一樣，不會比較不安全。

至於「只有一個對話包做不出 ZIP」，是因為 ZIP 一定要先有「跨多個對話的共同問題報告」當索引；但單一對話根本沒有「跨」可言。所以讓 ZIP 在沒有那份報告時，直接放該對話自己的回顧就好；對方那邊的匯入程式本來就不檢查這份報告，收得進去。

工作量不大：主要改一支腳本、補幾個測試、文件各一句，出一個小版本。
