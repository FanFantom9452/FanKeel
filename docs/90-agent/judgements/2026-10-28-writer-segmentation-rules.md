---
judged: 2026-10-28T13:22:09.951Z
model: fable
agent: fankeel-judge
task: "writer 講人話：字幕斷句規則式 prompt 能否用在 writer／prose"
session: 51df66bd-7104-43cb-ac88-b0c60727a89b
stage: survey
---

# 43 — writer 有沒有照「語意斷句」寫？要不要把這套規則放進 fankeel？

## Question

# 43 — writer 有沒有照「語意斷句」寫？要不要把這套規則放進 fankeel？

## 問題

使用者問：「我們 WRITER 有設計成這樣嗎？讓他更講人話、貼近一些。」並主張：斷句精準度不需要大量人工校正過的字幕當基準，下一段 prompt 就能解決，這段 prompt 也可以直接問 AI 得到。他貼的規則（原文照錄）：

1. 以「語意完整、自然閱讀」為最高原則斷句，不要只按照固定字數切割。
2. 絕對不要把一個完整詞彙、專有名詞、人名、品牌名、數字＋單位拆開。
3. 不要在語法關係緊密的位置斷開：主詞／謂語、動詞／受詞、介系詞／其後名詞、修飾語／被修飾語、助動詞／主要動詞、固定搭配／慣用語／片語中間。
4. 優先在自然的語意停頓處斷句：標點附近、子句之間、語意轉折處、說話者自然換氣或停頓的位置。
5. 每一段字幕都應該讓觀眾「單獨看到這一段時，也能快速理解」。
6. 避免上一段留下懸而未決的詞（因為、所以、但是、如果、就是、而且），除非口語節奏確實需要。

要判的有兩件：
(a) fankeel 現在寫給人看的文字（fankeel-writer、`prose.style` 四種風格、`lib/plain.js` 的機械檢查）有沒有已經涵蓋這些規則？哪幾條有、哪幾條沒有，各指到 path:line。
(b) 該怎麼處理，從下面選一個。

## 選項

- A. 不改。現有規則已涵蓋，或這套是字幕專用、不適用於文件頁與 gate。
- B. 把其中適用於書面文字的幾條（例如 2、3、5、6 的書面版）改寫進 `STYLES.plain` 或 `STYLES.writer` 與 `agents/fankeel-writer.md`，`plain-language.md` 同步；不加機械檢查。注意 `lib/prose.js` 的 SUGGESTED 450／MAX 1200 字元與 brief 長度預算。
- C. 不改內建風格，只建議使用者用 `prose.style custom` 寫進 `.fankeel/prose.md`。
- D. B 再加一條機械檢查到 `lib/plain.js`（例如：句子或行尾停在懸空連接詞「因為／所以／但是／如果」就報），或改動 160 欄硬切的做法。

也請對使用者的主張「不需要人工校正基準、prompt 就夠」給一句判斷：在 fankeel 的語境（文件頁、gate、報告，而非影片字幕）是否成立，要不要一個可量測的檢查來代替「讀起來像人話」的感覺（參考 docs/judgements 裡 42 號 Uncle Bob「measure not read」那份判斷的方向）。

## 背景

- fankeel 本身沒有字幕功能；影片字幕在另一個 plugin（launch-video）。使用者的規則原本是字幕斷句用的。
- `prose.style` 預設 `writer`；`plain` 是 ASD-STE100 受控語言五條；句長上限 160 欄（CJK 兩欄）由程式擋在 gate、docs-check。
- 使用者要回覆一律繁體中文。

## 要讀的路徑

- agents/fankeel-writer.md
- lib/prose.js（STYLES、SUGGESTED、MAX）
- lib/plain.js（SPLIT、MAX_SENTENCE_WIDTH、proseProblem）
- docs/90-agent/reference/plain-language.md
- docs/99-archive/2026-10-05-prose-style-design.md
- skills/fankeel-explain/SKILL.md
- docs/judgements/ 下 42 號 uncle-bob measure-not-read 那份（用 Glob 找）
- tests/ 裡測 prose／plain 的檔案（決定改動的成本）

## 什麼算答案

一個 pick（A／B／C／D 之一），六條規則逐條標「已涵蓋／部分／未涵蓋／不適用」各附 path:line，以及若選 B 或 D，要改的檔案與建議的規則文字草稿（繁中或英文皆可，標出字元數是否在 450 內）。

## 回答的形狀

六欄（pick 開頭），然後 `## 白話`（600 字內，繁體中文，讓使用者一讀就能說出選了什麼、主因是什麼），然後 `## Summary`。

html: yes

## Answer

pick: A — 不改。六條裡四條是「把一段話切成字幕格」的機械，fankeel 從不在句中切；對書面文字有意義的兩條（一句一件事、句子自成一體）已在 `STYLES.plain` 與 plain-language.md。
why: 逐條：1 已涵蓋 lib/prose.js:19、docs/90-agent/reference/plain-language.md:15；4 已涵蓋（由定義）lib/plain.js:20、plain-language.md:29；5 部分 lib/prose.js:19、plain-language.md:18-19、agents/fankeel-writer.md:49-50、lib/plain.js:64-71 逐欄檢查；2、3 不適用（句內沒有切點，最近的是 skills/fankeel-explain/SKILL.md:93-94）；6 未涵蓋，但散文句尾不會停在連接詞（agents/fankeel-writer.md:50 只說「保留連接詞」）。
「160 欄硬切」不存在：lib/plain.js:73-75 只回「split it」把 gate 退回，沒有任何切字或重排的程式碼，D 的前提落空。
風格刻意不設程式檢查（docs/99-archive/2026-10-05-prose-style-design.md:19）；brief 沒有一筆「選項單獨看不懂」或「句尾懸空」的紀錄，沒紀錄的問題不修（judgement 42 :92 引 optimise-own-first.md:8）。
對主張的判定：prompt 夠讓模型照做，不夠讓人知道它照做了；fankeel 已照 42 號的分工——量得到的（句長、裸代號）交程式 lib/plain.js:12、:73-79，量不到的留人讀——不加新檢查。
若日後要 B，成本低：tests/prose.test.js:58-62 只測每段 ≤450，沒有釘原文；plain 330 字元還有 120 字空間。
would flip if: 任一筆真實紀錄（gate 選項、guide 句、完成紀錄）出現單獨看不懂、或句尾停在「因為／所以／但是／如果」→ 轉 B，用摘要的草稿（plain 加 105 字元成 436，在 450 內）。
unread: brief 點名的路徑都開了。tests/ 裡 surface-threshold-prose、explain-dispatch、version-prose 三檔只比對檔名未開（不測 STYLES 原文或 plain.js）；lib/chartroom/README.md 只看了格式五行。
delegated: agents/fankeel-writer.md（opus）；docs/90-agent/reference/plain-language.md（opus）；lib/prose.js（opus）；lib/plain.js（opus）；docs/99-archive/2026-10-05-prose-style-design.md（sonnet）；skills/fankeel-explain/SKILL.md（sonnet）；docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md（sonnet；brief 寫 docs/judgements/，實際在 docs/90-agent/judgements/）；tests/plain.test.js、tests/prose.test.js、tests/prose-brief.test.js、tests/prose-profile.test.js、tests/record-docs.test.js（sonnet）。
checklist: 1 writer agent 六條對照 — answered；2 plain-language.md 六條對照 — answered；3 STYLES 原文、字數、SUGGESTED/MAX — answered；4 plain.js SPLIT／160／proseProblem 是退回還是切字 — answered；5 archive 為何三內建＋custom、預算保護什麼 — answered（預算理由頁上沒寫，prose.js:24-27 註解補了）；6 explain skill 有無重述規則 — answered；7 judgement 42 結論與限制 — answered；8 tests 釘住什麼 — answered。

## 白話

選 A，不改：這六條是「把一段話切成一格一格字幕」用的規則，fankeel 寫文件和關卡問題時根本不切句子，所以其中四條沒有東西可以套。
好比裁縫的「別從鈕扣中間剪」，對一間只賣整件衣服、從不裁布的店沒意義：fankeel 只在句號處結束句子，程式碰到太長的句子也只是退回請作者重寫，不會自己剪。
真正對書面文字有意義的兩條——「一句講一件事」和「句子自己要說得通」——已經寫在 plain 風格和寫手的規則裡；少的只是「每句單獨看也能懂」這句明文，目前沒有一筆紀錄顯示缺它出過問題，先不加。
關於「不用人工校正基準、prompt 就夠」：prompt 夠讓 AI 照做，但不夠讓你知道它有沒有照做；fankeel 已把量得到的（句長、裸代號）交給程式，量不到的留給人讀，這正是 42 號判決的做法。哪天真要加，草稿和字數都在摘要裡，預算放得下。

## Summary

### 六條規則逐條對照（path:line）

| 規則 | 判定 | 根據 |
|---|---|---|
| 1 語意完整斷句，不按固定字數 | 已涵蓋（原則）；字面上「部分」 | `STYLES.plain` 第一句 "One sentence says one thing: two things are two sentences"（lib/prose.js:19）、plain-language.md:15「一句只講一件事」。160 欄（plain-language.md:16、lib/plain.js:12）是天花板不是切點：低於 160 的句子程式碰都不碰。 |
| 2 不拆詞彙／專名／人名／品牌／數字＋單位 | 不適用 | fankeel 沒有「在句子中間切一刀」的步驟；句子只在作者放句號處結束，程式的切點也只有標點（lib/plain.js:20 `SPLIT = /[。！？；|]|[.!?;](?=\s|$)/`）。最近的對應是 skills/fankeel-explain/SKILL.md:93-94「不壓縮數字與單位、識別字、路徑」與 agents/fankeel-writer.md:58-59「路徑與識別字放 code」——那是「不要改寫」不是「不要拆」。 |
| 3 主詞／謂語、動詞／受詞等緊密處不斷 | 不適用 | 同上。書面句子的結尾永遠是完整子句；沒有句內硬切就沒有「切在緊密處」的可能。 |
| 4 優先在標點、子句之間、語意轉折處斷 | 已涵蓋（由定義） | 句界＝標點（lib/plain.js:20、plain-language.md:29）；程式對過長句子只說「split it」（lib/plain.js:75），作者自己把新句尾放在標點。 |
| 5 每段單獨看也能快速理解 | 部分 | `STYLES.plain`「Name who did what… No code stands where a name should be」（lib/prose.js:19）、plain-language.md:18-19（不用代號、寫誰做了什麼）、agents/fankeel-writer.md:49-50（術語第一次出現就解釋——這是線性閱讀的假設，不是「單獨看」）。`proseProblem` 把每個 gate 的 question、每個 option 的 label 與 description、next 各自當一欄檢查（lib/plain.js:64-71），所以每個選項至少在句長與代號上自成一體。沒有一句明文說「讀者只看到這句也懂」。 |
| 6 句尾不留「因為／所以／但是／如果」 | 未涵蓋；實務上不適用 | agents/fankeel-writer.md:50「Keep the connectives」講的是不要省掉連接詞，不講它落在哪。lib/plain.js 沒有任何檢查看句尾字（reader 整檔確認）。但散文的句尾在句號前，「……因為。」本身就不成句，作者不會這樣寫；懸空只發生在有視覺硬切的媒介（字幕），fankeel 沒有。 |

### 各 reader 的發現

- **writer agent 與 plain-language.md（opus）**：兩檔都以「句子」為最小單位，沒有任何關於句內斷行的規則；rule 1、4、5 只被「一句一件事」「160 欄」「全句」側面碰到。writer.md 唯一談長度的是章節長度 :44，不是句子。plain-language.md:9 寫明句長與代號兩項由程式檢查、不分風格，適用於主 session 說的話、gate 問題與選項、guide 頁、TODO 完成紀錄；:23-25 寫明擋在哪（`ruleProblem`→`proseProblem` 退 gate；docs-check 回報 `long-sentence`／`bare-code`）。
- **prose.js 與 plain.js（opus）**：三段內建風格 writer 387、plain 330、sepia 422 字元（用 `prose.length` 數），`SUGGESTED = 450`（prose.js:28，註解 :24 說是 sepia 422 進位）、`MAX = 1200`（:29，為 SubagentStart 10,000 字元留約 3,500 空間，:26-27）。兩者只量風格文字本身，不量整份 brief。超過 SUGGESTED 只在 `task.js profile set` 時警告（:73）；超過 MAX 或檔案缺失退回 writer 並附一行說明（:49-50）。`proseProblem` 只做兩件事：句寬（:73-75）與裸代號（:77-79），回第一個違規欄位；唯一呼叫者是 lib/handoff.js:283 的 `ruleProblem`。**沒有任何程式碼切字或重排**——160 是退回，不是硬切。
- **archive 設計頁與 explain skill（sonnet）**：設計頁 :12 兩項機械檢查不分風格；:18 底線（`proseProblem`／`proseFindings`）只查句長與裸代號；:19「風格沒有程式檢查，因為它本來就要求判斷」；:23 每段要在 SUGGESTED 內、測試會量；:31 custom 讀 `.fankeel/prose.md`，超建議值只警告；:33 預算數字當時只是提案（約 400／1200），後來寫死成 450／1200。頁上沒有說預算「保護什麼」，prose.js:24-27 的註解才說。explain skill :27「一句一訊息」、:30-32 例子先於定義、:93-94 不壓縮數字單位與識別字、:98-104 中文受控段落連到 plain-language.md 並重述 160 欄與一句一件事。
- **judgement 42（sonnet）**：檔在 docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md（brief 寫的 docs/judgements/ 下沒有）。pick B 借四件小東西（:64）；原則在 :90「人讀報告與證據表不讀碼，但 fankeel 多一層 reviewer 對 claim 讀 diff，該留」；拒絕清單 :122-126：不裝複雜度／coverage 工具（零依賴硬規矩）、不放鬆先測、不寫進每輪注入（per-turn block 2397/2400）；:92 引 optimise-own-first.md:8「沒有記錄過的問題對得上」。整份沒有一字談 prose、句寬或 lib/plain.js。
- **tests（sonnet）**：tests/prose.test.js:58-62 只斷言每段內建 ≤ SUGGESTED、SUGGESTED < MAX、NAMES 四個名字；沒有測試釘住 `STYLES.plain` 或 `STYLES.writer` 原文（所有引用都是常數比對，:25、:34、:49、:69；prose-brief.test.js:54、:61-62、:74、:90）；:36 要求 sepia ≠ writer。tests/plain.test.js:9 釘 `MAX_SENTENCE_WIDTH === 160`、:10-13 釘切點與 CJK 兩欄；:33-39 釘 `proseProblem` 的兩段訊息原文。沒有測試或 script 比對 writer.md 與 plain-language.md 同步（record-docs.test.js:10-11 只查完成紀錄段）。跑法：`node --test --require ./tests/subprocess-timeout.js tests/plain.test.js tests/prose.test.js tests/prose-brief.test.js tests/prose-profile.test.js`。

### 抽查結果

五個 reader 各開一處，全部與原文相符：agents/fankeel-writer.md:49-51；plain-language.md:15-16、:29；lib/prose.js:18-20、:24-29；lib/plain.js:12、:20、:62-83；archive :18-19、:31、:33；SKILL.md:98-104；judgement :90、:122-126；tests/prose.test.js:58-63；tests/plain.test.js:8-14。沒有一處與 reader 的說法不符。

### 怎麼得出 A

1. 六條規則的對象是「把連續語音切成有時間長度的格子」。fankeel 的文字沒有這個步驟：句子是最小單位，句尾一定在標點，程式只量句寬、不切（lib/plain.js:73-75）。所以 2、3、4、6 四條在 fankeel 沒有可套用的那一刀——不是「沒寫」，是「沒有東西可以寫」。
2. 剩下 1 和 5 是書面文字真正用得上的。1 已是 `STYLES.plain` 第一句與 plain-language.md 第 1 條；5 的實質（主詞明確、不用代號、每欄各自檢查）都在，缺的只是「單獨看也懂」這句明文。
3. 加這句的成本不高（plain 還有 120 字元、測試不釘原文），但設計頁 :19 把風格留給判斷是刻意的，而且 brief 沒有任何一筆真實紀錄顯示 fankeel 的 gate 選項或 guide 句曾經「單獨看不懂」或「句尾懸空」。judgement 42 :92 的原則是沒有記錄的問題不修。每多一句風格文字，每次派 writer／brain 的 brief 都多付一次。
4. D 的前提「160 欄硬切」不存在；而「句尾停在連接詞」的檢查在散文裡幾乎永遠不會觸發（「……因為。」本身不成句），檢查寫得出來、值不回本。
5. C 不選是因為使用者的問題是「我們的 writer 有沒有這樣設計」，答案是「有意義的部分已經有」，不需要引導他另寫一份 custom。

### 對「不需要人工校正基準、prompt 就夠」的判定

在 fankeel 的語境（文件頁、gate、報告）：**一半成立**。prompt 足以讓模型產生這種行為（模型照「一句一件事」寫，不需要校正語料）；但 prompt 不能告訴你它有沒有照做——「讀起來像人話」是讀出來的感覺，正是 42 號判決要換成數字的那一層。fankeel 已經這樣分工：量得到的兩項（句寬 160、裸代號）由 lib/plain.js:12、:73-79 擋在 gate 與 docs-check，量不到的（風格）留給人讀（archive :19）。六條裡唯一能量的是「句尾懸空連接詞」，而它在散文裡沒有真實觸發案例，所以不加新檢查。順帶一句，不在 fankeel 範圍：在字幕 plugin（launch-video）裡，「斷句精準度」若連一個數字都沒有（例如抽 50 格人工標對錯），就只是感覺；要說「夠」，先量一次。

### 若日後翻成 B 的草稿（字數為手數，未用 node 量）

- `STYLES.plain`（lib/prose.js:19）句尾加：`Each sentence stands alone: seen by itself, it still makes sense. End on the point, not on a connective.`——105 字元，330＋1＋105＝436，在 450 內。
- `STYLES.writer`（lib/prose.js:18）387 字元只剩 63 字空間，同一句放不下；建議不動 `STYLES.writer`，改在 agents/fankeel-writer.md:49-51 那條 bullet 後加一條（agent 檔沒有 450 預算）：`- Each sentence stands alone: a reader who sees only that sentence still understands it. End it on the point, not on a connective.`
- docs/90-agent/reference/plain-language.md:13-19 五條加第 6 條：`6. 每句單獨看也能懂；句尾落在重點，不落在「因為／所以／但是／如果」。` 同時 :9「五條規則」改「六條」。
- 不加測試、不改 lib/plain.js；跑上面那行四檔測試即可（它們只量長度）。

### 寫進 context.md 的兩筆

`.fankeel/build/task-20261028T131448/context.md`：(1) lib/plain.js:73-75 的 160 欄只退回不切字；(2) lib/prose.js:18-20 三段風格字數與 tests 不釘原文。

```chartroom
{"chartroom":1,"title":"六條斷句規則對 fankeel 現有規則","root":"main"}
{"view":"main","title":"六條斷句規則對 fankeel 現有規則","dir":"LR"}
{"node":"r1","in":"main","label":"1 語意斷句不按字數"}
{"node":"r2","in":"main","label":"2 不拆詞／專名／數字單位"}
{"node":"r3","in":"main","label":"3 語法緊密處不斷"}
{"node":"r4","in":"main","label":"4 在自然停頓處斷"}
{"node":"r5","in":"main","label":"5 單獨看也能懂"}
{"node":"r6","in":"main","label":"6 不留懸空連接詞"}
{"node":"cov","in":"main","label":"已涵蓋：一句一件事／切點＝標點"}
{"node":"na","in":"main","label":"不適用：fankeel 從不在句中切"}
{"node":"part","in":"main","label":"部分：主詞、不用代號、逐欄檢查"}
{"node":"none","in":"main","label":"未涵蓋，但散文句尾不會停在連接詞"}
{"edge":"e1","in":"main","from":"r1","to":"cov","arrow":"end"}
{"edge":"e2","in":"main","from":"r2","to":"na","arrow":"end"}
{"edge":"e3","in":"main","from":"r3","to":"na","arrow":"end"}
{"edge":"e4","in":"main","from":"r4","to":"cov","arrow":"end"}
{"edge":"e5","in":"main","from":"r5","to":"part","arrow":"end"}
{"edge":"e6","in":"main","from":"r6","to":"none","arrow":"end"}
```
