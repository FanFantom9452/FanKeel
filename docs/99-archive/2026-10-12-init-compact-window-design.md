---
status: current
approved: 2026-10-12
last_verified: 2026-10-12
---

# fankeel-init 幫忙設自動壓縮視窗

session 2fa61efa-a6c1-4424-b85c-4a5e04d9a0b4 的 design，來自 TODO 條目「init 幫忙設壓縮視窗」。這頁是要做的事，不是現況。

一句話：fankeel-init 的第 7 步多問一題，使用者答是，才由一支新腳本把 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫進使用者層 `settings.json` 的 `env`；答否記在機器層的一個標記檔，之後不再問。

使用者 2026-10-12 在 design 的提問裡選了使用者層（`<configDir>/settings.json`），不寫專案層。

## 1. 腳本 `scripts/compact-window.js`

- `show` 印一行狀態：`set <n>`（環境變數或 `<configDir>/settings.json` 的 `env` 已有正數）、`declined`（標記檔存在）、或 `unset`；`set` 優先於 `declined`。
- `set <n>` 把 `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 寫成字串 `<n>`，檔案裡其他的鍵與 `env` 裡其他的變數原樣保留；檔案不存在就建立只含這個 `env` 的檔。
- `set` 拒絕不是正整數的 `<n>`，也拒絕解析不了的 `settings.json`，兩種都不寫檔、exit 非 0，並印出檔案路徑。
- `decline` 寫下標記檔 `<configDir>/fankeel/compact-window.declined`，這是「答否不再重問」記住的地方。
- `<configDir>` 用 `lib/profile.js` 的 `configDirOf()`；變數名與「正數才算設了」的判斷在腳本裡自己寫一份，和 `tests/render.test.js:502` 一樣。

Struck（2026-10-12，plan 時）：原本要重用 `lib/context.js` 的 `windowSet`，但它沒有匯出，而那個檔正被另一個還活著的 session 握著（guard 是 `deny`），所以不改它。

## 2. 「不設」記在哪裡

- 不新增 profile 的鍵；答否由 `compact-window.js decline` 的標記檔記住，寫在機器層，因為視窗是每台機器一次的設定。

Struck（2026-10-12，plan 時）：原本是 profile 鍵 `init.window`。有可選值的鍵會自動進站頁精靈（`lib/profile.js:82`），而且要重新產生 `docs/01-guide/profile.md` 的表格，那個檔也被同一個 session 握著。

## 3. fankeel-init 的第 7 步

- `skills/fankeel-init/SKILL.md` 第 7 步多一項：跑 `compact-window.js show`，只有 `unset` 才問一題 `AskUserQuestion`；scout 的 `profile` 列是 `done` 也照跑。
- 那一題三個選項：設 450000（建議）、不設、Other 讓使用者自己填數字；說明寫清楚它改的是使用者自己的 Claude 設定檔、對這台機器之後開的每個 session 都生效、要重開 Claude Code 才吃到。
- 答是跑 `compact-window.js set <n>`；答否跑 `compact-window.js decline`；沒有答案什麼都不寫。

Struck（2026-10-12，plan 時）：`agents/fankeel-init-scout.md` 不改，它的指令清單是固定的五條，第 7 步自己跑 `show` 只要一個指令。`docs/01-guide/profile.md` 多一句「`/fankeel-init` 會問這一題」也不在這次做：那個檔被握著，等對方收尾後再補。

## 不做的

- `onboard.js` 不加檢查：它的五項都是專案的文件狀況，視窗是機器的設定，答否的機器不該讓 `--full` 永遠 exit 1。rerun 靠 `show` 讀現況。
- 站頁的精靈不加這一步：TODO 的完成條件沒有要求。
- `lib/context.js` 的 `NO_WINDOW` 提醒不動：答否的人仍會在 400k 以上看到一次提醒，那是另一個決定。

## 證明做完

- `tests/compact-window.test.js`：暫存的 configDir 裡，`show` 在三種狀態各印對的一行，`decline` 之後印 `declined`；`set 450000` 之後檔案的其他鍵還在、`show` 印 `set 450000`；壞的 JSON 與 `set abc` 都 exit 非 0 且檔案位元組不變。現在腳本不存在，測試紅。
- 產物對自己：`set` 寫出的檔再用 `JSON.parse` 讀回，`env` 的值等於 `show` 印的數字。

## 還沒驗證的

寫在 `settings.json` `env` 的變數，主機的自動壓縮是否照樣吃到，沒有量過（`lib/context.js:143`、`docs/01-guide/profile.md`）。verify 要在真的 session 量一次；量不到就在那一題的說明裡照實寫。
