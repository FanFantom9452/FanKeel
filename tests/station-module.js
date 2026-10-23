'use strict';
// The station page as it runs: every script assets/station/index.html loads,
// in its order (tests/station-src.js), then any other module a test names
// (gate-frame.js), in one vm context, each file with its own `module` object so a
// module's exports do not replace station.js's. And `stringsLeft`, the check
// tests/station-i18n.test.js gives station.js, applied to a module and its own
// English table: each CJK literal is the Chinese of a loc() call, each key
// has English with no CJK, and every English entry is used.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const prices = require('../lib/prices.js');
const { NAMES } = require('./station-src.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const read = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');

function page(names, station, extra) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: Object.assign({ generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: prices.verified, prices: prices.perMillion,
            serve: false, projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] }, station) };
    const box = vm.createContext(Object.assign({ window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } }, extra));
    const M = {};
    for (const name of [...NAMES, ...(names || []).filter((n) => !NAMES.includes(n))]) {
        box.module = { exports: {} };
        vm.runInContext(read(name), box, { filename: name });
        M[name] = box.module.exports;
    }
    return { V: M['station.js'], M, win, doc };
}

function stringsLeft(name, EN) {
    const bad = [];
    const used = new Set();
    read(name).split('\n').forEach((text, i) => {
        if (/^\s*\/\//.test(text)) return;
        const keyed = /\bloc\('([a-z]+\.[A-Za-z0-9]+)', '((?:[^'\\\n]|\\.)*)'/g;
        let m;
        while ((m = keyed.exec(text))) {
            used.add(m[1]);
            if (!Object.prototype.hasOwnProperty.call(EN, m[1])) bad.push((i + 1) + ' ' + m[1] + ' has no English');
        }
        const lit = /'(?:[^'\\\n]|\\.)*'/g;
        while ((m = lit.exec(text))) {
            if (!CJK.test(m[0])) continue;
            if (/\bloc\('[a-z]+\.[A-Za-z0-9]+',\s*$/.test(text.slice(0, m.index))) continue;
            bad.push((i + 1) + ' literal ' + m[0]);
        }
    });
    for (const [k, v] of Object.entries(EN)) {
        if (!used.has(k)) bad.push(k + ' is used nowhere');
        if (CJK.test(v)) bad.push(k + ' is not English');
    }
    return bad;
}

module.exports = { page, stringsLeft };
