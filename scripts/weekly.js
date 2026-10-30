#!/usr/bin/env node
'use strict';
// The weekly report's command line (skills/fankeel-weekly/SKILL.md;
// docs/90-agent/plans/2026-10-27-weekly-skill-design.md): `scan` lists the
// repositories with commits in a range, `collect` writes the data.json the
// model reads, `render` guards the model's events.json and writes the page.
// Thin over lib/weekly-*.js. Writes only <configDir>/fankeel/weekly/ and the
// --out paths it is given — never into a repository.
const fs = require('node:fs');
const path = require('node:path');
const { liveConfigDir, envSession } = require('../lib/live.js');
const profile = require('../lib/profile.js');
const registry = require('../lib/registry.js');
const sensitive = require('../lib/sensitive.js');
const { readServeRecord, probe } = require('../lib/serve.js');
const git = require('../lib/weekly-git.js');
const store = require('../lib/weekly-store.js');
const { collect, defaultRange } = require('../lib/weekly-collect.js');
const { render, guard, guardData, shapeHits, archiveOf, DEFAULT_FACETS } = require('../lib/weekly-render.js');
const { sessionCost } = require('../lib/session-cost.js');

const USAGE = 'usage: weekly.js scan [--since YYYY-MM-DD --until YYYY-MM-DD] [--roots dir1,dir2]\n'
    + '       weekly.js collect --repos dir1,dir2 [--since A --until B] --out data.json\n'
    + '       weekly.js render --events events.json --data data.json [--out weekly.html] [--session <id>]\n'
    + '       weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ASSETS = path.join(__dirname, '..', 'assets');

// Every flag weekly.js takes, each with a value. Written as a STRING_FLAGS
// object because that is the shape lib/skills.js acceptedFlags reads, so
// scripts/skills-check.js can hold the skill's commands to this table.
const STRING_FLAGS = { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD', roots: 'dirs', repos: 'dirs', out: 'file', events: 'file', data: 'file', session: 'id', repo: 'name', near: 'YYYY-MM-DD', grep: 'word' };
// The one flag that takes no value.
const BOOL_FLAGS = new Set(['--answered']);

function flags(args) {
    const o = {};
    for (let i = 0; i < args.length; i++) {
        const k = args[i];
        if (!k.startsWith('--')) return { error: 'unexpected argument: ' + k };
        if (BOOL_FLAGS.has(k)) {
            o[k.slice(2)] = true;
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(STRING_FLAGS, k.slice(2))) return { unknown: k };
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) return { error: k + ' needs a value' };
        o[k.slice(2)] = v;
        i++;
    }
    return o;
}

function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function range(f, configDir) {
    const last = store.latest(configDir);
    const def = defaultRange(today(), last && last.until);
    const since = f.since || def.since;
    const until = f.until || def.until;
    if (!DAY.test(since) || !DAY.test(until) || since > until) return { error: '--since and --until are YYYY-MM-DD, since not after until' };
    return { since, until };
}

function rootsOf(f, cwd, configDir) {
    if (f.roots) return profile.parseValue('weekly.roots', f.roots);
    const home = registry.findStateRoot(cwd) || cwd;
    const set = profile.read(home, configDir).values['weekly.roots'];
    if (Array.isArray(set) && set.length) return { value: set };
    return { value: [path.dirname(home)] };
}

// The facet vocabulary: the profile's weekly.facets (`名稱:受眾` strings,
// lib/profile.js parseFacets), else lib/weekly-render.js DEFAULT_FACETS.
function facetsFor(cwd, configDir) {
    const home = registry.findStateRoot(cwd) || cwd;
    const set = profile.read(home, configDir).values['weekly.facets'];
    if (!Array.isArray(set) || !set.length) return DEFAULT_FACETS;
    return set.map((s) => {
        const i = String(s).lastIndexOf(':');
        return { name: String(s).slice(0, i), audience: String(s).slice(i + 1) };
    });
}

// A report rendered again for the same end date keeps the replies the
// station already saved into its archive (lib/weekly-reply.js), by question id.
function keepReplies(events, prior) {
    const old = prior && Array.isArray(prior.questions) ? prior.questions : [];
    if (!events || !Array.isArray(events.questions) || !old.length) return events;
    const byId = new Map(old.filter((q) => q && q.reply).map((q) => [q.id, q]));
    const questions = events.questions.map((q) => (q && !q.reply && byId.has(q.id)
        ? Object.assign({}, q, { reply: byId.get(q.id).reply, repliedAt: byId.get(q.id).repliedAt })
        : q));
    return Object.assign({}, events, { questions });
}

// Every archived question that passes the filters, newest report first
// (design §3): `--near D` keeps a report whose range, widened a week each
// way, holds D. A report archived before questions existed has none.
const NEAR_MS = 7 * 86400e3;
const dayMs = (d) => Date.parse(d + 'T00:00:00Z');
const oneLine = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
function questionsOf(configDir, f) {
    const want = f.grep ? f.grep.toLowerCase() : null;
    const out = [];
    for (const r of store.list(configDir)) {
        if (f.near) {
            const t = dayMs(f.near);
            if (t < dayMs(r.since || r.until) - NEAR_MS || t > dayMs(r.until) + NEAR_MS) continue;
        }
        const a = store.readArchive(configDir, r.until);
        for (const q of (a && Array.isArray(a.questions) ? a.questions : [])) {
            if (!q || typeof q.text !== 'string') continue;
            if (f.repo && String(q.repo).toLowerCase() !== f.repo.toLowerCase()) continue;
            if (f.answered && !q.reply) continue;
            if (want && !(q.text + '\n' + (q.reply || '')).toLowerCase().includes(want)) continue;
            out.push([r.until, oneLine(q.repo), oneLine(q.text), q.reply ? oneLine(q.reply) : '尚未回覆'].join('\t'));
        }
    }
    return out;
}

function writeOut(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}

async function main(argv, opts) {
    const o = opts || {};
    const log = o.log || ((s) => console.log(s));
    const err = o.err || ((s) => console.error(s));
    const configDir = o.configDir || liveConfigDir();
    const cwd = o.cwd || process.cwd();
    const [verb, ...rest] = argv || [];
    const f = flags(rest);
    const usage = (msg) => { if (msg) err(msg); err(USAGE); return 2; };
    if (f.unknown) { err('unknown flag: ' + f.unknown); err(USAGE); return 1; }
    if (f.error) return usage(f.error);

    if (verb === 'scan') {
        const r = range(f, configDir);
        if (r.error) return usage(r.error);
        const roots = rootsOf(f, cwd, configDir);
        if (roots.error) return usage(roots.error);
        const repos = [];
        const failed = [];
        for (const p of git.scanRepos(roots.value)) {
            try {
                const commits = git.countCommits(p, r.since, r.until);
                if (commits > 0) repos.push({ path: p, name: path.basename(p), commits });
            } catch (e) {
                if (!e.gitFailed) throw e;
                err(e.message);
                failed.push({ path: p, name: path.basename(p), error: e.message });
            }
        }
        log(JSON.stringify({ since: r.since, until: r.until, repos, failed }, null, 1));
        return 0;
    }

    if (verb === 'collect') {
        if (!f.repos || !f.out) return usage('collect needs --repos and --out');
        const r = range(f, configDir);
        if (r.error) return usage(r.error);
        const repos = f.repos.split(',').map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(cwd, p));
        const missing = repos.find((p) => !fs.existsSync(path.join(p, '.git')));
        if (missing) return usage('not a git repository: ' + missing);
        let data;
        try {
            data = collect({ repos, since: r.since, until: r.until, configDir });
        } catch (e) {
            if (!e.gitFailed) throw e;
            err(e.message);
            return 1;
        }
        data.facets = facetsFor(cwd, configDir);
        const out = path.resolve(cwd, f.out);
        writeOut(out, JSON.stringify(data, null, 1) + '\n');
        log('wrote: ' + out);
        return 0;
    }

    if (verb === 'render') {
        if (!f.events || !f.data) return usage('render needs --events and --data');
        let data;
        let events;
        try {
            data = JSON.parse(fs.readFileSync(path.resolve(cwd, f.data), 'utf8'));
            events = JSON.parse(fs.readFileSync(path.resolve(cwd, f.events), 'utf8'));
        } catch (e) {
            return usage('cannot read --data or --events: ' + e.message);
        }
        if (!data || !DAY.test(String(data.until)) || !Array.isArray(data.repos)) return usage('--data is not a data.json weekly.js collect wrote');
        const words = [];
        for (const r of data.repos) {
            const list = sensitive.readList(r.path);
            if (list.error) {
                err('cannot read ' + path.join(r.path, '.fankeel', 'sensitive.txt') + ': ' + list.error);
                return 2;
            }
            for (const w of list.words) if (!words.includes(w)) words.push(w);
        }
        const facets = facetsFor(cwd, configDir);
        const hits = guard(events, words).concat(guardData(data, events, words), shapeHits(events, facets));
        if (hits.length) {
            for (const h of hits) err(h.where + ': ' + h.word);
            err('render refused: ' + hits.length + ' word(s) a report for outside readers must not carry; nothing written');
            return 1;
        }
        // 製作成本 (design §4): the session that ran this, which is the one
        // this shell names unless --session says otherwise. /fankeel-weekly's
        // prompt injects no id, so the shell's own is the default.
        let cost = null;
        if (events && events.show && events.show.cost === true) {
            const id = f.session || envSession(configDir, o.env || process.env);
            if (!id) return usage('show.cost is on and this shell names no session: pass --session <id>');
            cost = sessionCost(configDir, id);
            if (!cost) {
                err('no transcript for session ' + id + ' under ' + configDir + '; nothing written');
                return 2;
            }
        }
        const generated = today();
        const full = keepReplies(events, store.readArchive(configDir, data.until));
        const html = await render(data, full, {
            stationCss: fs.readFileSync(path.join(ASSETS, 'station', 'station.css'), 'utf8'),
            reportCss: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.css'), 'utf8'),
            reportJs: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.js'), 'utf8'),
            generated,
            facets,
            cost,
        });
        if (f.out) {
            const out = path.resolve(cwd, f.out);
            writeOut(out, html);
            log('wrote: ' + out);
        }
        const saved = store.save(configDir, data.until, { json: archiveOf(data, full, generated), html });
        log('wrote: ' + saved.html);
        const rec = readServeRecord(configDir);
        const alive = rec ? await probe(rec, 500) : false;
        log('open: ' + (alive ? rec.url + 'station/weekly/' + data.until + '.html' : saved.html));
        return 0;
    }

    if (verb === 'questions') {
        if (f.near && !DAY.test(f.near)) return usage('--near is YYYY-MM-DD');
        const rows = questionsOf(configDir, f);
        if (!rows.length) log('沒有符合的問題');
        for (const row of rows) log(row);
        return 0;
    }

    return usage(verb ? 'unknown verb: ' + verb : '');
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e && e.stack || e); process.exitCode = 2; });
}

module.exports = { main };
