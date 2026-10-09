---
status: current
last_verified: 2026-10-09
source_of_truth: `docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/` 下的 `probe.sh`、十個 `<arm><n>.json`、`results.txt`；本頁不會重新產生
---

# `.claude/settings.local.json` 的放行規則有沒有效果 — headless A/B — 2026-09-28

`.claude/settings.local.json` 只有一條規則：`{"permissions": {"allow": ["Edit(/.fankeel/build/**)"]}}`。這一頁量這條規則在 headless `claude -p` 底下有沒有可量到的效果：A 組帶上這份 `local` 設定，B 組不帶，其餘完全相同。

## 1. 前提檢查

跑 `claude --help 2>&1 | grep -i -A3 permission-mode`，choices 裡有 `auto`：

```
--permission-mode <mode>              Permission mode to use for the session
                                       (choices: "acceptEdits", "auto",
                                       "bypassPermissions", "manual",
                                       "dontAsk", "plan")
```

前提成立，繼續量測。

## 2. 怎麼跑的

- HEAD：`40bc85167d984309ed6c99bc6c76efd913bc0fd8`（跑之前 `git status --porcelain` 已有 `TODO.md`、`tests/guard.test.js` 兩個 neighbour 的未 commit 修改，跟本任務無關，逐字記在 `results.txt`）。
- 十次 `claude -p`，A、B 交替：A1 B1 A2 B2 A3 B3 A4 B4 A5 B5。
- A 組旗標：`--setting-sources project,local --permission-mode auto --model sonnet --output-format json`。
- B 組旗標：`--setting-sources project --permission-mode auto --model sonnet --output-format json`（沒有 `local`，讀不到 `.claude/settings.local.json` 那條 allow 規則）。
- 每次的 prompt 相同（`<arm>`、`<n>` 換成實際值）：

  > Dispatch one Agent (subagent_type general-purpose, model sonnet) whose only job is to Write the file .fankeel/build/probe-<arm><n>/ok.txt containing the word ok, then report whether the write succeeded or was refused, with the exact refusal text.

- 每次的 JSON 輸出寫到 `<arm><n>.json`；跑完立刻用 `.fankeel/build/probe-<arm><n>/ok.txt` 存不存在記一行 `<arm><n> exists=<0|1>` 到 `results.txt`。
- 跑完 `bash docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/probe.sh` 之後，刪掉全部 `.fankeel/build/probe-*`。

## 3. 結果

從每個 JSON 讀 `permission_denials` 和 `result`：

| 組 | 寫成功 | 被拒 | no verdict |
|---|---|---|---|
| A（project,local） | 5/5 | 0/5 | 0/5 |
| B（project） | 5/5 | 0/5 | 0/5 |

十個 JSON 的 `permission_denials` 全部是空陣列 `[]`，`is_error` 全部是 `false`，`subtype` 全部是 `success`；`result` 文字裡也都是「寫入成功，沒有被拒絕，所以沒有拒絕文字可以引用」這一類敘述，沒有一次出現 no verdict 的樣子。`results.txt` 裡對應的 `exists=1` 十行，跟這裡的「寫成功」一致。

## 4. 結論

結論：本機現在重現不出 no verdict，規則效果仍無法證明。

## 5. 10-08 再發生

2026-10-09 的 land（session 8846548c）從 transcript 數出：2026-10-08 auto mode 對這條規則涵蓋的路徑回了 10 次 no verdict（時間是 UTC）。

- 主 session 4 次，18:27 到 18:28：Write `.fankeel/build/probe/main-tiny.txt`、Write `.fankeel/build/probe/main-4k.txt`、Edit `.fankeel/build/probe/main-bash.txt`、Write 根目錄的 `fk-probe-root.txt`。
- 三個 brain 子 agent 共 6 次：16:11 與 16:17 Write `.fankeel/build/task-20261008T155402/survey.md`；16:31 Write 設計頁（plans 資料夾）、16:33 Write `.fankeel/build/task-20261008T155402/design.md`；17:46 Write 計畫頁（plans 資料夾）、17:48 Write `.fankeel/build/task-20261008T155402/plan.md`。

規則在 `.claude/settings.local.json` 第 4 行：`Edit(/.fankeel/build/**)`。這個檔最後一次修改在 16:36，加的是一條 gate-check 的 Bash 規則。之後 17:48、18:27 兩次、18:28 一次，共四次寫的都是這條規則涵蓋的路徑，仍然 no verdict，所以這四次規則確定在檔案裡。

規則當時有沒有被讀到：未判定。拒絕訊息只說 classifier 沒有判定（tool_result 開頭是 "The server-side auto mode classifier gave no verdict"），看不出權限判定走到哪一步。當時 session 用 `--plugin-dir` 載入、開著 Remote Control、切換過多次模式；使用者切到 accept edits 之後，同樣的寫入都成功。要判定，得由使用者在 auto mode 下以 `claude --debug` 寫一次 `.fankeel/build/` 底下的檔，看 debug 輸出裡權限判定讀了哪些規則。

證據：`~/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33.jsonl` 與同名資料夾下的 `subagents/`。
