---
status: design-intent
last_verified: 2026-10-28
---

# station.js 拆到只剩殼 — design

TODO：station 留 vanilla、拆完模組（`docs/90-agent/todo/station-52.md`），只剩標準 (b)：
`assets/station/station.js` 約 1,500 行以內、只留殼。決策：
[2026-10-24-station-vanilla-modules.md](../../03-decisions/2026-10-24-station-vanilla-modules.md)
——classic script、`window.FK_*`、零依賴、無 build。本設計不換技術，只搬。

## 做法

純畫字串的區塊整段搬成新的 `FK_*` 模組；殼留下會被重新賦值的狀態、`draw`、`VIEWS`、
事件監聽、`freshen`/`refresh`。死碼直接刪。

### 模組取依賴的方式

模組只匯出 `make(K)`。station.js 在原位置留惰性取得器，第一次呼叫才把它要的 helper
裝進 `K` 去 `make`，再為每個仍被外面用到的名字留一行 hoisted 轉發函式——所以
`module.exports` 與 `FK_KIT` 不用改。不讀 `w.FK_KIT`：`require` 下 station.js 的 `w` 是 `{}`、
模組的 `w` 是 `null`，讀不到。會被重新賦值的 `S`、`route`、`NOW` 等走 K 的 getter
（同 `daysCtx`，station.js:4256）；`view` 傳參考，原地改。

### `require` 下的測試

33 個測試檔直接 `require('../assets/station/station.js')`，此時沒有 index.html，模組不在 `w` 上。
station.js 在 module.exports 區塊前用
`var FMT = w.FK_FMT || (typeof require === 'function' ? require('./fmt.js') : null)`
取回模組，export 名稱一個不少，測試檔不改。每個新模組尾端照 days-page.js:217 的 CJS guard。

### 搬移清單（行號為 fd6b28be）

| 新模組 | 來源 | 約行數 | 狀態 |
|---|---|---|---|
| `fmt.js` FK_FMT | 200-803 的 model/kind 常數、localDay…windowTotals；comma cents dur estMark totalSuffix niceStep downsample | 350 | 純 |
| `records.js` FK_RECORD | recLabel…listAskRow、keelGlyph keelProgress keelStage | 150 | 純 |
| `gate-tab.js` FK_GATEVIEW | 3415-3636 | 220 | 純，ctx 10 個名字 |
| `detail-html.js` FK_DETAIL | 2899-3415 的純函式（ctxSection…tasksHtml、plan*Html） | 400 | 純；needDetail/DETAIL/planTab/planListen 留殼 |
| `dispatch-table.js` FK_DISPATCH | 3672-4237（派工表、replay、todo 標記） | 560 | 純 |
| `chart.js` FK_CHART | dayBars…segTip、roHtml kpiHtml、dashHead…dashModels | 600 | 純 |
| `session-body.js` FK_SBODY | 877-1430 timeline/cost/talk、liveTag railHtml | 550 | 純；sessionPage 留殼 |
| `nav.js` FK_NAV | 左欄 nav、icon（也進 FK_KIT）、jump、search 4973-5116 | 500 | 自掛監聽 |
| `float.js` FK_FLOAT | 1822-1981 tune/float/pendingGate、drawFloat、gate POST 5248-5327 | 450 | 有狀態，ctx getter |
| `list-page.js` FK_LISTPAGE | list 頁、pickOpen/pickQ/pickLast 與其 handler | 350 | 有狀態 |
| `health.js` FK_HEALTH | reload、健康輪詢 5454-5527、語言 chrome 5125-5185 | 200 | 有狀態 |

### 刪掉的死碼

只有測試與 export 用到、畫面已改由模組畫的：`nowHtml` 一串（liveRail…liveIdle、liveSubsHtml）、
804-876 的 project helpers（projectsHtml recentHtml projectHead sessionPoints projectChart
projectSessionsHtml）。連同只測它們的斷言一起刪——這是唯一會改測試的地方，gate 上要點頭。

### 順序

純的先（fmt → records → gate-tab → detail → dispatch → chart → session-body），有狀態的後
（nav → float → list → health）。每步 `npm test` 綠才下一步；每步都寫 station.js，所以全部串行。

### 行數預估（2026-10-28，a483fe04）

計畫 1 落地後 station.js 4,966 行。計畫 2–6 列的 212 個名字都還在檔內、沒有重複；以括號配對估它們的範圍，搬完約剩 **2,221 行**，還沒算轉發與取得器。剩下的大約是 786 行沒列進任何計畫的函式（`draw`、`sessionPage`、`refresh`…）、537 行監聽與 `setInterval` 的本體——計畫的 Global Constraints 把載入時執行的敘述全留在殼——其餘是 `var`、註解與空行。

所以 1,500 行在這套規則下到不了。決定（design gate，2026-10-28）：計畫 2–6 照跑，監聽留在殼；[2026-10-28-station-shell-7.md](2026-10-28-station-shell-7.md) 先刪 nav.js 的舊 live 死碼，再把實測行數往上取到 50 的倍數定為上限。station-52 的 (b) 改成「只剩外殼，行數由測試鎖住」。

## 驗收

- `tests/station-shell-size.test.js`（新）：station.js ≤ CAP，CAP 是七份計畫落地後的實測值往上取到 50 的倍數。現在 4,966 行，會紅。
- `npm test` 全綠；33 個 `require` 測試與 50 個 vm 測試除死碼斷言外不改。
- 產物：served station 每個 `VIEWS` 路由（days docs weekly tour list settings now live sessions cmp projects project session）畫出來的 DOM，搬前搬後逐路由相同、console 0 error——fankeel-render-reviewer 拍。
- `docs/90-agent/reference/station.md:616-618` 的模組清單改成新清單。

## 沒驗證

模組在**載入時**有沒有任何一處讀 `FK_KIT`——有的話排在 station.js 前面會拿到空的。只在 fmt.js 第一步跑測試時才知道。
