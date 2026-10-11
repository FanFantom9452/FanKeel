---
judged: 2026-10-11T20:51:17.540Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 12982116-4d5a-4c36-9e48-a2c032cbe77f
stage: plan
---

# Brief: fankeel 面板右邊的 Pane 到底該顯示什麼

## Question

# Brief: fankeel 面板右邊的 Pane 到底該顯示什麼

## 問題

使用者的原話：「請你去幫我思考看看 PANEL 右邊要怎麼設計 那些是我們真的需要顯示的 請先和我討論」。

fankeel 的面板分兩處：輸入框上方常駐的兩行（band），與右側可開關的 Pane。
問題是右側 Pane：哪些資訊是使用者在任務進行中「真的需要」看到的，哪些是因為手上有資料就放上去的；
以及留下來的那些該怎麼排（順序、分區、什麼時候出現、什麼時候收起）。

這是討論的起點，不是定案：使用者要先討論，你的答案會原文給使用者看，然後由使用者決定。
所以請給出有立場的建議與理由，並把你拿不準、需要使用者回答的問題明確列出來。

## 現況（請自己讀，不要只信這段摘要）

- `docs/03-decisions/2026-10-12-fankeel-panel.md` — 10-12 的決定：兩行常駐，細節放 Pane。
  Pane 現在顯示：context 用量與自動 compact 門檻、plan 做到第幾個 task、任務的 notes、其他 session、這個任務碰過的檔；
  gate 在等時最上面畫題目與每個選項的完整說明，可在 Pane 上作答。
- `docs/99-archive/2026-10-11-fankeel-pane-design.md` — design，現行版本是第 6 節。
- `hooks/pane.ts`（369 行）、`hooks/pane-status.ts`（172）、`hooks/pane-gate.ts`（112）、`hooks/pane-band.ts`（97）— 實作。
- `.fankeel/build/ask/1-pane-content-brief.md` 與 `1-pane-content-answer.md` — 先前一次同主題的判官問答；
  請讀它，說清楚你這次的答案和它哪裡一樣、哪裡不同、為什麼。
- `docs/90-agent/todo/pane-1.md` — 真機還沒看完的四件事（撞檔的 ⚑、在 Pane 上答真的 gate、終端上的樣子、自動開關）。
- `docs/90-agent/reference/statusline.md`、`docs/90-agent/reference/station.md` — 另外兩個顯示任務狀態的地方（狀態列、監控站），
  Pane 不該只是重複它們。
- registry 一筆 session 紀錄有哪些欄位：`docs/90-agent/reference/registry.md`（task、stage、route、claims、notes、next、burn、clock、waited、moves、inflight、gateAt…）。

## 限制

- Pane 是窄欄，終端與 Claude Desktop 都要畫得出來；CJK 一格算兩欄。
- band 兩行已經放了：階段、路線圓點、guard、這站用了多久、任務標題、下一步／gate 提醒、撞檔 ⚑。Pane 不必重複。
- mod 沒載入時一切照舊，Pane 不能是任何流程的唯一入口。
- 多題或多選的 gate 目前不能在 Pane 作答。

## 什麼算一個答案

1. 一張表：Pane 每一項候選資訊（現有的每一項，加上你認為該加的），各自判 `留`／`砍`／`條件顯示`／`新增`，
   附一句理由——理由要回答「使用者看到它之後會做出什麼不同的事」，答不出來的就是該砍的。
2. 留下來的東西的排列：由上到下的順序、哪些預設收合、各自在什麼狀態下出現（沒 gate／有 gate／有子代理在跑／撞檔／context 吃緊）。
   用一個純文字的窄欄示意圖畫出至少兩個狀態。
3. 和 band、狀態列、監控站的分工：一句話說 Pane 獨有的職責是什麼。
4. 你拿不準、要使用者回答才能定的問題，最多五個，每個附你傾向的答案。

## 回答的形狀

繁體中文。先一句結論，再照上面 1–4 的順序。程式裡的概念用程式裡的名字（`claims`、`inflight`、`notes`），不要翻譯。
引用檔案時寫 `path:line`。全文不超過 900 字（示意圖與表不計）。
不要改任何檔案。

## Answer

pick: Pane 只留「此刻要不要出手」的東西，由上到下 gate（加倒數）→ ⚑ 撞檔行 → agent 出去幾分 → context → plan → notes → foot；砍 touched 與沒撞檔的其他 session，撞檔、agent、context 第二行都改條件顯示。
why:
一句結論：Pane 不是把 registry 攤開，而是這個 session 現在要不要出手的地方；留下的每一項都要能改變使用者下一步，答不出的就砍。

**1. 逐項**

| 項目 | 判 | 看到後會做什麼不同的事 |
|---|---|---|
| gate 題目、每個選項全文、按鈕（hooks/pane-gate.ts:94） | 留 | 不離開輸入框就答 |
| gate 倒數，讀 pending 的 `until`（hooks/pane-gate.ts:9） | 新增 | 知道不答也會在 N 秒後送到終端，決定在這答還是等 |
| 多題／多選的一行提示（hooks/pane-gate.ts:107） | 留 | 知道要去終端或 station |
| `context` 用量＋門檻（hooks/pane-status.ts:119） | 留 | TokenBar 的 ctx% 是模型視窗，不是 fankeel 的 450k（docs/90-agent/reference/statusline.md:29）；快到時先補 note／`next` 或 handoff |
| `context` 第二行「留 …」 | 條件顯示 | 只在 ≥ 門檻 80% 時出現，那時才要決定 compact 前補什麼；平時是家具 |
| `plan` tasks N of M＋檔名 | 留（已是條件：有 ledger 才畫） | band 只有 stage N of 7；數字不動又沒 agent 在跑，就該去看 |
| `notes`（hooks/pane-status.ts:143） | 留，5 改 3 | 看到「X 失敗改走 Y」能擋掉重試；超過三則是 agent 的記憶不是使用者的 |
| 其他 session，沒撞檔的 | 砍 | 看到也不會做什麼；station 進行中頁有全表 |
| 其他 session 的 ⚑ 共用行（hooks/pane-status.ts:153） | 留，升到 gate 下 | band 只有 `⚑n`（hooks/pane-band.ts:77）；要知道哪個檔、對方在哪站，才決定等、`take` 或改檔 |
| `touched` 數目＋最後三路徑（hooks/pane-status.ts:158） | 砍 | 數目 band 有（hooks/pane-band.ts:85）；最後三個路徑不改變下一步，要看全部去 git 或 station |
| `inflight`（docs/90-agent/reference/registry.md:233） | 新增，條件顯示 | `agent 出去 12 分 · 第 2 組`：知道是在等 agent 不是卡住、別打斷；太久去查。只在 `inflight.stage === stage` 時畫——.fankeel/sessions/12982116-4d5a-4c36-9e48-a2c032cbe77f.json:54 的 inflight 指 survey 而 stage 是 plan，是殘留 |
| foot：id 前 8 碼＋關閉指令 | 留 | compact 後 `--session <id>`、開 station `#/s/<id>` 要用 |
| `next`、stage、route、guard、cost | 砍（已砍） | band 與 station 有 |
| `seen`、`burn`、`waited`、`moves`、`gateAsked`、`todo`、`profile` | 砍 | 都不改變下一步 |

**2. 排列**

順序 gate → ⚑ → agent → context → plan → notes → foot。不做收合機制：條件顯示取代收合，少一種要記的狀態。列數不夠時丟 notes → plan → agent → context（吃緊時不丟）；gate、⚑、foot 不丟（hooks/pane-status.ts:97 的 DROP 改掉）。

| 狀態 | 出現 |
|---|---|
| 沒 gate | context、plan、notes、foot |
| 有 gate | 頂端加 gate 全文與倒數 |
| 子代理在跑 | 多一行 agent |
| 撞檔 | gate 之下每個撞檔的 session 一行 ⚑ |
| context 吃緊 | context 整塊 amber 粗體，加「留 …」行 |

A：沒 gate，agent 在跑，build 中
```
fankeel
agent 出去 12 分 · 第 2 組

context
212k · 到 450k 自動 compact

plan
●●○○○ tasks 2 of 5
2026-10-12-fankeel-pane-band

notes
· Desktop 讀安裝快照，要先 plugin update
· ⚑ 與紅色帶留到下個真任務

12982116 · /fankeel-panel 關閉
```
B：gate＋撞檔＋吃緊，plan 與 notes 被丟
```
fankeel
 gate · 面板右邊             還 48 秒
沒撞檔的其他 session 要列嗎？
1 只列撞檔的
   沒撞檔就一行都不畫，station 有全表
2 全列
   每個 active 的 session 一行
t 交給終端
ctrl+x tab 進面板，再按數字或 t

⚑ 共用 hooks/pane.ts
  站的花費曲線重畫 @ design · 3m

context
431k · 到 450k 自動 compact
留 task · stage · plan · agent · handoff

12982116 · /fankeel-panel 關閉
```

**3. 分工**

band：現在在哪、下一步。狀態列：模型、ctx%、git，加 fankeel 一個字。station：跨 session 的歷史、花費、派工、全表。Pane 獨有：這個 session 此刻要不要出手——gate 全文與作答、撞的是哪個檔、快 compact、agent 還沒回來。

與 10-11 答案（.fankeel/build/ask/1-pane-content-answer.md）的異同——同：gate 在上永不丟；head、route、next、cost、guard 砍；context 與 plan（只算 ledger）留；burn 等砍。異：其他 session 只留撞檔行、touched 砍、notes 5→3、context 第二行改條件、新增 agent 行與 gate 倒數。為什麼：上次的題目是「一個版面」，這次多了「看到後會做什麼不同的事」這把尺，沒撞檔的鄰居與最後三個路徑過不了；`inflight` 上次沒判，它是唯一標記「agent 在外面」的欄位，session 內沒有別處給使用者看。

**4. 要你定的**

1. `gate.station` 現在是 off（12982116…json:27），pending 檔不會寫，Pane 的 gate 區塊永遠不出現（docs/90-agent/reference/station.md:1184）。要開嗎？傾向：開；不開的話 Pane 只是狀態板，自動打開的理由就弱了。
2. 沒撞檔的其他 session 真的不列？傾向：不列。
3. touched 砍掉可以嗎？傾向：砍。
4. 吃緊門檻設門檻的 80%？傾向：80%（HARD 450k 時 360k）。
5. agent 行只靠 `inflight`，mod 讀不到 agent transcript，只知道出去多久、不知道它死了沒；接受嗎？傾向：接受，超過 20 分變 amber。
would flip if: `gate.station` 留在 off——gate 區塊是死的，Pane 降為狀態板，自動開應取消；或 mod 能讀 agent 檔，agent 行就能畫真狀態而不只是時間。
unread: nothing
