---
status: current
last_verified: 2026-10-05
---

# UserPromptSubmit 注入各段耗時（2026-10-05）

## 結論

五秒逾時沒有在本機重現：四個情境、各跑五次，牆鐘最長的是 `/fankeel`（station 在跑）約 2.0 秒。最慢的一段是 `call lib/station.js write`，中位數 1756.3ms、最大 1861.8ms（`fankeel` 情境；關掉 serve 的情境是中位數 1749.3ms），佔該情境 `exit` 時刻（中位數 1863.4ms）的 94%。其餘每段都在 50ms 以下：`require lib/station.js` 20.2ms、`call lib/serve.js ensureServe` 32.1ms（station 已在跑，所以只是問一次）、node 起到墊片 16.6ms。一般 prompt 與進行中任務的 prompt 都在 0.33 秒內（進行中任務帶墊片的最大值是 328.9ms）。

## 環境

- HEAD：`e9bb07393349641cbe77fcb704c7dd69235b49bc`
- `git status --porcelain`（探針跑之前）：只有 `?? docs/90-agent/reports/evidence/2026-10-05-inject-timing/`，即本報告的證據目錄
- node：v24.9.0，Windows 11
- station：有在跑（`serve.json` 的 pid 活著），所以 `fankeel` 情境真的走了 `ensureServe`，沒有被跳過
- 探針：`evidence/2026-10-05-inject-timing/probe.cjs`，每情境五輪，輪流正序與反序；每輪各跑一次帶墊片（`shim.cjs`）、一次不帶。原始檔在 `evidence/2026-10-05-inject-timing/raw/`，彙整在 `summary.txt`。
- 第一次跑時墊片會把內建模組也包起來而讓 hook 以 exit 1 結束，那批資料已丟棄；修正後（`Module.isBuiltin` 提早返回）重跑，全部 exit 0。

## 牆鐘時間（毫秒，取自 `raw/wall.tsv`，每格五筆）

| 情境 | shim 中位數 | shim 最大 | bare 中位數 | bare 最大 |
|---|---|---|---|---|
| plain（`hello`，無任務） | 84.6 | 147.9 | 72.9 | 77.7 |
| fankeel-serve-off（`/fankeel`，`FANKEEL_SERVE=off`） | 1866.4 | 1962.3 | 1849.7 | 1864.5 |
| fankeel（`/fankeel`，station 在跑） | 1913.3 | 2032.7 | 1901.8 | 1991.3 |
| active（`hello`，進行中任務） | 194.0 | 328.9 | 183.0 | 286.8 |

（中位數取自五筆排序後的第三筆；shim 比 bare 多的是墊片本身。）

## 分段（毫秒，取自 `summary.txt`；`require` 只記 1ms 以上，`call` 只記最外層）

### plain

| 段 | 中位數 | 最大 |
|---|---|---|
| start（node 起到墊片） | 18.0 | 19.4 |
| require hooks/inject.js（含其下所有 require） | 33.2 | 36.1 |
| 　其中 require lib/station.js | 20.1 | 21.5 |
| 　其中 require lib/render.js | 4.9 | 5.2 |
| call lib/registry.js readSession | 0.2 | 0.3 |
| call lib/badge.js readBadge | 0.1 | 0.2 |
| exit | 55.6 | 59.0 |

### fankeel-serve-off

| 段 | 中位數 | 最大 |
|---|---|---|
| start | 17.6 | 19.3 |
| require hooks/inject.js | 32.2 | 34.2 |
| call lib/station.js write | 1749.3 | 1829.5 |
| call lib/registry.js writeSession | 2.8 | 3.1 |
| require scripts/input-check.js | 6.3 | 7.3 |
| call scripts/input-check.js sources | 1.8 | 14.5 |
| call lib/render.js renderInit | 0.2 | 0.2 |
| call lib/badge.js writeBadge＋writeLead | 0.7＋1.4 | 0.8＋1.4 |
| exit | 1819.2 | 1914.1 |

### fankeel（station 在跑）

| 段 | 中位數 | 最大 |
|---|---|---|
| start | 16.6 | 17.9 |
| require hooks/inject.js | 33.7 | 41.9 |
| call lib/station.js write | 1756.3 | 1861.8 |
| call lib/registry.js writeSession | 2.8 | 3.8 |
| require scripts/input-check.js | 7.3 | 8.9 |
| call scripts/input-check.js sources | 1.9 | 2.1 |
| call lib/serve.js ensureServe | 32.1 | 43.4 |
| call lib/render.js renderInit | 0.2 | 0.2 |
| call lib/badge.js writeBadge＋writeLead | 0.7＋1.3 | 0.9＋1.4 |
| exit | 1863.4 | 1974.9 |

### active（進行中任務的 prompt）

| 段 | 中位數 | 最大 |
|---|---|---|
| start | 17.2 | 18.6 |
| require hooks/inject.js | 33.3 | 34.8 |
| call lib/dirty.js claimWrites | 50.4 | 171.2 |
| call lib/registry.js readActive | 16.4 | 23.5 |
| call lib/render.js render | 8.2 | 10.8 |
| call lib/registry.js touch | 2.7 | 3.2 |
| call lib/badge.js pruneBadges | 17.8 | 19.0 |
| exit | 162.8 | 273.9 |

## 與 `SERVE_BUDGET_MS` 的關係

`hooks/inject.js` 的 `const SERVE_BUDGET_MS = 4000;` 從 `main()` 開始算（`const began = Date.now();`），不含 node 啟動與 require。本機量到：node 起到墊片 16.6ms，加上 `require hooks/inject.js` 33.7ms，合計約 50ms 在 `main()` 之前。50 + 4000 = 4050ms，沒超過 `.claude-plugin/plugin.json` 的 `timeout: 5`（5000ms）。但這是 station 已在跑、`write` 只花 1.76 秒的情形：`write` 是同步的，發生在 `ensureServe` 之前，而 `ensureServe` 的 `until: began + SERVE_BUDGET_MS` 是從 `began` 算起，所以 `write` 慢多少，`ensureServe` 能用的就少多少，總和不會超過 4000ms。換句話說，只要 `ensureServe` 守得住 `until`，這條路徑的上限是 4050ms 加上最後輸出，不會到 5000ms。

這份量測沒有涵蓋 station 沒在跑、要冷啟動的情形（那時 `ensureServe` 會等到預算用完才放棄），也沒有涵蓋慢磁碟或防毒掃描下 `write` 遠超 1.8 秒的機器；那兩種才是五秒逾時最可能的來源，本機沒量到。

## 下一步候選（只列，不動手）

- `station.write` 佔 /fankeel 路徑 94%：在 `/fankeel` 路徑先問 `ensureServe`（station 已在跑就不需要再重寫整頁），或讓 `write` 在 station 已在跑時不讀明細。是否改，待 TODO「注入後第一步先開 server」決定。
- `write` 目前的明細預算是 `DETAIL_BUDGET_MS=1500`，實測 1750ms 已超過它約 250ms，與 station-14 的門檻調整（預算加 500ms 餘裕）一致。
- 一般 prompt（約 55ms 內）與進行中任務的 prompt（中位數 163ms，`claimWrites` 50ms、`pruneBadges` 18ms）都遠低於五秒，不是目前的問題。
