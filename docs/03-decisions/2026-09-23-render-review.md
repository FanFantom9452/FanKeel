---
status: decision
last_verified: 2026-09-23
---

# 渲染審查獨立成 agent、逐塊即時調做成注入式 — 決策紀錄

design 見 [../archive/2026-09-23-render-review-design.md](../99-archive/2026-09-23-render-review-design.md)，
plan 見 [../archive/2026-09-23-render-review.md](../99-archive/2026-09-23-render-review.md)（已落地封存）。

## 一、定案

| 項目 | 定案 | 為什麼 |
|---|---|---|
| 前端審查 agent | 另開 `fankeel-render-reviewer`（sonnet），推翻 [2026-09-23-todo-ten.md](2026-09-23-todo-ten.md) 的「不另開 agent」 | 使用者在 survey 關卡指出 reviewer 與 verifier 都不做「實際渲染後對照要求」；舊 `render` lens 只比同源數字。獨立的 agent 有自己的回傳格式（逐 `data-block` × 角色的表與 `recapture`／`fix`／`ship`），不和程式碼審查的規則混在一起 |
| 出場點 | build 每個動到頁面的 task，加上 verify 的完整一輪 | 偏差在 build 就抓到，verify 補全部角色與頁面 |
| 角色 | `.fankeel/render.json` 宣告頁面與角色；每個角色一個瀏覽器 profile（`--user-data-dir`），`render.js login` 手動登入一次 | browser-use 的做法可借、套件不借：它要 Python、Playwright 與 LLM API key，本專案零 npm 依賴 |
| 逐塊即時調 | 注入式：`scripts/tune.js` 在送出 HTML 時注入 overlay，點區塊、寫要怎麼改，`done` 擋下區塊外的改動並還原 | 使用者在 design 關卡選了注入式而非輕量迴圈；注入在送出時做，原始檔不改，不用收尾 |
| Jev | 不採用 | TypeSafe AI 的 System One 模型，雲端 API、不吃圖（官方頁：「not on images (yet…)」） |
| 本地判斷模型 | 不做，掛 `TODO.md` 的 `## Waiting` | 要求本身不需要；moondream、UI-TARS 都沒在本機試過 |
| 逐塊即時調的檔名 | `lib/live.js` 與 `tests/live.test.js` 早已是 session-liveness 模組，所以改名 `lib/tune.js`、`scripts/tune.js`、`assets/tune/overlay.js`；HTTP 端點刻意保留 `/__live/*`（協定名，不撞檔名） | plan 誤標為新檔，Task 3 的 implementer 以 blocked 擋下 |
| build 的主控 | 由主 session 直接派 implementer 與 reviewer，沒走 `fankeel-brain` | session 的 hook 釘在 0.74.0，`lib/stages.js` 在那一版只認 `stage.agents === true`，profile 的陣列落空；使用者在關卡選了本 session、直接在 main |

## 二、沒做的

- 框架產生的頁面不能逐塊調：`data-block` 必須逐字寫在所服務的檔案裡。
- 新 agent 在寫下它的那個 session 派不到（安裝版 0.74.0），受控跑由 parent 以 `general-purpose` 帶 agent 檔全文代跑。
- 受控 build（stage agent）這次沒跑到，這份 plan 的派工與提交順序未必與 0.76.0 的受控 build 一致。
