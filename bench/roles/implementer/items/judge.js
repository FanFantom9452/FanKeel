#!/usr/bin/env node
'use strict';
// The implementer items' shared judge.
//
//   node judge.js <item dir> <project> [--expect <dir>]
//   node judge.js write <item dir> <project>
//
// The first form judges a run. Every Files path of the item's input.md that
// has expected text must hold it byte for byte: the code block written for
// that path, without its fence's indentation, or — with --expect — the file
// of the same name under <dir>, which the item's check.sh built itself. Then
// nothing outside the Files block may differ from the bench-start tag, and
// every Test path must pass under node --test. The last line printed is
// `pass` or `fail <class>: <why>`. `write` lays the code blocks into a
// project, which is how a pass control is built without a second copy.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The paths under **Files:**, up to the first blank line.
function filesOf(md) {
    const out = { modify: [], test: [] };
    let inFiles = false;
    for (const raw of md.split('\n')) {
        const line = raw.trim();
        if (line === '**Files:**') {
            inFiles = true;
            continue;
        }
        if (!inFiles) continue;
        if (!line) break;
        const m = /^-\s*(Modify|Test):\s*`([^`]+)`/.exec(line);
        if (m) out[m[1].toLowerCase()].push(m[2]);
    }
    return out;
}

// The code block for each path: a fence whose nearest non-blank line above
// names the path in backticks. A later block for the same path wins.
function blocksOf(md, paths) {
    const lines = md.split('\n');
    const out = {};
    for (let i = 0; i < lines.length; i++) {
        const open = /^(\s*)(`{3,})\S*\s*$/.exec(lines[i]);
        if (!open) continue;
        const body = [];
        let j = i + 1;
        for (; j < lines.length && lines[j].trim() !== open[2]; j++) {
            body.push(lines[j].startsWith(open[1]) ? lines[j].slice(open[1].length) : lines[j].trim());
        }
        let k = i - 1;
        while (k >= 0 && !lines[k].trim()) k--;
        const named = k >= 0 ? paths.find((p) => lines[k].includes('`' + p + '`')) : undefined;
        if (named) out[named] = body.join('\n') + '\n';
        i = j;
    }
    return out;
}

// Every file that differs from bench-start, committed or not, and every
// untracked file git does not ignore.
function changed(proj) {
    const list = (args) => String(spawnSync('git', args, { cwd: proj, encoding: 'utf8' }).stdout || '').split('\n').filter(Boolean);
    return [...new Set([...list(['diff', '--name-only', 'bench-start']), ...list(['ls-files', '--others', '--exclude-standard'])])];
}

function differs(got, want) {
    if (got.includes('\r\n') !== want.includes('\r\n')) return 'its line endings changed';
    let i = 0;
    while (i < got.length && i < want.length && got[i] === want[i]) i++;
    return 'the first difference is at byte ' + i;
}

function judge(itemDir, proj, expectDir) {
    const md = fs.readFileSync(path.join(itemDir, 'input.md'), 'utf8');
    const files = filesOf(md);
    const allowed = [...files.modify, ...files.test];
    const blocks = blocksOf(md, allowed);
    for (const p of allowed) {
        const from = expectDir ? path.join(expectDir, p) : null;
        const want = from ? (fs.existsSync(from) ? fs.readFileSync(from) : null) : (p in blocks ? Buffer.from(blocks[p]) : null);
        if (!want) continue;
        const file = path.join(proj, p);
        if (!fs.existsSync(file)) return 'fail wrong: ' + p + ' was not written';
        const got = fs.readFileSync(file);
        if (!got.equals(want)) return 'fail wrong: ' + p + ' differs from the plan — ' + differs(got, want);
    }
    const extra = changed(proj).filter((p) => !allowed.includes(p));
    if (extra.length) return 'fail extra: changed outside the Files block: ' + extra.join(', ');
    if (files.test.length) {
        // Under the repo's own node --test, NODE_TEST_CONTEXT makes a nested
        // run exit 0 on a failing spec; the child must not inherit it.
        const { NODE_TEST_CONTEXT, ...env } = process.env;
        const r = spawnSync(process.execPath, ['--test', ...files.test], { cwd: proj, encoding: 'utf8', env });
        if (r.status !== 0) return 'fail wrong: node --test ' + files.test.join(' ') + ' fails';
    }
    return 'pass';
}

const args = process.argv.slice(2);
if (args[0] === 'write') {
    const md = fs.readFileSync(path.join(args[1], 'input.md'), 'utf8');
    const files = filesOf(md);
    for (const [p, text] of Object.entries(blocksOf(md, [...files.modify, ...files.test]))) {
        fs.mkdirSync(path.dirname(path.join(args[2], p)), { recursive: true });
        fs.writeFileSync(path.join(args[2], p), text);
    }
} else {
    const at = args.indexOf('--expect');
    const verdict = judge(args[0], args[1], at === -1 ? null : args[at + 1]);
    console.log(verdict);
    process.exit(verdict === 'pass' ? 0 : 1);
}
