---
judged: 2026-10-26T01:10:02.062Z
model: fable
agent: fankeel-judge
task: "station 與 notification 展開面板太小、不能調整大小；手機版畫面一併調整"
session: 4ace4d5d-3c5e-47ef-9539-980d4d920eca
stage: build
---

# 判官題：先把第三方通知（ntfy.sh）從 fankeel 拔掉，改記成 watch 狀態的 TODO，之後再做回來？

## Question

# 判官題：先把第三方通知（ntfy.sh）從 fankeel 拔掉，改記成 watch 狀態的 TODO，之後再做回來？

## 問題

使用者原話：「這個SKILL 我不希望他去依賴第三方的通知程式 你要不要幫我把第三方的通知程式先幫我拔掉 這個通知我們留到 watch 之後再想辦法再去把它做回來」

「watch」是 fankeel TODO 的一種狀態（例：`docs/90-agent/todo/await-15.md:5` `state: watch`），所以使用者的意思是：把通知功能拿掉，另記一筆 watch 狀態的 TODO，等之後再把它做回來。

事實：
- station 的 gate／stage／end 通知由 `lib/notify.js` 起一個 detached child（`scripts/notify.js`），POST 到 `notify.server`（預設 `https://ntfy.sh`，第三方公開服務）。
- 呼叫的地方有：`hooks/gate.js`、`hooks/leave.js`、`scripts/task.js`、`scripts/station.js`、`lib/mobile.js`。
- profile 的 `notify.*` 鍵在 `lib/profile.js`。
- 設定頁裡有 ntfy 的步驟，在 `assets/station/settings-steps.js`（15 處）和 `settings-page.js`；遠端卡片在 `remote-card.js`；`/m` 頁面在 `mobile.js`。
- 相關文件：`docs/01-guide/{profile,station,tailscale-setup,what-runs}.md`、`docs/90-agent/reference/{station,sources}.md`。
- 相關 TODO：`docs/90-agent/todo/station-35.md`、`station-41.md`、`station-43.md`。
- 相關測試：`tests/notify*.test.js`、`gate-notify`、`profile-remote`、`station-mobile-page`、`station-remote*`、`station-settings-*`、`mobile-model`。
- 早先的判決：`docs/90-agent/judgements/2026-10-22-notify-channel.md`（當時選了留 ntfy.sh，或者別的，請讀全文）。
- 決策：`docs/03-decisions/2026-10-21-station-remote.md`。

目前任務在 build 階段，這輪正在做的是設定頁的 AGENT 數量 slider（build agent 正在動 `assets/station/settings-page.js`、`settings-detail.*`、`lib/profile.js`、`lib/settingsuggest.js`）。拔通知也會碰到 `settings-page.js` 和 `lib/profile.js`，兩件事會改到同樣的檔案。

## 要選的

1. **整個拔掉**：刪掉 `lib/notify.js`、`scripts/notify.js`，拿掉所有呼叫、`notify.*` profile 鍵（舊 profile 裡有這些鍵時要能容忍或忽略）、設定頁的 ntfy 步驟、遠端卡片和 /m 頁面的訂閱入口，相關測試和文件一起拿掉。另開一筆 watch TODO「通知做回來（不依賴第三方）」，連結判決和 git 中最後一個含 notify 的 commit；station-35／41／43 改指向它或關掉。
2. **只拔第三方**：保留 notify 的掛點和事件（gateEvent 等），但移除 ntfy.sh 預設 server 與 POST，變成 no-op；之後做回來時只換傳送端。
3. **用開關停用**：程式保留，預設關閉並從設定頁隱藏。
4. 其他組合。

要考慮「不依賴」的意思：使用者要的是程式碼裡沒有第三方，還是只要不往外送？也要考慮做回來的成本、測試大約減少多少、版本號（依記憶：功能／UI 變更升 minor）。

## 要回答的排程問題

這件事要併進目前 build 這一輪（和 slider 一起，靠先後順序避開同檔衝突），還是等這輪 land 之後另開一個任務？請說明理由。

## 要讀的

- `lib/notify.js`、`scripts/notify.js`
- `hooks/gate.js`、`hooks/leave.js`、`scripts/task.js`、`scripts/station.js`、`lib/mobile.js`：用 grep 找 notify
- `lib/profile.js`：notify 鍵
- `assets/station/settings-steps.js`、`settings-page.js`、`remote-card.js`、`mobile.js`
- `docs/90-agent/judgements/2026-10-22-notify-channel.md`、`docs/03-decisions/2026-10-21-station-remote.md`
- `docs/90-agent/todo/station-35.md`、`station-41.md`、`station-43.md`，以及任何一筆 `state: watch` 的 TODO 的格式
- `git grep -n ntfy` 的結果，用來估算範圍

## 什麼算答案

答案要包含：
- 一個 pick（1 到 4 或明確的組合）。
- 要刪、要改的檔案清單，標出哪些是直接刪除。
- 舊 profile 留有 `notify.*` 時的處理方式。
- 那筆 watch TODO 的標題和內容要點。
- station-35／41／43 各自怎麼處理。
- 排程答案：併入這輪或另開，加上理由。
- 有沒有任何呼叫端拿掉後會讓別的功能壞掉，例如 gate.js 依賴 notify 的回傳值。

## 回傳形狀

照 fankeel-judge 的固定格式回六個欄位（含 `pick:`），後面接 `## Summary`。用繁體中文回答。

## Answer

pick: 1 整個拔掉（刪 lib/notify.js、scripts/notify.js、5 個 notify 測試檔；拿掉所有呼叫、notify.* 五個 profile 鍵、設定頁兩個 ntfy step、遠端卡片與 /m 訂閱入口；另開一筆 state: watch TODO），排程上「等這輪 land 後另開任務」，版本 0.116.0 → 0.117.0。
why: 使用者說的是「拔掉」「之後再做回來」，而觸發鍵今天已預設關（lib/profile.js:61-63），選項 3 等於沒做；選項 2 留下的只是三個事件組字函式（lib/notify.js:47-75，約 30 行），從 git 取回比留空殼便宜。
三個 hook 呼叫端都是 try/catch 裡的裸語句、不用回傳值（hooks/gate.js:200、hooks/leave.js:136、scripts/task.js:996），fire 本身也永不丟出（lib/notify.js:110-125），拔掉不會壞 gate／leave／stage。
舊 profile 的 notify.* 鍵不用遷移：載入只走 KEYS 表，多出的鍵靜默忽略（lib/profile.js:455-463）；使用者專案 profile 本來就沒有 notify 鍵。
排程：build-7 寫明 slider「尚未動工」（build-7.md:4）、settings-page.js 與 lib/profile.js 無未提交差異，兩件事在這兩檔的區段也不重疊，所以沒有「同檔衝突」要靠先後避；真正的代價是這輪已過 6 次 verify、正在收尾（build.md:1「build 收尾」），再塞進 ~25 檔的功能移除會把 verify 整個重開，而且依「每個變更各自 bump、各自 commit」的規則，兩個 minor 變更不該擠進同一個 land。
would flip if: 使用者說「先」是指要在 slider 之前、這輪就拔——那就在 slider 動工前先做一輪獨立 commit 的 notify 移除（兩區段不重疊，可行），但 verify 要全套重跑。
或者使用者其實只要「預設不往外送」而不在意程式碼含 ntfy——那選項 3（今天已是預設關，只需藏兩個 step、rail 列與卡片區）即可。
unread: `docs/01-guide/{profile,station,tailscale-setup,what-runs}.md` 只看了 git grep 命中行與 tailscale-setup.md:79-81；`docs/90-agent/reference/sources.md:119` 只看命中行；部分命中的測試檔（station-hdl-g/j/k、dispatches、usage、profile-confirm、station-float、station-gate-send、settings-suggest）只有計數，沒開內容；機器 profile（configDir 下的 fankeel/profile.json）沒看，不知道使用者實測後是否留有 notify.topic；profile.write 重寫檔案時是否保留未知鍵沒查。
delegated: lib/notify.js、scripts/notify.js（opus）；hooks/gate.js、hooks/leave.js、scripts/task.js、scripts/station.js、lib/mobile.js、assets/station/mobile.js:347-350（sonnet）；lib/profile.js、lib/settingsuggest.js、.fankeel/profile.json、git diff/status（sonnet）；assets/station/settings-steps.js、settings-page.js、remote-card.js、mobile.js、settings-detail.js（sonnet）；docs/90-agent/judgements/2026-10-22-notify-channel.md、docs/03-decisions/2026-10-21-station-remote.md（sonnet）；docs/90-agent/todo/station-35.md、station-41.md、station-43.md、await-15.md、scripts/todo.js --help、docs/90-agent/reference/todo.md（sonnet）；git grep ntfy/notify 全庫計數、tests/ 清單與測試數、package.json、docs/01-guide 命中行（sonnet）；.fankeel/build/task-20261025T191318/build-7.md、build.md、git log、docs/90-agent/reference/station.md 命中行（sonnet）
checklist: 1 lib/notify.js、scripts/notify.js API 與回傳值 — answered；2 五個呼叫端是否用回傳值 — answered；3 lib/profile.js notify 鍵與未知鍵容忍、未提交差異 — answered；4 四個 station 資產檔的 ntfy 參照與 slider 區段重疊 — answered；5 判決與決策檔內容 — answered；6 station-35/41/43、watch 格式、todo.js 用法 — answered；7 git grep 範圍、測試數、版本 — answered；8 build-7 現況 — answered

## Summary

### 使用者的「不依賴」是什麼意思

原話是「不希望他去依賴第三方的通知程式」「先幫我拔掉」「留到 watch 之後再想辦法再去把它做回來」。三個動詞：不依賴、拔掉、做回來。「做回來」表示它會先消失，所以不是藏起來（選項 3）；「不依賴」針對的是程式裡那個第三方——`https://ntfy.sh` 作為 builtin（lib/profile.js:59）、settings 的 `ntfy.sh` 選項（assets/station/settings-steps.js:397）、/m 的 `ntfy://` 深連結（lib/mobile.js:160）。而且今天三個觸發鍵 builtin 都是 `'false'`（lib/profile.js:61-63），「預設不往外送」早就成立，選項 3 幾乎等於什麼都沒做。選項 2 留下的「掛點」實際只有 gateEvent／stageEvent／endEvent 三個組字函式（lib/notify.js:47-75）和一個變成空殼的 fire；做回來時傳送端不一定還是「POST 一個 body」（Web Push 要 VAPID＋service worker，形狀不同），留這 30 行換不到多少，git 裡本來就有。所以選 1。

### 各 reader 的發現與抽查

**lib/notify.js、scripts/notify.js（opus）**：exports 在 lib/notify.js:128 `{ newTopic, remoteBase, gateEvent, stageEvent, endEvent, request, send, fire }`；`fire` 同步回傳 boolean，整個包在 try/catch（:110-125），用 `spawn(... { detached: true, stdio: 'ignore' })` 加 `unref()` 起 scripts/notify.js（:119-121）。ntfy.sh 預設不在 notify.js 裡，只在 profile KEYS 的 builtin（lib/profile.js:59）。守門在 :79（觸發鍵不為 true 回 null）與 :82（沒 topic 或 server 非 http(s) 回 null）。檔案 128＋47 行。最後三個 commit：1b548297、ef922175、d61e9c06（2026-10-21）。抽查 :77-128 全部屬實。

**呼叫端（sonnet）**：gate.js:200、leave.js:136、task.js:996 三處都是 `notify.fire(...)` 裸語句，各自包在 try，catch 註明「a notification never changes the question/hook/move」；抽查 gate.js:198-201 屬實。scripts/station.js 沒有 fire：:838-844 把 `notify:{server,topic,gate,stage,end}` 放進 settings JSON；:913 `body.notify = mobile.subscribeOf(...)` 放進 /m JSON；:1116-1121 在 machine scope 首次把任一觸發鍵設 true 且沒 topic 時自動 `notify.newTopic()` 寫入（抽查屬實）。lib/mobile.js:154-161 `subscribeOf` 回 null 或 `{app:'ntfy://host/topic', web:'https://host/topic'}`；前端 assets/station/mobile.js:349-350 以 `m.notify && m.notify.app` 守門只畫兩個連結。

**lib/profile.js（sonnet）**：五鍵 :59-63（server builtin ntfy.sh、topic null、三個 flag 'false'），解析分支 :428-430。載入迴圈 `for (const key of Object.keys(KEYS))`（:455）只讀表內的鍵，抽查 :455-463 屬實——舊檔多出的 notify.* 不會被讀也不會報錯；`unset` 對未知鍵回 `unknown key`（:603）。`lib/settingsuggest.js:151` 有一行「notify.gate 為 true 時建議 gate.away」。使用者專案 `.fankeel/profile.json` 沒有任何 notify 鍵。`git diff --stat` 對 lib/profile.js、settingsuggest.js、settings-page.js、settings-detail.* 全部為空。

**station 資產（sonnet）**：settings-steps.js 的 ntfy 不是一個物件而是兩個 step（:391-394 `id:'notify'` 多選三觸發、:395-398 `id:'ntfy'` 單選 server）加 rail 列 :319-320、字串 :48-49、:179-195；抽查 :391-398 屬實。settings-page.js 的 notify 在 MACHINE 常數 :144、names() :256、lab() :271、fresh() :321、machine() :364、cardHtml() :458-460，只有 :237（一個 `from` 來源字串）落在 slider 要改的 questions()（:165-243）裡。settings-detail.js 有 15 處 notify.* 鍵參照。remote-card.js:125-131、:153 畫觸發 checkbox 與 topic 文字，`triggers(S.notify || {})` 有守門。

**判決與決策（sonnet）**：2026-10-22 判決 pick 1「維持 ntfy.sh」（:52，抽查屬實），理由含「自架 ntfy 在 Android 走常駐前景服務、FCM 中繼只給 iOS」（:55）、「Tailscale 沒有推播通道」（:57）；would flip if 第一條正是「使用者收回『內容可送第三方』的接受」（:58）——現在就是這個情況。決策 2026-10-21-station-remote.md:18 寫三觸發預設關、:22 寫「內容會送到第三方，使用者在 survey 時已接受」、:28 否決自架／Web Push。拔掉後這份決策的 ntfy 部分被取代，應補一筆新決策記錄（或在 :6/:18 旁加一行「已被 2026-10-26 … 取代」），不改寫歷史內文。

**TODO（sonnet）**：station-35「手機實測」、station-41「/m 訂閱按鈕」、station-43「指南補 topic 即密碥」三筆都 `state: done`，是已完成的紀錄，不用改狀態、不用改內容，由新 TODO 反向連結即可。watch 格式見 await-15.md:1-9（label/title/description/state/group/timing: if: …/stamp），`todo.js new --label --title --description --state watch --body [--link --group --timing]`，stamp 對 watch 自動填今天（scripts/todo.js:69）。另外發現 `docs/90-agent/todo/gate-notify-1.md` 是一筆 watch（gate-notify 測試偶發紅）——gate-notify.test.js 刪掉後它失去對象，應一併以移除 commit 的 sha 關掉。

**範圍（sonnet）**：`git grep -c -i ntfy` 命中程式面：assets/station/{mobile 1, remote-card 3, settings-steps 15}、hooks/{gate 1, leave 1}、lib/{mobile 1, notify 1, profile 4}、scripts/{notify 2, task 1}；測試 13 檔；docs/01-guide 4 檔 8 行；reference/station.md:1606、1624-1635、1667，sources.md:119。「notify」命中但**不是**推播、要留下的：assets/station/i18n.js:282（瀏覧器 Notification 按鈕文字）、assets/station/station.js:1975/4889/5518/5557（瀏覽器 Notification API 與 tune toast）、tour-ring.js:1707（demo 文字）、lib/stop.js:5（英文動詞）、scripts/tune.js:357（區域函式 `notify(event, then)`，我自己確認過）。lib/render.js:346、lib/serve.js:69、:157 是提到 `remoteBase`／lib/notify.js 的註解，要改字；`remoteBase` 沒有其他呼叫端（我 grep 過 lib/、scripts/、hooks/）。scripts/uninstall.js:27 GENERATED 列含 `notify-failed.log`，建議留著讓舊安裝清掉殘檔。package.json:3 版本 0.116.0。

**build 現況（sonnet）**：build-7.md:4「設定頁 slider 尚未動工，在等下面的設計決定」、:9「這輪先不寫 code」，抽查屬實；build.md:1 標題「build 收尾」；git status 只有三個已修改檔與未追蹤目錄，無程式差異。

### 要刪、要改的清單

直接刪除（git rm）：
- `lib/notify.js`、`scripts/notify.js`
- `tests/notify.test.js`（11 測）、`tests/notify-end.test.js`（4）、`tests/notify-failed.test.js`（4）、`tests/notify-stage.test.js`（3）、`tests/gate-notify.test.js`（5）——共 27 個測試整檔刪除
- TODO：`gate-notify-1` 以 `todo.js done gate-notify-1 --sha <移除 commit>` 關掉（測試已不存在）

要改（程式）：
- `hooks/gate.js`：刪 :57 require、:189-201 註解＋try 區塊
- `hooks/leave.js`：刪 :31 require、:121-138 註解＋try 區塊
- `scripts/task.js`：刪 :986-997 註解、require 與 try 區塊
- `scripts/station.js`：刪 :60 require、:838-844 settings JSON 的 notify 欄、:913 `body.notify`、:1116 `trigger` 與 :1118-1121 自動產 topic 區塊（:1117 refreshRemote 留）
- `lib/mobile.js`：刪 :151-161 `subscribeOf` 與 :164 的匯出
- `lib/profile.js`：刪 :57-63 五鍵、:428-430 的 notify 分支（parseFlag 條件只留 station.remote；parseUrl／parseTopic 若無其他使用者則一併刪）、:385/:394/:403 註解
- `lib/settingsuggest.js:151` 刪該行（tests/settings-suggest 跟著調）
- `lib/render.js:346`、`lib/serve.js:69`、`:157` 改註解
- `assets/station/settings-steps.js`：刪 :391-398 兩個 step、:319-320 rail 列、:48-49、:179-195 字串
- `assets/station/settings-page.js`：:144 MACHINE 移除 notify.*、:237、:256、:271、:321、:364、:458-460
- `assets/station/settings-detail.js`：15 處 notify.* 參照（:41、:115、:152、:161、:217、:277-281、:318-319、:342-343、:360、:427-428）
- `assets/station/remote-card.js`：:6、:35、:125-131 觸發區與 topic、:153 的 `triggers(...)`
- `assets/station/mobile.js`：:170 註解、:347-350 訂閱連結
- `assets/station/i18n.js` 等語系表裡 `ss.notify*`、`ss.ntfy*`、`rm.ntfy`、`home.sub`、`home.subWeb` 鍵（reader 沒列行號，build 時 grep）

要改（測試，部分修剪）：profile-remote（27 行）、station-remote-card（10）、station-mobile-page（6）、mobile-model（5）、station-remote（6）、station-settings-detail（4）、station-settings-quick（7）、station-settings-steps（2）、station-hdl-k（18，推測是 POST /profile 自動 topic）、station-hdl-g（5）、station-hdl-j（6）、dispatches（5）、usage（3）、settings-suggest（2）、profile-confirm／station-float／station-gate-send／station-mobile-harness-turns／station-mobile-resize 各 1。估計整體少 40–60 個測試（5395 → 約 5340，<1%），tests/ 486 檔 → 481。

要改（文件）：`docs/01-guide/profile.md:51-52`（兩列刪）、`station.md:54,57`、`tailscale-setup.md:49,81`（〈推播〉小節刪）、`what-runs.md:20,42`（gate.js／leave.js 列的 ntfy 字樣）；`docs/90-agent/reference/station.md:1606、1624-1635、1667`（否則 docs-check 會抓到 lib/notify.js 死引用）；`docs/90-agent/reference/sources.md:119` 是報告索引列，保留。新增 `docs/03-decisions/2026-10-26-notify-removed.md`（或在 2026-10-21 決策加一行取代指標）。判決檔與 99-archive 不動。

### 舊 profile 留有 notify.* 時

不寫遷移。載入只走 KEYS（lib/profile.js:455），多出的鍵靜默略過；`unset` 會回 unknown key（:603），所以舊鍵留在機器 profile 裡是惰性資料，不影響任何行為。只在新決策記錄或指南寫一句「舊的 notify.* 鍵可手動刪、留著無害」。沒查到的：profile.write 重寫檔案時是否連帶丟掉未知鍵（兩種結果都無害）。

### watch TODO

`node scripts/todo.js new --label notify --title "通知做回來，不走第三方服務" --state watch --group 通知 --timing "if: 使用者決定要在手機上收 gate／stage／end 通知" --description "ntfy.sh 推播在 <sha> 拔掉；要做回來時不經第三方公開服務" --link docs/03-decisions/2026-10-21-station-remote.md --link docs/90-agent/judgements/2026-10-22-notify-channel.md --body "<要點>"`

body 要點：
1. 拔掉的是什麼：lib/notify.js（detached child POST）、scripts/notify.js、五個 notify.* 鍵、設定頁兩個 step、遠端卡片觸發區、/m 訂閱按鈕；取回用 `git show <移除 commit>^:lib/notify.js`，最後含 notify 的 commit 是 1b548297（2026-10-21）。
2. 三個掛點位置與形狀：hooks/gate.js（emit 前、refuse 後）、hooks/leave.js（結束）、scripts/task.js stage（換站），都是 try/catch 裡不等待的單行；資料只讀機器 profile（ef922175 的理由：clone 下來的 repo 不能把問題送到別台）。
3. 做回來的約束：內容（stage、第一題、任務名、tailnet 主機名 click URL）不得經第三方；候選是 tailnet 內自架 ntfy（Android 走常駐前景服務，見判決 :55）或 station 自推 Web Push（要 VAPID＋service worker；Samsung Internet 支援未驗，判決 :60）；Tailscale 本身沒有推播通道。
4. 歷史：station-35（手機實測）、station-41（訂閱按鈕）、station-43（topic 即密碼）已 done，當時的決策 2026-10-21 與判決 2026-10-22 連結在 --link。

### station-35／41／43 怎麼處理

三筆都已 `state: done`，是歷史紀錄，不改狀態也不改內文；新的 watch TODO 用 body 提到它們即可（todo.js 的 --link 若只收路徑，也可連結三個檔案）。真正要關的是 `gate-notify-1`（watch，對象測試被刪）。

### 排程：等這輪 land 後另開任務

理由：(1) 現在沒有同檔衝突可避——slider 尚未動工、settings-page.js 與 lib/profile.js 沒有未提交差異，而且兩件事在這兩檔的區段不同（slider：profile.js:28、:260-267、settings-page.js questions() :165-243；notify：profile.js:59-63、:428-430、settings-page.js :144、:250-271、:318-324、:361-368、:447-466，只有 :237 同在 questions()），所以「併入靠先後順序避衝突」解決的是不存在的問題。(2) 這一任務的題目是「station 與 notification 展開面板」——這裡的 notification 是鈴鐺面板 .fkp，不是 ntfy——已走到 build-7、6 次 verify、「build 收尾」；拔 ntfy 動到 hooks、scripts、lib、assets、約 20 個測試檔與 7 份文件，整個 verify 要重做，還要補決策記錄，不是收尾能吞的量。(3) 記憶裡的規則是每個變更各自 bump、各自 commit；slider（minor）與移除（minor）各自 0.117、0.118 比較乾淨。(4) 使用者的「先」讀作「先拔、之後再做回來」，不是「在 slider 之前」；若使用者確實要「這輪就拔」，可行的順序是：在 slider 動工前先做一輪獨立 commit 的 notify 移除，再做 slider——但 verify 要全套重跑。

### 拿掉後會不會壞別的功能

不會。三個 hook 的 fire 都在 try/catch 裡、回傳值丟棄；/m 前端對 `m.notify` 有守門（assets/station/mobile.js:349）、遠端卡片對 `S.notify` 有 `|| {}`（remote-card.js:153），server 端先拿掉也不會讓舊前端報錯。`remoteBase` 只被 notify 自己呼叫、其他檔只在註解提到。`lib/settingsuggest.js:151` 拿掉只少一條建議規則。`scripts/uninstall.js:27` 的 `notify-failed.log` 清理建議保留一版，讓先前實測過的機器清掉殘檔。沒看到的風險：部分命中的 station-hdl-k 等測試檔內容，與 configDir 下機器 profile 是否留有 notify.topic（兩者都只影響測試修剪量與惰性資料，不影響功能）。
