---
status: design-intent
approved: 2026-10-12
last_verified: 2026-10-12
---

# fankeel-init 幫忙設自動壓縮視窗

session 2fa61efa-a6c1-4424-b85c-4a5e04d9a0b4 的 design，來自 TODO 條目「init 幫忙設壓縮視窗」。這頁是要做的事，不是現況。

一句話：fankeel-init 的第 7 步多問一題，使用者答是，才由一支新腳本把 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫進使用者層 `settings.json` 的 `env`；答否記在機器層 profile，之後不再問。

使用者 2026-10-12 在 design 的提問裡選了使用者層（`<configDir>/settings.json`），不寫專案層。

## 1. 腳本 `scripts/compact-window.js`

- `show` 印一行狀態：`set <n>`（環境變數或 `<configDir>/settings.json` 的 `env` 已有正數）、`declined`（機器層 profile 的 `init.window` 是 `off`）、或 `unset`；`set` 優先於 `declined`。
- `set <n>` 把 `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫成字串 `<n>`，檔案裡其他的鍵與 `env` 裡其他的變數原樣保留；檔案不存在就建立只含這個 `env` 的檔。
- `set` 拒絕不是正整數的 `<n>`，也拒絕解析不了的 `settings.json`，兩種都不寫檔、exit 非 0，並印出檔案路徑。
- `<configDir>` 用 `lib/profile.js` 的 `configDirOf()`，「有沒有設」的判斷用 `lib/context.js` 的 `windowSet`，兩者都不重寫。

## 2. profile 的鍵 `init.window`

- `lib/profile.js` 的 `KEYS` 多一個 `init.window`，值 `ask`、`off`，內建 `ask`。
- 使用者答否時，init 跑 `task.js profile set init.window off --default`，寫在機器層，因為視窗是每台機器一次的設定。
- `docs/01-guide/profile.md` 的 `PROFILE_TABLE` 重新產生，多這一列。

## 3. fankeel-init 的第 7 步

- `skills/fankeel-init/SKILL.md` 第 7 步多一項：跑 `compact-window.js show`，只有 `unset` 才問一題 `AskUserQuestion`。
- 那一題三個選項：設 450000（建議）、不設、Other 讓使用者自己填數字；說明寫清楚它改的是使用者自己的 Claude 設定檔、對這台機器之後開的每個 session 都生效、要重開 Claude Code 才吃到。
- 答是跑 `compact-window.js set <n>`；答否跑 `task.js profile set init.window off --default`；沒有答案什麼都不寫。
- `agents/fankeel-init-scout.md` 的 `profile` 列：`compact-window.js show` 印 `unset` 時是 `partial`，否則這一項不影響該列。
- `docs/01-guide/profile.md` 講手動設視窗的那一段多一句：`/fankeel-init` 會問這一題。

## 不做的

- `onboard.js` 不加檢查：它的五項都是專案的文件狀況，視窗是機器的設定，答否的機器不該讓 `--full` 永遠 exit 1。rerun 靠 `show` 讀現況。
- 站頁的精靈不加這一步：TODO 的完成條件沒有要求。
- `lib/context.js` 的 `NO_WINDOW` 提醒不動：答否的人仍會在 400k 以上看到一次提醒，那是另一個決定。

## 證明做完

- `tests/compact-window.test.js`：暫存的 configDir 裡，`show` 在三種狀態各印對的一行；`set 450000` 之後檔案的其他鍵還在、`show` 印 `set 450000`；壞的 JSON 與 `set abc` 都 exit 非 0 且檔案位元組不變。現在腳本不存在，測試紅。
- `tests/profile.test.js`：`init.window` 是鍵、內建 `ask`、`off` 可設。
- 產物對自己：`set` 寫出的檔再用 `JSON.parse` 讀回，`env` 的值等於 `show` 印的數字。

## 還沒驗證的

寫在 `settings.json` `env` 的變數，主機的自動壓縮是否照樣吃到，沒有量過（`lib/context.js:143`、`docs/01-guide/profile.md`）。verify 要在真的 session 量一次；量不到就在那一題的說明裡照實寫。
