---
judged: 2026-10-23T12:03:51.756Z
model: fable
agent: fankeel-judge
task: "station 通知鈴鐺：說明內容並移到 header 右上角"
session: cc4be444-8040-4101-b9a8-b4988030305a
stage: build
---

# Brief: station loading skeletons, and the station's stack going forward

## Question

# Brief: station loading skeletons, and the station's stack going forward

## The user's words (2026-10-23, verbatim)

幫我記錄到 TODO：LOADING 的 SKELETON 和實際的差距有點大，可以針對每個畫面設計一個 SKELETON 嗎？還是會太複雜？另外我們的 STATION 網頁前端和後端框架使用的是什麼？有沒有辦法兼具現在的網頁風格、便利性，又可以支援長期發展，還有本地快速啟動的機制？

## Questions

1. **Skeletons.** The station's loading skeleton differs noticeably from the page that replaces it. Options:
   - A. One skeleton per view (sessions list, session detail, docs, settings, gate, TODO…), hand-written.
   - B. Derive the skeleton from the real view's own render function (render it with empty/placeholder data and a `.skel` class), so it cannot drift.
   - C. Keep one generic skeleton but shape it per layout family (list / detail / form), 2–3 variants.
   - D. Not worth it — e.g. make loading fast enough that skeletons rarely show.
   Which, and is per-view "too complex" here?
2. **Stack.** What frontend and backend does the station actually use today (state it from the code)? Is there a path that keeps the current look and the convenience (no build step? zero deps? whatever is true), supports long-term growth (station.js is a very large single file), and gives fast local startup? Options might include: stay vanilla but split into modules; adopt a light framework (Preact/htm, Lit, Svelte…) with or without a build step; keep the backend as-is. Recommend one, with what it costs to migrate.

## Paths the judge needs

- assets/station/index.html, assets/station/station.js (large; skeleton code: grep `skel`), assets/station/station.css, assets/station/mobile.js, assets/station/i18n.js
- the server: grep scripts/ and lib/ for what serves 127.0.0.1:28888 (`serve`, `station`) — e.g. scripts/station*.js, lib/station*/
- package.json (dependencies — the plugin's own stance on deps)
- docs/90-agent/reference/station.md (how the station is described), CONTRIBUTING.md, any docs/03-decisions/* about station, frameworks, dependencies or build steps
- tests/station-*.test.js (how the station is tested — a stack change must keep these meaningful)

## What counts as an answer

A pick for each question, grounded in path:line evidence of what exists today, with the migration cost stated plainly. For Q2, the facts of the current stack first (frontend, backend, build step or none, dependency count, file sizes), then the recommendation.

## Shape

The six fields the judge returns (`pick:` first), then `## Summary` covering both questions. The answer becomes the body of one or two TODO entries, so it should say what each entry should become and what counts as done.

## Answer

pick: Q1 = C (hash-keyed skeleton per layout family: dashboard / list / detail / form, set by a 2-line inline script in index.html). Q2 = stay vanilla with zero deps and no build step; finish the module split already in progress so station.js shrinks to a shell. No framework.
why: There is no skeleton code at all — the "skeleton" is CSS on `#page:empty` that always draws the 儀表板 shape because CSS cannot read the hash (assets/station/station.css:1387-1392); that is the whole mismatch on deep links. Per-view hand-drawn CSS (A) multiplies the drift the user sees today; deriving from render functions (B) reverses the documented load order (data before station.js, index.html:26-41) and needs placeholder data in every FK_* module. Stack today: node:http, 0 deps, no build (scripts/station.js:28,36; package.json; docs/03-decisions/2026-09-04-session-station-design.md:70-71), classic scripts with window.FK_* globals and a CJS guard (station.js:11, :2963); 98 tests (53 via node:vm on a fake window, 38 require the file) and the file:// fallback (station.md:34-35) both depend on plain classic scripts, so ESM or a framework breaks them. The split is already half done: VIEWS.* defer to FK_LIVE/FK_SESSIONS/FK_PROJECTS/FK_PROJECT/FK_SESSION with OLD.* fallbacks (station.js:5732-5754).
would flip if: Q1 → B if the page ever loads station.js before station-data.js (then empty-S renders could carry a .skel class cheaply). Q2 → a framework only if the station needs per-keystroke reactive updates; today it re-renders from S on a 3 s poll (station.js:6598, :6838), so it does not.
unread: nothing named in the brief was skipped; not opened: live-page.js/sessions-page.js and the other FK_* module bodies (sizes only), lib/live.js, mobile.css, the four later station decisions (2026-09-26, 09-23, 10-16, 10-22) — none of them bears on either pick.
delegated: assets/station/index.html + station.css (sonnet); assets/station/station.js (opus); assets/station/mobile.js + i18n.js + dir listing (sonnet); scripts/station.js + lib/serve.js + hooks + plugin.json (sonnet); package.json + CONTRIBUTING.md + README.md (sonnet); docs/90-agent/reference/station.md + docs/03-decisions/* + .fankeel/map.md (sonnet); tests/station-*.test.js (sonnet)
checklist: 1 index.html script tags — answered (15 classic scripts, no module/CDN). 2 station.js skeleton/views/size — answered (no skel; VIEWS table; 6939 lines). 3 station.css skeleton rules — answered (found at :1387-1415 under `:empty`, reader missed it; I grepped). 4 mobile.js/i18n.js — answered. 5 server — answered (node:http, 21 routes, verbatim static). 6 package.json — answered (0/0 deps). 7 station.md — answered (no stack sentence; serve/hook flow). 8 CONTRIBUTING + decisions — answered. 9 tests — answered (98 files; vm/require/string).

## Summary

### What the "loading skeleton" actually is

No file under assets/station contains `skel` (reader on station.js: grep empty across *.js/*.css/*.html; reader on station.css: zero matches). The thing the user sees is the block at F:/ymlab/fankeel/assets/station/station.css:1387-1415, headed "first load (2026-09-25)". Its own comment states the cause of the mismatch: "The page waits on station/station-data.js, which serve computes per request, and station.js is loaded after it, so no script runs until the data is here: these placeholders are the stylesheet's alone, on the three boxes the shell leaves empty. The hash is not something CSS can read, so #page takes the 儀表板's shape, the page a bare load opens." Concretely: `#side:empty::before/::after` draws a spinner and "計算中…" (:1393-1395), `#nav:empty` a striped nav (:1397-1398), and `#page:empty` a nine-layer gradient mosaic shaped like the dashboard (:1399-1411), with a reduced-motion guard (:1415).

So on any deep link — `#/sessions`, `#/s/<id>`, `#/p/<key>`, `#/docs`, `#/settings`, `#/days`, `#/list`, `#/cmp` (the routes parseHash returns at station.js:255-270; PAGES list at :254) — the user sees a dashboard-shaped placeholder and then a different page. That is the whole "差距".

The load order that makes it CSS-only is in F:/ymlab/fankeel/assets/station/index.html:24-41 (spot-checked): `<main class="page" id="page"></main>` is empty; line 26 is an inline script that document.writes `station/station-data.js` (the data, generated per request by `station.serialize(sharedModel())` at scripts/station.js:572); then i18n.js, tip.js, 12 FK_* page modules, and station.js last (:41). station.js's first paint is the synchronous `draw()` at its last lines (:6937), reading `w.STATION` which is already there (`var S = w.STATION || { sessions: [], projects: [] }` at :24). How long the skeleton shows is how long `gather()` takes: lib/station.js:933 says "about a second", memoised across requests within a window (scripts/station.js:405-412), synchronous.

### Q1 options against that fact

- A (one hand-written skeleton per view): requires a hash → class step anyway (CSS cannot read the hash), then 8-10 gradient mosaics like :1399-1411, each of which drifts every time its view's layout changes — the same drift the user is reporting, multiplied. "Too complex" in the maintenance sense, not the coding sense.
- B (render the real view with empty data and a `.skel` class): the no-drift option, but station.js deliberately runs after the data (station.css:1388-1389, index.html:26-41). Reversing that means loading ~700 KB of scripts before the data (fine locally) and then making every page function — including the split-out FK_SESSIONS/FK_PROJECTS/FK_PROJECT/FK_SESSION/FK_LIVE modules — render placeholder rows from fake records, since an empty `S` renders empty states ("no sessions"), not shapes. That touches every view and the 53 vm-based tests' assumptions about `window.STATION` being present at load. Too much for a cosmetic.
- C (2-4 family shapes keyed on the hash): add to the existing inline script at index.html:26 two statements — read `location.hash`, set `data-skel` on `#page` (`list` for sessions/projects/docs/days/list/cmp, `detail` for `#/s/` and `#/p/`, `form` for settings, nothing for the dashboard) — and add CSS variants `#page:empty[data-skel=list]`, `[data-skel=detail]`, `[data-skel=form]` beside :1399. The dashboard mosaic stays as the default. Drift is bounded to three shapes that only need to be roughly right (rows / header+tabs+body / label-field pairs). This is the pick.
- D (make loading fast enough): a stale-while-revalidate station-data.js (answer from the last memo, let the 3 s poll at station.js:6598/:6838 fetch fresh) would hide the skeleton on repeat loads, but not on the first load after serve starts, and gather() is synchronous so a cold gather still blocks. Worth a separate, optional TODO; it does not answer the mismatch.

Test impact of C: 13 tests read index.html as a string and 20 read station.css as a string (reader 7 counts), e.g. tests/station-float.test.js:67-68 pins the header markup by regex. Adding statements inside the existing inline script and new CSS rules does not disturb those pins unless one pins line 26 verbatim — a `grep "station-data.js" tests/` before editing will say.

TODO entry 1 should become: "Station skeleton per layout family" — done when (a) index.html's inline script sets `data-skel` on `#page` from the hash before station-data.js is requested, (b) station.css has `#page:empty[data-skel=list|detail|form]` variants beside the dashboard default at :1399, (c) a test reads index.html and asserts the hash→data-skel mapping for `#/sessions`, `#/s/x`, `#/settings`, and another reads station.css and asserts one rule per family, (d) a render shot of `#/sessions` and `#/s/<id>` with station-data.js delayed shows the family shape, not the dashboard.

### Q2 — the stack as the code states it

Frontend (all spot-checked or reader-extracted with lines):
- Hand-written vanilla JavaScript, classic `<script src>` tags, no `type="module"`, no CDN, no web fonts, no framework reference (index.html:27-41; station.css has no `@import`/`url(`; grep for preact/react/vue/svelte/lit/htm/alpine in station.js empty).
- One IIFE per file publishing a `window.FK_*` global, with a CommonJS guard so node tests can `require` the same file: station.js:11 `(function (w, doc) {` … :2963 `if (typeof module !== 'undefined' && module.exports) { module.exports = {`; i18n.js:7/:1138-1139 (`window.FK_I18N`); mobile.js:16/:924-925 (`window.FK_M`).
- HTML by string concatenation in `*Html` functions (no tagged templates; 23 `innerHTML` sites). `draw()` at station.js:5834-5870 calls `(VIEWS[route.view] || dashPage)(route)` and either swaps changed top-level parts via `<template>` or sets `p.innerHTML = html` (spot-checked :5859-5869). Hash routing (`hashchange` at :6004).
- Data: not fetch-first. `station/station-data.js` is re-injected as a script every `POLL_MS = 3000` (station.js:6598, :6624 `reload`, :6786, :6838) and `station/detail/<id>.js` likewise (:4284, :6798); a few `fetch()` calls for search, talk, health and the POSTs (profile, todo, answer). No EventSource or WebSocket anywhere (frontend or server).
- Sizes (bytes): station.js 519,241 (6,939 lines); station.css 197,426 (2,627 lines); i18n.js 69,844 (1,140 lines; English table only, Chinese is the call-site fallback); mobile.js 63,062 (927 lines; a separate `/m` phone page with its own strings, not a narrow-screen adapter); the already split-out page modules: sessions-page 31,789, projects-page 23,812, session-page 20,206, project-page 16,711, remote-card 15,862, session-talk 12,784, live-page 12,076, session-dispatch 8,809, spend-panel/range/kinds/talk ≈ 25,000 together; tour-*.js ≈ 330,000 (the tour, separate page). No minified or bundled file in the directory.
- i18n: `loc(key, zh, vars)` at station.js:34 delegates to `FK_I18N.t`; i18n.js:2-6 header (spot-checked).

Backend:
- F:/ymlab/fankeel/scripts/station.js (1,266 lines) is the server: `node:http` only (:36), header comment :28 "Zero dependencies, as everywhere in this repository: `node:http` and a form" (spot-checked). `http.createServer(handler)` :1000, `listen(port, '127.0.0.1')` :1063, fixed port 28888 with ephemeral fallback and a rebind timer (:114, :1059, :1077-1087 spot-checked). About 21 exact routes plus a regex static route and a board mount (reader 4 list: `/`, `/station/station-data.js`, `/station/search`, `/station/spend`, remote/*, health, `/m`, mobile.json, phone.json, and POSTs clear/clear-stale/todo/answer/profile/remote/*).
- Static assets are read from disk per request and sent verbatim with no-store — no templating or bundling (:835-843 spot-checked; STATIC regex at :77).
- The server also `require`s the frontend file (`const view = require('../assets/station/station.js')` at :64) — view functions run on both sides, which is what the CJS guard is for.
- Model: F:/ymlab/fankeel/lib/station.js (1,180 lines) — `gather()` :470, `serialize`, `render` (reads index.html at :1066), static export of css/js/i18n/MODULES for the file:// form (:1127-1130). lib/serve.js: serve.json record, HTTP health probe, `ensureServe`.
- Startup: hooks/inject.js (plugin.json:30) → `lib/serve.js ensureServe` → `spawn(node, [station.js, 'serve', ...], {detached:true}).unref()` (scripts/station.js:1197), polling serve.json every 50 ms up to 5 s (:1198-1209); already-running detection via the serve.json record plus a 500 ms health probe (:323-324). hooks/inject.js:184-195 (spot-checked): a running/starting station serves the page itself; only a failed start writes the static page. No measured startup number exists in the repo; the bounds are 5 s deadline and ~1 s per cold gather.
- Dependencies: package.json has no `dependencies`, no `devDependencies`, no `type` (CJS), `engines.node >=22.5`, scripts = node --test only; no package-lock.json, no node_modules (reader 5). Written policy: docs/03-decisions/2026-09-04-session-station-design.md:70-71 "`package.json` — no dependencies. The server is `node:http`; the page has no external resource." (spot-checked); docs/03-decisions/2026-10-07-station-chartroom.md:30 "fankeel 現在沒有 build 步驤、沒有 dependency，Chartroom 卻用 React 與 Vite，所以『怎麼併進來還維持這兩點』…是下一份 design 第一個要回答的問題" (spot-checked) — i.e. no-build and no-dep are treated as commitments to preserve. CONTRIBUTING.md:35-36 (spot-checked) lists "no new dependency" among the three conditions for a change to count as small; reader 5's caution that its scope was unverified is resolved: it is a process bar, not the policy itself, but it points the same way.
- Tests: 98 `tests/station-*.test.js`, 20,860 lines. 81 read a source file as a string; 53 evaluate station.js with `vm.runInNewContext(src, { window: win, document: doc, URLSearchParams, fetch() {} })` on hand-built fake elements (tests/station-view.test.js:949 spot-checked; fake element factory :931); 38 `require('../assets/station/station.js')` after setting `global.window = { STATION: … }` (station-float.test.js:10-11); 25 require the server in-process; 20 read station.css and 13 index.html as strings. No jsdom, no shared helper.

### Q2 recommendation and costs

Stay vanilla, zero deps, no build; finish the module split. Reasons from the code:
1. Every documented commitment (no deps, no build, node ≥22.5 only) is broken by Svelte/Lit/Vite or Preact+JSX, and the chartroom ruling already named "keep no-build/no-dep" as the first question when React code arrived.
2. The tests are the cost centre. 53 files run the source in `vm.runInNewContext` with hand-rolled fake elements; 38 `require` the file as CJS. ES modules cannot be `require`d through the existing guard nor run in `runInNewContext` (they need `vm.SourceTextModule` behind a flag), and a framework's renderer needs a real DOM (createElement/insertBefore/attributes…) that the fake elements at station-view.test.js:931 do not provide — that means jsdom, a dependency, plus rewriting ~50 test files.
3. The `file://` fallback (station.md:34-35; hooks/leave.js writes it) only works with classic scripts and globals — module scripts are blocked over file:// by CORS. The current pattern is the one that works in both forms.
4. The gain from a framework is small here: the page already re-renders from one `S` on a 3 s poll and diffs top-level parts (station.js:5860-5869). No fine-grained reactivity is needed.
5. The growth problem is real — 519 KB in one file — but the repo already has the mechanism: `VIEWS.now/live/sessions/cmp/projects/project/session` are overridden to `w.FK_LIVE / FK_SESSIONS / FK_PROJECTS / FK_PROJECT / FK_SESSION` modules when loaded, with `OLD.*` fallbacks (station.js:5732-5754). docs, settings, days, list, dash, tour, focus/gate (focusPageHtml :2903, gateTabHtml :4977), the TODO panel (:2662) and the shared helpers still live in station.js.

Migration cost, plainly:
- Stay vanilla and finish the split (recommended): move each remaining page and the shared helpers (esc, loc, roHtml, …) into its own classic-script `FK_*` module with the same CJS guard; add each to index.html:27-41, to the STATIC regex at scripts/station.js:77 and to the MODULES list at lib/station.js:1127-1130; delete the `OLD.*` fallbacks once all pages are modules; point the tests that `require` a moved function at its new module. Days of mechanical work, zero new deps, no behaviour change, tests keep their technique. Target: station.js ≤ ~1,500 lines holding route parsing, draw/diff, poll, event delegation, loc/esc.
- Preact + htm vendored without a build: ~15 KB of third-party code committed under assets/ (a dependency by another name, against 2026-09-04 and the chartroom ruling, so it needs a decision first); rewrite ~7,000 lines of string templates plus the ~150 KB of modules into `h()`/htm; replace fake elements in ~53 tests with jsdom (another dep) or rewrite them to assert on strings via `preact-render-to-string` (yet another). Weeks.
- Svelte / Lit+TS / Vite: adds devDependencies, a lockfile, a build, a `dist/` to serve, and a committed build output for the file:// form; node-only test runner has to run the compiled output. Weeks plus permanent toolchain upkeep; it also contradicts the chartroom ruling outright.

Fast local startup already exists (detached serve, serve.json + health probe, fixed port, 50 ms poll, rejoin instead of second port) and needs no stack change. The one speed item worth its own small TODO is optional: let `/station/station-data.js` answer from the last memo immediately and refresh on the next 3 s poll, so repeat loads never show the skeleton.

TODO entry 2 should become: "Station stays vanilla; finish the page-module split" — done when (a) every `VIEWS.*` entry resolves to an `FK_*` module and the `OLD.*` fallbacks at station.js:5732-5754 are gone, (b) station.js is under ~1,500 lines and holds only the shell (route, draw/diff, poll, events, loc/esc), (c) index.html, scripts/station.js:77 STATIC and lib/station.js:1127-1130 MODULES list the same module set and a test asserts the three agree, (d) `npm test` passes with no test switched to a new technique, and (e) a one-paragraph decision under docs/03-decisions records "vanilla classic scripts, zero deps, no build step; ESM and frameworks ruled out for the vm tests and the file:// form", citing this judgement.

### What I could not check
The bodies of the FK_* page modules and lib/live.js (only sizes and headers), mobile.css, and the four later station decisions; none affects either pick. Reader 1 reported zero `skel` rules in station.css, which was literally true but missed the `:empty` skeleton — I found it by grepping `placeholder|loading` and read :1384-1415 myself. The Preact/htm size and the jsdom claim are from general knowledge, not from this repo.
