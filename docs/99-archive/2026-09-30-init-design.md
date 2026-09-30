---
status: current
last_verified: 2026-09-30
---

# 首次使用的 init：第一次接上自動叫，文件整理好才放行

這頁描述要做成的樣子，不是現在的樣子。來源：session 5ba3e967-ce24-4b43-836e-aaf70c79740a
的討論，定案記在 [init-1](../todo/init-1.md) 內文；gate 重複問的缺陷記在 [gate-2](../todo/gate-2.md)，
使用者 09-30 把它併進同一個 task。

## 為什麼

文件沒整理好的專案，後續每個 workflow 都會把沒歸類、過時的頁面當成現況讀，產生幻覺。
init 在第一次接上時把 docs tree 與目錄樹整理到腳本檢查得過，之後的站才讀得到可信的文件。

## 1. 偵測：一個 lib，兩種深度

- 新增 `lib/onboard.js`，匯出 `cheap(root, configDir)`：回傳 `{ docsJson, unfiled, tree, skip }`，全部只讀檔，不讀任何 md 內文。
- `docsJson` 用 `lib/docs.js` 的 `read(root)`：檔案不存在或不能 parse 都算未過。
- `unfiled` 從 `scripts/docs-audit.js:726` 抽出成 `unfiledCount(root)`：`trackedFiles` 加 `isMarkdown` 加 `docs.roleOf`，不跑 `sweep()`；`docs-audit.js` 改呼叫這個函式，不留兩份。
- `tree` 用 `lib/map.js` 的 `layoutBlock(root, tree)`：回傳 `null`（沒有目錄樹）與 `unfilled > 0` 都算未過。
- `skip` 讀 profile 的 `init.skip`；為 `true` 時 `cheap` 回報 `skipped`，不觸發。
- 匯出 `full(root, configDir)`：`cheap` 的三條，加 `docs-check.js` 無錯，加 `docs-audit.js` 的 drift 為零，共五條。
- 新增 `scripts/onboard.js [--full] [--root]`：印每條一列 `pass/fail · 證據`，未過時 exit 1。scout 和 skill 都跑它，不自己重算。

量測（09-30，本 repo）：`docs.read` 0.4 ms、`layoutBlock` 1.1 ms、git ls-files 加 roleOf 27 ms；完整 `docs-audit.js` 2288 ms，所以只放在 `full`。

## 2. 觸發：檢查 task 的專案，在 `task.js start` 做

registry 常開在一個工作區，底下有多個專案（例：`F:/ymlab/SBIR/ProjectWorkspace`，orient 列出 16 個
目錄，多數是會議資料而不是專案；Trovara 有 `docs.json` 但沒有 git）。檢查 registry 根目錄會對
工作區本身報「沒有 docs.json」，是錯的對象；逐一檢查 16 個目錄會對會議資料夾一再催促。所以
檢查的對象是 task 選定的專案，時點是每個 task 都會經過的 `task.js start`。

- `scripts/task.js` 的 `start` 在寫入 entry 之後，對 task 的專案（`--project` 所指；單一專案的 registry 就是根目錄）呼叫 `onboard.cheap`；未過且沒 skip，就在 controller 指示之前印一行 `onboard: <專案> — <未過的條>; Skill fankeel-init --root <專案> before survey`。
- 工作區根目錄本身永遠不是檢查對象，除非它就是 task 的專案。
- 沒有 git 的專案走 `lib/tracked.js` 的 walk 備援。實測 09-30：Trovara（無 git）列檔加分類 71 ms，得 `docsJson: true`、目錄樹 90 列中 6 列沒填、233 份 md 中 9 份 unfiled；工作區根目錄 303 ms。
- 不改 `hooks/inject.js`、`lib/render.js` 與 `INIT`：只在 start 檢查一次，每次 prompt 都不多花時間，也不碰 init 區塊 1400 字元的上限。
- 工作區層級與專案層級分開：docs.json、TODO、目錄樹、profile 屬於專案（`--root <專案>`）；CLAUDE.md 與 memory 屬於 Claude Code 開啟的目錄，見第 2b 節。

## 2a. 原始資料不是文件：`data` role

大專案裡有一大塊是原始資料（例：Telung 2 萬檔以上被截斷、SBIR文書 434 檔），不是描述系統的文件。
算進 unfiled 會一直催人把資料「歸類成文件」，讀進 survey 會被當成現況說明，兩者都是幻覺的來源。

- `lib/docs.js` 的 role 多一個 `data`：這個 bucket 底下是原始資料，不是文件。docs-check 與 docs-audit 完全不檢查它，`unfiledCount` 不把它算進 unfiled，map 把它標成資料目錄。
- init 的 docs.json 那一步先分資料與文件：scout 依副檔名與檔案數草擬哪些目錄是原始資料，使用者逐條核可，寫成 `role: data` 的 bucket。
- 只宣告路徑。負責人、保留期限、NAS 位置是 [data-1](../todo/data-1.md) 還在等答案的題目，這裡不做；`data` bucket 之後可以加那些欄位，不必改 role。

## 2b. 工作區開啟時：CLAUDE.md 與 memory 看開啟的那一層

Claude Code 在工作區開啟時，每一輪都注入全域 CLAUDE.md、工作區（與其上層）的 CLAUDE.md、
以及工作區這個開啟位置的 MEMORY.md；各 repo 自己的 CLAUDE.md 只在讀到那個 repo 的檔案時才載入，
memory 則依開啟位置分開存（從工作區開與從 Trovara 開是兩份）。所以工作區裡的規則會套到每個 repo 上。

- CLAUDE.md 那一步對開啟位置跑 `input-check.js`：它已經列出全域、上層、開啟位置、以及開啟位置底下每個目錄的 CLAUDE.md 與各自的 MEMORY.md，並給大小。
- scout 另外讀這些 CLAUDE.md，回報腳本看不出的三種問題：工作區層寫了只屬於某個 repo 的規則（會套到其他 repo）；兩層互相矛盾；兩層重複。每條附兩邊的 `path:line`。
- 修正以 diff 呈現：該搬進 repo 的搬進 repo 的 CLAUDE.md，重複的刪一邊，矛盾的由使用者定哪邊對；刪減仍交給 `fankeel-slimmer`。每個檔案核可才寫。
- memory 那一步對開啟位置跑 `memory-check.js`，並列出這個工作區底下還有哪些開啟位置有自己的 memory，只報告，不合併。

## 2c. 可見度與敏感詞：先提醒，使用者決定要不要攔

spec、plan 這類文件會 commit 進 repo，寫進去的客戶名、內部代號、資料內容，會跟著 repo 被推出去。
哪些詞敏感因專案而異，所以詞表由使用者給，預設只提醒，要不要攔截由使用者決定。

- init 偵測可見度：`gh repo view --json visibility` 回報 public 或 private；沒有 remote 就是 local；沒有 `gh` 或查不到就是 unknown。可見度只決定問法的輕重——public 時強烈建議設詞表並改為攔截。
- 詞表放 `.fankeel/sensitive.txt`，一行一個詞，加進 `.fankeel/.gitignore`：詞表本身就是敏感資料，不能進版控。每台機器各一份，換機器要重設。
- profile 加一個鍵 `sensitive.mode`，值為 `warn`（預設）或 `block`。
- 新增 `lib/sensitive.js`，匯出 `scan(root, paths)`：回傳每個命中的 `path:line` 與詞。
- 檢查時點是 commit：fankeel 對 Bash 與 PowerShell 的 PreToolUse hook 攔到 `git commit` 時，掃描 staged 的文字檔；`scripts/commit.js` 也呼叫同一個 `scan`。`warn` 把命中列在 additionalContext；`block` 直接 deny，並說明怎麼改詞表或改成 `warn`。
- 只管經過 Claude Code 的 commit。使用者自己在終端機下的 `git commit` 不檢查，因為那需要改 repo 的 git hook，而那是使用者的檔案。
- spec 與 plan 照常 commit，留在 repo 裡（使用者 09-30 明說）。
- 另一個開關 `sensitive.review`，值為 `true` 或 `false`（預設）：要不要讓 reviewer 在審查時也確認敏感資料沒被寫進去。init 在可見度那一步問，public 時建議 `true`。
- `agents/fankeel-reviewer.md` 加一個 `## Sensitive` lens，照 `## Security` 的寫法：讀 diff，報兩種——詞表 `.fankeel/sensitive.txt` 裡的詞，以及詞表沒列、但看得出是敏感資料的內容（憑證、個資、客戶名、內部主機或 IP、原始資料的節錄）。每條附 `path:line`。
- 開關為 `true` 時，plan 的 review、build 每個 task 的 review、verify 的 adversary 都多要這個 lens；三份 skill（`fankeel-plan`、`fankeel-build`、`fankeel-verify`）的派遣說明各加一句。
- 兩層分工：commit 時的 `scan` 是機械比對詞表，快且不漏列出的詞；reviewer 的 lens 是判斷，抓詞表沒列到的。

## 3. 跳過：兩道 gate，記在 profile

- `lib/profile.js` 的 `KEYS` 加一列 `'init.skip': { values: ['true','false'], builtin: 'false' }`；會自動出現在 station 的精靈頁。
- skill 的第一道 gate 提供「先跳過」。選了之後再出一道 gate，說明不整理的代價並強烈建議先做；確認才跑 `task.js profile set init.skip true --project`。
- skip 之後 `/fankeel` 不再注入那一行；手動 `/fankeel-init` 仍可叫，完成時把 `init.skip` 設回 `false`。

## 4. skill：`skills/fankeel-init/SKILL.md`

- 不加 `disable-model-invocation`：`/fankeel` 要能叫它，而使用者叫起的 skill 不能轉給只能手動叫的 skill（`tests/skills.test.js:1352-1360` 也管這條）。description 寫窄，只對應 `onboard:` 行與 `/fankeel-init`。
- 步驟與順序：scout → 可見度與敏感詞（排在最前，因為 init 自己寫的東西之後也會 commit）→ docs.json（含 data 目錄）→ TODO → 目錄樹 → CLAUDE.md → memory → profile → 收尾跑 `onboard.js --full`。一次一題，每題 `AskUserQuestion`。
- 每步先看 `onboard.js` 與 scout 的狀態，已完成就跳過並說一句；重跑從停下的地方接，不存進度檔。
- docs.json：沒有就用 `lib/docs.js` 的 `write(root, PRESETS[<shape>])`，`audience` 為選項一；已有的文件用 `docs-move.js plan` 出搬移表，核可後 apply。
- TODO：已有 `TODO.md` 就 `todo.js migrate`；沒有就建空的 todo bucket。
- 目錄樹：`layout.js` 出骨架，填上 scout 草擬的每列用途，以 diff 給使用者逐列核可後寫入 README 或 CLAUDE.md。
- CLAUDE.md 與 memory：刪減交給 `fankeel-slimmer`，memory 只跑 `memory-check.js`，不預先寫條目；每個改動先給 diff，核可才寫。
- drift：`docs-audit.js --batches` 一個 bucket 一批，每批一個 `fankeel-reader`，一次最多 4 個；每頁三選一——更新內容、改 `last_verified`、移進 archive——才算處理完。
- 收尾：`onboard.js --full` exit 0 才說完成；未過的條列出來，留在原步驟。

## 5. scout：`agents/fankeel-init-scout.md`

- 唯讀，`tools: [Read, Grep, Glob, Bash]`，`model: sonnet`，`effort: medium`。
- 回傳兩段：狀態表（每步 `done/partial/missing` 加一行證據，照抄 `onboard.js` 輸出）；草稿（目錄樹每列用途、未歸類文件建議的 bucket、看起來過時的頁面）。
- 登記：`.claude-plugin/plugin.json` 的 `agents`、`tests/agents.test.js` 的 `NAMES` 與 `EFFORT`、`lib/guard.js:299` 的 `READ_ONLY_AGENTS`；skill 登記在 `tests/inventory.test.js` 的 `SKILLS`。

## 6. gate-2：受控站的 gate 不能原封不動、不能沒有暫停、不能降級

- 答案回來後 gate 不變就擋：`hooks/gate.js` 開 gate 時把 `questions` 的雜湊存進 `registry.gateOpen` 的紀錄；同一站、答案之後再問、雜湊相同，就 deny，叫主控 SendMessage 要 agent 換掉已處理的選項。
- 沒有暫停選項就擋：`lib/handoff.js` 的 `gateProblem` 除了 `gate.next`，還要有一個選項的 label 符合暫停（`暫停|pause|停下|先停`）。
- 低於 `floor` 的 class 就擋：`readGate` 與 `gateProblem` 多收 `floor`；任何選項的 label 點名一個比 `floor` 低的 class（`spike < bounded < architectural`），就 deny。
- `agents/fankeel-brain.md:95-97` 與 `lib/render.js:557` 的回答後規則補一句：改寫報告時 gate 也要改，拿掉已處理的選項。

## 7. 文件

- `docs/90-agent/reference/documents.md:35` 目前寫「只在 survey 問一次」，改成 init 與 survey 各一處，共用 `write`。
- role 表多一列 `data`：`skills/fankeel/SKILL.md` 的 *Where documents live* 與 `documents.md`。
- `docs/90-agent/reference/subagents.md:32,34`、`collisions.md:258` 的 agent 名單加 `fankeel-init-scout`。
- `skills/fankeel/SKILL.md` 的 *Start does not stop there* 加一句：`task.js start` 印出 `onboard:` 行時，先對那個專案執行 fankeel-init，再進 survey。

## 驗證

- `tests/onboard.test.js`：無 docs.json 的 fixture → `cheap` 未過；有 docs.json、目錄樹填滿、無 unfiled → 通過；`init.skip` → `skipped`。現在因模組不存在而紅。
- `tests/task.test.js`（或 start 所在的測試檔）：多專案 fixture 的工作區根目錄沒有 `docs.json`、專案 A 沒整理、專案 B 已整理；`start --project A` 印 `onboard:`，`start --project B` 不印，工作區根目錄從不被點名。
- `tests/handoff.test.js` / `tests/gate.test.js`：survey 那道 gate（無暫停、含「改走 bounded」、floor architectural）被擋；答案後原封不動重問被擋。
- 產物：`node scripts/onboard.js --root F:/ymlab/SBIR/ProjectWorkspace/Trovara` 報目錄樹 6 列沒填、9 份 unfiled，與上面 09-30 的實測一致；`onboard.js` 與 `onboard.js --full` 對同一條給同一個 pass/fail。

- `tests/docs.test.js`：`role: data` 的 bucket 底下放一份 md，`unfiledCount` 不算它、docs-check 不報它；拿掉那個 bucket 就算 unfiled。
- scout 的 CLAUDE.md 檢查：fixture 工作區的 CLAUDE.md 寫一條只屬於 repo A 的規則、另一條與 repo B 的 CLAUDE.md 矛盾，scout 兩條都要報出，附兩邊的 `path:line`。

- `tests/sensitive.test.js`：詞表含 `ACME`，staged 一份寫著 `ACME` 的 plan；`warn` 時 hook 放行並在 additionalContext 列出 `path:line`，`block` 時 deny；詞表為空時兩者都不出聲。

- `## Sensitive` lens：給 reviewer 一段 diff，裡面有詞表裡的 `ACME` 與一組看似真實的 API key，兩條都要報出；拿掉兩者後報 `none`。

## 沒驗過的

- 宣告成 `data` 的目錄能不能讓 `lib/tracked.js` 的 walk 直接跳過；跳不過的話，Telung 這種被 `MAX_WALK_FILES` 截斷的專案，截斷仍會發生在資料目錄上。
