---
label: station remote
title: 遠端關掉要撤 serve
description: tailscale serve is never turned off when the station exits or remote is switched off.
state: ready
---

Found by the whole-branch review of the station-remote build (lib/tailscale.js, scripts/station.js refreshRemote). tailscale serve --bg is run once at listen with an ephemeral port (opts.port || 0) and is never turned off, so after the station exits the tailnet name still proxies to 127.0.0.1:<port> and any local service that later binds that port is reachable by every tailnet peer. Low severity. It should become a teardown (serve off) on station shutdown and when station.remote is written off. Done when a test shows serve off is run on both paths and the tailnet name stops answering.
