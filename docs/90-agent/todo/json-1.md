---
label: json
title: 收掉重複的 JSON 讀檔
description: lib/json.js 加 readObject，取代約 23 處 JSON.parse(readFileSync)（registry.js:145、agentfile.js:37、serve.js:28、station.js:63、handoff.js），net 約 -92；先逐一核對各處 fallback 值。
state: done
link: lib/registry.js
done:
  at: 2026-10-02
  sha: 6c0fa5237093adb319532ba50587885b415bcf8a
  disposition: done
---
