#!/usr/bin/env node
'use strict';

// What already exists in this repository, worked out on the spot.
//
// The survey stage used to carry a rule saying "search for something that
// already does this before you build it". That is the kind of instruction that
// gets agreed with and skipped, which is the whole reason components get built
// twice. This produces an artifact instead: run it, and the stage rule requires
// quoting what came back.
//
// Nothing is stored. A written index is a file that disagrees with the code
// three months later, and a stale index is worse than none — it is read with
// confidence. This walks the working tree on every run, so it cannot go out of
// date.
//
// The file list comes from `git ls-files --cached --others --exclude-standard`,
// which is how node_modules, build output and everything else already excluded
// stays excluded without a second ignore list to maintain. Not tracked files
// only: a file written this session and never committed is in the list, because
// a scanner blind to the work in progress is the confident wrong answer this
// plugin exists to prevent. `lib/tracked.js` carries the case that proved it.

const fs = require('node:fs');
const path = require('node:path');

const { trackedFiles, MAX_WALK_FILES, SKIP_EXT } = require('../lib/tracked.js');

// The default, not the law. `--max N` and `--all` move it, because a report that
// silently stops at 25 answers a different question than the one that was asked —
// and on a large repository the tail it cuts is where the answer usually is.
const DEFAULT_MAX = 25;
const MAX_FILE_BYTES = 512 * 1024;

// One pattern per language, capturing the declared name. Deliberately shallow:
// the point is to notice that something with that name exists, not to parse the
// language. A missed declaration costs one line of a report; a parser costs a
// dependency and a maintenance burden.
//
// Adding a language is adding a row. Extension lists must stay disjoint, because
// the first row whose list contains the extension wins.
const JS_PATTERNS = [
    // The alternation, not `\s*\*?\s+`: that form needs whitespace after the
    // star and so misses every plain `function foo`.
    /^\s*(?:export\s+)?(?:async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_$][\w$]*\s*=>)/,
];

const DECLARATIONS = [
    // `.vue` and `.svelte` are here for their script block. The component itself
    // is the file, so the filename section is what actually finds it.
    { ext: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.vue', '.svelte'], patterns: JS_PATTERNS },
    { ext: ['.ps1', '.psm1'], patterns: [/^\s*function\s+([A-Za-z_][\w-]*)/i] },
    { ext: ['.py'], patterns: [
        /^\s*def\s+([A-Za-z_]\w*)/,
        /^\s*class\s+([A-Za-z_]\w*)/,
    ] },
    { ext: ['.sh', '.bash'], patterns: [
        /^\s*(?:function\s+)?([A-Za-z_]\w*)\s*\(\)\s*\{/,
    ] },
    { ext: ['.go'], patterns: [
        // The optional group is the receiver, so methods are found by their own
        // name rather than by the type they hang off.
        /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/,
        /^\s*type\s+([A-Za-z_]\w*)/,
    ] },
    { ext: ['.rs'], patterns: [
        /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/,
        /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|type|union)\s+([A-Za-z_]\w*)/,
    ] },
    { ext: ['.cs', '.java', '.kt', '.swift'], patterns: [
        /^\s*(?:[\w@]+\s+)*?(?:class|interface|enum|record|struct|protocol|object)\s+([A-Za-z_]\w*)/,
        // A visibility keyword is required for methods. Without one this matches
        // every `if (`, `for (` and bare call in the file.
        /^\s*(?:public|private|protected|internal|open|override|fileprivate)\s+[\w<>\[\],.?\s]*?([A-Za-z_]\w*)\s*\(/,
        /^\s*(?:fun|func)\s+([A-Za-z_]\w*)/,
    ] },
    { ext: ['.rb'], patterns: [
        /^\s*def\s+(?:self\.)?([A-Za-z_]\w*[?!]?)/,
        /^\s*(?:class|module)\s+([A-Za-z_]\w*)/,
    ] },
    // Stylesheets earn a row because a duplicated button style is the same
    // failure as a duplicated component, and nothing else here would see it.
    { ext: ['.css', '.scss', '.sass', '.less'], patterns: [
        /^\s*\.([A-Za-z_-][\w-]*)/,
        /^\s*(--[A-Za-z][\w-]*)\s*:/,
        /^\s*@(?:mixin|function)\s+([\w-]+)/,
    ] },
    { ext: ['.md'], patterns: [/^(#{1,3})\s+(.+?)\s*$/] },
];

function declPatterns(file) {
    const ext = path.extname(file).toLowerCase();
    const hit = DECLARATIONS.find((d) => d.ext.includes(ext));
    return hit ? hit.patterns : null;
}

const isDoc = (file) => path.extname(file).toLowerCase() === '.md';

// git reports a nested repository as one entry and never descends into it, in
// either of two forms: a trailing slash when it is untracked, and a bare
// directory name when it is a submodule.
//
// One function because there were two, and they drifted: the scan skipped the
// stat for an entry carrying a declaration extension, the tree never did, and a
// submodule named `vendor.js` came out a file in the header and a repository in
// the tree below it.
//
// Asked only of entries that could be one. Statting all of them ran 3.3x slower
// on a 6,500-file repository, and spent it on the majority the scan never opens:
// an entry carrying a file extension that no declaration pattern claims is a
// file, and the stat only confirms it. What is left is the two shapes a subtree
// actually takes — extensionless, `sub`, or named like something the scan reads,
// `vendor.js` — and those are rare enough to pay for.
//
// The ones that are left are exactly the ones the read loop stats again for
// their size, so it is handed the answer through `sizes` rather than asking
// twice. Without that the survivors put the scan back over the budget on a
// repository that is mostly code.
function isSubtree(root, rel, sizes) {
    if (rel.endsWith('/')) return true;
    if (path.extname(rel) && !declPatterns(rel)) return false;
    let st;
    try {
        st = fs.statSync(path.join(root, rel));
    } catch (e) {
        // A stat that failed is not evidence of a directory — git lists an entry
        // the disk no longer has, and a staged file since deleted is the shipped
        // test's own case.
        return false;
    }
    if (st.isDirectory()) return true;
    if (sizes) sizes.set(rel, st.size);
    return false;
}


// Substring, case-insensitive, against the declared name and the path both. A
// looser match would fill the report with noise, and a report nobody finishes
// reading is a report nobody acts on.
function matches(terms, ...fields) {
    if (!terms.length) return true;
    const hay = fields.join(' ').toLowerCase();
    return terms.some((t) => hay.includes(t));
}

function scan(root, terms) {
    // `null` from `trackedFiles` means nothing readable, and a root whose only
    // subtree could not be listed is nothing readable — every other caller wants
    // that answer and two of them are gates. This one wants to say *why*, so it
    // asks for the count separately and rebuilds the empty result around it.
    const stats = {};
    const tracked = trackedFiles(root, { stats }) || (stats.unlistable
        ? { files: [], repos: [], walked: true, truncated: false, unlistable: stats.unlistable, skippedExt: 0 }
        : null);
    if (tracked === null) return null;
    const { files: entries, repos, walked, truncated, unlistable, skippedExt } = tracked;

    // A nested repository has no extension, so it used to fall through to
    // `noPattern` — an entire unread repository counted as one file of an
    // unknown type, which is the exact understatement these counters were added
    // to remove.
    //
    // Split here rather than in the loop so the header, the name matches and the
    // read loop all agree on what is a file.
    const nested = [];
    const files = [];
    const sizes = new Map();
    for (const entry of entries) {
        if (isSubtree(root, entry, sizes)) nested.push(entry);
        else files.push(entry);
    }

    const decls = [];
    const docs = [];
    const named = files.filter((f) => terms.length && matches(terms, f));

    // Six ways the tree is never opened, every one of them silent until now. A
    // scan that skipped half the tree and a scan that genuinely found nothing
    // read the same, and the stage rule can only key on what the report says.
    //
    // `nested` and `unlistable` are subtrees rather than files, so they are
    // counted apart from the per-file kinds: a `sub/` entry inside `noPattern`
    // reported an unread repository as one file with an unknown extension.
    //
    // Two of them hold paths rather than a number, and it is the same two the
    // stage rule dispatches a reader over: a file with no pattern can be opened
    // by hand, and a nested repository can be surveyed on its own root. The
    // other four name nothing a reader could act on, so they stay counts.
    const skipped = {
        unreadable: 0,
        oversize: 0,
        noPattern: [],
        skipExt: skippedExt || 0,
        nested,
        unlistable: unlistable || 0,
    };

    for (const file of files) {
        const patterns = declPatterns(file);
        if (!patterns) { skipped.noPattern.push(file); continue; }
        const full = path.join(root, file);
        let text;
        try {
            // The split already stat'd every entry that reaches here, so the
            // size is asked for rather than taken again.
            const size = sizes.has(file) ? sizes.get(file) : fs.statSync(full).size;
            if (size > MAX_FILE_BYTES) { skipped.oversize++; continue; }
            text = fs.readFileSync(full, 'utf8');
        } catch (e) {
            skipped.unreadable++;
            continue;
        }
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            for (const re of patterns) {
                const m = re.exec(lines[i]);
                if (!m) continue;
                if (isDoc(file)) {
                    const heading = m[2];
                    if (matches(terms, heading, file)) {
                        docs.push({ file, line: i + 1, text: m[1] + ' ' + heading });
                    }
                } else if (matches(terms, m[1], file)) {
                    decls.push({
                        file,
                        line: i + 1,
                        text: lines[i].trim().slice(0, 100),
                        // Whether the declared name carries the term, or only the
                        // path it lives in. Both are worth reporting and only one
                        // is the answer to the question that was asked.
                        named: matches(terms, m[1]),
                    });
                }
                break;
            }
        }
    }

    // Name matches first. Everything in a file whose path matches still gets
    // listed — seeing what else lives in `share.py` is how a duplicate
    // implementation turns up — but path order alone put boilerplate above the
    // answer. Measured on a real repository searching for "share": 204
    // declarations, 62 of them matching on path only, and six `def upgrade():`
    // from migration files holding places in the first 25 while real API
    // functions sat below the cap.
    //
    // This does not fix the cap itself. 142 named matches still do not fit in
    // 25, and test functions rank alongside the implementation they test.
    //
    // Sort is stable, so file order survives inside each group.
    decls.sort((a, b) => (b.named ? 1 : 0) - (a.named ? 1 : 0));

    // `total` is the file count, not the entry count: a nested repository is a
    // subtree, it is reported as one on the `skipped:` line, and counting it
    // here as well would have the header disagree with the split below it.
    // `files` stays the whole list because the tree section prints the subtrees
    // as their own rows.
    //
    // `nested` is not returned on its own. It was, read by nothing, while
    // `report` used `skipped.nested` and `treeLines` worked it out again — which
    // is where the two answers to "is this a subtree" came from.
    return { total: files.length, files: entries, repos, walked, truncated, decls, docs, named, skipped };
}

// `slice(0, Infinity)` is the whole array and `length > Infinity` is false, so
// `--all` needs no special case here.
function section(title, rows, render, max) {
    if (!rows.length) return [];
    const out = [title];
    for (const row of rows.slice(0, max)) out.push('  ' + render(row));
    if (rows.length > max) {
        out.push('  ... and ' + (rows.length - max) + ' more, not listed');
    }
    out.push('');
    return out;
}

const human = (n) => (n < 1024 ? n + 'B'
    : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'K'
    : (n / (1024 * 1024)).toFixed(1) + 'M');

// The shape of the tree rather than what is declared in it — for the case the
// scanner cannot serve, which is a project big enough that no set of search terms
// tells you where anything lives.
//
// One line per directory carrying its full path, then its files under it.
// Indenting by depth was the alternative and it drops rungs: a directory holding
// no files of its own has no line for its children to hang under, so the level
// vanishes and the reader is never told.
//
// This is the one section costing a stat per file, and it runs only when asked.
function treeLines(root, files, max) {
    const dirs = new Map();
    // A nested repository is a fact about the tree worth printing, and splitting
    // a trailing slash on the last slash would otherwise produce a file with no
    // name. Same test as the scan's, so the header and the tree cannot disagree
    // about which entries are files.
    const opaque = [];
    let total = 0;
    for (const rel of files) {
        if (isSubtree(root, rel)) { opaque.push(rel); continue; }
        const cut = rel.lastIndexOf('/');
        const dir = cut === -1 ? '.' : rel.slice(0, cut);
        let size = 0;
        try {
            size = fs.statSync(path.join(root, rel)).size;
        } catch (e) {
            size = 0;
        }
        total += size;
        if (!dirs.has(dir)) dirs.set(dir, []);
        dirs.get(dir).push({ name: rel.slice(cut + 1), size });
    }

    const count = (n) => n + (n === 1 ? ' file' : ' files');
    const out = ['tree — ' + count(files.length - opaque.length) + ', ' + human(total), ''];
    for (const dir of [...dirs.keys()].sort()) {
        const list = dirs.get(dir);
        const bytes = list.reduce((sum, f) => sum + f.size, 0);
        out.push('  ' + (dir === '.' ? './' : dir + '/') + '   ' + count(list.length) + '  ' + human(bytes));
        for (const f of list.slice(0, max)) out.push('    ' + f.name + '  ' + human(f.size));
        if (list.length > max) out.push('    ... and ' + (list.length - max) + ' more, not listed');
    }
    for (const rel of opaque.sort()) out.push('  ' + rel + '   a repository of its own, not descended into');
    out.push('');
    return out;
}

function report(result, terms, opts) {
    const max = (opts && opts.max) || DEFAULT_MAX;
    if (result === null) {
        return 'fankeel survey: nothing readable under that root — no repository, and no files.\n'
             + 'Search by hand and say what you searched for.';
    }
    const { total, repos, walked, truncated, decls, docs, named, skipped } = result;
    const head = terms.length
        ? 'fankeel survey — ' + total + ' files, matching: ' + terms.join(', ')
        : 'fankeel survey — ' + total + ' files, everything declared';

    // Where the list came from, always. Two sources cover different things —
    // git knows the project's own ignore rules, a walk only knows a fixed list —
    // and a report that hides which one it used invites its coverage to be
    // trusted further than it should be.
    const source = [];
    if (!walked) source.push('git');
    else {
        if (repos.length) source.push('git in ' + repos.join(', '));
        source.push('a directory walk elsewhere (dot-directories, dependencies and build output skipped)');
    }
    const note = ['source: ' + source.join('; ')];
    if (max !== DEFAULT_MAX) note.push('cap: ' + (max === Infinity ? 'none' : max + ' per section'));
    if (truncated) {
        note.push('the walk stopped at ' + MAX_WALK_FILES + ' files — narrow it with --root before trusting this.');
    }
    // What was in the tree and never opened. The header counts the files that
    // reached the scan, which is neither the tree nor the coverage: three of
    // these kinds are inside it and three never entered it. The gap used to be
    // invisible either way.
    //
    // Comma-joined, so no member may contain a comma of its own: one that does
    // stops the line reading as a list and turns a single count into what looks
    // like two.
    const skips = [];
    if (skipped) {
        if (skipped.unreadable) skips.push(skipped.unreadable + ' unreadable');
        if (skipped.oversize) skips.push(skipped.oversize + ' over the size cap');
        if (skipped.noPattern.length) skips.push(skipped.noPattern.length + ' with no pattern for their extension');
        // Walk mode only — inside a repository a `.png` in the tree is there on
        // purpose. The count matters because it is large: eleven thousand on the
        // first real run, against a `source:` note that named only directories.
        if (skipped.skipExt) skips.push(skipped.skipExt + (skipped.skipExt === 1 ? ' document or binary' : ' documents and binaries') + ' dropped by extension');
        // Whole subtrees. Said as subtrees, because a count of one here is not a
        // file and reading it as one understates the gap by however much is
        // under it.
        if (skipped.nested.length) skips.push(skipped.nested.length + (skipped.nested.length === 1 ? ' nested repository' : ' nested repositories') + ' not descended into');
        if (skipped.unlistable) skips.push(skipped.unlistable + (skipped.unlistable === 1 ? ' directory' : ' directories') + ' that could not be listed');
    }
    if (skips.length) note.push('skipped: ' + skips.join(', '));

    // The split is said out loud rather than left for the reader to infer from
    // the ordering. A section that silently mixes two kinds of match is a
    // section whose tail gets read as though it answered the question.
    const namedCount = decls.filter((d) => d.named).length;
    const declTitle = namedCount && namedCount < decls.length
        ? 'declarations:  (' + namedCount + ' by name, then ' + (decls.length - namedCount) + ' more in files that match)'
        : 'declarations:';

    const lines = [head, ...note, ''];
    lines.push(...section('files whose name matches:', named, (f) => f, max));
    lines.push(...section(declTitle, decls, (d) => d.file + ':' + d.line + '  ' + d.text, max));
    lines.push(...section('documentation:', docs, (d) => d.file + ':' + d.line + '  ' + d.text, max));

    // The half of the `skipped:` line something can be done about, named. The
    // stage rule sends one reader at these with the list, and a list is what a
    // count is not — `4 with no pattern for their extension` says nothing about
    // which four. Capped like every other section, so an over-cap skip list is
    // itself visible rather than being the second silent loss.
    //
    // Binaries come off it. Inside a repository nothing drops a tracked `.png`,
    // so `assets/logo.png` reached `noPattern` and got listed here — under a
    // title whose whole job is the split between what a reader can act on and
    // what it cannot. It stays in the count on the `skipped:` line; it is only
    // not an instruction.
    if (skipped) {
        lines.push(...section('skipped, and openable by hand:', [
            ...skipped.noPattern.filter((f) => !SKIP_EXT.has(path.extname(f).toLowerCase())),
            ...skipped.nested.map((d) => d + '  (a repository of its own)'),
        ], (f) => f, max));
    }

    if (opts && opts.tree && opts.root) lines.push(...treeLines(opts.root, result.files, max));

    if (!named.length && !decls.length && !docs.length) {
        lines.push(terms.length
            ? 'Nothing matched. Either it does not exist yet, or it is called something else —'
            : 'Nothing declared that this can see.');
        if (terms.length) lines.push('try a synonym before concluding it is new.');
    } else {
        lines.push('Quote the lines you checked. "Nothing matched" is a finding too, and');
        lines.push('says which terms were tried.');
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// --root takes a value, so the value has to be consumed with the flag. Filtering
// on the leading dashes alone left the path itself in the term list, where it
// showed up in the report header and could match against a file path.
function parseArgs(argv) {
    let root = process.cwd();
    let max = DEFAULT_MAX;
    let tree = false;
    const terms = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            if (argv[i + 1]) root = argv[++i];
            continue;
        }
        // A value that is not a positive number leaves the default in place rather
        // than erroring, and is still consumed so it cannot become a search term.
        // The note block names the cap only when it differs from the default, so a
        // mistyped value reads as an ordinary run rather than as an error — the
        // trade for never failing a scan over an argument.
        if (argv[i] === '--max') {
            const n = parseInt(argv[i + 1], 10);
            if (argv[i + 1] !== undefined) i++;
            if (Number.isFinite(n) && n > 0) max = n;
            continue;
        }
        if (argv[i] === '--all') { max = Infinity; continue; }
        if (argv[i] === '--tree') { tree = true; continue; }
        if (argv[i].startsWith('--')) continue;
        const term = String(argv[i]).toLowerCase().trim();
        if (term && !terms.includes(term)) terms.push(term);
    }
    return { root, terms, max, tree };
}

function main(argv) {
    const { root, terms, max, tree } = parseArgs(argv);
    return report(scan(root, terms), terms, { max, tree, root });
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { scan, report, parseArgs, trackedFiles, isSubtree, treeLines };
