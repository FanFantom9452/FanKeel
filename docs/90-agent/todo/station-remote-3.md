---
label: station remote
title: 遠端收尾三個缺口
description: station 撤 tailscale serve 的收尾有三個缺口：off 範圍過大、enable 失敗仍標 madeServe、強制結束不收尾。
state: ready
---

來源：station 改版的 verify（scripts/station.js:979 teardownRemote、lib/tailscale.js:81 disable）。三個缺口：(a) tailscale serve --https=443 off 會清掉整個 443 listener，使用者自己掛在 443 的 handler 也一起消失；尚未查證 Tailscale 如何界定 off 的範圍，可能有按路徑的較窄 serve ... off。(b) station.remote 維持開啟時若 enable 失敗，madeServe 仍為 true，proxy 要到 close 才撤。(c) 強制結束，以及 Windows 上的 SIGTERM，完全不跑收尾（程式註解已說明）。要改成：(a) 依 Tailscale 文件記載的 off 範圍做出決定（改用較窄的 off，或明文接受整個 443 被清）；(b) enable 失敗時立即撤銷，或根本不標 madeServe，並附測試；(c) 在 docs/01-guide/station.md 記為已知限制。完成條件：(a) 已依 Tailscale 文件的範圍決定；(b) 有測試，且把 madeServe 的修正改回會變紅；(c) docs/01-guide/station.md 有此已知限制。
