---
judged: 2026-10-29T10:49:21.595Z
model: fable
agent: fankeel-judge
task: "手機版 /m 設計 mockup 調整，並在手機上看多台電腦的 desktop/CLI 對話與帳號 RC 對話"
session: c7a97a6b-fff4-4749-abd8-8f6aaad68f92
stage: land
---

# 問題

## Question

# 問題

使用者問：「現在產生 Question 的時候，選項和題目名稱都可以自訂嗎？」

這裡的 Question 指 fankeel 在每個 stage 結束時，用 AskUserQuestion 問的 gate 問題。

想知道的是：gate 的 header、question、選項的 label 與 description，現在哪些可以自訂、由誰來自訂、透過什麼方式。可能的自訂方式包括 profile 設定、stage agent 寫的 `json gate` 區塊、controller 自己寫、lib/stages.js 的固定規則。

## 選項（回答落在哪一種）

1. 都可以自訂：stage agent 或 controller 想怎麼寫就怎麼寫，只受長度與格式檢查限制。
2. 部分可以：有些欄位或位置是固定的（例如選項一必須是下一個 stage、第二個是留在本 stage、一定要有暫停、land 的四個固定選項），其餘可以自由寫。
3. 使用者自己不能直接自訂；只能改規則或 profile。

## 背景

這次 session 裡實際看到的行為：

- controller 必須把 handoff 檔（例如 build-2.md、verify-2.md）最後一個 `json gate` 區塊的 `questions` 逐字複製給 AskUserQuestion。PreToolUse hook 會拒絕不一致的版本，錯誤訊息是「this question does not match … word for word」。
- 另有一個 hook 拒絕在選項描述裡用「verify-2」這種檔名代號，要求寫出它是什麼。
- stage 的規則寫著：「Option one is the approval: <next stage>」、「Option two names the open decision, or none」、「never dropping the pause」、最多 4 個選項、header 12 字元（CJK 6）、question 約 40 字元（CJK 20）。
- land 的 gate 固定四個選項：收工、option two、匯出並回顧、暫停。

## 要讀的路徑

- lib/stages.js（gate 規則、ALWAYS）
- hooks/ 下檢查 AskUserQuestion 的 hook（gate-write.js、gate.js，或任何比對 `json gate` 的檔案）
- scripts/gate-check.js
- lib/handoff.js（約第 414 行，land 收工 label）
- skills/fankeel/SKILL.md 的「At the end of a stage, ask」那一段
- profile 的設定鍵：`node scripts/task.js profile show`，看有沒有和 gate 文字或選項有關的鍵

## 什麼算回答

逐欄位（header、question、每個選項的 label 與 description、選項數量）說清楚：

- 誰寫的
- 哪些被 hook 或規則強制、強制的方式是什麼（`path:line`）
- 哪些可以自由寫

最後說明使用者如果想自訂（例如換固定選項的字、加自己的選項），現在能走哪條路，還是需要改程式碼。

## 回答形式

六個欄位，`pick:` 選上面 1、2、3 其中一個。接著 `## 白話`，600 字以內，用繁體中文。最後 `## Summary` 放逐欄位的表格。

html: yes

## Answer

pick: 2 — 部分可以：option 1 的 label 必須含下一個 stage 名（或路線上的 stage、路線末端 down/收工）、一定要有一個 label 含 暫停/pause/停下/先停、第一題至少 3 個選項、每題 2–4 個、header ≤12 欄（CJK 算 2）；其餘文字由 stage agent 或 controller 自由寫，沒有 profile 鍵能改 gate 文字。
why: 強制規則全在 lib/handoff.js:386-432（gateProblem）與 :253-283（ruleProblem）+ lib/plain.js:62-81，由 hooks/gate.js:292 在 AskUserQuestion 前跑，但只對 profile `stage.agents` 列的 stage 逐字比對 handoff 的 `json gate`（hooks/gate.js:289-292, :335, :360-366）；未受控 stage 的 gate 只給 systemMessage 不擋（hooks/gate.js:300-320）。
沒有任何程式碼產生 gate 文字：land 的「收工 / 匯出並回顧 / 暫停」只是 lib/stages.js:404 給 agent 的指引，程式只要求 option 1 含 down/收工（lib/handoff.js:421）與有 pause；「匯出並回顧」在 lib/scripts/hooks 都不存在。
「verify-2」被拒不是檔名規則，是 lib/plain.js:44,56 的 TODO id 規則，因為 docs/90-agent/todo/verify-2.md 存在。
profile 41 個鍵裡只有 model.lang（語言）、prose.style（風格）、gate.away（多加一題 離開）、gate.station（等待秒數）碰到 gate，沒有一個設定文字或選項（lib/profile.js:38,55,86,686）。
would flip if: lib/profile.js 出現一個 gate 文字/選項的鍵，或 lib/ 有函式回傳 `{header, question, options}` 給某個 stage（目前只有 lib/context.js:207-215 的 AWAY_QUESTION）；那就偏向 3。
unread: nothing — brief 列的六個路徑都由 reader 讀過並抽查。
delegated: lib/stages.js (sonnet); hooks/gate.js + hooks/gate-write.js + .claude-plugin/plugin.json + lib/plain.js (opus); scripts/gate-check.js + agents/fankeel-brain*.md + docs/90-agent/reference/enforcement.md (sonnet); lib/handoff.js + lib/context.js + lib/render.js + scripts/drive.js (sonnet); skills/fankeel/SKILL.md + `node scripts/task.js profile show` + lib/profile.js (sonnet).
checklist: 1 lib/stages.js 規則固定/自由 — answered；2 hooks/ 的強制機制 — answered；3 scripts/gate-check.js 檢查什麼、誰跑 — answered（advisory，brain 自檢）；4 lib/handoff.js 是否硬編碼 land 四選項 — answered（否，只驗證）；5 SKILL.md「At the end of a stage, ask」— answered；6 profile 鍵 — answered（無 gate 文字鍵）。

## 白話

結論：可以改一部分，不是全部。gate 像一張固定格式的表單：第一個選項一定要寫「去下一站」（例如 verify、或路線走完時的 收工），一定要留一個「暫停」，第一題至少三個、最多四個選項，標題不超過六個中文字；在這些框框裡，標題、問題句、每個選項的字與說明，都是 stage agent（survey/build/verify）或這個 session 自己寫的，程式不會替你產生任何一句。
land 的「收工／匯出並回顧／暫停」也只是給 agent 的指示，程式只檢查第一項有「收工」和有「暫停」，所以「匯出並回顧」這種字可以改，只是要改 skill/rule 的文字，agent 才會照著寫。
你本人在對話裡不能直接改某一次 gate 的字；在受控 stage，session 必須逐字照抄 agent 寫的那塊，抄錯會被擋。想自訂固定選項的字或加常駐選項，現在沒有 profile 設定可用，要改 lib/stages.js 的規則句或 skill 文字；要放寬硬性檢查（如第一項必含 stage 名）才需要改 lib/handoff.js 的程式。

## Summary

### 逐欄位

| 欄位 | 誰寫 | 強制（path:line，方式） | 自由 |
|---|---|---|---|
| header | stage agent 的 handoff `json gate`（受控 stage：此 profile 的 survey/build/verify），其他 stage 由 controller 自己寫 | 非空、寬度 ≤12 欄，CJK 算 2（lib/handoff.js:392-395，readGate→hook 拒絕）。SKILL.md:365「the stage that just finished / 12 chars, 6 CJK」是指引；hooks/gate.js:357-358 用 header 等於 stage 名或檔案 gate 的 header 來判斷「這是不是在抄 gate」 | 12 欄內的字 |
| question | 同上 | 非空（lib/handoff.js:397）；任一句 ≤160 欄（lib/plain.js:12, :73-75）；不得出現裸 hex / `Task N` / 已知 TODO id（lib/plain.js:21-22, :44, :54-56, :77-79）。SKILL.md:366 的「~40 字／CJK 20」只是指引，程式沒有這個上限 | 句子內容 |
| option 1 label | 同上 | label 必須包含下一個 stage 名、或路線上任一 stage 名（退回用）、或路線末端的 down/收工（lib/handoff.js:419-428）；lib/stages.js:125 ALWAYS「Option one is the approval: {{NEXT}}」；SKILL.md:367 | stage 名以外的字、`(Recommended)` 放哪一項（lib/stages.js:125 說標記而非搬動） |
| option 1 description | 同上 | 必須是字串（lib/handoff.js:402）、句長與裸代號規則同上 | 內容 |
| option 2 label/description | 同上 | 程式沒有任何 option 2 專屬檢查（lib/handoff.js:386-432 無）；只有規則文字「names the open decision, or none」（lib/stages.js:125；SKILL.md:368） | 全部 |
| 暫停選項 | 同上 | 任一題任一 label 需符合 `/暫停\|pause\|停下\|先停/i`（lib/handoff.js:253, :263-264），只在 rules.pause 時檢查，hook 與 gate-check 都傳 pause:true（hooks/gate.js:292；scripts/gate-check.js:51）；`gate.next` 必須非空字串，否則報「no pause option」（lib/handoff.js:418）。位置不固定 | 四個同義字擇一、description 內容、放第幾項 |
| 選項數量 | 同上 | 每題 2–4（lib/handoff.js:398）；第一題 ≥3（lib/handoff.js:260, :266-268）；最多 4 題（lib/handoff.js:387）。profile `gate.away=ask` 時 hook 會再加一題 離開（hooks/gate.js:203-211，lib/context.js:207-215），這是唯一程式產生的題 | 第 4 個選項（SKILL.md:373-374） |
| 任何 label | 同上 | 不得寫出比 task floor 更輕的 class 名（lib/handoff.js:270-280） | — |
| land 的四個選項 | 同上（land 未在 stage.agents，故 controller 自己寫） | lib/stages.js:404「Gate: 收工, open, `record.js session` then retro, 暫停.」是給 agent 的指引句；程式只要 option 1 含 down/收工（lib/handoff.js:421）＋有 pause。「匯出並回顧」在 lib/、scripts/、hooks/ 都 grep 不到（reader D） | 字面可改，改規則句即可 |
| multiSelect / preview | 同上 | multiSelect 需布林（lib/handoff.js:414）；preview 需非空字串且不可在 multiSelect 題（:409-412）；檔案 gate 缺 multiSelect 時補 false（:453-454，reader B） | — |

### 強制機制

- PreToolUse `AskUserQuestion` → `hooks/gate.js`（.claude-plugin/plugin.json:137-141，抽查確認）。流程：`controlled = controlling(mine.stage, values)` 只在 profile `stage.agents` 列的 stage 才讀 handoff 最後一塊 `json gate`（hooks/gate.js:289-292）。沒有檔案 gate（未受控、檔案不存在）→ 問題照出，最多附 systemMessage；未受控時 `thinGate` 只警告「three at least」不擋（hooks/gate.js:300-320）。檔案 gate 無效 → 拒絕並要求 SendMessage 給 stage agent 重寫、「Do not write the question yourself」（:326-331）。檔案 gate 有效但 asked 與檔案 gate 不 deep-equal、且 header 相同＋字元重疊 >0.5 → 拒絕「does not match … word for word」（:335, :360-366）。
- PostToolUse Write → `hooks/gate-write.js:71` 在 handoff 寫入時跑同一套 readGate（reader C，未抽查）。
- `scripts/gate-check.js` 是薄包裝：同樣呼叫 readGate（:51），加 verify 專屬的 adversary 未回檢查（:55-58）；只有 agents/fankeel-brain.md:217-218 叫 brain 自己跑，沒有 hook 強制跑（docs/90-agent/todo/gate-16.md:14 記這是開放缺口）。
- 「verify-2」被拒：lib/plain.js:44 只認 `todoIds(root)` 裡符合 `/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/` 的 id；Glob 確認 docs/90-agent/todo/verify-2.md 存在，所以描述裡寫 verify-2 被當 TODO id 擋下。它不是檔名規則，brief 裡「拒絕檔名代號」的理解需修正。

### 誰寫

- 受控 stage：stage agent 在 handoff 寫 `json gate`；controller 的 stage 規則要求「copied verbatim」（lib/stages.js:725；SKILL.md:1048-1049；docs/90-agent/reference/subagents.md:608，reader E）。
- 其他 stage（此 profile 的 design/plan/audit/land）：controller 依 lib/stages.js:124-129 ALWAYS 與 SKILL.md:361-369 的表自己寫，hook 不比對檔案。
- 程式產生的 gate 文字：只有 lib/context.js:207-215 AWAY_QUESTION（離開一題）。lib/render.js:631 只指示用 profile `model.lang` 的語言寫，`暫停`、`(Recommended)` 照原樣。

### profile

`node scripts/task.js profile show` 41 鍵（reader E）。碰到 gate 的只有 gate.station（等監控站秒數，lib/profile.js:38）、gate.away（加一題，:55）、model.lang（語言，:86）、prose.style（風格，:686）、prompt.all / prompt.<stage>（附加到 stage 規則，非 gate）。沒有鍵設定 header、question、label、description 或選項數。

### 使用者想自訂時的路

1. 改固定選項的字（如把「匯出並回顧」換字、把「收工」換成別的）：改 lib/stages.js:404（land 指引句）或 SKILL.md:367-369 的文字即可讓 agent 照寫；但 option 1 仍須含 down/收工（lib/handoff.js:421），要換這兩個字得改 lib/handoff.js。
2. 加自己的常駐選項：沒有 profile 鍵；可用 prompt.all / prompt.<stage> 附加規則句讓 agent 多寫一項（未驗證 agent 會否遵守），受限於每題最多 4 個（lib/handoff.js:398）。
3. 單次手動改某個受控 stage 的 gate：不行，hook 要求逐字抄；要改得請 stage agent 重寫 handoff。未受控 stage 則 controller 可自由寫。
4. 放寬硬規則（header 寬度、pause 關鍵字、option 1 命名）：只能改 lib/handoff.js 常數與 gateProblem/ruleProblem。

### 抽查結果

lib/stages.js:125, :404, :725；hooks/gate.js:286-367；lib/handoff.js:252-284, :384-432；lib/plain.js:10-81；skills/fankeel/SKILL.md:356-375, :1046-1049；scripts/gate-check.js:44-61；lib/profile.js:38, :55, :86, :686；.claude-plugin/plugin.json:137-141；hooks/gate.js:203-211（grep）。全部與 reader 引述一致，沒有出入。

### 沒做的

- 未把事實寫入 context.md：手上沒有 session id，`context.js add --session` 需要它；這題與 mobile-sources 任務的後續 stage 無關，影響有限。
- 未抽查 hooks/gate-write.js:71、lib/cjk.js askSlip、docs/90-agent/reference/subagents.md:608（reader 引述，未親自開）。
