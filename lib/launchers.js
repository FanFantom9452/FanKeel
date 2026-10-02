'use strict';

// The station launchers every registry gets under `.fankeel/`: double-click
// `station.bat` on Windows, run `station.sh` elsewhere. Each holds this plugin
// install's absolute path, so they are per machine — `registry.ensureLayout`
// lists them in `.fankeel/.gitignore` — and each is rewritten only when the
// bytes it should hold differ from what is there, which is how a plugin upgrade
// that moves the install reaches them on the next hook. Starting a second
// station is not this file's concern: `serve --detach` probes `serve.json`
// first and only opens the browser on a station that answers
// (scripts/station.js, the `args.detach` branch).
//
// No require of `./registry.js`: registry requires this file, and `.fankeel/`
// is spelled out below rather than taken from `stateDir` to keep it that way.
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.join(__dirname, '..');
const NAMES = ['station.bat', 'station.sh'];

function contents(pluginRoot) {
    const script = path.join(pluginRoot, 'scripts', 'station.js');
    const slashed = script.split(path.sep).join('/');
    return {
        'station.bat': '@node "' + script + '" serve --detach --open --root "%~dp0.." %*\r\n',
        'station.sh': '#!/bin/sh\nexec node "' + slashed + '" serve --detach --open --root "$(dirname "$0")/.." "$@"\n',
    };
}

function write(projectRoot, pluginRoot) {
    const dir = path.join(projectRoot, '.fankeel');
    fs.mkdirSync(dir, { recursive: true });
    const want = contents(pluginRoot || PLUGIN);
    const written = [];
    const failed = [];
    for (const name of NAMES) {
        // One try per file: a failure on one launcher does not stop the other.
        try {
            const file = path.join(dir, name);
            let have = null;
            try {
                have = fs.readFileSync(file, 'utf8');
            } catch (e) { /* not written yet, or not a file: write it below */ }
            if (have === want[name]) continue;
            fs.writeFileSync(file, want[name]);
            if (name.endsWith('.sh')) fs.chmodSync(file, 0o755);
            written.push(name);
        } catch (e) {
            failed.push(new Error(name + ': ' + e.message));
        }
    }
    // Thrown only after every file was tried; the first failure names its file.
    if (failed.length) throw failed[0];
    return written;
}

module.exports = { NAMES, PLUGIN, write };
