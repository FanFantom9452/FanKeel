'use strict';
// plain-1, item three: the tests the 2026-10-05 TODO sweep added were shown to
// pass and never shown to fail. Each mutation below puts one production line
// back the way it was before that work, or removes the check a test exists
// for, runs the one test file that should catch it, and restores the file.
// Every test file first runs once unmutated and must pass: a file red before
// the mutation would make every red after it meaningless. A mutation its test
// does not catch prints `green` and the script exits 1 — a finding, not a pass.
// usage: node red.cjs <repo root>
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '.');

const MUTATIONS = [
    { area: 'handoff marker', file: 'lib/stages.js', what: 'a close mark names its group again',
        from: "Number.isInteger(mark.group) && mark.kind !== 'close'", to: 'Number.isInteger(mark.group)', test: 'tests/stages.test.js' },
    { area: 'handoff marker', file: 'lib/handoff.js', what: 'liveMarks drops close marks too',
        from: "m.stage !== 'build' || m.kind === 'close' || ", to: "m.stage !== 'build' || ", test: 'tests/handoff.test.js' },
    { area: 'handoff marker', file: 'lib/handoff.js', what: 'liveMarks keeps every mark, as before',
        from: 'return !(at !== null && at > (Number(m.at) || 0));', to: 'return true;', test: 'tests/handoff.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'a record with no --commits lists no sha',
        from: 'o.commits : [o.sha]);', to: 'o.commits : []);', test: 'tests/todo-files.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'a non-sha --commits entry is accepted',
        from: "for (const s of commits) if (!SHA.test(String(s))) throw new Error('--commits entry is not a commit sha: ' + s);", to: '', test: 'tests/todo-files.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'recordOf never finds the record',
        from: "return at === -1 ? '' : text.slice(at + DONE_HEADING.length).trim();", to: "return '';", test: 'tests/todo-files.test.js' },
    { area: 'station panel', file: 'lib/station.js', what: 'the panel shows the whole body, as before',
        from: "body: todoFiles.recordOf(bodyOf.get(e.id) || '') || bodyOf.get(e.id) || ''", to: "body: bodyOf.get(e.id) || ''", test: 'tests/station-todo-files.test.js' },
    { area: 'plain check', file: 'lib/handoff.js', what: 'the gate runs no prose check, as before',
        from: "return require('./plain.js').proseProblem(gate, rules.ids || []);", to: 'return null;', test: 'tests/gate-check.test.js' },
    { area: 'plain check', file: 'scripts/docs-check.js', what: 'docs-check runs no prose check, as before',
        from: ".concat(require('../lib/plain.js').proseFindings(rel, readFile(root, rel), role, (docs.bucketOf(tree, rel) || {}).audience))", to: '', test: 'tests/docs-check.test.js' },
    { area: 'plain check', file: 'lib/plain.js', what: 'the sentence cap moves off 160',
        from: 'const MAX_SENTENCE_WIDTH = 160;', to: 'const MAX_SENTENCE_WIDTH = 1000;', test: 'tests/plain.test.js' },
];

function runTest(test) {
    const res = cp.spawnSync(process.execPath, ['--test', '--test-reporter=spec', test], { cwd: root, encoding: 'utf8', timeout: 300000 });
    const failed = String(res.stdout || '').split('\n').filter((l) => /^\s*✖/.test(l)).map((l) => l.trim());
    return { code: res.status, failed };
}

const git = (args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const out = ['HEAD ' + git(['rev-parse', 'HEAD']), 'porcelain: ' + (git(['status', '--porcelain']) || '(clean)'), ''];
let bad = 0;

for (const test of [...new Set(MUTATIONS.map((m) => m.test))]) {
    const r = runTest(test);
    out.push(['control', test, r.code === 0 ? 'pass' : 'FAIL ' + r.failed.join(' | ')].join('\t'));
    if (r.code !== 0) bad++;
}
if (bad) {
    console.log(out.concat('', 'a test file fails unmutated: no mutation was run').join('\n'));
    process.exit(1);
}
out.push('');

for (const m of MUTATIONS) {
    const file = path.join(root, m.file);
    const original = fs.readFileSync(file, 'utf8');
    const count = original.split(m.from).length - 1;
    if (count !== 1) {
        out.push([m.area, m.file, m.what, m.test, 'SKIPPED: the text to change occurs ' + count + ' times'].join('\t'));
        bad++;
        continue;
    }
    fs.writeFileSync(file, original.replace(m.from, () => m.to));
    let r;
    try {
        r = runTest(m.test);
    } finally {
        fs.writeFileSync(file, original);
    }
    if (fs.readFileSync(file, 'utf8') !== original) {
        console.log(out.concat('restore failed: ' + m.file).join('\n'));
        process.exit(1);
    }
    out.push([m.area, m.file, m.what, m.test, r.code === 0 ? 'green' : 'red', r.failed.join(' | ')].join('\t'));
    if (r.code === 0) bad++;
}

out.push('', 'restored: ' + (git(['status', '--porcelain', '--', ...new Set(MUTATIONS.map((m) => m.file))]) || 'every mutated file matches HEAD'));
console.log(out.join('\n'));
process.exitCode = bad ? 1 : 0;
