'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-page.css'), 'utf8');

// station-64: at 390 wide the settings page scrolled sideways on a real phone.
// The global/project switch is a flex item whose grid columns had an automatic
// minimum, so nothing let it shrink below its two labels.
test('the global/project switch can shrink below its labels', () => {
    const seg = css.slice(css.indexOf('.sq-seg{'), css.indexOf('}', css.indexOf('.sq-seg{')));
    assert.match(seg, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(seg, /min-width:0/);
    const narrow = css.slice(css.indexOf('@media (max-width:900px)'));
    assert.match(narrow, /\.sq-seg\{flex:1 1 100%;min-width:0\}/);
});
