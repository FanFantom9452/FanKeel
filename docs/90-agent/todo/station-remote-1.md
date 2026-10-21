---
label: station remote
title: 遠端關掉要撤 serve
description: tailscale serve is never turned off when the station exits or remote is switched off.
state: done
done:
  at: 2026-10-22
  sha: 17c91566
  disposition: done
  session: 47bc7b65-af5d-4f30-9dc7-02592156bd57
---

Found by the whole-branch review of the station-remote build (lib/tailscale.js, scripts/station.js refreshRemote). tailscale serve --bg is run once at listen with an ephemeral port (opts.port || 0) and is never turned off, so after the station exits the tailnet name still proxies to 127.0.0.1:<port> and any local service that later binds that port is reachable by every tailnet peer. Low severity. It should become a teardown (serve off) on station shutdown and when station.remote is written off. Done when a test shows serve off is run on both paths and the tailnet name stops answering.

## 完成紀錄

關掉遠端、關站台或閒置結束時，站台會撤掉自己開的 tailscale serve；只用模擬的 tailscale 測過，剩下的缺口另記在「遠端收尾三個缺口」。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-21-47bc7b65)

- commit 17c91566
- commit 96a43bfb
