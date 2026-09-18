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
const { positionIn, CLASSES } = require('./stages.js');
const profile = require('./profile.js');
const detail = require('./detail.js');

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
// `sessions/` directory is stamped now, and a root that has gone is stamped
// too — for as long as its directory still exists — it is already rendered
// as `gone`, and forgetting it too would mean the page silently stops
// mentioning a registry the user may still be looking for. A gone root whose
// directory has been deleted is not that registry — it is a scratch tree from
// a test run, and nothing will ever look for it again.

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
        // A gone root that still exists is a registry the user may be looking
        // for, and the comment above is why it keeps a stamp — its old one,
        // and only its old one: a root never recorded before is not this
        // page's memory to grow, so a directory merely passed as `--root`
        // once gains no entry just because it happens to be gone now. A gone
        // root whose directory is not there at all is a scratch tree from
        // a test run — two landed on 2026-09-06 — and nothing will ever find
        // it again.
        else if (isRootRecord(old[r.root]) && fs.existsSync(r.root)) next[r.root] = old[r.root];
    }
    const file = rootsPath(configDir);
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n');
    registry.renameRetrying(temp, file);
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
    // How long this call may spend reading transcripts for the detail panel. A
    // changed session costs about half a second (measured 2026-09-11 on two
    // real sessions: 543 and 516 ms), and `hooks/inject.js` writes the page
    // inside a five-second hook — so `write()` hands a budget in, and every
    // session reached after it is spent reuses its cache as it stands. No
    // budget is no limit.
    const until = Number.isFinite(opts.detailBudgetMs) ? Date.now() + opts.detailBudgetMs : Infinity;
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
            // The panel's detail, read and cached by `lib/detail.js`. `--json`
            // asks for none: it prints rows, and a replay is not a row.
            const got = opts.details === false ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: Date.now() > until });
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
                gates: Array.isArray(data.gates) ? data.gates : null,
                // `costOf` returns `usd: 0` for a stage whose models the table
                // does not price, which is indistinguishable from a stage that
                // genuinely cost nothing: the table would print `$0.00` and the
                // cumulative curve would count the stage as free. `row()`
                // already reads `priced.length` for the summary cell; an
                // unpriced stage is `null` here for the same reason, and the
                // table prints `—` while the curve steps over it.
                //
                // Both halves of the stage are priced and added: the parent's
                // own requests and, under `spend[stage].subagents`, whatever
                // its agents spent in that window. `usd` is therefore the one
                // number the cost cell above prints as `$X + $Y (N agents)`,
                // and a curve drawn from the parent alone was a third of it.
                // A stage priced on one side only still carries that side —
                // `null` means neither side had a rate, not that one did not.
                stages: registry.seriesOf(data).map((w) => {
                    const own = w.spend && w.spend.models ? prices.costOf(w.spend.models) : null;
                    const theirs = w.spend && w.spend.subagents && w.spend.subagents.models
                        ? prices.costOf(w.spend.subagents.models) : null;
                    const mine = own && own.priced.length ? own.usd : 0;
                    const agents = theirs && theirs.priced.length ? theirs.usd : 0;
                    const priced = Boolean((own && own.priced.length) || (theirs && theirs.priced.length));
                    return {
                        stage: w.stage,
                        from: w.from,
                        to: w.to,
                        burn: w.burn,
                        usd: priced ? mine + agents : null,
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
                detail: got ? got.detail : null,
                detailFresh: Boolean(got && got.fresh),
                tasks: detail.tasksOf(root, data, got ? got.detail.rows : []),
                // The detail's own sequence when there is a transcript, and the
                // entry's `moves` or clock when there is none — one
                // `stageSequence` either way, so the two cannot count apart.
                backtracks: got ? got.detail.backtracks
                    : detail.backtracksOf(detail.stageSequence([], data), data.route).length,
            });
        }
        sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        const projectDirs = [root].concat([...new Set(sessions.map((s) => s.project).filter(Boolean))]
            .map((p) => path.join(root, p)).filter((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }));
        const profiles = {};
        for (const p of projectDirs) profiles[p] = profile.read(p, configDir);
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions, profiles });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [], profiles: {} });
    }
    // A caller that walked the machine itself — `scripts/station.js`'s
    // first-run `autoScan` — hands its own numbers in, and `discover` may have
    // walked again for `opts.scan` on the same call. They are two walks, not
    // two opinions of one, so neither is authoritative and the header adds
    // them: cuts summed, timed-out true if either ran out. Letting the handed
    // block win outright threw the `--scan` walk's own counts away and the
    // header then described a walk that was not the one that ran short.
    const handed = opts.scanStats && typeof opts.scanStats === 'object' ? opts.scanStats : null;
    const walked = found.scanStats || null;
    return {
        generatedAt: new Date(now).toISOString(),
        configDir,
        pricesVerified: prices.verified,
        registries,
        machineProfile: profile.read(null, configDir),
        scanStats: handed && walked
            ? {
                depthCuts: (handed.depthCuts || 0) + walked.depthCuts,
                timedOut: Boolean(handed.timedOut) || walked.timedOut,
            }
            : handed || walked,
    };
}

// The shell and its two assets ship as files rather than as template literals,
// so the CSS has syntax highlighting and the view script can be unit tested.
// They are copied rather than referenced: the plugin directory carries its
// version in its path, so a page pointing into it breaks on the next update,
// and the copy under `<root>/.fankeel/` would point outside its own repository.
const ASSETS = path.join(__dirname, '..', 'assets', 'station');

// A project whose profile says `station.hide: 'true'` does not go on the page
// at all — not as a row, not inside a total, not as a detail file on disk.
// One function, because the page, the detail writer and the two CLI surfaces
// each filter separately and a second copy of this judgement is a second
// judgement that will drift.
//
// `r.profiles` is keyed by `path.join(root, project)` — backslashes on Windows
// — while `pkey` is `root + '/' + project`. Comparing the two raw is how this
// filter silently never fires, so the key is normalised to pkey's shape here.
function hiddenPkeys(model) {
    const hidden = new Set();
    for (const r of model.registries) {
        const profiles = r.profiles || {};
        for (const dir of Object.keys(profiles)) {
            const values = profiles[dir] && profiles[dir].values;
            if (!values || values['station.hide'] !== true) continue;
            if (dir === r.root) { hidden.add(r.root); continue; }
            const rel = path.relative(r.root, dir).split(path.sep).join('/');
            hidden.add(r.root + '/' + rel);
        }
    }
    return hidden;
}

function pkeyOf(session) {
    return session.project ? session.root + '/' + session.project : session.root;
}

// Every registry's sessions in one array, each carrying the root it came from,
// which is what the facets, the charts and the sort all read. `gather` keeps
// its shape: `--json` and the tests read registries there.
function flatten(model) {
    const sessions = [];
    const hidden = hiddenPkeys(model);
    for (const r of model.registries) {
        for (const s of r.sessions) {
            const row = Object.assign({ root: r.root }, s);
            if (hidden.has(pkeyOf(row))) continue;
            sessions.push(row);
        }
    }
    return sessions;
}

// A session's spend when its detail has no `days`, a cache kept from before
// they existed: spent whole, at no stage, on the local day the session started.
// The cache's own `day` is `started` cut to ten characters, a UTC date, and
// `days` counts local ones.
function keptDays(s) {
    const started = Date.parse(s.started);
    return [{
        day: Number.isFinite(started) ? detail.dayOf(started) : null,
        stage: null, model: s.detail.model, who: 'main', tokens: null, cost: null, usd: s.detail.usd,
    }];
}

// Which option-one wording most often loses. `labels` is in the order the
// question declared, so `labels[0]` is option one — the one whose description
// carries the approval. A wording that keeps losing is a wording to rewrite.
function gateSummary(model, hidden) {
    const lost = new Map();
    const total = new Map();
    for (const r of model.registries) {
        for (const s of r.sessions) {
            // This walks the model rather than `flatten()`'s output, so it
            // carries its own check, the same way `write()`'s detail loop
            // does. A session carries `project` but not `root`, so the pkey
            // has to be rebuilt from the registry it came from.
            if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;
            const events = s.detail && Array.isArray(s.detail.events) ? s.detail.events : [];
            const rows = [];
            for (const e of events) {
                if (e.kind !== 'gate' || !Array.isArray(e.qs)) continue;
                for (const q of e.qs) {
                    rows.push({ first: Array.isArray(q.labels) ? q.labels[0] : null, picked: q.a });
                }
            }
            // `detail` needs the transcript. When it is gone the entry's own
            // `gates` still has the wording, which is why Task 3 put it there:
            // without this the `swapped` denominator quietly shrinks as
            // transcripts age, and the page cannot show that it did.
            if (!rows.length) {
                for (const g of Array.isArray(s.gates) ? s.gates : []) {
                    rows.push({ first: Array.isArray(g.labels) ? g.labels[0] : null, picked: g.picked });
                }
            }
            for (const r of rows) {
                if (typeof r.first !== 'string' || r.first === '' || r.picked === null) continue;
                total.set(r.first, (total.get(r.first) || 0) + 1);
                if (r.picked !== r.first) lost.set(r.first, (lost.get(r.first) || 0) + 1);
            }
        }
    }
    const swapped = [...lost.keys()]
        .map((label) => ({ label, lost: lost.get(label), total: total.get(label) }))
        .sort((a, b) => b.lost - a.lost);
    return { swapped };
}

// The one generated file. `opts` carries what only a server knows — whether a
// clear button can post anywhere, the nonce it would post, and the count a
// redirect brought back — so the shell above can stay identical everywhere.
function serialize(model, opts) {
    opts = opts || {};
    const hidden = hiddenPkeys(model);
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
        profiles: {
            machine: model.machineProfile || { values: {}, sources: {}, unreadable: [] },
            projects: Object.assign({}, ...model.registries.map((r) => {
                const keep = {};
                for (const dir of Object.keys(r.profiles || {})) {
                    const values = r.profiles[dir] && r.profiles[dir].values;
                    if (values && values['station.hide'] === true) continue;
                    keep[dir] = r.profiles[dir];
                }
                return keep;
            })),
        },
        profileKeys: profile.KEYS,
        gates: gateSummary(model, hidden),
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
            // `w.burn` is the raw two-count pair `data.burn[stage]` carried
            // through unread by `gather()`; reading it apart from `burnOf`
            // let a stage sampled backwards reach the page as a negative
            // number. Wrapping it back into the shape `burnOf` reads reuses
            // the one place that already nulls a spend that is not positive.
            stages: s.stages.map((w) => {
                const b = registry.burnOf({ burn: { [w.stage]: w.burn } }, w.stage);
                return {
                    stage: w.stage, from: w.from, to: w.to,
                    burn: (b == null || b < 0) ? null : b,
                    usd: w.usd, waited: w.waited,
                };
            }),
            claims: s.claims, notes: s.notes, next: s.next, guard: s.guard,
            backtracks: s.backtracks,
            hasDetail: Boolean(s.detail), peak: s.detail ? s.detail.peak : null,
            // What the overview and the project page add up, so neither loads a
            // detail file.
            days: !s.detail ? null : Array.isArray(s.detail.days) ? s.detail.days : keptDays(s),
            spans: s.detail && Array.isArray(s.detail.spans) ? s.detail.spans : null,
            // A project is a registry root and the session's `project` under it.
            pkey: s.project ? s.root + '/' + s.project : s.root,
        })),
    };
    // The three classes' routes by name, so the overview can group sessions by
    // route and call a route a class names by that class's name.
    out.classes = Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [name, c.route]));
    if (opts.nonce) out.nonce = opts.nonce;
    if (opts.plugin) out.plugin = opts.plugin;
    if (Number.isFinite(opts.cleared)) out.cleared = opts.cleared;
    return 'window.STATION = ' + JSON.stringify(out) + ';\n';
}

// One session's detail as the script the panel loads when that session is
// opened, `station/detail/<id>.js`. Kept out of `station-data.js`, which every
// `/fankeel` prompt rewrites: a hundred sessions' replays in it would be
// megabytes rewritten per prompt for the one panel open at a time. The tasks
// ride along uncached, because the ledger moves without the transcript.
function serializeDetail(s) {
    const body = Object.assign({}, s.detail, { tasks: s.tasks || [] });
    return 'window.STATION_DETAIL = window.STATION_DETAIL || {};\n'
        + 'window.STATION_DETAIL[' + JSON.stringify(s.sessionId) + '] = ' + JSON.stringify(body) + ';\n';
}

// `render` keeps its name and its two callers, and now returns the shell. It
// takes the model so the signature does not change under `scripts/station.js`,
// and ignores it: nothing about a machine reaches this file any more.
function render() {
    return fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
}

// Carried through unchanged. It sat inside the span above because `render()`
// counted the header from it; `write()` still counts its return value from it,
// so deleting it with its neighbours would leave `counts` undefined at `:892`.
function tally(model, hidden) {
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) {
        for (const s of r.sessions) {
            if (hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;
            counts[s.state]++;
        }
    }
    return counts;
}

function stationPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'index.html');
}

// Five names — the last a directory — in one place, because `.gitignore` and the writer disagreeing is
// how a generated file gets committed. Constraint: `ensureIgnored` appends only
// what is missing, so growing this list is safe on a registry that already has
// the old single line.
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/station-data.js', 'station/detail'];

// What one write spends on transcripts at most; see `until` in `gather()`. The
// CLI passes `Infinity`, and `serve` passes nothing: a person who typed a
// command can wait for it.
const DETAIL_BUDGET_MS = 1500;

function write(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const model = gather(Object.assign({ detailBudgetMs: DETAIL_BUDGET_MS }, opts, { now }));
    const html = render();
    const dir = path.dirname(stationPath(configDir));
    fs.mkdirSync(dir, { recursive: true });
    const data = serialize(model, { plugin: opts.plugin });
    const hidden = hiddenPkeys(model);
    // The three copied files are compared before they are written, so a prompt
    // that changed nothing rewrites one file rather than four. `hooks/inject.js`
    // calls this on every prompt.
    const emit = (into) => {
        fs.mkdirSync(path.join(into, 'station'), { recursive: true });
        const same = (file, text) => {
            try {
                return fs.readFileSync(file, 'utf8') === text;
            } catch (e) {
                return false;
            }
        };
        for (const [name, text] of [
            ['index.html', html],
            ['station/station.css', fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8')],
            ['station/station.js', fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8')],
        ]) {
            const at = path.join(into, name);
            if (!same(at, text)) fs.writeFileSync(at, text);
        }
        fs.writeFileSync(path.join(into, 'station', 'station-data.js'), data);
        // One script per session that has a detail, written when it was read
        // just now or is missing here — so an ended session's is written once.
        const details = path.join(into, 'station', 'detail');
        fs.mkdirSync(details, { recursive: true });
        for (const r of model.registries) {
            for (const s of r.sessions) {
                if (!s.detail) continue;
                if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;
                const at = path.join(details, s.sessionId + '.js');
                if (s.detailFresh || !fs.existsSync(at)) fs.writeFileSync(at, serializeDetail(s));
            }
        }
    };
    emit(dir);
    const file = stationPath(configDir);
    // The copy beside the user, and only into a registry that exists: a caller
    // handing over its launch directory must not grow a `.fankeel/` there.
    let copy = null;
    const root = opts.root ? resolved(opts.root) : null;
    if (root && hasRegistry(root)) {
        try {
            registry.ensureIgnored(root, ['index.html', 'station/']);
            const into = path.join(root, '.fankeel');
            emit(into);
            copy = path.join(into, 'index.html');
        } catch (e) {
            copy = null;
        }
    }
    try {
        rememberRoots(configDir, model.registries, now);
    } catch (e) { /* housekeeping; the page is written, the memory catches up next time */ }
    const counts = tally(model, hidden);
    return {
        file,
        copy,
        registries: model.registries.filter((r) => !r.gone).length,
        live: counts.live,
        stale: counts.stale,
        down: counts.down,
        hidden: hidden.size,
    };
}

module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED, hiddenPkeys };
