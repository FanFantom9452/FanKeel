---
judged: 2026-10-30T06:53:29.319Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 546aef3d-c03f-41e0-929d-cee508e1f6f5
stage: land
---

# 判官要和人類確認時，/fankeel-ask 該怎麼設計

## Question

# 判官要和人類確認時，/fankeel-ask 該怎麼設計

## 問題

`/fankeel-ask` 現在是 one-shot：寫 brief、派一個判官、判官答一次、`judge.js record` 原文歸檔、stage 照答案做。判官從頭到尾沒有辦法問使用者。

使用者的觀察（2026-10-30，原話整理）：
- 有些題目判官其實需要先跟人確認一些事，才判得準。
- 回顧過去的 session，同一個 session 問判官超過兩次的，基本上都是出了問題：一次答不到點上，只好再問。
- 只問一次的，通常代表題目很淺，人類不必參與。
- 需要人類一起回答的題目，該怎麼設計？使用者舉的例子就是現在這題：「gate 頁空白無法標記」（docs/90-agent/todo/gate-20.md）。題目是要先修空白頁再驗，還是換一種驗證方式；它其實很適合人類和判官一起討論。

請判斷：`/fankeel-ask` 要怎麼改，才能在判官需要人類的時候讓人類參與，同時保住 one-shot 想擋的東西（session 一直依賴判官、一題問好幾次、判決被轉述走樣）。

## 選項（判官可以提出更好的）

A. **判官先問、再判（兩段式）**：判官第一次回傳的不是判決，而是「要問人類的問題」區塊（最多 N 題，例如 3 題）。controller 用 AskUserQuestion 原文轉問，答案寫進 brief 的 `## 人類的回答`。判官 SendMessage 續跑同一個 context，再給出唯一一次判決。record 把問與答都歸檔。判決還是只有一次。

B. **brief 階段先問人**：派判官之前，controller 先問使用者 brief 裡標成「需要人類」的未知數，再派 one-shot 判官。判官本身不變。

C. **討論模式（多輪）**：新增 `/fankeel-ask --discuss`，判官與使用者來回幾輪（上限例如 3 輪），最後一輪才寫判決。輪數記在檔案裡。

D. **維持 one-shot，但判決可以回 `pick: needs-human`**：判官列出人要回答的問題，這次記錄就結束。使用者答完以後，再開一次新的 ask，並帶上第一次的記錄。用現有的兩次 ask 表達「要人參與」，再用 `judge.js` 統計：同一題問兩次以上的，標成 brief 寫得不好。

## 背景與證據

- 現行設計：`skills/fankeel-ask/SKILL.md`（one-shot、Not a defect 表、四步驟）、`agents/fankeel-judge.md`（判官的輸出六欄、`## 白話`、`## Summary`）、`scripts/judge.js`（record 的檢查，例如沒有 `pick:` 就拒絕）、`lib/judgepage.js`。
- 「為什麼 one-shot」與何時值得花錢：`docs/90-agent/reference/subagents.md`（搜尋 judge / fankeel-ask / one-shot）。
- 過去的判決：`docs/90-agent/judgements/`，77 份，frontmatter 有 `session`、`stage`、`task`。依 session 計數：98873819 有 7 份，8a1d6ae0、23fd8947 各 3 份，另有 10 個 session 各 2 份，其餘各 1 份。請派 reader 讀問最多次的幾個 session 的判決，回答兩件事：
  - 第二次以後的 ask，是不是因為第一次少了只有人類知道的資訊（偏好、外部事實、現場觀察）？
  - 或者是因為 brief 本身寫得不好、題目換了？
  這是使用者「超過兩次＝有問題」這個說法的證據檢驗：請說明它成立、部分成立，還是不成立。
- brief 與答案原檔：`.fankeel/build/ask/*-brief.md`、`*-answer.md`。
- controller 怎麼轉問：`hooks/gate.js`、AskUserQuestion 的限制（每次最多 4 題、每題 2–4 個選項，使用者永遠可以自由輸入）。controlled stage 的 guard 只放行 ask brief 的寫入（`asksBrief`，`hooks/guard.js`）。
- 判官是 subagent。controller 可以 SendMessage 讓它續跑同一個 context；判官自己沒有 AskUserQuestion（`agents/fankeel-judge.md` 的 tools）。

## 什麼算答案

- 一個 pick（A／B／C／D 或判官提出的 E），說明它怎麼保住 one-shot 想擋的三件事。
- 寫清楚「判官何時該要求人類參與」的判準，要能寫成一條規則，例如：題目的關鍵未知數只有人類知道（偏好、現場觀察、外部承諾）。
- 列出要改的檔案和每個檔案改什麼，一行一個：skill、agent、judge.js record 的格式與檢查、測試。
- 拿 gate-20 當例子走一遍：判官會問人類哪幾題，人類回答後判決長什麼樣。
- 「超過兩次＝有問題」的證據結論。

## 回答格式

照 `agents/fankeel-judge.md` 的六欄，接著 `## 白話`（600 字以內），再接 `## Summary`。

html: yes

## Answer

pick: E — 判官維持 one-shot，但判決多一欄 `ask human:`（0–4 題、每題 2–4 選項、標出判決假設的那個答案）；`pick:` 是「假設成立時」的判決，`would flip if:` 寫其他選項下判決變成什麼；controller 把 `ask human:` 原文照抄成一次 AskUserQuestion，答案由 `judge.js answered` 原文附進同一份判決檔。只有人類的答案落在所有分支之外時，才走 D（帶第一份記錄再 ask 一次）。
why: 72 份判決、51 個 session 裡，第二次以後的 21 次 ask 沒有一次是因為「少了只有人類知道的資訊」；唯一真重問（23fd8947 graphify-run-it:22）缺的是一個實驗，不是人；98873819 的 7 份是同一秒送出的七條 TODO（resume-assertion.md:43）。「超過兩次＝有問題」不成立。
真正的缺口在別處：判官早已找出人類才知道的決定性事實，卻只寫進 `would flip if:`（notify-channel.md:58 使用者偏好、phone-voice-input.md:66 真機實測、retro-full-record.md:98 使用者的本意），從沒人把它拿去問人。E 只是把那一行路由給人，不新增任何判官回合。
A 和 C 都靠續跑同一個 judge context，而 subagents.md:616 記錄 SendMessage 送到停掉的 agent「queued 然後遺失，兩次」、:950 resume 不會重注 brief；判官一回 SubagentHandback 就結束（judge.md:14），續跑不可靠且再付一輪 Fable。B 把「哪些事只有人知道」丟給還沒讀檔的 controller——它正是不知道才要問判官的那一方。
現有機制剛好夠：judge.js:129 只檢查 `/^pick:/m`，新欄不會被拒；guard.js:36-41 已放行 `.fankeel/build/ask/` 下所有寫入；gate.js:375-377 的「逐字照抄」規則可直接套用到 `ask human:` 區塊，擋住轉述走樣。
would flip if: harness 讓已回傳的 subagent 可靠續跑且重注 brief（推翻 subagents.md:616/:950）——那 A 比 E 省一次人類分支推演；或判決檔出現「因缺人類資訊而重問」的實例（目前 0/21）。
unread: nothing — brief 點名的每條路徑都由 reader 讀過或由我抽查；`hooks/guard.js` 60-110、170 行以後與 `lib/handoff.js` 的 `answeredOf` 內文 reader 未開，只影響 gate.js 改法的細節，不影響 pick。
delegated: skills/fankeel-ask/SKILL.md + agents/fankeel-judge.md (sonnet)；scripts/judge.js + lib/judgepage.js (sonnet)；docs/90-agent/reference/subagents.md + repo grep SendMessage (sonnet)；docs/90-agent/judgements/ session 98873819 的 7 份 (opus)；judgements/ session 8a1d6ae0、23fd8947 的 6 份 (opus)；judgements/ 11 個兩份 session 的 22 份 + 全目錄計數 (sonnet)；hooks/gate.js + hooks/guard.js (sonnet)；docs/90-agent/todo/gate-20.md + .fankeel/build/ask/*-brief.md、*-answer.md + judgements grep (sonnet)
checklist: 1 SKILL.md 四步驟／Not-a-defect／one-shot 要擋的事 — answered (SKILL.md:15-18, :45-49, :93-96)；2 judge.md tools 與六欄、cannot-answer 路徑 — answered (judge.md:4, :58-65, :98-99)；3 judge.js record 的檢查與命名 — answered (judge.js:129, :136-146)；4 judgepage.js PLAIN_MAX 與頁面 — answered (judgepage.js:12, :26, :129-133)；5 subagents.md 為何 one-shot／何時值得 — answered (subagents.md:548-577)；6 session 98873819 七份的成因 — answered (全部 (c)，同一秒批次)；7 8a1d6ae0、23fd8947 — answered (1 個 (a)，0 個 (b))；8 11 個兩份 session — answered (0 個 (a)/(b))；9 gate.js 怎麼問、限制 — answered (gate.js:208, :236-237, :375-377, :391-395)；10 guard.js asksBrief 範圍 — answered (guard.js:36-41, :150)；11 SendMessage 續跑判官是否可靠 — answered (subagents.md:616-619, :891, :950；judge.md 無 SendMessage)；12 gate-20 的人類未知數 — answered (gate-20.md:8, :10)；13 brief/answer 檔形狀、有無「答不出」 — answered (18 對檔、0 份說需要人)

## 白話
建議選 E：判官還是只判一次，但判決裡多一欄「要問人的題目」，由系統照原文問你一次，你的回答原文附進同一份判決檔。
打個比方：醫生看完檢查報告，不是把你叫回診間聊三次，而是在報告上寫「若你平常有在跑步，建議 A；若沒有，建議 B」，櫃台只問你一句「有沒有在跑步」，答案釘在報告上。判官現在其實已經在做前半——過去的判決裡，「只有你知道的事」都寫在「什麼情況下會翻盤」那行，只是從來沒人拿去問你。
至於「同一個 session 問超過兩次就是出問題」：翻完 72 份判決，沒有任何一次重問是因為缺你的資訊；問最多的那個 session 是你自己一次送了七條 TODO。所以不該拿「問幾次」當警訊，該修的是把判官的問題送到你面前。

## Summary

### 問題與證據

**「超過兩次＝有問題」的檢驗：不成立。**

全目錄計數（reader 6，`grep ^session:`）：judgements/ 內 77 個檔 = 72 份 .md ＋ 5 份 .html 旁檔；51 個 session：37 個一份、11 個兩份（brief 說 10，實為 11）、8a1d6ae0 與 23fd8947 各三份、98873819 七份。第二次以後的 ask 共 21 次（6＋2＋2＋11）。

- **98873819（7 份）**：全部 stage `design`、同一 task「處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask」。`judged:` 時間戳從 15:04:30.972Z 到 15:04:31.734Z，相差不到一秒（我以 grep 抽查全部七個，一致）——是一次送出七條 TODO 的批次，不是接連重問。`docs/90-agent/judgements/2026-09-10-resume-assertion.md:43-44` 原文：「使用者今天的指示是七條 TODO 全部送判官，所以這題送到你這裡是指示，不是這個 session 答不出來」（抽查相符）。七份中四份（exception-cases:79、total-budget:68、section-loading:70、pattern-skill:67）判官糾正了 brief 裡寫錯的事實，但沒有任何一份因此被重問。分類：7 × (c)，0 × (a)/(b)。
- **8a1d6ae0（3 份）**：notify-channel（verify）→ phone-voice-input（verify，新題目，使用者補了兩個前提）→ writer-dispatch（land，關於另一個 session 的旁題）。分類 (c)、(d)。沒有重問。但 `2026-10-22-notify-channel.md:58` 的 would-flip 是「使用者收回『內容可送第三方』的接受」（抽查相符，純使用者偏好）；`phone-voice-input.md:66` 的 would-flip 是 S24 真機實測結果。
- **23fd8947（3 份）**：graphify-knowledge-graph（survey）→ graphify-run-it（build）→ understand-anything（survey，換了工具，task 字串不同）。第二份是唯一的真重問 (a)：`2026-10-22-graphify-run-it.md:22`「T5 compared graphify against a one-line grep, **not against a real fankeel-reader doing the job**」（抽查相符）——第一次判決的試驗設計不足以定案，缺的是一個實驗，不是人類才知道的事。
- **11 個兩份 session**：6 個 (d)（task 或 stage 不同）、5 個 (c)（同一盤點任務下的兩條 TODO 或承接前一份的後續題）。0 個 (a)/(b)。人類事實只出現在 would-flip：`2026-10-20-retro-full-record.md:98`「the user means the raw transcript by "complete record"」（抽查相符）、`2026-10-12-pane-band-redesign.md:205`「實測 Claude Desktop 的 band 不到 70 格」、`2026-10-29-ci-cd-nightly.md:103`「a professor asks for a per-commit green signal」。

結論：21 次後續 ask 中，(b)「缺人類資訊」= 0，(a)「第一次答不到點」= 1，(e)「brief 寫壞導致重問」= 0。使用者的印象（「問超過兩次基本上都出了問題」）在記錄上找不到支撐；反而顯示重問極少、多問是批次或正常推進。D 選項附帶的統計（「同題問兩次以上標成 brief 寫得不好」）會把健康的 session 誤標。

**但記錄揭露另一件事：判官已經會辨識「只有人類知道」的決定性事實，卻只寫進 `would flip if:`，然後 stage 照 pick 行動，沒人去問人。** 至少五份判決如此（上列）。這才是 gate-20 這類題目的實際缺口——不是判官無法「討論」，而是它找出的人類問題沒有通道送到人面前。

### 現行機制（readers 1、2、3、7 ＋ 抽查）

- one-shot 要擋的三件事，原文：`skills/fankeel-ask/SKILL.md:17-18`「Asking the judge a second question in the same stage is not more diligence — it is the thing the one-shot shape exists to stop」；`:48`「A second question in the same stage is a second `/fankeel-ask`, typed by the user, not a follow-up message to the same judge」；`:93-96` 重打字就是轉述走樣；`:35-41` 與 `subagents.md:554-558` 沒有任何提示推薦判官，避免 session 依賴。`subagents.md:562-566`（抽查相符）：「a single bounded question is still the only shape that pays… You are buying one judgement at that cost, not running a session at twice the rate」。
- 判官：`agents/fankeel-judge.md:4` `tools: [Read, Grep, Glob, Bash, Agent]`，無 AskUserQuestion、無 SendMessage（抽查相符）；`:14`「It will not come back to you for more」；`:98-99`「Do not ask a question back. If the brief cannot be answered, `pick:` says so」。
- `scripts/judge.js:129`（抽查相符）：record 對答案內容唯一的檢查是 `/^pick:/m`；沒有六欄解析、沒有 needs-human 處理、沒有 per-session 統計（reader 2 Q4、Q7）。檔名 `YYYY-MM-DD-<slug>.md`（:136），frontmatter 只有 judged/model/agent/task/session/stage（:137-146）。`lib/judgepage.js:12` `PLAIN_MAX = 600`，頁面是泛用 markdown 轉 HTML，無欄位解析。
- 續跑判官是否可行：`subagents.md:616-619`（抽查相符）「`SendMessage` to a stopped brain showed `queued` and was lost, twice」；`:950-951`「Of 24 resumed agents … a resume never re-injected the brief」；`:891` 一次成功續跑 implementer 的個案。判官一呼叫 SubagentHandback 就結束 run。結論：A、C 依賴的續跑在這個 harness 裡不可靠。
- `hooks/guard.js:36-41`、`:150`（抽查相符）：controller 在 controlled stage 的 Edit/Write 只放行 `.fankeel/build/ask/` 前綴，不分檔名、不分新舊檔；`docs/90-agent/judgements/` 不放行，但 `node scripts/judge.js record` 走 Bash 寫檔今天已經可行，新增的 `answered` 子命令同路徑。
- `hooks/gate.js:375-377`、`:416`：gate 的 AskUserQuestion 必須逐字照抄 handoff 的 `json gate` 區塊，否則拒絕；`:391-395`（抽查相符）：跨 stage 的重複問題以 0.8 字元重疊判定後拒絕，並要 controller 直接用舊答案；`:208` 以 4 題為上限；`:236-237` gate 至少三個選項。gate.js 目前完全沒有 judge 相關處理（reader 7 Q2）。
- gate-20（抽查全文）：`:8` 把「先修空白頁再驗，還是改用其他方式驗證」交給判官；`:10` 把「暫開 `gate.station` 還是走別的路徑」也交給判官；完成標準已寫死「真 gate 頁能顯示 mermaid 圖、點節點送出後答案檔出現『標記：』行，且 hooks/gate.js 收到」。檔內沒有任何人類已回答的觀察（空白頁的網址、console 錯誤、是否接受自動化驗證替代本人點選）。
- 18 對 brief/answer 原檔中 0 份說「無法回答／需要人」（reader 8）；judgements grep 也沒有 needs-human 類字串。

### 各選項對三件事的保全

| | 依賴判官 | 一題多問 | 轉述走樣 | 其他 |
|---|---|---|---|---|
| A 兩段式 | 持平 | 判官同 context 跑兩輪，實質是追問 | 問題與答案可原文 | 續跑不可靠（:616、:950）；再付一輪 Fable；人類答題期間 context 要吊著（gate.away 情境） |
| B brief 先問人 | 持平 | 持平 | 持平 | controller 不知道自己不知道什麼——它沒讀檔就得猜哪些是人類才知道的；問得到的題目通常也就不需要判官 |
| C 討論模式 | 判官變成聊天對象，正面違反 :17-18 | 直接開放多輪 | 多輪口語難以原文歸檔 | 成本 N 倍 Fable；證據顯示真重問只有 1/21，討論需求沒有記錄支撐 |
| D needs-human ＋再 ask | 持平 | 固定兩次 ask 才完成一題 | 原文 | 第二次要再付完整判官＋readers（約 2.1×）；附帶的統計會誤標 11 個健康 session |
| **E 條件判決 ＋ `ask human:`** | 持平（判官仍一次、無提示） | 判官一次；人類一次 AskUserQuestion；只有答案落在所有分支外才第二次 ask | `ask human:` 區塊逐字照抄（沿用 gate.js:375-377 的規則）；答案由腳本附檔，不重打 | 零新增 Fable 回合；用的是判官 72 次已在做的 would-flip 推演 |

### E 的規格

**判準（一條規則）**：判官只有在「決定 `pick:` 的那個事實，沒有任何檔案、指令或 reader 能產出——它是使用者的偏好、使用者在自己螢幕／裝置上看到的現象、或使用者在 repo 外做的承諾」時，才可以把它寫進 `ask human:`；每一題必須附一句「為什麼沒有路徑能回答」。能派 reader 讀到的，就去讀，不問人。

**第七欄格式**（放在 `checklist:` 之後、`## 白話` 之前）：
```
ask human: <0–4 題；每題一行問句 ＋ 2–4 個選項 ＋ 恰好一個標 (assumed) ＋ 一句「無路徑可答因為…」；沒有就寫 nothing>
```
`pick:` 是所有 (assumed) 成立時的判決；`would flip if:` 必須對每個非 assumed 選項寫出判決變成什麼（這欄的兩行上限可放寬到每題一行）。

**流程**：record 之後，若 plain 輸出帶 `ask human:`，controller 把 record 印出的 `questions` JSON 逐字貼進一次 AskUserQuestion → `node scripts/judge.js answered --session <id> --record <path> --answers -` 把答案原文附到判決檔的 `## 人類的回答` → 答案等於 assumed 就照 `pick:`；等於某個非 assumed 選項就照 `would flip if:` 對應分支；自由輸入或落在分支外，才是第二次 `/fankeel-ask` 的唯一正當情境，brief 必須帶 `--record` 第一份。

**要改的檔案**：
- `agents/fankeel-judge.md`：六欄加第七欄 `ask human:`；加上述判準；`:98-99`「Do not ask a question back」改為「問題只能進 `ask human:`，不得寫在散文裡；`pick:` 永遠要填」；`would flip if:` 行數限制改為「每個非 assumed 選項一行」。
- `skills/fankeel-ask/SKILL.md`：第 3 步後加「3b. 若 record 印出 `ask human:`，照抄 `questions` JSON 問一次，跑 `judge.js answered`」；第 4 步加分支規則；Not-a-defect 表加一列「判官答完後 controller 問了使用者一次 — 判決檔有 `ask human:` 時這是流程，不是依賴判官」；`:48` 加「答案落在分支外的第二次 ask 必帶 `--record`」。
- `scripts/judge.js`：`record` 解析 `ask human:`（0–4 題、每題 2–4 選項、恰好一個 (assumed)、每題有理由句），不合格式就 fail；plain 輸出後加印 `questions` JSON（沿用 handoff gate 的 `json gate` 形狀）；新子命令 `answered --session <id> --record <path> --answers <path|->`：判決檔沒有 `ask human:` 或已有 `## 人類的回答` 則拒絕，否則原文附檔並印出 pick 或對應分支。
- `lib/judgepage.js`：把 `ask human:` 與 `## 人類的回答` 畫成一張表（題目／選項／assumed／實際回答）放在 `<aside class="plain">` 下方。
- `hooks/gate.js`：在 `:375-377` 的逐字比對來源加上「最新未回答的判決檔的 `ask human:` 區塊」；`:241-252` 的 gate 辨識不變，所以 `ask human:` 不會被當成 stage gate、不受三選項下限（:236-237）約束；`:391-395` 的 already-answered 守門照常生效（使用者在 gate 已答過的就用舊答案）。
- `hooks/guard.js`：不改（`asksBrief` 已放行；`judge.js answered` 與 `record` 同路徑）。測試需證明 controlled stage 下 `answered` 能寫 `docs/90-agent/judgements/`。
- `tests/judge.test.js`（或現有 judge 測試檔）：record 接受／拒絕 `ask human:` 各形狀；`answered` 附檔一次、第二次拒絕、無區塊拒絕；plain 輸出含 `questions` JSON；judgepage 畫出兩節；gate.js 對 `ask human:` 區塊逐字比對、對轉述拒絕。
- `docs/90-agent/reference/subagents.md`：`:146-170` 判官段落加第七欄與判準；`:566-573`「Worth typing when」加一條「決定性未知數在你身上（偏好、你看到的現象）——判官會用 `ask human:` 問你一次」。
- `docs/90-agent/todo/gate-20.md`：不改，作為 E 的第一個實跑案例。

### gate-20 走一遍

判官讀完 `assets/station/nav.js`、`lib/station.js` 的 focusShell、`hooks/gate.js` 的 `gate.station` 分支、committed profile、`tests/station-*` 之後，能自己確定：空白頁的程式原因（focusShell 沒載 nav.js）可用程式修，`gate.station: off` 會讓站台答案進不了答案檔。它確定不了的三件事都在使用者身上：

```
ask human:
1. 空白頁出現時，瀏覽器網址列是哪一頁、console 有沒有紅字？ 選項：/gate 且有紅字 ／ /gate 無紅字 (assumed) ／ /m ／ 不確定 — 無路徑可答：現場畫面只有你看過，tests 跑的是 headless。
2. 驗證期間要不要暫時把 gate.station 開成 on？ 選項：開、驗完關回 (assumed) ／ 不開，改用 Playwright 真瀏覽器測試證明 ／ 永久開 — 無路徑可答：committed profile 把它釘 off 是你的選擇，repo 沒寫原因。
3. 完成標準裡「點節點送出」要你本人點一次，還是自動測試點一次也算？ 選項：我本人點 (assumed) ／ 自動測試即可 ／ 兩者都要 — 無路徑可答：gate-20:8 的完成標準沒寫誰點。
```

`pick:`（三個 assumed 成立）：先修空白頁（focusShell 載入 nav.js，附 `tests/station-*` 一支真瀏覽器測試），驗證時暫開 `gate.station`，由使用者在真 gate 頁點一次，答案檔出現「標記：」行後關回 off。`would flip if:`：Q1=有紅字 → 先修那個錯誤，nav.js 載入是第二步；Q1=/m → 不是 focusShell 問題，改查 /m 路由；Q2=不開 → 以 Playwright 測試證明 hooks/gate.js 收到，不動 profile；Q2=永久開 → 同時改 committed profile 並開 TODO 記錄原因；Q3=自動測試即可 → 完成標準改寫，使用者不必在場。使用者答完，`judge.js answered` 把三個答案附進判決檔；controller 依分支動手，不再派判官。若使用者自由輸入「其實我用的是手機」，三題分支都沒涵蓋——這才是帶著第一份記錄再 ask 一次的情境。

### 沒能查到的

- `lib/handoff.js` 的 `answeredOf` 與 `hooks/guard.js` 60-110、170 行以後未開：影響 gate.js 改法的細節（already-answered 守門會不會誤擋 `ask human:`），不影響 pick。
- SendMessage 工具在 controller 端是否存在，只從 `.claude-plugin/plugin.json:192` 的 hook matcher 與 subagents.md 的實測記錄推得，未直接驗；若它變得可靠，見 would flip if。
- 11 個 (d) 類兩份 session 中，reader 未確認是否有「兩個任務碰巧共用一個 session id」的情況；即使有，也只會讓 (c)/(d) 之間移動，不會變成 (a)/(b)。

```chartroom
{"type":"title","text":"21 次後續 ask 的成因（72 份判決）"}
{"type":"bar","label":"(c) 同任務不同題","value":11}
{"type":"bar","label":"(d) 任務或 stage 換了","value":9}
{"type":"bar","label":"(a) 第一次答不到點","value":1}
{"type":"bar","label":"(b) 缺人類才知道的資訊","value":0}
{"type":"bar","label":"(e) brief 寫壞導致重問","value":0}
{"type":"note","text":"98873819 的 6 次後續是同一秒批次，計入 (c)；人類事實只出現在 would-flip 行，從未成為重問原因"}
```
