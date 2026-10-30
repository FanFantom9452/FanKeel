'use strict';
// skills/fankeel-weekly/SKILL.md and docs/01-guide/station.md say what
// docs/90-agent/plans/2026-10-30-weekly-facets-design.md changed: the 顯示
// question, facets and questions at Gate 1, cost only when picked, the
// station's one write, and weekly.js questions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-weekly', 'SKILL.md'), 'utf8');
const guide = fs.readFileSync(path.join(ROOT, 'docs', '01-guide', 'station.md'), 'utf8');

test('the first ask holds a 顯示 question with both switches, neither recommended, written to show', () => {
    assert.match(skill, /## 1\. Ask — one AskUserQuestion, three questions/);
    assert.match(skill, /\*\*顯示\*\*: multiSelect, `每天的工作量`[^\n]*`製作成本`/);
    assert.match(skill, /neither is the recommendation/);
    assert.match(skill, /"show": \{ "daily": false, "cost": false \}/);
});

test('events.json names facets, tech and questions, and Gate 1 lists facets and questions', () => {
    assert.match(skill, /\*\*`facets`\*\* — one or more `name`s from `data\.json` `facets`/);
    assert.match(skill, /\*\*`tech`\*\* — optional: one to three sentences/);
    assert.match(skill, /\*\*`questions`\*\* —/);
    assert.match(skill, /事、專案、狀態、面向、一句結論/);
    assert.match(skill, /## Blocked`? and `?## Needs a decision/);
});

test('cost only at the foot when picked, the session the shell names, and the station\'s one write', () => {
    assert.doesNotMatch(skill, /no spend/);
    assert.match(skill, /Cost appears only at the page's foot, and only when `製作成本` was picked\./);
    assert.match(skill, /`--session <id>`/);
    assert.match(skill, /saves a reply to a question it already has; it writes nothing else\./);
    assert.match(skill, /node <plugin>\/scripts\/weekly\.js questions \[--repo R\] \[--near YYYY-MM-DD\] \[--grep 詞\] \[--answered\]/);
});

test('the station guide says a served report takes replies and the mailed file does not', () => {
    assert.match(guide, /回覆欄可以輸入，按「儲存」會寫回 `fankeel\/weekly\/<迄日>\.json`/);
});
