'use strict';
// skills/fankeel-design/design-guide.md: fankeel's own design rules, one
// page, read by every mockup before any design skill a prompt names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GUIDE = path.join(ROOT, 'skills', 'fankeel-design', 'design-guide.md');

test('the guide is one page, with its six sections, and names the four skills it is distilled from', () => {
    const text = fs.readFileSync(GUIDE, 'utf8');
    const lines = text.split('\n').length;
    assert.ok(lines <= 150, 'the guide is ' + lines + ' lines; one page is 150');
    for (const h of ['## Direction', '## Type', '## Colour', '## Space and layout', '## Motion', '## Never']) {
        assert.ok(text.includes('\n' + h + '\n'), 'no ' + h + ' section');
    }
    for (const s of ['taste-skill', 'frontend-design', 'ui-ux-pro-max', 'impeccable']) assert.ok(text.includes(s), 'the guide does not name ' + s);
    assert.match(text, /prefers-reduced-motion/);
});

test('the mockup agent reads the guide first, and the design skill takes a list and auto', () => {
    const agent = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mockup.md'), 'utf8');
    assert.match(agent, /skills\/fankeel-design\/design-guide\.md/);
    assert.doesNotMatch(agent.replace(/\s+/g, ' '), /a prompt that names none is a prompt to say so/);
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(design, /\[design-guide\.md\]\(design-guide\.md\)/);
    assert.match(design, /`design\.mockup: auto`/);
    assert.match(design, /`design\.skill` is a list/);
});
