---
status: decision
last_verified: 2026-09-26
---

# todo-check 驗行號與主控倍數第一次實測：決策紀錄

一句話：`todo-check.js` 現在會檢查行號。`path:N`／`path:N-M` 形式的引用，行號超過檔尾就回報 `past end`；行數用 `docs-check.js` 匯出的 `lineCount` 算，不另寫一份。主控倍數 k 第一次實測結果：可比的三站 k 落在 2.29–2.74，破平衡點 2.5052 正好在這個範圍裡，一對數據定不了輸贏。

design 見 [../archive/2026-09-25-todo-line-and-multiplier-design.md](../archive/2026-09-25-todo-line-and-multiplier-design.md)，計畫見 [../archive/2026-09-25-todo-line-and-multiplier.md](../archive/2026-09-25-todo-line-and-multiplier.md)，量測結果見 [../reports/2026-09-25-controller-multiplier.md](../reports/2026-09-25-controller-multiplier.md)。

## 範圍

- `TODO.md` 的 `## Ready` 原本有四條。這次只做兩條：todo-check 驗行號、Sonnet 主控倍數。使用者在 design 站這樣劃範圍。
- 7d 水位那條退回 `## Waiting`，放在「TokenBar 寫出真實序列」下面，因為它要等 TokenBar 先寫出資料。security lens 那條留在 `## Ready`。
- 量測只跑一對：同一個 task 分別交給 opus 主控和 sonnet 主控，預算上限 $125。task 就用 todo-check 驗行號本身。實際花費 $42.84。

## 量測時的兩個 harness 問題

- `ab.sh` 在執行中被 build agent 改過。bash 是按 byte offset 讀執行中的腳本，改動後讀取位置錯開，sonnet 那一臂沒有跑。opus 那一臂的資料留在 `run1-opus-only/`，腳本修好後整對重跑。
- 重跑時，sonnet 臂自己在 verify 站執行了 `git stash push -u` 再 drop。這一步把沒 commit 的 `stage.agents` override 清掉了，於是 verify 站又派出 brain，那一站的數字不能和 opus 臂比，k 只算 design、plan、build 三站。最初以為是模型沒拿到主控規則，後來讀了 transcript 才確認是 harness 的問題；報告第 7 節有更正。

## verify gate 的選擇

使用者先選「先修 harness」。verify 站本身不 commit，而修 `ab.sh` 需要自己的 review range，所以不塞進這個 task。最後的處理是：核准這個 task，harness 修法以 `TODO.md` `## Ready` 的〔stage-agents〕條目另開一個 task。

## 其他

- docs-check 補上行號檢查後，第一次跑就抓到 design 裡的兩個示範引用（行號寫成五位數、遠超過檔尾的那種）。兩處都改寫，不再是可解析的 `path:N` 形式。
- audit 站只找到一處不完整：`docs/development.md` 描述 todo-check 的那段沒有提到 `past end`。在 land 站補上了。
