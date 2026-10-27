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
const { liveConfigDir } = require('../lib/live.js');
const profile = require('../lib/profile.js');
const registry = require('../lib/registry.js');
const sensitive = require('../lib/sensitive.js');
const { readServeRecord, probe } = require('../lib/serve.js');
const git = require('../lib/weekly-git.js');
const store = require('../lib/weekly-store.js');
const { collect, defaultRange } = require('../lib/weekly-collect.js');
const { render, guard, archiveOf } = require('../lib/weekly-render.js');

const USAGE = 'usage: weekly.js scan [--since YYYY-MM-DD --until YYYY-MM-DD] [--roots dir1,dir2]\n'
    + '       weekly.js collect --repos dir1,dir2 [--since A --until B] --out data.json\n'
    + '       weekly.js render --events events.json --data data.json [--out weekly.html]';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ASSETS = path.join(__dirname, '..', 'assets');

// Every flag weekly.js takes, each with a value. Written as a STRING_FLAGS
// object because that is the shape lib/skills.js acceptedFlags reads, so
// scripts/skills-check.js can hold the skill's commands to this table.
const STRING_FLAGS = { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD', roots: 'dirs', repos: 'dirs', out: 'file', events: 'file', data: 'file' };

function flags(args) {
    const o = {};
    for (let i = 0; i < args.length; i++) {
        const k = args[i];
        if (!k.startsWith('--')) return { error: 'unexpected argument: ' + k };
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
        const repos = git.scanRepos(roots.value)
            .map((p) => ({ path: p, name: path.basename(p), commits: git.countCommits(p, r.since, r.until) }))
            .filter((x) => x.commits > 0);
        log(JSON.stringify({ since: r.since, until: r.until, repos }, null, 1));
        return 0;
    }

    if (verb === 'collect') {
        if (!f.repos || !f.out) return usage('collect needs --repos and --out');
        const r = range(f, configDir);
        if (r.error) return usage(r.error);
        const repos = f.repos.split(',').map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(cwd, p));
        const missing = repos.find((p) => !fs.existsSync(path.join(p, '.git')));
        if (missing) return usage('not a git repository: ' + missing);
        const data = collect({ repos, since: r.since, until: r.until, configDir });
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
        for (const r of data.repos) for (const w of sensitive.readList(r.path).words) if (!words.includes(w)) words.push(w);
        const hits = guard(events, words);
        if (hits.length) {
            for (const h of hits) err(h.where + ': ' + h.word);
            err('render refused: ' + hits.length + ' word(s) a report for outside readers must not carry; nothing written');
            return 1;
        }
        const generated = today();
        const html = await render(data, events, {
            stationCss: fs.readFileSync(path.join(ASSETS, 'station', 'station.css'), 'utf8'),
            reportCss: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.css'), 'utf8'),
            generated,
        });
        if (f.out) {
            const out = path.resolve(cwd, f.out);
            writeOut(out, html);
            log('wrote: ' + out);
        }
        const saved = store.save(configDir, data.until, { json: archiveOf(data, events, generated), html });
        log('wrote: ' + saved.html);
        const rec = readServeRecord(configDir);
        const alive = rec ? await probe(rec, 500) : false;
        log('open: ' + (alive ? rec.url + 'station/weekly/' + data.until + '.html' : saved.html));
        return 0;
    }

    return usage(verb ? 'unknown verb: ' + verb : '');
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e && e.stack || e); process.exitCode = 2; });
}

module.exports = { main };
