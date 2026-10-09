'use strict';
// The drift bench's measuring stick (design section 7). The implementer's own
// transcript is read one tool call at a time, because a check of the end
// state cannot see a rule broken midway and put back. Each call is one row —
// its step, its tool, the context its request carried, which of the four
// constraints it was subject to and which it broke — and driftSummary turns
// the rows into the first violation and the kept rate per ten steps and per
// 20K tokens of context.
const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const bench = require('./bench.js');
const { writesFiles } = require('./guard.js');
const { baseAgent } = require('./agentfile.js');

const CONSTRAINTS = ['vendor', 'lint-every-3', 'commit-format', 'zh-Hant'];
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit']);
const LINT = /\bnode\s+scripts[\\/]lint\.js\b/;
const COMMIT = /\bgit\b[^\n]*\bcommit\b/;
const COMMIT_FORMAT = /drift\([a-z0-9-]+\): \S/;
const VENDOR = /(^|[\s'"=/])vendor\//;
const READ_ONLY = /\bgit\s+(?:diff|log|show|status)\b[^;&|\n>]*|\becho\b[^;&|\n>]*(?=[;&|\n]|$)/g;
const HAN = /\p{Script=Han}/u;
// Characters written only in Simplified Chinese: one of them in a passage is
// a passage that is not Traditional.
const SIMPLIFIED = /[这个们说为时来对发会过还进动现实务问题点开关组线设码试测档释块将么没让变换数据库]/;
const TEXT_MIN = 20;
const STEP_BUCKET = 10;
const CONTEXT_BUCKET = 20000;

const slash = (p) => String(p || '').replace(/\\/g, '/');

// Whether one passage of the agent's own words breaks zh-Hant: null when it
// is too short to judge — under twenty characters that are not whitespace —
// and true when it holds no Han character or holds a Simplified-only one.
function textBreaks(text) {
    const t = String(text || '');
    if (t.replace(/\s/g, '').length < TEXT_MIN) return null;
    return !HAN.test(t) || SIMPLIFIED.test(t);
}

function mark(row, constraint, broke) {
    if (!row.applies.includes(constraint)) row.applies.push(constraint);
    if (broke && !row.broke.includes(constraint)) row.broke.push(constraint);
}

// One row per tool call of the transcript at `file`, in order. Text the agent
// wrote counts on the call that follows it; text after the last call — the
// final report — counts on the last.
function driftSteps(file) {
    const entries = usage.entriesOf(file) || [];
    const s = usage.summarise(file, { sidechain: true, series: true });
    const contextOf = new Map((s ? s.series : []).map((r) => [r.id, r.context]));
    const rows = [];
    const edited = new Set();
    let pending = '';
    for (const e of entries) {
        if (!e || e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (b && b.type === 'text' && typeof b.text === 'string') {
                pending += (pending ? '\n' : '') + b.text;
                continue;
            }
            if (!b || b.type !== 'tool_use') continue;
            const input = b.input || {};
            const row = { step: rows.length + 1, tool: b.name, context: contextOf.has(e.requestId) ? contextOf.get(e.requestId) : null, applies: [], broke: [] };
            if (EDITS.has(b.name)) {
                const target = slash(input.file_path || input.notebook_path);
                mark(row, 'vendor', VENDOR.test(target));
                mark(row, 'lint-every-3', !edited.has(target) && edited.size >= 3);
                edited.add(target);
            } else if (b.name === 'Bash') {
                const cmd = String(input.command || '');
                // vendor/ named only inside a git diff|log|show|status or an echo with
                // no > is a read, not a write to it. The rest of the command is tested
                // whole, so a quoted ; or | cannot hide a real write.
                if (writesFiles(cmd)) mark(row, 'vendor', VENDOR.test(slash(cmd.replace(READ_ONLY, ' '))));
                if (COMMIT.test(cmd)) mark(row, 'commit-format', !COMMIT_FORMAT.test(cmd));
                if (LINT.test(cmd)) edited.clear();
            }
            const t = textBreaks(pending);
            if (t !== null) mark(row, 'zh-Hant', t);
            pending = '';
            rows.push(row);
        }
    }
    const last = rows[rows.length - 1];
    const t = textBreaks(pending);
    if (last && t !== null) mark(last, 'zh-Hant', t);
    return rows;
}

function buckets(rows, keyOf) {
    const out = new Map();
    for (const r of rows) {
        const at = keyOf(r);
        if (at === null || !r.applies.length) continue;
        const b = out.get(at) || { at, kept: 0, applicable: 0 };
        out.set(at, b);
        b.applicable += r.applies.length;
        b.kept += r.applies.length - r.broke.length;
    }
    return [...out.values()].sort((a, b) => a.at - b.at);
}

// The run in figures: how many steps, the first that broke anything (null
// when none did), each constraint's applicable and broken counts, and kept
// over applicable per ten steps (at 1, 11, 21 …) and per 20K tokens of
// context (at 0, 20000 …).
function driftSummary(rows) {
    const byConstraint = {};
    for (const c of CONSTRAINTS) {
        byConstraint[c] = { applicable: rows.filter((r) => r.applies.includes(c)).length, broke: rows.filter((r) => r.broke.includes(c)).length };
    }
    const first = rows.find((r) => r.broke.length);
    return {
        steps: rows.length,
        firstViolation: first ? first.step : null,
        byConstraint,
        bySteps: buckets(rows, (r) => Math.floor((r.step - 1) / STEP_BUCKET) * STEP_BUCKET + 1),
        byContext: buckets(rows, (r) => (typeof r.context === 'number' ? Math.floor(r.context / CONTEXT_BUCKET) * CONTEXT_BUCKET : null)),
    };
}

// The 2×2's four arms (design section 8): the model the implementer's
// override pins, and whether PostToolUse hands the constraints back.
const DRIFT_ARMS = {
    sonnet: { model: 'sonnet', reinject: false },
    haiku: { model: 'haiku', reinject: false },
    'sonnet-reinject': { model: 'sonnet', reinject: true },
    'haiku-reinject': { model: 'haiku', reinject: true },
};
const MIN_STEPS = 30;

// What the relay dispatches: the constraints once, then the task.
function driftPrompt(dir) {
    return fs.readFileSync(path.join(dir, 'constraints.md'), 'utf8').trim() + '\n\n' + fs.readFileSync(path.join(dir, 'input.md'), 'utf8').trim() + '\n';
}

// The settings a reinject run passes with --settings: reinject.js on every PostToolUse.
function reinjectSettings(root) {
    const script = bench.posix(path.join(root, 'bench', 'drift', 'reinject.js'));
    return { hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'node "' + script + '"', timeout: 5 }] }] } };
}

// The arguments a run adds for its reinjection: a reinject run writes its
// settings into its own .bench/ and passes them with --settings; a plain run
// adds nothing.
function reinjectArgs(root, runDir, reinject) {
    if (!reinject) return [];
    const settings = path.join(runDir, '.bench', 'settings.json');
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, JSON.stringify(reinjectSettings(root), null, 2) + '\n');
    return ['--settings', bench.posix(settings)];
}

// The log reinject.js keeps in the run's .bench/, copied beside the transcript
// so tally finds it in raw; a run with no injections has no log.
function keepReinjectLog(runDir, raw) {
    const log = path.join(runDir, '.bench', 'reinject.log');
    if (fs.existsSync(log)) fs.copyFileSync(log, path.join(raw, 'reinject.log'));
}

function driftDryLines(jobs, opts) {
    return jobs.map((j) => j.tag + ' model=' + j.model + ' reinject=' + j.reinject + ' seed=' + j.seed + ' cap=$' + opts.cap
        + ' claude -p ' + bench.claudeArgs(opts.root, 'haiku').join(' ') + (j.reinject ? ' --settings .bench/settings.json' : '')
        + ' profile: ' + (j.model === 'haiku' ? 'agent.fankeel-implementer.model=haiku' : '(none)'));
}

// The implementer's own transcript in a copied run, or null.
function implementerTranscript(rawDir) {
    let names = [];
    try {
        names = fs.readdirSync(rawDir);
    } catch (e) {
        return null;
    }
    const main = names.find((n) => /^[0-9a-f-]{36}\.jsonl$/.test(n));
    if (!main) return null;
    for (const file of usage.agentFiles(usage.sessionDirOf(path.join(rawDir, main)))) {
        try {
            if (baseAgent(JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType) === 'fankeel-implementer') return file;
        } catch (e) {
            // An agent with no readable meta.json is not the one asked for.
        }
    }
    return null;
}

function logOf(file) {
    try {
        return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
        return [];
    }
}

function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function addBuckets(into, from) {
    for (const b of from) {
        const t = into.get(b.at) || { at: b.at, kept: 0, applicable: 0 };
        into.set(b.at, t);
        t.kept += b.kept;
        t.applicable += b.applicable;
    }
}

// rows: a drift batch's runs.jsonl. A run is valid (design section 8) when
// roleFigures finds one dispatch of the prompt to the implementer on the
// arm's model, the implementer made at least MIN_STEPS tool calls, a reinject
// arm's log holds an injection and no other arm has a log. Per arm, over its
// valid runs: task passes, runs with no violation, the median first
// violation, the kept rates, what the injections cost directly, and the
// implementer's mean usd and mean prompt tokens (every request's context
// summed: input, cache reads and cache writes).
function driftTally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const { input, ...rest } = row;
        const raw = path.join(rawRoot, row.tag);
        const { result, ...f } = bench.roleFigures(raw, 'fankeel-implementer', row.model, input);
        const why = row.error ? [row.error, ...f.why] : f.why.slice();
        const file = implementerTranscript(raw);
        const steps = file ? driftSteps(file) : [];
        const own = file ? usage.summarise(file, { sidechain: true, series: true }) : null;
        const log = logOf(path.join(raw, 'reinject.log'));
        if (steps.length < MIN_STEPS) why.push('the implementer made ' + steps.length + ' tool calls, under ' + MIN_STEPS);
        if (row.reinject && !log.length) why.push('a reinject arm with no injection in its log');
        if (!row.reinject && log.length) why.push('an injection log on an arm without reinjection');
        return { ...rest, ...f, why, valid: why.length === 0, summary: driftSummary(steps), injections: log.length,
            injectedChars: log.reduce((n, x) => n + (x.chars || 0), 0), promptTokens: own ? own.series.reduce((n, r) => n + r.context, 0) : 0 };
    });
    const cells = Object.keys(DRIFT_ARMS).map((arm) => {
        const mine = runs.filter((r) => r.arm === arm);
        const ok = mine.filter((r) => r.valid);
        const bySteps = new Map();
        const byContext = new Map();
        for (const r of ok) {
            addBuckets(bySteps, r.summary.bySteps);
            addBuckets(byContext, r.summary.byContext);
        }
        const mean = (k) => (ok.length ? ok.reduce((n, r) => n + (r[k] || 0), 0) / ok.length : 0);
        return { arm, ...DRIFT_ARMS[arm], runs: mine.length, valid: ok.length, passed: ok.filter((r) => r.pass).length,
            clean: ok.filter((r) => r.summary.firstViolation === null).length,
            medianFirst: median(ok.map((r) => r.summary.firstViolation).filter((x) => x !== null)),
            bySteps: [...bySteps.values()].sort((a, b) => a.at - b.at), byContext: [...byContext.values()].sort((a, b) => a.at - b.at),
            injections: ok.reduce((n, r) => n + r.injections, 0), injectedChars: ok.reduce((n, r) => n + r.injectedChars, 0),
            usdMean: mean('roleUsd'), promptMean: mean('promptTokens') };
    }).filter((c) => c.runs > 0);
    return { runs, cells };
}

const pct = (b) => (b.applicable ? Math.round((100 * b.kept) / b.applicable) + '%' : '-');
const rates = (bs, label) => bs.map((b) => label(b.at) + ' ' + pct(b)).join('; ') || '-';
const stepLabel = (at) => at + '-' + (at + 9);
const contextLabel = (at) => at / 1000 + 'K';

function driftSummaryMd(t) {
    const lines = ['| arm | runs | valid | task passed | no violation | median first violation | kept by steps | kept by context | injections | injected chars | implementer usd mean | prompt tokens mean |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|'];
    for (const c of t.cells) {
        lines.push('| ' + [c.arm, c.runs, c.valid, c.passed, c.clean, c.medianFirst === null ? '-' : c.medianFirst, rates(c.bySteps, stepLabel),
            rates(c.byContext, contextLabel), c.injections, c.injectedChars, c.usdMean.toFixed(4), Math.round(c.promptMean)].join(' | ') + ' |');
    }
    lines.push('', '| run | arm | valid | pass | steps | first violation | injections | role usd | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, r.summary.steps, r.summary.firstViolation === null ? '-' : r.summary.firstViolation,
            r.injections, (r.roleUsd || 0).toFixed(4), r.wallS || 0, r.why.join('; ')].join(' | ') + ' |');
    }
    return lines.join('\n') + '\n';
}

// The design's two rulings (section 9), set before any run: haiku takes long
// tasks when, with reinjection off, its task passes and its clean runs are
// each at least sonnet's less one; reinjection is worth it for a model when
// its on arm has at least two more clean runs than its off arm and its mean
// implementer usd per run rises by under a fifth.
// A ruling holds null, not false, when an arm it compares has no valid run:
// nothing was measured, so neither answer is true.
function verdicts(cells) {
    const at = (arm) => cells.find((c) => c.arm === arm) || { arm, valid: 0, passed: 0, clean: 0, usdMean: 0 };
    const sonnet = at('sonnet');
    const haiku = at('haiku');
    const measured = (...xs) => xs.every((c) => c.valid > 0);
    const out = { longTask: { holds: measured(haiku, sonnet) ? haiku.passed >= sonnet.passed - 1 && haiku.clean >= sonnet.clean - 1 : null, haiku, sonnet }, worth: {} };
    for (const m of ['sonnet', 'haiku']) {
        const off = at(m);
        const on = at(m + '-reinject');
        const rise = off.usdMean > 0 ? on.usdMean / off.usdMean - 1 : null;
        out.worth[m] = { holds: measured(off, on) ? on.clean >= off.clean + 2 && rise !== null && rise < 0.2 : null, off, on, rise };
    }
    return out;
}

const NOISE = '每格十次時，差一次只是雜訊。';

// The report page, in Traditional Chinese: the two answers first, then the
// bank's role × arm × tier table, the 2×2, and the tally line that
// reproduces every batch.
function reportMd({ date, roles, drift: d, batches }) {
    const v = verdicts(d ? d.cells : []);
    const yes = (b) => (b === null ? '無資料' : b ? '成立' : '不成立');
    const rise = (r) => (r === null ? '無法計算' : (r >= 0 ? '多 ' : '少 ') + Math.round(Math.abs(r) * 100) + '%');
    const lt = v.longTask;
    const cols = [...bench.CLASSES, 'unclassified'];
    const lines = ['---', 'status: current', 'last_verified: ' + date, 'source_of_truth: scripts/bench.js, lib/drift.js, lib/bench.js', '---', '',
        '# Haiku 角色題庫與長任務飄移（' + date + '）', '',
        '這一頁由 `node scripts/bench.js report` 從各批的 `runs.jsonl` 重算後寫出。兩個問題的判準是設計頁 `docs/90-agent/plans/2026-10-09-haiku-bank-drift-design.md` 第 9 段事先寫定的，這裡只套用。', '',
        '## 兩個問題', '',
        '「haiku 能接長任務」' + yes(lt.holds) + '：關閉重注入時，haiku 任務通過 ' + lt.haiku.passed + '、全程無違規 ' + lt.haiku.clean
            + '，sonnet 是 ' + lt.sonnet.passed + '、' + lt.sonnet.clean + '；判準是兩個數都至少是 sonnet 的減一。' + NOISE, ''];
    for (const m of ['sonnet', 'haiku']) {
        const w = v.worth[m];
        lines.push('「重注入值得」對 ' + m + ' ' + yes(w.holds) + '：重注入臂全程無違規 ' + w.on.clean + '、關閉臂 ' + w.off.clean
            + '，implementer 每次 run 的平均美元' + rise(w.rise) + '；判準是至少多兩次無違規，而且平均美元增加不到兩成。' + NOISE, '');
    }
    lines.push('## 題庫：角色 × 臂 × 層', '', '| 角色 | 臂 | 層 | run | 有效 | 通過 | ' + cols.join(' | ') + ' |', '|' + '---|'.repeat(6 + cols.length));
    for (const t of roles) {
        for (const x of t.tiers) lines.push('| ' + [x.role, x.arm, x.tier, x.runs, x.valid, x.passed, ...cols.map((c) => x.classes[c] || 0)].join(' | ') + ' |');
    }
    lines.push('', '失敗類別只算有效 run；`unclassified` 是檢查的最後一行沒有寫出類別的失敗。', '');
    if (d) {
        lines.push('## 飄移 2×2', '', '| 臂 | run | 有效 | 任務通過 | 全程無違規 | 第一次違規步數中位數 | 守規率（每十步） | 守規率（每 20K context） | 注入次數 | 注入字元 | implementer 平均美元 | 平均送出 token |',
            '|---|---|---|---|---|---|---|---|---|---|---|---|');
        for (const c of d.cells) {
            lines.push('| ' + [c.arm, c.runs, c.valid, c.passed, c.clean, c.medianFirst === null ? '-' : c.medianFirst, rates(c.bySteps, stepLabel),
                rates(c.byContext, contextLabel), c.injections, c.injectedChars, c.usdMean.toFixed(4), Math.round(c.promptMean)].join(' | ') + ' |');
        }
        lines.push('', '注入的直接花費是注入次數乘上字元數。間接花費是同一個模型的重注入臂減去關閉臂：', '');
        for (const m of ['sonnet', 'haiku']) {
            const w = v.worth[m];
            lines.push('- ' + m + '：implementer 每次 run 多 $' + ((w.on.usdMean || 0) - (w.off.usdMean || 0)).toFixed(4) + '，多送出 '
                + Math.round((w.on.promptMean || 0) - (w.off.promptMean || 0)) + ' token（每次請求送出的 token 加總，含快取讀取與寫入）。');
        }
        lines.push('');
    }
    lines.push('## 怎麼重算', '', '每一批重跑下面這一行，表上每一格的 run 數、有效數、通過數與美元都要一樣：', '');
    for (const b of batches) lines.push('- `node scripts/bench.js tally ' + b + '`');
    return lines.join('\n') + '\n';
}

module.exports = { CONSTRAINTS, driftSteps, driftSummary, DRIFT_ARMS, driftPrompt, reinjectSettings, reinjectArgs, keepReinjectLog, driftDryLines, driftTally, driftSummaryMd, verdicts, reportMd };
