---
status: current
last_verified: 2026-09-27
source_of_truth: lib/profile.js, docs/90-agent/reference/station.md, docs/90-agent/reference/registry.md, scripts/task.js
---

# Profile

profile 是 gate 的常備答案：先寫好，fankeel 就不再問那一題。gate 是 fankeel 在關鍵處停下來問你的那一題，例如收尾要 merge 還是開 PR；每回答一次都是一次打斷，同一題你每次都答一樣的話，寫進 profile 就不必再答。

它有兩層檔案加上內建預設，逐個 key 合併：

| 層 | 放在哪 |
|---|---|
| 專案 | 專案裡的 `.fankeel/profile.json`，會提交 |
| 機器 | Claude Code 設定目錄下的 `fankeel/profile.json` |
| 內建 | 寫死在 `lib/profile.js` |

專案層蓋過機器層，機器層蓋過內建。一個 key 三層都沒有值，就表示「到時候問我」。

之所以逐個 key 合併、而不是整檔取代，是讓專案只需要寫它跟機器習慣不同的那幾個 key：專案只設了 `land.push`，仍然會拿到機器層的 `guard`。專案層會提交，所以隊友拿到的是同一份答案；只屬於你個人的習慣（例如 `language`）放機器層就不會影響別人。

兩種壞掉的情形都不會擋住 fankeel，只會讓那個 key 退回下一層：檔案裡某個值不在可選值內，該值當作沒寫；整個檔案不是合法 JSON，該層整個當作沒有，`profile show` 會在最後印出 `unreadable:` 和檔案路徑讓你去修。要補一個 key 時，用下面的 `profile set`，它遇到壞檔會拒絕寫入、請你先手動修好，不會蓋掉你的內容。

## 每個 key

「建議」一欄取自站頁精靈的「平衡」組合（`lib/profile.js` 的 `PRESETS.balanced`）；那組沒設的 key，建議就是內建值或不設。程式碼多半只記了每個值是什麼，沒有記為什麼選它；「平衡」的說明文字是照這個 repo 今天的習慣收尾，只在值得停的地方停。唯一有記下理由的是 `stage.agents`，見表後的說明。

起任務時，fankeel 會把來源不是內建的 key 記進這個 session 的紀錄（`guard` 記在自己的欄位，其餘記在 `profile` 欄位），事後翻紀錄就能看出這個任務是照哪些常備答案跑的。

<!-- PROFILE_TABLE:START -->
| key | 意思 | 可選值 | 建議 |
|---|---|---|---|
| `land.integration` | 收尾時怎麼整合：merge、pr 或 keep | `merge`、`pr`、`keep` | `merge` |
| `land.push` | 收尾時要不要 push | `true`、`false` | `false` |
| `land.archivePlan` | 計畫落地後直接封存，還是先問 | `true`、`false` | `true` |
| `class.default` | 起任務沒指定類別時的預設（spike／bounded／architectural） | `spike`、`bounded`、`architectural` | 不設 |
| `guard` | 別的 session 佔了檔案時：ask 問、deny 擋、off 只警告 | `ask`、`deny`、`off`；內建 `ask` | `ask` |
| `dispatch.floor` | 派給實作者與 reader 的最低模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `sonnet` | 不設，維持內建 |
| `judge.model` | 判官（/fankeel-ask）用哪個模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `fable` | 不設，維持內建 |
| `design.mockup` | 有前端的專案，design 站先做頁面時用哪個模型；auto 前端工作不問就畫、畫完開頁面；false 不做 | `false`、`auto`、`sonnet`、`opus`、`fable`；內建 `false` | 不設，維持內建 |
| `design.skill` | mockup 另外載入哪些 design skill，可多選（逗號分隔）；fankeel 指南一律載入 | `taste-skill:taste-skill`、`taste-skill:soft-skill`、`taste-skill:minimalist-skill`、`frontend-design:frontend-design`、`ui-ux-pro-max:ui-ux-pro-max`、`impeccable:impeccable` | 不設 |
| `quota.week` | 一週額度等於多少美元（如 Max 20x），監控站在每筆花費旁顯示佔比 |  | 不設 |
| `station.hide` | 這個專案要不要從監控站隱藏 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `gate.station` | gate 發出後，等監控站作答幾秒；off 不等，逾時照常在 terminal 問 | `off`、`60`、`120`、`300`；內建 `off` | 不設，維持內建 |
| `stage.agents` | 哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑 | `false`、`true`、`all`、或逗號分隔的站名清單；內建 `false` | `survey,build,verify` |
| `security.local` | verify 的 security lens 先交給哪個本地 ollama 模型篩候選；沒設照原流程 | 一個 ollama 模型名稱 | 不設 |
| `prompt.all`、`prompt.<站>` | 附在每一站（或某一站）規則最後的一句自訂 prompt | 一行文字 | 需要時才設 |
| `language` | 站 agent 寫報告與 gate 用的語言；不設就照 brief 的英文 | 一種語言的名稱，例如 繁體中文 | 不設 |
| `worktree` | 起任務時開自己的 git worktree（.fankeel/worktrees/<id 前 8 碼>，分支 fk/<id 前 8 碼>）：true 一律開，bounded 對 bounded 以上，architectural 只對 architectural | `true`、`false`、`bounded`、`architectural`；內建 `false` | 不設，維持內建 |
| `init.skip` | 跳過首次使用的 init 整理；true 時 task.js start 不再印 onboard: 行 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `sensitive.mode` | commit 帶到 .fankeel/sensitive.txt 的詞時：warn 只提醒、block 擋下 | `warn`、`block`；內建 `warn` | 不設，維持內建 |
| `sensitive.review` | reviewer 審查時要不要多跑 ## Sensitive lens，確認敏感資料沒寫進去 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `commit.format` | commit.js 提交前，每則訊息第一行要符合的正規式；不設就不檢查 | 一個 JavaScript 正規式，比對訊息第一行 | 不設 |
<!-- PROFILE_TABLE:END -->

`stage.agents` 建議打開，理由記在 `lib/profile.js:424-428`，`the user, 2026-10-02`（使用者，2026-10-02）：主 session 跑長任務時，用 remote control 的人看不到它的 context 堆了多少，除非手動 compact；Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent，每一站在自己的乾淨 context 裡跑，靠檔案互相傳遞資訊，主控只轉路徑。內建值仍是 `false`（`lib/profile.js:39`，`builtin: 'false'`），要打開得自己設。這段理由支持的是「把站交給 agent」這個方向，以及 `all`（每一站都交出去）；它沒有解釋為什麼「建議」欄只挑 survey、build、verify 這三站。精靈 agents 那一步有三顆會交出站的按鈕：「只交出 survey」設 `survey`；「省 context」的值在 `assets/station/station.js:1822`，是 `survey,build,verify`，其餘幾站仍由主控自己跑；「全部交出去」的值在 `assets/station/station.js:1823`，是 `all`，七站都交出去。程式碼裡另有兩組預設：`PRESETS.balanced` 的值在 `lib/profile.js:442`，是 `survey,build,verify`，`PRESETS.lean`（標籤也叫「省 context」）的值在 `lib/profile.js:447`，是 `all`；現在的站頁不再套用這兩組，實際寫入值的是精靈的按鈕，所以在精靈按「省 context」得到的是三站，不是 `all`。`true` 是舊寫法，只等於只交 survey。要自己設，把站名用逗號串起來：

```
node <plugin>/scripts/task.js profile set stage.agents survey,build,verify
node <plugin>/scripts/task.js profile set stage.agents all --default
```

`security.local`、`commit.format`、`language` 與 `prompt.all`、`prompt.<站>` 幾列是自由文字，精靈沒有欄位給它們，要用下面的指令設。自由文字各有限制，是因為它們會被注入每一輪或交給 `commit.js` 執行：`prompt.*` 與 `language` 限一行、200 字以內，因為每一輪都要付這段 token 的錢，而且各站的規則區塊已經接近上限；`commit.format` 同樣一行、200 字內，而且必須能編譯成正規式；`security.local` 必須是 `ollama list` 印出的模型名稱，例如 `qwen3:14b`，填 `false` 則關掉。設 `prompt.*` 時指令會當場印出多吃幾個 token、各站離上限還剩多少，超過只警告、不拒絕。例：

```
node <plugin>/scripts/task.js profile set commit.format '^(feat|fix|docs)(\([^)]+\))?: '
node <plugin>/scripts/task.js profile set language 繁體中文
```

`quota.week` 也是自由填的值，但填的是數字：你的 Max 20x 一週額度等於多少美元（以 API 價格換算的估算值）。填了之後，監控站每個金額後面會接上「(x%)」，也就是那筆金額除以這個數字；沒填就不顯示比例。它沒有內建值，因為 transcript 與 registry 裡都沒有百分比欄位可以讀，所以只能自己量。校準報告（`docs/90-agent/reports/2026-09-21-quota-calibration.md`）量到的區間約 $2,619–4,584，而且那份報告也指出累積讀數與固定費率互相矛盾，這個區間只能當起點。值必須是大於 0 的數字。例：

```
node <plugin>/scripts/task.js profile set quota.week 3000
```

另外有一類不在表裡的 key：`agent.<name>.model` 與 `agent.<name>.effort`，`<name>` 是 plugin 裡某個 agent 的名字，用來單獨調那個 agent 的模型與思考力道。模型的可選值同 `dispatch.floor`，effort 是 Claude Code 接受的五級。設下去時指令會順便把覆寫檔寫到 `.claude/agents/`（加 `--default` 則寫到機器層的 `agents/`）。

## 在站頁精靈怎麼套

精靈適合第一次設、或想一次套一整組習慣的時候：它把八個問題拆開，每題給幾顆預先配好的組合，省得你逐個 key 去對可選值。監控站的 `#/settings`（左側「設定 → 精靈」）是八步的精靈，每一步問一個習慣：收尾、任務大小、前端、context、撞檔、模型、監控站、答 gate。

- 每一步上方有兩到四顆「常見組合」，按一顆就一次設好它列的所有 key。
- 下面每個 key 一組卡片，一張卡一個值，可以只改一個 key。
- 最後一步是摘要：每個 key 目前的值、來自哪一層、說明；上面一排按鈕選要寫進哪個檔，機器預設或某個專案。
- 按「寫入 N 鍵」一次寫進去。頁面是直接開檔案、不是 serve 出來的時候，同一個位置會印出要自己跑的指令。

不開站頁也可以直接設：

```
node <plugin>/scripts/task.js profile set land.integration merge
node <plugin>/scripts/task.js profile set guard ask --default
node <plugin>/scripts/task.js profile show
node <plugin>/scripts/task.js profile unset guard
node <plugin>/scripts/task.js profile suggest
```

`--default` 寫進機器層；不加就寫進目前這個專案。三個動詞各做一件事：

- `show` 列出每個 key 目前的值與它來自哪一層（`project`、`machine`、`builtin`，沒值的留空，值印成 `(ask)`），改完用它確認。
- `unset` 把那個 key 從指定的檔案拿掉，讓下一層來回答；key 本來就不在檔案裡不算錯，也不會為了它新建檔案。要「退回問我」用它，而不是設成某個值。
- `suggest` 只印不寫：它從 git 的 merge 紀錄、有沒有 remote、沒推出去的 commit 數、registry 裡過去收尾與類別的紀錄，推 `land.integration`、`land.push`、`class.default`，以及近 50 則 commit 有八成以上長得像 `type(scope): ` 時的 `commit.format`。證據不足（例如 merge 不到三次）就不建議，印「nothing the history answers」。每個建議都附一行可以直接複製去跑的 `profile set`，由你決定要不要採用。

專案還沒有 `.fankeel/profile.json` 時，`task.js start` 會自己印出同樣的建議，所以第一次起任務多半不必手動跑 `suggest`。
