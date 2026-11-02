'use strict';

// docs/90-agent/todo/init-4.md and compact-8.md: init names /auto-mode-setup
// once and never runs it, and the compact-window question says the host
// compacts an idle conversation first.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const init = fs.readFileSync(path.join(__dirname, '..', 'skills/fankeel-init/SKILL.md'), 'utf8').replace(/\s+/g, ' ');

test('init asks once about /auto-mode-setup and never runs it', () => {
    assert.match(init, /`\/auto-mode-setup` \(Claude Code 2\.1\.304\)/);
    assert.match(init, /no subagent can run a slash command/);
    assert.match(init, /the skill never runs the command itself/);
    assert.match(init, /docs\/90-agent\/todo\/stage-agents-10\.md/);
});

test('the compact-window question says idle compaction goes first', () => {
    assert.match(init, /Claude Code 2\.1\.314 compacts an idle 200K\+ conversation on its own/);
    assert.match(init, /`\/config` → Idle compaction/);
    assert.match(init, /never reaches 350000 and above first/);
});
