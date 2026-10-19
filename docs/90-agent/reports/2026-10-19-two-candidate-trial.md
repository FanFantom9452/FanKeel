---
status: current
last_verified: 2026-10-19
source_of_truth: skills/fankeel-design/SKILL.md
---

# 兩個候選草圖再由判官選一，試跑一次 — 2026-10-19

一句話：在「每功能驗證地圖」放哪裡這一題上，兩份 opus 草圖加一位 fable 判官花了約 159k subagent token（不含判官的六個讀者），判官選 A，使用者同意；決定性的事實寫在 B 自己的成本段裡，所以這次不足以支持把它變成 `architectural` 的固定步驟。

## 1. 怎麼跑

來源是 `docs/90-agent/todo/skills-4.md` 的第二個問題：architectural 任務值不值得「兩個候選草圖再由 judge 選一」（pstack 的 architect＋arena），而 Claude Code 只有同家族模型，對抗訊號可能弱、成本加倍。10-19 第三輪盤點的 design 階段拿驗證地圖的位置試了一次。

- 兩個 opus 草圖 agent 同時派出，各拿一個立場：A 是 `.fankeel/verify/` 下每個功能一份 markdown，B 是在 `.fankeel/render.json` 加 `features` 陣列。草圖寫在 `.fankeel/build/2026-10-19-candidates/A.md` 與 `B.md`（`.fankeel/build/` 不進 git，所以要點摘在本頁）。
- 一位 fable 判官，effort xhigh，讀兩份草圖並派六個 sonnet 讀者核對引用，讀者以前景（`run_in_background: false`）派出。
- token 是各 subagent 回報的用量，判官的數字不含它的讀者。

## 2. 結果

| 角色 | 模型 | token | 產出 |
|---|---|---|---|
| 草圖 A | opus | 約 57k | 目錄式 prose 功能檔，frontmatter 只放 `src`、`render`、`status` |
| 草圖 B | opus | 約 61k | `render.json` 的 `features` 陣列，沿用 `parseTargets` 的拒絕通道 |
| 判官 | fable，xhigh | 約 41k | 選 A，三個理由 |
| 讀者 ×6 | sonnet | 沒量 | 六個都回到判官，沒有一個交回到上層 session |

判官選 A 的三個理由：

1. `lib/shots.js:41-42` 拒絕沒有非空 `pages` 與 `roles` 的 render.json，而 fankeel 本身沒有 render.json；它的功能多半是 hook 與 CLI，走 B 得先放一個假頁面，或放寬這條規則而動到 render 閘門。
2. B 把 prose（drive、gotchas）綁進會擋人的閘門：功能條目一個欄位寫錯，就是 `ledger.js complete` 與 `task.js` claim 的解析錯誤。
3. A 符合這個 repo 一功能一檔的形狀，每個功能有自己的 `git log` 與 diff。

使用者看過後同意 A。

## 3. B 留下了什麼

沒被選的草圖仍有三點帶進 A 的設計（design 第 9 節）：

- 頁面型功能用 `render:` 指向 render.json 的 pages，`src` 從那裡取，不在功能檔重宣告一次，免掉 A 自己承認的兩份 `src` 漂移。
- frontmatter 有 `kind: page | cli | hook`，非頁面功能有正式的位置。
- verify 比對變更路徑時重用 `pagesTouched`（`lib/shots.js:87`），不寫第二套 glob 比對。

## 4. 這次說明了什麼

- **決定性的事實出自 B 自己。** `lib/shots.js:41-42` 那條拒絕是 B 的「What it costs」第一點，B 也寫了「如果 hook 與 CLI 佔多數就是錯的選擇」。一份草圖誠實寫成本，判官做的多半是確認，不是發現。
- **第二份草圖的價值在補洞，不在選邊。** 三點帶過來的都是細節，不是方向；單一草圖加一位 reviewer 問「另一個位置會怎樣」可能拿到同樣的東西，這次沒有對照組可以證明。
- **成本約翻倍。** 單一草圖約 60k，這次約 159k 再加六個讀者。
- **同家族模型的對抗訊號：** 兩份都是 opus，立場是派的時候指定的，不是模型自己分歧出來的；這次看不出同家族是否削弱了判斷。

## 5. 結論

不把兩候選訂成 `architectural` design 的固定步驟，也不另開決定條目。只跑過一次、一個題目，樣本不夠；這次的選擇在 B 的成本段就已經寫明，多花的一倍 token 換到的是三個細節。若之後某個 architectural 題目的兩個方向都沒有明顯的硬限制，再試一次並記下單草圖的對照。

## 沒驗證的

- 六個讀者的 token 沒有量。
- 沒有單一草圖的對照組，所以「一份草圖加 reviewer 也能拿到那三點」是推論。
- 判官以前景派讀者、讀者全數回到判官，只在這一次 design 階段的前景判官上看到；背景 `/fankeel-ask` 判官的情形留給 design 第 4 節的 verify。
