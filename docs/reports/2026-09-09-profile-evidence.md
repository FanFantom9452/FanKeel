---
status: current
last_verified: 2026-09-09
source_of_truth: F:/ymlab/fankeel/.fankeel/sessions/ 的 106 個 JSON，per-machine 且不在版本控制裡；本頁抄錄它們當天的欄位分佈，不是重新量測
---

# 開發偏好 profile 的證據

`docs/improvement-brief.md` §4.2 提的 profile 要「掃過去的 session 找出每個專案的慣例
答案」。這份報告是那個掃描的結果，只回答一個問題：**今天在這台機器上，哪些慣例答案是
真的拿得到的。** 格式、欄位、存哪裡都是待決，不在這裡。

先講結論：那一節列的證據來源有一半在資料裡不存在。

## registry 實際有什麼

`.fankeel/sessions/` 106 個 JSON，全部解析乾淨。欄位聯集是 18 個：

```
active, burn, claims, class, clock, configDir, ended, model, next, notes,
route, spend, stage, started, task, updated, usage, waited
```

| 欄位 | 106 筆裡有幾筆 | 能不能當 profile 的來源 |
|---|---|---|
| `route` | 106 | 可以，但它是階段序列不是單一答案：13 種不同的序列 |
| `class` | 70 | 可以 |
| `project` | **0** | 不行 |
| `guard` | **0** | 不行 |

簡報 §4.2 寫 registry「有 task / project / route / class / guard」。那是 schema 上有，
資料裡 `project` 與 `guard` 一次都沒出現過。兩者各有原因，而且原因不同：

- **`project`** 只在 registry root 底下不只一個專案時才會被寫入，而這個 registry 只蓋著
  一個專案。**所以以「每個專案一份 profile」為形狀的設計，在這裡的證據上沒有鍵可以分。**
  106 筆的 `configDir` 也全部是同一個 `C:\Users\Owner\.claude`。
- **`guard`** 缺席本身就是答案：不寫代表用預設的 `ask`。106 個 session 沒有人改過它，
  所以 profile 裡放一個 `guard` 欄位，記的會是一個從來沒有人表達過不同意見的偏好。

`class` 的分佈是 `bounded` 47、`architectural` 22、`spike` 1。route 前三名：

| 次數 | route |
|---|---|
| 47 | `survey, design, build, verify, land` |
| 24 | `survey, design, plan, build, verify, audit, land` |
| 14 | `design, build, verify, land` |

## land 的答案不在 registry 裡

`skills/fankeel-land/SKILL.md:165-170` 每次都問同一件事：

```
Present exactly these, and wait. Integration is the user's decision.

1. Merge back to <base> locally
2. Push and create a Pull Request
3. Keep the branch as-is
```

沒有任何欄位記下使用者選了哪一個。唯一的紀錄在 git 裡：`git log --merges` 在這個 repo
回 10 筆，全部是 `merge:` 開頭的本地合併（例如 `8c6011f merge: the station is four
files and the D dashboard`），沒有一筆是 `Merge pull request #…` 或 squash 合併的形狀。

**所以這個 repo 的 land 答案是選項 1，而且證據是 git 而不是 registry。** 任何想「掃過去
的 session 得到 land 慣例」的設計都要先接受這件事：那個答案不在 session 記錄裡，要嘛從
git 推，要嘛從今天開始記。

## 這份報告不涵蓋什麼

- **只查了兩條絕對路徑**：`F:\ymlab\fankeel\.fankeel\sessions\`（106 個檔）與
  `C:\Users\Owner\.claude\fankeel\sessions\`（目錄不存在）。station 說全機有 5 live、
  4 stale，其餘 registry 沒有列舉，所以 106 是下限而不是普查。
- **106 含這個 session 自己那一筆**，而它當天還在被寫入。這個數字會因為被記錄而移動。
- 沒有量任何一個「問了幾次同樣的問題」的頻率。上面說的是答案在不在，不是問了幾次。

[回到索引](README.md)
