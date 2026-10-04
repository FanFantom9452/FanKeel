---
status: current
last_verified: 2026-10-04
---

# mod 探測第四輪：補測 (d)，mod 載入時 fankeel 的 command hook 內文有沒有被干擾

一句話：用第三輪留下的探針（`docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/` 的 `mod/`、`settings.json`、`proxy.js`）開兩個互動式 session，一臂載入 mod、一臂不載入，兩臂都先用 `task.js start` 進受控 stage，再派一個 `fankeel:fankeel-reader`，從 proxy 存下的請求本文判斷 fankeel 的注入有沒有到，結果寫成一份新的報告頁。

為什麼現在能做：第三輪的補測卡在 `task.js` 拒絕一個沒有 `sessions/<pid>.json` 的 session（`docs/90-agent/reports/2026-10-03-mod-probe-3.md:77`）。`7d63b578` 之後，`requireSession` 也接受 `CLAUDE_CODE_SESSION_ID` 與存活的 `CLAUDE_PID` 對得上的 shell（`lib/live.js:151-159`，`scripts/task.js:293-294`），所以不必先解開 sessions-3 的原因。

## 1. 兩臂量測

- 兩臂都是互動式 session，`ANTHROPIC_BASE_URL` 經第三輪的 `proxy.js`，證據存到 `docs/90-agent/reports/evidence/2026-10-04-mod-probe-4/` 底下的 `mod-on/` 與 `mod-off/`。
- mod 臂用 `--plugin-dir <round-3>/mod --settings <round-3>/settings.json` 啟動，載入以 debug 檔裡 `hooks module fankeel-mod-probe@inline loaded` 那一行為證；對照臂不帶這兩個旗標，debug 檔沒有那一行。
- 兩臂都先跑 `node scripts/task.js start --session <該 session 的 id> --task "mod-probe d" --route survey`，探針 prompt 叫主 session 不要執行 stage，只派一個 `fankeel:fankeel-reader`（description `mod-probe d reader`）回答它收到的 prompt 第一行。量完跑 `task.js` 把該 session 的條目清掉，registry 不留東西。
- 判定只看 proxy 存下的請求本文，不看模型自述：主 session 請求的注入裡有沒有 fankeel 的受控 stage 區塊，reader 第一個請求的 prompt 有沒有 `hooks/brief.js` 寫的 `FANKEEL` 開頭那一行。
- 對照臂兩樣都必須找得到，否則這次量測判無效、不判「沒有干擾」：對照臂就是這個探針抓得到東西的證明。
- 每臂 n=1，兩臂交替各跑一次；不重跑第三輪已判定的 (a)、(b)、(c)。

## 2. 記錄

- 新增 `docs/90-agent/reports/2026-10-04-mod-probe-4.md`：判定（沒有干擾、有干擾、或無效）、兩臂的本文路徑與命中行、HEAD 與 Claude Code 版本。第三輪的報告頁是一次量測的記錄，不改它。
- `docs/03-decisions/2026-10-03-mod-route.md` 的「沒做的」第一條改成指向第四輪的結果；擱置的決定本身不變。
- `docs/90-agent/reference/sources.md` 加一列 `MOD-PROBE-4-261004`，`docs/README.md` 的索引加這份報告。

## 不做

- 不解 sessions-3（子 session 為什麼不寫 `sessions/` 檔）；那條保持開著。
- 不維護探針，跑完即棄，與第三輪相同。
