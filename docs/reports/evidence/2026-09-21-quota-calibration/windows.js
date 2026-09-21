'use strict';

// What the account actually spent inside the two rate-limit windows that two
// statusline payload captures sit in — so `used_percentage`, an integer with no
// units printed anywhere, gets a denominator under it.
//
//   node docs/reports/evidence/2026-09-21-quota-calibration/windows.js
//
// The two captures are the only readings that exist. Nothing persists
// `rate_limits`: it arrives in the statusline payload, TokenBar's statusline.ps1
// dumps that payload only while `CLAUDE_STATUSLINE_DEBUG=1` is set, and the dump
// is one file that every later render overwrites. So the series is two points,
// and both are recorded beside this script rather than re-derivable.
//
// Scope: every `*.jsonl` at the top level of every directory under the config
// directory's `projects/`, plus each one's `subagents/` tree, which is where
// `lib/usage.js`'s `summariseTree` looks. Nothing is sampled and nothing is
// filtered — a rate-limit window does not care which project a request came
// from, and leaving any out would understate the window.
//
// Everything is computed by the libraries the rest of the repository uses:
// `lib/usage.js`'s own window bucketing (the same `stageAt` half-open interval
// test that buckets a session's cost by stage) and `lib/prices.js`'s `costOf`.
// No rate and no bucketing rule is re-implemented here.
//
// The two things this file decides on its own, stated because nothing else
// states them:
//
// - A displayed integer `p` stands for a true value in `[p - 0.5, p + 0.5)`, so
//   every rate below is a band and not a number. A displayed 0 is the one that
//   does not widen downward — a meter cannot read below zero — so it stands for
//   `[0, 0.5)`.
//
// - A window that has just reset is taken to read exactly 0. Nothing in the
//   payload says so; it is the one assumption here, and it is named in the
//   output as well as here so a reader can reject it.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const usage = require('../../../../lib/usage.js');
const prices = require('../../../../lib/prices.js');
const live = require('../../../../lib/live.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// Where Claude Code keeps transcripts. `live.liveConfigDir()` is the repository's
// own answer to "which config directory is this session running under", so
// CLAUDE_CONFIG_DIR moves this the way it moves everything else.
const PROJECTS = path.join(live.liveConfigDir() || path.join(os.homedir(), '.claude'), 'projects');

// The five-hour window both captures fall inside: `resets_at` 1789936800 on both
// of them, which is what makes them comparable at all.
const FIVE_OPEN = Date.parse('2026-09-20T15:40:00.000Z');
const FIVE_RESET = Date.parse('2026-09-20T20:40:00.000Z');
// The seven-day window, likewise identical on both: `resets_at` 1790276400.
const SEVEN_OPEN = Date.parse('2026-09-17T19:00:00.000Z');

// Reading A — committed as
// docs/reports/evidence/2026-09-21-long-task-projection/quota-capture-260920T163041Z.txt
const A = { at: Date.parse('2026-09-20T16:30:41.226Z'), five: 2, seven: 0 };
// Reading B — committed beside this script as
// quota-capture-260920T203515Z.txt
const B = { at: Date.parse('2026-09-20T20:35:15.617Z'), five: 13, seven: 3 };

const WINDOWS = [
    { stage: 'before-7d', from: -Infinity, to: SEVEN_OPEN },
    { stage: '7d-open..5h-open', from: SEVEN_OPEN, to: FIVE_OPEN },
    { stage: '5h-open..A', from: FIVE_OPEN, to: A.at },
    { stage: 'A..B', from: A.at, to: B.at },
    { stage: 'B..5h-reset', from: B.at, to: FIVE_RESET },
    { stage: 'after-5h-reset', from: FIVE_RESET, to: Infinity },
];

const out = [];
const say = (line) => out.push(line === undefined ? '' : String(line));

const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });

// Claude Code writes its own interstitial turns under the model id
// `<synthetic>`. They carry no tokens and no rate has one, so they are dropped
// and counted — a silently skipped id is how a total starts looking complete.
const synthetic = { buckets: 0, tokens: 0 };

function fold(into, models) {
    for (const [id, m] of Object.entries(models || {})) {
        if (id === '<synthetic>') {
            synthetic.buckets += 1;
            synthetic.tokens += m.input + m.output + m.cacheRead + m.cacheWrite5m + m.cacheWrite1h;
            continue;
        }
        const t = into[id] || (into[id] = blank());
        for (const k of Object.keys(t)) t[k] += m[k];
    }
}

const tokensOf = (models) => {
    let n = 0;
    for (const m of Object.values(models)) n += m.input + m.output + m.cacheRead + m.cacheWrite5m + m.cacheWrite1h;
    return n;
};
const priceOf = (models) => prices.costOf(models).usd;
const unpricedIn = (models) => Object.keys(models).filter((id) => !prices.rateFor(id));
const num = (n) => Math.round(n).toLocaleString('en-US');
const usd = (n) => '$' + n.toFixed(2);

const per = {};
const reqs = {};
for (const w of WINDOWS) { per[w.stage] = {}; reqs[w.stage] = 0; }

const rows = [];
let walked = 0;
let withUsage = 0;

for (const dir of fs.readdirSync(PROJECTS)) {
    let names;
    try { names = fs.readdirSync(path.join(PROJECTS, dir)); } catch (e) { continue; }
    for (const name of names) {
        if (!name.endsWith('.jsonl')) continue;
        walked += 1;
        const seen = usage.summariseTree(path.join(PROJECTS, dir, name), { stages: WINDOWS });
        if (!seen) continue;
        withUsage += 1;
        const mine = {};
        for (const w of WINDOWS) mine[w.stage] = { requests: 0, models: {} };
        for (const side of [seen.usage.stages, seen.usage.subagents && seen.usage.subagents.stages]) {
            for (const [stage, bucket] of Object.entries(side || {})) {
                fold(per[stage], bucket.models);
                reqs[stage] += bucket.requests;
                mine[stage].requests += bucket.requests;
                fold(mine[stage].models, bucket.models);
            }
        }
        const inFive = mine['5h-open..A'].requests + mine['A..B'].requests + mine['B..5h-reset'].requests;
        const inSeven = inFive + mine['7d-open..5h-open'].requests;
        if (inSeven) {
            rows.push({
                dir,
                session: name.replace(/\.jsonl$/, '').slice(0, 8),
                inFive,
                inSeven,
                fiveUsd: priceOf(mine['5h-open..A'].models) + priceOf(mine['A..B'].models)
                    + priceOf(mine['B..5h-reset'].models),
                sevenUsd: priceOf(mine['7d-open..5h-open'].models) + priceOf(mine['5h-open..A'].models)
                    + priceOf(mine['A..B'].models) + priceOf(mine['B..5h-reset'].models),
            });
        }
    }
}

say('# what the two rate-limit windows actually held');
say('#');
say('# generated by docs/reports/evidence/2026-09-21-quota-calibration/windows.js');
say('# transcripts read from ' + PROJECTS);
say('# registry root ' + ROOT);
say('');
say('transcripts walked                 ' + walked);
say('  carrying any usage               ' + withUsage);
say('  with a request in the 7d window  ' + rows.length);
say('  with a request in the 5h window  ' + rows.filter((r) => r.inFive).length);
say('<synthetic> buckets dropped        ' + synthetic.buckets + ', carrying ' + synthetic.tokens + ' tokens');
say('prices.verified                    ' + prices.verified);
say('');

say('## block 1 — every segment');
say(['segment', 'requests', 'tokens', 'usd', 'unpriced models here'].join('\t'));
for (const w of WINDOWS) {
    const up = unpricedIn(per[w.stage]);
    say([w.stage, reqs[w.stage], num(tokensOf(per[w.stage])), usd(priceOf(per[w.stage])),
        up.length ? up.join(',') : '—'].join('\t'));
}

say('');
say('## block 2 — who was in the five-hour window');
say(['project dir', 'session', 'requests in 5h', 'usd in 5h'].join('\t'));
for (const r of rows.filter((x) => x.inFive).sort((a, b) => b.inFive - a.inFive)) {
    say([r.dir, r.session, r.inFive, '$' + r.fiveUsd.toFixed(4)].join('\t'));
}

say('');
say('## block 3 — who was in the seven-day window, every one of them');
say(['project dir', 'session', 'requests in 7d', 'usd in 7d'].join('\t'));
for (const r of rows.slice().sort((a, b) => b.sevenUsd - a.sevenUsd)) {
    say([r.dir, r.session, r.inSeven, usd(r.sevenUsd)].join('\t'));
}

say('');
say('## block 4 — the model split, per segment and then per window');
say('Per segment first, because that is what says how much a model id carried —');
say('including an id `lib/prices.js` had no rate for until 2026-09-21, whose');
say('tokens were being named as `unpriced` rather than charged at zero.');
for (const w of WINDOWS) {
    say(w.stage + ':');
    const ids = Object.keys(per[w.stage]);
    if (!ids.length) { say('  (nothing)'); continue; }
    for (const id of ids) {
        const one = {};
        one[id] = per[w.stage][id];
        say(['  ' + id, num(tokensOf(one)) + ' tokens', usd(priceOf(one))].join('\t'));
    }
}
say('');
const fiveModels = {};
fold(fiveModels, per['5h-open..A']);
fold(fiveModels, per['A..B']);
fold(fiveModels, per['B..5h-reset']);
const sevenModels = {};
fold(sevenModels, per['7d-open..5h-open']);
fold(sevenModels, fiveModels);
for (const [label, models] of [['five-hour window', fiveModels], ['seven-day window', sevenModels]]) {
    say(label + ':');
    for (const [id, m] of Object.entries(models)) {
        const one = {};
        one[id] = m;
        say(['  ' + id, num(tokensOf(one)) + ' tokens', usd(priceOf(one))].join('\t'));
    }
}

say('');
say('## block 5 — what a point of each meter would have to cost');
say('A displayed integer p means a true value in [p-0.5, p+0.5). A displayed 0');
say('does not widen downward, so it means [0, 0.5). A window that has just reset');
say('is taken to read exactly 0 — an assumption, not something the payload says.');
say('');

const bandOf = (p) => (p === 0 ? [0, 0.5] : [p - 0.5, p + 0.5]);
const seg = (name) => ({ tokens: tokensOf(per[name]), usd: priceOf(per[name]), requests: reqs[name] });
const fiveA = seg('5h-open..A');
const fiveAB = seg('A..B');

const rate = (label, amount, fromBand, toBand, unit) => {
    const dLo = toBand[0] - fromBand[1];
    const dHi = toBand[1] - fromBand[0];
    const lo = amount / dHi;
    const hi = amount / dLo;
    const fmt = (x) => (unit === '$' ? '$' + x.toFixed(2) : num(x));
    say(['  ' + label, 'delta ' + dLo.toFixed(1) + '-' + dHi.toFixed(1) + ' points',
        fmt(lo) + '-' + fmt(hi) + ' per point'].join('\t'));
    return [lo, hi];
};
const overlap = (a, b) => {
    const lo = Math.max(a[0], b[0]);
    const hi = Math.min(a[1], b[1]);
    return hi >= lo ? [lo, hi] : null;
};

say('five-hour meter, in dollars:');
const f1u = rate('open -> A', fiveA.usd, [0, 0], bandOf(A.five), '$');
const f2u = rate('A -> B', fiveAB.usd, bandOf(A.five), bandOf(B.five), '$');
say('five-hour meter, in tokens:');
const f1t = rate('open -> A', fiveA.tokens, [0, 0], bandOf(A.five), 'tok');
const f2t = rate('A -> B', fiveAB.tokens, bandOf(A.five), bandOf(B.five), 'tok');
const ou = overlap(f1u, f2u);
const ot = overlap(f1t, f2t);
say('');
say('  dollars: ' + (ou
    ? 'the two segments AGREE — ' + usd(ou[0]) + '-' + usd(ou[1]) + ' per point'
    : 'the two segments DISAGREE — no shared rate'));
say('  tokens:  ' + (ot
    ? 'the two segments AGREE — ' + num(ot[0]) + '-' + num(ot[1]) + ' per point'
    : 'the two segments DISAGREE — no shared rate'));

say('');
say('seven-day meter, cumulative from the window opening:');
const sevenUpToA = {};
fold(sevenUpToA, per['7d-open..5h-open']);
fold(sevenUpToA, per['5h-open..A']);
const sevenUpToB = {};
fold(sevenUpToB, sevenUpToA);
fold(sevenUpToB, per['A..B']);
const uA = priceOf(sevenUpToA);
const uB = priceOf(sevenUpToB);
const aHi = bandOf(A.seven)[1];
const bLo = bandOf(B.seven)[0];
const bHi = bandOf(B.seven)[1];
say('  at A the window held ' + usd(uA) + ' and the meter read ' + A.seven + '%');
say('  at B the window held ' + usd(uB) + ' and the meter read ' + B.seven + '%');
say('  A therefore puts a point above ' + usd(uA / aHi));
say('  B therefore puts a point at ' + usd(uB / bHi) + '-' + usd(uB / bLo));
say('  shared rate? ' + (uB / bLo > uA / aHi
    ? 'possible'
    : 'NO — B needs a point cheaper than A allows, by a factor of '
        + ((uA / aHi) / (uB / bLo)).toFixed(1)));

let sha = 'unknown';
try {
    sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch (e) {
    sha = 'unknown';
}
const outPath = path.join(__dirname, 'windows-at-' + sha + '.txt');
fs.writeFileSync(outPath, out.join('\n') + '\n');
process.stdout.write(out.join('\n') + '\n');
process.stdout.write('\nwritten to ' + outPath + '\n');
