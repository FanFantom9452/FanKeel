'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
const rule = (sel) => {
    const at = css.indexOf(sel + '{');
    assert.ok(at >= 0, sel + ' has a rule');
    return css.slice(at, css.indexOf('}', at));
};

// station-65: the gate page's pick buttons drew a 30px inset-shadow chip while
// the station's own buttons (station.css .btn / .btn.go) draw a real border.
test('the gate pick button is bordered and 32px like the station button', () => {
    const pick = rule('.gq-pick');
    assert.match(pick, /min-height:32px/);
    assert.match(pick, /border:1px solid var\(--rule2\)/);
    assert.match(pick, /box-shadow:none/);
    assert.doesNotMatch(pick, /inset/);
    assert.match(rule('.gq-pick:hover'), /border-color:var\(--keel\)/);
    assert.match(rule('.gt-opts .is-rec .gq-pick,.gq-pick[aria-pressed="true"]'), /border-color:var\(--keel-deep\)/);
    assert.match(rule('.gt-send'), /border-color:var\(--keel-deep\)/);
});

test('the option number and the expander line up with the 32px button', () => {
    assert.match(rule('.gt-n'), /\/32px/);
    assert.match(rule('.gt-more'), /min-height:32px/);
});
