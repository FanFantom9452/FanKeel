---
label: guard
title: 唯讀 agent 無任務時不擋
description: guard hook 在 mine 不存在或 active 不是 true 時直接 return，排在唯讀 agent 的寫檔檢查之前，所以沒有作用中任務的 session 派出的 fankeel-reader 等唯讀 agent，Bash 寫檔不會被拒
state: done
link: hooks/guard.js
done:
  at: 2026-10-19
  sha: ff0d3ea5
  disposition: done
  session: 1452cf01-6856-4dc9-a1d7-2ba349b40338
---

2026-10-18 判官清單版量測時，三版判官的讀者都確認了這條路徑：父 session 沒有作用中紀錄時，guard 在第 55-57 行就 return，讀不到後面 READ_ONLY_AGENTS 的寫檔檢查。唯讀合約跟兩個 session 是否重疊無關（註解自己這麼說），所以檢查大概該移到 active 判斷之前；但這樣每個沒開 fankeel 的終端機都會多跑一段，要先決定值不值得。完成的樣子：沒有作用中任務時，唯讀 agent 的寫檔指令一樣被拒，並有測試釘住。

## 完成紀錄

唯讀的子代理在沒有進行中任務時想寫檔，現在一樣會被擋下；能寫檔的代理與主對話不受影響，並補上兩邊的測試。

- commit a96c8e2d
- commit ff0d3ea5
