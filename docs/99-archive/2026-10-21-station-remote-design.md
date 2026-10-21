---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/station.js, lib/remote.js, lib/tailscale.js, lib/qr.js, lib/mobile.js, lib/notify.js, lib/profile.js, hooks/gate.js, hooks/leave.js, scripts/task.js, assets/station/mobile.js, assets/station/remote-card.js
---

# Station remote: the station on a phone, through your own Tailscale, with ntfy

Approved at the design gate on 2026-10-21, in the task 「station 遠端存取討論：參考
VoiceLedger 架構，可選 Tailscale、手機版、完成通知」. The user's pick at the survey
gate was 「看答加 ntfy」: the phone reads every task's stage and what finished,
answers a waiting gate, and is told by ntfy — content leaving for a third party
was accepted with that pick.

The model is VoiceLedger's (survey,
`.fankeel/build/task-20261021T024539/survey.md`): the server keeps listening on
`127.0.0.1` only, and `tailscale serve --bg` wraps that port as an https address
inside the user's tailnet. What VoiceLedger does not have and this adds: a
trust model for writes that do not come from this machine, a phone layout, and
notifications.

Measured before the design (f51da72e): `scripts/station.js:840` listens on
`127.0.0.1`; `:432` builds the url without reading Host; every POST is guarded
by the per-run nonce (`:320`, `:479`), which only stops another origin's page —
and the nonce is in `/station/station-data.js`, which anything that can GET the
page can read. `POST /answer` (`:735`) answers a gate `hooks/gate.js` holds.
`hooks/pane.ts:334` accepts only a `http://127.0.0.1:<port>` station url.

Mockup, uncommitted: `.fankeel/build/2026-10-21-station-mobile/mockup.html` —
blocks `tabbar`, `tab-gates`, `gate-sheet`, `tab-tasks`, `tab-done`,
`pair-scan`, `pair-error`, `gates-empty`, `ntfy-preview`, `remote-on`,
`remote-off`.

## 1. Off by default, and loopback only when off

- `station.remote` is a profile key read from the machine profile, default `false`; off, the station answers only a request whose Host is `127.0.0.1`, `localhost` or `[::1]` and that carries no proxy header, and refuses anything else with 421 — today it answers any Host.
- On, a request whose Host or X-Forwarded-Host is this machine's tailnet name, or one tailscale serve rewrote to loopback with a proxy header, is answered as coming through the tailnet; loopback requests are handled exactly as today.
- `hooks/pane.ts` stays on loopback, unchanged: `serve.json`'s `url` is the loopback address whatever `station.remote` says, and the tailnet address sits beside it as `remote.url`.

## 2. tailscale serve, made once, tailnet only

- At listen, and whenever `station.remote` is written from the page, the station runs `tailscale serve --bg <port>` only when `tailscale serve status --json` shows no proxy to that port yet — VoiceLedger's `ensure_tailscale_serve`.
- It never runs `tailscale funnel`, and with Funnel on for the machine it leaves remote off and says so.
- Every failure — no tailscale, not running, no MagicDNS name, another proxy already on `/` — is a warning on stderr and on the 手機遠端 card, never fatal: the station keeps serving loopback.
- Turning `station.remote` off does not touch Tailscale: the station refuses the tailnet Host from the next request, and the reference page says how to remove the proxy.

## 3. Pairing, and what a phone may reach

- The 手機遠端 card on `#/settings` (mockup `remote-on`, `remote-off`) carries the switch, the tailnet url with 複製, a QR of `https://<name>/m#/pair/<code>` with the code typed out, the paired devices with 解除, and the three ntfy triggers.
- A pairing code is 8 characters, one-time, live for 10 minutes; 換一個 mints a new one, and five wrong tries drop it.
- `POST /station/remote/pair` from the tailnet trades a live code for a device token, set as an `HttpOnly; Secure; SameSite=Strict` cookie for a year; only the token's SHA-256 is stored, in `<configDir>/fankeel/remote.json`, which is never in a repository.
- Through the tailnet every route but the phone page, its assets and pairing needs a paired device's cookie, reads included — `/station/talk/<id>` serves whole transcripts — and answers 401 without; every POST from there also needs `Origin: https://<name>`.
- The POST routes (`/answer`, `/clear`, `/clear-stale`, `/todo`, `/profile`) take a paired device's cookie in place of the nonce from the tailnet; from loopback they keep today's nonce, and the card's own routes and Chartroom answer loopback only.
- 解除 revokes one device: its cookie answers 401 from the next request.

## 4. The phone station

- `/m` is the phone's page, one app-like column — full-bleed under 600 px, a centred 480 px column above — with 待答, 任務 and 完成 on a bottom tab bar (mockup `tabbar`, `tab-gates`, `tab-tasks`, `tab-done`).
- 待答 lists the gates `hooks/gate.js` is holding for the station, oldest first; a row opens the gate as a bottom sheet with every question, the recommended option picked and a 自己寫答案 box (`gate-sheet`), posting to `POST /answer`; with none held it is `gates-empty`.
- 任務 lists running tasks with their route dots and stage; 完成 lists the stages finished and tasks ended in the last 48 hours, newest first, with their cost including agents.
- An unpaired phone sees `pair-scan` — the camera through BarcodeDetector where the browser has it, otherwise 輸入配對碼 — and a phone that cannot reach the station sees `pair-error`, from the service worker's cached shell when installed.
- It works as an installed PWA (`/m/manifest.webmanifest`, `/m/icon.svg`, `/sw.js` caching the shell only) and opened directly in the browser, the same page either way.
- Its data is `GET /station/mobile.json` (`lib/mobile.js`), a few kilobytes, read every 5 s while the page is visible — never the desktop's `station-data.js`; through the tailnet `/` redirects to `/m`.

## 5. Notifications through ntfy

- Profile keys `notify.server` (default `https://ntfy.sh`) and `notify.topic` — random, `fankeel-` and 20 hex digits, written the first time a trigger is turned on from the card — and three triggers, `notify.gate`, `notify.stage` and `notify.end`, each default `false`.
- One JSON publish per trigger to `<server>/` with the topic, and a `click` to `<remote.url>m#/gate/<id>` or `m#/task/<id>` when `serve.json` has a tailnet address.
- A gate waiting (`hooks/gate.js`, every question it lets out) is priority 4 with a 打開 gate action; a stage finished (`task.js stage`) and a task ended (`hooks/leave.js`) are priority 2, silent.
- Each publish is sent by a detached child (`scripts/notify.js`), so no hook waits on the network, and no failure — no topic, an unreachable server, a refusal — changes a hook's output or its exit code.
- What leaves for the ntfy server is the stage, the first question, the task text cut to 80 characters, the project and the cost, and nothing else.

## What proves it done

| test | file | fails today because |
|---|---|---|
| with `station.remote` off, a request whose Host is the tailnet name is refused with 421 | `tests/station-remote.test.js` | the server answers any Host |
| with `station.remote` on and no device cookie, `POST /answer` through the tailnet answers 401 | `tests/station-remote.test.js` | no route reads a cookie |
| `hooks/gate.js` with ntfy configured makes exactly one POST to a stub ntfy server | `tests/gate-notify.test.js` | no hook sends anything |
| the phone page's 待答 badge, its gate rows and `/station/mobile.json`'s `gates` agree in number | `tests/station-mobile-route.test.js` | there is no phone page |

## Files

| file | change | dispatch |
|---|---|---|
| `lib/remote.js` | new: host kind, the tailnet route policy, pairing codes, device tokens, the cookie | implementer, opus, high |
| `lib/tailscale.js` | new: the machine's tailnet name, `tailscale serve --bg` made once, never Funnel | implementer, opus, high |
| `lib/qr.js` | new: a QR encoder (byte mode, level L, versions 1-5) and its SVG | implementer, opus, high |
| `lib/profile.js` | `station.remote`, `notify.server`, `notify.topic`, `notify.gate`, `notify.stage`, `notify.end` | implementer, opus, high |
| `docs/01-guide/profile.md` | the key table regenerated | implementer, opus, high |
| `lib/notify.js` | new: the ntfy publish for each trigger, sent by a detached child | implementer, opus, high |
| `scripts/notify.js` | new: that child | implementer, opus, high |
| `scripts/station.js` | the Host check, the tailnet policy, the pairing and card routes, tailscale at listen, `remote` in `serve.json`; the phone routes and assets | implementer, opus, high |
| `docs/90-agent/reference/station.md` | the remote section and the phone's served files | implementer, opus, high |
| `lib/mobile.js` | new: `/station/mobile.json`'s lists, the `/m` shell, manifest and icon | implementer, opus, high |
| `assets/station/mobile.js` | new: the phone page | implementer, opus, high |
| `assets/station/mobile.css` | new: its styles, from the mockup | implementer, opus, high |
| `assets/station/sw.js` | new: the service worker | implementer, opus, high |
| `assets/station/remote-card.js` | new: the 手機遠端 card, a station module | implementer, opus, high |
| `assets/station/station.css` | the card's styles | implementer, opus, high |
| `assets/station/station.js` | `#/settings` draws the card under the wizard | implementer, opus, high |
| `assets/station/index.html` | loads `remote-card.js` | implementer, opus, high |
| `lib/station.js` | `remote-card.js` among the emitted modules | implementer, opus, high |
| `hooks/gate.js` | `notify.gate` | implementer, opus, high |
| `scripts/task.js` | `notify.stage` | implementer, opus, high |
| `hooks/leave.js` | `notify.end` | implementer, opus, high |

## Against the map

`docs/90-agent/reference/station.md` (current, last verified 2026-10-19) says
the station is loopback-only and the nonce guards every POST; both stay true
with `station.remote` off, and the tasks that change the server add the remote
section to it. No page listed as current describes a phone station, Tailscale
or ntfy.

## Not verified

- What `tailscale serve` forwards on Windows — the Host it sends and which of
  X-Forwarded-For, X-Forwarded-Host and Tailscale-User-Login it adds. The plan's
  first tailscale task probes it before anything relies on it.
- Whether Chrome on the phone offers install for a manifest whose only icon is
  an SVG with `sizes: any`, and whether BarcodeDetector is there on the S24.
