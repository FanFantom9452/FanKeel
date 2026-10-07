#!/usr/bin/env node
'use strict';

// One session's whole conversation — what the user typed, what Claude wrote,
// every compaction marked — as markdown to read or jsonl to analyse. The rules
// for which transcript lines count are lib/conversation.js's; this file finds
// the transcript, parses the command line and writes.

const fs = require('node:fs');
const { parseArgs } = require('node:util');
const conversation = require('../lib/conversation.js');
const { transcriptOf } = require('../lib/detail.js');
const { entriesOf } = require('../lib/usage.js');
const { liveConfigDir } = require('../lib/live.js');

const HELP = [
    'usage: node scripts/conversation.js --session <id> [--format md|jsonl] [--out <file>] [--config-dir <dir>]',
    '',
    'The whole conversation of one Claude Code session, read from',
    '<config dir>/projects/<project>/<id>.jsonl: what the user typed and what Claude',
    'wrote, in order, with every compaction and its summary marked where it happened.',
    'Tool calls, system text, hook output and subagents are left out and counted.',
    'md (the default) is for reading; jsonl is one turn a line, for analysis.',
    'Without --out it prints to stdout. In Windows PowerShell 5, use --out rather',
    'than >, which re-encodes the text.',
].join('\n');

function main(argv) {
    const { values } = parseArgs({
        args: argv,
        strict: true,
        options: {
            session: { type: 'string' },
            format: { type: 'string' },
            out: { type: 'string' },
            'config-dir': { type: 'string' },
            help: { type: 'boolean' },
        },
    });
    if (values.help || !values.session) {
        process.stdout.write(HELP + '\n');
        return values.help ? 0 : 2;
    }
    const format = values.format || 'md';
    if (format !== 'md' && format !== 'jsonl') {
        process.stderr.write('conversation: --format is md or jsonl, not ' + format + '\n');
        return 2;
    }
    const configDir = values['config-dir'] || liveConfigDir();
    const file = transcriptOf(configDir, values.session);
    if (!file) {
        process.stderr.write('conversation: no transcript for session ' + values.session + ' under ' + configDir + '/projects\n');
        return 1;
    }
    const read = conversation.turnsOf(entriesOf(file) || []);
    const text = format === 'jsonl' ? conversation.jsonlOf(read.turns) : conversation.markdownOf(read, { session: values.session, file });
    if (values.out) {
        fs.writeFileSync(values.out, text);
        process.stdout.write('wrote ' + read.turns.length + ' turns to ' + values.out + '\n');
    } else {
        process.stdout.write(text);
    }
    return 0;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (e) {
    process.stderr.write('conversation: ' + e.message + '\n');
    process.exitCode = 2;
}
