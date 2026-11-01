---
judged: 2026-11-01T17:09:41.599Z
model: fable
agent: fankeel-judge
task: "評估 patent-KG 的概念與程式碼能否用進 fankeel"
session: 44ced78d-5e39-414c-ae9a-438a4331686b
stage: survey
human: no
---

# Brief 1 — kg-into-fankeel

## Question

# Brief 1 — kg-into-fankeel

## Question

教授寫的 patent-KG（F:\ymlab\pdm\patent-KG）裡的概念與程式碼，能不能用在 fankeel（F:\ymlab\fankeel）裡面？哪些可以搬、哪些不適用、搬的話放在 fankeel 的哪裡？

## Options

- A. 直接搬程式碼：把 patent-KG 的某些 Python 模組（如 `code/kg_certify`、`code/kg_generator`）或其演算法移植成 fankeel 的 Node 腳本。
- B. 只搬概念：把 patent-KG 的機制（certificate at projected actuation time、deficit-directed acquisition、per-condition expiry、temporal knowledge graph）重新表述成 fankeel 自己的機制，例如套在 registry、gate、docs drift、TODO 的 `on:`/`if:` 時效、claims、handoff 上；不搬程式碼。
- C. 不適用：兩者問題域差太遠（設備維護派工 vs. 開發 session 紀律），硬套只會增加複雜度。
- D. 部分：某一兩個概念值得做成 fankeel 的一個小功能，其餘不適用。

## Background

- patent-KG：duration-certified dispatch of maintenance skills over a temporal knowledge graph。在預計的 actuation time 出具 certificate；certificate 不足時做 deficit-directed acquisition（只去取補足 deficit 需要的證據）；給工人的指示每個 condition 有自己的 expiry。Graph completion 只有描述、沒有量到增益。Case Y 結果：C3 FAIL、SY n 不足、其餘 PASS。
- fankeel：Claude Code plugin，Node。session registry（`.fankeel/sessions/*.json`，claims、stage、route、notes、next）、stage gate、docs-check/docs-audit（drift = 參考文件的主題比文件晚改）、TODO 的 Blocked/Watch 時效（`on: MM-DD`、`after:`、`if:`）、handoff/adopt、scope guard、station。
- 這是 spike：輸出是一個答案，不是改動。使用者想知道值不值得投資。
- 注意：patent-KG 是專利工作區的內容，搬程式碼或在 fankeel 公開文件裡描述其機制，可能有專利公開／申請前揭露的顧慮；判斷時請點出來。

## Paths to read

- F:\ymlab\pdm\patent-KG\README.md
- F:\ymlab\pdm\patent-KG\idea-KG.txt（invention disclosure，Sections 1–10）
- F:\ymlab\pdm\patent-KG\research_note-KG.md（必要段落即可）
- F:\ymlab\pdm\patent-KG\code\kg_certify\ 、 code\kg_generator\（只看結構與核心演算法）
- F:\ymlab\fankeel\skills\fankeel\SKILL.md
- F:\ymlab\fankeel\docs\ 下的 architecture 與 reference（registry.md、collisions.md、documents.md、pipeline.md）
- F:\ymlab\fankeel\scripts\ 與 lib\（task.js、docs-audit.js、todo-check.js、lib/handoff.js 等，看結構即可）

## What counts as an answer

一個 pick（A/B/C/D），加上：每個 patent-KG 概念對到 fankeel 的哪個既有機制（或沒有對應）、是否值得做、具體會改哪個檔案；以及明確不適用的部分與原因。對應必須有 path:line 依據，不能只是比喻。

## Answer shape

七個欄位（pick 在內，`ask human:` 最後），`## 白話`（≤600 字），`## Summary` 內含一張對照表：patent-KG 概念 | fankeel 對應機制（path） | 值不值得 | 理由。

html: yes

## Answer

pick: D — 不搬程式碼；只借一個結構性概念（交接指示「每個前提各自標明何時該重驗、接手時只重驗變動的」→ 做成 `task.js adopt` 重驗 claims 自 handoff 後是否被改），憑證、缺口分數、時間知識圖、圖補全皆不適用。
why: KG 核心是由每個條件的存活律 S_l 推出 q_l 與 C_k（idea-KG.txt:865-868、certify.py:48-76、:79-102）；fankeel 沒有任何「條件多久仍成立」的統計，也不收集它。
fankeel 設計明文拒絕計時過期（collisions.md:337-343、registry.md:437），以動作當下觀測取代預測（guard.js:142、registry.md:74、documents.md:162-165）。
「先 sensing 再問 owner」的缺口導向取證在 fankeel 已是規則而非數字（SKILL.md:864-865、:957-962）。
程式碼依賴 numpy/scipy.special/rdflib 且是模擬 harness（survival.py:7-10、kg_generator/prereg.py:6）；唯一可移植的 Datalog 引擎在 fankeel 無用途。
唯一缺口：`next`/`handoff` 只有一個整體戳記（registry.js:814-820），無逐條件重驗。
would flip if: `scripts/task.js` cmdAdopt 本體已列出 handoff 後被改的 claims（未讀）→ C；fankeel 開始記錄 `next:` 的存活時長 → B 變成可驗。
unread: kg_certify/ssbn.py（726 行）與 prowl.py 本體；kg_generator/loop.py、network.py 本體；scripts/task.js cmdAdopt/cmdClear 本體；research_note Section 14 的 14.6 之後；docs/90-agent/reference/station.md；F:\ymlab\.fankeel\map.md 無 pdm/KG 內容可取。
delegated: sonnet × 8 — (1) patent-KG/README.md、idea-KG.txt；(2) research_note-KG.md、docs/review/caseY_results-2026-10-31.md；(3) code/kg_certify/{__init__,certify,kg,policies,completion,survival,skills,world}.py、skills/worker_procedure.md；(4) code/kg_generator/*.py 首行、plant_rules/case_y.dl、plant_ontology/plant_tbox.ttl；(5) fankeel/skills/fankeel/SKILL.md、.fankeel/map.md；(6) fankeel/docs/02-architecture/{pipeline,layout}.md、docs/90-agent/reference/{registry,collisions,documents,todo}.md、docs/03-decisions/2026-09-27-todo-blocked-watch.md、2026-09-19-waiting-triggers.md；(7) fankeel/scripts/{task,docs-audit,docs-check,todo-check}.js、lib/{drift,todo}.js；(8) fankeel/lib/{handoff,gates,registry,guard,tracked}.js
checklist: 1 README boundary/filing — answered；2 idea-KG 定義/claim 1/未主張 — answered；3 research note 公式與結果 — answered；4 kg_certify 演算法與依賴 — answered（ssbn.py 未讀）；5 kg_generator 結構與依賴 — answered（loop 本體未讀）；6 SKILL.md 機制定義 — answered（map.md 無相關內容）；7 docs 架構與 reference 時效語意 — answered；8 scripts 的 drift 與 TODO 計算 — answered；9 libs 的 gate/stale/claim/handoff — answered（cmdAdopt 未讀）
ask human: nothing

## 白話

結論：不要搬程式碼，只有一個小觀念值得借——交接時把「下一位要靠的前提」逐條列出，接手時只重驗有變動的那幾條；其餘都不適用。

打個比方：patent-KG 像是預測「這張通行證幾點會過期」，靠的是設備故障的統計壽命表；但寫程式的 session 沒有這種壽命表，一個檔案什麼時候會被別人改，只能在動手那一刻看一眼。fankeel 本來就是這樣設計的：編輯當下查誰占著檔案、審文件時直接比日期、關卡由人點頭，而且它的設計文件明寫「不用計時器讓權限自動失效，因為那會默默弄丟工作」。所以「預計時間的憑證」「缺口分數」「時間知識圖」在這裡沒有地基；圖補全在專利自己的實驗裡還量到準確度下降，更不必抄。

另外提醒：這份專利還沒申請，若把它的機制寫進 fankeel 的公開文件，可能算提前揭露；上面那個小功能用 fankeel 自己的話寫、不提專利，就沒有這個問題。

## Summary

### patent-KG 這邊（readers 1-4）

- 機制定義（idea-KG.txt）：q_l(s) = p̂_l · min{ρ_l(s;lo), ρ_l(s;hi)}，ρ 是存活比 S_l(s−u)/S_l(t_obs−u)（:865, :830）；C_k = 1 − Σ_{l∈Pre_k}(1 − q_l(t+λ_k))，λ_k 是技能延遲分布的 (1−γ) 分位（:866, :826）；C_k ≥ 1−α_k 才派工（:868）；deficit d_l = 1 − q_l(t+λ_k)（:833-834）；取證規則「取最大 deficit 的 literal，先經 sensing skill（最小 λ_j 且 t+λ_j ≤ D），否則問 owner」（:874-878；research_note-KG.md:229-236 同）；工人指示每條前提 t*_l = sup{s ≥ t_issue : q_l(s) ≥ 1−α_w/m}，執行時只重測已過期者（:884-888）。時間知識圖：每個 State fact 存 t_on、t_obs、onset bracket、S_l 參考；causes-edge 帶延遲密度 f_e（:843-845）。
- 程式碼對應：`code/kg_certify/certify.py:48-76` 即 C_k，`:79-102` 即 t* 二分法；`kg.py:28` Fact(literal, value, t_obs, lo, hi, p_obs, sojourn)，`kg.py:237` KG 是 dict of facts 而非 triples；`survival.py:21/62/103` Weibull/Gamma/LogNormal；`policies.py:437-448` 的 VOI 分數只用於診斷取證。依賴：numpy 遍布、scipy.special gammainc/gammaincinv（survival.py:7-10、ssbn.py:17）、rdflib（prowl.py:16、kg_generator/ontology.py:22-24）、yaml（skills.py:8）。kg_certify 共 5748 行，其中 ssbn.py 726、sweep.py 1280；kg_generator 共 5441 行，且 import kg_certify（loop.py:69-75）。kg_generator 是 pre-registered 模擬 harness（prereg.py:6 「runs … only while STATUS is SIGNED」、incidents.py:1 「Incident sampling」）。唯一純 stdlib、可移植的是 Datalog 引擎 rules.py（694 行）與 temporal.py（128 行 WindowedLiteral once/throughout、w）。
- 量測：S1c/S2/S3/S5/S6、C4/C5a/b、E1-E3、C3r PASS；S4 FAIL（completion − without = −0.1162，95% CI [−0.1502, −0.0820]，idea-KG.txt:976-978：圖補全量到的是**下降**，不只是無增益）；C3 FAIL −0.0433（:1036）；S1a/b 與 SY insufficient n（:963-966, :1032-1034）。D13 dropped、Y3 不主張（:1281）；D11/D12 不陳述效益（:1355-1357）。無田野資料、無 LLM 實跑（:14-15）。
- 申請狀態：兩檔皆無申請日或保密聲明；idea-KG.txt:4-5「must be reviewed by a patent attorney before filing」、:1394「professional CPC search … before filing」、README.md:21「No LaTeX specification yet」→ 推定未申請。
- README.md:25-28 Landscape Boundary：owns 憑證/缺口取證/逐條件過期/Y4/Y5；emits dispatch records with certificate and deficits、worker instructions with expiries。

### fankeel 這邊（readers 5-8）

- 時效邏輯全貌：TODO `on:` 由程式比日期，`after:`/`upstream:` 戳記滿 7 天 due，Watch 永不 due、60 天 stale 只問去留（todo.md:73-79；lib/todo.js:262-266, :285-295；2026-09-27-todo-blocked-watch.md:22）；文件 drift = 引用目標比文件晚改且差距 ≥ 14 天（SKILL.md:491；docs-audit.js:527-540，DEFAULT_SINCE=14 :37）；registry `isStale` 12 小時只是註記（registry.js:849-852；registry.md:9「never a state change」）；唯一逐項 `until` 在待答問題檔（handoff.js:135-140）；gate 答案若報告後來重寫則 stale（handoff.js:165-178）；verify 的 context 檔「until HEAD moves past the sha」（handoff.js:109）。
- claims 靠 pid 存活而非時間（collisions.md:155、:349；guard.js:129, :142-143）；設計明言拒絕計時過期：collisions.md:337-338「nothing deactivates anything: a session ending, a timer expiring and a terminal dying all leave `active` exactly as it was」、:343「A registry that expires claims on a timer is one that quietly loses work」、registry.md:437。
- gate 是人答（SKILL.md:356, :386；pipeline.md:122, :165），程式端只做結構驗證 gateProblem/ruleProblem（handoff.js:441, :317）；lib/gates.js 只事後記錄（gates.js:2）。「能用指令/測試/原型回答的就去跑，只有偏好判斷才問人」（SKILL.md:864-865）。
- handoff/next：`setNext` 只存一行 120 字 `next` 與一個整體 `handoff` 戳記（registry.js:814-820；registry.md:91, :531-537）；adopt 只調整 clock/moves 並檢查來源存活（registry.md:454-457, :548-557）；cmdAdopt 本體未讀。
- 反對新機制的原則：registry.md:99-104「A fifth store would overlap all of them while being the one nobody reviews」；documents.md:162-165「the scan is re-run rather than stored」、:82-84、:321-325「A new document is the last resort」。
- 無任何 projected/estimate/budget/horizon 邏輯（SKILL.md、六個 script、五個 lib 皆無；最近者是量測值 burn/clock/waited，SKILL.md:112-128；BUSY 400k 是量測不是預測，registry.md:489）。

### Spot-checks

- 成立：idea-KG.txt:862-888、:1279-1282；README.md:25-28；research_note-KG.md:229-236；certify.py:48-102；temporal.py:55-60；SKILL.md:491、:612；todo.md:69-79；collisions.md:317-318；lib/todo.js:244-295；docs-audit.js:527-540；lib/drift.js:1-6；handoff.js:135-140；registry.js:814-823、:849-852；guard.js:142-143。
- 不成立（修正）：reader 6 把「nothing deactivates anything … timer expiring」與「expires claims on a timer … quietly loses work」標為 `registry.md:337` 與 `:341-343`；該處實為 gate 欄位說明。原句在 `docs/90-agent/reference/collisions.md:337-338` 與 `:343`。上表已改用正確路徑。
- 修正 brief 的假設：`lib/drift.js` 不是文件 drift，是 drift bench（agent 違規計分，drift.js:2）；文件 drift 在 `scripts/docs-audit.js:527-540`。

### 對照表

| patent-KG 概念 | fankeel 對應機制（path） | 值不值得 | 理由 |
|---|---|---|---|
| Certificate at projected actuation time：C_k = 1−Σ(1−q_l(t+λ_k))，q_l 由存活律推出（idea-KG.txt:865-868；certify.py:48-76） | 最近者：stage gate（handoff.js:441 gateProblem；SKILL.md:356, :386 人答）；guard 在編輯當下檢查（guard.js:142） | 不值得 | 需要每個條件的 S_l 與每個技能的 Λ_k（idea-KG.txt:823-825, :895-896 假設校準正確）；fankeel 無此資料亦無法收集；fankeel 以「當下觀測」取代預測（registry.md:74；documents.md:162-165），並明文拒絕計時過期（collisions.md:337-343） |
| Deficit：d_l = 1−q_l，取最大 deficit；sensing before owner（idea-KG.txt:833-834, :874-878；research_note-KG.md:234-236） | judge/reader 規則：「能跑的就跑、只有偏好問人」（SKILL.md:864-865）、delegate 窄答（:957-962）；judge 的 `ask human:` 需附 `reason:` | 已有，不必做 | 同一順序（先便宜通道、最後才問人）已是規則；缺口「數字」需要 posterior p̂_l，fankeel 無 |
| Per-condition expiry t*_l 於工人指示，執行時只重測過期者（idea-KG.txt:884-888；certify.py:79-102） | `next`（120 字）+ 單一 `handoff` 戳記（registry.js:814-820；registry.md:91, :531-537）；adopt（registry.md:548-557；cmdAdopt 未讀）；先例：context 檔以 sha 定效期（handoff.js:109）、答案 vs 報告 mtime（handoff.js:165-178）、todo 逐組 stamp（todo.md:72-79） | **值得，小功能**（本 pick 的唯一項） | 結構可借、數學不可借：把「每條前提各有過期」改成 fankeel 的事件式——handoff 時記 HEAD sha，adopt 時 `git diff --name-only <sha>..HEAD ∩ claims` 列出「交接後被改的 claims」。改動處：`lib/registry.js:814` setNext 多存 `handoffSha`；`scripts/task.js:1159-1175` cmdNext 傳 HEAD；cmdAdopt 印差集。零程式碼替代：由 stage agent 在 `<stage>.md`（registry.md:42）寫一節「前提與失效條件」，skill 文字即可。若 cmdAdopt 已做此事 → 本項消失，pick 變 C |
| Temporal KG：fact 帶 t_on/t_obs/S_l，edge 帶 f_e（idea-KG.txt:843-845；kg.py:28, :237） | registry 扁平 JSON（registry.md:31；registry.js:292 writeSession），`moves [stage, at, used]`（registry.md:156）；無知識圖 | 不值得 | registry.md:99-104 拒絕第五個 store；documents.md:82-84「a map that contradicts the README is worse than no map」；fankeel 的「事實」是檔案與 git，不是帶存活律的命題 |
| Graph completion D11/D12（idea-KG.txt:1259-1263） | 無對應 | 不值得 | 專利自己量到準確度下降 −0.1162（idea-KG.txt:976-978，S4 FAIL）且不陳述效益（:1355-1357） |
| Y4 windowed literal once/throughout（temporal.py:56-60）；Y5 consistency filter（kg_generator/consistency.py:198） | todo stamp 7/60 天窗（lib/todo.js:265-266）、drift 14 天窗（docs-audit.js:537）；docs-check 的 `path:line`+引文機械反證（SKILL.md:461-465；documents.md:280, :412） | 已有，不必做 | fankeel 只允許「窗到了提醒人」而非自動改狀態（todo.md:76-79；2026-09-19-waiting-triggers.md:20「程式只判日期」） |
| 程式碼本身（kg_certify 5748 行、kg_generator 5441 行） | 無 | 不值得（排除 A） | numpy/scipy.special/rdflib/yaml 依賴（survival.py:7-10；ontology.py:22-24；skills.py:8）；模擬 harness（prereg.py:6）；唯一純 stdlib 的 Datalog 引擎 rules.py 在 fankeel 無規則庫可跑 |

### 專利揭露顧慮

patent-KG 未申請（idea-KG.txt:4-5, :1394；README.md:21）。claim 1（idea-KG.txt:1284-1309）記載：帶存活函數的 KG、PR-OWL/MEBN SSBN、下界 q_l、在 t+λ_k 評估、deficit 取證、帶過期的工人指示。本 pick 提議的小功能（adopt 時以 sha 差集重驗 claims）不含上述任一元件，不構成對該發明的揭露；但 fankeel 文件應以自己的術語描述、不引用 patent-KG，且在申請前不要把 C_k/t*/deficit 機制寫進 fankeel 的 docs 或 README。fankeel repo 是否公開未查；若公開，這條更重要。

### 如何得出 D

A 排除：依賴與模擬性質。B 排除：可重述的部分（取證順序、窗、機械反證）fankeel 已有，不可重述的部分（憑證、t*、KG）缺存活律且違反 fankeel 的「觀測而非預測、不計時過期」設計。C 太絕對：工人指示「逐條前提、執行時只重測變動者」的結構，對 handoff/adopt 是真實缺口（單一 `handoff` 戳記，registry.js:819），能以 fankeel 的事件式一小步補上。故 D。已把三個事實寫入 `F:/ymlab/.fankeel/build/task-20261101T165928/context.md`（certify.py:48、lib/todo.js:285、idea-KG.txt:4）。

```chartroom
{"chartroom":1,"title":"patent-KG concepts vs fankeel mechanisms","root":"main"}
{"view":"main","title":"patent-KG concepts vs fankeel mechanisms","dir":"LR"}
{"node":"k1","in":"main","label":"Certificate at t+lambda (certify.py:48)"}
{"node":"k2","in":"main","label":"Deficit-directed acquisition (idea-KG.txt:874)"}
{"node":"k3","in":"main","label":"Per-condition expiry t* (certify.py:79)"}
{"node":"k4","in":"main","label":"Temporal KG + completion (kg.py:28)"}
{"node":"k5","in":"main","label":"Windowed literal / consistency filter"}
{"node":"f1","in":"main","label":"Gate: human answer + gateProblem (handoff.js:441)"}
{"node":"f2","in":"main","label":"Run before asking (SKILL.md:864)"}
{"node":"f3","in":"main","label":"next / handoff stamp / adopt (registry.js:814)"}
{"node":"f4","in":"main","label":"Flat registry, liveness not timers (collisions.md:343)"}
{"node":"f5","in":"main","label":"todo stamp windows + docs-check quotes (todo.js:265)"}
{"edge":"e1","in":"main","from":"k1","to":"f1","label":"not applicable: no survival law","arrow":"end"}
{"edge":"e2","in":"main","from":"k2","to":"f2","label":"already a rule","arrow":"end"}
{"edge":"e3","in":"main","from":"k3","to":"f3","label":"small feature: adopt re-checks claims since handoff","arrow":"end"}
{"edge":"e4","in":"main","from":"k4","to":"f4","label":"not applicable: design refuses a fifth store","arrow":"end"}
{"edge":"e5","in":"main","from":"k5","to":"f5","label":"already present as 7/60/14-day windows","arrow":"end"}
```
