'use strict';
// tests/station-src.js — the station page's scripts as the browser runs them:
// every `<script src="station/…">` in assets/station/index.html, in that
// order, joined into one source for vm.runInNewContext (SRC), and their
// names (NAMES). A test that drew with station.js alone saw the OLD.*
// fallbacks; with every route on its module (station-52) it loads them all.
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const NAMES = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
const SRC = NAMES.map((n) => fs.readFileSync(path.join(ASSETS, n), 'utf8')).join('\n;\n');
module.exports = { SRC, NAMES };
