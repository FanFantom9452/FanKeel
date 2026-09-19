// Task 7 Step 3: one row per arm, read from each arm's `claude -p --output-format json`
// result and the script's own provenance log.
// usage: node ab-table.js
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = path.join(__dirname, 'ab');
const log = fs.readFileSync(path.join(DIR, 'provenance.txt'), 'utf8');
const ARMS = ['old1', 'new1', 'old2', 'new2'];

// A result file can hold the result line more than once; take the largest cost.
function results(file) {
    const out = [];
    const text = fs.readFileSync(file, 'utf8');
    try { out.push(JSON.parse(text)); } catch (e) {
        for (const line of text.split('\n')) { try { const o = JSON.parse(line); if (o.type === 'result') out.push(o); } catch (x) { /* not json */ } }
    }
    return out;
}

function sessionOf(arm) {
    const m = new RegExp('--- ' + arm + ' .*session ([0-9a-f-]{36})').exec(log);
    return m ? m[1] : null;
}

function shellSeconds(arm) {
    const at = log.indexOf('--- ' + arm + ' ');
    const m = /survey exit=(\d+) shell_seconds=(\d+)/.exec(log.slice(at));
    return m ? { exit: Number(m[1]), seconds: Number(m[2]) } : null;
}

console.log('| arm | model | stage.agents | shell s | cost (modelUsage) | total_cost_usd | input | output | cache read | cache write | turns | subagents | handoff |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const arm of ARMS) {
    const file = path.join(DIR, arm + '-survey.json');
    if (!fs.existsSync(file)) { console.log('| ' + arm + ' | (no result file) |'); continue; }
    const rs = results(file);
    const r = rs.sort((a, b) => (b.total_cost_usd || 0) - (a.total_cost_usd || 0))[0] || {};
    const mu = r.modelUsage || {};
    let cost = 0, inp = 0, outp = 0, cr = 0, cw = 0;
    for (const m of Object.values(mu)) {
        cost += m.costUSD || 0; inp += m.inputTokens || 0; outp += m.outputTokens || 0;
        cr += m.cacheReadInputTokens || 0; cw += m.cacheCreationInputTokens || 0;
    }
    const s = sessionOf(arm);
    const sub = s ? path.join(os.homedir(), '.claude', 'projects', 'F--ymlab-fankeel', s, 'subagents') : null;
    let agents = [];
    try { agents = fs.readdirSync(sub).filter((n) => n.endsWith('.meta.json')).map((n) => JSON.parse(fs.readFileSync(path.join(sub, n), 'utf8')).agentType); } catch (e) { /* none */ }
    const kinds = {};
    for (const a of agents) kinds[a] = (kinds[a] || 0) + 1;
    const sh = shellSeconds(arm);
    const isNew = arm.startsWith('new');
    console.log('| ' + [arm, Object.keys(mu).join(' + ') || '?', isNew ? 'true' : 'false',
        sh ? sh.seconds + (sh.exit ? ' (exit ' + sh.exit + ')' : '') : '?',
        '$' + cost.toFixed(2), r.total_cost_usd != null ? '$' + Number(r.total_cost_usd).toFixed(2) : '?',
        inp, outp, cr, cw, r.num_turns != null ? r.num_turns : '?',
        Object.entries(kinds).map(([k, n]) => n + ' ' + k.replace('fankeel:', '')).join(', ') || 'none',
        s ? 'session ' + s.slice(0, 8) : '?'].join(' | ') + ' |');
}
console.log('\nper model, per arm:');
for (const arm of ARMS) {
    const file = path.join(DIR, arm + '-survey.json');
    if (!fs.existsSync(file)) continue;
    const r = results(file).sort((a, b) => (b.total_cost_usd || 0) - (a.total_cost_usd || 0))[0] || {};
    for (const [model, m] of Object.entries(r.modelUsage || {})) {
        console.log('  ' + arm + '  ' + model + '  $' + (m.costUSD || 0).toFixed(4) + '  in ' + (m.inputTokens || 0) + '  out ' + (m.outputTokens || 0) + '  cacheR ' + (m.cacheReadInputTokens || 0) + '  cacheW ' + (m.cacheCreationInputTokens || 0));
    }
}
