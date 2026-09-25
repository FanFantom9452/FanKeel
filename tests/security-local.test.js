'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { DEFAULT_URL, parseArgs, securitySection, candidates } = require('../scripts/security-local.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'security-local.js');
const REVIEWER = path.join(__dirname, '..', 'agents', 'fankeel-reviewer.md');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// Two commits; the second adds the line the model has to be shown.
function repo() {
    const dir = tmp('fankeel-seclocal-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 1;\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.js'), "require('child_process').execSync(process.argv[2]);\n");
    git(dir, 'commit', '-qam', 'sink');
    return dir;
}

// A stand-in for ollama's POST /api/generate, on a port the OS picks.
function stub(response) {
    const seen = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            seen.push({ method: req.method, url: req.url, body: JSON.parse(body) });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ model: 'stub', response, done: true }));
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: 'http://127.0.0.1:' + server.address().port })));
}

// Never execFileSync here: the stub answers from this same event loop.
function run(args) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, ...args]);
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

const NOISE = [
    'Sure — here is what I found.',
    '- a.js:1: inject: process.argv[2] → execSync. Use execFile with an argument list.',
    'The rest looks fine.',
    '`lib/b.js:10: secret: API_KEY → console.log. Drop the log.`',
    'a.js: file: no line number here',
    'a.js:2: style: not one of the four tags',
    'security: 2 findings.',
].join('\n');
const KEPT = [
    'a.js:1: inject: process.argv[2] → execSync. Use execFile with an argument list.',
    'lib/b.js:10: secret: API_KEY → console.log. Drop the log.',
];

test('only the reply lines in the lens format reach --out, and the model is shown the lens and the diff', async () => {
    const dir = repo();
    const { server, seen, url } = await stub(NOISE);
    try {
        const out = path.join(tmp('fankeel-seclocal-out-'), 'candidates.txt');
        const r = await run(['--range', 'HEAD~1..HEAD', '--model', 'qwen3:14b', '--out', out, '--url', url, '--root', dir]);
        assert.equal(r.code, 0, r.stderr);
        assert.equal(fs.readFileSync(out, 'utf8'), KEPT.join('\n') + '\n');
        assert.match(r.stdout, /2 candidate lines/);
        assert.equal(seen.length, 1);
        assert.equal(seen[0].method, 'POST');
        assert.equal(seen[0].url, '/api/generate');
        assert.equal(seen[0].body.model, 'qwen3:14b');
        assert.equal(seen[0].body.stream, false);
        assert.ok(seen[0].body.prompt.includes('Trace from the source to the sink'), 'the lens is read from the agent file');
        assert.ok(seen[0].body.prompt.includes('execSync(process.argv[2])'), 'the range\'s diff is in the prompt');
    } finally {
        server.close();
    }
});

test('ollama not answering: non-zero, the reason on stderr, nothing written', async () => {
    const { server, url } = await stub('');
    await new Promise((resolve) => server.close(resolve));
    const dir = repo();
    const out = path.join(tmp('fankeel-seclocal-out-'), 'candidates.txt');
    const r = await run(['--range', 'HEAD~1..HEAD', '--model', 'qwen3:14b', '--out', out, '--url', url, '--root', dir]);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cannot reach ollama at http:\/\/127\.0\.0\.1:\d+/);
    assert.equal(fs.existsSync(out), false);
});

test('parseArgs: three required flags, the URL from --url then FANKEEL_OLLAMA_URL, and no range git would read as an option', () => {
    const base = ['--range', 'a..b', '--model', 'm', '--out', 'o'];
    assert.equal(parseArgs(base, {}).url, DEFAULT_URL);
    assert.equal(DEFAULT_URL, 'http://127.0.0.1:11434');
    assert.equal(parseArgs(base, { FANKEEL_OLLAMA_URL: 'http://127.0.0.1:9' }).url, 'http://127.0.0.1:9');
    assert.equal(parseArgs(base.concat(['--url', 'http://h:1']), { FANKEEL_OLLAMA_URL: 'http://x:2' }).url, 'http://h:1');
    assert.ok(parseArgs(['--model', 'm', '--out', 'o'], {}).error, 'no --range');
    assert.ok(parseArgs(['--range', '--output=x', '--model', 'm', '--out', 'o'], {}).error, 'a range starting with -');
    assert.ok(parseArgs(base.concat(['--bogus', 'x']), {}).error, 'an unknown flag');
});

test('the lens is the reviewer file\'s own ## Security section, and candidates keeps only lens-format lines', () => {
    const lens = securitySection(fs.readFileSync(REVIEWER, 'utf8'));
    assert.ok(lens.includes('`inject:`') && lens.includes('security: <N> findings.'), lens);
    assert.equal(lens.includes('## Return'), false, 'the section runs past its end');
    assert.equal(securitySection('# x\n\n## Other\n\ntext\n'), null);
    assert.deepEqual(candidates(NOISE), KEPT);
});
