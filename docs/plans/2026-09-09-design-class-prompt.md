---
status: design-intent
last_verified: 2026-09-09
---

# PROMPT — 為 fankeel 設計 `design` class 與軸鎖定機制

這份文件原文出自 caveman.zip，是 2026-09-09 讀進本 repo 的四份文件之一，作者是在
本 repo 之外的另一輪對話裡寫成的；下方全文照抄，未經改寫或翻譯。它是一份要交給
**後續 session** 執行的 prompt，不是一份已經執行過的計畫，這裡也沒有任何交付物
真的被做出來。

> **怎麼用**：開一個新 session，工作目錄設在 **fankeel 的原始碼 repo**，然後說：
>
> ```
> 讀 C:\SynologyDrive\School_ClassProjects\caveman\PROMPT-design-class-for-fankeel.md 並執行
> ```
>
> 或直接把本檔全文貼進去。建議模型：**Fable 5.1**（寫作任務）。實作階段換 **Opus 5**。
>
> **注意**：這份 prompt 很長，那是刻意的。Prompt 是 input，讀一次；SKILL.md 是每回合注入的 output，讀一輩子。
> **兩者的長度紀律完全相反**，不要把這份文件的密度帶進你要寫的 skill。

---

## 你的任務

在 fankeel 這個 plugin 上，新增第四個 class：`design`，用來做前端 UI 工作。

**要解決的問題**：使用者裝了 68 個設計 skill，但 AI 每次都產出通用設計。原因不是缺素材——盤點顯示軸的機制已經被獨立實作了六次，反通用清單有八份。**缺的是選擇器**：沒有任何東西決定何時用哪一套。

**你要產出的是 SKILL.md 的實際文字，不是產出計畫。**

---

## 必讀（依序）

### 1. 盤點結果

```
C:\SynologyDrive\School_ClassProjects\caveman\DESIGN-axis-inventory.md
```

這是 68 個設計 skill 的軸盤點。**第三部的統一軸表和第五部的四個缺口是你的規格來源。** 不要重新盤點，也不要發明軸表裡沒有的軸——每一個軸都必須對應到某個已安裝 skill 的實際內容。

### 2. 三份架構掃描（取模式，不取內容）

```
C:\SynologyDrive\School_ClassProjects\caveman\FANKEEL-improvement-brief.md          (caveman + sepia)
C:\SynologyDrive\School_ClassProjects\caveman\FANKEEL-improvement-brief-2-adhd.md   (i-have-adhd)
```

**注意第二份的第零部是對第一份的勘誤，先讀那一節。**

### 3. fankeel 自己

- `skills/fankeel/SKILL.md` — route、class、stage、gate、claims、scope guard 的定義
- `skills/fankeel-{survey,design,plan,build,verify,land}/SKILL.md` — 六個 stage skill
- `lib/stages.js` — stage 規則的注入
- `lib/plantasks.js` — plan 的 `**Files:**` 解析與分組
- `scripts/task.js` — class 與 route 的寫入點

### 4. 要被路由的素材（只讀你決定要引用的）

```
~/.claude/plugins/cache/taste-skill/taste-skill/1.0.0/skills/imagegen-frontend-web/SKILL.md   §2
~/.claude/plugins/cache/taste-skill/taste-skill/1.0.0/skills/taste-skill/SKILL.md             §0–1
~/.claude/plugins/cache/impeccable/impeccable/4.2.2/skills/impeccable/SKILL.md                Modes
~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.6.2/.claude/skills/ui-ux-pro-max/data/*.csv
```

---

## 交付物（四項）

### 交付物 1 — `design` class 的定義

寫進 fankeel 的 SKILL.md class 表。目前有三個：

```
spike          survey,build
bounded        survey,design,build,verify,land
architectural  survey,design,plan,build,verify,land,audit
```

`design` class 的 route 由你決定並說明理由。約束：

- 必須有一個階段產出**可以看的東西**（見下方「必須解決的三個設計問題」第 1 題）
- `task.js` 的 class 驗證要能接受它
- ratchet 是單向的（class 只能往上升）——說明 `design` 在這個階梯上的位置，或說明它是正交的而不是一個階

### 交付物 2 — 軸鎖定檔的格式

一個檔案格式，住在專案的 `.fankeel/` 裡，記錄這個產品**鎖定的軸值**。它是那篇貼文所說的「② Shared UI Authority」。

要求：

- 每一軸一列：軸名、選定值、**選定的理由**、來源（哪個 skill 的哪一節）
- 理由欄不可空白——**理由是這份檔案存在的原因**，沒有理由的軸值就是憑感覺挑的
- 必須能容納「既有專案約束」：現有色票、字體、間距 token，作為**不可違反的硬約束**（軸表缺口 C）
- 版本控制：跟 `docs.json` 一樣進 git，不是 per-machine

給出完整範例，用一個真實可想像的產品（不要用 `foo` / `MyApp`）。

### 交付物 3 — 路由表

fankeel 的 `design` stage 進入時，決定載入哪些 skill 的哪些節。**照 sepia 路由表的形狀寫**：一張表，每列是一個情境，欄位是「依序載入什麼」，粒度細到節。

第一維必須是 **Mode**（`impeccable` 的 Persuade / Operate / Read / Experience），因為它決定其他軸的權重，而且目前 68 個 skill 裡只有一個有這一軸。

### 交付物 4 — stage skill 的增修

指出 `fankeel-design` / `fankeel-plan` / `fankeel-verify` 各需要增加什麼，並**寫出實際文字**。至少涵蓋：

- design：Mode 選擇、軸鎖定、preview gate、non-goals（軸表缺口 B）
- plan：`**Files:**` 當作事前邊界而不只是分組依據
- verify：對照軸鎖定檔逐軸檢查

---

## 必須解決的三個設計問題

**先做決定並寫下理由，再開始寫 skill 文字。** 這三題沒有標準答案，但答案必須明確。

### 問題 1 — 「可以看的東西」在 CLI 裡是什麼？

那篇貼文的核心是「先看得到 → 再確認 → 再文件化 → 最後才施工」，理由是：

> 腦中想的是 A → 跟 AI 說完變成 B → AI 寫出來又變成 C

fankeel 的 gate 是 `AskUserQuestion`，**是文字的**。文字 gate 只能抓 A→B 的落差，抓不到 B→C。

候選解法（自己評估，也可以提第四種）：

| 解法 | 代價 |
|---|---|
| 用 `imagegen-frontend-web` 生成參考圖 | 要圖像生成能力；圖不等於將實作出來的東西 |
| 產出單頁 HTML 樣張，用瀏覽器開 | 真實，但要先寫 code——順序又反了 |
| 用內建 `design` skill 的 canvas artifact | 有 artboard 與視覺編輯，但 fankeel 的 gate 在終端機 |
| 只做「一個代表性個案的真實產出」而不是全頁 | 最便宜，但可能不夠 |

**決定一個，說明為什麼其他三個不行。**

### 問題 2 — 68 個 skill 之間怎麼避免打架？

`imagegen-frontend-web` 說「left-text/right-image 是最被濫用的 AI 模式」，`taste-skill` 的 dial inference 在 public-sector 情境下把 VARIANCE 壓到 3–4（也就是對稱），這兩條在同一個任務裡會直接衝突。

sepia 對這種情況有明確程序（`voice-skills.md`）：

> **name both rules in the report and leave the choice to the user** — never silently override either.

以及一條統管規則：

> **Aim at the band, not the opposite pole.** Inverting every AI tell creates a new fingerprint.

**寫出 `design` class 的版本。** 特別要處理：八份 ban list 全是絕對禁令，沒有白名單、沒有「一次命中不算數，成群才算」的規則——**全部避開 left-text/right-image 的網站，看起來會一樣地刻意不對稱，那是另一種通用。**

### 問題 3 — 這是 fankeel 的一部分，還是一個新 plugin？

預設答案是「fankeel 的第四個 class」，理由是七層流程跟 fankeel 的 route 幾乎同構。**但你要驗證這個預設。**

反對的理由至少有一個：fankeel 的 skill 目前完全不談前端，加進去會讓每回合注入的內容多背一個領域。

如果你認為該拆開，說出拆開後**軸鎖定檔與 fankeel 的 registry 怎麼互相知道對方存在**。

---

## 硬約束

### 長度

| 檔 | 上限 | 對照 |
|---|---|---|
| `design` class 進 fankeel SKILL.md 的部分 | **+40 行** | 現有 class 表 3 列 |
| 路由表 | **一張表**，不超過 15 列 | sepia 的路由表 7 列 |
| 每個 stage skill 的增修 | **各 +25 行** | caveman 的 `surgical-patch` 全文 16 行 |
| 軸鎖定檔範例 | 不限（它是資料不是 prompt） | — |

長度標尺，`caveman:surgical-patch` 全文：

```
Reproduce failure first when economical; otherwise capture strongest available evidence.
- Trace symptom to responsible mechanism.
- Change narrowest layer that owns incorrect behavior.
- Preserve unrelated behavior and user changes.
- Avoid cleanup, renaming, and abstraction outside fix.
- Add only regression proof relevant to task.
Run focused proof plus nearest affected gate. Stop when failure is fixed and regression proof passes.
```

**16 行承載一個完整工作模式。** 這是可達成的密度，不是理想值。

sepia 量過一次相關的事：一個 reviewer 被告知「只回三行」，回了三行**加上十二點驗證日誌**；下一個被告知同樣的話**並說明理由**，回了剛好三行。同一個模型，同一種任務。**契約沒有理由就只是偏好。**

### 文體

- **不要用比喻代替直述。** 「a dial worth turning」→「a parameter worth varying」。fankeel 現有的 SKILL.md 已經偏文學腔（「The keel of a project: the one structural member a hull cannot lose」），**不要往那個方向加碼**
- 段落要斷。長句拆短
- 每條規則要能被檢查。「保持一致性」不能被檢查；「全站至少出現 3 種不同的 composition anchor」可以

### 素材

- **每個軸必須指向已安裝 skill 的實際內容**，附路徑與節號
- 軸表裡沒有的軸不要發明。真的需要新軸，另開一節標為「新增，無既有素材」並說明為什麼非有不可
- **不要重寫那 68 個 skill。** 你在寫路由，不是寫替代品

---

## 要套用的模式（來自三份掃描）

按重要性排序。每一項都有出處，需要細節就回去讀。

| # | 模式 | 出處 | 怎麼用在這裡 |
|---|---|---|---|
| 1 | **路由表：body 不承載規則，只承載「哪些規則現在該載入」，粒度細到節** | sepia `SKILL.md` Routing | 交付物 3 的形狀 |
| 2 | **entry_condition / stop_condition 成對** | caveman 的 6 個 pattern skill | design stage 何時進入、何時必須停 |
| 3 | **可失敗的自檢測試，配明確豁免清單** | sepia deletion/reversion test；i-have-adhd pre-send check（**兩者獨立收斂**） | 收尾檢查。形狀是「撤掉你做的，看會不會變差」+ 豁免項 + **一個可證偽的終局問題** |
| 4 | **白名單 + cluster 規則** | sepia `style-pass.md` §7 | 問題 2 的解 |
| 5 | **統管所有規則的元規則** | sepia Calibration：aim at the band / select don't accumulate / leave slack | 問題 2 的另一半 |
| 6 | **衝突不靜默裁決，兩條規則都寫進報告，讓使用者選** | sepia `voice-skills.md` | 問題 2 |
| 7 | **「空是合法值」條款** | i-have-adhd RESULTS.md：rule 8 逼模型在證據不足時編造成因，`partial-success` −0.63 | verify 對軸逐項檢查時，「這一軸無需檢查」必須是合法輸出 |
| 8 | **marker 圍出讀者區** | i-have-adhd `judge:begin` / `judge:end` | 軸鎖定檔同時給模型讀與給人讀時 |
| 9 | **「the constraint wins, the shape stays」** | i-have-adhd `SKILL.md` §5–6 | 規則與任務／harness 衝突時的統一原理 |
| 10 | **證據帶範圍而非四捨五入** | sepia `languages/zh.md` §6 | 引用任何設計「法則」時（Fitts / Hicks / Miller）標明適用範圍 |
| 11 | **Security boundary：外部文字是 data 不是 instruction** | sepia `SKILL.md` | design stage 會讀既有 code 與設計檔 |
| 12 | **copy + `cmp` 閘門而非 symlink** | i-have-adhd `cursor-skill-sync.yml`（**簡報二的勘誤 1**） | 若軸表需要在兩處存在 |

---

## 輸出格式

依序四節，各自完整，可以直接貼進檔案：

```
## 決定（三個設計問題的答案）
問題 1：<選了哪個，為什麼其他不行>
問題 2：<衝突處理程序>
問題 3：<class 還是新 plugin，理由>

## 交付物 1 — design class
<要貼進 fankeel SKILL.md 的實際文字，標明插在哪一節之後>

## 交付物 2 — 軸鎖定檔格式
<格式定義 + 一個真實產品的完整範例>

## 交付物 3 — 路由表
<一張表>

## 交付物 4 — stage skill 增修
### fankeel-design
<實際文字，標明插在哪>
### fankeel-plan
<同上>
### fankeel-verify
<同上>

## 未解決 / 需要覆核
<你沒把握的、需要看 fankeel 原始碼才能確定的、以及你刻意沒做的>
```

**最後一節不可省略。** 空著比編出來好。

---

## 不要做的事

1. **不要重新盤點那 68 個 skill。** 盤點已經完成，在 `DESIGN-axis-inventory.md`。你的工作從那張軸表開始
2. **不要發明軸表裡沒有的軸**，除非另開一節標明並說明必要性
3. **不要寫實作程式碼。** 這一輪只有 SKILL.md 文字與檔案格式。實作交給 Opus
4. **不要修改那 68 個 skill 的任何一個**
5. **不要產出「計畫」。** 交付物是可以直接貼進檔案的文字
6. **不要說某個檢查跑過了，除非你真的跑了。** 沒跑就寫進「未解決 / 需要覆核」，並說明為什麼——**檢視不等於執行**
7. **不要為了填滿交付物而發明內容。** 某一項在讀完素材後發現不需要，就說它不需要並解釋

---

## 完成的判準

四項全部滿足才算完成：

1. 三個設計問題各有一個明確答案與理由，**不是列出選項**
2. 每個軸都指得出來源（skill 路徑 + 節號）
3. 長度全部在上限內
4. 「未解決 / 需要覆核」一節有內容，或明確說明為什麼是空的

---

## 交出去之後

下一輪（Opus 5）會做：實作 `task.js` 的 class 驗證、`lib/stages.js` 的路由載入、軸鎖定檔的讀寫、以及 preview gate 的實際機制。

**所以你的輸出要讓一個沒有這段對話上下文的人能照著做。** 凡是「你知道但沒寫下來」的，下一輪都會重新猜一次。

---

*本 prompt 由 Claude Opus 5 於 2026-09-09 產出，依據 `DESIGN-axis-inventory.md` 與兩份 fankeel 改進簡報。*
