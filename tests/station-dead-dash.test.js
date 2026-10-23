'use strict';
// station-52: the 儀表板 and project page that only the OLD.* fallback drew
// are gone, with their TODO panel and its listeners; the .tdlg dialog
// listener the session page and the remote card still use stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('the old dashboard, project page and TODO panel are not defined any more', () => {
    for (const n of ['todoPanelHtml', 'todoGloss', 'todoChip', 'dashPage', 'dashRecent', 'dashXList', 'dashClash', 'dashGateWait', 'dashLanded',
        'dashTodoDialog', 'tdBack', 'homeLive', 'homeLiveRow', 'homeRunning', 'homeTodo', 'homeSpend', 'waitFor', 'waitsOnYou', 'dashRowName',
        'sessionsPage', 'projectsPage', 'projectPage', 'inWindow']) {
        assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
    }
    assert.doesNotMatch(JS, /data-tdmore|data-tdbody|\[data-tdlg\]/);
});

test('the .tdlg dialog listener and its tabs stay', () => {
    assert.match(JS, /function tdShow\(/);
    assert.match(JS, /t\.closest\('\.tdlg'\)/);
    assert.match(JS, /closest\('\.tdlg \[role=tab\]'\)/);
});
