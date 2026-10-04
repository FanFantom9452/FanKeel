---
label: cleanup
title: cleanup-1 剩下的四項可刪項
description: fetchHealth 改用 fetch、profile.js 的 git、detail.js 的 readText、三支 script 的 readFile；後三項刪了會位移多處行號引用
state: ready
---

來源：cleanup-1 在 2026-10-04 的 TODO 全表盤點 build 裡只做了不會大量位移引用的項目，這四項留下。要做：一、lib/serve.js 的 fetchHealth 與 scripts/security-local.js 的 post 改用全域 fetch 加 AbortSignal.timeout，先驗證 keep-alive 不會拖住短命的 hook 行程（hooks/inject.js 會呼叫 fetchHealth），驗不過就不做。二、lib/profile.js 的 git 輔助函式改用 lib/blame.js 匯出的 git；刪掉會位移 docs/01-guide/profile.md 與 docs/90-agent/reference/subagents.md 以行號引用 profile.js 的位置，要一併改。三、lib/detail.js 的 readText 改用 lib/json.js 的 readText；會位移 registry.md、station.md、lib/spend.js、lib/usage.js 與 tests/usage-peak.test.js 引用的 detail.js 行號。四、scripts/memory-check.js、scripts/input-check.js 與 scripts/docs-check.js 的 readFile 改用 readText；後兩支的行號被 documents.md、skills-check.js、docs-audit.js 與 docs.test.js 引用。完成條件：全套測試綠、淨減行數、被位移的行號引用都改對，每項動手前先重新核對引用仍成立。
