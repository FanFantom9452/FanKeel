---
status: decision
last_verified: 2026-10-30
---

# TODO 全表盤點（10-30）：做了什麼、沒做什麼

一句話：gate 的標頭和題目從全大寫改成首字大寫（`Build -> Verify | fankeel : task`）。手機 gate 畫面會畫報告裡的 mermaid 圖，也能標記節點。手機對話裡的照片改成縮圖。focus 殼補載了六個模組，有殼的頁面不再空白。design 只在專案有宣告手機寬度時才畫手機版。

一份計畫：[2026-10-30-todo-patrol.md](../../99-archive/2026-10-30-todo-patrol.md)（18 個任務）。

## 盤點

開著的 8 條 Ready TODO 逐條查過。survey 時使用者決定三件事：gate 的題目、標頭、選項標籤一律改首字大寫；gate 頁按鈕照判官的改法做；拆模組（station-52）排進這一輪。plan 把 station-52 交給既有的拆殼計畫 6 和 7，在這份計畫之後跑。第 17、18 個任務要使用者動手，所以放到其他任務做完後、build 的 gate 上一起驗。

## 做了什麼

- gate 的站名改首字大寫，`stageWord()` 是唯一來源，`formatProblem` 也照新格式檢查：`fd0fdfd6`、`1c736640`。
- skill、brain agent、規則句和 brief 都改照新格式寫，測試的 gate 也跟著改：`531ed39e`、`24dba147`、`c2e17ffc`、`57231212`、`86053536`。
- 手機對話裡，上傳的照片用 `GET /phone/img` 取回，畫成縮圖；按送出後輸入欄立刻清空：`6a9eb6c4`、`7ce2cdc0`、`b946fa8f`、`fbde136e`。從配對電腦看照片，會走那台電腦的前綴：`ad041627`。
- phone.json 帶上報告裡的 `diagrams`，手機 gate 畫面會畫圖、點節點就能標記：`e73700e9`、`538b9c3b`。
- focus 殼補載六個延遲載入的模組，有殼的 gate 頁和 plan 頁不再空白：`1b2999ed`。
- `mobileDeclared` 讀 render.json 裡的手機寬度，design 只在專案宣告了才畫手機版：`7e87fed9`、`f546e867`。
- station-65 補上 gate 按鈕的改前改後截圖記錄：`710f5f75`。
- 收尾修的是套件與文件：`ed0c940d`、`957558e3`、`38b61622`。verify 新增 focus 頁的假資料測站和 render.json 頁面：`a3828c79`。
- 發版 0.135.0。

## 驗過、沒驗過

- verify 跑了 render 審查，結果是 ship。拍了 7 張圖，沒有一張空白：focus gate 頁和 plan 頁有殼、無殼各一張，另外是手機標記節點和對話縮圖。
- 快速套件 5951 過、16 敗。16 條全部指向鄰居還沒提交的 notify 和 station 檔案；對抗審查沒找到任何一條落在這次改到的檔案上。
- 沒驗過：
  - 第 17 個任務（entry-4）：build 的 gate 是在終端機答的，答案檔沒有「標記：」行，所以真 session 上標記並送出這件事，還沒有證據。
  - 手機上的平移和縮放只能在真手機上看，render 審查拍不到。
  - gate 頁的「選這個」按鈕有畫出來，但沒有真的點過。

## 沒做什麼

- entry-4 維持開放：理由同上。
- station-52 維持開放：交給拆殼計畫 6、7。
- station-65 維持開放：截圖已記錄，等使用者確認。
- verify 找到兩個小問題，這輪不修：有殼頁面的背景 shell 列沒上樣式；`lib/shots.js` 的 `mobileDeclared` 在 render.json 解析失敗時默默回 false。
- 鄰居的 notify 功能不在這輪範圍。它的手機通知標題只寫 `<stage> gate 在等你`，題目放在內文。
