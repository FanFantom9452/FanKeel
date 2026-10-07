#!/usr/bin/env node
'use strict';

// Before and after: two date ranges of this machine's Claude Code sessions,
// side by side. The figures are lib/compare.js's; this file parses the
// command line and prints.

const { parseArgs } = require('node:util');
const compare = require('../lib/compare.js');
const { liveConfigDir } = require('../lib/live.js');

const HELP = [
    'usage: node scripts/usage-compare.js --before YYYY-MM-DD..YYYY-MM-DD --after YYYY-MM-DD..YYYY-MM-DD [--config-dir <dir>]',
    '',
    'Two date ranges of this machine\'s Claude Code sessions, side by side, read from',
    '<config dir>/projects. Compare per session, not totals: the two ranges did',
    'different work, and a week or two is a small sample.',
    '',
    'Before installing fankeel, on the machine being measured:',
    '  1. In ~/.claude/settings.json set "cleanupPeriodDays": 90, so transcripts are',
    '     not deleted after the default 30 days, before the comparison runs.',
    '  2. Run /insights and save ~/.claude/usage-data/report.html somewhere else.',
    '  3. Zip ~/.claude/projects as the baseline.',
].join('\n');

function main(argv) {
    const { values } = parseArgs({
        args: argv,
        strict: true,
        options: { before: { type: 'string' }, after: { type: 'string' }, 'config-dir': { type: 'string' }, help: { type: 'boolean' } },
    });
    if (values.help || !values.before || !values.after) {
        process.stdout.write(HELP + '\n');
        return values.help ? 0 : 2;
    }
    const a = compare.parseRange(values.before);
    const b = compare.parseRange(values.after);
    process.stdout.write(compare.format(compare.compare(values['config-dir'] || liveConfigDir(), a, b)) + '\n');
    return 0;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (e) {
    process.stderr.write('usage-compare: ' + e.message + '\n');
    process.exitCode = 2;
}
