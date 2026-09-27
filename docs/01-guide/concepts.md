---
status: current
last_verified: 2026-09-27
source_of_truth: docs/02-architecture/pipeline.md, docs/90-agent/reference/registry.md, lib/stages.js, README.md
---

# 概念

fankeel 把一件工作切成幾站走，每站做完停下來問你一次。這頁講四件事：七站各產出什麼、三種類別、gate 怎麼答、registry 是什麼。每一站裡面的步驟在 [pipeline.md](../02-architecture/pipeline.md)。

## 七站

每一站用它的產出命名：

| 站 | 產出 |
|---|---|
| `survey` | 這裡已經有什麼：搜程式、讀文件，確認要做的東西是不是已經存在 |
| `design` | 一個你同意的做法：它的取捨，以及一個現在會失敗、做完會通過的檢查 |
| `plan` | 拆成沒看過這個 repo 的人也能照做的 task，每個 task 自己測、自己審 |
| `build` | 改動本身：寫、測、提交，每個 task 審一次 |
| `verify` | 證據：跑測試、確認改了的東西真的改了、找出這次改動讓哪些文件變得不對 |
| `audit` | 一份清單：哪些文件已經不是真的 |
| `land` | 收尾：關掉 TODO、重寫 project map，然後 merge、開 PR 或先留著 |

每一輪 prompt 只送目前這站的規則，而且每輪重送。

## 三種類別

類別決定一個 task 走哪幾站。開 task 時決定，而且會說出來，你可以不同意：

| 類別 | route | 意思 |
|---|---|---|
| `spike` | survey → build | 可不可行的問題，產出是一個答案；做出來的東西標成用完即丟 |
| `bounded` | survey → design → build → verify → land | 在這個 repo 已經有的流程上做範圍明確的改動；design 在對話裡做，不寫 spec 也不寫 plan |
| `architectural` | 七站全走 | 新的子系統，或改動別的東西依賴的介面 |

`bounded` 量的是 repo，不是你熟不熟：要改的流程已經在這裡可以讀，才算 bounded。拿不準就選重的那個。

## gate 怎麼答

每一站做完都停在 gate，用 `AskUserQuestion` 問你，至少三個選項：

- **第一個是核准。** 它的說明寫著核准的是什麼，design 之後就是那個做法本身。選了就往 route 的下一站走；在最後一站選它，task 就收掉。
- **第二個是留在這站**，說明裡寫著還沒決定的那件事。
- **暫停：** 下一步寫進 registry，task 比 session 活得久，下次 `/fankeel` 可以接著做。

選項都不合意，就用 Other 自己寫。profile 可以替某些 gate 先寫好答案，例如收尾要 merge 還是開 PR，見 [profile.md](profile.md)。設了 `gate.station` 的話，gate 也會出現在監控站上，可以在頁面上答。

## registry

registry 是專案裡的 `.fankeel/` 目錄，每個 session 一個檔：

```
.fankeel/
├── .gitignore
└── sessions/
    └── {session_id}.json
```

裡面記著這個 session 在做的 task、在哪一站、試過什麼（`notes`）、下一步（`next`），以及它動過的檔案（`claims`）。檔案不用你宣告，編輯落地時由 hook 記下。兩個 live session 動到同一個檔，badge 會變成 `[FANKEEL:CLASH]`，預設另一邊編輯前會先問你。

`sessions/` 不進 git。監控站就是把這台機器上所有 registry 讀出來畫成一頁。每個欄位的說明在 [registry.md](../90-agent/reference/registry.md)。
