---
status: current
---

# STATION 導覽影片：文件區塊動畫＋合成配樂＋中英雙語 — design

2026-09-28。使用者覺得現在的分鏡不好，要把終端機畫面全部拿掉，改成「文件頁的區塊」動畫，加上純音樂（不要人聲），快速說明 fankeel 做什麼，中英各一版。survey：`.fankeel/build/task-20260928T110821/survey.md`。分鏡圖（已核准方向）：`.fankeel/build/2026-09-28-tour-blocks/mockup.html`，`?lang=en` 看英文版；gate 選的是**方向**，細節交給 build 的 render reviewer。

時間基準：60 fps，120 BPM，4/4，一小節 = 2 秒 = 120 格，一拍 = 30 格。全片 3600 格 = 30 小節。

## 1. 分鏡：十一格文件區塊

- `assets/station/tour-stages.js` 的 `termCut()`、`landCloseup()` 和所有終端機 chrome 刪除，不留任何終端機畫面。
- 每一格是一頁文件：頁框、檔名標籤，裡面的區塊（標題、清單列、表格、提示框、選項卡）在拍點上一塊一塊由下往上浮入。內容用示範任務「多倉庫庫存與調撥」、專案 `inventory-admin`。
- 十一格與格數，每格起點都是 120 的倍數：hook 0–239、route 240–479、survey 480–839、design 840–1199、plan 1200–1559、build 1560–1919、verify 1920–2279、audit 2280–2639、land 2640–2999、clash 3000–3239、outro 3240–3599。
- 每格的畫面內容照分鏡圖對應的 `data-block`（`cut-hook` … `cut-outro`）：hook 文件越疊越高、三塊變灰加刪除線「已過時」；route 任務卡加 7 顆 stage 色點依序亮；survey 三列找到的檔案加 `class: bounded` 提示框；design 方案一句、檔案表、「✓ 核准」選項卡；audit 文件樹兩頁標「過時」、一頁移進 `archive/`；land `TODO.md` 劃掉一條、「工作樹乾淨 ✓」；clash 兩張 session 卡碰同一檔案、琥珀色 `CLASH`；outro 兩行安裝指令加 tagline。
- plan 格講「自動拆解、看出誰能一起做」：A（`Files: src/stock/warehouse.ts`）、B（`Files: src/transfer/api.ts`）併進「同時」框，C（`Consumes: A`）排到下一排，箭頭標「等 A」。這對應 `lib/plantasks.js` 依 `Files:` 不重疊分組、`Consumes` 排在後面。
- build 格講「能平行的一起跑，該排隊的排隊」：兩條跑道，A、B 同一拍亮綠、各自一顆 reviewer 點、同時 ○→✓，之後 C 才亮綠、reviewer、✓。
- `beats` 和 `stills` 跟著新格數重算；`length` 仍是 3600。

## 2. 合成配樂

- 新檔 `assets/station/tour-music.js`：譜寫成資料（和弦、bass、kick、pluck 琶音、pad），用純 JS 合成出單聲道 PCM（Float32，44100 Hz），瀏覽器和 Node 共用同一份，不加任何依賴，repo 不放音檔。
- 風格：明亮科技 pluck，120 BPM；每次換場（每個 cut 起點）一聲 whoosh/重音，每個區塊浮入一聲 pluck，route 格進主旋律，outro 在最後一小節收在主和弦。
- 長度剛好 3600 / 60 = 60 秒，峰值不超過 0.9（不破音），最後半小節淡出。
- `assets/station/tour-player.js` 播放時用 Web Audio 播這段 PCM，play / pause / seek 時聲音跟畫面同步；加一個靜音鈕；瀏覽器擋自動播放時，第一次點播放才出聲。
- `scripts/tour-record.js` 在 Node 裡用同一個模組寫出 WAV，ffmpeg 把它和畫面合成一支 mp4（`-c:a aac -shortest`），之後用 ffprobe 確認有一條音軌。

## 3. 中英雙語與字體

- 影片裡每一個字串都放進一張 `{ zh, en }` 對照表，語言跟著 station 的 `I18N.lang`；英文用分鏡圖 `?lang=en` 的寫法（例如任務名 "Multi-warehouse transfers"）。中英共用同一組座標和同一條配樂。
- `assets/station/tour.js` 的字體順序依語言切換：zh 把 "Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC" 排在 "Bahnschrift" 前面；en 讓 "Bahnschrift" 在前。
- 新增 `fit()`：畫字前用 `measureText` 量寬，超過給定寬度就一級一級縮小字級（最多縮三級），仍放不下才換行；換行時「。，、」不落在行首。
- 等寬字體（Cascadia Mono）只放 ASCII；中文標籤一律用介面字體。垂直置中用量到的 `actualBoundingBoxAscent`，不用寫死的偏移。
- `scripts/tour-record.js` 加 `--lang zh|en`，預設 `zh`，中英各錄一支（`stages-zh.mp4`、`stages-en.mp4`）。
- 不打包字體檔：錄影固定在 Windows 上跑，網頁版用系統字體。

## 4. 文件

- `docs/01-guide/station.md` 和 `docs/90-agent/reference/station.md` 裡「無聲」「一支影片」等描述改成現在的樣子：一支 60 秒、有配樂、中英兩版的文件區塊動畫。

## What proves it done

| check | now | after |
|---|---|---|
| `tests/tour-stages.test.js`：十一格起點都是 120 的倍數，來源裡沒有 `termCut` | 失敗（起點是 240＋408i，有 `termCut`） | 通過 |
| 中英每一個字串用 `measureText` 量過，不超過它的方塊寬度 | 失敗（沒有英文表） | 通過 |
| `tests/tour-music.test.js`：PCM 長度 = 60 × 44100，每個 cut 起點附近 50 ms 內有重音，峰值 ≤ 0.9 | 失敗（沒有這個模組） | 通過 |
| 錄出的 `stages-zh.mp4`、`stages-en.mp4` 用 ffprobe 看各有一條 60 秒音軌、3600 格畫面 | 失敗（只有畫面） | 通過 |

## 對照地圖

`.fankeel/map.md`：沒有衝突。`docs/99-archive/2026-09-27-tour-design.md` 的「no audio」是封存的舊決定，這份推翻它。

## 還沒驗的

音樂好不好聽只能靠人耳；瀏覽器自動播放政策可能要使用者點一下才出聲。
