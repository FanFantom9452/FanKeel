---
label: docs
title: 流程圖由腳本生成並防漂移
description: docs 的流程圖用腳本生成 mermaid，docs-audit 比對防漂移；station 用 cytoscape 讓人逐層鑽入
state: blocked
link: docs/README.md
group: 另一個專案先做流程圖
timing: after: 使用者在另一個專案把流程圖生成做出來
stamp: 2026-10-05
---

來源：2026-10-05 TODO 全表盤點 session 的討論。想法：docs 裡各 stage 的流程不再手畫，用腳本從程式裡的 stage 表生成 mermaid 圖，docs-audit 比對生成結果與頁面，不一致就報漂移；station 用 cytoscape 畫可展開的流程圖，借 LevelMark 的 detail 與狀態色。要先決定：圖放哪幾頁、腳本讀哪些資料、station 要不要新增依賴（package.json 目前沒有 dependencies）。完成條件：決定寫下來；選做就有生成腳本、漂移檢查與測試。

2026-10-05 session 0461c799 開工時，使用者決定先擋住：流程圖之後用另一個專案來做，做出來再回頭看這裡要不要照搬。
