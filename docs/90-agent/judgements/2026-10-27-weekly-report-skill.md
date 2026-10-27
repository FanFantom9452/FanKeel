---
judged: 2026-10-27T00:14:44.071Z
model: fable
agent: fankeel-judge
task: "週報 skill 分析：時間區間→git 紀錄→一頁 HTML（判官一題）"
session: c7256bd4-07c3-4810-abed-1e4babe314fd
stage: survey
---

# Ask 1 — 週報 skill：形狀與落點分析

## Question

# Ask 1 — 週報 skill：形狀與落點分析

## 問題

使用者每週五要向兩位教授報告「這一週（或兩週）做了什麼」。他要一個新 skill，兩步驟：

1. 先問使用者時間區間（起訖日期；預設「上週五到今天」或「近兩週」之類）。
2. 依區間翻 git 紀錄，總結成**一頁 HTML** 給教授看。

這一題只要**分析**：這個 skill 該長什麼形狀、放哪裡、資料從哪來、最大風險在哪。詳細 design（版面、呈現方式）會另開任務做，這裡不必畫版面。

## 選項（判官可另提）

- **A. fankeel 內新 skill**（如 `skills/fankeel-weekly/`），跑在任何 session，不綁 task route；資料只用 git log。
- **B. fankeel 內新 skill，資料用 git log + fankeel 自己的紀錄**（registry 的 task 歷史、`.fankeel/build/task-*/` 各站報告、`docs/90-agent/` 歸檔的 plan / judgements、session bundle 的花費），git 當骨架、fankeel 紀錄補「為什麼做、做到哪」。
- **C. 擴充既有 `fankeel-explain`**（它已經涵蓋「簡報、報告、進度同步」），加一種「區間週報」輸出，而非新 skill。
- **D. 不放 fankeel**，做成獨立的 user-level skill 或專案內腳本（類似 SBIR 用 `build_boss_overview.py` 產生 HTML 的做法）。

## 背景

- 使用者給的範例：`F:\ymlab\SBIR\ProjectWorkspace\SBIR文書\查核點總覽_給老闆.html`（217KB，由 `SBIR文書/查核佐證/附9_產製工具/build_boss_overview.py` 產生，另有 `boss_visuals.py`）。它是給老闆看的一頁 HTML：KPI 卡、甘特圖、逐點表格、文件位置，自帶 CSS、狀態色。使用者說「這個檔案都是用 visualize 的方式顯示」——他要的是這種視覺化一頁，不是 markdown。
- **工作橫跨多個 repo**。2026-10-13 起兩週的 commit 數（`git log --since=2026-10-13 --oneline | wc -l`）：`F:\ymlab\fankeel` 1395、`F:\ymlab\SBIR\ProjectWorkspace\Trovara` 582、`SBIR\ProjectWorkspace\ils-bench` 266、`F:\ymlab\launch-video` 135、`claude-kit` 2、`SBIR\ProjectWorkspace\FanFantom9452` 1。`SBIR\ProjectWorkspace\SBIR文書` 本身是 git repo 但近兩週 0 commit；`SBIR\ProjectWorkspace` 這層不是 repo。也就是說：commit 量極大（fankeel 一週數百則、含大量 chore/docs/release），教授要的是「做了哪幾件事」，不是 commit 列表。
- fankeel 的 commit 有慣例：`chore: 0.121.0 - ...` 是 release，`docs: ... record filed, plan archived, TODO closed` 是收尾，`fix:` / `feat:` 是實作。任務在 registry（`F:\ymlab\fankeel\skills\registry.json`、`scripts/task.js show --all`）有標題與站別；`docs/90-agent/` 底下有歸檔的 plan、records、judgements、TODO。
- 既有相關 skill：`skills/fankeel-explain/SKILL.md`（簡報、報告、進度同步、status sync 六欄）、`skills/fankeel-station/`（監控站、`conversation.js`、`usage-compare.js` 讀 session 與花費）。
- 設計相關：`design.mockup` = opus、有 `fankeel:fankeel-mockup` agent 與 design-lint、設計目錄（0.121.0 剛落地）。
- 使用者的規矩（memory）：fankeel 每次變更都要 release；回覆用繁體中文；平行 session 共用 checkout。
- 使用者原話裡「skill workflow 有提到 pull request 的那種感覺」「band 結束之後」——推測是指 fankeel 收尾（land）後會有整合紀錄可供彙整；請判官看 land 留下什麼可用。

## 判官要讀的路徑

- `F:\ymlab\SBIR\ProjectWorkspace\SBIR文書\查核點總覽_給老闆.html`（只看結構與區塊類型，不必全讀）
- `F:\ymlab\SBIR\ProjectWorkspace\SBIR文書\查核佐證\附9_產製工具\build_boss_overview.py`、`boss_visuals.py`
- `F:\ymlab\fankeel\skills\fankeel-explain\SKILL.md`
- `F:\ymlab\fankeel\skills\fankeel-land\SKILL.md`（land 留下什麼紀錄）
- `F:\ymlab\fankeel\skills\fankeel-station\` 與 `scripts/` 中讀 session / 花費 / registry 的腳本
- `F:\ymlab\fankeel\docs\90-agent\`（records、judgements、plans 歸檔的形狀）
- 兩三個 repo 的 `git log --since=2026-10-20 --pretty='%ad %s' --date=short`，看原始材料長怎樣、雜訊多少

## 什麼算回答

- 選一個（A/B/C/D 或另提），說清楚理由，尤其**資料來源**：只有 git 夠不夠讓教授看懂；commit 怎麼聚成「事」（依 task？依 release？依 repo？依 plan？）。
- 第一步「問時間區間」該問什麼（只問日期？也問哪些 repo、給誰看？），預設值是什麼。
- 一頁 HTML 至少該有哪幾個區塊（只列區塊與用意，不畫版面——版面留給之後的 design 任務）。
- 最大的一兩個風險（例如 commit 雜訊、跨 repo、教授看不懂內部術語、花費敏感資料、產出放哪）。
- 後續 design 任務該先回答的問題清單。

## 回答的形狀

照 fankeel-judge 的六欄，`pick:` 一行是選項；其後 `## Summary` 不限長度，涵蓋上面「什麼算回答」各點。用繁體中文。

## Answer

pick: B（fankeel 內新 skill `skills/fankeel-weekly/`，git 當骨架、fankeel 紀錄補「事」）——但「事」的主來源是 `docs/90-agent/records/<月>.md` 的六欄紀錄與 `.fankeel/sessions/*.json`，不是 registry.json；花費不進教授版。
why: 只有 git 不夠：fankeel 一週 640 則，docs 230／chore 46／release 39，教授要的「做了哪幾件事」在 git 裡只剩 8 則 `docs: … record filed` 收尾線索（git log），且 land 的 `merge:`／`Fankeel-Task` trailer 近一週 0 則，git 認不出任務邊界。
而 records/2026-10.md:5 每則就是 `## 日期 任務標題` + 要求／做了什麼／為什麼／驗過／還剩，41 則現成，正是教授要的粒度；sessions/*.json 有 task、started、updated、stage 可定區間。
C 不成立：fankeel-explain/SKILL.md:53「Only chat is written here」，無資料源、無區間、無 HTML。D 不成立：SBIR 腳本（build_boss_overview.py:49-53）讀固定 PDF/MD/TSV、不讀 git，不可套用；且 fankeel 紀錄只有 fankeel skill 讀得到。
A 是 B 的退化：非 fankeel repo（Trovara、ils-bench）只有 git，skill 必須同時支援「有紀錄 repo」與「只有 git 的 repo」，B 涵蓋 A。
would flip if: 使用者說教授只關心 Trovara／ils-bench 等 SBIR repo、不看 fankeel 本身——那 fankeel 紀錄用不上，A 或 D 更輕。
unread: nothing（`查核點總覽_給老闆.html` 與兩個 .py 依 brief 只看結構，未讀 viz_* 函式體與 :210-232 長行）
delegated: 查核點總覽_給老闆.html sonnet；build_boss_overview.py + boss_visuals.py sonnet；skills/fankeel-explain/SKILL.md opus；skills/fankeel-land/SKILL.md + scripts/record.js + .fankeel/docs.json sonnet；skills/registry.json + scripts/task.js + conversation.js + usage-compare.js + lib/compare.js + .fankeel/sessions/*.json sonnet；docs/90-agent/{records,reports,judgements,todo} sonnet；git log fankeel／Trovara／launch-video + ProjectWorkspace ls sonnet；skills/ 目錄 + .claude-plugin/plugin.json + .fankeel/map.md + fankeel-design/SKILL.md + profile.json sonnet
checklist: 1 HTML 區塊類型與自足性 answered；2 SBIR 腳本資料源與組法 answered；3 explain 能否容納 answered（不能）；4 land 留下什麼 answered；5 讀 session／花費／registry 的腳本 answered；6 90-agent 歸檔形狀 answered；7 三 repo git 雜訊 answered（launch-video 近週 0 則，另補 ils-bench 119 則）；8 skill 註冊與 HTML 慣例 answered

## Summary

### 一、各讀者查到什麼（含抽查）

**1. SBIR 範例頁的形狀**（`F:\ymlab\SBIR\ProjectWorkspace\SBIR文書\查核點總覽_給老闆.html`）
- 306 行、CSS 內嵌於 :8-201，JS 兩段內嵌 :247-306，無 `<link>`、無 http。區塊依序：header（h1 + 「資料時點：115 年 10 月 2 日」:205）→ 四張 KPI 卡（:206）→ 甘特「工作時程與現況」（:207-208）→ 逐點 21 張 `article.cpcard`（:209-221，各含表格與狀態點格 `d y/n/c` 共 3,497 個）→「文件放在哪」（:232）→ footer「來源：…」（:232）→ lightbox。
- 不是完全自足：32 張 `<img src="查核佐證/…/截圖/…">` 相對路徑，搬離資料夾即破。
- 抽查 :7 `<!-- 由 查核佐證/附9_產製工具/build_boss_overview.py 產生，勿手改 -->` 吻合。
- 對週報的啟示：教授版要的是「KPI 卡 + 時間軸 + 逐項卡 + 來源註腳」這組區塊類型，且每個區塊標明資料來源（`span.src`），這點值得抄。

**2. SBIR 產製腳本**（`build_boss_overview.py`、`boss_visuals.py`）
- 資料全來自固定檔案：PDF（fitz 讀座標畫甘特）:49、進度 MD :50、驗收 TSV :51、索引 MD :52；boss_visuals 讀各查核點 CSV/JSON。**無 subprocess、無 git**。
- HTML 以 `a(...)` 串接字串、`CSS = """` 於 :624、render() :429；輸出 :53 `OUT = ROOT/查核點總覽_給老闆.html` 固定路徑、無日期參數；寫前有死連結與去識別化（check_model_names、deid_submission）守門 :890-895。
- 第三方只有 fitz；圖表全是手寫 HTML/SVG 字串。
- 抽查 :41-53 吻合。
- 對週報的啟示：這條路線是「專案專屬資料 → 固定頁」，與「區間 → git → 泛用頁」的題目不同構；可借的是「字串拼 HTML、CSS 內嵌、無依賴、寫前守門」這套做法，而非腳本本身。所以 D（照 SBIR 做獨立腳本）只借到形，借不到資料邏輯。

**3. fankeel-explain 能否容納**（`skills/fankeel-explain/SKILL.md`，opus 讀）
- :3 觸發詞含 報告、進度同步；但 :51-53「A product kept as a file is dispatched … **Only chat is written here**」——它自己不寫檔；:30 證據定義；全文 1-105 無 git log、無 registry、無時間區間、無 HTML。
- :55-64 六欄：Goal／Current state／Decisions／Problems／Evidence（confirmed 與 inferred 分開）／Next step。
- 抽查 :46-64 吻合。
- 結論：C 不成立。explain 是「怎麼說」的風格規則，不是「從哪取、產什麼檔」的流程。但它的六欄與 :46 的報告順序（problem → why → evidence → finding → result → next step）可直接拿來當週報每一「事」的內容規則，尤其「做了」與「推論／計畫」分開標示（:66）。

**4. land 留下什麼**（`skills/fankeel-land/SKILL.md`、`scripts/record.js`、`.fankeel/docs.json`）
- SKILL.md:134-147：`record.js write --session <id>` 收五欄（要求／做了什麼／為什麼這樣做／驗過・沒驗過／還剩什麼），程式自算第六欄 花費（record.js:105 格式 `$X.XX，<時間>，N 個 agent（主 session <model>…）`），寫進「registry entry 與月份檔」。錨點 `r-<YYYY-MM-DD>-<session8>`、標題 `## <日期> <任務標題>`（record.js:108-109）。
- 其他落點：TODO `## 完成紀錄`（:155-157）、plan 與 design 歸檔到 docs/99-archive（:190-197）、決策記錄 docs/03-decisions 或 report 桶（:179-186）、session bundle `.fankeel/bundles/<day>-<id8>.jsonl.gz`（:277-281，使用者選「匯出並回顧」才跑）、版本 bump（:199-211）、`land.js merge` 做 `merge: <task>` + `Fankeel-Task`/`Fankeel-Class` trailer（:390-393）。
- `chore: X.Y.Z - …` 與 `docs: … record filed, plan archived, TODO closed` **不在 SKILL.md 內**，是慣例。
- 抽查 :134-147、record.js:103-109 吻合。
- **我自己補查**：`git log --since=2026-10-20` 中 `merge:` 提交 0 則、`Fankeel-Task` trailer 0 則。使用者說的「pull request 的那種感覺」在 SKILL 裡有（land.js merge），但近一週實際沒用——所以不能靠 git 的 merge/trailer 把 commit 聚成任務；真正可靠的任務邊界在 records 月檔與 sessions JSON。

**5. 讀 session／花費／任務的腳本**
- `skills/registry.json` **不是任務表**，是 stage registry（:1-12，generated_by stage-registry.js）。brief 的描述有誤。
- 任務資料在 `.fankeel/sessions/<id>.json`（450 個），鍵：task、route、configDir、version、stage、active、started、updated、ended、model、usage、clock、moves、burn、claims、spend。我自己讀了一個：`started=2026-09-19T20:38:57Z`、`spend.survey.models.claude-sonnet-5.{input,output,cacheRead,…}`。
- `task.js show --all`（task.js:432-441）印 updated 日期、stage、token、時間、標題；無日期過濾、無 --json、無 USD。
- `conversation.js --session <id>` 只給對話文字，無花費。
- `usage-compare.js --before A..B --after C..D`（:27-34，regex 在 lib/compare.js:19-22）給兩區間彙總：sessions 數、每 session USD、中位數、token、subagent 占比、總 USD、各模型占比；**無 per-session 列**。per-session 算法在 lib/usage.js costOf／lib/compare.js sessionOf:68，但沒印出。
- 全 scripts 僅 usage-compare 收日期區間；version.js 的 `--since` 是版本號非日期。
- 抽查 task.js:432-441、usage-compare.js:27-34 吻合。

**6. docs/90-agent 歸檔形狀**
- 檔數：judgements 62、records 1（月檔）、reports 1681、todo 362、plans 0（歸檔到 99-archive）、reference 15。
- records/2026-10.md：H1「任務完成紀錄 2026-10」，41 則 `## 2026-10-xx <中文任務標題>` + 六欄 bullet（抽查 :1-12 吻合）。**這就是週報的「事」清單，且已是繁中、已有「做了什麼／為什麼／還剩什麼」。**
- reports：`YYYY-MM-DD-slug.md`，frontmatter status/last_verified，H1 後一行「一句話：…」（抽查 2026-10-26-todo-patrol.md:1-8 吻合）。三份「TODO 全表盤點」是現有最接近週報的東西。
- judgements：`YYYY-MM-DD-slug.md`、frontmatter `judged:`、`task:`、H1「Brief N — 問題」，無一句話摘要。
- todo：`<label>-<n>.md`，frontmatter title/description/state/stamp，無日期檔名。
- 沒有任何檔案是週報或進度摘要。

**7. 三 repo git 原始材料**（2026-10-20 起，皆單一作者 FanFantom9452）
- fankeel 640 則：docs 230／fix 155／feat 149／chore 46／test 36／refactor 13／station 5／stop 3／task 2／style 1；release 39；每日 38-150 則。收尾線索 `docs: … record filed|plan archived|TODO closed` 只有 8 則（我自己複算為 8）。release 行如 `chore: 0.121.0 - design catalogue and design-lint land` 其實是最好的「英文一句話」。
- Trovara 224 則：docs 95／feat 62／fix 33／test 24／refactor 7／chore 3；0 release；訊息多為中文、含 scope（nsn_catalog、mip_extract）、含 `docs(plans)`／`docs(meetings)` 會議摘要——**Trovara 沒有 fankeel records，只能靠 git，但它的 commit 訊息品質高、scope 可當聚類鍵**。
- launch-video：10-13 起 135 則、10-20 起 **0** 則（我自己驗）；ils-bench 10-20 起 119 則（我自己補）。`SBIR\ProjectWorkspace` 非 repo，底下 20+ 個目錄，哪些是 repo 未逐一查。
- 啟示：活躍 repo 集合每週不同，skill 第一步必須自己掃、不能寫死。

**8. skill 註冊與 HTML 慣例**
- plugin.json:9 `"skills": "./skills/"` 目錄自動發現，不必逐一列；agents 才逐一列（:10）。新 skill = `skills/<name>/SKILL.md` + frontmatter（name/description/version/status/last_verified/source_of_truth）。抽查 plugin.json:1-12 吻合。
- 既有 HTML 產出慣例：mockup 放 `.fankeel/build/<date>-<topic>/mockup.html`、不 commit（fankeel-design/SKILL.md:88-89，抽查吻合）；`design-lint.js <page.html>` 可 lint；render.js 可用 headless Chrome 截圖；station 寫 `<configDir>/fankeel/index.html`。
- 設計指南 `skills/fankeel-design/design-guide.md`、目錄 `catalog/include.json`／`exclude.json`；`profile.json:5 "design.mockup": "opus"`。
- explain、station 都沒有「不綁 task route」的宣告，就是不呼叫 task.js 的普通 skill——新 skill 同理。

### 二、資料來源：只有 git 夠不夠？commit 怎麼聚成「事」？

**只有 git 不夠**，理由是三層：
1. 雜訊：fankeel 640 則裡 docs+chore+test 佔 312（49%），fix/feat 又多是 land 前的小修（如 `fix: close review of plan task body - zh label…`）。
2. 邊界：git 裡沒有任務邊界——merge 提交 0、trailer 0；只有 8 則 `docs: … record filed` 和 39 則 release 行間接標出「一件事結束了」。
3. 語言與受眾：fankeel commit 全英文、滿是內部名詞（station、brain、gate、catalogue、TODO patrol），教授讀不懂。

**聚類策略（分兩種 repo）**：
- **有 fankeel 紀錄的 repo**（fankeel 自己、以及任何跑過 /fankeel 的專案 repo，看 `docs/90-agent/records/` 是否存在）：以 `records/<月>.md` 的每一則 `## 日期 標題` 為一「事」，六欄直接給「做了什麼／為什麼／還剩什麼」；再用 `.fankeel/sessions/*.json` 的 started/updated/stage 定區間與「進行中但未 land」的事（stage ≠ land）。git 只用來給每「事」掛數字（區間內 commit 數、release 版號 from→to、改動檔數）。
- **只有 git 的 repo**（Trovara、ils-bench）：以 conventional-commit 的 scope 為第一鍵（`feat(mip_extract)`、`fix(nsn_catalog)`），無 scope 的以 `docs(plans)`/`docs(meetings)` 為線索；release 行若有則當里程碑；同 scope 同週歸一「事」，交給模型寫一句繁中摘要。這一段是整個 skill 最吃模型判斷的地方，也是風險所在。
- **不依 plan 聚**：plans 已歸檔到 99-archive、檔名無統一日期，不如 records 乾淨。

所以 B 的正確解讀是「records 為主、sessions 定區間、git 掛數字；沒 records 的 repo 退回 git + scope」。brief 裡 B 列的「registry 的 task 歷史」實際是 sessions JSON，「各站報告 `.fankeel/build/task-*/`」太細不該進教授版，「session bundle 的花費」不該給教授（見風險）。

### 三、第一步該問什麼、預設值

問三件事，一次問完（fankeel 風格的 gate，一則訊息）：
1. **區間**：預設「上週五到今天」（今天週二 10-27 → 10-17..10-27；若今天是週五則上週五..今天）。提供「近兩週」選項。區間以 ISO 日期表示，內部用 `git log --since=<起> --until=<迄+1>`。
2. **repo 集合**：skill 先自己掃（固定根 `F:\ymlab` 與 `F:\ymlab\SBIR\ProjectWorkspace` 一層內含 `.git` 的目錄，列出區間內 commit 數 > 0 者），把掃到的清單連同數字呈給使用者勾選，預設全選有 commit 的。**這一步不能省**——launch-video 這週 0 則、上週 135 則就是證明。根目錄清單放在 skill 的設定（`.fankeel/profile.json` 或 skill 內 reference），不寫死在 SKILL.md。
3. **受眾與語言**：預設「給教授、繁體中文、不含花費、不含內部術語」；另一選項「給自己、含花費與 session 數」。這決定要不要讀 sessions 的 spend 與要不要翻譯術語。

不必問：輸出路徑（固定）、版面（design 任務決定）。

### 四、一頁 HTML 至少哪幾個區塊（只列用意）

1. **標頭**：區間（起訖）、產生時間、涵蓋哪些 repo——對應 SBIR 頁的「資料時點」。
2. **本週一句話**：三到五句繁中總結，仿 reports 的「一句話：」。給教授 30 秒版本。
3. **KPI 卡**：完成的事（records 則數／scope 群數）、進行中的事、涵蓋 repo 數、release 版號 from→to；**不放** commit 數當主 KPI（640 這種數字對教授無意義，可放小字）。
4. **時間軸**：區間內每日各 repo 活動（commit 數或「事」的起訖），對應 SBIR 的甘特——讓教授看到「哪幾天做哪個專案」。
5. **逐事卡**：每一「事」一張：標題（繁中）、repo、做了什麼、為什麼、還剩什麼／下一步、狀態（完成／進行中），加「證據」小字（版號、record 錨點或 commit 區間）。這是主體，對應 SBIR 的 cpcard。
6. **未完成與下週**：從 records 的「還剩什麼」與 sessions stage ≠ land 的任務彙整；對應 explain 六欄的 Problems／Next step。
7. **來源註腳**：每個區塊標資料來源（records 檔、git range、sessions），與 SBIR 的 `span.src` 同理，也方便使用者自己核對。

可選：**時間與花費**（只在「給自己」模式出現）。

### 五、最大風險

1. **術語與語言（最大）**：fankeel commit 與 records 都是內部語彙（station、gate、brain、TODO patrol、mockup catalogue）；records 雖是繁中，但仍是對 fankeel 開發者說的。教授版需要模型重寫成「對外一句話」，而這一步沒有 ground truth、容易編造或誇大。緩解：每張逐事卡保留「證據」小字與來源連結；套 explain 的規則「inference 與 fact 分開、未知寫『不知道』」（explain/SKILL.md:22-23、:66）；寫前跑一個「禁詞」守門（仿 SBIR 的 check_model_names）——內部名詞與 session id、花費不得出現在教授版。
2. **只有 git 的 repo 聚類不穩**：Trovara/ils-bench 無 records，scope 聚類可能把一個功能拆成三張卡或把兩個合一。緩解：第一版先以 scope 為準、讓使用者在產出前看到「事」清單並可合併／刪除（第二次 gate），再出 HTML。
3. **花費敏感**：sessions JSON 的 spend 與 record 的「花費」欄（`$X.XX`）不該出現在給教授的頁；要在「受眾」那一問就切掉，不是產出後再手刪。
4. **repo 集合漂移**：寫死 repo 清單會漏掉這週新開的或多算已停的；必須每次掃。
5. **產出放哪**：建議 `.fankeel/build/<date>-weekly/weekly.html`（沿 mockup 慣例，不 commit，自足：CSS 內嵌、不引外部圖）；若要留存，複製到使用者指定的報告資料夾。SBIR 頁因相對路徑截圖搬走即破，週報不要引外部檔。
6. **fankeel 自己的規矩**：新 skill 落地要 release（minor bump）、跑 suite；另外 records 月檔是跨月的，區間跨月時要讀兩個檔。

### 六、後續 design 任務該先回答的問題

1. 「事」的粒度：一則 record = 一張卡？還是同主題多則合一張（例如三次 TODO patrol）？合併規則誰定？
2. 只有 git 的 repo：scope 聚類後要不要有「使用者確認『事』清單」的 gate，還是直接出頁？
3. 教授版的「對外一句話」由誰寫：模型即時寫（每次不同）還是寫回 record 的某欄（可重用、可累積）？後者意味 land 時多一欄「對外說法」。
4. 時間軸的單位：日 × repo 的熱度，還是每「事」的起訖條？sessions 有 started/updated，git 有每日數——兩者都可，選一個。
5. KPI 卡放哪四個數字？release from→to 對教授有意義嗎（fankeel 一週 39 版）？
6. 自足性：截圖或圖表要不要？若要，用 inline SVG（SBIR 做法）而不是外部 png。
7. 輸出路徑與保留：`.fankeel/build/<date>-weekly/` 不 commit，還是進 `docs/90-agent/reports/`？跨 repo 的週報屬於哪個 repo？
8. 「給自己」模式要不要存在，還是先只做教授版（砍掉花費欄位整條路，簡化一半）。
9. 多語：Trovara commit 已是繁中、fankeel 是英文——頁面統一繁中，英文 commit 由模型翻，要不要保留原文小字。
10. 守門清單：禁詞（內部名詞、session id、`$`）與死連結檢查，仿 build_boss_overview.py:890-895，要不要做成 `scripts/weekly-check.js` 給 suite 跑。

### 七、沒查到／沒做的

- 未逐一確認 `SBIR\ProjectWorkspace` 底下 20+ 個目錄哪些是 repo（只驗 Trovara、ils-bench、launch-video）。
- 未讀 SBIR 頁 :210-232 長行與兩段 script 內容、viz_* 函式體。
- 未驗 lib/registry.js 是否有列 per-session USD 的 helper（讀者只見 burnOf/clockOf）。
- 未看 judgements 的 Summary 段是否可當「事」來源（它們無一句話摘要，暫不列入）。
- context.md 已加四條（sessions JSON 欄位；records 六欄格式；usage-compare 區間與 merge 提交 0 則；SBIR 腳本不讀 git），檔在 `F:/ymlab/fankeel/.fankeel/build/task-20261027T000803/context.md`。
