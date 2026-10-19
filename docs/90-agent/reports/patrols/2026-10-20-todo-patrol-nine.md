---
status: decision
last_verified: 2026-10-20
---

# TODO 全表盤點（10-19 第三輪）：34 個任務做完，14 條結案

一句話：盤點挑出十六條要做，拆成 34 個任務、11 組，全部做完；13 條以 done 結案，「等鎖時報出持有者沒有新輸出」以 abandoned 結案，兩條改成 10-27 重量，「工具參數中文寫成轉義」留著再量一週。

計畫在 [2026-10-20-todo-patrol-nine.md](../../../99-archive/2026-10-20-todo-patrol-nine.md)，任務紀錄在 [2026-10 月紀錄](../../records/2026-10.md#r-2026-10-19-45487ab9)。

## 做了什麼

- 回答「要離開」後工作不再停下；下一個要問使用者的問題會先擱著，session 在那裡壓縮，人回來再問。
- agent 回報超過 3000 字會被退回一次，傳給別的 session 或 agent 的訊息超過 2000 字也會被退回。
- 站 agent 交回結果前，要等它派出去的 agent 全部回來；verify 關卡的對手 agent 還沒回來，gate-check 不讓關卡開。
- ALWAYS[3] 只說「中文直接寫字」；控制區塊與每份子 agent brief 都帶著這條規則；AskUserQuestion 裡出現錯字會被退回一次。
- `scripts/escape-scan.js` 掃 transcript，按工具分別算出寫錯的中文字數。
- 監控站可以看本週、上週、近 30 天或自訂區間的花費，並和前一段同樣長的區間比較；看得到五種花費成分的說明、cache write 的 1h 和 5m 拆開、依 agent 類型的花費、最貴的 session，以及每次壓縮和 cache 重寫的花費。
- `task.js release` 可以放掉另一個 session 指名的 claim；record.js 寫登記失敗時會大聲報錯；四組重複的測試斷言已拿掉。
- 每個 SKILL.md 都有自己的位元組上限。
- ilsbench 探針改設每週成本上限，寫成 [決策紀錄](../../../03-decisions/2026-10-19-ilsbench-probe-cap.md)。
- 機器 profile 和 SBIR 的 ProjectWorkspace 都把 compact.at 設為 350000。
- 八條 Blocked 條目重新標上日期。

## 驗證找到、回建置修掉的

- 收尾檢查發現幾處引用行號跟著程式碼移動了，也缺少監控站等待時間和稽核室的測試；一次修掉（407b2ff8）。

## 沒做什麼

- 「SBIR 沒套到 compact.at 350K」和「主對話 1h cache write 佔 29%」要到 10-27 才能重量；已開的 SBIR session 要重開 Claude Desktop 才會套用新值，這次沒有實際看到。
- 「工具參數中文寫成轉義」第一次全機掃描：AskUserQuestion 0.95%、Write 2.43%（被寫進 regex 的區塊邊界字灌高）、使用者 prompt 0.95%，一週後再量。
- verify 只派一個對手 agent 審整個分支，34 個任務沒有各自的 verifier。
- 監控站的新花費頁面只有單元測試與渲染測試，沒有人在瀏覽器裡實際看過。
- 判斷書寫的 ilsbench 每次探針費用是 $0.54，實測約 $0.083，判斷書本身沒改。
- 盤點中途問判官的兩題（巢狀 repo 路徑、右側面板區塊被截掉）只歸檔了判斷書，修改留到下一個任務。
