#!/usr/bin/env node
'use strict';

// Writes lib/profile.js's own key table into docs/01-guide/profile.md, the
// way scripts/stage-registry.js writes skills/registry.json: KEYS and
// PRESETS.balanced are the source, and the page between the markers holds
// only their rendering.

const fs = require('node:fs');
const path = require('node:path');

const { profileTableMarkdown } = require('../lib/profile.js');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'profile.md');
const START = '<!-- PROFILE_TABLE:START -->';
const END = '<!-- PROFILE_TABLE:END -->';

function apply(text, table) {
    const at = text.indexOf(START);
    const to = text.indexOf(END);
    if (at < 0 || to < 0 || to < at) return null;
    return text.slice(0, at + START.length) + '\n' + table + '\n' + text.slice(to);
}

function main() {
    const text = fs.readFileSync(PAGE, 'utf8');
    const next = apply(text, profileTableMarkdown());
    if (next === null) return 'profile-table.js: ' + PAGE + ' has no ' + START + ' / ' + END + ' markers';
    fs.writeFileSync(PAGE, next);
    return path.relative(path.join(__dirname, '..'), PAGE) + ' written.';
}

if (require.main === module) {
    process.stdout.write(main() + '\n');
}

module.exports = { apply };
