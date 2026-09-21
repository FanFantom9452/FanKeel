---
status: decision
last_verified: 2026-09-22
---

# ctx.js --by-stage 先做、其餘五個 task 等量測 — 決策紀錄

起點是使用者的觀察：主控用 Sonnet 5 很省，但主 session 還是被不斷叫起、stage 來回跳讓 context 堆得很快，所以每個 stage 都要拆出去。
設計見 [../plans/2026-09-21-all-stages-brain-design.md](../plans/2026-09-21-all-stages-brain-design.md)，
計畫見 [../archive/2026-09-21-all-stages-brain.md](../archive/2026-09-21-all-stages-brain.md)，
沒做的五個 task 在 [../plans/2026-09-21-all-stages-brain-held.md](../plans/2026-09-21-all-stages-brain-held.md)。
**主控用 Sonnet 是前提，品質由 stage agent 負責**，所以這個任務量的是主控的 turn 與 context，不是品質。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 全部 stage 交給 brain 要補什麼 | 設計寫了四樣：handoff 按圈編號、brief 的 `read first:`、design 與 plan 的 `artifact:` 與提交、audit 與 land 走 implementer；builtin 維持 `false` | 受控 build／verify 已經接上，缺的是每一站都能拆時的這幾樣；全拆只是 profile 的 `stage.agents: all` |
| 先做哪一部分 | **只做 `ctx.js --by-stage`**，其餘五個 task 原文收進 held 檔 | 使用者在 plan 關卡選的：受控 build／verify 從沒跑完一輪，後面四節蓋在沒跑過的東西上，先量再改 |
| 讀取清單誰寫（未做） | 上一站的 brain 寫、`hooks/brief.js` 抄 | 主控沒讀原檔，只能從摘要挑；design 站使用者選的 |
| brain 自己提交（未做） | 拿掉，A/B 量完再決 | 使用者上次選了主控提交，要推翻它得先有兩個 turn 的實際成本 |
| `woken` 的定義 | 自上一個 request 以來收到 subagent 回報、且沒有 tool result（回報之前或之後都算；人的 prompt 不影響） | verify 發現字面「回報後面、中間沒有 tool result」與程式不一致；改字面、不改算法，並用測試釘住 tool result、回報、request 這個順序 |
| `ctx.js` 讀 subagent 檔 | 每個 request 行都是 sidechain 就當主線讀，看內容不看路徑 | 第三次 adversary 發現對 `subagents/agent-<id>.jsonl` 印 `unreadable`，而 §1 要量每個 brain 的 context 序列 |

## 二、沒做的，以及為什麼

- **held 檔的 Task 2 到 6**（圈號、`read first:`、`artifact:` 與提交、audit／land 路徑、文件）：等 §1 的真實量測。開工前要先讀 held 檔的說明，並處理改名 task 的圈號（`cmdTask` 刪 `moves` 卻保留 `started`）。
- **§1 的真實受控跑與 dated report**：要使用者開新終端機，用 `claude --plugin-dir F:/ymlab/fankeel` 或重裝；裝機的 0.74.0 沒有 `STAGE_AGENTS`、`COMMIT_RULE`、`scripts/commit.js`，build 與 verify 不受控。
- **沒有 push**：整合走 profile 的本地合併。
- **三行 TODO 小尾巴**：`stageRows` 的 `isSidechain` skip 沒有 fixture、多餘的 `t === null`；讀 agent 檔的 fixture 沒有 user 行、`isAgentFile` 可精簡、一處註解；`docs/subagents.md` 的 Accounting 條。都不改變任何數字。
- **`Number.isFinite(c.turn)` 那個 guard 沒有真實案例**：427 份 transcript、53,571 個主線 tool_use 行（最後一次日誌的數字，transcript 還在長）裡沒有缺 `model` 或 `usage` 的；它只在合成 fixture 上證明過，是防禦性的。

## 三、量到的

用新工具讀 session 4f52fd18（Sonnet 5 主控、0.74.0、build 與 verify 都不受控，是「沒拆」的基線）：454 個 request、55 個 woken、24 個 gate；
九次站切換的站名與順序和 registry 的 `moves` 相同（每次切換落在哪個 turn 沒有另外核對）。逐站：build 232＋26＝258 turn、verify 62＋11＝73、audit 33、land 19；
主控重讀量 186.8M token 裡 build 加 verify 佔 129.5M（69%），audit 與 land 佔 45.3M。design 站當時算出的「verify 125 turn、兩站佔 94%」是把 audit 與 land 併進 verify 的結果。
454 個 request 裡 398 個有 tool result、55 個有回報而沒有 tool result、1 個兩者都沒有，沒有 request 兩者都有：主控的 turn 主體是它自己的 tool loop，不是被叫醒。
該 session 的 63 個 agent 檔現在全部讀得了，最大的 context 是 431,192（一個 `fankeel:fankeel-reader`、66 個 turn，不是 brain）。

這個 session 自己也是一個數字：主控 context 在 build 與 verify 的來回之後到 583k（hook 顯示的 in play）。build 燒 369k、耗 1 小時 51 分，verify 燒 194k、耗 1 小時 30 分。

## 四、verify 抓到而 build 的 review 沒抓到的（給下一個人）

verify 三次退回 build；一個 task 加十二個 fix 與文字修正，共 13 個 commit。每一項都是 build 的逐 task reviewer 讀 diff 與 brief 讀不出來的：

- **沒被任何測試釘住的 guard**：整條分支的 review 找到三個，第二次 adversary 又找到兩個，記成 TODO。
- **字面與程式不一致**：`woken` 的說法與算法差一個順序；spec 說「`ctx.js` 印得出」的數其實有一個它不印。
- **spec 裡已被新工具取代的舊數字**：「沒進 repo」、「verify 125 turn」、「只配到 6 個指令」。
- **plan 關卡新增的三頁沒進 `docs/README.md`**：`docs-audit` exit 1；已寫成記憶 `plan-gate-indexes-its-pages`。plan 關卡的提交要一併索引它新增的頁面。
- **證據腳本自己的缺口**：一條檢查在 Windows 的 `cmd.exe` 下永遠是空字串、掃描與分類器不在紀錄、數字用打字的常數比；每一條都補上了負對照。
- **`ctx.js` 讀不了 agent 檔**：只有讀 spec 的 adversary 才會去跑那個指令。

沒做的：build 的 reviewer 範本沒有加「這個改動讓哪一頁變成假的」與「每個檢查有沒有負對照」，這次只寫進了記憶。
