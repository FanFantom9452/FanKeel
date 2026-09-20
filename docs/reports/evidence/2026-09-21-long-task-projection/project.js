'use strict';

// Projects the per-stage dollar table at `stages-at-8365088.txt` onto "what
// would this long task have cost with Sonnet as the main controller instead
// of Opus" -- the second row of the "does moving the controller to Sonnet
// make a seven-stage long task cheaper" file table. It reads that table's
// own columns and recomputes from them; it does not rescan
// `.fankeel/sessions` itself, per this repo's evidence convention that a
// derived file trusts its source table's own fields rather than re-deriving
// them from the registry.
//
//   node docs/reports/evidence/2026-09-21-long-task-projection/project.js
//
// Four blocks, printed to stdout and also written to `project-at-<sha>.txt`
// (`<sha>` = `git rev-parse --short HEAD`):
//
//   1. Sonnet/Opus price ratio per component, read from `lib/prices.js`
//      (never hardcoded) -- input, output, cacheRead, cacheWrite(5m). All
//      four turn out equal (0.4), so the rest of this file calls that one
//      value `r`. Had they not been equal, the non-survey projection below
//      would need its own per-component recompute instead of a single
//      scaling factor; `projectNonSurveyUsd` below carries that path even
//      though the live pricing table never exercises it.
//   2. Per-session projection for the long-task buckets (`200-799`, `800+`):
//      every stage but `survey` is scaled by `r` -- no brain runs there, so
//      the controller is the whole cost. `survey` is scaled by `S_low` /
//      `S_high` instead, because the new mode's survey stage buys a whole
//      extra Opus brain on top of the cheaper controller.
//   3. What share of a long task's total the survey stage is -- how diluted
//      that one expensive station gets across a seven-stage run.
//   4. Sensitivity: block 2 assumes Sonnet spends exactly as many tokens as
//      Opus did on every non-survey stage, only at a cheaper rate. That is
//      unverified, so this sweeps a multiplier `k` on non-survey token
//      spend and solves for the `k` at which the projected total stops
//      being cheaper than the observed one.
//
// S_low = 0.973 and S_high = 1.049 are not derived here -- they are the two
// ab7 pairs' measured (new total / old total) from
// docs/reports/2026-09-20-survey-brain-ab.md section 10 ("交接檔的字數上限"):
// group 13 (nor11 $0.80 / old13 $0.82) and group 12 (nor10 $0.97 / old12
// $0.93). ab7 is the last-revised brain, so it is the closest thing this
// project has to a real cost ratio for a survey stage run under the new
// brain-delegating mode.

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const prices = require('../../../../lib/prices.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(__dirname, 'stages-at-8365088.txt');

const S_LOW = 0.973;
const S_HIGH = 1.049;

const LONG_BUCKETS = new Set(['200-799', '800+']);

// --- read block 1 of the source table ---------------------------------------

function readStageRows() {
    const text = fs.readFileSync(SRC, 'utf8');
    const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
    const headerIdx = lines.findIndex((l) => l.startsWith('session\tversion\trequests\tbucket\tstage\t'));
    if (headerIdx === -1) throw new Error('block 1 header not found in ' + SRC);
    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.startsWith('##')) break;
        const cells = line.split('\t');
        const [session, version, requests, bucket, stage, from, to, who, usd, cIn, cOut, cacheR, cacheW] = cells;
        rows.push({
            session, version, requests, bucket, stage, from, to, who,
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
    return { ratio, cacheWrite1h, allEqual, r: allEqual ? values[0] : null };
}

function block1Text(pr) {
    const lines = [];
    lines.push('## block 1: Sonnet/Opus price ratio per component (lib/prices.js: claude-sonnet-5 / claude-opus-5)');
    lines.push(
        'input=' + pr.ratio.input.toFixed(6)
        + '  output=' + pr.ratio.output.toFixed(6)
        + '  cacheRead=' + pr.ratio.cacheRead.toFixed(6)
        + '  cacheWrite(5m)=' + pr.ratio.cacheWrite.toFixed(6)
        + '  [cacheWrite(1h)=' + pr.cacheWrite1h.toFixed(6) + ', not one of the four, checked for consistency]'
    );
    if (pr.allEqual) {
        lines.push('four ratios equal: yes, r = ' + pr.r);
    } else {
        lines.push('four ratios equal: no -- keeping all four, applying each one to its own component below, not an average');
    }
    return lines.join('\n');
}

// Dollar projection for one non-survey row. When the four component ratios
// are equal this is just old_usd * r. When they are not, old_usd cannot be
// rescaled by one number (it was a mix of differently-priced components), so
// this recomputes straight from the row's own token columns at Sonnet's
// per-component rates instead.
function projectNonSurveyUsd(row, pr) {
    if (pr.allEqual) return row.usd * pr.r;
    const sonnet = prices.perMillion['claude-sonnet-5'];
    return (
        row.input * sonnet.input
        + row.output * sonnet.output
        + row.cacheRead * sonnet.cacheRead
        + row.cacheWrite * sonnet.cacheWrite5m
    ) / 1e6;
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
    lines.push([
        'TOTAL', String(sessions.length) + ' sessions', '-',
        totalOld.toFixed(4), totalLow.toFixed(4), totalHigh.toFixed(4),
        (totalOld ? totalLow / totalOld : 0).toFixed(4),
        (totalOld ? totalHigh / totalOld : 0).toFixed(4),
    ].join('\t'));
    lines.push('skipped rows with usd = "—" (no quote, excluded from every sum above): ' + skipped);

    return { text: lines.join('\n'), sessions, totalOld, totalLow, totalHigh, skipped };
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
    lines.push('median survey share across ' + sessions.length + ' sessions: ' + median.toFixed(2) + '%');
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

// --- main --------------------------------------------------------------------

function main() {
    const rows = readStageRows();
    const pr = priceRatio();

    const b1 = block1Text(pr);
    const b2 = block2(rows, pr);
    const b3 = block3(b2.sessions);
    const b4 = block4(b2.sessions, pr);

    const text = [b1, '', b2.text, '', b3.text, '', b4.text, ''].join('\n');

    let sha = 'unknown';
    try {
        sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    } catch (e) {
        // Left as 'unknown' -- this script still prints to stdout without git.
    }
    const outPath = path.join(__dirname, 'project-at-' + sha + '.txt');
    fs.writeFileSync(outPath, text, { encoding: 'utf8' });
    process.stdout.write(text);
    return { outPath, b2, b3, b4 };
}

main();
