#!/usr/bin/env node
'use strict';
// What fankeel leaves outside every project, taken away before the plugin is.
//
//   node scripts/uninstall.js [--dry-run]
//
// Deletes, under <configDir> (CLAUDE_CONFIG_DIR, or ~/.claude):
//   fankeel/index.html and fankeel/station/ — the page lib/station.js write()
//     puts there, its copied assets, its data and detail scripts, the detail
//     cache under station/cache;
//   fankeel/serve.json, fankeel/roots.json, fankeel/remote.json — the running
//     station's record, the remembered registries, the paired phones;
//   fankeel/compact-window.declined and fankeel/notify-failed.log;
//   modes/<session>/fankeel — the badge word lib/badge.js writes.
// Keeps, and says so: fankeel/profile.json, the machine profile — answers the
// user wrote — and every remembered project's .fankeel/, which belongs to the
// project (README.md, under 移除). A JSON file here that does not parse is not
// this script's to judge, and is left as it is. A station still answering for
// the pid in serve.json is stopped first: it would write serve.json again.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgsOrExit } = require('../lib/cli.js');
const live = require('../lib/live.js');
const profile = require('../lib/profile.js');

// Under <configDir>/fankeel/: what fankeel writes and nothing else reads.
const GENERATED = ['index.html', 'station', 'serve.json', 'roots.json', 'remote.json', 'compact-window.declined', 'notify-failed.log'];

function readJson(file) {
    try {
        return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (e) {
        return { ok: false, value: null };
    }
}

// What a run would do, without doing it.
function plan(configDir) {
    const own = path.join(configDir, 'fankeel');
    const remove = [];
    const keep = [];
    for (const name of GENERATED) {
        const p = path.join(own, name);
        if (!fs.existsSync(p)) continue;
        if (name.endsWith('.json') && !readJson(p).ok) keep.push({ path: p, why: 'does not parse as JSON, left as it is' });
        else remove.push(p);
    }
    const machine = profile.machineFile(configDir);
    if (machine && fs.existsSync(machine)) keep.push({ path: machine, why: 'machine profile' });
    const roots = readJson(path.join(own, 'roots.json')).value;
    for (const [root, seen] of Object.entries(roots && typeof roots === 'object' ? roots : {})) {
        if (typeof seen !== 'string' || !Number.isFinite(Date.parse(seen))) continue;
        const reg = path.join(root, '.fankeel');
        if (fs.existsSync(reg)) keep.push({ path: reg, why: 'project registry' });
    }
    let modes = [];
    try {
        modes = fs.readdirSync(path.join(configDir, 'modes'), { withFileTypes: true });
    } catch (e) {
        modes = [];
    }
    for (const d of modes) {
        if (!d.isDirectory()) continue;
        const badge = path.join(configDir, 'modes', d.name, 'fankeel');
        try {
            if (fs.statSync(badge).isFile()) remove.push(badge);
        } catch (e) { /* no badge in this one */ }
    }
    return { remove, keep };
}

// serve.json's record, when its pid is running and answers /station/health as itself.
async function runningStation(configDir) {
    const rec = readJson(path.join(configDir, 'fankeel', 'serve.json')).value;
    if (!rec || typeof rec.url !== 'string' || !live.running(rec.pid)) return null;
    try {
        const res = await fetch(rec.url + 'station/health', { signal: AbortSignal.timeout(1000) });
        const body = await res.json();
        return body && body.pid === rec.pid ? rec : null;
    } catch (e) {
        return null;
    }
}

async function run(configDir, opts) {
    const o = opts || {};
    const lines = ['fankeel uninstall — ' + configDir + (o.dryRun ? ' (dry run: nothing is deleted)' : '')];
    const station = await runningStation(configDir);
    if (station) {
        if (!o.dryRun) {
            try { process.kill(station.pid); } catch (e) { /* already gone */ }
        }
        lines.push((o.dryRun ? 'would stop ' : 'stopped  ') + 'the station, pid ' + station.pid + ' at ' + station.url);
        if (station.remote && station.remote.url) lines.push('         its tailnet proxy may stay on: tailscale serve --https=443 --set-path=/ off');
    }
    const { remove, keep } = plan(configDir);
    for (const p of remove) {
        if (!o.dryRun) fs.rmSync(p, { recursive: true, force: true });
        lines.push((o.dryRun ? 'would delete ' : 'deleted  ') + p);
    }
    for (const k of keep) lines.push('kept     ' + k.path + '  (' + k.why + ')');
    if (!o.dryRun) {
        try { fs.rmdirSync(path.join(configDir, 'fankeel')); } catch (e) { /* not empty, or not there */ }
    }
    lines.push('then: claude plugin uninstall fankeel@fankeel');
    return lines.join('\n') + '\n';
}

async function main(argv) {
    const { values } = parseArgsOrExit('uninstall', argv, { 'dry-run': { type: 'boolean' } });
    process.stdout.write(await run(live.liveConfigDir(), { dryRun: Boolean(values['dry-run']) }));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { plan, run };
