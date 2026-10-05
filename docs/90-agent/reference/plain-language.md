---
status: current
last_verified: 2026-10-05
source_of_truth: lib/plain.js, lib/prose.js
---

# 中文受控規則

這頁的五條規則是 profile 的 `prose.style` 設成 `plain` 時的寫法，規則文字在 `lib/prose.js` 的 `STYLES.plain`。其中句長（第 2 條）和不用代號（第 4 條）由程式檢查，不論選哪種風格都適用：主 session 對使用者說的話、gate 的提問與選項、guide 目錄的頁面、TODO 條目的完成紀錄。

做法取自航空維修文件用的受控英語（ASD-STE100）：句子短、一句一件事、用字固定。

## 五條規則

1. 一句只講一件事。兩件事就寫兩句。
2. 一句最多 160 欄，中文字一個算兩欄，也就是大約 80 個中文字。
3. 先講結果，再講原因。
4. 不用代號。TODO 條目寫它的標題，task 寫它做什麼；hex 一定要在前面寫 commit 或 session。
5. 寫誰做了什麼。主詞是人、agent 或某支程式，不寫「已處理」這種看不出是誰的句子。

## 哪裡會擋

- 受控 stage 的 gate：`lib/handoff.js` 的 `ruleProblem` 在最後呼叫 `proseProblem`，第一個違規的欄位會讓 gate 被退回，訊息寫出欄位與原因。
- docs-check：`proseFindings` 檢查 audience 是 `human` 的 reference 頁，以及 TODO 條目 `## 完成紀錄` 以下的段落，回報 `long-sentence` 與 `bare-code`。

程式碼片段（反引號裡的字）與連結的目標不算句子，也不算代號：寫在 code 裡的名字是引用，不是稱呼。

句子的切點是 `。！？；|`，以及後面接空白的 `. ! ? ;`。

## 完成紀錄

有 TODO 條目的任務，land 時在條目檔底下寫一段 `## 完成紀錄`：用白話說這次做了什麼，最後列出做事的 commit。

- 一條紀錄可以對多個 commit，記清單，不記單一 sha。
- 紀錄不寫 `path:line`，免得程式改動後 todo 的行號檢查誤報。
- 紀錄寫好就不再改。
- 寫紀錄的 commit 記不到自己的 sha，所以只列做事的 commit。

station 的 TODO 面板在已完成的條目上只顯示這一段；沒有這一段的舊條目，照舊顯示整個 body。
