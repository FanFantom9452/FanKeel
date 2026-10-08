---
label: render
title: 本地模型篩渲染審查
description: 本地判斷模型當渲染審查前的篩子：moondream2（`ollama run moondream`）判畫面是否正常、UI-TARS 驅動頁面；兩者都沒在本機試過，Jev 是雲端不吃圖 — [agents/fankeel-render-reviewer.md](agents/fankeel-render-reviewer.md).
state: watch
link: agents/fankeel-render-reviewer.md
group: sonnet 花費成瓶頸或要離線
timing: if: 渲染審查的 sonnet 花費成了瓶頸，或需要離線跑
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 176 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：本地判斷模型當渲染審查前的篩子：moondream2（`ollama run moondream`）判畫面是否正常、UI-TARS 驅動頁面；兩者都沒在本機試過，Jev 是雲端不吃圖

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條原本的前提是「moondream2 與 UI-TARS 都沒在本機試過」（決策頁 `docs/03-decisions/2026-09-23-render-review.md:20` 就是這樣寫），這句已經過時。2026-09-28 的試跑 `docs/90-agent/reports/2026-09-28-local-judge-trial.md`（commit 2af091e2）跑過了：moondream 對十張圖，正常的五張全判對，壞的五張只抓到一張（`broken-d`），門檻是四張以上，所以不夠當篩子；UI-TARS 在 `ollama pull` 時被擋（跨主機 redirect），一題都沒問到。

所以還開著的只剩兩件事：UI-TARS 沒有結果，以及渲染審查的 sonnet 花費是否成了瓶頸（`agents/fankeel-render-reviewer.md` 現在是 `model: sonnet`）。等花費或離線成為實際問題時，先換一條能拉到 UI-TARS 的路（例如手動下載 gguf 再 `ollama create`）。直接重跑 `docs/90-agent/reports/evidence/2026-09-28-local-judge-trial/judge.sh` 沒有用：它第 23 行寫死 `ollama run moondream "$PROMPT" "$f"`，十張圖也寫死，模型不是參數，重跑只會重現 moondream 的一抓五。所以要先讓 judge.sh 把模型當參數（改第 23 行）。完成的標準：用 UI-TARS 的模型名帶進參數的那次執行，所產生的 `results.tsv` 顯示壞圖抓到四張以上、正常圖誤判一張以下，就寫進渲染審查；達不到，就以這份 tsv 為證結案。
