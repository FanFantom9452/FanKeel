#!/usr/bin/env node
'use strict';
// A real station (scripts/station.js serve) on fake data, for shooting the phone page /m:
//
//   node tests/fixtures/mobile-station.js [--port 28889]    then  node scripts/render.js --config
//
// Ctrl+C stops it and removes its scratch config dir. The default port is not 28888 so it never
// collides with the station already running on this machine. What /m draws, at the time of the
// request: this computer `office` (Desktop with RC, two CLI rows, one RC ended), `lab` paired
// and answering (a running task, a held gate for 等你, a CLI row, RC connected and ended), and
// `laptop` paired but offline, seen two hours ago (its rows as `was`, 最後看到). Tailscale and
// the other computers are fakes, as in tests/station-peers.test.js; nothing leaves the machine.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const profile = require('../../lib/profile.js');
const { serve } = require('../../scripts/station.js');

const argPort = process.argv.indexOf('--port');
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : 28889;
const SELF = 'office.fake.ts.net';
const LAB = 'lab.fake.ts.net';
const LAPTOP = 'laptop.fake.ts.net';
const min = (m) => Date.now() - m * 60e3;

const task = (id, o) => Object.assign({ id, root: 'D:\\lab\\proj', task: 'task ' + id, project: 'proj', stage: 'build', route: ['survey', 'build', 'verify'], gate: false, updated: min(3), state: 'running', attached: false, background: [], last: null, holdUntil: null }, o);
const unreg = (id, o) => Object.assign({ id, cwd: 'D:\\work\\' + id, entrypoint: 'cli', name: '', status: 'idle', bridge: false, started: min(40) }, o);

function labBody() {
    const gate = { id: 'lab-gate-1', root: 'D:\\lab\\Jussay-ASR', task: '仿 Breeze ASR 25 的 Whisper 繁中聽寫模型微調', project: 'Jussay-ASR', stage: 'design', route: ['survey', 'design', 'plan', 'build'] };
    return {
        host: 'lab', at: Date.now(), device: null, others: [],
        gates: [Object.assign({}, gate, { questions: [{ question: '評估集要用 Common Voice 19 的 zh-TW 還是自己錄的 200 句？', options: [{ label: 'Common Voice 19' }, { label: '自己錄的 200 句' }] }], since: min(4), until: Date.now() + 22 * 60e3 })],
        tasks: [
            task('lab-gate-1', Object.assign({}, gate, { gate: true, state: 'gate', updated: min(4) })),
            task('lab-run-1', { root: 'F:\\ymlab\\SBIR\\ProjectWorkspace', task: '期中報告的實驗數據表重跑', project: 'Trovara', updated: min(2) }),
        ],
        stopped: [], done: [],
        unregistered: [unreg('lab-cli-1', { cwd: 'D:\\lab\\notebooks', name: '整理 WER 圖表', status: 'busy', bridge: true, started: min(25) })],
        rc: {
            live: [{ id: 'lab-cli-1', kind: 'unreg', task: '', name: '整理 WER 圖表', cwd: 'D:\\lab\\notebooks', entrypoint: 'cli', status: 'busy', started: min(25) }],
            ended: [{ id: 'lab-rc-old', kind: 'unreg', task: '', name: '下載資料集', cwd: 'D:\\lab\\data', entrypoint: 'claude-desktop', at: min(300) }],
        },
    };
}

const LAPTOP_SEEN = min(120);
const laptopLast = {
    host: 'laptop', at: LAPTOP_SEEN, device: null, others: [], gates: [], stopped: [], done: [],
    tasks: [task('laptop-run-1', { root: 'C:\\Users\\me\\thesis', task: '論文第三章圖表改版', project: 'thesis', stage: 'verify', updated: LAPTOP_SEEN - 5 * 60e3 })],
    unregistered: [unreg('laptop-desk-1', { entrypoint: 'claude-desktop', cwd: 'C:\\Users\\me\\notes', name: '讀書會筆記', started: LAPTOP_SEEN - 30 * 60e3 })],
    rc: { live: [], ended: [] },
};

// tailscale CLI as tests/station-peers.test.js fakes it: this machine, lab and laptop on the tailnet.
function tailscaleRun() {
    let proxy = null;
    const status = { BackendState: 'Running', Self: { DNSName: SELF + '.' }, Peer: { a: { DNSName: LAB + '.', Online: true }, b: { DNSName: LAPTOP + '.', Online: false } } };
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify(status), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [SELF + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) { proxy = 'http://127.0.0.1:' + bg[1]; return { status: 0, stdout: '', stderr: '' }; }
        if (a === 'serve --https=443 off' || /^serve .*off$/.test(a)) { proxy = null; return { status: 0, stdout: '', stderr: '' }; }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}

async function peerSend(o) {
    if (o.url.startsWith('https://' + LAB + '/')) return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(labBody())) };
    throw new Error('connect ETIMEDOUT');
}

function seed(cfg) {
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    // An empty roots.json: no first-run drive scan, and no real registry on the page.
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), '{}\n');
    if (!profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok) throw new Error('station.remote not written');
    // lib/live.js reads Claude Code's sessions/<pid>.json and keeps only running pids: this one.
    // Each cwd is walked up for a registry (lib/station.js discover), so none sits on a real drive's tree.
    const live = [
        { sessionId: 'office-desk-1', cwd: 'Z:\\fake\\VoiceLedger', entrypoint: 'claude-desktop', name: '記帳語音輸入的錯字', status: 'busy', bridgeSessionId: 'bridge-1', startedAt: min(15) },
        { sessionId: 'office-cli-1', cwd: 'Z:\\fake\\scratch', entrypoint: 'cli', name: '', status: 'idle', startedAt: min(90) },
        { sessionId: 'office-cli-2', cwd: 'Z:\\fake\\site', entrypoint: 'cli', name: '部落格 RSS 修正', status: 'busy', startedAt: min(8) },
    ];
    live.forEach((s, i) => fs.writeFileSync(path.join(cfg, 'sessions', (process.pid + i) + '.json'), JSON.stringify(Object.assign({ pid: process.pid }, s))));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'rc-seen.json'), JSON.stringify({ sessions: [{ id: 'office-rc-old', kind: 'unreg', name: '整理照片', cwd: 'Z:\\fake\\photos', entrypoint: 'claude-desktop', task: '', last: min(180) }] }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'peers.json'), JSON.stringify({ peers: [
        { dnsName: LAB, name: 'lab', token: 'L'.repeat(43), paired: min(7 * 1440), seen: null, last: null },
        { dnsName: LAPTOP, name: 'laptop', token: 'P'.repeat(43), paired: min(7 * 1440), seen: LAPTOP_SEEN, last: laptopLast },
    ] }));
}

const getJson = (port, p) => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: p }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => { try { resolve(JSON.parse(t)); } catch (e) { reject(e); } });
    }).on('error', reject);
});

async function main() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-mobile-fixture-'));
    const cfg = path.join(base, 'cfg');
    seed(cfg);
    // gather() takes the cwd as a lead; the scratch dir has no registry in it.
    process.chdir(base);
    const s = await serve({ configDir: cfg, port: PORT, portWasExplicit: true, idleMs: 0, open: false, tailscaleRun: tailscaleRun(), probeGet: async () => ({ status: 401 }), peerSend });
    const stop = () => { s.close(); try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) { /* a held file; tmp-clean gets it */ } process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const port = Number(new URL(s.url).port);
    // lab's first read is in flight after the first request; wait for it so the first shot has it.
    for (let i = 0; i < 100; i++) {
        const j = await getJson(port, '/station/mobile.json');
        if (j.machines.some((x) => x.name === 'lab' && x.state === 'on')) break;
        await new Promise((r) => setTimeout(r, 100));
    }
    process.stdout.write('http://127.0.0.1:' + port + '/m\n');
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
