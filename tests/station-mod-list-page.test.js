'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('list-page.js holds the list page station.js used to write out', () => {
    moved('list-page.js', ['taskCell', 'stageCell', 'goneNote', 'registryNote', 'homeRows', 'homeOpts', 'val', 'pickHtml',
        'facetsHtml', 'selbarInner', 'selbarHtml', 'listPage', 'drawList', 'clearStaleControl', 'clearControl',
        'drawDetail', 'claimsKeep', 'claimsPut', 'genText']);
});
