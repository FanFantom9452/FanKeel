'use strict';
// Design §6 (docs/99-archive/2026-10-20-chartroom-board-design.md): the
// station-15 completion record says task diagrams moved to the board design,
// and the design skill files a task's diagram as a .board in the build
// directory, sequence and gantt staying Mermaid.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const LINK = '[2026-10-20-chartroom-board-design.md](../../99-archive/2026-10-20-chartroom-board-design.md)';

test('station-15\'s completion record is marked superseded for task diagrams', () => {
    const t = read('docs/90-agent/todo/station-15.md');
    const record = t.slice(t.indexOf('## 完成紀錄'));
    assert.ok(record.includes(LINK), 'the record links the board design');
    assert.match(record, /任務的架構、流程與依賴圖改由/);
});

test('the design skill files a task diagram as a .board in the build directory, sequence and gantt as Mermaid', () => {
    const d = read('skills/fankeel-design/SKILL.md');
    assert.match(d, /\*\*A task's diagram is a `\.board`\.\*\*/);
    assert.match(d, /one record per line, no coordinates/);
    assert.match(d, /Sequence and gantt diagrams stay Mermaid\./);
    assert.doesNotMatch(d, /方向|逐塊/);
});
