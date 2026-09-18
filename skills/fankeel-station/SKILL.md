---
name: fankeel-station
description: Run the station as a live server — every fankeel session on this machine on one page, served rather than read as the static file a prompt already writes. Use for /fankeel-station, "開站", or when the station has to be a server rather than a file. Reading that file, and the station's other phrases like "監控站", stay with the fankeel skill.
version: 0.72.0
status: current
last_verified: 2026-09-15
source_of_truth: scripts/station.js, docs/station.md
---

# fankeel-station

Run:

    node <plugin>/scripts/station.js serve --open

`<plugin>` is two directories up from this file. Say the URL the command
prints, and stop there — the station's routes, states and fields are
documented at [docs/station.md](../../docs/station.md), not repeated here.
