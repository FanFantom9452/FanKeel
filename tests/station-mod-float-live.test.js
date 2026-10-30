'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

// fkDrop and fkListen stay in station.js: they assign its `fkDrag` and `fkRec`.
test('float.js also holds the float panel drawing and gate posting', () => {
    moved('float.js', ['drawFloat', 'fkFit', 'goneSave', 'fkApply', 'fkClose', 'pgRead', 'pgSync',
        'answerPost', 'gatePost', 'tickGates', 'tuneNotify', 'reload']);
});
