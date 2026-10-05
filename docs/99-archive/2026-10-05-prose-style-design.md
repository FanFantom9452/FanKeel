---
status: current
last_verified: 2026-10-05
---

# 給人看的文字可以選風格：writer、plain、sepia 或自訂

session b86d9f75-9d42-4ff4-8d45-d3395ccb5ccb 的 design。這個任務先用一題 Express middleware 寫出三種風格的中英文六版（`.fankeel/build/task-20261005T062336/design.md`）。使用者看完後要三件事：把三種風格都存起來；選一種當預設；讓使用者用 profile 選風格，或輸入自己的規則，並告訴他建議的注入字數。這頁寫的是要做的事，不是現狀。

## 一句話

新增 profile key `prose.style`，值是 `writer`、`plain`、`sepia` 或 `custom`，內建 `writer`。所選風格的規則文字會注入站 agent 的 brief 和 writer 的 brief。兩項機械檢查不分風格，照舊擋下：句子不超過 160 欄，以及不用裸代號。

## 分兩層：固定的底線和可換的風格

使用者要「限制 workflow，但保留變通性」。所以這個設計把規則分成兩層。

- 底線不能換。`lib/plain.js` 的 `proseProblem` 照舊檢查每個 gate，`proseFindings` 照舊檢查 docs-check。兩者都只查句長和裸代號，不管寫法，所以任何風格都適用。
- 風格可以換。風格只是一段注入的規則文字。它決定段落或清單、句子長短交錯，以及要不要附可照抄的例子。風格沒有程式檢查，因為它本來就要求判斷。

## 三種內建風格

規則文字放在新檔 `lib/prose.js` 的 `STYLES`。每段都要在 `SUGGESTED` 字數以內，測試會量。

- `writer`：預設。這是 `agents/fankeel-writer.md` 現行的寫法：先結論後原因，每節說做什麼、為什麼，並附一個可照抄的例子。長度跟著風險走，可以列舉的東西用清單。預設選它有三個理由。第一，現行輸出不會改變。第二，三版中只有它附可照抄的程式碼。第三，它介於 plain 和 sepia 之間。
- `plain`：`docs/90-agent/reference/plain-language.md` 的五條規則。英文照 ASD-STE100 受控英語寫：短句、主動語態、一句一件事。
- `sepia`：取自 sepia 的 `professional-pass.md` 與 `style-pass.md` §5。長短句要交錯，不要整段短句。真正可以列舉的才用清單。結尾不要重述前文。規則文字照 sepia 改寫成 fankeel 自己的話，並註明出處，不在執行時讀 sepia 的檔案，因為使用者不一定裝了 sepia。

## 自訂

`prose.style custom` 讀專案的 `.fankeel/prose.md`，整個檔案就是規則文字。這和 `prompt.*` 的做法一樣：`task.js profile set prose.style custom` 會印出這段文字的字數、約多少 token，以及和 `SUGGESTED` 相比的結果。超過建議值只警告，不拒絕（`docs/01-guide/profile.md:65` 的 `prompt.*` 也是這樣）。超過硬上限 `MAX` 時，brief 改用 `writer`，並寫一行說明原因。檔案不存在時也一樣改用 `writer`。

建議值和硬上限由 plan 量出來再寫死。這頁先提出：`SUGGESTED` 等於三種內建風格中最長的那段，預期約 400 字；`MAX` 是 1200 字。

## 注入到哪裡

- 站 agent：`lib/render.js` 的 `renderBrief` 加一行，寫法和第 545–547 行的 `language` 那行一樣。
- writer：`hooks/brief.js` 現在只給 `fankeel-brain` brief（第 122 行）。這個設計要讓它也給 `fankeel-writer` 一段只含風格規則的 brief。SubagentStart 的上限是 10,000 字元，不受每輪 2400 的限制。
- 主 session 每輪的區塊不注入。那個區塊已經接近 2400 的上限，而且這個上限不能調高。所以主 session 直接對使用者說的話不受風格影響，這是刻意不做的部分。

## 文件

- 新增 `docs/90-agent/reports/2026-10-05-prose-styles.md`：Express middleware 的中英文六版，並用 `lib/plain.js` 的 `SPLIT` 量出每版的句數、最長句和句長標準差。這是報告頁，寫一次就不再改。
- `docs/90-agent/reference/plain-language.md:9` 現在說「寫給使用者看的中文照這頁寫」。改成：兩項檢查適用所有風格，五條規則是 `plain` 風格。
- `docs/01-guide/profile.md` 的 key 表格是產生的，會自動多一列。另外由 writer 加一節說明怎麼選風格、怎麼寫 `.fankeel/prose.md`。

## 怎麼算做完

新增 `tests/prose.test.js`。現在 `lib/prose.js` 還不存在，所以這個測試會失敗。做完後要通過以下幾項：

1. 沒設 `prose.style` 時，brief 含 `writer` 的規則文字。
2. 設成 `sepia` 時，brief 含 `sepia` 的規則文字，不含 `writer` 的。
3. 設成 `custom` 且有 `.fankeel/prose.md` 時，brief 含檔案內容。超過 `MAX` 或檔案不存在時，brief 改用 `writer`，並有一行說明。
4. 三段內建規則都不超過 `SUGGESTED`。
5. `profile set prose.style` 遇到未知的值會拒絕。
6. writer 的 SubagentStart brief 含所選風格。

## 沒有驗證的事

- 我沒有讀 `hooks/brief.js` 對非 brain agent 的全部處理，所以不知道多給 writer 一段 brief 會不會碰到現有的規則。
- 400 和 1200 是提議，還沒有量過。
