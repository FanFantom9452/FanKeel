---
label: judge
title: ask 結果看不到也看不懂
description: /fankeel-ask 回覆只有四行加判決檔路徑，使用者看不到判官分析了什麼；需要時也該能產出視覺化 HTML，而不只是 MD 檔
state: ready
link: skills/fankeel-ask/SKILL.md
---

來源：2026-10-28 用 /fankeel-ask 評估 Alibaba 的 OCR（open code review）對 fankeel-reviewer 的借鑑價值。判官回答後，主控照 skills/fankeel-ask/SKILL.md 的 Output 只回四行（judged/model/filed/accepted），判決全文只寫進 docs/90-agent/judgements/2026-10-27-ocr-reviewer.md；使用者說「他直接寫成 MD 檔案回去了，我也不知道他到底分析什麼」，必須再追問一次才得到白話解釋。另外有些分析（逐項對照表、基準數據、架構比較）做成視覺化 HTML 頁會比 MD 好讀。

要變成什麼：(1) ask 的回覆除了四行，要讓使用者當下看得懂判官的結論與理由——例如附判決的白話摘要，或在 station 開一頁判決；同時不違背 skill「別把整份判決重貼進 context」的初衷，要決定摘要的長度上限與放哪裡。(2) brief 可宣告想要 HTML 產物（或由題型決定，如比較表、數據），判官或主控派人產出一頁自含 HTML（沿用 station 或 fankeel-explain 的既有樣式，不新增依賴），歸檔在判決旁並在回覆中給路徑。

要參考的（使用者 2026-10-28 指定）：ELI5（像對五歲小孩解釋：先一句白話講結論，比喻與例子在前、術語在後；倉庫內尚無出處，動手前先找一個具體的 ELI5 skill 或寫法來源）；archify（判決 docs/90-agent/judgements/2026-10-26-archify-vs-chartroom.md，看它把分析畫成架構圖的做法）；我們自己的 Chartroom（lib/chartroom/、lib/board.js、station 的 `/station/board/<sessionId>/<name>.svg` 與畫 mermaid 的 assets/station/diagram.js，見 docs/90-agent/reference/station.md:699-704）——HTML 頁的圖優先用 Chartroom，不另引新依賴。

要決定的：摘要由判官的 Summary 截取、還是主控另寫；HTML 由誰寫（writer？implementer？）、何時值得做。

完成條件：下一次 /fankeel-ask 回覆後，使用者不必追問就能說出判官的 pick 與主要理由；一題指定 HTML 的 ask 會產出可直接開啟的 HTML 頁且路徑出現在回覆裡。
