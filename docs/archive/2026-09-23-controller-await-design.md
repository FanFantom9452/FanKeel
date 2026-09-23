---
status: current
---

# 主控看檔案等站 agent — design

2026-09-23，使用者在對話中核可。

證據有兩份。第一份是同日 10:28 的實驗：一個 general-purpose subagent 派出一個子 agent（45 秒的工作），用單一個字 `waiting` 結束自己的 turn，之後 52 秒沒有任何 tool call；子 agent 的結果到達後 3 秒內它被喚醒，接著用 `SubagentHandback` 回報。父層從頭到尾沒看到 `waiting` 這個字。所以 `2992222` 寫進 `agents/fankeel-brain.md` Return 段的規則（用 `waiting` 結束 turn、不輪詢）是對的；它唯一的問題是版本號沒升，裝好的那份落後。第二份在 `TODO.md` 的 stage-agents 條目：對一個已停下的 brain 用 SendMessage，畫面顯示 `queued`，然後訊息不見了（09-23 兩次）；另有一次 brain 的 `commit` hand-back 沒送到主控。

做法一句話：hand-back 會掉，檔案不會。主控每次送出之後都在背景等檔案，不再只等送達。

## 1. 主控等檔案，不等 SendMessage 送達

- 新增 `scripts/await.js`，邏輯放在 `lib/handoff.js` 的 `awaitState` 與 `awaitHandoff`，直接測。主控 SendMessage 站 agent 之後，用 Bash `run_in_background` 在背景跑它；下列三個條件任一成立就結束，並印出是哪一個：`handoff`，handoff 檔的 mtime 晚於給定的 since 時間（預設是 answer 檔）；`commit`，`<stage>-commit.md`（`lib/handoff.js` 的 `commitPath`）存在；`lost`，handoff 沒更新，而且 agent 的 transcript 兩分鐘沒動。
  - agent 的 id 取自 record 的 `inflight.agentId`（由 `hooks/brief.js` 的 `markInflight` 寫入）；transcript 用 `lib/detail.js` 的 `transcriptOf` 找到 session 的目錄，再用 `lib/usage.js` 的 `agentFiles` 列出 `subagents/agent-*.jsonl`。
  - 「沒動」看的是整個 `subagents/` 目錄裡最新的那個 mtime，不是 agent 自己那一份：brain 等子 agent 時自己的 transcript 不會動（實驗裡 52 秒沒有 tool call），但它派出去的子 agent 會寫。agent 自己那一份不存在時，不判 `lost`。
  - 事件觸發：啟動時先 stat 一次（條件可能已經成立），然後用 `fs.watch` 看 handoff 所在的目錄，再加一個計時器，設在 agent 會被判為 lost 的那一刻，到時重讀磁碟再決定、必要時重設。硬上限 30 分鐘，到了印 `timeout`。主控那邊沒有輪詢迴圈。
  - 判斷順序是 `commit`、`handoff`、`lost`。commit 檔同樣要晚於 since 才算，所以 commit.js 失敗後主控帶 `--since "<那個 commit 檔>"` 重跑，那份還沒改過的檔不會立刻再觸發一次。
  - 印出的那一行以狀態字開頭，後面接下一步要做什麼，讓主控規則本身不必逐項列出。
- `lib/stages.js` 的 `controlRules` 加一條規則，`SCRIPT_TOKENS` 加 `{{AWAIT}}`，跟 `{{COMMIT}}` 一樣由 `lib/render.js` 的 `SCRIPTS` 填入：每次 dispatch 與每次 SendMessage 站 agent 之後，在背景起 await，然後結束 turn；拿到 `handoff` 就出 gate（同一個 placeholder AskUserQuestion），除非這份 handoff 已經問過；拿到 `commit` 就走既有的 commit 流程；拿到 `lost` 就用同一行 dispatch 一個新的站 agent。
  - 三種結果各自要做什麼，寫在 await 印出的那一行裡，不寫進規則：受控 build 帶 in-flight 標記、從 `renderResume` 出來的 block 已經 2213 字元，`tests/render.test.js` 的上限是 2400，只剩 187 字元。規劃時在 `2066658` 的副本上實測，加上這條規則並拿掉通知那句的舊結尾之後是 2368。
- 既有那句「A notification that it finished with no path in hand: if {{HANDOFF}} exists, ask」也改成先看 commit 檔：收到這種通知時同樣起 await，而 await 先查 commit 檔、再查 handoff。
- `scripts/commit.js`：所有 block 都提交成功後，把 commit 檔改名為 `<stage>-commit.done.md`（已有的就覆蓋），讓磁碟上一份 `-commit.md` 永遠代表還沒做的提交。失敗時檔案留在原地。

## 2. brain 的等待規則有證據撐著

- 新增 `docs/reports/2026-09-23-brain-wakeup.md`（report 角色，frontmatter 照 `docs/reports` 裡其他頁的格式），記下這次實驗和上面那些時間。
- `agents/fankeel-brain.md` 的 Return 段引用那份報告，並寫明它的回報只經由 `SubagentHandback` 到達主控；既有的 `waiting` 與不輪詢那兩句保留（`tests/agents.test.js` 斷言它們）。
- `docs/subagents.md` 加一段說明 await 的協議。
- 同一個改動裡跟上的頁：`docs/subagents.md` 表格的 controller's block 與 commit 兩列、`docs/registry.md` 講 build 目錄那一列（`.done.md`），以及 `docs/README.md` 索引裡這份設計、它的計畫和那份報告的列。

## What proves it done

| test | 對應 |
|---|---|
| `tests/await.test.js`：在 `tests/tmp.js` 給的暫存 fixture 裡寫入 handoff 檔，觸發 `handoff` | §1 |
| `tests/await.test.js`：寫入 commit 檔，觸發 `commit` | §1 |
| `tests/await.test.js`：用可注入的 idle 門檻與時鐘觸發 `lost`，測試不必等兩分鐘 | §1 |
| `tests/commit.test.js` 斷言提交成功後改名、失敗時不改名 | §1 |
| `tests/stages.test.js` 斷言新規則的文字與 `{{AWAIT}}` token | §1 |
| `tests/agents.test.js` 斷言 Return 段連到 `docs/reports/2026-09-23-brain-wakeup.md` | §2 |
| 整套 `npm test` 綠，其中 `tests/render.test.js` 的受控 block 仍在 2400 字元以下 | §1 |

## 沒驗過的

- 背景 Bash 結束時，會不會像 hand-back 一樣把主控叫醒。

## 不在這份計畫裡

- 版本升到 0.77.0、`TODO.md` 的修改：land 時由 session 自己做。

## 檔案

| file | change | dispatch |
|---|---|---|
| `lib/handoff.js` | `mtimeOf`、`lastActivity`、`awaitState`、`awaitHandoff`，匯出後兩個 | implementer, sonnet |
| `scripts/await.js` | 新檔：參數、從 record 找路徑與 agent、印一行 | implementer, sonnet |
| `tests/await.test.js` | 新檔 | implementer, sonnet |
| `scripts/commit.js` | 全部提交後改名為 `.done.md` | implementer, sonnet |
| `tests/commit.test.js` | 改名的測試 | implementer, sonnet |
| `lib/stages.js` | `SCRIPT_TOKENS.await`、`AWAIT_RULE`，通知那句改成交給 await | implementer, sonnet |
| `lib/render.js` | `SCRIPTS.await` | implementer, sonnet |
| `tests/stages.test.js` | 規則文字與 token | implementer, sonnet |
| `docs/reports/2026-09-23-brain-wakeup.md` | 新檔 | implementer, sonnet |
| `agents/fankeel-brain.md` | Return 段引用報告、寫明 `SubagentHandback` | implementer, sonnet |
| `tests/agents.test.js` | Return 段的連結 | implementer, sonnet |
| `docs/subagents.md` | await 協議一段、表格兩列、位移的引用 | implementer, sonnet |
| `docs/registry.md` | build 目錄那列加 `.done.md` | implementer, sonnet |
| `docs/README.md` | 三列索引 | implementer, sonnet |
