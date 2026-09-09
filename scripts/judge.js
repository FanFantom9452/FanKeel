#!/usr/bin/env node
'use strict';

// Files what a `fankeel-judge` subagent answered. The judge is read-only by
// construction, so the parent session is the one that writes — and what it
// writes is what it received, verbatim: the brief it sent and the answer that
// came back. A record is never overwritten; a second on the same slug gets -2.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');

const FLAGS = ['session', 'brief', 'answer', 'slug', 'model', 'root', 'project'];

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

function parse(argv) {
    const options = {};
    for (const f of FLAGS) options[f] = { type: 'string' };
    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    for (const f of FLAGS) if (values[f] !== undefined && typeof values[f] !== 'string') fail('--' + f + ' needs a value.');
    return { verb: positionals[0], opts: values };
}

function readAnswer(spec) {
    if (spec === '-') return fs.readFileSync(0, 'utf8');
    return fs.readFileSync(spec, 'utf8');
}

function freePath(dir, base) {
    let file = path.join(dir, base + '.md');
    for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, base + '-' + n + '.md');
    return file;
}

function firstLine(text) {
    const line = text.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) || '';
    return line.length > 120 ? line.slice(0, 117) + '…' : line;
}

// The index is hand-maintained, so the row is appended under the heading
// Task 3 of the plan created. No heading means no index to keep, and the
// record is still written — the audit's "documents the index never learned
// about" is the safety net there.
function indexRow(indexFile, question, rel, judged, model) {
    if (!fs.existsSync(indexFile)) return false;
    const text = fs.readFileSync(indexFile, 'utf8');
    const at = text.indexOf('## Judgements');
    if (at < 0) return false;
    const tableEnd = (() => {
        const after = text.slice(at);
        const lines = after.split('\n');
        let i = 0;
        while (i < lines.length && !lines[i].startsWith('|')) i++;
        while (i < lines.length && lines[i].startsWith('|')) i++;
        return at + lines.slice(0, i).join('\n').length;
    })();
    const row = '\n| ' + question.replace(/\|/g, '\\|') + ' | [' + rel + '](' + rel + ') — *judged ' + judged.slice(0, 10) + ', ' + model + '* |';
    fs.writeFileSync(indexFile, text.slice(0, tableEnd) + row + text.slice(tableEnd));
    return true;
}

function record(opts) {
    if (!opts.session) fail('--session <id> is required: the record names the session that asked.');
    if (!opts.brief || !opts.answer || !opts.slug) fail('record needs --brief <path>, --answer <path|-> and --slug <a-z0-9->.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.slug)) fail('--slug is lowercase ascii, digits and dashes.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    const brief = fs.readFileSync(opts.brief, 'utf8');
    const answer = readAnswer(opts.answer);
    const judged = new Date().toISOString();
    const model = opts.model || 'fable';
    const dir = path.join(projectRoot, 'docs', 'judgements');
    fs.mkdirSync(dir, { recursive: true });
    const file = freePath(dir, judged.slice(0, 10) + '-' + opts.slug);
    const body = [
        '---',
        'judged: ' + judged,
        'model: ' + model,
        'agent: fankeel-judge',
        'task: ' + JSON.stringify(mine.task || ''),
        'session: ' + opts.session,
        'stage: ' + (mine.stage || ''),
        '---',
        '',
        '# ' + firstLine(brief),
        '',
        '## Question',
        '',
        brief.trimEnd(),
        '',
        '## Answer',
        '',
        answer.trimEnd(),
        '',
    ].join('\n');
    fs.writeFileSync(file, body);
    const indexFile = path.join(projectRoot, 'docs', 'README.md');
    const rel = 'judgements/' + path.basename(file);
    const indexed = indexRow(indexFile, firstLine(brief), rel, judged, model);
    return 'fankeel — judgement filed: ' + file + '\n' + (indexed ? 'index row: ' + indexFile : 'no ## Judgements table in ' + indexFile + '; add the row by hand');
}

function main(argv) {
    const { verb, opts } = parse(argv);
    if (verb !== 'record') fail('judge.js record --session <id> --brief <path> --answer <path|-> --slug <slug> [--model <m>] [--root <dir>] [--project <dir>]');
    return record(opts);
}

if (require.main === module) process.stdout.write(main(process.argv.slice(2)) + '\n');

module.exports = { firstLine, freePath, indexRow };
