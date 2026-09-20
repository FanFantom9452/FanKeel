'use strict';

// Projects the per-stage dollar table produced by `stages.js` (a sibling
// `stages-at-<sha>.txt`) onto "what would this long task have cost with
// Sonnet as the main controller instead of Opus" -- the second row of the
// "does moving the controller to Sonnet make a seven-stage long task
// cheaper" file table. It reads that table's own columns and recomputes
// from them; it does not rescan `.fankeel/sessions` itself, per this repo's
// evidence convention that a derived file trusts its source table's own
// fields rather than re-deriving them from the registry.
//
// The source filename is found by pattern (`stages-at-*.txt` next to this
// script), not hardcoded: `stages.js` names its own output after the sha it
// was run at, so that name changes every time `stages.js` is rerun at a new
// commit and the old file is deleted. Exactly one match is required --
// zero or more than one is an error naming what was found, never a guess
// and never "take the newest".
//
//   node docs/reports/evidence/2026-09-21-long-task-projection/project.js
//
// Five blocks, printed to stdout and also written to `project-at-<sha>.txt`
// (`<sha>` = `git rev-parse --short HEAD`):
//
//   1. Sonnet/Opus price ratio per component, read from `lib/prices.js`
//      (never hardcoded) -- input, output, cacheRead, cacheWrite(5m). All
//      four turn out equal (0.4), so the rest of this file calls that one
//      value `r` and scales a stage's whole `usd` by it. This script is
//      evidence pinned to a sha's pricing table, not a library meant to
//      outlive a repricing, so if the four ever stop being equal it throws
//      instead of quietly falling back to some other math -- the four
//      values are in the thrown message.
//   2. Per-session projection for the long-task buckets (`200-799`, `800+`):
//      every stage but `survey` is scaled by `r` -- no brain runs there, so
//      the controller is the whole cost. `survey` is scaled by `S_low` /
//      `S_high` instead, because the new mode's survey stage buys a whole
//      extra Opus brain on top of the cheaper controller.
//
//      The unit here is a session, not a task: a long task's survey stage
//      can have run in a different session, or the task may never have gone
//      through survey at all. A session whose block 1 rows contain no
//      `survey` stage gets its whole total scaled by `r` alone, and its
//      ratio_low/ratio_high print out as exactly `r` -- that is the correct
//      projection for a session with nothing to apply `S` to, not a bug.
//      Those sessions are named on their own line in block 2's output
//      rather than left for a reader to notice from a suspiciously round
//      ratio.
//   3. What share of a long task's total the survey stage is -- how diluted
//      that one expensive station gets across a seven-stage run. The same
//      no-survey sessions from block 2 show up here at 0.00% and are still
//      counted in the median.
//   4. Sensitivity: block 2 assumes Sonnet spends exactly as many tokens as
//      Opus did on every non-survey stage, only at a cheaper rate. That is
//      unverified, so this sweeps a multiplier `k` on non-survey token
//      spend and solves for the `k` at which the projected total stops
//      being cheaper than the observed one.
//   5. The distribution of block 2's 43 long-task `old_usd` values (min,
//      quartiles, max), and what one A/B pair would cost at the median.
//      Quartiles use linear interpolation on the sorted values at position
//      `1 + p*(n-1)` (1-indexed) -- this is R's default `type = 7`, numpy's
//      default `interpolation='linear'`, and Excel's `PERCENTILE.INC`. The
//      exclusive method (Excel's `PERCENTILE.EXC`, R's `type = 6`) gives
//      different Q1/Q3 from the same data; block 5's own printout names
//      which one it used so a reader quoting these two numbers knows which
//      algorithm they came from.
//      The pair line's lower bound is the median session's own `new_low`
//      from block 2 -- not block 2 TOTAL's aggregate `ratio_low` applied to
//      the median. That aggregate is a population-wide blend across
//      sessions with different stage mixes (some have no survey stage at
//      all -- see point 2); multiplying it onto one named session would
//      throw away that session's own composition. The upper bound is
//      parity -- that same session's own `old_usd` -- the new arm costing
//      exactly what the old one did and saving nothing.
//
// S_low = 0.973 and S_high = 1.049 are not derived here -- they are the two
// ab7 pairs' measured (new total / old total), from the unrounded per-model
// figures in the "per model, per arm:" section of
// docs/reports/evidence/2026-09-20-survey-brain-ab/ab7-table.txt (not the
// pre-rounded per-arm dollar figures in the report's own table, which do not
// divide back out to these constants):
//
//   group 13: (nor11 sonnet $0.3303 + nor11 opus $0.4673) / old13 $0.8199
//             = 0.7976 / 0.8199 = 0.9728 -> S_low  0.973
//   group 12: (nor10 sonnet $0.3076 + nor10 opus $0.6655) / old12 $0.9279
//             = 0.9731 / 0.9279 = 1.0487 -> S_high 1.049
//
// ab7 is the last-revised brain, so it is the closest thing this project has
// to a real cost ratio for a survey stage run under the new brain-delegating
// mode.

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const prices = require('../../../../lib/prices.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const S_LOW = 0.973;
const S_HIGH = 1.049;

const LONG_BUCKETS = new Set(['200-799', '800+']);

// --- read block 1 of the source table ---------------------------------------

// Exactly one `stages-at-*.txt` is expected next to this script -- see the
// file header for why this is discovered by pattern rather than hardcoded.
function findSourceFile() {
    const matches = fs.readdirSync(__dirname).filter((f) => /^stages-at-.*\.txt$/.test(f));
    if (matches.length !== 1) {
        throw new Error(
            'expected exactly one stages-at-*.txt in ' + __dirname + ', found ' + matches.length
            + (matches.length ? ' (' + matches.join(', ') + ')' : '')
        );
    }
    return path.join(__dirname, matches[0]);
}

function readStageRows() {
    const src = findSourceFile();
    const text = fs.readFileSync(src, 'utf8');
    const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
    const headerIdx = lines.findIndex((l) => l.startsWith('session\tversion\trequests\tbucket\tstage\t'));
    if (headerIdx === -1) throw new Error('block 1 header not found in ' + src);
    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.startsWith('##')) break;
        const cells = line.split('\t');
        const [session, , , bucket, stage, , , , usd, cIn, cOut, cacheR, cacheW] = cells;
        rows.push({
            session, bucket, stage,
            usd: usd === '—' ? null : Number(usd),
            input: Number(cIn), output: Number(cOut), cacheRead: Number(cacheR), cacheWrite: Number(cacheW),
        });
    }
    return rows;
}

// --- block 1: price ratio ----------------------------------------------------

function priceRatio() {
    const sonnet = prices.perMillion['claude-sonnet-5'];
    const opus = prices.perMillion['claude-opus-5'];
    if (!sonnet || !opus) throw new Error('claude-sonnet-5 or claude-opus-5 missing from lib/prices.js perMillion');
    const ratio = {
        input: sonnet.input / opus.input,
        output: sonnet.output / opus.output,
        cacheRead: sonnet.cacheRead / opus.cacheRead,
        cacheWrite: sonnet.cacheWrite5m / opus.cacheWrite5m,
    };
    // Not one of the four asked for, checked anyway: the 1h write rate
    // carries the same ratio, so picking the 5m rate above was not a
    // meaningful choice between two different numbers.
    const cacheWrite1h = sonnet.cacheWrite1h / opus.cacheWrite1h;
    const values = [ratio.input, ratio.output, ratio.cacheRead, ratio.cacheWrite];
    const allEqual = values.every((v) => Math.abs(v - values[0]) < 1e-9);
    if (!allEqual) {
        // This script is evidence pinned to a sha's pricing table, not a
        // library meant to survive a future repricing -- if the four
        // components ever stop scaling by one number, every stage-level
        // multiplication below (`row.usd * r`) becomes wrong in a way this
        // file cannot silently correct for, so it stops here instead.
        throw new Error(
            'Sonnet/Opus price ratios are not equal (input=' + ratio.input + ', output=' + ratio.output
            + ', cacheRead=' + ratio.cacheRead + ', cacheWrite=' + ratio.cacheWrite
            + ') -- this script\'s projection only holds when a single ratio r applies to every component'
        );
    }
    return { ratio, cacheWrite1h, allEqual, r: values[0] };
}

function block1Text(pr) {
    const lines = [];
    lines.push('## block 1: Sonnet/Opus price ratio per component (lib/prices.js: claude-sonnet-5 / claude-opus-5)');
    lines.push(`input=${pr.ratio.input.toFixed(6)}  output=${pr.ratio.output.toFixed(6)}  cacheRead=${pr.ratio.cacheRead.toFixed(6)}  cacheWrite(5m)=${pr.ratio.cacheWrite.toFixed(6)}  [cacheWrite(1h)=${pr.cacheWrite1h.toFixed(6)}, not one of the four, checked for consistency]`);
    lines.push('four ratios equal: yes, r = ' + pr.r);
    return lines.join('\n');
}

// Dollar projection for one non-survey row: old_usd scaled by the single
// Sonnet/Opus ratio `r` established in block 1 -- `priceRatio()` above
// already throws before this is ever called if the four components are not
// equal, so there is no second path here for that case.
function projectNonSurveyUsd(row, pr) {
    return row.usd * pr.r;
}

// --- block 2: per-session projection ----------------------------------------

function block2(rows, pr) {
    const bySession = new Map();
    let skipped = 0;

    for (const row of rows) {
        if (!LONG_BUCKETS.has(row.bucket)) continue;
        if (!bySession.has(row.session)) {
            bySession.set(row.session, {
                session: row.session, bucket: row.bucket, stages: new Set(),
                oldTotal: 0, newLow: 0, newHigh: 0, surveyUsd: 0,
            });
        }
        const s = bySession.get(row.session);
        s.stages.add(row.stage);
        if (row.usd == null) {
            skipped += 1;
            continue;
        }
        s.oldTotal += row.usd;
        if (row.stage === 'survey') {
            s.surveyUsd += row.usd;
            s.newLow += row.usd * S_LOW;
            s.newHigh += row.usd * S_HIGH;
        } else {
            s.newLow += projectNonSurveyUsd(row, pr);
            s.newHigh += projectNonSurveyUsd(row, pr);
        }
    }

    const sessions = [...bySession.values()].sort((a, b) => a.session.localeCompare(b.session));

    const lines = [];
    lines.push('## block 2: per-session projection (bucket 200-799 or 800+; survey x S_low/S_high, everything else x r)');
    lines.push(['session', 'bucket', 'stages', 'old_usd', 'new_low', 'new_high', 'ratio_low', 'ratio_high'].join('\t'));
    let totalOld = 0, totalLow = 0, totalHigh = 0;
    for (const s of sessions) {
        totalOld += s.oldTotal;
        totalLow += s.newLow;
        totalHigh += s.newHigh;
        lines.push([
            s.session, s.bucket, s.stages.size,
            s.oldTotal.toFixed(4), s.newLow.toFixed(4), s.newHigh.toFixed(4),
            (s.oldTotal ? s.newLow / s.oldTotal : 0).toFixed(4),
            (s.oldTotal ? s.newHigh / s.oldTotal : 0).toFixed(4),
        ].join('\t'));
    }
    const noSurvey = sessions.filter((s) => !s.stages.has('survey'));
    lines.push('sessions with no survey stage: ' + noSurvey.length
        + (noSurvey.length ? ' (' + noSurvey.map((s) => s.session).join(', ') + ')' : ''));
    lines.push([
        'TOTAL', String(sessions.length) + ' sessions', '-',
        totalOld.toFixed(4), totalLow.toFixed(4), totalHigh.toFixed(4),
        (totalOld ? totalLow / totalOld : 0).toFixed(4),
        (totalOld ? totalHigh / totalOld : 0).toFixed(4),
    ].join('\t'));
    lines.push('skipped rows with usd = "—" (no quote, excluded from every sum above): ' + skipped);

    return { text: lines.join('\n'), sessions, totalOld, totalLow, totalHigh, skipped, noSurvey };
}

// --- block 3: survey share ----------------------------------------------------

function medianOf(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function block3(sessions) {
    const lines = [];
    lines.push('## block 3: survey stage share of a long-task session\'s old_usd total');
    lines.push(['session', 'survey_usd', 'old_usd', 'survey_pct'].join('\t'));
    const pcts = [];
    for (const s of sessions) {
        const pct = s.oldTotal ? (s.surveyUsd / s.oldTotal) * 100 : 0;
        pcts.push(pct);
        lines.push([s.session, s.surveyUsd.toFixed(4), s.oldTotal.toFixed(4), pct.toFixed(2) + '%'].join('\t'));
    }
    const median = medianOf(pcts);
    const noSurveyCount = sessions.filter((s) => !s.stages.has('survey')).length;
    lines.push('median survey share across ' + sessions.length + ' sessions: ' + median.toFixed(2) + '%');
    lines.push('(' + noSurveyCount + ' of those sessions have no survey stage and are counted at 0.00% above)');
    return { text: lines.join('\n'), median };
}

// --- block 4: sensitivity to non-survey token multiplier k -----------------

function block4(sessions, pr) {
    if (!pr.allEqual) {
        throw new Error('block 4 assumes a single non-survey price ratio r; the four components are not equal, revisit this function');
    }
    const totalOld = sessions.reduce((a, s) => a + s.oldTotal, 0);
    const totalSurvey = sessions.reduce((a, s) => a + s.surveyUsd, 0);
    const totalNonSurvey = totalOld - totalSurvey;
    const ks = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

    const lines = [];
    lines.push('## block 4: sensitivity -- non-survey stages projected at old_usd * r * k, survey stages fixed at S_low');
    lines.push(['k', 'old_total', 'new_total', 'ratio'].join('\t'));
    for (const k of ks) {
        const newTotal = totalSurvey * S_LOW + totalNonSurvey * pr.r * k;
        lines.push([
            k.toFixed(2), totalOld.toFixed(4), newTotal.toFixed(4),
            (totalOld ? newTotal / totalOld : 0).toFixed(4),
        ].join('\t'));
    }
    // Solve totalSurvey * S_LOW + totalNonSurvey * r * k = totalOld for k.
    // The survey term is fixed (it does not move with k), which is exactly
    // why the break-even k is not simply 1/r.
    const kBreakeven = (totalOld - S_LOW * totalSurvey) / (pr.r * totalNonSurvey);
    lines.push('break-even k (new_total == old_total, survey held at S_low): ' + kBreakeven.toFixed(4));

    return { text: lines.join('\n'), kBreakeven };
}

// --- block 5: long-task old_usd distribution, and one A/B pair's cost -------

// Linear-interpolation quantile on a value already sorted ascending --
// R's default `type = 7`, numpy's default, Excel's `PERCENTILE.INC`. See
// the file header for why this method was picked over the exclusive one.
function quantile(sortedAsc, p) {
    const n = sortedAsc.length;
    if (n === 0) return 0;
    if (n === 1) return sortedAsc[0];
    const pos = 1 + p * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const frac = pos - lo;
    return sortedAsc[lo - 1] + frac * (sortedAsc[hi - 1] - sortedAsc[lo - 1]);
}

const money = (n) => n.toFixed(2);

function block5(sessions) {
    const sorted = sessions.map((s) => s.oldTotal).sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const q1 = quantile(sorted, 0.25);
    const median = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);

    // The median lands exactly on one session's own old_usd (n is odd, so
    // the type-7 interpolation above returns a sorted array element
    // unchanged, not a blend of two). That specific session, not the block
    // 2 TOTAL row's population-wide ratio, is what the pair line below
    // projects from -- exactly one match is required; zero or more than
    // one is an error naming what was found, not a guess.
    const medianSessions = sessions.filter((s) => Math.abs(s.oldTotal - median) < 1e-9);
    if (medianSessions.length !== 1) {
        throw new Error(
            'expected exactly one session at the old_usd median ' + median + ', found ' + medianSessions.length
            + (medianSessions.length ? ' (' + medianSessions.map((s) => s.session).join(', ') + ')' : '')
        );
    }
    const medianSession = medianSessions[0];

    const oldArm = medianSession.oldTotal;
    const newArmLow = medianSession.newLow;
    const newArmHigh = medianSession.oldTotal; // parity: the new arm costs exactly what the old one did
    const totalLow = oldArm + newArmLow;
    const totalHigh = oldArm + newArmHigh;

    const lines = [];
    lines.push('## block 5: long-task old_usd distribution, and what one A/B pair would cost');
    lines.push('quantiles: linear interpolation on sorted old_usd (position = 1 + p*(n-1)) -- R type 7 / numpy default / Excel PERCENTILE.INC; the exclusion method gives different Q1/Q3');
    lines.push(['n', 'min', 'q1', 'median', 'q3', 'max'].join('\t'));
    lines.push([n, money(min), money(q1), money(median), money(q3), money(max)].join('\t'));
    lines.push(
        'pair at the median (session ' + medianSession.session + '): old arm ' + money(oldArm)
        + ', new arm ' + money(newArmLow) + ' (that session\'s own projection) to '
        + money(newArmHigh) + ' (parity, saves nothing)'
        + ', total ' + money(totalLow) + ' to ' + money(totalHigh)
    );
    return { text: lines.join('\n'), n, min, q1, median, q3, max, medianSession };
}

// --- main --------------------------------------------------------------------

function main() {
    const rows = readStageRows();
    const pr = priceRatio();

    const b1 = block1Text(pr);
    const b2 = block2(rows, pr);
    const b3 = block3(b2.sessions);
    const b4 = block4(b2.sessions, pr);
    const b5 = block5(b2.sessions);

    const text = [b1, '', b2.text, '', b3.text, '', b4.text, '', b5.text, ''].join('\n');

    let sha = 'unknown';
    try {
        sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    } catch (e) {
        // Left as 'unknown' -- this script still prints to stdout without git.
    }
    const outPath = path.join(__dirname, 'project-at-' + sha + '.txt');
    fs.writeFileSync(outPath, text, { encoding: 'utf8' });
    process.stdout.write(text);
    return { outPath, b2, b3, b4, b5 };
}

main();
