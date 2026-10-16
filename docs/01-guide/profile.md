---
status: current
last_verified: 2026-10-15
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
| `dispatch.floor` | 派給實作者與 reader 的最低模型；architectural 類的任務自動抬到至少 `opus`、effort `high` | `sonnet`、`opus`、`fable`、`haiku`；內建 `sonnet` | 不設，維持內建 |
| `dispatch.inflight` | 同一回應最多同時派幾個 Agent，超過就先問；擋的是 API 用量、主對話 context 與共用 checkout 的檔案衝突，不是 CPU | `4`、`6`、`8`、`12`；內建 `4` | 不設，維持內建 |
| `judge.model` | 判官（/fankeel-ask）用哪個模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `fable` | 不設，維持內建 |
| `design.mockup` | 有前端的專案，design 站先做頁面時用哪個模型；auto 前端工作不問就畫、畫完開頁面；false 不做 | `false`、`auto`、`sonnet`、`opus`、`fable`；內建 `false` | 不設，維持內建 |
| `design.skill` | mockup 另外載入哪些 design skill，可多選（逗號分隔）；fankeel 指南一律載入 | `taste-skill:taste-skill`、`taste-skill:soft-skill`、`taste-skill:minimalist-skill`、`frontend-design:frontend-design`、`ui-ux-pro-max:ui-ux-pro-max`、`impeccable:impeccable` | 不設 |
| `quota.week` | 一週額度等於多少美元（如 Max 20x），監控站在每筆花費旁顯示佔比 |  | 不設 |
| `station.hide` | 這個專案要不要從監控站隱藏 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `station.chartroom` | 監控站從哪個 Chartroom 安裝路徑開架構白板（/chartroom/<專案>/）；沒設就沒有白板 | 一個絕對路徑：Chartroom 套件的根目錄 | 不設 |
| `gate.station` | gate 發出後，等監控站作答幾秒；off 不等，逾時照常在 terminal 問 | `off`、`60`、`120`、`300`；內建 `off` | 不設，維持內建 |
| `compact.at` | 主對話累積多少 token 就自動壓縮；off 不壓縮。只對跑 fankeel 任務的 session 生效 | `350000`、`450000`、`600000`、`1000000`、`off`；內建 `450000` | 不設，維持內建 |
| `stage.agents` | 哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑 | `false`、`true`、`all`、或逗號分隔的站名清單；內建 `false` | `survey,build,verify` |
| `security.local` | verify 的 security lens 先交給哪個本地 ollama 模型篩候選；沒設照原流程 | 一個 ollama 模型名稱 | 不設 |
| `prompt.all`、`prompt.<站>` | 附在每一站（或某一站）規則最後的一句自訂 prompt | 一行文字 | 需要時才設 |
| `language` | 站 agent 寫報告與 gate 用的語言；不設就照 brief 的英文 | 一種語言的名稱，例如 繁體中文 | 不設 |
| `worktree` | 起任務時開自己的 git worktree（.fankeel/worktrees/<id 前 8 碼>，分支 fk/<id 前 8 碼>）：true 一律開，bounded 對 bounded 以上，architectural 只對 architectural | `true`、`false`、`bounded`、`architectural`；內建 `false` | 不設，維持內建 |
| `init.skip` | 跳過首次使用的 init 整理；true 時 task.js start 不再印 onboard: 行 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `sensitive.mode` | commit 帶到 .fankeel/sensitive.txt 的詞時：warn 只提醒、block 擋下 | `warn`、`block`；內建 `warn` | 不設，維持內建 |
| `sensitive.review` | reviewer 審查時要不要多跑 ## Sensitive lens，確認敏感資料沒寫進去 | `true`、`false`；內建 `false` | 不設，維持內建 |
| `commit.format` | commit.js 提交前，每則訊息第一行要符合的正規式；不設就不檢查 | 一個 JavaScript 正規式，比對訊息第一行 | 不設 |
| `quota.calibrated` | 最近一次自動校準 quota.week 的日期（YYYY-MM-DD），由 scripts/quota.js 寫入 |  | 不設 |
| `prose.style` | 站 agent 與 writer 寫給人看的文字用哪種風格：writer 先結論再附例子、plain 白話短句、sepia 長短句交錯、custom 讀 .fankeel/prose.md | `writer`、`plain`、`sepia`、`custom`；內建 `writer` | 不設，維持內建 |
<!-- PROFILE_TABLE:END -->

`stage.agents` 建議打開，理由記在 `lib/profile.js:474-478`，`the user, 2026-10-02`（使用者，2026-10-02）：主 session 跑長任務時，用 remote control 的人看不到它的 context 堆了多少，除非手動 compact；當時 Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent，每一站在自己的乾淨 context 裡跑，靠檔案互相傳遞資訊，主控只轉路徑。內建值仍是 `false`（`lib/profile.js:50`，`builtin: 'false'`），要打開得自己設。這段理由支持的是「把站交給 agent」這個方向，以及 `all`（每一站都交出去）；它沒有解釋為什麼「建議」欄只挑 survey、build、verify 這三站。這三站是經驗選擇：repo 裡沒有任何一處記下為什麼挑這三站，使用者 2026-10-02/03 裁定維持原樣、不補編理由；`PRESETS.balanced` 那一行的註解也這樣寫。精靈 agents 那一步有三顆會交出站的按鈕：「只交出 survey」設 `survey`；「省 context」與「全部交出去」都設 `all`（`assets/station/station.js` 的 `WIZ_STEPS`），七站都交出去，和 `PRESETS.lean` 一樣；只交 survey、build、verify 三站，要在同一步下面的卡片選「交三站」。`PRESETS.balanced` 的值是 `survey,build,verify`，`PRESETS.lean`（標籤也叫「省 context」）的值是 `all`；`/fankeel-init` 的習慣那一步用 `task.js profile preset` 套這幾組，站頁精靈則用自己的按鈕。2026-10-15 以前精靈的「省 context」寫的是三站，那時寫下的 `profile.json` 照原樣讀，不會被改寫。`true` 是舊寫法，只等於只交 survey。2026-10-05 起 fankeel 自帶一支 mod（`hooks/compact.ts`，由 `hooks/mod.ts` 載入，`hooks/hooks.json` 把它宣告為 module）。它在互動式 session 裡、這個 session 已在 `/plugin` 按過 Enable 讓 mod 載入（[重開 mod 路線](../03-decisions/2026-10-07-mod-reopen.md)），主 session 又有 active 的 fankeel task 時才動作。這時 context 一到門檻，它就在 turn 結束後自動壓縮，並要摘要留下 session id、task、stage 與還在跑的 agent。門檻預設 450k（`lib/context.js` 的 `HARD`），profile 的 `compact.at` 可以改成 350000、600000、1000000 或 `off`（不壓縮）。環境變數 `FANKEEL_COMPACT_AT` 有設時以它為準（`hooks/compact.ts`）。所以 `stage.agents` 不打開也不會撞 1M。同一支 mod 也畫兩樣東西（`hooks/pane.ts`）。在 Claude Desktop（`e.surface === 'desktop'`）這兩樣畫成 Svg 圖，圖的 `alt` 就是下面講的文字列；終端與其他畫得出來的介面照舊畫文字列，所以下面先講文字列，Desktop 的畫法接在各處之後。session 有 active 的 task 時，輸入框上方多兩行（畫面上有 survey 時讓位，`hooks/pane.ts` 的 `hasSurvey`）。第一行只講流程：階段徽章、route 的圓點、plan 有 ledger 時的 `tasks N/M`、這一站到現在的分鐘，以及等你回答了幾分鐘；有 gate 在等時多一個黃底的「gate 在等」與 `還 N 秒` 的倒數，題目本身不在這一行。列寬夠時，這一行最後是「遠端」：Remote Control 連著畫綠色 ✓，沒連或讀不到畫灰色 ✗，讀的是 Claude Code 自己的 session 檔。第二行是三條長條。`ctx` 是目前用掉的 token 除以模型的 context window，數字寫成 `212k/1M`。長條上的一條白線是自動壓縮發生的位置（`compact.at` 的門檻），顏色與 `⚠` 照 TokenBar 的分級，看用掉的 token 佔 context window 的百分比，不看離壓縮門檻多近。200k、500k、800k 與更大的視窗各有一組門檻，窗口大於 800k 時 `⚠` 往上換成 💥、💀 的階梯。`5h` 與 `7d` 是引擎回報的用量額度，`7d` 後面帶正負號的數字是比平均進度超前或落後幾點；別的還活著的 session 在改同一批檔案時，行尾多一個 `⚑N`，兩行左邊的色條變紅。`compact.at` 設成 `off` 時長條照畫，只是沒有白線；引擎沒有回報 window 時，`ctx` 對照門檻畫，顏色與 `⚠` 也看離門檻多近。Desktop 的第一行（`hooks/pane-svg.ts` 的 `bandRow1Svg`）把 route 畫成圓點，做完的站是自己那一站顏色的實心點，目前這一站是空心、外框用這一站的顏色，還沒到的是灰色空心，都不動畫；`tasks` 畫成一排小方格，後面接 `N/M`；有 gate 在等時，黃底徽章後面多一個環，環和旁邊的秒數倒數的，是這一題還能在 station 頁（`gate.station`）回答的時間。第二行（`bandRow2Svg`）的 `ctx`、`5h`、`7d` 各是一條長條：`ctx` 上有 compact 的位置，`7d` 上有一根細刻度標出平均進度，最後才是 `⚑N`。圖裡的說明文字是灰色；講狀態的字才帶顏色：`FANKEEL <STAGE>` 標籤用階段色，gate、等待的分秒、「還有 N 個是你的」與「已到門檻」的提示用琥珀色（「快到門檻」還是灰字），撞檔的 ⚑ 與檔名用紅色。⚠ 與偏差標記跟著長條的顏色。Pane 裡你的任務編號與 `80%` 標示用琥珀色，走完與正在跑的任務格，編號是填色格上的深色字。站名一律是灰色：band 的站點圓點與左側豎條用階段色；Pane 的路線圓點走完的是綠色實心，目前這一站是空心、外框用這一站的顏色，還沒到的是灰色空心。列寬不夠時，第一行依序丟「遠端」「本站」「等你」「tasks」，第二行先縮窄分隔線兩側的空格，再縮短長條，最後丟 `7d` 與 `5h`（`hooks/pane-band.ts`）；長條的畫法與顏色照 TokenBar 的漸層，寫在 `hooks/pane-bar.ts`。有任務時側邊的面板會自己打開，打 `/fankeel-panel` 可以關掉或再開。面板每一塊的第一列左邊有一條色條：任務區塊的不指定顏色，tasks、agents 與 notes 共用同一個灰色，同一塊底下的各列開頭只空一格。撞檔是要你出手的事，每一列都有色條。最上面是任務區塊：任務標題全文與 `next` 全文，其下一列是 route。這個任務路線上的站名用 › 相連，做完的站綠色，目前這一站粗體、用終端機自己的顏色，還沒到的灰色，欄寬不夠時在站與站之間換行。面板不畫 gate，也不因 gate 自動打開或跳提示；gate 在等只看輸入框上方第一行的徽章與倒數，要回答請到終端或 station 頁（`hooks/pane-gate.ts` 只讀 pending 檔，給那個倒數用）。接著是撞檔：別的還活著的 session 也握著的檔案，每個檔案一行 `⚑ <路徑>`，其下是對方的任務、所在階段與多久前動過；沒有共用的檔案就沒有這一塊。「還活著」看的是 `hooks/inject.js` 在有任務的 session 收到 prompt 時寫下的 `.fankeel/build/live.json`；不在名單裡的鄰居，只要它的 registry 檔寫得比名單晚，也算還活著，所以名單寫下之後才開始或才送出 prompt 的 session 馬上就看得到；那個檔讀不到時，所有 active 的鄰居都算。再來是 tasks：plan 的任務在六個以內就全列，更多就折成「完成幾個、第一個未完成的與之後兩個、還有幾個」，有 agent 在這一站外出時，那一列寫 `出去 N 分`，滿 20 分鐘轉琥珀色。接著是 agents：這個任務派出的 subagent，標題列寫幾個在跑、幾個完成（含各層底下的）。其下最多六個最上層的 agent 各佔一列，○ 在跑、● 完成，後面是標題、模型、effort、分鐘，以及它用掉的 token（input、cache 寫入與 output 相加，寫成 `79.4k`；讀不到它的 transcript 時這一段不畫）；它自己派的 agent 縮在 ├ └ 底下，每個最多三個，其餘折成「還有 N 個」。自己還在跑、或底下任何一層還有在跑的 agent 排在前面，其餘新的在前，所以被折掉的先是跑完的；沒有 subagent 就沒有這一塊。Desktop 的面板（`paneParts`）把三塊換成圖，任務標題、`next`、agents、notes 與頁尾仍是文字列：route 每一站一欄，欄裡有這一站花的分鐘，gate 等過的分鐘用琥珀色接在後面；撞檔畫成一張小圖，左邊是共用的檔案，右邊是握著它們的 session，有握就連一條線；tasks 九個以內排成一列，十個排成一列十格，超過十個就畫成四段的一條長條，游標停在格子上會顯示該任務的標題。重置時間不畫在任何地方。最後是最新三則 notes 與頁尾；頁尾是 session 編號與 station 那一列，station 在跑時是「開啟 station」按鈕加網址，沒有就寫「station 未啟動」。列數不夠時，依 notes、agents 的清單（留標題列）、tasks 的清單（留標題列）的次序讓出位置；任務、撞檔與頁尾不丟（`hooks/pane-status.ts`）。Remote Control 與手機不畫 mod，這兩樣在那裡都看不到。Claude Desktop 讀的是安裝時的快照，不是工作目錄；改版後要跑 `claude plugin update fankeel@fankeel` 才看得到新的。2026-10-07 在互動式 session 實測壓縮成功：transcript 的 `compact_boundary` 記的 trigger 是 `manual`，同一時間 debug log 有 `fankeel compact` 那一行，要判斷是不是 mod 壓的就看這兩樣；`claude -p` 這種 headless session 裡 Claude Code 會拒絕壓縮。不想每個 session 按 Enable 的話，可以改用 Claude Code 自己的自動壓縮。用環境變數 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`。你選過 `compact.at` 之後，`task.js start` 會替你寫進 `~/.claude/settings.json` 的 `env`（下面會說），你不用手動加，寫入後重開 Claude Code；沒選過就不碰。`/fankeel-init` 的第 1 步（習慣）套完組合之後，會先跑 `scripts/compact-window.js show`，看這台機器有沒有設這個變數，再問你 fankeel 自己的 mod 要在多少 token 壓縮。答案寫進機器層 profile 的 `compact.at`。之後每次 `task.js start` 開任務，只要 `compact.at` 是專案或機器層明確選過的，就會把 `settings.json` 的 `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 對齊成合併後的 `compact.at`：值一樣就不動，不一樣才寫。`settings.json` 原本就存在時，才會留一份 `.fankeel-bak` 備份。哪裡都沒設 `compact.at` 時，`start` 不碰 `settings.json`，這台機器原有的視窗照舊（不再套用內建的 450000）。你自己在 `settings.json` 手設的數字，會被 `compact.at` 換掉。`settings.json` 解析不了時，`start` 會印出 `compact window: not synced` 和原因，任務照常開始。`compact.at` 是 `off`，或這台機器有早先的 init 留下的 `compact-window.declined` 標記，就完全不碰 `settings.json`。寫入後 `start` 會印出 `compact window:` 那一行，這時請重開 Claude Desktop；已經開著的 session 仍用舊的視窗。2026-10-12 在 headless 用環境變數量過 100000 與 200000 兩個視窗（[量測](../90-agent/reports/2026-10-12-compact-window-probe.md)）。主機在 context 到大約視窗減 3 萬的地方自己壓，turn 進行中也壓。不用 mod，也不用你打任何字。還沒量的有三樣：寫在 `settings.json` 的 `env` 是否一樣生效、450000 的實際觸發點、Claude Desktop。寫在 `env` 的變數會套用到之後開的每個 session，不只有 fankeel task 的，這一點同樣沒有量過。沒有設、context 到 400k 以上、而且這個 session 還沒壓縮過時，`context:` 行會多一句。`compact.at` 選過之後 `task.js start` 就設好了，所以那一句多半只在 `compact.at` 是 `off`、從沒選過，或這台機器選過不設時才出現。出現時請 Claude 轉告你，或自己打 `/compact`。站 agent 仍值得開，因為每一站從乾淨的 context 開始，而壓縮會丟掉細節。headless 的證據見 [2026-10-05-compact-probe.md](../90-agent/reports/2026-10-05-compact-probe.md)。要自己設，把站名用逗號串起來：

```
node <plugin>/scripts/task.js profile set stage.agents survey,build,verify
node <plugin>/scripts/task.js profile set stage.agents all --default
```

本 repo 自 2026-10-09 起只交 `survey`：工作流評審指出 build 加 verify 占長任務花費的 63.9%，從沒量過交給站 agent 划不划算，唯一量過的 survey 打平。對照腳本在 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`，判定規則寫在旁邊的 README；量完的報告會是 `docs/90-agent/reports/<date>-build-verify-ab.md`，到時依它決定 build、verify 要不要加回。

`security.local`、`commit.format`、`language` 與 `prompt.all`、`prompt.<站>` 幾列是自由文字，精靈沒有欄位給它們，要用下面的指令設。自由文字各有限制，是因為它們會被注入每一輪或交給 `commit.js` 執行：`prompt.*` 與 `language` 限一行、200 字以內，因為每一輪都要付這段 token 的錢，而且各站的規則區塊已經接近上限；`commit.format` 同樣一行、200 字內，而且必須能編譯成正規式；`security.local` 必須是 `ollama list` 印出的模型名稱，例如 `qwen3:14b`，填 `false` 則關掉。設 `prompt.*` 時指令會當場印出多吃幾個 token、各站離上限還剩多少，超過只警告、不拒絕。例：

```
node <plugin>/scripts/task.js profile set commit.format '^(feat|fix|docs)(\([^)]+\))?: '
node <plugin>/scripts/task.js profile set language 繁體中文
```

`prose.style` 決定站 agent 和 writer 寫給人看的文字用哪種風格，內建 `writer`。`writer` 先講結論再講原因，每一節附一個可以照抄的例子。`plain` 是[中文受控規則](../90-agent/reference/plain-language.md)的白話短句。`sepia` 讓長句和短句交錯，規則改寫自 sepia 外掛的專業文體檢查。三種都不合用時，設成 `custom`，再把自己的規則寫進專案的 `.fankeel/prose.md`，整個檔案就是規則。設定時，指令會印出規則有幾個字、約多少 token，並和建議的 450 字比較；超過只警告。超過 1200 字的上限時，brief 改用 `writer`，檔案不存在時也一樣。build 站的 agent 不注入風格，因為它的 brief 已經貼近 10,000 字元的上限；它派出去的 writer 仍然照風格寫。不論選哪一種，句子不超過 160 欄和不用裸代號這兩項檢查都照舊擋 gate。例：

```
node <plugin>/scripts/task.js profile set prose.style sepia
node <plugin>/scripts/task.js profile set prose.style custom
```

`quota.week` 也是自由填的值，但填的是數字：你的 Max 20x 一週額度等於多少美元（以 API 價格換算的估算值）。填了之後，監控站在多數金額後面會接上「(x%)」，也就是那筆金額除以這個數字。但日直方圖與專案圖的縱軸刻度和每根長條的合計、導覽列的天數徽章、花費佔比條的標籤、派工花費條的各段文字，以及 session 頁花費讀數本身都只顯示純金額。session 頁的花費讀數把比例放在下方說明行開頭，滑鼠停留的提示文字則仍保留比例。沒填就不顯示比例。它沒有內建值，因為 transcript 與 registry 裡都沒有百分比欄位可以讀，所以只能自己量。校準報告（`docs/90-agent/reports/2026-09-21-quota-calibration.md`）量到的區間約 $2,619–4,584，而且那份報告也指出累積讀數與固定費率互相矛盾，這個區間只能當起點。值必須是大於 0 的數字。專案層（不加 --default）與機器層都可設，同一個 key 兩層都有時專案層優先，多個專案各設不同值時取登錄順序第一個有設的專案。例：

```
node <plugin>/scripts/task.js profile set quota.week 3000
```

`quota.calibrated` 是 `quota.week` 最近一次自動校準的日期（YYYY-MM-DD），由 `node <plugin>/scripts/quota.js` 寫進機器層，平常不用手填。這支腳本讀 TokenBar 的 statusline 每次渲染時寫在 Claude 設定目錄下的 tokenbar-usage.jsonl（`rate_limits.seven_day` 的百分比與重置時間）。在最新一個動了 10 個百分點以上的 7 天視窗裡，它拿頭尾兩筆讀數之間全機所有 transcript 的 API 等價花費，除以動了的百分點再乘 100，寫成 `quota.week`。只用同一視窗內的差值，不用讀數的絕對水位，因為絕對水位與 transcript 花費對不上（見 2026-09-21 的額度校準報告）。沒裝 TokenBar、或沒有夠大的視窗時，它什麼都不寫，`quota.week` 維持手填的值。要重新校準就再跑一次；加 `--dry-run` 只印結果、不寫。監控站在 30 天花費下方的說明行註明用的是哪一天的校準。例：

```
node <plugin>/scripts/quota.js --dry-run
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
node <plugin>/scripts/task.js profile preset balanced
```

`--default` 寫進機器層；不加就寫進目前這個專案。四個動詞各做一件事：

- `show` 列出每個 key 目前的值與它來自哪一層（`project`、`machine`、`builtin`，沒值的留空，值印成 `(ask)`），改完用它確認。
- `unset` 把那個 key 從指定的檔案拿掉，讓下一層來回答；key 本來就不在檔案裡不算錯，也不會為了它新建檔案。要「退回問我」用它，而不是設成某個值。
- `suggest` 只印不寫：它從 git 的 merge 紀錄、有沒有 remote、沒推出去的 commit 數、registry 裡過去收尾與類別的紀錄。它由這些紀錄推 `land.integration`、`land.push`、`class.default`，以及近 50 則 commit 有八成以上長得像 `type(scope): ` 時的 `commit.format`。證據不足（例如 merge 不到三次）就不建議，印「nothing the history answers」。每個建議都附一行可以直接複製去跑的 `profile set`，由你決定要不要採用。
- `preset` 一次套一整組：`manual`、`balanced` 或 `lean`，值照 `lib/profile.js` 的 `PRESETS` 寫，組合裡是 `null` 的 key 從檔案拿掉，和 `unset` 一樣。`balanced` 的 `land.integration` 與 `land.push` 改用 `suggest` 從這個 repo 歷史讀到的值，輸出在那幾行後面標 `(from history)`，再列出它讀到的證據；加 `--default` 寫機器層時不讀歷史，照組合本身的值寫。`/fankeel-init` 的第 1 步就是跑這一行。

專案還沒有 `.fankeel/profile.json` 時，`task.js start` 會自己印出同樣的建議，所以第一次起任務多半不必手動跑 `suggest`。
