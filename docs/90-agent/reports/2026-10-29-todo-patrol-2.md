---
status: decision
last_verified: 2026-10-30
---

# TODO 全表盤點第二輪（10-29）：做了什麼、沒做什麼

一句話：gate 的標題格式改由程式擋，第一題的標頭、題目開頭和前兩個選項不合格式就退回；gate 頁「選這個」按鈕改得和測站其他按鈕一樣；設定頁的切換列在窄螢幕會縮；station.js 又拆出 float.js 和 list-page.js 兩個模組。

一份計畫：[2026-10-29-todo-patrol-2.md](../../99-archive/2026-10-29-todo-patrol-2.md)（9 個任務）。

## 盤點

開著的 TODO 逐條查過。使用者決定做這幾條：gate 頁按鈕、設定頁 390 寬溢出、gate 標題強制格式，再加上拆殼計畫的第五份。另外把「額度改讀記錄」那兩條結案，「station-63」改成等拆殼計畫 7 再做。「真 gate 上標記一個 node」這一輪也排了，做成第 9 個任務。

## 做了什麼

- gate 頁的 `.gq-pick` 按鈕改成 32px、1px 邊框，跟測站的 keel 按鈕一致：`58ad85d0`。
- 設定頁的全域｜個別切換列在窄螢幕會縮，不再把頁面撐寬：`05cf97eb`。
- `formatProblem` 檢查 gate 第一題：標頭要是大寫的站名，題目開頭要是 `THIS -> NEXT | project : task`。選項一要是 `Go to <NEXT>`；路線走完時是 `Wrap up — 收工`；或 `Back to` 更早的站。選項二要是 `Stay in` 或 `Back to`。stage agent 交的 gate 和沒有 controller 的 gate 都會檢查：`92820ec8`、`ae98880c`、`50501780`。
- 常駐規則、skill 表、brain 與 land 的說明都改照新格式寫：`a1f9b8b8`、`5fe1fb46`、`aaa913ea`。
- 調整浮窗和待答關卡拆成 float.js，清單頁拆成 list-page.js：`1e5b5204`、`621e1798`。
- TODO 帳務和拆殼計畫的交叉引用都改好了：`ed5cc317`、`69d6a65b`。新開三條手機測站問題：`78ce5972`。
- drive 測試和 enforcement 參考頁跟著新格式修：`c65d673f`、`fd3ec03e`、`2c80ea4e`、`da9f33d9`。
- 發版 0.133.0。

## 驗過、沒驗過

- verify 跑了四輪，前三輪都退回 build：
  - 第一輪：gate 頁截圖是空白的。
  - 第二輪：選項一的規則收緊後，drive 測試的 gate 不合格。
  - 第三輪：enforcement 參考頁的表格裡多了一個沒跳脫的 `|`。
- 第四輪的快速套件是 5912 過、15 敗。15 個失敗全部來自另一個 session 還沒提交的 notify 和 station 測試檔。land 在一個只有已提交檔案的乾淨工作樹上，重跑了完整套件。
- 沒驗過：
  - 設定頁沒在真手機上重量，只在瀏覽器窗格做了防護性修正。
  - gate 頁的改後截圖拍不出來：`focusShell` 沒載入 nav.js，頁面有殼的時候會丟錯，畫面是空白的。

## 沒做什麼

- 「station 圖需要真瀏覽器驗證」維持開放：第 9 個任務沒做成，build 的 gate 是在終端機答的，沒有留下標記。
- 「gate 頁按鈕與測站一致」維持開放：按鈕已經改了，但完成標準要求的改前改後截圖還沒有。
- 「station 留 vanilla、拆完模組」維持開放：這輪只拆了兩個模組。
- 「design 依專案決定手機版」維持開放：survey 的問題名額滿了，留給下一輪。
- 鄰居的 notify 接線和 gate 頁空白不在這輪範圍：notify 是要重新接回還是刪掉，由使用者決定。
