#!/usr/bin/env node
'use strict';
// scripts/render.js: a screenshot and the DOM after JS ran, from whatever
// Chromium-family browser this machine already has. Zero dependencies, like
// everywhere else in this repository — package.json has no "dependencies".
//
//   node scripts/render.js <url-or-file> [--out <dir>] [--size 1600,1000]
//   node scripts/render.js --config [<render.json>] [--out <dir>] [--size W,H]
//   node scripts/render.js login <role> <url-or-file> [--out <dir>]
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
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { parseArgsOrExit } = require('../lib/cli.js');
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
};

function parseArgs(argv) {
    const { values, positionals } = parseArgsOrExit('render', argv, OPTIONS);
    return {
        out: values.out !== undefined ? values.out : null,
        size: values.size !== undefined ? values.size : '1600,1000',
        config: values.config === true,
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
    const shot = spawnSync(browser, [...base, '--screenshot=' + png, '--window-size=' + size, url], { encoding: 'utf8' });
    if (shot.status !== 0) return { label: 'screenshot', status: shot.status || 1, message: shot.stderr || String(shot.status) };
    if (!fs.existsSync(png)) return { label: 'screenshot', status: 1, message: 'exited 0 but did not write ' + png };
    const dump = spawnSync(browser, [...base, '--dump-dom', url], { encoding: 'utf8' });
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

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.positionals[0] === 'login') return runLogin(args);
    if (args.config) return runConfig(args);
    const target = args.positionals[0];
    if (!target) {
        process.stderr.write('render: give a URL or a file path\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const outDir = outDirOf(args);
    fs.mkdirSync(outDir, { recursive: true });
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
