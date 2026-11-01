# survey — 交接時記下 HEAD sha，adopt 時列出之後被改的 claims（拋棄式原型）

fankeel map：1378 份 markdown，11 份 planned, not built，410 份 retired，86 份 undeclared（`node scripts/map.js` 的摘要）。

scanner：`survey.js setNext cmdNext cmdAdopt handoff` 掃 3666 個檔，source: git；declarations 命中 lib/registry.js:814 `setNext`、lib/registry.js:837 `handoffOf`、scripts/task.js:1159 `cmdNext`、scripts/task.js:1391 `cmdAdopt`；測試檔 tests/adopt-sessions.test.js 是 adopt 的既有測試。skipped：1 個超過大小上限、1806 個副檔名沒有宣告樣式（多為文件與資料，與這個功能無關）。

結論：既有的判斷（選 D）成立，原型只動三處，而且 `cmdAdopt` 確實沒有任何 claims 差集，所以判斷檔裡的「would flip to C」條件沒有成立。

- lib/registry.js:814 — `setNext(projectRoot, sessionId, next, handoffAt)` 只存一行 `next` 與一個 ISO 時間戳 `handoff`；沒有 sha。原型在此多收一個 `handoffSha`，並照 `handoff` 的規則，在 `next` 被清掉或改寫（沒帶 `--handoff`）時一併刪掉。
- scripts/task.js:1159-1175 — `cmdNext` 在 `--handoff` 時傳 `now()`；原型在這裡用 `git rev-parse HEAD` 取 sha（task.js:26 已引入 `execFileSync`，task.js:882 附近已有 git 的用法可仿），失敗時（不在 repo 裡）不記，不報錯。
- scripts/task.js:1391 `cmdAdopt` — 複製 `next`、`claims`，但不複製 `handoff`，也不印任何差集。原型在這裡讀 `source.handoffSha`，執行 `git diff --name-only <sha>..HEAD`，與 `registry.claimsOf(source)`（registry.js:777）取交集，在回傳的 `lines` 末尾（task.js 的 describe 之後）加一段「交接後被改的 claims」。
- tests/adopt-sessions.test.js:1 — 用 `spawnSync` 跑 `task.js adopt`，在暫存 registry 上測；原型的測試放同一個檔案或相鄰新檔，需要一個暫存 git repo 做兩次 commit。
- 規則：fankeel 文件裡不得提 patent-KG 或其機制（判斷檔的專利揭露顧慮）；原型的註解與測試描述只用 fankeel 自己的語彙。

planned, not built: 與此功能無關的 11 份 design-intent 頁；我沒有逐一開啟，因為這個功能不在其中任何一頁的描述範圍內（未逐頁確認）。
not found: 無；四個詞都有宣告命中。
unknown: `handoffSha` 要不要出現在 `show` / station 頁；`git diff` 在 worktree 或 sha 已被 rebase 掉時的行為；docs 裡（registry.md:531-537）要不要同步一句——這些留給 build 階段決定，原型先不做。我也沒有跑現有測試。
skipped: 見上；皆為不可由 survey 解析的檔案，沒有可派給 reader 的路徑。
class: spike — 輸出是「這個小功能是否可行」的答案，原型標為拋棄式。
route: unchanged

補讀（依使用者要求再停留在 survey）：11 份 planned 頁是 professor 系列計畫、bench 測試夾具與 improvement-brief，沒有一份談 handoff 或 adopt，與此功能無衝突（以 map.js --print 的清單核對，頁內容未逐頁開啟）。station 顯示：lib/render.js:515 只依 `handoffOf` 標示交接，不讀 sha，所以多存 `handoffSha` 不會改變任何頁面，原型不必動 station。

## D 是什麼

D 是判斷檔給原問題「patent-KG 的概念與程式碼能不能用進 fankeel」的四個答案之一：A 搬程式碼、B 只搬概念、C 全不適用、D 只挑一兩個概念做成小功能，其餘不用。判斷檔選 D，原因是 patent-KG 的核心（預測憑證何時過期）需要設備的統計壽命表，而 fankeel 沒有這種資料，也刻意不用計時器讓權限過期，所以不搬；但它「交接指示的每個前提各自標明何時要重驗，接手者只重驗變動過的」這個結構，剛好補上 fankeel 的一個缺口：交接只有一個整體時間戳，接手時不知道哪些檔案在交接後被動過。做法是交接時記下 HEAD 的 sha，adopt 時用 git 列出該 sha 之後被改的 claims（那個任務宣告占用的檔案）。例如 A 交接時 HEAD 是 abc123，B 接手時印出「交接後被改：lib/foo.js」。這就是 D，也是 build 階段要做的原型。

reads:
F:/ymlab/fankeel/lib/registry.js — 814-840 行：setNext 與 handoffOf，加 handoffSha 的地方
F:/ymlab/fankeel/scripts/task.js — 1159-1175 行 cmdNext；1391-1520 行 cmdAdopt（差集印在 describe 之前）
F:/ymlab/fankeel/tests/adopt-sessions.test.js — 既有的 adopt 測試寫法，原型測試照抄

```json gate
{"questions":[{"header":"Survey→Build","question":"Survey -> Build | fankeel : 評估 patent-KG 的概念與程式碼能否用進 fankeel","options":[{"label":"Go to Build (Recommended)","description":"接受 spike 分類與選 D（只做交接時記 sha、接手時列出被改 claims 這一個小功能）。build 只做拋棄式原型：handoff 時記 HEAD sha，adopt 時列出之後被改的 claims。只動 registry.js、task.js 與一個測試。"},{"label":"Back to Survey","description":"若上面對 D 的說明仍不清楚，或你想改選 A、B、C，選這項重新談。"},{"label":"暫停","description":"結論先記下，原型之後再做；registry 保留這個任務，不動任何程式碼。"}]}],"next":"build 拋棄式原型：handoff 記 HEAD sha，adopt 列出交接後被改的 claims"}
```
