#!/usr/bin/env node
'use strict';
// scripts/render.js: a screenshot and the DOM after JS ran, from whatever
// Chromium-family browser this machine already has. Zero dependencies, like
// everywhere else in this repository — package.json has no "dependencies".
//
//   node scripts/render.js <url-or-file> [--out <dir>] [--size 1600,1000]
//
// Two files land in `--out` (default `.fankeel/build/render/`): `render.png`,
// a `--headless=new` screenshot at `--size`, and `render.html`, the DOM
// `--dump-dom` prints after the page's own script has run — the second is
// what a reviewer's `render` lens reads to prove a figure came from a
// script rather than being typed into the markup by hand. Both paths print
// on stdout, one per line, nothing else.
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
const { pathToFileURL } = require('node:url');

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

function parseArgs(argv) {
    const out = { out: null, size: '1600,1000', target: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out') { out.out = argv[++i]; continue; }
        if (a === '--size') { out.size = argv[++i]; continue; }
        if (out.target === null) out.target = a;
    }
    return out;
}

function toUrl(target) {
    if (/^https?:\/\//.test(target)) return target;
    return pathToFileURL(path.resolve(target)).href;
}

// Runs `browser` headless with `extraArgs` appended after the two flags
// every call shares, and exits the process the same way on failure: a
// `render: <label> failed: ...` line on stderr, the browser's own exit
// status (or 1 if it has none). The screenshot and dump-dom calls in
// main() differ only in their label, their extra flags and what the
// caller does with a successful result.
function runHeadless(browser, label, extraArgs) {
    const result = spawnSync(browser, ['--headless=new', '--disable-gpu', ...extraArgs], { encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write('render: ' + label + ' failed: ' + (result.stderr || result.status) + '\n');
        process.exit(result.status || 1);
    }
    return result;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.target) {
        process.stderr.write('render: give a URL or a file path\n');
        process.exit(2);
    }
    const browser = findBrowser();
    if (!browser) {
        process.stderr.write('render: no Chromium-family browser found (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)\n');
        process.exit(2);
    }
    // Resolved to absolute before it ever reaches the browser: a relative
    // `--out` handed straight to the browser's own `--screenshot=` flag can
    // be resolved against the browser's working directory rather than this
    // process's, so the PNG lands somewhere other than the path this tool
    // prints — or nowhere at all.
    const outDir = path.resolve(args.out || path.join(process.cwd(), '.fankeel', 'build', 'render'));
    fs.mkdirSync(outDir, { recursive: true });
    const png = path.join(outDir, 'render.png');
    const html = path.join(outDir, 'render.html');
    const url = toUrl(args.target);

    runHeadless(browser, 'screenshot', ['--screenshot=' + png, '--window-size=' + args.size, url]);
    if (!fs.existsSync(png)) {
        process.stderr.write('render: screenshot exited 0 but did not write ' + png + '\n');
        process.exit(1);
    }

    const dump = runHeadless(browser, 'dump-dom', ['--dump-dom', url]);
    fs.writeFileSync(html, dump.stdout);

    process.stdout.write(png + '\n');
    process.stdout.write(html + '\n');
}

if (require.main === module) main();
module.exports = { findBrowser };
