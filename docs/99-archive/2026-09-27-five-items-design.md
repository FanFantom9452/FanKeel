---
status: current
last_verified: 2026-09-27
---

# 五件：`#/live` 改版、wizard-motion 瞬斷、01-guide 四頁、ab.sh 路徑、mockup 自我驗收

session 8037359d-acbb-4cec-bffe-318196779a68 的 design 站，使用者 2026-09-27 核准。
描述的是要做成的樣子，不是現在的樣子。

Mockup：`.fankeel/build/2026-09-27-live-card/mockup.html`（不提交；從 repo 根目錄
`tune.js serve . --port 7819` 開，網址 `/.fankeel/build/2026-09-27-live-card/mockup.html`）。
方向核准：mockup 定方向，細節交 build 的 render reviewer。

## 檔案

| file | change | dispatch |
|---|---|---|
| `assets/station/station.js` | `#/live` 改寫成四塊 | implementer, sonnet |
| `assets/station/station.css` | 四塊的新樣式 | implementer, sonnet |
| `tests/station-view.test.js` | 四塊的斷言 | implementer, sonnet |
| `tests/station-wizard-motion.test.js` | 重現後依原因修 | implementer, sonnet |
| `docs/01-guide/getting-started.md` | 新頁 | implementer, sonnet |
| `docs/01-guide/concepts.md` | 新頁 | implementer, sonnet |
| `docs/01-guide/profile.md` | 新頁 | implementer, sonnet |
| `docs/01-guide/station.md` | 新頁 | implementer, sonnet |
| `docs/README.md` | 索引列出四頁 | implementer, sonnet |
| `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` | `EVID`/`OLD` 路徑 | in-session：一次 Edit |
| `agents/fankeel-mockup.md` | 回傳前用 serve 出來的網址驗收 | implementer, sonnet |
| `skills/fankeel-design/SKILL.md` | 第 3 步同一條規則 | implementer, sonnet |
| `tests/agents.test.js` | mockup 驗收規則的斷言 | implementer, sonnet |

## 1. `#/live` 的四塊

來源是使用者 09-24 tune r-0012 對 `#/live` registry 卡片的話：「這邊有點醜 也不直覺 直觀」。
第一步（左側導覽依功能分類）已在 4083ff6c 落地，這是第二步。

- `live-gate`：等使用者回答的 gate 釘在最上面；沒有時只有一行「沒有在等你的 gate」。
- `live-run`：「正在跑」，每個確認活著的 session 一列：專案與根目錄、task、route 畫成站點（目前那站外圈高亮並標在站時間）、最後一次寫入多久前、開了多久。
- `live-maybe`：「可能已經停了」，registry 標進行中但確認不了 process 的 session，標記改成灰色 `live?`；stale 的那種帶 clear stale 按鈕。
- `live-idle`：沒有 session 的 registry 收成一排名字 chip，每個連到該專案頁，取代原本一張張「沒有進行中的 session」卡片。
- 每一塊在原始碼裡字面帶 `data-block="<name>"`。

## 2. `station-wizard-motion` 瞬斷

09-27 四次整套紅兩次，單跑 3/3 綠；`.fankeel/build/` 裡沒有任何一次失敗輸出，所以哪個 assert 紅未知。

- 先重現：整套反覆跑到抓到一次紅，把失敗訊息寫進 `.fankeel/build/2026-09-27-five-items/flake.txt`。
- 依抓到的原因修在根上；不加第二次重試、不放寬斷言。
- 抓不到紅（整套 10 次全綠）就不改碼，把 10 次的結果寫進 flake.txt，TODO 那條移到 `## Watch`。

## 3. 01-guide 四頁

給人讀的，繁體中文，短；`role: reference`、`audience: human`（`docs/01-guide` 已如此宣告）。

- `getting-started.md`：裝插件、第一次 `/fankeel`、選 task、走完一條 route、看 station。
- `concepts.md`：七站各產出什麼、三種 class、gate 怎麼答、registry 是什麼。
- `profile.md`：每個 profile key 的意思與建議值、在站頁精靈怎麼套。
- `station.md`：每個 view 看什麼、數字怎麼讀。
- 每頁的 `source_of_truth` 指向它摘要的 90-agent 頁（及 `lib/profile.js` 之類的原始碼），那些頁一改就被 drift 報到。
- `docs/README.md` 的索引列出四頁。

## 4. ab.sh 路徑

- `EVID`/`OLD` 從 `docs/reports/evidence/...` 改成 `docs/90-agent/reports/evidence/...`；不重跑，重跑留在 TODO 的 `## Needs a decision`。

## 5. mockup 自我驗收

design 站的 mockup 曾以 `file://` 截圖驗收，實際給使用者的 `tune.js serve <mockup 目錄>` 網址卻因 `../../../assets/...` 跳出伺服器根目錄而 404、整頁無樣式。

- `agents/fankeel-mockup.md`：回傳前自己用 `tune.js serve` 開在 CSS 相對路徑也在根目錄內的那一層，用 `render.js` 截那個 http 網址；任何 stylesheet 回非 200 或截圖無樣式就不回傳。回傳的是那個網址。
- `skills/fankeel-design/SKILL.md` 第 3 步：給使用者的是 agent 回傳、已驗收的網址，不是自己另開的 serve。

## What proves it done

| check | how |
|---|---|
| `#/live` 四塊 | `tests/station-view.test.js` 新斷言：live view 的 HTML 含四個 `data-block`，閒置 registry 不再輸出「沒有進行中的 session」卡片；改前紅、改後綠 |
| 渲染 | build 的 render reviewer 對 `#/live` 截圖，四塊都出現 |
| flake | 整套 10 次，`station-wizard-motion` 0 紅 |
| 01-guide | `node scripts/docs-check.js` 乾淨，四頁在 `docs/README.md` |
| ab.sh | `grep -c "docs/reports/evidence" ab.sh` 為 0 |
| mockup 驗收 | `tests/agents.test.js` 新斷言：`fankeel-mockup.md` 要求以 serve 網址驗收；改前紅、改後綠 |
