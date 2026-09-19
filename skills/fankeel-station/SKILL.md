---
name: fankeel-station
description: Reopen the station by hand — every fankeel session on this machine on one page, served live. `/fankeel` already starts it and names its url on the block's station line, so this is for a station that was stopped or a tab that was closed. Use for /fankeel-station, "開站", or when the station has to be a server rather than a file. Reading that file, and the station's other phrases like "監控站", stay with the fankeel skill.
version: 0.74.0
status: current
last_verified: 2026-09-19
source_of_truth: scripts/station.js, lib/serve.js, docs/station.md
---

# fankeel-station

`/fankeel` already opens the station: its hook starts `serve --open` when no
station answers and names the url on the block's `station:` line. This is for
reopening it by hand — a station that was stopped, or a tab that was closed.
Run:

    node <plugin>/scripts/station.js serve --open

`<plugin>` is two directories up from this file. A station already running is
joined rather than started twice, and the command prints its URL either way.
Say the URL the command prints, and stop there — the station's routes, states
and fields are documented at [docs/station.md](../../docs/station.md), not
repeated here.
