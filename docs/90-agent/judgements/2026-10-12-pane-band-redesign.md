---
judged: 2026-10-12T10:32:49.303Z
model: fable
agent: fankeel-judge
task: "Pane 配色與右欄重新規劃 (pane-3) 為主,順便 TODO 全表盤點"
session: 88d97abd-517b-4278-93fd-55c331259f41
stage: design
---

# Brief: band 與 Pane 該怎麼重新設計

## Question

# Brief: band 與 Pane 該怎麼重新設計

## 問題

fankeel 在 Claude Code 裡畫兩塊：輸入框上方常駐的兩列（band），與右側的窄欄（Pane）。
使用者正在 design 站重新規劃兩者。他已經定的事：

- 分工：「進度相關的都設計在 band，詳細資訊、任務、衝突的檔案在 Pane」，要「直覺一些」。
- 配色選 B（每塊左邊一條固定色軌、內文用終端預設色），站內任務的呈現選 B1（band 寫站名加任務量表，Pane 只寫出正在跑與接下來幾個任務）。
- 右欄新增四項：gate 倒數、guard 模式、碰過檔數、Remote Control 狀態。
- 撞檔只算還活著的 session。

看完 B1 的 mockup 之後，他寫了三則備註，原話：

1. 對整個 band：「BAND 設計請你簡潔 我覺得全部寫 會不會很奇怪?」
2. 對整個 Pane 與其中 `⚿ guard deny · 12 檔` 那一列：「我覺得這個設計不好 要不要重新設計? 應該說 原本的TOKENBAR顯示機制其實就沒有很好了」
3. 對 Pane 的 context 那一列（`212k · 到 450k 自動 compact`）：「這塊改成長條圖吧 一樣顯示現在多少 K 這樣 但是這邊是提醒到了多少K 會自動壓縮 而不是 只有 450K這樣」

要你判的是：依這三則備註，band 與 Pane 的下一版該長什麼樣。這不是定案，你的答案會原文給使用者看，並成為下一版 mockup 的依據。

## 請自己讀，不要只信這段摘要

- `.fankeel/build/2026-10-12-pane-band/mockup.html` — 現在的 mockup。B0 是 `data-block="b-…"`，B1 是 `data-block="b1-…"`（`b1-band-5/15/30`、`b1-pane-tasks-5/15/30`、`b1-notes`）。頁首「現在的樣子」是今天的 band 與 Pane。
- `hooks/pane-band.ts:56-97` — 今天的 band 怎麼畫（第 1 列：徽章、●○ 圓點、guard、⚑、任務標題；第 2 列：next 或 gate、N 檔、N of M、分鐘）。
- `hooks/pane-status.ts:130-224` — 今天的 Pane 各塊；`hooks/pane-gate.ts` — gate 塊；`hooks/pane.ts:343-392` — 色調對照與畫法。
- `docs/90-agent/judgements/2026-10-11-pane-right.md` — 前一次判官對 Pane 內容的取捨（那把尺：「看到後會做什麼不同的事」）。
- `docs/90-agent/reference/statusline.md` — TokenBar 狀態列現在顯示什麼；使用者說它的顯示機制「本來就沒有很好」，請讀它再判斷他可能指什麼。
- `hooks/compact.ts` — 自動 compact 的門檻（`HARD`）怎麼來。

## 限制

- band 約 80 格寬、2 列；六站的站名全寫要 83 格，七站 91 格。Pane 在 Claude Desktop 實測 41 格 × 32 列。CJK 一字兩格。
- 引擎的顏色可用 hex 或佈景 key；hex 不跟著佈景變。
- registry 現有資料：stage、route、guard、claims、notes、next、clock、waited、moves、inflight；build 的 ledger 有 `tasks done of total`，plan 檔有任務標題。沒有「哪一個任務正在跑」、沒有 plan 站與 verify 站的細項。
- band 仍要有圓點（使用者前一輪明說）。

## 什麼算一個答案

1. band：兩列各放什麼，逐項列出，每項一句理由；放不下時先丟什麼。回答使用者「全部寫會不會很奇怪」：站名該全寫、只寫目前這站、還是別的。畫一個 80 格內的純文字示意，至少「平常」與「gate 在等」兩個狀態。
2. Pane：使用者說「這個設計不好」。指出 B1 的 Pane 最可能讓他覺得不好的兩三個具體原因（讀 mockup 判斷，不要泛論），再給一個重新設計：由上到下的塊、各塊幾列、哪些條件顯示。guard 與檔數那一列留不留、放哪。畫一個 41 格寬的純文字示意。
3. context 長條圖：畫出這一塊。要同時看得出現在用了多少、到多少會自動 compact、還剩多少；說明刻度怎麼定、顏色何時變、80% 起要不要換文字。41 格內的示意，至少 47% 與 96% 兩個狀態。band 上的 context 要不要用同一種畫法。
4. 你拿不準、要使用者回答才能定的，最多三題，每題附你傾向的答案。

## 回答的形狀

繁體中文。先一句結論，再照 1–4 的順序。程式裡的概念用程式裡的名字。引用檔案寫 `path:line`。
全文不超過 900 字（示意圖與表不計）。不要改任何檔案。

## Answer

pick: band 兩列只留「徽章＋圓點＋`tasks 2/5`＋分鐘」與「next 或 gate＋倒數＋`212k/450k`」，站名不寫；Pane 砍掉與 band 重複的 next 與分鐘，`⚿ guard deny · 12 檔` 拆成有標籤的 session 塊，agent 併入 tasks 列，context 改 18 格長條（刻度 0→HARD，80% 轉 amber），band 不畫長條。
why:
結論：band 只答「到哪、接下來、context 還剩多少」，Pane 只答「此刻要不要出手、細節是什麼」；TokenBar 式「符號＋光禿數字擠一列」兩邊都不再用。

**1. band**

第 1 列（進度）：
- `▌` 色軌：站色，撞檔變紅（hooks/pane-band.ts:63 照舊）。
- `FANKEEL BUILD`：站名只寫這一次，與 lead line 同形（docs/90-agent/reference/statusline.md:27）。
- `●●●●○○`：位置，使用者要的圓點。`4 of 6` 砍，與圓點同義。
- `tasks 2/5`：ledger 的 done of total，有 ledger 才畫。不畫 task 圓點：兩串圓點並排會混（B1 第 2 列、B4 第 1 列都是）。
- `本站 12 分`：站拖太久的唯一訊號。
- `⚑2`：活的 session 撞檔數（hooks/pane-band.ts:36）。

第 2 列（接下來）：
- `next` 全文，或 `gate 在等` 徽章＋題目＋`還 48 秒`（pending 的 `until`，hooks/pane-gate.ts:9）。
- 右端 `212k/450k`：現在／門檻，80% 起 amber 粗體。

全部寫站名會奇怪：六站 83 格，80 格就得截；徽章已寫現在站，圓點已給位置，別站的名字不改變下一步；只寫現在站又與徽章重複。所以不寫。
放不下先丟：`本站 N 分` → `tasks 2/5` → 截 next／gate 文字（最少 4 格，hooks/pane-band.ts:91）。徽章、圓點、⚑、倒數、context 不丟。

```
平常（80 格）
▌FANKEEL BUILD  ●●●●○○  tasks 2/5  本站 12 分
▌next  等使用者核准配色，再排 pane-status.ts 的改法                    212k/450k

gate 在等、撞 2 檔、96%
▌FANKEEL BUILD  ●●●●○○  tasks 2/5  本站 41 分  ⚑2
▌ gate 在等  Pane 的 route 行整行拿掉，還是留一行給窄終…  還 48 秒  432k/450k
```

**2. Pane**

B1 的 Pane 不好在：
(a) task 塊是舊 band 原樣攤開（hooks/pane-status.ts:4 自述）：`next` 兩列、`本站 12 分` 一列，band 第 1、2 列都有，六列重複三列。
(b) `⚿ guard deny · 12 檔` 正是 lead line 的寫法（statusline.md:27 `⚿ ask  ⚑2`）：符號＋字＋光禿數字，沒說 12 是什麼（其實是 `claims.length`，hooks/pane-band.ts:85），灰字夾在 next 與分鐘之間。四個新項目散在三處（這一列、gate 徽章、最底佔位），沒有一處是「這個 session 的設定」。
(c) `◉ 3 Pane task 塊改寫` 與下方 `agent 出去 12 分 · 第 2 組` 是同一件事畫兩塊，中間還隔著 context。

重設（由上到下）：

| 塊 | 列 | 何時 |
|---|---|---|
| task | 標題 wrap，1–2 列 | 永遠；不再有 next、分鐘 |
| gate | 徽章列含 `還 N 秒`，題目、選項照 hooks/pane-gate.ts:94 | 有 pending |
| ⚑ | 每檔 2 列：路徑、對方任務 @ 站 · 幾分 | shared 非空，只算活的 |
| tasks | `tasks N of M`＋B1 的窗，≤6 列：total ≤6 全列；否則完成折成 `✓ 完成 N`、◉ 列＋接下來 2 個＋`還有 N 個，1 個是你的`。◉ 列尾加 `· 出去 N 分`，≥20 分 amber（LONG，hooks/pane-status.ts:126） | 有 ledger；沒 ledger 但 inflight 指本站，退成一列 `agent 出去 N 分 · 第 N 組` |
| context | 2 列；≥80% 第 3 列 `留 …` | 有 usage |
| session | `guard`、`claims`、`remote` 各一列，標籤對齊 | 永遠；remote 讀不到就不畫那列 |
| notes | 最近 3 則 | 有 notes |
| foot | id · 關閉 | 永遠 |

guard 與檔數：留，但不再合寫一列，拆成 session 塊兩列。
不夠列時丟：session → notes → tasks 窗（留標題列）→ context（≥80% 不丟）；gate、⚑、task、foot 不丟。

```
平常（41 格）
▌Pane 配色與右欄重新規劃 (pane-3) 為主,順
▌便 TODO 全表盤點

▌tasks 2 of 5
▌● 1 band 站名三色
▌● 2 band 第二列加進度
▌◉ 3 Pane task 塊改寫 · 出去 12 分
▌○ 4 Pane clash 塊
▌◐ 5 真機看一次 · 你的

▌context  212k · 還 238k 可用
▌████████▍░░░░░░░░░ 到 450k 自動 compact

▌session
▌guard    deny
▌claims   12 檔
▌remote   已連線

▌notes
▌· Pane body 實測 41 × 32 格
▌· 判官已砍 touched 與沒撞檔的 session

▌88d97abd · /fankeel-panel 關閉

忙：gate、撞 2 檔、96%；session 與 notes 讓位（30 列）
▌Pane 配色與右欄重新規劃 (pane-3) 為主,順
▌便 TODO 全表盤點

▌ gate 在等  還 48 秒
▌Pane 的 route 行整行拿掉，還是留一行給窄
▌終端？
▌1  整行拿掉
▌   band 已經有三色 route，Pane 不重複
▌2  留一行
▌   band 被截掉時，Pane 還看得到路線
▌t  交給終端
▌ctrl+x tab 進面板，再按數字或 t

▌⚑ hooks/pane.ts
▌  station 頁加 Remote 列 @ build · 3m
▌⚑ hooks/pane-status.ts
▌  station 頁加 Remote 列 @ build · 3m

▌tasks 2 of 5
▌● 1 band 站名三色
▌● 2 band 第二列加進度
▌◉ 3 Pane task 塊改寫 · 出去 23 分
▌○ 4 Pane clash 塊
▌◐ 5 真機看一次 · 你的

▌context  432k · 還 18k 可用
▌█████████████████▎ 到 450k 自動 compact
▌留 task · stage · plan · agent · handoff

▌88d97abd · /fankeel-panel 關閉
```

**3. context 長條**

刻度 0→門檻：門檻是 hooks/compact.ts:8 的 `HARD` 450k 或 `FANKEEL_COMPACT_AT`（hooks/compact.ts:66），線性，18 格一格 25k，餘數用 ▏▎▍▌▋▊▉ 八分格。不是模型視窗——TokenBar 第 3 列的 `ctx 38%` 是模型視窗（statusline.md:29），刻度不同，所以長條旁必寫 `到 450k 自動 compact`。
第 1 列：現在 K 與還剩 K；第 2 列：長條＋門檻字。
顏色三態：<80% 長條用 context 塊軌色、數字預設色；≥80% 長條與數字 amber 粗體，加第 3 列 `留 …`（KEEP，hooks/pane-status.ts:124）；≥100% 紅，第 2 列字改 `已到 450k，compact 中`。九段 heat 色（hooks/pane-status.ts:121，36% 就變黃）砍掉：沒有一段告訴你該做什麼，三態才有。
80% 不換第 1、2 列文字，只加第 3 列：「到多少 K 會壓」是使用者要的常駐提醒，最需要時不該消失。

```
47%
▌context  212k · 還 238k 可用
▌████████▍░░░░░░░░░ 到 450k 自動 compact

96%
▌context  432k · 還 18k 可用
▌█████████████████▎ 到 450k 自動 compact
▌留 task · stage · plan · agent · handoff

≥100%
▌context  463k · 還 0k 可用
▌██████████████████ 已到 450k，compact 中
```

band 不畫長條，只寫 `212k/450k`：TokenBar 自己的 ctx 長條就在幾列之下、刻度不同，再畫一條會被當成同一件事；band 要簡潔，長條在 Pane 一處就夠。

**4. 要你定的**
1. `next` 只留 band，Pane 的 task 塊只剩標題？傾向：是。
2. context 的九段 heat 色砍成三態（預設／amber／紅）？傾向：砍。
3. Remote Control：mod 讀不到連線狀態前整列不畫，不放佔位？傾向：不畫。
would flip if: 實測 Claude Desktop 的 band 不到 70 格——`tasks 2/5` 與分鐘就得常態收掉，task 量表只剩 Pane；或 mod 真能讀到哪個 task 在跑，tasks 窗的 ◉ 就不必從 inflight 組號推。
unread: nothing
