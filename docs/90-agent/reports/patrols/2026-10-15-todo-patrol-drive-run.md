---
status: decision
last_verified: 2026-10-15
---

# TODO 全表盤點（10-15 第二次）：做了什麼、沒做什麼

一句話：drive.js 第一次用真的 claude -p 跑完一輪並結案——答案是 acceptEdits 下站寫不進交棒資料夾；整套偶爾紅的兩條併成一條、改盯 station-cli 測試；使用者新提的四件事記成 TODO；其餘 Ready 都要真機，留著。

計畫在 [2026-10-15-todo-patrol-drive-run.md](../../../99-archive/2026-10-15-todo-patrol-drive-run.md)。

## 起因

使用者在開任務時選了「TODO 全表盤點」。survey 逐條核過 29 筆：Ready 6、Needs a decision 0、Blocked 12、Watch 11。Ready 裡這個 session 自己做得了的只有 drive.js 第一次實跑；Blocked 的條件一條都沒到；Watch 裡「整套再紅一次」那組的事件 10-14 又發生了。使用者看了清單，另外提了四件事，並選擇花最多 2 美元實跑 drive.js。

## 做了什麼

- drive.js 第一次實跑：使用者在 Claude Desktop 另開一個 session 起了一個只有 build、verify 兩站的小任務，這個 session 用 `--max-rounds 2 --max-usd 2` 去跑。跑了一輪、花 0.47 美元就停下：那一站把檢查做完了，但它寫交棒檔時被 Claude Code 當成敏感檔案擋下，沒有繞過，driver 因為找不到交棒檔停在 status。這回答了原本沒人驗證過的問題，寫進 drive.js 的說明頁後結案；讓它真的能交棒另開一條待辦（drive.js 寫不進 handoff）。
- 整套偶爾紅：使用者選了改查 station-cli 測試。「一次性整套測試失敗」那條的候選原因從 trackedIn 測試改成 station-cli 的「the first run scans once and records that it did」在忙碌機器上跑太久，標題跟著改成「station-cli 測試偶爾逾時」；「並行 commit 測試偶爾紅」併進去，以放棄結案。
- 使用者新提的事記成 TODO：gate 通知框可拖曳縮放、快速設定重新設計（連同 init，land 時使用者確認放 Ready）、升級技能要不要替舊專案補步驟（需要決定）。
- Blocked 十二條裡十一條上午那次盤點已蓋過今天的章，剩下一條補蓋。
- verify 抓到一句寫錯：說明頁原本寫「Write 和 Edit 都被擋」，紀錄裡其實只有一次 Write，回 build 改正後重驗通過。整套 4260 個測試通過。

## 沒做什麼

- 五筆 Ready 要使用者的真機，留在 Ready：子代理 brief 改走 spawn、Desktop 真機看壓縮視窗、實測安裝版 mod 啟動就載入、面板真機沒看完的四件事、終端啟動讀遠端狀態。
- 使用者問的「CONTEXT 壓縮、預設 1M 有沒有做」：程式那一半做了，真機那一半就是上面兩條 Ready；「預設 1M」指的是哪個設定沒說清楚，repo 裡沒有把預設改成 1M 的提交，所以沒有結論。
- 「一次性整套測試失敗」那條較早的段落仍寫著先看 trackedIn 測試。條目內文只往後加日期段落、不改寫舊的，使用者同意照這個規矩留著；新的 10-15 段落已說明候選改了。
- 試跑任務在 registry 裡的紀錄還開著，要不要收掉由使用者決定。
- 這次不發版，使用者要等整理做完再發。
