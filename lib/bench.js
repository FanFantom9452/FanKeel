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
const { readObject } = require('./json.js');

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

const { posix } = require('./tracked.js');

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
// flag, what is left of the cap, and the prompt on stdin. A role run's relay
// passes `haiku`; a whole run keeps `sonnet`.
function claudeArgs(root, model) {
    return ['--setting-sources', 'project', '--plugin-dir', posix(root), '--permission-mode', 'bypassPermissions',
        '--model', model || 'sonnet', '--output-format', 'json'];
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

// Lays one control over a fresh setup: copies its files over `dir`, and when
// it carries a control.sh — a control that has to make git history, such as
// the mover's commit — runs it there and removes it, so check.sh never sees
// it. Returns why it failed, or null.
function layControl(projectDir, control, dir, env) {
    fs.cpSync(path.join(projectDir, 'controls', control), dir, { recursive: true });
    const script = path.join(dir, 'control.sh');
    if (!fs.existsSync(script)) return null;
    const r = spawnSync('bash', [posix(script)], { windowsHide: true, cwd: dir, env, encoding: 'utf8' });
    fs.rmSync(script, { force: true });
    return r.status === 0 ? null : 'control.sh exited ' + r.status + ' — ' + String(r.stderr || '').trim();
}

// The item bank (design sections 1 and 2): a role's items live under items/,
// one directory each, its tier the name's prefix. A check.sh's last line is
// `pass` or `fail <class>: <why>`, and a fail control is named for the class
// it must draw — `fail-extra`, or `fail-extra-2` for a second of that class.
const TIERS = ['easy', 'mid', 'trap'];
const CLASSES = ['wrong', 'fabricated', 'unrestored', 'extra', 'format'];
const ITEM_PARTS = ['input.md', 'setup.sh', 'check.sh', 'controls'];

const tierOf = (id) => TIERS.find((t) => String(id || '').startsWith(t + '-')) || null;

// Every directory under <role>/items/, sorted, with its tier and input.md. A
// file there — a judge the items share — is not an item; no items/ is none.
function roleItems(roleDir) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(roleDir, 'items'), { withFileTypes: true });
    } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
    return entries.filter((d) => d.isDirectory()).map((d) => d.name).sort().map((id) => {
        const dir = path.join(roleDir, 'items', id);
        const file = path.join(dir, 'input.md');
        return { id, tier: tierOf(id), dir, input: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
    });
}

function itemErrors(item) {
    const out = [];
    if (!item.tier) out.push(item.id + ': the name starts with none of ' + TIERS.map((t) => t + '-').join(', '));
    for (const part of ITEM_PARTS) if (!fs.existsSync(path.join(item.dir, part))) out.push(item.id + ': no ' + part);
    return out;
}

// The class a check.sh's output names on its last line: null for `pass`, the
// class for `fail <class>: <why>`, and `unclassified` for anything else.
function checkClass(output) {
    const lines = String(output || '').trim().split(/\r?\n/);
    const last = lines[lines.length - 1].trim();
    if (last === 'pass') return null;
    const m = /^fail ([a-z]+): \S/.exec(last);
    return m && CLASSES.includes(m[1]) ? m[1] : 'unclassified';
}

// The class a fail control's name promises, or null for one that names none.
function controlClass(name) {
    const m = /^fail-([a-z]+)(?:-\d+)?$/.exec(String(name));
    return m && CLASSES.includes(m[1]) ? m[1] : null;
}

// selftest over every item of a role, under each seed in opts.seeds (1 when
// none), with the class rule on; opts.only narrows it to the items named.
function selftestRole(roleDir, opts) {
    const role = path.basename(roleDir);
    const items = roleItems(roleDir).filter((it) => !opts.only || opts.only.includes(it.id));
    if (!items.length) return [role + ': no items under items/'];
    const seeds = opts.seeds && opts.seeds.length ? opts.seeds : [1];
    const errors = [];
    for (const item of items) {
        const bad = itemErrors(item);
        if (bad.length) {
            errors.push(...bad.map((e) => role + '/' + e));
            continue;
        }
        for (const seed of seeds) {
            const label = role + '/' + item.id + (seeds.length > 1 ? ' seed ' + seed : '');
            errors.push(...selftest(item.dir, { ...opts, classes: true, seed, label }));
        }
    }
    return errors;
}

// Each check.sh against its own controls: every directory under controls/
// named pass* must pass and every one named fail* must fail, each laid over a
// fresh setup.sh. A project missing either side is an error, because a check
// only ever shown passing cannot be told from one that passes everything.
// With opts.classes — every item under bench/roles/ and bench/drift — a pass
// control must also end on `pass`, and a fail control be named fail-<class>
// and end on `fail <class>: …` of that class, so a control failing for
// another clause's reason no longer reads as proof of its own. opts.seed is
// BENCH_SEED (1 when unset); opts.label names the target in each error.
function selftest(projectDir, opts) {
    const name = opts.label || path.basename(projectDir);
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
    if (opts.classes) {
        for (const c of fail) {
            if (!controlClass(c)) errors.push(name + ' ' + c + ': a fail control is named fail-<class>, the class one of ' + CLASSES.join(', '));
        }
    }
    const env = { ...process.env, BENCH_SEED: String(opts.seed || 1), BENCH_IMPL: 'sonnet', BENCH_PLUGIN: opts.plugin };
    for (const c of [...pass, ...fail]) {
        const dir = opts.mkdtemp();
        try {
            const s = spawnSync('bash', [posix(path.join(projectDir, 'setup.sh'))], { windowsHide: true, cwd: dir, env, encoding: 'utf8' });
            if (s.status !== 0) {
                errors.push(name + ' ' + c + ': setup.sh exited ' + s.status + ' — ' + (s.stderr || '').trim());
                continue;
            }
            const laid = layControl(projectDir, c, dir, env);
            if (laid) {
                errors.push(name + ' ' + c + ': ' + laid);
                continue;
            }
            const r = spawnSync('bash', [posix(path.join(projectDir, 'check.sh')), posix(dir)], { windowsHide: true, env, encoding: 'utf8' });
            const out = ((r.stdout || '') + (r.stderr || '')).trim();
            const wantPass = c.startsWith('pass');
            if ((r.status === 0) !== wantPass) {
                errors.push(name + ' ' + c + ': check.sh exited ' + r.status + ', wanted ' + (wantPass ? '0' : 'non-zero') + ' — ' + out.slice(0, 300));
                continue;
            }
            if (!opts.classes) continue;
            const want = wantPass ? null : controlClass(c);
            if (!wantPass && !want) continue;
            const got = checkClass(r.stdout);
            if (got !== want) {
                errors.push(name + ' ' + c + ': check.sh\'s last line names ' + (got || 'pass') + ', wanted ' + (want || 'pass') + ' — ' + out.slice(-300));
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
    const meta = readObject(file.replace(/\.jsonl$/, '.meta.json'));
    return (meta && baseAgent(meta.agentType)) || 'unknown';
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

// The role bench (design section 5): a relay session on haiku dispatches one
// role once, with input.md as its prompt, and only that agent is measured.
// An arm is the model the role's own transcript must show throughout.
const ROLE_ARMS = { sonnet: /^claude-sonnet-/, haiku: HAIKU_55 };
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

function relayPrompt(agent, input) {
    return 'You are a relay, and this is your whole job. Call the Agent tool exactly once, with subagent_type "fankeel:' + agent
        + '", model "sonnet", description "bench ' + agent + '", and as its prompt the text between the two marker lines below,'
        + ' copied exactly, character for character, without the marker lines. Make no other tool call.'
        + ' When the agent returns, reply with the single word done.\n'
        + '<<<BENCH INPUT\n' + norm(input) + '\nBENCH INPUT>>>\n';
}

function roleDryLines(name, agent, jobs, opts) {
    return jobs.map((j) => j.tag + ' ' + name + ' ' + j.row.item + ' ' + j.arm + ' seed=' + j.seed + ' cap=$' + opts.cap
        + ' claude -p ' + claudeArgs(opts.root, 'haiku').join(' ')
        + ' profile: ' + (j.model === 'haiku' ? 'agent.' + agent + '.model=haiku' : '(none)'));
}

// A bounded pool, lib/fanout.js's shape: `width` workers draining one queue,
// so at most `width` jobs are in flight and the next starts as one finishes.
async function pool(jobs, width, fn) {
    const queue = jobs.slice();
    await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => {
        for (;;) {
            const job = queue.shift();
            if (job === undefined) return;
            await fn(job);
        }
    }));
}

// Every Agent or Task tool_use the main transcript made, each with the text
// that came back for it: the tool_result, or — for a dispatch that ran in the
// background — the task-notification naming it, which arrives later and wins.
function dispatchesIn(main) {
    const calls = [];
    const results = new Map();
    for (const e of usage.entriesOf(main) || []) {
        if (!e || e.isSidechain === true || !e.message) continue;
        const content = Array.isArray(e.message.content) ? e.message.content : [];
        if (e.type === 'assistant') {
            for (const b of content) {
                if (b && b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) calls.push({ id: b.id, input: b.input || {} });
            }
        } else if (e.type === 'user') {
            const n = usage.notificationOf(e);
            if (n) {
                const text = usage.textOf(e.message.content);
                const m = /<result>\n?([\s\S]*?)<\/result>/.exec(text);
                results.set(n.toolUseId, m ? m[1] : text);
            }
            for (const b of content) {
                if (b && b.type === 'tool_result' && !results.has(b.tool_use_id)) results.set(b.tool_use_id, usage.textOf(b.content));
            }
        }
    }
    return calls.map((c) => ({ ...c, result: results.get(c.id) || '' }));
}

// One role run, read back from its copied transcript. Valid when the relay
// dispatched exactly once, sent input.md unchanged, got text back, and the
// only agent that ran was the role, on the arm's model throughout. The
// role's money is its own transcript's; the relay's is listed apart.
function roleFigures(rawDir, agent, arm, input) {
    const main = transcriptIn(rawDir);
    if (!main) return { valid: false, why: ['no transcript in ' + rawDir], roleUsd: 0, relayUsd: 0, models: [], result: '' };
    const why = [];
    const calls = dispatchesIn(main);
    if (calls.length !== 1) why.push('the relay dispatched ' + calls.length + ' times, not once');
    const call = calls[0];
    if (call && norm(call.input.prompt) !== norm(input)) why.push('the dispatched prompt differs from input.md');
    if (call && !norm(call.result)) why.push('the dispatch returned no text');
    const own = usage.summarise(main);
    const relayUsd = own ? prices.costOf(own.usage.models).usd : 0;
    let roleUsd = 0;
    let seen = false;
    const models = [];
    for (const file of usage.agentFiles(usage.sessionDirOf(main))) {
        const type = agentTypeOf(file);
        if (type !== agent) {
            why.push(path.basename(file) + ' is ' + type + ', not ' + agent);
            continue;
        }
        seen = true;
        const s = usage.summarise(file, { sidechain: true, series: true });
        if (!s) continue;
        roleUsd += prices.costOf(s.usage.models).usd;
        for (const row of s.series) if (!models.includes(row.model)) models.push(row.model);
    }
    if (!seen) why.push('no ' + agent + ' transcript');
    else if (!models.length) why.push('the ' + agent + ' made no request');
    const off = models.filter((m) => !ROLE_ARMS[arm].test(m));
    if (off.length) why.push(agent + ' ran ' + off.join(',') + ', not the ' + arm + ' arm');
    return { valid: why.length === 0, why, roleUsd, relayUsd, models, result: call ? call.result : '' };
}

// rows: the lines of a role batch's runs.jsonl. A row bench.js already marked
// with an error is never valid. The input text stays in runs.jsonl only.
function roleTally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const { input, ...rest } = row;
        const { result, ...f } = roleFigures(path.join(rawRoot, row.tag), row.agent, row.arm, input);
        const why = row.error ? [row.error, ...f.why] : f.why;
        return { ...rest, ...f, why, valid: !row.error && f.valid, tier: tierOf(row.item), class: row.pass ? null : checkClass(row.check) };
    });
    const arms = new Map();
    for (const r of runs) {
        const key = r.role + ' ' + r.arm;
        const a = arms.get(key) || { role: r.role, arm: r.arm, runs: 0, valid: 0, passed: 0, roleUsd: 0, relayUsd: 0 };
        arms.set(key, a);
        a.runs += 1;
        a.roleUsd += r.roleUsd || 0;
        a.relayUsd += r.relayUsd || 0;
        if (r.valid) {
            a.valid += 1;
            if (r.pass) a.passed += 1;
        }
    }
    // Role × arm × tier, each valid failure under its class. A row with no
    // item — a batch from before the bank — has no tier and no row here.
    const tiers = new Map();
    for (const r of runs) {
        if (!r.tier) continue;
        const key = r.role + ' ' + r.arm + ' ' + r.tier;
        const t = tiers.get(key) || { role: r.role, arm: r.arm, tier: r.tier, runs: 0, valid: 0, passed: 0, classes: {} };
        tiers.set(key, t);
        t.runs += 1;
        if (!r.valid) continue;
        t.valid += 1;
        if (r.pass) t.passed += 1;
        else t.classes[r.class] = (t.classes[r.class] || 0) + 1;
    }
    const byTier = (a, b) => a.role.localeCompare(b.role) || a.arm.localeCompare(b.arm) || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
    return { runs, arms: [...arms.values()], tiers: [...tiers.values()].sort(byTier) };
}

// The design's rule (section 7): a role may go to haiku only when its haiku
// arm was valid and passed on every run.
function roleSummaryMd(t) {
    const lines = ['| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |', '|---|---|---|---|---|---|---|---|'];
    for (const a of t.arms) {
        lines.push('| ' + [a.role, a.arm, a.runs, a.valid, a.passed, a.roleUsd.toFixed(4), (a.runs ? a.roleUsd / a.runs : 0).toFixed(4), a.relayUsd.toFixed(4)].join(' | ') + ' |');
    }
    if (t.tiers && t.tiers.length) {
        const cols = [...CLASSES, 'unclassified'];
        lines.push('', '| role | arm | tier | runs | valid | passed | ' + cols.join(' | ') + ' |', '|' + '---|'.repeat(6 + cols.length));
        for (const x of t.tiers) lines.push('| ' + [x.role, x.arm, x.tier, x.runs, x.valid, x.passed, ...cols.map((c) => x.classes[c] || 0)].join(' | ') + ' |');
    }
    lines.push('', '| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, r.class || '', (r.roleUsd || 0).toFixed(4), (r.relayUsd || 0).toFixed(4),
            (r.claudeUsd || 0).toFixed(4), r.wallS || 0, (r.why || []).join('; ')].join(' | ') + ' |');
    }
    lines.push('', 'role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.');
    lines.push('', 'verdict, haiku only where its arm was valid and passed n/n:');
    for (const a of t.arms.filter((x) => x.arm === 'haiku')) {
        lines.push('- ' + a.role + ': ' + (a.runs > 0 && a.valid === a.runs && a.passed === a.runs ? 'haiku' : 'not haiku'));
    }
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

module.exports = { cleanup, ARMS, ROLE_ARMS, TIERS, CLASSES, tierOf, roleItems, checkClass, controlClass, selftestRole, posix, order, claudeArgs, dryLines, roleDryLines, stagePrompts, relayPrompt, callError, aliasVerdict, selftest, layControl, pool, tally, roleFigures, roleTally, verdict, summaryMd, roleSummaryMd };
