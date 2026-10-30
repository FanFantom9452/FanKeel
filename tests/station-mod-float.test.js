'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('float.js holds the tune float and pending gate station.js used to write out', () => {
    moved('float.js', ['tuneItems', 'tuneOpen', 'tuneEvents', 'toastText', 'floatNotes', 'readAll', 'dismissNote',
        'clearNotes', 'goneKeys', 'goneParse', 'noteHtml', 'gateClock', 'micOk', 'gateFreeHtml', 'gateCountdownHtml',
        'fkBoxParse', 'fkBoxClamp', 'fkBoxStyle', 'floatHtml', 'pgAnswers', 'pendingGateHtml', 'changedParts',
        'effortChip', 'boardLinkHtml']);
});
