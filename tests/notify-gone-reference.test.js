'use strict';
// notify-1 and station-chartroom-vendored-1: the station reference names
// neither the ntfy sender nor an external Chartroom install, and the 10-21
// decision says it was superseded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('reference/station.md has no notify sender and no station.chartroom', () => {
    const text = read('docs/90-agent/reference/station.md');
    assert.doesNotMatch(text, /lib\/notify\.js|scripts\/notify\.js|notify-failed\.log|notify\.topic|station\.chartroom/);
    assert.match(text, /boardPage/);
});

test('the 10-21 remote decision points at the 10-26 removal', () => {
    assert.match(read('docs/03-decisions/2026-10-21-station-remote.md'), /2026-10-26-remove-ntfy\.md/);
});
