---
status: current
last_verified: 2026-09-06
source_of_truth: lib/station.js, lib/usage.js, lib/registry.js, scripts/station.js, hooks/leave.js
---

# Station Reads Back Implementation Plan

**Goal:** every station row carries a curve of what the session spent against how
long it ran, the list above it filters and sorts, and registry discovery stops
forgetting roots and stops being bounded by depth alone.

**Architecture:** per-stage spend is derived at session end by bucketing the
transcript's requests into the windows `clock` already records — no new hook, no
per-prompt transcript read. The chart is hand-written inline `<svg>`; the
controls are one inline `<script>`. Discovery gains a wall-clock deadline
because depth was measured not to bound anything.

**Tech Stack:** Node v24.9.0, CommonJS, `node:test`. **Zero dependencies** —
`package.json` declares neither `dependencies` nor `devDependencies`, so the
chart is written by hand and the page script is vanilla.

**Spec:** [2026-09-06-station-reads-back-design.md](2026-09-06-station-reads-back-design.md)

## Global Constraints

Generated from this project on 2026-09-06, not remembered.

- **No dependency may be added.** `package.json` has no `dependencies` key at
  all. No charting library, no front-end framework.
- **`npm test` is `node --test`.** The spec reporter prints `✔`/`✖` and a
  `ℹ pass` / `ℹ fail` summary. It prints **no TAP `ok` lines** — grepping for
  `ok` returns nothing and that is not a failure signal.
- **Style, from every file in `lib/`:** `'use strict';` as line 1, four-space
  indent, CommonJS `require`, `module.exports` last, and a comment block at the
  top of the file saying *why* rather than *what*. Match it.
- **`tests/source.test.js` reads `git ls-files '*.js'`.** A new `.js` file is
  invisible to it until `git add`. Run the suite after staging, not before.
- **`tests/skills.test.js:42,43,50,51,52`** — a `SKILL.md` frontmatter `name`
  must equal its directory name and match `/^[a-z0-9-]+$/`; its `description`
  must be **longer than 60 and shorter than 500 characters** and must contain
  `Use for` or `Use when`.
- **`tests/contract.test.js`** fails when the version disagrees across
  `package.json`, `.claude-plugin/plugin.json` and every `skills/*/SKILL.md`.
  `scripts/version.js` sets them together. Do not hand-edit a version.
- **`.fankeel/docs.json` roles:** `docs` → reference, `docs/plans` → plan,
  `docs/decisions` → decision, `docs/reports` → report, `docs/archive` →
  archive, `skills` → reference, `output-styles` → reference.
- **`.fankeel/.gitignore` ignores `sessions/`, `map.md`, `build/`,
  `station.html`.** A page a test writes must never be committed.
- **Two existing assertions must keep passing.** `tests/station.test.js:91` —
  the page contains no `<script src=` (an inline `<script>` is fine, and is what
  this plan adds). `tests/station.test.js:65` — `gather()` returns sessions
  ordered by `updated` descending; client-side sorting is a view over that and
  must not change it.
- **Measured on this machine, 2026-09-06:** a depth-8 walk of `F:\` took
  **10,678 ms** over 24,151 directories, found 12 registries and hit the depth
  limit 5,488 times; `C:\Users\Owner` at depth 8 **did not finish inside
  20,000 ms** (35,711 directories, 11,486 depth cuts). Any walk this plan adds
  is bounded by wall-clock, not by depth.

## File structure

| file | responsibility after this change |
|---|---|
| `lib/usage.js` | reads a transcript; now also buckets its requests into stage windows |
| `lib/registry.js` | the entry's shape and its accessors; now also `spendOf` and `seriesOf` |
| `hooks/leave.js` | writes what a session cost when it ends; now also per stage |
| `lib/station.js` | gathers, renders; now also the chart, the controls, the bounded walk |
| `scripts/station.js` | the CLI and the clearing server; now also bulk clear, `--forget`, first-run scan |
| `docs/station.md`, `skills/fankeel-station/SKILL.md` | describe the above, and currently contradict it |

---

## Task 1: `summarise` buckets a transcript by stage

**Files:**
- Modify: `lib/usage.js` — extract the model accumulator, add `opts.stages`, pass `opts` through `summariseTree`
- Test: `tests/usage.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `summarise(transcriptPath, opts)` where `opts` may carry
  `stages: [{ stage: string, from: number, to: number }]`. When it does, the
  return's `usage` gains `stages: { [stage]: { requests: number, models: {...} } }`.
  With no `opts.stages` the return is byte-for-byte what it is today.
  Also `summariseTree(transcriptPath, opts)` — `opts` forwarded to the parent's
  `summarise` only, never to the agents' (an agent's requests are not the
  parent's stages).

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Today the per-request loop stores `{ model, usage }`. It must also store the
line's timestamp, because that is what decides the stage:

```js
const at = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
byRequest.set(key, { model: message.model, usage: message.usage, at });
```

A later line with the same `requestId` overwrites the earlier one, so `at` is
the **last** line's timestamp for free — the same "last line winning" rule the
de-duplication already uses. That is deliberate and is the whole answer to a
request whose lines straddle a stage boundary: one rule, not two.

Extract the accumulator that already exists inline, so the stage buckets do not
duplicate it:

```js
const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });

function addUsage(models, model, usage) {
    const m = models[model] || (models[model] = blank());
    m.input += num(usage.input_tokens);
    m.output += num(usage.output_tokens);
    m.cacheRead += num(usage.cache_read_input_tokens);
    const split = usage.cache_creation;
    if (split && typeof split === 'object') {
        m.cacheWrite5m += num(split.ephemeral_5m_input_tokens);
        m.cacheWrite1h += num(split.ephemeral_1h_input_tokens);
    } else {
        m.cacheWrite5m += num(usage.cache_creation_input_tokens);
    }
}
```

Rewrite the existing totals loop to call it, then add the buckets:

```js
// A stage is a half-open window. The windows come from `clock`, and the last
// one runs to Infinity so that nothing a session spent falls outside the record
// of what it spent.
function stageAt(stages, at) {
    if (!Array.isArray(stages) || !Number.isFinite(at)) return null;
    for (const w of stages) {
        if (at >= w.from && at < w.to) return w.stage;
    }
    return null;
}
```

and, after the totals are built:

```js
let stages;
if (Array.isArray(opts && opts.stages) && opts.stages.length) {
    stages = {};
    for (const { model: id, usage, at } of byRequest.values()) {
        const name = stageAt(opts.stages, at);
        if (name === null) continue;
        const bucket = stages[name] || (stages[name] = { requests: 0, models: {} });
        bucket.requests += 1;
        addUsage(bucket.models, id, usage);
    }
}
return { model, usage: stages ? { requests: byRequest.size, models, stages } : { requests: byRequest.size, models } };
```

`summariseTree` forwards only to the parent call:

```js
function summariseTree(transcriptPath, opts) {
    const own = summarise(transcriptPath, opts);
    const agents = agentsOf(transcriptPath);
    ...
}
```

**Tests** — write these in `tests/usage.test.js`, following the flat
`test('<sentence>', () => {})` shape the file already uses. Build a transcript
with a helper that writes JSONL lines to a temp file:

```js
const line = (req, at, model, usage) => JSON.stringify({
    type: 'assistant', requestId: req, timestamp: new Date(at).toISOString(),
    message: { model, usage },
});
```

1. `test('summarise buckets requests into the stage windows it is given', ...)` —
   four requests at t=10, 20, 110, 120, windows
   `[{stage:'survey',from:0,to:100},{stage:'design',from:100,to:Infinity}]`.
   Assert `usage.stages.survey.requests === 2` and
   `usage.stages.design.requests === 2`, and that
   `usage.requests === 4` and `usage.models` are unchanged from the
   no-`stages` call.
2. `test('a request whose lines straddle a boundary lands in its last line stage', ...)` —
   one `requestId` written twice, at t=90 and t=110, same windows. Assert
   `usage.stages.design.requests === 1` and that `usage.stages.survey` is
   `undefined`.
3. `test('summarise with no stages returns exactly what it returned before', ...)` —
   assert `usage.stages === undefined` and the totals match.

Run: `node --test tests/usage.test.js`. Test 1 fails today with
`usage.stages` undefined.

---

## Task 2: `spendOf` and `seriesOf` on the registry

**Files:**
- Modify: `lib/registry.js` — two new accessors and their exports
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  `spendOf(data, stage)` → `{ requests, models }` or `null`.
  `seriesOf(data)` → `[{ stage, from, to, burn, spend }]`, ordered by `from`,
  where `burn` is the **raw pair** `[first, used]` or `null`, and `spend` is
  what `spendOf` returns.
  `windowsFrom(clock)` → `[{ stage, from, to }]`, ordered by `from`, each
  window running to the next stage's `from` and the last to `Infinity`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`burnOf` returns a **distance** (`seen[1] - seen[0]`), which is the wrong thing
for a curve: a chart needs the height at each end, not the climb between them.
So `seriesOf` reads the pairs directly, with the same validation `burnOf` does.

```js
// What a stage cost, as `hooks/leave.js` bucketed it out of the transcript.
// Absent on every entry written before that hook learned to, and on every
// session still running — `spend` is written once, at the end.
function spendOf(data, stage) {
    const seen = data && data.spend && data.spend[stage];
    return seen && typeof seen === 'object' && seen.models ? seen : null;
}

// The windows a session's stages occupied, for bucketing anything timestamped
// into them. Each runs to the next stage's start rather than to its own last
// touch, so time spent at a gate belongs to the stage that opened the gate and
// nothing falls between two windows. The first starts at -Infinity: the prompt
// that created the entry is older than the entry.
function windowsFrom(clock) {
    if (!clock || typeof clock !== 'object' || Array.isArray(clock)) return [];
    const names = Object.keys(clock).filter((n) =>
        Array.isArray(clock[n]) && clock[n].length === 2 && Number.isFinite(clock[n][0]));
    names.sort((a, b) => clock[a][0] - clock[b][0]);
    return names.map((stage, i) => ({
        stage,
        from: i === 0 ? -Infinity : clock[stage][0],
        to: i + 1 < names.length ? clock[names[i + 1]][0] : Infinity,
    }));
}

// The per-stage series the station's chart is drawn from. Ordered by when the
// stage was entered, which is the x axis.
function seriesOf(data) {
    const clock = data && data.clock && typeof data.clock === 'object' && !Array.isArray(data.clock)
        ? data.clock : null;
    if (!clock) return [];
    const ok = (v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
    const names = Object.keys(clock).filter((n) => ok(clock[n]));
    names.sort((a, b) => clock[a][0] - clock[b][0]);
    return names.map((stage) => ({
        stage,
        from: clock[stage][0],
        to: clock[stage][1],
        burn: data.burn && ok(data.burn[stage]) ? data.burn[stage] : null,
        spend: spendOf(data, stage),
    }));
}
```

Add all three to the `module.exports` list beside `burnOf`.

**Tests** in `tests/registry.test.js`:

1. `test('seriesOf orders stages by when they were entered, not by route order', ...)` —
   an entry whose `clock` keys are inserted `build, survey` with `survey`
   earlier; assert `seriesOf(data).map((w) => w.stage)` is `['survey','build']`.
2. `test('seriesOf carries the raw burn pair, not the distance', ...)` —
   `burn: { survey: [100, 400] }`; assert the entry's `burn` is
   `[100, 400]` while `burnOf(data,'survey')` is `300`.
3. `test('seriesOf leaves burn null for a stage sampled once', ...)` —
   `burn: { survey: [100] }`; assert `burn` is `null` and the stage is still
   present because `clock` has it.
4. `test('windowsFrom runs each stage to the next one and the last to Infinity', ...)` —
   `clock: { survey: [10, 20], design: [30, 40] }`; assert
   `[{stage:'survey',from:-Infinity,to:30},{stage:'design',from:30,to:Infinity}]`.
5. `test('spendOf is null for a stage with no spend recorded', ...)`.

Run: `node --test tests/registry.test.js`. All five fail today — the exports do
not exist.

---

## Task 3: `leave.js` writes `spend` when the session ends

**Files:**
- Modify: `hooks/leave.js` — read the entry's `clock`, build windows, pass them in, write `d.spend`
- Test: `tests/leave.test.js`

**Interfaces:**
- Consumes: `summarise(transcriptPath, opts)` from Task 1 — with `opts.stages`
  set it returns `usage.stages` as `{ [stage]: { requests, models } }`;
  `windowsFrom(clock)` from Task 2 — returns `[{ stage, from, to }]`.
- Produces: the entry field `spend`, a map of stage name to
  `{ requests, models }`, written once at session end beside `usage`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`hooks/leave.js:37` currently reads the transcript before it knows anything about
the entry. It needs the entry's `clock` first, so read the session, then
summarise, then update:

```js
const before = registry.readSession(root, sessionId);
const windows = before ? registry.windowsFrom(before.clock) : [];
const seen = typeof payload.transcript_path === 'string'
    ? usage.summariseTree(payload.transcript_path, windows.length ? { stages: windows } : undefined)
    : null;
```

and inside the update callback, beside the existing `d.usage = seen.usage;`:

```js
if (seen.usage.stages) {
    d.spend = seen.usage.stages;
    delete d.usage.stages;
}
```

`spend` is a field of its own rather than a corner of `usage`, so it sits beside
`burn`, `clock` and `waited` — every other per-stage map on the entry — and so
that a reader of `usage` sees exactly the shape it has always had.

**Tests** in `tests/leave.test.js`, following the fixture style already there:

1. `test('leave writes spend per stage from the clock windows', ...)` — an entry
   with `clock: { survey: [1000, 2000], build: [3000, 4000] }` and a transcript
   holding one request at t=1500 and two at t=3500. Assert
   `spend.survey.requests === 1`, `spend.build.requests === 2`.
2. `test('leave writes no spend when the entry has no clock', ...)` — assert
   `spend` is `undefined` and `usage` is still written.
3. `test('usage keeps the shape it always had', ...)` — assert
   `usage.stages === undefined` on the written entry.

Run: `node --test tests/leave.test.js`. Test 1 fails today — nothing writes `spend`.

---

## Task 4: the curve, and the per-stage table under it

**Files:**
- Modify: `lib/station.js` — `gather()` carries a `stages` series per session; `row()` renders an `<svg>` and a table; `CSS` gains the chart rules
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `seriesOf(data)` from Task 2 — `[{ stage, from, to, burn, spend }]`;
  `costOf(models)` from `lib/prices.js`, unchanged — `{ usd, priced, unpriced }`.
- Produces: on each gathered session, `stages: [{ stage, from, to, burn, usd }]`
  where `usd` is a number or `null`. Task 5 reads `s.stages` for nothing; it is
  this task's alone.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `gather()`, beside `burn: sum(data, registry.burnOf),` add:

```js
stages: registry.seriesOf(data).map((w) => ({
    stage: w.stage,
    from: w.from,
    to: w.to,
    burn: w.burn,
    usd: w.spend && w.spend.models ? prices.costOf(w.spend.models).usd : null,
})),
```

Then the chart, as a module-level function above `row`:

```js
const CHART_W = 320;
const CHART_H = 90;
const PAD = 4;

// Two series in one box, each scaled to its own maximum, because a dual axis is
// unreadable at ninety pixels. The maxima are printed under it, which is where
// the units live.
function chart(stages) {
    const withBurn = stages.filter((w) => w.burn);
    if (withBurn.length < 2) return '<p class="nochart">no burn recorded</p>';
    const t0 = stages[0].from;
    const t1 = stages[stages.length - 1].to;
    const span = t1 - t0 > 0 ? t1 - t0 : 1;
    const x = (t) => PAD + ((t - t0) / span) * (CHART_W - 2 * PAD);
    const poly = (pts, max, cls) => {
        if (pts.length < 2 || !(max > 0)) return '';
        const y = (v) => CHART_H - PAD - (v / max) * (CHART_H - 2 * PAD);
        return `<polyline class="${cls}" points="`
            + pts.map((p) => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ') + `"/>`;
    };

    const burnPts = [];
    for (const w of withBurn) burnPts.push([w.from, w.burn[0]], [w.to, w.burn[1]]);
    const burnMax = burnPts.reduce((n, p) => (p[1] > n ? p[1] : n), 0);

    const spendPts = [];
    let running = 0;
    for (const w of stages) {
        if (w.usd === null) continue;
        spendPts.push([w.from, running]);
        running += w.usd;
        spendPts.push([w.to, running]);
    }

    const rules = stages.map((w) => {
        const at = x(w.from).toFixed(1);
        return `<line class="rule" x1="${at}" y1="${PAD}" x2="${at}" y2="${CHART_H - PAD}"/>`
            + `<text class="rl" x="${(x(w.from) + 2).toFixed(1)}" y="${CHART_H - PAD}">`
            + esc(w.stage.slice(0, 1)) + `</text>`;
    }).join('');

    return `<svg class="curve" viewBox="0 0 ${CHART_W} ${CHART_H}" width="${CHART_W}" height="${CHART_H}"`
        + ` role="img" aria-label="burn and spend over ${esc(mins(t1 - t0))}">`
        + rules + poly(burnPts, burnMax, 'burn') + poly(spendPts, running, 'spend') + `</svg>`
        + `<p class="legend"><span class="kb">burn</span> to ${esc(tokens(burnMax))}`
        + (spendPts.length
            ? ` · <span class="ks">spend</span> to $${running.toFixed(2)}`
            : ' · spend arrives when the session ends')
        + ` · ${esc(mins(t1 - t0))} wide</p>`;
}

// The figures the chart is drawn from, because a curve shows a shape and a
// reader eventually wants the number.
function stageTable(stages) {
    if (!stages.length) return '';
    return `<table class="stages"><tr><th>stage</th><th>mins</th><th>burn</th><th>spend</th></tr>`
        + stages.map((w) => `<tr><td>${esc(w.stage)}</td>`
            + `<td>${esc(mins(w.to - w.from))}</td>`
            + `<td>${esc(w.burn ? tokens(w.burn[1] - w.burn[0]) : '—')}</td>`
            + `<td>${w.usd === null ? '—' : '$' + w.usd.toFixed(2)}</td></tr>`).join('')
        + `</table>`;
}
```

In `row()`, insert both immediately after the opening `<div class="more">` and
before the `<dl>`:

```js
+ `</summary><div class="more">`
+ chart(s.stages) + stageTable(s.stages)
+ `<dl>`
```

Append to `CSS`:

```
svg.curve{display:block;margin:8px 0 2px;max-width:100%;height:auto}
svg.curve .rule{stroke:var(--line);stroke-width:1}
svg.curve .rl{fill:var(--mute);font-size:7px;font-family:ui-monospace,monospace}
svg.curve polyline{fill:none;stroke-width:1.5}
svg.curve polyline.burn{stroke:var(--live)}
svg.curve polyline.spend{stroke:var(--stale)}
.legend{margin:0 0 8px;font-size:11px;color:var(--mute)}
.legend .kb{color:var(--live)}.legend .ks{color:var(--stale)}
.nochart{margin:8px 0;font-size:12px;color:var(--mute)}
table.stages{border-collapse:collapse;font-size:12px;margin:4px 0 8px}
table.stages th,table.stages td{text-align:right;padding:1px 8px 1px 0}
table.stages th:first-child,table.stages td:first-child{text-align:left}
```

**Tests** in `tests/station.test.js`, extending the existing fixture:

1. `test('a session with burn on three stages draws a polyline of six points', ...)` —
   assert the page matches `/<svg class="curve"/`, that the `burn` polyline's
   `points` attribute has **6** coordinate pairs, and that the page contains
   three `<line class="rule"` elements for that row.
2. `test('a session with burn on one stage draws no chart', ...)` — assert the
   page contains `no burn recorded` and, for that row, no `<svg`.
3. `test('a session with no spend says so instead of drawing a spend line', ...)` —
   assert `spend arrives when the session ends` appears and no
   `polyline class="spend"` does.
4. `test('the stage table prints the burn distance, not the pair', ...)` —
   `burn: { survey: [100, 400] }` renders `300` and not `400`.

Run: `node --test tests/station.test.js`. All four fail today.

---

## Task 5: the control bar and the inline script

**Files:**
- Modify: `lib/station.js` — `data-*` attributes on each `<details>`, a `.rows` wrapper per registry, the bar, the script, the CSS
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-4 — `row()` gains attributes, it does not read
  the chart.
- Produces: the DOM contract the script depends on, which nothing else reads:
  each `<details class="s …">` carries `data-updated`, `data-started`,
  `data-cost`, `data-stage` and `data-text` (lower-cased); each registry's rows
  are wrapped in one `<div class="rows">`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

The attributes go on the opening tag in `row()`. `data-text` is lower-cased
**when it is written**, so the filter compares like with like:

```js
const text = [s.task, s.project, s.sessionId, s.model || ''].join(' ').toLowerCase();
return `<details class="s ${s.state}"`
    + ` data-updated="${s.updated || 0}"`
    + ` data-started="${Date.parse(s.started) || 0}"`
    + ` data-cost="${s.cost && s.cost.priced.length ? s.cost.usd : 0}"`
    + ` data-stage="${esc(s.stage)}"`
    + ` data-text="${esc(text)}"`
    + `><summary>`
```

In `render()`, wrap each registry's rows:

```js
body += `<div class="rows">`;
for (const s of r.sessions) body += row(s, opts, r.root);
body += `</div>`;
```

The bar goes immediately after the `<p class="meta">` header, and the
auto-refresh control only when serving — the static file is rewritten by
fankeel's own events, so a timer on it would reload the same bytes:

```js
const BAR = (serve) => `<div class="bar">`
    + `<input type="search" id="q" placeholder="filter: task, project, session, model">`
    + `<span class="meta">sort</span>`
    + ['updated', 'started', 'cost', 'stage'].map((k) =>
        `<button data-sort="${k}" aria-pressed="${k === 'updated' ? 'true' : 'false'}">${k}</button>`).join('')
    + (serve ? `<label><input type="checkbox" id="auto"> auto-refresh</label>` : '')
    + `<span id="shown" class="meta"></span></div>`;
```

The script is inline. **It must never gain a `src`** —
`tests/station.test.js:91` asserts the page has no `<script src=`, and that
assertion is correct and stays:

```js
const SCRIPT = `
(function(){
  var q=document.getElementById('q');
  var groups=[].slice.call(document.querySelectorAll('.rows'));
  var shown=document.getElementById('shown');
  var key='updated',dir=-1;
  function num(el,k){var n=parseFloat(el.getAttribute('data-'+k));return isNaN(n)?-Infinity:n}
  function apply(){
    var term=(q.value||'').toLowerCase(),n=0,total=0;
    groups.forEach(function(g){
      var rows=[].slice.call(g.children);
      rows.forEach(function(r){
        total++;
        var hit=!term||(r.getAttribute('data-text')||'').indexOf(term)!==-1;
        r.hidden=!hit; if(hit)n++;
      });
      rows.sort(function(a,b){
        if(key==='stage')return dir*String(a.getAttribute('data-stage')).localeCompare(String(b.getAttribute('data-stage')));
        return dir*(num(a,key)-num(b,key));
      });
      rows.forEach(function(r){g.appendChild(r)});
    });
    shown.textContent=n===total?total+' shown':n+' of '+total+' shown';
  }
  q.addEventListener('input',apply);
  var bs=[].slice.call(document.querySelectorAll('.bar button[data-sort]'));
  bs.forEach(function(b){b.addEventListener('click',function(){
    var k=b.getAttribute('data-sort');
    if(k===key){dir=-dir}else{key=k;dir=(k==='stage')?1:-1}
    bs.forEach(function(o){o.setAttribute('aria-pressed',o===b?'true':'false')});
    apply();
  })});
  var auto=document.getElementById('auto');
  if(auto){var t=null;auto.addEventListener('change',function(){
    if(auto.checked){t=setTimeout(function(){location.reload()},30000)}else{clearTimeout(t);t=null}
  })}
  apply();
})();
`;
```

emitted from `render()` as `<script>${SCRIPT}</script>` just before `</body>`.

Append to `CSS`:

```
.bar{display:flex;gap:8px;align-items:center;margin:10px 0 4px;flex-wrap:wrap}
.bar input[type=search]{padding:3px 6px;min-width:220px;font:inherit}
.bar button{padding:3px 8px;font:inherit;cursor:pointer}
.bar button[aria-pressed=true]{font-weight:600}
```

**Tests** in `tests/station.test.js`:

1. `test('the page carries an inline script and still no script src', ...)` —
   assert `page.includes('<script>')` **and** `!page.includes('<script src=')`.
   The second half passes today and must keep passing.
2. `test('each row carries the attributes the script sorts on', ...)` — assert a
   row matches `/data-updated="\d+"/`, `/data-started="\d+"/`,
   `/data-cost="[\d.]+"/` and `/data-stage="[a-z]*"/`.
3. `test('data-text is written lower-cased', ...)` — a task named `Live One`
   renders `data-text` containing `live one` and not `Live One`.
4. `test('each registry wraps its rows in one .rows div', ...)` — assert the
   count of `<div class="rows">` equals the number of registries that are not
   `gone`.
5. `test('the auto-refresh control appears only when serving', ...)` — assert
   `id="auto"` is present with `{ serve: true }` and absent without it.

Run: `node --test tests/station.test.js`. Tests 1-5 fail today apart from the
negative half of 1.

---

## Task 6: discovery stops forgetting, and is bounded by time

**Files:**
- Modify: `lib/station.js` — delete `ROOT_TTL_MS` and the pruning, `SCAN_DEPTH` 6 → 8, `scanRoots` takes a deadline and reports its cuts, the header says so
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `scanRoots(dir, depth, opts)` → `{ roots: string[], depthCuts: number, timedOut: boolean }`
  where `opts` may carry `deadline` (epoch ms). **This changes the return shape**
  — it returns a bare array today. `discover()` is the only internal caller.
  `discover(opts)` gains `scanStats: { depthCuts, timedOut }` on its return when
  a scan ran. `rememberRoots(configDir, registries, now)` keeps every root it has
  ever seen.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Three changes, and one of them breaks a passing test on purpose.

**The TTL goes.** Delete `const ROOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;` at
`lib/station.js:52` and the pruning in `rememberRoots` that drops a root stamped
older than it. A root that has gone is already rendered as `gone`; forgetting it
as well means the page silently stops mentioning a registry the user may still
be looking for. **`tests/station.test.js:121-145` asserts the drop and its
assertion inverts** — that test is rewritten here, not deleted:

```js
test('a root that has been gone for a month is still listed', () => {
    // ... stamp a gone root 31 days old, write, re-read
    assert.ok(Object.keys(after).includes(goneRoot), 'a gone root is kept, not forgotten');
});
```

**Depth 6 → 8, with a deadline beside it.** Depth was measured not to bound the
walk: `F:\` at depth 8 took 10.7 s and `C:\Users\Owner` did not finish in 20 s.

```js
const SCAN_DEPTH = 8;

// Depth is the backstop; the deadline is the control. Measured 2026-09-06, a
// depth-8 walk of one drive took 10.7 seconds and a home directory did not
// finish inside twenty, so a walk that only counts directories is not bounded
// by anything a user would wait for.
function scanRoots(dir, depth, opts) {
    const deadline = opts && Number.isFinite(opts.deadline) ? opts.deadline : Infinity;
    const roots = [];
    let depthCuts = 0;
    let timedOut = false;
    const walk = (at, left) => {
        if (timedOut) return;
        if (Date.now() > deadline) { timedOut = true; return; }
        if (left < 0) { depthCuts += 1; return; }
        let ents;
        try {
            ents = fs.readdirSync(at, { withFileTypes: true });
        } catch (e) {
            return;
        }
        if (hasRegistry(at)) roots.push(at);
        for (const e of ents) {
            if (!e.isDirectory()) continue;
            if (SCAN_SKIP.has(e.name) || e.name.startsWith('.')) continue;
            walk(path.join(at, e.name), left - 1);
            if (timedOut) return;
        }
    };
    walk(resolved(dir), typeof depth === 'number' ? depth : SCAN_DEPTH);
    return { roots, depthCuts, timedOut };
}
```

Update `discover()`'s call site to read `.roots` and to carry the two counters
out on its return.

**The header says what the walk could not reach.** In `render()`, extend the
`<p class="meta">` line:

```js
+ (model.scanStats && model.scanStats.depthCuts
    ? ` · depth stopped the scan in ${model.scanStats.depthCuts} places` : '')
+ (model.scanStats && model.scanStats.timedOut ? ' · the scan ran out of time' : '')
```

`gather()` passes `found.scanStats` onto the model it returns.

**Tests** in `tests/station.test.js`:

1. Rewrite the 31-day case as above — a gone root is kept.
2. `test('scanRoots finds a registry seven levels down', ...)` — build the
   fixture seven deep; assert it is in `.roots`. Fails today at depth 6.
3. `test('scanRoots stops when its deadline is spent and says so', ...)` — pass
   `{ deadline: Date.now() - 1 }`; assert `timedOut === true` and
   `roots.length === 0`.
4. `test('scanRoots counts the places depth cut it', ...)` — a fixture nine
   deep scanned at depth 2; assert `depthCuts > 0`.
5. `test('the header reports a scan that ran out of time', ...)` — assert the
   page contains `the scan ran out of time`.

Run: `node --test tests/station.test.js`.

---

## Task 7: the CLI — bulk clear, `--forget`, and a first run that scans once

**Files:**
- Modify: `scripts/station.js` — a `/clear-stale` route, a `--forget <dir>` flag, a once-only budgeted auto-scan
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: `scanRoots(dir, depth, { deadline })` → `{ roots, depthCuts, timedOut }`
  from Task 6; `clearEntry(root, id, { force })` → `{ ok, reason, data, age }`
  from `lib/clear.js`, unchanged.
- Produces: nothing another task reads.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**`force` is already done.** The form in `lib/station.js` renders the checkbox
and `scripts/station.js:114` already passes
`force: form.get('force') === '1'`. Do not rebuild it and do not write a test
that would pass today.

**`POST /clear-stale`**, beside the existing `/clear` route, clearing every
stale row in one registry:

```js
if (req.method === 'POST' && url.pathname === '/clear-stale') {
    const form = new URLSearchParams(await readBody(req));
    if (form.get('nonce') !== nonce) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('wrong nonce: open the page this server printed and try again\n');
        return;
    }
    const model = station.gather(gatherOpts);
    const reg = model.registries.find((r) => r.root === path.resolve(form.get('root') || ''));
    if (!reg) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('no such registry on this page\n');
        return;
    }
    const force = form.get('force') === '1';
    let cleared = 0;
    const refused = [];
    for (const s of reg.sessions) {
        if (s.state !== 'stale') continue;
        const out = clearEntry(reg.root, s.sessionId, { force });
        if (out.ok) cleared += 1;
        else if (out.reason !== 'inactive') refused.push(s.sessionId + ': ' + out.reason);
    }
    if (refused.length) {
        res.writeHead(409, { 'content-type': 'text/plain' });
        res.end('cleared ' + cleared + '; refused ' + refused.length + '\n' + refused.join('\n') + '\n');
        return;
    }
    res.writeHead(303, { location: '/' });
    res.end();
    return;
}
```

The form for it goes in `render()` under each registry's meta line, when
serving, with the count in the button so the confirm is the label:

```js
opts.serve && r.sessions.some((s) => s.state === 'stale')
    ? `<form class="clear" method="post" action="/clear-stale"`
        + ` onsubmit="return confirm('Clear ' + ${r.sessions.filter((s) => s.state === 'stale').length} + ' stale rows?')">`
        + `<input type="hidden" name="root" value="${esc(r.root)}">`
        + `<input type="hidden" name="nonce" value="${esc(opts.nonce || '')}">`
        + `<label><input type="checkbox" name="force" value="1"> force</label> `
        + `<button type="submit">clear all `
        + r.sessions.filter((s) => s.state === 'stale').length + ` stale</button></form>`
    : ''
```

**`--forget <dir>`** removes one root from `roots.json` and prints what is left.
Argument parsing follows the file's existing `--scan` handling exactly.

**The first run scans once, under a budget.** With no `roots.json` at all:

```js
// Once, from the CLI, and never from `station.write()`. `hooks/inject.js` calls
// write() on every /fankeel prompt, and a walk measured at 10.7 seconds for one
// drive would stall the prompt that triggered it. Five seconds is what a person
// will wait for a command they typed; anything the budget cut is still reachable
// with --scan.
const AUTO_BUDGET_MS = 5000;
```

Record the fact in `roots.json` under a `scannedAt` key so it never repeats,
whether or not it found anything, and print one line saying how long it took,
how many roots it found and whether the budget or the depth cut it.

**Tests** in `tests/station-cli.test.js`:

1. `test('POST /clear-stale clears every stale row in one registry', ...)` — two
   stale and one live; assert 303, both stale become `active: false`, the live
   one stays `active: true`.
2. `test('POST /clear-stale refuses without the nonce', ...)` — assert 403 and
   nothing changed.
3. `test('POST /clear-stale reports the rows it refused', ...)` — a fresh stale
   row without `force`; assert 409 and the body names the count.
4. `test('--forget drops one root and keeps the rest', ...)`.
5. `test('the first run scans once and records that it did', ...)` — assert
   `roots.json` gains `scannedAt` and that a second run does not walk again.

Run: `node --test tests/station-cli.test.js`. All five fail today.

---

## Task 8: the documents this change makes false

**Files:**
- Modify: `docs/station.md` — the sorting/filtering claim, the 30-day TTL, the chart, `spend`, `/clear-stale`, `--forget`, the deadline
- Modify: `skills/fankeel-station/SKILL.md` — the same, in the short form
- Modify: `docs/README.md` — index rows for this plan and its design
- Test: none written; `node scripts/docs-check.js` and `node scripts/todo-check.js` are the gate

**Interfaces:**
- Consumes: the finished behaviour of Tasks 1-7.
- Produces: nothing any task reads.

**Dispatch:** in-session — these pages describe the code as it finally landed,
so they are written by the session that watched it land and can check each claim
against the file rather than against the plan.

`docs/station.md` contradicts this change twice today: it claims no sorting or
filtering exists, and it documents the 30-day TTL. Both are rewritten, not
patched around.

`skills/fankeel-station/SKILL.md` must keep passing `tests/skills.test.js`: its
frontmatter `name` stays `fankeel-station`, and its `description` stays longer
than 60 and shorter than 500 characters and keeps the words `Use for`.

**Do not hand-edit any version string.** `tests/contract.test.js` fails when the
ten files disagree; `scripts/version.js` is what sets them together, and that
belongs to `land`.

Run: `node scripts/docs-check.js` and `node scripts/todo-check.js`, both to exit
zero, on an unpiped run — a pipe swallows the exit code.

---

## Self-review

**Spec coverage.** Curve → Task 4. Per-stage spend → Tasks 1, 2, 3. Filter,
sort, auto-refresh → Task 5. Row fields (the stage table) → Task 4. Actions →
Task 7. Discovery → Tasks 6, 7. Documents → Task 8. No requirement is without a
task, and one spec item — the `force` flag — was **removed** from the spec at
this gate because it already works.

**Placeholders.** None. Every task carries its code, its `**Files:**`, its
`**Interfaces:**` and its `**Dispatch:**` line.

**Type consistency.** `spend` is the entry field; `usage.stages` is what
`summarise` returns and Task 3 moves it to `spend`, deleting it from `usage` so
there is only one name on disk. `seriesOf` returns the raw `burn` pair;
`burnOf` returns the distance; Task 4's table prints the distance and the chart
plots the pair, which is the one place both are used and it is deliberate.
`scanRoots` returns an object everywhere after Task 6 — no caller is left
expecting the array.
