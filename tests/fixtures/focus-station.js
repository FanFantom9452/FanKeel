#!/usr/bin/env node
'use strict';
// A real station (scripts/station.js serve) holding one real registry on fake sessions, for shooting
// the pages tests/fixtures/mobile-station.js has no session for:
//
//   node tests/fixtures/focus-station.js [--port 28890]    then  node scripts/render.js --config
//
// Three sessions in one scratch project, each a real registry entry with real files:
//   GATE  survey stage, a gate held (survey-pending.json), survey.md with a mermaid flowchart,
//         a claimed plan; no background shell.         /f/<id>/gate, /f/<id>/plan, /m#/s/<id>
//   SHELL the same, plus a transcript that launched a background shell still running.
//   PHOTO a phone-attached session whose chat has a phone message with two "[圖片] <path>" lines
//         naming real PNGs under its phone uploads/ directory.                  /m#/s/<id>
// The ids are fixed, so .fankeel/render.json can name the pages. Prints the three ids, then the /m url.
// The phone gate screen's diagram needs a wait before it draws, which render.json pages cannot declare, so it
// is shot by hand, and so is the photo chat (a --config shot of a /m page that waits on fetch came out blank): the
// marked node, then a shot after the click; then the photos:
//   node scripts/render.js "http://127.0.0.1:28890/m#/s/<GATE id>" --viewport 412,900 --act tests/fixtures/focus-station-mark.act.json --out .fankeel/build/render-act
//   node scripts/render.js "http://127.0.0.1:28890/m#/s/<PHOTO id>" --viewport 412,900 --act tests/fixtures/focus-station-photos.act.json --out .fankeel/build/render-act
// Ctrl+C stops it and removes the scratch dir.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const registry = require('../../lib/registry.js');
const profile = require('../../lib/profile.js');
const phone = require('../../lib/phone.js');
const { serve } = require('../../scripts/station.js');

const argPort = process.argv.indexOf('--port');
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : 28890;
const IDS = {
    gate: 'f0c05000-0000-4000-8000-000000000001',
    shell: 'f0c05000-0000-4000-8000-000000000002',
    photo: 'f0c05000-0000-4000-8000-000000000003',
};
const SLUG = 'fankeel-focus-fixture';
const PLAN = path.join(__dirname, '..', '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');

const REPORT = [
    '# SURVEY 報告', '',
    '結論先說：路線分兩段，先查再改，改完驗證。圖在下面，點方塊可以標記。', '',
    '```mermaid', 'flowchart TD', '  A["讀地圖"] --> B{"已有現成的？"}', '  B -- 是 --> C["沿用"]', '  B -- 否 --> D["新寫一個"]', '  C --> E["驗證"]', '  D --> E', '```', '',
    '| 項目 | 結果 |', '| --- | --- |', '| 現成的 | 有兩個可沿用 |', '',
].join('\n');
const QUESTIONS = [{
    header: 'Survey', multiSelect: false,
    question: 'Survey -> Design | fixture : 照圖走，下一步要進哪一站？',
    options: [{ label: 'Go to Design (Recommended)', description: '沿用現成的，進設計' }, { label: 'Stay in Survey', description: '再查一輪' }, { label: '先停下來', description: '這輪到此為止' }],
}];

// A small real PNG: a w x h gradient, so a thumbnail has something to show.
function png(w, h, rgb) {
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => {
        const t = Buffer.concat([Buffer.from(type), data]);
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(t));
        return Buffer.concat([len, t, sum]);
    };
    const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 3 + 1)] = 0;
        for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.round(rgb[c] * (0.6 + 0.4 * ((x / w + y / h) / 2)));
    }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function seed(base) {
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(PLAN, path.join(root, 'docs', 'plans', 'x.md'));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(root)]: new Date().toISOString() }) + '\n');
    if (!profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok) throw new Error('station.remote not written');
    const handoff = require('../../lib/handoff.js');
    const until = Date.now() + 24 * 3600e3;
    const mk = (id, task, extra) => {
        const data = Object.assign({ active: true, task, stage: 'survey', route: ['survey', 'design', 'plan', 'build', 'verify', 'land'], claims: ['docs/plans/x.md'],
            started: '2026-10-30T09:00:00.000Z', updated: new Date().toISOString(), moves: [['survey', 1]], configDir: cfg }, extra);
        registry.writeSession(root, id, data);
        return data;
    };
    const held = (id, data) => {
        const dir = handoff.dirFor(root, data);
        fs.mkdirSync(dir, { recursive: true });
        // The gate page draws its pick buttons from the report's own `json gate` fence (lib/handoff.js readGate).
        fs.writeFileSync(path.join(dir, 'survey.md'), REPORT + '\n```json gate\n' + JSON.stringify({ questions: QUESTIONS, next: 'Design' }) + '\n```\n');
        fs.writeFileSync(handoff.pendingPath(root, data, 'survey'), JSON.stringify({ questions: QUESTIONS, until, at: Date.now() - 60e3 }) + '\n');
    };
    held(IDS.gate, mk(IDS.gate, '畫面驗證用：沒有背景指令的關卡'));
    held(IDS.shell, mk(IDS.shell, '畫面驗證用：有背景指令的關卡'));
    mk(IDS.photo, '畫面驗證用：手機傳來的照片', { stage: 'build', moves: [['build', 1]], route: ['survey', 'build', 'verify'] });

    // SHELL: a transcript that launched `node scripts/suite.js` in the background; its output file has no exit line, so it is running.
    const tdir = path.join(cfg, 'projects', SLUG);
    fs.mkdirSync(tdir, { recursive: true });
    const ts = new Date(Date.now() - 4 * 60e3).toISOString();
    const lines = [
        { type: 'assistant', timestamp: ts, message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'node scripts/suite.js', run_in_background: true } }] } },
        { type: 'user', timestamp: ts, toolUseResult: { backgroundTaskId: 'bsh1' }, message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'started' }] } },
    ];
    fs.writeFileSync(path.join(tdir, IDS.shell + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const tasks = path.join(os.tmpdir(), 'claude', SLUG, IDS.shell, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    fs.writeFileSync(path.join(tasks, 'bsh1.output'), 'running 120 tests\n');

    // PHOTO: attached, a phone message carrying two real photos.
    const up = path.join(phone.dirOf(root, IDS.photo), 'uploads');
    fs.mkdirSync(up, { recursive: true });
    const a = path.join(up, Date.now() + '-a1b2c3.png');
    const b = path.join(up, (Date.now() + 1) + '-d4e5f6.png');
    fs.writeFileSync(a, png(240, 160, [60, 150, 230]));
    fs.writeFileSync(b, png(120, 200, [230, 120, 60]));
    phone.attach(root, IDS.photo, 'fixture phone', Date.now());
    phone.append(root, IDS.photo, { role: 'desktop', text: '這輪先把登入頁修好', at: Date.now() - 5 * 60e3 });
    phone.append(root, IDS.photo, { role: 'assistant', text: '好，改好了，你看一下現在的樣子。', at: Date.now() - 4 * 60e3 });
    phone.append(root, IDS.photo, { role: 'phone', text: '按鈕還是歪的，看這兩張\n[圖片] ' + a + '\n[圖片] ' + b, at: Date.now() - 2 * 60e3 });
    // lib/live.js keeps a sessions/<pid>.json whose pid runs: this process.
    [IDS.gate, IDS.shell, IDS.photo].forEach((id, i) => {
        fs.writeFileSync(path.join(cfg, 'sessions', (process.pid + i) + '.json'), JSON.stringify({ pid: process.pid, sessionId: id, cwd: root, entrypoint: 'cli', status: 'busy', startedAt: Date.now() - 10 * 60e3 }));
    });
    return { cfg, tasksRoot: path.join(os.tmpdir(), 'claude', SLUG) };
}

// tailscale CLI faked as in tests/fixtures/mobile-station.js: this machine alone, nothing leaves it.
function tailscaleRun() {
    const status = { BackendState: 'Running', Self: { DNSName: 'office.fake.ts.net.' }, Peer: {} };
    return (args) => (args.join(' ') === 'status --json' ? { status: 0, stdout: JSON.stringify(status), stderr: '' } : { status: 0, stdout: '{}', stderr: '' });
}

async function main() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-focus-fixture-'));
    const { cfg, tasksRoot } = seed(base);
    process.chdir(base);
    const s = await serve({ configDir: cfg, roots: [path.join(base, 'ws')], port: PORT, portWasExplicit: true, idleMs: 0, open: false, tailscaleRun: tailscaleRun(), probeGet: async () => ({ status: 401 }) });
    const stop = () => { s.close(); for (const d of [base, tasksRoot]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* tmp-clean gets it */ } } process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const port = Number(new URL(s.url).port);
    process.stdout.write(JSON.stringify(IDS) + '\nhttp://127.0.0.1:' + port + '/m\n');
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
