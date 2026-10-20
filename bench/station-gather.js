'use strict';
// Station speed (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// gather() as `serve()` runs it, against this machine's own registries, with
// the server's holds — one cold, three to warm, five timed — then the gather
// the detail route runs for the newest live session (an ended one answers from
// the shared model and costs nothing). The design's bar is a warm median of
// 150 ms or less for both.
//
//   node bench/station-gather.js [--config <dir>]
const station = require('../lib/station.js');
const live = require('../lib/live.js');

const at = process.argv.indexOf('--config');
const configDir = at > 0 && process.argv[at + 1] ? process.argv[at + 1] : live.liveConfigDir();
const holds = { memo: new Map(), rowMemo: new Map(), buildMemo: new Map() };
const base = { configDir, roots: [], scan: [], cwd: process.cwd(), detailBudgetMs: station.DETAIL_BUDGET_MS };
const timed = (fn) => {
    const t = process.hrtime.bigint();
    const out = fn();
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, out };
};
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function run(label, extra) {
    const opts = Object.assign({}, base, holds, extra);
    const cold = timed(() => station.gather(opts));
    for (let i = 0; i < 3; i++) station.gather(opts);
    const warm = [];
    for (let i = 0; i < 5; i++) warm.push(timed(() => station.gather(opts)).ms);
    console.log(label + ': cold ' + cold.ms.toFixed(0) + ' ms, warm median ' + median(warm).toFixed(0)
        + ' ms (' + warm.map((x) => x.toFixed(0)).join(' ') + ')');
    return cold.out;
}

const model = run('gather');
const rows = model.registries.flatMap((r) => r.sessions).sort((a, b) => (b.updated || 0) - (a.updated || 0));
console.log('sessions: ' + rows.length + ', live: ' + rows.filter((s) => s.state === 'live').length);
const pick = rows.find((s) => s.state === 'live') || rows[0];
if (pick) run('detail ' + pick.sessionId.slice(0, 8), { details: pick.sessionId });
