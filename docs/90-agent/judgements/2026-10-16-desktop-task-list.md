---
judged: 2026-10-16T05:12:11.110Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 9cf97941-93c8-4fcb-9cf2-8ef92f52eff5
stage: build
---

# 判官題：對話裡那張勾選清單是誰畫的？

## Question

# 判官題：對話裡那張勾選清單是誰畫的？

## 問題

使用者在 Claude Desktop（Code 分頁）截圖，圈起對話裡的一張清單，問：「這個到底是什麼？為什麼會有這個東西？是我們 STAGE 定義的嗎？」

圈起來的清單，每一列前面是空心或虛線圓圈：

- 讀相關程式與上一份盤點計畫
- 產生 Global Constraints
- 寫計畫檔
- intends、lint、reviewer
- plan 關卡

它出現在主 session 的回覆中間，就在「正在讀程式碼準備寫計畫。」這句之後。那時 fankeel 任務在 plan 站。

## 已知的事實（主 session 提供，判官請核對 repo 這一側）

1. 主 session 由 Claude Desktop 的 Code 分頁啟動。這個宿主的系統提示要求模型維護一張任務清單，工具是 `mcp__ccd_turn__update_plan`，參數有 `items`、`advance`、`done`、`start`、`scope`。原文大意是：使用者看的是 app 釘在最新訊息下方的任務清單，不是讀訊息；凡是要改檔或跑多個指令的請求，回合的第一個工具呼叫就要一起送出整份計畫；每走完一步用 `{"advance": true}`；最後用 `mcp__ccd_turn__wrap_up` 收尾。
2. 這五列的文字是主 session 在進 plan 站後自己寫的，送進 `update_plan` 的 `items`。進 build 站後，主 session 又送了一份新的：「開分支、提交計畫、開 ledger／Task 1 與 Task 2 實作與審查／Task 3 實作與審查／整支審查、快速套件、docs-check／build 關卡」。
3. 截圖裡另外有 fankeel 自己的東西：右側 Pane（`hooks/pane.ts`）上方的路線點 survey→plan→build→verify→land，以及輸入框上方的 band（`FANKEEL PLAN ●-○-○-○-○`）。這兩個是 fankeel 的 mod 畫的。

## 請判官讀

- `F:/ymlab/fankeel/lib/stages.js`：各站注入的規則。請確認裡面沒有任何規則要求畫這種勾選清單，也沒有提到 `update_plan`、`ccd_turn`。
- `F:/ymlab/fankeel/skills/fankeel/SKILL.md`、`F:/ymlab/fankeel/skills/fankeel-plan/SKILL.md`、`F:/ymlab/fankeel/skills/fankeel-build/SKILL.md`：同樣確認。
- `F:/ymlab/fankeel/hooks/pane.ts`、`F:/ymlab/fankeel/hooks/pane-status.ts`：確認 Pane 畫的是右側那一塊，不是對話裡的清單。
- 主 session 已經對 `lib hooks skills scripts` 跑過 `grep -rn "update_plan\|ccd_turn"`，沒有命中。

## 什麼算答案

一個判斷，給使用者看，用繁體中文：

1. 這張清單是誰畫的：Claude Desktop 宿主、fankeel，還是兩者都有份。
2. 為什麼會有它。
3. 它跟 fankeel 的 stage 是什麼關係：是 stage 定義的，還是主 session 把 stage 的步驟填進宿主的清單。
4. 它和 fankeel 自己的進度顯示（Pane 的路線點、band 的 `●○○○○`）有沒有重複；如果重複，fankeel 這一側能做什麼、不能做什麼。宿主的系統提示 fankeel 改不了，但 fankeel 可以影響主 session 填進去的內容。

## 回覆格式

- 第一行：一句結論。
- 「依據」：每一點附 `path:line`，或寫「宿主系統提示（主 session 轉述）」。
- 「建議」：至多三條；沒有就寫「無」。

整份 300 字以內。

## Answer

pick: 宿主畫的——Claude Desktop Code 分頁的系統提示要主 session 用 `mcp__ccd_turn__update_plan` 維護清單；fankeel 沒有這條規則，是主 session 把 plan 站的規則抄成五格填進宿主的清單。
why: 依據：全 repo grep `update_plan|ccd_turn|wrap_up` 零命中；`F:/ymlab/fankeel/lib/stages.js:277-297` plan 站規則與 template 只要求寫計畫檔、intends/lint/reviewer、AskUserQuestion，沒有勾選清單；`F:/ymlab/fankeel/skills/fankeel-plan/SKILL.md:375-390` 同。五列逐一對上 `stages.js:278`（讀 map、Global Constraints、寫計畫檔）、`:281`（intends、lint、reviewer）、`:119`（關卡）：是主 session 把 stage 步驟填進去，不是 stage 定義的。
Pane／band：`F:/ymlab/fankeel/hooks/pane.ts:515-555` 畫輸入框上方 band（`hooks/pane-band.ts:106-109` 的 ●○），`:557-599` 畫右側 Pane；`F:/ymlab/fankeel/hooks/pane-status.ts:173-195` 畫路線點、`:240-283` tasks 塊只在有 ledger 時列 `## Task N:`。兩者都不寫進對話。
重複：路線點是「站」粒度，宿主清單是「站內步驟」粒度，plan 站不重複；build 站主 session 填的「Task 1/2/3 實作與審查」會與 Pane tasks 塊重複。
建議：(1) 不動——宿主系統提示 fankeel 改不了；(2) 若要收斂，`stages.js` 加一行要主 session 以 route 站名或 plan `## Task N:` 標題填清單，但注入已貼 2400 字上限（`stages.js:105-107`），得拿別的字去換。
would flip if: 宿主提示的轉述有誤——`update_plan` 若來自某個 MCP 或 plugin 而非宿主，來源就變；或 `~/.claude` 下其他 plugin／CLAUDE.md 帶 `ccd_turn` 規則（未查）。
unread: `hooks/pane-band.ts` 只 grep 到 106-109 未讀全文；`tests/render.test.js`、`~/.claude` 其他 plugin 與 CLAUDE.md 未查。
