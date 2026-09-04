// Pull the figures out of a `claude -p --output-format json` arm file.
// Definitions are the ones both published reports state, and this script is
// validated by reproducing their printed numbers before it is used on pair 3.
//
//   main-thread context = usage.input_tokens
//                       + usage.cache_read_input_tokens
//                       + usage.cache_creation_input_tokens
//   all-model tokens    = sum over modelUsage of
//                         inputTokens + outputTokens
//                       + cacheReadInputTokens + cacheCreationInputTokens
//                         (NOT maxOutputTokens, a cap; NOT thinkingTokens,
//                          already inside outputTokens)
//
// usage: node extract.js <arm.json> [<arm.json> ...]
const fs = require('fs');

function figures(path) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  const u = j.usage || {};
  const parent =
    (u.input_tokens || 0) +
    (u.cache_read_input_tokens || 0) +
    (u.cache_creation_input_tokens || 0);

  const mu = j.modelUsage || {};
  const perModel = {};
  let allTokens = 0;
  for (const [model, m] of Object.entries(mu)) {
    const t =
      (m.inputTokens || 0) +
      (m.outputTokens || 0) +
      (m.cacheReadInputTokens || 0) +
      (m.cacheCreationInputTokens || 0);
    perModel[model] = { tokens: t, cost: m.costUSD };
    allTokens += t;
  }

  return {
    parent,
    allTokens,
    perModel,
    cost: j.total_cost_usd,
    spawned: j.subagent_stats ? j.subagent_stats.spawned : undefined,
    duration_ms: j.duration_ms,
    num_turns: j.num_turns,
  };
}

const n = (x) => (x === undefined ? '-' : x.toLocaleString('en-US'));

for (const p of process.argv.slice(2)) {
  const f = figures(p);
  console.log('--- ' + p.replace(/^.*[\\/]/, ''));
  console.log('  parent context : ' + n(f.parent));
  console.log('  all-model      : ' + n(f.allTokens));
  for (const [m, v] of Object.entries(f.perModel)) {
    console.log('    ' + m + ' : ' + n(v.tokens) + ' tokens / $' + v.cost.toFixed(4));
  }
  console.log('  total_cost_usd : ' + f.cost);
  console.log('  spawned        : ' + f.spawned);
  console.log('  num_turns      : ' + f.num_turns);
  console.log('  duration_ms    : ' + n(f.duration_ms));
}
