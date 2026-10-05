'use strict';
// model-3: one row per run of ab.sh, and one per arm over its valid runs.
// A run is `r<round>-<arm>`: its stage json and wall files sit in the evidence
// dir as `<tag>-<stage>.json` / `.wall`, and raw/<tag>/ holds the controller
// transcript `<session>.jsonl`, its `<session>/subagents/` and the worktree's
// `.fankeel/build` copied as `build/`. `--resume` reports cost cumulatively, so
// a run's spend is its last stage file's, never a sum. A tool_use is counted
// once by its id, however many transcript lines repeat it. A run is valid
// only when its verify stage json exists and its judged brains ran on its arm's
// model, read off each brain's meta `description`, which hooks/title.js opens
// with the model. A brain's stage is read off the controller's Agent tool_use
// prompt, linked to the subagent through the tool_result's agentId.
// usage: node tally.js <evidence dir> <raw dir>
const fs = require('node:fs');
const path = require('node:path');

const ORDER = ['start', 'plan', 'build', 'verify'];
const MODEL_WORD = /^(opus|sonnet|haiku)\b/i;

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

function lines(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try { out.push(JSON.parse(l)); } catch (e) { /* a torn line */ }
    }
    return out;
}

function toolUses(entries) {
    const seen = new Map();
    for (const e of entries) {
        if (!e || e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const c of e.message.content) if (c && c.type === 'tool_use' && c.id) seen.set(c.id, c);
    }
    return [...seen.values()];
}

function resultTexts(entries) {
    const out = [];
    for (const e of entries) {
        if (!e || e.type !== 'user' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const c of e.message.content) {
            if (!c || c.type !== 'tool_result') continue;
            out.push(typeof c.content === 'string' ? c.content
                : Array.isArray(c.content) ? c.content.map((x) => (x && x.text) || '').join('\n') : '');
        }
    }
    return out;
}

// agentId -> stage word of the controller prompt that dispatched it. The id is
// on the tool_result entry (`toolUseResult.agentId`) or, failing that, in its
// text as `agentId: <id>`. Assumption: a brain with no link here is judged, not
// skipped, so a plan brain that cannot be linked invalidates a run rather than
// passing one.
function stagesByAgent(entries) {
    const stageOf = new Map();
    for (const u of toolUses(entries)) {
        if (u.name !== 'Agent') continue;
        const m = /^\s*(plan|design|build|verify)\b/.exec(String((u.input && u.input.prompt) || ''));
        if (m) stageOf.set(u.id, m[1]);
    }
    const out = new Map();
    for (const e of entries) {
        if (!e || e.type !== 'user' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const c of e.message.content) {
            if (!c || c.type !== 'tool_result' || !stageOf.has(c.tool_use_id)) continue;
            const text = typeof c.content === 'string' ? c.content
                : Array.isArray(c.content) ? c.content.map((x) => (x && x.text) || '').join('\n') : '';
            const id = (e.toolUseResult && e.toolUseResult.agentId) || (/agentId:\s*([\w-]+)/.exec(text) || [])[1];
            if (id) out.set(id, stageOf.get(c.tool_use_id));
        }
    }
    return out;
}

function filesUnder(dir, re) {
    const out = [];
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const d of names) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) out.push(...filesUnder(p, re));
        else if (re.test(d.name)) out.push(p);
    }
    return out;
}

function spend(evid, tag) {
    let last = null;
    for (const stage of ORDER) {
        const j = readJson(path.join(evid, tag + '-' + stage + '.json'));
        if (j) last = j;
    }
    const models = {};
    for (const [id, u] of Object.entries((last && last.modelUsage) || {})) models[id] = Number(u && u.costUSD) || 0;
    return { usd: (last && Number(last.total_cost_usd)) || 0, models };
}

function wallSeconds(evid, tag) {
    let s = 0;
    for (const stage of ORDER) {
        let t;
        try {
            t = fs.readFileSync(path.join(evid, tag + '-' + stage + '.wall'), 'utf8').trim().split(/\s+/).map(Number);
        } catch (e) {
            continue;
        }
        if (t.length === 2 && t.every(Number.isFinite)) s += t[1] - t[0];
    }
    return s;
}

// The controller sends the plan and design brains on `model: opus` in both arms
// (lib/stages.js), so only the other stages' brains are judged: at least one on
// the arm's model, none on the other model or on none named.
function validRun(arm, brainModels) {
    const other = arm === 'opus' ? 'sonnet' : 'opus';
    return (brainModels[arm] || 0) >= 1 && !brainModels[other] && !brainModels.unknown;
}

function tallyRun(evid, rawRun, tag) {
    const arm = /-(opus|sonnet)$/.exec(tag)[1];
    let names = [];
    try { names = fs.readdirSync(rawRun); } catch (e) { /* an empty run */ }
    const session = names.find((n) => n.endsWith('.jsonl'));
    const entries = session ? lines(path.join(rawRun, session)) : [];
    const uses = toolUses(entries);
    const stageOfAgent = stagesByAgent(entries);
    const bash = uses.filter((u) => u.name === 'Bash').map((u) => String((u.input && u.input.command) || ''));
    const agents = { brain: 0, reviewer: 0, fixer: 0, implementer: 0, other: 0 };
    const brainModels = {};
    const judged = {};
    let gateCheckRefusals = 0;
    let handoffWithoutGate = 0;
    const subagents = session ? filesUnder(path.join(rawRun, session.slice(0, -'.jsonl'.length), 'subagents'), /^agent-.+\.jsonl$/) : [];
    for (const file of subagents) {
        const meta = readJson(file.replace(/\.jsonl$/, '.meta.json')) || {};
        const type = String(meta.agentType || '').replace(/^fankeel:/, '').replace(/-(high|xhigh)$/, '');
        const role = /^fankeel-(brain|reviewer|fixer|implementer)$/.exec(type);
        agents[role ? role[1] : 'other'] += 1;
        if (role && role[1] === 'brain') {
            const word = (MODEL_WORD.exec(String(meta.description || '')) || [null, 'unknown'])[1].toLowerCase();
            brainModels[word] = (brainModels[word] || 0) + 1;
            const stage = stageOfAgent.get(path.basename(file).replace(/^agent-/, '').replace(/\.jsonl$/, ''));
            if (stage !== 'plan' && stage !== 'design') judged[word] = (judged[word] || 0) + 1;
        }
        for (const t of resultTexts(lines(file))) {
            if (t.includes('gate-check.js: invalid at')) gateCheckRefusals += 1;
            if (t.includes('no readable `json gate` block')) handoffWithoutGate += 1;
        }
    }
    const toBuild = bash.filter((c) => /task\.js\s+stage\s+build\b/.test(c)).length;
    return Object.assign({
        tag,
        arm,
        valid: validRun(arm, judged) && fs.existsSync(path.join(evid, tag + '-verify.json')),
        brainModels,
    }, spend(evid, tag), {
        wallSeconds: wallSeconds(evid, tag),
        controller: {
            brainDispatches: uses.filter((u) => u.name === 'Agent' && /fankeel-brain/.test(String((u.input && u.input.subagent_type) || ''))).length,
            sendMessages: uses.filter((u) => u.name === 'SendMessage').length,
            commitRuns: bash.filter((c) => /scripts\/commit\.js/.test(c)).length,
            backToBuild: Math.max(0, toBuild - 1),
        },
        agents,
        gateCheckRefusals,
        handoffWithoutGate,
        relays: filesUnder(path.join(rawRun, 'build'), /^relay-.+\.md$/).length,
    });
}

function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

function main(argv) {
    const [evid, raw] = argv;
    if (!evid || !raw) return { text: 'usage: node tally.js <evidence dir> <raw dir>', code: 2 };
    let tags;
    try {
        tags = fs.readdirSync(raw).filter((n) => /^r\d+-(opus|sonnet)$/.test(n)).sort();
    } catch (e) {
        return { text: 'no raw dir at ' + raw, code: 1 };
    }
    const runs = tags.map((tag) => tallyRun(evid, path.join(raw, tag), tag));
    const arms = {};
    for (const arm of ['opus', 'sonnet']) {
        const ok = runs.filter((r) => r.arm === arm && r.valid);
        arms[arm] = {
            runs: runs.filter((r) => r.arm === arm).length,
            valid: ok.length,
            medianUsd: median(ok.map((r) => r.usd)),
            medianWallSeconds: median(ok.map((r) => r.wallSeconds)),
            medianBrainDispatches: median(ok.map((r) => r.controller.brainDispatches)),
            medianSendMessages: median(ok.map((r) => r.controller.sendMessages)),
            fixers: ok.reduce((n, r) => n + r.agents.fixer, 0),
            backToBuild: ok.reduce((n, r) => n + r.controller.backToBuild, 0),
            gateCheckRefusals: ok.reduce((n, r) => n + r.gateCheckRefusals, 0),
            relays: ok.reduce((n, r) => n + r.relays, 0),
        };
    }
    return { text: JSON.stringify({ runs, arms }, null, 2), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    (code ? process.stderr : process.stdout).write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { tallyRun, main };
