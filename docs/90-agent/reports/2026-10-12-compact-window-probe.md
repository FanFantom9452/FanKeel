---
status: current
last_verified: 2026-10-12
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新
---

# 主機的壓縮視窗探針：設了 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`，主機在 turn 進行中自己壓（headless，n=2）

結論先講：Claude Code 自己的自動壓縮可以用環境變數 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 把視窗調小，調小之後它在 context 到「視窗減約 3 萬」時壓縮，而且是在一個 turn 進行中、兩次 model 請求之間壓，不需要 fankeel 的 mod、不需要 `/plugin` 的 Enable、也不需要使用者做任何事。這是在 headless（`claude -p`）、haiku、Claude Code 2.1.296、fankeel 工作樹 f741b6c7 上量的，每個視窗各跑一次。

## 為什麼量這個

SBIR 工作區的 session 9916350f（Claude Desktop 2.1.295，build 站）在 2026-10-11T19:40Z 過 450k，到 2026-10-12T01:17Z 使用者手動 `/compact` 時是 629k，壓縮邊界記 650k。這段期間 transcript 有 16 筆 `stop_hook_summary`，也就是 turn 結束了 16 次，沒有任何一次壓縮。fankeel 的壓縮只有 `hooks/compact.ts` 這支 mod，要每個 session 按 Enable 才載入，而且只能在 turn 之間壓。使用者問的是：有時候看得到的那種自動壓縮為什麼不能用。那種是主機自己的，transcript 裡記成 `trigger: auto`。

## 量到的

| 視窗 | 壓縮次數 | 每次壓縮前的 tokens | 壓縮後 | session |
|---|---|---|---|---|
| 40000 | 0 | context 從 39k 起跳、到 59k 結束 | 沒有壓 | 262f59ec |
| 100000 | 3 | 71219、71756、74916 | 15098、16797、15628 | 8e33027e |
| 200000 | 2 | 164970、169774 | 14590、13560 | 0f5f068f |

- 三次都是同一種跑法：一個 prompt 叫模型連續用 Read 讀大檔，每次 400 行，全部在同一個 turn 裡。壓縮發生在這個 turn 中間，模型接著讀完並回 `done`（200000 那次）。
- 100000 那次最後的回覆是主機自己的訊息 `Autocompact is thrashing: the context refilled to the limit within 3 turns of the previous compact, 3 times in a row`：視窗小到壓完三步之內又滿，連續三次，主機就停。這是探針把視窗壓太小造成的，不是一般情況。
- 40000 沒有壓：這個 repo 的 session 起始 context 就有 39k，視窗比起點還小。主機在這種情況下做什麼沒有再追。
- 觸發點：100000 時是 71k 到 75k，200000 時是 165k 到 170k，兩個視窗都落在視窗減 25k 到 35k。照這個差距，450000 會在 415k 到 425k 壓。這是從兩個點外推的，沒有在 450000 量過。

## 沒量的

- 互動式的 Claude Desktop：變數寫在 `~/.claude/settings.json` 的 `env` 時，Desktop 啟動的 session 吃不吃得到，沒量。
- 1M 視窗的模型在 450000 的實際觸發點。
- 主機壓縮時用的摘要指示：fankeel 的 mod 自己壓的時候會要求摘要留下 session id、task、stage（`hooks/compact.ts` 的 `instructionsFor`）；主機自己壓的不經過那一段。壓縮之後 `context:` 行會帶 `--session <id>`（`lib/context.js` 的 `contextLine`），那一條不受影響。
- `docs/01-guide/profile.md` 寫使用者在全域關掉了自動壓縮；`~/.claude/settings.json` 裡沒有對應的鍵，而 fankeel 專案的幾個 session 有 `trigger: auto` 的壓縮（243k 到 387k）。哪一邊對沒有查清楚。
