'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('dispatch-table.js holds the dispatch table and replay station.js used to write out', () => {
    moved('dispatch-table.js', ['sums', 'estOf', 'numCells', 'isNum', 'agentState', 'toolText', 'stepLabel', 'stepLi',
        'agentPill', 'agdots', 'stateTally', 'modelOf', 'nowLine', 'agentCounts', 'agentRow', 'agentBody', 'dispatchHtml',
        'dxChartHtml', 'stepsFor', 'rpKinds', 'segmentsOf', 'rpTag', 'took', 'replayRow', 'replayHtml', 'todoEntry',
        'riseTodo', 'backTodo', 'todoSpot']);
});
