'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('session-body.js holds the session page bodies station.js used to write out', () => {
    moved('session-body.js', ['clock', 'timelineModel', 'textW', 'labelRoom', 'timelineSvg', 'costModel', 'loopRow',
        'sumLoops', 'stageShare', 'costShareHtml', 'dispatchStagesHtml', 'costHtml', 'sessionHeadHtml', 'tabsHtml',
        'talkStamp', 'talkBody', 'talkCounts', 'talkRow', 'talkCut', 'talkRows', 'talkNote', 'talkHtml', 'liveTag', 'railHtml']);
});
