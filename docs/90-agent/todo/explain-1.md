---
label: explain
title: 任務做完看得懂它做了什麼
description: Karpathy 四層做法（受控語言、圖、HTML、影片）只套在主 session、提問與 docs 三處
state: done
link: skills/fankeel-explain/SKILL.md
done:
  at: 2026-10-05
  sha: ba05309c
  disposition: done
  session: 7dd8cae1-9f94-407e-bc69-ca3f51c93296
---

來源：2026-10-05 使用者在 TODO 全表盤點的 plan 階段中提出（session 8c77b36e），貼了 Karpathy 的一段話：模型越強，人越要花時間看懂它的輸出。文中由淺到深列了四層做法：一是用受控語言寫（ASD-STE100，航空維修文件用的，句子短、用字受限）；二是能畫圖就不寫；三是直接交 HTML 網頁，可以互動、有動畫；四是為題目做講解影片（3Blue1Brown 風格，旁白用本機的免費 TTS）。使用者要的是：每個任務完成後，看得懂它做了什麼。只套在三處：主 session 對使用者說的話、Claude 的提問（AskUserQuestion）、docs 文件，其他邏輯維持原樣。要先討論再定：四層各用在三處的哪裡；哪些已經有了（fankeel-explain、fankeel-writer、station 頁、render 腳本）；受控語言要寫成規則，還是交給 checker 檢查。

討論結果（2026-10-05，同一 session，使用者逐題選定）：
- 存放處：有 TODO 條目的任務，land 時在條目檔底下寫一段白話完成紀錄，附上這次的 commit 清單。land 時的對話與 station 任務卡都只讀這段來顯示，不另存。沒有 TODO 條目的任務，紀錄只留在 registry。
- 受控語言：寫一份中文版受控規則（一句一件事、限句長、先講結果、不用代號、寫誰做了什麼），再讓 `gateProblem` 與 docs-check 擋超長句與裸代號。只寫規則不夠。
- 影片：放 Watch，另開一條「發版時做講解影片」。
- 完成紀錄的四個限制：一條可能對多個 commit，記清單不記單一 sha；紀錄不寫 path:line，免得 todo 的行號檢查在程式改動後誤報；紀錄寫好就不再改；寫紀錄的 commit 記不到自己的 sha，只列做事的 commit。

還要在 design 定的：中文受控規則的條文與句長上限、checker 擋在哪幾處、完成紀錄的格式、station 任務卡的版面。完成條件：照上面的方向走完 design 並做完，然後關閉本條。

## 完成紀錄

給人看的中文現在有一份受控規則：一句只講一件事，一句最多 160 欄，先講結果，不用代號。plain.js 負責檢查。gate 會退回太長的句子和裸代號，docs-check 對給人看的頁面和完成紀錄做同樣的檢查。todo.js done 現在可以寫白話的完成紀錄，station 的 TODO 面板對已完成的條目只顯示這一段。講解影片另放在 Watch 裡。

- commit cb967f2f
- commit 5bfabb83
- commit cd53193e
- commit 68d5f69b
- commit cf98b4f6
- commit 050fdec9
- commit f06e9daf
- commit ba05309c
