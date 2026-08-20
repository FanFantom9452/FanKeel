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

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_PER_SECTION = 25;
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

function gitFiles(dir) {
    try {
        return execFileSync('git', ['ls-files', '-z'], {
            cwd: dir,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            // Asking a directory that is not a repository is a normal step here,
            // not an error, and git says so on stderr. Inheriting that puts
            // `fatal: not a git repository` at the top of a report that then
            // goes on to work perfectly — and it gets quoted as if it meant
            // something.
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\0')
            .filter(Boolean);
    } catch (e) {
        return null;
    }
}

// One level down, sorted, so two runs read the same repositories in the same
// order. Deeper is guesswork: a directory three levels below the root is not
// what anybody means by "this project".
function childRepos(root) {
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort()
        .filter((name) => fs.existsSync(path.join(root, name, '.git')));
}

// Every tracked file under the root, and which repositories they came from.
//
// A root that is not itself a repository but holds several is a normal way to
// keep related projects together, and it is exactly the root a cross-project
// task gets opened at — the collision warnings and the scope guard only reach
// across two repositories when the session sits at their common parent. Giving
// up there would take the scanner away from the one case that needs it most, so
// the children are read instead and their paths are prefixed.
function trackedFiles(root) {
    const direct = gitFiles(root);
    if (direct) return { files: direct, repos: null };

    const repos = childRepos(root);
    if (!repos.length) return null;

    const files = [];
    const read = [];
    for (const repo of repos) {
        const list = gitFiles(path.join(root, repo));
        if (!list) continue;
        read.push(repo);
        for (const f of list) files.push(repo + '/' + f);
    }
    return read.length ? { files, repos: read } : null;
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
    const tracked = trackedFiles(root);
    if (tracked === null) return null;
    const { files, repos } = tracked;

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

    return { total: files.length, repos, decls, docs, named };
}

function section(title, rows, render) {
    if (!rows.length) return [];
    const out = [title];
    for (const row of rows.slice(0, MAX_PER_SECTION)) out.push('  ' + render(row));
    if (rows.length > MAX_PER_SECTION) {
        out.push('  ... and ' + (rows.length - MAX_PER_SECTION) + ' more, not listed');
    }
    out.push('');
    return out;
}

function report(result, terms) {
    if (result === null) {
        return 'fankeel survey: not a git repository, and no repositories directly inside it.\n'
             + 'Search by hand and say what you searched for.';
    }
    const { total, repos, decls, docs, named } = result;
    const where = repos
        ? total + ' tracked files across ' + repos.length + ' repositories (' + repos.join(', ') + ')'
        : total + ' tracked files';
    const head = terms.length
        ? 'fankeel survey — ' + where + ', matching: ' + terms.join(', ')
        : 'fankeel survey — ' + where + ', everything declared';

    // The split is said out loud rather than left for the reader to infer from
    // the ordering. A section that silently mixes two kinds of match is a
    // section whose tail gets read as though it answered the question.
    const namedCount = decls.filter((d) => d.named).length;
    const declTitle = namedCount && namedCount < decls.length
        ? 'declarations:  (' + namedCount + ' by name, then ' + (decls.length - namedCount) + ' more in files that match)'
        : 'declarations:';

    const lines = [head, ''];
    lines.push(...section('files whose name matches:', named, (f) => f));
    lines.push(...section(declTitle, decls, (d) => d.file + ':' + d.line + '  ' + d.text));
    lines.push(...section('documentation:', docs, (d) => d.file + ':' + d.line + '  ' + d.text));

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
    const terms = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            if (argv[i + 1]) root = argv[++i];
            continue;
        }
        if (argv[i].startsWith('--')) continue;
        const term = String(argv[i]).toLowerCase().trim();
        if (term && !terms.includes(term)) terms.push(term);
    }
    return { root, terms };
}

function main(argv) {
    const { root, terms } = parseArgs(argv);
    return report(scan(root, terms), terms);
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { scan, report, main, parseArgs, declPatterns, matches };
