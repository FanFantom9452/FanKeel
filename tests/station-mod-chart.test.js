'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('chart.js holds the 30-day chart helpers station.js used to write out', () => {
    moved('chart.js', ['dayBars', 'kpiHtml', 'roHtml', 'spark', 'routeDots', 'stageNow', 'runningTag', 'segHtml',
        'histSvg', 'paletteOf', 'legendOwn', 'legendRest', 'shortLabel', 'legendHtml', 'filterHtml', 'visibleBars',
        'segTip', 'tourPage', 'projectRows']);
});
