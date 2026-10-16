---
judged: 2026-10-16T07:13:00.939Z
model: fable
agent: fankeel-judge
task: "調整 station mockup"
session: 9cf97941-93c8-4fcb-9cf2-8ef92f52eff5
stage: design
---

# Brief: Pane 要不要顯示所有 background task，網頁服務能不能自動出現打開的 Button

## Question

# Brief: Pane 要不要顯示所有 background task，網頁服務能不能自動出現打開的 Button

## 問題

使用者原話：「右邊 除了 派出的 AGENT 要不要順便顯示 所有 BACKGROUND TASK 然後如果是 網頁服務 可以自動顯示 BUTTON 打開嗎? 還是這個有難度?」

fankeel 的 Pane 是 Claude Code mod（`hooks/pane.ts` 的 `ui.render` hook，`component: 'Pane'`）。現在的子代理樹從 Claude Code 自己的檔案 `<configDir>/projects/<slug>/<session>/subagents/agent-<id>.jsonl` 與 `.meta.json` 讀（`hooks/pane.ts` 的 `agentsOf`、`hooks/pane-agents.ts`），每一列有狀態、模型、effort、分鐘與 token。頁尾已有一個 `Button` 打開 station 網頁（`hooks/pane.ts` 的 `openStation`，Windows 用 `cmd /c start`，`$.process.run`），網址只接受 `^http://127.0.0.1:\d{1,5}/?$`（`STATION_URL`）。

要回答：

1. **資料從哪裡來**：mod 能不能拿到這個 session 所有 background task（shell `run_in_background`、Monitor、Workflow、背景子代理）的清單與狀態？已知線索：型別檔 `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code/index.d.ts:742` 有 `BackgroundTaskSummary`（id、type 'shell'|'subagent'|'monitor'|'workflow'、status、description、command），出現在 `:11575` 與 `:11705` 附近的 hook input（看起來是 Stop / SubagentStop 這類 command hook 的 `background_tasks`）。這份型別檔是 10-03 的版本，可能舊了；請查它是否只給 command hook、mod 引擎（`on(...)` 事件、`$` API）有沒有對應的事件或 API，或要從磁碟讀（session 目錄下有 `subagents/`、`tool-results/`、`workflows/`；背景 shell 的輸出在 `%TEMP%/claude/<slug>/<session>/tasks/<id>.output`）。
2. **網頁服務的判斷**：一個背景 shell 是不是網頁服務，能不能可靠地判斷（command 字樣如 `serve`/`dev`/`--port`、輸出裡的 `http://127.0.0.1:<port>` 或 `localhost:<port>`、實際探 port）？哪一種不會誤報、不會掃太多檔？
3. **打開的 Button**：沿用 `openStation` 的做法開任意 localhost 網址，安全上要守什麼（只放 127.0.0.1/localhost、只放 http、port 範圍）？Desktop 的 Pane 與終端各自能不能點。
4. **值不值得**：Pane 已經很擠（route、撞檔、tasks、agents、notes、頁尾；今天剛拿掉 context 區塊、tasks 過十個改長條）。背景 task 一多會不會淹掉 agents？建議放哪、怎麼裁。

## 選項

- A：做。Pane 的 agents 區塊改成「背景工作」，子代理與 shell/monitor/workflow 一起列，網頁服務那一列有「開」的 Button。
- B：只做網頁服務：不列所有背景 task，只在偵測到 localhost 網頁服務時，在頁尾 station 按鈕旁多出一顆該服務的 Button。
- C：不做或延後：資料來源不可靠（例如 mod 拿不到、只有磁碟猜測），記成 TODO 等引擎給 API。

## 什麼算答案

選一個（或修改過的）選項，並給：資料來源的確切位置（型別或檔案路徑:行）、網頁服務的判斷規則、安全限制、Pane 上放哪一塊與裁切規則、做的話大概幾個檔與最大的不確定。

## 回答的形狀

第一行是選的選項與一句理由，然後依 1–4 各一小段，最後一行列出你沒能查證的東西。繁體中文。

## Answer

pick: B（修改版）：只做「網頁服務按鈕」。引擎給 mod 的背景清單只在 turn 結束那一刻（`classic.Stop`／`classic.SubagentStop` 的 `e.background_tasks`），中間 monitor／workflow 的狀態沒有任何檔或 API 可追，整列會半舊半新；而「shell 輸出裡印了 http://127.0.0.1:port」這個訊號可靠又便宜，值得做。
why: 1 資料來源：型別沒舊——現行 F:/ymlab/fankeel/.claude-plugin/types/claude-code/index.d.ts:799–830 `BackgroundTaskSummary`（id/type/status/description/command），只掛在 :12135 `StopHookInput` 與 :12265 `SubagentStopHookInput`；但 :1236–1259 說 hooks module 可 `on('classic.Stop' | 'classic.SubagentStop', …)` 收到整份 stdin 輸入，所以 mod 拿得到，只是每 turn 末一次快照、沒有 `$.tasks.list()` 之類可每 tick 問的 API（`$.agent.list()` :125 只有 subagent/teammate，「a workflow's are not」）。起點另可在 `on('tool.call',{tool:'Bash'})` 的 `next(e)` 結果取 `backgroundTaskId`（claude-code-tools/index.d.ts:203–204 `run_in_background`、:4399–4400；Monitor :4830–4832 `taskId`、Workflow :5511–5513 `taskId`）。磁碟：C:/Users/user/AppData/Local/Temp/claude/<slug>/<session>/tasks/<id>.output（本 session 實測：shell 結尾是 `[exited with code 0]` 或 `[killed]`、b 開頭 id；a 開頭是 subagent 轉錄的硬連結、wf 的 .output 也在），<configDir>/projects/<slug>/<session>/workflows/wf_*.json 只有 runId/taskId/script 沒看到狀態欄，monitor 沒有檔；tool-results/ 是大型工具回傳的溢出檔，與狀態無關。
why: 2 判斷規則：只認輸出檔裡的 `https?://(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1?\]):(\d{2,5})`（取第一個，0.0.0.0／[::] 正規化成 127.0.0.1；192.168.x 的 Network 行不收），且該 id 仍在跑（輸出尾沒有 `[exited with code`／`[killed]`，且最近一次 Stop 快照仍列它或它在快照後才起）。命令字樣（serve/dev/--port）不當觸發——`npm run dev` 可能是 watcher、`serve` 會出現在路徑；不探 port——`$.http.fetch`（:3476–3497）受 web-fetch policy 管、對未知本機服務發 GET 有副作用、也分不出是哪個 task 的。讀檔量：只讀 `tool.call`／快照給的 shell id，stamp 變才重讀，找到 URL 後就不再讀，超過 256 KiB 不讀（dev server 的 URL 都在前幾 KB）。
why: 3 Button：沿用 hooks/pane.ts:347–364 `openStation` 泛化成 `openUrl`，白名單把 :324 `STATION_URL` 放寬為 `^http://(127\.0\.0\.1|localhost):\d{1,5}/?$`——不放 path／query／fragment／userinfo，因為 `$.process.run` 雖無 shell，`cmd /c start "" url` 本身是 shell，`&|^%"` 會逃出；port 數字 1–65535，https 不放（本機 dev 憑證會跳警告，且 serve.json 慣例是 http）。終端用 hotkey `o`（`s` 已給 station）與焦點 Enter，Desktop 原生按鈕；Desktop 下 `$.process.run` 標「CLI only」與 station 同樣未證實。
why: 4 放哪、怎麼裁：放 foot（pane-status.ts:336 `DROP` 永不丟）的 station 列（:281–285）上面，一列一個服務：`[開] http://127.0.0.1:5173 · <command 前 N 字> · 3 分`，最多 2 列、新的在前，第 3 個起不畫；station 列已佔滿 41 欄，兩顆鈕擠同一列放不下。不把 shell/monitor/workflow 併進 agents 區塊：agents 從磁碟讀有 model/effort/token，`BackgroundTaskSummary` 沒有，併了只會重複或變薄；非網頁 shell 不列（要的話同一來源可加「背景 shell N 個」計數到 agents 標題列）。做的話約 5 檔：hooks/pane.ts（兩個 classic hook＋tool.call 包裝、`servesOf`、`openUrl`、Seen.serves）、hooks/pane-status.ts（Seg.press 帶 url、foot 多列）、新 hooks/pane-serve.ts（純函式：URL 正則、尾標記、裁切）＋tests/pane-serve.test.js、tests/pane.test.js／pane-status.test.js 補案例。最大不確定：hooks module 的 `classic.Stop` 是否真的帶 `background_tasks`（型別是可選欄位，說明是寫給 command hook 的）。
would flip if: 引擎給了每 tick 可問的背景清單 API（或 `background_tasks` 出現在 `ui.render`／`$.session.*`）→ 改 A，整列成本變低；若 module 的 `classic.Stop` 不帶 `background_tasks` 且 `tool.call` 結果拿不到 `backgroundTaskId` → 改 C 記 TODO。
unread: nothing（未證實：module 收到的 `classic.Stop` 實際 payload；非 Windows 的 tasks 目錄路徑（推測 `$TMPDIR`／`/tmp/claude/<slug>/<session>/tasks`）；Desktop 上 `$.process.run` 能否開瀏覽器；monitor 在磁碟上是否真的無任何檔）。
