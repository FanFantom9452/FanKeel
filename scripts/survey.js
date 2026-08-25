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
// Tracked files only, via `git ls-files`, which is how node_modules, build
// output and everything else already excluded stays excluded without a second
// ignore list to maintain.

const fs = require('node:fs');
const path = require('node:path');

const { trackedFiles, MAX_WALK_FILES } = require('../lib/tracked.js');

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


// Substring, case-insensitive, against the declared name and the path both. A
// looser match would fill the report with noise, and a report nobody finishes
// reading is a report nobody acts on.
function matches(terms, ...fields) {
    if (!terms.length) return true;
    const hay = fields.join(' ').toLowerCase();
    return terms.some((t) => hay.includes(t));
}

function scan(root, terms) {
    const tracked = trackedFiles(root);
    if (tracked === null) return null;
    const { files, repos, walked, truncated } = tracked;

    const decls = [];
    const docs = [];
    const named = files.filter((f) => terms.length && matches(terms, f));

    for (const file of files) {
        const patterns = declPatterns(file);
        if (!patterns) continue;
        const full = path.join(root, file);
        let text;
        try {
            if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
            text = fs.readFileSync(full, 'utf8');
        } catch (e) {
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

    return { total: files.length, files, repos, walked, truncated, decls, docs, named };
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
    // git reports a nested repository as one entry with a trailing slash and
    // never descends into it. That is a fact about the tree worth printing, and
    // splitting it on the last slash would otherwise produce a file with no name.
    const opaque = [];
    let total = 0;
    for (const rel of files) {
        if (rel.endsWith('/')) { opaque.push(rel); continue; }
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
    const { total, repos, walked, truncated, decls, docs, named } = result;
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
        // The header line says which cap was used, so a typo shows up in the
        // report instead of in a stack trace.
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

module.exports = { scan, report, main, parseArgs, declPatterns, matches, trackedFiles, treeLines, human };
