#!/usr/bin/env node
'use strict';

// Whether Claude Code's own memory for this project still points at
// something real.
//
//   node memory-check.js [--root <project>] [--config-dir <dir>]
//
// Claude Code writes here and never prunes it. Nothing else in this plugin
// ever reads it, so a path a memory entry cites can go dead — or move —
// with nothing noticing but the next person who trusts the entry. This
// reuses `docs-check.js`'s own machinery for the reference-checking half
// rather than writing a second regex for a claim this repository already
// knows how to check.
//
// Only a path whose first segment is a top-level entry this project actually
// tracks is a claim about this project. A survey pass that guessed at "dead"
// paths by pattern alone found six hits that were every one of them a path
// outside the repository — `~/.claude/...`, another project, a
// `.fankeel/build/` scratch fragment — and reporting those is how a checker
// earns being ignored.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const cp = require('node:child_process');
const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { trackedFiles } = require('../lib/tracked.js');
const docs = require('../lib/docs.js');
const { plural, section } = require('../lib/report.js');
const { LINK, CODE, PATHISH, resolveRef, external } = require('./docs-check.js');

const MAX_FINDINGS = 200;

// Two memory files on one subject are a merge the slimmer proposes. The
// measure is the Jaccard ratio of their word sets — name, description and
// body; each Han character one word, any other run of three or more letters
// or digits one word, so `the`, `run` and `中` count and `it`, `on` do not.
// 0.5, because on 2026-10-19 the six pairs of this project's four memory
// files ranged 0.067-0.165 (the top pair cross-links with [[...]]), and one
// fact said twice in different words measured 0.72. A pair is listed, never a
// failing finding, so a false one costs a line.
const SIMILAR = 0.5;
const FRONT = /^---\r?\n[\s\S]*?\r?\n---\r?(?:\n|$)/;
const WORD = /\p{Script=Han}|[\p{L}\p{N}]{3,}/gu;

// `[[name]]`, `[[name|label]]`, `[[name#part]]` — how memory files cite one
// another. docs-check.js's LINK wants `](` and never sees these.
const WIKI = /\[\[([^\]\n|#]+)(?:[|#][^\]\n]*)?\]\]/g;

function wikiLinks(text) {
    const out = [];
    WIKI.lastIndex = 0;
    let m;
    while ((m = WIKI.exec(String(text))) !== null) out.push(m[1].trim());
    return out;
}

function wordSet(text) {
    const fm = docs.frontmatter(text) || {};
    const body = String(text).replace(FRONT, '');
    return new Set([fm.name || '', fm.description || '', body].join(' ').toLowerCase().match(WORD) || []);
}

function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let both = 0;
    for (const w of a) if (b.has(w)) both++;
    return both / (a.size + b.size - both);
}

function similarPairs(files, threshold) {
    const out = [];
    for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
            const ratio = jaccard(files[i].words, files[j].words);
            if (ratio < threshold) continue;
            out.push({
                tag: 'similar', name: files[i].name, other: files[j].name, ratio,
                what: files[i].name + ' and ' + files[j].name + ' share ' + Math.round(ratio * 100) + '% of their words',
            });
        }
    }
    return out;
}

// `F:\ymlab\EMU3000_Web` -> `F--ymlab-EMU3000-Web`. Every character that is
// not a letter or a digit becomes `-` — Claude Code's own scheme, read off
// ~/.claude/projects on 2026-09-24, where `_` and `.` are replaced too.
function projectSlug(root) {
    return path.resolve(root).replace(/[^A-Za-z0-9]/g, '-');
}

function memoryDir(configDir, root) {
    return path.join(configDir, 'projects', projectSlug(root), 'memory');
}

const { readText: readFile } = require('../lib/json.js');

function lineCount(file) {
    const text = readFile(file);
    if (text === null) return null;
    const l = text.split('\n');
    if (l.length && l[l.length - 1] === '') l.pop();
    return l.length;
}

// The last time a real commit touched this path, or null for "never, or this
// is not a repository". `%cI` is the committer date in strict ISO 8601,
// which `Date.parse` reads with no translation step.
function lastCommit(root, rel) {
    try {
        const out = cp.execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { windowsHide: true,
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return out ? Date.parse(out) : null;
    } catch (e) {
        return null;
    }
}

// Every `[title](file.md)` bullet MEMORY.md carries. A bare same-directory
// `.md` name only — a link elsewhere on the page pointing anywhere else is
// not one of the memory files this index is keeping in step with the
// directory.
function indexEntries(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        if (/^[\w.-]+\.md$/.test(ref)) out.push(ref);
    }
    return out;
}

// One memory file's own citations of this project's code, in the same shape
// `docs-check.js` checks a reference document in: a code span shaped like
// `path` or `path:N`, its first segment a root this project actually tracks.
// The state directory is excluded the same way and for the same reason
// `docs-check.js` excludes it — this project's own `.fankeel/docs.json` is
// tracked, and `.fankeel/build/` is not the runtime's promise to keep
// existing.
function citations(text, roots) {
    const out = [];
    CODE.lastIndex = 0;
    let m;
    while ((m = CODE.exec(text)) !== null) {
        const span = m[1].trim();
        if (span.endsWith('/')) continue;
        const hit = PATHISH.exec(span);
        if (!hit) continue;
        const ref = hit[1];
        if (ref === docs.STATE_DIR || ref.startsWith(docs.STATE_DIR + '/')) continue;
        if (!roots.has(ref.split('/')[0])) continue;
        out.push({ ref, wanted: hit[2] ? parseInt(hit[2], 10) : null });
    }
    return out;
}

function scan(root, configDir) {
    const dir = memoryDir(configDir, root);
    const indexFile = path.join(dir, 'MEMORY.md');
    const indexText = readFile(indexFile);
    if (indexText === null) return { dir, present: false, findings: [], stale: [], similar: [], indexed: 0, onDisk: 0 };

    let names;
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'MEMORY.md');
    } catch (e) {
        names = [];
    }
    const onDisk = new Set(names);
    const indexed = indexEntries(indexText);
    const indexedSet = new Set(indexed);

    const findings = [];
    for (const ref of indexed) {
        if (!onDisk.has(ref)) findings.push({ tag: 'index', what: 'MEMORY.md links ' + ref + ', which is not on disk' });
    }
    for (const name of onDisk) {
        if (!indexedSet.has(name)) findings.push({ tag: 'index', what: name + ' is on disk and not linked from MEMORY.md' });
    }

    const tracked = trackedFiles(root);
    const roots = new Set((tracked ? tracked.files : []).map((f) => f.split('/')[0]));

    const texts = new Map();
    for (const name of onDisk) {
        const text = readFile(path.join(dir, name));
        if (text !== null) texts.set(name, text);
    }
    // A [[name]] resolves to a file of that name or to one whose frontmatter
    // `name:` is it.
    const known = new Set();
    for (const [name, text] of texts) {
        known.add(name.replace(/\.md$/, ''));
        const fm = docs.frontmatter(text);
        if (fm && fm.name) known.add(fm.name);
    }

    const stale = [];
    for (const [name, text] of texts) {
        for (const target of wikiLinks(text)) {
            if (!known.has(target)) findings.push({ tag: 'dead', what: name + ' links [[' + target + ']], which is no memory file here' });
        }
        const fm = docs.frontmatter(text) || {};
        const modified = fm['metadata.modified'] ? Date.parse(fm['metadata.modified']) : NaN;

        for (const { ref, wanted } of citations(text, roots)) {
            const found = resolveRef(root, '', ref);
            if (found === null) {
                findings.push({ tag: 'dead', what: name + ' cites ' + ref + ', which no longer exists' });
                continue;
            }
            if (wanted !== null) {
                const n = lineCount(path.join(root, found));
                if (n !== null && wanted > n) {
                    findings.push({ tag: 'past-end', what: name + ' cites ' + ref + ':' + wanted + ' but the file ends at ' + n });
                    continue;
                }
            }
            if (Number.isNaN(modified)) continue;
            const commit = lastCommit(root, found);
            // A correct memory entry can still cite a file that changed after
            // it was written — this is listed, never a failing finding.
            if (commit !== null && modified < commit) {
                stale.push({ tag: 'stale', name, what: name + ' cites ' + ref + ', changed since this entry was last touched' });
            }
        }
    }

    const similar = similarPairs([...texts].map(([name, text]) => ({ name, words: wordSet(text) })), SIMILAR);
    return { dir, present: true, findings, stale, similar, indexed: indexed.length, onDisk: onDisk.size };
}

function report(result) {
    if (!result.present) {
        return 'fankeel memory-check: no native memory yet at ' + result.dir + ' — nothing to check.';
    }
    const lines = [];
    lines.push('fankeel memory-check — ' + result.dir);
    lines.push('  ' + result.indexed + ' indexed, ' + result.onDisk + ' on disk');
    lines.push(...section(result.findings.length + (result.findings.length === 1 ? ' finding:' : ' findings:'),
        result.findings.map((f) => f.tag + ': ' + f.what), MAX_FINDINGS));
    if (!result.findings.length) {
        lines.push('');
        lines.push('Every entry is indexed both ways, and every cited repository path still');
        lines.push('exists where it says it does.');
    }
    const staleEntries = new Set(result.stale.map((f) => f.name)).size;
    lines.push(...section(plural(staleEntries, 'entry cites a file changed since it was written', 'entries cite a file changed since they were written')
        + (result.stale.length === staleEntries ? ':' : ', ' + result.stale.length + ' citations:'),
        result.stale.map((f) => f.what), MAX_FINDINGS));
    const similar = result.similar || [];
    lines.push(...section(plural(similar.length, 'pair of memory files reads as one subject', 'pairs of memory files read as one subject')
        + ' — a merge for the slimmer to propose:', similar.map((f) => f.what), MAX_FINDINGS));
    return lines.join('\n');
}

function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, 'config-dir': { type: 'string' }, quiet: { type: 'boolean' } },
    });
    return {
        root: resolveRoot(values.root),
        configDir: typeof values['config-dir'] === 'string' && values['config-dir'] ? path.resolve(values['config-dir']) : liveConfigDir(),
        quiet: Boolean(values.quiet),
    };
}

function main(argv) {
    const { root, configDir, quiet } = parseArgs(argv);
    const result = scan(root, configDir);
    const text = report(result);
    const bad = result.present && result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    if (text) process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { scan, report, parseArgs, main, projectSlug, memoryDir, indexEntries, citations, lastCommit, wikiLinks, wordSet, jaccard, similarPairs, SIMILAR };
