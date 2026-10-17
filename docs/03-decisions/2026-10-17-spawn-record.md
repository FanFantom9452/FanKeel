---
status: decision
last_verified: 2026-10-17
---

# mod 替 brief.js 記下 spawn，brief 本身不搬（10-17）

一句話：`hooks/mod.ts` 在 `agent.spawn` 時把 prompt 第一行、`subagentType`、`parentAgentId` 寫進 `.fankeel/build/spawn/<agentId>.json`，`hooks/brief.js` 先讀它再退回 transcript 與 meta；brief 的內容照舊由 SubagentStart 的 command hook 交出。

同一次還修了 Desktop 窄 band 的 ⚑，也證明了 command hook 讀得到 settings 的壓縮視窗。設計與計畫在 [2026-10-17-three-followups-design.md](../99-archive/2026-10-17-three-followups-design.md) 與 [2026-10-17-three-followups.md](../99-archive/2026-10-17-three-followups.md)。

## 決定

- mod 只記三件事、不交 brief：prompt 第一行最多 200 字元，`parentAgentId` 從主 session 派出時是空字串。agentId 不符合 `^[\w.-]+$` 就不寫；寫不出來記一次 debug log，派出照常。
- registry 根目錄在 mod 裡另寫一份，從 `$.session.root()` 往上找到有這個 session 檔的那一層，因為 mod 引擎不能 require `lib/`。
- `promptOfAgent` 與 `nestedBrain` 先讀這個檔：有非空的 `parentAgentId` 就判成巢狀，不登記 in-flight。讀不到就照舊讀 transcript 與 meta。
- mod 沒載入時沒有這個檔，`hooks/brief.js` 行為與之前一樣，符合 [2026-10-07 mod 重開](2026-10-07-mod-reopen.md) 的退路規則。

## 為什麼

剛派出的子代理還沒有自己的 transcript 與 meta，所以 SubagentStart 第一次跑時，巢狀 brain 一律被判成非巢狀。mod 在派出那一刻看得到這些資料，command hook 看不到。

## 放棄了什麼

- 整份 brain brief 改由 `agent.spawn` 寫進 prompt：brief 要用 profile、stages、handoff 這些 `lib/` 模組，mod 引擎 require 不到。另外 mod 與 hook 同時交 brief，子代理會拿到兩份。
- 用 `session.append` 在子代理跑到一半時補 brief：這次的洞在第一次 SubagentStart，補在半途解決不了。

## 還沒驗的

真機上這個檔在 SubagentStart 跑的時候是不是已經寫好，這次沒驗到。那個 session 的 mod 早於這次改動載入，派出前後都沒有 spawn 目錄。這件記在 [brief-7](../90-agent/todo/brief-7.md)；檔案晚到也不會出錯，只是這一步沒有幫上忙。
