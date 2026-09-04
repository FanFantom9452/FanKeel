---
status: design-intent
last_verified: 2026-09-04
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/prices.js, lib/clear.js, lib/badge.js
---

# The session station: every fankeel session on this machine, on one page

**Goal:** one page that shows every session fankeel has recorded on this
machine — live, abandoned and stood down — with what each one cost, lets the
user put an abandoned one down, and is current the moment a session ends.
TokenBar is not changed and is not required.

## The ask

Three things, in the user's words on 2026-09-04: see every session, clean
sessions up, and have a page to look at after each session ends. Server or no
server was left to this design, and it settled on **no resident server**: a
static page regenerated on `SessionEnd`, and a local server that runs only while
the user is clearing, then exits.

Two things were added by the questions that followed. `model` and cost are
recorded by fankeel itself, from the transcript, so a machine without TokenBar
sees them too. And cost is shown in dollars, from a price table that carries
its own date — the one thing in this design that goes stale on a schedule, and
it says so on the page.

## What is already here

- `lib/registry.js:160` — `readAll(root)` returns `{ entries: [{sessionId, data}], unreadable }`.
  The station calls it; nothing is re-parsed from `task.js show` text.
- `scripts/task.js:340-365` — `entryLine` builds display strings directly; no
  `--json`, no render split, and it omits `waited`. Left alone: the station is
  the second reader, not a replacement for the first.
- `scripts/task.js:848-878` — `cmdClear`: not self, valid id, entry exists,
  `active === true`, `registry.isStale` unless `--force`; writes only
  `active: false`. Moves to `lib/clear.js` so the server calls the same code.
- `lib/live.js:91-111` — `runningSessions(configDir)` reads
  `<configDir>/sessions/*.json`: `pid`, `sessionId`, `cwd`, `startedAt`,
  `status`, `name`. Liveness is `process.kill(pid, 0)`. Ten such files on this
  machine today.
- `lib/registry.js:79-95` — `findStateRoot` walks up from one directory. Nothing
  enumerates registries.
- `lib/badge.js:31-34,84-87` — `modes/<id>/fankeel` (a word) and
  `modes/<id>/fankeel.lead` (key=value lines, `LEAD_KEYS` at :76, 160 chars a
  value, pruned after 30 days by `pruneBadges` at :154). Written by
  `hooks/inject.js:106` (init), `hooks/inject.js:200` (every prompt) and
  `scripts/task.js:94` (every verb that moves the badge). Five of 122 `modes/`
  directories hold one today, dated 09-01 to 09-04.
- `hooks/inject.js:53-54` — `launchRoot` and `rootFor` are computed before the
  init lead is written, so the registry root is known at `[FANKEEL:INIT]`.
- `.claude-plugin/plugin.json` — six events, none of them `SessionEnd`. Claude Code's
  `SessionEnd` input carries `session_id`, `transcript_path`, `cwd` and
  `reason` (`clear | logout | prompt_input_exit | other`); `"async": true`
  lifts the hook timeout.
- `hooks/carry.js:1-12` — `/clear` keeps the process and takes a new session id;
  the old entry stays `active: true` and leaves the running set. That is the
  abandoned row the station has to show and `clear` exists to put down.
- The transcript: every `type: "assistant"` line carries `message.model` and
  `message.usage` (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`). No dollar figure. **One request writes
  several lines with the same usage**: this session's transcript held 76
  assistant lines for 25 `requestId`s, one of them six times with
  `output_tokens: 1061` on every copy. Summing lines over-counts threefold;
  the sum is over distinct `requestId`.
- `lib/registry.js:348` — `update` runs a mutator under the lock;
  `writeSession` at :242 serialises the record whole. New hook-written fields
  need no whitelist.
- `package.json` — no dependencies. The server is `node:http`; the page has no
  external resource.
- `.fankeel/build/<plan>/` — 59 files under eight plan directories here, keyed
  by plan file, not by session.

Checked against `.fankeel/map.md`: no page is `design-intent`; the pages this
touches are `docs/registry.md` (what is on disk, and the field table),
`docs/statusline.md` (the lead keys) and `docs/collisions.md` (liveness, reused
unchanged). No contradiction with any page marked current.

## The approach

Seven units. Each is named by what it does, and none needs the others' internals.

### 1. Discovery — `lib/badge.js` and `lib/station.js`

Where the registries are. Three sources, unioned and de-duplicated by resolved
path:

1. **Leads.** `LEAD_KEYS` gains `root`, the registry root the session runs
   under, written by all three lead writers. `readLeads(claudeDir)` lists
   `modes/*/fankeel.lead` and returns `[{ sessionId, fields }]`. TokenBar reads
   leads by key and ignores what it does not name; its PowerShell port drops a
   lead over 1024 bytes or 12 lines — today's largest is 317 bytes and seven
   lines, and a root path adds one line.
2. **Running sessions.** `runningSessions(configDir)` gives a `cwd` per live
   Claude Code process; `findStateRoot(cwd)` gives its registry, if it has one.
   This finds a session that has run `/fankeel` and nothing else yet.
3. **`--root <dir>`**, repeatable, and the directory the station itself runs
   in. For a registry whose last session is older than the 30-day lead prune.

A root whose `sessions/` no longer exists is listed on the page as gone and
skipped. Leads are pointers; the registry is the record.

### 2. Gathering — `lib/station.js`

For each root: `readAll(root)`, then `readLive` once and `isLive` per entry.
Each session becomes one row with a **state**:

| state | meaning |
|---|---|
| `live` | `active: true` and its process is running |
| `stale` | `active: true` and no process — abandoned by `/clear`, a closed terminal, or a crash |
| `down` | `active: false` |

Plus the registry's `unreadable` count, the `build/` directories with their file
counts, and `map.md`'s modification date. Rows sort by `updated`, newest first,
matching `show --all`.

### 3. Rendering — `lib/station.js`

`render(model, opts)` returns one HTML string. No script from outside, no font
from outside, no image: the page is opened from disk, possibly offline. A
short inline stylesheet, `prefers-color-scheme` for dark.

Per registry: its root, the counts, the `build/` line. Per row: started date,
state, `stage` with route dots as `●●●○○`, task, project, model, cost, burn,
clock, waited, `ended` (when and why), last updated. A row expands to claims,
notes, `next`, and the session id. Cost shows the price-table date beside it —
`$1.84 (prices 2026-09-04)` — and tokens only for a model the table lacks.

`opts.serve` decides the clear control: on a static page a `stale` row shows
the `task.js clear` command to copy; under the server it is a button.

### 4. The station command — `scripts/station.js`

```
node <plugin>/scripts/station.js [--root <dir>]... [--open]
node <plugin>/scripts/station.js serve [--port <n>] [--root <dir>]... [--open]
```

The first form writes `<configDir>/fankeel/station.html` and prints its path;
`--open` hands it to the OS (`start` on Windows, `open` on macOS, `xdg-open`
elsewhere). The second binds `127.0.0.1` on an ephemeral port unless `--port`,
prints the URL, serves `GET /` by gathering and rendering afresh on every
request, and `POST /clear` with `root`, `id`, `force` and a per-run nonce in
the form. A missing or wrong nonce is `403`. It exits after ten minutes with no
request, and on Ctrl+C. Nothing else is ever started for the user.

`<configDir>` is `liveConfigDir()`, so `CLAUDE_CONFIG_DIR` moves it with
everything else.

### 5. Clearing — `lib/clear.js`

`clearEntry(root, targetId, { callerId, force, now })` holds exactly the checks
`cmdClear` makes today and returns `{ ok, reason }`. `task.js clear` calls it
and prints as before; the server calls it and redirects to `/`. It writes
`active: false` and nothing else. `clearEntry` judges age, as `cmdClear` does
today; it does not judge liveness, and the CLI keeps that. The server judges
both: it has just gathered the row's state, so a `POST /clear` naming a `live`
row is answered `409` before `clearEntry` is called, and the page never draws
the button on one. `force` is for a `stale` row younger than `isStale` allows,
which is the same rule the CLI has.

### 6. Session end — `hooks/leave.js`, `lib/usage.js`

`SessionEnd`, `"async": true`, no matcher. It reads the payload, finds the
registry from `cwd` the way `inject.js` does, and if this session owns an entry
there, `update`s it with:

```json
{
  "ended": { "at": "2026-09-04T09:12:00.000Z", "reason": "clear" },
  "model": "claude-fable-5-1",
  "usage": {
    "requests": 25,
    "models": {
      "claude-fable-5-1": { "input": 812, "output": 41880, "cacheRead": 3102344, "cacheWrite5m": 1220, "cacheWrite1h": 60000 }
    }
  }
}
```

`usage` comes from `lib/usage.js`: read the transcript whole, keep one
`message.usage` per `requestId` (the last line wins), sum the five counts per
`message.model` — cache writes arrive split by TTL under `cache_creation`, and
the two TTLs are priced differently — and name `model` as the one with the
most output tokens. A transcript that cannot be read leaves the fields absent
rather than zero.

Then it regenerates `station.html`, whether or not there was an entry. It never
touches `active`, `claims`, `updated`, `stage` or `guard`: a session ending is
not the user standing a task down, which is invariant 2, and `ended` on a row
that is still `active: true` is exactly what makes a `stale` row explain
itself.

Once per session id, because `/clear` takes a new id. This hook and
`hooks/carry.js` are the two ends of the same event: this one records that the
old id ended, and that one offers the new id its task.

### 7. Prices — `lib/prices.js`

```js
module.exports = {
  verified: 'YYYY-MM-DD',
  perMillion: {
    '<model id>': { input, output, cacheRead, cacheWrite5m, cacheWrite1h }
  }
};
```

Dollars per million tokens, five rates per model id — input, output, cache
read, and cache write at each of the two TTLs — and one `verified` date
for the whole table. The build fills one row per model id that appears in this
machine's transcripts — `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`
and `claude-haiku-4-5-20251001` today — from Anthropic's published pricing
read at build, not from memory, and sets `verified` to the day it was read.
The page prints that date next to every figure. A model absent from the table
shows its tokens and no dollar sign.

### Data flow

```
transcript ──(SessionEnd)──▶ leave.js ──update──▶ sessions/<id>.json ──┐
                                   │                                    │
                                   └──────────▶ station.js ◀── readLeads, runningSessions, --root
                                                     │
                                          render ──▶ station.html   or   127.0.0.1:<port>
                                                                              │
                                                                   POST /clear ──▶ clear.js ──▶ active:false
```

### Error handling

Every reader degrades to a count or a label, never to an exception: a registry
that is gone is listed as gone; an entry that does not parse is in
`unreadable`; a transcript that cannot be read leaves `usage` absent; a config
dir that cannot be read makes every claim `live`, as `docs/collisions.md`
already says. `leave.js` catches everything and exits 0 — a hook that fails at
session end has nobody to tell.

### Testing

`node --test`, no network, ephemeral ports.

- `tests/usage.test.js` — a five-line transcript with two `requestId`s, one of
  them three times: the sum counts it once; two models: `model` is the larger.
- `tests/leave.test.js` — the hook as a subprocess with a real payload, the way
  `tests/contract.test.js` runs the others: the entry gains `ended`, `model`,
  `usage`; `active` is still `true`; `station.html` exists afterwards.
- `tests/station.test.js` — two temp registries found through two leads, one
  running-session file whose `pid` is `process.pid`: `render` names both tasks,
  marks the running one `live`; `POST /clear` on a `stale` row writes
  `active: false`, on a `live` row returns `409`, without the nonce `403`.
- `tests/clear.test.js` — `clearEntry` refuses self, refuses a fresh row
  without `force`, and `task.js clear` prints what it printed before.
- `tests/badge.test.js` — `root` round-trips through `writeLead`/`readLeads`.

`tests/contract.test.js` pins the hook count; it moves from seven to eight.

## Rejected

- **A resident server started at `[FANKEEL:INIT]`.** Whether a hook's child
  outlives the hook is undocumented; N sessions would contend for one port and
  none of them owns it; every `/fankeel` would have to check for it; and the
  live view it would add is what TokenBar already shows for the session in
  front of the user.
- **A snapshot written by TokenBar** (`modes/<id>/tokenbar` with model and
  cost). It would be the only data the station could not get without TokenBar
  installed. The transcript has the model and the tokens; only the price is
  missing, and a price table is smaller than a dependency.
- **A separate registries index** (`<configDir>/fankeel/registries`, appended by
  `task.js start`). No 30-day window, but a new file with its own lifecycle,
  where the lead already exists, is already per session, and is already
  pruned on a rule someone wrote down.
- **Tokens only, no dollars.** Asked for and declined: the user wants a figure,
  and a dated one is honest.

## What deliberately does not change

- TokenBar: not a line. It keeps reading `word`, `step`, `steps`, `others` and
  ignores `root`.
- `active`: still set to `false` by `down` and `clear` only, both on the user's
  say-so. `leave.js` records an end; it does not stand anything down.
- `task.js show` and `show --all`: unchanged. The station is a second reader.
- The six invariants in `skills/fankeel/SKILL.md`. The hook writes its own
  session's file (1), never sets `active: false` (2), never touches `updated`
  or `claims` (3), deletes nothing (4), moves no stage (5), sets no guard (6).
- `.fankeel/build/`: listed, not managed. Nothing here deletes a ledger.

## Unverified

Whether a `SessionEnd` hook marked `async` gets to read a 13 MB transcript
before the process is gone. The documentation says `async` lifts the timeout
and says nothing about the process exiting under it. Measured first at build,
with a transcript of that size, before anything depends on it; if it cannot,
`leave.js` reads a tail the way `lib/context.js` does and records what it saw.
