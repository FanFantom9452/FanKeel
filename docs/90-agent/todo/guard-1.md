---
label: guard
title: 唯讀 agent 無任務時不擋
description: hooks/guard.js:55-57 在 mine 不存在或 active 不是 true 時直接 return，排在唯讀 agent 的寫檔檢查之前，所以沒有作用中任務的 session 派出的 fankeel-reader 等唯讀 agent，Bash 寫檔不會被拒
state: decision
link: hooks/guard.js
---

2026-10-18 判官清單版量測時，三版判官的讀者都確認了這條路徑：父 session 沒有作用中紀錄時，guard 在第 55-57 行就 return，讀不到後面 READ_ONLY_AGENTS 的寫檔檢查。唯讀合約跟兩個 session 是否重疊無關（註解自己這麼說），所以檢查大概該移到 active 判斷之前；但這樣每個沒開 fankeel 的終端機都會多跑一段，要先決定值不值得。完成的樣子：沒有作用中任務時，唯讀 agent 的寫檔指令一樣被拒，並有測試釘住。
