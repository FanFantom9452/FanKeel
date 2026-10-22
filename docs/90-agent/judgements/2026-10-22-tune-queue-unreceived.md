---
judged: 2026-10-22T14:04:02.335Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 6bedeb94-1482-4af2-8d8f-049b6d29c923
stage: build
---

# Brief: tune requests the session never receives

## Question

# Brief: tune requests the session never receives

## Question

The tune view (`scripts/tune.js serve`, port 7819, page `.fankeel/build/2026-10-21-station-redesign/route-docs.html`) shows the user's requests sitting in its queue, but the main session never receives them. Why — is it the build stage's controller/gate rules, or something else — and how should the tuning workflow be designed so a request the user submits always reaches someone who acts on it?

## Options to weigh

- A. The session itself runs `tune.js wait` in the background (Bash `run_in_background`) for the whole time a tuning loop is open, and on each request dispatches one `fankeel:fankeel-mockup` for that one block, then `tune.js done <id>`.
- B. The `fankeel-mockup` agent owns the loop: it keeps a background `wait` running and handles requests itself; the session only relays.
- C. The tune server pushes a notification the session already listens for (e.g. through hooks — the Stop hook, `await.js`, or the phone channel in `lib/phone.js`), so a request wakes an idle session.
- D. Something else the evidence points to.

## Background (facts observed 2026-10-22, this session)

- `curl http://127.0.0.1:7819/__live/queue` returned `{"pending":3,"editing":[{"id":"r-0037","block":"mast","round":2},{"id":"r-0049","block":"mast","round":8}]}`.
- The tune page's panel showed 「修改項 0 則待送」, 「佇列 3」 and 「全部送出（0 則）」 together.
- `scripts/tune.js:8-9`: `wait` blocks until the next request and prints it; `done <id>` settles it. `:132-136`: `editing` = requests `wait` handed out and `done` never settled. `:29-30`: default wait timeout one hour.
- The tune server was started by a `fankeel:fankeel-mockup` subagent this session dispatched to retune one block (`docs-health`). That agent finished its edits and stopped with "background work of its own still running"; nothing in the main session runs `tune.js wait`.
- The main session is the build-stage controller: `hooks/guard.js` refuses controller writes on a controlled stage; the Stop hook (`lib/stop.js`, `hooks/stop.js`) nudges a controller that ends a turn with nothing in the background to wake it. `scripts/await.js` is how the controller waits for stage agents.
- The `editing` ring that keeps glowing on tuned blocks is TODO tune-7 (`docs/90-agent/todo/tune-7.md`, `assets/tune/overlay.js:748-754`).
- Mockup tuning rules live in `agents/fankeel-mockup.md` and `skills/fankeel-design/SKILL.md` (and `design-guide.md` beside it).

## Paths to read

- scripts/tune.js (wait, done, serve's queue and request routes)
- assets/tune/overlay.js (how the page submits, what 「佇列」 and 「待送」 count)
- agents/fankeel-mockup.md
- skills/fankeel-design/SKILL.md (its tuning-loop section)
- scripts/await.js, lib/stop.js, hooks/stop.js, hooks/guard.js
- docs/90-agent/todo/tune-6.md, docs/90-agent/todo/tune-7.md

## What counts as an answer

A root cause grounded in path:line (who is supposed to be waiting, and why nobody is), whether the gate/controller rules play any part, and one recommended workflow design with what changes where (file and rule), plus how the three pending and two stale editing requests should be cleared now.

## Answer shape

The six fields your agent file defines (`pick:` first), then `## Summary`.

## Answer

pick: A — the session arms `tune.js wait` with `run_in_background: true` for as long as the loop is open, dispatches one `fankeel:fankeel-mockup` per request, runs `done <id>`, re-arms; plus a `tune.js drop <id>` command and a tune-queue line in the Stop-hook nudge as the safety net.
why: Nobody is assigned to wait: SKILL.md:144-151 puts wait/dispatch/done on the session as a bare "Then loop:" with no background rule, no end, no timeout handling; agents/fankeel-mockup.md:73-74,84-85 has the agent start `serve`, leave it running, and never run `wait`. This session retuned `docs-health` by direct dispatch, so r-0063 (queued 13:48) was never taken.
Gate/controller rules play no part: hooks/guard.js:114,150 refuse only the controller's Edit/Write and writing Bash; `node tune.js wait|done` matches nothing in lib/guard.js:378-384 and the Agent check at guard.js:169-171 names only fankeel-brain. The Stop hook reads only the transcript (lib/stop.js:26) and nudges "dispatch or ask the gate" (lib/stop.js:100-102), knowing nothing of the queue.
Option A fits the machinery that exists: lib/stop.js:76 counts a background Bash as pending work, so an armed `wait` lets the turn end and its exit (request printed, or exit 3 after 3600s at tune.js:238) wakes the session — the same pattern scripts/await.js:4-10 uses. B contradicts fankeel-mockup.md:14,53-55 (one block per dispatch) and is what orphaned the server here; C needs new push code in tune.js and hooks/stop.js for a wake A already gets.
「佇列 3」 is 1 real + 2 stale: tune.js:131 counts queued+taken; r-0037 (2026-10-01-station-layout/mockup.html, taken 10-10) and r-0049 (2026-10-21-bg-shells/mockup.html, taken 10-21) were handed out in earlier sessions and never settled; queue.jsonl is append-only with only serve/wait/done (tune.js:464-467). Their pages are byte-identical to their before.html, so `done` settles each with no file rewritten.
would flip if: a background Bash's exit did not produce a `<task-notification>` the session sees (then only C wakes an idle session); or lib/guard.js `writesFiles` flagged `node tune.js done` (then the controller could not settle, and B or a brain-run loop would be forced).
unread: nothing
delegated: F:/ymlab/fankeel/scripts/tune.js (opus); F:/ymlab/fankeel/assets/tune/overlay.js (opus); F:/ymlab/fankeel/agents/fankeel-mockup.md (opus); F:/ymlab/fankeel/skills/fankeel-design/SKILL.md (opus); F:/ymlab/fankeel/skills/fankeel-design/design-guide.md (opus); F:/ymlab/fankeel/scripts/await.js (sonnet); F:/ymlab/fankeel/lib/stop.js (sonnet); F:/ymlab/fankeel/hooks/stop.js (sonnet); F:/ymlab/fankeel/hooks/guard.js (sonnet); F:/ymlab/fankeel/docs/90-agent/todo/tune-6.md (sonnet); F:/ymlab/fankeel/docs/90-agent/todo/tune-7.md (sonnet)
checklist: 1 scripts/tune.js who runs wait / queue counts / settle paths — answered; 2 assets/tune/overlay.js what 佇列 and 待送 count, ring keys — answered; 3 agents/fankeel-mockup.md does the agent wait — answered; 4 skills/fankeel-design/SKILL.md (+design-guide.md) loop ownership — answered; 5 scripts/await.js what it waits on — answered; 6 lib/stop.js + hooks/stop.js background Bash treatment — answered; 7 hooks/guard.js controller refusals — answered; 8 tune-6.md / tune-7.md — answered

## Summary

### Root cause: the loop has an owner on paper and no trigger in practice

Reader B (opus) found the only place the tuning loop is defined, `F:/ymlab/fankeel/skills/fankeel-design/SKILL.md:144-151`, and my spot-check confirms it word for word: "Then loop: `node <plugin>/scripts/tune.js wait` prints the next request as JSON ... dispatch one `subagent_type: fankeel:fankeel-mockup` ... then `node <plugin>/scripts/tune.js done <id>`". The session is the waiter. The skill says nothing about running `wait` in the background, nothing about what to do when `wait` times out, and nothing about when the loop ends (reader B grepped "background" and "timeout": no hits; I read :132-161 and found none either).

`F:/ymlab/fankeel/agents/fankeel-mockup.md:73-74` tells the mockup agent to run `tune.js serve` "in the background" for its served check, and `:84-85` says "Leave the server running — the url you return is the one the user opens." It is never told to run `wait` (reader B, confirmed by my read of :70-93), and `:14` and `:53-55` define it as one block per dispatch. So the agent that started port 7819 this session was never a waiter, and when it returned with "background work of its own still running" that background work was the server, not a `wait`.

In this session the main session dispatched a mockup agent to retune `docs-health` directly, bypassing the queue. The user then submitted r-0063 for `docs-health` on `route-docs.html` at 2026-10-22T13:48 (queue.jsonl, last line). No `wait` was running, so it sits `queued`.

`F:/ymlab/fankeel/scripts/tune.js:8` (reader A) is the only text about `wait` and says only "block until the next request; print it as JSON". Who runs it is not in the file. `:29-31` sets `WAIT_TIMEOUT_SEC = 3600`; `:238` (spot-checked) is `if (Date.now() >= until) die('no request in ' + timeoutSec + 's', 3);`. `:221-241`: `wait` polls every 500 ms, takes the first `queued` row, copies the page to `<id>.before.html` (`:228`), appends `taken` (`:229`), prints the job and exits. A row that `wait` hands out stays `taken` forever unless `done` runs; nothing re-queues it.

### The gate and controller rules play no part

Reader C (sonnet) read `F:/ymlab/fankeel/hooks/guard.js`; I spot-checked `:110-159`. On a controlled stage the controller (main thread, `!payload.agent_id`) is refused Edit/Write/NotebookEdit outside `.fankeel/build/ask/` (`:150-159`) and Bash that `writesFiles(command)` flags (`:114-123`). `lib/guard.js:378-384` (my grep) flags redirects, `tee`, `rm|mv|cp`, `sed -i`, writing git verbs, PowerShell item cmdlets, and `node -e`/python writes. `node <plugin>/scripts/tune.js wait` and `node <plugin>/scripts/tune.js done r-0063` match none of these, so the controller may run them. The Agent tool is checked only for `fankeel-brain` (`guard.js:169-171`, reader C); dispatching `fankeel-mockup` passes. The controller is therefore fully able to run the loop as SKILL.md writes it; the rules did not stop it.

The Stop hook (`F:/ymlab/fankeel/lib/stop.js:95-103`, spot-checked) refuses a stop only when the stage is open, the user is not away, and `pendingWork` is false; its text is "dispatch it (then run await.js in the background), or ask the stage's gate". It reads only the transcript (`lib/stop.js:26`, reader C) — no file or URL a tune server could write. `hooks/stop.js:66-67` holds for phone messages only. So an idle session with a queued tune request gets no wake from any hook today.

### Why Option A, and why not B or C

`F:/ymlab/fankeel/lib/stop.js:76` (spot-checked): `if ((b.name === 'Bash' || b.name === 'PowerShell') && input.run_in_background === true) launched.set(b.id, when);` and `:89` `return launched.size > 0 || sentAt > notifiedAt;`. A background `tune.js wait` is pending work: the session can end its turn without a nudge, and when `wait` exits — printing the request, or exit 3 after 3600 s — the task-notification wakes the session and `:83` clears the launched id. `:88` drops launches older than `STALE_MS` (60 min), which matches `wait`'s 3600 s default, so a timed-out `wait` and the nudge re-arm together. This is exactly the pattern `F:/ymlab/fankeel/scripts/await.js:4-10` (reader C) documents for stage agents: "The controller runs it with Bash `run_in_background` after every dispatch ... and ends its turn: this script exiting is what hands the turn back." Option A needs no new code to work; it needs the skill to say it.

Option B puts the loop in the mockup agent. That contradicts `fankeel-mockup.md:14` and `:53-55` (one block per dispatch, rejected edits "come back to you" from the session's `done`), would keep an opus agent idle for up to an hour per request, and is the failure mode already seen: a subagent's background process outlives or orphans when it returns. Reject.

Option C (server pushes into hooks/phone) would need new code in `tune.js` (today a request only appends to queue.jsonl at `:198` and broadcasts SSE at `:200`, reader A) and in `hooks/stop.js`, and the Stop hook only runs when a turn ends, so it still cannot wake a session that is mid-wait on the user. A gets the wake from the Bash notification. The one piece of C worth keeping is a queue line in the Stop-hook nudge (below).

### Recommended design: what changes where

1. `F:/ymlab/fankeel/skills/fankeel-design/SKILL.md:144-152` — rewrite the loop as an explicit protocol: after giving the user the url, run `node <plugin>/scripts/tune.js wait` with `run_in_background: true` and end the turn. When its notification arrives: parse the JSON; dispatch one `fankeel:fankeel-mockup` for its `items` (foreground, or background with `await.js`); run `node <plugin>/scripts/tune.js done <id>`; re-arm `wait` in the background at once and end the turn. On exit 3 (timeout) ask the user whether the page is still being tuned; re-arm if yes. The loop closes when the user says so or the gate is asked; the server stays up (`fankeel-mockup.md:84-85`) but `wait` is not re-armed. Add: a block-change the user asks for in chat while a loop is open is still taken through `wait` (check `/__live/queue` first), never by a direct dispatch that leaves a queued row behind.
2. `F:/ymlab/fankeel/agents/fankeel-mockup.md` Return section (`:87-92`) — add one line: the agent never runs `tune.js wait` and never calls `done`; both belong to the session that dispatched it. (Makes the ownership explicit where the agent reads it.)
3. `F:/ymlab/fankeel/scripts/tune.js:464-467` — add `drop <id>`: settles a `taken` row as `dropped` (through `settle` at `:350-363`, a new status) without reading `before.html` or touching the page. Today `done` is the only settle path (`:368` refuses non-`taken`) and in static mode `:376` `fs.writeFileSync(r.file, before)` rewrites the page whenever anything outside the block changed — a destructive way to clear a stale row from a page that has moved on. `/__live/queue` at `:131` should then count `pending` as `queued` only and report `taken` separately, so 「佇列 N」 means requests nobody has taken.
4. `F:/ymlab/fankeel/lib/stop.js:95-103` (`refusal`) — when `.fankeel/build/tune/serve.json` exists and queue.jsonl has a `queued` row with no background `wait` in `launched`, add to the nudge: "tune queue has N request(s) and nothing is waiting on it — run `tune.js wait` in the background." This is the safety net for a session that forgets rule 1.
5. `F:/ymlab/fankeel/assets/tune/overlay.js:746-747` and `scripts/tune.js:134-135` — the ring code keys on `job.blocks || [job.block]` only; the server's `editing` carries no `page`. `route-docs.html` has one `data-block="mast"`, so r-0037 and r-0049 (both `mast`, both other pages) glow on it. Send `page` in `editing` and have the overlay skip jobs whose `page` is not the current one. This is the mechanism TODO tune-7 (`docs/90-agent/todo/tune-7.md:9`) asked for and did not name; tune-6 is unrelated (dynamic elements not pickable).

### Clearing the queue now

- r-0063 (`queued`, `docs-health`, `route-docs.html`): run `node <plugin>/scripts/tune.js wait` (it returns at once since a queued row exists), read its `items`, dispatch one `fankeel:fankeel-mockup` for them (if the earlier direct retune already did what the note asks, the agent changes nothing), then `node <plugin>/scripts/tune.js done r-0063`. `done` compares the `before.html` taken at this `wait` with the page now, so an unchanged page settles clean.
- r-0037 and r-0049 (`taken`): I compared each page with its `before.html` with `cmp`: both byte-identical (181239 and 56437 bytes), neither tracked by git. `node <plugin>/scripts/tune.js done r-0037` and `done r-0049` therefore settle each as `done` with `touched: []` and rewrite nothing (`:371-379`). Run them before `wait` so they do not confuse the round count. After that `/__live/queue` reports `pending: 0, editing: []` and the rings on route-docs clear on the next 2 s poll (`overlay.js:757`).
- Then arm `tune.js wait` in the background per rule 1 before ending the turn.

### Spot-checks

Every cited span said what its reader said: `tune.js:131,134-136` (pending = queued+taken, editing = taken without page), `:238` (exit 3 on timeout), `:365-379` (done refuses non-taken; static rejection rewrites the file), `SKILL.md:144-152`, `fankeel-mockup.md:73-74,84-85,89-92`, `lib/stop.js:76,88-89,95-103`, `guard.js:114-125,150-159`, `overlay.js:739-757`, `tune-7.md:9`. Two things no reader could settle I checked myself: `lib/guard.js:378-384` (`writesFiles` does not flag `node tune.js wait|done`), and the two stale pages versus their snapshots (identical). Not checked: whether Claude Code delivers a `<task-notification>` for a background Bash that exits with code 3 the same way it does for exit 0 — `lib/stop.js:80` drops a launch on `is_error` tool results, which is the dispatch-time error, not the exit; if a non-zero exit were swallowed, rule 4 (the Stop-hook queue line) is what still wakes the session.

Context filed: seven facts added to `F:/ymlab/fankeel/.fankeel/build/task-20261022T113839/context.md` (entries 6-12) for session 6bedeb94-1482-4af2-8d8f-049b6d29c923.
