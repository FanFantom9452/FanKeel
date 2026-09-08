---
status: design-intent
last_verified: 2026-09-08
---

# A station you start once, and the Ready backlog

**Goal:** `station.js serve` becomes something you run once and forget — a fixed
port, no idle exit, a second start that joins the first — and `.fankeel/` reads
as `.gitignore`, `docs.json`, `index.html`, `map.md` with the page's parts in a
`station/` subdirectory. The fifteen `## Ready` entries ride along, because each
is a one-file change that needs no design of its own.

**Approach:** the station is already a shell plus a data file — that landed on
2026-09-08 — so nothing here rebuilds the page. Three defaults change, one
constant grows a directory segment, and the parts that were always meant to be
buttons get their buttons.

**Two subsystems, one design.** The station work and the Ready backlog share no
file and settle no common question. They are in one cycle because the user chose
that over splitting when both were on screen at the survey gate. The plan groups
them apart.

## What the survey found, and what it changes

| | |
|---|---|
| `scripts/station.js:192` `serve()` | already answers `GET /`, `/station-data.js`, `/station.css`, `/station.js` and `POST /clear`, `/clear-stale` |
| `scripts/station.js:38` | `port: 0, idleMs: 10 * 60e3` — an ephemeral port and a ten-minute idle exit |
| `hooks/inject.js:71` | `station.write()` on every prompt; measured 126, 126, 129 ms |
| `lib/station.js:420` | `EMITTED` is the single list of the four emitted names |
| `assets/station/station.js:623` | `clearControl` wires one row to `/clear`; nothing posts to `/clear-stale` |

So "make it a server you start once" is three defaults, not a subsystem. The
routes are there; what is missing is that the process goes away and the URL is
different every time.

## 1. `serve` starts once and stays

- **The default port is fixed at `7817`** rather than `0`. The number is
  arbitrary and loopback-only; `--port` still overrides it. When the port is
  taken, `serve` falls back to an ephemeral one rather than failing, and records
  which it got.
- **`idleMs` defaults to `0`, meaning never exit.** `--idle <minutes>` still asks
  for the old behaviour. Today's ten-minute default is what makes the URL a
  thing you re-create; nothing else about the timer changes.
- **`<configDir>/fankeel/serve.json` records `{ pid, port, url, started }`.**
  It is written when the listener binds and removed when the server closes.
- **A second `serve` joins the first.** It reads `serve.json`, checks the pid the
  way `lib/live.js` already checks a session's, and when that process is alive it
  prints the recorded URL, honours `--open`, and exits 0 without binding.
- **`--detach` runs it as a background process** — `child_process.spawn` with
  `detached: true`, `stdio: 'ignore'` and `unref()`, zero dependencies — so
  closing the terminal does not take the station with it. Without the flag
  `serve` stays in the foreground exactly as it does today.

## 2. `.fankeel/` reads as four names and three directories

- **`EMITTED` becomes `['index.html', 'station/station.css', 'station/station.js',
  'station/station-data.js']`** — one constant, still the single source, now
  carrying a directory segment. `write()` creates `station/` when it is missing.
- **`stationPath(configDir)` returns `<configDir>/fankeel/index.html`.** Every
  path that reaches a session flows from here, including the `station:` line in
  the injected block, so the rename needs no second edit.
- **`assets/station/station.html` is renamed `assets/station/index.html`** and its
  three references become `station/…`. The shell stays byte-copied.
- **`ensureIgnored(root, EMITTED)` is given `['index.html', 'station/']`** — two
  entries in place of four. Existing `.fankeel/.gitignore` files keep their four
  station lines; `ensureIgnored` only appends, so nothing is rewritten and a
  stale line ignores a file that no longer exists.
- **`serve`'s three GET routes read from `station/`**, and `GET /` keeps its path.
  The URL surface does not change; only where the bytes come from does.

## 3. The bulk clear gets its button

- **Each registry card carries a `clear N stale` form posting to `/clear-stale`**
  when `S.serve` is true, beside the per-row control `clearControl` already
  builds. Offline it prints the copyable command, as the per-row one does.
- **The nonce the route already requires travels in a hidden field**, from the
  same `S.nonce` the per-row form uses. The route is untouched.

## 4. Two plan pages say they were never built

- **`docs/plans/2026-09-08-station-shell.md:2` and `-design.md:2` flip from
  `design-intent` to `current`.** The ledger records six tasks complete and
  twelve commits landed; `.fankeel/map.md` reports both as "planned, not built",
  which is the one state the survey stage is told to read first.
- **The precedent is this repository's own, from the same day.** `af05431 docs:
  the eval design and plan are current, not intent` did exactly this to the
  behaviour-eval pair. Archiving is the other convention, and it does not apply
  yet: `docs-audit` requires three days untouched before it calls a plan landed,
  which is why these two are absent from its list of nine.
- Only the frontmatter line moves, then `grep` confirms no sentence on either
  page was quoting its own status — a split-and-join on `status: design-intent`
  has previously rewritten a sentence that merely quoted it.

## 5. The Ready backlog

Fifteen entries, each already specified by its own bullet and each touching one
or two files. They are listed in the plan's file table rather than designed here;
nothing in them changes an interface. Three overlap this design's own files —
the `clear N stale` button (§3), the `burn` negative clamp and the nav label
collision — and are folded into the sections above or into the same task, so no
two tasks own one file.

## Success criterion

**Fails now, passes after:** a test that calls `serve()` twice against one
`configDir` and asserts the second resolves to the first's `url` while
`server.address()` was never called a second time, and that `serve.json` holds
one pid. Today both calls bind, on two different ephemeral ports, and no
`serve.json` exists.

**And one row on the artefact:** the stale count printed in the served page's top
bar equals the number of rows `station-data.js` marks stale — read out of the
rendered DOM, not recomputed from the model. Unit tests all passed on 2026-09-06
while a cost cell and the curve under it disagreed by a factor of three, because
no criterion named the page.

## Against the map

`.fankeel/map.md` lists `docs/station.md` for "Every session on this machine on
one page", `status: current`, `source_of_truth: lib/station.js,
scripts/station.js, …`. This design makes four passages false, and they are
rewritten here rather than left for a sweep:

- `docs/station.md:167-169` — "The page is four files. `station.html` is a shell"
- `docs/registry.md:36-37` — the two rows naming `station.html` and its three siblings
- `skills/fankeel/SKILL.md:25`, `:80-84`, `:516-519` — the `.gitignore` line and both tree diagrams
- `skills/fankeel/SKILL.md:608` — "`.fankeel/station.html` in the registry is the copy beside you"

`tests/station-doc.test.js:16` asserts every flag the CLI parses appears in
`docs/station.md`, so `--detach` reddens that test until the page is written. That
is the guard, not a chore.

Nothing else the map lists as current is touched: the registry format, liveness,
the clear routes' behaviour, `roots.json` and the first-run scan all stay.

## Unverified

**Whether a detached Node process survives its terminal on Windows.**
`detached: true` with `unref()` and `stdio: 'ignore'` is documented to, and this
repository has no existing detach to copy — `survey.js daemon service background
always-on` matched nothing outside two prose headings. `build` measures it by
closing a terminal before `verify` accepts it.

A second, smaller one: **whether a `file://` page can load `station/station-data.js`
from a subdirectory.** Sibling loading works today and was verified by use; a
subdirectory is the same relative-path rule, and the browser driver here refuses
the `file:` protocol, so it is checked by hand at `build`.
