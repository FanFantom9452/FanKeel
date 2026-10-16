---
status: design-intent
---

# TODO 全表盤點（10-16）：路線圓點不呼吸、Pane 子代理樹、四條偶發測試 — Design

這次盤點做三件事，都是使用者在 survey 的關卡之後定的。圓點與子代理樹都改 `hooks/pane-svg.ts`、`hooks/pane.ts`，所以留在同一個任務、依序做，不分兩個 session。需要 Desktop 真機的條目（brief-3、compact-4、compact-6、pane-1、pane-7）與「接縫 profile 中途翻轉」這次不動。

class 沿用 patrol 的路線 `survey,plan,build,verify,land`；路線上沒有 design 站，所以這份 design 由 plan 站寫，在 plan 的關卡一起核准。

## 1. 路線圓點不呼吸

使用者原話：「不要有呼吸動畫，那個點點還沒走到的改為灰色，正在跑的是空心但是有邊框顏色」。

- band 第一列（`bandRow1Svg`）的路線圓點：走過的站維持實心、站色，`r="3.5"`；目前這一站只畫一個空心圈，`r="5"`、`fill="none"`、`stroke` 是該站的顏色、`stroke-width="2"`，不再有中間的實心點；還沒到的站是灰色空心圈，`r="3.25"`、`stroke` 是 `TODO`（`#767676`）。
- Pane 的路線（`routeSvg`）：目前這一站從灰色雙圈改成單一空心圈，`r="6"`、`stroke` 是該站的 `stageColor`、`stroke-width="2.5"`；走過與還沒到的站不變（已經是 `DONE` 實心與 `TODO` 空心）。
- 擴散圈整個拿掉：`ring()`、`BREATH`、`breathing()` 從 `hooks/pane-svg.ts` 刪除，band 與 Pane 都不再以 `isInteractive` 畫路線。
- tasks 格子的 `.live` 外框脈動（`fk-pulse`）也拿掉：使用者說不要呼吸動畫，這是同一類。格子的 hover 外框保留，所以 tasks 的 Svg 仍是 `isInteractive`。
- 「Desktop 看路線圓點呼吸」條目因此不必再看，land 站以 `todo.js done` 關掉，理由寫「使用者決定不要呼吸動畫，圈已移除」。

## 2. Pane 子代理樹

使用者原話：「AGENT 底下像是 TREE 一樣，那些正在跑的，那些跑完的……他是使用哪個 MODEL、哪個 EFFORT 程度，TITLE 要優先抓下來」。

資料都在 Claude Code 自己寫的檔裡，本 session 量過（2.1.295）：`<configDir>/projects/<slug>/<session>/subagents/agent-<id>.meta.json` 帶 `agentType`、`description`（`hooks/title.js` 已在前面加上 `sonnet 5.5 · medium: `）、`spawnDepth`、`parentAgentId`；`agent-<id>.prefix.json` 在子代理第一次呼叫後出現，`state.model` 是實際的 model id（`claude-sonnet-5-5`）、`state.effortValue` 是實際的 effort。SubagentStart 跑的時候 meta 還不存在（docs/90-agent/reports/2026-09-28-spawndepth-timing.md），所以讀取在 mod 這邊，每次刷新時做。

- 新檔 `hooks/pane-agents.ts`，純函式：`agentTree(files, ended, since)` 把 meta／prefix 組成樹，`modelAlias(id)` 把 `claude-sonnet-5-5` 寫成 `sonnet 5.5`。
- title 是 `description` 去掉 title hook 的前綴；model 依序取 `prefix.state.model`、前綴裡的 model、`meta.model`，都沒有是 `?`；effort 依序取 `prefix.state.effortValue`、前綴裡的 effort，都沒有是 `?`。
- 只列這個任務開始（`entry.started`）之後的子代理，以 meta 檔的 `mtimeMs` 當它的出發時間。
- 「跑完」由新的 SubagentStop hook `hooks/agent-end.js` 記：寫 `.fankeel/build/agents-<session>.json` 的 `ended[agentId] = Date.now()`；同一支 hook 也掛在 SubagentStart，把同一個 id 從 `ended` 拿掉（`hooks/brief.js` 不動），所以被 SendMessage 叫回來的子代理會回到「在跑」。這個 hook 不碰 registry 的 `inflight`，所以 docs/90-agent/reference/subagents.md 不加 SubagentStop 的理由（清錯 mark 會讓 controller 多派一個）不受影響。
- `hooks/pane-status.ts` 的 `statusRows` 多一個 `agents` block，放在 `tasks` 之後：標題列 `agents  N 在跑 · M 完成`；每個子代理一列，在跑的是 `○`（`OUT` 色，空心）、跑完的是 `●`（`DONE` 色），後面是 title，再後面是 ` · <model> · <effort> · <分> 分`；子代理底下的子代理縮排並以 `└`／`├` 開頭。在跑的排前面，其餘新的在前；最上層最多 6 個，各自最多 3 個子節點，多出來的收成一列 `還有 N 個`。
- 列不夠時 `agents` 在 `notes` 之後放棄，只留標題列，和 `tasks` 一樣。
- 標題之後的動態更新（子代理改名）使用者說「後續再看看」，這次不做。

## 3. 四條偶發測試

這次在 0.111.7（53953e18）安靜的機器上把整套跑了三次並存檔（`.fankeel/build/task-20261016T025752/flaky-run-*.txt`），四條都沒有重現。量到的耗時：reviewcheck「the three tables」約 24.5 秒、station-cli「the first run scans once」約 9.8 秒、inject「a file dirty before the task started」約 14 秒、task-worktree「without the key」約 19 秒。四次紅燈都發生在並行負載下，而 0.111.7 的 suite.js 已經讓一台機器同時只跑一套。

- station-cli 首掃那條會紅的是 `tests/station-cli.test.js:312` 的 `assert.ok(elapsed1 < 9000, …)`，不是 20 秒的 `timeout`：10-14 量到那一條跑 13.5 秒，沒有碰到 20 秒。`elapsed1` 從 spawn 算起，含 node 自己的啟動，而 `AUTO_BUDGET_MS` 只管掃描；機器忙時啟動變慢，掃描沒有超過預算也會紅。改成在首掃前先計時一次 `node -e ""`，斷言 `elapsed1 - idle < 9000`；9000 這個字面值不動，所以預算移到十秒以上仍然抓得到。兩個 `timeout: 20000` 不動。
- reviewcheck、inject、task-worktree 三條測試本身沒有時間上限，沒有失敗輸出就沒有可修的東西：三個條目改成 watch，併入「整套再紅一次」那一組（`if: 整套測試再出現一次重跑不見的失敗`），本文寫下這次三輪的證據與耗時。
- 「station-cli 首掃偶發失敗」在扣掉啟動時間後由 land 關掉；「station-cli 測試偶爾逾時」那條 watch 條目補一段 10-16 的證據，候選原因改成 `elapsed1 < 9000` 含 node 啟動。
- blocked 條目由 survey 標了 restamp 的，在 land 站以今天重蓋 stamp，不在 build 的 task 裡。

## 4. Pane 常駐的 station 按鈕

使用者在 plan 的關卡選「先把 station 按鈕加進來」；做法依判官的答案 [judgements/2026-10-16-pane-station-link.md](../judgements/2026-10-16-pane-station-link.md)（verdict B）。

- station 是 Pane 的 `foot` block 的最後一列，在 `<session> · /fankeel-panel 關閉` 之下；`foot` 不在 `DROP` 裡，所以永遠不放棄，也不多一個 block、不多一條空白列。沒有任務時，`empty` 那兩列之後也有同一列。station 開始或停止時 Pane 立刻重畫：網址在重畫的 key 裡。
- `<configDir>/fankeel/serve.json` 有 `url`、且是 `http://127.0.0.1:<port>/` 的形狀時，這一列是一個 `Button`（label `開啟 station`、hotkey `s`）加上完整網址；沒有紀錄或形狀不對時是一列灰字 `station 未啟動`，沒有按鈕。網址不合形狀就不畫按鈕，因為按下去會把它交給 `cmd /c start`。 Pane 41 欄寬時完整網址放得下；更窄時網址從尾端截斷。
- 按下去：Windows（`OS` 是 `Windows_NT`）跑 `$.process.run(['cmd', '/c', 'start', '', url])`，其他系統依序試 `open`、`xdg-open`；都失敗時 `$.ui.copy` 複製網址。
- configDir：entry 記的 `configDir`，沒有 entry 時 `CLAUDE_CONFIG_DIR`，再沒有是 `HOME`／`USERPROFILE` 下的 `.claude`。
- 判官建議的 `$.http.fetch` 健康探測這次不做：一筆硬殺留下的舊紀錄會畫出按不開的按鈕，按下去由瀏覽器說連不上。

## What proves it done

| test | how |
|---|---|
| band 目前站是單一空心站色圈 | `tests/pane-svg.test.js` 的 `dots()` 讀出 `{ state: 'here', colour: RAMP.plan }`，且目前站沒有 `r="3.5"` 的實心點；還沒到的站 `stroke` 都是 `#767676`。 |
| 沒有任何呼吸動畫 | `bandRow1Svg`、`routeSvg`、`tasksSvg` 的輸出都不含 `<animate`、`fk-br`、`fk-pulse`；`hooks/pane-svg.ts` 不再 export `breathing`。 |
| Pane 目前站是站色空心圈 | `routeSvg` 在 build 站輸出含 `r="6" fill="none" stroke="<RAMP.build>"`。 |
| 子代理樹 | `tests/pane-agents.test.js`：兩個 meta（一個 brain、一個 `parentAgentId` 指向它的 reader），一個 prefix，`ended` 標了 reader；`agentTree` 回一個根、一個子節點，根的 model 取自 prefix、子節點取自標題前綴，子節點 `end` 有值；`statusRows` 帶 `agents` 時畫出 `agents  1 在跑 · 1 完成` 與 `└ ●` 那一列。 |
| station 按鈕 | `tests/pane-status.test.js`：`station` 給 `http://127.0.0.1:28888/` 時 station 列是 `{ text: "開啟 station", press: "station" }` 加網址，沒給時是灰字；`tests/pane.test.js`：fake 的 `serve.json` 在時 Pane 有一個 label 為 `開啟 station` 的 Button，按下去 `$.process.run` 收到 `["cmd", "/c", "start", "", url]`；`url` 是 `https://example.com/` 時沒有 Button。 |
| hook 的數目寫成十三 | `tests/contract.test.js` 的「the pages that count the hooks」綠：`docs/01-guide/development.md` 寫 all thirteen、The other seven。 |
| SubagentStop 記下跑完 | `tests/agent-end.test.js`：對有 active entry 的 session 餵 SubagentStop payload，`.fankeel/build/agents-<sid>.json` 的 `ended` 有那個 id；再餵同一個 id 的 SubagentStart 後它不在了；manifest 的兩個事件都掛著 `hooks/agent-end.js`。 |
| station-cli 扣掉 node 啟動 | `grep -n "elapsed1 - idle < 9000" tests/station-cli.test.js` 一行；該檔單跑全過。 |
| 三條偶發測試轉 watch | `node scripts/todo-check.js` 綠；三個條目的 `state: watch`、`group: 整套再紅一次`。 |

## Files

| file | change |
|---|---|
| `hooks/pane-svg.ts` | 圓點新樣式，刪 `ring`／`BREATH`／`breathing`／`fk-pulse` |
| `hooks/pane.ts` | band 不再 `isInteractive`；讀 subagents 與 `agents-<sid>.json`，傳給 `statusRows` |
| `tests/pane-svg.test.js` | 圓點與呼吸相關的測試改寫 |
| `hooks/pane-agents.ts` | 新檔，`agentTree`、`modelAlias` |
| `hooks/pane-status.ts` | `agents` block |
| `tests/pane-agents.test.js` | 新檔 |
| `lib/agentends.js` | 新檔，`markEnded`、`clearEnded` |
| `hooks/agent-end.js` | 新檔，SubagentStop 記、SubagentStart 清 |
| `.claude-plugin/plugin.json` | SubagentStop 與 SubagentStart 都掛 `agent-end.js` |
| `tests/agent-end.test.js` | 新檔 |
| `docs/01-guide/development.md` | hook 數目十三 |
| `tests/hook.test.js` | hook 數目十三 |
| `tests/contract.test.js` | `WORDS` 加 `thirteen` |
| `tests/station-cli.test.js` | 首掃讀數扣掉 node 啟動 |
| `docs/90-agent/todo/flaky-1.md` | 轉 watch，補證據 |
| `docs/90-agent/todo/flaky-3.md` | 轉 watch，補證據 |
| `docs/90-agent/todo/flaky-4.md` | 轉 watch，補證據 |
| `docs/90-agent/todo/test-1.md` | 補 10-16 證據與新候選 |

## Unverified

- `$.process.run` 在 d.ts 標「CLI only」：Claude Desktop 底下的引擎能不能開本機瀏覽器，要在真機按一次才知道；終端在非 fullscreen 時滑鼠點 Button 會不會回報也沒寫，hotkey `s` 是保底。

- SubagentStop 在背景子代理結束時會不會觸發、payload 有沒有 `agent_id`，這台機器還沒量過，而這個 session 的 hook 清單在它開始時就讀定了，新 hook 在這裡不會跑；要在新 session 派一個子代理才看得到，verify 站把它列成使用者的一項。
- mod 的 `$.fs` 能不能列 `<configDir>/projects`：`remoteOf` 已經讀 `<configDir>/sessions`，同一個根，推定可以；Task 4 在真機上看 Pane 才能證實。
