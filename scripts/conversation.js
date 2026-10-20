#!/usr/bin/env node
'use strict';

// One session's whole conversation — what the user typed, what Claude wrote,
// every compaction marked — as markdown to read or jsonl to analyse. The rules
// for which transcript lines count are lib/conversation.js's; this file finds
// the transcript, parses the command line and writes.

const fs = require('node:fs');
const { parseArgs } = require('node:util');
const conversation = require('../lib/conversation.js');
const bundle = require('../lib/bundle.js');
const { transcriptOf } = require('../lib/detail.js');
const { entriesOf } = require('../lib/usage.js');
const { liveConfigDir } = require('../lib/live.js');

const HELP = [
    'usage: node scripts/conversation.js --session <id> [--format md|jsonl] [--out <file>] [--config-dir <dir>]',
    '       node scripts/conversation.js --bundle <file.jsonl.gz> [--part <rel>] [--list] [--tools] [--format md|jsonl] [--out <file>]',
    '--bundle reads a bundle record.js session wrote; --part picks one transcript in it, the first by default;',
    '--list prints its parts. --tools keeps tool calls and tool results as turns.',
    '',
    'The whole conversation of one Claude Code session, read from',
    '<config dir>/projects/<project>/<id>.jsonl: what the user typed and what Claude',
    'wrote, in order, with every compaction and its summary marked where it happened.',
    'System text, tool results and subagent lines are left out, and lines that do not',
    'parse are skipped; both are counted on a "left out:" line. Hook output, thinking',
    'and tool calls are dropped without a count.',
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
            bundle: { type: 'string' },
            part: { type: 'string' },
            list: { type: 'boolean' },
            tools: { type: 'boolean' },
            help: { type: 'boolean' },
        },
    });
    if (values.help || (!values.session && !values.bundle)) {
        process.stdout.write(HELP + '\n');
        return values.help ? 0 : 2;
    }
    const format = values.format || 'md';
    if (format !== 'md' && format !== 'jsonl') {
        process.stderr.write('conversation: --format is md or jsonl, not ' + format + '\n');
        return 2;
    }
    const stats = { unparsed: 0 };
    let entries;
    let file;
    let session = values.session;
    if (values.bundle) {
        const { head, parts } = bundle.unpack(fs.readFileSync(values.bundle));
        if (values.list) {
            process.stdout.write(head.files.map((r) => r + '  ' + (parts.get(r) || []).length + ' lines').join('\n') + '\n');
            return 0;
        }
        const rel = values.part || head.files[0];
        if (!parts.has(rel)) {
            process.stderr.write('conversation: no part ' + rel + ' in ' + values.bundle + '\n');
            return 1;
        }
        entries = parts.get(rel);
        file = values.bundle + '#' + rel;
        session = session || head.sessions[0];
    } else {
        const configDir = values['config-dir'] || liveConfigDir();
        file = transcriptOf(configDir, values.session);
        if (!file) {
            process.stderr.write('conversation: no transcript for session ' + values.session + ' under ' + configDir + '/projects\n');
            return 1;
        }
        entries = entriesOf(file, stats);
        if (!entries) {
            process.stderr.write('conversation: cannot read ' + file + '\n');
            return 1;
        }
    }
    const read = conversation.turnsOf(entries, { tools: Boolean(values.tools) });
    read.skipped.unparsed = stats.unparsed;
    const text = format === 'jsonl' ? conversation.jsonlOf(read.turns) : conversation.markdownOf(read, { session, file });
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
