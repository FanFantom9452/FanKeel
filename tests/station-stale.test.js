'use strict';
// station-55: a station whose code or modules changed on disk after it
// started hands its port to a fresh process on the next page load, and that
// process serves what is on disk now. Run against a copy of the plugin, so
// the edits below never touch this checkout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const serve = require('../lib/serve.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const TAG = '<script src="station/station.js"></script>';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function copyPlugin() {
    const dir = tmp('fankeel-stale-plugin-');
    for (const name of ['lib', 'scripts', 'assets', 'hooks', 'skills', 'agents', '.claude-plugin']) {
        fs.cpSync(path.join(PLUGIN, name), path.join(dir, name), { recursive: true });
    }
    fs.copyFileSync(path.join(PLUGIN, 'package.json'), path.join(dir, 'package.json'));
    return dir;
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

// The first serve.json naming a pid other than `notPid`.
async function recordFrom(cfg, notPid, ms) {
    const until = Date.now() + ms;
    for (;;) {
        const rec = serve.readServeRecord(cfg);
        if (rec && typeof rec.url === 'string' && rec.pid !== notPid) return rec;
        if (Date.now() >= until) return null;
        await sleep(50);
    }
}

test('a page load after a module changed is answered by a fresh station on the same port', async () => {
    const plugin = copyPlugin();
    const cfg = tmp('fankeel-stale-cfg-');
    const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
    const first = spawn(process.execPath, [path.join(plugin, 'scripts', 'station.js'), 'serve', '--port', '0', '--idle', '2'],
        { cwd: cfg, env, stdio: 'ignore', windowsHide: true });
    const pids = [first.pid];
    const assets = path.join(plugin, 'assets', 'station');
    try {
        const one = await recordFrom(cfg, null, 10000);
        assert.ok(one, 'no serve.json ten seconds after serve started');
        pids.push(one.pid);
        const unchanged = await get(one.url);
        assert.equal(unchanged.status, 200);
        assert.doesNotMatch(unchanged.body, /data-fankeel-restart/, 'a station nobody changed restarted');

        // A module the shell already loads changes.
        fs.appendFileSync(path.join(assets, station.MODULES.find((n) => n.endsWith('.css'))), '\n/* station-55 */\n');
        const asked = await get(one.url);
        assert.equal(asked.status, 200);
        assert.match(asked.body, /data-fankeel-restart/, 'the old station served the page as if nothing had changed');
        const two = await recordFrom(cfg, one.pid, 15000);
        assert.ok(two, 'no fresh station took over');
        pids.push(two.pid);
        assert.equal(two.port, one.port, 'the fresh station is on another port');
        const health = JSON.parse((await get(two.url + 'station/health')).body);
        assert.equal(health.fingerprint, serve.diskFingerprint(plugin));
        assert.doesNotMatch((await get(two.url)).body, /data-fankeel-restart/);

        // A module added to the shell: the station that started before it would answer it 404.
        fs.writeFileSync(path.join(assets, 'zz-stale.js'), 'window.ZZ_STALE = 1;\n');
        const shell = path.join(assets, 'index.html');
        fs.writeFileSync(shell, fs.readFileSync(shell, 'utf8').replace(TAG, '<script src="station/zz-stale.js"></script>\n' + TAG));
        assert.match((await get(two.url)).body, /data-fankeel-restart/);
        const three = await recordFrom(cfg, two.pid, 15000);
        assert.ok(three, 'no fresh station after index.html changed');
        pids.push(three.pid);
        const added = await get(three.url + 'station/zz-stale.js');
        assert.equal(added.status, 200);
        assert.match(added.body, /ZZ_STALE/);
    } finally {
        for (const pid of pids) {
            try { process.kill(pid); } catch (e) { /* already gone */ }
        }
    }
});
