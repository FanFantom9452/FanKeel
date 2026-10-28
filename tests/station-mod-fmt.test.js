'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('fmt.js holds the shared formatters station.js used to write out', () => {
    moved('fmt.js', ['localDay', 'lastDays', 'parseHash', 'projectHash', 'knownPkey', 'sessionHash', 'family',
        'modelKey', 'modelLabel', 'tokenSum', 'dimKey', 'verCmp', 'orderKeys', 'colorOf', 'keyLabel', 'keyHint',
        'projectNames', 'niceTop', 'partEst', 'metricText', 'sessionTotals', 'windowTotals']);
});
