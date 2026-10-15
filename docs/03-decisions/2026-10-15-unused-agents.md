---
status: decision
last_verified: 2026-10-15
---

# 沒派過的 agent 各自怎麼處理（10-15）

一句話：effort 改在派工時傳，六個 `-high`／`-xhigh` 複本刪掉；mover、mutator、writer 留給 stage agent 派；init-scout 與 slimmer 不動。

## 決定

| agent | 怎麼處理 | 為什麼 |
|---|---|---|
| implementer-xhigh、reviewer-xhigh、brain-high | 刪掉 | effort 改在派工時傳，六個複本全部退役 |
| mover、mutator | 留著，只給 stage agent 派 | stage agent 不能 Edit，才需要它們；在 session 裡跑的 audit 與 land 自己搬檔；在 session 裡跑的 verify 沒有 mutation 這一步 |
| writer | 留著，只給 stage agent 派 | build 與 audit 的 stage agent 透過它寫給人看的頁；在 session 裡由 session 自己寫 |
| init-scout、slimmer | 留著，不改 | `fankeel-init` 會派這兩個；這個 repository 從來沒跑過 init |

- 表上第一列的三個從沒被派過；另外三個複本（implementer-high、reviewer-high、brain-xhigh）派過，也一起刪。
- 哪些 agent 只有 stage agent 會派，寫在 `docs/90-agent/reference/subagents.md`。

## 為什麼

- 10-15 的探針：兩次 `fankeel:fankeel-reader` 派工都用 opus，其中一次帶 `effort: "high"`。
- 帶的那次，請求前綴記的是 `effortValue: "high"`；沒帶的那次是 `medium`，和 agent 檔一樣。
- 派工時傳的 effort 會蓋過 agent 檔，複本就沒有存在的理由。
- 複本是 agent 檔的拷貝，本體每改一次就要重產六份；刪掉之後只剩一份要維護。
- mover、mutator、writer 在這裡沒被派過，是因為每個 stage 都在 session 裡跑。改由 stage agent 跑時要靠它們，刪了 stage agent 就沒有手。
- init-scout 與 slimmer 沒被派過，是因為這個 repository 沒跑過 init；別的專案跑 init 時會用到。

## 放棄了什麼

- 用 mod 的 turn.step 依 agentId 改寫每個子代理 effort 的做法不做了；派工時直接傳就夠。TODO 條目「每個子代理的 effort」以此結案。
- 舊的對話紀錄裡還會出現 `fankeel-implementer-high` 這類名字；`baseAgent` 照舊把它讀成本體，bench 與 drift 讀舊紀錄時不會壞。
- 探針只量了 reader。brain、implementer 與 reviewer 帶 effort 的派工沒有再量一次，推定它們一樣。
