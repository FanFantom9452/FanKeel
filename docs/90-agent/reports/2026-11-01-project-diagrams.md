---
status: decision
last_verified: 2026-11-01
---

# 七段流程頁與整體架構圖重畫（11-01）：做了什麼、沒做什麼

一句話：seven-stages.html 換上新的七段流程圖與八張步驟卡；layout.md 的框架圖擴成整個專案的架構 mermaid，station 用 pele 畫得出來。

一份計畫：[2026-11-01-project-diagrams.md](../../99-archive/2026-11-01-project-diagrams.md)（2 個任務）。

## 經過

使用者要重畫專案的 mermaid 圖，並重做先前設計的 HTML 流程圖。survey 確認對象是 11-01 交付的 seven-stages.html 與 layout.md 的框架圖。
design 先出一頁 mockup，使用者調過一次：架構圖下半部拖不到，以及每段都要拆出細步驟（例如 audit 跑哪個腳本、做什麼）。
plan 的 reviewer 找到五個缺口，全部補上測試或說明後才進 build。

## 做了什麼

- seven-stages.html：主線、關卡、VERIFY 退回 BUILD 與三條分類線重畫；每段節點連到下方步驟卡，八張卡寫出每一步跑的腳本或 agent：`967cd9e3`。
- layout.md：框架圖補上 skills、agents、hooks、registry 與 scripts，chartroom 接回 station 與週報：`5558efd0`。
- 兩頁各自加了測試：分類線段數對 `lib/stages.js`、步驟卡、圖例與兩條 BUILD 線、架構圖必備節點。

## 驗過・沒驗過

快速套件 6115 通過；verify 的 adversary 沒有推翻任何一項。
架構圖每條邊的方向沒有逐條對過程式碼；layout 測試裡 chartroom 那條斷言只要求有一條對外邊，沒有指定是哪個節點。
