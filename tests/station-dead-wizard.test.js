'use strict';
// station-52: the old 文件 card and the seven-step wizard are gone from
// assets/station/station.js, with their strings from i18n.js; the section
// marker tests/station-i18n.test.js keys the `wiz` prefix by stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const JS = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const I18N = fs.readFileSync(path.join(ASSETS, 'i18n.js'), 'utf8');

test('no docs-card or wizard function or table is declared in station.js', () => {
    for (const n of ['docSplitHtml', 'docPathList', 'docFilingHtml', 'docProjectHtml', 'docsCardHtml', 'dsxCount', 'dsxResultsHtml', 'docsSearchHtml',
        'wizLoad', 'wizApply', 'wizChanges', 'wizHtml', 'wizCards', 'wizScopes', 'wizStepHtml', 'wizSummaryHtml', 'wizFrontHtml', 'wizSkillHtml']) {
        assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
    }
    for (const v of ['DOC_STATUS_COLOUR', 'DOC_HATCH', 'WIZ_STEPS', 'WIZ_SCENES', 'WIZ_CARD_TEXT', 'WIZ_FE_MODELS', 'WIZ_STAGES']) {
        assert.doesNotMatch(JS, new RegExp('var ' + v + '\\b'), v);
    }
    assert.match(JS, /^    \/\/ ---- 設定: the seven-step wizard/m);
    assert.match(JS, /^    \/\/ ---- tune: a block changed -/m);
});

test('station.js still loads under require and exports none of them', () => {
    global.window = { STATION: {} };
    const V = require('../assets/station/station.js');
    for (const n of ['docsCardHtml', 'docsSearchHtml', 'WIZ_STEPS', 'wizLoad', 'wizApply', 'wizChanges', 'wizHtml']) assert.equal(n in V, false, n);
    assert.equal(typeof V.tourPage, 'function');
    assert.equal(typeof V.parseHash, 'function');
});

test('i18n.js holds no wizard key and none of the docs card keys', () => {
    assert.doesNotMatch(I18N, /'wiz\./);
    for (const k of ['shared.docsHeading', 'shared.fullTextSearch', 'shared.noHitsFor', 'shared.notBuiltYet', 'shared.filingLocation', 'dash.docs', 'dash.noProjectDocsYet']) {
        assert.equal(I18N.includes("'" + k + "'"), false, k);
    }
});
