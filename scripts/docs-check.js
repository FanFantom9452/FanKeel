#!/usr/bin/env node
'use strict';

// What the documents claim, checked against what is there.
//
//   node docs-check.js [--root <dir>] [--role reference,plan] [--quiet]
//
// This reports only what can be decided mechanically: a path that no longer
// exists, a `file:line` past the end of the file, a `file:line` whose page
// quoted what it meant to point at and no longer finds it there, a symbol
// nothing declares, a link to a document that has gone. Whether two documents
// contradict each other, or whether a page is merely out of date in its prose,
// is not mechanical, and a script that guessed at it would produce findings
// nobody could act on. That judgement belongs to the `audit` stage; this gives
// it the facts to start from.
//
// The role a document holds decides what is checked, which is the whole reason
// the tree is declared. An archive that names deleted code is an archive doing
// its job. A reference page that does the same is the bug this exists to find,
// and it arrives unread if the two are reported alike.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const docs = require('../lib/docs.js');
const { section } = require('../lib/report.js');
const { trackedFiles } = require('../lib/tracked.js');
const { resolveRoot } = require('../lib/registry.js');

const MAX_FINDINGS = 200;

// A markdown link or an inline-code span is where a document names something in
// the repository. Prose that merely mentions a filename is deliberately not
// matched: `see the registry` is not a claim that can go stale, and treating it
// as one is how a checker starts crying wolf.
const LINK = /\[[^\]]*\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g;
const CODE = /`([^`\n]{2,120})`/g;

// A link inside a fenced code block is a quotation, not a reference. A plan
// shows the code it is asking for, and a test fixture in that code can carry a
// markdown link on purpose — read as a claim, a plan describing a link test
// fails the very check it is planning.
//
// The lines are blanked rather than removed, because every finding here is
// reported as `path:line` and dropping lines would move every number after the
// block. Only links are read from the blanked copy: a `path:line` or a symbol
// named inside a block is still a claim the document is making.
// `openedAt` is the line of a fence nobody closed, or 0. CommonMark runs such a
// block to the end of the document, so blanking it is correct — and it would
// then swallow every link below it without saying so, which is the one failure
// this scanner must never have. The caller reports it.
function withoutFences(text) {
    const out = [];
    let fence = null;
    let openedAt = 0;
    const lines = String(text).split('\n');
    for (let i = 0; i < lines.length; i++) {
        const open = /^\s*(```+|~~~+)/.exec(lines[i]);
        if (fence === null) {
            if (open) {
                fence = open[1];
                openedAt = i + 1;
            }
            out.push(open ? '' : lines[i]);
            continue;
        }
        // Closed by a run of the same character at least as long as the opener,
        // which is the CommonMark rule and the reason the opener is kept whole
        // rather than counted.
        if (open && open[1][0] === fence[0] && open[1].length >= fence.length) {
            fence = null;
            openedAt = 0;
        }
        out.push('');
    }
    return { text: out.join('\n'), openedAt };
}

// Inside a code span, the things that are checkable claims about *this*
// repository. A separator is required and the first segment has to be something
// this tree actually has.
//
// Both conditions were learned by running it. A bare `settings.json` or
// `CLAUDE.md` in prose is naming a kind of file, not pointing at one, and
// `Waypoint/web/src` in an example is describing somebody else's tree. Reported
// as broken references they were nine findings out of ten, and a report that is
// nine parts noise gets read once.
const PATHISH = /^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+))?$/;

// A declaration this repository makes somewhere. Deliberately shallow, the same
// bargain survey.js makes: the goal is to notice a name exists, not to parse
// six languages.
const DECL = [
    /(?:^|\s)(?:export\s+)?(?:async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_$][\w$]*)/g,
    /(?:^|\s)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:^|\s)(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\s)def\s+([A-Za-z_][\w]*)/g,
    /(?:^|\s)(?:type|interface|struct|enum)\s+([A-Za-z_][\w]*)/g,
    /(?:^|\s)function\s+([A-Za-z-][\w-]*)\s*\{/g,     // PowerShell
];

const CODE_EXT = new Set([
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.py', '.sh', '.ps1',
    '.go', '.rs', '.rb', '.java', '.cs', '.vue', '.svelte', '.php', '.kt', '.swift',
]);

const isMarkdown = (p) => p.toLowerCase().endsWith('.md');

function readFile(root, rel) {
    try {
        return fs.readFileSync(path.join(root, rel.split('/').join(path.sep)), 'utf8');
    } catch (e) {
        return null;
    }
}

// Every symbol the repository declares, gathered once. A per-document search
// would re-read the tree for each page, and the answer is the same every time.
function declaredSymbols(root, files) {
    const names = new Set();
    for (const rel of files) {
        if (!CODE_EXT.has(path.extname(rel).toLowerCase())) continue;
        const text = readFile(root, rel);
        if (text === null) continue;
        for (const re of DECL) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) names.add(m[1]);
        }
    }
    return names;
}

const LINES = new Map();
function linesOf(root, rel) {
    const key = root + '\0' + rel;
    if (!LINES.has(key)) {
        const text = readFile(root, rel);
        // A file ending in a newline splits into a trailing empty element that
        // is not a line. Counting it let a reference to the line after the last
        // one pass, and made every "ends at N" one too many.
        const l = text === null ? null : text.split('\n');
        if (l !== null && l.length && l[l.length - 1] === '') l.pop();
        LINES.set(key, l);
    }
    return LINES.get(key);
}

function lineCount(root, rel) {
    const l = linesOf(root, rel);
    return l === null ? null : l.length;
}

// Resolve a reference the way a reader would: relative to the document it is
// written in, then from the repository root. Both, because both conventions are
// in use and guessing wrong turns a working link into a finding.
function resolveRef(root, fromRel, ref) {
    const base = path.posix.dirname(fromRel.replace(/\\/g, '/'));
    const candidates = [];
    if (ref.startsWith('/')) candidates.push(ref.slice(1));
    else {
        candidates.push(path.posix.normalize(path.posix.join(base, ref)));
        candidates.push(path.posix.normalize(ref));
    }
    for (const c of candidates) {
        if (c.startsWith('..')) continue;
        try {
            if (fs.existsSync(path.join(root, c.split('/').join(path.sep)))) return c;
        } catch (e) { /* unreadable is not found */ }
    }
    return null;
}

const external = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('#');

// The page recorded what it meant to point at, right beside the citation. A
// nearby symbol is a proxy for intent; this is the author's own note, on disk,
// which is the thing `docs/decisions/fankeel-shell.md:424` said nothing records.
// A second path is not a quote — `lib/a.js:10` beside `lib/b.js` is two
// citations, not one citation and its evidence.
function quoteBeside(text, from) {
    const eol = text.indexOf('\n', from);
    const rest = text.slice(from, eol === -1 ? undefined : eol);
    const span = /`([^`\n]{2,120})`/.exec(rest);
    if (!span) return null;
    return PATHISH.test(span[1].trim()) ? null : span[1];
}

const flat = (s) => s.replace(/\s+/g, ' ').trim();

// One document's claims. `role` decides which of them are worth making.
function checkDoc(root, rel, role, symbols, roots) {
    const text = readFile(root, rel);
    if (text === null) return [];
    const out = [];
    const lines = text.split('\n');

    // Archive is checked for one thing only, and not here: that nothing current
    // points *at* it. What it points at itself is history.
    if (role === 'archive' || role === 'report') return out;

    const lineOf = (index) => text.slice(0, index).split('\n').length;

    // Same line count, different offsets — so links are numbered against the
    // copy they were found in.
    const fenced = withoutFences(text);
    const linkText = fenced.text;
    const linkLineOf = (index) => linkText.slice(0, index).split('\n').length;

    // Everything below an unclosed fence is blanked, so saying nothing here would
    // turn a check that found nothing into a check that looked at nothing — the
    // exact shape this scanner exists to catch everywhere else.
    if (fenced.openedAt) {
        out.push({
            file: rel, line: fenced.openedAt, tag: 'open-fence',
            what: 'a code fence is never closed, so no link below this line was checked',
        });
    }

    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(linkText)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        if (resolveRef(root, rel, ref) === null) {
            out.push({ file: rel, line: linkLineOf(m.index), tag: 'gone', what: 'links to ' + ref });
        }
    }

    CODE.lastIndex = 0;
    while ((m = CODE.exec(text)) !== null) {
        const span = m[1].trim();
        // A trailing slash makes it a shape, not a file. `.fankeel/sessions/`
        // is a directory this software creates in someone else's workspace at
        // run time, and `docs/archive/` is a convention a project may not have
        // filled yet. Neither is a claim that the path is here, and this
        // repository's own SKILL.md was the first thing reported for it — the
        // checker's own author writing the sentence the checker misreads.
        if (span.endsWith('/')) continue;
        const hit = PATHISH.exec(span);
        if (!hit) continue;
        const ref = hit[1];
        // The trailing slash above covers `.fankeel/sessions/` and misses
        // `.fankeel/map.md`, which is generated and git-ignored. Six of this
        // repository's own documents named it, and every one was reported the
        // moment it was cloned somewhere the file had never been generated.
        // A check that passes only in the working tree it was written in is a
        // check nobody can trust anywhere else, so the whole state directory is
        // runtime: naming a path in it says where the software writes, not that
        // the path is here.
        if (ref === docs.STATE_DIR || ref.startsWith(docs.STATE_DIR + '/')) continue;
        const wanted = hit[2] ? parseInt(hit[2], 10) : null;
        const found = resolveRef(root, rel, ref);
        if (found === null) {
            // Only when the first segment is something this repository has. A
            // path rooted somewhere that does not exist here is an example, and
            // an example is not a claim.
            //
            // Never for a plan or a decision, and for opposite reasons that
            // land in the same place. A plan names files that do not exist yet;
            // a decision names files that existed when it was written. Neither
            // is a broken reference, and both were reported as one on the first
            // real run — a month-old plan for `shared/repositories.py` that was
            // never built, and this repository's own decision record for naming
            // a `.fankeel/memory/` that was considered and rejected.
            //
            // Never for a fixture either: it is a test's own input, and a path
            // it names may exist only inside the scaffold its own test builds —
            // `evals/one-call-not-agent/prompt.md` naming `lib/thing.js`, which
            // this tree never has, is exactly that.
            //
            // Links are still checked in all three. A document nobody can
            // navigate is broken whatever its role; what it says about code is
            // history, or somebody else's tree.
            if (role !== 'plan' && role !== 'decision' && role !== 'fixture' && roots.has(ref.split('/')[0])) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'gone', what: 'names ' + ref });
            }
            continue;
        }
        if (wanted !== null) {
            const n = lineCount(root, found);
            if (n !== null && wanted > n) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'past-end', what: found + ':' + wanted + ' but the file ends at ' + n });
            } else if (role === 'reference') {
                // Reference only. A plan cites lines it is about to change, and
                // a decision cites the lines that existed the day it was
                // written; both are the role working, exactly as with `gone`.
                const quote = quoteBeside(text, m.index + m[0].length);
                const target = linesOf(root, found);
                if (quote === null) {
                    out.push({ file: rel, line: lineOf(m.index), tag: 'unquoted', what: found + ':' + wanted + ' carries no quote, so nothing checks the line' });
                } else if (target && !flat(target[wanted - 1] || '').includes(flat(quote))) {
                    const at = [];
                    for (let i = 0; i < target.length; i++) {
                        if (flat(target[i]).includes(flat(quote))) at.push(i + 1);
                    }
                    // One hit is where it went. Two is ambiguous and stays
                    // ambiguous — reporting a guessed line is the thing the
                    // 09-05 decision was right about.
                    out.push({ file: rel, line: lineOf(m.index), tag: 'moved',
                        what: found + ':' + wanted + ' does not hold `' + quote + '`'
                            + (at.length === 1 ? ' — it is at :' + at[0] : '') });
                }
            }
        }
    }

    // Symbols are checked in reference documents only. A decision record naming
    // a function that was later renamed is not wrong — it is a record of the day
    // it was written, and rewriting it to match would destroy the only thing it
    // was for.
    if (role === 'reference') {
        CODE.lastIndex = 0;
        while ((m = CODE.exec(text)) !== null) {
            const span = m[1].trim();
            const call = /^([A-Za-z_$][\w$]{2,})\(\)$/.exec(span);
            if (!call) continue;
            if (!symbols.has(call[1])) {
                out.push({ file: rel, line: lineOf(m.index), tag: 'orphan', what: call[1] + '() is not declared anywhere' });
            }
        }
    }

    void lines;
    return out;
}

function scan(root, roles) {
    const result = trackedFiles(root);
    if (!result) return null;

    const { tree, error } = docs.read(root);
    const files = result.files;
    const roots = new Set(files.map((f) => f.split('/')[0]));
    const markdown = files.filter(isMarkdown);
    const symbols = declaredSymbols(root, files);

    // Where documentation is expected to live, so "filed nowhere" can mean
    // something. A README beside code is not misfiled; a page under docs/ that
    // no bucket claims is.
    const docRoot = (tree ? tree.index : 'docs/README.md').split('/')[0];

    const findings = [];
    const counts = {};
    const unfiled = [];
    const archived = new Set(
        tree ? markdown.filter((f) => docs.roleOf(tree, f) === 'archive') : [],
    );

    for (const rel of markdown) {
        const declared = docs.roleOf(tree, rel);
        // Guessing `reference` is the loudest default, not a safe one: a project
        // keeping plans outside `docs/` on purpose gets every one of them graded
        // as a claim about the present. So it is the fallback only where there is
        // no tree at all — that project wants the checks more than the precision.
        // docs/documents.md, *Filing, and what happens when you do not*, has it.
        const role = declared || (tree ? null : 'reference');
        if (!declared && rel.split('/')[0] === docRoot) unfiled.push(rel);
        if (!role) continue;
        counts[role] = (counts[role] || 0) + 1;
        for (const f of checkDoc(root, rel, role, symbols, roots)) findings.push(Object.assign({ role }, f));
    }

    // The one thing an archive is checked for, and it is checked from the other
    // side: a current document pointing into the archive is quietly telling its
    // reader that retired material is current.
    if (archived.size) {
        for (const rel of markdown) {
            const role = docs.roleOf(tree, rel);
            if (role !== 'reference') continue;
            const text = readFile(root, rel);
            if (text === null) continue;
            const linkText = withoutFences(text).text;
            LINK.lastIndex = 0;
            let m;
            while ((m = LINK.exec(linkText)) !== null) {
                if (external(m[1])) continue;
                const target = resolveRef(root, rel, m[1]);
                if (target && archived.has(target)) {
                    findings.push({
                        role, file: rel, line: linkText.slice(0, m.index).split('\n').length,
                        tag: 'into-archive', what: 'points at retired ' + target,
                    });
                }
            }
        }
    }

    const unquoted = findings.filter((f) => f.tag === 'unquoted')
        .map((f) => f.file + ':' + f.line + '  ' + f.what);
    const failing = findings.filter((f) => f.tag !== 'unquoted');

    const wanted = roles && roles.length ? roles : null;
    const kept = wanted ? failing.filter((f) => wanted.includes(f.role)) : failing;

    return {
        tree, error, counts, unfiled,
        markdown: markdown.length,
        findings: kept,
        unquoted,
    };
}

const ORDER = ['open-fence', 'gone', 'past-end', 'moved', 'orphan', 'into-archive'];

function report(result) {
    if (!result) return 'fankeel docs-check: nothing readable under this directory.';

    const lines = [];
    const shape = result.tree ? result.tree.preset : 'none declared';
    lines.push('fankeel docs-check — ' + result.markdown + ' markdown files, tree: ' + shape);
    if (result.error) lines.push('  ' + result.error + ' — falling back to root files only.');

    const roles = Object.keys(result.counts).sort();
    if (roles.length) lines.push('  ' + roles.map((r) => result.counts[r] + ' ' + r).join(', '));

    // Said before the findings, because an unfiled document is the one whose
    // lifetime nobody decided, and those are the ones that rot unnoticed.
    lines.push(...section(result.unfiled.length + ' in no bucket — nobody has said how long these stay true:',
        result.unfiled, 20));

    lines.push(...section(result.unquoted.length + ' cited with no quote — the line number is not checked:',
        result.unquoted, 20));

    const findings = result.findings.slice()
        .sort((a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag) || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));

    if (!findings.length) {
        lines.push('');
        lines.push('Every reference resolves. Whether the prose is still true is not something');
        lines.push('this can see — that is the reading you still have to do.');
        return lines.join('\n');
    }

    lines.push(...section(findings.length + (findings.length === 1 ? ' reference that no longer resolves:' : ' references that no longer resolve:'),
        findings.map((f) => f.tag + ': ' + f.file + ':' + f.line + '  ' + f.what + '  [' + f.role + ']'), MAX_FINDINGS));

    lines.push('');
    lines.push('These are facts, not judgements. A document can have every link working');
    lines.push('and still describe a system that no longer exists.');
    return lines.join('\n');
}

// A declared flag given no value comes back `true` rather than a string, so the
// default is restored by type; `strict: false` keeps an unknown flag silent. A
// repeated `--role` is the last one, which is what the hand-written loop did.
function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, role: { type: 'string' }, quiet: { type: 'boolean' } },
    });
    return {
        root: resolveRoot(values.root),
        roles: typeof values.role === 'string' ? values.role.split(',').map((r) => r.trim()).filter(Boolean) : [],
        quiet: Boolean(values.quiet),
    };
}

function main(argv) {
    const { root, roles, quiet } = parseArgs(argv);
    const result = scan(root, roles);
    const text = report(result);
    // Non-zero when something does not resolve, so a stage rule that runs this
    // cannot pass by not reading the output.
    const bad = !result || result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    if (text) process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { scan, report, parseArgs, resolveRef, LINK, CODE, PATHISH, external, readFile, isMarkdown };
