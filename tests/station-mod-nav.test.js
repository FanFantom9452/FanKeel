'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('nav.js holds the left bar station.js used to write out', () => {
    moved('nav.js', ['recentRows', 'navCounts', 'icon', 'navOn', 'navGroup', 'navTop', 'themeBtnHtml', 'navHtml',
        'navLinksHtml', 'jumpHtml', 'jumpHits', 'jumpListHtml', 'subtabsHtml', 'shellsHtml', 'liveRail', 'saFamily',
        'saShort', 'liveSubsHtml', 'liveLane', 'liveGate', 'liveRun', 'liveMaybe', 'liveIdle', 'nowHtml']);
});
