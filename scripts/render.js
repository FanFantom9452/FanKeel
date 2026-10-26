#!/usr/bin/env node
'use strict';
// scripts/render.js: a screenshot and the DOM after JS ran, from whatever
// Chromium-family browser this machine already has. Zero dependencies, like
// everywhere else in this repository — package.json has no "dependencies".
//
//   node scripts/render.js <url-or-file> [--out <dir>] [--size 1600,1000]
//   node scripts/render.js --config [<render.json>] [--out <dir>] [--size W,H]
//   node scripts/render.js login <role> <url-or-file> [--out <dir>]
//   node scripts/render.js <url-or-file> --act <steps.json> [--out <dir>] [--size W,H]
//
// `--config` shoots every role × page `.fankeel/render.json` declares
// (`lib/shots.js` reads it) into `<out>/<role>/<page>.png|.html`, each role
// with its own browser profile at `<out>/profiles/<role>`, and writes
// `<out>/index.json` listing every cell with `ok` and, when it failed, `error`.
// It prints the index path, and exits 1 when any cell failed. `login` opens
// that role's profile in a window for a person to sign in once; the cookies
// stay in the profile, under `.fankeel/build/`, which git ignores.
//
// Two files land in `--out` (default `.fankeel/build/render/`): `render.png`,
// a `--headless=new` screenshot at `--size`, and `render.html`, the DOM
// `--dump-dom` prints after the page's own script has run — the second is
// what `fankeel-render-reviewer` reads for what the page's own script
// wrote. Both paths print on stdout, one per line, nothing else.
//
// `FANKEEL_BROWSER` names a browser directly and is tried first, ahead of
// every other lookup. `FANKEEL_NO_FALLBACK=1` turns off every lookup but
// that one, so a test can prove "no browser found" deterministically on a
// machine that may have a real one installed — without it, an invalid
// `FANKEEL_BROWSER` would simply fall through to Edge, Chrome or the
// ms-playwright cache, and the test's outcome would depend on what else
// happens to be on the machine running it.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { parseArgsOrExit } = require('../lib/cli.js');
const { parseSteps } = require('../lib/act.js');
const { parseTargets, cells, NAME } = require('../lib/shots.js');

// `ms-playwright` names each install `chromium-<build number>`; the highest
// number is the newest download, not necessarily the one `readdirSync`
// happens to list first.
function newestPlaywrightChromium() {
    const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    let entries;
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch (e) {
        return null;
    }
    const builds = entries
        .filter((d) => d.isDirectory() && /^chromium-\d+$/.test(d.name))
        .map((d) => ({ name: d.name, n: Number(d.name.split('-')[1]) }))
        .sort((a, b) => b.n - a.n);
    for (const b of builds) {
        const exe = path.join(base, b.name, 'chrome-win', 'chrome.exe');
        if (fs.existsSync(exe)) return exe;
    }
    return null;
}

// The first existing path among: `FANKEEL_BROWSER` (tried even when
// fallback is off), then — unless `FANKEEL_NO_FALLBACK=1` — Edge, Chrome
// and the newest `ms-playwright` cache on Windows, or `chromium`/
// `google-chrome` on `PATH` elsewhere. `null` when none of them exist.
function findBrowser() {
    const candidates = [];
    if (process.env.FANKEEL_BROWSER) candidates.push(process.env.FANKEEL_BROWSER);
    if (process.env.FANKEEL_NO_FALLBACK !== '1') {
        if (process.platform === 'win32') {
            candidates.push(
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            );
            const pw = newestPlaywrightChromium();
            if (pw) candidates.push(pw);
        } else {
            for (const name of ['chromium', 'google-chrome']) {
                const found = spawnSync('which', [name], { encoding: 'utf8' });
                if (found.status === 0 && found.stdout.trim()) candidates.push(found.stdout.trim());
            }
        }
    }
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return null;
}

// `--out` and `--size` are the only flags; the target is the one positional
// argv carries. `lib/cli.js`'s `parseArgsOrExit` is the parser and the
// refusal, shared with `scripts/station.js`: an unrecognised flag becomes a
// `render: unknown argument <flag>` message and exit 2.
const OPTIONS = {
    out: { type: 'string' },
    size: { type: 'string' },
    config: { type: 'boolean' },
    act: { type: 'string' },
};

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('render', argv, OPTIONS);
    return {
        out: values.out !== undefined ? values.out : null,
        size: values.size !== undefined ? values.size : '1600,1000',
        config: values.config === true,
        act: values.act !== undefined ? values.act : null,
        positionals,
    };
}

// A `#`/`?` suffix on a non-http(s) target is a URL fragment or query, not
// part of the filesystem path — `path.resolve` does not know that and folds
// it into the literal path it resolves, so `tour.html#quickstart@330` used
// to become a file that does not exist. Split the suffix off before
// resolving, then re-append it to the resulting file:// URL untouched. A
// target with neither character behaves exactly as before.
function toUrl(target) {
    if (/^https?:\/\//.test(target)) return target;
    const cut = target.search(/[#?]/);
    const filePart = cut === -1 ? target : target.slice(0, cut);
    const suffix = cut === -1 ? '' : target.slice(cut);
    return pathToFileURL(path.resolve(filePart)).href + suffix;
}

function needBrowser() {
    const browser = findBrowser();
    if (!browser) {
        process.stderr.write('render: no Chromium-family browser found (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)\n');
        process.exit(2);
    }
    return browser;
}

// Resolved to absolute before it ever reaches the browser: a relative
// `--out` handed straight to the browser's own `--screenshot=` flag can be
// resolved against the browser's working directory rather than this
// process's, so the PNG lands somewhere other than the path this tool
// prints — or nowhere at all.
function outDirOf(args) {
    return path.resolve(args.out || path.join(process.cwd(), '.fankeel', 'build', 'render'));
}

// One screenshot and one DOM dump of `url`. `extra` goes in front of both
// calls — `--user-data-dir=` for a role. A PNG left from an earlier run is
// removed first, so "exited 0 but wrote nothing" cannot pass on a stale file.
// Returns null, or `{ label, status, message }` for the first call that
// failed: --config records it and goes on to the next cell, the one-page
// mode exits on it.
function shoot(browser, url, png, html, size, extra) {
    fs.rmSync(png, { force: true });
    const base = ['--headless=new', '--disable-gpu', ...extra];
    const shot = spawnSync(browser, [...base, '--screenshot=' + png, '--window-size=' + size, url], { encoding: 'utf8', windowsHide: true });
    if (shot.status !== 0) return { label: 'screenshot', status: shot.status || 1, message: shot.stderr || String(shot.status) };
    if (!fs.existsSync(png)) return { label: 'screenshot', status: 1, message: 'exited 0 but did not write ' + png };
    const dump = spawnSync(browser, [...base, '--dump-dom', url], { encoding: 'utf8', windowsHide: true });
    if (dump.status !== 0) return { label: 'dump-dom', status: dump.status || 1, message: dump.stderr || String(dump.status) };
    fs.writeFileSync(html, dump.stdout);
    return null;
}

// Width and height out of a PNG's IHDR chunk (bytes 16-23, big-endian), so
// index.json can say what size each shot actually came out at — the render
// reviewer holds that against `size` rather than trusting the flag was obeyed.
function pngSize(file) {
    const head = Buffer.alloc(24);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, head, 0, 24, 0);
    } finally {
        fs.closeSync(fd);
    }
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// The config is read before a browser is looked for, so a bad render.json
// fails the same way on a machine with no browser at all.
function runConfig(args) {
    const file = path.resolve(args.positionals[0] || path.join('.fankeel', 'render.json'));
    let targets;
    try {
        targets = parseTargets(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        process.stderr.write('render: ' + (e.code === 'ENOENT' ? 'no ' + file : e.message) + '\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const outDir = outDirOf(args);
    const rows = [];
    for (const c of cells(targets, path.dirname(file))) {
        const dir = path.join(outDir, c.role);
        fs.mkdirSync(dir, { recursive: true });
        const png = path.join(dir, c.page + '.png');
        const html = path.join(dir, c.page + '.html');
        const err = shoot(browser, toUrl(c.url), png, html, args.size, ['--user-data-dir=' + path.join(outDir, 'profiles', c.role)]);
        const row = { role: c.role, page: c.page, url: c.url, png, html, ok: !err };
        if (err) row.error = err.label + ': ' + String(err.message).trim();
        else Object.assign(row, pngSize(png));
        rows.push(row);
    }
    const index = path.join(outDir, 'index.json');
    fs.writeFileSync(index, JSON.stringify({ config: file, size: args.size, cells: rows }, null, 2) + '\n');
    process.stdout.write(index + '\n');
    if (rows.some((r) => !r.ok)) process.exit(1);
}

// A window, not headless: a person signs in, then closes it. The browser
// runs in the foreground with this role's own profile directory, so it is a
// separate instance from any browser already open, and this call returns
// when that window closes.
function runLogin(args) {
    const role = args.positionals[1];
    const target = args.positionals[2];
    if (!role || !NAME.test(role) || role === 'profiles' || !target) {
        process.stderr.write('render: login needs <role> <url-or-file>\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const dir = path.join(outDirOf(args), 'profiles', role);
    fs.mkdirSync(dir, { recursive: true });
    process.stdout.write('render: sign in as ' + role + ' in the window that opened, then close it — the profile is ' + dir + '\n');
    const r = spawnSync(browser, ['--user-data-dir=' + dir, '--no-first-run', '--new-window', toUrl(target)], { stdio: 'inherit' });
    process.exit(r.status || 0);
}

// `--act <file>` (entry-4): the page driven before it is shot. The browser
// is started with `--remote-debugging-port=0` on a profile of its own and
// writes the port it picked to DevToolsActivePort in that profile; Node's own
// WebSocket (22.4 and later, so on the 22.5 floor) carries the DevTools
// Protocol to the page. No dependency, like everything else here.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtoolsPort(profileDir, ms) {
    const file = path.join(profileDir, 'DevToolsActivePort');
    const until = Date.now() + ms;
    for (;;) {
        try {
            const port = Number(fs.readFileSync(file, 'utf8').split('\n')[0]);
            if (port) return port;
        } catch (e) { /* not written yet */ }
        if (Date.now() > until) throw new Error('the browser opened no DevTools port within ' + ms / 1000 + ' s');
        await sleep(100);
    }
}

// One DevTools session over `ws`: `send` resolves with a command's result or
// rejects with its error; `once` resolves on the next event of that method,
// or rejects after `ms`.
function connect(ws) {
    let id = 0;
    const waiting = new Map();
    const listeners = [];
    ws.addEventListener('message', (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id !== undefined && waiting.has(msg.id)) {
            const w = waiting.get(msg.id);
            waiting.delete(msg.id);
            if (msg.error) w.reject(new Error(msg.error.message));
            else w.resolve(msg.result);
            return;
        }
        for (const l of listeners.slice()) if (l.method === msg.method) l.fire();
    });
    const send = (method, params) => new Promise((resolve, reject) => {
        id += 1;
        waiting.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    const once = (method, ms) => new Promise((resolve, reject) => {
        const l = { method, fire: () => { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(); } };
        const t = setTimeout(() => { listeners.splice(listeners.indexOf(l), 1); reject(new Error(method + ' did not come within ' + ms / 1000 + ' s')); }, ms);
        listeners.push(l);
    });
    return new Promise((resolve, reject) => {
        ws.addEventListener('open', () => resolve({ send, once }));
        ws.addEventListener('error', () => reject(new Error('cannot reach the page over DevTools')));
    });
}

// The centre of the first element `sel` matches, scrolled into view, or null.
async function centre(cdp, sel) {
    const r = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: '(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null;'
            + ' e.scrollIntoView({ block: "center", inline: "center" }); const b = e.getBoundingClientRect();'
            + ' return [b.left + b.width / 2, b.top + b.height / 2]; })()',
    });
    return r.result.value;
}

const mouse = (cdp, type, x, y, buttons) => cdp.send('Input.dispatchMouseEvent', {
    type, x, y, buttons, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1,
});

async function shotTo(cdp, file) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
}

// Every file it wrote, in order: each `shot`, then render.png and render.html.
// A step whose selector matches nothing throws, naming the step.
async function runAct(browser, url, steps, outDir, size) {
    const [w, h] = size.split(',').map(Number);
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-render-'));
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0',
        '--user-data-dir=' + profileDir, '--window-size=' + size, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    let ws = null;
    const wrote = [];
    try {
        const port = await devtoolsPort(profileDir, 15000);
        const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
        const target = targets.find((t) => t.type === 'page');
        if (!target) throw new Error('the browser opened no page');
        ws = new WebSocket(target.webSocketDebuggerUrl);
        const cdp = await connect(ws);
        await cdp.send('Page.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        const loaded = cdp.once('Page.loadEventFired', 30000);
        await cdp.send('Page.navigate', { url });
        await loaded;
        for (const [n, step] of steps.entries()) {
            const label = 'step ' + (n + 1) + ' (' + step.kind + (step.sel ? ' ' + step.sel : '') + ')';
            if (step.kind === 'wait') { await sleep(step.ms); continue; }
            if (step.kind === 'shot') { wrote.push(await shotTo(cdp, path.join(outDir, step.name + '.png'))); continue; }
            const at = await centre(cdp, step.sel);
            if (!at) throw new Error(label + ': no element matches');
            const [x, y] = at;
            await mouse(cdp, 'mouseMoved', x, y, 0);
            await mouse(cdp, 'mousePressed', x, y, 1);
            if (step.kind === 'drag') {
                for (let k = 1; k <= 10; k++) await mouse(cdp, 'mouseMoved', x + (step.dx * k) / 10, y + (step.dy * k) / 10, 1);
                await mouse(cdp, 'mouseReleased', x + step.dx, y + step.dy, 0);
            } else {
                await mouse(cdp, 'mouseReleased', x, y, 0);
                if (step.kind === 'type') await cdp.send('Input.insertText', { text: step.text });
            }
            await sleep(150);
        }
        wrote.push(await shotTo(cdp, path.join(outDir, 'render.png')));
        const dom = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        const html = path.join(outDir, 'render.html');
        fs.writeFileSync(html, '<!doctype html>\n' + dom.result.value);
        wrote.push(html);
    } finally {
        if (ws) { try { ws.close(); } catch (e) { /* closing anyway */ } }
        child.kill();
        // The browser holds its profile's files until it has exited.
        await new Promise((r) => {
            if (child.exitCode !== null) return r();
            child.once('exit', r);
            setTimeout(r, 5000).unref();
        });
        fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    return wrote;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.positionals[0] === 'login') return runLogin(args);
    let steps = null;
    if (args.act !== null) {
        if (args.config) {
            process.stderr.write('render: --act takes one page, not --config\n');
            process.exit(2);
        }
        try {
            steps = parseSteps(fs.readFileSync(path.resolve(args.act), 'utf8'));
        } catch (e) {
            process.stderr.write('render: --act ' + (e.code === 'ENOENT' ? 'names no file: ' + args.act : e.message) + '\n');
            process.exit(2);
        }
    }
    if (args.config) return runConfig(args);
    const target = args.positionals[0];
    if (!target) {
        process.stderr.write('render: give a URL or a file path\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const outDir = outDirOf(args);
    fs.mkdirSync(outDir, { recursive: true });
    if (steps) {
        runAct(browser, toUrl(target), steps, outDir, args.size).then((files) => {
            for (const f of files) process.stdout.write(f + '\n');
        }, (e) => {
            process.stderr.write('render: ' + e.message + '\n');
            process.exit(1);
        });
        return;
    }
    const png = path.join(outDir, 'render.png');
    const html = path.join(outDir, 'render.html');
    // A profile of its own for this run, removed after: two renders at once on
    // the default profile hand one URL to the other browser, and the second
    // exits having written nothing.
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-render-'));
    let err;
    try {
        err = shoot(browser, toUrl(target), png, html, args.size, ['--user-data-dir=' + profileDir]);
    } finally {
        fs.rmSync(profileDir, { recursive: true, force: true });
    }
    if (err) {
        process.stderr.write('render: ' + err.label + ' failed: ' + err.message + '\n');
        process.exit(err.status);
    }
    process.stdout.write(png + '\n');
    process.stdout.write(html + '\n');
}

if (require.main === module) main();
module.exports = { findBrowser, toUrl };
