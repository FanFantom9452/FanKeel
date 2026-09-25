#!/usr/bin/env node
'use strict';

// Verify's security lens, first pass on a local model. The lens is read out of
// agents/fankeel-reviewer.md's `## Security` section rather than copied here,
// so the two cannot drift; of the model's reply only the lines in that lens's
// own `path:line: <tag> ...` format are kept, and the reviewer then confirms
// them one by one. docs/plans/2026-09-26-three-ready-design.md §2.
//
//   node scripts/security-local.js --range <a>..<b> --model <m> --out <file>
//                                  [--url <base>] [--root <repo>]
//
// The base URL is --url, else FANKEEL_OLLAMA_URL, else ollama's default. Exit 0
// with the file written; 1 when git, the agent file or ollama fails, the reason
// on stderr; 2 on a usage error.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_URL = 'http://127.0.0.1:11434';
const REVIEWER = path.join(__dirname, '..', 'agents', 'fankeel-reviewer.md');
const USAGE = 'usage: security-local.js --range <a>..<b> --model <m> --out <file> [--url <base>] [--root <repo>]';
// The lens's four tags; a line carrying any other is not a finding of this lens.
const LINE = /^\S+:\d+: (?:inject|access|file|secret): \S/;
const FLAGS = { '--range': 'range', '--model': 'model', '--out': 'out', '--url': 'url', '--root': 'root' };

function parseArgs(argv, env) {
    const e = env || process.env;
    const out = { range: null, model: null, out: null, url: e.FANKEEL_OLLAMA_URL || DEFAULT_URL, root: process.cwd() };
    for (let i = 0; i < argv.length; i++) {
        const key = FLAGS[argv[i]];
        if (!key || i + 1 >= argv.length) return { error: USAGE };
        out[key] = argv[++i];
    }
    if (!out.range || !out.model || !out.out) return { error: USAGE };
    // Handed to git as an argument: one starting with `-` would be read as an option.
    if (out.range.startsWith('-')) return { error: '--range is <a>..<b>, not an option: ' + out.range };
    return out;
}

// From the line after `## Security` to the next `## ` heading or the end.
function securitySection(text) {
    const m = /^## Security[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(String(text));
    return m ? m[1].trim() : null;
}

// A list marker or a pair of backticks around the line is the model's noise,
// not part of the finding.
function candidates(reply) {
    const out = [];
    for (const raw of String(reply).split(/\r?\n/)) {
        const line = raw.trim().replace(/^[-*]\s+/, '').replace(/^`(.*)`$/, '$1');
        if (LINE.test(line)) out.push(line);
    }
    return out;
}

function post(base, body) {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/generate', base);
        if (url.protocol !== 'http:') throw new Error('only http:// is supported, got ' + url.protocol);
        const data = JSON.stringify(body);
        const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { text += c; });
            res.on('end', () => resolve({ status: res.statusCode, text }));
        });
        req.on('error', reject);
        req.end(data);
    });
}

async function main(argv) {
    const args = parseArgs(argv);
    if (args.error) {
        process.stderr.write(args.error + '\n');
        return 2;
    }
    let lens = null;
    try { lens = securitySection(fs.readFileSync(REVIEWER, 'utf8')); } catch (e) { lens = null; }
    if (!lens) {
        process.stderr.write('no ## Security section in ' + REVIEWER + '\n');
        return 1;
    }
    let diff;
    try {
        diff = execFileSync('git', ['diff', args.range], { cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        process.stderr.write('git diff ' + args.range + ' failed in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
        return 1;
    }
    const prompt = [
        'Apply the security lens below to the diff after it. Return only finding lines in the lens\'s format, one per line, and nothing else.',
        '',
        lens,
        '',
        '--- diff ---',
        diff,
    ].join('\n');
    let res;
    try {
        res = await post(args.url, { model: args.model, prompt, stream: false });
    } catch (e) {
        process.stderr.write('cannot reach ollama at ' + args.url + ': ' + (e.code || e.message) + '\n');
        return 1;
    }
    if (res.status !== 200) {
        process.stderr.write('ollama answered ' + res.status + ': ' + res.text.slice(0, 200) + '\n');
        return 1;
    }
    let reply;
    try { reply = JSON.parse(res.text).response; } catch (e) { reply = undefined; }
    if (typeof reply !== 'string') {
        process.stderr.write('ollama answered no `response` string\n');
        return 1;
    }
    const lines = candidates(reply);
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, lines.map((l) => l + '\n').join(''));
    process.stdout.write(args.out + ' — ' + lines.length + ' candidate line' + (lines.length === 1 ? '' : 's') + '\n');
    return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });

module.exports = { DEFAULT_URL, parseArgs, securitySection, candidates };
