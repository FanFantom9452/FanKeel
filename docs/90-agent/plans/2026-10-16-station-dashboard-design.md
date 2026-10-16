---
status: design-intent
---

# Station 儀表板改版 — Design

使用者在 design 站用逐塊調整頁核准了儀表板 mockup（`.fankeel/build/2026-10-16-station-dashboard/mockup.html`，r-0042 到 r-0047 的版本），並要求多派 agent 快速做完。mockup 是靜態頁；這份 design 說的是把它做進真的 station（`assets/station/station.js`、`station.css`、`i18n.js`）。其他頁面之後另開任務，照第 1 節的頂列做。

## 1. 頂列

- 左上品牌只留標誌與 `fankeel` 字樣，不再寫「測站」；寬度對齊左側選單那一欄，標誌與字的大小維持原本的 34px／27px。
- `#side` 不再畫麵包屑，改寫目前這一頁的標題（例如「儀表板」），從內容欄的左緣開始。
- 搜尋框移到右邊那一組，排在 serve 圖示、語言與主題前面。
- serve 狀態改成只有圖示：連線中是綠點的插頭（`#serveup`，由 `servePill` 建立），停掉是灰色的同一個圖示（`#servedown`）；文字只在 `title` 與 `aria-label`。
- 語言選單的項目只寫「繁體中文」「English」，按鈕寫「繁中」或「EN」。

## 2. 花費長條的 hover

- 近 30 天花費的每一根長條在滑鼠移上或鍵盤聚焦時升高、變亮，其他變淡，上方浮出當天的金額與日期；沒有花費的日子寫「沒有紀錄」。
- 只用 CSS 做效果；`prefers-reduced-motion` 時不播動畫。

## 3. 可以開工的彈窗

- 點「可以開工」卡片裡的專案列，先開一個 `<dialog>`：Ready、Blocked、Watch、Done 四個分頁，各標數量，列出條目標題與標籤。
- 彈窗底部「開啟完整 TODO 頁 →」連到該專案的 TODO 頁（列原本的 href）。
- Ctrl 或中鍵點專案列，照舊直接開新分頁；✕、Esc、點背景都能關閉，焦點回到原本那一列。

## 4. 卡片區的編輯模式

- 拿掉頂上的「調整卡片」按鈕與舊的 `dash-chooser` 勾選面板，也拿掉 dash-head 那一列（標題已在頂列，四個狀態標籤刪除）。
- 卡片區右欄最下面多一格虛線卡「編輯版面」（`#dchtog`），按下進入編輯模式；編輯時每張卡有拖曳把手、「隱藏／顯示」，外框變虛線，底部一條貼底的列有「還原預設」與「完成」，Esc 等於完成。
- 順序與隱藏照舊存在 `station.dash`（`{order, off}`），預設順序不存鍵。

## 5. 新增卡片

- 編輯模式下那格虛線卡變成「＋ 新增卡片」，開一個選卡片的 `<dialog>`：「隱藏中」可加回，「更多卡片」列出八種，各有圖示、名稱、一句說明與「加入」。
- 八種卡片用頁面已經收到的資料畫：撞檔與共用檔案（`sessions[].claims`）、依專案花費（`dayBars`）、近 7 天 token（`sessions[].days[].tokens`）、模型用量分布（`days[].model`）、gate 平均等待（`stages[].waited`）、最近 land（`todos[].done[]` 與 stage 為 land 的 session）、TODO Blocked 到期（`todos[].open[]` 的 blocked）、子代理派工（`sessions[].subagents`）。
- 加入的卡片和原本五張一樣存進 `station.dash`。

## 6. 通知面板不再跳回最上面

- 每 3 秒重讀時 `drawFloat` 重建 `#fkp`，捲動位置歸零；改成重建前記下 `#fkp` 的 `scrollTop`，重建後放回。

## What proves it done

| test | how |
|---|---|
| 頂列 | `tests/station-header.test.js`：`#side` 寫頁面標題不寫麵包屑；`servePill` 在連線時建立帶 `title` 的 `#serveup` 圖示、停掉時顯示 `#servedown`；品牌字不是「測站」。 |
| 花費 hover | `tests/station-spend-hover.test.js`：`dashSpend` 每一根有花費的長條帶可聚焦的屬性與金額日期提示；CSS 有 hover 規則與 `prefers-reduced-motion` 區塊。 |
| TODO 彈窗 | `tests/station-todo-modal.test.js`：`dashTodoDialog` 依 state 分四組並標數量，Done 取 `done[]`，底部連結等於專案列的 href。 |
| 編輯模式 | `tests/station-dash.test.js` 改寫：沒有 `dash-chooser`、沒有 `.kcap`；`#dchtog` 在卡片區裡；隱藏、排序、還原仍寫 `station.dash`。 |
| 新增卡片 | `tests/station-cards.test.js`：八種卡片各有 builder，`dashOrder` 認得它們的 id，選卡片視窗列出隱藏中與未加入的卡片。 |
| 通知面板 | `tests/station-float-scroll.test.js`：重建前後 `#fkp` 的 `scrollTop` 不變。 |

## Files

| file | change |
|---|---|
| `assets/station/station.js` | 六節的 JS |
| `assets/station/station.css` | 各節的樣式，放在相關規則旁 |
| `assets/station/i18n.js` | 新字串的英文 |
| `tests/station-header.test.js` | 新 |
| `tests/station-spend-hover.test.js` | 新 |
| `tests/station-todo-modal.test.js` | 新 |
| `tests/station-dash.test.js` | 改寫 chooser 相關測試 |
| `tests/station-cards.test.js` | 新 |
| `tests/station-float-scroll.test.js` | 新 |

## Unverified

- 拖曳只在 mockup 用鍵盤驗過，滑鼠拖曳沒有實測。
- 淺色主題沒有截圖。
