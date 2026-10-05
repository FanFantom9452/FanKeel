---
label: cleanup
title: cleanup-1 剩下的可刪項
description: detail.js 的 readText、三支 script 的 readFile；這幾項刪了會位移多處行號引用
state: done
done:
  at: 2026-10-05
  sha: a4c8ccfc
  disposition: done
  session: 7dd8cae1-9f94-407e-bc69-ca3f51c93296
---

來源：cleanup-1 在 2026-10-04 的 TODO 全表盤點 build 裡只做了不會大量位移引用的項目，這四項留下。要做：（fetchHealth 已在 2026-10-05 改用全域 fetch，子行程探測後自己結束的測試守著它。scripts/security-local.js 的 post 不改：全域 fetch 的 undici 預設 headersTimeout 是 300 秒，ollama 以 stream: false 生成超過五分鐘會被切斷，http.request 沒有這個上限。）三、lib/detail.js 的 readText 改用 lib/json.js 的 readText；會位移 registry.md、station.md、lib/spend.js、lib/usage.js 與 tests/usage-peak.test.js 引用的 detail.js 行號。四、scripts/memory-check.js、scripts/input-check.js 與 scripts/docs-check.js 的 readFile 改用 readText；後兩支的行號被 documents.md、skills-check.js、docs-audit.js 與 docs.test.js 引用。完成條件：全套測試綠、淨減行數、被位移的行號引用都改對，每項動手前先重新核對引用仍成立。

## 完成紀錄

detail.js 和三支檢查腳本原來各自寫了一個讀檔函式。現在它們都改用 json.js 的 readText，少了重複的程式。被推移的行號引用，包含文件、前端和另一支腳本裡的，也都改成新的行號。全套測試維持全綠。

- commit 55004a17
- commit 2ac547d5
- commit 57653b59
- commit a4c8ccfc
- commit 4023ec05
