'use strict';
// Every fankeel session on this machine, as data and as a page.
//
// Discovery is the part nothing else here does. A registry is per workspace and
// `findStateRoot` walks up from one directory, so no reader knows more than one.
// Five sources, unioned: the `root=` field of every lead under `modes/`, the
// `cwd` of every running Claude Code session walked up to its registry, the
// roots file every `write` below rewrites, any directory the caller asks to
// have walked, and whatever the caller names. Leads are pointers and die with
// the badge; the roots file is what remembers; the registry is the record.
//
// Liveness is asked of `runningIds` directly rather than through `readLive`,
// whose self-check is right for a hook — a scan that cannot see the caller is
// a scan not to be trusted — and wrong for a page with no session of its own.
// A directory that cannot be read still counts as live, as `docs/collisions.md`
// says, and the row says `live?` so the doubt is visible.
const fs = require('node:fs');
const path = require('node:path');
const registry = require('./registry.js');
const badge = require('./badge.js');
const live = require('./live.js');
const prices = require('./prices.js');
const { positionIn } = require('./stages.js');
const { tokens } = require('./context.js');

const resolved = (p) => {
    try {
        return path.resolve(String(p));
    } catch (e) {
        return null;
    }
};

const hasRegistry = (root) => {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'sessions')).isDirectory();
    } catch (e) {
        return false;
    }
};

function rootsPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'roots.json');
}

// What the lead forgets. A lead is cleared with its badge — at `down`, `clear`,
// `adopt` and the prompt after a stand-down — so a registry with no task
// running in it has nothing pointing at it, and on 2026-09-05 the page found 3
// of at least 11. This file is rewritten by every `write`: a root seen with a
// `sessions/` directory is stamped now, and a root that has gone keeps its
// last stamp for good — it is already rendered as `gone`, and forgetting it
// too would mean the page silently stops mentioning a registry the user may
// still be looking for.

function readRawRoots(configDir) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(rootsPath(configDir), 'utf8'));
    } catch (e) {
        return {};
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

// A root record is a key whose value is an ISO date string. Anything else in
// this file belongs to another writer — `scripts/station.js` keeps its
// `scannedAt` object here — and is not a root.
const isRootRecord = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));

function readRoots(configDir) {
    const out = {};
    for (const [root, seen] of Object.entries(readRawRoots(configDir))) {
        if (isRootRecord(seen)) out[root] = seen;
    }
    return out;
}

// Written to a sibling and renamed, the way `lib/registry.js` writes an entry:
// `task.js`, `inject.js` and `leave.js` can all write this in the same second,
// and a torn read here is the page forgetting every registry at once.
//
// This writer owns the root records and nothing else in the file. Every key
// that is not one is carried across untouched: `write()` runs on every
// `/fankeel` prompt, so a key rebuilt away here does not survive its first
// hook, and the CLI's `scannedAt` — the record that the once-only first-run
// walk already happened — is meant to be durable.
function rememberRoots(configDir, registries, now) {
    const old = readRawRoots(configDir);
    const next = {};
    for (const [key, value] of Object.entries(old)) {
        if (!isRootRecord(value)) next[key] = value;
    }
    for (const r of registries) {
        if (!r.gone) next[r.root] = new Date(now).toISOString();
        else if (isRootRecord(old[r.root])) next[r.root] = old[r.root];
    }
    const file = rootsPath(configDir);
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n');
    registry.renameRetrying(temp, file);
    return next;
}

// The one-off walk behind `--scan`: every directory under `dir` that holds
// `.fankeel/sessions/`. Not a default and not a hook — a home directory is
// minutes, and %TEMP% held 297,088 test fixtures on 2026-09-05.
const SCAN_SKIP = new Set(['node_modules', '.git']);
const SCAN_DEPTH = 8;

// Depth is the backstop; the deadline is the control. Measured 2026-09-06, a
// depth-8 walk of one drive took 10.7 seconds and a home directory did not
// finish inside twenty, so a walk that only counts directories is not bounded
// by anything a user would wait for.
// `opts.now` is a seam and not a feature: with the real clock, the only
// reproducible deadline a test can set is one already spent, and that returns on
// the first line of `walk` — an implementation that checked the deadline once
// before the walk began would pass it identically. A counting clock lets a test
// spend the deadline *between* two directories, which is the only way to see
// that this check sits inside the recursion. Production passes no `now`.
function scanRoots(dir, depth, opts) {
    const deadline = opts && Number.isFinite(opts.deadline) ? opts.deadline : Infinity;
    const now = opts && typeof opts.now === 'function' ? opts.now : Date.now;
    const roots = [];
    let depthCuts = 0;
    let timedOut = false;
    const walk = (at, left) => {
        if (timedOut) return;
        if (now() > deadline) { timedOut = true; return; }
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

function discover(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const seen = new Set();
    const gone = new Set();
    const add = (root) => {
        const abs = root && resolved(root);
        if (!abs) return;
        (hasRegistry(abs) ? seen : gone).add(abs);
    };
    for (const lead of badge.readLeads(configDir)) add(lead.fields.root);
    for (const s of live.runningSessions(configDir) || []) {
        if (s.cwd) add(registry.findStateRoot(s.cwd));
    }
    for (const root of Object.keys(readRoots(configDir))) add(root);
    // One deadline shared by every `--scan` directory, the way `autoScan`
    // shares one across drives: a caller that budgeted the walk budgeted all
    // of it. Without this the deadline branch above is dead in production and
    // `timedOut` can only ever be true in a test that calls `scanRoots` itself.
    const deadline = Number.isFinite(opts.deadline) ? opts.deadline : undefined;
    let scanStats = null;
    for (const dir of opts.scan || []) {
        const found = scanRoots(dir, undefined, { deadline });
        if (!scanStats) scanStats = { depthCuts: 0, timedOut: false };
        scanStats.depthCuts += found.depthCuts;
        scanStats.timedOut = scanStats.timedOut || found.timedOut;
        for (const root of found.roots) add(root);
    }
    for (const root of opts.roots || []) add(root);
    if (opts.cwd) add(registry.findStateRoot(opts.cwd));
    if (opts.root) add(opts.root);
    const out = { roots: [...seen].sort(), gone: [...gone].sort() };
    if (scanStats) out.scanStats = scanStats;
    return out;
}

// Minutes, rounded, with hours above sixty of them — the shape `task.js` uses.
const mins = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? h + 'h' + r + 'm' : h + 'h';
};

const sum = (data, of) => {
    let total = null;
    for (const stage of Array.isArray(data.route) ? data.route : []) {
        const v = of(data, stage);
        if (v !== null) total = (total || 0) + v;
    }
    return total;
};

function buildDirs(root) {
    const dir = path.join(root, '.fankeel', 'build');
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of names) {
        if (!d.isDirectory()) continue;
        let files = 0;
        try {
            files = fs.readdirSync(path.join(dir, d.name), { recursive: true, withFileTypes: true })
                .filter((f) => f.isFile()).length;
        } catch (e) { /* counted as zero */ }
        out.push({ name: d.name, files });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function mapDate(root) {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'map.md')).mtime.toISOString();
    } catch (e) {
        return null;
    }
}

function gather(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const found = discover(opts);
    // One liveness scan per config dir this page needs, for the life of this call.
    const scans = new Map();
    const idsIn = (dir) => {
        if (!scans.has(dir)) scans.set(dir, live.runningIds(dir));
        return scans.get(dir);
    };
    const registries = [];
    for (const root of found.roots) {
        const all = registry.readAll(root);
        const sessions = [];
        for (const { sessionId, data } of all.entries) {
            const theirs = typeof data.configDir === 'string' && data.configDir ? data.configDir : configDir;
            const ids = idsIn(theirs);
            const running = ids ? ids.has(sessionId) : true;
            const at = positionIn(data.route, data.stage) || {};
            const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
            sessions.push({
                sessionId,
                state: data.active !== true ? 'down' : running ? 'live' : 'stale',
                unknown: data.active === true && !ids,
                task: typeof data.task === 'string' ? data.task : '',
                project: registry.projectOf ? (registry.projectOf(data) || '') : (data.project || ''),
                stage: typeof data.stage === 'string' ? data.stage : '',
                route: Array.isArray(data.route) ? data.route : [],
                step: at.step || 0,
                steps: at.steps || 0,
                started: typeof data.started === 'string' ? data.started : null,
                updated: registry.updatedAt(data),
                ended: data.ended && typeof data.ended === 'object' ? data.ended : null,
                model: typeof data.model === 'string' ? data.model : null,
                usage,
                cost: usage && usage.models ? prices.costOf(usage.models) : null,
                agents: usage && usage.subagents && typeof usage.subagents === 'object' ? usage.subagents : null,
                agentCost: usage && usage.subagents && usage.subagents.models ? prices.costOf(usage.subagents.models) : null,
                burn: sum(data, registry.burnOf),
                // `costOf` returns `usd: 0` for a stage whose models the table
                // does not price, which is indistinguishable from a stage that
                // genuinely cost nothing: the table would print `$0.00` and the
                // cumulative curve would count the stage as free. `row()`
                // already reads `priced.length` for the summary cell; an
                // unpriced stage is `null` here for the same reason, and the
                // table prints `—` while the curve steps over it.
                stages: registry.seriesOf(data).map((w) => {
                    const spend = w.spend && w.spend.models ? prices.costOf(w.spend.models) : null;
                    return {
                        stage: w.stage,
                        from: w.from,
                        to: w.to,
                        burn: w.burn,
                        usd: spend && spend.priced.length ? spend.usd : null,
                        waited: w.waited,
                    };
                }),
                clock: sum(data, registry.clockOf),
                waited: sum(data, registry.waitedOf),
                claims: registry.claimsOf(data),
                notes: registry.notesOf(data),
                next: registry.nextOf(data),
                guard: typeof data.guard === 'string' ? data.guard : '',
                configDir: theirs,
            });
        }
        sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [] });
    }
    // A caller that walked the machine itself — `scripts/station.js`'s
    // first-run `autoScan` — hands its own numbers in, and they win: `discover`
    // never saw that walk, so what it found here is silence rather than a
    // second opinion. Only when nothing is handed in does the walk `discover`
    // did for `opts.scan` speak.
    const handed = opts.scanStats && typeof opts.scanStats === 'object' ? opts.scanStats : null;
    return {
        generatedAt: new Date(now).toISOString(),
        configDir,
        pricesVerified: prices.verified,
        registries,
        scanStats: handed || found.scanStats,
    };
}

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '—');
const stamp = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—');
const dots = (step, steps) => (steps ? '●'.repeat(Math.min(step, steps)) + '○'.repeat(Math.max(0, steps - step)) : '');

const CSS = `
:root{--bg:#fafaf8;--fg:#1d1d1b;--mute:#6b6b66;--line:#e2e2dc;--live:#2f7d32;--stale:#b26a00;--down:#8a8a85;--panel:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#e8e8e2;--mute:#9a9a92;--line:#2c2c28;--live:#7ed184;--stale:#f0b35a;--down:#7a7a74;--panel:#1f1f1c}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}
.meta{color:var(--mute);font-size:12px}
details.s{border:1px solid var(--line);border-radius:6px;margin:6px 0;background:var(--panel)}
details.s>summary{display:grid;grid-template-columns:82px 64px 110px 1fr 120px 90px 70px;gap:10px;padding:8px 12px;cursor:pointer;align-items:center;list-style:none}
details.s>summary::-webkit-details-marker{display:none}
.state{font-weight:600}.live .state{color:var(--live)}.stale .state{color:var(--stale)}.down .state{color:var(--down)}
.stage{font-family:ui-monospace,monospace;white-space:nowrap}
.task{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.more{padding:6px 12px 12px;border-top:1px solid var(--line);color:var(--mute);font-size:13px}
.more dt{float:left;clear:left;width:70px;color:var(--fg)}.more dd{margin:0 0 4px 80px;word-break:break-all}
code{font-family:ui-monospace,monospace;font-size:12px}
form.clear{margin-top:8px}form.clear button{padding:4px 10px}
.gone{color:var(--stale)}
svg.curve{display:block;margin:8px 0 2px;max-width:100%;height:auto}
svg.curve .rule{stroke:var(--line);stroke-width:1}
svg.curve .rl{fill:var(--mute);font-size:7px;font-family:ui-monospace,monospace}
svg.curve polyline{fill:none;stroke-width:1.5}
svg.curve polyline.burn{stroke:var(--live)}
svg.curve polyline.spend{stroke:var(--stale);stroke-dasharray:4 3}
.legend{margin:0 0 8px;font-size:11px;color:var(--mute)}
.legend .kb{color:var(--live)}.legend .ks{color:var(--stale)}
.nochart{margin:8px 0;font-size:12px;color:var(--mute)}
table.stages{border-collapse:collapse;font-size:12px;margin:4px 0 8px}
table.stages th,table.stages td{text-align:right;padding:1px 8px 1px 0}
table.stages th:first-child,table.stages td:first-child{text-align:left}
.bar{display:flex;gap:8px;align-items:center;margin:10px 0 4px;flex-wrap:wrap}
.bar input[type=search]{padding:3px 6px;min-width:220px;font:inherit}
.bar button{padding:3px 8px;font:inherit;cursor:pointer}
.bar button[aria-pressed=true]{font-weight:600}
.cleared{margin:8px 0 0;color:var(--live);font-size:12px}
`;

const CHART_W = 320;
const CHART_H = 90;
const PAD = 4;

// Two series in one box, each scaled to its own maximum, because a dual axis is
// unreadable at ninety pixels. The maxima are printed under it, which is where
// the units live.
//
// Each series is normalised to its own maximum, so both end at the same pixel
// on every row that has both — the top-right corner — and where they converge
// there is nothing in a solid stroke to say which is which. The spend line is
// therefore dashed (`polyline.spend` in the CSS above): colour separates them
// at a glance, the dash separates them where they overlap.
//
// x is milliseconds since `stages[0].from` — the first stage's first `clock`
// sighting — and not since the entry's `started`, which this function never
// reads. A session's clock is what its stages are measured in, so the width
// printed in the legend is the clocked span, which is shorter than the elapsed
// run whenever fankeel was not watching for part of it.
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
//
// Five columns, the last of them `waited`: how much of that stage's minutes went
// on a gate rather than on work. It is the only field this change adds, and the
// curve cannot carry it — a gate is time with no burn and no spend, so it shows
// on the chart as a flat run and nowhere as a number.
function stageTable(stages) {
    if (!stages.length) return '';
    return `<table class="stages"><tr><th>stage</th><th>mins</th><th>burn</th><th>spend</th><th>waited</th></tr>`
        + stages.map((w) => `<tr><td>${esc(w.stage)}</td>`
            + `<td>${esc(mins(w.to - w.from))}</td>`
            + `<td>${esc(w.burn ? tokens(w.burn[1] - w.burn[0]) : '—')}</td>`
            + `<td>${w.usd === null ? '—' : '$' + w.usd.toFixed(2)}</td>`
            + `<td>${esc(w.waited === null || w.waited === undefined ? '—' : mins(w.waited))}</td></tr>`).join('')
        + `</table>`;
}

function row(s, opts, root) {
    const usd = s.cost && s.cost.priced.length ? '$' + s.cost.usd.toFixed(2) : '';
    const agentUsd = s.agentCost && s.agentCost.priced.length ? '$' + s.agentCost.usd.toFixed(2) : '';
    const unpriced = s.cost && s.cost.unpriced.length ? ' (' + s.cost.unpriced.join(', ') + ' unpriced)' : '';
    const outTok = s.usage && s.usage.models
        ? tokens(Object.values(s.usage.models).reduce((n, m) => n + (m.output || 0), 0)) + ' out'
        : '';
    const costCell = usd || outTok
        ? (usd || outTok) + (agentUsd ? ' + ' + agentUsd + ' (' + s.agents.agents + ' agents)' : '')
        : '';
    const state = s.state + (s.unknown ? '?' : '');
    const ended = s.ended ? stamp(Date.parse(s.ended.at)) + ' (' + esc(s.ended.reason) + ')' : '—';
    let clear = '';
    if (s.state === 'stale') {
        clear = opts.serve
            ? `<form class="clear" method="post" action="/clear">`
                + `<input type="hidden" name="root" value="${esc(root)}">`
                + `<input type="hidden" name="id" value="${esc(s.sessionId)}">`
                + `<input type="hidden" name="nonce" value="${esc(opts.nonce || '')}">`
                + `<label><input type="checkbox" name="force" value="1"> force</label> `
                + `<button type="submit">clear</button></form>`
            : `<dt>clear</dt><dd><code>node ${esc(opts.plugin || '<plugin>')}/scripts/task.js clear ${esc(s.sessionId)} --root "${esc(root)}" --session &lt;your session id&gt;</code></dd>`;
    }
    const text = [s.task, s.project, s.sessionId, s.model || ''].join(' ').toLowerCase();
    return `<details class="s ${s.state}"`
        + ` data-updated="${s.updated || 0}"`
        + ` data-started="${Date.parse(s.started) || 0}"`
        + ` data-cost="${s.cost && s.cost.priced.length ? s.cost.usd : 0}"`
        + ` data-stage="${esc(s.stage)}"`
        // The bare state, without the `?` the summary prints when liveness could
        // not be measured: this is what the filter matches on, and a row whose
        // liveness is in doubt is still a `live` row to anyone typing `live`.
        + ` data-state="${esc(s.state)}"`
        + ` data-text="${esc(text)}"`
        + `><summary>`
        + `<span>${esc(day(s.started))}</span>`
        + `<span class="state">${esc(state)}</span>`
        + `<span class="stage">${esc(s.stage)} ${dots(s.step, s.steps)}</span>`
        + `<span class="task" title="${esc(s.task)}">${esc(s.task)}</span>`
        + `<span>${esc(costCell)}${esc(unpriced)}</span>`
        + `<span>${esc(s.burn !== null ? tokens(s.burn) : '—')} / ${esc(s.clock !== null ? mins(s.clock) : '—')}</span>`
        + `<span>${esc(s.model ? s.model.replace(/^claude-/, '') : '')}</span>`
        + `</summary><div class="more">`
        + chart(s.stages) + stageTable(s.stages)
        + `<dl>`
        + `<dt>session</dt><dd><code>${esc(s.sessionId)}</code></dd>`
        + `<dt>project</dt><dd>${esc(s.project || '—')}</dd>`
        + `<dt>route</dt><dd>${esc(s.route.join(' → '))}</dd>`
        + `<dt>updated</dt><dd>${esc(stamp(s.updated))}</dd>`
        + `<dt>ended</dt><dd>${ended}</dd>`
        + `<dt>waited</dt><dd>${esc(s.waited !== null ? mins(s.waited) : '—')}</dd>`
        + `<dt>touched</dt><dd>${esc(s.claims.join(' ') || '—')}</dd>`
        + `<dt>notes</dt><dd>${s.notes.length ? s.notes.map(esc).join('<br>') : '—'}</dd>`
        + `<dt>next</dt><dd>${esc(s.next || '—')}</dd>`
        + `<dt>guard</dt><dd>${esc(s.guard || 'ask (default)')}</dd>`
        + (s.agents ? `<dt>agents</dt><dd>${s.agents.agents} agents, ${s.agents.requests} requests, ${esc(mins(s.agents.wallMs))} of their own wall-clock</dd>` : '')
        + clear
        + `</dl></div></details>`;
}

// The filter box and the sort buttons sit above every registry's rows, because
// `.rows` groups are queried once and sorted independently — one bar drives
// all of them. Auto-refresh only when serving: the static file is rewritten by
// fankeel's own events, so a timer on it would reload the same bytes.
const BAR = (serve) => `<div class="bar">`
    + `<input type="search" id="q" placeholder="filter: task, project, session, model, state">`
    + `<span class="meta">sort</span>`
    + ['updated', 'started', 'cost', 'stage'].map((k) =>
        `<button data-sort="${k}" aria-pressed="${k === 'updated' ? 'true' : 'false'}">${k}</button>`).join('')
    + (serve ? `<label><input type="checkbox" id="auto"> auto-refresh</label>` : '')
    + `<span id="shown" class="meta"></span></div>`;

// The only script on the page, inline so `tests/station.test.js:91`'s assertion
// that the page carries no `<script src=` stays true. It reads the `data-*`
// attributes `row()` writes and never touches anything Tasks 1-4 produced.
//
// The filter matches `data-text` or `data-state`, so `live`, `stale` and `down`
// are terms as much as a task or a session id is — that is what reads the
// `data-state` attribute, which would otherwise be written for nothing.
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
        var hit=!term||(r.getAttribute('data-text')||'').indexOf(term)!==-1||(r.getAttribute('data-state')||'').indexOf(term)!==-1;
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

function render(model, opts) {
    opts = opts || {};
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    let body = `<h1>fankeel station</h1>`
        + `<p class="meta">generated ${esc(stamp(Date.parse(model.generatedAt)))} · `
        + `${model.registries.filter((r) => !r.gone).length} registries · `
        + `${counts.live} live, ${counts.stale} stale, ${counts.down} down · `
        + `cost in USD at prices ${esc(model.pricesVerified)}; burn / clock are this session's own context and wall-clock`
        + (opts.serve ? ' · serving; this page re-reads the registries on every load' : '')
        + (model.scanStats && model.scanStats.depthCuts
            ? ` · depth stopped the scan in ${model.scanStats.depthCuts} places` : '')
        + (model.scanStats && model.scanStats.timedOut ? ' · the scan ran out of time' : '')
        + `</p>`
        // What `/clear-stale` did, said on the page it redirects to. The POST
        // answers `303 → /?cleared=N` rather than writing a body, so the
        // browser's reload is a plain GET and a refresh does not re-post the
        // form; this line is where the count that would have been in that body
        // comes back. A refusal is different: it never gets here, because there
        // is a reason to print and the route answers 409 with it.
        + (Number.isFinite(opts.cleared)
            ? `<p class="cleared">cleared ${opts.cleared} stale `
                + `${opts.cleared === 1 ? 'row' : 'rows'}</p>`
            : '')
        + BAR(!!opts.serve);
    for (const r of model.registries) {
        body += `<h2>${esc(r.root)}${r.gone ? ' <span class="gone">— gone: no sessions/ here any more</span>' : ''}</h2>`;
        if (r.gone) continue;
        body += `<p class="meta">${r.sessions.length} sessions, ${r.unreadable} unreadable`
            + (r.mapAt ? ` · map.md ${esc(day(r.mapAt))}` : ' · no map.md')
            + (r.build.length ? ` · build/: ${r.build.map((b) => esc(b.name) + ' (' + b.files + ')').join(', ')}` : ' · no build/')
            + `</p>`;
        // `/clear-stale` is served-only, and only when there is a stale row to
        // clear — the button carries the same count as its own confirm, so the
        // confirm reads as the button's label rather than a separate guess.
        const stale = r.sessions.filter((s) => s.state === 'stale').length;
        body += opts.serve && stale
            ? `<form class="clear" method="post" action="/clear-stale"`
                + ` onsubmit="return confirm('Clear ${stale} stale rows?')">`
                + `<input type="hidden" name="root" value="${esc(r.root)}">`
                + `<input type="hidden" name="nonce" value="${esc(opts.nonce || '')}">`
                + `<label><input type="checkbox" name="force" value="1"> force</label> `
                + `<button type="submit">clear all ${stale} stale</button></form>`
            : '';
        body += `<div class="rows">`;
        for (const s of r.sessions) body += row(s, opts, r.root);
        body += `</div>`;
    }
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
        + `<title>fankeel station</title><style>${CSS}</style></head><body>${body}<script>${SCRIPT}</script></body></html>\n`;
}

function stationPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'station.html');
}

function write(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const model = gather(Object.assign({}, opts, { now }));
    const html = render(model, { plugin: opts.plugin });
    const file = stationPath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    // The copy beside the user, and only into a registry that exists: a caller
    // handing over its launch directory must not grow a `.fankeel/` there. The
    // canonical file above is always the newest; this one is refreshed by the
    // sessions in this registry, and the page header dates both.
    let copy = null;
    const root = opts.root ? resolved(opts.root) : null;
    if (root && hasRegistry(root)) {
        try {
            registry.ensureIgnored(root, ['station.html']);
            copy = path.join(root, '.fankeel', 'station.html');
            fs.writeFileSync(copy, html);
        } catch (e) {
            copy = null;
        }
    }
    try {
        rememberRoots(configDir, model.registries, now);
    } catch (e) { /* housekeeping; the page is written, the memory catches up next time */ }
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    return {
        file,
        copy,
        registries: model.registries.filter((r) => !r.gone).length,
        live: counts.live,
        stale: counts.stale,
        down: counts.down,
    };
}

module.exports = { discover, gather, render, write, scanRoots, readRoots, rootsPath, SCRIPT };
