#!/usr/bin/env node
'use strict';
// The model bench: run a bench project's arms with claude -p, each run in a
// fresh temp directory built by the project's setup.sh and graded by its
// check.sh, with the transcript copied out for tally.
//
//   node scripts/bench.js probe
//   node scripts/bench.js selftest [<project>...]
//   node scripts/bench.js run <project> --arms <a,b> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>]
//   node scripts/bench.js role <role> --arms <sonnet,haiku> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>]
//   node scripts/bench.js tally <batch dir> [--evidence <dir>]
//
// Every run goes through --permission-mode bypassPermissions, so a run only
// ever happens inside an mkdtemp directory; and `run` asks `probe` first
// whenever an arm puts a role on haiku: an alias that resolves to anything
// but Haiku 5.5 stops the batch before any arm runs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const bench = require('../lib/bench.js');
const { spawnClaude } = require('./eval.js');

const ROOT = path.join(__dirname, '..');

function lastJson(stdout) {
    const lines = String(stdout || '').trim().split(/\r?\n/);
    try {
        return JSON.parse(lines[lines.length - 1]);
    } catch (e) {
        return null;
    }
}

function probe() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-probe-'));
    try {
        const r = spawnClaude(['-p', '--model', 'haiku', '--output-format', 'json', '--setting-sources', 'project', '--max-budget-usd', '0.10'],
            { cwd: dir, input: 'Reply with the single word ok.', encoding: 'utf8', timeout: 120e3 });
        return bench.aliasVerdict(lastJson(r.stdout));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function md5(file) {
    return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function git(cwd, args) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function provenance(log, extra) {
    const version = String(spawnClaude(['--version'], { encoding: 'utf8' }).stdout || '').trim();
    fs.appendFileSync(log, ['=== ' + new Date().toISOString(),
        'HEAD: ' + git(ROOT, ['rev-parse', 'HEAD']).stdout.trim(),
        'porcelain:', git(ROOT, ['status', '--porcelain']).stdout.trimEnd(),
        'claude: ' + version,
        'scripts/bench.js md5: ' + md5(__filename),
        'lib/bench.js md5: ' + md5(path.join(ROOT, 'lib', 'bench.js')),
        ...extra].join('\n') + '\n');
}

function copyTranscript(session, dest) {
    const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
    let dirs = [];
    try {
        dirs = fs.readdirSync(projects);
    } catch (e) {
        return false;
    }
    for (const d of dirs) {
        const file = path.join(projects, d, session + '.jsonl');
        if (!fs.existsSync(file)) continue;
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(file, path.join(dest, session + '.jsonl'));
        const sub = path.join(projects, d, session);
        if (fs.existsSync(sub)) fs.cpSync(sub, path.join(dest, session), { recursive: true });
        return true;
    }
    return false;
}

function runOne(ctx, item) {
    const arm = bench.ARMS[item.arm];
    const tag = 'r' + item.round + '-' + item.arm;
    const row = { tag, project: ctx.name, arm: item.arm, round: item.round, seed: item.seed, requires: ctx.conf.requires || [],
        pass: false, check: '', exit: [], claudeUsd: 0, wallS: 0, error: null, session: crypto.randomUUID() };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-'));
    const env = { ...process.env, BENCH_SEED: String(item.seed), BENCH_IMPL: arm.impl, BENCH_PLUGIN: bench.posix(ROOT) };
    try {
        const s = spawnSync('bash', [bench.posix(path.join(ctx.project, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
        if (s.status !== 0) {
            row.error = 'setup.sh exited ' + s.status + ': ' + (s.stderr || '').trim();
            return row;
        }
        for (const [key, value] of Object.entries(arm.profile)) {
            const p = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'task.js'), 'profile', 'set', key, value], { cwd: dir, encoding: 'utf8' });
            if (p.status !== 0) {
                row.error = 'profile set ' + key + ' exited ' + p.status + ': ' + (p.stderr || '').trim();
                return row;
            }
        }
        for (const role of arm.haiku) {
            const f = path.join(dir, '.claude', 'agents', role + '.md');
            if (!/^model: haiku$/m.test(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
                row.error = f + ' does not pin haiku';
                return row;
            }
        }
        for (const args of [['add', '-A'], ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', 'commit', '-q', '--allow-empty', '-m', 'bench: arm ' + item.arm]]) {
            const g = git(dir, args);
            if (g.status !== 0) {
                row.error = 'baseline git ' + args.find((x) => x === 'add' || x === 'commit') + ' exited ' + g.status + ': ' + (g.stderr || '').trim();
                return row;
            }
        }
        const task = fs.readFileSync(path.join(ctx.project, 'task.md'), 'utf8').trim().replace(/@IMPL@/g, arm.impl);
        const prompts = ctx.conf.route ? bench.stagePrompts(ctx.conf, task, row.session, ROOT) : [task];
        const t0 = Date.now();
        for (let i = 0; i < prompts.length; i++) {
            const left = ctx.cap - row.claudeUsd;
            if (left < 0.5) {
                row.error = 'capped: $' + row.claudeUsd.toFixed(2) + ' spent before call ' + (i + 1) + ' of ' + prompts.length;
                break;
            }
            const args = ['-p', ...(i === 0 ? ['--session-id', row.session] : ['--resume', row.session]),
                '--max-budget-usd', left.toFixed(2), ...bench.claudeArgs(ROOT)];
            const r = spawnClaude(args, { cwd: dir, env, input: prompts[i], encoding: 'utf8', timeout: 45 * 60e3, maxBuffer: 64 * 1024 * 1024 });
            row.exit.push(r.status);
            // --resume reports cost cumulatively (ab.sh), so the run's spend is the largest seen.
            const out = lastJson(r.stdout);
            if (out && typeof out.total_cost_usd === 'number') row.claudeUsd = Math.max(row.claudeUsd, out.total_cost_usd);
            const failed = bench.callError(r);
            if (failed) {
                row.error = 'call ' + (i + 1) + ' of ' + prompts.length + ': ' + failed;
                break;
            }
        }
        row.wallS = Math.round((Date.now() - t0) / 1000);
        const c = spawnSync('bash', [bench.posix(path.join(ctx.project, 'check.sh')), bench.posix(dir)], { env, encoding: 'utf8' });
        row.pass = c.status === 0;
        row.check = ((c.stdout || '') + (c.stderr || '')).trim().slice(-500);
        if (!copyTranscript(row.session, path.join(ctx.batchDir, 'raw', tag)) && !row.error) row.error = 'no transcript for session ' + row.session;
        return row;
    } finally {
        if (ctx.keep) row.dir = dir;
        else {
            const left = bench.cleanup(dir);
            if (left) row.dir = left;
        }
    }
}

// A role under bench/roles/: its role.json, its input.md, and the directory
// its setup.sh, check.sh and controls live in.
function readRole(projectsRoot, name) {
    const dir = path.join(projectsRoot, 'roles', name);
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(dir, 'role.json'), 'utf8'));
        return { dir, conf, project: bench.roleProject(dir), input: fs.readFileSync(path.join(dir, 'input.md'), 'utf8') };
    } catch (e) {
        return null;
    }
}

// One role run: a fresh setup, the haiku arm's override, one relay session on
// haiku that dispatches the role once, then the role's return written to
// .bench/result.txt for check.sh.
function runRole(ctx, item) {
    const tag = 'r' + item.round + '-' + item.arm;
    const row = { tag, role: ctx.name, agent: ctx.role.conf.agent, arm: item.arm, round: item.round, input: ctx.role.input,
        pass: false, check: '', exit: null, claudeUsd: 0, wallS: 0, error: null, session: crypto.randomUUID() };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-role-'));
    const env = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: bench.posix(ROOT) };
    try {
        const s = spawnSync('bash', [bench.posix(path.join(ctx.role.project, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
        if (s.status !== 0) {
            row.error = 'setup.sh exited ' + s.status + ': ' + (s.stderr || '').trim();
            return row;
        }
        if (item.arm === 'haiku') {
            const key = 'agent.' + row.agent + '.model';
            const p = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'task.js'), 'profile', 'set', key, 'haiku'], { cwd: dir, encoding: 'utf8' });
            const f = path.join(dir, '.claude', 'agents', row.agent + '.md');
            if (p.status !== 0 || !/^model: haiku$/m.test(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
                row.error = 'profile set ' + key + ' did not pin haiku: ' + (p.stderr || '').trim();
                return row;
            }
        }
        const t0 = Date.now();
        const args = ['-p', '--session-id', row.session, '--max-budget-usd', ctx.cap.toFixed(2), ...bench.claudeArgs(ROOT, 'haiku')];
        const r = spawnClaude(args, { cwd: dir, env, input: bench.relayPrompt(row.agent, row.input), encoding: 'utf8',
            timeout: 20 * 60e3, maxBuffer: 64 * 1024 * 1024 });
        row.wallS = Math.round((Date.now() - t0) / 1000);
        row.exit = r.status;
        const out = lastJson(r.stdout);
        if (out && typeof out.total_cost_usd === 'number') row.claudeUsd = out.total_cost_usd;
        row.error = bench.callError(r);
        const raw = path.join(ctx.batchDir, 'raw', tag);
        if (!copyTranscript(row.session, raw)) {
            row.error = row.error || 'no transcript for session ' + row.session;
            return row;
        }
        const f = bench.roleFigures(raw, row.agent, row.arm, row.input);
        fs.mkdirSync(path.join(dir, '.bench'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.bench', 'result.txt'), f.result);
        const c = spawnSync('bash', [bench.posix(path.join(ctx.role.project, 'check.sh')), bench.posix(dir)], { env, encoding: 'utf8' });
        row.pass = c.status === 0;
        row.check = ((c.stdout || '') + (c.stderr || '')).trim().slice(-500);
        return row;
    } finally {
        if (ctx.keep) row.dir = dir;
        else {
            const left = bench.cleanup(dir);
            if (left) row.dir = left;
        }
    }
}

const today = () => new Date().toISOString().slice(0, 10);
const defaultEvidence = () => path.join(ROOT, 'docs', '90-agent', 'reports', 'evidence', today() + '-haiku-bench');

function cmdRun(a, projectsRoot) {
    const name = a.positionals[1] || '';
    const project = path.join(projectsRoot, name);
    let conf;
    try {
        conf = JSON.parse(fs.readFileSync(path.join(project, 'bench.json'), 'utf8'));
    } catch (e) {
        console.error('bench.js: no bench.json under ' + project);
        return 1;
    }
    const arms = String(a.values.arms || '').split(',').filter(Boolean);
    const bad = arms.filter((x) => !bench.ARMS[x] || !conf.arms.includes(x));
    if (!arms.length || bad.length) {
        console.error('bench.js: --arms is a comma list of ' + conf.arms.join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
        return 1;
    }
    const runs = Number(a.values.runs || 3);
    const cap = Number(a.values.cap || 5);
    if (!(runs >= 1) || !(cap > 0)) {
        console.error('bench.js: --runs is at least 1 and --cap above 0');
        return 1;
    }
    const schedule = bench.order(arms, runs);
    if (a.values.dry) {
        console.log(bench.dryLines(name, conf, schedule, { cap, root: ROOT }).join('\n'));
        return 0;
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const evidence = a.values.evidence ? path.resolve(a.values.evidence) : defaultEvidence();
    const batchDir = path.join(ROOT, '.fankeel', 'build', 'bench', name + '-' + stamp);
    fs.mkdirSync(evidence, { recursive: true });
    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(path.join(batchDir, 'evidence.txt'), evidence + '\n');
    const log = path.join(evidence, 'provenance.txt');
    const extra = ['batch: ' + batchDir, 'project: ' + name + '  arms: ' + arms.join(',') + '  runs: ' + runs + '  cap: $' + cap];
    if (arms.some((x) => bench.ARMS[x].haiku.length)) {
        const v = probe();
        extra.push('probe: ' + v.why);
        if (!v.ok) {
            provenance(log, extra);
            console.error('bench.js: ' + v.why + ' — no arm ran');
            return 1;
        }
    }
    provenance(log, extra);
    for (const item of schedule) {
        const row = runOne({ name, conf, project, cap, keep: Boolean(a.values.keep), batchDir }, item);
        fs.appendFileSync(path.join(batchDir, 'runs.jsonl'), JSON.stringify(row) + '\n');
        console.log(row.tag + ' pass=' + row.pass + ' $' + row.claudeUsd.toFixed(4) + ' ' + row.wallS + 's' + (row.error ? ' — ' + row.error : ''));
    }
    console.log('batch: ' + batchDir);
    console.log('next: node scripts/bench.js tally ' + bench.posix(batchDir));
    return 0;
}

function cmdRole(a, projectsRoot) {
    const name = a.positionals[1] || '';
    const role = readRole(projectsRoot, name);
    if (!role) {
        console.error('bench.js: no role.json and input.md under ' + path.join(projectsRoot, 'roles', name));
        return 1;
    }
    const arms = String(a.values.arms || 'sonnet,haiku').split(',').filter(Boolean);
    const bad = arms.filter((x) => !bench.ROLE_ARMS[x]);
    if (!arms.length || bad.length) {
        console.error('bench.js: --arms is a comma list of ' + Object.keys(bench.ROLE_ARMS).join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
        return 1;
    }
    const runs = Number(a.values.runs || 5);
    const cap = Number(a.values.cap || 1);
    if (!(runs >= 1) || !(cap > 0)) {
        console.error('bench.js: --runs is at least 1 and --cap above 0');
        return 1;
    }
    const schedule = bench.order(arms, runs);
    if (a.values.dry) {
        console.log(bench.roleDryLines(name, role.conf.agent, schedule, { cap, root: ROOT }).join('\n'));
        return 0;
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const evidence = a.values.evidence ? path.resolve(a.values.evidence) : defaultEvidence();
    const batchDir = path.join(ROOT, '.fankeel', 'build', 'bench', 'role-' + name + '-' + stamp);
    fs.mkdirSync(evidence, { recursive: true });
    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(path.join(batchDir, 'evidence.txt'), evidence + '\n');
    const log = path.join(evidence, 'provenance.txt');
    const extra = ['batch: ' + batchDir, 'role: ' + name + ' (' + role.conf.agent + ')  arms: ' + arms.join(',') + '  runs: ' + runs + '  cap: $' + cap];
    // The relay always runs on haiku, so the alias is settled before any run.
    const v = probe();
    extra.push('probe: ' + v.why);
    provenance(log, extra);
    if (!v.ok) {
        console.error('bench.js: ' + v.why + ' — no run started');
        return 1;
    }
    for (const item of schedule) {
        const row = runRole({ name, role, cap, keep: Boolean(a.values.keep), batchDir }, item);
        fs.appendFileSync(path.join(batchDir, 'runs.jsonl'), JSON.stringify(row) + '\n');
        console.log(row.tag + ' pass=' + row.pass + ' $' + row.claudeUsd.toFixed(4) + ' ' + row.wallS + 's' + (row.error ? ' — ' + row.error : ''));
    }
    console.log('batch: ' + batchDir);
    console.log('next: node scripts/bench.js tally ' + bench.posix(batchDir));
    return 0;
}

function cmdTally(a) {
    const batchDir = path.resolve(a.positionals[1] || '');
    let rows;
    try {
        rows = fs.readFileSync(path.join(batchDir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
        console.error('bench.js: no runs.jsonl under ' + batchDir);
        return 1;
    }
    let evidence = a.values.evidence ? path.resolve(a.values.evidence) : null;
    if (!evidence) {
        try {
            evidence = fs.readFileSync(path.join(batchDir, 'evidence.txt'), 'utf8').trim();
        } catch (e) {
            evidence = defaultEvidence();
            console.error('bench.js: no evidence.txt under ' + batchDir + '; writing to ' + evidence);
        }
    }
    const isRole = rows.length > 0 && typeof rows[0].role === 'string';
    const t = isRole ? bench.roleTally(rows, path.join(batchDir, 'raw')) : bench.tally(rows, path.join(batchDir, 'raw'));
    const out = path.join(evidence, path.basename(batchDir));
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(t, null, 2) + '\n');
    const md = isRole ? bench.roleSummaryMd(t) : bench.summaryMd(t);
    fs.writeFileSync(path.join(out, 'summary.md'), md);
    process.stdout.write(md);
    return 0;
}

function cmdSelftest(a, projectsRoot) {
    const named = a.positionals.slice(1);
    const rolesDir = path.join(projectsRoot, 'roles');
    const roles = fs.existsSync(rolesDir)
        ? fs.readdirSync(rolesDir).filter((n) => fs.existsSync(path.join(rolesDir, n, 'role.json'))).map((n) => 'roles/' + n)
        : [];
    const all = named.length ? named
        : [...fs.readdirSync(projectsRoot).filter((n) => fs.existsSync(path.join(projectsRoot, n, 'bench.json'))), ...roles];
    const errors = [];
    for (const n of all) {
        errors.push(...bench.selftest(bench.roleProject(path.join(projectsRoot, n)),
            { mkdtemp: () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-self-')), plugin: bench.posix(ROOT) }));
    }
    for (const e of errors) console.log(e);
    console.log(errors.length ? errors.length + ' control(s) judged wrong' : 'selftest ok: ' + all.join(', '));
    return errors.length ? 1 : 0;
}

function main(argv) {
    const a = parseArgs({ args: argv, allowPositionals: true, strict: false, options: {
        arms: { type: 'string' }, runs: { type: 'string' }, cap: { type: 'string' }, dry: { type: 'boolean' },
        keep: { type: 'boolean' }, evidence: { type: 'string' }, projects: { type: 'string' },
    } });
    const projectsRoot = a.values.projects ? path.resolve(a.values.projects) : path.join(ROOT, 'bench');
    const verb = a.positionals[0];
    if (verb === 'probe') {
        const v = probe();
        console.log(v.why);
        return v.ok ? 0 : 1;
    }
    if (verb === 'selftest') return cmdSelftest(a, projectsRoot);
    if (verb === 'run') return cmdRun(a, projectsRoot);
    if (verb === 'role') return cmdRole(a, projectsRoot);
    if (verb === 'tally') return cmdTally(a);
    console.error('usage: node scripts/bench.js probe | selftest [<project>...] | run <project> --arms <a,b> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>] | role <role> --arms <sonnet,haiku> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>] | tally <batch dir> [--evidence <dir>]');
    return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
