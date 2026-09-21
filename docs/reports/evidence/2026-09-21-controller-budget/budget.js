#!/usr/bin/env node
'use strict';

// Where a long fankeel task's money goes, and how many of them fit in one
// seven-day quota window.
//
//   node docs/reports/evidence/2026-09-21-controller-budget/budget.js
//
// Blocks 1-4 are computed here, from `.fankeel/sessions` through the repo's
// own `lib/spend.js`, `lib/prices.js` and `lib/station.js`. Nothing in them is
// retyped from a page.
//
// Block 5 is different in kind and says so. The quota water-line appears only
// in a statusline payload, and exactly two captures of it were ever taken
// before the next render overwrote the file. This script READS those two
// files, and the window table committed beside them, rather than quoting the
// page that first derived a rate from them — so the inputs are visible and a
// reader can see that n = 2. Everything block 5 derives inherits that n.
//
// Which registry: `--root <dir>` for one, omitted for this repo plus the
// machine-wide view, because "three projects at once" is a machine-wide
// question and the per-stage split is a per-registry one.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const spend = require(path.join(REPO, 'lib', 'spend.js'));
const prices = require(path.join(REPO, 'lib', 'prices.js'));
const station = require(path.join(REPO, 'lib', 'station.js'));
const live = require(path.join(REPO, 'lib', 'live.js'));

// `lib/spend.js` owns the bucket boundaries; this is the lower edge of the
// two buckets the long-task projection already treats as long, named here
// once rather than repeated at each use.
const LONG = 200;
const STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

// The two statusline captures, and the segment table that prices the window
// between them. Paths, not figures: the numbers come out of these files.
const CAPTURE_A = path.join(REPO, 'docs', 'reports', 'evidence',
    '2026-09-21-long-task-projection', 'quota-capture-260920T163041Z.txt');
const CAPTURE_B = path.join(REPO, 'docs', 'reports', 'evidence',
    '2026-09-21-quota-calibration', 'quota-capture-260920T203515Z.txt');
const WINDOWS = path.join(REPO, 'docs', 'reports', 'evidence',
    '2026-09-21-quota-calibration', 'windows-at-43daef5.txt');

const usd = (n) => (n == null ? '—' : '$' + n.toFixed(2));
const pct = (n) => (n == null ? '—' : (Math.round(n * 1000) / 10).toFixed(1) + '%');

// One `models` object to dollars, through the repo's own rate table. A model
// with no rate is named rather than charged zero, the same way `lib/spend.js`
// treats one.
function usdOf(models, unpriced) {
    let total = 0;
    for (const id of Object.keys(models || {})) {
        const rate = prices.rateFor(id);
        if (!rate) { unpriced.add(id); continue; }
        const u = models[id];
        total += (u.input || 0) / 1e6 * rate.input
            + (u.output || 0) / 1e6 * rate.output
            + (u.cacheRead || 0) / 1e6 * rate.cacheRead
            + (u.cacheWrite5m || 0) / 1e6 * rate.cacheWrite5m
            + (u.cacheWrite1h || 0) / 1e6 * rate.cacheWrite1h;
    }
    return total;
}

// `used_percentage` and `total_cost_usd` out of one capture. The dump is a
// key-then-whitespace-then-value text table, and the header above it is
// prose; anchoring on the full dotted key is what keeps a sentence mentioning
// `five_hour` out of the answer.
function readCapture(file) {
    const text = fs.readFileSync(file, 'utf8');
    const field = (key) => {
        const m = text.match(new RegExp('^' + key.replace(/\./g, '\\.') + '\\s+([0-9.]+)', 'm'));
        return m ? Number(m[1]) : null;
    };
    const got = {
        file: path.basename(file),
        fiveHour: field('rate_limits.five_hour.used_percentage'),
        sevenDay: field('rate_limits.seven_day.used_percentage'),
        sessionUsd: field('cost.total_cost_usd'),
    };
    // A capture that did not parse must say so here rather than downstream. An
    // unread percentage is 0 by subtraction, and 0 makes every figure block 5
    // derives come out `Infinity` — which reads as a number and is not one.
    for (const key of ['fiveHour', 'sevenDay', 'sessionUsd']) {
        if (got[key] == null) throw new Error('budget.js: ' + got.file + ' has no readable ' + key);
    }
    return got;
}

// The `A..B` row of block 1 of the windows table: the whole five-hour segment
// between the two captures, across every session in it. This is the spend the
// meters moved on — not either capture's `cost.total_cost_usd`, which is one
// session's own figure and which that capture's footer says so explicitly.
function readWindowSegment() {
    const text = fs.readFileSync(WINDOWS, 'utf8');
    const m = text.match(/^A\.\.B\t(\d+)\t([\d,]+)\t\$([\d.]+)\t(.*)$/m);
    if (!m) return null;
    return {
        requests: Number(m[1]),
        tokens: Number(m[2].replace(/,/g, '')),
        usd: Number(m[3]),
        unpriced: m[4],
        line: m[0].replace(/\t/g, '  '),
    };
}

function longRowsOf(roots) {
    const { rows, scanned, noSpend, unreadable } = spend.sessionsOf(roots);
    const long = rows.filter((r) => r.requests >= LONG);
    return { rows, long, scanned, noSpend, unreadable };
}

// Per stage, the parent's own dollars against its subagents'. The registry
// stores `spend[stage] = {requests, models, subagents:{requests, models}}`,
// so this is the one place the two halves are separable at all — the session
// table in `scripts/spend.js` gives the same split per session, not per stage.
function perStage(roots, longIds) {
    const agg = {};
    const unpriced = new Set();
    for (const root of roots) {
        const dir = path.join(root, '.fankeel', 'sessions');
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const name of names) {
            if (!name.endsWith('.json')) continue;
            if (!longIds.has(name.slice(0, -'.json'.length))) continue;
            let rec;
            try { rec = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (e) { continue; }
            if (!rec || !rec.spend) continue;
            for (const stage of Object.keys(rec.spend)) {
                const s = rec.spend[stage];
                const at = agg[stage] || (agg[stage] = { own: 0, sub: 0, requests: 0 });
                at.own += usdOf(s.models, unpriced);
                at.requests += s.requests || 0;
                if (s.subagents) at.sub += usdOf(s.subagents.models, unpriced);
            }
        }
    }
    return { agg, unpriced: [...unpriced] };
}

function main(argv) {
    const { values } = parseArgs({ args: argv, options: { root: { type: 'string' } }, allowPositionals: false, strict: true });
    const out = [];
    const say = (s) => out.push(s == null ? '' : s);

    const here = [values.root ? path.resolve(values.root) : REPO];
    const all = values.root
        ? here
        : station.discover({ configDir: live.liveConfigDir(), cwd: REPO }).roots;

    // ---- block 1 ----
    const h = longRowsOf(here);
    say('## block 1 — denominator');
    say('');
    say('registry                  ' + here[0]);
    say('session files scanned     ' + h.scanned);
    say('priced (have `spend`)     ' + h.rows.length + '   skipped ' + h.noSpend + ', unreadable ' + h.unreadable);
    say('long (requests >= ' + LONG + ')   ' + h.long.length);
    say('');

    // ---- block 2 ----
    const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
    const total = sum(h.long, (r) => r.usd);
    const own = sum(h.long, (r) => r.own);
    const sub = sum(h.long, (r) => r.subagents);
    say('## block 2 — long sessions in this registry: who spent it, and on what');
    say('');
    say('half\tusd\tshare');
    say('parent (the controller)\t' + usd(own) + '\t' + pct(own / total));
    say('subagents\t' + usd(sub) + '\t' + pct(sub / total));
    say('total\t' + usd(total) + '\t100.0%');
    say('');
    say('component\tusd\tshare');
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite']) {
        const v = sum(h.long, (r) => r.cost[k]);
        say(k + '\t' + usd(v) + '\t' + pct(v / total));
    }
    say('');

    // ---- block 3 ----
    const longIds = new Set(h.long.map((r) => r.sessionId));
    const { agg, unpriced } = perStage(here, longIds);
    const grand = Object.values(agg).reduce((a, x) => a + x.own + x.sub, 0);
    say('## block 3 — the same money, per stage');
    say('');
    say('stage\tparent\tagents\ttotal\tshare of all stages\tparent share of stage');
    for (const stage of STAGES) {
        const a = agg[stage];
        if (!a) continue;
        const t = a.own + a.sub;
        say(stage + '\t' + usd(a.own) + '\t' + usd(a.sub) + '\t' + usd(t) + '\t' + pct(t / grand) + '\t' + pct(a.own / t));
    }
    say('TOTAL\t' + usd(Object.values(agg).reduce((a, x) => a + x.own, 0))
        + '\t' + usd(Object.values(agg).reduce((a, x) => a + x.sub, 0))
        + '\t' + usd(grand) + '\t100.0%\t—');
    say('');
    say('unpriced model ids in this block: ' + (unpriced.length ? unpriced.join(', ') : 'none'));
    say('');
    say('block 3\'s grand total and block 2\'s total are the same money read two ways —');
    say('per stage against per session — so they agree or one of them is wrong:');
    say('  block 2 total  ' + usd(total));
    say('  block 3 total  ' + usd(grand));
    say('  agree          ' + (Math.abs(total - grand) < 0.01 ? 'yes' : 'NO — differ by ' + usd(Math.abs(total - grand))));
    say('');

    // ---- block 4 ----
    const a = longRowsOf(all);
    const buckets = spend.buckets(a.rows);
    say('## block 4 — the machine, not this repo');
    say('');
    say('registries discovered     ' + all.length);
    say('session files scanned     ' + a.scanned + '   priced ' + a.rows.length);
    say('');
    say('range\tsessions\ttotal\tmedian\tcacheRead share');
    for (const b of buckets) say(b.range + '\t' + b.count + '\t' + usd(b.total) + '\t' + usd(b.median) + '\t' + pct(b.share.cacheRead));
    say('');

    // ---- block 5 ----
    const A = readCapture(CAPTURE_A);
    const B = readCapture(CAPTURE_B);
    const seg = readWindowSegment();
    say('## block 5 — how many long tasks fit in a seven-day window');
    say('');
    say('READ, not retyped. n = 2 — the water-line lives only in a statusline payload,');
    say('and two captures of it survive. Everything below inherits that n.');
    say('');
    say('reading\tfile\t5h used\t7d used\tthat session\'s own usd');
    say('A\t' + A.file + '\t' + A.fiveHour + '%\t' + A.sevenDay + '%\t' + usd(A.sessionUsd));
    say('B\t' + B.file + '\t' + B.fiveHour + '%\t' + B.sevenDay + '%\t' + usd(B.sessionUsd));
    say('');
    if (!seg) {
        say('window segment A..B: NOT FOUND in ' + path.basename(WINDOWS) + ' — block 5 stops here.');
    } else {
        say('the window between them, every session in it, from ' + path.basename(WINDOWS) + ':');
        say('  ' + seg.line);
        say('');
        const d5 = B.fiveHour - A.fiveHour;
        const d7 = B.sevenDay - A.sevenDay;
        if (d5 <= 0 || d7 <= 0) throw new Error('budget.js: a meter did not move between the captures (5h ' + d5 + ', 7d ' + d7 + ') — nothing here can be divided by it');
        say('moved\t5h ' + d5 + ' points\t7d ' + d7 + ' points\ton ' + usd(seg.usd));
        say('');
        const cap5 = seg.usd / (d5 / 100);
        const cap7 = seg.usd / (d7 / 100);
        say('so one full window is worth, at these prices:');
        say('  5h   ' + usd(cap5));
        say('  7d   ' + usd(cap7));
        say('');
        const bucket800 = buckets.find((b) => b.range === '800+');
        const median = bucket800 ? bucket800.median : null;
        if (median) {
            say('a long task\'s median cost, machine-wide, 800+ bucket: ' + usd(median));
            say('  long tasks per 7d window      ' + Math.floor(cap7 / median));
            say('  ... split three ways          ' + (Math.floor(cap7 / median) / 3).toFixed(1) + ' per project');
            say('  long tasks per 5h window      ' + Math.floor(cap5 / median));
            say('');
            say('the same, if the controller ran on Sonnet instead of Opus. The four rate');
            say('components are all exactly 0.4, so a model swap scales spend by 0.4 times');
            say('whatever token multiple Sonnet turns out to need — and that multiple has');
            say('never been measured. At a multiple of 1.0 the parent share alone falls:');
            const ratio = prices.rateFor('claude-sonnet-5').input / prices.rateFor('claude-opus-5').input;
            const parentShare = own / total;
            const scaled = median * (parentShare * ratio + (1 - parentShare));
            say('  price ratio, computed        ' + ratio);
            say('  parent share, block 2        ' + pct(parentShare));
            say('  median long task would be    ' + usd(scaled));
            say('  long tasks per 7d window     ' + Math.floor(cap7 / scaled));
            say('  ... split three ways         ' + (Math.floor(cap7 / scaled) / 3).toFixed(1) + ' per project');
        } else {
            say('no 800+ bucket in this scan — the per-task arithmetic is skipped.');
        }
    }

    return out.join('\n') + '\n';
}

if (require.main === module) process.stdout.write(main(process.argv.slice(2)));

module.exports = { main, readCapture, readWindowSegment };
