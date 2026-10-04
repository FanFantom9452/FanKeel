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

// TokenBar's log lines that carry a 7-day reading, oldest first; `at` and
// `resetsAt` in seconds, as TokenBar writes them.
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
        if (!j || typeof j.at !== 'number' || typeof j.seven_day_pct !== 'number' || typeof j.seven_day_resets_at !== 'number') continue;
        out.push({ at: j.at, pct: j.seven_day_pct, resetsAt: j.seven_day_resets_at });
    }
    return out.sort((a, b) => a.at - b.at);
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
// there is no projects directory.
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
    const add = (file, sidechain) => {
        let mtime;
        try {
            mtime = fs.statSync(file).mtimeMs;
        } catch (e) {
            return;
        }
        if (mtime < from) return;
        const s = usage.summarise(file, { sidechain, stages });
        const w = s && s.usage.stages && s.usage.stages.w;
        if (!w) return;
        for (const [id, m] of Object.entries(w.models)) {
            const into = models[id] || (models[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            for (const k of Object.keys(into)) into[k] += m[k] || 0;
        }
    };
    for (const d of dirs) {
        const dir = path.join(root, d.name);
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isFile() && e.name.endsWith('.jsonl')) add(path.join(dir, e.name), false);
            if (!e.isDirectory()) continue;
            const sub = path.join(dir, e.name, 'subagents');
            let files = [];
            try {
                files = fs.readdirSync(sub).filter((f) => f.endsWith('.jsonl'));
            } catch (err) {
                continue;
            }
            for (const f of files) add(path.join(sub, f), true);
        }
    }
    return prices.costOf(models);
}

function calibrate(configDir, logText) {
    const s = span(readings(logText));
    if (!s) return { error: 'no 7-day window in the log moved ' + MIN_POINTS + ' points or more between two readings' };
    const cost = spentBetween(configDir, s.from, s.to);
    if (!cost) return { error: 'no transcripts under ' + path.join(configDir, 'projects') };
    const week = perWeek(cost.usd, s.points);
    if (!week) return { error: 'nothing priced was spent between the two readings' };
    return { week, day: new Date(s.to).toISOString().slice(0, 10), usd: cost.usd, points: s.points, from: s.from, to: s.to, unpriced: cost.unpriced };
}

module.exports = { MIN_POINTS, readings, span, perWeek, spentBetween, calibrate };
