---
status: current
---

# TODO Ready 十一條與 data-1

session 66d83a22-59ee-453e-997c-359ab202ce3e 的 design。描述要做成的樣子，不是現在的樣子。
survey 報告在 `.fankeel/build/task-20260930T111216/survey.md`，使用者的答案在同目錄的 `survey-answer.md`：全部 Ready 加上已決定的 data-1，重點是 INIT 與 UPGRADE。

INIT：十一條 Ready 沒有一條改到 `skills/fankeel-init/`、`agents/fankeel-init-scout.md` 或 init 用的腳本。唯一碰到的是第 6 節：data-1 的保留欄位掛在 fankeel-init 第 2 步寫出的 `data` bucket 上，而 init 說的「a path and a role, nothing more」照樣成立，因為沒有程式讀這個欄位。

## 1. upgrade-2：readTodo 只把 ENOENT 當成沒有 TODO.md

- `scripts/upgrade.js` 的 `readTodo` 只在錯誤碼是 `ENOENT` 時回 `null`，其他錯誤照原樣拋出；先寫會紅的測試：`TODO.md` 是一個目錄時 `steps()` 要拋出一個不是 `ENOENT` 的錯。
- 命令列 `upgrade.js` 遇到讀不了的 `TODO.md` 以非零結束，不印 `nothing pending.`。

## 2. tests-3：contract 測試的註解不寫死數字

- `tests/contract.test.js` 版本一致那個測試上方的註解拿掉「thirteen places」，改成不帶數字的說法；斷言裡的 15 不動。

## 3. await-4：工具呼叫還在跑時不報 lost

- `lib/handoff.js` 新增 `pendingTool(file)`：transcript 尾端最後一則 assistant 訊息裡，有沒有還沒拿到 `tool_result` 的 `tool_use`。
- `awaitState` 閒置超過 `idleMs` 時，只要任何 activity 檔有未回的 `tool_use`，就等到 `busyMs`（預設 11 分鐘，比 Bash 前景上限 10 分鐘多一分鐘）才回 `lost`。
- `awaitHandoff` 在這種情況下每隔 `idleMs` 再看一次，不空轉。

## 4. collisions-2：兩個 commit 同時發生

- 新測試釘住：同一棵樹上 `.git/index.lock` 被佔住時，`commit.js` 以 1 結束、印一行帶 `index.lock` 的 `commit.js: git add failed:`，commit 檔留著。
- 新測試釘住：兩個 `commit.js` 同時跑、路徑不重疊時，每一個不是印出 range 並以 0 結束，就是印一行 `commit.js:` 並以 1 結束；沒有安靜失敗。
- 新測試釘住：兩個 worktree 分支改同一行，從主 checkout 依序 `git merge`，第二次停在衝突，`git merge --abort` 後回到第一次 merge 的樣子。
- `docs/90-agent/reference/collisions.md` 加一節記下這三件事，並寫明 fankeel 在這條路上沒有自己的程式。

## 5. commit-2：commit 訊息格式由 profile 設定

- `lib/profile.js` 新增鍵 `commit.format`：一行、最多 200 字、能編成 JavaScript 正規式；內建值 null，不進監控站精靈。
- `docs/01-guide/profile.md` 的鍵表重新產生，多一列 `commit.format`。
- `scripts/commit.js` 在任何 block 被 stage 之前，逐一檢查每則訊息第一行符不符合 `commit.format`；有一則不符就整個檔都不提交，印一行 `commit.js:` 指出哪一則、哪個正規式，以 1 結束。
- 沒設 `commit.format` 時，`commit.js` 的行為和現在一樣。

## 6. data-1：資料位置的保留欄位

- `docs/90-agent/reference/documents.md` 寫明 `data` bucket 保留一個鍵 `access`：這個位置怎麼連到（起因是 NAS 在 Windows 上），可選值之後定成固定清單，現在沒有任何程式讀它。
- 一個測試釘住「沒有程式讀它」：`lib/docs.js` 的 `normalise()` 讀到 `access` 時把它丟掉。
- `docs/90-agent/todo/data-1.md` 的待答那一句改成已答，條目轉 `ready`，位置、負責人、保留期限那一半留給之後做。

## 7. test-3：serve detached 測試在 fed438fc 上跑全套

- 在 fed438fc 的乾淨 worktree 跑三次全套，記下每次的 pass、fail 數與失敗的測試名稱，寫進 `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`。
- 三次都沒重現就以 `measured-no-change` 關掉 test-3；有重現就把失敗行與報告連結附進條目，條目留在 `ready`。

## 8. tests-1：station-wizard-motion 在全套下的偶發紅

- 在當時 HEAD 的乾淨 worktree 跑三次全套，記下每次的結果與 station-wizard-motion 的失敗行，寫進同一份報告。
- 規則同 test-3：三次都沒重現就關掉，重現就附進條目、留在 `ready`。

## 9. inject-2：提示 hook 在負載下的耗時

- 量 `hooks/inject.js` 對本 repo registry 副本的耗時，閒置 20 次、全套跑著時 20 次，每次旁邊量一個空的 `node -e 0` 當對照，寫進同一份報告。
- 負載下最大值超過 5000 ms 時，`.claude-plugin/plugin.json` 裡 inject.js 的 `timeout` 改成 10、15、20、30 之中第一個不小於最大值 1.5 倍（換成秒）的值；沒超過就維持 5。
- 一個測試讀報告裡的 `inject timeout:` 行，釘住 manifest 的值和它相等。

## 10. station-8：8806240d 之後的 subagent 上限

- 對 8806240d（2026-09-30 05:10:45 +0800）之後開始、有 subagent 的每個 session，量每個 subagent 的 context 峰值與最貴 subagent 的花費佔比，寫進同一份報告。
- (1) 沒有任何峰值超過 300k，而且 (2) 至少有一個 subagent 滿 10 個的 session、這些 session 的佔比都低於 15%，才關掉 station-8；否則把數字附進條目，留在 `ready`。

## 11. await-1、skills-1：由使用者實跑

- await-1：一個 `build close` brain 跑起來時，session 紀錄的 in-flight mark 帶 `kind: 'close'`，await 印出的 handoff 路徑是 `build.md`；兩者都對就關掉。
- skills-1：新 session 裡模型收到的 skill 清單沒有 `fankeel:fankeel-station`，不打斜線請它開監控站時它不呼叫 Skill，打 `/fankeel-station` 仍能用；都對就關掉。
- 這兩條排在最後，沒有任何 task 依賴它們。

## What proves it done

| test | 由什麼證明 |
|---|---|
| upgrade-2：`TODO.md` 是目錄時 `steps()` 拋錯，沒有 `TODO.md` 時回空清單 | `tests/upgrade-readtodo.test.js` |
| tests-3：`tests/contract.test.js` 不再出現 `thirteen places`，contract 測試照樣通過 | `grep` 加上 `node --test tests/contract.test.js` |
| await-4：閒置 200 秒、尾端有未回 `tool_use` 的 transcript 不算 lost，過了 `busyMs` 才算 | `tests/await-pending.test.js` |
| collisions-2：`index.lock` 被佔住、兩個 commit 同時跑、兩個 worktree 改同一行，三種結果都被測試釘住 | `tests/collisions-commit.test.js` |
| commit-2：設了 `commit.format` 時第一行不符的訊息整檔不提交，沒設時照舊提交 | `tests/profile-commit-format.test.js`、`tests/commit-format.test.js` |
| data-1：`access` 寫在 documents.md，`normalise()` 把它丟掉 | `tests/docs-data-access.test.js` |
| 量測四條：報告裡每一節都有指令、量測時的 commit 與數字 | 報告本身；inject 的 timeout 由 `tests/inject-timeout.test.js` 釘住 |
| 實跑兩條：使用者照最後兩個 task 做完回報 | 條目變成 `done` |

## 對照 map

- `docs/90-agent/reference/collisions.md` 與 `documents.md` 由本設計改動，各自在負責的 task 裡改。
- 第 9 節若把 timeout 調高，`hooks/inject.js` 裡 `SERVE_BUDGET_MS` 上方「four of the five seconds」那句同時改；其他寫著 inject 5 秒的頁面留給 verify 的 drift 檢查。
- 其他頁沒有衝突。
