'use strict';
// spend-1: what one week of the account's quota is worth in API-equivalent
// dollars. Two statusline readings of the 7-day window and what the whole
// machine spent between them give dollars per point. Only the change inside
// one window is used: the meter's absolute level does not follow transcript
// spend (docs/90-agent/reports/2026-09-21-quota-calibration.md, quota-1).

const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');

// A reading is a whole percent, so a difference of d points is d ± 1; under
// ten points that error is more than a tenth of the answer.
const MIN_POINTS = 10;

// Two sources: a limits row (hooks/pane-limits.ts: ISO times, `seven` in whole
// percent) and the older TokenBar line (seconds, `seven_day_pct`). Oldest
// first; `at` and `resetsAt` in seconds.
function readings(text) {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
        if (!raw.trim()) continue;
        let j;
        try {
            j = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!j) continue;
        if (typeof j.at === 'string' && typeof j.seven === 'number' && typeof j.sevenResets === 'string') {
            const at = Date.parse(j.at) / 1000, resetsAt = Date.parse(j.sevenResets) / 1000;
            if (Number.isFinite(at) && Number.isFinite(resetsAt)) out.push({ at, pct: j.seven, resetsAt });
            continue;
        }
        if (typeof j.at !== 'number' || typeof j.seven_day_pct !== 'number' || typeof j.seven_day_resets_at !== 'number') continue;
        out.push({ at: j.at, pct: j.seven_day_pct, resetsAt: j.seven_day_resets_at });
    }
    return out.sort((a, b) => a.at - b.at);
}

// Every session's limits file, one text: sessions overlap in time, and
// readings() sorts what it keeps.
function limitsText(root) {
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return '';
    }
    return names.filter((n) => n.endsWith('.jsonl')).sort()
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n');
}

// The newest window whose first and last reading are MIN_POINTS or more
// apart, in milliseconds. Readings are grouped by their reset rounded to the
// hour: the payload's `resets_at` can differ by seconds within one window.
function span(list) {
    const windows = new Map();
    for (const r of list) {
        const k = Math.round(r.resetsAt / 3600);
        if (!windows.has(k)) windows.set(k, []);
        windows.get(k).push(r);
    }
    for (const k of [...windows.keys()].sort((a, b) => b - a)) {
        const w = windows.get(k);
        const points = w[w.length - 1].pct - w[0].pct;
        if (points >= MIN_POINTS) return { from: w[0].at * 1000, to: w[w.length - 1].at * 1000, points };
    }
    return null;
}

function perWeek(usd, points) {
    return usd > 0 && points > 0 ? Math.round(usd / points * 100) : null;
}

// Every transcript under `<configDir>/projects/` — each project's session
// files and each session's `subagents/` — priced over [from, to). The quota
// is the account's, so no project is left out. A file last written before
// `from` holds no request inside the window and is not opened. null when
// there is no projects directory. `skipped` counts files and directories that
// could not be read: their spend is missing from `usd`.
function spentBetween(configDir, from, to) {
    const root = path.join(configDir, 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (e) {
        return null;
    }
    const stages = [{ stage: 'w', from, to }];
    const models = {};
    let skipped = 0;
    const add = (file, sidechain) => {
        let mtime;
        try {
            mtime = fs.statSync(file).mtimeMs;
        } catch (e) {
            skipped++;
            return;
        }
        if (mtime < from) return;
        const s = usage.summarise(file, { sidechain, stages });
        if (!s) {
            skipped++;
            return;
        }
        const w = s && s.usage.stages && s.usage.stages.w;
        if (!w) return;
        for (const [id, m] of Object.entries(w.models)) {
            const into = models[id] || (models[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            for (const k of Object.keys(into)) into[k] += m[k] || 0;
        }
    };
    for (const d of dirs) {
        const dir = path.join(root, d.name);
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            skipped++;
            continue;
        }
        for (const e of entries) {
            if (e.isFile() && e.name.endsWith('.jsonl')) add(path.join(dir, e.name), false);
            if (!e.isDirectory()) continue;
            const sub = path.join(dir, e.name, 'subagents');
            let files = [];
            try {
                files = fs.readdirSync(sub).filter((f) => f.endsWith('.jsonl'));
            } catch (err) {
                if (err.code !== 'ENOENT') skipped++;
                continue;
            }
            for (const f of files) add(path.join(sub, f), true);
        }
    }
    return Object.assign(prices.costOf(models), { skipped });
}

function calibrate(configDir, logText) {
    const s = span(readings(logText));
    if (!s) return { error: 'no 7-day window in the log moved ' + MIN_POINTS + ' points or more between two readings' };
    const cost = spentBetween(configDir, s.from, s.to);
    if (!cost) return { error: 'no transcripts under ' + path.join(configDir, 'projects') };
    const week = perWeek(cost.usd, s.points);
    if (!week) return { error: 'nothing priced was spent between the two readings' };
    return { week, day: new Date(s.to).toISOString().slice(0, 10), usd: cost.usd, points: s.points, from: s.from, to: s.to, unpriced: cost.unpriced, estimated: cost.estimated, skipped: cost.skipped };
}

// ---- per-account series (docs/90-agent/plans/2026-10-30-spend-quota-design.md §0, §1, §3) ----

const MIN_MS = 60e3;
// A step longer than this had no reading inside it: drawn faded, not broken.
const GAP_MS = 30 * MIN_MS;
const FIVE_MS = 5 * 3600e3;
const DAY_MS = 24 * 3600e3;

// What each limits file parsed into, by path, kept while its size and mtime hold:
// the page is serialized every few seconds and these files only grow.
const parsed = new Map();
// Rounded, not floored: Node's stat Date rounds mtimeMs, and a time set back from it
// (utimes) lands on that rounded millisecond — floor would call it changed.
const stampOf = (st) => st.size + ':' + Math.round(st.mtimeMs);
const msOf = (v) => (typeof v === 'string' ? Date.parse(v) : NaN);
const numOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Every reading in every root's limits directory, oldest first, times in epoch ms:
// `{ at, session, account, five, fiveResets, seven, sevenResets }`, the session being
// the file's name. A line that does not parse or has no time is skipped; a missing
// value is null.
function limitsRows(roots) {
    const out = [];
    for (const root of roots || []) {
        const dir = path.join(root, '.fankeel', 'build', 'limits');
        let names;
        try {
            names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'));
        } catch (e) {
            continue;
        }
        for (const n of names) {
            const file = path.join(dir, n);
            let st;
            let text;
            try {
                st = fs.statSync(file);
                const hit = parsed.get(file);
                if (hit && hit.stamp === stampOf(st)) {
                    out.push(...hit.rows);
                    continue;
                }
                text = fs.readFileSync(file, 'utf8');
            } catch (e) {
                continue;
            }
            const session = n.slice(0, -'.jsonl'.length);
            const rows = [];
            for (const raw of text.split('\n')) {
                if (!raw.trim()) continue;
                let j;
                try {
                    j = JSON.parse(raw);
                } catch (e) {
                    continue;
                }
                const at = j ? msOf(j.at) : NaN;
                if (!Number.isFinite(at)) continue;
                const fr = msOf(j.fiveResets);
                const sr = msOf(j.sevenResets);
                rows.push({
                    at, session, account: typeof j.account === 'string' && j.account ? j.account : null,
                    five: numOf(j.five), fiveResets: Number.isFinite(fr) ? fr : null,
                    seven: numOf(j.seven), sevenResets: Number.isFinite(sr) ? sr : null,
                });
            }
            parsed.set(file, { stamp: stampOf(st), rows });
            out.push(...rows);
        }
    }
    return out.sort((a, b) => a.at - b.at);
}

// A 7d reset as the account it names: the local weekday and HH:MM, rounded to five
// minutes — the payload's resets_at wanders by seconds between readings of one
// window. '4 04:00' is Thursday 04:00.
function resetKey(t) {
    const d = new Date(t);
    const week = 7 * 1440;
    const raw = d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const m = ((Math.round(raw / 5) * 5) % week + week) % week;
    const hm = m % 1440;
    return Math.floor(m / 1440) + ' ' + String(Math.floor(hm / 60)).padStart(2, '0') + ':' + String(hm % 60).padStart(2, '0');
}

// The readings split by account. The key is the reading's own 7d reset; a reading
// with none takes the key its `account` uuid is seen with most; with neither it
// belongs to no account. Where uuid and reset disagree the reset wins — a session
// started before a `/login` may keep writing the old uuid (design, 未驗證). Within one
// account and one minute only a strictly larger `seven` replaces the reading kept:
// sessions running side by side write the same one. `bySession` is each session's
// account, the one most of its readings carry.
function accountsOf(rows) {
    const tally = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const most = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const seenWith = new Map();
    for (const r of rows) {
        if (!r.account || r.sevenResets === null) continue;
        if (!seenWith.has(r.account)) seenWith.set(r.account, new Map());
        tally(seenWith.get(r.account), resetKey(r.sevenResets));
    }
    const keyed = new Map();
    const votes = new Map();
    const val = (r) => (r.seven === null ? -1 : r.seven);
    for (const r of rows) {
        const key = r.sevenResets !== null ? resetKey(r.sevenResets)
            : r.account && seenWith.has(r.account) ? most(seenWith.get(r.account)) : null;
        if (!key) continue;
        if (!votes.has(r.session)) votes.set(r.session, new Map());
        tally(votes.get(r.session), key);
        if (!keyed.has(key)) keyed.set(key, new Map());
        const byMin = keyed.get(key);
        const minute = Math.floor(r.at / MIN_MS);
        const had = byMin.get(minute);
        if (!had || val(r) > val(had)) byMin.set(minute, r);
    }
    const accounts = [...keyed.keys()].sort().map((key) => ({
        key, wd: Number(key.split(' ')[0]), hm: key.split(' ')[1],
        rows: [...keyed.get(key).values()].sort((a, b) => a.at - b.at),
    }));
    const bySession = {};
    for (const [session, v] of votes) bySession[session] = most(v);
    return { accounts, bySession };
}

// One field's step line, 'seven' or 'five': each reading holds until the next, and
// falls to 0 at its own reset when that comes first. `gap` marks a step longer than
// GAP_MS — no reading inside it, drawn faded. The 0 after a reset is known, never a
// gap. The last step runs to `now`.
function stepsOf(rows, field, now) {
    const resets = field === 'five' ? 'fiveResets' : 'sevenResets';
    const list = rows.filter((r) => r[field] !== null && r[field] !== undefined);
    const out = [];
    const push = (from, to, v, gap) => {
        if (to >= from) out.push({ from, to, v, gap });
    };
    list.forEach((r, i) => {
        const end = i + 1 < list.length ? list[i + 1].at : Math.max(now, r.at);
        const reset = r[resets];
        if (reset !== null && reset !== undefined && reset > r.at && reset < end) {
            push(r.at, reset, r[field], reset - r.at > GAP_MS);
            push(reset, end, 0, false);
        } else push(r.at, end, r[field], end - r.at > GAP_MS);
    });
    return out;
}

// The 5h windows, oldest first, each `{ start, end, steps }`: readings grouped by
// their fiveResets rounded to five minutes, a window the five hours before it, its
// line running to the reset or to `now`, whichever is first.
function windowsOf(rows, now) {
    const by = new Map();
    for (const r of rows) {
        if (r.five === null || r.fiveResets === null) continue;
        const end = Math.round(r.fiveResets / (5 * MIN_MS)) * 5 * MIN_MS;
        if (!by.has(end)) by.set(end, []);
        by.get(end).push(Object.assign({}, r, { fiveResets: null }));
    }
    return [...by.keys()].sort((a, b) => a - b)
        .map((end) => ({ start: end - FIVE_MS, end, steps: stepsOf(by.get(end), 'five', Math.min(now, end)) }));
}

// The 7d line's last reading and when it reaches 100 at the last 24 hours' pace: the
// climb of `steps` over the day before the last reading — every rise, a reset's fall
// not subtracted — per hour. `out` is null when the pace is not above zero or 100
// comes only after the reset (design §3, 重置前用不完).
function forecast(rows, steps) {
    const list = rows.filter((r) => r.seven !== null && r.seven !== undefined);
    if (!list.length) return null;
    const last = list[list.length - 1];
    let rise = 0;
    for (let i = 1; i < steps.length; i++) {
        if (steps[i].from > last.at - DAY_MS && steps[i].from <= last.at) rise += Math.max(0, steps[i].v - steps[i - 1].v);
    }
    const perHour = rise / 24;
    const out = perHour > 0 ? Math.round(last.at + (100 - last.seven) / perHour * 3600e3) : null;
    const resets = last.sevenResets === undefined ? null : last.sevenResets;
    return { at: last.at, pct: last.seven, resets, perHour, out: out !== null && (resets === null || out < resets) ? out : null };
}

// Everything the 花費 page's quota tabs draw (design §1): per account its 7d step
// line, its 5h windows, its forecast and the window `span` the price of a point
// comes from; and each session's account.
function quotaOf(roots, now) {
    const { accounts, bySession } = accountsOf(limitsRows(roots));
    return {
        accounts: accounts.map((a) => {
            const steps7 = stepsOf(a.rows, 'seven', now);
            const sp = span(a.rows.filter((r) => r.seven !== null && r.sevenResets !== null)
                .map((r) => ({ at: r.at / 1000, pct: r.seven, resetsAt: r.sevenResets / 1000 })));
            return { key: a.key, wd: a.wd, hm: a.hm, steps7, windows: windowsOf(a.rows, now), forecast: forecast(a.rows, steps7), span: sp };
        }),
        bySession,
    };
}

module.exports = {
    MIN_POINTS, readings, limitsText, span, perWeek, spentBetween, calibrate,
    limitsRows, resetKey, accountsOf, stepsOf, forecast, quotaOf,
};
