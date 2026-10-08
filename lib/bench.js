'use strict';
// The model bench's logic, kept apart from its runner so it can be tested
// without spending money: the arms, the order they run in, what a dry run
// prints, the prompts a staged run sends, whether `haiku` resolved to Haiku
// 5.5, each check.sh against its two-sided controls, and the per-run and
// per-arm figures read back from copied transcripts. scripts/bench.js spawns.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const usage = require('./usage.js');
const prices = require('./prices.js');
const { baseAgent } = require('./agentfile.js');

const HAIKU_55 = /^claude-haiku-5-5(?:-\d{8})?$/;
const TIER_AT = 100000;
const SUB_ROLES = ['fankeel-reader', 'fankeel-mover', 'fankeel-mutator', 'fankeel-verifier'];

function haikuAt(roles, effort) {
    const out = {};
    for (const r of roles) {
        out['agent.' + r + '.model'] = 'haiku';
        out['agent.' + r + '.effort'] = effort;
    }
    return out;
}

// Each arm changes the profile and `haiku` (the roles that must show Haiku
// 5.5); the `impl` arm also sets `impl`. The rest stays as in `base`. `profile` is what `task.js
// profile set` writes before the run; `impl` replaces `@IMPL@` in task.md and
// reaches setup.sh as BENCH_IMPL; `haiku` lists the roles whose transcripts
// must show Haiku 5.5 for the run to count. There is no brain arm and no
// whole-session arm: the design leaves both out.
const ARMS = {
    base: { profile: {}, impl: 'sonnet', haiku: [] },
    sub: { profile: haikuAt(SUB_ROLES, 'high'), impl: 'sonnet', haiku: SUB_ROLES },
    impl: { profile: haikuAt(['fankeel-implementer'], 'high'), impl: 'haiku', haiku: ['fankeel-implementer'] },
    reviewer: { profile: haikuAt(['fankeel-reviewer'], 'high'), impl: 'sonnet', haiku: ['fankeel-reviewer'] },
};

const posix = (p) => String(p).split(path.sep).join('/');

// Odd rounds run the arms as given, even rounds reversed, so neither always
// pays the cold cache. The seed is the round: rounds 2 and 3 regenerate a
// seeded fixture rather than repeat round 1's.
function order(arms, runs) {
    const out = [];
    for (let r = 1; r <= runs; r++) {
        const round = r % 2 === 1 ? arms.slice() : arms.slice().reverse();
        for (const arm of round) out.push({ round: r, arm, seed: r });
    }
    return out;
}

// Every claude -p call of a run carries these; the run adds the session
// flag, what is left of the cap, and the prompt on stdin.
function claudeArgs(root) {
    return ['--setting-sources', 'project', '--plugin-dir', posix(root), '--permission-mode', 'bypassPermissions',
        '--model', 'sonnet', '--output-format', 'json'];
}

function dryLines(name, conf, schedule, opts) {
    return schedule.map(({ round, arm, seed }) => {
        const a = ARMS[arm];
        const set = Object.entries(a.profile).map(([k, v]) => k + '=' + v).join(' ') || '(none)';
        return 'r' + round + ' ' + name + ' ' + arm + ' seed=' + (conf.seeded ? seed : '-') + ' impl=' + a.impl
            + ' route=' + (conf.route || 'single') + ' cap=$' + opts.cap + ' claude -p ' + claudeArgs(opts.root).join(' ')
            + ' profile: ' + set;
    });
}

// The prompts of one staged run, as ab.sh sends them: start the task on its
// route, then one prompt per stage that takes option one at the gate and
// moves the task on. The task text rides on the first stage's prompt.
function stagePrompts(conf, task, session, root) {
    const stages = conf.route.split(',');
    const cli = 'node ' + posix(root) + '/scripts/task.js';
    const out = ['Run this command and report its output, nothing else: ' + cli + ' start --session ' + session
        + ' --task "' + conf.title + '" --route ' + conf.route];
    stages.forEach((stage, i) => {
        const next = stages[i + 1];
        let p = 'Do the ' + stage + ' stage of this task. There is no user in this run: at the stage\'s gate do not call AskUserQuestion — take option one yourself';
        p += next ? ', run ' + cli + ' stage ' + next + ' --session ' + session + ', and stop.' : ' and stop.';
        if (i === 0) p += '\n\nThe task:\n' + task;
        out.push(p);
    });
    return out;
}

// `claude -p --output-format json` ends with a result whose `modelUsage` is
// keyed by the model ids that answered. The probe asked for `haiku`, so
// every claude-haiku id there is what the alias resolved to.
function aliasVerdict(result) {
    const ids = Object.keys((result && result.modelUsage) || {}).filter((id) => /^claude-haiku/.test(id));
    if (!ids.length) return { ok: false, ids, why: 'no claude-haiku id in modelUsage' };
    const off = ids.filter((id) => !HAIKU_55.test(id));
    if (off.length) return { ok: false, ids, why: 'haiku resolved to ' + off.join(', ') + ', not claude-haiku-5-5' };
    return { ok: true, ids, why: 'haiku resolved to ' + ids.join(', ') };
}

// Each check.sh against its own controls: every directory under controls/
// named pass* must pass and every one named fail* must fail, each laid over a
// fresh setup.sh. A project missing either side is an error, because a check
// only ever shown passing cannot be told from one that passes everything.
function selftest(projectDir, opts) {
    const name = path.basename(projectDir);
    const errors = [];
    let controls = [];
    try {
        controls = fs.readdirSync(path.join(projectDir, 'controls'));
    } catch (e) {
        controls = [];
    }
    const pass = controls.filter((c) => c.startsWith('pass'));
    const fail = controls.filter((c) => c.startsWith('fail'));
    if (!pass.length) errors.push(name + ': no controls/pass');
    if (!fail.length) errors.push(name + ': no controls/fail');
    const env = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: opts.plugin };
    for (const c of [...pass, ...fail]) {
        const dir = opts.mkdtemp();
        try {
            const s = spawnSync('bash', [posix(path.join(projectDir, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
            if (s.status !== 0) {
                errors.push(name + ' ' + c + ': setup.sh exited ' + s.status + ' — ' + (s.stderr || '').trim());
                continue;
            }
            fs.cpSync(path.join(projectDir, 'controls', c), dir, { recursive: true });
            const r = spawnSync('bash', [posix(path.join(projectDir, 'check.sh')), posix(dir)], { env, encoding: 'utf8' });
            const wantPass = c.startsWith('pass');
            if ((r.status === 0) !== wantPass) {
                errors.push(name + ' ' + c + ': check.sh exited ' + r.status + ', wanted ' + (wantPass ? '0' : 'non-zero')
                    + ' — ' + ((r.stdout || '') + (r.stderr || '')).trim().slice(0, 300));
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    return errors;
}

// Why one claude -p call did not complete, or null. A non-zero exit, a null
// status (killed, timed out) and a spawn error are the run's failure, not the
// model's, so the run is marked and never counted as a valid failing run.
function callError(r) {
    if (r.error) return 'claude did not run: ' + r.error.message;
    if (r.status !== 0) return 'claude exited ' + r.status + ': ' + String(r.stderr || '').trim().slice(-300);
    return null;
}

function transcriptIn(dir) {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return null;
    }
    const t = names.find((n) => /^[0-9a-f-]{36}\.jsonl$/.test(n));
    return t ? path.join(dir, t) : null;
}

function agentTypeOf(file) {
    try {
        return baseAgent(JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType) || 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

function fold(into, from) {
    for (const [id, m] of Object.entries(from || {})) {
        const t = into[id] || (into[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
        for (const k of Object.keys(t)) t[k] += m[k] || 0;
    }
}

// One run, read back from its copied transcript and subagents directory. It
// counts when every agent of a role in `haiku` ran on Haiku 5.5 throughout,
// when at least one of those roles was dispatched at all — an arm none of
// whose roles ran measured nothing — and when every role in `requires` ran.
function runFigures(rawDir, haiku, requires) {
    const main = transcriptIn(rawDir);
    if (!main) return { error: 'no transcript in ' + rawDir, valid: false };
    const tree = usage.summariseTree(main);
    const models = {};
    fold(models, tree && tree.usage.models);
    fold(models, tree && tree.usage.subagents && tree.usage.subagents.models);
    const cost = prices.costOf(models);
    const own = usage.summarise(main, { series: true });
    let over100k = (own ? own.series : []).filter((r) => HAIKU_55.test(r.model) && r.context > TIER_AT).length;
    const roles = {};
    const mismatched = [];
    for (const file of usage.agentFiles(usage.sessionDirOf(main))) {
        const s = usage.summarise(file, { sidechain: true, series: true });
        if (!s) continue;
        const type = agentTypeOf(file);
        const r = roles[type] || (roles[type] = { dispatches: 0, prefix: [], cacheRead: 0, prompt: 0, models: [] });
        r.dispatches += 1;
        r.prefix.push(s.series[0].context);
        const ran = [];
        for (const row of s.series) {
            r.cacheRead += row.tokens.cacheRead;
            r.prompt += row.context;
            if (!ran.includes(row.model)) ran.push(row.model);
            if (HAIKU_55.test(row.model) && row.context > TIER_AT) over100k++;
        }
        for (const m of ran) if (!r.models.includes(m)) r.models.push(m);
        if (type === 'unknown' && haiku.length) mismatched.push(path.basename(file) + ' role unreadable (no usable meta.json)');
        if (haiku.includes(type) && ran.some((m) => !HAIKU_55.test(m))) {
            mismatched.push(path.basename(file) + ' ' + type + ' ran ' + ran.join(','));
        }
    }
    for (const r of Object.values(roles)) r.hitRate = r.prompt ? r.cacheRead / r.prompt : 0;
    const unexercised = (requires || []).filter((t) => !roles[t]);
    if (haiku.length && !haiku.some((t) => roles[t])) unexercised.push('none of ' + haiku.join(', '));
    return {
        usd: cost.usd, unpriced: cost.unpriced, estimated: cost.estimated, models, over100k, roles,
        wakes: own ? own.usage.wakes : 0, mismatched, unexercised,
        valid: mismatched.length === 0 && unexercised.length === 0,
    };
}

// rows: the lines of a batch's runs.jsonl. A row bench.js already marked
// with an error — capped, a setup that failed — is never valid.
function tally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const f = runFigures(path.join(rawRoot, row.tag), ARMS[row.arm].haiku, row.requires);
        return { ...row, ...f, error: row.error || f.error || null, valid: !row.error && f.valid };
    });
    const arms = new Map();
    for (const r of runs) {
        const key = r.project + ' ' + r.arm;
        const a = arms.get(key) || { project: r.project, arm: r.arm, runs: 0, valid: 0, passed: 0, usd: 0 };
        arms.set(key, a);
        a.runs += 1;
        a.usd += r.usd || 0;
        if (r.valid) {
            a.valid += 1;
            if (r.pass) a.passed += 1;
        }
    }
    return { runs, arms: [...arms.values()] };
}

// The external bench's rule: per project, the cheapest arm whose every run
// was valid and passed. One failure, or one invalid run, and the arm is not
// clean. A project with no clean arm is left out.
function verdict(arms) {
    const best = {};
    for (const a of arms) {
        const clean = a.runs > 0 && a.valid === a.runs && a.passed === a.valid;
        if (clean && (!best[a.project] || a.usd < best[a.project].usd)) best[a.project] = a;
    }
    return Object.fromEntries(Object.entries(best).map(([p, a]) => [p, a.arm]));
}

function summaryMd(t) {
    const lines = ['| project | arm | runs | valid | passed | usd |', '|---|---|---|---|---|---|'];
    for (const a of t.arms) lines.push('| ' + [a.project, a.arm, a.runs, a.valid, a.passed, a.usd.toFixed(4)].join(' | ') + ' |');
    lines.push('', '| run | arm | valid | pass | usd | over 100K | wakes | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        const why = r.error || (r.mismatched || []).join('; ') || (r.unexercised || []).join(', ') || '';
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, (r.usd || 0).toFixed(4), r.over100k || 0, r.wakes || 0, r.wallS || 0, why].join(' | ') + ' |');
    }
    const v = verdict(t.arms);
    lines.push('', 'verdict, the cheapest arm that passed n/n on valid runs:');
    for (const p of [...new Set(t.arms.map((a) => a.project))]) lines.push('- ' + p + ': ' + (v[p] || 'none'));
    return lines.join('\n') + '\n';
}

// A finished run must survive a transient Windows lock on its temp dir (EPERM, 2026-10-08):
// retry, and on a final failure warn and return the leftover dir instead of throwing.
function cleanup(dir, rm = fs.rmSync, warn = console.error) {
    try {
        rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
        return null;
    } catch (e) {
        warn('bench.js: could not remove ' + dir + ': ' + e.message);
        return dir;
    }
}

module.exports = { cleanup, ARMS, posix, order, claudeArgs, dryLines, stagePrompts, callError, aliasVerdict, selftest, tally, verdict, summaryMd };
