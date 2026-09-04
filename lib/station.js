'use strict';
// Every fankeel session on this machine, as data and as a page.
//
// Discovery is the part nothing else here does. A registry is per workspace and
// `findStateRoot` walks up from one directory, so no reader knows more than one.
// Three sources, unioned: the `root=` field of every lead under `modes/`, the
// `cwd` of every running Claude Code session walked up to its registry, and
// whatever the caller names. Leads are pointers; the registry is the record.
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
    for (const root of opts.roots || []) add(root);
    if (opts.cwd) add(registry.findStateRoot(opts.cwd));
    return { roots: [...seen].sort(), gone: [...gone].sort() };
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
                burn: sum(data, registry.burnOf),
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
    return { generatedAt: new Date(now).toISOString(), configDir, pricesVerified: prices.verified, registries };
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
`;

function row(s, opts, root) {
    const usd = s.cost && s.cost.priced.length ? '$' + s.cost.usd.toFixed(2) : '';
    const unpriced = s.cost && s.cost.unpriced.length ? ' (' + s.cost.unpriced.join(', ') + ' unpriced)' : '';
    const outTok = s.usage && s.usage.models
        ? tokens(Object.values(s.usage.models).reduce((n, m) => n + (m.output || 0), 0)) + ' out'
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
    return `<details class="s ${s.state}"><summary>`
        + `<span>${esc(day(s.started))}</span>`
        + `<span class="state">${esc(state)}</span>`
        + `<span class="stage">${esc(s.stage)} ${dots(s.step, s.steps)}</span>`
        + `<span class="task" title="${esc(s.task)}">${esc(s.task)}</span>`
        + `<span>${esc(usd || outTok)}${esc(unpriced)}</span>`
        + `<span>${esc(s.burn !== null ? tokens(s.burn) : '—')} / ${esc(s.clock !== null ? mins(s.clock) : '—')}</span>`
        + `<span>${esc(s.model ? s.model.replace(/^claude-/, '') : '')}</span>`
        + `</summary><div class="more"><dl>`
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
        + clear
        + `</dl></div></details>`;
}

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
        + `</p>`;
    for (const r of model.registries) {
        body += `<h2>${esc(r.root)}${r.gone ? ' <span class="gone">— gone: no sessions/ here any more</span>' : ''}</h2>`;
        if (r.gone) continue;
        body += `<p class="meta">${r.sessions.length} sessions, ${r.unreadable} unreadable`
            + (r.mapAt ? ` · map.md ${esc(day(r.mapAt))}` : ' · no map.md')
            + (r.build.length ? ` · build/: ${r.build.map((b) => esc(b.name) + ' (' + b.files + ')').join(', ')}` : ' · no build/')
            + `</p>`;
        for (const s of r.sessions) body += row(s, opts, r.root);
    }
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
        + `<title>fankeel station</title><style>${CSS}</style></head><body>${body}</body></html>\n`;
}

function stationPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'station.html');
}

function write(opts) {
    const file = stationPath(opts.configDir);
    const html = render(gather(opts), { plugin: opts.plugin });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    return file;
}

module.exports = { discover, gather, render, write, stationPath };
