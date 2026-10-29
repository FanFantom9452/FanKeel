'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('dash.js holds the dashboard cards and completion record station.js used to write out', () => {
    moved('dash.js', ['msOf', 'dashHead', 'keelGlyph', 'keelProgress', 'keelStage', 'focusHref', 'tdShow', 'dashTodoName',
        'dashParts', 'dashByProj', 'dashTokens7', 'dashModels', 'stageCost', 'recLabel', 'recTitle', 'recordRows',
        'recordNone', 'recordSrc', 'recordHtml', 'recordPageHtml', 'boardsHtml', 'listAskRow', 'dispatchUi']);
});
