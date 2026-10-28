'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('detail-html.js holds the detail panel bodies station.js used to write out', () => {
    moved('detail-html.js', ['estMark', 'totalSuffix', 'secOpen', 'seenHtml', 'sec', 'comma', 'niceStep', 'downsample',
        'lineChart', 'riseText', 'risesList', 'ctxSection', 'seqHtml', 'backBlock', 'orderSection', 'splitStage',
        'splitCount', 'splitHtml', 'cents', 'dur', 'taskCount', 'tasksHtml', 'planNewest', 'planPath', 'planReason',
        'planRel', 'planLit', 'planCard', 'planTabHtml']);
});
