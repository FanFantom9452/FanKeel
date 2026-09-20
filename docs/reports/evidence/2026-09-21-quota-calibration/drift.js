'use strict';

// How much of a session's cost the late stage-stamp put in the wrong stage, over
// every registry entry that still has a transcript — and what that did to the one
// figure another report leaned on.
//
//   node docs/reports/evidence/2026-09-21-quota-calibration/drift.js
//
// Until 2026-09-21, `clock` and `moves` were stamped only by `registry.touch()`,
// which runs from a prompt hook. So a stage boundary landed at the next sighting
// rather than at the `task.js stage` command that caused it, and everything
// bucketed by `windowsFrom` — which is `spend`, which is the station's per-stage
// table and `scripts/spend.js`'s columns — inherited that.
//
// This measures it by bucketing each session's requests twice: once at the
// boundaries `clock` recorded, once at the boundaries the session's own
// transcript puts the `task.js stage` commands at. The figure that matters is how
// much money changes stage between the two — half the sum of the absolute
// per-stage differences, because every dollar that leaves one stage arrives in
// another.
//
// Three guards, because an earlier draft of this measurement reported shares
// above 100% and had to be thrown away:
//
// - A stage call from a PREVIOUS task in the same session is excluded by
//   `started`. `task.js task` renames a task without a new session, so a long
//   session can hold several tasks' worth of commands.
// - A boundary is only ever moved earlier, and never past the previous one.
// - Any session whose two bucketings do not price to the same total is reported
//   as a mismatch and dropped, not folded in. A pure reattribution must leave the
//   total alone; one that does not is a counting error, not a finding.
//
// The denominator is stated rather than implied: of the entries in the registry,
// this reports how many had no clock, how many had no usable command, and how
// many were measured. A session whose `task.js` calls predate the transcript
// Claude Code still has cannot be measured and is counted, not skipped quietly.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const registry = require('../../../../lib/registry.js');
const usage = require('../../../../lib/usage.js');
const prices = require('../../../../lib/prices.js');
const live = require('../../../../lib/live.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PROJECTS = path.join(live.liveConfigDir() || path.join(os.homedir(), '.claude'), 'projects');
const HERE = path.join(PROJECTS, ROOT.replace(/[^A-Za-z0-9]/g, '-'));
const SESSIONS = path.join(ROOT, '.fankeel', 'sessions');

// A session at or above this is a long task for the purpose of block 3 — the
// population docs/reports/2026-09-21-long-task-projection.md's own conclusion is
// about. Its 43 sessions were picked by request-count bucket, not by dollars, so
// this is a near neighbour of that population and not the same one; the output
// says so rather than letting the two be read as one.
const LONG_USD = 50;

const out = [];
const say = (line) => out.push(line === undefined ? '' : String(line));
const usd = (n) => '$' + n.toFixed(2);
const pct = (n) => (100 * n).toFixed(1) + '%';

// Every `task.js stage <name>` the transcript carries, with the timestamp of the
// assistant turn that issued it. Kept in order rather than keyed by stage: a
// verify that went back to build moved into `build` twice.
function stageCalls(file, notBefore) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    const found = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let j;
        try { j = JSON.parse(line); } catch (e) { continue; }
        if (j.type !== 'assistant' || !j.message || !j.timestamp) continue;
        const at = Date.parse(j.timestamp);
        if (!Number.isFinite(at) || at < notBefore) continue;
        for (const c of j.message.content || []) {
            if (c.type !== 'tool_use') continue;
            // An invocation, not a mention of one. Matching the whole tool input
            // counted a Write whose body quoted the command as if it were the
            // command: on the session that found this, 7 such mentions against 13
            // real invocations, and one placed a stamp 170 seconds BEFORE the
            // command it was supposedly taken from. A shell tool, and the match
            // inside its own `command` field, is what tells them apart. Not
            // narrowed further with `--session`, so an invocation written some
            // other way is still found.
            if (c.name !== 'Bash' && c.name !== 'PowerShell') continue;
            const cmd = c.input && typeof c.input.command === 'string' ? c.input.command : '';
            // `--session` required, and the separator allows a line
            // continuation. Measured over 241 top-level transcripts: the
            // plain-single-space form matched 509, allowing `\` and a newline
            // matches 510 — one real invocation the narrower form missed — and
            // requiring `--session` leaves 507, dropping three that quote the
            // command without running it, one of them a heredoc writing a
            // progress file.
            //
            // The residual, named rather than claimed closed: a shell command
            // that quotes the WHOLE invocation including `--session` still
            // passes. So the remaining error runs in both directions, not only
            // the conservative one.
            if (!cmd.includes('--session')) continue;
            const m = cmd.match(/task\.js[\s\\]+stage[\s\\]+([a-z]+)/);
            if (m) found.push({ stage: m[1], at });
        }
    }
    return found;
}

function splitOf(transcript, windows) {
    const seen = usage.summariseTree(transcript, { stages: windows });
    if (!seen) return null;
    const rows = {};
    for (const side of [seen.usage.stages, seen.usage.subagents && seen.usage.subagents.stages]) {
        for (const [stage, b] of Object.entries(side || {})) {
            const real = {};
            for (const [id, m] of Object.entries(b.models)) if (id !== '<synthetic>') real[id] = m;
            const c = prices.costOf(real);
            if (c.unpriced.length) throw new Error('unpriced model: ' + c.unpriced.join(','));
            rows[stage] = (rows[stage] || 0) + c.usd;
        }
    }
    return rows;
}

// The two window sets for one session: as recorded, and with each boundary moved
// back to the command that caused it. Null when nothing could be matched.
function bothWindows(data, calls) {
    const recorded = registry.windowsFrom(data.clock);
    if (recorded.length < 2) return null;
    const observed = recorded.map((w) => ({ stage: w.stage, from: w.from, to: w.to }));
    let matched = 0;
    let worst = { stage: null, min: 0 };
    for (let i = 1; i < observed.length; i += 1) {
        const cands = calls.filter((c) => c.stage === observed[i].stage && c.at <= recorded[i].from);
        if (!cands.length) continue;
        const call = cands[cands.length - 1];
        if (call.at <= observed[i - 1].from) continue;
        observed[i].from = call.at;
        matched += 1;
        const d = (recorded[i].from - call.at) / 60000;
        if (d > worst.min) worst = { stage: observed[i].stage, min: d };
    }
    if (!matched) return null;
    for (let i = 0; i + 1 < observed.length; i += 1) observed[i].to = observed[i + 1].from;
    return { recorded, observed, matched, worst };
}

const rows = [];
const counts = { noClock: 0, noTranscript: 0, noCalls: 0, mismatch: 0 };

for (const f of fs.readdirSync(SESSIONS)) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace(/\.json$/, '');
    const data = registry.readSession(ROOT, id);
    if (!data || !data.clock || !data.started) { counts.noClock += 1; continue; }
    const t = path.join(HERE, id + '.jsonl');
    if (!fs.existsSync(t)) { counts.noTranscript += 1; continue; }
    const calls = stageCalls(t, Date.parse(data.started));
    if (!calls || !calls.length) { counts.noCalls += 1; continue; }
    const w = bothWindows(data, calls);
    if (!w) { counts.noCalls += 1; continue; }

    const a = splitOf(t, w.recorded);
    const b = splitOf(t, w.observed);
    if (!a || !b) { counts.noCalls += 1; continue; }
    const totalA = Object.values(a).reduce((x, y) => x + y, 0);
    const totalB = Object.values(b).reduce((x, y) => x + y, 0);
    if (Math.abs(totalA - totalB) > 0.005 || totalA <= 0) { counts.mismatch += 1; continue; }

    let absDiff = 0;
    for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) absDiff += Math.abs((a[s] || 0) - (b[s] || 0));

    rows.push({
        id: id.slice(0, 8),
        boundaries: w.matched,
        worstStage: w.worst.stage,
        worstMin: w.worst.min,
        usd: totalA,
        movedUsd: absDiff / 2,
        share: absDiff / 2 / totalA,
        firstStage: w.recorded[0].stage,
        recFirstShare: (a[w.recorded[0].stage] || 0) / totalA,
        obsFirstShare: (b[w.observed[0].stage] || 0) / totalB,
        firstMoved: (w.recorded[1].from - w.observed[1].from) / 60000,
    });
}

say('# what the late stage-stamp cost the per-stage split');
say('#');
say('# generated by docs/reports/evidence/2026-09-21-quota-calibration/drift.js');
say('# registry ' + SESSIONS);
say('# transcripts ' + HERE);
say('# prices.verified ' + prices.verified);
say('');
say('registry entries with no clock or no started   ' + counts.noClock);
say('entries with a clock but no transcript          ' + counts.noTranscript);
say('transcripts with no usable task.js stage call   ' + counts.noCalls);
say('sessions whose two bucketings priced differently ' + counts.mismatch);
say('sessions measured                               ' + rows.length);
say('');

say('## block 1 — per session');
say(['session', 'boundaries fixed', 'worst stage', 'worst min late', 'session usd', 'usd moved', 'share of cost moved'].join('\t'));
for (const r of rows.slice().sort((x, y) => y.share - x.share)) {
    say([r.id, r.boundaries, r.worstStage, r.worstMin.toFixed(1), usd(r.usd), usd(r.movedUsd), pct(r.share)].join('\t'));
}

const med = (xs) => {
    const s = [...xs].sort((x, y) => x - y);
    if (!s.length) return null;
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const long = rows.filter((r) => r.usd >= LONG_USD);

say('');
say('## block 2 — the population');
say('sessions measured                           ' + rows.length);
say('boundaries corrected                         ' + rows.reduce((x, y) => x + y.boundaries, 0));
say('median share of a session cost that moves    ' + pct(med(rows.map((r) => r.share))));
say('over 10% of the session cost moves           ' + rows.filter((r) => r.share > 0.1).length + ' sessions');
say('under 2% moves                               ' + rows.filter((r) => r.share < 0.02).length + ' sessions');
say('worst single boundary                        '
    + rows.reduce((x, y) => (y.worstMin > x.worstMin ? y : x), rows[0]).worstMin.toFixed(1) + ' minutes late');
say('');
say('the long ones only — at or above $' + LONG_USD + '. NOT the same population as the');
say('43 sessions in docs/reports/2026-09-21-long-task-projection.md, which were');
say('picked by request-count bucket; this is a dollar threshold and a near neighbour.');
say('  sessions                                  ' + long.length);
say('  median share that moves                    ' + (long.length ? pct(med(long.map((r) => r.share))) : '—'));
say('  worst                                      '
    + (long.length ? pct(Math.max(...long.map((r) => r.share))) : '—'));

say('');
say('## block 3 — the direction, on the figure another report leaned on');
say('That report rests one conclusion on survey being a median 7.96% of a long');
say('task: if survey is that small, tuning only survey\'s stage agent cannot pay.');
say('That figure is bucketed by `clock`. `survey` is the first window and runs');
say('from -Infinity, so a late second boundary hands survey some of the next');
say('stage\'s work — which would make the figure an over-estimate and the');
say('conclusion stronger. That is the reasoning. This is the measurement.');
say('');
const firstIsSurvey = rows.filter((r) => r.firstStage === 'survey');
const longSurvey = firstIsSurvey.filter((r) => r.usd >= LONG_USD);
say(['session', 'usd', 'survey share, clock', 'survey share, commands', 'change', 'first boundary moved'].join('\t'));
for (const r of longSurvey.slice().sort((x, y) => y.usd - x.usd)) {
    const d = r.obsFirstShare - r.recFirstShare;
    say([r.id, usd(r.usd), (100 * r.recFirstShare).toFixed(2) + '%', (100 * r.obsFirstShare).toFixed(2) + '%',
        (d >= 0 ? '+' : '') + (100 * d).toFixed(2) + 'pp',
        r.firstMoved.toFixed(1) + ' min earlier'].join('\t'));
}
for (const [label, set] of [['all ' + firstIsSurvey.length + ' sessions whose route opens at survey', firstIsSurvey],
    ['the ' + longSurvey.length + ' of those at or above $' + LONG_USD, longSurvey]]) {
    if (!set.length) continue;
    const a = med(set.map((r) => r.recFirstShare));
    const b = med(set.map((r) => r.obsFirstShare));
    say('');
    say(label + ':');
    say('  median survey share, as clock buckets it   ' + (100 * a).toFixed(2) + '%');
    say('  median survey share, by the commands       ' + (100 * b).toFixed(2) + '%');
    say('  direction                                  '
        + (b < a ? 'clock OVER-states survey by ' + (100 * (a - b)).toFixed(2) + 'pp'
            : 'clock UNDER-states survey by ' + (100 * (b - a)).toFixed(2) + 'pp'));
    say('  sessions where survey shrank               ' + set.filter((r) => r.obsFirstShare < r.recFirstShare).length
        + ' of ' + set.length);
}

let sha = 'unknown';
try {
    sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch (e) {
    sha = 'unknown';
}
const outPath = path.join(__dirname, 'drift-at-' + sha + '.txt');
fs.writeFileSync(outPath, out.join('\n') + '\n');
process.stdout.write(out.join('\n') + '\n');
process.stdout.write('\nwritten to ' + outPath + '\n');
