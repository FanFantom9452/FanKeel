---
status: design-intent
---

# 自動壓縮改靠主機的壓縮視窗（10-12）— design

這條路線沒有 design 站；這份是 plan 站寫的，連同計畫一起在 plan 的 gate 給使用者核准。量測在 [2026-10-12-compact-window-probe.md](../reports/2026-10-12-compact-window-probe.md)。

使用者要的是：任何站都會壓、進 build 前不被打斷、不用自己打 `/compact`。fankeel 的 mod 做不到這三樣（要每個 session 按 Enable，只能在 turn 之間壓，壓完要人說繼續）；主機自己的自動壓縮做得到，只是它預設認模型的視窗，1M 的視窗要接近 1M 才壓。先前照 [2026-10-12-compact-before-build.md](../judgements/2026-10-12-compact-before-build.md) 寫的「mod 寫心跳、進 build 先壓一次」那一版，使用者在 gate 退回，這一版取代它。

## 1. 主機的壓縮視窗是主要機制

- 指南寫明一次性的設定：在 `~/.claude/settings.json` 的 `env` 加 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`，建議值 `450000`；設了之後主機在 context 到視窗減約 3 萬時自己壓，turn 進行中也壓，不需要 mod、Enable 或使用者動作。
- 指南同一段改掉「你在全域關掉的自動壓縮，對沒有 fankeel task 的 session 維持關閉」那一句：這個設定對每個 session 都生效，不只 fankeel 的。

## 2. context 行在沒有視窗時說出來

- context 到 `BUSY`（400k）以上、還沒有壓縮過，而 hook 的環境裡沒有正數的 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`：`context:` 行最後多一句，說這個 session 在模型自己的上限之前不會被壓縮，請 Claude 轉告使用者設那個變數或手動 `/compact`。已經壓縮過的 session 不加，那一行已經夠長（`tests/render.test.js` 的 3000 字上限）。
- 有設的時候，或 400k 以下：這一行跟現在一樣，一個字不多。

## 3. 沒做的

- `hooks/compact.ts` 不動：它的門檻是 450k，主機設 450000 時會先在 420k 上下壓到，mod 變成保險。
- 不做依任務大小的判斷、不做進 build 前的壓縮、不做心跳檔：主機只在真的到線時才壓，task 少的任務永遠碰不到。
- Claude Desktop 真機上設定吃不吃得到，這次只有 headless 的量測；開一筆 TODO。

## 檔案

| file | change |
|---|---|
| `lib/context.js` | `windowSet`，`contextLine` 多一個參數與一句 |
| `lib/render.js` | 兩處 `contextLine` 帶上環境變數 |
| `tests/context.test.js` | 上面的測試 |
| `docs/90-agent/reference/registry.md` | context 行那一節 |
| `docs/01-guide/profile.md` | 設定怎麼設，改掉全域關閉那一句 |

## What proves it done

| claim | check |
|---|---|
| 過 400k、還沒壓縮過而沒有設視窗時，context 行說出來 | `tests/context.test.js` 的測試，現在失敗 |
| 有設視窗時、400k 以下、或已經壓縮過，context 行不變 | `tests/context.test.js` 的測試 |
| 兩個注入區塊都帶那一句 | `tests/context.test.js` 透過 `render` 與 `renderResume` 的測試，現在失敗 |
