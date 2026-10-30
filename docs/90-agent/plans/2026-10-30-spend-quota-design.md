---
status: design-intent
last_verified: 2026-10-30
---

# 花費頁：總覽、7d 額度、5h 額度、明細四個 TAB — design

花費頁（`#/days`）頂端一排 TAB——總覽｜7d 額度｜5h 額度｜明細——切換時不捲動；
每個 TAB 裡再用分段鈕切換資料。區間選擇四個 TAB 共用。**總覽**回答「花了多少、花在哪」，
**額度**回答「額度什麼時候漲、當時在跑哪些任務」，**明細**放分項與表格。並修兩個讀錯的 KPI。
mockup：`.fankeel/build/2026-10-30-spend-quota/mockup.html`（未提交）。

今天的狀態：5h/7d 讀數由 `hooks/pane-limits.ts` 寫進每個 registry 的
`.fankeel/build/limits/<session>.jsonl`，測站只把最新一筆給手機版
（`scripts/station.js:1068`）；`lib/quota.js:20` 的 `readings()` 只讀 `seven`，
跨 session 沒有去重。

## 0. 帳號

這台機器兩個帳號共用一個 config dir（`C:\Users\user\.claude`），7d 重置時刻分
04:00 與 19:00 兩組（2026-10-30 使用者確認）。

- `hooks/pane-limits.ts` 每筆讀數多記 `account`：寫入當下 config dir 的 `.claude.json` 裡 `oauthAccount.accountUuid`；不記 email 或姓名。
- 帳號鍵：有 `account` 用它；沒有的舊讀數依 `sevenResets` 的星期、時、分歸組。兩者矛盾時以重置時刻為準。
- 頁面上叫「帳號 · 週四 04:00 重置」，不顯示 uuid。
- session 的帳號是它 limits 讀數裡最多的那個；沒有讀數的歸「未知」。registry 不加欄位。

## 1. 資料

- 額度序列：所有未 `gone` 的 registry 的 limits 檔，依帳號分開，每筆 `{at, account, five, fiveResets, seven, sevenResets}`，`at` 為 epoch ms；同帳號同一分鐘的重疊讀數留 `seven` 較大者。
- task 區段：每個 session 依 transcript 的 `task.js start`／`task`／`stage`／`down` 指令切成 `{session, account, task, start, end, stages:[{stage, start, end}], gates:[{start, end}]}`；`gates` 取自 registry 的 `waited` 與 `gateAt` 紀錄所在的 stage 時段。session 沒結束時 `end` 為最後一次活動。
- 每段 task 在任一時段的花費，取 `lib/detail.js` `daysOf` 的逐請求列（帶 `task`）加總。
- 兩者放進 `serialize` 的資料（與 `C.DAYS` 同一條路），前端依區間過濾；不新增路由。

## 2. TAB 與總覽（預設）

- TAB 列在區間選擇之下，四個：總覽、7d 額度、5h 額度、明細；所選 TAB 記在 hash（`#/days/quota7` 等），重新整理後留在原 TAB。
- 帳號分段鈕（7d、5h 兩個 TAB 共用一個選擇；總覽多一個「全部」）在 TAB 內最上方。

- 一個總花費數字；sub-line 為各帳號與未知的金額，「04:00 帳號 $X · 19:00 帳號 $Y · 未知 $Z」；不接 `(x%)`。
- 每日花費長條，依帳號分色。
- 「最貴的 5 個 task」短表：task、專案、花費；點一列切到 7d 額度 TAB、該帳號、時間軸對準該 task 並選中它。

## 2a. 明細

- 分段鈕：依 model／專案／stage／task（預設 model）；下面是現有的堆疊長條與對應表格。
- 其餘現有 KPI（token、active、等待佔比、最常被換掉）與現有三張表放在這個 TAB，堆疊長條之下。

## 3. 7d 額度與 5h 額度

兩個 TAB 版面相同，只差時間軸與用哪個百分比。

- 頂端：帳號分段鈕（一次一個帳號）；5h 額度 TAB 另有 ‹ 窗口 › 。
- 上層折線：階梯線——兩次取樣之間沿用上一個值，到重置時刻掉回 0；沒有取樣的時段同一條線畫淡色，不斷開。y 軸 0–100%。
- 7d 額度：時間軸從區間內第一筆讀數到區間終點（區間前段整段沒有讀數時不畫，圖下註明）。5h 額度：時間軸是一個 5h 窗口，‹ › 換窗口，預設最近一個有讀數的窗口。
- 下層 task 條，與折線共用時間軸：一條 = 一個 task 區段，條內依 stage 分色，等關卡的時段畫斜線；同時段重疊的條疊成多條泳道，泳道數取最大重疊數。只顯示所選帳號的 session；未知帳號的不顯示，條數寫在圖下。
- 折線上方一列燒速與重置：7d 目前百分比與「照近 24 小時速度 MM-DD HH:mm 用完」或「重置前用不完」；5h 目前百分比與「HH:mm 重置，還有 N 小時 M 分」；每 1% ≈ 該帳號最近一個漲幅 ≥ 10 點的 7d 窗口內花費 ÷ 漲幅，不足時「資料不足」。最近讀數超過 6 小時時改寫讀數時間。

## 4. 折線與 task 條的關係

- 點一條 task 條：折線上該條 `start`–`end` 的那段反白，其餘變淡；條旁顯示「這段額度 +x%，這個 task 約佔 y%」。
- 額度漲幅 = 該段終點與起點的值差，跨過重置時分段相加。
- 分配：把該段切成「重疊的 task 集合不變」的小段；每小段的漲幅依各 task 在該小段的花費比例分配；這個 task 的佔比 = 它分到的總和 ÷ 該段漲幅。小段內所有 task 花費為 0 時平均分。
- 5h 額度 TAB 只算目前窗口內的部分。
- 再點一次或點空白處取消選取。

## 5. 最常被換掉

- `lib/station.js:829,838` 取關卡標籤當鍵前，先去掉 `(Recommended)`／`(建議)` 後綴，讓同一選項合併計數。

## 驗收

- 測試：兩個 registry、三個重疊 session 的 limits 檔，合併後每帳號筆數等於去重後分鐘數，`five` 有值。
- 測試：沒有 `account` 的讀數依 `sevenResets` 歸組成兩個帳號；與 `account` 矛盾時以重置時刻為準。
- 測試：`pane-limits` 寫出的讀數帶 `accountUuid`，不含 email。
- 測試：階梯序列在兩次取樣之間值不變、在 `sevenResets` 掉回 0，沒有取樣的點標 `gap`。
- 測試：transcript 中途改名，切出兩個 task 區段，各自的 stages 正確。
- 測試：兩個 task 部分重疊、花費 1:3，該段漲幅 8 點時佔比分別為 2 與 6 點；跨重置的漲幅分段相加。
- 測試：近 24 小時斜率預估等於手算值；斜率 ≤ 0 時為「重置前用不完」。
- 測試：總覽的帳號金額加未知等於總花費，且不含 `%`。
- 測試：`verify (Recommended)` 與 `verify` 合併成一個 `swapped` 項。
- 成品：渲染後的頁面上，最貴 5 個 task 的金額不大於總花費，點一列後 7d 額度 TAB 選中同一 task；切換四個 TAB 頁面捲動位置不變。

## 對照 map

會改 `docs/90-agent/reference/station.md` 的 quota 一段（184–190 行，花費頁不再接 `(x%)`）與花費頁一節，以及 limits 欄位說明（多一個 `account`）；沒有與 current 頁衝突的地方。

`quota.week` = $66 是錯的（校準只取 10-29 的 6.4 小時，又把兩個帳號的花費除以一個帳號的額度）；花費頁不再讀它，它本身的處置另開 TODO。

## 未驗證

同一個 config dir 裡用 `/login` 換帳號時，已在跑的 session 是否跟著換。若不換，寫入當下讀 `.claude.json` 會貼錯帳號——§0 以重置時刻為準就是為了這個。
