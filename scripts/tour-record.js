#!/usr/bin/env node
'use strict';
// scripts/tour-record.js: the one tour timeline (the promo, `stages`) to an
// MP4, frame by frame.
//
//   node scripts/tour-record.js stages [--out f.mp4]
//
// Opens assets/station/tour.html?record#<name>@0 in the Chromium-family
// browser scripts/render.js finds, headless, with a DevTools port, and drives
// it over Node's global WebSocket: for every frame, `tour.seek(n)` (record mode
// draws ten averaged sub-frames), then Page.captureScreenshot, and the PNG goes
// down a pipe to `ffmpeg -f image2pipe`. ffmpeg comes from FANKEEL_FFMPEG or
// PATH; ffprobe from beside it. After writing, the MP4's frames are counted
// and the run exits 1 unless the count is `tour.length(name)`. No dependency.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { parseArgsOrExit } = require('../lib/cli.js');
const { findBrowser } = require('./render.js');

const NAMES = ['stages'];
const SIZE = { width: 1280, height: 720 };
const PAGE = path.join(__dirname, '..', 'assets', 'station', 'tour.html');

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('tour-record', argv, { out: { type: 'string' } });
    const name = positionals[0];
    if (positionals.length !== 1 || !NAMES.includes(name)) {
        process.stderr.write('usage: tour-record.js <' + NAMES.join('|') + '> [--out f.mp4]\n');
        process.exit(2);
    }
    return { name, out: path.resolve(values.out || path.join('.fankeel', 'build', 'tour', name + '.mp4')) };
}

// FANKEEL_FFMPEG when set (and then only it), else the first PATH entry that
// holds one; null when neither does.
function ffmpegPath(env) {
    const e = env || process.env;
    if (e.FANKEEL_FFMPEG) return fs.existsSync(e.FANKEEL_FFMPEG) ? e.FANKEEL_FFMPEG : null;
    const exe = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg'];
    for (const dir of String(e.PATH || e.Path || '').split(path.delimiter).filter(Boolean)) {
        for (const n of exe) {
            const p = path.join(dir, n);
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

function ffprobeOf(ffmpeg) {
    return path.join(path.dirname(ffmpeg), path.basename(ffmpeg).replace(/^ffmpeg/i, 'ffprobe'));
}

function ffmpegArgs(out) {
    return ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '60', out];
}

// "DevTools listening on ws://127.0.0.1:<port>/devtools/browser/<id>"
function devtoolsPort(stderr) {
    const m = /DevTools listening on ws:\/\/[^:\s]+:(\d+)\//.exec(String(stderr));
    return m ? Number(m[1]) : null;
}

function countFrames(ffprobe, file) {
    const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
        '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    const n = Number(String(r.stdout).trim());
    return Number.isInteger(n) ? n : null;
}

function launch(browser, url, profileDir) {
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
        '--remote-debugging-port=0', '--user-data-dir=' + profileDir, '--force-device-scale-factor=1',
        '--window-size=' + SIZE.width + ',' + SIZE.height, url], { stdio: ['ignore', 'ignore', 'pipe'] });
    return new Promise((resolve, reject) => {
        let err = '';
        const timer = setTimeout(() => reject(new Error('tour-record: the browser never printed its DevTools port')), 30000);
        child.stderr.on('data', (d) => {
            if (err.length < 65536) err += d;
            const port = devtoolsPort(err);
            if (port) { clearTimeout(timer); resolve({ child, port }); }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error('tour-record: the browser exited (' + code + ') before DevTools opened: ' + err.slice(0, 300)));
        });
    });
}

function cdp(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const wait = new Map();
        let id = 0;
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            const w = msg.id && wait.get(msg.id);
            if (!w) return;
            wait.delete(msg.id);
            if (msg.error) w.reject(new Error('tour-record: ' + msg.error.message));
            else w.resolve(msg.result);
        };
        ws.onerror = () => reject(new Error('tour-record: the DevTools socket failed: ' + url));
        ws.onopen = () => resolve({
            send(method, params) {
                return new Promise((res, rej) => {
                    id += 1;
                    wait.set(id, { resolve: res, reject: rej });
                    ws.send(JSON.stringify({ id, method, params: params || {} }));
                });
            },
            close() { ws.close(); },
        });
    });
}

async function record(args, ffmpeg, browser) {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-tour-'));
    const url = pathToFileURL(PAGE).href + '?record#' + args.name + '@0';
    const { child, port } = await launch(browser, url, profileDir);
    try {
        const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
        const page = list.find((t) => t.type === 'page');
        if (!page) throw new Error('tour-record: no page target on port ' + port);
        const c = await cdp(page.webSocketDebuggerUrl);
        await c.send('Emulation.setDeviceMetricsOverride', { width: SIZE.width, height: SIZE.height, deviceScaleFactor: 1, mobile: false });
        const evaluate = async (expression) => {
            const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (r.exceptionDetails) throw new Error('tour-record: the page threw: ' + r.exceptionDetails.text);
            return r.result.value;
        };
        let ready = false;
        for (let i = 0; i < 300 && !ready; i++) {
            ready = await evaluate('!!(window.tour && window.tour.ready)');
            if (!ready) await new Promise((r) => setTimeout(r, 100));
        }
        if (!ready) throw new Error('tour-record: the page never set tour.ready');
        const total = await evaluate('tour.length(' + JSON.stringify(args.name) + ')');
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        const ff = spawn(ffmpeg, ffmpegArgs(args.out), { stdio: ['pipe', 'ignore', 'inherit'] });
        const done = new Promise((res) => ff.on('exit', (code) => res(code)));
        for (let f = 0; f < total; f++) {
            await evaluate('tour.seek(' + f + '); new Promise(function (r) { requestAnimationFrame(function () { r(true); }); })');
            const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: SIZE.width, height: SIZE.height, scale: 1 } });
            if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
            if (f % 600 === 0) process.stderr.write('tour-record: ' + args.name + ' frame ' + f + ' / ' + total + '\n');
        }
        ff.stdin.end();
        const code = await done;
        c.close();
        if (code !== 0) throw new Error('tour-record: ffmpeg exited ' + code);
        return total;
    } finally {
        child.kill();
        try {
            fs.rmSync(profileDir, { recursive: true, force: true });
        } catch (e) {
            // The browser may still hold it; `npm run clean` gets it later.
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const ffmpeg = ffmpegPath(process.env);
    if (!ffmpeg) {
        process.stderr.write('tour-record: ffmpeg not found — put it on PATH or set FANKEEL_FFMPEG to its full path\n');
        process.exit(2);
    }
    const browser = findBrowser();
    if (!browser) {
        process.stderr.write('tour-record: no Chromium-family browser found (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)\n');
        process.exit(2);
    }
    const total = await record(args, ffmpeg, browser);
    const got = countFrames(ffprobeOf(ffmpeg), args.out);
    process.stdout.write(args.out + '\n' + 'frames ' + got + ' / ' + total + '\n');
    if (got !== total) process.exit(1);
}

if (require.main === module) {
    main().catch((e) => {
        process.stderr.write(String((e && e.message) || e) + '\n');
        process.exit(1);
    });
}
module.exports = { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, devtoolsPort, countFrames };
