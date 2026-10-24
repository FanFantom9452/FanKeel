---
name: fankeel-phone
description: Hand this session to the phone — when this turn ends the session waits for the next message typed on the station's phone page (/m). Use for /fankeel-phone, "交給手機", or before walking away from a session you want to keep talking to.
disable-model-invocation: true
version: 0.112.0
status: current
last_verified: 2026-10-22
source_of_truth: scripts/phone.js, lib/phone.js, hooks/stop.js
---

# fankeel-phone

`<plugin>` is two directories up from this file.

1. Run `node <plugin>/scripts/phone.js attach --session <id>`, with the id the
   fankeel block names on its `--session <id>` line. It exits 1 with a message
   when `station.remote` is off; the guide to turn it on is
   `docs/01-guide/tailscale-setup.md`.
2. Answer with its one line, nothing else.
3. End the turn. Its end is what the Stop hook holds: the next message comes
   from the phone, and a prompt typed here takes the session back.
