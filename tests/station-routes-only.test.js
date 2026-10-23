'use strict';
// station-52 (a): every route draws through its FK_* module — no OLD.*
// fallback — and every script index.html loads runs, in order, in one vm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC, NAMES } = require('./station-src.js');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('no view falls back to an OLD view, and the redesigned routes call their module', () => {
    assert.doesNotMatch(JS, /\bOLD\b/);
    for (const [v, g] of [['now', 'FK_LIVE'], ['live', 'FK_LIVE'], ['sessions', 'FK_SESSIONS'], ['cmp', 'FK_SESSIONS'], ['projects', 'FK_PROJECTS'], ['project', 'FK_PROJECT']]) {
        assert.match(JS, new RegExp('VIEWS\\.' + v + ' = function \\(r\\) \\{ return w\\.' + g + '\\.page\\('), v);
    }
    assert.match(JS, /\(VIEWS\[route\.view\] \|\| VIEWS\.now\)\(route\)/);
    for (const n of ['routeLedger', 'routeGroups', 'livePage', 'cmpPage', 'compareHtml']) assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
});

test('every script index.html loads runs in one vm, in order, and sets its global', () => {
    assert.equal(NAMES[0], 'i18n.js');
    assert.equal(NAMES[NAMES.length - 1], 'station.js');
    const win = {};
    // No `module` here, as in the browser: with one, i18n.js exports itself
    // to it instead of setting window.FK_I18N.
    vm.runInNewContext(SRC, { window: win, URLSearchParams });
    for (const g of ['FK_I18N', 'FK_TIP', 'FK_LIVE', 'FK_SESSIONS', 'FK_PROJECTS', 'FK_PROJECT', 'FK_SESSION', 'FK_KIT']) assert.equal(typeof win[g], 'object', g);
});
