---
status: current
last_verified: 2026-09-08
---

# Station Shell Implementation Plan

**Goal:** `station.html` becomes a static shell that renders from `station-data.js` written beside it, and the page's frame ships as real files under `assets/station/`.

**Architecture:** six tasks. Task 1 creates the shell and its stylesheet — the two files that never vary. Task 2 creates the view script that builds every row and chart in the browser from `window.STATION`. Task 3 rewrites `lib/station.js` so `render()` returns the shell, a new `serialize()` writes the data, and `write()` emits four files instead of one. Task 4 gives `serve()` the three GET routes the split needs. Tasks 5 and 6 move the assertions and the prose that named the old single file.

**Tech Stack:** Node v24.9.0, zero dependencies, `node --test`. Browser side is ES5-compatible plain JavaScript with no build step and no framework — the page is opened from `file://` as often as from the server.

**Spec:** [2026-09-08-station-shell-design.md](2026-09-08-station-shell-design.md)

## Global Constraints

Generated from this repository on 2026-09-08, values copied exactly.

1. **Line endings are LF.** `.gitattributes` is `* text=auto eol=lf`. Write every new file with LF; on Windows a naive text write produces CRLF for the whole file and the diff is the whole file.
2. **Zero dependencies.** `package.json` declares no `dependencies` and no `devDependencies`, `"private": true`, and `"test": "node --test"`. Nothing may be added — not for the browser side either, which is why the page ships plain JavaScript and inline SVG rather than a chart library.
3. **`'use strict';` is the first line** of every `.js` under `lib/`, `scripts/` and `hooks/`. Indentation is four spaces.
4. **`tests/source.test.js` — every exported name is imported by something.** It reads `module.exports = { … }` out of every tracked non-test `.js` and fails on a name nothing imports; a name reached only by a test counts as used. `SCRIPT` must therefore leave `lib/station.js`'s export block when it leaves the file.

   **It does not reach `assets/station/station.js`, and this was measured rather than assumed.** Its pattern is `/module\.exports\s*=\s*\{([\s\S]*?)\n?\};?\s*$/` with no `m` flag, so the block has to sit at the end of the file; in the view script it sits at line 127 of 701, inside the IIFE, and the file is skipped whole. `git ls-files '*.js'` does list it — the glob is not what misses it. So nothing reports an orphan export there, and the export list is guarded only by the tests that import from it.
5. **`tests/source.test.js` — no tracked file holds a NUL byte.**
6. **`git ls-files` is the denominator.** Both checks above enumerate tracked files, so a new file under `assets/` is invisible to them until `git add`. Stage the new files before treating a green `source.test.js` as evidence.
7. **`lib/registry.js:222` `ensureIgnored(projectRoot, names)`** appends only the names missing from `<root>/.fankeel/.gitignore` and touches nothing else, so growing its argument from one name to four is additive and leaves a hand-added line alone.
8. **The committed template `.fankeel/.gitignore` holds** `sessions/`, `map.md`, `build/`, `station.html` — four lines, in that order.
9. **`.fankeel/map.md` filing:** `docs/plans` is `plan`, `docs` at depth 1 is `reference`, `skills` and `output-styles` are `reference`, `docs/archive` is `archive`. The index is `docs/README.md` and is maintained by hand. `docs/station.md` is `status: current` with `source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js, lib/prices.js, lib/clear.js`.
10. **`scripts/station.js` routes today:** `GET /` at `:213`, `POST /clear` at `:228`, `POST /clear-stale` at `:262`, catch-all 404 at `:297`. The two POST routes are not touched by this plan.
11. **The four emitted filenames are fixed:** `station.html`, `station.css`, `station.js`, `station-data.js`. Every task that names one names it exactly.
12. **No `CLAUDE.md` or `AGENTS.md` exists** in this repository; conventions come from the code and from this list.

## File structure

| file | responsibility |
|---|---|
| `assets/station/station.html` | the shell: `<head>`, the frame's empty containers, three `<script>`/`<link>` references. No data. |
| `assets/station/station.css` | every rule the page uses, light and dark. |
| `assets/station/station.js` | formatting helpers, the facet state, and the two views. Exports its pure functions for `node --test`. |
| `lib/station.js` | unchanged: `discover`, `gather`, `scanRoots`, `readRoots`, `rootsPath`, `rememberRoots`, `tally`, `sum`, `stationPath`. Changed: `render`, `write`. New: `serialize`, `ASSETS`, `EMITTED`, `flatten`. Deleted: `CSS`, `SCRIPT`, `esc`, `day`, `stamp`, `dots`, `chart`, `stageTable`, `row`, `BAR`, `navLabels`, `navHtml`, the local `mins` at `:194`, and the `tokens` import at `:24`. |
| `scripts/station.js` | `serve()` answers `/station.css`, `/station.js`, `/station-data.js`. |
| `docs/station.md` | the reference page, rewritten where it describes the old markup. |
| `.fankeel/.gitignore` | four generated names instead of one. |

`navLabels` moves rather than dying: the shortest-unique-tail rule is what labels the registry facets, and it now runs in the browser.

---

## Task 1: `assets/station/station.html` and `station.css` — the shell

**Files:**
- Modify: `assets/station/station.html` — created here: the static shell, carrying no session data
- Modify: `assets/station/station.css` — created here: the page's whole stylesheet
- Test: `tests/station-shell.test.js`

**Interfaces:**
- Consumes: none
- Produces: the element ids `side`, `q`, `gen`, `nreg`, `cfg`, `page`; the classes `app`, `side`, `brand`, `scroll`, `foot`, `teamcard`, `main`, `tbar`, `search`, `who`, `scrollmain`. `assets/station/station.js` reads exactly these.

**Dispatch:** implementer, sonnet — two static files and one test; the content is in this task.

### Step 1: the failing test

Create `tests/station-shell.test.js`:

```js
'use strict';

// The shell is the half of the page that must not vary. Everything a machine
// knows about itself — a task line, a count, a timestamp — travels in
// station-data.js, so this file can be copied byte for byte to two places and
// still be the same file. A single session id leaking into it would make the
// copy machine-specific and the byte-equality test in tests/station.test.js
// would start passing for the wrong reason.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHELL = path.join(ROOT, 'assets', 'station', 'station.html');
const CSS = path.join(ROOT, 'assets', 'station', 'station.css');

const shell = () => fs.readFileSync(SHELL, 'utf8');

test('the shell references its three siblings by bare name', () => {
    const html = shell();
    assert.match(html, /<link rel="stylesheet" href="station\.css">/);
    assert.match(html, /station-data\.js/);
    assert.match(html, /<script src="station\.js"><\/script>/);
});

test('the data request carries the page query through', () => {
    // /clear-stale answers 303 -> /?cleared=2 and the shell is static, so the
    // count reaches the data file only if the src picks up location.search.
    assert.match(shell(), /document\.write\([^)]*location\.search/);
});

test('station-data.js is loaded before station.js', () => {
    const html = shell();
    assert.ok(html.indexOf('station-data.js') < html.indexOf('src="station.js"'),
        'the view script reads window.STATION at load');
});

test('the shell carries no absolute path', () => {
    // A path into the plugin directory carries its version, so a shell holding
    // one breaks on the next update and the .fankeel/ copy points outside the
    // repository it sits in.
    assert.doesNotMatch(shell(), /file:\/\/|[A-Za-z]:[\\/]|\/Users\/|\/home\//);
});

test('the shell holds every id the view script looks up', () => {
    const html = shell();
    for (const id of ['side', 'q', 'gen', 'nreg', 'cfg', 'page']) {
        assert.ok(html.includes('id="' + id + '"'), 'missing id=' + id);
    }
});

test('the stylesheet defines both themes', () => {
    const css = fs.readFileSync(CSS, 'utf8');
    assert.match(css, /^:root\{/m);
    assert.match(css, /@media\(prefers-color-scheme:dark\)/);
});

test('neither file holds a CRLF', () => {
    // .gitattributes is `* text=auto eol=lf`; a CRLF file diffs whole.
    for (const f of [SHELL, CSS]) {
        assert.ok(!fs.readFileSync(f, 'utf8').includes('\r'), f + ' has CRLF');
    }
});
```

Run it and watch all six fail — neither file exists.

### Step 2: the shell

Create `assets/station/station.html`:

```html
<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fankeel station</title>
<link rel="stylesheet" href="station.css">
</head><body>
<div class="app">
  <aside class="side">
    <div class="brand"><span class="mk">f</span><b>fankeel</b><span class="mute">station</span></div>
    <div class="scroll" id="side"></div>
    <div class="foot">
      <div class="teamcard">
        <span class="av">&#9671;</span>
        <span><span class="t1">config dir</span><span class="t2" id="cfg">&mdash;</span></span>
      </div>
    </div>
  </aside>
  <div class="main">
    <div class="tbar">
      <label class="search"><span class="mute">&#8981;</span>
        <input id="q" placeholder="搜尋任務、session、碰過的檔案…"><span class="k">/</span></label>
      <span class="spacer"></span>
      <span class="mute gen" id="gen"></span>
      <span class="who"><span class="av">&#9672;</span>
        <span><span class="n1">station</span><span class="n2" id="nreg"></span></span></span>
    </div>
    <div class="scrollmain" id="page"></div>
  </div>
</div>
<script>document.write('<script src="station-data.js' + location.search + '"><\/script>')</script>
<script src="station.js"></script>
</body></html>
```

Nothing in it changes between two machines: the four text slots — `cfg`, `gen`, `nreg`, and everything under `page` — are filled by the view script at load.

The one line of script in the shell is there because a static file cannot otherwise pass a query through. `/clear-stale` answers `303 → /?cleared=2`, and the count has to reach the data request; `document.write` is what carries `location.search` onto the `src`. Opened as a local file there is no query and it appends nothing.

Measured on 2026-09-08 against a page served from 127.0.0.1 with `?cleared=2`: the tag came out as `src=probe-data.js?cleared=2`, and the data file's global was already set by the time the next inline script ran — which is the ordering `station.js` depends on. The same page has not been checked from a local file, because the browser driver available here refuses that protocol.

### Step 3: the stylesheet

Create `assets/station/station.css` with the content below. It is the approved mock's stylesheet; the only change from the mock is that `.who .n1`, `.who .n2`, `.teamcard .t1` and `.teamcard .t2` carry `display:block`, which the mock needed after the label and its value rendered on one line.

```css
/* The station page. Cool ground, white rounded cards, indigo accent.
   Loaded as a sibling of station.html, which is copied verbatim from
   assets/station/ — so nothing in here may reference the plugin directory. */
:root{
  --ground:#eef0f5; --card:#fff; --fg:#141621; --fg-2:#3d4256; --mute:#8b90a3;
  --line:#e8eaf0; --line-2:#dfe2ea; --soft:#f5f6fa;
  --ind:#4c3fd7; --ind-2:#7c6cf0; --ind-soft:#eeecfe;
  --blue:#3b82f6; --teal:#14b8a6; --mint:#7fe7d4; --slate:#aab1c4;
  --up:#16a34a; --up-bg:#dcfce7; --dn:#dc2626; --dn-bg:#fee2e2;
  --live:#16a34a; --live-bg:#dcfce7;
  --stale:#d97706; --stale-bg:#fef3c7;
  --down:#94a3b8; --down-bg:#eef1f6;
  --r:16px; --r-md:12px; --r-sm:8px; --r-pill:999px;
  --mono:ui-monospace,SFMono-Regular,"Cascadia Mono",Menlo,monospace;
  --sans:system-ui,"Segoe UI","Noto Sans TC",sans-serif;
  --sh:0 1px 2px rgba(20,22,33,.04),0 4px 16px rgba(20,22,33,.04);
}
@media(prefers-color-scheme:dark){:root{
  --ground:#0e0f16; --card:#171926; --fg:#eceefa; --fg-2:#c2c6db; --mute:#7d829a;
  --line:#232637; --line-2:#2c3045; --soft:#1d2030;
  --ind:#7c6cf0; --ind-2:#9b8dfa; --ind-soft:#231f45;
  --up:#4ade80; --up-bg:#14301f; --dn:#f87171; --dn-bg:#3a1a1a;
  --live:#4ade80; --live-bg:#14301f;
  --stale:#fbbf24; --stale-bg:#33270d;
  --down:#6b7186; --down-bg:#20242f;
  --sh:0 1px 2px rgba(0,0,0,.3);
}}

*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--ground);color:var(--fg);
  font:14px/1.5 var(--sans);-webkit-font-smoothing:antialiased;overflow:hidden}
h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.015em}
.num{font-variant-numeric:tabular-nums}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.mute{color:var(--mute)}
.spacer{flex:1}
.gen{font-size:12px}

.app{display:grid;grid-template-columns:236px minmax(0,1fr);height:100vh}
.side{background:var(--card);border-right:1px solid var(--line);display:flex;
  flex-direction:column;overflow:hidden}
.brand{display:flex;align-items:center;gap:9px;padding:16px 18px;border-bottom:1px solid var(--line)}
.brand .mk{width:26px;height:26px;border-radius:8px;flex:0 0 auto;
  background:linear-gradient(140deg,var(--ind-2),var(--ind));display:grid;place-items:center;
  color:#fff;font:700 13px/1 var(--sans)}
.brand b{font-size:15px;letter-spacing:-.02em}
.brand .mute{font-size:13px}
.side .scroll{flex:1;overflow:auto;padding:12px 10px}
.grp{margin-bottom:14px}
.grp h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--mute);
  padding:0 8px;margin-bottom:5px;font-weight:600}
.nav a{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:var(--r-sm);
  font-size:13px;color:var(--fg-2);text-decoration:none;cursor:pointer;line-height:1.3}
.nav a:hover{background:var(--soft)}
.nav a[aria-current=true],.nav a[aria-pressed=true]{background:var(--ind-soft);color:var(--ind);
  font-weight:600}
.nav a .lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav a .n{margin-left:auto;font:11.5px var(--mono);color:var(--mute);
  background:var(--soft);border-radius:var(--r-pill);padding:1px 7px}
.nav a[aria-pressed=true] .n{background:var(--card);color:var(--ind)}
.ic{width:16px;flex:0 0 16px;display:grid;place-items:center;opacity:.8}
.side .foot{border-top:1px solid var(--line);padding:12px}
.teamcard{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-md);
  background:var(--soft);border:1px solid var(--line)}
.teamcard .av{width:30px;height:30px;border-radius:9px;
  background:linear-gradient(140deg,var(--teal),var(--blue));
  display:grid;place-items:center;color:#fff;font-size:14px}
.teamcard .t1{display:block;font-size:10.5px;color:var(--mute);line-height:1.2}
.teamcard .t2{display:block;font-size:12.5px;font-weight:600;line-height:1.25;max-width:118px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.main{display:flex;flex-direction:column;min-width:0;overflow:hidden}
.tbar{display:flex;align-items:center;gap:14px;padding:12px 22px;background:var(--card);
  border-bottom:1px solid var(--line)}
.search{flex:0 1 400px;display:flex;align-items:center;gap:8px;background:var(--soft);
  border:1px solid var(--line);border-radius:var(--r-pill);padding:7px 14px}
.search input{border:0;background:transparent;outline:0;font:inherit;color:var(--fg);width:100%}
.search .k{font:11px var(--mono);color:var(--mute);background:var(--card);
  border:1px solid var(--line-2);border-radius:5px;padding:1px 6px;white-space:nowrap}
.who{display:flex;align-items:center;gap:9px;padding-left:14px;border-left:1px solid var(--line)}
.who .av{width:32px;height:32px;border-radius:10px;
  background:linear-gradient(140deg,var(--ind-2),var(--ind));
  display:grid;place-items:center;color:#fff;font:600 12px var(--sans)}
.who .n1{display:block;font-size:12.5px;font-weight:600;line-height:1.25}
.who .n2{display:block;font-size:11px;color:var(--mute);line-height:1.25}

.scrollmain{flex:1;overflow:auto;padding:20px 22px 40px}
.scrollmain.fixed{overflow:hidden;padding-bottom:22px}
.phead{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.phead h1{font-size:22px}
.ctl{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:var(--r-sm);
  border:1px solid var(--line-2);background:var(--card);font-size:12.5px;color:var(--fg-2);
  cursor:pointer;white-space:nowrap}
.ctl:hover{border-color:var(--ind);color:var(--ind)}
.ctl .cr{color:var(--mute);font-size:10px}

.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
.chd{display:flex;align-items:center;gap:9px;padding:15px 18px 0}
.chd .ci{width:28px;height:28px;border-radius:var(--r-sm);background:var(--soft);
  display:grid;place-items:center;font-size:14px}
.chd h2{font-size:14px}
.cbody{padding:14px 18px 18px}

.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(224px,1fr));gap:14px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:15px 17px;
  box-shadow:var(--sh)}
.kpi .top{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.kpi .ci{width:28px;height:28px;border-radius:var(--r-sm);background:var(--soft);
  display:grid;place-items:center;font-size:14px}
.kpi .lb{font-size:13px;color:var(--fg-2);font-weight:500}
.kpi .i{margin-left:auto;color:var(--line-2);font-size:13px;cursor:help}
.kpi .row{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.kpi .v{font:600 27px/1.1 var(--sans);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.kpi .v .u{font-size:15px;color:var(--mute);margin-left:1px}
.kpi .sub{font-size:11.5px;color:var(--mute);margin-top:7px}
.delta{display:inline-flex;align-items:center;gap:3px;font:600 11.5px var(--sans);
  padding:2px 8px;border-radius:var(--r-pill);white-space:nowrap;font-variant-numeric:tabular-nums}
.delta.up{background:var(--up-bg);color:var(--up)}
.delta.dn{background:var(--dn-bg);color:var(--dn)}
.delta.flat{background:var(--soft);color:var(--mute)}

.grid2{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(0,1fr);gap:14px;margin-bottom:14px}
.grid3{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.9fr);gap:14px}
@media(max-width:1180px){.grid2,.grid3{grid-template-columns:minmax(0,1fr)}}

.headline{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 0 4px}
.headline .big{font:600 26px/1.1 var(--sans);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.headline .hint{font-size:12px;color:var(--mute)}

svg.chart{display:block;width:100%;height:auto;overflow:visible}
svg.chart .lbl{fill:var(--mute);font:10.5px var(--mono)}
svg.chart .val{fill:var(--fg-2);font:600 11px var(--sans)}
.legend{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:12px;
  font-size:11.5px;color:var(--mute)}
.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;
  vertical-align:-1px}
.gstats{display:flex;gap:0;margin-bottom:6px}
.gstats>div{flex:1;padding-left:11px;border-left:3px solid var(--line-2)}
.gstats .k{font-size:11.5px;color:var(--mute);margin-bottom:3px}
.gstats .v{font:600 18px/1.1 var(--sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums}

.dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex:0 0 auto}
.dot.live{background:var(--live)}.dot.stale{background:var(--stale)}.dot.down{background:var(--down)}
.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:var(--r-pill);
  font:600 11.5px var(--sans);white-space:nowrap}
.pill.live{background:var(--live-bg);color:var(--live)}
.pill.stale{background:var(--stale-bg);color:var(--stale)}
.pill.down{background:var(--down-bg);color:var(--down)}
.chip{display:inline-block;padding:2px 9px;border-radius:var(--r-pill);background:var(--soft);
  border:1px solid var(--line);font-size:11.5px;color:var(--mute);white-space:nowrap;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.pulse{position:relative}
.pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--live);
  opacity:.5;animation:p 2.4s ease-out infinite}
@keyframes p{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.5);opacity:0}}
@media(prefers-reduced-motion:reduce){.pulse::after{animation:none;opacity:.35}}

table{border-collapse:collapse;width:100%;table-layout:fixed}
th{text-align:left;font:600 10.5px var(--sans);text-transform:uppercase;letter-spacing:.07em;
  color:var(--mute);padding:9px 10px;background:var(--soft);white-space:nowrap}
th:first-child{border-radius:var(--r-sm) 0 0 var(--r-sm)}
th:last-child{border-radius:0 var(--r-sm) var(--r-sm) 0}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle;overflow:hidden}
tbody tr:last-child td{border-bottom:0}
.r{text-align:right}
.ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mini{height:5px;border-radius:3px;background:var(--line);overflow:hidden;display:flex}
.mini span{display:block;height:100%;background:var(--ind);border-radius:3px}
.seeall{margin-left:auto;font-size:12.5px;color:var(--ind);font-weight:600;cursor:pointer;
  text-decoration:none}

.listwrap{display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:14px;height:100%;min-height:0}
.listcard{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.listcard .scroll{overflow:auto;flex:1}
.listcard table thead th{position:sticky;top:0;z-index:3;cursor:pointer;user-select:none}
.listcard table thead th[data-dir]{color:var(--ind)}
.listcard table thead th[data-dir]::after{content:" \2193"}
.listcard table thead th[data-dir=asc]::after{content:" \2191"}
.listcard tbody tr{cursor:pointer}
.listcard tbody tr:hover{background:var(--soft)}
.listcard tbody tr[aria-selected=true]{background:var(--ind-soft)}
.det{overflow:auto}
.det .strip{display:flex;height:26px;border-radius:var(--r-sm);overflow:hidden;margin:6px 0 4px}
.det .strip div{min-width:2px;display:flex;align-items:center;justify-content:center;
  font:600 9.5px var(--mono);color:#fff;overflow:hidden}
.det .dl{display:grid;grid-template-columns:58px 1fr;gap:4px 10px;font-size:12px;margin:12px 0}
.det .dl dt{color:var(--mute)}
.det .dl dd{margin:0;word-break:break-word}
.note{background:var(--ind-soft);border-left:3px solid var(--ind);padding:9px 11px;
  border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:12.5px;line-height:1.5;margin:9px 0}
.claims{font:11.5px/1.75 var(--mono);max-height:170px;overflow:auto;background:var(--soft);
  border-radius:var(--r-sm);padding:9px 11px}
.claims div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clearform{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px}
.cleared{margin:0 0 12px;color:var(--up);font-size:12.5px}
.empty{padding:44px;text-align:center;color:var(--mute);font-size:13px}
```

### Step 4: watch it pass, then commit

```
node --test tests/station-shell.test.js
git add assets/station/station.html assets/station/station.css tests/station-shell.test.js
```

The `git add` is not tidiness: Constraint 6 says `tests/source.test.js` cannot see an untracked file, so a green run before staging proves nothing about the new ones.

---

## Task 2: `assets/station/station.js` — the two views

**Files:**
- Modify: `assets/station/station.js` — created here: helpers, facet state, overview and list views
- Read: `assets/station/station.html` — the element ids it looks up
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: the ids `side`, `q`, `gen`, `nreg`, `cfg`, `page` from Task 1
- Produces: `module.exports = { tokens, mins, hours, usd, ago, day, stamp, esc, cost, labels, delta, match }` for `node --test`. The DOM half is not exported and is not unit tested; the artefact criterion covers it through `serve`.

**Dispatch:** implementer, sonnet — the code is in this task; it is transcription plus the helper tests.

### Step 1: the failing test

Create `tests/station-view.test.js`:

```js
'use strict';

// The browser half of the page cannot be driven from `node --test` — there is
// no DOM here and no dependency may be added to get one. What can be tested is
// every function that decides a number or a string before any element is
// touched, so that is what the view file exports. The rendering itself is
// checked against the served page, which is what the plan's success criterion
// is for.

const test = require('node:test');
const assert = require('node:assert/strict');

const V = require('../assets/station/station.js');

test('tokens rounds the way the page prints', () => {
    assert.equal(V.tokens(null), '—');
    assert.equal(V.tokens(0), '0');
    assert.equal(V.tokens(999), '999');
    assert.equal(V.tokens(1500), '2k');
    assert.equal(V.tokens(1500000), '1.5M');
    assert.equal(V.tokens(12000000), '12M');
});

test('mins climbs through hours into days', () => {
    assert.equal(V.mins(null), '—');
    assert.equal(V.mins(90 * 1000), '2m');
    assert.equal(V.mins(3600 * 1000), '1h');
    assert.equal(V.mins(5400 * 1000), '1h30m');
    assert.equal(V.mins(90000 * 1000), '1d1h');
});

test('usd prints cents under a hundred and none above', () => {
    assert.equal(V.usd(0), '—');
    assert.equal(V.usd(2.5), '$2.50');
    assert.equal(V.usd(239.37), '$239');
});

test('esc closes every hole the page could open', () => {
    assert.equal(V.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
    assert.equal(V.esc(null), '');
});

test('cost adds the session and its agents', () => {
    assert.equal(V.cost({ usd: 1.5, agentUsd: 2.25 }), 3.75);
    assert.equal(V.cost({}), 0);
});

test('labels give each root the shortest tail nothing else shares', () => {
    const out = V.labels(['/a/b/datapacks', '/c/d/datapacks', '/e/notes']);
    assert.equal(out['/e/notes'], 'notes');
    assert.equal(out['/a/b/datapacks'], 'b/datapacks');
    assert.equal(out['/c/d/datapacks'], 'd/datapacks');
});

test('labels stop growing when one root nests inside another', () => {
    // TODO.md files this under "Needs a decision": growing cannot separate a
    // root from its own parent, because one runs out of segments first. The
    // guard is what stops the loop; the shorter label is allowed to repeat.
    const out = V.labels(['/a/b', '/a/b/c']);
    assert.equal(typeof out['/a/b'], 'string');
    assert.equal(typeof out['/a/b/c'], 'string');
});

test('delta says so rather than dividing by an empty window', () => {
    assert.match(V.delta(5, 0), /前期無資料/);
    assert.match(V.delta(12, 10), /\+20%/);
    assert.match(V.delta(8, 10), /-20%/);
});

test('delta in points reads a rise in waiting as bad', () => {
    const worse = V.delta(0.6, 0.4, 'pt');
    assert.match(worse, /\+20\.0 pt/);
    assert.match(worse, /class="delta dn"/);
    assert.match(V.delta(0.4, 0.6, 'pt'), /class="delta up"/);
});

test('match reads state, registry, stage and free text', () => {
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'rework the ramp',
        project: 'Waypoint', id: 'abc', label: 'a', claims: ['lib/badge.js'],
        notes: [], next: '',
    };
    assert.equal(V.match(s, { q: '', state: 'live', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: '', state: 'down', project: '', stage: '' }), false);
    assert.equal(V.match(s, { q: 'badge.js', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'nothing here', state: '', project: '', stage: '' }), false);
});

test('the model and the state are still free-text terms', () => {
    // Both were terms on the page this replaces. A facet covers state; nothing
    // covers the model, so the search box has to.
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'x', project: 'p', id: 'i',
        label: 'a', model: 'claude-opus-5', claims: [], notes: [], next: '',
    };
    assert.equal(V.match(s, { q: 'opus', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'live', state: '', project: '', stage: '' }), true);
});
```

Run it and watch every case fail — `assets/station/station.js` does not exist.

### Step 2: the helpers and the export block

Create `assets/station/station.js`, starting with the part `node --test` reaches:

```js
'use strict';

// The station page, rendered in the browser from `window.STATION`. Loaded by
// `station.html` after `station-data.js`, so the model is already there.
//
// Everything above the `module.exports` guard is a pure function and is unit
// tested; everything below it touches the document and is checked against the
// served page instead. The split is not a preference — this repository carries
// no dependencies, so there is no DOM in `node --test` to render into.

(function (w, doc) {
    var S = w.STATION || { sessions: [], projects: [] };
    var ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var STAGE_C = {
        survey: '#94a3b8', design: '#8b5cf6', plan: '#f472b6', build: '#4c3fd7',
        verify: '#14b8a6', audit: '#3b82f6', land: '#64748b',
    };
    var PAL = ['#4c3fd7', '#7c6cf0', '#3b82f6', '#14b8a6', '#7fe7d4', '#c7ccd9'];
    var WD = ['日', '一', '二', '三', '四', '五', '六'];

    function tokens(n) {
        if (n === null || n === undefined) return '—';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
        if (n >= 1e3) return Math.round(n / 1e3) + 'k';
        return String(n);
    }
    function mins(ms) {
        if (ms === null || ms === undefined || !isFinite(ms)) return '—';
        var m = Math.round(ms / 60000);
        if (m < 60) return m + 'm';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
        return Math.floor(h / 24) + 'd' + (h % 24 ? (h % 24) + 'h' : '');
    }
    function hours(ms) { return (ms / 3.6e6).toFixed(ms >= 3.6e7 ? 0 : 1) + 'h'; }
    function usd(n) { return n ? '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2)) : '—'; }
    function ago(ms) {
        if (!ms) return '—';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3.6e6) return Math.round(d / 6e4) + 'm ago';
        if (d < 8.64e7) return Math.round(d / 3.6e6) + 'h ago';
        return Math.round(d / 8.64e7) + 'd ago';
    }
    function day(iso) { return typeof iso === 'string' ? iso.slice(0, 10) : '—'; }
    function stamp(ms) {
        return isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—';
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function cost(s) { return (s.usd || 0) + (s.agentUsd || 0); }

    // The shortest tail of a root's segments that no other root shares. Moved
    // here from `lib/station.js`'s `navLabels` when the nav became a facet: the
    // rule is the same and the guard is still what bounds it, because two roots
    // where one nests inside the other cannot be separated by growing — the
    // inner one runs out of segments first. TODO.md files that case.
    function labels(roots) {
        var segs = roots.map(function (r) {
            return String(r).split(/[\\/]+/).filter(Boolean);
        });
        var depth = roots.map(function () { return 1; });
        var at = function (i) { return segs[i].slice(-depth[i]).join('/'); };
        for (var guard = 0; guard < 50; guard++) {
            var ls = roots.map(function (_, i) { return at(i); });
            var counts = {};
            ls.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
            var grew = false;
            ls.forEach(function (l, i) {
                if (counts[l] > 1 && depth[i] < segs[i].length) { depth[i] += 1; grew = true; }
            });
            if (!grew) break;
        }
        var out = {};
        roots.forEach(function (r, i) { out[r] = at(i); });
        return out;
    }

    // Two windows of very different completeness sit beside each other here:
    // this repository's usage records begin on 2026-09-04 and its burn records
    // on 08-28, so a previous window holding nothing would otherwise print
    // +13000%. An empty comparison says it is empty. A ratio moves in
    // percentage points, and a rise in waiting is the bad direction.
    function delta(cur, prev, unit) {
        if (unit === 'pt') {
            var pp = (cur - prev) * 100;
            if (!prev && !cur) return '<span class="delta flat">無可比</span>';
            var c2 = Math.abs(pp) < 0.5 ? 'flat' : pp > 0 ? 'dn' : 'up';
            return '<span class="delta ' + c2 + '">' + (pp > 0 ? '+' : '') + pp.toFixed(1)
                + ' pt ' + (c2 === 'up' ? '↘' : c2 === 'dn' ? '↗' : '') + '</span>';
        }
        if (!prev) return '<span class="delta flat">前期無資料</span>';
        var d = (cur - prev) / prev * 100;
        var cls = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'dn';
        var n = Math.abs(d) >= 100 ? Math.round(d) : Number(d.toFixed(1));
        return '<span class="delta ' + cls + '">' + (d > 0 ? '+' : '') + n + '% '
            + (cls === 'up' ? '↗' : cls === 'dn' ? '↘' : '') + '</span>';
    }

    // One predicate for every view. A facet and the search box are AND-ed, so
    // the KPI cards, the charts and the table all narrow together — which is
    // the thing the old page could not do, because its rows were markup by the
    // time they reached the browser.
    function match(s, f) {
        if (f.state && s.state !== f.state) return false;
        if (f.project && s.root !== f.project) return false;
        if (f.stage && s.stage !== f.stage) return false;
        if (f.q) {
            // The model is in here because it was a filter term on the old page
            // and dropping it would be a silent loss: nothing tells a reader
            // that `opus` stopped matching.
            // Guarded, every one of them: an absent `model` joined raw puts the
            // string `undefined` in the haystack, and a search for it matches
            // every session that has no model.
            var t = [s.task, s.project, s.id, s.label, s.model || '', s.state,
                (s.claims || []).join(' '), (s.notes || []).join(' '), s.next || '']
                .join(' ').toLowerCase();
            if (t.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        return true;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
            stamp: stamp, esc: esc, cost: cost, labels: labels, delta: delta, match: match,
        };
    }
    if (!doc) return;
```

The guard is what lets one file be both a browser script and a `require`. `node --test` reaches the exports and returns before touching `document`; the browser has no `module`, skips the block, and carries on into the code below.

### Step 3: the views

Continue `assets/station/station.js` — the DOM half, after the `if (!doc) return;`:

```js
    var f = { q: '', state: '', project: '', stage: '' };
    var page = 'overview', sel = null, sortKey = 'updated', sortDir = -1;
    var NOW = Date.parse(S.generatedAt);
    var LAB = labels(S.projects.map(function (p) { return p.root; }));
    var sum = function (a, fn) {
        return a.reduce(function (n, x) { return n + (fn(x) || 0); }, 0);
    };
    var rows = function () {
        return S.sessions.filter(function (s) { return match(s, f); });
    };
    var windowed = function (list, from, to) {
        return list.filter(function (s) {
            var t = Date.parse(s.started) || 0;
            return t >= from && t < to;
        });
    };

    function navGroup(title, key, items) {
        return '<div class="grp"><h3>' + title + '</h3><div class="nav">'
            + items.map(function (it) {
                return '<a data-k="' + key + '" data-v="' + esc(it.v) + '" aria-pressed="'
                    + (f[key] === it.v) + '"><span class="ic">' + (it.icon || '') + '</span>'
                    + '<span class="lb" title="' + esc(it.title || it.label) + '">'
                    + esc(it.label) + '</span>'
                    + (it.n === undefined ? '' : '<span class="n">' + it.n + '</span>') + '</a>';
            }).join('') + '</div></div>';
    }
    function drawSide() {
        var n = { live: 0, stale: 0, down: 0 };
        S.sessions.forEach(function (s) { n[s.state]++; });
        var byStage = {};
        S.sessions.forEach(function (s) { byStage[s.stage] = (byStage[s.stage] || 0) + 1; });
        doc.getElementById('side').innerHTML =
            '<div class="grp"><h3>檢視</h3><div class="nav">'
            + '<a data-page="overview" aria-current="' + (page === 'overview') + '">'
            + '<span class="ic">▦</span><span class="lb">總覽</span></a>'
            + '<a data-page="list" aria-current="' + (page === 'list') + '">'
            + '<span class="ic">☰</span><span class="lb">清單</span>'
            + '<span class="n">' + S.sessions.length + '</span></a></div></div>'
            + navGroup('狀態', 'state', [
                { v: '', label: '全部', n: S.sessions.length, icon: '○' },
                { v: 'live', label: 'live', n: n.live, icon: '<i class="dot live"></i>' },
                { v: 'stale', label: 'stale', n: n.stale, icon: '<i class="dot stale"></i>' },
                { v: 'down', label: 'down', n: n.down, icon: '<i class="dot down"></i>' }])
            + navGroup('Registry', 'project',
                [{ v: '', label: '全部專案', n: S.sessions.length, icon: '⌂' }].concat(
                    S.projects.map(function (p) {
                        return {
                            v: p.root, label: LAB[p.root] + (p.gone ? ' — gone' : ''),
                            title: p.root, icon: '▸',
                            n: S.sessions.filter(function (s) { return s.root === p.root; }).length,
                        };
                    }).sort(function (a, b) { return b.n - a.n; })))
            + navGroup('停在哪一階段', 'stage',
                [{ v: '', label: '全部', n: S.sessions.length, icon: '◇' }].concat(
                    ROUTE.filter(function (k) { return byStage[k]; }).map(function (k) {
                        return {
                            v: k, label: k, n: byStage[k],
                            icon: '<i class="dot" style="background:' + STAGE_C[k] + '"></i>',
                        };
                    })));
    }
```

Then the four charts. In `assets/station/station.js`, after `drawSide`, add the KPI row and the stacked flow:

```js
    function kpis(R) {
        var a = windowed(R, NOW - 7 * 864e5, NOW + 864e5);
        var b = windowed(R, NOW - 14 * 864e5, NOW - 7 * 864e5);
        var clock = sum(R, function (s) { return s.clock; });
        var wait = sum(R, function (s) { return s.waited; });
        var ca = sum(a, function (s) { return s.clock; });
        var wa = sum(a, function (s) { return s.waited; });
        var cb = sum(b, function (s) { return s.clock; });
        var wb = sum(b, function (s) { return s.waited; });
        var card = function (icon, label, v, unit, d, sub) {
            return '<div class="kpi"><div class="top"><span class="ci">' + icon + '</span>'
                + '<span class="lb">' + label + '</span>'
                + '<span class="i" title="近 7 天與前 7 天相比">ⓘ</span></div>'
                + '<div class="row"><span class="v">' + v
                + (unit ? '<span class="u">' + unit + '</span>' : '') + '</span>' + d + '</div>'
                + '<div class="sub">' + sub + '</div></div>';
        };
        return '<div class="kpis">'
            + card('◷', 'session', R.length, '', delta(a.length, b.length),
                '近 7 天 ' + a.length + ' 個，前 7 天 ' + b.length + ' 個')
            + card('▤', 'context', tokens(sum(R, function (s) { return s.burn; })), '',
                delta(sum(a, function (s) { return s.burn; }),
                    sum(b, function (s) { return s.burn; })),
                '近 7 天 ' + tokens(sum(a, function (s) { return s.burn; })))
            + card('$', '花費', usd(sum(R, cost)), '', delta(sum(a, cost), sum(b, cost)),
                R.filter(function (s) { return cost(s); }).length + ' / ' + R.length + ' 個有計價')
            + card('◔', '等你的時間', clock ? Math.round(wait / clock * 100) : 0, '%',
                delta(ca ? wa / ca : 0, cb ? wb / cb : 0, 'pt'),
                hours(wait) + ' 等 · ' + hours(clock) + ' 總時')
            + '</div>';
    }

    // Stacked pills, one column per day, with a ribbon joining each registry's
    // segment to its own segment in the next column. The ribbons are what make
    // it a flow rather than six unrelated stacks: a registry that grew from one
    // day to the next widens between them.
    function flow(R) {
        var byDay = {};
        R.forEach(function (s) {
            var d = day(s.started);
            if (d === '—' || !s.burn) return;
            if (!byDay[d]) byDay[d] = {};
            byDay[d][s.root] = (byDay[d][s.root] || 0) + s.burn;
        });
        var days = Object.keys(byDay).sort().slice(-6);
        if (!days.length) return '<div class="empty">這個篩選下沒有 context 紀錄</div>';
        var tot = {};
        days.forEach(function (d) {
            for (var k in byDay[d]) tot[k] = (tot[k] || 0) + byDay[d][k];
        });
        var top = Object.keys(tot).sort(function (x, y) { return tot[y] - tot[x]; }).slice(0, 5);
        var keys = top.concat(['__other']);
        var colour = {}, label = {};
        keys.forEach(function (k, i) { colour[k] = PAL[i]; });
        top.forEach(function (k) { label[k] = LAB[k] || k; });
        label.__other = '其他';
        var cols = days.map(function (d) {
            var v = {}, other = 0;
            for (var k in byDay[d]) {
                if (top.indexOf(k) >= 0) v[k] = byDay[d][k]; else other += byDay[d][k];
            }
            if (other) v.__other = other;
            return {
                day: d, v: v,
                total: Object.keys(v).reduce(function (n, k) { return n + v[k]; }, 0),
            };
        });
        var W = 760, H = 300, padX = 26, padTop = 48, padBot = 32;
        var plotH = H - padTop - padBot, base = H - padBot;
        var max = Math.max.apply(null, cols.map(function (c) { return c.total; })) || 1;
        var span = (W - 2 * padX) / cols.length, cw = Math.min(78, span * 0.56);
        cols.forEach(function (c, i) {
            c.cx = padX + span * (i + 0.5);
            c.seg = {};
            var y = base;
            keys.forEach(function (k) {
                if (!c.v[k]) return;
                var h = c.v[k] / max * plotH;
                c.seg[k] = { top: y - h, bot: y, h: h };
                y -= h;
            });
            c.topY = y;
        });
        var rib = '', bar = '', txt = '';
        for (var i = 0; i < cols.length - 1; i++) {
            (function (A, B) {
                keys.forEach(function (k) {
                    var a = A.seg[k], b = B.seg[k];
                    if (!a || !b) return;
                    var x1 = A.cx + cw / 2, x2 = B.cx - cw / 2;
                    rib += '<path d="M' + x1 + ',' + a.top + ' L' + x2 + ',' + b.top
                        + ' L' + x2 + ',' + b.bot + ' L' + x1 + ',' + a.bot + ' Z" fill="'
                        + colour[k] + '" opacity=".12"/>';
                });
            }(cols[i], cols[i + 1]));
        }
        cols.forEach(function (c) {
            keys.forEach(function (k) {
                var g = c.seg[k];
                if (!g) return;
                var h = Math.max(g.h - 5, 3);
                bar += '<rect x="' + (c.cx - cw / 2) + '" y="' + (g.top + (g.h - h) / 2)
                    + '" width="' + cw + '" height="' + h + '" rx="' + Math.min(7, h / 2)
                    + '" fill="' + colour[k] + '"><title>' + esc(label[k]) + ' ' + c.day + ' '
                    + tokens(c.v[k]) + '</title></rect>';
            });
            txt += '<text class="val" x="' + c.cx + '" y="' + (c.topY - 11)
                + '" text-anchor="middle">' + tokens(c.total) + '</text>'
                + '<text class="lbl" x="' + c.cx + '" y="' + (base + 19)
                + '" text-anchor="middle">' + c.day.slice(5) + '</text>';
        });
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
            + ' aria-label="每天 context，依 registry"' + '>' + rib + bar + txt + '</svg>'
            + '<div class="legend">' + keys.filter(function (k) {
                return cols.some(function (c) { return c.v[k]; });
            }).map(function (k) {
                return '<span><i style="background:' + colour[k] + '"></i>'
                    + esc(label[k]) + '</span>';
            }).join('') + '</div>';
    }
```

In `assets/station/station.js`, after `flow`, add the weekday bars, the gauge and the stage ledger:

```js
    function weekBars(R) {
        var days = [];
        for (var i = 6; i >= 0; i--) {
            var t = NOW - i * 864e5, d = new Date(t).toISOString().slice(0, 10);
            days.push({
                d: d, wd: WD[new Date(t).getUTCDay()],
                n: R.filter(function (s) { return day(s.started) === d; }).length,
            });
        }
        var max = Math.max.apply(null, days.map(function (x) { return x.n; })) || 1;
        var W = 300, H = 270, padBot = 26, plotH = H - padBot - 30, bw = 26;
        var span = W / days.length, out = '';
        days.forEach(function (x, i) {
            var h = Math.max(x.n / max * plotH, 4), cx = span * (i + 0.5), y = H - padBot - h;
            var hot = x.n === max && x.n > 0;
            out += '<rect x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="'
                + h + '" rx="' + Math.min(12, h / 2) + '" fill="'
                + (hot ? 'url(#g1)' : 'var(--line)') + '"><title>' + x.d + ' · ' + x.n
                + ' 個</title></rect>'
                + (hot ? '<text class="val" x="' + cx + '" y="' + (y - 8)
                    + '" text-anchor="middle">' + x.n + '</text>' : '')
                + '<text class="lbl" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">'
                + x.wd + '</text>';
        });
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
            + ' aria-label="近七天每天開了幾個"><defs>'
            + '<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0" stop-color="#7c6cf0"/><stop offset="1" stop-color="#4c3fd7"/>'
            + '</linearGradient></defs>' + out + '</svg>';
    }

    function gauge(pct) {
        var W = 240, H = 140, cx = 120, cy = 118, r = 88, t = 18;
        var pt = function (a, rad) {
            var x = Math.PI * (180 - a) / 180;
            return [cx + Math.cos(x) * rad, cy - Math.sin(x) * rad];
        };
        var arc = function (a0, a1, rad, col, wid) {
            var p0 = pt(a0, rad), p1 = pt(a1, rad);
            return '<path d="M' + p0[0].toFixed(1) + ',' + p0[1].toFixed(1) + ' A' + rad + ','
                + rad + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(1) + ','
                + p1[1].toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + wid
                + '" stroke-linecap="round"/>';
        };
        var ticks = '';
        for (var a = 8; a <= 172; a += 8) {
            var p0 = pt(a, r + 13), p1 = pt(a, r + 19);
            ticks += '<line x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) + '" x2="'
                + p1[0].toFixed(1) + '" y2="' + p1[1].toFixed(1)
                + '" stroke="var(--line-2)" stroke-width="1.5"/>';
        }
        return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="等待佔比 '
            + pct + '%"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">'
            + '<stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#4c3fd7"/>'
            + '</linearGradient></defs>' + ticks
            + arc(0, 180, r, 'var(--line)', t)
            + arc(0, Math.max(pct / 100 * 180, 2), r, 'url(#g2)', t)
            + '<text x="' + cx + '" y="' + (cy - 16) + '" text-anchor="middle"'
            + ' style="font:600 32px var(--sans);fill:var(--fg);letter-spacing:-.03em">'
            + pct + '%</text>'
            + '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="lbl">'
            + '在等你回話</text></svg>';
    }

    function stageLedger(R) {
        var st = {};
        R.forEach(function (s) {
            s.stages.forEach(function (w) {
                if (!st[w.stage]) st[w.stage] = { n: 0, ms: 0, wait: 0, burn: 0, usd: 0 };
                var x = st[w.stage];
                x.n++;
                x.ms += Math.max(w.to - w.from, 0);
                x.wait += w.waited || 0;
                x.burn += w.burn || 0;
                x.usd += w.usd || 0;
            });
        });
        var max = Math.max.apply(null, ROUTE.map(function (k) {
            return st[k] ? st[k].ms + st[k].wait : 0;
        })) || 1;
        return '<table><colgroup><col style="width:86px"><col><col style="width:70px">'
            + '<col style="width:70px"><col style="width:56px"></colgroup>'
            + '<thead><tr><th>階段</th><th>做事 / 等你</th><th class="r">context</th>'
            + '<th class="r">花費</th><th class="r">等待</th></tr></thead><tbody>'
            + ROUTE.map(function (k) {
                var x = st[k];
                if (!x) return '';
                return '<tr><td><span class="chip" style="background:' + STAGE_C[k]
                    + '1f;border-color:transparent;color:' + STAGE_C[k] + ';font-weight:600">'
                    + k + '</span></td>'
                    + '<td><div class="mini"><span style="width:' + (x.ms / max * 100)
                    + '%;background:' + STAGE_C[k] + '"></span><span style="width:'
                    + (x.wait / max * 100) + '%;background:' + STAGE_C[k] + '38"></span></div>'
                    + '<div class="mute" style="font-size:10.5px;margin-top:4px">'
                    + hours(x.ms) + ' 做事 · ' + hours(x.wait) + ' 等你</div></td>'
                    + '<td class="r num mute">' + tokens(x.burn) + '</td>'
                    + '<td class="r num">' + usd(x.usd) + '</td>'
                    + '<td class="r num" style="color:'
                    + (x.wait > x.ms ? 'var(--dn)' : 'var(--mute)') + '">'
                    + Math.round(x.wait / (x.ms + x.wait || 1) * 100) + '%</td></tr>';
            }).join('') + '</tbody></table>';
    }
```

In `assets/station/station.js`, after `stageLedger`, add the two shared cells and the overview page:

```js
    function taskCell(s) {
        return '<div class="ell" title="' + esc(s.task) + '" style="font-weight:500">'
            + esc(s.task || '（未命名）') + '</div>'
            + '<div class="mute ell" style="font-size:11px;margin-top:2px">'
            + esc(LAB[s.root] || s.label) + ' · ' + ago(s.updated) + '</div>';
    }
    function stageCell(s) {
        var pct = s.steps ? Math.round(s.step / s.steps * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:8px">'
            + '<div class="mini" style="flex:1"><span style="width:' + pct + '%;background:'
            + (STAGE_C[s.stage] || 'var(--ind)') + '"></span></div>'
            + '<span class="mono mute" style="font-size:11px">' + s.step + '/' + s.steps
            + '</span></div><div class="mute" style="font-size:11px;margin-top:3px">'
            + esc(s.stage || '—') + '</div>';
    }
    function statePill(s) {
        return '<span class="pill ' + s.state + '"><i class="dot ' + s.state
            + (s.state === 'live' ? ' pulse' : '') + '"></i>' + s.state + '</span>';
    }

    // A gone registry keeps its facet, so selecting it has to say why the pane
    // went empty. Without this the page answers a click with a blank screen and
    // the reader cannot tell a gone registry from a filter that matched nothing.
    function goneNote() {
        if (!f.project) return '';
        var hit = S.projects.filter(function (p) { return p.root === f.project; });
        if (!hit.length || !hit[0].gone) return '';
        return '<div class="card" style="margin-bottom:14px"><div class="cbody">'
            + '<p style="margin:0"><b>' + esc(hit[0].root) + '</b></p>'
            + '<p class="mute" style="margin:4px 0 0">gone — no sessions/ here any more. '
            + 'The registry keeps its place until it is forgotten by name: '
            + '<code>station.js --forget</code>.</p></div></div>';
    }

    function overview() {
        var R = rows();
        var recent = R.slice().sort(function (a, b) {
            return (b.updated || 0) - (a.updated || 0);
        }).slice(0, 7);
        var clock = sum(R, function (s) { return s.clock; });
        var wait = sum(R, function (s) { return s.waited; });
        var burn = sum(R, function (s) { return s.burn; });
        var a = windowed(R, NOW - 7 * 864e5, NOW + 864e5);
        var b = windowed(R, NOW - 14 * 864e5, NOW - 7 * 864e5);
        return '<div class="phead"><h1>總覽</h1><span class="chip">'
            + (f.project ? esc(LAB[f.project]) : '全部 ' + S.projects.length + ' 個 registry')
            + '</span><span class="spacer"></span>'
            + '<span class="ctl" data-page="list">☰ 清單</span></div>'
            + (isFinite(S.cleared)
                ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + goneNote()
            + kpis(R)
            + '<div class="grid2">'
            + '<div class="card"><div class="chd"><span class="ci">◧</span>'
            + '<h2>context 流向</h2></div><div class="cbody">'
            + '<div class="headline"><span class="big">' + tokens(burn) + '</span>'
            + delta(sum(a, function (s) { return s.burn; }),
                sum(b, function (s) { return s.burn; }))
            + '<span class="hint">近 6 天，每一疊是一天，色塊是一個 registry</span></div>'
            + flow(R) + '</div></div>'
            + '<div class="card"><div class="chd"><span class="ci">▥</span>'
            + '<h2>近七天</h2></div><div class="cbody">'
            + '<div class="headline"><span class="big">' + a.length + '</span>'
            + delta(a.length, b.length) + '</div>'
            + '<div class="mute" style="font-size:11.5px;margin:-2px 0 8px">開始的 session</div>'
            + weekBars(R) + '</div></div></div>'
            + '<div class="grid3">'
            + '<div class="card"><div class="chd"><span class="ci">◕</span>'
            + '<h2>時間去哪了</h2></div><div class="cbody"><div class="gstats">'
            + '<div style="border-color:var(--ind)"><div class="k">做事</div>'
            + '<div class="v">' + hours(clock - wait) + '</div></div>'
            + '<div style="border-color:var(--teal)"><div class="k">等你</div>'
            + '<div class="v">' + hours(wait) + '</div></div>'
            + '<div><div class="k">總時</div><div class="v">' + hours(clock) + '</div></div>'
            + '</div>' + gauge(clock ? Math.round(wait / clock * 100) : 0) + '</div></div>'
            + '<div class="card"><div class="chd"><span class="ci">◫</span><h2>七個階段</h2>'
            + '<span class="spacer"></span><a class="seeall" data-page="list">全部 '
            + R.length + ' 個 →</a></div>'
            + '<div class="cbody" style="padding-top:8px">' + stageLedger(R) + '</div></div>'
            + '</div>'
            + '<div class="card" style="margin-top:14px"><div class="chd"><span class="ci">☰</span>'
            + '<h2>最近動過的</h2><span class="spacer"></span>'
            + '<a class="seeall" data-page="list">看全部 →</a></div>'
            + '<div class="cbody" style="padding-top:8px"><table>'
            + '<colgroup><col><col style="width:150px"><col style="width:78px">'
            + '<col style="width:78px"><col style="width:86px"></colgroup>'
            + '<thead><tr><th>任務</th><th>階段</th><th class="r">context</th>'
            + '<th class="r">花費</th><th>狀態</th></tr></thead><tbody>'
            + recent.map(function (s) {
                return '<tr data-id="' + esc(s.id) + '"><td>' + taskCell(s) + '</td><td>'
                    + stageCell(s) + '</td><td class="r num mute">' + tokens(s.burn) + '</td>'
                    + '<td class="r num">' + usd(cost(s)) + '</td><td>' + statePill(s)
                    + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }
```

In `assets/station/station.js`, after `overview`, add the list page and its detail pane:

```js
    // `started` has a column of its own because the page this replaces sorted
    // by it, and a sort key with no header is a sort nobody can reach.
    var COLS = [['task', '任務'], ['stage', '階段'], ['burn', 'context'],
        ['cost', '花費'], ['state', '狀態'], ['started', '開始'], ['updated', '最後動作']];
    function val(s, k) {
        if (k === 'cost') return cost(s);
        if (k === 'state') return { live: 0, stale: 1, down: 2 }[s.state];
        if (k === 'started') return Date.parse(s.started) || 0;
        return s[k];
    }
    function listPage() {
        // A gone registry has no rows to lay out, and the grid below is sized
        // against the page head alone — so the note replaces the table rather
        // than sitting above it and pushing the list off the bottom.
        var gone = goneNote();
        if (gone) {
            return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
                + '<span class="spacer"></span>'
                + '<span class="ctl" data-page="overview">▦ 總覽</span></div>' + gone;
        }
        return '<div class="phead"><h1>清單</h1><span class="chip" id="cnt"></span>'
            + '<span class="spacer"></span>'
            + '<span class="ctl" data-page="overview">▦ 總覽</span></div>'
            + '<div class="listwrap" style="height:calc(100% - 54px)">'
            + '<div class="card listcard"><div class="scroll"><table>'
            + '<colgroup><col><col style="width:130px"><col style="width:80px">'
            + '<col style="width:78px"><col style="width:86px"><col style="width:86px">'
            + '<col style="width:92px"></colgroup>'
            + '<thead id="lh"></thead><tbody id="lb"></tbody></table></div></div>'
            + '<div class="card det" id="det"></div></div>';
    }
    function drawList() {
        // The gone-registry branch of listPage() renders no table.
        if (!doc.getElementById('lb')) return;
        var R = rows().sort(function (a, b) {
            var x = val(a, sortKey), y = val(b, sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return sortDir * String(x).localeCompare(String(y));
            }
            return sortDir * ((x || 0) - (y || 0));
        });
        doc.getElementById('cnt').textContent = R.length + ' / ' + S.sessions.length;
        doc.getElementById('lh').innerHTML = '<tr>' + COLS.map(function (c) {
            return '<th data-k="' + c[0] + '"'
                + (['burn', 'cost'].indexOf(c[0]) >= 0 ? ' class="r"' : '')
                + (sortKey === c[0] ? ' data-dir="' + (sortDir > 0 ? 'asc' : 'desc') + '"' : '')
                + '>' + c[1] + '</th>';
        }).join('') + '</tr>';
        doc.getElementById('lb').innerHTML = R.map(function (s) {
            return '<tr data-id="' + esc(s.id) + '" aria-selected="' + (sel === s.id) + '">'
                + '<td>' + taskCell(s) + '</td><td>' + stageCell(s) + '</td>'
                + '<td class="r num mute">' + tokens(s.burn) + '</td>'
                + '<td class="r num">' + usd(cost(s)) + '</td>'
                + '<td>' + statePill(s) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + day(s.started) + '</td>'
                + '<td class="num mute" style="font-size:11.5px">' + ago(s.updated) + '</td></tr>';
        }).join('') || '<tr><td colspan="7"><div class="empty">沒有符合的 session</div></td></tr>';
        if (R.length && !R.some(function (s) { return s.id === sel; })) sel = R[0].id;
        drawDetail();
    }

    // The clear control is the one place the served page and the written file
    // differ, and both forms come out of the data rather than out of two
    // renderers: `serve` is true only when a server produced this data file, and
    // `nonce` is the token that server will check. A file on disk has neither,
    // so it prints the command instead.
    function clearControl(s) {
        if (s.state !== 'stale') return '';
        if (S.serve) {
            return '<form class="clearform" method="post" action="/clear">'
                + '<input type="hidden" name="root" value="' + esc(s.root) + '">'
                + '<input type="hidden" name="id" value="' + esc(s.id) + '">'
                + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                + '<label><input type="checkbox" name="force" value="1"> force</label>'
                + '<button class="ctl" type="submit">clear</button></form>';
        }
        return '<div class="claims" style="margin-top:14px">node '
            + esc(S.plugin || '<plugin>') + '/scripts/task.js clear ' + esc(s.id)
            + ' --root "' + esc(s.root) + '" --session &lt;your session id&gt;</div>';
    }
    function drawDetail() {
        var d = doc.getElementById('det');
        if (!d) return;
        var hit = S.sessions.filter(function (x) { return x.id === sel; });
        if (!hit.length) { d.innerHTML = '<div class="empty">選一列</div>'; return; }
        var s = hit[0];
        var tot = s.stages.reduce(function (n, w) {
            return n + Math.max(w.to - w.from, 0);
        }, 0) || 1;
        d.innerHTML = '<div class="cbody" style="padding-top:16px">'
            + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;'
            + 'flex-wrap:wrap">' + statePill(s)
            + '<span class="chip" title="' + esc(s.root) + '">' + esc(LAB[s.root] || s.label)
            + '</span>'
            + (s.model ? '<span class="chip mono">'
                + esc(s.model.replace(/^claude-/, '')) + '</span>' : '') + '</div>'
            + '<h2 style="font-size:15px;line-height:1.45;margin-bottom:12px">'
            + esc(s.task || '（未命名）') + '</h2>'
            + (s.stages.length
                ? '<div class="strip">' + s.stages.map(function (w) {
                    var p = Math.max(w.to - w.from, 0) / tot * 100;
                    return '<div style="width:' + p + '%;background:'
                        + (STAGE_C[w.stage] || '#888') + '" title="' + esc(w.stage) + ' · '
                        + mins(w.to - w.from) + '">'
                        + (p > 11 ? esc(w.stage.slice(0, 5)) : '') + '</div>';
                }).join('') + '</div>'
                + '<table style="margin-top:10px"><colgroup><col><col style="width:56px">'
                + '<col style="width:58px"><col style="width:56px"></colgroup>'
                + '<thead><tr><th>階段</th><th class="r">時間</th><th class="r">ctx</th>'
                + '<th class="r">等你</th></tr></thead><tbody>'
                + s.stages.map(function (w) {
                    return '<tr><td><i class="dot" style="background:'
                        + (STAGE_C[w.stage] || '#888') + '"></i> ' + esc(w.stage) + '</td>'
                        + '<td class="r num">' + mins(w.to - w.from) + '</td>'
                        + '<td class="r num mute">' + tokens(w.burn) + '</td>'
                        + '<td class="r num mute">' + mins(w.waited) + '</td></tr>';
                }).join('') + '</tbody></table>'
                : '<p class="mute" style="font-size:12px">沒有分階段紀錄</p>')
            + (s.next ? '<div class="note"><b>下一步</b><br>' + esc(s.next) + '</div>' : '')
            + (s.notes.length
                ? '<div class="note" style="background:var(--soft);border-color:var(--line-2)">'
                + s.notes.map(esc).join('<br>') + '</div>' : '')
            + '<dl class="dl"><dt>session</dt><dd class="mono" style="font-size:10.5px">'
            + esc(s.id) + '</dd>'
            + '<dt>route</dt><dd class="mono" style="font-size:11px">'
            + esc(s.route.join(' → ')) + '</dd>'
            + '<dt>開始</dt><dd class="num">' + stamp(Date.parse(s.started)) + '</dd>'
            + '<dt>最後</dt><dd class="num">' + stamp(s.updated) + '</dd>'
            + (s.ended ? '<dt>結束</dt><dd>' + esc(s.ended.reason) + '</dd>' : '')
            + '<dt>總計</dt><dd class="num">' + tokens(s.burn) + ' · ' + usd(cost(s))
            + (s.agents ? ' · ' + s.agents + ' agents' : '') + '</dd>'
            + '<dt>guard</dt><dd>' + esc(s.guard || 'ask (預設)') + '</dd></dl>'
            + '<h3 style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;'
            + 'color:var(--mute);margin:14px 0 6px">碰過的檔案 ' + s.claims.length + '</h3>'
            + (s.claims.length
                ? '<div class="claims">' + s.claims.map(function (p) {
                    return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
                }).join('') + '</div>'
                : '<p class="mute" style="font-size:12px">沒有</p>')
            + clearControl(s) + '</div>';
    }
```

Finally, in `assets/station/station.js`, close the file with the wiring:

```js
    function draw() {
        var p = doc.getElementById('page');
        p.className = 'scrollmain' + (page === 'list' ? ' fixed' : '');
        p.innerHTML = page === 'list' ? listPage() : overview();
        if (page === 'list') drawList();
        drawSide();
    }
    doc.addEventListener('click', function (e) {
        var pg = e.target.closest('[data-page]');
        if (pg) { page = pg.getAttribute('data-page'); sel = null; draw(); return; }
        var a = e.target.closest('a[data-k]');
        if (a) { f[a.getAttribute('data-k')] = a.getAttribute('data-v'); draw(); return; }
        var th = e.target.closest('th[data-k]');
        if (th) {
            var k = th.getAttribute('data-k');
            if (k === sortKey) sortDir = -sortDir;
            else { sortKey = k; sortDir = k === 'task' ? 1 : -1; }
            drawList();
            return;
        }
        var tr = e.target.closest('tr[data-id]');
        if (tr && page === 'list') {
            sel = tr.getAttribute('data-id');
            [].forEach.call(doc.querySelectorAll('#lb tr'), function (x) {
                x.setAttribute('aria-selected', x.getAttribute('data-id') === sel);
            });
            drawDetail();
        }
    });
    doc.getElementById('q').addEventListener('input', function (e) {
        f.q = e.target.value;
        draw();
    });
    doc.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
        if (e.key === '/') { e.preventDefault(); doc.getElementById('q').focus(); }
    });

    doc.getElementById('gen').textContent = '掃描於 ' + stamp(NOW)
        + ' · 價目表 ' + S.pricesVerified
        + (S.serve ? ' · 每次載入都重讀 registry' : '');
    doc.getElementById('nreg').textContent = S.projects.length + ' 個 registry · '
        + S.sessions.length + ' sessions';
    doc.getElementById('cfg').textContent = String(S.configDir || '').replace(/^.*[\\/]/, '')
        || S.configDir;
    doc.getElementById('cfg').title = S.configDir || '';
    draw();
}(typeof window === 'undefined' ? {} : window,
  typeof document === 'undefined' ? null : document));
```

### Step 4: watch it pass, then commit

```
node --test tests/station-view.test.js
git add assets/station/station.js tests/station-view.test.js
```

---

## Task 3: `lib/station.js` — `serialize`, and `write()` emits four files

**Files:**
- Modify: `lib/station.js` — `render()` returns the shell; new `serialize()` and `ASSETS`; `write()` emits four files; the markup builders go
- Read: `assets/station/station.html` — the file `render()` returns
- Read: `assets/station/station.css` — read by `emit()` on every write
- Read: `assets/station/station.js` — read by `emit()` on every write
- Read: `lib/registry.js` — `ensureIgnored(projectRoot, names)`, which now takes four names
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `assets/station/station.html`, `assets/station/station.css` and `assets/station/station.js` from Tasks 1 and 2
- Produces: `serialize(model, opts)` returning `window.STATION = <json>;\n`; `ASSETS` as the absolute path of `assets/station/`; `write()`'s return shape unchanged at `{ file, copy, registries, live, stale, down }`

**Dispatch:** implementer, sonnet — the deletions are named and the new functions are written out here.

### Step 1: the failing tests

This file already has what these need: `fixture()` at `:19` returns `{ base, cfg, r1, r2 }` with three sessions in two registries — `live one`, `stale one` and `down two` — and `tmp` at `:11` is the shared scratch-directory helper, called with a prefix. There is no shared `model()`, `root` or `NOW` in this file; every test builds its own from `fixture()`, and these follow that.

In `tests/station.test.js`, replace the block at `:686-705` — the three tests that assert `SCRIPT` is inlined and that the page carries exactly one `<script` and no `src` — with:

```js
test('the page is the shell, byte for byte', () => {
    const shell = fs.readFileSync(
        path.join(__dirname, '..', 'assets', 'station', 'station.html'), 'utf8');
    assert.equal(station.render(), shell,
        'render() copies the shell; it does not template it');
});

test('the shell carries no session text and the data file carries all of it', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    const read = (n) => fs.readFileSync(path.join(f.cfg, 'fankeel', n), 'utf8');
    assert.ok(!read('station.html').includes('live one'), 'a task line reached the shell');
    assert.ok(read('station-data.js').includes('live one'), 'the data file lost a task line');
});

test('write leaves exactly the four files beside roots.json', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    assert.deepEqual(
        fs.readdirSync(path.join(f.cfg, 'fankeel')).filter((n) => n !== 'roots.json').sort(),
        ['station-data.js', 'station.css', 'station.html', 'station.js']);
});

test('a second write with the same model rewrites only the data', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    const at = (n) => path.join(f.cfg, 'fankeel', n);
    // Stamped to a fixed past time rather than compared between two writes:
    // both writes land inside the same millisecond, so equal mtimes would
    // pass whether or not the file was rewritten.
    const PAST = new Date('2020-01-01T00:00:00Z');
    const copied = ['station.html', 'station.css', 'station.js'];
    for (const n of copied.concat(['station-data.js'])) fs.utimesSync(at(n), PAST, PAST);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const n of copied) {
        assert.equal(fs.statSync(at(n)).mtimeMs, PAST.getTime(), n + ' was rewritten');
    }
    assert.notEqual(fs.statSync(at('station-data.js')).mtimeMs, PAST.getTime(),
        'the data file was not rewritten');
});

test('serialize flattens the registries into one session list', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const line = station.serialize(m, {});
    assert.match(line, /^window\.STATION = /);
    const back = JSON.parse(line.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(back.registries, undefined, 'the page reads sessions, not registries');
    assert.equal(back.sessions.length,
        m.registries.reduce((n, r) => n + r.sessions.length, 0));
    assert.ok(back.sessions.every((s) => typeof s.root === 'string'),
        'a row lost the registry it came from');
});

test('serialize carries what only a server knows', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const read = (o) => JSON.parse(station.serialize(m, o)
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    const served = read({ serve: true, nonce: 'abc', cleared: 2 });
    assert.equal(served.serve, true);
    assert.equal(served.nonce, 'abc');
    assert.equal(served.cleared, 2);
    const onDisk = read({});
    assert.equal(onDisk.serve, false);
    assert.equal(onDisk.nonce, undefined);
});
```

Every one fails: `station.serialize` is not a function and `render()` still returns a page full of rows.

### Step 2: the flat session list

`gather()` returns registries each holding sessions; the page wants one array with the root on every row, because every facet, chart and sort runs over one list. That flattening is `serialize`'s, not `gather`'s — `gather` has other readers, `--json` among them.

Three deletions sit outside that span and each one fails differently if it is missed.

- `mins` is defined at `:194`, **before** the span. Every call to it is inside the span, so leaving it makes it dead code that nothing reports. Delete `:193-200` — the comment line and the arrow function — as a separate edit.
- `tokens` is not defined in this file at all: `:24` is `const { tokens } = require('./context.js');`, and its four call sites are all inside the span. Delete that line as a separate edit.
- `tally` is defined at `:729`, **inside** the span, and `write()` at `:892` still calls it after `render()` stops doing so. It is carried through the replacement below unchanged rather than deleted.

In `lib/station.js`, replace `esc`, `day`, `stamp`, `dots`, `chart`, `stageTable`, `row`, `BAR`, `SCRIPT`, `CSS`, `tally`, `navLabels`, `navHtml` and `render` — everything from `const esc = ` at `:348` down to the end of `render()` at `:860` — with:

```js
// The shell and its two assets ship as files rather than as template literals,
// so the CSS has syntax highlighting and the view script can be unit tested.
// They are copied rather than referenced: the plugin directory carries its
// version in its path, so a page pointing into it breaks on the next update,
// and the copy under `<root>/.fankeel/` would point outside its own repository.
const ASSETS = path.join(__dirname, '..', 'assets', 'station');

// Every registry's sessions in one array, each carrying the root it came from,
// which is what the facets, the charts and the sort all read. `gather` keeps
// its shape: `--json` and the tests read registries there.
function flatten(model) {
    const sessions = [];
    for (const r of model.registries) {
        for (const s of r.sessions) sessions.push(Object.assign({ root: r.root }, s));
    }
    return sessions;
}

// The one generated file. `opts` carries what only a server knows — whether a
// clear button can post anywhere, the nonce it would post, and the count a
// redirect brought back — so the shell above can stay identical everywhere.
function serialize(model, opts) {
    opts = opts || {};
    const out = {
        generatedAt: model.generatedAt,
        configDir: model.configDir,
        pricesVerified: model.pricesVerified,
        scanStats: model.scanStats || null,
        serve: Boolean(opts.serve),
        projects: model.registries.map((r) => ({
            root: r.root, gone: Boolean(r.gone), unreadable: r.unreadable,
            build: r.build, mapAt: r.mapAt,
        })),
        sessions: flatten(model).map((s) => ({
            id: s.sessionId, root: s.root, project: s.project, task: s.task,
            state: s.state, unknown: s.unknown, stage: s.stage, route: s.route,
            step: s.step, steps: s.steps, started: s.started, updated: s.updated,
            ended: s.ended, model: s.model, burn: s.burn, clock: s.clock, waited: s.waited,
            usd: s.cost && s.cost.priced.length ? s.cost.usd : 0,
            agentUsd: s.agentCost && s.agentCost.priced.length ? s.agentCost.usd : 0,
            unpriced: s.cost && s.cost.unpriced ? s.cost.unpriced : [],
            agents: s.agents ? s.agents.agents : 0,
            requests: s.agents ? s.agents.requests : 0,
            stages: s.stages.map((w) => ({
                stage: w.stage, from: w.from, to: w.to,
                burn: w.burn ? w.burn[1] - w.burn[0] : null,
                usd: w.usd, waited: w.waited,
            })),
            claims: s.claims, notes: s.notes, next: s.next, guard: s.guard,
        })),
    };
    if (opts.nonce) out.nonce = opts.nonce;
    if (opts.plugin) out.plugin = opts.plugin;
    if (Number.isFinite(opts.cleared)) out.cleared = opts.cleared;
    return 'window.STATION = ' + JSON.stringify(out) + ';\n';
}

// `render` keeps its name and its two callers, and now returns the shell. It
// takes the model so the signature does not change under `scripts/station.js`,
// and ignores it: nothing about a machine reaches this file any more.
function render() {
    return fs.readFileSync(path.join(ASSETS, 'station.html'), 'utf8');
}

// Carried through unchanged. It sat inside the span above because `render()`
// counted the header from it; `write()` still counts its return value from it,
// so deleting it with its neighbours would leave `counts` undefined at `:892`.
function tally(model) {
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    return counts;
}
```

### Step 3: `write()` emits four

In `lib/station.js`, replace the middle of `write()` — from `const html = render(model, { plugin: opts.plugin });` at `:870` down to and including the closing brace of the `if (root && hasRegistry(root)) { … }` block at `:887` — with the code below.

**The span stops there on purpose.** The three statements after it stay exactly as they are: the `rememberRoots` call in its own `try`, `const counts = tally(model);`, and the `return`. A replacement running to the `return` drops `counts` while leaving the `return` that reads it, and `write()` then throws — on every prompt, because the prompt hook is what calls it.

```js
    const html = render();
    const dir = path.dirname(stationPath(configDir));
    fs.mkdirSync(dir, { recursive: true });
    const data = serialize(model, { plugin: opts.plugin });
    // The three copied files are compared before they are written, so a prompt
    // that changed nothing rewrites one file rather than four. `hooks/inject.js`
    // calls this on every prompt.
    const emit = (into) => {
        const same = (file, text) => {
            try {
                return fs.readFileSync(file, 'utf8') === text;
            } catch (e) {
                return false;
            }
        };
        for (const [name, text] of [
            ['station.html', html],
            ['station.css', fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8')],
            ['station.js', fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8')],
        ]) {
            const at = path.join(into, name);
            if (!same(at, text)) fs.writeFileSync(at, text);
        }
        fs.writeFileSync(path.join(into, 'station-data.js'), data);
    };
    emit(dir);
    const file = stationPath(configDir);
    // The copy beside the user, and only into a registry that exists: a caller
    // handing over its launch directory must not grow a `.fankeel/` there.
    let copy = null;
    const root = opts.root ? resolved(opts.root) : null;
    if (root && hasRegistry(root)) {
        try {
            registry.ensureIgnored(root, EMITTED);
            const into = path.join(root, '.fankeel');
            emit(into);
            copy = path.join(into, 'station.html');
        } catch (e) {
            copy = null;
        }
    }
```

And above `write()`, in `lib/station.js`, add the list both the emit and the ignore read:

```js
// Four names, in one place, because `.gitignore` and the writer disagreeing is
// how a generated file gets committed. Constraint: `ensureIgnored` appends only
// what is missing, so growing this list is safe on a registry that already has
// the old single line.
const EMITTED = ['station.html', 'station.css', 'station.js', 'station-data.js'];
```

### Step 4: the export block

In `lib/station.js`, replace the last line with:

```js
module.exports = { discover, gather, render, serialize, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED };
```

`SCRIPT` goes. Constraint 4 fails on an exported name nothing imports, and `tests/station.test.js:686` was its only importer — that test is replaced in Step 1.

### Step 5: watch them pass

```
node --test tests/station.test.js
```

Then the whole suite, unpiped, because this task deletes names other files may reach:

```
node --test
```

---

## Task 4: `scripts/station.js` — the three sibling routes

**Files:**
- Modify: `scripts/station.js` — `serve()` answers `/station.css`, `/station.js`, `/station-data.js`
- Read: `lib/station.js` — `serialize` and `render`, the two names it calls
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `serialize(model, opts)` and `render()` from Task 3
- Produces: nothing other tasks read

`ASSETS` is not imported. `lib/station.js` keeps its own private copy for `emit()` and does not export it; this file builds the same path from `PLUGIN`, which it already has.

**Dispatch:** implementer, sonnet — three routes and their tests, written out here.

### Step 1: the failing test

In `tests/station-cli.test.js`, change the two assertions at `:64` and `:97` that grep the written `station.html` for `stale` and `scanned` to read `station-data.js` instead, change `:386` and `:389` the same way, and add:

This file has its own fixture and its own client: `fixture()` at `:19` returns `{ base, cfg, r1 }` with a seeded `roots.json`, and `request(url, opts, body)` at `:47` wraps `node:http` — the file uses that rather than `fetch`, and every existing serve test calls `serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false })`. `s.url` already ends in a slash.

```js
test('serve answers the shell and its three siblings', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        assert.match(page.headers['content-type'], /text\/html/);
        assert.ok(!page.text.includes('window.STATION'), 'the shell inlined the data');

        const data = await request(s.url + 'station-data.js', { method: 'GET' });
        assert.equal(data.status, 200);
        assert.match(data.headers['content-type'], /javascript/);
        assert.match(data.text, /^window\.STATION = /);
        assert.match(data.text, /"serve":true/);

        assert.equal((await request(s.url + 'station.css', { method: 'GET' })).status, 200);
        assert.equal((await request(s.url + 'station.js', { method: 'GET' })).status, 200);
        assert.equal((await request(s.url + 'nothing', { method: 'GET' })).status, 404);
    } finally {
        s.close();
    }
});
```

### Step 2: the routes

In `scripts/station.js`, inside `serve()`'s request handler, replace the `GET /` branch that begins at `:213` with:

```js
        if (req.method === 'GET' && url.pathname === '/') {
            res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'no-store',
            });
            res.end(station.render());
            return;
        }
        if (req.method === 'GET' && url.pathname === '/station-data.js') {
            // Per request, which is what keeps the header's promise that a
            // served page re-reads the registries on every load. `?cleared=N`
            // is what `/clear-stale` redirects with, and the only thing this
            // server takes from a query string: digits only, because anything
            // else is somebody's typing and the page says nothing rather than
            // echoing it into a script.
            const said = url.searchParams.get('cleared');
            const cleared = said !== null && /^\d+$/.test(said) ? Number(said) : undefined;
            res.writeHead(200, {
                'content-type': 'text/javascript; charset=utf-8',
                'cache-control': 'no-store',
            });
            res.end(station.serialize(modelNow(), { serve: true, nonce, plugin: PLUGIN, cleared }));
            return;
        }
        if (req.method === 'GET' && (url.pathname === '/station.css' || url.pathname === '/station.js')) {
            const name = url.pathname.slice(1);
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, name), 'utf8');
            } catch (e) {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('no such asset\n');
                return;
            }
            res.writeHead(200, {
                'content-type': name.endsWith('.css')
                    ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
            });
            res.end(body);
            return;
        }
```

The `/clear-stale` success redirect at `:293` is unchanged — it already answers `303 → /?cleared=N`, and Task 1's shell carries that query onto its own `station-data.js` request, which is what the `cleared` branch above reads.

Add the constant `scripts/station.js` now needs, at the top beside the others:

```js
const ASSETS = path.join(PLUGIN, 'assets', 'station');
```

### Step 3: watch it pass

```
node --test tests/station-cli.test.js
```

---

## Task 5: the three suites that grep the page for a task line

**Files:**
- Modify: `tests/task.test.js` — `:118` and `:123` read `station-data.js`
- Modify: `tests/leave.test.js` — `:116` reads `station-data.js`
- Read: `lib/station.js` — the four emitted names

**Interfaces:**
- Consumes: `write()` from Task 3, which emits `station-data.js`
- Produces: nothing

**Dispatch:** implementer, sonnet — three mechanical changes across two files.

### Step 1: the changes

In `tests/task.test.js`, at `:118`, the assertion that `station.html` includes `tidy the project cards` becomes a read of `station-data.js`:

```js
    const data = fs.readFileSync(path.join(dir, 'fankeel', 'station-data.js'), 'utf8');
    assert.ok(data.includes('tidy the project cards'), 'the task line is not in the data');
```

Still in `tests/task.test.js`, at `:123`, the assertion that the page includes the literal `class="s down"` becomes an assertion about the data, because the class no longer exists — a down session is a `state` field now:

```js
    assert.match(data, /"state":"down"/);
```

`:119`, which asserts the copy byte-equals the main file, stays and now covers the shell.

In `tests/leave.test.js`, at `:116`, the same substitution:

```js
    const data = fs.readFileSync(path.join(dir, 'fankeel', 'station-data.js'), 'utf8');
    assert.ok(data.includes('the ramp'), 'the task line is not in the data');
```

Still in `tests/leave.test.js`, `:119` asserts the page excludes the literal `<plugin>` placeholder; it moves to the data file, where the placeholder now lives:

```js
    assert.ok(!data.includes('<plugin>'), 'the plugin path did not resolve');
```

### Step 2: watch them pass

```
node --test tests/task.test.js tests/leave.test.js
```

---

## Task 6: `docs/station.md` and `.fankeel/.gitignore`

**Files:**
- Modify: `docs/station.md` — the three passages the change makes false
- Modify: `.fankeel/.gitignore` — four generated names
- Read: `lib/station.js` — the shape being described

**Interfaces:**
- Consumes: `EMITTED` from Task 3
- Produces: nothing

**Dispatch:** implementer, sonnet — the replacement prose is written out here.

### Step 1: the gitignore

Replace `.fankeel/.gitignore` with:

```
sessions/
map.md
build/
station.html
station.css
station.js
station-data.js
```

### Step 2: the page

In `docs/station.md`, replace the paragraph at `:214` — "The page carries one inline script — no `src`, nothing fetched, no…" — with:

```markdown
The page is four files. `station.html` is a shell with no session data in it,
copied byte for byte from `assets/station/station.html`; `station.css` and
`station.js` are copied the same way; `station-data.js` is the only generated
one, and holds `window.STATION` — the scan, and nothing else. The shell is
copied rather than pointed at, because the plugin directory carries its version
in its path and the copy under `<root>/.fankeel/` would otherwise point outside
the repository it sits in.

`write()` compares the three copied files before writing them, so a prompt that
changed nothing rewrites `station-data.js` alone. `hooks/inject.js` calls it on
every prompt, which is the reason that comparison is there.
```

In `docs/station.md`, replace the *Filtering and sorting* section at `:212-291` — its heading included — with:

```markdown
### Filtering, and the two views

Everything on the page is built in the browser from `window.STATION`, which is
what lets one filter narrow the charts and the table together: server-side
markup cannot redraw a chart when a facet is clicked.

The left rail is facets, each with its own count — state, registry, stage — and
the search box above them matches task, project, session id, registry label,
the files the task has touched and its notes. They are AND-ed. Selecting a
registry recomputes the four cards, every chart and the list; it does not merely
hide rows.

`navLabels` moved into `assets/station/station.js` as `labels`, unchanged: each
root gets the shortest tail of its path segments no other root shares, and the
full root stays in `title=`. Its one unresolved case is filed under
`## Needs a decision` in `TODO.md` — a root nested inside another runs out of
segments before the two separate, and the guard is what stops the loop.

**總覽** carries four cards with a seven-day-against-previous-seven delta, the
stacked context flow by registry, a weekday bar, the waiting gauge and the
seven-stage ledger. A delta whose previous window holds nothing prints
`前期無資料` rather than a percentage against zero, because this repository's
usage records begin on 2026-09-04 and its burn records on 08-28; the waiting
ratio moves in percentage points, and a rise in it is the bad direction.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
rather than expanding the row, so two sessions can be compared without
scrolling. Sorting is by task, stage, context, cost, state or last action,
clicking twice to reverse. `gather` still returns sessions ordered by `updated`
descending, so the page's first sort is the one it arrived in.

A stale row's clear control is the one thing that differs between the served
page and the file: `window.STATION.serve` is true only when a server produced
the data, and then the pane shows a form posting to `/clear` with that run's
nonce. A file on disk has neither, so it prints the `task.js clear` command to
copy.
```

At `:278`, the citation `lib/station.js:688` refers to a line this change removes. The `emptied` rule it cited went with the sections; delete the sentence carrying it rather than repointing it.

### Step 3: check the citations still resolve

```
node scripts/docs-check.js
```

A `path:line` past the end of a file or a symbol nothing declares fails this, which is what catches a repointed citation that was not repointed.

---

## Coverage

| promise | task |
|---|---|
| `station.html` — the shell, copied verbatim from `assets/station/station.html` | Task 3 |
| `station.css` — copied verbatim from `assets/station/station.css` | Task 3 |
| `station.js` — copied verbatim from `assets/station/station.js` | Task 3 |
| `station-data.js` — the only generated file: `window.STATION = <the model>;` | Task 3 |
| `registry.ensureIgnored(root, [...])` takes all four names, not the one it takes today | Task 3 |
| The three copied files are written only when their bytes differ from what is already there | Task 3 |
| `assets/station/station.html` is a real HTML file with real syntax highlighting | Task 1 |
| It carries no session data, no counts, no timestamps | Task 1 |
| It is not read at runtime from the plugin directory | Task 3 |
| `render(model, opts)` keeps its name and returns the shell, and `write()` keeps the return shape | Task 3 |
| `serve` — true when a server is rendering, which is what puts a `clear` button | Task 3 |
| `nonce` — the per-run token the `clear` form posts back | Task 3 |
| `plugin` — the path printed inside the copyable `task.js clear` command | Task 3 |
| `cleared` — the count `/clear-stale` redirects with | Task 4 |
| `serialize(model, opts)` is a new export that returns the `window.STATION = …;` line | Task 3 |
| A left rail of facets — state, registry, stage — each carrying its count | Task 2 |
| `overview`: four KPI cards with a 7-day-against-previous-7 delta, the stacked context flow… | Task 2 |
| `list`: the sortable table and a detail pane, replacing today's accordion | Task 2 |
| A facet applies to both at once — the KPI numbers, every chart and the table | Task 2 |
| A delta whose previous window holds nothing says so rather than printing a percentage against zero | Task 2 |
| `GET /` returns the shell, from the same `render()` the file write uses | Task 4 |
| `GET /station-data.js` returns `serialize(modelNow(), …)`, so the promise that | Task 4 |
| `GET /station.css` and `GET /station.js` return the plugin's own copies | Task 4 |
| The `clear` and `clear-stale` POST routes are untouched | Task 4 |
| Kept: every filter term the page has today — task, project, session id, model and state | Task 2 |
| Kept: sorting by `updated`, `started`, `cost` and `stage` | Task 2 |
| Kept: `down` rows out of the way by default, and a way to bring them back | struck — the facet replaces the default; `down` is a facet with its count, so the rows are one click away rather than hidden and restored. Recorded in `docs/station.md` by Task 6 |
| Kept: a gone registry keeps its place and says why it is empty | Task 2 |
| Dropped: the `<details>`/`<summary>` accordion. A row opens in the detail pane | Task 2 |
| Dropped: the per-row inline `<svg>` burn curve | Task 2 |
| `station.html` contains no task text; `station-data.js` does | Task 3 |
| The shell written to disk is byte-identical to `assets/station/station.html` | Task 3 |
| `write()` leaves exactly four files, and a second `write()` with an unchanged model rewrites only `station-data.js` | Task 3 |
| `serve` answers 200 on all four paths | Task 4 |
| `serialize()` output parses, and its `sessions.length` equals the model's | Task 3 |
| a test that opens the written `station.html`, loads `station-data.js` beside it, and asserts the page contains no session task text | Task 3 |
| the overview's `累計花費` card equals the sum of `usd + agentUsd` over `STATION.sessions` | verify — read out of the served DOM; no unit test can reach it |
| `docs/station.md:214` — "The page carries one inline script — no `src`, nothing fetched" | Task 6 |
| `docs/station.md:212-291` — the whole *Filtering and sorting* section | Task 6 |
| `docs/station.md:278` — cites `lib/station.js:688`, a line this moves | Task 6 |
| Whether four files stay cheap enough for `hooks/inject.js` | verify — measured there, per the design's `Unverified` |
