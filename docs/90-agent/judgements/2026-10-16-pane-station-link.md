---
judged: 2026-10-16T03:29:01.665Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 9e59e535-7d50-4ff5-a017-bb2638612fb8
stage: plan
---

# Brief: Pane 上能不能放常駐、可點、打開 station 網頁的元件，並顯示完整網址

## Question

# Brief: Pane 上能不能放常駐、可點、打開 station 網頁的元件，並顯示完整網址

## 問題

使用者原話：「PANE 上面可以做可點的互動事件嗎？可以常駐 CLICK 後打開 STATION 網頁的功能嗎？同時顯示 STATION URL + PORT 完整網址位置」。

fankeel 的 Pane 是一個 Claude Code mod（`hooks/pane.ts` 的 `ui.render` hook，`component: 'Pane'`），在終端畫文字列，在 Claude Desktop 把部分 block 畫成 `Svg`。要回答的是：

1. mod 的 UI 有沒有可點的元件（`Button`、`Link`、`onPress`、`ui.press`），在 Claude Desktop 的 Pane 與終端各自能不能點。
2. 點了以後能不能打開瀏覽器到 station 網址：是 `Link` 直接開、還是 `onPress` 裡呼叫某個 `$` API（例如 `$.ui.copy` 只複製），還是兩者都不行只能顯示網址。
3. 網址從哪裡讀：station 的 `serve.json`（`lib/serve.js:5,23`：`<configDir>/fankeel/serve.json`，`scripts/station.js:12` 預設 port `28888`）。mod 能不能用 `$.fs.read` 讀到它，網址該怎麼組（host、port、path）。
4. 「常駐」：放在 Pane 的哪一個 block（例如永遠不會被放棄的 `foot` block，`hooks/pane-status.ts` 的 `DROP`／`statusRows`），在 Desktop 是以文字列還是 Svg 畫——Svg（`isInteractive`）裡的東西能不能點。

## 選項

- A：`Link` 元件，`href` 是 station 網址，文字就是完整網址；終端與 Desktop 都畫。
- B：`Button` + `onPress` 打開網址（若有能開瀏覽器的 API），另一列顯示完整網址。
- C：只顯示完整網址，點擊改為複製（`$.ui.copy`），因為 mod 開不了瀏覽器。
- D：其他，判官依 API 實際提供的能力說。

## 要讀的檔

- `.claude-plugin/types/claude-code/index.d.ts` — mod API 型別；`Button` 約 1064–1167 行、`$.ui.open`／`$.ui.copy` 約 2499–2576 行、`Link`／`LinkProps` 約 3805–3860 行，`grep -n "LinkProps\|interface ButtonProps\|ui.press\|onPress"` 找全
- `hooks/pane.ts` — Pane 的 `ui.render`（檔尾）、`readJson`、`remoteOf` 讀 `<configDir>` 的寫法
- `hooks/pane-status.ts` — `statusRows`、`foot` block、`DROP`
- `hooks/pane-svg.ts` — `paneParts`：哪些 block 畫成 Svg、`isInteractive` 的用途
- `lib/serve.js` — `serve.json` 的欄位（url、port、pid）
- `scripts/station.js` 檔頭 — port 規則

## 什麼算答案

一個選項（A／B／C／D），附：用哪個元件與 API（名字照 d.ts）、在終端與 Desktop 各自的行為、網址從 `serve.json` 哪個欄位組、放在哪個 block、station 沒在跑時顯示什麼。凡是 d.ts 沒寫、要在真機上才知道的，標「未證實」。

## 回答的形狀

```
verdict: A | B | C | D
why: 一到三句，引 d.ts 的行號
how: 元件、API、block、網址來源，條列
terminal: 一句
desktop: 一句
unverified: 條列，或 none
```

## Answer

verdict: B
why: Button 在終端與 Desktop 都可按（d.ts:1059–1064：click／hotkey／焦點 Enter 都 raise `ui.press` 到 `onPress`），而開瀏覽器的 API 是 `$.process.run`（d.ts:3505–3522，host 上跑 argv、無 shell）。A 不行：Desktop 是 remote surface（d.ts:10377–10388），`Link` 的 `href` 不是 `https:` 就畫成純文字（d.ts:5654–5656），station 是 `http://127.0.0.1:…`。C 不行：`$.ui.copy` 在 remote surface「has no path yet」（d.ts:2571，結果 `no-clipboard` 13744–13749）——只能當終端的退路。
how:
- 元件：`Button`（`key: 'station'`, `label: '開啟 station'`, `hotkey: 's'`）＋同列 `Text` 畫完整網址；`onPress: async press => { try { await $.process.run(opener(url)) } catch { await $.ui.copy({ text: url, surface: press.surface }) } }`，opener 依 `$.env.get('OS')==='Windows_NT'` 選 `['cmd','/c','start','',url]`，否則 `['open',url]`／`['xdg-open',url]`。
- 網址：`$.fs.read(\`${configDir}/fankeel/serve.json\`)`（絕對路徑可讀，d.ts:3226,3239）直接取 `url` 欄位——已是 `http://127.0.0.1:<port>/`（station.js:746,771；serve.js:6 的 `{ pid, port, url, started }`），不必自己組；`port` 另一欄位可單獨顯示。configDir 照 pane.ts:182–183 的 `entry.configDir`→`HOME/USERPROFILE/.claude`，但「常駐」沒有 entry 時也要畫，所以要補 `$.env.get('CLAUDE_CONFIG_DIR')` 優先；在 tick 以 `$.fs.stat` stamp 變了才重讀。
- block：`foot`（pane-status.ts:318 `DROP=['notes','tasks']`，foot 永不丟；pane-svg.ts:494,536 在 Desktop 仍是 Text rows 不是 Svg，所以能塞元素），加一列在 `<id> · /fankeel-panel 關閉` 之前；`!entry` 分支（pane-status.ts:324–328）也要加同一列才算常駐。做法：`Seg` 加選用 `press?: 'station'`，pane.ts `piece()` 遇到它畫 `Button`，其餘仍 `Text`，pane-status 保持純函式可測。
- station 沒在跑：無 serve.json → 一列 dim `station 未啟動 · /fankeel 會啟動`，不畫 Button；有紀錄 → 每 ~5 秒（不是每 250ms tick）`$.http.fetch(url + 'station/health')`（d.ts:3476–3497）探一次，200 才畫 Button，否則網址 dim 加 `沒回應`（硬殺留下的舊紀錄，serve.js:7–9；mod 沒有 pid 檢查，只能靠探）。
- Svg 內不能點：`isInteractive` 只開 hover／SMIL／tooltip，事件屬性被剝、無 allow-scripts，「presses go on an enclosing element」（d.ts:12299–12306）。
terminal: Button 畫成 `[ 開啟 station ]`（hotkey／焦點 Enter 一定可按，滑鼠點只在 fullscreen terminal 回報），網址以 Text 畫；失敗退路 `$.ui.copy`（終端走 `/copy`／OSC 52，d.ts:2571,13730–13735）。
desktop: Button 畫成原生按鈕放在 foot 的 Text 列裡，網址以 Text 畫（`Link` http 會變純文字）；`onPress` 的 `$.process.run` 在 Desktop 引擎上開瀏覽器，失敗時 copy 也會 `no-clipboard`，只剩看網址手抄。
unverified:
- `$.process.run` 標「CLI only」（d.ts:3500）：Claude Desktop 底下的引擎算不算 CLI、能不能開本機瀏覽器，要真機試。
- 終端非 fullscreen 時滑鼠點 Button 是否回報（d.ts:5728–5729, 7932 只提 fullscreen）；hotkey 是保底。
- `$.http.fetch` 對 127.0.0.1 是否被 web-fetch policy 擋（d.ts:3481–3482）。
- 若 Desktop 的 process.run 被拒，備案是 `Markdown` 的 http 連結（d.ts:5717 允許 `http:`；9604 無 press 時由 surface 自己開）——Desktop 會不會真的開 localhost 沒寫。
- 終端 `Link`（OSC 8）ctrl+click 能否開，是終端自己的事（d.ts:5656），Windows Terminal 未測。
