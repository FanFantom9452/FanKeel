#!/usr/bin/env node
'use strict';
// scripts/tour-record.js: a tour timeline (`reel`, the kinetic promo, or
// `promo30`, the 30-second film, `promo30v3`, its honeycomb-ring cut, or `promo30v4`, that cut at one minute, or `promo30v5`, the 74-second tour) to an MP4 with its score, frame by frame, in
// one language.
//
//   node scripts/tour-record.js <reel|promo30|promo30v3|promo30v4|promo30v5> [--lang zh|en] [--out f.mp4]
//
// --lang is zh unless given, and the file is .fankeel/build/tour/
// <name>-<lang>.mp4 unless --out says; promo30v5 goes to
// F:/ymlab/fankeel-videos/v5/<name>-<lang>.mp4 (FANKEEL_VIDEOS_V5 overrides
// the directory) and its intermediate .wav is deleted, the MP4 alone kept. Opens
// assets/station/tour.html?record&lang=<lang>#<name>@0 in the Chromium-family
// browser scripts/render.js finds, headless, with a DevTools port, and drives
// it over Node's global WebSocket: for every frame, `tour.seek(n)` (record mode
// draws ten averaged sub-frames), then Page.captureScreenshot, and the PNG goes
// down a pipe to `ffmpeg -f image2pipe`. ffmpeg comes from FANKEEL_FFMPEG or
// PATH; ffprobe from beside it. The sound is assets/station/tour-music.js run
// here in Node over the timeline's own cues, written as a WAV beside the MP4
// and muxed in as AAC, the shorter of the two ending the file. After writing,
// the MP4's frames are counted and its audio streams read, and the run exits
// 1 unless the count is `tour.length(name)` and there is exactly one audio
// stream within 0.1 s of that many frames at 60 fps. No dependency.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { parseArgsOrExit } = require('../lib/cli.js');
const { findBrowser } = require('./render.js');

const NAMES = ['reel', 'promo30', 'promo30v3', 'promo30v4', 'promo30v5'];
// The four names the usage line has always listed; promo30v5 follows on its own line.
const OLD_NAMES = NAMES.slice(0, 4);
const V5_DIR = 'F:/ymlab/fankeel-videos/v5';
const LANGS = ['zh', 'en'];
const SIZE = { width: 1280, height: 720 };
const PAGE = path.join(__dirname, '..', 'assets', 'station', 'tour.html');

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('tour-record', argv, { out: { type: 'string' }, lang: { type: 'string' } });
    const name = positionals[0];
    const lang = values.lang === undefined ? 'zh' : values.lang;
    if (positionals.length !== 1 || !NAMES.includes(name) || !LANGS.includes(lang)) {
        process.stderr.write('usage: tour-record.js <' + OLD_NAMES.join('|') + '> [--lang ' + LANGS.join('|') + '] [--out f.mp4]\n'
            + '       tour-record.js promo30v5 [--lang ' + LANGS.join('|') + '] [--out f.mp4]  (MP4 in ' + V5_DIR + ')\n');
        process.exit(2);
    }
    const dir = name === 'promo30v5' ? (process.env.FANKEEL_VIDEOS_V5 || V5_DIR) : path.join('.fankeel', 'build', 'tour');
    return { name, lang, out: path.resolve(values.out || path.join(dir, name + '-' + lang + '.mp4')) };
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

// PNG frames from stdin, the score from `wav`; the shorter ends the MP4.
function ffmpegArgs(out, wav) {
    return ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
        '-i', wav, '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '60', '-c:a', 'aac', '-shortest', out];
}

// The score of timeline `name` as WAV bytes: tour-music.js over the cues the
// timeline registered — the same samples the page plays.
function scoreWav(name) {
    const E = require('../assets/station/tour.js');
    require('../assets/station/tour-reel.js');
    require('../assets/station/tour-keel.js');
    require('../assets/station/tour-ring.js');
    const M = require('../assets/station/tour-music.js');
    return Buffer.from(M.wav(M.render(E.get(name).cues, E.length(name))));
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

// Each audio stream's duration in seconds, in stream order; null when
// ffprobe cannot run or exits nonzero.
function audioStreams(ffprobe, file) {
    const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=duration',
        '-of', 'csv=p=0', file], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    return String(r.stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(Number);
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
    const url = pathToFileURL(PAGE).href + '?record&lang=' + args.lang + '#' + args.name + '@0';
    const { child, port } = await launch(browser, url, profileDir);
    let wav = null;
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
        const pageError = () => evaluate("(document.querySelector('canvas') || { dataset: {} }).dataset.error || ''");
        let ready = false;
        for (let i = 0; i < 300 && !ready; i++) {
            ready = await evaluate('!!(window.tour && window.tour.ready)');
            if (!ready) {
                const err = await pageError();
                if (err) throw new Error('tour-record: the page failed: ' + err);
                await new Promise((r) => setTimeout(r, 100));
            }
        }
        if (!ready) {
            const err = await pageError();
            throw new Error('tour-record: the page never set tour.ready' + (err ? ' (' + err + ')' : ''));
        }
        const total = await evaluate('tour.length(' + JSON.stringify(args.name) + ')');
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        wav = args.out.replace(/\.mp4$/i, '') + '.wav';
        fs.writeFileSync(wav, scoreWav(args.name));
        const ff = spawn(ffmpeg, ffmpegArgs(args.out, wav), { stdio: ['pipe', 'ignore', 'inherit'] });
        const done = new Promise((res) => ff.on('exit', (code) => res(code)));
        for (let f = 0; f < total; f++) {
            await evaluate('tour.seek(' + f + '); new Promise(function (r) { requestAnimationFrame(function () { r(true); }); })');
            const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: SIZE.width, height: SIZE.height, scale: 1 } });
            if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
            if (f % 600 === 0) process.stderr.write('tour-record: ' + args.name + '-' + args.lang + ' frame ' + f + ' / ' + total + '\n');
        }
        ff.stdin.end();
        const code = await done;
        c.close();
        if (code !== 0) throw new Error('tour-record: ffmpeg exited ' + code);
        return total;
    } finally {
        if (wav && args.name === 'promo30v5') fs.rmSync(wav, { force: true });
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
    const audio = audioStreams(ffprobeOf(ffmpeg), args.out);
    const seconds = total / 60;
    const heard = !!audio && audio.length === 1 && Math.abs(audio[0] - seconds) <= 0.1;
    process.stdout.write(args.out + '\n' + 'frames ' + got + ' / ' + total + '\n'
        + 'audio ' + (audio ? audio.map((d) => d.toFixed(2) + ' s').join(', ') || 'none' : 'unreadable') + ' / one stream of ' + seconds.toFixed(2) + ' s\n');
    if (got !== total || !heard) process.exit(1);
}

if (require.main === module) {
    main().catch((e) => {
        process.stderr.write(String((e && e.message) || e) + '\n');
        process.exit(1);
    });
}
module.exports = { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, scoreWav, devtoolsPort, countFrames, audioStreams };
