---
status: current
last_verified: 2026-09-09
source_of_truth: caveman.zip 的 DESIGN-axis-inventory.md，原文照抄；它盤點的六個設計 skill 是安裝在這台機器上的外掛，不在本 repo
---

# 設計 skill 軸表盤點

這份文件原文出自 caveman.zip，是 2026-09-09 讀進本 repo 的四份文件之一，作者是在
本 repo 之外的另一輪對話裡寫成的，盤點對象是這台機器上已安裝的設計相關 skill；
下方全文照抄，未經改寫或翻譯，盤點結果本身不隨本 repo 的程式碼變化。

> **這份檔案是什麼**：這台機器上已安裝的 68 個設計相關 skill 的軸盤點。
> 目的是回答一個問題：**為什麼 AI 每次都產出通用設計。**
>
> **結論先講**：不是缺素材，也不是缺軸。**軸的機制被獨立實作了六次，六套詞彙互不相通，而且沒有任何東西決定何時用哪一套。**
>
> 盤點日期：2026-09-09
> 掃描範圍：`~/.claude/plugins/cache/` 底下 4 個 marketplace 的 SKILL.md 與資料檔
> 配套檔案：`FANKEEL-improvement-brief.md`、`FANKEEL-improvement-brief-2-adhd.md`

---

## 目錄

- [第一部：全景](#第一部全景)
- [第二部：六套軸引擎（核心發現）](#第二部六套軸引擎核心發現)
- [第三部：統一軸表](#第三部統一軸表)
- [第四部：八份反通用清單](#第四部八份反通用清單)
- [第五部：真正的缺口](#第五部真正的缺口)
- [第六部：順帶發現的漂移](#第六部順帶發現的漂移)
- [附錄：各 skill 的檔案位置與尺寸](#附錄各-skill-的檔案位置與尺寸)

---

## 第一部：全景

### 1.1 數量

| 來源 | skill 數 | 性質 |
|---|---:|---|
| `taste-skill` | 13 | 美學執行 + 圖像生成 + 軸引擎 |
| `interaction-design`（designer-skills） | 27 | 互動法則 22 條 + 流程 5 條 |
| `ux-strategy`（designer-skills） | 15 | 策略層 |
| `ui-ux-pro-max` | 7 | **唯一有機器可讀資料集的** |
| `impeccable` | 1 + 5 subagent | 唯一有 mode 軸與 finish-reviewer 的 |
| `frontend-design` | 1 | 官方，最短（55 行） |
| 內建（`design` / `dataviz` / `artifact-design` / `artifact-diagramming`） | 4 | canvas、圖表、artifact |
| **合計** | **68** | |

### 1.2 尺寸分佈（前十大）

| skill | 行 | 位元組 |
|---|---:|---:|
| `imagegen-frontend-mobile` | 1,465 | 40,285 |
| `image-to-code-skill` | 1,228 | 36,361 |
| `taste-skill` | 1,206 | **87,126** |
| `imagegen-frontend-web` | 987 | 36,780 |
| `brandkit` | 798 | 15,967 |
| `ui-ux-pro-max` | 680 | 46,111 |
| `ui-styling` | 324 | 10,045 |
| `design`（ui-ux-pro-max） | 313 | 12,257 |
| `design-system` | 244 | 6,833 |
| `taste-skill-v1` | 226 | 21,190 |

`taste-skill` 一個檔 87KB。對照組：sepia 的 canonical SKILL.md 是 10KB、caveman 的 `surgical-patch` 是 16 行。

---

## 第二部：六套軸引擎（核心發現）

**「多種歸類讓 AI 去選」這個機制已經存在六次。** 每一次都用不同的名字、不同的軸、不同的選法，而且彼此不知道對方存在。

| # | 所在 | 機制名稱 | 軸數 | 值的形態 | 選法 |
|---|---|---|---:|---|---|
| 1 | `imagegen-frontend-web` §2 | **THE COMBINATORIAL VARIATION ENGINE** | 10 | 具名列舉 | `Choose 1` / `Choose exactly 4` / `Choose exactly 2` |
| 2 | `image-to-code-skill` §12 | **THE COMBINATORIAL VARIATION ENGINE** | 7 | 具名列舉（前 6 軸與 #1 完全相同，值的敘述較短） | 同上 |
| 3 | `soft-skill` §3 | **THE CREATIVE VARIANCE ENGINE** | 2 | 具名列舉 + CSS 實作細節 | `Pick 1` |
| 4 | `taste-skill` §1 | **THE THREE DIALS** | 3 | **連續值 1–10** | 由 design read 推斷 + 9 個 use-case preset |
| 5 | `taste-skill-v1` §6 | Dial Definitions | 3 | 同上，分三段落定義 | 同上 |
| 6 | `ui-ux-pro-max` | CSV 資料集 | ~13 個資料維度 | **機器可讀 CSV** | BM25 搜尋 |
| — | `impeccable` | **Modes** | 1 | 4 個具名值 | 由 surface 決定，不由 product 決定 |

### 2.1 引擎 #1：`imagegen-frontend-web` §2（最完整的一套）

十個軸，明確規定選幾個：

| 軸 | 值 | 選法 |
|---|---|---|
| **Theme Paradigm** | Pristine Light Mode / Deep Dark Mode / Bold Studio Solid / Quiet Premium Neutral | Choose 1 |
| **Background Character** | technical grid・dotted / solid + ambient gradient / full-bleed cinematic / tactile textured | Choose 1 |
| **Typography Character** | clean grotesk / refined grotesk / expressive display / compressed statement / editorial serif+sans / Swiss rational | Choose 1 |
| **Hero Architecture** | cinematic centered / asymmetric split / floating polaroid scatter / inline typography behemoth / editorial offset / massive image-first | Choose 1 |
| **Section System** | modular bento / alternating editorial / poster stacked / gallery-led / Swiss grid / asymmetric premium | Choose 1 |
| **Signature Component Set** | 12 個具名元件 | **Choose exactly 4** |
| **Motion-Implied Language** | 6 種能量 | **Choose exactly 2** |
| **Composition Anchor** | 9 種（含 per-section 規則） | 每節 1 個，全站**至少 3 種不同** |
| **Background Mode** | per-section | 每節 1 個 |
| **CTA Variation** | — | — |

引擎的開場句寫得很好，值得抄：

> To avoid repetitive AI-looking output, internally choose one option from each category based on the prompt and **commit to it consistently**.
> **Do not mash everything together into chaos. Pick a strong combination and execute it clearly.**

`Composition Anchor` 那一軸還內建了反預設條款：

> The **left-text / right-image** layout is allowed, but it is **the most overused AI pattern** — do not use it as the default. Reach for it only when it is the genuinely best fit.
> across the site **at least 3 different anchors must appear**; vary the hero so the page does not open on the AI default.

### 2.2 引擎 #4：`taste-skill` 三個轉盤（唯一有推斷表的）

軸是連續的，不是列舉：

```
DESIGN_VARIANCE: 1 = Perfect Symmetry  →  10 = Artsy Chaos
MOTION_INTENSITY: 1 = Static           →  10 = Cinematic / Physics
VISUAL_DENSITY: 1 = Art Gallery/Airy   →  10 = Cockpit/Packed Data
Baseline: 8 / 6 / 4
```

**它是唯一一個把「brief 的語言」映射到「軸的值」的**：

| Signal | VARIANCE | MOTION | DENSITY |
|---|---:|---:|---:|
| minimalist / clean / calm / editorial / Linear-style | 5–6 | 3–4 | 2–3 |
| premium consumer / Apple-y / luxury / brand | 7–8 | 5–7 | 3–4 |
| playful / wild / Dribbble / Awwwards / experimental | 9–10 | 8–10 | 3–4 |
| landing page / portfolio / marketing（預設） | 7–9 | 6–8 | 3–5 |
| trust-first / public-sector / regulated / a11y-critical | 3–4 | 2–3 | 4–5 |
| **redesign – preserve** | **match existing** | +1 | **match existing** |
| **redesign – overhaul** | +2 | +2 | match existing |

最後兩列就是你要的「配合當前專案」與「重新 REDESIGN」，**這個機制已經存在，只是只在 taste-skill 裡**。

`taste-skill-v1` §6 把每個 level 段落展開成具體 CSS：

> **8–10 (Asymmetric):** Masonry layouts, CSS Grid with fractional units (`grid-template-columns: 2fr 1fr 1fr`), massive empty zones (`padding-left: 20vw`)
> **8–10 (Cockpit Mode):** Tiny paddings. No card boxes; just 1px lines to separate data. **Mandatory:** Use Monospace for all numbers.

而且每一段都有 `MOBILE OVERRIDE` 條款——非對稱在 `<768px` 必須退成單欄。

### 2.3 引擎 #6：`ui-ux-pro-max` — 唯一機器可讀的

其他五套都是散文列舉，**只有這一套是 CSV**：

| 資料檔 | 列數 | 內容 |
|---|---:|---|
| `google-fonts.csv` | 1,923 | 字體 |
| `draft.csv` | 1,777 | — |
| `design.csv` | 1,774 | — |
| `products.csv` | 161 | 產品類型 |
| `ui-reasoning.csv` | 161 | UI 決策推理 |
| `colors.csv` | 160 | 配色 |
| `icons.csv` | 104 | 圖示 |
| `ux-guidelines.csv` | 98 | UX 準則 |
| `styles.csv` | **84** | **風格——這就是軸的值** |
| `typography.csv` | 73 | 字體搭配 |
| `landing.csv` | 34 | Landing 模式 |
| `app-interface.csv` | 29 | App 介面 |
| `charts.csv` | 25 | 圖表 |
| `stacks/*.csv` | 16 檔 × 49–60 | 各技術棧的規則 |

另有 `design/data/logo/{styles,colors,industries}.csv`（各 55）、`cip/*.csv`、`icon/styles.csv`（15）、`design-system/data/slide-*.csv`（8 檔）。

**這是全部 68 個 skill 裡唯一可以被程式讀取、篩選、比對的軸資料。** 其他五套引擎的值只能靠模型讀散文。

### 2.4 `impeccable` 的 Mode —— 唯一一個「先於美學」的軸

四個值，而且定義的是**成功長什麼樣**，不是長相：

| Mode | 訪客的成功 | 適用 |
|---|---|---|
| **Persuade** | 訪客決定並行動；設計本身就是產品 | Landing、行銷、定價 |
| **Operate** | 訪客完成一項任務 | App UI、dashboard、editor、admin、設定 |
| **Read** | 訪客理解某件事 | 文件、文章、指南、changelog |
| **Experience** | 訪客身處作品之中 | 作品集、gallery、showcase |

選法規則寫得極準：

> Choose the mode **from the requested surface, not the product**, and persist it only in that surface brief. **A tool's landing page is still Persuade; a fashion house's documentation is still Read; a docs index is Read, not Persuade.**

`Operate` 那一列還有優先序：「Scanability, consistency, native expectations, and the real usage scene **outrank expression**.」

**其他五套引擎沒有任何一個有這一軸。** 它們全部從「長什麼樣」開始。

---

## 第三部：統一軸表

把六套引擎的軸攤平、去重、標出誰有誰沒有。

**符號**：`●` 該 skill 有這一軸且值明確｜`○` 有但只是散文提及｜`—` 沒有

| # | 軸（建議名） | 值的來源 | imagegen-web | image-to-code | soft | taste-skill | ui-ux-pro-max | impeccable |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **0** | **Mode（成功的定義）** | impeccable：Persuade / Operate / Read / Experience | — | — | — | ○ | ○ | **●** |
| 1 | Theme Paradigm（明暗與色場） | 4 值 | ● | ● | ○ | — | ● `colors.csv` | — |
| 2 | Background Character | 4 值 | ● | ● | ○ | — | — | — |
| 3 | Typography Character | 6 值 | ● | ● | ○ | — | ● `typography.csv` 73 | — |
| 4 | Hero Architecture | 6 值 | ● | ● | — | — | ○ `landing.csv` | — |
| 5 | Section System / Layout Archetype | 6 值（imagegen）／3 值（soft） | ● | ● | ● | ○ | — | — |
| 6 | Signature Component Set | 12 選 4 | ● | ● | ○ | ○ | — | — |
| 7 | Motion Language | 6 選 2（imagegen）／1–10（taste） | ● | ● | ● | **●** | ○ | — |
| 8 | Composition Anchor（每節） | 9 值，全站至少 3 種 | ● | — | — | — | — | — |
| 9 | **Variance（對稱↔非對稱）** | 1–10 | ○ | — | ○ | **●** | — | — |
| 10 | **Density（留白↔資訊密度）** | 1–10 | — | — | — | **●** | ○ | ○ |
| 11 | Vibe & Texture Archetype | 3 值（含具體色碼） | ○ | — | **●** | ○ | ● `styles.csv` 84 | — |
| 12 | 技術棧 | 16–22 個 | — | — | ○ | ● | **●** `stacks/*.csv` | — |
| 13 | 產品類型 | 161 | — | — | — | ○ | **●** `products.csv` | — |
| 14 | **互動法則** | 22 條 | — | — | — | — | ○ `ux-guidelines.csv` 98 | ○ |
| 15 | **既有配色約束** | preserve / overhaul | — | — | — | **●**（僅 2 列） | — | ○ |

### 3.1 讀這張表的三個結論

**一、軸 0（Mode）應該最先決定，但只有一個 skill 有。**
`impeccable` 的 Mode 決定了其他所有軸的權重（Operate 模式下「可掃描性勝過表現力」）。其他五套引擎直接從長相開始選，所以一個 dashboard 和一個 landing page 會走同一條軸——**這是通用設計的第一個來源**。

**二、軸 1–8 在兩個 skill 裡幾乎逐字重複。**
`imagegen-frontend-web` §2 與 `image-to-code-skill` §12 的前六軸值完全相同，只是後者敘述較短。這是同一份東西的兩份手抄本，沒有任何同步機制——**caveman 的 `verbs-gate` 與 sepia 的 `check_versions` 就是為這種情況存在的**。

**三、軸 9、10、15 只在 `taste-skill` 有，而且 15 只有兩列。**
「配合當前專案配色」在整個 68 個 skill 裡，只存在於 `taste-skill` 的 dial inference 表最後兩列（`redesign - preserve` / `redesign - overhaul`），而且輸出是「軸的值要 match existing」，**不是「把既有色票當成硬約束傳下去」**。

---

## 第四部：八份反通用清單

「不要產出通用設計」這件事，在八個地方各寫了一次：

| # | 所在 | 節名 |
|---|---|---|
| 1 | `taste-skill` §0.D | Anti-Default Discipline |
| 2 | `soft-skill` §2 | THE "ABSOLUTE ZERO" DIRECTIVE (STRICT ANTI-PATTERNS) |
| 3 | `taste-skill-v1` §7 | AI TELLS (Forbidden Patterns) — 分 Visual&CSS / Typography / Layout&Spacing / Content("Jane Doe" Effect) / External Resources |
| 4 | `stitch-skill` step 9 | List Anti-Patterns (AI Tells) |
| 5 | `redesign-skill` | Strategic Omissions (What AI Typically Forgets) |
| 6 | `minimalist-skill` §2 | Absolute Negative Constraints (Banned Elements) |
| 7 | `gpt-tasteskill` §7 | CONTENT, ASSETS & STRICT BANS |
| 8 | `imagegen-frontend-web` | Composition Anchor 的「left-text/right-image 是最被濫用的 AI 模式」 |

**八份清單，零份白名單。**

對照 sepia：它把所有 ban list 合併成一張表（`style-pass.md` §3），並且**配一張白名單**（§7 False-positive whitelist），逐項說明「為什麼這個看起來像 AI 但不是」：

> | Correct grammar and clean punctuation | Plenty of humans write cleanly; imperfection-injection is a detectable gimmick |
> | A single em-dash, semicolon, or "delve" | One hit means nothing; **only clusters count** |

以及一條統管規則：

> **Aim at the band, not the opposite pole.** Inverting every AI tell creates a new fingerprint.

**八份 ban list 沒有白名單、沒有 cluster 規則，結果是過度修正——而過度修正本身是另一種通用。** 全部避開 left-text/right-image 的網站，看起來會一樣地「刻意不對稱」。

---

## 第五部：真正的缺口

盤點完之後，「缺什麼」的答案跟一開始的假設不同。

| 原本以為缺的 | 實際狀況 |
|---|---|
| ~~多軸歸類機制~~ | **有六套** |
| ~~足夠的風格素材~~ | `styles.csv` 84 種、`colors.csv` 160 種、`google-fonts.csv` 1,923 筆 |
| ~~反通用規則~~ | **有八份** |

**真正缺的四件：**

### 缺口 A — 選擇器（router）

68 個 skill、六套軸引擎，**沒有任何東西決定何時用哪一套**。模型憑感覺挑，憑感覺挑就回到預設值。

這正是 sepia 的路由表解決的問題：SKILL.md 只有 70 行，因為它不承載規則，只承載「哪些規則現在該載入」，而且載入粒度細到節（`discourse-pass.md §1–3`）。

### 缺口 B — 軸 0（Mode）沒有被當成第一決策

`impeccable` 有，但它是一個獨立 skill，不會在別人的軸引擎啟動前先跑。**Mode 應該是路由表的第一維**，正如 sepia 的路由表第一維是「文本類型」。

### 缺口 C — 「既有配色」不是硬約束

只有 `taste-skill` 的 dial inference 兩列處理了 redesign，而且輸出是「軸的值 match existing」。缺的是：**把專案現有的色票、字體、間距 token 讀進來，當成後續每一頁的不可違反約束**。

`ui-ux-pro-max:design-system` 有 three-layer token（primitive→semantic→component）的架構，`brand` skill 有 `docs/brand-guidelines.md` → design token 的同步流程。**零件都在，沒有接起來。**

### 缺口 D — 沒有白名單，也沒有 cluster 規則

八份 ban list 全是絕對禁令。缺 sepia 那條「**一次命中不算數，成群才算**」，也缺「不要把每個表面都磨過」。

---

## 第六部：順帶發現的漂移

盤點時撞到的，順手記錄，**與軸表無關但值得回報給該 skill 的作者**。

`ui-ux-pro-max` 的資料集在 repo 裡有**三份副本**，而且它們不一致：

| 資料檔 | `.claude/skills/`（實際載入的） | `cli/assets/` | `src/` |
|---|---:|---:|---:|
| `colors.csv` | 160 | 160 | **192** |
| `products.csv` | 161 | 161 | **192** |
| `stacks/` 檔數 | **16** | 22 | 22 |
| `stacks/nuxt-ui.csv` | **50** | 70 | 70 |

**實際被 skill 載入的那一份落後於 src。** `src/` 多出 6 個技術棧（avalonia、javafx、uno、uwp、winui、wpf），配色多 32 筆，產品類型多 31 筆。

這正是 caveman 的 `checksums.sha256` + `verify_repo.py`、sepia 的 `check_versions.py` 在擋的東西：**一份資料活在三個地方，沒有閘門，就會分岔。**

（skill description 宣稱「161 color palettes」，shipped 的 CSV 是 160 行——差 1 可能是表頭計數，需覆核；192 vs 160 那 32 筆的差距則無歧義。）

---

## 附錄：各 skill 的檔案位置與尺寸

### taste-skill（13 個）
路徑：`~/.claude/plugins/cache/taste-skill/taste-skill/1.0.0/skills/<name>/SKILL.md`

| skill | 行 | 定位 |
|---|---:|---|
| `taste-skill` | 1,206 | 主體。三轉盤 + brief inference + 設計系統對映 |
| `taste-skill-v1` | 226 | v1 保留版，轉盤定義較具體 |
| `imagegen-frontend-mobile` | 1,465 | 手機螢幕圖像生成，含平台模式軸 |
| `image-to-code-skill` | 1,228 | 先生圖再實作，含 7 軸引擎 |
| `imagegen-frontend-web` | 987 | **10 軸引擎，最完整** |
| `brandkit` | 798 | 品牌板、logo 系統，5 種 logo 概念法 |
| `stitch-skill` | 184 | 產出 `DESIGN.md` 語意設計系統 |
| `redesign-skill` | 178 | 既有站點升級，audit-first |
| `soft-skill` | 98 | 高級感 agency 風，2 軸引擎 |
| `brutalist-skill` | 92 | 瑞士印刷 × 軍用終端 |
| `minimalist-skill` | 85 | 暖色單色編輯風 |
| `gpt-tasteskill` | 74 | AIDA 結構 + GSAP 動態 |
| `output-skill` | 49 | 禁止截斷與 placeholder |

### ui-ux-pro-max（7 個）
路徑：`~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.6.2/.claude/skills/<name>/SKILL.md`

| skill | 行 | 定位 |
|---|---:|---|
| `ui-ux-pro-max` | 680 | 主體，9 類規則按優先序（a11y CRITICAL → 動畫 MEDIUM） |
| `ui-styling` | 324 | shadcn/ui + Tailwind 實作層 |
| `design` | 313 | logo / CIP / 簡報 / banner / icon / 社群圖 路由 |
| `design-system` | 244 | 三層 token 架構 |
| `banner-design` | 196 | 多尺寸 banner |
| `brand` | 97 | 品牌指南 → token 同步 |
| `slides` | 40 | HTML 簡報 |

### impeccable
路徑：`~/.claude/plugins/cache/impeccable/impeccable/4.2.2/skills/impeccable/SKILL.md`（84 行）
另有 5 個 subagent：`asset-producer` / `documenter` / `finish-reviewer` / `manual-edit-applier`
參考檔：`reference/new-work.md`、`reference/operate.md`

### designer-skills（42 個）
路徑：`~/.claude/plugins/cache/designer-skills/{interaction-design,ux-strategy}/1.0.0/skills/<name>/SKILL.md`

- **interaction-design（27）**：法則 9 條（fitts / hicks / miller / jakob / tesler / doherty / peak-end / serial-position / zeigarnik）+ 模式 13 條 + 流程 5 條
- **ux-strategy（15）**：design-brief、design-principles、information-architecture、content-strategy、competitive-analysis、experience-map、service-blueprint、metrics-definition 等

### frontend-design（官方）
路徑：`~/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0/skills/frontend-design/SKILL.md`（55 行）
結構：Ground it in the subject → Design principles → Process (brainstorm, explore, plan, critique, build, critique again) → Restraint and self-critique

---

## 掃描方法與可覆核性

| 項目 | 值 |
|---|---|
| 掃描方式 | 對每個 `SKILL.md` 萃取 frontmatter `description`、`^#{1,3}` 標題、行數與位元組；對六套軸引擎逐節讀取全文；對 CSV 計行數 |
| 全文讀過 | `imagegen-frontend-web` §2、`image-to-code-skill` §12、`soft-skill` §3、`taste-skill` §1、`taste-skill-v1` §6、`impeccable` Modes |
| 僅讀標題與 description | 其餘 62 個 |
| **未讀** | `interaction-design` 27 個與 `ux-strategy` 15 個的**內文**（只有 description）；`brandkit` / `imagegen-frontend-mobile` 內文；`ui-ux-pro-max` 的 CSV **內容**（只計行數） |

**下一步若要把軸表變成可執行的路由，這三項必須補讀**：`styles.csv` 84 列的實際值、`interaction-design` 22 條法則的觸發條件、`ux-guidelines.csv` 98 列。

---

*本檔由 Claude Opus 5 於 2026-09-09 產出。引號內英文為 SKILL.md 原文逐字引用；中文為分析與推論。*
