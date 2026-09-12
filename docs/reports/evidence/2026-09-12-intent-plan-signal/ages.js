// Does a plan point at files that PREDATE it, or files changed AFTER it?
// A plan naming files as reading points backwards; a plan whose work landed
// points forwards. Uses docs-audit's own pointsAt for what a plan "names".
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../../../..');
const docs = require(path.join(root, 'lib/docs.js'));
const audit = require(path.join(root, 'scripts/docs-audit.js'));

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const files = git(['ls-files']).split('\n').map((s) => s.trim()).filter(Boolean);
const roots = new Set(files.map((f) => f.split('/')[0]));

// The second-newest commit on a path: the newest is the rename into archive,
// which is the trap docs/reports/2026-09-07-audit-constants.md:31-35 names.
const lastTouch = (rel) => {
    const out = git(['log', '--format=%ad', '--date=short', '--', rel]);
    return out ? out.split('\n')[0] : null;
};
const filedAt = (rel) => {
    const out = git(['log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', rel]);
    const rows = out ? out.split('\n') : [];
    return rows.length ? rows[rows.length - 1] : null;
};

const subjects = [
    'docs/plans/2026-09-09-design-class-prompt.md',
    'docs/plans/2026-09-09-gate-and-controls.md',
    'docs/plans/2026-09-09-gate-and-controls-design.md',
];

for (const rel of subjects) {
    const text = fs.readFileSync(root + '/' + rel, 'utf8');
    const contract = docs.contractOf(text);
    const p = audit.pointsAt(root, rel, roots, contract);
    const filed = filedAt(rel);
    console.log('=== ' + rel);
    console.log('  status ' + contract.status + '   filed ' + filed + '   names ' + p.code.length + ' files');
    let after = 0, before = 0;
    for (const q of p.code) {
        const t = lastTouch(q);
        const sign = t && filed ? (t > filed ? 'AFTER ' : t === filed ? 'same  ' : 'before') : '?     ';
        if (sign === 'AFTER ') after++;
        if (sign === 'before') before++;
        console.log('    ' + sign + '  ' + q + '   last ' + t);
    }
    console.log('  => after=' + after + '  before=' + before + '  same=' + (p.code.length - after - before));
    console.log('');
}
