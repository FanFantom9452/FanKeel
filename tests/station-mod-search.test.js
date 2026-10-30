'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('search.js holds the header search and language chrome station.js used to write out', () => {
    moved('search.js', ['qMark', 'qHas', 'qGroups', 'qDraw', 'cssKey', 'serveIconHtml', 'applyChrome']);
});
