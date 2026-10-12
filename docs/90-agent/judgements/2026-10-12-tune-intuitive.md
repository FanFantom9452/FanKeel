---
judged: 2026-10-12T10:30:33.005Z
model: fable
agent: fankeel-judge
task: "Pane 配色與右欄重新規劃 (pane-3) 為主,順便 TODO 全表盤點"
session: 88d97abd-517b-4278-93fd-55c331259f41
stage: design
---

# Brief: 逐塊調整工具（tune）怎麼變直覺

## Question

# Brief: 逐塊調整工具（tune）怎麼變直覺

## 問題

fankeel 的 design 站畫完 mockup 後，使用者在頁面上用一個浮層「逐塊調整」：點右下角標誌、新增一則、點頁面上的元素、寫一句備註、全部送出；session 那頭 `tune.js wait` 收到請求，派 agent 只改被點到的 `data-block`。

2026-10-12 使用者實際用了一次，結果是：

- 他點了三則：第 1 則點到 `div.term.band`（整個終端外框，比任何 `data-block` 大一層）；第 2 則點到 `div.term.pane` 與一列 `div.r`；第 3 則點到一列 `div.r`（在 `data-block` 裡面的單列）。
- 三則都寫了備註，按「全部送出（3 則）」，整批被拒，浮層底部一行小字：`a static page takes a data-block element on an html file under the served directory`。沒有說是哪一則、哪個元素不行，也沒有說該改點什麼。備註送不出去，他只好截圖貼給 session。
- 他的原話：「這樣我的逐塊調整不就很尷尬嗎? 這個要記錄到 TODO 吧 不然每次都這樣 就失去逐塊調整工具的意義了 然後逐塊調整工具還不夠直覺」

要你判的是：這個工具的選取、備註、送出流程該怎麼改，才不會再發生這件事，而且整體更直覺。答案會寫進一筆 TODO 條目，這次任務不會動到 tune。

## 請自己讀，不要只信這段摘要

- `assets/tune/overlay.js`（794 行）— 浮層。`blockOf`／`blockName` 在 :170-180，`pickable` 在 :194（任何 body 以下、不屬於浮層的元素都可點）。請讀選取、往外一層、托盤、送出與錯誤顯示的部分。
- `scripts/tune.js`（454 行）— 伺服器與 `wait`／`done`。拒絕在 :170-171：靜態頁上任何一則沒有 `block` 就整批 400。live 模式（`--proxy`）則接受 `selector`。
- `tests/tune.test.js:494` 附近 — 這個拒絕的測試。
- `skills/fankeel-design/SKILL.md` 第 3 步 — 流程怎麼教 session 用它，以及 mockup 該怎麼標 `data-block`。
- `agents/fankeel-mockup.md` — mockup agent 被要求怎麼寫 `data-block`。
- `docs/90-agent/todo/` 裡的 tune-1、tune-2（都已 done）— 之前改過什麼。
- `.fankeel/build/2026-10-12-pane-band/mockup.html` — 這次出事的頁面：`data-block` 掛在包住多列的 `div` 上，外框 `div.term.band`／`div.term.pane` 與單列 `div.r` 多數沒有。

## 什麼算一個答案

1. 這次失敗的根因是哪一個，或哪幾個的組合：浮層讓人點了不能送的東西、伺服器整批拒絕、錯誤訊息、mockup 的 `data-block` 粒度。每個一句，附 `path:line`。
2. 一個修法，不是清單：選取時該發生什麼（例如點到沒有名字的元素時自動落到最近的 `data-block`、或外框自動代表它裡面全部的 block、或靜態頁也收 selector），送出失敗時該發生什麼（備註不能丟），錯誤怎麼說。說明為什麼是這個而不是另外兩個最接近的做法。
3. 「不夠直覺」：讀完浮層後，指出使用者第一次用最可能卡住的三個地方（按發生順序），各給一個最小的改法。不要重新設計整個浮層。
4. 這筆 TODO 該寫成一筆還是拆開，各自的完成條件（哪個測試現在紅、改完綠）。
5. 你拿不準的，最多兩題，附傾向。

## 回答的形狀

繁體中文。先一句結論，再照 1–5 的順序。程式裡的概念用程式裡的名字。引用檔案寫 `path:line`。
全文不超過 700 字。不要改任何檔案。

## Answer

結論：浮層放行了送不出去的元素，伺服器又整批拒絕不點名；修法是圈選時就把每個 pick 解析成 block，解析不到的當場不給點。

1. 根因
- 浮層 `pickable` 只擋 body 與自己（assets/tune/overlay.js:194）；外框 `blockOf` 回 null（:170），`describe` 送出 `block:''`（:302）；hover 標籤沒名字就什麼都不說（:290）。
- 伺服器一則缺 block 就整批 400，訊息無則號無元素（scripts/tune.js:170）；`blocks` 只在 >1 時保留（:161），首 pick 無名、次 pick 有名的那則也算缺。
- `sendErr` 原樣貼英文（overlay.js:550），不像缺備註會標出那一則（:521）。
- mockup 把 `data-block` 掛在包多列的 div（mockup.html:123、:196），外框（:122）與區塊間空列 `div.r`（:204）無名；B0 band 卻掛在單列（:176），一頁兩種粒度。

2. 修法
圈選時解析：在 block 內→該 block（現狀）；自身含 block→`querySelectorAll('[data-block]')` 全部，chip 寫「外框·N 塊」；皆無→框轉琥珀、標籤寫「沒有 data-block，往外或往內一層」，click 不加入。`itemsOf` 以解析後的 union 填 `block`/`blocks`。伺服器 :170 改逐則檢查，訊息 `item 1: div.term.band 不在任何 data-block 內`，並取 `block||blocks[0]`。失敗時草稿已留著（:548），再照 :521 把那一則標紅、queue line 用中文點名與下一步。
不收 selector：`done` 只能靠 block 名守界（scripts/tune.js:357→lib/tune.js:53），agent 也按名字改（agents/fankeel-mockup.md:45）。不限只能點 data-block 元素：會丟掉單列的 `selector`/`text`，那是 agent 定位那一行的依據；點外框說「整個 pane」也自然。

3. 卡點
① hover 永遠框最內層 span（:614），看不出哪裡能送：琥珀標籤。
② 往外一層/完成這則在左上 hint（:141），托盤在右下，備註欄要「完成這則」後才出現（:380）：圈選中就給 textarea，兩鈕搬進該則 row。
③ 失敗只有一行英文（:550）：點名＋標紅。

4. 拆兩筆
tune-3 正確性：解析＋逐則點名。紅→綠：tune-overlay.test.js 加「點外框得內層全部 blocks、無名元素不加入」（:404 現只擋 body）；tune.test.js:494 改斷言含 `item 2` 與元素名。
tune-4 直覺：textarea 與鈕進 row；加「picking row 有 textarea」測試；外加使用者真機用一次。
mockup 粒度不開 TODO，寫進 agents/fankeel-mockup.md：外框與空列也掛名，`outside` 支援巢狀（lib/tune.js:58）。

5. 拿不準
- 外框展開後「整個 pane 換配色」會動到空列（:204），`done` 判 `(區塊外)` 退回；傾向外框本身也掛名，浮層優先用它。
- hover 要不要預設吸附最近 block；傾向不要，會藏掉單列 pick。
未全讀：agents/fankeel-mockup.md 與 mockup.html 只讀 data-block 相關段落。
