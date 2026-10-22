---
judged: 2026-10-22T06:44:11.724Z
model: fable
agent: fankeel-judge
task: "station 遠端的手機實測（S24 + Tailscale）"
session: 8a1d6ae0-88cf-47ed-b122-33b0a48182ce
stage: land
---

# 判官題：另一個 session 在產口語化簡報，為什麼沒有主動派 fankeel-writer？是定義切得不夠清楚嗎

## Question

# 判官題：另一個 session 在產口語化簡報，為什麼沒有主動派 fankeel-writer？是定義切得不夠清楚嗎

## 問題（使用者原話）

「現在有另一個 SESSION 輸出有關口語化簡報這些，他怎麼不主動派 WRITER AGENT？是我們定義切的不夠清楚嗎？」

## 背景

- 這個 registry（F:/ymlab/fankeel/.fankeel/sessions/）裡此刻沒有別的 live session，所以使用者說的 session 可能在別的工作區或專案。要找：`C:/Users/user/.claude/projects/` 底下今天（2026-10-22）、這個 session（8a1d6ae0-…）以外、最近幾小時內出現「簡報」「口語」「presentation」的 transcript（.jsonl），讀它最後在做什麼、用了哪個 skill、有沒有考慮過派 agent。找不到就照實說，改用定義本身作答。
- 目前的分工（要逐字查證）：
  - `agents/fankeel-writer.md`：只寫一頁給人看的 docs 頁——guide 目錄下的頁或 README.md；拒絕其他目標、拒絕多頁、拒絕沒有頁面路徑。
  - `skills/fankeel-explain/SKILL.md`：簡報、報告、進度同步、整理思路的「說法」——觸發詞含「簡報」。它是 skill（在主 session 裡照著說），不是 agent。
  - fankeel 主 skill 的 Subagents 段：「Dispatch 是預設，在這裡做才需要理由」，例外只有「pipe 已經去掉殘留」與「一次工具呼叫」。
- 可能的缺口：口語化簡報的產物是聊天內容或一個檔案？若是檔案，它不在 writer 允許的目標裡；若是聊天，explain 讓主 session 自己說，沒有任何規則說要派 writer。也可能是 session 沒在 fankeel 任務裡（沒有 stage rules 注入），所以根本沒讀到 dispatch 預設。

## 要選的

1. **定義沒問題，是那個 session 沒照做**（例如不在 fankeel 模式、或 explain 的範圍本來就是主 session 自己講）——不改。
2. **writer 的範圍太窄**：擴大 writer 的允許目標（例如 docs 下的簡報、報告頁，或任意一份給人看的 md），讓 explain 的檔案型產物能派它。
3. **explain 該寫明何時派 writer**：在 fankeel-explain 加一句「產物是要留下的檔案時派 fankeel-writer；只在聊天裡說時自己說」，並寫清 writer 的目標規則。
4. **另開一個 agent**（例如 presenter）專做簡報。

## 要讀的

- `agents/fankeel-writer.md`（全文）
- `skills/fankeel-explain/SKILL.md`（全文，尤其簡報、報告、輸出成檔的段落）
- `skills/fankeel/SKILL.md` 的 `## Subagents`、`### Dispatch by default, never the filtering`
- `lib/stages.js` 裡提到 writer 或 explain 的規則（grep `fankeel-writer`、`fankeel-explain`）
- `hooks/` 裡注入 agent 清單或 dispatch 預設的地方（grep `writer`）
- 上面說的那個 session 的 transcript（若找得到）
- `docs/90-agent/reference/subagents.md` 裡 writer 的那段

## 什麼算答案

一個 pick（1–4 或組合）；指出那個 session 實際沒派的原因（有證據就引 transcript 的行，沒有就說沒找到）；若要改，指出改哪個檔、哪一段、一句話的新規則；以及要不要開 TODO（一句話標題）。

## 回傳形狀

六個欄位（依 fankeel-judge 的固定格式，含 `pick:`），之後 `## Summary`。繁體中文。不要把任何 transcript 裡的私人內容（主機名、topic、IP）抄進答案。

## Answer

pick: 3（主）＋ 1 的一半 —— writer 定義沒切錯，缺的是 explain 沒寫「產物是檔案時派誰寫」；不選 2、4
why: 那個 session 在 fankeel build 裡，有照 dispatch 預設派 brain→implementer；沒派 writer 是計畫裡根本沒有「口語化」這一步（transcript L2952），使用者問了才補。
why: 補派時 writer 依自己的範圍拒絕（L3017）—— agents/fankeel-writer.md:70 只收 docs/01-guide/ 與 README.md，講稿本來就不在內，這是設計、不是切不清。
why: 真正的缺口在 skills/fankeel-explain/SKILL.md:44「A report or a presentation」只講結構，全文沒有一句說產物是要留下的檔案時派誰、只在聊天裡說時自己說。
why: 且 prose.style 規則只注入 fankeel-writer 的 brief（lib/render.js:848）；implementer 改寫講稿收不到，只能靠 brief 手寫要求（L2953 正是這樣做的）。
why: 擴 writer（2）會讓它的「what / why / example」docs 頁規則去寫銷售講稿，形狀不合；另開 presenter（4）沒有證據需要，一個帶 explain 規則的 implementer 已做完。
would flip if: profile 的 prose.style 規則本身就夠通用、能產口語講稿（我沒讀 lib/prose.js 的規則內容）—— 那麼放寬 writer 的目標（2）會比在 explain 加句子更省事。
unread: 另一 session 的 subagent transcript（writer 實際拒絕原文）、gate 回答行 L2998、lib/prose.js 的 prose.style 規則
delegated: agents/fankeel-writer.md + skills/fankeel-explain/SKILL.md（opus）；skills/fankeel/SKILL.md §Subagents + docs/90-agent/reference/subagents.md（sonnet）；lib/stages.js + hooks/ + skills/fankeel-explain/ 目錄（sonnet）；C:/Users/user/.claude/projects/F--ymlab-SBIR-ProjectWorkspace/ef621f87-338c-41cf-aaf0-0be789150762.jsonl（opus）
checklist: 1 writer 目標與拒絕 — 已答；2 explain 簡報段與派 writer 句 — 已答；3 主 skill dispatch 預設與例外 — 已答；4 subagents.md writer 段 — 已答；5 stages.js 的 writer/explain — 已答；6 hooks 注入 agent 清單與「在任務裡」判定 — 已答；7 找到 transcript、讀它用什麼 skill、有無考慮派 agent — 已答

## Summary

### 要改的一句話與 TODO

- 改哪裡：`F:/ymlab/fankeel/skills/fankeel-explain/SKILL.md:44` 的「## A report or a presentation」段末，加一句：
  「產物是要留下的檔案時，寫的工作派出去：頁在 `docs/01-guide/` 或 `README.md` 派 `fankeel-writer`；其他檔（講稿、簡報備註、報告）派 implementer，把本 skill 的規則寫進它的 brief；只在聊天裡說時，自己說。」
- 要不要開 TODO：要。標題一句：「fankeel-explain：產物是檔案時派誰寫——guide/README 給 writer，其他給帶 explain 規則的 implementer」。
- 不改 `agents/fankeel-writer.md`：它的範圍（A:12-14、A:70-72）是 docs-writer 設計刻意切的（docs/90-agent/reference/subagents.md:104-108 同樣只說「rewrites one page under docs/01-guide/ or README.md」），這次它也正確拒絕了。

### 那個 session 實際沒派的原因（有 transcript 證據）

找到的 transcript：`C:/Users/user/.claude/projects/F--ymlab-SBIR-ProjectWorkspace/ef621f87-338c-41cf-aaf0-0be789150762.jsonl`（今天 14:38，8 MB，3,215 行）。搜尋範圍：排除本 session 與 72 個 ilsbench 暫存檔後，今天 44 個 .jsonl 中 37 個含「簡報|口語|presentation」；這個檔 742 次命中、「口語」41 次，其餘檔 0–14 次，沒有任何檔含「口語化簡報」原字串。reader（opus）判它是目標，我抽查 L2952、L3017 兩行內容與 reader 所述一致。

- 它在另一個工作區（SBIR）的 fankeel 任務裡，注入的 stage 文字遍布（`@ build` 331 次、`.fankeel/sessions` 16 次）——所以「沒在 fankeel 模式、沒讀到 dispatch 預設」這條假設不成立。
- 它做的是給廠商的銷售講稿（一份 md）加 24 頁 pptx 的講者備註，要求每頁一到三句口語（L2579）。
- 主 session 只派過 `fankeel-brain`（53 次）與 `fankeel-judge`（4 次），沒直接派過 writer。
- L2938 使用者問「有沒有派 WRITER 要口語化」；L2952 session 答（抽查原文）：「沒有派。講稿是判官起稿、實作的 agent 照抄進 md 和備註的，中間沒有專門的 writer 把它改成口語。這輪回 build 就加上這一步。」→ 不是不願派，是計畫裡沒有這一步。
- L2953 build-2 的 brief 叫 brain 先試 `fankeel:fankeel-writer`，若因目標不在 guide/README 被拒就改派 implementer 並把口語要求寫進 brief。
- L3017 brain 回報（抽查原文）：「fankeel-writer，它因目標不在 guide 或 README 而拒絕、沒改任何檔；改派 1 個 implementer（sonnet）完成改寫與重建」。
- 產物落在檔案（講稿 md 與 pptx 備註），由 implementer 子代理寫，不是聊天內容。

### 定義本身各讀到什麼

- `agents/fankeel-writer.md`（opus reader；抽查 :66-75 相符）：A:3、A:12-14 只收 `docs/01-guide/` 下的頁或 `README.md`；A:70-72 三條拒絕（目標不在範圍、多頁、沒頁路徑）、A:74 改任何檔之前先拒。全文 81 行沒有 簡報／presentation／report／口語／explain。誰派它、在哪個 stage 沒寫。
- `skills/fankeel-explain/SKILL.md`（opus reader；抽查 :44-49 相符）：B:3 description 的觸發詞含「簡報、報告、進度同步、整理思路」；B:44-49 簡報段只給結構「problem → why it matters → evidence → finding → fix → why this fix → result → next step」。全文沒有 fankeel-writer、dispatch、subagent、派、子代理；也沒有一句說產物是聊天或檔案。B:12「Produces a reply the reader understands on first reading」、B:90-91「Reply in the language the user writes in」—— 隱含它是主 session 自己說的 reply。目錄只有 SKILL.md，沒有樣板。
- `skills/fankeel/SKILL.md`（sonnet reader；抽查 :922-937 相符）：:924「Dispatch is the default. Doing it here is what needs a reason.」:932-935 兩個例外「a pipe already removes them」「it is one tool call」，:937「Everything else is a dispatch」。§Subagents（:901-990）沒有 fankeel-writer，沒有「給人看的頁誰寫」。:908-909 把規則綁在「while the mode is on」。:846 提到 fankeel-explain 只在 voice 段。
- `docs/90-agent/reference/subagents.md`（sonnet reader）：:104-108 writer 是「a stage's hands, one per kind of write」，「rewrites one page under docs/01-guide/ or README.md for a person」；無 explain／簡報。
- `lib/stages.js`（sonnet reader；抽查 :752-757 相符）：STAGE_AGENTS 只在 build（:753）與 audit（:755）列 `fankeel:fankeel-writer`；verify、land、survey、plan 沒有。沒有 explain，沒有「dispatch by default」文字。
- `hooks/`（sonnet reader）：hooks 裡沒有「Dispatch is the default」，那句只在 SKILL.md:924。`writer` 唯一命中是 hooks/brief.js:21 註解，實際注入在 lib/render.js:848 `if (type === 'fankeel-writer') ... prose.briefLines(...)` —— prose.style 規則只給 writer。brain 可派清單由 lib/render.js:636-638 從 agentsFor(stage) 組出；hooks/guard.js:165-178 拒絕不在 stage.agents 的派送。「在不在 fankeel 任務裡」由 hooks/inject.js:95-100 看 registry 的 active entry 決定。

### 怎麼推到 pick

使用者的兩個問句分開答：
1. 「怎麼不主動派 writer」—— 證據是 L2952：計畫沒排口語化這一步，不是漏讀 dispatch 預設（它在 fankeel 模式裡、也確實派了 brain→implementer）。
2. 「定義切的不夠清楚嗎」—— writer 的定義很清楚，清楚到它正確拒絕了講稿（L3017 對上 A:70）。切不清楚的是 explain：它負責「怎麼說」，卻沒說「產物是檔案時誰來寫」；加上 prose 規則只注入 writer（render.js:848），implementer 寫的講稿不會自動拿到說法規則。L2953 那個 session 自己摸出的做法（writer 先、拒了就 implementer 帶要求）正是該寫進 explain 的一句話，所以選 3。
不選 2：writer 的內容規則是 docs 頁形狀（what / why / example、每句能指 path:line），銷售講稿不是那種東西；放寬目標只會讓它拒絕得更晚。不選 4：一個帶規則的 implementer 已把活做完，沒有證據需要新 agent。

### 沒查到的

- 那個 session 的 subagent transcript（writer 拒絕的原文）、L2998 的 gate 回答、L3171 另一 session 訊息——都不影響結論。
- `lib/prose.js` 的 prose.style 規則內容：若它夠通用，放寬 writer（2）會是更小的改法，這是「would flip if」。
- 寫入 context.md 三條：writer 範圍（agents/fankeel-writer.md:70）、explain 無派送句（skills/fankeel-explain/SKILL.md:44）、STAGE_AGENTS 與 prose 注入範圍（lib/stages.js:753）。
