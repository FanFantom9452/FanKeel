// What does the landed predicate actually see for each plan?
// Calls docs-audit's own pointsAt the way sweep() does (docs-audit.js:427,436),
// rather than re-deriving what a plan "names".
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.resolve(__dirname, '../../../..');
const docs = require(path.join(root, 'lib/docs.js'));
const audit = require(path.join(root, 'scripts/docs-audit.js'));

const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
const roots = new Set(files.map((f) => f.split('/')[0]));

// The subject, plus two controls: the plans the sweep reports as landed today.
const subjects = [
    'docs/plans/2026-09-09-design-class-prompt.md',
    'docs/plans/2026-09-09-gate-and-controls.md',
    'docs/plans/2026-09-09-gate-and-controls-design.md',
];

for (const rel of subjects) {
    const text = fs.readFileSync(root + '/' + rel, 'utf8');
    const contract = docs.contractOf(text);
    const p = audit.pointsAt(root, rel, roots, contract);
    const onDisk = (q) => fs.existsSync(root + '/' + q);
    console.log('=== ' + rel);
    console.log('  status      : ' + contract.status + '   kind: ' + contract.kind);
    console.log('  role        : ' + docs.roleOf(docs.read(root).tree, rel));
    console.log('  code named  : ' + p.code.length);
    console.log('  unbuilt     : ' + p.unbuilt.length);
    for (const q of p.unbuilt) console.log('      unbuilt: ' + q + '   exists-now=' + onDisk(q));
    const missing = p.code.filter((q) => !onDisk(q));
    console.log('  named-but-absent-on-disk: ' + missing.length);
    for (const q of missing) console.log('      absent: ' + q);
    console.log('  => would the landed predicate be satisfiable? '
        + (p.code.length > 0 && p.unbuilt.length === 0 ? 'YES (names files, none unbuilt)' : 'no'));
    console.log('');
}
