'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('gate-tab.js holds the gate tab station.js used to write out', () => {
    moved('gate-tab.js', ['gateStage', 'gateAt', 'gateText', 'gateSec', 'gateKv', 'gateRest', 'gateList', 'gatePatrol',
        'gateSurvey', 'gateDisp', 'gateDesign', 'gateBuild', 'gateTime', 'gateLand', 'gateTabHtml', 'gateTab']);
});
