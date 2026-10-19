---
feature: station
kind: page
src: [scripts/station.js, lib/station.js, lib/serve.js, lib/detail.js, assets/station/**]
last_checked: 2026-10-19
status: clean
---

# station

Every fankeel session on this machine, shown on one page. The page is served from 127.0.0.1 or written as a static file. This repository has no `.fankeel/render.json`, so this file declares the page's `src` itself instead of using `render:`.

## Sub-features

- The page lists every session of every registry the station knows: the full list is at the `#/sessions` route, the dashboard shows the five most recent, and the footer count `<n> sessions` totals them. Each row opens a detail panel, served as `/station/detail/<sessionId>.js`.
- The POST routes behind the page's buttons: `/clear`, `/clear-stale`, `/todo`, `/answer`, `/profile`. Each one needs the per-run nonce the page carries.
- Doc search (`/station/search`) and the conversation view (`/station/talk/<sessionId>`).
- The tour, `/station/tour.html`, served from `assets/station/` with the scripts it loads.
- `/station/health`: read-only, answers `station`, `pid`, `started` and `fingerprint`.
- `/chartroom/<name>/`: only when the profile sets `station.chartroom`, and a 404 otherwise.
- The static form: run with no verb, it writes `<configDir>/fankeel/index.html` and, when it makes one, a copy whose path its `copy at` line names.
- `--json`: the rows as one JSON line, for a script rather than a page.

## Reach

- For a verify run, isolate it. Set `CLAUDE_CONFIG_DIR` to a fresh temporary directory, then run `node scripts/station.js serve --port 0 --root <repo>`. It prints `fankeel station — <url>  (Ctrl+C to exit)`. `--port 0` takes an ephemeral port, so nothing else on the machine is in the way, and nothing joins the user's own station.
- The user's own station: `node scripts/station.js serve --detach`. If the station named in `<configDir>/fankeel/serve.json` answers, this joins it; otherwise it starts a new one. The default port is 28888.
- The static form: `node scripts/station.js` prints the path of the `index.html` it wrote.

## Drive

1. With the same `CLAUDE_CONFIG_DIR`, run `node scripts/station.js --json --root <repo>` and count the sessions under `registries[].sessions`.
2. Start the server as under Reach. Read the url from its first line; never assume 28888.
3. `node scripts/render.js <url> --out .fankeel/build/task-<started>/verify/station/` writes `render.png` and `render.html`. The footer `#nreg` in `render.html` reads `<registries> 個 registry · <n> sessions`, and `<n>` equals the count from step 1.
4. GET `<url>station/health` answers 200 with `station: true` and the `pid` recorded in `<configDir>/fankeel/serve.json`.
5. Take one row's `sessionId` from step 1. GET `<url>station/detail/<sessionId>.js` answers 200; a 404 `no detail for that session` means that session has no detail to read, so pick another row.
6. POST `<url>clear` with no nonce answers 403 `wrong nonce`: the guard holds.
7. Run the same `serve` command again with the same `CLAUDE_CONFIG_DIR`. It prints the first server's url and binds no port of its own: this is the join.
8. GET `<url>station/tour.html` answers 200.
9. Cleanup: kill the pid recorded in `serve.json`, then delete the temporary config directory. Keep the evidence from step 3.

## Gotchas

- A running station serves the code it started with: `lib/station.js` and `assets/station/station.js` are required once, at startup. A `serve` against a config directory whose station is alive joins that station, so an edit stays invisible until the station stops. The isolated `CLAUDE_CONFIG_DIR` under Reach is what keeps you from driving old code. On a `/fankeel` prompt, `ensureServe` in `lib/serve.js` replaces a stale station by comparing `fingerprint`; a hand-typed `serve` does not.
- When another program holds port 28888, the default falls back to an ephemeral port and retries 28888 every 30 seconds. It keeps both listeners open, and `serve.json` names whichever one is current. Read the url from `serve.json` or from the printed line.
- A killed station leaves `serve.json` behind. The next `serve` asks `/station/health` and removes the stale record, so a record on its own does not prove a station is up.
- Do not use the static form in an isolated config directory. Its first run there, with no `roots.json`, scans every drive under a time budget and finds the user's real projects. `serve` and `--json` with `--root` do not need it.
- The static form writes into `<configDir>/fankeel/`, and its copy (the `copy at` line) lands elsewhere. That changes files a test or a screenshot may compare against.
- `scripts/render.js` tries `FANKEEL_BROWSER` first. On a Windows machine where Edge fails, set it to Chrome's full path.

## Doctor

If any of these checks fails, skip the drive and write a `blocked` row:

- `node scripts/station.js --json --root <repo>` exits 0 and its `registries` list holds at least one session. An empty table proves nothing.
- The isolated `serve` prints a `fankeel station — ` line within five seconds.
- `node scripts/render.js <url> --out <dir>` exits 0. If no browser is found, only step 3 is blocked; the HTTP steps still run.
