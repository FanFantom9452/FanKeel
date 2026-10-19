---
status: current
last_verified: 2026-10-19
source_of_truth: agents/fankeel-slimmer.md
---

# 記憶規則與 pstack 並比 — 2026-10-19

一句話：TencentDB 判決借來的四條記憶規則與 pstack 判決沒有衝突，只在兩處重疊——常駐索引設數量上限、耐久內容先成提案再經使用者核准；四條全部在第三輪 patrol（2026-10-19）建，pstack 與記憶相關的兩條建議（land 回顧、規則↔強制表）也在同一輪建，從逐字稿自動寫記憶兩份判決都不採用。

## 1. 比什麼

- [TencentDB-Agent-Memory 判決](../judgements/2026-10-18-tencentdb-agent-memory.md) 第五節與第十節的建議，TODO `memory-1` 把它們歸成四條。
- [cursor/plugins（pstack）判決](../judgements/2026-10-18-cursor-plugins-pstack.md) 對照表中碰到記憶或每輪讀入的列：#14、#15、#31、#36、#39。
- 下文的 Task 編號是第三輪 patrol 計畫的編號。

## 2. TencentDB 的四條

| # | 建議 | pstack 對應 | 重疊 | 衝突 | 優先 | 本輪 |
|---|---|---|---|---|---|---|
| 一 | `MEMORY.md` 最多 20 條，滿了先 merge 再新增 | #31 continual-learning：AGENTS.md 每節最多 12 條、語意去重 | 兩邊都給常駐索引設數量上限 | 無：上限只是規則，不帶自動寫入 | 高：每輪都讀，條目數就是每輪的 token | 建：Task 8（slimmer 的上限與 merge 優先）、Task 9（`input-check.js` 印 `entries: N of 20`） |
| 二 | land 寫記憶前四選一：store／update／merge／skip，並列出四類不收錄 | #14 reflect：先提案，使用者核准後才改 | 兩邊都讓耐久的學習先成提案再落地 | #31 從逐字稿自動寫記憶，與 fankeel「land 是唯一寫點」衝突；照 fankeel，不採 #31 | 高：寫點只有一個，閘設在那裡最省 | 建：Task 8（`skills/fankeel-land/SKILL.md` 第 4 步） |
| 三 | slimmer 單次移除不超過記憶檔的三分之一 | 無 | 無 | 無 | 中：便宜的保險絲，平常不觸發 | 建：Task 8（slimmer 的 Refuse） |
| 四 | `input-check.js` 報條目數；`memory-check.js` 報跨檔近重複並追 `[[name]]` 連結 | #39：用 `input-check.js` 量每次讀入的文字 | 同一支工具：#39 量 stage skill（`--skills`），這條量 `MEMORY.md` | 無 | 中：讓規則一、三有數字可依 | 建：Task 9 |

## 3. pstack 與記憶相關的列

| # | 建議 | 與四條的關係 | 判決等級 | 本輪 |
|---|---|---|---|---|
| 14 | land 收尾可選派一個讀逐字稿的回顧 reviewer，以 diff 提案改 skill 或 `CLAUDE.md` | 與規則二重疊：都是提案加核准。回顧的提案落到 skill 或 `CLAUDE.md`；耐久事實仍走規則二的四選一 | B | 建：Task 7，只在使用者說要時跑 |
| 15 | 一張表：每條注入規則由哪個 hook 或腳本強制 | 本輪四條裡，一與四有腳本報數字但不擋，二與三只是文字；表上照實寫 | A | 建：Task 6 |
| 31 | 從逐字稿自動寫記憶 | 與規則二衝突，也是 TencentDB 判決第六節拒絕的 hook 式自動寫入 | C | 不採：兩份判決一致 |
| 36 | 從逐字稿生個人工作模式 | 無 | C | 不採 |
| 39 | 量每次讀入的文字，再瘦身 stage skill | 與規則四共用 `input-check.js` | B | 建：Task 2（skill 瘦身） |

## 4. 沒挑的

- TencentDB 第十節第 1 步：跑一次 slimmer，把現有四條 fat hook 縮短。這是一次執行，不是改動；本輪建完後由使用者在 `/fankeel` 的輸入量警告閘門決定。
- 第十節第 5 步：`lib/render.js` 在超過上限時加提示。那條警告看的是 token，條目數已由 `input-check.js` 印出，再印一次是重複。
- 第十節第 6 步：補 `docs/90-agent/reference/improvement-brief.md` 的「6.1 memory 清理」。那是文件真偽，屬 audit。
- 第五節第 4 點後半：slimmer「無可刪」固定成一行。它回覆的第一行本就是 before → after，零節省已經說明了。
- heat、proxy、自動寫入、offload：TencentDB 判決第六節已拒絕，理由不變。

## 5. 近重複的門檻

`memory-check.js` 的近重複，比的是兩檔 name、description 與本文的詞集合 Jaccard（漢字一字一詞，其他取三個字元以上的字母數字串），門檻 0.5。2026-10-19 量本專案四個記憶檔，六對中最高 0.165，是互相 `[[...]]` 引用的那兩檔；同一件事換句話寫的兩句測試樣本是 0.72。近重複只列出、不讓 exit 非零，誤報的代價是一行。
