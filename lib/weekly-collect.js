'use strict';
// Everything one weekly report is written from — scripts/weekly.js collect
// writes it as data.json and the model reads it to write events.json
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收): per repository,
// its completion records in the range (merged by title), its sessions still
// under way, its commits per day, and — for a repository with no records — its
// commits grouped by conventional-commit scope; the modules each of those
// touched, the change totals and the architecture board; and the last
// report's next-week list, which this report's carry block answers.
const fs = require('node:fs');
const path = require('node:path');
const git = require('./weekly-git.js');
const modules = require('./weekly-modules.js');
const store = require('./weekly-store.js');
const registry = require('./registry.js');

const RECORDS = ['docs', '90-agent', 'records'];
const DROP = ['花費'];
const FRIDAY = 5;

function addDays(day, n) {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function defaultRange(today, latestUntil) {
    if (latestUntil && latestUntil < today) return { since: addDays(latestUntil, 1), until: today };
    const dow = new Date(today + 'T00:00:00Z').getUTCDay();
    const back = ((dow - FRIDAY + 7) % 7) || 7;
    return { since: addDays(today, -back), until: today };
}

function months(since, until) {
    const out = [];
    let [y, m] = since.slice(0, 7).split('-').map(Number);
    const end = until.slice(0, 7);
    for (;;) {
        const key = y + '-' + String(m).padStart(2, '0');
        if (key > end) break;
        out.push(key);
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return out;
}

// scripts/record.js:108-109 writes `<a id="r-<date>-<session8>[-n]"></a>`,
// a blank line, then `## YYYY-MM-DD title`; `- label：value` lines follow, and
// indented `  - x` lines continue the field above them.
const ANCHOR = /^<a id="r-\d{4}-\d{2}-\d{2}-([0-9a-f]{8})(?:-\d+)?"><\/a>\s*$/;

function parseRecords(text) {
    const out = [];
    let cur = null;
    let field = null;
    let session = null;
    for (const line of text.split(/\r?\n/)) {
        const a = ANCHOR.exec(line);
        if (a) { session = a[1]; continue; }
        const h = /^## (\d{4}-\d{2}-\d{2}) (.+)$/.exec(line);
        if (h) {
            cur = { date: h[1], title: h[2].trim(), session, fields: {} };
            out.push(cur);
            field = null;
            session = null;
            continue;
        }
        if (!cur) continue;
        if (/^#{1,2} /.test(line)) { cur = null; continue; }
        const f = /^- ([^：:]{1,20})[：:]\s*(.*)$/.exec(line);
        if (f) {
            field = f[1].trim();
            cur.fields[field] = f[2].trim();
            continue;
        }
        const sub = /^\s+- (.*)$/.exec(line);
        if (sub && field) cur.fields[field] = (cur.fields[field] ? cur.fields[field] + '\n' : '') + sub[1].trim();
    }
    for (const r of out) for (const k of DROP) delete r.fields[k];
    return out;
}

function readRecords(repo, since, until) {
    const out = [];
    for (const month of months(since, until)) {
        let text;
        try {
            text = fs.readFileSync(path.join(repo, ...RECORDS, month + '.md'), 'utf8');
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
            continue;
        }
        for (const r of parseRecords(text)) if (r.date >= since && r.date <= until) out.push(r);
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
}

function mergeSame(records) {
    const by = new Map();
    for (const r of records) {
        const m = by.get(r.title) || { title: r.title, dates: [], count: 0, fields: {}, from: [] };
        by.set(r.title, m);
        if (!m.dates.includes(r.date)) m.dates.push(r.date);
        m.from.push({ date: r.date, session: r.session || null });
        m.count++;
        m.fields = Object.assign({}, m.fields, r.fields);
    }
    return [...by.values()];
}

const claimPath = (c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? c.path || c.file || '' : '');

// Every session file of this repo, at any stage: the repo's own
// .fankeel/sessions, else the registry above it filtered by `project`. Each
// comes with its id (the file name) and its claims as repo-relative paths.
function sessionFiles(repo) {
    const own = fs.existsSync(path.join(repo, '.fankeel', 'sessions'));
    const root = own ? repo : registry.findStateRoot(repo);
    if (!root) return [];
    const rel = path.relative(root, repo).replace(/\\/g, '/');
    let names;
    try {
        names = fs.readdirSync(path.join(root, '.fankeel', 'sessions')).filter((n) => n.endsWith('.json'));
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        return [];
    }
    const out = [];
    for (const n of names) {
        let o;
        try {
            o = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', n), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!o || typeof o !== 'object') continue;
        if (rel) {
            const proj = registry.projectOf(o).replace(/\\/g, '/');
            if (proj !== rel && path.basename(proj) !== path.basename(repo)) continue;
        }
        const claims = (Array.isArray(o.claims) ? o.claims : []).map(claimPath).filter(Boolean)
            .map((c) => (path.isAbsolute(c) ? path.relative(repo, c) : c).replace(/\\/g, '/'))
            .map((c) => (rel && c.startsWith(rel + '/') ? c.slice(rel.length + 1) : c));
        out.push({ id: n.slice(0, -'.json'.length), o, claims });
    }
    return out;
}

function readSessions(repo, since, until) {
    return sessionFiles(repo)
        .filter(({ o }) => {
            const day = String(o.updated || '').slice(0, 10);
            return day >= since && day <= until && o.stage !== 'land' && !o.ended;
        })
        .map(({ o, claims }) => ({ task: String(o.task || ''), stage: String(o.stage || ''), updated: String(o.updated), claims }))
        .sort((a, b) => a.updated.localeCompare(b.updated));
}

// A done record's anchor names its session by the id's first 8 characters;
// that session's claims are the record's files, whatever stage it reached.
function sessionClaims(repo) {
    const files = sessionFiles(repo);
    return (session8) => {
        if (!session8) return null;
        const hit = files.find((f) => f.id.slice(0, 8) === session8);
        return hit ? hit.claims : null;
    };
}

function idsOf(res, paths) {
    const ids = new Set();
    for (const p of paths) {
        const id = res(p);
        if (id) ids.add(id);
    }
    return [...ids];
}

function collect(opts) {
    const { since, until } = opts;
    const last = opts.configDir ? store.latest(opts.configDir) : null;
    const previous = last && last.until < since ? last : null;
    const repos = (opts.repos || []).map((repo) => {
        const name = path.basename(repo);
        const list = git.commits(repo, since, until);
        const def = modules.moduleDef(repo, name);
        const res = modules.resolver(def);
        const stats = modules.moduleStats(def, list, { attrs: git.readAttrs(repo) });
        const filesOn = (date) => list.filter((c) => c.date === date).flatMap((c) => c.files.map((f) => f.p));
        const claimsOf = sessionClaims(repo);
        // Each merged record's own sessions' claims; the day's commits only for
        // a record whose session file is gone.
        const recordFiles = (r) => r.from.flatMap((x) => claimsOf(x.session) || filesOn(x.date));
        const records = mergeSame(readRecords(repo, since, until)).map((r) => Object.assign(r, { modules: idsOf(res, recordFiles(r)) }));
        const sessions = readSessions(repo, since, until).map((s) => Object.assign(s, { modules: idsOf(res, s.claims) }));
        const scopes = records.length ? [] : git.groupByScope(list).map((g) => Object.assign(g, { modules: idsOf(res, g.files) }));
        return {
            name,
            path: String(repo).replace(/\\/g, '/'),
            records,
            sessions,
            scopes,
            daily: git.dailyCounts(list, since, until),
            commits: list.length,
            modules: stats,
            board: modules.boardText(def, stats.mods),
        };
    });
    return { since, until, days: git.dayRange(since, until), previous, repos };
}

module.exports = { addDays, defaultRange, readRecords, mergeSame, readSessions, sessionClaims, collect };
