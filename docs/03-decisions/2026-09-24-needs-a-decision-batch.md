---
status: decision
last_verified: 2026-09-24
---

# Needs a decision 十五條一次定案 — 決策紀錄

design 見 [../archive/2026-09-23-needs-a-decision-batch-design.md](../99-archive/2026-09-23-needs-a-decision-batch-design.md)，
計畫見 [../archive/2026-09-24-needs-a-decision-batch.md](../99-archive/2026-09-24-needs-a-decision-batch.md)。
十四個 task 在 `6808b39..5b7bafe`，audit 的修正在 `0cd23c9`。

## 定了什麼

- **每條做最小的修改。** 十五條各在既有程式裡改一處，不另外加量測工具；
  第 5、6 條合成一條。
- **CLAUDE.md 那條的範圍在 design gate 被使用者擴大。** 初稿因為本 repo
  沒有 `CLAUDE.md` 就建議關掉；使用者的回答是「只要會影響到 INPUT TOKEN
  都要處理」——全域 `CLAUDE.md`、各專案的 `CLAUDE.md`、各專案的
  `MEMORY.md`。結果是 `scripts/input-check.js`：只列出、不判定、不改檔，
  由 `/fankeel-audit` 一起跑。
- **〔method〕兩條的候選改從 fankeel 自己的問題出發。** skill-repos 與
  ponytail 兩頁原本寫成「對方有、fankeel 沒有」，並要使用者挑「收哪幾條」。
  使用者在 verify gate 定調：以優化自己為主，對方的功能只是參考。所以先列
  fankeel 實際出過的問題，再看對方有沒有可參考的做法；對不上問題的候選就不問。
  挑選本身留到下一個任務。
- **〔security〕排在最後**，照 09-23 的排序：它牽涉開發方法，放在具體功能之後。

## 跑的時候抓到的

這些都已經寫進 `TODO.md` 的 `## Needs a decision`，本任務沒有修：

| 接縫 | 發生了什麼 |
|---|---|
| gate 的題數沒驗 | verify 的 gate 放了 5 題，被 `AskUserQuestion` 的上限 4 擋了兩次；`readGate` 只驗選項數 |
| `hooks/gate.js` 換掉主控自己問的題 | 受控的 verify 站裡，主控問的「開新任務？」被換成該站的舊 gate，使用者看到舊題 |
| 主控對不在 `stage.agents` 的站派了 brain | design 不在 `survey,build,verify` 裡，主控照 survey 的套路派了，gate 沒替換，使用者看到佔位題 |
| brain 不攢批提交 | 受控 build 主控替它提交了 19 次；`scripts/commit.js` 早就收 `---` 分隔的多組 |

audit 的三個 code lens 另外找到五條刪減（合計 net -36），寫在 `## Ready`。
