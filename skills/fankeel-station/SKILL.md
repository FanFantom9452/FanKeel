---
name: fankeel-station
description: Open the station as a live page — every fankeel session on this machine, on one page, with a server behind it instead of the static file a session end already writes. Use for /fankeel-station, "開站", "monitor station", "open the station", or when the station needs to run as a server rather than be read as the static file.
version: 0.67.0
status: current
last_verified: 2026-09-15
source_of_truth: scripts/station.js
---

# fankeel-station

Run:

    node <plugin>/scripts/station.js serve --open

`<plugin>` is two directories up from this file. Say the URL the command
prints, and stop there — the station's routes, states and fields are
documented at [docs/station.md](../../docs/station.md), not repeated here.
